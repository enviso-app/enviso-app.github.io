/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The announcement card's content, built from a tagged post on the channel.
 *
 * Written by tools/fetch-announcement.mjs during the deploy; see that file for
 * how a post becomes a card. The file is "null" when there is nothing to show,
 * and may be missing entirely on an older build -- both mean the same thing.
 */

const KEY = 'enviso_ad_seen';

/**
 * Matches MAX_AGE_DAYS in the fetcher.
 *
 * Checked again here because a deploy can sit unchanged for a long time --
 * GitHub disables scheduled workflows after a couple of months of repository
 * quiet -- and a stale card should still expire. tools/announcement.test.mjs
 * fails if this number and the fetcher's ever drift apart.
 */
const MAX_AGE_DAYS = 10;

export interface Announcement {
  id: string;
  title: string;
  body: string;
  link: string;
  image: string | null;
  date: string | null;
}

let pending: Promise<Announcement | null> | null = null;

export function loadAnnouncement(): Promise<Announcement | null> {
  if (pending) return pending;

  /*
   * Cache-bust by the hour rather than by a content hash.
   *
   * The file is a few hundred bytes, and a hash would have to live in the JS
   * bundle -- so every announcement would change the bundle's name and force
   * everyone to re-download the whole app to read one card.
   */
  const bucket = Math.floor(Date.now() / 3600000);
  const url = `${import.meta.env.BASE_URL}announcement.json?h=${bucket}`;

  pending = fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((ad) => (valid(ad) ? (ad as Announcement) : null))
    .catch(() => null); // a missing file is simply no announcement

  return pending;
}

function valid(ad: unknown): ad is Announcement {
  if (!ad || typeof ad !== 'object') return false;

  const {id, title, link, date} = ad as Record<string, unknown>;
  if (typeof id !== 'string' || !id) return false;
  if (typeof title !== 'string' || !title) return false;
  if (typeof link !== 'string' || !link) return false;

  // Only ever link into Telegram. The card's content comes from a page this
  // app does not control, so the destination is worth checking here rather
  // than trusting whatever the build wrote.
  if (!/^https:\/\/t\.me\//.test(link)) return false;

  if (typeof date === 'string' && date) {
    const age = (Date.now() - Date.parse(date)) / 86400000;
    if (Number.isFinite(age) && age > MAX_AGE_DAYS) return false;
  }

  return true;
}

/* -- dismissal --------------------------------------------------------------
   Per post, in localStorage only. It is a preference about one card on one
   device, not something worth a cloud round trip -- and Telegram's cloud
   storage is reserved for the API key. */

export function isDismissed(id: string): boolean {
  try {
    return localStorage.getItem(KEY) === id;
  } catch {
    return false;
  }
}

export function dismiss(id: string): void {
  try {
    // One id, not a list: a new announcement should always show, and there is
    // no reason to remember cards that can no longer appear.
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode -- the card returns next launch, which is survivable */
  }
}
