import { useLanguage } from '../../i18n/LanguageContext';
import FadeIn from './FadeIn';
import AnimatedHeading from './AnimatedHeading';

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenDocs: (sectionId: string) => void;
}

const HERO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4';

const NAV_LINKS = [
  { sectionId: 'rag', label: { en: 'RAG Engine', hi: 'RAG इंजन' } },
  { sectionId: 'gnn', label: { en: 'GNN Forecast', hi: 'GNN पूर्वानुमान' } },
  { sectionId: 'discrepancy', label: { en: 'Discrepancy', hi: 'डिस्क्रेपेंसी' } },
  { sectionId: 'kavya', label: { en: 'Kavya AI', hi: 'काव्या AI' } },
  { sectionId: 'overview', label: { en: 'Docs', hi: 'दस्तावेज़' } },
];

export default function LandingPage({ onGetStarted, onOpenDocs }: LandingPageProps) {
  const { t, lang, toggleLang } = useLanguage();
  const hi = lang === 'hi';
  const tx = (en: string, hiText: string) => (hi ? hiText : en);

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
          <div className="flex items-center gap-2">
            <img src="/ruralens-logo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-2xl font-semibold tracking-tight">{t('appBrand', 'RuraLens')}</span>
          </div>

          <div className="hidden items-center gap-8 text-sm lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.sectionId}
                href={`#/docs/${link.sectionId}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenDocs(link.sectionId);
                }}
                className="transition-colors hover:text-gray-300"
              >
                {link.label[lang]}
              </a>
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

      <div className="relative z-10 flex flex-1 flex-col justify-end px-6 pb-12 md:px-12 lg:px-16 lg:pb-16">
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
    </section>
  );
}
