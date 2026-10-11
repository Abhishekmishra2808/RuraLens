import { useState, useEffect } from 'react';
import {
  Shield,
  Send,
  Search,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  ArrowUpRight,
  Camera,
  X,
  Loader2,
  Copy,
  Check,
  Star,
  Filter,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Route,
  Droplet,
  Zap,
  Trash2,
  Stethoscope,
  BookOpen,
  Scale,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { useAnonymousReports } from '../../hooks/useAnonymousReports';
import { API_URL } from '../../config/api';
import { useLanguage } from '../../i18n/LanguageContext';

const CATEGORIES = [
  { id: 'road', label: { en: 'Road', hi: 'सड़क' }, icon: Route },
  { id: 'water', label: { en: 'Water', hi: 'पानी' }, icon: Droplet },
  { id: 'power', label: { en: 'Power', hi: 'बिजली' }, icon: Zap },
  { id: 'waste', label: { en: 'Waste', hi: 'कचरा' }, icon: Trash2 },
  { id: 'healthcare', label: { en: 'Health', hi: 'स्वास्थ्य' }, icon: Stethoscope },
  { id: 'education', label: { en: 'Education', hi: 'शिक्षा' }, icon: BookOpen },
  { id: 'corruption', label: { en: 'Corruption', hi: 'भ्रष्टाचार' }, icon: Scale },
  { id: 'safety', label: { en: 'Safety', hi: 'सुरक्षा' }, icon: Shield },
  { id: 'other', label: { en: 'Other', hi: 'अन्य' }, icon: FileText }
];

const STATUS_CONFIG: Record<string, { label: { en: string; hi: string }; color: string; bg: string }> = {
  pending: { label: { en: 'Pending', hi: 'लंबित' }, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  acknowledged: { label: { en: 'Acknowledged', hi: 'स्वीकृत' }, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  assigned: { label: { en: 'Assigned', hi: 'आवंटित' }, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  in_progress: { label: { en: 'In Progress', hi: 'प्रगति में' }, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  resolved: { label: { en: 'Resolved', hi: 'समाधान हुआ' }, color: 'text-green-400', bg: 'bg-green-500/20' },
  closed: { label: { en: 'Closed', hi: 'बंद' }, color: 'text-slate-400', bg: 'bg-slate-500/20' },
  rejected: { label: { en: 'Rejected', hi: 'अस्वीकृत' }, color: 'text-red-400', bg: 'bg-red-500/20' }
};

const AUTHORITY_LEVELS: Record<number, { name: { en: string; hi: string }; color: string }> = {
  0: { name: { en: 'Local Representative', hi: 'स्थानीय प्रतिनिधि' }, color: 'text-green-400' },
  1: { name: { en: 'Area Officer', hi: 'क्षेत्र अधिकारी' }, color: 'text-blue-400' },
  2: { name: { en: 'District Magistrate', hi: 'जिला मजिस्ट्रेट' }, color: 'text-yellow-400' },
  3: { name: { en: 'State Authority', hi: 'राज्य प्राधिकरण' }, color: 'text-red-400' }
};

type TabType = 'browse' | 'submit' | 'track';

export default function MobileAnonymousReports() {
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const { 
    reports, 
    stats, 
    loading,
    error,
    fetchReports,
    submitReport, 
    trackReport, 
    voteOnReport,
    escalateReport,
    submitFeedback 
  } = useAnonymousReports();
  
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Debug log for mobile
  useEffect(() => {
    console.log('MobileAnonymousReports mounted');
    console.log('API_URL:', API_URL);
    console.log('Reports count:', reports.length);
    console.log('Error:', error);
  }, [reports, error]);

  // Submit form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    district: ''
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Track form state
  const [trackToken, setTrackToken] = useState('');
  const [trackedReport, setTrackedReport] = useState<any>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackData, setFeedbackData] = useState({
    isResolved: true,
    rating: 5,
    feedback: ''
  });

  const filteredReports = reports.filter(r => 
    !filterCategory || r.category === filterCategory
  );

  // Handlers
  const handleVote = async (reportId: string, voteType: 'upvote' | 'downvote', e: React.MouseEvent) => {
    e.stopPropagation();
    await voteOnReport(reportId, voteType);
  };

  const detectLocation = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert(tx('Geolocation not supported', 'जियोलोकेशन समर्थित नहीं है'));
      setDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords([pos.coords.longitude, pos.coords.latitude]);
        setDetecting(false);
      },
      () => {
        alert(tx('Could not detect location', 'स्थान का पता नहीं चल सका'));
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 3) {
      alert(tx('Maximum 3 photos', 'अधिकतम 3 फोटो'));
      return;
    }
    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    setPhotos(prev => [...prev, ...validFiles]);
    setPreviewUrls(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.category) {
      alert(tx('Please fill required fields', 'कृपया आवश्यक फ़ील्ड भरें'));
      return;
    }
    setSubmitting(true);
    const result = await submitReport({
      ...formData,
      coords: coords || undefined,
      photos
    });
    setSubmitting(false);
    setSubmitResult(result);
    if (result.success) {
      setFormData({ title: '', description: '', category: '', location: '', district: '' });
      setPhotos([]);
      setPreviewUrls([]);
      setCoords(null);
    }
  };

  const handleTrack = async () => {
    if (!trackToken.trim()) {
      setTrackError(tx('Enter your tracking token', 'अपना ट्रैकिंग टोकन दर्ज करें'));
      return;
    }
    setTrackError(null);
    const result = await trackReport(trackToken.trim());
    if (result.success) {
      setTrackedReport(result.report);
    } else {
      setTrackError(result.error || tx('Report not found', 'रिपोर्ट नहीं मिली'));
      setTrackedReport(null);
    }
  };

  const handleEscalate = async () => {
    if (!escalateReason.trim()) {
      alert(tx('Please provide a reason', 'कृपया कारण दें'));
      return;
    }
    const result = await escalateReport(trackedReport.id, trackToken, escalateReason);
    if (result.success) {
      alert(tx(`Escalated to ${result.authority}`, `${result.authority} तक एस्केलेट किया गया`));
      setShowEscalate(false);
      setEscalateReason('');
      handleTrack();
    } else {
      alert(result.error || tx('Failed to escalate', 'एस्केलेट करने में विफल'));
    }
  };

  const handleFeedbackSubmit = async () => {
    const result = await submitFeedback(
      trackedReport.id,
      trackToken,
      feedbackData.isResolved,
      feedbackData.rating,
      feedbackData.feedback
    );
    if (result.success) {
      alert(tx('Feedback submitted!', 'प्रतिक्रिया जमा हो गई!'));
      setShowFeedback(false);
      handleTrack();
    }
  };

  const copyToken = () => {
    if (submitResult?.reporterToken) {
      navigator.clipboard.writeText(submitResult.reporterToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const canEscalate = trackedReport && 
    trackedReport.status !== 'resolved' && 
    trackedReport.status !== 'closed' && 
    trackedReport.currentEscalationLevel < 3 &&
    new Date() > new Date(trackedReport.escalationDeadline);

  // Render tabs
  const renderTabs = () => (
    <div className="flex bg-slate-800/50 rounded-xl p-1 mb-4">
      {[
        { id: 'browse', label: tx('Browse', 'देखें'), icon: Eye },
        { id: 'submit', label: tx('Submit', 'जमा करें'), icon: Send },
        { id: 'track', label: tx('Track', 'ट्रैक करें'), icon: Search }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabType)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-cyan-500 text-white'
              : 'text-slate-400'
          }`}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      ))}
    </div>
  );

  // Browse Tab
  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  };

  const SelectedCategoryIcon = selectedReport
    ? CATEGORIES.find(c => c.id === selectedReport.category)?.icon
    : undefined;

  const renderBrowse = () => (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-slate-500 text-xs mt-1">API: {API_URL}</p>
          </div>
        </div>
      )}

      {/* Stats with Refresh */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">Overview</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-2 text-slate-400 active:text-cyan-400"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-white">{stats?.total || 0}</div>
          <div className="text-xs text-slate-400">{tx('Total', 'कुल')}</div>
        </div>
        <div className="bg-yellow-500/10 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-yellow-400">{stats?.pending || 0}</div>
          <div className="text-xs text-slate-400">{tx('Pending', 'लंबित')}</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-green-400">{stats?.resolved || 0}</div>
          <div className="text-xs text-slate-400">{tx('Resolved', 'समाधान हुआ')}</div>
        </div>
      </div>

      {/* Filter */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-sm text-slate-400"
      >
        <Filter size={16} />
        {tx('Filter by Category', 'श्रेणी के अनुसार फ़िल्टर')}
        <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
      </button>

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              !filterCategory ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {tx('All', 'सभी')}
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 ${
                filterCategory === cat.id ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <cat.icon size={14} className="shrink-0" />{cat.label[lang]}
            </button>
          ))}
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{tx('No reports found', 'कोई रिपोर्ट नहीं मिली')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => {
            const status = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
            const category = CATEGORIES.find(c => c.id === report.category);
            const CategoryIcon = category?.icon ?? FileText;
            
            return (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CategoryIcon size={18} className="shrink-0" />
                    <span className={`px-2 py-0.5 rounded text-xs ${status.bg} ${status.color}`}>
                      {status.label[lang]}
                    </span>
                  </div>
                  {report.currentEscalationLevel > 0 && (
                    <span className="text-xs text-orange-400 flex items-center gap-1">
                      <ArrowUpRight size={12} />
                      L{report.currentEscalationLevel}
                    </span>
                  )}
                </div>
                
                <h3 className="text-white font-medium mb-1 line-clamp-1">{report.title}</h3>
                <p className="text-slate-400 text-sm mb-3 line-clamp-2">{report.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleVote(report.id, 'upvote', e)}
                      className="flex items-center gap-1 text-slate-400 active:text-green-400"
                    >
                      <ThumbsUp size={14} />
                      <span className="text-xs">{report.upvoteCount}</span>
                    </button>
                    <button
                      onClick={(e) => handleVote(report.id, 'downvote', e)}
                      className="flex items-center gap-1 text-slate-400 active:text-red-400"
                    >
                      <ThumbsDown size={14} />
                      <span className="text-xs">{report.downvoteCount}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar size={12} />
                    {format(new Date(report.createdAt), 'MMM d')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
          <div className="bg-slate-900 w-full max-h-[85vh] rounded-t-3xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Report Details</h3>
              <button onClick={() => setSelectedReport(null)} className="p-2">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
              <div className="flex items-center gap-2">
                {SelectedCategoryIcon && <SelectedCategoryIcon size={24} className="shrink-0" />}
                <span className={`px-2 py-1 rounded text-sm ${STATUS_CONFIG[selectedReport.status]?.bg} ${STATUS_CONFIG[selectedReport.status]?.color}`}>
                  {STATUS_CONFIG[selectedReport.status]?.label[lang]}
                </span>
              </div>
              
              <h4 className="text-xl font-bold text-white">{selectedReport.title}</h4>
              <p className="text-slate-300">{selectedReport.description}</p>
              
              {selectedReport.intent && (
                <div className="bg-cyan-500/10 rounded-xl p-3">
                  <div className="text-xs text-slate-400 mb-1">{tx('AI Extracted Intent', 'एआई द्वारा निकाला गया आशय')}</div>
                  <div className="text-cyan-400 text-sm">{selectedReport.intent}</div>
                </div>
              )}
              
              <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <ThumbsUp size={16} className="text-green-400" />
                    <span className="text-white">{selectedReport.upvoteCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsDown size={16} className="text-red-400" />
                    <span className="text-white">{selectedReport.downvoteCount}</span>
                  </div>
                </div>
                <div className={`text-sm ${
                  selectedReport.credibilityScore >= 70 ? 'text-green-400' :
                  selectedReport.credibilityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {selectedReport.credibilityScore}% {tx('Credibility', 'विश्वसनीयता')}
                </div>
              </div>

              {selectedReport.currentEscalationLevel > 0 && (
                <div className="bg-orange-500/10 rounded-xl p-3">
                  <div className="text-xs text-orange-400 mb-1">{tx('Escalation Level', 'एस्केलेशन स्तर')}</div>
                  <div className="text-white">
                    {AUTHORITY_LEVELS[selectedReport.currentEscalationLevel]?.name[lang]}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleVote(selectedReport.id, 'upvote', {} as any)}
                  className="flex-1 py-3 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center gap-2"
                >
                  <ThumbsUp size={18} /> {tx('Verify', 'समर्थन')}
                </button>
                <button
                  onClick={() => handleVote(selectedReport.id, 'downvote', {} as any)}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center gap-2"
                >
                  <ThumbsDown size={18} /> {tx('Doubt', 'आपत्ति')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Submit Tab
  const renderSubmit = () => {
    if (submitResult?.success) {
      return (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">{tx('Report Submitted!', 'रिपोर्ट जमा हो गई!')}</h2>
            <p className="text-slate-400 text-sm mb-4">{tx('Save your tracking token', 'अपना ट्रैकिंग टोकन सुरक्षित रखें')}</p>
            
            <div className="bg-slate-800 rounded-xl p-3 mb-3">
              <div className="text-xs text-slate-400 mb-1">{tx('Report ID', 'रिपोर्ट आईडी')}</div>
              <div className="text-cyan-400 font-mono text-sm">{submitResult.reportId}</div>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-3 mb-4">
              <div className="text-xs text-slate-400 mb-1">{tx('Tracking Token', 'ट्रैकिंग टोकन')}</div>
              <div className="flex items-center justify-between">
                <div className="text-yellow-400 font-mono text-xs break-all pr-2">
                  {submitResult.reporterToken}
                </div>
                <button onClick={copyToken} className="p-2 flex-shrink-0">
                  {tokenCopied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-slate-400" />}
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setSubmitResult(null)}
              className="w-full py-3 bg-cyan-500 text-white rounded-xl font-medium"
            >
              {tx('Submit Another Report', 'एक और रिपोर्ट जमा करें')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Privacy Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <Shield size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300">
              <span className="text-blue-400 font-medium">{tx('Privacy Protected: ', 'गोपनीयता सुरक्षित: ')}</span>
              {tx('AI will automatically remove all personal information from your report.', 'एआई आपकी रिपोर्ट से सभी व्यक्तिगत जानकारी स्वतः हटा देगा।')}
            </p>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">{tx('Category', 'श्रेणी')} *</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                className={`p-3 rounded-xl border text-center transition-all ${
                  formData.category === cat.id
                    ? 'border-cyan-500 bg-cyan-500/20'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <div className="mb-1 flex justify-center"><cat.icon size={20} className="shrink-0" /></div>
                <div className="text-xs text-slate-300">{cat.label[lang]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">{tx('Title', 'शीर्षक')} *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder={tx('Brief title of the issue', 'समस्या का संक्षिप्त शीर्षक')}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">{tx('Description', 'विवरण')} *</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder={tx('Describe the issue in detail. Include names, dates - AI will anonymize them.', 'समस्या का विस्तृत विवरण दें। नाम, तारीख शामिल करें - एआई उन्हें अनामीकृत कर देगा।')}
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 resize-none"
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-300 mb-2 block">{tx('Area', 'क्षेत्र')}</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder={tx('Area/Locality', 'क्षेत्र/इलाका')}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-2 block">{tx('District', 'जिला')}</label>
            <input
              type="text"
              value={formData.district}
              onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
              placeholder={tx('District', 'जिला')}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500"
            />
          </div>
        </div>

        {/* GPS */}
        <button
          onClick={detectLocation}
          disabled={detecting}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-slate-300"
        >
          {detecting ? <Loader2 size={16} className="animate-spin" /> : coords ? <Check size={16} /> : <MapPin size={16} />}
          {detecting ? tx('Detecting...', 'पता लगाया जा रहा है...') : coords ? tx('Location added', 'स्थान जोड़ दिया गया') : tx('Add GPS location', 'जीपीएस स्थान जोड़ें')}
        </button>

        {/* Photos */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">{tx('Photos (Optional)', 'फोटो (वैकल्पिक)')}</label>
          <div className="flex gap-2 flex-wrap">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1 -right-1 p-1 bg-red-500 rounded-full"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-slate-700 rounded-lg cursor-pointer">
                <Camera size={20} className="text-slate-500" />
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !formData.title || !formData.description || !formData.category}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
                {tx('Anonymizing...', 'अनामीकरण...')}
            </>
          ) : (
            <>
              <Send size={18} />
                {tx('Submit Anonymous Report', 'गुमनाम रिपोर्ट जमा करें')}
            </>
          )}
        </button>
      </div>
    );
  };

  // Track Tab
  const renderTrack = () => (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search size={18} className="text-cyan-400" />
          <span className="text-white font-medium">{tx('Track Your Report', 'अपनी रिपोर्ट ट्रैक करें')}</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={trackToken}
            onChange={(e) => setTrackToken(e.target.value)}
            placeholder={tx('Enter tracking token', 'ट्रैकिंग टोकन दर्ज करें')}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 font-mono text-sm"
          />
          <button
            onClick={handleTrack}
            disabled={loading}
            className="px-4 py-3 bg-cyan-500 text-white rounded-xl"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </div>
        {trackError && (
          <p className="text-red-400 text-sm mt-2">{trackError}</p>
        )}
      </div>

      {/* Tracked Report */}
      {trackedReport && (
        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
          {/* Status Banner */}
          <div className={`p-4 ${STATUS_CONFIG[trackedReport.status]?.bg || 'bg-slate-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-5 h-5 ${STATUS_CONFIG[trackedReport.status]?.color}`} />
                <span className={`font-medium ${STATUS_CONFIG[trackedReport.status]?.color}`}>
                  {STATUS_CONFIG[trackedReport.status]?.label[lang]}
                </span>
              </div>
              <span className={AUTHORITY_LEVELS[trackedReport.currentEscalationLevel]?.color}>
                {AUTHORITY_LEVELS[trackedReport.currentEscalationLevel]?.name[lang]}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">{tx('Report ID', 'रिपोर्ट आईडी')}</div>
              <div className="text-white font-mono text-sm">{trackedReport.id}</div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">{tx('Title', 'शीर्षक')}</div>
              <div className="text-white">{trackedReport.title}</div>
            </div>

            {/* Timeline */}
            <div>
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                <Clock size={12} /> {tx('Status Timeline', 'स्थिति समयरेखा')}
              </div>
              <div className="space-y-2">
                {trackedReport.statusUpdates?.slice(-3).map((update: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-white">{update.message}</div>
                      <div className="text-xs text-slate-500">
                        {format(new Date(update.timestamp), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Votes */}
            <div className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <ThumbsUp size={14} className="text-green-400" />
                  <span className="text-white text-sm">{trackedReport.upvoteCount}</span>
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsDown size={14} className="text-red-400" />
                  <span className="text-white text-sm">{trackedReport.downvoteCount}</span>
                </span>
              </div>
              <span className={`text-sm ${
                trackedReport.credibilityScore >= 70 ? 'text-green-400' :
                trackedReport.credibilityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {trackedReport.credibilityScore}% {tx('Credibility', 'विश्वसनीयता')}
              </span>
            </div>

            {/* Assigned Worker */}
            {trackedReport.assignedTo && (
              <div className="bg-purple-500/10 rounded-xl p-3">
                <div className="text-xs text-slate-400 mb-1">{tx('Assigned To', 'आवंटित')}</div>
                <div className="text-purple-400">{trackedReport.assignedTo}</div>
              </div>
            )}

            {/* Escalation */}
            {trackedReport.status !== 'resolved' && trackedReport.status !== 'closed' && (
              <div className={`rounded-xl p-3 ${canEscalate ? 'bg-red-500/10' : 'bg-slate-700/50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{tx('Escalation Deadline', 'एस्केलेशन समयसीमा')}</div>
                    <div className={canEscalate ? 'text-red-400' : 'text-white'}>
                      {format(new Date(trackedReport.escalationDeadline), 'MMM d, yyyy')}
                    </div>
                  </div>
                  {canEscalate && (
                    <button
                      onClick={() => setShowEscalate(true)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm flex items-center gap-1"
                    >
                      <ArrowUpRight size={14} /> {tx('Escalate', 'एस्केलेट करें')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Escalate Modal */}
            {showEscalate && (
              <div className="bg-slate-700/50 rounded-xl p-4">
                <h4 className="text-white font-medium mb-2">{tx('Escalate Report', 'रिपोर्ट एस्केलेट करें')}</h4>
                <p className="text-xs text-slate-400 mb-3">
                  {tx('This will escalate to', 'यह एस्केलेट करेगा:')} {AUTHORITY_LEVELS[(trackedReport.currentEscalationLevel + 1)]?.name[lang]}
                </p>
                <textarea
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder={tx('Reason for escalation...', 'एस्केलेशन का कारण...')}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 resize-none mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEscalate}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg"
                  >
                    {tx('Confirm', 'पुष्टि करें')}
                  </button>
                  <button
                    onClick={() => setShowEscalate(false)}
                    className="flex-1 py-2 bg-slate-700 text-white rounded-lg"
                  >
                    {tx('Cancel', 'रद्द करें')}
                  </button>
                </div>
              </div>
            )}

            {/* Resolution Feedback */}
            {(trackedReport.status === 'resolved' || trackedReport.status === 'closed') && 
             !trackedReport.resolutionFeedback && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <h4 className="text-green-400 font-medium mb-2">{tx('Was your issue resolved?', 'क्या आपकी समस्या का समाधान हुआ?')}</h4>
                {!showFeedback ? (
                  <button
                    onClick={() => setShowFeedback(true)}
                    className="w-full py-2 bg-green-500 text-white rounded-lg"
                  >
                    {tx('Provide Feedback', 'प्रतिक्रिया दें')}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFeedbackData(p => ({ ...p, isResolved: true }))}
                        className={`flex-1 py-2 rounded-lg ${
                          feedbackData.isResolved ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {tx('Yes', 'हां')}
                      </button>
                      <button
                        onClick={() => setFeedbackData(p => ({ ...p, isResolved: false }))}
                        className={`flex-1 py-2 rounded-lg ${
                          !feedbackData.isResolved ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {tx('No', 'नहीं')}
                      </button>
                    </div>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map(r => (
                        <button
                          key={r}
                          onClick={() => setFeedbackData(p => ({ ...p, rating: r }))}
                        >
                          <Star
                            size={24}
                            className={r <= feedbackData.rating ? 'text-yellow-400 fill-current' : 'text-slate-600'}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={feedbackData.feedback}
                      onChange={(e) => setFeedbackData(p => ({ ...p, feedback: e.target.value }))}
                      placeholder={tx('Comments (optional)', 'टिप्पणियां (वैकल्पिक)')}
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 resize-none"
                    />
                    <button
                      onClick={handleFeedbackSubmit}
                      className="w-full py-2 bg-green-500 text-white rounded-lg"
                    >
                      {tx('Submit Feedback', 'प्रतिक्रिया जमा करें')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Already submitted feedback */}
            {trackedReport.resolutionFeedback && (
              <div className="bg-slate-700/50 rounded-xl p-3">
                <div className="text-xs text-slate-400 mb-1">{tx('Your Feedback', 'आपकी प्रतिक्रिया')}</div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 ${trackedReport.resolutionFeedback.isResolved ? 'text-green-400' : 'text-red-400'}`}>
                    {trackedReport.resolutionFeedback.isResolved ? <Check size={14} /> : <X size={14} />}
                    {trackedReport.resolutionFeedback.isResolved ? tx('Resolved', 'समाधान हुआ') : tx('Not resolved', 'समाधान नहीं हुआ')}
                  </span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(r => (
                      <Star
                        key={r}
                        size={14}
                        className={r <= trackedReport.resolutionFeedback.satisfactionRating ? 'text-yellow-400 fill-current' : 'text-slate-600'}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!trackedReport && !trackError && (
        <div className="text-center py-8 text-slate-400">
          <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{tx('Enter your tracking token to see report status', 'रिपोर्ट स्थिति देखने के लिए ट्रैकिंग टोकन दर्ज करें')}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-cyan-500/20 rounded-xl">
          <Shield size={20} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{tx('Anonymous Reports', 'गुमनाम रिपोर्ट')}</h1>
          <p className="text-xs text-slate-400">{tx('Report issues anonymously', 'समस्याएं गुमनाम रूप से रिपोर्ट करें')}</p>
        </div>
      </div>

      {renderTabs()}

      {activeTab === 'browse' && renderBrowse()}
      {activeTab === 'submit' && renderSubmit()}
      {activeTab === 'track' && renderTrack()}
    </div>
  );
}
