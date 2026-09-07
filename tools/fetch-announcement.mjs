// Turns a tagged post on the Telegram channel into the app's announcement card.
//
// Post on t.me/mukhtorov_md with #enviso in the text and, on the next
// scheduled build, that post shows as a card at the top of the home screen.
// Post a newer tagged one to replace it, delete it to remove it, or leave it
// to expire on its own.
//
// Why scrape the public channel preview rather than call the Bot API: the API
// needs the bot token, and the only place a static site could keep a token is
// in the page, where anyone could take the bot. t.me/s/<channel> is the same
// public page anyone can open, needs no credentials, and this runs on a GitHub
// runner rather than in the browser, so there is no CORS problem either.
//
// Output: public/announcement.json (git-ignored, rebuilt each deploy).
// Failure is never fatal -- see the bottom of the file.

import {writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'announcement.json');

const CHANNEL = 'mukhtorov_md';

// The tag that marks a post as an in-app announcement. Change this line and
// the app follows a different tag.
const TAG = 'enviso';

// A card older than this stops showing, so a forgotten post does not sit in
// the app forever. lib/announcement.ts holds the same number, and a test
// fails if the two ever disagree.
const MAX_AGE_DAYS = 10;

const TITLE_MAX = 70;
const BODY_MAX = 105;

/* -- parsing --------------------------------------------------------------- */

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+|#\d+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** The message text as plain text, with line breaks preserved. */
function textOf(html) {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Pull the messages out of the channel's public preview page.
 *
 * Deliberately tolerant: it looks for the few attributes that carry meaning
 * and ignores the rest of the markup, so a styling change upstream does not
 * break it. If the shape changes enough that nothing parses, the caller
 * treats that as a failure and publishes no card rather than junk.
 */
export function parseChannel(html) {
  const posts = [];
  const wrapper = /<div class="tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"/g;

  const starts = [];
  for (let m; (m = wrapper.exec(html)); ) starts.push({id: m[1], at: m.index});

  for (let i = 0; i < starts.length; i++) {
    const block = html.slice(starts[i].at, starts[i + 1]?.at ?? html.length);

    const textMatch = block.match(
      /<div class="[^"]*js-message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_footer|<div class="tgme_widget_message_reply|$)/,
    );
    const timeMatch = block.match(/<time[^>]+datetime="([^"]+)"/);
    const photoMatch = block.match(/background-image:url\('([^']+)'\)/);

    if (!textMatch) continue;
    const text = textOf(textMatch[1]);
    if (!text) continue;

    posts.push({
      id: starts[i].id,
      link: `https://t.me/${starts[i].id}`,
      date: timeMatch ? timeMatch[1] : null,
      text,
      // Only photos, not the author avatar, carry a background-image here.
      image: photoMatch ? photoMatch[1] : null,
    });
  }
  return posts;
}

/** Trim to a whole word rather than cutting mid-word. */
function clip(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const kept = space > max * 0.6 ? cut.slice(0, space) : cut;
  return kept.replace(/[,;:.\s]+$/, '') + '…';
}

/** The newest tagged post that has not expired, shaped for the card. */
export function pickAnnouncement(
  posts,
  {tag = TAG, now = Date.now(), maxAgeDays = MAX_AGE_DAYS} = {},
) {
  const tagRe = new RegExp('#' + tag + '\\b', 'i');

  // The page lists oldest first, so the last match is the newest post.
  const tagged = posts.filter((p) => tagRe.test(p.text));
  const post = tagged[tagged.length - 1];
  if (!post) return null;

  if (post.date) {
    const age = (now - Date.parse(post.date)) / 86400000;
    if (Number.isFinite(age) && age > maxAgeDays) return null;
  }

  // The tag is plumbing, not copy -- strip it from what the card shows.
  const body = post.text
    .replace(new RegExp('#' + tag + '\\b', 'gi'), '')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const rest = lines.slice(1).join(' ').trim();

  return {
    id: post.id,
    title: clip(lines[0], TITLE_MAX),
    body: rest ? clip(rest, BODY_MAX) : '',
    link: post.link,
    image: post.image,
    date: post.date,
  };
}

/* -- run ------------------------------------------------------------------- */

/** `--tag=AI` follows a different tag; `--dry` prints without writing. */
function options(argv) {
  const flag = argv.find((a) => a.startsWith('--tag='));
  return {tag: flag ? flag.slice('--tag='.length) : TAG, dry: argv.includes('--dry')};
}

export async function fetchChannel(channel = CHANNEL) {
  const url = 'https://t.me/s/' + channel;
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'enviso-build (+https://github.com/enviso-app/enviso-app.github.io)',
    },
  });
  if (!res.ok) throw new Error(res.status + ' fetching ' + url);
  return res.text();
}

async function main() {
  const {tag, dry} = options(process.argv.slice(2));

  const html = await fetchChannel();
  const posts = parseChannel(html);
  if (!posts.length) {
    throw new Error('no posts parsed -- the page shape may have changed');
  }

  const picked = pickAnnouncement(posts, {tag});

  console.log('channel            : t.me/s/' + CHANNEL);
  console.log('posts read         : ' + posts.length);
  console.log('tag followed       : #' + tag);

  // A dry run is for looking: it reports every tagged post it saw and the card
  // it would publish, and writes nothing.
  if (dry) {
    const tagRe = new RegExp('#' + tag + '\\b', 'i');
    const tagged = posts.filter((p) => tagRe.test(p.text));
    console.log('posts carrying it  : ' + tagged.length);
    for (const p of tagged) {
      const first = p.text.split('\n')[0].slice(0, 58);
      console.log('  ' + (p.date || 'no date') + '  ' + p.id + '  ' + first);
    }
    console.log('\nwhat the card would show:');
    console.log(JSON.stringify(picked, null, 2));
    return;
  }

  writeFileSync(OUT, JSON.stringify(picked ?? null), 'utf8');

  if (picked) {
    console.log('announcement       : ' + picked.id + ' -- ' + picked.title);
  } else {
    console.log(
      'announcement       : none (no #' + tag + ' post in the last ' +
        MAX_AGE_DAYS + ' days)',
    );
  }
}

// Only run when invoked directly, so the tests can import the parser.
const invoked = process.argv[1] && process.argv[1].replace(/\\/g, '/');
if (invoked && import.meta.url === new URL('file://' + (invoked.startsWith('/') ? '' : '/') + invoked).href) {
  // Never fail the build over this. A broken fetch, a rate limit, or a change
  // to Telegram's markup should cost the app its announcement card, not its
  // deploy.
  main().catch((err) => {
    console.log('announcement skipped: ' + err.message);
    try {
      writeFileSync(OUT, 'null', 'utf8');
    } catch {
      /* the app treats a missing file as "no announcement" anyway */
    }
  });
}
