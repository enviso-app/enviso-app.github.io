// The announcement parser, against a fixture shaped like Telegram's channel
// preview. No network: this locks in the behaviour, and the live page is
// exercised by actually running `npm run announcement -- --dry`.

const {parseChannel, pickAnnouncement} = await import(
  new URL('./fetch-announcement.mjs', import.meta.url).href
);

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name + ' ' + detail);
  }
};

const post = ({id, date, text, photo = null}) => `
<div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="${id}" data-view="x">
  <div class="tgme_widget_message_bubble">
    ${photo ? `<a class="tgme_widget_message_photo_wrap" style="background-image:url('${photo}')"></a>` : ''}
    <div class="tgme_widget_message_text js-message_text">${text}</div>
    <div class="tgme_widget_message_footer compact">
      <span class="tgme_widget_message_meta"><time datetime="${date}"></time></span>
    </div>
  </div>
</div>`;

const DAY = 86400000;
const NOW = Date.parse('2026-09-07T12:00:00+00:00');
const ago = (days) => new Date(NOW - days * DAY).toISOString();

// Oldest first, the order the real page uses.
const html = `<html><body>
${post({id: 'ch/1', date: ago(30), text: 'An old post with no tag at all.'})}
${post({id: 'ch/2', date: ago(3), text: 'Old news #enviso<br>Read it here.'})}
${post({id: 'ch/3', date: ago(2), text: 'Just a normal post about &quot;papers&quot; &amp; videos.'})}
${post({
  id: 'ch/4',
  date: ago(1),
  photo: 'https://cdn4.telesco.pe/file/abc.jpg',
  text: 'Pictures now work 🖼 #enviso<br>Upload a sketch and Enviso builds the app it implies, which is the sort of thing worth telling people about properly.',
})}
</body></html>`;

const posts = parseChannel(html);

console.log('\nparsing');
check('every message is found', posts.length === 4, String(posts.length));
check(
  'ids and links are built from data-post',
  posts[3].id === 'ch/4' && posts[3].link === 'https://t.me/ch/4',
  posts[3].link,
);
check('line breaks survive as newlines', posts[1].text.includes('\n'), JSON.stringify(posts[1].text));
check('html entities are decoded', posts[2].text.includes('"papers" &'), posts[2].text);
check('a photo is picked up', posts[3].image === 'https://cdn4.telesco.pe/file/abc.jpg');
check('a post without a photo has none', posts[1].image === null);
check('the date comes from the time element', posts[3].date === ago(1), String(posts[3].date));

console.log('\nchoosing');
const ad = pickAnnouncement(posts, {now: NOW});
check('the newest tagged post wins, not the first', ad.id === 'ch/4', ad && ad.id);
check(
  'the tag itself is stripped from the copy',
  !/#enviso/i.test(ad.title + ad.body),
  ad.title + ' | ' + ad.body,
);
check('the first line becomes the title', ad.title === 'Pictures now work 🖼', ad.title);
check('the rest becomes the body', ad.body.startsWith('Upload a sketch'), ad.body);
check(
  'a long body is clipped on a word boundary',
  ad.body.length <= 106 && ad.body.endsWith('…') && !ad.body.includes('  '),
  ad.body.length + ': ' + ad.body,
);
check('the image travels with the card', ad.image === 'https://cdn4.telesco.pe/file/abc.jpg');
check('untagged posts are ignored even when newer', pickAnnouncement([posts[2]], {now: NOW}) === null);

console.log('\nexpiry and edge cases');
check('a tagged post older than the window is dropped', pickAnnouncement(posts, {now: NOW, maxAgeDays: 0.5}) === null);
check('the window is inclusive enough to keep yesterday post', pickAnnouncement(posts, {now: NOW, maxAgeDays: 2})?.id === 'ch/4');
check('no posts at all is not an error', pickAnnouncement([], {now: NOW}) === null);
check(
  'a post that is only the tag yields nothing',
  pickAnnouncement(parseChannel(post({id: 'ch/9', date: ago(0), text: '#enviso'})), {now: NOW}) === null,
);
check(
  'a tag on its own line still leaves the next line as the title',
  pickAnnouncement(parseChannel(post({id: 'ch/10', date: ago(0), text: '#enviso<br>Real headline here'})), {now: NOW})
    ?.title === 'Real headline here',
);
check(
  'a different tag can be followed',
  pickAnnouncement(parseChannel(post({id: 'ch/8', date: ago(0), text: 'Hello #news'})), {now: NOW, tag: 'news'})
    ?.title === 'Hello',
);
check(
  'a tag that is only a prefix of another word does not match',
  pickAnnouncement(parseChannel(post({id: 'ch/7', date: ago(0), text: 'See #envisobot now'})), {now: NOW}) === null,
);
check(
  'a post with no date is kept rather than treated as ancient',
  pickAnnouncement(parseChannel(post({id: 'ch/11', date: '', text: 'Undated #enviso'})), {now: NOW})?.id === 'ch/11',
);

console.log('\nthe expiry window');
check(
  'the default window is 10 days, not longer',
  pickAnnouncement(parseChannel(post({id: 'ch/6', date: ago(11), text: 'Old news #enviso'})), {now: NOW}) === null,
);
check(
  'and not shorter',
  pickAnnouncement(parseChannel(post({id: 'ch/5', date: ago(9), text: 'Recent news #enviso'})), {now: NOW})?.id === 'ch/5',
);

// The app re-checks expiry itself, because a deploy can sit unchanged for
// months. The two copies of the number have to agree, or a card would linger
// in the app after the build had already stopped publishing it.
const {readFileSync} = await import('node:fs');
const constOf = (rel) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8').match(/MAX_AGE_DAYS = (\d+)/)[1];
const inFetcher = constOf('./fetch-announcement.mjs');
const inApp = constOf('../lib/announcement.ts');
check(
  'the fetcher and the app agree on the window',
  inFetcher === inApp && inFetcher === '10',
  'fetcher ' + inFetcher + ', app ' + inApp,
);

console.log('\nresilience');
check(
  'markup it does not recognise yields no posts rather than junk',
  parseChannel("<html><body><div class='something-else'>hi</div></body></html>").length === 0,
);
check('an empty page yields no posts', parseChannel('').length === 0);
check('a truncated page does not throw', parseChannel(html.slice(0, html.length / 2)).length >= 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
