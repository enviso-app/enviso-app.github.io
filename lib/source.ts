/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Largest file we will inline into a request, before base64 expansion. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** The cap in whole megabytes, for anything that has to say it out loud. */
export const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));

/**
 * The image types Gemini actually accepts, and nothing else.
 *
 * The API takes exactly PNG, JPEG, WEBP, HEIC and HEIF. GIF, SVG, BMP and
 * TIFF are not on that list, and `image/*` waved all of them through -- so
 * exporting a flowchart as SVG, an ordinary thing to do, was accepted here
 * and refused at the far end of an upload as a raw API error. A format we
 * cannot use has to be refused at the moment it is picked, in a sentence.
 */
const PICTURE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
];

/** What a diagram may be, stated so the picker can filter on it too. */
export const DIAGRAM_ACCEPT = [
  ...PICTURE_TYPES,
  'application/pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.webp',
  '.heic',
  '.heif',
  '.pdf',
].join(',');

/**
 * Extensions we accept when the browser reports no type at all.
 *
 * A file picked from an unusual source, or with an extension Windows does
 * not recognise, arrives with an empty `type`. Judging on that alone would
 * refuse a perfectly good photograph for a reason the person cannot see or
 * fix, so the name gets the second word. It lists only what the API takes.
 */
const PICTURE_EXTENSION = /\.(png|jpe?g|jfif|webp|heic|heif|pdf)$/i;

/** True for a file that can be handed to Gemini as a picture. */
export function isPictureFile(file: File): boolean {
  if (PICTURE_TYPES.includes(file.type) || file.type === 'application/pdf') {
    return true;
  }
  return file.type === '' && PICTURE_EXTENSION.test(file.name);
}

/** True for a file that can be handed to Gemini as a paper. */
export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') return true;
  return file.type === '' && /\.pdf$/i.test(file.name);
}

export type SourceKind = 'video' | 'paper' | 'diagram';

/**
 * What a generation is built from.
 *
 * A paper arrives either as a file the user picked or as a link the model
 * retrieves itself; both end up here so one pipeline serves all three inputs.
 */
export type Source =
  | {kind: 'video'; url: string}
  | {
      kind: 'paper';
      via: 'url';
      url: string;
      /** Full-text addresses resolved from the link, best first. */
      candidates?: string[];
      /** The paper's real title, once a lookup has confirmed it. */
      title?: string;
    }
  | {kind: 'paper'; via: 'file'; name: string; mimeType: string; base64: string}
  /**
   * A picture of something that implies an interface.
   *
   * A wireframe, a whiteboard, a flowchart, a form, a screenshot, a page of a
   * textbook. Unlike the other two there is no link form: the thing itself is
   * the source, and it only ever arrives as a file.
   */
  | {kind: 'diagram'; name: string; mimeType: string; base64: string};

/**
 * The subset of sources that can be described by a link alone.
 *
 * An uploaded PDF lives on one device with no server to put it on, so only
 * these can be shared or restored from a URL.
 */
export type LinkSource =
  | {kind: 'video'; url: string}
  | {kind: 'paper'; via: 'url'; url: string};

/** Stable identity for a source, used to key the generating component. */
export function sourceLabel(source: Source): string {
  if (source.kind === 'video') return source.url;
  if (source.kind === 'diagram') return source.name;
  return source.via === 'url' ? source.url : source.name;
}

/**
 * What to call a file the browser would not name.
 *
 * `file.type || 'application/pdf'` was written for the PDF upload, and on the
 * picture path it contradicted the check above: isPictureFile goes out of its
 * way to accept an image whose type is empty, and then the image was sent to
 * Gemini declared as a PDF. The extension already told us what it is.
 */
const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

function inferMimeType(file: File): string {
  // Some systems report a spelling the API does not know.
  if (file.type === 'image/jpg') return 'image/jpeg';
  if (file.type) return file.type;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? 'application/pdf';
}

/**
 * Read a picked file as base64.
 *
 * The result is inlined into the request rather than uploaded, which avoids
 * the upload lifecycle entirely -- no waiting for a file to become active, no
 * expiry to reason about. The size cap keeps the request inside the inline
 * limit once base64 has added its third.
 */
export function readFileAsBase64(
  file: File,
): Promise<{name: string; mimeType: string; base64: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      if (comma === -1) {
        reject(new Error('Could not read that file'));
        return;
      }
      resolve({
        name: file.name,
        mimeType: inferMimeType(file),
        base64: result.slice(comma + 1),
      });
    };

    reader.readAsDataURL(file);
  });
}

/** True for something that plausibly points at a publication. */
export function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Link hints                                                                 */
/* -------------------------------------------------------------------------- */

export type LinkHint = 'paywall' | 'abstractOnly' | 'blocked' | 'doi';

/**
 * Hosts whose pages usually yield less than the full text.
 *
 * These are hints, never refusals: plenty of papers on these publishers are
 * open access, and the app cannot know which until it has actually read one.
 * The point is to warn before a generation is spent, not to decide.
 */
const HINTS: {hint: LinkHint; hosts: string[]}[] = [
  {
    hint: 'blocked',
    hosts: ['researchgate.net', 'academia.edu', 'drive.google.com', 'dropbox.com'],
  },
  {
    hint: 'abstractOnly',
    hosts: ['pubmed.ncbi.nlm.nih.gov'],
  },
  {
    hint: 'paywall',
    hosts: [
      'sciencedirect.com',
      'elsevier.com',
      'link.springer.com',
      'springer.com',
      'onlinelibrary.wiley.com',
      'wiley.com',
      'tandfonline.com',
      'jstor.org',
      'nejm.org',
      'thelancet.com',
      'jamanetwork.com',
      'cell.com',
      'ieeexplore.ieee.org',
      'dl.acm.org',
      'academic.oup.com',
      'karger.com',
      'thieme-connect.com',
      'sagepub.com',
    ],
  },
  {
    hint: 'doi',
    hosts: ['doi.org', 'dx.doi.org'],
  },
];

/** What to warn about for a pasted link, or null when it looks fine. */
export function linkHintFor(value: string): LinkHint | null {
  const trimmed = value.trim();
  if (!looksLikeUrl(trimmed)) return null;

  let host: string;
  try {
    host = new URL(trimmed).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }

  // A direct PDF is the thing itself, whoever is hosting it.
  if (new URL(trimmed).pathname.toLowerCase().endsWith('.pdf')) return null;

  for (const {hint, hosts} of HINTS) {
    if (hosts.some((known) => host === known || host.endsWith(`.${known}`))) {
      return hint;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* DOI expansion                                                              */
/* -------------------------------------------------------------------------- */

/** PLOS DOI suffixes map to their own journal sites. */
const PLOS_JOURNALS: Record<string, string> = {
  pone: 'plosone',
  pbio: 'plosbiology',
  pmed: 'plosmedicine',
  pgen: 'plosgenetics',
  pcbi: 'ploscompbiol',
  ppat: 'plospathogens',
  pntd: 'plosntds',
};

/**
 * Turn a link into every address worth trying for the full text.
 *
 * A doi.org URL is a redirect, and the retrieval tool appears to read the
 * redirect stub rather than following it -- which is why an open-access PLOS
 * paper came back reported as paywalled. Handing over the publisher's own
 * article URL as well removes the redirect from the path entirely.
 *
 * The original is always kept and always first; these are additions, not
 * replacements, since a guess that misses costs nothing.
 */
export function expandPaperUrl(url: string): string[] {
  const candidates = [url.trim()];

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return candidates;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'doi.org' && host !== 'dx.doi.org') return candidates;

  const doi = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  // PLOS: 10.1371/journal.pone.0298940 -> journals.plos.org/plosone/article?id=
  const plos = doi.match(/^10\.1371\/journal\.([a-z]+)\./i);
  if (plos) {
    const journal = PLOS_JOURNALS[plos[1].toLowerCase()];
    if (journal) {
      candidates.push(
        `https://journals.plos.org/${journal}/article?id=${doi}`,
        `https://journals.plos.org/${journal}/article/file?id=${doi}&type=printable`,
      );
    }
  }

  // arXiv: 10.48550/arXiv.2404.01234 -> arxiv.org/abs/2404.01234
  const arxiv = doi.match(/^10\.48550\/arxiv\.(.+)$/i);
  if (arxiv) {
    candidates.push(`https://arxiv.org/abs/${arxiv[1]}`);
  }

  // bioRxiv and medRxiv publish full text under the DOI path.
  if (/^10\.1101\//.test(doi)) {
    candidates.push(`https://www.biorxiv.org/content/${doi}v1.full`);
    candidates.push(`https://www.medrxiv.org/content/${doi}v1.full`);
  }

  return [...new Set(candidates)];
}
