import { Home, Settings, ChevronLeft, ChevronRight, Map, Briefcase, Shield, CloudSun, Phone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { SPRING, SPRING_SNAPPY } from '@/lib/motion';

const menuItems = [
  { id: 'dashboard', icon: Home, labelKey: 'dashboard', label: 'Dashboard' },
  { id: 'map', icon: Map, labelKey: 'mapView', label: '3D Map' },
  { id: 'schemes', icon: Briefcase, labelKey: 'govSchemes', label: 'Schemes' },
  { id: 'aqi-weather', icon: CloudSun, labelKey: 'aqiWeather', label: 'AQI & Weather' },
  { id: 'anonymous-reports', icon: Shield, labelKey: 'citizenReports', label: 'Citizen Reports' },
  { id: 'call-records', icon: Phone, labelKey: 'citizenCallRecords', label: 'Call Records' },
  { id: 'settings', icon: Settings, labelKey: 'settings', label: 'Settings' },
];

const ROLE_ITEMS: Record<string, string[]> = {
  field_worker: ['dashboard', 'map', 'aqi-weather', 'anonymous-reports', 'settings'],
  user: ['dashboard', 'map', 'schemes', 'aqi-weather', 'anonymous-reports', 'settings'],
};

export default function Sidebar() {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar, userRole } = useAppStore();
  const { t } = useLanguage();

  const allowed = userRole ? ROLE_ITEMS[userRole] : undefined;
  const items = allowed ? menuItems.filter((item) => allowed.includes(item.id)) : menuItems;

  const handleMenuClick = (itemId: string) => {
    setActiveView(itemId);
    if (window.innerWidth < 768 && !sidebarCollapsed) toggleSidebar();
  };

  return (
    <>
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="fixed inset-0 bottom-0 top-16 z-20 bg-zinc-900/20 md:hidden"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          />
        )}
      </AnimatePresence>

      <aside
        className={`transition-fluid fixed bottom-0 left-0 z-30 border-r border-zinc-200 bg-white ${
          sidebarCollapsed ? '-translate-x-full md:w-16 md:translate-x-0' : 'w-60 translate-x-0'
        }`}
        style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-5 z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:text-zinc-900 md:flex"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <nav className="h-full space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const label = t(item.labelKey, item.label);
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                title={sidebarCollapsed ? label : undefined}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'font-medium text-brand-700' : 'text-zinc-600 hover:bg-zinc-900/[0.04] hover:text-zinc-900'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-0 rounded-lg bg-brand-50"
                    aria-hidden
                  />
                )}
                <Icon size={18} className="relative shrink-0" />
                {!sidebarCollapsed && <span className="relative flex-1 whitespace-nowrap text-left">{label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
