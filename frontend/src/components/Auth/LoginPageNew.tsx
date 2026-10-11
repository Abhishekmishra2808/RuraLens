import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Briefcase, ChevronRight, Lock, Mail, AlertCircle, Loader, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { API_URL } from '../../config/api';
import { useLanguage } from '../../i18n/LanguageContext';

const roles = [
  { 
    id: 'admin' as const, 
    name: { en: 'Administrator', hi: 'प्रशासक' }, 
    icon: Shield, 
    description: { en: 'Manage schemes and governance workflows', hi: 'योजनाओं और प्रशासनिक वर्कफ्लो का प्रबंधन' },
    color: 'from-purple-500 to-indigo-600',
    accent: 'text-purple-400',
    border: 'group-hover:border-purple-500/50',
    bg: 'group-hover:bg-purple-500/10',
    shadow: 'group-hover:shadow-purple-500/20'
  },
  { 
    id: 'field_worker' as const, 
    name: { en: 'Field Worker', hi: 'फील्ड वर्कर' }, 
    icon: Briefcase, 
    description: { en: 'Update field data and reports', hi: 'फील्ड डेटा और रिपोर्ट अपडेट करें' },
    color: 'from-orange-500 to-amber-600',
    accent: 'text-orange-400',
    border: 'group-hover:border-orange-500/50',
    bg: 'group-hover:bg-orange-500/10',
    shadow: 'group-hover:shadow-orange-500/20'
  },
  { 
    id: 'user' as const, 
    name: { en: 'Citizen', hi: 'नागरिक' }, 
    icon: User, 
    description: { en: 'View schemes and feedback', hi: 'योजनाएं और फीडबैक देखें' },
    color: 'from-emerald-500 to-teal-600',
    accent: 'text-emerald-400',
    border: 'group-hover:border-emerald-500/50',
    bg: 'group-hover:bg-emerald-500/10',
    shadow: 'group-hover:shadow-emerald-500/20'
  },
];

interface LoginPageProps {
  onBack?: () => void;
}

export default function LoginPage({ onBack }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'field_worker' | null>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const login = useAppStore((state) => state.login);
  const { t, lang, toggleLang } = useLanguage();
  const hi = lang === 'hi';
  const tx = (en: string, hiText: string) => (hi ? hiText : en);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister 
        ? { email, password, name, role: selectedRole }
        : { email, password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // Check if response has content before parsing JSON
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Update store - login(role, username)
      login(data.user.role, data.user.name);

    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Quick login for demo
  const quickLogin = async (demoEmail: string, demoPassword: string, demoRole: 'admin' | 'field_worker' | 'user') => {
    setSelectedRole(demoRole);
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsRegister(false);
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword })
      });

      // Check if response has content before parsing JSON
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      // Update store - login(role, username)
      login(data.user.role, data.user.name);

    } catch (err: any) {
      setError(err.message || 'Demo login failed. Server may not be running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f5f7ef] relative overflow-hidden font-sans selection:bg-emerald-500/20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#fefdf8] via-[#f4f7ef] to-[#eaf2e4] pointer-events-none" />
      <div className="absolute top-[-20%] left-[10%] w-[60vw] h-[60vw] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[10%] w-[40vw] h-[40vw] bg-lime-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

      <div className="w-full max-w-6xl relative z-10 px-6 flex flex-col h-full justify-center">
        {/* Back Button - Absolute positioned */}
        {onBack && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="absolute top-8 left-6 flex items-center gap-2 text-[#5d7466] hover:text-[#214f3d] transition-colors p-2 rounded-lg hover:bg-[#e5efe0] group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">{t('back', 'Back')}</span>
          </motion.button>
        )}

        <button
          onClick={toggleLang}
          className="absolute top-8 right-6 rounded-md border border-[#9cb7a6] px-3 py-1.5 text-xs font-bold text-[#2a5f46]"
        >
          {hi ? 'EN' : 'हि'}
        </button>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 flex flex-col items-center shrink-0"
        >
          <div className="relative mb-4 group">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full group-hover:bg-emerald-500/30 transition-all duration-500"></div>
            <img 
              src="/ruralens-logo.png" 
              alt="RuraLens Logo" 
              className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(46,124,87,0.35)] transition-transform duration-500 group-hover:scale-110" 
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#13372a] via-[#24533f] to-[#5f7e68]">
            {t('appBrand', 'RuraLens')}
          </h1>
          <p className="text-base text-[#5d7466] font-light max-w-xl mx-auto tracking-wide">
            {tx('Empowering communities with ', 'समुदायों को ')}<span className="text-[#2c6650] font-medium">AI</span> {tx('and', 'और')} <span className="text-[#3f8b60] font-medium">{tx('Transparency', 'पारदर्शिता')}</span> {tx('for better governance.', 'से सशक्त बनाना')}
          </p>
        </motion.div>

        {/* Role Selection */}
        {!selectedRole ? (
          <div className="max-w-5xl mx-auto w-full flex flex-col gap-8">
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-4 mb-2"
            >
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-[#a7bcae]"></div>
              <span className="text-xs uppercase tracking-[0.2em] text-[#698171] font-medium">{t('choosePortal', 'Choose your portal')}</span>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-[#a7bcae]"></div>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5">
              {roles.map((role, index) => {
                const RoleIcon = role.icon;
                return (
                  <motion.button
                    key={role.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    onClick={() => setSelectedRole(role.id)}
                    className={`group relative p-6 rounded-2xl transition-all duration-300 text-left bg-[#fbfdf8] border border-[#d7e2d4] hover:border-transparent ${role.border} ${role.bg} hover:-translate-y-1 hover:shadow-2xl ${role.shadow} flex flex-col items-center text-center overflow-hidden`}
                  >
                    {/* Hover Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                    
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#e8f1e4] border border-[#cfddcc] group-hover:scale-110 transition-transform duration-300 ${role.accent}`}>
                      <RoleIcon size={28} strokeWidth={1.5} />
                    </div>
                    
                    <h3 className="font-bold text-lg mb-2 text-[#1f2d26] transition-colors">{role.name[lang]}</h3>
                    <p className="text-sm text-[#677e6f] leading-relaxed mb-4">
                      {role.description[lang]}
                    </p>

                    <div className={`mt-auto flex items-center text-xs font-bold uppercase tracking-wider ${role.accent} opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300`}>
                      {t('enterPortal', 'Enter Portal')} <ChevronRight size={14} className="ml-1" />
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Quick Demo Login - Enhanced */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-[#f8fbf4]/95 border border-[#d7e2d4] rounded-2xl p-5 text-center backdrop-blur-sm max-w-3xl mx-auto w-full"
            >
              <p className="text-xs text-[#6a826f] mb-4 font-medium uppercase tracking-wider">{t('quickDemo', 'Quick Demo Access')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => quickLogin('admin@ruralens.com', 'admin123', 'admin')}
                  disabled={loading}
                  className="group relative overflow-hidden bg-transparent border border-purple-300 text-purple-700 py-2.5 px-4 rounded-xl hover:bg-purple-100/70 transition-all disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Shield size={14} className="text-purple-400" />
                  <span>{tx('Admin Demo', 'एडमिन डेमो')}</span>
                </button>
                <button
                  onClick={() => quickLogin('field@ruralens.com', 'field123', 'field_worker')}
                  disabled={loading}
                  className="group relative overflow-hidden bg-transparent border border-orange-300 text-orange-700 py-2.5 px-4 rounded-xl hover:bg-orange-100/70 transition-all disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Briefcase size={14} className="text-orange-400" />
                  <span>{tx('Field Demo', 'फील्ड डेमो')}</span>
                </button>
                <button
                  onClick={() => quickLogin('citizen@ruralens.com', 'user123', 'user')}
                  disabled={loading}
                  className="group relative overflow-hidden bg-emerald-100/70 border border-emerald-300 text-emerald-800 py-2.5 px-4 rounded-xl hover:bg-emerald-200/70 transition-all disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(78,150,111,0.15)]"
                >
                  <User size={14} className="text-emerald-400" />
                  <span>{tx('Citizen Demo', 'नागरिक डेमो')}</span>
                </button>
              </div>
              
              {(error || loading) && (
                <div className="mt-3 flex items-center justify-center">
                  {error && (
                    <div className="flex items-center space-x-2 text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                      <AlertCircle size={12} />
                      <span className="text-xs">{error}</span>
                    </div>
                  )}
                  {loading && (
                    <div className="flex items-center space-x-2 text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                      <Loader size={12} className="animate-spin" />
                      <span className="text-xs">{tx('Authenticating...', 'प्रमाणीकरण हो रहा है...')}</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        ) : (
          /* Login/Register Form - Compact */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-sm mx-auto w-full"
          >
            <button
              onClick={() => { setSelectedRole(null); setError(''); }}
              className="text-[#667d6e] hover:text-[#214f3d] mb-6 flex items-center gap-2 transition-colors text-xs group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              {tx('Back to Roles', 'भूमिकाओं पर वापस')}
            </button>

            <div className="bg-[#fbfdf8]/95 border border-[#d8e3d4] backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              {/* Form Background Gradient */}
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${roles.find(r => r.id === selectedRole)?.color || 'from-blue-500 to-cyan-500'}`} />
              
              <div className="text-center mb-6">
                <div className={`w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-3 bg-[#e8f2e5] border border-[#d1dfcd] ${roles.find(r => r.id === selectedRole)?.accent}`}>
                  {(() => {
                    const RoleIcon = roles.find(r => r.id === selectedRole)?.icon || User;
                    return <RoleIcon size={24} />;
                  })()}
                </div>
                <h2 className="text-xl font-bold text-[#1f2f27] mb-1">
                  {isRegister ? tx('Create Account', 'खाता बनाएं') : tx('Welcome Back', 'फिर से स्वागत है')}
                </h2>
                <p className="text-xs text-[#6c8474]">
                  {tx('Login as', 'लॉगिन करें:')} <span className={`font-medium ${roles.find(r => r.id === selectedRole)?.accent}`}>{roles.find(r => r.id === selectedRole)?.name[lang]}</span>
                </p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-2 text-red-400"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-xs">{error}</span>
                </motion.div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <div className="relative group">
                      <User size={16} className="absolute left-3 top-3 text-[#7b8f82] group-focus-within:text-[#2e6e52] transition-colors" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#fdfefb] border border-[#d3dfcf] text-[#1f2c24] text-sm placeholder-[#90a094] focus:outline-none focus:ring-2 focus:ring-emerald-300/70 focus:border-transparent transition-all"
                        placeholder={tx('Full Name', 'पूरा नाम')}
                        required={isRegister}
                      />
                    </div>
                  </motion.div>
                )}

                <div className="relative group">
                  <Mail size={16} className="absolute left-3 top-3 text-[#7b8f82] group-focus-within:text-[#2e6e52] transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#fdfefb] border border-[#d3dfcf] text-[#1f2c24] text-sm placeholder-[#90a094] focus:outline-none focus:ring-2 focus:ring-emerald-300/70 focus:border-transparent transition-all"
                    placeholder={tx('Email Address', 'ईमेल पता')}
                    required
                  />
                </div>

                <div className="relative group">
                  <Lock size={16} className="absolute left-3 top-3 text-[#7b8f82] group-focus-within:text-[#2e6e52] transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#fdfefb] border border-[#d3dfcf] text-[#1f2c24] text-sm placeholder-[#90a094] focus:outline-none focus:ring-2 focus:ring-emerald-300/70 focus:border-transparent transition-all"
                    placeholder={tx('Password', 'पासवर्ड')}
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2.5 rounded-lg font-bold text-white shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm bg-gradient-to-r ${roles.find(r => r.id === selectedRole)?.color || 'from-blue-600 to-blue-500'} hover:shadow-blue-500/25 hover:scale-[1.02]`}
                >
                  {loading ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      <span>{tx('Processing...', 'प्रोसेस हो रहा है...')}</span>
                    </>
                  ) : (
                    <span>{isRegister ? tx('Create Account', 'खाता बनाएं') : tx('Sign In', 'साइन इन')}</span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setIsRegister(!isRegister); setError(''); }}
                  className="text-xs text-[#6d8575] hover:text-[#214f3d] transition-colors"
                >
                  {isRegister ? tx('Already have an account? Sign in', 'पहले से खाता है? साइन इन करें') : tx('Need an account? Register', 'खाता चाहिए? रजिस्टर करें')}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer - Compact */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.8 }}
              className="text-center mt-8 shrink-0"
        >
          <p className="text-[10px] text-[#748a79] uppercase tracking-widest">
            {tx('Powered by', 'संचालित:')} MongoDB · Runanywhere · WebSocket
          </p>
        </motion.div>
      </div>
    </div>
  );
}
