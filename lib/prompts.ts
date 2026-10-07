/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {SourceKind} from '@/lib/source';

export const SPEC_FROM_VIDEO_PROMPT = `You are a pedagogist and product designer with deep expertise in crafting engaging learning experiences via interactive web apps.

FIRST, screen the attached video and report on it honestly:

- "language": the primary spoken language, as an English word ("English", "Russian", "Uzbek", "Spanish", ...). Use "None" if nobody speaks.
- "durationMinutes": the video's length in minutes, as a number.
- "contentKind": one of "educational", "music", "entertainment", "promotional", "other". Choose "music" for anything whose point is a song or performance, even if it is well made. Choose "educational" only when the video is genuinely trying to teach or explain something.
- "audioQuality": "clear" if the speech is easy to follow; "unclear" if it is drowned in noise or music, heavily distorted, or largely unintelligible; "none" if there is no speech at all.
- "teachable": set this TRUE for essentially every video where a person is explaining, describing, arguing, demonstrating or narrating something. An essay, a documentary, a history, a rant with a point, a how-to, a lecture -- all of them. Ideas become scenarios and consequences, exactly like the friendship example below. Set it false ONLY when the video is a song, or when nobody speaks at all.
- "title": a short title for what this teaches, in English.
- "summaryEn": two or three sentences, in English, telling a learner what the app you are about to design will teach them and what they will do in it. Address the learner directly. No jargon, no mention of specs or code.
- "reason": one short sentence explaining your judgement.

THERE ARE ONLY THREE REASONS TO REFUSE, and they are all facts about the recording rather than judgements about its worth:

1. It is a music video -- the point of it is a song or a performance.
2. Nobody speaks. Rain, birdsong, ambience, a silent timelapse: there are no words to build a lesson from.
3. The speech is in a language other than English.

Anything else, build. Do not refuse because the subject seems too broad, too soft, too obvious, too entertaining, or because you cannot immediately picture the app. Finding the mechanic is your job, and the three examples below show how differently it can look. If a video has a person making a point, there is an app in it.

THEN, only if "teachable" is true AND "contentKind" is "educational", write the spec. Otherwise set "spec" to an empty string and stop -- do not invent a lesson out of material that does not contain one.

When you do write it: write a detailed and carefully considered spec for an interactive web app designed to complement the video and reinforce its key idea or ideas. The recipient of the spec does not have access to the video, so the spec must be thorough and self-contained (the spec must not mention that it is based on a video). Here is an example of a spec written in response to a video about functional harmony:

"In music, chords create expectations of movement toward certain other chords and resolution towards a tonal center. This is called functional harmony.

Build me an interactive web app to help a learner understand the concept of functional harmony.

SPECIFICATIONS:
1. The app must feature an interactive keyboard.
2. The app must showcase all 7 diatonic triads that can be created in a major key (i.e., tonic, supertonic, mediant, subdominant, dominant, submediant, leading chord).
3. The app must somehow describe the function of each of the diatonic triads, and state which other chords each triad tends to lead to.
4. The app must provide a way for users to play different chords in sequence and see the results.
[etc.]"

Here is a second, in response to a video about friendship:

"Build an interactive web app to help users explore the principles of making and maintaining friendships.

SPECIFICATIONS:
1. The app should present a series of scenarios, each a different stage or situation in making and maintaining friendships. Draw the scenarios from the video's own examples (attending a class, joining a club, moving to a new city, a breakup, scrolling through contacts).
2. For each scenario, pose a question and offer a set of concrete actions to choose between, reflecting the positive or negative behaviours the video discusses.
3. Each choice produces a visible change in a friendship score or network -- a bar or a network diagram growing or shrinking. Positive actions raise it, negative lower it.
4. Track the score across scenarios. Give feedback after each one and at the end, with encouragement and tips.
5. Include at least three scenarios, ideally five to seven, covering both starting friendships and keeping them.
6. Keep the interface simple and warm. Avoid being saccharine.
7. Every action must clearly trace back to a principle from the video (prioritising time, showing genuine interest, being open, inviting people to do things, sharing experiences).
8. Make the scoring transparent, so the user understands why an action helped. Never score arbitrarily.
[etc.]"

And a third, in response to a video about baseball hitting mechanics:

"Build me an interactive web app to help a learner understand shoulder tilt and barrel tilt in a batting swing.

SPECIFICATIONS:
1. Feature a simplified animated batter. A stick figure is sufficient.
2. Give the user two sliders, shoulder tilt and barrel tilt, each ranging from -20 to +20 degrees, with 0 being level.
3. As shoulder tilt changes, the figure's shoulders rotate, clearly showing the front shoulder rising or falling against the back. Label it "Shoulder Tilt: [X] degrees".
4. As barrel tilt changes, the bat rotates, clearly showing the barrel tipping toward or away from the plate. Label it "Barrel Tilt: [Y] degrees".
5. Explain the target for each: shoulder tilt at launch is slightly downward, about 9 degrees; barrel tilt at launch is slightly inward, toward the plate.
6. Add a button, "Show Ideal Position", which animates smoothly to those values and states that this is the proper tilt at launch.
7. Add a button, "Reset Position", returning both sliders to 0 and the figure to level.
[etc.]"

WHAT THESE THREE HAVE IN COMMON, and what yours must share:

- ONE MECHANIC. A keyboard, a scored sequence of choices, two sliders driving one figure. Not a tour of everything the video mentioned. Name the mechanic and build the whole app around it.
- SPECIFICATIONS THAT CAN BE CHECKED, not described. "-20 to +20 degrees". A label reading exactly "Shoulder Tilt: [X] degrees". Buttons named exactly "Show Ideal Position" and "Reset Position". Anything vague is something the developer has to invent, and invented detail is where these apps go wrong.
- THE VIDEO'S OWN NUMBERS AND EXAMPLES. Nine degrees, because the video said nine. Moving to a new city, because the video used it. Never a plausible substitute, never a rounded figure, never an example of your own.
- AN ANSWER STATE. A way for the learner to see what right looks like: an ideal position to jump to, feedback at the end of a run, the correct progression played back.
- PERMISSION TO BE SIMPLE. "A stick figure is sufficient." Say so where it applies, so effort goes into the mechanic being correct rather than into the drawing.


The goal of the app that is to be built based on the spec is to enhance understanding through simple and playful design. The provided spec should not be overly complex, i.e., a junior web developer should be able to implement it in a single html file (with all styles and scripts inline). Most importantly, the spec must clearly outline the core mechanics of the app, and those mechanics must be highly effective in reinforcing the given video's key idea(s).

Write the spec in English regardless of the language spoken in the video. The spec is a build brief for a developer, not user-facing text.`;

/**
 * JSON shape the screening call must return, enforced by the API itself.
 *
 * Screening and spec-writing share one request: the expensive part is watching
 * the video, so asking separately would double the cost of every rejection.
 */
export const SPEC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    language: {
      type: 'string',
      description: 'Primary spoken language in English, or "None".',
    },
    durationMinutes: {type: 'number', description: 'Video length in minutes.'},
    contentKind: {
      type: 'string',
      enum: ['educational', 'music', 'entertainment', 'promotional', 'other'],
    },
    audioQuality: {type: 'string', enum: ['clear', 'unclear', 'none']},
    teachable: {type: 'boolean'},
    title: {type: 'string'},
    summaryEn: {type: 'string'},
    reason: {type: 'string'},
    spec: {
      type: 'string',
      description: 'The specification, or an empty string if unsuitable.',
    },
  },
  required: [
    'language',
    'durationMinutes',
    'contentKind',
    'audioQuality',
    'teachable',
    'spec',
  ],
} as const;

export const CODE_REGION_OPENER = '```';
export const CODE_REGION_CLOSER = '```';


/* -------------------------------------------------------------------------- */
/* Diagrams, sketches and photographs                                         */
/* -------------------------------------------------------------------------- */

/**
 * Screening plus plan for a picture.
 *
 * The other two sources are read for what they say. A picture is read for
 * what it implies: a wireframe implies the screen it is a drawing of, a
 * flowchart implies the process it charts, a photograph of a cluttered desk
 * implies the tidying of it. So the brief is to find the mechanic the image
 * points at and build that, rather than to reproduce the image.
 *
 * Almost nothing is refused, which is deliberate and is the one place this
 * differs sharply from the paper prompt. A paper that cannot be read yields
 * an explainer made of invention. A sketch that is ambiguous just yields a
 * different app than the one its author had in mind, and that is a fine
 * outcome -- so the instruction is to guess well rather than to decline.
 */
export const SPEC_FROM_DIAGRAM_PROMPT = `You are a product designer and engineer who turns pictures of things into working software.

The attachment is an image or a PDF. It might be a polished interface mockup, a wireframe, a napkin sketch, a whiteboard covered in arrows, a flowchart, a printed form, a table of data, a page from a textbook, or a photograph of an ordinary physical object or scene.

FIRST, screen the attachment and report on it honestly:

- "language": the language of any writing in the image, as an English word ("English", "Russian", "Uzbek", ...). Use "None" when there is no legible writing. This is a description, NOT a reason to refuse -- a wireframe with no words at all is completely normal and entirely buildable.
- "contentKind": always "educational". This field exists for the other sources; it is not a judgement here.
- "audioQuality": legibility, since there is no sound. Use "clear" when you can make out what the image contains; "unclear" when it is blurry, dim or awkwardly angled but you can still tell what is there; "none" ONLY when the image is genuinely blank, corrupt, or so degraded that you cannot identify a single element in it.
- "teachable": true whenever you can see anything at all.
- "title": a short English name for the thing you are about to build, e.g. "Contingency table calculator" or "Desk tidying game".
- "summaryEn": two or three sentences, in English, telling the person what the app you are about to design will let them do. Address them directly. Describe the app, not the picture, and do not mention specs or code.
- "reason": one short sentence explaining what you saw and what you decided to make of it.

THERE IS EXACTLY ONE REASON TO REFUSE: you cannot make out anything in the image at all. A blank page, a corrupted file, a photograph so dark or blurred that no element is identifiable. In that case set "audioQuality" to "none", set "spec" to an empty string, and stop.

Everything else you build. Do not refuse because the drawing is crude, because the handwriting is bad, because the subject seems mundane, because the image is a photograph rather than a design, or because you are unsure what the author intended. An ambiguous sketch is not a failure: make the most interesting defensible reading of it and commit to that.

THEN write the spec: a detailed, self-contained specification for a single interactive web app. The person who receives this spec cannot see the image, so every element you want built must be described in words. Never refer to "the image", "the attachment", "the sketch" or "the diagram" in the spec -- describe the app itself as though it were always the plan.

HOW TO READ WHAT YOU ARE GIVEN

- An INTERFACE MOCKUP OR WIREFRAME is a drawing of a screen. Build that screen, cleanly and modernly, and make every control in it actually work. A drawn text field accepts typing; a drawn button does something; a drawn list can be added to and removed from. Where the sketch shows four blank rows, they are placeholders for real rows the user can create -- do not hard-code four empty boxes.
- A FLOWCHART, PROCESS OR TIMELINE is a mechanism. Build something that steps through it, where the user drives the progression and sees state change at each stage, rather than a static redrawing of the boxes and arrows.
- A TABLE, CHART OR SET OF NUMBERS is a calculator waiting to happen. Put the numbers in editable inputs and compute every derived quantity live. If the picture shows a 2x2 table of test results, the app recomputes sensitivity, specificity and predictive values the moment a cell changes.
- A FORM OR DOCUMENT becomes a working wizard: real fields, real validation, a visible summary of what has been entered.
- A DIAGRAM FROM A TEXTBOOK -- a cycle, an anatomy plate, a labelled apparatus -- becomes something explorable: tap a part to learn what it does, drag labels onto the right places, step through the cycle one stage at a time.
- AN ORDINARY OBJECT OR SCENE has no interface in it, so invent a useful or playful one around what it contains. A cluttered desk becomes a tidying game or a task board. A bowl of fruit becomes a nutrition tracker. A bookshelf becomes a reading list. Do not simply describe the photograph back.

WHAT TO PUT IN THE SPEC

- The single core mechanic, stated in one sentence. Everything else supports it.
- Every screen region, what it contains, and how it is laid out on a narrow phone screen.
- Every control: what it is, what it does, what changes when it is used.
- The rules: any formula, scoring, validation or state machine, written out precisely enough to implement without guessing.
- Faithfulness to how the thing really works. When the picture shows a causal chain -- a pathway, a process, a circuit, a sequence of steps -- a simulated quantity changes only at the step that actually causes it, in the order and direction the picture shows. A blood pressure that rises before the hormone that raises it exists teaches the wrong thing. Where the picture is ambiguous, follow established fact.
- The starting state. Give real, plausible seed content so the app is alive the moment it opens rather than an empty shell -- if the picture contains actual values, labels or numbers, carry them across as the initial data.

DO NOT ask for photographs or external images of any kind. Everything the app shows must be drawable in the browser: CSS shapes, inline SVG, the Canvas API, emoji, or coloured type. If the source pictures a coffee cup, the app draws one or shows an emoji; it never loads a photograph of one.`;

export const DIAGRAM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    language: {
      type: 'string',
      description: 'Language of any writing in the image, or "None".',
    },
    contentKind: {
      type: 'string',
      enum: ['educational', 'music', 'entertainment', 'promotional', 'other'],
    },
    audioQuality: {
      type: 'string',
      enum: ['clear', 'unclear', 'none'],
      description: 'Legibility of the image, not sound.',
    },
    teachable: {type: 'boolean'},
    title: {type: 'string'},
    summaryEn: {type: 'string'},
    reason: {type: 'string'},
    spec: {
      type: 'string',
      description: 'The specification, or an empty string if nothing is legible.',
    },
  },
  required: ['language', 'contentKind', 'audioQuality', 'teachable', 'spec'],
} as const;

/* -------------------------------------------------------------------------- */
/* Research papers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Screening plus plan for a research publication.
 *
 * Deliberately parallel to the video prompt: same screen-first discipline,
 * same JSON shape, so both sources flow through one pipeline. The brief asks
 * for an explanatory narrative rather than a quiz, because the thing a paper
 * most needs is for its central mechanism to become visible.
 */
export const SPEC_FROM_PAPER_PROMPT = `You are a science communicator and product designer who turns research publications into interactive explanatory web experiences.

FIRST, screen the publication provided (attached as a file, or at the URL given below) and report on it honestly:

- "language": the language the publication is written in, as an English word ("English", "Russian", "Uzbek", ...).
- "contentKind": "educational" for a genuine research paper, preprint, thesis, or serious technical report. Use "promotional" for marketing or press material, and "other" for anything else, including a page you could not actually read.
- "audioQuality": "clear" if you could read the full text, "unclear" if you could only reach an abstract, a paywall, or a scanned page you could not parse reliably, "none" if you could not read it at all.
- "teachable": true only if there is a specific, concrete mechanism, method or finding that an interactive explanation could make clearer.
- "title": the publication's title, as printed.
- "summaryEn": two or three sentences, in English, telling a reader what the explainer you are about to design will show them and what they will be able to try in it. Address the reader directly. No jargon, no mention of specs or code.
- "reason": one short sentence explaining your judgement.

Be strict. If you reached only an abstract or a landing page, say so with "unclear" rather than inventing the contents of a paper you did not read. A confident explanation of a paper you could not see is far worse than an honest refusal.

THEN, only if "teachable" is true AND "contentKind" is "educational", write the spec. Otherwise set "spec" to an empty string and stop.

When you do write it: produce a detailed, self-contained spec for an EXPLAINER WEBSITE about this publication -- a long-form, scrolling narrative site, not a small app and not a quiz. Think of how a museum or a good science magazine presents a piece of research: it opens, it unfolds, it makes one difficult idea visible. The recipient of the spec has not read the paper, so the spec must carry every fact, number, name and definition it needs.

Specify the site as a sequence of sections, and say what each one contains:

1. A HERO: the paper's title, its authors, the journal and date, and one sentence stating what was achieved. Describe the visual that sits behind or beside it.
2. THE PROBLEM: what question the paper attacks, in plain language, and why it was hard. No jargon before it is explained.
3. THE MECHANISM: the method or contribution at the heart of the paper. This is the centre of the site and should be its longest, most carefully staged part.
4. AT LEAST ONE INTERACTIVE VISUAL that makes that mechanism visible -- something the reader manipulates and sees respond, not a static picture. Say precisely what is shown, what the reader controls, and what changes as a result.
5. RESULTS: the key numbers, exactly as the paper reports them, and plainly what they mean.
6. LIMITATIONS: the open questions the paper itself acknowledges.
7. CREDITS: the authors, their institutions, and the citation with a link to the publication.

ON THREE-DIMENSIONAL VISUALS. If, and only if, the subject is genuinely spatial -- a molecular or crystal structure, an anatomical arrangement, a physical or astronomical system, a lattice, a field, a geometry, a device -- then specify a real 3D scene the reader can orbit and inspect, saying what it depicts and what the controls do. Three.js will be available for this. When the subject is not spatial, do NOT ask for 3D: a well-made 2D diagram, chart or animation explains a statistical or algorithmic result far better, and a gratuitous rotating object is worse than none.

Aim for the feel of a well-made exhibit: serious about the science, generous to the newcomer, unhurried, never padded. Every section must earn its place, and the interactive parts must show something the prose could not.

Write the spec in English regardless of the publication's language. The spec is a build brief for a developer, not user-facing text.`;

/**
 * Appended when the source is a link rather than an uploaded file.
 *
 * More than one address may be offered for the same paper, because a DOI is a
 * redirect and the retrieval tool reads what the redirect returns rather than
 * where it points. Trying the publisher's own article URL alongside it is the
 * difference between reading a paper and reporting it paywalled.
 */
const NEWLINE = String.fromCharCode(10);

export function paperUrlInstruction(urls: string[]): string {
  if (urls.length === 1) {
    return `

The publication is at this URL. Retrieve and read it before answering: ${urls[0]}`;
  }

  return `

The publication can be reached at the addresses below. They are the same paper, listed with the most likely full text first. Retrieve them and work from whichever gives you the complete article; if one is only a redirect, a landing page or an abstract, try the next before concluding that the full text is unavailable.

${urls.map((url) => `- ${url}`).join(NEWLINE)}`;
}

/**
 * Schema for the paper screening call.
 *
 * Shares the video screening's field names so one guard function judges both.
 * `durationMinutes` is absent because a paper has no length in minutes.
 */
export const PAPER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    language: {type: 'string'},
    contentKind: {
      type: 'string',
      enum: ['educational', 'music', 'entertainment', 'promotional', 'other'],
    },
    audioQuality: {type: 'string', enum: ['clear', 'unclear', 'none']},
    teachable: {type: 'boolean'},
    title: {type: 'string'},
    summaryEn: {type: 'string'},
    identity: {type: 'string'},
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: {type: 'string'},
          titleEn: {type: 'string'},
          titleUz: {type: 'string'},
          instrument: {type: 'string'},
          brief: {type: 'string'},
        },
        required: ['key', 'titleEn', 'titleUz', 'instrument', 'brief'],
      },
    },
    facts: {
      type: 'string',
      description:
        'JSON string of the paper metadata, authors, numbers and tables.',
    },
    reason: {type: 'string'},
    spec: {type: 'string'},
  },
  required: ['language', 'contentKind', 'audioQuality', 'teachable', 'spec'],
} as const;

/**
 * Asks for the same JSON without a response schema.
 *
 * Structured-output mode and server-side tools do not reliably combine, and
 * the URL path needs the retrieval tool, so that path states the shape in
 * words and leans on the tolerant parser instead.
 */
export const JSON_ONLY_INSTRUCTION = `

Return ONLY a JSON object, with no markdown fence and no commentary, with exactly these fields: "language" (string), "contentKind" (one of "educational", "music", "entertainment", "promotional", "other"), "audioQuality" (one of "clear", "unclear", "none"), "teachable" (boolean), "title" (string), "summaryEn" (string), "identity" (string containing JSON), "sections" (array of objects with key, titleEn, titleUz, instrument, brief), "facts" (string containing JSON), "reason" (string), "spec" (string).`;

/* -------------------------------------------------------------------------- */
/* Variations                                                                 */
/* -------------------------------------------------------------------------- */

export type VariationKind = 'simpler' | 'visual' | 'quiz';

/**
 * A nudge appended to an existing plan.
 *
 * Rebuilding from the same plan costs one call rather than two, since the
 * source never has to be read again -- which is what makes "try another
 * version" cheap enough to offer at all.
 */
export const VARIATIONS: Record<VariationKind, string> = {
  simpler: `

REVISION: Make this markedly simpler. Cut every secondary feature and keep only the single core mechanic. Assume a learner meeting this topic for the first time, and shorten all explanatory text.`,
  visual: `

REVISION: Make this far more visual. Replace explanatory prose with diagrams, animation and direct manipulation wherever possible, so the learner sees the idea behind the words rather than reading about it.`,
  quiz: `

REVISION: Restructure this as active recall. Build it around questions the learner answers and gets immediate feedback on, with a visible score, rather than around exposition they read.`,
};

/**
 * The data layer, extracted on its own.
 *
 * This used to ride along with the plan in one call, which made that call the
 * slowest thing in the pipeline: a verdict, a plan, two summaries, an identity,
 * a section list and a thousand lines of tables all in one response. Asking
 * separately costs a second read of the paper and buys back half the wait,
 * because the two calls now run at the same time.
 */
export const FACTS_FROM_PAPER_PROMPT = `Read the attached publication (or the one at the URL below) and extract its complete data layer. Return ONLY a JSON object, with no prose, no markdown fence and no commentary.

Everything the explainer site shows will be computed from this object, so its completeness decides how good the result can be. Include:

- "meta": title, journal, volume and pages, year, every date given (received, accepted, published), DOI and its URL, institution, ethics approval, funding, and any accession or registration identifiers.
- "authors": every author, with name, role or contribution, institution, department and email where the paper prints them.
- "metrics": the headline numbers, each with a label, the value, its unit, and what it means.
- "tables": every table that matters, each with a name, its column headers, and ALL of its rows as arrays of strings. Do not summarise a table -- reproduce it.
- "records": if the paper reports per-subject, per-sample, per-locus or per-timepoint data, reproduce those rows in full with every field the paper prints. A cohort of sixteen patients is sixteen objects, not a count. This is what allows a figure to be explored rather than merely displayed.
- "statistics": every correlation, p-value, confidence interval, odds ratio and effect size, each with what was compared and the exact reported value.
- "steps": if the paper describes a procedure, method or pipeline, its ordered stages with names and descriptions.
- "findings" and "limitations": the paper's own claims and its own stated caveats, as arrays of sentences.

COMPLETE, BUT COMPACT. Reproduce every row and every field the paper prints -- a cohort of sixteen is sixteen rows, a table of thirty loci is thirty rows -- but write the JSON densely: short keys, arrays of values rather than objects of named fields where a table has fixed columns, no indentation, and NO explanatory prose inside records. Description belongs in "findings", not repeated on every row. A row is data for a figure to compute from, not a paragraph.

Keep the whole object under roughly 900 lines of dense JSON. If the paper has more data than fits, keep the tables and records the figures need and drop the least useful table, saying which in a "omitted" field. An object that never finishes being written is worth nothing.

Use the paper's exact values and units. Never round, never estimate, never invent a figure to fill a gap. If the paper does not report something, omit the field rather than guessing.`;

export interface Palette {
  scheme: string;
  background: string;
  text: string;
  hint: string;
  accent: string;
  accentText: string;
}

/**
 * Requirements appended to every spec before it is handed to the code model.
 *
 * Three things make this different from the stock single-language prompt:
 *
 *  1. Telegram Mini App constraints. The result renders inside a sandboxed
 *     iframe on a phone: no web storage, no network, touch-sized controls.
 *  2. Theme matching. The live Telegram palette is injected so the generated
 *     app does not flash white inside a dark Telegram.
 */
export function buildSpecAddendum(
  palette: Palette,
  kind: SourceKind = 'video',
): string {
  // A diagram, like a video, becomes one self-contained app: offline, and
  // judged on whether its core mechanic works rather than on how it reads.
  const paper = kind === 'paper';

  /*
   * Learning apps stay strictly offline: they are small, and a CDN is a
   * failure point they do not need. An explainer website may need real 3D,
   * which is not worth hand-rolling in WebGL, so that path -- and only that
   * path -- may reach for three.js.
   */
  const networkRule = paper
    ? THREE_JS_RULE
    : `- Do NOT load anything over the network: no CDN scripts, no external stylesheets, no web fonts, no remote images, no fetch or XMLHttpRequest calls. Everything must be inline. Use CSS, inline SVG, emoji, or the Canvas API for visuals.`;

  const closing = paper ? PAPER_CRAFT_RULE : APP_CRAFT_RULE;

  return `


---

IMPLEMENTATION REQUIREMENTS

LANGUAGE: write every user-facing string in English.

Provide the code as a single, self-contained HTML document. All styles and scripts must be inline. In the result, encase the code between "${CODE_REGION_OPENER}" and "${CODE_REGION_CLOSER}" for easy parsing.

RUNTIME ENVIRONMENT (a sandboxed iframe inside a Telegram Mini App on a phone)
- Mobile-first. Assume a viewport about 360px wide with a touch screen. It must also scale up gracefully on desktop.
- Interactive targets must be at least 44x44px. Never rely on :hover, right-click, or keyboard-only interactions to convey information or drive core mechanics; support tap and drag.
- Do NOT use localStorage, sessionStorage, cookies, or IndexedDB. The sandbox blocks them and any access throws an exception that will break the page. Keep all state in JavaScript variables.
${networkRule}
- If you need audio, synthesize it with the Web Audio API and only start the AudioContext inside a user gesture handler, since mobile browsers block autoplay.
- The document must never scroll horizontally. Long content scrolls vertically inside its own container.

TEXT MUST NEVER BE CLIPPED OR COLLIDE. This is the most common way these apps break on a phone, so treat it as a hard requirement:
- A ROW OF TABS, STEPS OR CHIPS is the usual culprit. At 360px a strip of five labelled steps cannot fit side by side. Either make the row scroll -- display:flex; overflow-x:auto; gap; with every item flex:0 0 auto and white-space:nowrap -- or let it wrap onto more than one line. NEVER let labels shrink until they overlap, and never cut a label mid-word.
- Give nothing that contains text a fixed height. Let it grow. A button, a card or a cell must size itself to its label, not the other way round.
- Long unbroken strings -- a chemical name, a URL, an identifier -- need overflow-wrap: anywhere so they cannot push a container wider than the screen.
- Check every label at its longest. If one step is called "Immune Evasion" and another "Post-Exposure Prophylaxis", the layout has to hold at the longer one.
- Where a label genuinely will not fit, shorten the text itself rather than letting the box clip it.

VISUAL THEME (match the surrounding Telegram client)
- Colour scheme: ${palette.scheme}
- Page background: ${palette.background}
- Primary text: ${palette.text}
- Secondary / hint text: ${palette.hint}
- Accent and primary buttons: ${palette.accent}
- Text on accent: ${palette.accentText}
Use these exact values as the base palette. Derived shades are fine, but the app must feel like it belongs inside this theme, and text must stay readable against its background.

${closing}`;
}

const THREE_JS_RULE = `- Load nothing over the network EXCEPT three.js, and only if the spec calls for a 3D scene. When you need it, import it exactly like this and add no other remote resource of any kind:

  <script type="importmap">
  {"imports":{"three":"https://unpkg.com/three@0.181.1/build/three.module.js","three/addons/":"https://unpkg.com/three@0.181.1/examples/jsm/"}}
  </script>
  <script type="module">
  import * as THREE from 'three';
  import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
  </script>

  Keep any scene light enough for a phone: cap the pixel ratio at 2, keep geometry simple, pause the render loop when the canvas scrolls out of view, and if WebGL is unavailable show a diagram in its place rather than an empty box. Still no web fonts, no remote images, and no fetch or XMLHttpRequest.`;

const APP_CRAFT_RULE = `Keep the design simple, playful, and focused on the core mechanic. Working interactivity matters more than decoration.`;

const PAPER_CRAFT_RULE = `TYPOGRAPHY AND PACING
- This is a long-form site, so it must be a pleasure to read: a serif face for headings against a clean sans for body text, generous line height, a measure of roughly 65-75 characters, and real space between sections.
- Let it breathe. A confident explainer is unhurried; do not compress it into a stack of cards.
- The reader must always know where they are, so give it a slim sticky header or section markers rather than letting a long scroll run unmarked.

Working interactivity and clear explanation matter more than decoration, but this should look like something made with care.`;
