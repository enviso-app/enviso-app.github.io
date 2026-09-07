/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Diagnostics from '@/components/Diagnostics';
import {KeyIllustration} from '@/components/Illustrations';
import {useSettings} from '@/context';
import {
  haptic,
  isTelegram,
  notify,
  openExternal,
  openTelegram,
} from '@/lib/telegram';
import {validateApiKey} from '@/lib/textGeneration';
import {useState} from 'react';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

/** A walkthrough of getting a key, for anyone who has never seen one. */
const KEY_GUIDE_URL = 'https://youtu.be/yZN5a12CZD8?si=EPbQLdrQY2d2-xQm';

/** The author's channel, credited on this screen in both its roles. */
const CHANNEL_URL = 'https://t.me/mukhtorov_md';

interface KeyGateProps {
  /** Rendered as a dismissable settings screen rather than a first-run gate. */
  onClose?: () => void;
  /** Fired only after a key is accepted, so the caller can resume its work. */
  onSaved?: () => void;
  /** Shown when the user hit this on the way to generating something. */
  pending?: boolean;
}

/**
 * Bring-your-own-key onboarding.
 *
 * The app has no backend, so there is nowhere to hide a shared key: each user
 * supplies their own free Google AI Studio key, which is kept in their private
 * Telegram cloud storage and sent only to Google.
 */
export default function KeyGate({onClose, onSaved, pending}: KeyGateProps) {
  const {t, apiKey, saveApiKey, clearApiKey} = useSettings();
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed || checking) return;

    haptic();
    setChecking(true);
    setRejected(false);

    const valid = await validateApiKey(trimmed);
    setChecking(false);

    if (!valid) {
      setRejected(true);
      notify('error');
      return;
    }

    await saveApiKey(trimmed);
    notify('success');
    setValue('');
    if (onSaved) onSaved();
    else onClose?.();
  };

  const handleRemove = async () => {
    haptic();
    await clearApiKey();
    setValue('');
  };

  return (
    <div className="key-gate">
      <div className="key-card">
        <h2 className="key-title display">{pending ? t.keyNeeded : t.keyTitle}</h2>
        <div className="rule" />
        <p className="hint key-intro">{t.keyIntro}</p>

        <ol className="key-steps">
          <li>
            <span className="step-number">1</span>
            <span>{t.keyStep1}</span>
          </li>
          <li>
            <span className="step-number">2</span>
            <span>{t.keyStep2}</span>
          </li>
        </ol>

        {/* A picture of the destination removes most of the doubt about
            whether you are in the right place once you get there. */}
        <KeyIllustration className="key-art" />

        <div className="key-actions">
          <button
            className="button-primary key-link"
            onClick={() => {
              haptic();
              openExternal(AI_STUDIO_URL);
            }}>
            {t.keyGet}
          </button>
          <button
            className="button-secondary key-link key-watch"
            onClick={() => {
              haptic();
              openExternal(KEY_GUIDE_URL);
            }}>
            <span aria-hidden="true">&#9654;</span> {t.keyWatch}
          </button>
        </div>

        <input
          type="password"
          className="key-input"
          value={value}
          placeholder={t.keyPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setRejected(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />

        {rejected && <p className="key-error">{t.keyBad}</p>}

        <button
          className="button-primary key-save"
          onClick={handleSave}
          disabled={!value.trim() || checking}>
          {checking ? t.keyChecking : t.keySave}
        </button>

        <p className="hint key-privacy">
          {isTelegram ? t.keyStored : t.keyStoredBrowser}
        </p>

        {apiKey && (
          <div className="key-existing">
            <button className="button-ghost" onClick={handleRemove}>
              {t.keyRemove}
            </button>
            {onClose && (
              <button className="button-ghost" onClick={onClose}>
                {t.back}
              </button>
            )}
          </div>
        )}

        {apiKey &&
          (showDiagnostics ? (
            <Diagnostics />
          ) : (
            <button
              className="button-ghost trouble-link"
              onClick={() => {
                haptic();
                setShowDiagnostics(true);
              }}>
              {t.trouble}
            </button>
          ))}

        <p className="key-credit">
          {t.credit}{' '}
          <button
            type="button"
            className="credit-link"
            onClick={() => {
              haptic();
              openTelegram(CHANNEL_URL);
            }}>
            {t.creditName}
          </button>
        </p>
      </div>

      <style>{`
        .key-gate {
          display: flex;
          justify-content: center;
          padding: 1.25rem 1rem 2rem;
        }

        .key-card {
          width: 100%;
          max-width: 460px;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .key-title {
          font-size: 1.4rem;
        }

        .key-art {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-hint);
          height: auto;
          max-width: 100%;
          padding: 0.5rem;
          width: 100%;
        }

        .key-intro {
          line-height: 1.5;
        }

        .key-steps {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .key-steps li {
          align-items: center;
          display: flex;
          font-size: 0.95rem;
          gap: 0.65rem;
        }

        .step-number {
          align-items: center;
          background: var(--color-accent);
          border-radius: 50%;
          color: var(--color-accent-text);
          display: flex;
          flex: 0 0 24px;
          font-size: 0.8rem;
          font-weight: 700;
          height: 24px;
          justify-content: center;
          width: 24px;
        }

        .key-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .key-link {
          flex: 1 1 45%;
        }

        .key-watch {
          align-items: center;
          display: flex;
          gap: 0.4rem;
          justify-content: center;
        }

        .key-error {
          color: var(--color-error);
          font-size: 0.85rem;
        }

        .key-privacy {
          line-height: 1.5;
        }

        .trouble-link {
          align-self: flex-start;
          padding-left: 0;
        }

        .key-existing {
          display: flex;
          gap: 0.5rem;
          justify-content: space-between;
        }

        .key-credit {
          border-top: 1px solid var(--color-border);
          color: var(--color-hint);
          font-size: 0.8rem;
          margin-top: 0.4rem;
          padding-top: 0.9rem;
          text-align: center;
        }

        /* A button, because Telegram blocks a plain anchor out of the webview,
           dressed as the link it reads as. */
        .credit-link {
          background: none;
          color: var(--color-brand);
          font: inherit;
          font-weight: 600;
          min-height: auto;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
