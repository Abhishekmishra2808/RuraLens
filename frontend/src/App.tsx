import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useVillageStore } from './store/villageStore';
import { demoVillageData } from './data/demoVillageData';
import LandingPage from './components/Landing/LandingPage';
import DocsPage from './components/Docs/DocsPage';
import { DOC_SECTIONS } from './components/Docs/docsContent';
import LoginPage from './components/Auth/LoginPageNew';
import TopNav from './components/Layout/TopNav';
import Sidebar from './components/Sidebar/Sidebar';
import StatusBar from './components/Layout/StatusBar';
import InfoPanel from './components/InfoPanel/InfoPanel';
import Dashboard from './components/Dashboard/Dashboard';
import SettingsView from './components/Views/SettingsView';
import AnonymousReportsView from './components/Views/AnonymousReportsView';
import MobileAnonymousReports from './components/Views/MobileAnonymousReports';
import FieldWorkerView from './components/Views/FieldWorkerView';
import MapView from './components/Views/MapView';
import SchemesView from './components/Views/SchemesView';
import AqiWeatherView from './components/Views/AqiWeatherView';
import CallRecordsView from './components/Views/CallRecordsView';
import ImpactPredictorView from './components/Views/ImpactPredictorView';
import MobileNav from './components/Layout/MobileNav';
import MobileHeader from './components/Layout/MobileHeader';
import MobileLandingPage from './components/Landing/MobileLandingPage';
import MobileLoginPage from './components/Auth/MobileLoginPage';
import MobileDashboard from './components/Dashboard/MobileDashboard';
import { useLanguage } from './i18n/LanguageContext';

function parseDocsHash(hash: string): string | null {
  const match = hash.match(/^#\/docs(?:\/([\w-]+))?\/?$/);
  if (!match) return null;
  const requested = match[1];
  return DOC_SECTIONS.some((section) => section.id === requested) ? requested! : DOC_SECTIONS[0].id;
}

function App() {
  const { activeView, sidebarCollapsed, infoPanelOpen, isAuthenticated, userRole, fetchSchemes, waterTanks, setVillageData } = useVillageStore();
  const { lang, t } = useLanguage();
  const [showLanding, setShowLanding] = useState(true);
  const [docsSection, setDocsSection] = useState<string | null>(() => parseDocsHash(window.location.hash));
  const isMobile = Capacitor.isNativePlatform();
  const hi = lang === 'hi';

  useEffect(() => {
    const onHashChange = () => setDocsSection(parseDocsHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const openDocs = (sectionId: string) => {
    window.location.hash = `#/docs/${sectionId}`;
  };

  const closeDocs = () => {
    window.history.pushState(null, '', window.location.pathname + window.location.search);
    setDocsSection(null);
    window.scrollTo(0, 0);
  };

  // Load demo data on startup if no data loaded
  useEffect(() => {
    if (waterTanks.length === 0) {
      console.log('🏘️ Loading demo village data with built-in network...');
      setVillageData(demoVillageData);
    }
  }, [waterTanks.length, setVillageData]);

  // Control body overflow based on authentication state
  useEffect(() => {
    if (isAuthenticated) {
      document.body.classList.add('dashboard-mode');
      // Fetch schemes when user logs in (non-blocking, especially for mobile)
      fetchSchemes().catch(err => {
        console.warn('Schemes fetch failed silently:', err);
      });
    } else {
      document.body.classList.remove('dashboard-mode');
    }
    
    return () => {
      document.body.classList.remove('dashboard-mode');
    };
  }, [isAuthenticated, fetchSchemes]);

  if (docsSection) {
    return (
      <DocsPage
        section={docsSection}
        onBack={() => {
          closeDocs();
          setShowLanding(true);
        }}
        onGetStarted={() => {
          closeDocs();
          setShowLanding(false);
        }}
      />
    );
  }

  // Show landing page first
  if (showLanding && !isAuthenticated) {
    if (isMobile) {
      return <MobileLandingPage onGetStarted={() => setShowLanding(false)} />;
    }
    return <LandingPage onGetStarted={() => setShowLanding(false)} onOpenDocs={openDocs} />;
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    if (isMobile) {
      return <MobileLoginPage onBack={() => setShowLanding(true)} />;
    }
    return <LoginPage onBack={() => setShowLanding(true)} />;
  }

  // Render appropriate view based on activeView and userRole
  const renderView = () => {
    console.log('🔷 Rendering view:', activeView, 'userRole:', userRole, 'isMobile:', isMobile);
    
    // Field Worker sees their dashboard by default
    if (userRole === 'field_worker' && !isMobile) {
      return <FieldWorkerView />;
    }

    switch (activeView) {
      case 'dashboard':
        return isMobile ? <MobileDashboard /> : <Dashboard />;
      case 'map':
        return <MapView />;
      case 'schemes':
        return <SchemesView />;
      case 'aqi-weather':
        return <AqiWeatherView />;
      case 'reports':
      case 'anonymous-reports':
        return isMobile ? <MobileAnonymousReports /> : <AnonymousReportsView />;
      case 'call-records':
        return userRole === 'admin' ? <CallRecordsView /> : (isMobile ? <MobileDashboard /> : <Dashboard />);
      case 'impact-predictor':
        return <ImpactPredictorView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  // Mobile Layout (Android APK)
  if (isMobile && isAuthenticated) {
    console.log('🔵 Mobile authenticated layout - activeView:', activeView, 'userRole:', userRole);
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
        {/* 1. Native-style Header */}
        <MobileHeader />

        {/* 2. Main Content Area (Scrollable) */}
        <main 
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth bg-slate-950"
          style={{
            paddingTop: '72px', // 56px header + 16px spacing
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingBottom: '88px' // 64px (Nav) + 24px (extra spacing)
          }}
        >
          {renderView()}
          
          {/* Mobile Info Panel (Overlay if active) */}
          {infoPanelOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/95 pt-14 pb-16 overflow-y-auto animate-in slide-in-from-bottom-10">
              <InfoPanel />
            </div>
          )}
        </main>

        {/* 3. Native-style Bottom Tabs */}
        <MobileNav />
        
        {/* 4. Overlay Sidebar (Only when 'More' is clicked) */}
        {!sidebarCollapsed && (
          <div className="fixed inset-0 z-[60]">
            {/* Click backdrop to close */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={useVillageStore.getState().toggleSidebar}
            />
            <div className="absolute right-0 top-0 bottom-0 w-64 bg-slate-900 border-l border-white/10 p-4 pt-16 animate-in slide-in-from-right">
              <h3 className="text-white font-bold mb-4 text-lg">{hi ? 'मेनू' : 'Menu'}</h3>
              {/* You can reuse specific Sidebar items here manually or import Sidebar list */}
              <button 
                onClick={() => { useVillageStore.getState().setActiveView('settings'); useVillageStore.getState().toggleSidebar(); }}
                className="w-full text-left p-3 text-slate-300 hover:bg-white/10 rounded-lg"
              >
                {t('settings', 'Settings')}
              </button>
              <button 
                onClick={() => { useVillageStore.getState().logout(); }}
                className="w-full text-left p-3 text-red-400 hover:bg-red-500/10 rounded-lg mt-2"
              >
                {hi ? 'लॉगआउट' : 'Logout'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-200">
      <TopNav />
      
      <div className="flex-1 flex overflow-hidden" style={{
        marginTop: '64px',
        marginBottom: '32px'
      }}>
        <Sidebar />
        
        <main className={`flex-1 flex transition-all duration-300 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        } ml-0`}>
          {/* Central Canvas */}
          <div className={`flex-1 relative transition-all duration-300 ${
            infoPanelOpen ? 'lg:w-3/4' : 'w-full'
          }`}>
            {renderView()}
          </div>
          
          {/* Info Panel */}
          {infoPanelOpen && (
            <div className="hidden lg:block w-1/4 min-w-[300px] max-w-[400px]">
              <InfoPanel />
            </div>
          )}
        </main>
      </div>
      
      <StatusBar />
    </div>
  );
}

export default App;
