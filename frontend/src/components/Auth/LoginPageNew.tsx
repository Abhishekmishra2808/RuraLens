import { useState, type FormEvent } from 'react';
import { AlertCircle, Briefcase, Loader2, Shield, User, type LucideIcon } from 'lucide-react';
import Login03, { ENTER, stagger } from '@/components/ui/login-03';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { API_URL } from '@/config/api';
import { useLanguage } from '@/i18n/LanguageContext';
import { ServerWakeNotice, useSlowRequest } from './ServerWakeNotice';

type Role = 'admin' | 'field_worker' | 'user';
type Bilingual = { en: string; hi: string };

const ROLES: Array<{ id: Role; label: Bilingual; icon: LucideIcon; demo: { email: string; password: string } }> = [
  {
    id: 'admin',
    label: { en: 'Admin', hi: 'प्रशासक' },
    icon: Shield,
    demo: { email: 'admin@ruralens.com', password: 'admin123' },
  },
  {
    id: 'field_worker',
    label: { en: 'Field worker', hi: 'फील्ड वर्कर' },
    icon: Briefcase,
    demo: { email: 'field@ruralens.com', password: 'field123' },
  },
  {
    id: 'user',
    label: { en: 'Citizen', hi: 'नागरिक' },
    icon: User,
    demo: { email: 'citizen@ruralens.com', password: 'user123' },
  },
];

const roleMeta = (id: Role) => ROLES.find((r) => r.id === id) ?? ROLES[2];

interface LoginPageProps {
  onBack?: () => void;
}

export default function LoginPage({ onBack }: LoginPageProps) {
  const [role, setRole] = useState<Role>('user');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const slowRequest = useSlowRequest();

  const login = useAppStore((s) => s.login);
  const { t, lang, toggleLang } = useLanguage();
  const hi = lang === 'hi';
  const tx = (en: string, hiText: string) => (hi ? hiText : en);
  const roleLabel = roleMeta(role).label[lang];

  const authenticate = async (endpoint: '/api/auth/login' | '/api/auth/register', body: Record<string, string>) => {
    setError('');
    setLoading(true);
    slowRequest.start();
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || tx('Authentication failed', 'प्रमाणीकरण विफल'));

      const accountRole = data.user?.role as Role | undefined;
      if (accountRole && accountRole !== role) {
        throw new Error(
          tx(
            `This account is registered as ${roleMeta(accountRole).label.en}. Select that role to sign in.`,
            `यह खाता ${roleMeta(accountRole).label.hi} के रूप में पंजीकृत है। साइन इन के लिए वह भूमिका चुनें।`,
          ),
        );
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      login(data.user.role, data.user.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        err instanceof TypeError
          ? tx('Cannot reach the server. Is the backend running?', 'सर्वर से कनेक्ट नहीं हो सका। क्या बैकएंड चल रहा है?')
          : message || tx('Something went wrong', 'कुछ गलत हो गया'),
      );
    } finally {
      slowRequest.stop();
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isRegister) void authenticate('/api/auth/register', { name, email, password, role });
    else void authenticate('/api/auth/login', { email, password });
  };

  const signInWithDemo = () => {
    const { demo } = roleMeta(role);
    setEmail(demo.email);
    setPassword(demo.password);
    void authenticate('/api/auth/login', demo);
  };

  const switchMode = () => {
    setIsRegister((v) => !v);
    setError('');
  };

  const brand = (
    <div className="flex items-center gap-2">
      <img src="/ruralens-logo.png" alt="" className="size-7 object-contain" />
      <span className="text-base font-semibold tracking-[-0.025em]">{t('appBrand', 'RuraLens')}</span>
    </div>
  );

  const aside = (
    <>
      <blockquote className="font-serif text-3xl leading-[1.15] tracking-tight md:text-4xl">
        {tx('Monitor. Predict.', 'निगरानी। पूर्वानुमान।')}{' '}
        <span className="italic text-foreground">{tx('Resolve.', 'समाधान।')}</span>
      </blockquote>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        {tx(
          'A live digital twin of village infrastructure: water, power, health and schools. Forecast failures, track scheme delivery and close citizen reports in one place.',
          'गाँव के इंफ्रास्ट्रक्चर का लाइव डिजिटल ट्विन: पानी, बिजली, स्वास्थ्य और स्कूल। विफलताओं का पूर्वानुमान, योजनाओं की प्रगति और नागरिक शिकायतें, सब एक जगह।',
        )}
      </p>
      <figcaption className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{tx('Digital twin', 'डिजिटल ट्विन')}</span>
        <span aria-hidden className="text-border">|</span>
        <span>{tx('GNN forecasts', 'GNN पूर्वानुमान')}</span>
        <span aria-hidden className="text-border">|</span>
        <span>{tx('Citizen reports', 'नागरिक शिकायतें')}</span>
      </figcaption>
    </>
  );

  return (
    <Login03
      brand={brand}
      aside={aside}
      onBack={onBack}
      backLabel={t('back', 'Back')}
      topRight={
        <Button variant="ghost" size="sm" onClick={toggleLang} aria-label={tx('Switch to Hindi', 'Switch to English')}>
          {hi ? 'EN' : 'हि'}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <h1 style={stagger(1)} className={cn(ENTER, 'font-serif text-4xl font-normal tracking-tight sm:text-5xl')}>
          {isRegister ? tx('Create account.', 'खाता बनाएं।') : tx('Welcome back.', 'फिर से स्वागत है।')}
        </h1>
        <p style={stagger(2)} className={cn(ENTER, 'text-sm text-muted-foreground')}>
          {isRegister
            ? tx(`Join RuraLens as ${roleLabel.toLowerCase()}.`, `${roleLabel} के रूप में जुड़ें।`)
            : tx('Choose your role and sign in.', 'अपनी भूमिका चुनें और साइन इन करें।')}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={tx('Role', 'भूमिका')}
        style={stagger(3)}
        className={cn(ENTER, 'grid grid-cols-3 gap-2')}
      >
        {ROLES.map(({ id, label, icon: Icon }) => {
          const active = role === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setRole(id);
                setError('');
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active
                  ? 'border-primary bg-background text-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              {label[lang]}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit} style={stagger(4)} className={cn(ENTER, 'space-y-3')}>
        {isRegister && (
          <div className="space-y-1.5">
            <label htmlFor="login-name" className="text-sm font-medium">
              {tx('Full name', 'पूरा नाम')}
            </label>
            <Input id="login-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-sm font-medium">
            {tx('Email', 'ईमेल')}
          </label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="login-password" className="text-sm font-medium">
            {isRegister ? tx('Create password', 'पासवर्ड बनाएं') : tx('Password', 'पासवर्ड')}
          </label>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder={isRegister ? tx('At least 6 characters', 'कम से कम 6 अक्षर') : undefined}
            minLength={6}
            required
          />
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={loading} className="w-full gap-2">
          {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {isRegister ? tx('Create account', 'खाता बनाएं') : tx('Sign in', 'साइन इन')}
        </Button>
        {loading && slowRequest.slow ? (
          <ServerWakeNotice />
        ) : (
          <span role="status" className="sr-only">
            {loading ? tx('Signing in', 'साइन इन हो रहा है') : ''}
          </span>
        )}
      </form>

      <div style={stagger(5)} className={cn(ENTER, 'space-y-4')}>
        <p className="text-sm text-muted-foreground">
          {isRegister ? tx('Already registered?', 'पहले से खाता है?') : tx('New to RuraLens?', 'RuraLens पर नए हैं?')}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isRegister ? tx('Sign in', 'साइन इन करें') : tx('Create an account', 'खाता बनाएं')}
          </button>
        </p>

        {!isRegister && (
          <>
            <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {tx('or', 'या')}
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" onClick={signInWithDemo} disabled={loading} className="w-full">
              {tx(`Try the demo ${roleLabel.toLowerCase()} account`, `डेमो ${roleLabel} खाता आज़माएं`)}
            </Button>
          </>
        )}
      </div>
    </Login03>
  );
}
