import { useAppStore } from '../../store/appStore';
import { Activity, ArrowRight, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export default function MobileDashboard() {
  const { kpis, setActiveView, userRole } = useAppStore();
  const { lang } = useLanguage();
  const hi = lang === 'hi';
  const tx = (en: string, hiText: string) => (hi ? hiText : en);

  console.log('MobileDashboard rendering - kpis:', kpis, 'userRole:', userRole);

  // Ensure we have data to display
  if (!kpis) {
    console.error('KPIs not loaded!');
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-white text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Quick stats for mobile - with defensive coding for undefined values
  const stats = [
    { 
      label: 'Open Reports', 
      labelHi: 'खुली रिपोर्ट',
      value: (kpis?.pendingReports ?? 0).toString(), 
      icon: ShieldAlert, 
      color: 'text-orange-400', 
      bg: 'bg-orange-500/10',
      view: 'anonymous-reports'
    },
    { 
      label: 'Sensors', 
      labelHi: 'सेंसर',
      value: (kpis?.activeSensors ?? 0).toString(), 
      icon: Activity, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10',
      view: 'map'
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{tx('Overview', 'सारांश')}</h1>
          <p className="text-sm text-slate-400">{tx('Infrastructure Status Monitor', 'इंफ्रास्ट्रक्चर स्थिति मॉनिटर')}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
          <img src="/ruralens-logo.png" alt="Logo" className="h-6 w-6" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, idx) => (
          <button
            key={idx}
            onClick={() => setActiveView(stat.view)}
            className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 flex flex-col gap-3 active:scale-[0.98] transition-transform text-left"
          >
            <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon size={20} className={stat.color} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-400">{hi ? (stat as any).labelHi : stat.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">{tx('Quick Actions', 'त्वरित कार्रवाइयां')}</h2>
        <div className="space-y-2">
          <ActionRow 
            label={tx('Report an Issue', 'मुद्दा रिपोर्ट करें')} 
            desc={tx('Roads, Water, Waste...', 'सड़क, पानी, कचरा...')} 
            onClick={() => setActiveView('reports')} 
          />
          <ActionRow 
            label={tx('View Government Schemes', 'सरकारी योजनाएं देखें')} 
            desc={tx('Track progress and funds', 'प्रगति और फंड ट्रैक करें')} 
            onClick={() => setActiveView('schemes')} 
          />
          {userRole === 'admin' && (
            <ActionRow 
              label={tx('Admin Controls', 'एडमिन नियंत्रण')} 
              desc={tx('Manage settings', 'सेटिंग्स प्रबंधित करें')} 
              onClick={() => setActiveView('settings')} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ label, desc, onClick }: { label: string, desc: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full p-4 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between active:bg-slate-800 transition-colors"
    >
      <div className="text-left">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <ArrowRight size={16} className="text-slate-500" />
    </button>
  );
}
