import { useState, useEffect } from 'react';
import {
  Clock,
  ArrowUpRight,
  User,
  Eye,
  Edit,
  ThumbsUp,
  ThumbsDown,
  Shield,
  MapPin,
  Filter,
  X,
  Check,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useAnonymousReports } from '../../hooks/useAnonymousReports';
import { API_URL } from '../../config/api';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  selectedReportId: string | null;
  onClose?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: { en: 'Pending', hi: 'लंबित' }, color: 'bg-yellow-500' },
  { value: 'acknowledged', label: { en: 'Acknowledged', hi: 'स्वीकृत' }, color: 'bg-blue-500' },
  { value: 'assigned', label: { en: 'Assigned', hi: 'आवंटित' }, color: 'bg-purple-500' },
  { value: 'in_progress', label: { en: 'In Progress', hi: 'प्रगति में' }, color: 'bg-cyan-500' },
  { value: 'resolved', label: { en: 'Resolved', hi: 'समाधान हुआ' }, color: 'bg-green-500' },
  { value: 'closed', label: { en: 'Closed', hi: 'बंद' }, color: 'bg-slate-500' },
  { value: 'rejected', label: { en: 'Rejected', hi: 'अस्वीकृत' }, color: 'bg-red-500' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: { en: 'Low', hi: 'निम्न' }, color: 'bg-slate-500' },
  { value: 'medium', label: { en: 'Medium', hi: 'मध्यम' }, color: 'bg-yellow-500' },
  { value: 'high', label: { en: 'High', hi: 'उच्च' }, color: 'bg-orange-500' },
  { value: 'critical', label: { en: 'Critical', hi: 'गंभीर' }, color: 'bg-red-500' }
];

const FIELD_WORKERS = [
  { id: 'fw-001', name: 'Ramesh Kumar', area: 'North Zone' },
  { id: 'fw-002', name: 'Suresh Patil', area: 'South Zone' },
  { id: 'fw-003', name: 'Anil Singh', area: 'East Zone' },
  { id: 'fw-004', name: 'Vijay Sharma', area: 'West Zone' }
];

export default function AnonymousReportAdminPanel({ selectedReportId }: Props) {
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const { reports, stats, fetchReports, updateStatus, assignWorker } = useAnonymousReports();
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');

  useEffect(() => {
    if (selectedReportId) {
      fetchReportDetails(selectedReportId);
    }
  }, [selectedReportId]);

  const fetchReportDetails = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/anonymous-reports/${id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedReport(data.report);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedReport || !selectedStatus) return;

    const result = await updateStatus(
      selectedReport.id,
      selectedStatus,
      statusMessage || tx(`Status updated to ${selectedStatus}`, `स्थिति ${selectedStatus} में अपडेट की गई`),
      'Admin'
    );

    if (result.success) {
      setShowStatusUpdate(false);
      setStatusMessage('');
      setSelectedStatus('');
      fetchReportDetails(selectedReport.id);
      fetchReports();
    }
  };

  const handleAssignWorker = async () => {
    if (!selectedReport || !selectedWorker) return;

    const worker = FIELD_WORKERS.find(w => w.id === selectedWorker);
    if (!worker) return;

    const result = await assignWorker(
      selectedReport.id,
      worker.id,
      worker.name,
      'Admin'
    );

    if (result.success) {
      setShowAssign(false);
      setSelectedWorker('');
      fetchReportDetails(selectedReport.id);
      fetchReports();
    }
  };

  const filteredReports = reports.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterPriority && r.priority !== filterPriority) return false;
    return true;
  });

  const renderReportsList = () => (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-slate-700 flex items-center gap-4">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-700 border-none rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">{tx('All Status', 'सभी स्थिति')}</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-slate-700 border-none rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">{tx('All Priority', 'सभी प्राथमिकता')}</option>
          {PRIORITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
          ))}
        </select>
      </div>

      {/* Reports Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('ID', 'आईडी')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Title', 'शीर्षक')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Category', 'श्रेणी')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Status', 'स्थिति')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Priority', 'प्राथमिकता')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Escalation', 'एस्केलेशन')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Credibility', 'विश्वसनीयता')}</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">{tx('Actions', 'क्रियाएं')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(report => (
              <tr 
                key={report.id} 
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-slate-300 font-mono">
                  {report.id.substring(0, 12)}...
                </td>
                <td className="px-4 py-3 text-sm text-white max-w-xs truncate">
                  {report.title}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300 capitalize">
                  {report.category}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    STATUS_OPTIONS.find(s => s.value === report.status)?.color
                  } bg-opacity-20 text-white`}>
                    {report.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    PRIORITY_OPTIONS.find(p => p.value === report.priority)?.color
                  } bg-opacity-20 text-white`}>
                    {report.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  {tx('Level', 'स्तर')} {report.currentEscalationLevel}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm ${
                    report.credibilityScore >= 70 ? 'text-green-400' :
                    report.credibilityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {report.credibilityScore}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => fetchReportDetails(report.id)}
                    className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReportDetail = () => {
    if (!selectedReport) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-cyan-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Report Details</h2>
                <p className="text-sm text-slate-400 font-mono">{selectedReport.id}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Status & Priority */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-1">{tx('Status', 'स्थिति')}</div>
                    <div className="text-white capitalize">{selectedReport.status}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-1">{tx('Priority', 'प्राथमिकता')}</div>
                    <div className="text-white capitalize">{selectedReport.priority}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-1">{tx('Escalation Level', 'एस्केलेशन स्तर')}</div>
                    <div className="text-white">{tx('Level', 'स्तर')} {selectedReport.currentEscalationLevel}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <div className="text-sm text-slate-400 mb-1">{tx('Credibility', 'विश्वसनीयता')}</div>
                    <div className={`${
                      selectedReport.votes?.credibilityScore >= 70 ? 'text-green-400' :
                      selectedReport.votes?.credibilityScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {selectedReport.votes?.credibilityScore || 50}%
                    </div>
                  </div>
                </div>

                {/* Anonymized Content */}
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">{tx('Anonymized Report', 'अनामीकृत रिपोर्ट')}</h3>
                  <h4 className="text-lg font-bold text-white mb-2">{selectedReport.anonymizedContent?.title}</h4>
                  <p className="text-slate-300 mb-4">{selectedReport.anonymizedContent?.description}</p>
                  
                  <div className="bg-cyan-500/10 rounded-lg p-3 mb-4">
                    <div className="text-xs text-slate-400 mb-1">{tx('AI Extracted Intent', 'एआई द्वारा निकाला गया आशय')}</div>
                    <div className="text-cyan-400">{selectedReport.anonymizedContent?.extractedIntent}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedReport.anonymizedContent?.keywords?.map((keyword: string, i: number) => (
                      <span key={i} className="px-2 py-1 bg-slate-600 rounded text-xs text-slate-300">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Processing Info */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-purple-400 mb-2">{tx('AI Processing', 'एआई प्रोसेसिंग')}</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">{tx('Model: ', 'मॉडल: ')}</span>
                      <span className="text-white">{selectedReport.aiProcessing?.model || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{tx('Confidence: ', 'विश्वास स्तर: ')}</span>
                      <span className="text-white">{((selectedReport.aiProcessing?.confidence || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">{tx('PII Removed: ', 'हटाई गई व्यक्तिगत जानकारी: ')}</span>
                      <span className="text-white">{selectedReport.aiProcessing?.piiRemoved?.join(', ') || tx('None', 'कोई नहीं')}</span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                {selectedReport.location && (
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {tx('Location', 'स्थान')}
                    </h3>
                    <div className="text-white">
                      {selectedReport.location.area && <span>{selectedReport.location.area}, </span>}
                      {selectedReport.location.district}
                    </div>
                  </div>
                )}

                {/* Assignment */}
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" /> {tx('Assignment', 'आवंटन')}
                  </h3>
                  {selectedReport.assignedTo?.workerName ? (
                    <div className="text-white">
                      {tx('Assigned to: ', 'आवंटित: ')}{selectedReport.assignedTo.workerName}
                      <div className="text-sm text-slate-400">
                        {tx('Since', 'से')} {format(new Date(selectedReport.assignedTo.assignedAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400">{tx('Not assigned', 'आवंटित नहीं')}</div>
                  )}
                </div>

                {/* Escalation History */}
                {selectedReport.escalationHistory?.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4" /> {tx('Escalation History', 'एस्केलेशन इतिहास')}
                    </h3>
                    <div className="space-y-2">
                      {selectedReport.escalationHistory.map((esc: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-white">{esc.authorityName}</span>
                          <span className="text-slate-400">{esc.reason}</span>
                          <span className="text-slate-500 font-mono text-xs">ID: {esc.escalationId?.substring(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                    {selectedReport.escalationIntegrity && (
                      <div className={`mt-3 text-sm ${selectedReport.escalationIntegrity.valid ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedReport.escalationIntegrity.message}
                      </div>
                    )}
                  </div>
                )}

                {/* Status Updates */}
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {tx('Status Timeline', 'स्थिति समयरेखा')}
                  </h3>
                  <div className="space-y-3">
                    {selectedReport.statusUpdates?.map((update: any, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2"></div>
                        <div className="flex-1">
                          <div className="text-sm text-white">{update.message}</div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(update.timestamp), 'MMM d, yyyy h:mm a')} {tx('by', 'द्वारा')} {update.updatedBy}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Votes */}
                <div className="bg-slate-700/50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-2">{tx('Community Votes', 'समुदाय वोट')}</h3>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="w-5 h-5 text-green-400" />
                      <span className="text-white">{selectedReport.votes?.upvotes || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="w-5 h-5 text-red-400" />
                      <span className="text-white">{selectedReport.votes?.downvotes || 0}</span>
                    </div>
                    <div className="text-slate-400">
                      {tx('Total:', 'कुल:')} {selectedReport.votes?.totalVotes || 0} {tx('votes', 'वोट')}
                    </div>
                  </div>
                </div>

                {/* Photos */}
                {selectedReport.photos?.length > 0 && (
                  <div className="bg-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">{tx('Photos', 'फोटो')}</h3>
                    <div className="flex gap-3">
                      {selectedReport.photos.map((photo: string, i: number) => (
                        <img
                          key={i}
                          src={`${API_URL}${photo}`}
                          alt={`Report photo ${i + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border border-slate-600"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution Feedback */}
                {selectedReport.resolutionFeedback && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-green-400 mb-2">{tx('Citizen Feedback', 'नागरिक प्रतिक्रिया')}</h3>
                    <div className="flex items-center gap-1 text-white">
                      {selectedReport.resolutionFeedback.isResolved ? <Check size={14} /> : <X size={14} />}
                      {selectedReport.resolutionFeedback.isResolved ? tx('Confirmed resolved', 'समाधान की पुष्टि') : tx('Not resolved', 'समाधान नहीं हुआ')}
                      <span className="ml-3">{tx('Rating:', 'रेटिंग:')} {selectedReport.resolutionFeedback.satisfactionRating}/5</span>
                    </div>
                    {selectedReport.resolutionFeedback.feedback && (
                      <div className="text-sm text-slate-300 mt-2">
                        "{selectedReport.resolutionFeedback.feedback}"
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-slate-700 flex gap-3">
            <button
              onClick={() => setShowStatusUpdate(true)}
              className="px-4 py-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              {tx('Update Status', 'स्थिति अपडेट करें')}
            </button>
            <button
              onClick={() => setShowAssign(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              {tx('Assign Worker', 'कर्मी आवंटित करें')}
            </button>
          </div>

          {/* Status Update Modal */}
          {showStatusUpdate && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-white mb-4">{tx('Update Status', 'स्थिति अपडेट करें')}</h3>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-slate-700 border-none rounded-xl px-4 py-3 text-white mb-4"
                >
                  <option value="">{tx('Select Status', 'स्थिति चुनें')}</option>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label[lang]}</option>
                  ))}
                </select>
                <textarea
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  placeholder={tx('Add a message (optional)', 'संदेश जोड़ें (वैकल्पिक)')}
                  className="w-full bg-slate-700 border-none rounded-xl px-4 py-3 text-white resize-none mb-4"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleStatusUpdate}
                    disabled={!selectedStatus}
                    className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors disabled:opacity-50"
                  >
                    {tx('Update', 'अपडेट')}
                  </button>
                  <button
                    onClick={() => setShowStatusUpdate(false)}
                    className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                  >
                    {tx('Cancel', 'रद्द करें')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Assign Worker Modal */}
          {showAssign && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-white mb-4">{tx('Assign Field Worker', 'फील्ड कर्मी आवंटित करें')}</h3>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className="w-full bg-slate-700 border-none rounded-xl px-4 py-3 text-white mb-4"
                >
                  <option value="">{tx('Select Worker', 'कर्मी चुनें')}</option>
                  {FIELD_WORKERS.map(worker => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name} - {worker.area}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button
                    onClick={handleAssignWorker}
                    disabled={!selectedWorker}
                    className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50"
                  >
                    {tx('Assign', 'आवंटित करें')}
                  </button>
                  <button
                    onClick={() => setShowAssign(false)}
                    className="px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                  >
                    {tx('Cancel', 'रद्द करें')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="text-3xl font-bold text-white">{stats?.total || 0}</div>
          <div className="text-sm text-slate-400">{tx('Total Reports', 'कुल रिपोर्ट')}</div>
        </div>
        <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
          <div className="text-3xl font-bold text-yellow-400">{stats?.pending || 0}</div>
          <div className="text-sm text-slate-400">{tx('Pending Review', 'समीक्षा लंबित')}</div>
        </div>
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
          <div className="text-3xl font-bold text-red-400">{stats?.escalated || 0}</div>
          <div className="text-sm text-slate-400">{tx('Escalated', 'एस्केलेटेड')}</div>
        </div>
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
          <div className="text-3xl font-bold text-green-400">{stats?.resolved || 0}</div>
          <div className="text-sm text-slate-400">{tx('Resolved', 'समाधान हुआ')}</div>
        </div>
      </div>

      {/* Reports List */}
      {renderReportsList()}

      {/* Report Detail Modal */}
      {selectedReport && renderReportDetail()}
    </div>
  );
}
