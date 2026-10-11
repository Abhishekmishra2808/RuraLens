import { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Eye,
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  Search,
  Filter,
  ArrowUpRight,
  User,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Route,
  Droplet,
  Zap,
  Trash2,
  Stethoscope,
  BookOpen,
  Scale,
  FileText,
  type LucideIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { useAnonymousReports } from '../../hooks/useAnonymousReports';
import { useAppStore } from '../../store/appStore';
import AnonymousReportForm from './AnonymousReportForm';
import AnonymousReportTracker from './AnonymousReportTracker';
import AnonymousReportAdminPanel from './AnonymousReportAdminPanel';
import { useLanguage } from '../../i18n/LanguageContext';

const AUTHORITY_LEVELS = {
  0: { name: { en: 'Local Representative', hi: 'स्थानीय प्रतिनिधि' }, color: 'text-green-400', bg: 'bg-green-500/20' },
  1: { name: { en: 'Area Officer', hi: 'क्षेत्र अधिकारी' }, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  2: { name: { en: 'District Magistrate', hi: 'जिला मजिस्ट्रेट' }, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  3: { name: { en: 'State Authority', hi: 'राज्य प्राधिकरण' }, color: 'text-red-400', bg: 'bg-red-500/20' }
};

const STATUS_CONFIG = {
  pending: { label: { en: 'Pending', hi: 'लंबित' }, color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock },
  acknowledged: { label: { en: 'Acknowledged', hi: 'स्वीकृत' }, color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Eye },
  assigned: { label: { en: 'Assigned', hi: 'आवंटित' }, color: 'text-purple-400', bg: 'bg-purple-500/20', icon: User },
  in_progress: { label: { en: 'In Progress', hi: 'प्रगति में' }, color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: TrendingUp },
  resolved: { label: { en: 'Resolved', hi: 'समाधान हुआ' }, color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
  closed: { label: { en: 'Closed', hi: 'बंद' }, color: 'text-slate-400', bg: 'bg-slate-500/20', icon: CheckCircle },
  rejected: { label: { en: 'Rejected', hi: 'अस्वीकृत' }, color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle }
};

const CATEGORY_CONFIG: Record<string, { label: { en: string; hi: string }; icon: LucideIcon; color: string }> = {
  road: { label: { en: 'Road & Infrastructure', hi: 'सड़क और अवसंरचना' }, icon: Route, color: 'text-amber-400' },
  water: { label: { en: 'Water Supply', hi: 'जल आपूर्ति' }, icon: Droplet, color: 'text-blue-400' },
  power: { label: { en: 'Electricity', hi: 'बिजली' }, icon: Zap, color: 'text-yellow-400' },
  waste: { label: { en: 'Waste Management', hi: 'कचरा प्रबंधन' }, icon: Trash2, color: 'text-green-400' },
  healthcare: { label: { en: 'Healthcare', hi: 'स्वास्थ्य सेवा' }, icon: Stethoscope, color: 'text-red-400' },
  education: { label: { en: 'Education', hi: 'शिक्षा' }, icon: BookOpen, color: 'text-purple-400' },
  corruption: { label: { en: 'Corruption', hi: 'भ्रष्टाचार' }, icon: Scale, color: 'text-orange-400' },
  safety: { label: { en: 'Safety', hi: 'सुरक्षा' }, icon: Shield, color: 'text-indigo-400' },
  other: { label: { en: 'Other', hi: 'अन्य' }, icon: FileText, color: 'text-slate-400' }
};

export default function AnonymousReportsView() {
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const { userRole } = useAppStore();
  const { reports, stats, loading, error, fetchReports, voteOnReport } = useAnonymousReports();
  const [activeTab, setActiveTab] = useState<'browse' | 'submit' | 'track' | 'admin'>('browse');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const filters: any = {};
    if (filterStatus) filters.status = filterStatus;
    if (sortBy) filters.sortBy = sortBy;
    fetchReports(filters);
  }, [filterStatus, sortBy, fetchReports]);

  const handleVote = async (reportId: string, voteType: 'upvote' | 'downvote') => {
    await voteOnReport(reportId, voteType);
  };

  const copyReportId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredReports = reports.filter(report => {
    if (filterCategory && report.category !== filterCategory) return false;
    return true;
  });

  const renderStatsCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="text-2xl font-bold text-white">{stats?.total || 0}</div>
        <div className="text-sm text-slate-400">{tx('Total Reports', 'कुल रिपोर्ट')}</div>
      </div>
      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
        <div className="text-2xl font-bold text-yellow-400">{stats?.pending || 0}</div>
        <div className="text-sm text-slate-400">{tx('Pending', 'लंबित')}</div>
      </div>
      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
        <div className="text-2xl font-bold text-blue-400">{stats?.inProgress || 0}</div>
        <div className="text-sm text-slate-400">{tx('In Progress', 'प्रगति में')}</div>
      </div>
      <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
        <div className="text-2xl font-bold text-green-400">{stats?.resolved || 0}</div>
        <div className="text-sm text-slate-400">{tx('Resolved', 'समाधान हुआ')}</div>
      </div>
      <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
        <div className="text-2xl font-bold text-red-400">{stats?.escalated || 0}</div>
        <div className="text-sm text-slate-400">{tx('Escalated', 'एस्केलेटेड')}</div>
      </div>
      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
        <div className="text-2xl font-bold text-purple-400">{stats?.avgResolutionTimeDays || 0}d</div>
        <div className="text-sm text-slate-400">{tx('Avg. Resolution', 'औसत समाधान')}</div>
      </div>
    </div>
  );

  const renderReportCard = (report: any) => {
    const statusConfig = STATUS_CONFIG[report.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const categoryConfig = CATEGORY_CONFIG[report.category] || CATEGORY_CONFIG.other;
    const authorityLevel = AUTHORITY_LEVELS[report.currentEscalationLevel as keyof typeof AUTHORITY_LEVELS];
    const StatusIcon = statusConfig.icon;

    return (
      <div 
        key={report.id}
        className="bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600 transition-all"
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <categoryConfig.icon size={20} className="shrink-0" />
              <span className={`text-sm ${categoryConfig.color}`}>{categoryConfig.label[lang]}</span>
            </div>
            <div className="flex items-center gap-2">
              {report.currentEscalationLevel > 0 && (
                <span className={`px-2 py-1 rounded-lg text-xs ${authorityLevel.bg} ${authorityLevel.color}`}>
                  <ArrowUpRight className="w-3 h-3 inline mr-1" />
                  {authorityLevel.name[lang]}
                </span>
              )}
              <span className={`px-2 py-1 rounded-lg text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                <StatusIcon className="w-3 h-3 inline mr-1" />
                {statusConfig.label[lang]}
              </span>
            </div>
          </div>

          {/* Title & Description */}
          <h3 className="text-white font-medium mb-2">{report.title}</h3>
          <p className="text-slate-400 text-sm mb-3 line-clamp-2">{report.description}</p>

          {/* Intent Badge */}
          <div className="bg-slate-700/50 rounded-lg p-2 mb-3">
            <div className="text-xs text-slate-500 mb-1">{tx('Extracted Intent:', 'निकाला गया आशय:')}</div>
            <div className="text-sm text-cyan-400">{report.intent}</div>
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
            {report.location?.area && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {report.location.area}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(report.createdAt), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Keywords */}
          {report.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {report.keywords.slice(0, 4).map((keyword: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-400">
                  {keyword}
                </span>
              ))}
            </div>
          )}

          {/* Voting & Credibility */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleVote(report.id, 'upvote')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors"
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm">{report.upvoteCount}</span>
              </button>
              <button
                onClick={() => handleVote(report.id, 'downvote')}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
              >
                <ThumbsDown className="w-4 h-4" />
                <span className="text-sm">{report.downvoteCount}</span>
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-slate-500" />
                <span className={`text-sm ${
                  report.credibilityScore >= 70 ? 'text-green-400' :
                  report.credibilityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {report.credibilityScore}%
                </span>
              </div>
              
              <button
                onClick={() => copyReportId(report.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                title={tx('Copy Report ID', 'रिपोर्ट आईडी कॉपी करें')}
              >
                {copiedId === report.id ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              {isAdmin && (
                <button
                  onClick={() => setSelectedReport(report.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">{tx('Manage', 'प्रबंधित करें')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto p-6 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-xl">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{tx('Anonymous Citizen Reports', 'गुमनाम नागरिक रिपोर्ट')}</h1>
            <p className="text-slate-400 text-sm">{tx('Report issues anonymously • AI-powered anonymization • Escalation timeline', 'समस्याएं गुमनाम रूप से रिपोर्ट करें • एआई आधारित अनामीकरण • एस्केलेशन टाइमलाइन')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700 pb-4">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === 'browse' 
              ? 'bg-cyan-500/20 text-cyan-400' 
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Eye className="w-4 h-4" />
          {tx('Browse Reports', 'रिपोर्ट देखें')}
        </button>
        {!isAdmin && (
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'submit' 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            {tx('Submit Report', 'रिपोर्ट जमा करें')}
          </button>
        )}
        <button
          onClick={() => setActiveTab('track')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === 'track' 
              ? 'bg-cyan-500/20 text-cyan-400' 
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Search className="w-4 h-4" />
          {tx('Track My Report', 'मेरी रिपोर्ट ट्रैक करें')}
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'admin' 
                ? 'bg-cyan-500/20 text-cyan-400' 
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            {tx('Admin Panel', 'एडमिन पैनल')}
          </button>
        )}
      </div>

      {/* Content */}
      {activeTab === 'browse' && (
        <>
          {/* Stats */}
          {renderStatsCards()}

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                  <option value="">{tx('All Status', 'सभी स्थिति')}</option>
                  <option value="pending">{tx('Pending', 'लंबित')}</option>
                  <option value="acknowledged">{tx('Acknowledged', 'स्वीकृत')}</option>
                  <option value="assigned">{tx('Assigned', 'आवंटित')}</option>
                  <option value="in_progress">{tx('In Progress', 'प्रगति में')}</option>
                  <option value="resolved">{tx('Resolved', 'समाधान हुआ')}</option>
                  <option value="closed">{tx('Closed', 'बंद')}</option>
              </select>
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">{tx('All Categories', 'सभी श्रेणियां')}</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label[lang]}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="createdAt">{tx('Newest First', 'नवीनतम पहले')}</option>
              <option value="priority">{tx('By Priority', 'प्राथमिकता के अनुसार')}</option>
              <option value="escalation">{tx('By Escalation Level', 'एस्केलेशन स्तर के अनुसार')}</option>
              <option value="credibility">{tx('By Credibility', 'विश्वसनीयता के अनुसार')}</option>
            </select>
          </div>

          {/* Reports Grid */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
              {error}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{tx('No reports found', 'कोई रिपोर्ट नहीं मिली')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map(renderReportCard)}
            </div>
          )}
        </>
      )}

      {activeTab === 'submit' && <AnonymousReportForm />}
      {activeTab === 'track' && <AnonymousReportTracker />}
      {activeTab === 'admin' && isAdmin && (
        <AnonymousReportAdminPanel 
          selectedReportId={selectedReport} 
          onClose={() => setSelectedReport(null)} 
        />
      )}
    </div>
  );
}
