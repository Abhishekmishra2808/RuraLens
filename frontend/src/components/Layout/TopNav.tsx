import { Search, Menu, User, LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { SPRING_SNAPPY } from '@/lib/motion';

const MENU_HIDDEN = { opacity: 0, scale: 0.94, y: -4 };

export default function TopNav() {
  const { toggleSidebar, username, userRole, logout } = useAppStore();
  const isMobile = Capacitor.isNativePlatform();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { t, lang, toggleLang } = useLanguage();

  const initials = username ? username.substring(0, 2).toUpperCase() : 'US';

  useEffect(() => {
    if (!isProfileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsProfileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isProfileOpen]);

  return (
    <nav
      className={`material fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-900/[0.08] px-4 md:px-6 ${
        isMobile ? 'pt-safe' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-900/[0.05] hover:text-zinc-900"
          aria-label="Toggle menu"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <img src="/ruralens-logo.png" alt="" className="h-7 w-7 object-contain" />
          <span className="hidden text-[17px] font-semibold tracking-tight text-zinc-900 md:block">
            {t('appBrand', 'RuraLens')}
          </span>
        </div>
      </div>

      <div className="mx-8 hidden max-w-md flex-1 md:flex">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
          <input
            type="text"
            placeholder={t('searchPlaceholder', 'Search')}
            className="h-9 w-full rounded-lg border border-transparent bg-zinc-900/[0.05] pl-9 pr-3 text-sm text-zinc-900 transition-colors placeholder:text-zinc-500 focus:border-zinc-300 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="h-8 rounded-lg border border-zinc-900/10 px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-900/[0.04]"
          title="Toggle language"
        >
          {lang === 'hi' ? 'EN' : 'हि'}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-haspopup="menu"
            aria-expanded={isProfileOpen}
            className="flex items-center gap-2.5 rounded-full py-1 pl-2 pr-1 transition-colors hover:bg-zinc-900/[0.04]"
          >
            <div className="hidden text-right md:block">
              <p className="text-xs font-medium text-zinc-900">{username || 'User'}</p>
              <p className="text-[11px] capitalize text-zinc-500">{userRole?.replace('_', ' ')}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white">
              {initials}
            </div>
          </button>

          {isProfileOpen && <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />}
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                role="menu"
                initial={MENU_HIDDEN}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={MENU_HIDDEN}
                transition={SPRING_SNAPPY}
                style={{ transformOrigin: 'top right' }}
                className="surface-raised absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl"
              >
                <div className="border-b border-zinc-900/[0.06] px-3 py-2.5">
                  <p className="text-sm font-medium text-zinc-900">{username}</p>
                  <p className="truncate text-xs capitalize text-zinc-500">{userRole?.replace('_', ' ')}</p>
                </div>
                <div className="p-1">
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-900/[0.05]"
                  >
                    <User size={14} /> {t('profile', 'Profile')}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10"
                  >
                    <LogOut size={14} /> {t('signOut', 'Sign out')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
