import { Search, Menu, User, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export default function TopNav() {
  const { toggleSidebar, username, userRole, logout } = useAppStore();
  const isMobile = Capacitor.isNativePlatform();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { t, lang, toggleLang } = useLanguage();

  const initials = username ? username.substring(0, 2).toUpperCase() : 'US';

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6 ${
        isMobile ? 'pt-safe' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
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
            className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="h-8 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          title="Toggle language"
        >
          {lang === 'hi' ? 'EN' : 'हि'}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 rounded-full py-1 pl-2 pr-1 hover:bg-zinc-50"
          >
            <div className="hidden text-right md:block">
              <p className="text-xs font-medium text-zinc-900">{username || 'User'}</p>
              <p className="text-[11px] capitalize text-zinc-500">{userRole?.replace('_', ' ')}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-medium text-white">
              {initials}
            </div>
          </button>

          {isProfileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                <div className="border-b border-zinc-100 px-3 py-2.5">
                  <p className="text-sm font-medium text-zinc-900">{username}</p>
                  <p className="truncate text-xs capitalize text-zinc-500">{userRole?.replace('_', ' ')}</p>
                </div>
                <div className="p-1">
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50">
                    <User size={14} /> {t('profile', 'Profile')}
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={14} /> {t('signOut', 'Sign out')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
