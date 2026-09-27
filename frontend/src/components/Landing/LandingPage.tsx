import { useEffect, useState } from 'react';
import { Bot, Check, GitBranch, PhoneCall, ShieldAlert, X, type LucideIcon } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import FadeIn from './FadeIn';
import AnimatedHeading from './AnimatedHeading';
import ragImg from '../../../assets/RAG.jpeg';
import gnnImg from '../../../assets/gnn.jpeg';
import discrepancyImg from '../../../assets/discrepency.jpeg';
import aiAgentImg from '../../../assets/AI-agent.jpeg';

interface LandingPageProps {
  onGetStarted: () => void;
}

type Localized = { en: string; hi: string };

interface HeroFeature {
  id: string;
  navLabel: Localized;
  title: Localized;
  subtitle: Localized;
  desc: Localized;
  highlights: { en: string[]; hi: string[] };
  icon: LucideIcon;
  image: string;
}

const HERO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4';

const HERO_FEATURES: HeroFeature[] = [
  {
    id: 'rag',
    navLabel: { en: 'RAG Engine', hi: 'RAG इंजन' },
    title: { en: 'RAG Knowledge Engine', hi: 'RAG ज्ञान इंजन' },
    subtitle: {
      en: 'Ask policy, scheme, and compliance questions in plain language.',
      hi: 'नीति, योजना और अनुपालन से जुड़े प्रश्न साधारण भाषा में पूछें।',
    },
    desc: {
      en: 'Retrieval-Augmented Generation searches circulars, tenders, and scheme manuals to return grounded answers for officers and citizens.',
      hi: 'Retrieval-Augmented Generation सरकारी परिपत्र, टेंडर रिकॉर्ड और योजना दस्तावेज़ खोजकर अधिकारियों और नागरिकों को तथ्य-आधारित उत्तर देता है।',
    },
    highlights: {
      en: ['Every answer cites its source documents', 'Personal data is removed before any AI model call', 'Cached, rate-limited responses stay fast and stable'],
      hi: ['हर उत्तर के साथ स्रोत दस्तावेज़ों का हवाला', 'AI मॉडल को भेजने से पहले व्यक्तिगत जानकारी हटाई जाती है', 'कैश और रेट-लिमिट से उत्तर तेज़ और स्थिर रहते हैं'],
    },
    icon: Bot,
    image: ragImg,
  },
  {
    id: 'gnn',
    navLabel: { en: 'GNN Forecast', hi: 'GNN पूर्वानुमान' },
    title: { en: 'GNN Impact Forecaster', hi: 'GNN प्रभाव पूर्वानुमान' },
    subtitle: {
      en: 'Model how one failure can ripple across infrastructure.',
      hi: 'एक विफलता पूरे इंफ्रास्ट्रक्चर में कैसे फैलती है, इसका पूर्वानुमान।',
    },
    desc: {
      en: 'Graph Neural Networks map hidden dependencies between pumps, tanks, roads, and power nodes to forecast disruption.',
      hi: 'Graph Neural Networks पंप, टैंक, सड़क और बिजली नोड्स के बीच छिपे संबंधों को मैप करके सेवा बाधा का पहले से अनुमान लगाता है।',
    },
    highlights: {
      en: ['Village infrastructure modelled as a connected graph', 'Simulates cascading failures before they happen', 'Impact scores show what to repair first'],
      hi: ['गांव का इंफ्रास्ट्रक्चर एक जुड़े हुए ग्राफ के रूप में', 'फैलती विफलताओं का पहले से सिमुलेशन', 'प्रभाव स्कोर बताते हैं कि पहले क्या ठीक करें'],
    },
    icon: GitBranch,
    image: gnnImg,
  },
  {
    id: 'discrepancy',
    navLabel: { en: 'Discrepancy', hi: 'डिस्क्रेपेंसी' },
    title: { en: 'Discrepancy Detector', hi: 'डिस्क्रेपेंसी डिटेक्टर' },
    subtitle: {
      en: 'Auto-compare milestones against field and vendor evidence.',
      hi: 'योजना माइलस्टोन की फील्ड और वेंडर साक्ष्य से स्वचालित तुलना।',
    },
    desc: {
      en: 'Detects budget leakage, progress mismatch, and timeline slippage by correlating reports and evidence.',
      hi: 'रिपोर्ट, इनवॉइस, जियोटैग और दस्तावेज़ साक्ष्य को जोड़कर बजट लीकेज, प्रगति असंगति और समय-सीमा देरी पकड़ता है।',
    },
    highlights: {
      en: ['Checks planned milestones against submitted progress', 'Flags timeline drift and budget variance', 'Catches evidence that does not match the reports'],
      hi: ['नियोजित माइलस्टोन की प्रस्तुत प्रगति से जांच', 'समय-सीमा में देरी और बजट अंतर को चिह्नित करता है', 'रिपोर्ट से मेल न खाने वाले साक्ष्य पकड़ता है'],
    },
    icon: ShieldAlert,
    image: discrepancyImg,
  },
  {
    id: 'kavya',
    navLabel: { en: 'Kavya AI', hi: 'काव्या AI' },
    title: { en: 'AI Calling Agent - Kavya', hi: 'एआई कॉलिंग एजेंट - काव्या' },
    subtitle: {
      en: 'Call-based complaint registration for low-connectivity regions.',
      hi: 'कम इंटरनेट वाले क्षेत्रों के लिए कॉल-आधारित शिकायत पंजीकरण।',
    },
    desc: {
      en: 'Kavya receives calls on behalf of RuraLens, captures complaint details, and registers cases directly into the system for rural areas with poor internet access.',
      hi: 'काव्या नागरिकों की ओर से कॉल लेती है, शिकायत विवरण दर्ज करती है और उसे RuraLens सिस्टम में सीधे रजिस्टर करती है ताकि ग्रामीण इलाकों में भी सेवा पहुंच सुनिश्चित रहे।',
    },
    highlights: {
      en: ['Citizens report issues with an ordinary phone call', 'Works where internet access is poor', 'Each call becomes a structured complaint record'],
      hi: ['नागरिक सामान्य फोन कॉल से शिकायत दर्ज करते हैं', 'कमजोर इंटरनेट वाले क्षेत्रों में भी काम करता है', 'हर कॉल एक संरचित शिकायत रिकॉर्ड बनती है'],
    },
    icon: PhoneCall,
    image: aiAgentImg,
  },
];

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { t, lang, toggleLang } = useLanguage();
  const hi = lang === 'hi';
  const tx = (en: string, hiText: string) => (hi ? hiText : en);

  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);
  const activeFeature = HERO_FEATURES.find((feature) => feature.id === activeFeatureId) ?? null;

  useEffect(() => {
    if (!activeFeatureId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveFeatureId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeFeatureId]);

  return (
    <section className="hero-section relative flex h-screen flex-col overflow-hidden bg-black font-sans text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={HERO_VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="relative z-30 px-6 pt-6 md:px-12 lg:px-16">
        <nav className="liquid-glass flex items-center justify-between rounded-xl px-4 py-2">
          <button onClick={() => setActiveFeatureId(null)} className="flex items-center gap-2">
            <img src="/ruralens-logo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-2xl font-semibold tracking-tight">{t('appBrand', 'RuraLens')}</span>
          </button>

          <div className="hidden items-center gap-8 text-sm lg:flex">
            {HERO_FEATURES.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeatureId((current) => (current === feature.id ? null : feature.id))}
                aria-expanded={activeFeatureId === feature.id}
                className={`transition-colors hover:text-gray-300 ${activeFeatureId === feature.id ? 'text-gray-300 underline underline-offset-8' : ''}`}
              >
                {feature.navLabel[lang]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleLang}
              aria-label={tx('Switch to Hindi', 'Switch to English')}
              className="liquid-glass rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
            >
              {hi ? 'EN' : 'हि'}
            </button>
            <button
              onClick={onGetStarted}
              className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100"
            >
              {t('enterPlatform', 'Enter Platform')}
            </button>
          </div>
        </nav>
      </div>

      <div
        className={`relative z-10 flex flex-1 flex-col justify-end px-6 pb-12 transition-opacity duration-300 md:px-12 lg:px-16 lg:pb-16 ${
          activeFeature ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        aria-hidden={activeFeature ? true : undefined}
      >
        <div className="lg:grid lg:grid-cols-2 lg:items-end">
          <div>
            <AnimatedHeading
              key={lang}
              text={tx('Empowering villages\nwith AI and transparency.', 'गांवों को सशक्त बनाएं\nAI और पारदर्शिता से।')}
              className="mb-4 text-4xl font-normal md:text-5xl lg:whitespace-nowrap lg:text-6xl xl:text-7xl"
              style={{ letterSpacing: hi ? 'normal' : '-0.04em' }}
              initialDelay={200}
              charDelay={hi ? 120 : 30}
              duration={500}
              splitBy={hi ? 'word' : 'char'}
            />

            <FadeIn delay={800} duration={1000}>
              <p className="mb-5 max-w-xl text-base text-gray-300 md:text-lg">
                {tx(
                  'A digital twin for rural India. Monitor infrastructure, track scheme delivery, and resolve citizen issues in real time.',
                  'ग्रामीण भारत के लिए डिजिटल ट्विन। इंफ्रास्ट्रक्चर की निगरानी करें, योजनाओं की प्रगति पर नज़र रखें और नागरिक शिकायतों का तुरंत समाधान करें।'
                )}
              </p>
            </FadeIn>

            <FadeIn delay={1200} duration={1000}>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={onGetStarted}
                  className="rounded-lg bg-white px-8 py-3 font-medium text-black"
                >
                  {t('enterPlatform', 'Enter Platform')}
                </button>
                <button
                  onClick={onGetStarted}
                  className="liquid-glass rounded-lg border border-white/20 px-8 py-3 font-medium text-white transition-colors hover:bg-white hover:text-black"
                >
                  {tx('Report an Issue', 'शिकायत दर्ज करें')}
                </button>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={1400} duration={1000} className="mt-8 flex items-end justify-start lg:mt-0 lg:justify-end">
            <div className="liquid-glass rounded-xl border border-white/20 px-6 py-3">
              <p className="text-lg font-light md:text-xl lg:text-2xl">
                {tx('Monitor. Predict. Resolve.', 'निगरानी। पूर्वानुमान। समाधान।')}
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      {activeFeature && (
        <div className="absolute inset-x-0 bottom-0 top-24 z-20 flex items-center justify-center px-6 pb-8 md:px-12 lg:px-16">
          <button
            aria-label={tx('Close feature details', 'विवरण बंद करें')}
            className="absolute inset-0 cursor-default"
            onClick={() => setActiveFeatureId(null)}
          />

          <FadeIn key={activeFeature.id} delay={0} duration={300} className="relative w-full max-w-3xl">
            <div
              role="dialog"
              aria-labelledby="hero-feature-title"
              className="liquid-glass max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-white/20 backdrop-blur-xl md:grid md:grid-cols-[2fr_3fr]"
              style={{ background: 'rgba(0, 0, 0, 0.55)' }}
            >
              <img
                src={activeFeature.image}
                alt=""
                className="h-44 w-full object-cover md:h-full"
              />

              <div className="p-6 md:p-8">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20">
                    <activeFeature.icon size={20} />
                  </div>
                  <button
                    onClick={() => setActiveFeatureId(null)}
                    aria-label={tx('Close', 'बंद करें')}
                    className="rounded-lg p-1.5 transition-colors hover:text-gray-300"
                  >
                    <X size={20} />
                  </button>
                </div>

                <h2 id="hero-feature-title" className="mb-2 text-2xl font-medium md:text-3xl" style={{ letterSpacing: hi ? 'normal' : '-0.02em' }}>
                  {activeFeature.title[lang]}
                </h2>
                <p className="mb-4 text-base text-gray-300">{activeFeature.subtitle[lang]}</p>
                <p className="mb-5 text-sm leading-relaxed text-gray-300">{activeFeature.desc[lang]}</p>

                <ul className="mb-6 space-y-2">
                  {activeFeature.highlights[lang].map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="mt-0.5 shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={onGetStarted}
                  className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-100"
                >
                  {tx('Try it in the platform', 'प्लेटफॉर्म में आज़माएं')}
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      )}
    </section>
  );
}
