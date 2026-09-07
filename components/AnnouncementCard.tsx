/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Announcement,
  dismiss,
  isDismissed,
  loadAnnouncement,
} from '@/lib/announcement';
import {useSettings} from '@/context';
import {haptic, openTelegram} from '@/lib/telegram';
import {useEffect, useState} from 'react';

/**
 * Whatever was last posted on the channel with the tag.
 *
 * Renders nothing at all until there is something to show, so the layout does
 * not jump on load and no space is reserved for a card that may not exist --
 * which is the normal state, since most of the time there is no announcement.
 */
export default function AnnouncementCard() {
  const {t} = useSettings();
  const [ad, setAd] = useState<Announcement | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadAnnouncement().then((found) => {
      if (alive && found && !isDismissed(found.id)) setAd(found);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ad || gone) return null;

  const open = () => {
    haptic();
    // The link was checked to be a t.me address before it got here.
    openTelegram(ad.link);
  };

  const close = (event: React.MouseEvent) => {
    event.stopPropagation();
    haptic();
    dismiss(ad.id);
    setGone(true);
  };

  return (
    <div className="ad">
      <button className="ad-main" onClick={open}>
        {ad.image && (
          <span className="ad-thumb">
            {/* Hosted by Telegram's CDN. If it fails to load the card simply
                loses its picture -- the text is the message. */}
            <img
              src={ad.image}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </span>
        )}
        <span className="ad-body">
          <span className="ad-from">{t.adFrom}</span>
          <span className="ad-title">{ad.title}</span>
          {ad.body && <span className="ad-text">{ad.body}</span>}
        </span>
      </button>

      <button className="ad-x" onClick={close} aria-label={t.adDismiss}>
        &#215;
      </button>

      <style>{`
        .ad {
          align-items: stretch;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          display: flex;
          gap: 0.25rem;
          overflow: hidden;
        }

        .ad-main {
          align-items: center;
          background: transparent;
          border-radius: 0;
          color: var(--color-text);
          display: flex;
          flex: 1;
          gap: 0.7rem;
          min-width: 0;
          padding: 0.65rem;
          text-align: left;
        }

        .ad-thumb {
          align-items: center;
          background: var(--color-background);
          border-radius: 8px;
          display: flex;
          flex: 0 0 52px;
          height: 52px;
          justify-content: center;
          overflow: hidden;
          width: 52px;
        }

        .ad-thumb img {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .ad-body {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }

        .ad-from {
          color: var(--color-brand);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ad-title {
          font-size: 0.92rem;
          font-weight: 600;
          line-height: 1.35;
        }

        /* Two lines at most: an announcement is a nudge towards the post, not
           the post itself. */
        .ad-text {
          color: var(--color-hint);
          display: -webkit-box;
          font-size: 0.8rem;
          line-height: 1.4;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .ad-x {
          background: transparent;
          color: var(--color-hint);
          flex: 0 0 auto;
          font-size: 1.15rem;
          min-height: auto;
          padding: 0 0.7rem;
        }
      `}</style>
    </div>
  );
}
