import { useState } from 'react';
import { 
  Settings, 
  User, 
  Bell, 
  Lock, 
  Database, 
  Monitor,
  Save,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useLanguage } from '../../i18n/LanguageContext';

export default function SettingsView() {
  const { userRole, username } = useAppStore();
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      sms: false,
      push: true,
      criticalAlerts: true,
      dailyReport: true,
    },
    display: {
      theme: 'dark',
      language: 'en',
      timezone: 'Asia/Kolkata',
      mapStyle: 'satellite',
      autoRefresh: true,
      refreshInterval: 5,
    },
    privacy: {
      shareLocation: false,
      analyticsTracking: true,
      publicProfile: userRole === 'user',
    },
  });

  const tabs = [
    { id: 'general', icon: Settings, label: tx('General', 'सामान्य') },
    { id: 'profile', icon: User, label: tx('Profile', 'प्रोफाइल') },
    { id: 'notifications', icon: Bell, label: tx('Notifications', 'सूचनाएं') },
    { id: 'display', icon: Monitor, label: tx('Display', 'डिस्प्ले') },
    { id: 'privacy', icon: Lock, label: tx('Privacy', 'गोपनीयता') },
    { id: 'data', icon: Database, label: tx('Data Management', 'डेटा प्रबंधन') },
  ];

  return (
    <div className="h-full w-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{tx('Settings', 'सेटिंग्स')}</h1>
          <p className="text-slate-400">{tx('Manage your preferences and account settings', 'अपनी प्राथमिकताएं और खाता सेटिंग्स प्रबंधित करें')}</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-64 bg-slate-900/50 backdrop-blur-md rounded-xl p-4 h-fit border border-white/10">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-slate-900/50 backdrop-blur-md rounded-xl p-8 border border-white/10">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">{tx('General Settings', 'सामान्य सेटिंग्स')}</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('System Name', 'सिस्टम नाम')}
                    </label>
                    <input
                      type="text"
                      value="RuraLens"
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Location', 'स्थान')}
                    </label>
                    <input
                      type="text"
                      value="Configurable"
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Time Zone', 'समय क्षेत्र')}
                    </label>
                    <select
                      value={settings.display.timezone}
                      onChange={(e) => setSettings({
                        ...settings,
                        display: { ...settings.display, timezone: e.target.value }
                      })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">{tx('Profile Information', 'प्रोफाइल जानकारी')}</h2>
                
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                    {username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{username}</h3>
                    <p className="text-slate-400 capitalize">{userRole?.replace('_', ' ')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Full Name', 'पूरा नाम')}
                    </label>
                    <input
                      type="text"
                      placeholder={tx('Enter your full name', 'अपना पूरा नाम दर्ज करें')}
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Email', 'ईमेल')}
                    </label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Phone Number', 'फोन नंबर')}
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white placeholder-slate-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">{tx('Notification Preferences', 'सूचना प्राथमिकताएं')}</h2>
                
                <div className="space-y-4">
                  {Object.entries(settings.notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-white/10">
                      <div>
                        <p className="text-white font-medium capitalize">
                          {key === 'email' && tx('Email', 'ईमेल')}
                          {key === 'sms' && tx('SMS', 'एसएमएस')}
                          {key === 'push' && tx('Push', 'पुश')}
                          {key === 'criticalAlerts' && tx('Critical Alerts', 'गंभीर अलर्ट')}
                          {key === 'dailyReport' && tx('Daily Report', 'दैनिक रिपोर्ट')}
                        </p>
                        <p className="text-sm text-slate-400">
                          {key === 'email' && tx('Receive notifications via email', 'ईमेल के माध्यम से सूचनाएं प्राप्त करें')}
                          {key === 'sms' && tx('Receive SMS alerts for critical issues', 'गंभीर समस्याओं के लिए एसएमएस अलर्ट प्राप्त करें')}
                          {key === 'push' && tx('Browser push notifications', 'ब्राउज़र पुश सूचनाएं')}
                          {key === 'criticalAlerts' && tx('Immediate alerts for critical infrastructure issues', 'गंभीर अवसंरचना समस्याओं पर तुरंत अलर्ट')}
                          {key === 'dailyReport' && tx('Daily summary report at 9:00 AM', 'रोजाना सुबह 9:00 बजे सारांश रिपोर्ट')}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setSettings({
                            ...settings,
                            notifications: { ...settings.notifications, [key]: e.target.checked }
                          })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">{tx('Display Settings', 'डिस्प्ले सेटिंग्स')}</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Theme', 'थीम')}
                    </label>
                    <select
                      value={settings.display.theme}
                      onChange={(e) => setSettings({
                        ...settings,
                        display: { ...settings.display, theme: e.target.value }
                      })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white"
                    >
                      <option value="dark">{tx('Dark', 'डार्क')}</option>
                      <option value="light">{tx('Light', 'लाइट')}</option>
                      <option value="auto">{tx('Auto', 'ऑटो')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Map Style', 'मैप शैली')}
                    </label>
                    <select
                      value={settings.display.mapStyle}
                      onChange={(e) => setSettings({
                        ...settings,
                        display: { ...settings.display, mapStyle: e.target.value }
                      })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white"
                    >
                      <option value="satellite">{tx('Satellite', 'सैटेलाइट')}</option>
                      <option value="streets">{tx('Streets', 'सड़कें')}</option>
                      <option value="terrain">{tx('Terrain', 'टेर्रेन')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {tx('Auto Refresh Interval (seconds)', 'ऑटो रिफ्रेश अंतराल (सेकंड)')}
                    </label>
                    <input
                      type="number"
                      value={settings.display.refreshInterval}
                      onChange={(e) => setSettings({
                        ...settings,
                        display: { ...settings.display, refreshInterval: parseInt(e.target.value) }
                      })}
                      min="1"
                      max="60"
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">{tx('Data Management', 'डेटा प्रबंधन')}</h2>
                
                <div className="grid gap-4">
                  <button className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Download size={20} />
                    <div className="text-left flex-1">
                      <p className="font-semibold">{tx('Export Data', 'डेटा एक्सपोर्ट करें')}</p>
                      <p className="text-sm text-blue-400/80">{tx('Download all infrastructure data as CSV/JSON', 'सभी अवसंरचना डेटा को CSV/JSON में डाउनलोड करें')}</p>
                    </div>
                  </button>

                  <button className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-all">
                    <Upload size={20} />
                    <div className="text-left flex-1">
                      <p className="font-semibold">{tx('Import Data', 'डेटा इम्पोर्ट करें')}</p>
                      <p className="text-sm text-purple-400/80">{tx('Upload sensor data or configuration files', 'सेंसर डेटा या कॉन्फ़िगरेशन फ़ाइलें अपलोड करें')}</p>
                    </div>
                  </button>

                  <button className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 hover:bg-orange-500/20 transition-all">
                    <RefreshCw size={20} />
                    <div className="text-left flex-1">
                      <p className="font-semibold">{tx('Reset Dashboard', 'डैशबोर्ड रीसेट करें')}</p>
                      <p className="text-sm text-orange-400/80">{tx('Reset all views to default configuration', 'सभी व्यू को डिफ़ॉल्ट कॉन्फ़िगरेशन पर रीसेट करें')}</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-8 flex gap-4">
              <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all">
                <Save size={20} />
                {tx('Save Changes', 'परिवर्तन सहेजें')}
              </button>
              <button className="px-6 py-3 border border-white/10 text-slate-300 rounded-lg hover:bg-slate-800 transition-all">
                {tx('Cancel', 'रद्द करें')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
