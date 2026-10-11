import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Lang = 'en' | 'hi';

type Dictionary = Record<string, { en: string; hi: string }>;

const dictionary: Dictionary = {
  appBrand: { en: 'RuraLens', hi: 'RuraLens' },
  appTagline: { en: 'AI Governance Twin', hi: 'एआई गवर्नेंस ट्विन' },
  searchPlaceholder: { en: 'Search schemes, reports, or sensors...', hi: 'योजनाएं, रिपोर्ट या सेंसर खोजें...' },
  signOut: { en: 'Sign Out', hi: 'साइन आउट' },
  profile: { en: 'Profile', hi: 'प्रोफाइल' },
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड' },
  mapView: { en: '3D Map View', hi: '3D मैप व्यू' },
  govSchemes: { en: 'Government Schemes', hi: 'सरकारी योजनाएं' },
  citizenReports: { en: 'Citizen Reports', hi: 'नागरिक रिपोर्ट' },
  settings: { en: 'Settings', hi: 'सेटिंग्स' },
  choosePortal: { en: 'Choose your portal', hi: 'अपना पोर्टल चुनें' },
  back: { en: 'Back', hi: 'वापस' },
  enterPortal: { en: 'Enter Portal', hi: 'पोर्टल खोलें' },
  quickDemo: { en: 'Quick Demo Access', hi: 'त्वरित डेमो एक्सेस' },
  launchDashboard: { en: 'Launch Dashboard', hi: 'डैशबोर्ड शुरू करें' },
  enterPlatform: { en: 'Enter Platform', hi: 'प्लेटफॉर्म खोलें' },
  capabilities: { en: 'Capabilities', hi: 'क्षमताएं' },
  sdgs: { en: 'SDGs', hi: 'एसडीजी' },
  impact: { en: 'Impact', hi: 'प्रभाव' },
  schemesDashboard: { en: 'Government Schemes Dashboard', hi: 'सरकारी योजनाएं डैशबोर्ड' },
  schemesSubtitle: { en: 'Real-time monitoring of development projects', hi: 'विकास परियोजनाओं की रियल-टाइम मॉनिटरिंग' },
  askAi: { en: 'Ask AI', hi: 'एआई से पूछें' },
  addScheme: { en: 'Add New Scheme', hi: 'नई योजना जोड़ें' },
  totalSchemes: { en: 'Total Schemes', hi: 'कुल योजनाएं' },
  onTrackDelayed: { en: 'On Track / Delayed', hi: 'समय पर / विलंबित' },
  budgetUtilization: { en: 'Budget Utilization', hi: 'बजट उपयोग' },
  avgProgress: { en: 'Avg Progress', hi: 'औसत प्रगति' },
  activeProjects: { en: 'Active projects', hi: 'सक्रिय परियोजनाएं' },
  noReviewsYet: { en: 'No reviews yet', hi: 'अभी कोई समीक्षा नहीं' }
};

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Only written when the user picks a language, so English stays the default for everyone else. */
const LANG_KEY = 'ruralens_lang';

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const setLang = (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // Storage unavailable (private mode); the choice lasts for this session only.
      }
    };
    return {
      lang,
      setLang,
      toggleLang: () => setLang(lang === 'en' ? 'hi' : 'en'),
      t: (key: string, fallback = key) => dictionary[key]?.[lang] || fallback
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
