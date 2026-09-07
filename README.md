# Enviso

A Telegram Mini App that turns source material into an interactive learning
app. Gemini reads the source, writes a plan, then writes a single-file web app
from that plan.

Three sections, one API key:

- **Video** — a YouTube lesson becomes a single self-contained interactive app
  built around its core mechanic, in one pass.
- **Research** — a paper becomes a long-form explainer *website*: hero, the
  problem, the mechanism, an interactive visual, the numbers, the limitations,
  the citation. From an uploaded PDF or a link the model retrieves itself.
  Where the subject is genuinely spatial it gets a real 3D scene the reader
  can orbit; where it is not, it gets a diagram, because a gratuitous rotating
  object explains nothing.
- **Picture** — a sketch, a whiteboard, a flowchart, a form, a textbook
  diagram or a photograph of an ordinary object becomes a working app built
  around whatever the picture implies. A drawn wireframe becomes the screen it
  is a drawing of; a 2x2 table becomes a calculator; a cluttered desk becomes
  a tidying game. The image is read for what it points at, not reproduced.

Based on Aaron Wade's Google AI Studio sample, rebuilt for Telegram.

## First run

1. **The key.** Nothing works without one, so it is the first screen and there
   is no way past it. A link to Google AI Studio and a two-minute walkthrough
   video sit beside the input, and the key is checked against Google before it
   is accepted.
2. **What are you starting from?** Video or paper, asked outright. The two
   modes used to live behind a small segmented switch, which made the research
   half easy to miss entirely.
3. **The app**, in the mode chosen. The switch stays in the header for changing
   without going back.

## Across devices

One layout, four shapes:

| Width | Shape |
|---|---|
| under 640 | single column, full width |
| 640–1023 | single column, 760px measure, roomier type |
| 1024+ | a 380px rail of controls beside a sticky result |
| 1440+ | same rail, more room for the result |

A phone held sideways drops the subtitle and the step list, since a 400px-tall
viewport has none to spare. Every tap target is at least 44px.

Telegram's insets are honoured, not just the device's. `env(safe-area-inset-*)`
covers a notch but not the space the client's own header occupies, and content
placed under that is simply unreachable — so `safeAreaInset` and
`contentSafeAreaInset` are published as CSS variables and the larger of the two
wins. Height comes from `viewportStableHeight` rather than `100dvh`, because
the two differ inside a Mini App sheet.

## Running cost: $0

| Piece | How | Cost |
|---|---|---|
| Hosting | GitHub Pages (static build) | free |
| Backend, database | none — there isn't one | free |
| Bot | BotFather | free |
| Gemini calls | each user's own AI Studio key | free tier |

There is no server, so there is nowhere to hide a shared API key. Each user
adds their own free [Google AI Studio](https://aistudio.google.com/apikey) key
once; it lives in their private Telegram cloud storage and is sent only to
Google. Your quota is never spent on someone else's video.

## Language

English throughout — the interface and everything it generates.

It was bilingual once, carrying every string twice behind a toggle and
requiring the same of every page it produced. That cost more than it bought:
doubling every label halves the room a figure has, doubles the text one
generation must write, and ties every layout decision to whichever language
runs longer.

Source language is a separate matter and still guarded: a video or paper that
is not in English is refused, because a plan built on a misheard
lecture teaches something wrong.

## The house style, and where it came from

Three AI Studio explainers built from unrelated papers -- quantum error
correction, SARS-CoV-2 genomics, paediatric cardiac surgery -- turned out to
share a byte-identical scaffold, and the only difference in their document head
was the `<title>`. Their quality comes from a fixed design system, not from
per-paper invention.

`lib/houseStyle.ts` encodes that system so every paper inherits it: Playfair
Display over Inter, the cream/ink/gold palette, `6rem` section rhythm, uppercase
eyebrows above headings, a gold rule beneath them, white figure cards, a drop
cap, a pull quote, metric tiles, author cards, and one inverted dark panel for
the technical centrepiece.

It deliberately does **not** follow the Telegram theme. A research explainer
should look like itself.

The other lever was their data layer. It holds every table row and every raw
record -- all sixteen patients with eighteen fields each -- and the components
compute from it. That is how a reported `r = 0.726` becomes a plot with a
draggable control rather than a sentence. Our `facts` contract now demands the
same: complete tables, per-record rows, statistics, procedure steps, authors.

## How an explainer site is built

A single generation has one output budget, and a whole site does not fit in it:
the hero, the 3D scene, every chart and all the prose end up competing for the
same ceiling. So the research path is written in parts — and the parts are
written at the same time.

**Phase 1, two calls at once.** One reads the source and returns the verdict,
the plan, the summary, the identity and the section list. The other reads it
again and returns the substance: for a paper, `facts` — metadata, authors,
numbers and full table rows; for a video, the lesson data — concepts, terms,
worked examples, misconceptions and a bank of twelve to twenty questions
spanning recall, apply and transfer. Everything later is computed from it.

The paths are not the same shape. A research site does not fit in one output
budget, so it is planned, extracted and built in parts. A learning app does
fit, and building it in pieces made it read like a document assembled from
sections rather than one thing — so it is written in a single pass, as it
originally was. A picture takes the learning app's shape for the same reason:
one screen, one mechanic, one pass.

## How generation works

1. **Video → screening + plan.** A Flash model watches the video, reports what
   it is (language, length, kind, audio quality), and writes the spec only if
   the video passes. A response schema keeps the JSON in shape.
2. **Plan → app.** The best model the key can reach streams a single
   self-contained HTML document. Streaming matters here: this step takes a
   minute or more, and on a phone visible progress is the difference between
   waiting and closing the app.

Model ids are never hardcoded. The app asks the key which models it may call
and picks the newest, because Google retires model names and a hardcoded one
becomes a 404 on a timer.

The result renders in a sandboxed iframe. Because that sandbox has no
same-origin access, the prompt forbids `localStorage` and cookies in both
modes — those throw and break the page.

Network access differs by mode. A learning app must be entirely inline: it is
small, and a CDN is a failure point it does not need. An explainer website may
load **three.js and nothing else**, from a pinned unpkg URL, since real 3D is
not worth hand-rolling in WebGL.

## What it refuses

A **video** is refused for three things only, and all three are facts about the
recording rather than judgements about its worth:

| Refused | Because |
|---|---|
| A music video | the point of it is a song |
| Nobody speaks | rain, birdsong, ambience — no words to build from |
| Not English | a lesson built on a misheard one teaches something wrong |

Anything else is built — documentaries, essays, vlogs with a point, noisy
audio. Whether a subject was "teachable" used to be judged too, and it was
judged badly: an essay on attention was called unteachable while an essay on
friendship, same channel and same shape, became a good app. Finding the
mechanic is the model's job, not grounds to refuse.

A **paper** is stricter, because it is either readable or it is not. A paywall
page, a scan that could not be parsed, or something that is not a publication
are all refused, since an explainer written from them would be invention.

A **picture** is refused for one thing only: nothing in it can be made out. A
blank page, a corrupt file, a photograph too dark to identify anything in. The
language guard cannot apply, since a wireframe has no language and "None" is
the normal answer rather than grounds to refuse; nor can teachability, since
the whole point is that a mundane object becomes something to use. An
ambiguous sketch is not a failure — the model commits to the most interesting
defensible reading rather than declining.

**Length** limits both: over 30 minutes is refused in the browser, before any
Gemini call, since watching an hour of video is the most expensive request the
app can make.

Every refusal shows the model's own sentence explaining it, and every one
except length offers **Build it anyway** — the person who chose the source
knows it better than a model that watched it once.

## What it does beyond generating

- **History.** Finished apps are kept in IndexedDB and reopen instantly, with
  no second generation and no second charge against the user's quota.
- **The plan fills the wait.** Screening returns a learner-facing summary in
  both languages before the app is written, so the minute of building is spent
  reading what is coming rather than watching a spinner.
- **Variations.** *Simpler*, *more visual*, *as a quiz* rebuild from the same
  plan, which costs one call rather than two since the source is never re-read.
- **Sharing.** A generated app cannot be hosted without a server, so the share
  link carries the source instead: the recipient opens the Mini App with it
  ready to build. Set `MINI_APP_PATH` in `lib/deeplink.ts` once BotFather has
  given you the link; until then sharing falls back to the bare source URL.
- **Telegram's own buttons.** MainButton drives the primary action and
  BackButton leaves the settings screen; both fall back to in-page controls
  outside Telegram.

## Announcing something in the app

Post it on the channel with **`#enviso`** in the text. Within about half an
hour it shows as a card at the top of the home screen, linking back to the
post.

    Pictures now work 🖼 #enviso
    Upload a sketch and Enviso builds the app it implies.

The first line becomes the card's title, the rest becomes the body, and the
post's photo becomes the thumbnail. The `#enviso` tag itself is stripped from
what people see, so it can sit on its own line if you prefer.

**To change it** -- post a newer `#enviso` message. The most recent one always
wins.

**To take it down** -- delete the post, or wait: a card stops showing 10 days
after it was posted, so a forgotten announcement cannot sit in the app
forever. Each person can also dismiss it, and a dismissed card stays gone
until you post a new one.

**How it works.** A scheduled GitHub Action reads the channel's public page
(`t.me/s/mukhtorov_md` -- the same one anyone can open, no bot token involved),
finds the newest tagged post, and writes `public/announcement.json` as part of
the normal build. The app fetches that file at runtime, cache-busted by the
hour so a new card never forces anyone to re-download the app. Nothing needs a
server, and it costs nothing: Actions minutes are free on public repositories.

The Bot API would have been the obvious route and is deliberately not used. It
needs the bot token, and the only place a static site could keep a token is in
the page, where anyone could take the bot.

**Three things worth knowing:**

- It is not instant. The timer runs every 30 minutes and the deploy takes
  about a minute, so allow up to an hour. To publish immediately, open the
  repository's **Actions** tab, pick **Deploy to GitHub Pages**, and press
  **Run workflow**.
- **GitHub switches off scheduled workflows after 60 days without a push to
  the repository.** You get an email when it happens, and any push -- or the
  "Enable workflow" button on the Actions tab -- turns them back on. If cards
  ever stop updating, check this first.
- Only public channels can be read this way, and only the recent posts on the
  channel page are considered.

To see what would be published without publishing anything:

```bash
npm run announcement -- --dry
npm run announcement -- --tag=AI --dry   # try the parser on another tag
```

To follow a different tag or change the 10-day window, edit `TAG` and
`MAX_AGE_DAYS` at the top of `tools/fetch-announcement.mjs`. The window also
lives in `lib/announcement.ts`, because a deploy can sit unchanged for months
and a stale card must still expire; `npm test` fails if the two disagree.

## Develop

```bash
npm install
```

```bash
npm run dev
```

Everything works in a plain browser outside Telegram: the theme falls back to
its own palette, haptics become no-ops, and the key is kept in `localStorage`
instead of Telegram cloud storage.

```bash
npm run typecheck
```

## Deploy free, in three steps

**1. Push to GitHub.** The repo lives at `enviso-app/enviso-app.github.io`. A
repo named after the organisation is served from the root, which is why the URL
carries no path and no personal username.

**2. Turn on Pages.** Repo → Settings → Pages → Source: **GitHub Actions**. The
workflow in `.github/workflows/deploy.yml` builds and publishes on every push to
`main`. Your app lands at `https://enviso-app.github.io/`.

**3. Register the Mini App with BotFather.**

- `/newbot` — create the bot and keep the token.
- `/newapp` — pick the bot, give it a title, description, a 640×360 image, and
  paste the Pages URL as the Web App URL.
- `/setmenubutton` — point the bot's menu button at the same URL so the app
  opens from any chat with the bot.

BotFather hands back a `t.me/<bot>/<app>` link. That link is the product.

## Layout

```
App.tsx                         screen layout, URL input, language toggle
components/ContentContainer.tsx  generation state machine and the two tabs
components/KeyGate.tsx           bring-your-own-key onboarding
components/Diagnostics.tsx       probes what the user's key can actually do
components/HistoryList.tsx       apps this device has already built
components/Illustrations.tsx     inline SVG for the empty and refused states
lib/history.ts                   IndexedDB store of finished generations
lib/deeplink.ts                  share links and startapp payloads
lib/prompts.ts                   both prompts — the product's behavior lives here
lib/screening.ts                 the guards, and what counts as an unusable source
lib/source.ts                    what a generation is built from: video, PDF, or link
lib/textGeneration.ts            model discovery, streaming, busy-model handling
lib/telegram.ts                  Mini App SDK wrapper with browser fallbacks
lib/i18n.ts                      interface strings, uz + en
```

## When a model is busy

Google returns "this model is currently experiencing high demand" on its
newest model far more often than on the one behind it — measured on a real
key, the newest returned 503 while the release directly behind it answered
immediately.

So the newest model is tried **last**, not first. Generation starts one
release back, walks the whole list in a single pass with no delay, and only
begins waiting once every model has refused. The newest stays pinned to the
end of the chain, since it is a poor first choice and a perfectly good last
one. Whichever model worked is remembered and tried first next time.

If something does fail, the settings screen has a **Run check** button that
probes the key directly and reports, per model, whether text and video
requests are accepted. That is far faster than guessing.
