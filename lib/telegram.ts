/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin wrapper around the Telegram Mini App SDK.
 *
 * Every function degrades to a sane browser fallback so the app stays fully
 * usable outside Telegram (local dev, desktop browser, sharing a plain link).
 */

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  destructive_text_color?: string;
}

interface TelegramWebApp {
  version: string;
  initData: string;
  initDataUnsafe: {
    user?: {id: number; language_code?: string};
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  viewportStableHeight: number;
  viewportHeight: number;
  isExpanded: boolean;
  /** Device notches and rounded corners (Bot API 8.0). */
  safeAreaInset?: {top: number; bottom: number; left: number; right: number};
  /** Space the Telegram client's own chrome occupies (Bot API 8.0). */
  contentSafeAreaInset?: {top: number; bottom: number; left: number; right: number};
  ready: () => void;
  expand: () => void;
  isVersionAtLeast: (version: string) => boolean;
  disableVerticalSwipes?: () => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  openLink: (url: string, options?: {try_instant_view?: boolean}) => void;
  HapticFeedback?: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
  };
  MainButton?: {
    setParams: (params: {
      text?: string;
      is_visible?: boolean;
      is_active?: boolean;
      color?: string;
      text_color?: string;
    }) => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
  openTelegramLink?: (url: string) => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (handler: () => void) => void;
    offClick: (handler: () => void) => void;
  };
  CloudStorage?: {
    getItem: (
      key: string,
      cb: (err: string | null, value?: string) => void,
    ) => void;
    setItem: (
      key: string,
      value: string,
      cb?: (err: string | null, ok?: boolean) => void,
    ) => void;
    removeItem: (key: string, cb?: (err: string | null) => void) => void;
  };
}

export const tg: TelegramWebApp | undefined = (globalThis as any).Telegram
  ?.WebApp;

/**
 * The Telegram script defines window.Telegram.WebApp even on a plain web page,
 * so presence alone proves nothing -- a real client always supplies initData.
 */
export const isTelegram = Boolean(tg?.initData);

/** CloudStorage was added in Bot API 6.9; older clients expose a stub that
 * logs an error and never calls back. */
const hasCloudStorage = () =>
  Boolean(tg?.CloudStorage && tg.isVersionAtLeast?.('6.9'));

/** Never let a silent SDK callback block startup. */
function withTimeout<T>(
  executor: (resolve: (value: T) => void) => void,
  fallback: T,
  ms = 3000,
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    const done = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    try {
      executor(done);
    } catch {
      done(fallback);
    }
  });
}

/** Call once at startup: tell Telegram we're painted, and take the full sheet. */
export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  // Stops the sheet from being dragged closed while scrolling generated content.
  tg.disableVerticalSwipes?.();
  applyTheme();
  tg.onEvent('themeChanged', applyTheme);
  tg.onEvent('viewportChanged', applyViewport);
  tg.onEvent('safeAreaChanged', applyInsets);
  tg.onEvent('contentSafeAreaChanged', applyInsets);
  applyViewport();
  applyInsets();
}

/**
 * Map Telegram's theme onto the CSS custom properties in index.css, so the
 * app repaints itself to match whatever theme the user runs Telegram in.
 */
export function applyTheme() {
  if (!tg) return;
  const p = tg.themeParams;
  const root = document.documentElement;
  const set = (name: string, value?: string) =>
    value && root.style.setProperty(name, value);

  root.dataset.theme = tg.colorScheme;
  root.style.colorScheme = tg.colorScheme;

  set('--color-background', p.bg_color);
  set('--color-surface', p.secondary_bg_color || p.section_bg_color);
  set('--color-text', p.text_color);
  set('--color-hint', p.hint_color);
  set('--color-accent', p.button_color || p.link_color);
  set('--color-accent-text', p.button_text_color);
  set('--color-error', p.destructive_text_color);
}

function applyViewport() {
  if (!tg) return;
  const root = document.documentElement;
  root.style.setProperty('--tg-viewport-height', `${tg.viewportStableHeight}px`);
  root.style.setProperty(
    '--tg-viewport-full',
    `${tg.viewportHeight || tg.viewportStableHeight}px`,
  );
}

/**
 * Publish Telegram's own insets as CSS variables.
 *
 * `env(safe-area-inset-*)` covers the device's notch, but not the space the
 * Telegram client itself occupies -- its header sits over the page on some
 * platforms, and content placed under it is simply unreachable. Telegram
 * reports both, and the larger of the two is the one that matters.
 */
function applyInsets() {
  if (!tg) return;
  const root = document.documentElement;
  const device = tg.safeAreaInset;
  const content = tg.contentSafeAreaInset;

  const largest = (side: 'top' | 'bottom' | 'left' | 'right') =>
    Math.max(device?.[side] ?? 0, content?.[side] ?? 0);

  (['top', 'bottom', 'left', 'right'] as const).forEach((side) => {
    root.style.setProperty(`--tg-inset-${side}`, `${largest(side)}px`);
  });
}

/** The palette actually on screen right now, for embedding into prompts. */
export function currentPalette() {
  const read = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback;
  return {
    scheme: tg?.colorScheme ?? 'light',
    background: read('--color-background', '#ffffff'),
    text: read('--color-text', '#000000'),
    hint: read('--color-hint', '#707579'),
    accent: read('--color-accent', '#3390ec'),
    accentText: read('--color-accent-text', '#ffffff'),
  };
}

/**
 * Show Telegram's own back button while a sub-screen is open.
 *
 * Returns a cleanup function. Outside Telegram this is a no-op, so callers
 * need no branching -- the in-app back control covers the browser case.
 */
export function showBackButton(handler: () => void): () => void {
  const back = tg?.BackButton;
  if (!back) return () => {};

  back.onClick(handler);
  back.show();

  return () => {
    back.offClick(handler);
    back.hide();
  };
}

export interface MainButtonState {
  text: string;
  visible: boolean;
  /** Shows the spinner and blocks presses. */
  busy?: boolean;
}

/**
 * Drive Telegram's bottom action button.
 *
 * A Mini App that uses it stops feeling like a web page in a frame, which is
 * why the in-page button hides whenever this one is available.
 *
 * Returns a cleanup function; a no-op outside Telegram.
 */
export function setMainButton(
  state: MainButtonState,
  handler: () => void,
): () => void {
  const button = tg?.MainButton;
  if (!button) return () => {};

  button.onClick(handler);
  button.setParams({
    text: state.text,
    is_visible: state.visible,
    is_active: !state.busy,
  });
  if (state.busy) button.showProgress(false);
  else button.hideProgress();

  return () => {
    button.offClick(handler);
    button.setParams({is_visible: false});
    button.hideProgress();
  };
}

/** Hand a message to Telegram's own share sheet. */
export function shareToChat(url: string, text: string) {
  const share = `https://t.me/share/url?url=${encodeURIComponent(
    url,
  )}&text=${encodeURIComponent(text)}`;

  if (tg?.openTelegramLink) tg.openTelegramLink(share);
  else globalThis.open?.(share, '_blank', 'noopener');
}

/** The startapp payload this session was opened with, if any. */
export function startParam(): string | undefined {
  return tg?.initDataUnsafe?.start_param;
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  tg?.HapticFeedback?.impactOccurred(style);
}

export function notify(type: 'success' | 'warning' | 'error') {
  tg?.HapticFeedback?.notificationOccurred(type);
}

/** Open a URL outside the Mini App webview (Telegram blocks plain target=_blank). */
export function openExternal(url: string) {
  if (tg?.openLink) tg.openLink(url);
  else globalThis.open?.(url, '_blank', 'noopener');
}

/**
 * Open a t.me address inside Telegram itself.
 *
 * openLink would put the channel's *web* page in a webview, which asks the
 * reader to log in again to do anything. openTelegramLink hands the address to
 * the client, so a channel opens as a channel.
 */
export function openTelegram(url: string) {
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else openExternal(url);
}

/** The user's Telegram interface language, e.g. 'uz', 'en', 'ru'. */
export function telegramLanguage(): string | undefined {
  return tg?.initDataUnsafe?.user?.language_code;
}

/**
 * Persistent key/value storage.
 *
 * Uses Telegram CloudStorage when available, so a saved API key follows the
 * user across their devices; falls back to localStorage in a plain browser.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (hasCloudStorage()) {
      const cloud = await withTimeout<string | null>(
        (resolve) =>
          tg!.CloudStorage!.getItem(key, (err, value) =>
            resolve(err ? null : (value ?? null)),
          ),
        null,
      );
      if (cloud) return cloud;
    }
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      if (hasCloudStorage()) tg!.CloudStorage!.setItem(key, value);
    } catch {
      /* CloudStorage is best-effort; the local copy below is the safety net. */
    }
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* Private mode or blocked storage: the value simply won't persist. */
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (hasCloudStorage()) tg!.CloudStorage!.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
