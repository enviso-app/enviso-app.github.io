/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Chooser from '@/components/Chooser';
import ContentContainer from '@/components/ContentContainer';
import HistoryList from '@/components/HistoryList';
import {
  DiagramIllustration,
  EmptyIllustration,
  PaperIllustration,
} from '@/components/Illustrations';
import AnnouncementCard from '@/components/AnnouncementCard';
import KeyGate from '@/components/KeyGate';
import {useSettings} from '@/context';
import {lookupPaper} from '@/lib/paperLookup';
import {isTooLong} from '@/lib/screening';
import {
  DIAGRAM_ACCEPT,
  type LinkHint,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  type Source,
  type SourceKind,
  isPdfFile,
  isPictureFile,
  linkHintFor,
  looksLikeUrl,
  readFileAsBase64,
} from '@/lib/source';
import {decodeSource} from '@/lib/deeplink';
import {type HistoryItem, listHistory} from '@/lib/history';
import {
  haptic,
  isTelegram,
  setMainButton,
  showBackButton,
  startParam,
} from '@/lib/telegram';
import {
  getVideoDurationSeconds,
  getYoutubeEmbedUrl,
  validateYoutubeUrl,
} from '@/lib/youtube';
import {useEffect, useRef, useState} from 'react';

export default function App() {
  const {t, apiKey, keyLoading} = useSettings();

  const [mode, setMode] = useState<SourceKind | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [pdf, setPdf] = useState<{name: string; mimeType: string; base64: string} | null>(null);
  const [picture, setPicture] = useState<{name: string; mimeType: string; base64: string} | null>(null);
  const [linkHint, setLinkHint] = useState<LinkHint | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [restored, setRestored] = useState<HistoryItem | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [checkingSource, setCheckingSource] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pictureRef = useRef<HTMLInputElement>(null);

  const videoUrl = source?.kind === 'video' ? source.url : '';

  const busy = contentLoading || checkingSource;

  const handleSubmit = async () => {
    if (busy) return;
    haptic('medium');
    setUrlError(null);

    const next =
      mode === 'video'
        ? await prepareVideo()
        : mode === 'diagram'
          ? prepareDiagram()
          : await preparePaper();
    if (!next) return;

    start(next);
  };

  /** Validate a YouTube URL and check its length before anything is spent. */
  const prepareVideo = async (): Promise<Source | null> => {
    const value = inputRef.current?.value.trim() || '';
    if (!value) {
      inputRef.current?.focus();
      return null;
    }

    const {isValid} = await validateYoutubeUrl(value);
    if (!isValid) {
      setUrlError(t.invalidUrl);
      return null;
    }

    // Length is checked here, before Gemini sees anything: watching an hour of
    // video is the most expensive request the app can make, and refusing it
    // afterwards would already have spent the user's quota.
    setCheckingSource(true);
    const seconds = await getVideoDurationSeconds(value);
    setCheckingSource(false);

    if (isTooLong(seconds)) {
      setUrlError(`${t.rejectTooLong} (${Math.round((seconds ?? 0) / 60)} min)`);
      return null;
    }

    return {kind: 'video', url: value};
  };

  /** An uploaded PDF wins over a link: it is the more reliable of the two. */
  const preparePaper = async (): Promise<Source | null> => {
    if (pdf) {
      return {kind: 'paper', via: 'file', ...pdf};
    }

    const value = inputRef.current?.value.trim() || '';
    if (!value || !looksLikeUrl(value)) {
      setUrlError(t.paperNeedInput);
      return null;
    }

    // A PubMed page is only ever an abstract and a DOI is only a redirect, so
    // look the paper up and hand the model somewhere the full text lives.
    setCheckingSource(true);
    const record = await lookupPaper(value);
    setCheckingSource(false);

    if (record?.title) setResolved(record.title);

    if (record?.openAccess) {
      // The warning was about the link, and the link has been replaced.
      setLinkHint(null);
    } else if (record) {
      // Known in advance, so say it now rather than after a spent generation.
      setLinkHint('paywall');
    }

    return {
      kind: 'paper',
      via: 'url',
      url: value,
      candidates: record?.candidates,
      title: record?.title,
    };
  };

  /**
   * A picture needs no validation beyond having been picked.
   *
   * There is no link to resolve and no length to measure -- the only thing
   * that could be wrong is the file itself, and reading it already failed
   * loudly at the point it was chosen.
   */
  const prepareDiagram = (): Source | null => {
    if (!picture) {
      setUrlError(t.diagramNeedFile);
      return null;
    }
    return {kind: 'diagram', ...picture};
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUrlError(null);

    // The accept attribute only filters the picker; "All files" walks past
    // it, and a drag-and-drop never saw it at all.
    if (!isPdfFile(file)) {
      setPdf(null);
      setUrlError(t.paperWrongType);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setPdf(null);
      setUrlError(t.paperTooBig);
      return;
    }

    try {
      setPdf(await readFileAsBase64(file));
      // The PDF supersedes the link, so its warning no longer applies.
      setLinkHint(null);
      haptic();
    } catch (error) {
      console.error('Could not read the PDF:', error);
      setUrlError(t.paperTooBig);
    }
  };

  const handlePicture = async (file: File | undefined) => {
    if (!file) return;
    setUrlError(null);

    if (!isPictureFile(file)) {
      setPicture(null);
      setUrlError(t.diagramWrongType);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setPicture(null);
      setUrlError(t.diagramTooBig);
      return;
    }

    try {
      setPicture(await readFileAsBase64(file));
      haptic();
    } catch (error) {
      console.error('Could not read the picture:', error);
      setUrlError(t.diagramUnreadable);
    }
  };

  const mainButtonLabel = checkingSource
    ? mode === 'video'
      ? t.checkingVideo
      : mode === 'diagram'
        ? t.checkingDiagram
        : t.checkingPaper
    : contentLoading
      ? t.generating
      : source
        ? t.regenerate
        : t.generate;

  /*
   * Telegram's bottom bar carries the primary action, but only where there is
   * one. It was showing "Generate" on the key screen and on the chooser --
   * screens whose action is a card or a field, not a button, and where
   * pressing it did nothing. It appears once a key exists and a mode has been
   * chosen, and not before.
   */
  useEffect(() => {
    if (!isTelegram || panelOpen || !apiKey || !mode) return;
    return setMainButton(
      {text: mainButtonLabel, visible: true, busy},
      () => void handleSubmit(),
    );
  });

  const hintMessage = (hint: LinkHint) =>
    ({
      paywall: t.hintPaywall,
      abstractOnly: t.hintAbstractOnly,
      blocked: t.hintBlocked,
      doi: t.hintDoi,
    })[hint];

  const switchMode = (next: SourceKind) => {
    if (next === mode) return;
    haptic();
    setMode(next);
    setSource(null);
    setPdf(null);
    setPicture(null);
    setUrlError(null);
    setLinkHint(null);
    setResolved(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const refreshHistory = () => {
    void listHistory().then(setHistory);
  };

  useEffect(refreshHistory, []);

  // Reload the list whenever a generation finishes, so a new app appears.
  useEffect(() => {
    if (!contentLoading) refreshHistory();
  }, [contentLoading]);

  /** Opened from a shared link: build straight from what the sender chose. */
  useEffect(() => {
    const param = startParam();
    if (!param) return;

    const shared = decodeSource(param);
    if (!shared) return;

    // decodeSource only ever yields link-backed sources, since a PDF cannot
    // travel through a start parameter.
    setMode(shared.kind);
    if (inputRef.current) inputRef.current.value = shared.url;
    setSource(shared);
    setReloadCounter((c) => c + 1);
  }, []);

  const openFromHistory = (item: HistoryItem) => {
    haptic();
    /*
     * Enter the item's own mode as well as restoring it.
     *
     * The list is shown on the chooser too, where no mode has been picked
     * yet -- and that screen renders for as long as the mode is null. So a
     * past app opened from there set the source, kept rendering the chooser,
     * and looked like a dead tap. That is the app's commonest entry point.
     */
    setMode(item.kind);
    setRestored(item);
    setSource(
      item.kind === 'video'
        ? {kind: 'video', url: item.sourceUrl ?? ''}
        : item.kind === 'diagram'
          ? {kind: 'diagram', name: item.title, mimeType: 'image/png', base64: ''}
          : item.sourceUrl
            ? {kind: 'paper', via: 'url', url: item.sourceUrl}
            : {kind: 'paper', via: 'file', name: item.title, mimeType: 'application/pdf', base64: ''},
    );
    setReloadCounter((c) => c + 1);
  };

  const start = (next: Source) => {
    setRestored(null);
    setSource(next);
    // Bumping the key remounts ContentContainer, which restarts generation.
    setReloadCounter((c) => c + 1);
  };

  const panelOpen = showSettings;

  const closePanel = () => setShowSettings(false);

  // Telegram's own back button is where a Mini App user looks first.
  useEffect(() => {
    if (!panelOpen) return;
    return showBackButton(closePanel);
  }, [panelOpen]);

  const header = (
    <header className="header">
      <div className="brand">
        <span className="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path
              d="M4 17.5 9.2 7.2a1.4 1.4 0 0 1 2.5 0l2 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="16.4" cy="14.6" r="4.1" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
        <div className="brand-text">
          <h1 className="title display">{t.appName}</h1>
          {/*
            The subtitle follows the mode: a research explainer is not a
            YouTube lesson, and saying so on both was simply wrong. Before a
            mode is chosen there is no one source to describe, so it names all
            three rather than promising whichever happens to be first.
          */}
          <p className="hint subtitle">
            {mode === 'video'
              ? t.subtitleVideo
              : mode === 'paper'
                ? t.subtitlePaper
                : mode === 'diagram'
                  ? t.subtitleDiagram
                  : t.subtitleAll}
          </p>
        </div>
      </div>
      <div className="header-actions">
        {(apiKey || panelOpen) && (
          <button
            className="button-ghost settings-button"
            aria-label={panelOpen ? t.back : t.settings}
            title={panelOpen ? t.back : t.settings}
            onClick={() => {
              haptic();
              if (panelOpen) closePanel();
              else setShowSettings(true);
            }}>
            {panelOpen ? '←' : '⚙'}
          </button>
        )}
      </div>
    </header>
  );

  if (keyLoading) return null;

  // The key comes first: nothing here works without one, and asking later
  // meant a new user met a demand instead of the app.
  if (!apiKey || panelOpen) {
    return (
      <div className="app">
        {header}
        <KeyGate
          key={apiKey ? 'settings' : 'onboarding'}
          onClose={apiKey ? closePanel : undefined}
          onSaved={apiKey ? closePanel : undefined}
        />
        <Styles />
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="app">
        {header}
        <AnnouncementCard />
        <Chooser onChoose={setMode} />
        <HistoryList
          items={history}
          onOpen={openFromHistory}
          onChanged={refreshHistory}
        />
        <Styles />
      </div>
    );
  }

  return (
    <div className="app app-main">
      {header}

      <AnnouncementCard />

      <nav className="mode-switch" role="tablist">
        {(['video', 'paper', 'diagram'] as const).map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={mode === option}
            className={mode === option ? 'mode-option active' : 'mode-option'}
            onClick={() => switchMode(option)}>
            {option === 'video'
              ? t.modeVideo
              : option === 'paper'
                ? t.modePaper
                : t.modeDiagram}
          </button>
        ))}
      </nav>

      <section className="controls">
        {/*
          A picture has no link form. Showing a URL field for it would offer
          an input that cannot start a generation.
        */}
        <label className="field-label" htmlFor="source-url">
          {mode === 'video'
            ? t.inputLabel
            : mode === 'paper'
              ? t.paperLabel
              : t.diagramLabel}
        </label>
        {mode !== 'diagram' && (
          <input
            ref={inputRef}
            id="source-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={
              mode === 'video' ? t.inputPlaceholder : t.paperPlaceholder
            }
            disabled={busy}
            onChange={(e) => {
              setUrlError(null);
              setResolved(null);
              setLinkHint(
                mode === 'paper' && !pdf ? linkHintFor(e.target.value) : null,
              );
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        )}

        {resolved && (
          <p className="field-resolved">
            {t.paperFound}: {resolved}
          </p>
        )}

        {linkHint && <p className="field-warning">{hintMessage(linkHint)}</p>}

        {mode === 'paper' && (
          <div className="upload-row">
            <span className="hint">{t.paperOr}</span>
            <button
              className="button-secondary upload-button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {pdf ? `${t.paperChosen}: ${pdf.name}` : t.paperUpload}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <span className="hint upload-limits">
              {t.paperLimits.replace('{size}', String(MAX_UPLOAD_MB))}
            </span>
          </div>
        )}

        {mode === 'diagram' && (
          <div className="upload-row">
            <button
              className="button-secondary upload-button"
              disabled={busy}
              onClick={() => pictureRef.current?.click()}>
              {picture ? `${t.paperChosen}: ${picture.name}` : t.diagramUpload}
            </button>
            <input
              ref={pictureRef}
              type="file"
              accept={DIAGRAM_ACCEPT}
              hidden
              onChange={(e) => handlePicture(e.target.files?.[0])}
            />
            <span className="hint upload-limits">
              {t.diagramLimits.replace('{size}', String(MAX_UPLOAD_MB))}
            </span>
          </div>
        )}

        {urlError && <p className="field-error">{urlError}</p>}

        {/* Stated before anything is spent. These are the only three things
            that get a source turned away, so saying them costs a moment and
            saves a wasted generation. */}
        {!source && (
          <div className="requirements">
            <p className="requirements-title">{t.reqTitle}</p>
            <ul className="requirements-list">
              {(mode === 'video'
                ? [t.reqDuration, t.reqLanguage, t.reqSpeech]
                : [t.reqPaperAccess, t.reqPaperLanguage]
              ).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {!isTelegram && (
          <button
            className="button-primary generate"
            onClick={handleSubmit}
            disabled={busy}>
            {mainButtonLabel}
          </button>
        )}
      </section>

      {mode === 'video' && (
        <section className="video">
          {videoUrl ? (
            <iframe
              className="video-frame"
              src={getYoutubeEmbedUrl(videoUrl)}
              title="source-video"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="video-placeholder hint">{t.videoPlaceholder}</div>
          )}
        </section>
      )}

      <section className="output">
        {source ? (
          <ContentContainer
            key={reloadCounter}
            source={source}
            restored={
              restored
                ? {
                    spec: restored.spec,
                    code: restored.code,
                    summary: restored.summary,
                    title: restored.title,
                  }
                : undefined
            }
            onLoadingStateChange={setContentLoading}
          />
        ) : (
          <div className="output-placeholder">
            {mode === 'video' ? (
              <EmptyIllustration className="placeholder-art" />
            ) : mode === 'diagram' ? (
              <DiagramIllustration className="placeholder-art" />
            ) : (
              <PaperIllustration className="placeholder-art" />
            )}
            <p className="hint">
              {mode === 'video'
                ? t.contentPlaceholder
                : mode === 'diagram'
                  ? t.diagramPlaceholderText
                  : t.paperPlaceholderText}
            </p>
            <ol className="intro-steps">
              {(mode === 'video'
                ? [t.introStep1, t.introStep2, t.introStep3]
                : mode === 'diagram'
                  ? [t.diagramStep1, t.diagramStep2, t.diagramStep3]
                  : [t.paperStep1, t.paperStep2, t.paperStep3]
              ).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <HistoryList
        items={history}
        onOpen={openFromHistory}
        onChanged={refreshHistory}
      />

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      /*
       * Insets come from Telegram where it runs, and from the device
       * otherwise. Telegram's own header overlays the page on some platforms,
       * so content placed under it would simply be unreachable.
       */
      .app {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: 0 auto;
        max-width: 640px;
        padding-block: calc(1rem + var(--tg-inset-top, env(safe-area-inset-top, 0px)))
          calc(1.5rem + var(--tg-inset-bottom, env(safe-area-inset-bottom, 0px)));
        padding-inline: calc(1rem + var(--tg-inset-left, env(safe-area-inset-left, 0px)))
          calc(1rem + var(--tg-inset-right, env(safe-area-inset-right, 0px)));
        width: 100%;
      }

      .header {
        align-items: flex-start;
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .brand {
        align-items: center;
        display: flex;
        gap: 0.6rem;
        min-width: 0;
      }

      .brand-text {
        min-width: 0;
      }

      .mark {
        align-items: center;
        background: linear-gradient(140deg, var(--color-brand), var(--color-brand-deep));
        border-radius: 11px;
        color: #fff;
        display: flex;
        flex: 0 0 34px;
        height: 34px;
        justify-content: center;
        width: 34px;
      }

      .title {
        font-size: 1.35rem;
        letter-spacing: 0.01em;
      }

      .placeholder-art {
        color: var(--color-hint);
        height: auto;
        max-width: 140px;
        opacity: 0.85;
      }

      .subtitle {
        margin-top: 0.2rem;
      }

      .header-actions {
        align-items: center;
        display: flex;
        flex: 0 0 auto;
        gap: 0.35rem;
      }

      /* A touch target, not just a glyph: 44px is the smallest a finger
         reliably hits. */
      .settings-button {
        align-items: center;
        display: flex;
        font-size: 1.2rem;
        justify-content: center;
        line-height: 1;
        min-height: 44px;
        min-width: 44px;
        padding: 0;
      }

      .mode-switch {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        display: flex;
        gap: 2px;
        padding: 4px;
      }

      .mode-option {
        background: transparent;
        border-radius: 999px;
        color: var(--color-hint);
        flex: 1;
        font-size: 0.9rem;
        min-height: 44px;
        padding: 0.35rem 0.75rem;
      }

      .mode-option.active {
        background: var(--color-background);
        color: var(--color-text);
      }

      .controls {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .upload-limits {
        /* Its own line: as a flex sibling it competed with the button for
           width, and the button ellipsised itself down to "Ch". */
        flex: 0 0 100%;
        font-size: 0.78rem;
      }

      .upload-row {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .upload-button {
        flex: 1;
        font-size: 0.85rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .field-label {
        font-size: 0.9rem;
        font-weight: 600;
      }

      .field-error {
        color: var(--color-error);
        font-size: 0.85rem;
      }

      .requirements {
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.75rem 0.85rem;
      }

      .requirements-title {
        color: var(--color-hint);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .requirements-list {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .requirements-list li {
        color: var(--color-hint);
        display: flex;
        font-size: 0.85rem;
        gap: 0.5rem;
        line-height: 1.45;
      }

      /* A tick rather than a bullet: these are conditions that are met, not
         items in a list. */
      .requirements-list li::before {
        color: var(--color-brand);
        content: '¹3';
        flex: 0 0 auto;
        font-weight: 700;
      }

      .field-resolved {
        background: var(--color-surface);
        border-left: 3px solid var(--color-brand);
        border-radius: 8px;
        font-size: 0.82rem;
        line-height: 1.45;
        padding: 0.55rem 0.7rem;
      }

      /* A warning, not a refusal: these links sometimes carry the full text. */
      .field-warning {
        background: var(--color-surface);
        border-radius: 8px;
        color: var(--color-hint);
        font-size: 0.82rem;
        line-height: 1.45;
        padding: 0.55rem 0.7rem;
      }

      .generate {
        width: 100%;
      }

      .video {
        background: var(--color-surface);
        border-radius: var(--radius);
        overflow: hidden;
        padding-top: 56.25%;
        position: relative;
        width: 100%;
      }

      .video-frame,
      .video-placeholder {
        border: none;
        height: 100%;
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
      }

      .video-placeholder {
        align-items: center;
        display: flex;
        justify-content: center;
      }

      .output {
        display: flex;
        flex-direction: column;
        min-height: 420px;
      }

      .output-placeholder {
        align-items: center;
        border: 1px dashed var(--color-border);
        border-radius: var(--radius);
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 1.25rem;
        justify-content: center;
        padding: 2rem 1.5rem;
        text-align: center;
      }

      .intro-steps {
        counter-reset: step;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 34ch;
        text-align: left;
      }

      .intro-steps li {
        align-items: center;
        counter-increment: step;
        display: flex;
        font-size: 0.9rem;
        gap: 0.65rem;
        line-height: 1.4;
      }

      .intro-steps li::before {
        align-items: center;
        background: var(--color-surface);
        border-radius: 50%;
        color: var(--color-hint);
        content: counter(step);
        display: flex;
        flex: 0 0 24px;
        font-size: 0.75rem;
        font-weight: 700;
        height: 24px;
        justify-content: center;
        width: 24px;
      }

      /* Tablet: still one column, but with room to breathe. */
      @media (min-width: 640px) {
        .app {
          gap: 1.25rem;
          max-width: 760px;
          padding-block: calc(1.5rem + var(--tg-inset-top, env(safe-area-inset-top, 0px)))
            calc(2rem + var(--tg-inset-bottom, env(safe-area-inset-bottom, 0px)));
        }

        .title {
          font-size: 1.55rem;
        }

        .output {
          min-height: 520px;
        }
      }

      /*
       * Desktop: a fixed rail beside the output.
       *
       * Every control lives in column one and the result fills column two,
       * which stays in view while the rail scrolls. The rail's rows are listed
       * explicitly rather than spanned by count, since a miscount silently
       * drops whichever item was added last into the wrong column.
       */
      @media (min-width: 1024px) {
        /*
         * The grid belongs to the main screen alone.
         *
         * The key gate and the chooser do not contain the elements these areas
         * name, and applying it to them put the chooser on the same row as the
         * header -- so the two rendered on top of each other.
         */
        .app-main {
          align-items: start;
          display: grid;
          gap: 1.25rem 1.75rem;
          grid-template-areas:
            'brand output'
            'promo output'
            'modes output'
            'form output'
            'media output'
            'past output';
          grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
          grid-template-rows: auto auto auto auto auto 1fr;
          max-width: 1320px;
          min-height: var(--tg-viewport-height, 100dvh);
        }

        .app-main .header {
          grid-area: brand;
        }

        .app-main .ad {
          grid-area: promo;
        }

        .app-main .mode-switch {
          grid-area: modes;
        }

        .app-main .controls {
          grid-area: form;
        }

        .app-main .video {
          grid-area: media;
        }

        .app-main .history {
          align-self: start;
          grid-area: past;
          overflow-y: auto;
        }

        .app-main .output {
          grid-area: output;
          height: 100%;
          min-height: min(
            calc(var(--tg-viewport-height, 100dvh) - 3.5rem),
            860px
          );
          position: sticky;
          top: 1.5rem;
        }

        /* Single-column screens get room without becoming a rail. */
        .app:not(.app-main) {
          max-width: 900px;
        }
      }

      /* Wide desktop: more room for the result, not for the rail. */
      @media (min-width: 1440px) {
        .app-main {
          grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
          max-width: 1560px;
        }
      }

      /* A phone held sideways has almost no height to spare. */
      @media (max-height: 520px) and (orientation: landscape) {
        .app {
          gap: 0.75rem;
        }

        .title {
          font-size: 1.15rem;
        }

        .subtitle,
        .intro-steps {
          display: none;
        }

        .output {
          min-height: 320px;
        }
      }
    `}</style>
  );
}
