/**
 * The UI's own translation dictionary — separate from `lib/language.ts`,
 * which governs what language the LLM answers IN. This file governs what
 * language the page ITSELF is written in: nav labels, headlines, button text,
 * every static string on the landing page and the chat page.
 *
 * Three languages, matching what the backend can actually answer in
 * (`AnswerLanguage` in `lib/language.ts`). There is no "auto" here — a page's
 * chrome is either English, Hindi, or Marathi; it does not detect anything.
 *
 * Structure mirrors the components that consume it (`hero.*` for Hero.tsx,
 * `chat.*` for the chat page, etc.) so a translator can find a string by
 * reading the component, not by guessing a key scheme.
 *
 * `en` is the source of truth — every string in the app is written in English
 * first and lives here unchanged. `hi` and `mr` are hand-translated, not
 * machine output, with the same identifier-preservation rule the LLM answers
 * follow: error codes, model numbers and file extensions are never
 * transliterated (see `common.faultFinder`, table headers like "OCF").
 */
export type UiLanguage = "en" | "hi" | "mr";

export const UI_LANGUAGE_OPTIONS: { value: UiLanguage; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { value: "mr", label: "Marathi", nativeLabel: "मराठी" },
];

/** Deep-nested string dictionary; leaves are either a string or a function taking interpolation vars. */
export type Dict = { [key: string]: string | ((vars: Record<string, string | number>) => string) | Dict };

type Vars = Record<string, string | number>;
interface FeedItem {
  name: string;
  description: string;
  time: string;
}
interface PreviewRow {
  activity: string;
  time: string;
}

/**
 * The structural shape every language must satisfy. Written by hand rather
 * than inferred from `en` via `typeof` -- inferring from a literal object
 * would fix every leaf to its EXACT English string type (`"Home"`, not
 * `string`), which makes it impossible for `hi`/`mr` to assign their own
 * strings to the same keys. This is what lets three independently-written
 * objects share one contract.
 */
export interface Dictionary {
  common: { faultFinder: string; demo: string; dashboard: string };
  nav: {
    home: string;
    stats: string;
    features: string;
    preview: string;
    openMenu: string;
    closeMenu: string;
  };
  hero: {
    headline: string;
    subhead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    livePreview: string;
    sidebar: { search: string; manual: string; codes: string; sources: string };
    techSupport: string;
    pause: string;
    start: string;
    reset: string;
    ready: string;
    countingDown: string;
  };
  stats: {
    heading: string;
    subhead: string;
    chunksIndexed: string;
    manualsLoaded: string;
    errorCodesResolved: string;
  };
  features: {
    heading: string;
    subhead: string;
    box1Title1: string;
    box1Title2: string;
    box1Body: string;
    box2Title1: string;
    box2Title2: string;
    box2Body: string;
    hours: string;
    min: string;
    sec: string;
    box3Title: string;
    box3Body: string;
    less: string;
    more: string;
    noQuery: string;
    answered: (v: Vars) => string;
    box4Title: string;
    box4Body: string;
    box5Title: string;
    box5Body: string;
  };
  analytics: {
    codesResolved: string;
    resolvedToday: string;
    citationRate: string;
    refusedNotGuessed: string;
    manuals: string;
    chunks: string;
    avgQuery: string;
    accuracy: string;
    manualsLoadedCount: string;
    chunksIndexedCount: string;
    avgQuerySeconds: string;
    queriesResolved: string;
  };
  feed: FeedItem[];
  showcase: { heading: string; subhead: string };
  previewSection: {
    heading: string;
    subhead: string;
    tableUser: string;
    tableActivity: string;
    tableDuration: string;
    tableCitations: string;
    tableTime: string;
    tableStatus: string;
    resolved: string;
    cited: string;
    refused: string;
    rows: PreviewRow[];
  };
  sponsor: { badge: string; heading: string; body: string; githubSponsors: string; buyMeCoffee: string };
  cta11: {
    trustedBy: string;
    heading: string;
    body: string;
    manualsIndexed: string;
    troubleshootingQueries: string;
    sourcedAnswers: string;
    getStarted: string;
    viewDemo: string;
  };
  footer: { rights: (v: Vars) => string; builtBy: string };
  chat: {
    faultFinder: string;
    manuals: string;
    pipeline: string;
    setupTroubleshooting: string;
    setupBody1p1: string;
    setupBody1p2: string;
    setupBody1p3: string;
    setupBody1p4: string;
    setupBody2: string;
    nothingIndexed: string;
    deleteManual: string;
    uploadPdfManual: string;
    indexingEllipsis: string;
    ocrScanned: string;
    pagesLabel: (v: Vars) => string;
    chunksLabel: (v: Vars) => string;
    codesLabel: (v: Vars) => string;
    pipelineChunks: string;
    pipelineFaultCodes: string;
    pipelineVectorDims: string;
    pipelineEmbedder: string;
    askFaultFinder: string;
    manualWord: string;
    manualsWord: string;
    chunksWord: string;
    headline1: string;
    headline2: string;
    subhead: string;
    uploadCta: string;
    nothingPreloaded: string;
    statManuals: string;
    statChunks: string;
    statCodes: string;
    statDims: string;
    suggestions: string[];
    askPlaceholderReady: string;
    askPlaceholderEmpty: string;
    enterToSend: string;
    uploadTitle: string;
    voiceInput: string;
    attachImageTitle: string;
    imageCaption: string;
    visionStepReading: string;
    visionStepMatching: string;
    visionStepDrafting: string;
    answersFooter: string;
    howThisWasAnswered: string;
    searchingManuals: string;
    working: string;
    answer: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    confidenceSuffix: string;
    stopReading: string;
    readAloud: string;
    probableCauses: string;
    correctiveAction: string;
    diagramsFromManual: string;
    sources: string;
    openPage: (v: Vars) => string;
    closeEsc: string;
    renderingPage: (v: Vars) => string;
    couldNotRenderPage: string;
    passageUsed: string;
    speechNotSupported: string;
    networkError: string;
    unknownError: string;
    errorPrefix: (v: Vars) => string;
    deleteFailed: string;
    deleteConfirm: (v: Vars) => string;
    uploading: (v: Vars) => string;
    parsing: (v: Vars) => string;
    stageEmbedding: string;
    stageParsing: string;
    stageChunking: string;
    stageIndexing: string;
    connectionInterrupted: (v: Vars) => string;
    uploadFailedGeneric: (v: Vars) => string;
    scannedWarning: (v: Vars) => string;
    indexedSummary: (v: Vars) => string;
    takingLong: string;
  };
}

const en: Dictionary = {
  common: {
    faultFinder: "FaultFinder",
    demo: "Demo",
    dashboard: "Dashboard",
  },

  nav: {
    home: "Home",
    stats: "Stats",
    features: "Features",
    preview: "Preview",
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
  },

  hero: {
    headline: "Turn a cryptic error code into a fix, in seconds.",
    subhead:
      "Type an error code, a symptom, or a machine name. FaultFinder retrieves the precise answer from the correct manual — with the meaning, cause, and a cited step-by-step repair.",
    ctaPrimary: "Try Live Demo",
    ctaSecondary: "See how it works",
    livePreview: "LIVE PREVIEW",
    sidebar: { search: "Search", manual: "Manual", codes: "Codes", sources: "Sources" },
    techSupport: "Tech Support",
    pause: "Pause",
    start: "Start",
    reset: "Reset",
    ready: "Ready: ",
    countingDown: "Counting down: ",
  },

  stats: {
    heading: "Built for Factories, Not Demos",
    subhead: "Real queries running through our RAG pipeline.",
    chunksIndexed: "Chunks Indexed",
    manualsLoaded: "Manuals Loaded",
    errorCodesResolved: "Error Codes Resolved",
  },

  features: {
    heading: "Everything for Machine Troubleshooting",
    subhead: "A reliable, cited RAG pipeline built for real factory floors.",
    box1Title1: "Cross-Document ",
    box1Title2: "Disambiguation",
    box1Body:
      "Same error code, different machines, different answers. We resolve ambiguity before answering.",
    box2Title1: "RAG Pipeline ",
    box2Title2: "Search, Retrieve, Cite.",
    box2Body: "Embed, retrieve, and generate cited answers from manuals.",
    hours: "Hours",
    min: "Min",
    sec: "Sec",
    box3Title: "Multi-Machine Retrieval",
    box3Body:
      "Search across multiple manuals at once — results are scoped to the correct machine automatically.",
    less: "Less",
    more: "More",
    noQuery: "No query",
    answered: (v: Record<string, string | number>) => `${v.mins} answered`,
    box4Title: "Real-time troubleshooting feed",
    box4Body: "Get instant feedback on resolved codes, ambiguity detection, and cited answers from the pipeline.",
    box5Title: "Multi-Source Hybrid Search",
    box5Body: "Vector + exact-match retrieval across all loaded manuals with page-level citations.",
  },

  analytics: {
    codesResolved: "Codes resolved",
    resolvedToday: "Resolved today",
    citationRate: "Citation rate",
    refusedNotGuessed: "Refused, not guessed",
    manuals: "Manuals",
    chunks: "Chunks",
    avgQuery: "Avg query",
    accuracy: "Accuracy",
    manualsLoadedCount: "5 loaded",
    chunksIndexedCount: "81 indexed",
    avgQuerySeconds: "1.2 sec",
    queriesResolved: "Queries resolved",
  },

  feed: [
    { name: "E101 resolved", description: "Winding fault — reseat connector, cited p.214", time: "2m ago" },
    {
      name: "Cross-manual match",
      description: "E101 also found in Press-2000 manual (different cause)",
      time: "8m ago",
    },
    { name: "Ambiguity resolved", description: "Asked machine model before answering", time: "15m ago" },
    { name: "Sourced step-by-step", description: "Corrective action from Section 4.2, page 92", time: "32m ago" },
    { name: "Insufficient info", description: "Refused guess — no match in loaded manuals", time: "1h ago" },
  ],

  showcase: {
    heading: "Interactive Workspace Showcase",
    subhead: "Search, retrieve, and explore machine troubleshooting data.",
  },

  previewSection: {
    heading: "Live Maintenance Requests with citations",
    subhead: "Real-time queries showing error codes, retrieved sources, and cited answers from the pipeline.",
    tableUser: "User",
    tableActivity: "Activity",
    tableDuration: "Duration",
    tableCitations: "Citations",
    tableTime: "Time",
    tableStatus: "Status",
    resolved: "Resolved",
    cited: "Cited",
    refused: "Refused",
    rows: [
      { activity: "E101 on the injection molding machine", time: "2m ago" },
      { activity: "b005 on PowerFlex-525", time: "12m ago" },
      { activity: "Press overheating", time: "25m ago" },
      { activity: "E204 on Press-2000", time: "1h ago" },
      { activity: "Insufficient info — refused", time: "3h ago" },
    ],
  },

  sponsor: {
    badge: "Sponsor FaultFinder",
    heading: "Help us build the ultimate troubleshooting tool.",
    body: "FaultFinder is built for the hackathon. Your support keeps the servers running and funds new features.",
    githubSponsors: "GitHub Sponsors",
    buyMeCoffee: "Buy Me a Coffee",
  },

  cta11: {
    trustedBy: "Trusted by maintenance teams resolving faults fast",
    heading: "Stop guessing. Find the fix.",
    body: "Every minute of downtime costs money. Get precise, cited troubleshooting steps pulled from the correct machine manual.",
    manualsIndexed: "Manuals Indexed",
    troubleshootingQueries: "Troubleshooting Queries",
    sourcedAnswers: "Sourced Answers",
    getStarted: "Get started free",
    viewDemo: "View live demo",
  },

  footer: {
    rights: (v: Record<string, string | number>) => `© ${v.year} FaultFinder. All rights reserved.`,
    builtBy: "Built with ❤️ by",
  },

  chat: {
    faultFinder: "FaultFinder",
    manuals: "Manuals",
    pipeline: "Pipeline",
    setupTroubleshooting: "Setup & troubleshooting",
    setupBody1p1: "Requires the parser at",
    setupBody1p2: "plus",
    setupBody1p3: "and",
    setupBody1p4: "in",
    setupBody2:
      "An upload that misbehaves can be deleted and re-uploaded — embeddings are cached, so the second pass takes seconds.",
    nothingIndexed: "Nothing indexed yet. Upload a PDF manual to begin.",
    deleteManual: "Delete manual",
    uploadPdfManual: "Upload PDF manual",
    indexingEllipsis: "Indexing…",
    ocrScanned: "OCR scanned pages (slower)",
    pagesLabel: (v: Record<string, string | number>) => `${v.pages} pages`,
    chunksLabel: (v: Record<string, string | number>) => `${v.chunks} chunks`,
    codesLabel: (v: Record<string, string | number>) => ` · ${v.faults} codes`,
    pipelineChunks: "Chunks",
    pipelineFaultCodes: "Fault codes",
    pipelineVectorDims: "Vector dims",
    pipelineEmbedder: "Embedder",

    askFaultFinder: "Ask FaultFinder",
    manualWord: "manual",
    manualsWord: "manuals",
    chunksWord: "chunks",

    headline1: "Turn a cryptic error code",
    headline2: "into a fix.",
    subhead:
      "Type an error code, a symptom, or a machine name. Every answer comes back with the meaning, the probable cause, and cited repair steps.",
    uploadCta: "Upload a PDF manual",
    nothingPreloaded: "Nothing is preloaded — the index starts empty by design.",
    statManuals: "Manuals",
    statChunks: "Chunks",
    statCodes: "Codes",
    statDims: "Dims",

    suggestions: [
      "E101 on the injection molding machine",
      "Why is the press overheating?",
      "E204 on the Press-2000",
      "b005 on powerflex",
    ],

    askPlaceholderReady: "e.g. E101 on the injection molding machine",
    askPlaceholderEmpty: "Upload a manual first, then ask anything about it",
    enterToSend: "Enter to send · Shift+Enter for a new line",
    uploadTitle: "Upload a PDF manual",
    voiceInput: "Voice input",
    attachImageTitle: "Attach a photo of the display",
    imageCaption: "Photo of the machine display",
    visionStepReading: "Reading the display…",
    visionStepMatching: "Matching the visible code against your manuals…",
    visionStepDrafting: "Drafting the response…",
    answersFooter: "Answers are retrieved from your loaded manuals and cited by page. Verify before acting on live equipment.",

    howThisWasAnswered: "How this was answered",
    searchingManuals: "Searching the manuals…",
    working: "Working…",

    answer: "Answer",
    confidenceHigh: "high",
    confidenceMedium: "medium",
    confidenceLow: "low",
    confidenceSuffix: " confidence",
    stopReading: "Stop reading",
    readAloud: "Read answer aloud",
    probableCauses: "Probable causes",
    correctiveAction: "Corrective action",
    diagramsFromManual: "Diagrams from the manual",
    sources: "Sources",
    openPage: (v: Record<string, string | number>) => `Click to open page ${v.page} of the manual`,

    closeEsc: "Close (Esc)",
    renderingPage: (v: Record<string, string | number>) => `Rendering page ${v.page}…`,
    couldNotRenderPage: "Could not render this page.",
    passageUsed: "passage used",

    speechNotSupported: "Speech recognition is not supported in this browser.",
    networkError: "Network error",
    unknownError: "Unknown",
    errorPrefix: (v: Record<string, string | number>) => `Error (${v.status})`,
    deleteFailed: "Delete failed",
    deleteConfirm: (v: Record<string, string | number>) =>
      `Delete "${v.label}"? This removes it from the index; re-upload to add it back.`,

    uploading: (v: Record<string, string | number>) => `Uploading ${v.name}…`,
    parsing: (v: Record<string, string | number>) => `Parsing ${v.name}…`,
    stageEmbedding: "Embedding",
    stageParsing: "Parsing",
    stageChunking: "Chunking",
    stageIndexing: "Indexing",
    connectionInterrupted: (v: Record<string, string | number>) =>
      `Connection interrupted — still checking on ${v.name}…`,
    uploadFailedGeneric: (v: Record<string, string | number>) => `Upload failed (${v.status})`,
    scannedWarning: (v: Record<string, string | number>) =>
      ` ${v.count} page(s) had little/no extractable text (scanned?).`,
    indexedSummary: (v: Record<string, string | number>) =>
      `Indexed ${v.title}: ${v.pages} pages, ${v.chunks} chunks, ${v.faults} fault codes.`,
    takingLong:
      "This upload is taking unusually long. Check the manuals list — it may have finished; if not, try again.",
  },
} as const;

const hi: Dictionary = {
  common: {
    faultFinder: "FaultFinder",
    demo: "डेमो",
    dashboard: "डैशबोर्ड",
  },

  nav: {
    home: "होम",
    stats: "आँकड़े",
    features: "सुविधाएँ",
    preview: "प्रीव्यू",
    openMenu: "नेविगेशन मेनू खोलें",
    closeMenu: "नेविगेशन मेनू बंद करें",
  },

  hero: {
    headline: "किसी भी उलझे हुए एरर कोड को सेकंडों में समाधान में बदलें।",
    subhead:
      "एक एरर कोड, कोई लक्षण, या मशीन का नाम टाइप करें। FaultFinder सही मैन्युअल से सटीक उत्तर निकालता है — अर्थ, कारण, और उद्धृत चरण-दर-चरण मरम्मत के साथ।",
    ctaPrimary: "लाइव डेमो आज़माएँ",
    ctaSecondary: "यह कैसे काम करता है",
    livePreview: "लाइव प्रीव्यू",
    sidebar: { search: "खोज", manual: "मैन्युअल", codes: "कोड", sources: "स्रोत" },
    techSupport: "टेक सपोर्ट",
    pause: "रोकें",
    start: "शुरू करें",
    reset: "रीसेट",
    ready: "तैयार: ",
    countingDown: "उलटी गिनती: ",
  },

  stats: {
    heading: "फैक्ट्रियों के लिए बनाया गया, डेमो के लिए नहीं",
    subhead: "हमारे RAG पाइपलाइन से गुज़रते वास्तविक प्रश्न।",
    chunksIndexed: "इंडेक्स किए गए चंक्स",
    manualsLoaded: "लोड किए गए मैन्युअल",
    errorCodesResolved: "हल किए गए एरर कोड",
  },

  features: {
    heading: "मशीन ट्रबलशूटिंग के लिए सब कुछ",
    subhead: "वास्तविक फैक्ट्री फ़्लोर के लिए बनाई गई एक भरोसेमंद, उद्धृत RAG पाइपलाइन।",
    box1Title1: "क्रॉस-डॉक्यूमेंट ",
    box1Title2: "स्पष्टीकरण",
    box1Body:
      "वही एरर कोड, अलग मशीनें, अलग जवाब। हम उत्तर देने से पहले अस्पष्टता को सुलझाते हैं।",
    box2Title1: "RAG पाइपलाइन ",
    box2Title2: "खोजें, पुनर्प्राप्त करें, उद्धृत करें।",
    box2Body: "मैन्युअल से एम्बेड, पुनर्प्राप्त करें, और उद्धृत उत्तर बनाएँ।",
    hours: "घंटे",
    min: "मिनट",
    sec: "सेकंड",
    box3Title: "मल्टी-मशीन रिट्रीवल",
    box3Body:
      "एक साथ कई मैन्युअल में खोजें — परिणाम स्वचालित रूप से सही मशीन तक सीमित रहते हैं।",
    less: "कम",
    more: "अधिक",
    noQuery: "कोई प्रश्न नहीं",
    answered: (v) => `${v.mins} उत्तर दिए गए`,
    box4Title: "रीयल-टाइम ट्रबलशूटिंग फ़ीड",
    box4Body: "हल किए गए कोड, अस्पष्टता पहचान, और पाइपलाइन से उद्धृत उत्तरों पर तुरंत जानकारी पाएँ।",
    box5Title: "मल्टी-सोर्स हाइब्रिड सर्च",
    box5Body: "पेज-स्तरीय उद्धरणों के साथ सभी लोड किए गए मैन्युअल में वेक्टर + सटीक-मिलान पुनर्प्राप्ति।",
  },

  analytics: {
    codesResolved: "हल किए गए कोड",
    resolvedToday: "आज हल किए गए",
    citationRate: "उद्धरण दर",
    refusedNotGuessed: "मना किया, अनुमान नहीं लगाया",
    manuals: "मैन्युअल",
    chunks: "चंक्स",
    avgQuery: "औसत प्रश्न",
    accuracy: "सटीकता",
    manualsLoadedCount: "5 लोड किए गए",
    chunksIndexedCount: "81 इंडेक्स किए गए",
    avgQuerySeconds: "1.2 सेकंड",
    queriesResolved: "हल किए गए प्रश्न",
  },

  feed: [
    { name: "E101 हल हुआ", description: "वाइंडिंग फॉल्ट — कनेक्टर फिर से लगाएँ, पेज 214 उद्धृत", time: "2 मि. पहले" },
    {
      name: "क्रॉस-मैन्युअल मैच",
      description: "E101, Press-2000 मैन्युअल में भी मिला (अलग कारण)",
      time: "8 मि. पहले",
    },
    { name: "अस्पष्टता सुलझी", description: "उत्तर देने से पहले मशीन मॉडल पूछा", time: "15 मि. पहले" },
    { name: "चरण-दर-चरण स्रोत मिला", description: "सेक्शन 4.2, पेज 92 से सुधारात्मक कार्रवाई", time: "32 मि. पहले" },
    { name: "अपर्याप्त जानकारी", description: "अनुमान से इनकार — लोड किए गए मैन्युअल में कोई मिलान नहीं", time: "1 घं. पहले" },
  ],

  showcase: {
    heading: "इंटरैक्टिव वर्कस्पेस शोकेस",
    subhead: "मशीन ट्रबलशूटिंग डेटा खोजें, पुनर्प्राप्त करें और एक्सप्लोर करें।",
  },

  previewSection: {
    heading: "उद्धरणों के साथ लाइव मेंटेनेंस अनुरोध",
    subhead: "पाइपलाइन से एरर कोड, पुनर्प्राप्त स्रोत, और उद्धृत उत्तर दिखाने वाले रीयल-टाइम प्रश्न।",
    tableUser: "उपयोगकर्ता",
    tableActivity: "गतिविधि",
    tableDuration: "अवधि",
    tableCitations: "उद्धरण",
    tableTime: "समय",
    tableStatus: "स्थिति",
    resolved: "हल हुआ",
    cited: "उद्धृत",
    refused: "मना किया",
    rows: [
      { activity: "इंजेक्शन मोल्डिंग मशीन पर E101", time: "2 मि. पहले" },
      { activity: "PowerFlex-525 पर b005", time: "12 मि. पहले" },
      { activity: "प्रेस ओवरहीटिंग", time: "25 मि. पहले" },
      { activity: "Press-2000 पर E204", time: "1 घं. पहले" },
      { activity: "अपर्याप्त जानकारी — मना किया", time: "3 घं. पहले" },
    ],
  },

  sponsor: {
    badge: "FaultFinder को प्रायोजित करें",
    heading: "बेहतरीन ट्रबलशूटिंग टूल बनाने में हमारी मदद करें।",
    body: "FaultFinder हैकाथॉन के लिए बनाया गया है। आपका समर्थन सर्वर चलाता रहता है और नई सुविधाओं को फंड करता है।",
    githubSponsors: "GitHub Sponsors",
    buyMeCoffee: "मुझे एक कॉफ़ी खिलाएँ",
  },

  cta11: {
    trustedBy: "तेज़ी से फॉल्ट हल करने वाली मेंटेनेंस टीमों का भरोसा",
    heading: "अनुमान लगाना बंद करें। समाधान पाएँ।",
    body: "डाउनटाइम का हर मिनट पैसे की लागत लाता है। सही मशीन मैन्युअल से सटीक, उद्धृत ट्रबलशूटिंग चरण पाएँ।",
    manualsIndexed: "इंडेक्स किए गए मैन्युअल",
    troubleshootingQueries: "ट्रबलशूटिंग प्रश्न",
    sourcedAnswers: "स्रोत-सहित उत्तर",
    getStarted: "मुफ़्त में शुरू करें",
    viewDemo: "लाइव डेमो देखें",
  },

  footer: {
    rights: (v) => `© ${v.year} FaultFinder. सर्वाधिकार सुरक्षित।`,
    builtBy: "❤️ के साथ बनाया गया —",
  },

  chat: {
    faultFinder: "FaultFinder",
    manuals: "मैन्युअल",
    pipeline: "पाइपलाइन",
    setupTroubleshooting: "सेटअप और समस्या-निवारण",
    setupBody1p1: "इसके लिए पार्सर की आवश्यकता है",
    setupBody1p2: "साथ ही",
    setupBody1p3: "और",
    setupBody1p4: "में",
    setupBody2:
      "गड़बड़ी वाले अपलोड को हटाकर फिर से अपलोड किया जा सकता है — एम्बेडिंग कैश की जाती हैं, इसलिए दूसरी बार सेकंडों में हो जाता है।",
    nothingIndexed: "अभी तक कुछ भी इंडेक्स नहीं हुआ है। शुरू करने के लिए एक PDF मैन्युअल अपलोड करें।",
    deleteManual: "मैन्युअल हटाएँ",
    uploadPdfManual: "PDF मैन्युअल अपलोड करें",
    indexingEllipsis: "इंडेक्स हो रहा है…",
    ocrScanned: "स्कैन किए गए पेजों के लिए OCR (धीमा)",
    pagesLabel: (v) => `${v.pages} पेज`,
    chunksLabel: (v) => `${v.chunks} चंक्स`,
    codesLabel: (v) => ` · ${v.faults} कोड`,
    pipelineChunks: "चंक्स",
    pipelineFaultCodes: "फॉल्ट कोड",
    pipelineVectorDims: "वेक्टर डाइम्स",
    pipelineEmbedder: "एम्बेडर",

    askFaultFinder: "FaultFinder से पूछें",
    manualWord: "मैन्युअल",
    manualsWord: "मैन्युअल",
    chunksWord: "चंक्स",

    headline1: "किसी भी उलझे हुए एरर कोड को",
    headline2: "समाधान में बदलें।",
    subhead:
      "एक एरर कोड, कोई लक्षण, या मशीन का नाम टाइप करें। हर उत्तर अर्थ, संभावित कारण, और उद्धृत मरम्मत चरणों के साथ आता है।",
    uploadCta: "PDF मैन्युअल अपलोड करें",
    nothingPreloaded: "कुछ भी पहले से लोड नहीं है — इंडेक्स जानबूझकर खाली शुरू होता है।",
    statManuals: "मैन्युअल",
    statChunks: "चंक्स",
    statCodes: "कोड",
    statDims: "डाइम्स",

    suggestions: [
      "इंजेक्शन मोल्डिंग मशीन पर E101",
      "प्रेस क्यों ओवरहीट हो रहा है?",
      "Press-2000 पर E204",
      "पॉवरफ्लेक्स पर b005",
    ],

    askPlaceholderReady: "जैसे, इंजेक्शन मोल्डिंग मशीन पर E101",
    askPlaceholderEmpty: "पहले एक मैन्युअल अपलोड करें, फिर उसके बारे में कुछ भी पूछें",
    enterToSend: "भेजने के लिए Enter · नई लाइन के लिए Shift+Enter",
    uploadTitle: "PDF मैन्युअल अपलोड करें",
    voiceInput: "आवाज़ इनपुट",
    attachImageTitle: "डिस्प्ले की फोटो अटैच करें",
    imageCaption: "मशीन के डिस्प्ले की फोटो",
    visionStepReading: "डिस्प्ले पढ़ा जा रहा है…",
    visionStepMatching: "दिख रहे कोड को आपके मैन्युअल से मिलाया जा रहा है…",
    visionStepDrafting: "उत्तर तैयार किया जा रहा है…",
    answersFooter:
      "उत्तर आपके लोड किए गए मैन्युअल से लिए जाते हैं और पेज के अनुसार उद्धृत होते हैं। असली मशीन पर काम करने से पहले सत्यापित करें।",

    howThisWasAnswered: "यह उत्तर कैसे दिया गया",
    searchingManuals: "मैन्युअल खोजे जा रहे हैं…",
    working: "काम जारी है…",

    answer: "उत्तर",
    confidenceHigh: "उच्च",
    confidenceMedium: "मध्यम",
    confidenceLow: "निम्न",
    confidenceSuffix: " विश्वास",
    stopReading: "पढ़ना रोकें",
    readAloud: "उत्तर ज़ोर से पढ़ें",
    probableCauses: "संभावित कारण",
    correctiveAction: "सुधारात्मक कार्रवाई",
    diagramsFromManual: "मैन्युअल से डायग्राम",
    sources: "स्रोत",
    openPage: (v) => `मैन्युअल का पेज ${v.page} खोलने के लिए क्लिक करें`,

    closeEsc: "बंद करें (Esc)",
    renderingPage: (v) => `पेज ${v.page} रेंडर हो रहा है…`,
    couldNotRenderPage: "यह पेज रेंडर नहीं हो सका।",
    passageUsed: "उपयोग किया गया अंश",

    speechNotSupported: "इस ब्राउज़र में वाक् पहचान समर्थित नहीं है।",
    networkError: "नेटवर्क त्रुटि",
    unknownError: "अज्ञात",
    errorPrefix: (v) => `त्रुटि (${v.status})`,
    deleteFailed: "हटाना विफल रहा",
    deleteConfirm: (v) =>
      `"${v.label}" हटाएँ? यह इसे इंडेक्स से हटा देगा; इसे वापस जोड़ने के लिए फिर से अपलोड करें।`,

    uploading: (v) => `${v.name} अपलोड हो रहा है…`,
    parsing: (v) => `${v.name} पार्स हो रहा है…`,
    stageEmbedding: "एम्बेडिंग हो रही है",
    stageParsing: "पार्स हो रहा है",
    stageChunking: "चंकिंग हो रही है",
    stageIndexing: "इंडेक्स हो रहा है",
    connectionInterrupted: (v) => `कनेक्शन बाधित हुआ — ${v.name} की जाँच जारी है…`,
    uploadFailedGeneric: (v) => `अपलोड विफल रहा (${v.status})`,
    scannedWarning: (v) => ` ${v.count} पेज में निकालने योग्य टेक्स्ट कम/नहीं था (स्कैन किया गया?)।`,
    indexedSummary: (v) => `इंडेक्स हुआ ${v.title}: ${v.pages} पेज, ${v.chunks} चंक्स, ${v.faults} फॉल्ट कोड।`,
    takingLong:
      "यह अपलोड असामान्य रूप से लंबा समय ले रहा है। मैन्युअल सूची जाँचें — शायद पूरा हो गया हो; अगर नहीं, तो फिर से कोशिश करें।",
  },
};

const mr: Dictionary = {
  common: {
    faultFinder: "FaultFinder",
    demo: "डेमो",
    dashboard: "डॅशबोर्ड",
  },

  nav: {
    home: "मुख्यपृष्ठ",
    stats: "आकडेवारी",
    features: "वैशिष्ट्ये",
    preview: "पूर्वावलोकन",
    openMenu: "नेव्हिगेशन मेनू उघडा",
    closeMenu: "नेव्हिगेशन मेनू बंद करा",
  },

  hero: {
    headline: "कोणताही गोंधळात टाकणारा एरर कोड सेकंदांत उपायात बदला.",
    subhead:
      "एरर कोड, एखादे लक्षण, किंवा मशीनचे नाव टाका. FaultFinder योग्य मॅन्युअलमधून अचूक उत्तर मिळवते — अर्थ, कारण आणि उद्धृत टप्प्याटप्प्याने दुरुस्तीसह.",
    ctaPrimary: "लाइव्ह डेमो पहा",
    ctaSecondary: "हे कसे काम करते ते पहा",
    livePreview: "लाइव्ह पूर्वावलोकन",
    sidebar: { search: "शोध", manual: "मॅन्युअल", codes: "कोड", sources: "स्रोत" },
    techSupport: "टेक सपोर्ट",
    pause: "थांबवा",
    start: "सुरू करा",
    reset: "रीसेट",
    ready: "तयार: ",
    countingDown: "उलटगणती: ",
  },

  stats: {
    heading: "कारखान्यांसाठी बनवलेले, डेमोसाठी नाही",
    subhead: "आमच्या RAG पाइपलाइनमधून जाणारे खरे प्रश्न.",
    chunksIndexed: "इंडेक्स केलेले चंक्स",
    manualsLoaded: "लोड केलेली मॅन्युअल्स",
    errorCodesResolved: "सोडवलेले एरर कोड",
  },

  features: {
    heading: "मशीन ट्रबलशूटिंगसाठी सर्व काही",
    subhead: "खऱ्या कारखान्याच्या मजल्यासाठी बनवलेली विश्वासार्ह, उद्धृत RAG पाइपलाइन.",
    box1Title1: "क्रॉस-डॉक्युमेंट ",
    box1Title2: "स्पष्टीकरण",
    box1Body: "तोच एरर कोड, वेगवेगळ्या मशीन्स, वेगवेगळी उत्तरे. उत्तर देण्यापूर्वी आम्ही संदिग्धता सोडवतो.",
    box2Title1: "RAG पाइपलाइन ",
    box2Title2: "शोधा, मिळवा, उद्धृत करा.",
    box2Body: "मॅन्युअलमधून एम्बेड करा, मिळवा आणि उद्धृत उत्तरे तयार करा.",
    hours: "तास",
    min: "मिनिट",
    sec: "सेकंद",
    box3Title: "मल्टी-मशीन रिट्रीव्हल",
    box3Body: "एकाच वेळी अनेक मॅन्युअल्समध्ये शोधा — निकाल आपोआप योग्य मशीनपुरते मर्यादित राहतात.",
    less: "कमी",
    more: "जास्त",
    noQuery: "प्रश्न नाही",
    answered: (v) => `${v.mins} उत्तरे दिली`,
    box4Title: "रिअल-टाइम ट्रबलशूटिंग फीड",
    box4Body: "सोडवलेले कोड, संदिग्धता ओळख, आणि पाइपलाइनमधील उद्धृत उत्तरांवर त्वरित माहिती मिळवा.",
    box5Title: "मल्टी-सोर्स हायब्रिड सर्च",
    box5Body: "पृष्ठ-स्तरीय उद्धरणांसह सर्व लोड केलेल्या मॅन्युअल्समध्ये व्हेक्टर + अचूक-जुळणी मिळवणी.",
  },

  analytics: {
    codesResolved: "सोडवलेले कोड",
    resolvedToday: "आज सोडवलेले",
    citationRate: "उद्धरण दर",
    refusedNotGuessed: "नकार दिला, अंदाज नाही",
    manuals: "मॅन्युअल्स",
    chunks: "चंक्स",
    avgQuery: "सरासरी प्रश्न",
    accuracy: "अचूकता",
    manualsLoadedCount: "5 लोड केले",
    chunksIndexedCount: "81 इंडेक्स केले",
    avgQuerySeconds: "1.2 सेकंद",
    queriesResolved: "सोडवलेले प्रश्न",
  },

  feed: [
    { name: "E101 सोडवले", description: "वाइंडिंग फॉल्ट — कनेक्टर पुन्हा बसवा, पृष्ठ 214 उद्धृत", time: "2 मि. आधी" },
    {
      name: "क्रॉस-मॅन्युअल जुळणी",
      description: "E101 Press-2000 मॅन्युअलमध्येही सापडले (वेगळे कारण)",
      time: "8 मि. आधी",
    },
    { name: "संदिग्धता सोडवली", description: "उत्तर देण्यापूर्वी मशीन मॉडेल विचारले", time: "15 मि. आधी" },
    { name: "टप्प्याटप्प्याने स्रोत मिळाला", description: "विभाग 4.2, पृष्ठ 92 वरून सुधारात्मक कृती", time: "32 मि. आधी" },
    { name: "अपुरी माहिती", description: "अंदाज नाकारला — लोड केलेल्या मॅन्युअल्समध्ये जुळणी नाही", time: "1 ता. आधी" },
  ],

  showcase: {
    heading: "इंटरॅक्टिव्ह वर्कस्पेस शोकेस",
    subhead: "मशीन ट्रबलशूटिंग डेटा शोधा, मिळवा आणि एक्सप्लोर करा.",
  },

  previewSection: {
    heading: "उद्धरणांसह लाइव्ह मेंटेनन्स विनंत्या",
    subhead: "पाइपलाइनमधील एरर कोड, मिळवलेले स्रोत, आणि उद्धृत उत्तरे दाखवणारे रिअल-टाइम प्रश्न.",
    tableUser: "वापरकर्ता",
    tableActivity: "क्रियाकलाप",
    tableDuration: "कालावधी",
    tableCitations: "उद्धरणे",
    tableTime: "वेळ",
    tableStatus: "स्थिती",
    resolved: "सोडवले",
    cited: "उद्धृत",
    refused: "नकार दिला",
    rows: [
      { activity: "इंजेक्शन मोल्डिंग मशीनवर E101", time: "2 मि. आधी" },
      { activity: "PowerFlex-525 वर b005", time: "12 मि. आधी" },
      { activity: "प्रेस ओव्हरहीट होत आहे", time: "25 मि. आधी" },
      { activity: "Press-2000 वर E204", time: "1 ता. आधी" },
      { activity: "अपुरी माहिती — नकार दिला", time: "3 ता. आधी" },
    ],
  },

  sponsor: {
    badge: "FaultFinder ला प्रायोजित करा",
    heading: "सर्वोत्तम ट्रबलशूटिंग साधन बनवण्यास आम्हाला मदत करा.",
    body: "FaultFinder हॅकाथॉनसाठी बनवले आहे. तुमचा पाठिंबा सर्व्हर चालू ठेवतो आणि नवीन वैशिष्ट्यांना निधी देतो.",
    githubSponsors: "GitHub Sponsors",
    buyMeCoffee: "मला कॉफी द्या",
  },

  cta11: {
    trustedBy: "वेगाने फॉल्ट सोडवणाऱ्या मेंटेनन्स टीम्सचा विश्वास",
    heading: "अंदाज लावणे थांबवा. उपाय शोधा.",
    body: "डाउनटाइमचा प्रत्येक मिनिट पैसे खर्च करतो. योग्य मशीन मॅन्युअलमधून अचूक, उद्धृत ट्रबलशूटिंग टप्पे मिळवा.",
    manualsIndexed: "इंडेक्स केलेली मॅन्युअल्स",
    troubleshootingQueries: "ट्रबलशूटिंग प्रश्न",
    sourcedAnswers: "स्रोतासह उत्तरे",
    getStarted: "मोफत सुरू करा",
    viewDemo: "लाइव्ह डेमो पहा",
  },

  footer: {
    rights: (v) => `© ${v.year} FaultFinder. सर्व हक्क राखीव.`,
    builtBy: "❤️ ने बनवले —",
  },

  chat: {
    faultFinder: "FaultFinder",
    manuals: "मॅन्युअल्स",
    pipeline: "पाइपलाइन",
    setupTroubleshooting: "सेटअप आणि समस्यानिवारण",
    setupBody1p1: "यासाठी पार्सर आवश्यक आहे",
    setupBody1p2: "तसेच",
    setupBody1p3: "आणि",
    setupBody1p4: "मध्ये",
    setupBody2:
      "चुकीचे वागणारे अपलोड हटवून पुन्हा अपलोड करता येते — एम्बेडिंग्ज कॅश केलेली असतात, त्यामुळे दुसऱ्यांदा फक्त काही सेकंद लागतात.",
    nothingIndexed: "अजून काहीही इंडेक्स केलेले नाही. सुरू करण्यासाठी PDF मॅन्युअल अपलोड करा.",
    deleteManual: "मॅन्युअल हटवा",
    uploadPdfManual: "PDF मॅन्युअल अपलोड करा",
    indexingEllipsis: "इंडेक्स होत आहे…",
    ocrScanned: "स्कॅन केलेल्या पृष्ठांसाठी OCR (हळू)",
    pagesLabel: (v) => `${v.pages} पृष्ठे`,
    chunksLabel: (v) => `${v.chunks} चंक्स`,
    codesLabel: (v) => ` · ${v.faults} कोड`,
    pipelineChunks: "चंक्स",
    pipelineFaultCodes: "फॉल्ट कोड",
    pipelineVectorDims: "व्हेक्टर डाइम्स",
    pipelineEmbedder: "एम्बेडर",

    askFaultFinder: "FaultFinder ला विचारा",
    manualWord: "मॅन्युअल",
    manualsWord: "मॅन्युअल्स",
    chunksWord: "चंक्स",

    headline1: "कोणताही गोंधळात टाकणारा एरर कोड",
    headline2: "उपायात बदला.",
    subhead:
      "एरर कोड, एखादे लक्षण, किंवा मशीनचे नाव टाका. प्रत्येक उत्तर अर्थ, संभाव्य कारण, आणि उद्धृत दुरुस्ती टप्प्यांसह येते.",
    uploadCta: "PDF मॅन्युअल अपलोड करा",
    nothingPreloaded: "काहीही आधीपासून लोड केलेले नाही — इंडेक्स मुद्दाम रिकामे सुरू होते.",
    statManuals: "मॅन्युअल्स",
    statChunks: "चंक्स",
    statCodes: "कोड",
    statDims: "डाइम्स",

    suggestions: [
      "इंजेक्शन मोल्डिंग मशीनवर E101",
      "प्रेस का ओव्हरहीट होत आहे?",
      "Press-2000 वर E204",
      "पॉवरफ्लेक्सवर b005",
    ],

    askPlaceholderReady: "उदा., इंजेक्शन मोल्डिंग मशीनवर E101",
    askPlaceholderEmpty: "प्रथम मॅन्युअल अपलोड करा, मग त्याबद्दल काहीही विचारा",
    enterToSend: "पाठवण्यासाठी Enter · नवीन ओळीसाठी Shift+Enter",
    uploadTitle: "PDF मॅन्युअल अपलोड करा",
    voiceInput: "आवाज इनपुट",
    attachImageTitle: "डिस्प्लेचा फोटो जोडा",
    imageCaption: "मशीनच्या डिस्प्लेचा फोटो",
    visionStepReading: "डिस्प्ले वाचला जात आहे…",
    visionStepMatching: "दिसणारा कोड तुमच्या मॅन्युअल्सशी जुळवला जात आहे…",
    visionStepDrafting: "उत्तर तयार केले जात आहे…",
    answersFooter:
      "उत्तरे तुमच्या लोड केलेल्या मॅन्युअल्समधून घेतली जातात आणि पृष्ठानुसार उद्धृत केली जातात. प्रत्यक्ष उपकरणावर कृती करण्यापूर्वी पडताळणी करा.",

    howThisWasAnswered: "हे उत्तर कसे दिले गेले",
    searchingManuals: "मॅन्युअल्स शोधली जात आहेत…",
    working: "काम सुरू आहे…",

    answer: "उत्तर",
    confidenceHigh: "उच्च",
    confidenceMedium: "मध्यम",
    confidenceLow: "कमी",
    confidenceSuffix: " विश्वास",
    stopReading: "वाचणे थांबवा",
    readAloud: "उत्तर मोठ्याने वाचा",
    probableCauses: "संभाव्य कारणे",
    correctiveAction: "सुधारात्मक कृती",
    diagramsFromManual: "मॅन्युअलमधील आकृत्या",
    sources: "स्रोत",
    openPage: (v) => `मॅन्युअलचे पृष्ठ ${v.page} उघडण्यासाठी क्लिक करा`,

    closeEsc: "बंद करा (Esc)",
    renderingPage: (v) => `पृष्ठ ${v.page} रेंडर होत आहे…`,
    couldNotRenderPage: "हे पृष्ठ रेंडर करता आले नाही.",
    passageUsed: "वापरलेला उतारा",

    speechNotSupported: "या ब्राउझरमध्ये वाक् ओळख समर्थित नाही.",
    networkError: "नेटवर्क त्रुटी",
    unknownError: "अज्ञात",
    errorPrefix: (v) => `त्रुटी (${v.status})`,
    deleteFailed: "हटवणे अयशस्वी झाले",
    deleteConfirm: (v) =>
      `"${v.label}" हटवायचे? हे इंडेक्समधून काढून टाकेल; परत जोडण्यासाठी पुन्हा अपलोड करा.`,

    uploading: (v) => `${v.name} अपलोड होत आहे…`,
    parsing: (v) => `${v.name} पार्स होत आहे…`,
    stageEmbedding: "एम्बेडिंग होत आहे",
    stageParsing: "पार्स होत आहे",
    stageChunking: "चंकिंग होत आहे",
    stageIndexing: "इंडेक्स होत आहे",
    connectionInterrupted: (v) => `कनेक्शन खंडित झाले — ${v.name} तपासणी सुरू आहे…`,
    uploadFailedGeneric: (v) => `अपलोड अयशस्वी झाले (${v.status})`,
    scannedWarning: (v) => ` ${v.count} पृष्ठांत काढण्यायोग्य मजकूर कमी/नाही होता (स्कॅन केलेले?).`,
    indexedSummary: (v) => `इंडेक्स झाले ${v.title}: ${v.pages} पृष्ठे, ${v.chunks} चंक्स, ${v.faults} फॉल्ट कोड.`,
    takingLong:
      "हे अपलोड नेहमीपेक्षा जास्त वेळ घेत आहे. मॅन्युअल यादी तपासा — कदाचित पूर्ण झाले असेल; नसल्यास पुन्हा प्रयत्न करा.",
  },
};

export const DICTIONARIES: Record<UiLanguage, Dictionary> = { en, hi, mr };
