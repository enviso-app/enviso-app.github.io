/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useSettings} from '@/context';
import {parseHTML, parseJSON} from '@/lib/parse';
import {RefusedIllustration} from '@/components/Illustrations';
import {creditsFromFacts} from '@/lib/creditsFallback';
import {
  buildSectionPrompt,
  buildShellPrompt,
  clearMarkers,
  planSections,
  stitchSection,
} from '@/lib/explainerPrompts';
import {
  DIAGRAM_RESPONSE_SCHEMA,
  FACTS_FROM_PAPER_PROMPT,
  SPEC_FROM_DIAGRAM_PROMPT,
  buildSpecAddendum,
  JSON_ONLY_INSTRUCTION,
  PAPER_RESPONSE_SCHEMA,
  SPEC_FROM_PAPER_PROMPT,
  SPEC_FROM_VIDEO_PROMPT,
  SPEC_RESPONSE_SCHEMA,
  VARIATIONS,
  type VariationKind,
  paperUrlInstruction,
} from '@/lib/prompts';
import {
  type RejectionReason,
  type Screening,
  VideoRejectedError,
  assertUsable,
  isOverridable,
} from '@/lib/screening';
import {
  type CopyOutcome,
  type SaveOutcome,
  copyHtml,
  downloadHtml,
  toFileName,
} from '@/lib/download';
import {saveHistory} from '@/lib/history';
import {withWorkingNav} from '@/lib/injectNav';
import {appLink, shareLink} from '@/lib/deeplink';
import {expandPaperUrl, type Source} from '@/lib/source';
import {currentPalette, haptic, notify, shareToChat} from '@/lib/telegram';
import {
  DailyQuotaError,
  OverloadedError,
  acrossModels,
  filePart,
  generateText,
  generateTextStream,
  resolveModels,
  videoPart,
} from '@/lib/textGeneration';
import {useCallback, useEffect, useRef, useState} from 'react';

interface ContentContainerProps {
  source: Source;
  /** A finished generation reopened from history, rather than a new one. */
  restored?: {spec: string; code: string; summary?: string; title?: string};
  onLoadingStateChange?: (isLoading: boolean) => void;
}

type LoadingState = 'loading-spec' | 'loading-code' | 'ready' | 'error';

const TABS = ['app', 'spec'] as const;

/**
 * Appended when the user overrules a refusal.
 *
 * The screening step is told to stop and write nothing when it judges a source
 * unsuitable, so overriding has to say plainly that the judgement is not
 * wanted -- otherwise it returns the same empty spec again.
 */
const OVERRIDE_INSTRUCTION = `

IMPORTANT OVERRIDE: the person who chose this source has already seen your assessment and disagrees. They know the material and want it built. Do NOT refuse, and do NOT return an empty spec. Set "teachable" to true and "contentKind" to "educational", and write the best spec you can from whatever the source does contain. If parts were unclear to you, work from the parts that were clear.`;

/**
 * Parts of the site generated at the same time.
 *
 * Bounded by the key's rate limit, which belongs to the key and not to any
 * model: every part in flight spends the same per-minute allowance, so going
 * wide caused the limit it was meant to outrun. Two is the point where a free
 * key keeps up.
 */
const PART_CONCURRENCY = 2;

export default function ContentContainer({
  source,
  restored,
  onLoadingStateChange,
}: ContentContainerProps) {
  const {t, apiKey} = useSettings();

  const [spec, setSpec] = useState(restored?.spec ?? '');
  const [code, setCode] = useState(restored?.code ?? '');
  const factsRef = useRef('');
  const identityRef = useRef('');
  const planRef = useRef<ReturnType<typeof planSections>>([]);
  const [summary, setSummary] = useState<{text?: string; title?: string}>(
    restored ? {text: restored.summary, title: restored.title} : {},
  );
  const [streamed, setStreamed] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(
    restored ? 'ready' : 'loading-spec',
  );
  const [showPlan, setShowPlan] = useState(false);
  const [saveState, setSaveState] = useState<SaveOutcome | null>(null);
  const [copyState, setCopyState] = useState<CopyOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<VideoRejectedError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [editedSpec, setEditedSpec] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  // Mounting means Generate was just pressed, so the output takes the screen
  // immediately -- the wait and the result both deserve the whole viewport.
  const [fullScreen, setFullScreen] = useState(true);

  // Generation is expensive and paid for out of the user's own quota, so it
  // must fire exactly once per mount no matter how often effects re-run.
  const startedRef = useRef(false);
  // Set when the user overrules a refusal, so the next run does not repeat it.
  const overrideRef = useRef(false);
  // False once this view is gone. A generation the user walked away from must
  // stop spending their quota at the next step, and must not land in history.
  const aliveRef = useRef(true);
  // The summary as it is now, not as it was when runGeneration was created.
  // runGeneration is made on the first render, so reading summary state from
  // inside it saw the empty value and saved every app under its raw URL.
  const summaryRef = useRef(summary);
  summaryRef.current = summary;

  useEffect(() => {
    onLoadingStateChange?.(
      loadingState === 'loading-spec' || loadingState === 'loading-code',
    );
  }, [loadingState, onLoadingStateChange]);

  /*
   * Leaving mid-generation -- switching mode, opening another app -- used to
   * leave the page reporting "Generating..." forever, with the input and the
   * button both disabled until a reload. Unmounting always reports idle.
   */
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      onLoadingStateChange?.(false);
    };
  }, []);

  /**
   * Build the screening request for whichever source we were given.
   *
   * A file or a video can use structured output, but the URL path needs the
   * retrieval tool, and tools do not combine reliably with a response schema
   * -- so that one asks for JSON in words and leans on the tolerant parser.
   */
  const sourceRequest = useCallback(
    (prompt: string, schema: unknown | null) => {
      if (source.kind === 'video') {
        return {
          prompt,
          attachments: [videoPart(source.url)],
          config: schema
            ? {responseMimeType: 'application/json', responseSchema: schema as never}
            : {},
        };
      }

      // A diagram and an uploaded paper are the same request shape: a file
      // inlined beside the prompt, with structured output asked for directly.
      if (source.kind === 'diagram' || source.via === 'file') {
        return {
          prompt,
          attachments: [filePart(source.mimeType, source.base64)],
          config: schema
            ? {responseMimeType: 'application/json', responseSchema: schema as never}
            : {},
        };
      }

      // The URL path needs the retrieval tool, and tools do not combine
      // reliably with a response schema, so it states the shape in words.
      return {
        prompt:
          prompt +
          paperUrlInstruction(
            source.candidates?.length
              ? source.candidates
              : expandPaperUrl(source.url),
          ) +
          (schema ? JSON_ONLY_INSTRUCTION : ''),
        attachments: [],
        config: {tools: [{urlContext: {}}]},
      };
    },
    [source],
  );

  /**
   * Read the source once, twice over.
   *
   * The plan and the data layer are asked for separately and at the same
   * time. Together they were the slowest response in the pipeline -- a
   * verdict, a plan, two summaries, an identity, a section list and a
   * thousand lines of tables in one output. Apart, they cost a second read
   * and halve the wait.
   */
  const generateSpecFromSource = useCallback(async () => {
    const models = await resolveModels(apiKey!);
    const chain = [
      models.spec,
      ...models.chain.filter((id) => id !== models.spec),
    ];

    const hooks = {
      onSwitch: (nextModel: string) =>
        setNotice(`${t.switchingModel}: ${nextModel}`),
      onWait: (waitMs: number) =>
        setNotice(`${t.allBusy} ${Math.round(waitMs / 1000)}${t.seconds}`),
      onQuota: (waitMs: number) =>
        setNotice(`${t.quotaWait} ${Math.round(waitMs / 1000)}${t.seconds}`),
    };

    const ask = (
      prompt: string,
      schema: unknown | null,
      extra: Record<string, unknown> = {},
    ) => {
      const request = sourceRequest(
        overrideRef.current ? prompt + OVERRIDE_INSTRUCTION : prompt,
        schema,
      );
      return acrossModels(
        chain,
        (modelName) =>
          generateText({
            apiKey: apiKey!,
            modelName,
            prompt: request.prompt,
            attachments: request.attachments,
            config: {...request.config, ...extra},
          }),
        hooks,
      );
    };

    const paper = source.kind === 'paper';

    const specPrompt =
      source.kind === 'video'
        ? SPEC_FROM_VIDEO_PROMPT
        : source.kind === 'diagram'
          ? SPEC_FROM_DIAGRAM_PROMPT
          : SPEC_FROM_PAPER_PROMPT;

    const specSchema =
      source.kind === 'video'
        ? SPEC_RESPONSE_SCHEMA
        : source.kind === 'diagram'
          ? DIAGRAM_RESPONSE_SCHEMA
          : PAPER_RESPONSE_SCHEMA;

    const [planText, factsText] = await Promise.all([
      ask(specPrompt, specSchema),
      // Only a paper has a data layer to extract. A video or a diagram
      // becomes one self-contained app, built in a single pass.
      paper
        ? ask(FACTS_FROM_PAPER_PROMPT, null, {
            thinkingConfig: {thinkingLevel: 'LOW' as never},
          }).catch((err) => {
            console.warn('Facts extraction failed:', err);
            return '';
          })
        : Promise.resolve(''),
    ]);

    const screening = parseJSON(planText) as Screening;
    console.info('Screening:', screening);

    // Throws VideoRejectedError when the source breaks one of the guards,
    // unless the user has already looked at the refusal and disagreed.
    if (!overrideRef.current) assertUsable(screening, source.kind);

    factsRef.current = factsText || screening.facts || '';
    identityRef.current = screening.identity ?? '';
    planRef.current = planSections(screening.sections, source.kind);

    const nextSummary = {text: screening.summaryEn, title: screening.title};
    summaryRef.current = nextSummary;
    setSummary(nextSummary);

    return screening.spec;
  }, [
    apiKey,
    source,
    sourceRequest,
    t.switchingModel,
    t.allBusy,
    t.quotaWait,
    t.seconds,
  ]);

  /** One call against the best model the key can reach. */
  const runOnBestModel = useCallback(
    async (prompt: string, stream = true) => {
      const models = await resolveModels(apiKey!);
      const chain = [
        models.code,
        ...models.chain.filter((id) => id !== models.code),
      ];

      return acrossModels(
        chain,
        (modelName) =>
          generateTextStream({
            apiKey: apiKey!,
            modelName,
            prompt,
            onChunk: stream ? setStreamed : undefined,
          }),
        {
          onSwitch: (nextModel) => {
            if (stream) setStreamed('');
            setNotice(`${t.switchingModel}: ${nextModel}`);
          },
          onWait: (waitMs) =>
            setNotice(`${t.allBusy} ${Math.round(waitMs / 1000)}${t.seconds}`),
          onQuota: (waitMs) =>
            setNotice(`${t.quotaWait} ${Math.round(waitMs / 1000)}${t.seconds}`),
        },
      );
    },
    [apiKey, t.switchingModel, t.allBusy, t.quotaWait, t.seconds],
  );

  /**
   * Explainer sites are written in parts, and every part at once.
   *
   * One generation has one output budget and a whole site does not fit in it.
   * The sections used to wait for the shell so they could reuse its CSS
   * classes -- but the styling is Tailwind now, so the vocabulary comes from
   * the brief rather than from the shell, and nothing has to wait for anything
   * else. The shell is simply one more job in the same pool.
   */
  const generateSite = useCallback(
    async (baseSpec: string) => {
      const kind = source.kind;
      const facts = factsRef.current;
      const identity = identityRef.current;
      const sections = planRef.current.length
        ? planRef.current
        : planSections(null, kind);

      type Job = {kind: 'shell'} | {kind: 'section'; index: number};
      const jobs: Job[] = [
        {kind: 'shell'},
        ...sections.map((_, index) => ({kind: 'section' as const, index})),
      ];

      const total = jobs.length;
      let shell = '';
      const written: (string | null)[] = new Array(sections.length).fill(null);
      let done = 0;
      let next = 0;

      setNotice(`${t.buildingPart} 1/${total}`);

      // One attempt here: runOnBestModel already walks five models over two
      // sweeps, so retrying on top of that multiplied a slow failure into a
      // wait nobody sits through. Credits has a data-built fallback instead.
      const attempt = async (prompt: string, stream: boolean) => {
        try {
          return parseHTML(await runOnBestModel(prompt, stream));
        } catch (err) {
          console.warn('Part failed:', err);
          return null;
        }
      };

      const worker = async () => {
        for (let i = next++; i < jobs.length; i = next++) {
          if (!aliveRef.current) return;
          const job = jobs[i];

          if (job.kind === 'shell') {
            shell =
              (await attempt(
                buildShellPrompt(baseSpec, facts, sections, identity, kind),
                true,
              )) ?? '';
          } else {
            written[job.index] = await attempt(
              buildSectionPrompt(
                sections[job.index],
                baseSpec,
                facts,
                identity,
                kind,
              ),
              false,
            );
          }

          done += 1;
          setNotice(`${t.buildingPart} ${Math.min(done + 1, total)}/${total}`);
        }
      };

      await Promise.all(
        Array.from({length: Math.min(PART_CONCURRENCY, jobs.length)}, worker),
      );

      if (!shell) throw new Error('The site shell could not be written.');

      let assembled = shell;
      sections.forEach((section, index) => {
        const html = written[index];
        if (html) {
          assembled = stitchSection(assembled, section.key, html);
        } else if (section.key === 'credits') {
          // Attribution is pure data, so it never needs a model to survive.
          assembled = stitchSection(
            assembled,
            section.key,
            creditsFromFacts(facts),
          );
        }
      });

      return clearMarkers(assembled);
    },
    [runOnBestModel, source.kind, t.buildingPart],
  );

  /**
   * A paper is built in parts; a video is not.
   *
   * The multi-part machinery exists because a research site does not fit in
   * one output budget. A learning app does, and building it in pieces made it
   * read like a document assembled from sections rather than one thing.
   */
  const generateCodeFromSpec = useCallback(
    async (baseSpec: string) => {
      if (source.kind === 'paper') return generateSite(baseSpec);

      const prompt = baseSpec + buildSpecAddendum(currentPalette(), source.kind);
      return parseHTML(await runOnBestModel(prompt));
    },
    [source.kind, runOnBestModel, generateSite],
  );

  const runGeneration = useCallback(async () => {
    try {
      setLoadingState('loading-spec');
      setError(null);
      setRejection(null);
      setNotice(null);
      setSpec('');
      setCode('');
      setStreamed('');

      const generatedSpec = await generateSpecFromSource();
      // Gone while the plan was being written: the build is the expensive
      // half, so do not start it for nobody.
      if (!aliveRef.current) return;
      setSpec(generatedSpec);
      setLoadingState('loading-code');

      const generatedCode = await generateCodeFromSpec(generatedSpec);
      if (!aliveRef.current) return;
      setCode(generatedCode);
      setStreamed('');
      setLoadingState('ready');
      notify('success');
      void remember(generatedSpec, generatedCode);
    } catch (err) {
      if (err instanceof VideoRejectedError) {
        console.info('Video rejected:', err.reason, err.detail ?? '');
        setRejection(err);
        setLoadingState('error');
        notify('warning');
        return;
      }

      console.error('Generation failed:', err);
      setError(
        err instanceof DailyQuotaError
          ? t.quotaDaily
          : err instanceof OverloadedError
            ? t.busyGaveUp
            : err instanceof Error
              ? err.message
              : String(err),
      );
      setLoadingState('error');
      notify('error');
    }
  }, [generateSpecFromSource, generateCodeFromSpec, t.busyGaveUp, t.quotaDaily]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // A restored item is already finished; regenerating it would spend quota
    // to reproduce something the user is looking at.
    if (restored) return;
    void runGeneration();
  }, [runGeneration, restored]);

  useEffect(() => {
    if (!fullScreen) return;
    // Always cleared rather than restored to whatever was captured: if this
    // ever ran twice, the captured value would itself be 'hidden' and the
    // page would stay locked with no way back.
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullScreen]);

  // Remount the preview whenever the code changes, including manual edits.
  useEffect(() => {
    if (code) setIframeKey((k) => k + 1);
  }, [code]);

  /** Store a finished generation so closing the app does not lose it. */
  const remember = async (finalSpec: string, finalCode: string) => {
    const sourceUrl =
      source.kind === 'video'
        ? source.url
        : source.kind === 'paper' && source.via === 'url'
          ? source.url
          : undefined;

    await saveHistory({
      kind: source.kind,
      title: summaryTitle(),
      sourceUrl,
      spec: finalSpec,
      code: finalCode,
      summary: summaryRef.current.text,
    });
  };

  const summaryTitle = () =>
    summaryRef.current.title?.trim() ||
    (source.kind === 'video'
      ? source.url
      : source.kind === 'diagram'
        ? source.name
        : source.via === 'url'
          ? source.url
          : source.name);

  /** Rebuild from the same plan with a nudge -- one call, not two. */
  const handleVariation = async (kind: VariationKind) => {
    if (isBusy || !spec) return;
    haptic('medium');
    setActiveTab(0);

    try {
      setLoadingState('loading-code');
      setError(null);
      setStreamed('');
      const generated = await generateCodeFromSpec(spec + VARIATIONS[kind]);
      setCode(generated);
      setStreamed('');
      setLoadingState('ready');
      notify('success');
      void remember(spec, generated);
    } catch (err) {
      console.error('Variation failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLoadingState('error');
      notify('error');
    }
  };

  const handleSave = async () => {
    if (!code) return;
    haptic('medium');
    const outcome = await downloadHtml(toFileName(summaryTitle()), code);
    setSaveState(outcome);
    // Not 'success': the download starting is not the file arriving, and a
    // congratulatory buzz over a file that never landed is the same lie the
    // label used to tell.
    notify(outcome === 'failed' ? 'error' : 'warning');
  };

  const handleCopy = async () => {
    if (!code) return;
    haptic('medium');
    const outcome = await copyHtml(code);
    setCopyState(outcome);
    notify(outcome === 'copied' ? 'success' : 'error');
  };

  const saveLabel =
    saveState === 'attempted'
      ? t.saveStarted
      : saveState === 'failed'
        ? t.saveFailedMsg
        : t.save;

  const copyLabel =
    copyState === 'copied'
      ? t.copied
      : copyState === 'failed'
        ? t.copyFailedMsg
        : t.copy;

  const canShare = shareLink(source) !== null;

  const handleShare = () => {
    const link = shareLink(source);
    if (!link) return;
    haptic();

    // Name the app in the message. A shared link that says only "look at
    // this paper" tells nobody where the thing they are looking at came from.
    const lead = source.kind === 'paper' ? t.shareTextPaper : t.shareTextVideo;
    const home = appLink();
    const message = home
      ? `${lead} ${summaryTitle()}

${t.shareFooter} ${home}`
      : `${lead} ${summaryTitle()}`;

    shareToChat(link, message);
  };

  const handleRetry = () => {
    haptic();
    overrideRef.current = false;
    void runGeneration();
  };

  /** The user has read the refusal and disagreed with it. */
  const handleOverride = () => {
    haptic('medium');
    overrideRef.current = true;
    setRejection(null);
    void runGeneration();
  };

  const handleSpecSave = async () => {
    const trimmed = editedSpec.trim();
    setIsEditingSpec(false);

    if (!trimmed || trimmed === spec) return;

    haptic();
    setSpec(trimmed);
    setActiveTab(0);

    try {
      setLoadingState('loading-code');
      setError(null);
      setStreamed('');
      const generatedCode = await generateCodeFromSpec(trimmed);
      setCode(generatedCode);
      setStreamed('');
      setLoadingState('ready');
      notify('success');
      void remember(trimmed, generatedCode);
    } catch (err) {
      console.error('Rebuild failed:', err);
      setError(err instanceof Error ? err.message : String(err));
      setLoadingState('error');
      notify('error');
    }
  };

  const isBusy =
    loadingState === 'loading-spec' || loadingState === 'loading-code';

  const renderProgress = () => (
    <div className="state-panel">
      <div className="spinner" />
      <p className="state-text">
        {loadingState !== 'loading-spec'
          ? t.loadingCode
          : source.kind === 'video'
            ? t.loadingSpec
            : source.kind === 'diagram'
              ? t.loadingDiagram
              : t.loadingPaper}
      </p>
      {notice && <p className="state-notice">{notice}</p>}

      {/* The plan lands well before the app does, so the wait is spent
          reading what is coming rather than watching a spinner. */}
      {loadingState === 'loading-code' && activeSummary() && (
        <div className="wait-summary">
          {summary.title && <p className="wait-title display">{summary.title}</p>}
          <p className="wait-text">{activeSummary()}</p>
          {streamed && (
            <p className="wait-progress">
              {t.buildingNow} {Math.round(streamed.length / 1024)} KB
            </p>
          )}
        </div>
      )}

      <p className="hint state-sub">{t.stillWorking}</p>
    </div>
  );

  const rejectionMessage = (err: VideoRejectedError) => {
    const messages: Record<RejectionReason, string> = {
      tooLong: t.rejectTooLong,
      language: t.rejectLanguage,
      music: t.rejectMusic,
      noSpeech: t.rejectNoSpeech,
      notEducational: t.rejectNotEducational,
      unreadable: t.rejectUnreadable,
      notResearch: t.rejectNotResearch,
      illegible: t.rejectIllegible,
    };
    return messages[err.reason].replace('{lang}', err.detail ?? '');
  };

  const renderRejection = (err: VideoRejectedError) => (
    <div className="state-panel">
      <RefusedIllustration className="state-art" />
      <p className="state-title reject-title display">
        {source.kind === 'paper'
          ? t.rejectTitlePaper
          : source.kind === 'diagram'
            ? t.rejectTitleDiagram
            : t.rejectTitle}
      </p>
      <p className="state-detail reject-detail">{rejectionMessage(err)}</p>

      {/* The model's own sentence. Without it a refusal is unarguable. */}
      {err.said && (
        <p className="reject-said">
          <span className="reject-said-label">{t.rejectWhy}</span> {err.said}
        </p>
      )}

      {isOverridable(err.reason) && (
        <button className="button-secondary" onClick={handleOverride}>
          {t.generateAnyway}
        </button>
      )}
    </div>
  );

  const activeSummary = () => summary.text;

  const renderError = () => (
    <div className="state-panel">
      <p className="state-title">{t.error}</p>
      <p className="state-detail">{error}</p>
      <button className="button-primary" onClick={handleRetry}>
        {t.retry}
      </button>
    </div>
  );

  const renderApp = () => {
    if (rejection) return renderRejection(rejection);
    if (loadingState === 'error') return renderError();
    if (loadingState !== 'ready') return renderProgress();
    return (
      <div className={fullScreen ? 'preview preview-full' : 'preview'}>
        <iframe
          key={iframeKey}
          srcDoc={withWorkingNav(code)}
          title="generated-app"
          sandbox="allow-scripts allow-popups"
          className="preview-frame"
        />
      </div>
    );
  };

  /**
   * The learner-facing tab.
   *
   * It used to show the raw build brief, which is written for a developer and
   * says nothing a learner wants. The plan is still reachable, but it is now a
   * disclosure rather than the default.
   */
  const renderAbout = () => {
    if (rejection) return renderRejection(rejection);
    if (loadingState === 'loading-spec') return renderProgress();
    if (loadingState === 'error' && !spec) return renderError();

    if (isEditingSpec) {
      return (
        <div className="pane">
          <textarea
            className="spec-editor"
            value={editedSpec}
            onChange={(e) => setEditedSpec(e.target.value)}
          />
          <div className="pane-actions">
            <button
              className="button-primary"
              onClick={handleSpecSave}
              disabled={isBusy}>
              {t.saveRegenerate}
            </button>
            <button
              className="button-secondary"
              onClick={() => setIsEditingSpec(false)}>
              {t.cancel}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="pane about-pane">
        <div className="about-scroll">
          {summary.title && <h3 className="about-title display">{summary.title}</h3>}
          <div className="rule" />
          <p className="about-heading">{t.aboutHeading}</p>
          <p className="about-text">{activeSummary() || spec.slice(0, 400)}</p>

          {loadingState === 'ready' && (
            <div className="variations">
              <p className="about-heading">{t.variationsTitle}</p>
              <div className="variation-row">
                <button
                  className="button-secondary variation"
                  disabled={isBusy}
                  onClick={() => handleVariation('simpler')}>
                  {t.variationSimpler}
                </button>
                <button
                  className="button-secondary variation"
                  disabled={isBusy}
                  onClick={() => handleVariation('visual')}>
                  {t.variationVisual}
                </button>
                <button
                  className="button-secondary variation"
                  disabled={isBusy}
                  onClick={() => handleVariation('quiz')}>
                  {t.variationQuiz}
                </button>
              </div>
            </div>
          )}

          <button
            className="button-ghost plan-toggle"
            onClick={() => {
              haptic();
              setShowPlan((open) => !open);
            }}>
            {showPlan ? `− ${t.tabPlan}` : `+ ${t.tabPlan}`}
          </button>

          {showPlan && (
            <>
              <div className="spec-text">{spec}</div>
              <button
                className="button-secondary"
                disabled={isBusy || !spec}
                onClick={() => {
                  haptic();
                  setEditedSpec(spec);
                  setIsEditingSpec(true);
                }}>
                {t.edit}
              </button>
            </>
          )}
        </div>

        {loadingState === 'ready' && (
          <>
            <div className="pane-actions">
              <button className="button-primary" onClick={handleSave}>
                {saveLabel}
              </button>
              <button className="button-secondary" onClick={handleCopy}>
                {copyLabel}
              </button>
              {canShare && (
                <button className="button-secondary" onClick={handleShare}>
                  {t.share}
                </button>
              )}
            </div>
            {/*
              Only after an attempt, and only until the copy lands: a browser
              that swallows downloads gives no signal, so the way out is
              offered rather than the outcome asserted.
            */}
            {saveState === 'attempted' && copyState !== 'copied' && (
              <p className="hint save-unsure">{t.saveUnsure}</p>
            )}
          </>
        )}
      </div>
    );
  };

  const labels = [t.tabApp, t.tabSpec];

  return (
    <div className={fullScreen ? 'container container-full' : 'container'}>
      <div className="tabs" role="tablist">
        {TABS.map((tab, index) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === index}
            className={activeTab === index ? 'tab tab-active' : 'tab'}
            onClick={() => {
              haptic();
              setActiveTab(index);
            }}>
            {labels[index]}
          </button>
        ))}
        <button
          className="tab-action"
          aria-label={fullScreen ? t.closeFull : t.openFull}
          title={fullScreen ? t.closeFull : t.openFull}
          onClick={() => {
            haptic();
            setFullScreen((v) => !v);
          }}>
          {fullScreen ? '✕' : '⤡'}
        </button>
      </div>

      <div className="tab-body">
        {activeTab === 0 && renderApp()}
        {activeTab === 1 && renderAbout()}
      </div>

      <style>{`
        .container {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          min-height: 420px;
          height: 100%;
          overflow: hidden;
        }

        .container-full {
          background: var(--color-background);
          border: none;
          border-radius: 0;
          bottom: 0;
          /* Telegram's usable height, which is not the same as the viewport
             once its own header is accounted for. */
          height: var(--tg-viewport-height, 100dvh);
          left: 0;
          padding-bottom: env(safe-area-inset-bottom);
          position: fixed;
          right: 0;
          top: 0;
          z-index: 50;
        }

        .tabs {
          border-bottom: 1px solid var(--color-border);
          display: flex;
          flex: 0 0 auto;
          gap: 0.25rem;
          padding: 0.35rem;
        }

        .tab {
          background: transparent;
          border-radius: 8px;
          color: var(--color-hint);
          flex: 1;
          font-size: 0.9rem;
          min-height: 44px;
          padding: 0.4rem 0.5rem;
        }

        .tab-active {
          background: var(--color-surface);
          color: var(--color-text);
        }

        .tab-body {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
        }

        .pane {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 0.6rem;
          min-height: 0;
          padding: 0.75rem;
        }

        .save-unsure {
          font-size: 0.8rem;
          margin: 0.5rem 0 0;
        }

        .pane-actions {
          align-items: center;
          display: flex;
          flex: 0 0 auto;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .preview {
          flex: 1;
          min-height: 0;
          position: relative;
        }

        .preview-frame {
          border: none;
          display: block;
          height: 100%;
          width: 100%;
        }

        .tab-action {
          background: transparent;
          border-radius: 8px;
          color: var(--color-hint);
          flex: 0 0 auto;
          font-size: 1rem;
          line-height: 1;
          min-height: 44px;
          min-width: 44px;
          padding: 0.4rem 0.7rem;
        }

        .tab-action:active {
          background: var(--color-surface);
        }

        .spec-editor {
          flex: 1;
          font-family: var(--font-primary);
          font-size: 15px;
          line-height: 1.5;
          min-height: 240px;
          overflow: auto;
          resize: none;
          white-space: pre-wrap;
        }

        .spec-text {
          flex: 1;
          line-height: 1.6;
          min-height: 0;
          overflow: auto;
          white-space: pre-wrap;
        }

        .state-art {
          color: var(--color-hint);
          height: auto;
          max-width: 150px;
          opacity: 0.9;
        }

        .about-pane {
          gap: 0.9rem;
        }

        .about-scroll {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 0;
          overflow: auto;
        }

        .about-title {
          font-size: 1.25rem;
        }

        .about-heading {
          color: var(--color-hint);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .about-text {
          font-size: 1rem;
          line-height: 1.6;
        }

        .variations {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .variation-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .variation {
          flex: 1 1 30%;
          font-size: 0.85rem;
          font-weight: 500;
          min-height: 40px;
          padding: 0.4rem 0.6rem;
        }

        .plan-toggle {
          align-self: flex-start;
          padding-left: 0;
        }

        .wait-summary {
          background: var(--color-surface);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 42ch;
          padding: 0.9rem 1rem;
          text-align: left;
        }

        .wait-title {
          font-size: 1.05rem;
        }

        .wait-text {
          font-size: 0.92rem;
          line-height: 1.55;
        }

        .wait-progress {
          color: var(--color-hint);
          font-size: 0.75rem;
        }

        .state-panel {
          align-items: center;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 0.75rem;
          justify-content: center;
          padding: 1.5rem 1rem;
          text-align: center;
        }

        .state-text {
          font-size: 1rem;
          font-weight: 600;
        }

        .reject-title {
          color: var(--color-text);
        }

        .reject-detail {
          font-size: 0.95rem;
          max-width: 40ch;
        }

        .reject-said {
          background: var(--color-surface);
          border-radius: 8px;
          color: var(--color-hint);
          font-size: 0.82rem;
          line-height: 1.5;
          max-width: 40ch;
          padding: 0.6rem 0.75rem;
          text-align: left;
        }

        .reject-said-label {
          font-weight: 700;
        }

        .state-title {
          color: var(--color-error);
          font-size: 1.1rem;
          font-weight: 700;
        }

        .state-detail {
          color: var(--color-hint);
          font-size: 0.9rem;
          max-width: 34ch;
          word-break: break-word;
        }

        .state-notice {
          background: var(--color-surface);
          border-radius: 8px;
          color: var(--color-hint);
          font-size: 0.8rem;
          padding: 0.4rem 0.65rem;
        }

        .state-sub {
          font-size: 0.8rem;
        }

        .stream-tail {
          background: var(--color-surface);
          border-radius: 8px;
          color: var(--color-hint);
          font-family: var(--font-mono);
          font-size: 10px;
          line-height: 1.4;
          margin: 0;
          max-height: 130px;
          overflow: hidden;
          padding: 0.6rem;
          text-align: left;
          white-space: pre-wrap;
          width: 100%;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
