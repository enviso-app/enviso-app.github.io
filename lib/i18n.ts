/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Interface strings.
 *
 * English throughout, interface and generated output alike. The app used to
 * carry both languages and require the same of everything it produced; that
 * halved the room every figure had and doubled the text a generation had to
 * write, for no gain the reader could see.
 */

export const strings = {
  appName: 'Enviso',
  /** Shown before a source has been chosen, so it must cover all three. */
  subtitleAll: 'Turn a video, a paper or a picture into something interactive',
  subtitleVideo: 'Turn a YouTube lesson into an interactive learning app',
  subtitlePaper: 'Turn a research paper into an interactive explainer',
  subtitleDiagram: 'Turn a picture of something into a working app',
  inputLabel: 'Paste a YouTube link',
  inputPlaceholder: 'https://www.youtube.com/watch?v=...',
  generate: 'Generate',
  validating: 'Checking link...',
  generating: 'Generating...',
  regenerate: 'Generate again',
  videoPlaceholder: 'Your video appears here',
  contentPlaceholder: 'Your learning app will appear here',
  introStep1: 'Paste a link to a short YouTube lesson',
  introStep2: 'Gemini watches it and designs an app around its main idea',
  introStep3: 'Practise with the app it builds',
  invalidUrl: 'That does not look like a YouTube link',
  checkingVideo: 'Checking the video...',
  checkingPaper: 'Finding the full text...',

  reqTitle: 'What works here',
  reqDuration: 'Under 30 minutes — 3 to 15 works best',
  reqLanguage: 'Spoken in English',
  reqSpeech: 'Someone explaining something, not music or ambient sound',
  reqPaperAccess: 'Open access, or upload the PDF',
  reqPaperLanguage: 'Written in English',

  rejectTitle: 'This video will not work',
  rejectWhy: 'It said:',
  generateAnyway: 'Build it anyway',
  rejectTitlePaper: 'This publication will not work',
  paperFound: 'Found',
  rejectTooLong:
    'The video is longer than 30 minutes. Please pick a shorter one - 3 to 15 minutes works best.',
  rejectLanguage:
    'Only English is supported. This one sounds like {lang}.',
  rejectMusic:
    'This is a music video. Pick one where someone explains or teaches something.',
  rejectNoSpeech:
    'Nobody speaks in this video, so there is nothing to build a lesson from. Pick one where someone explains something.',
  rejectNotEducational:
    'Nothing usable came back for this one. Try again, or pick another video.',
  rejectUnreadable:
    'Only an abstract or a paywall was reachable, so the full text could not be read. Try the publisher’s own article link instead of a DOI, or upload the PDF.',
  rejectNotResearch:
    'This does not look like a research publication. Try a paper, preprint, or thesis.',
  rejectTitleDiagram: 'Nothing could be made out',
  rejectIllegible:
    'The image came through blank or too unclear to identify anything in it. Try a sharper photo, better light, or a straight-on angle.',

  chooseTitle: 'What are you starting from?',
  chooseSubtitle: 'Pick one. You can switch at any time.',
  chooseVideoTitle: 'A video lesson',
  chooseVideoBody:
    'A YouTube lesson becomes an app you practise with: a model to manipulate, a worked example, questions with reasons, and a recap to keep.',
  choosePaperTitle: 'A research paper',
  choosePaperBody:
    'A paper becomes an explainer site: the problem, the mechanism made visible, its real numbers as figures you can explore, and the citation.',
  chooseDiagramTitle: 'A picture of something',
  chooseDiagramBody:
    'A sketch, a whiteboard, a flowchart, a form, even a photo of your desk becomes a working app built around whatever it implies.',

  modeVideo: 'Video',
  modePaper: 'Research',
  modeDiagram: 'Picture',
  paperLabel: 'Link to the publication',
  paperPlaceholder: 'https://doi.org/... or arxiv.org/...',
  paperOr: 'or',
  paperUpload: 'Choose a PDF',
  /** {size} is filled from the real cap, so the two can never drift apart. */
  paperLimits: 'PDF only, up to {size} MB',
  paperWrongType: 'That needs to be a PDF',
  paperChosen: 'Selected',
  paperTooBig: 'That PDF is too large. The limit is 12 MB.',
  paperNeedInput: 'Add a link or choose a PDF first',
  hintPaywall:
    'This publisher often shows only an abstract. If it is not open access, upload the PDF instead.',
  hintAbstractOnly:
    'PubMed shows abstracts only. Use the PubMed Central full-text link, or upload the PDF.',
  hintBlocked:
    'This site blocks automated readers, so the paper cannot be fetched. Upload the PDF instead.',
  hintDoi:
    'A DOI leads to the publisher, so only the abstract may be readable. Upload the PDF if it is paywalled.',
  paperPlaceholderText: 'Your explainer will appear here',
  paperStep1: 'Paste a link to a paper, or upload its PDF',
  paperStep2: 'Gemini reads it and designs an interactive explainer',
  paperStep3: 'Explore the mechanism it makes visible',

  diagramLabel: 'A picture to build from',
  diagramUpload: 'Choose an image or PDF',
  diagramNeedFile: 'Choose an image or a PDF first',
  diagramTooBig: 'That file is too large. The limit is 12 MB.',
  diagramUnreadable: 'That file could not be read. Try another.',
  diagramLimits: 'PNG, JPG, WEBP or PDF, up to {size} MB',
  diagramWrongType: 'That needs to be an image or a PDF',
  diagramPlaceholderText: 'Your app will appear here',
  diagramStep1: 'Upload a sketch, screenshot, diagram or photo',
  diagramStep2: 'Gemini works out what it implies and designs an app',
  diagramStep3: 'Use the thing your picture was pointing at',
  checkingDiagram: 'Reading the picture...',

  tabApp: 'App',
  tabSpec: 'About',
  tabPlan: 'Developer plan',
  aboutHeading: 'What you will learn',
  buildingNow: 'Building it now...',
  buildingPart: 'Writing part',
  loadingSite: 'Reading the paper and planning the site...',

  variationsTitle: 'Not quite right?',
  variationSimpler: 'Simpler',
  variationVisual: 'More visual',
  variationQuiz: 'As a quiz',

  save: 'Save as file',
  saveStarted: 'Download started',
  saveFailedMsg: 'Could not start the download',
  /*
   * Shown only after a save has been attempted. Whether the file arrived
   * cannot be detected, so the app says what it did and offers the way out
   * rather than asserting a success it cannot see.
   */
  saveUnsure: 'No file? Some in-app browsers block downloads — use Copy.',
  copy: 'Copy',
  copyFailedMsg: 'Could not copy',
  share: 'Share',
  shareTextVideo: 'I made an interactive learning app from this with Enviso —',
  shareTextPaper: 'I made an interactive explainer from this with Enviso —',
  shareFooter: 'Make your own:',
  saveFailed: 'Could not save this to your history',

  historyTitle: 'Your apps',
  historyEmpty: 'Apps you build are kept here',
  historyOpen: 'Open',
  historyDelete: 'Delete',
  historyClear: 'Clear all',
  historyVideo: 'From a video',
  historyPaper: 'From a paper',
  historyDiagram: 'From a picture',

  loadingSpec: 'Watching the video and writing a plan...',
  loadingPaper: 'Reading the publication and writing a plan...',
  loadingDiagram: 'Reading the picture and working out what to build...',
  loadingCode: 'Building your app from the plan...',
  stillWorking: 'Still working - it may take several minutes',

  error: 'Something went wrong',
  retry: 'Try again',
  quotaFallback: 'Free quota reached on the bigger model, retrying a faster one',
  busyRetry: 'Google is busy right now. Waiting, then trying again',
  switchingModel: 'That model is busy. Switching to another one',
  allBusy: 'All models are busy. Trying again in',
  quotaWait: 'Your key hit its per-minute limit. Waiting',
  quotaDaily:
    'Your key has used up today’s free quota on the larger models. It resets at midnight US Pacific time. Until then the app falls back to the lighter model, or you can add billing to your key.',
  seconds: 's',
  busyGaveUp:
    'Google is overloaded at the moment. This is temporary - wait a few minutes and press Try again.',

  edit: 'Edit',
  saveRegenerate: 'Save and rebuild',
  cancel: 'Cancel',
  copied: 'Copied',
  openFull: 'Open full screen',
  closeFull: 'Close',


  keyNeeded: 'One quick step first',
  keyTitle: 'Add your Gemini API key',
  trouble: 'Having trouble?',
  keyIntro:
    'This app runs entirely on your device with no server, so it uses your own Google AI Studio key. The free tier is enough for everyday use.',
  keyStep1: 'Open Google AI Studio and create a key',
  keyStep2: 'Paste it below',
  keyGet: 'Get a free key',
  keyWatch: 'Watch how (2 min)',
  keyPlaceholder: 'AIza...',
  keySave: 'Save key',
  keyChecking: 'Checking key...',
  keyBad: 'That key was rejected. Check it and try again.',
  keyStored:
    'Your key is stored in your own Telegram cloud storage and is never sent anywhere except Google.',
  /* Outside Telegram there is no cloud to put it in: it stays in this browser. */
  keyStoredBrowser:
    'Your key is stored in this browser only and is never sent anywhere except Google.',
  diagTitle: 'Check what your key can do',
  diagIntro:
    'Runs a few tiny test requests and shows exactly which models work, which are busy, and whether video input is allowed.',
  diagRun: 'Run check',
  diagRunning: 'Checking...',
  diagCopy: 'Copy result',
  keyChange: 'Change API key',
  keyRemove: 'Remove key',
  settings: 'Settings',
  back: 'Back',
  done: 'Done',

  /* Split so the surname can be the link and the rest cannot. */
  credit: 'designed by',
  creditName: 'mukhtorov',
};

export type Strings = typeof strings;
