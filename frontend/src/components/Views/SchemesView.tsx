import { useState, useEffect, useId, Fragment, type ReactNode } from 'react';
import { 
  AlertTriangle, 
  Check, 
  Search,
  Star,
  X,
  Plus,
  Upload,
  Loader,
  ChevronRight,
  Sparkles,
  Brush,
  Droplet,
  Home,
  HardHat,
  Zap,
  ClipboardList,
  type LucideIcon
} from 'lucide-react';
import { useAppStore, type GovernmentScheme } from '../../store/appStore';
import { API_URL } from '../../config/api';
import RagQueryModal from '../Rag/RagQueryModal';
import FeedbackView, { CitizenReviews } from './FeedbackView';
import type { Citation } from '../../hooks/useRagQuery';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { SPRING_SNAPPY } from '@/lib/motion';
import { BAR_COLOR, ProgressBar, STATUS_META, StatusLabel, type SchemeStatus } from '../Schemes/schemeUi';
import { SchemeFeedbackModal, canRateScheme } from '../Schemes/SchemeFeedbackModal';

const lakh = (rupees: number, digits = 1) => `${rupees < 0 ? '−' : ''}₹${(Math.abs(rupees) / 100000).toFixed(digits)}L`;
const crore = (rupees: number) => `₹${(rupees / 10000000).toFixed(1)}Cr`;
const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const monthYear = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const fullDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const fieldClass =
  'h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-400 focus:outline-none';

export default function SchemesView() {
  // Get schemes from store instead of mock data
  const schemes = useAppStore((state) => state.schemes);
  const fetchSchemes = useAppStore((state) => state.fetchSchemes);
  const userRole = useAppStore((state) => state.userRole);
  const username = useAppStore((state) => state.username);
  
  const [selectedScheme, setSelectedScheme] = useState<GovernmentScheme | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddSchemeModal, setShowAddSchemeModal] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'overview' | 'phases' | 'reports' | 'reviews'>('overview');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRagModal, setShowRagModal] = useState(false);

  const [feedbackScheme, setFeedbackScheme] = useState<GovernmentScheme | null>(null);
  const [viewFeedbackScheme, setViewFeedbackScheme] = useState<GovernmentScheme | null>(null);
  const focusedSchemeId = useAppStore((state) => state.focusedSchemeId);
  const setFocusedSchemeId = useAppStore((state) => state.setFocusedSchemeId);

  // Fetch schemes from database on component mount
  useEffect(() => {
    fetchSchemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openFeedbackModal = (scheme: GovernmentScheme, e: React.MouseEvent) => {
    e.stopPropagation();
    setFeedbackScheme(scheme);
  };

  // Calculate summary statistics
  const totalSchemes = schemes.length;
  const onTrackSchemes = schemes.filter(s => s.status === 'on-track' || s.status === 'completed').length;
  const delayedSchemes = schemes.filter(s => s.status === 'delayed').length;
  const totalBudget = schemes.reduce((sum, s) => sum + s.totalBudget, 0);
  const budgetUtilized = schemes.reduce((sum, s) => sum + s.budgetUtilized, 0);
  const avgProgress = schemes.length > 0 ? Math.round(schemes.reduce((sum, s) => sum + s.overallProgress, 0) / schemes.length) : 0;
  const totalFeedback = schemes.reduce((sum, s) => sum + s.feedbackCount, 0);

  // Filter schemes
  const filteredSchemes = schemes.filter(scheme => {
    const matchesCategory = filterCategory === 'all' || scheme.category.toLowerCase() === filterCategory.toLowerCase();
    const matchesStatus = filterStatus === 'all' || scheme.status === filterStatus;
    const matchesSearch = scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (scheme.area || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Category mapping for icons
  const categoryIcons: Record<string, LucideIcon> = {
    'Sanitation': Brush,
    'Water Supply': Droplet,
    'Housing': Home,
    'Employment': HardHat,
    'Power': Zap
  };

  const renderCategoryIcon = (category: string, size: number) => {
    const Icon = categoryIcons[category] ?? ClipboardList;
    return <Icon size={size} className="shrink-0" />;
  };

  const openIssues = schemes.reduce((sum, s) => sum + s.discrepancies.length, 0);
  const schemesWithIssues = schemes.filter((s) => s.discrepancies.length > 0).length;
  const filtersActive = filterCategory !== 'all' || filterStatus !== 'all' || searchQuery !== '';
  const clearFilters = () => {
    setFilterCategory('all');
    setFilterStatus('all');
    setSearchQuery('');
  };
  const openDetails = (scheme: GovernmentScheme) => {
    setSelectedScheme(scheme);
    setModalInitialTab('overview');
    setShowDetailsModal(true);
  };

  useEffect(() => {
    if (!focusedSchemeId) return;
    const scheme = schemes.find((s) => s.id === focusedSchemeId);
    if (scheme) {
      openDetails(scheme);
      setFocusedSchemeId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedSchemeId, schemes]);

  const stats = [
    { label: 'Schemes', value: totalSchemes, hint: `${onTrackSchemes} on track · ${delayedSchemes} delayed` },
    { label: 'Budget used', value: `${percentOf(budgetUtilized, totalBudget)}%`, hint: `${crore(budgetUtilized)} of ${crore(totalBudget)}` },
    { label: 'Average progress', value: `${avgProgress}%`, hint: `${totalFeedback} citizen reviews` },
    { label: 'Open issues', value: openIssues, hint: `Across ${schemesWithIssues} ${schemesWithIssues === 1 ? 'scheme' : 'schemes'}` },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 md:text-[28px]">Schemes</h1>
            <p className="mt-1 text-sm text-zinc-500">Progress, spending and citizen feedback for each government scheme.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRagModal(true)} className="gap-2">
              <Sparkles size={15} />
              Ask
            </Button>
            {userRole === 'admin' && (
              <Button size="sm" onClick={() => setShowAddSchemeModal(true)} className="gap-2">
                <Plus size={15} />
                New scheme
              </Button>
            )}
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white px-4 py-3.5 md:px-5">
              <dt className="text-xs text-zinc-500">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{stat.value}</dd>
              <dd className="mt-0.5 text-xs text-zinc-500">{stat.hint}</dd>
            </div>
          ))}
        </dl>

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white" aria-label="Schemes">
          <div className="flex flex-col gap-2 border-b border-zinc-200 p-3 md:flex-row md:items-center">
            <div className="relative md:w-72">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                aria-label="Search schemes"
                placeholder="Search by name or area"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${fieldClass} w-full pl-9`}
              />
            </div>
            <div className="flex gap-2">
              <select
                aria-label="Category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`${fieldClass} flex-1 md:flex-none`}
              >
                <option value="all">All categories</option>
                <option value="sanitation">Sanitation</option>
                <option value="water supply">Water supply</option>
                <option value="housing">Housing</option>
                <option value="employment">Employment</option>
                <option value="power">Power</option>
              </select>
              <select
                aria-label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`${fieldClass} flex-1 md:flex-none`}
              >
                <option value="all">All statuses</option>
                <option value="on-track">On track</option>
                <option value="delayed">Delayed</option>
                <option value="discrepant">Discrepant</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-zinc-600">
                Clear
              </Button>
            )}
            <span className="text-xs tabular-nums text-zinc-500 md:ml-auto">
              {filteredSchemes.length} of {totalSchemes}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th scope="col" className="px-4 py-2.5 font-medium">Scheme</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Progress</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Spent</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Deadline</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Rating</th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredSchemes.map((scheme) => {
                  const spentPct = percentOf(scheme.budgetUtilized, scheme.totalBudget);
                  const issues = scheme.discrepancies.length;
                  return (
                    <tr
                      key={scheme.id}
                      tabIndex={0}
                      onClick={() => openDetails(scheme)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetails(scheme);
                        }
                      }}
                      className="group cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                            {renderCategoryIcon(scheme.category, 15)}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate font-medium text-zinc-900" title={scheme.name}>
                              {scheme.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-zinc-500">
                              {scheme.category} · {scheme.area} · <span className="font-mono">{scheme.id}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusLabel status={scheme.status} />
                        {issues > 0 && (
                          <p className="mt-0.5 text-xs text-red-600">
                            {issues} {issues === 1 ? 'issue' : 'issues'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar value={scheme.overallProgress} status={scheme.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <p className={spentPct > 100 ? 'font-medium text-red-600' : 'text-zinc-900'}>{lakh(scheme.budgetUtilized)}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          of {lakh(scheme.totalBudget)} · {spentPct}%
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{monthYear(scheme.endDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {scheme.feedbackCount > 0 ? (
                          <span className="inline-flex items-center gap-1 tabular-nums text-zinc-700">
                            <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden />
                            {scheme.citizenRating.toFixed(1)}
                            <span className="text-xs text-zinc-400">({scheme.feedbackCount})</span>
                          </span>
                        ) : (
                          <span className="text-zinc-400">No reviews</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {userRole === 'user' && canRateScheme(scheme, username) && (
                            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={(e) => openFeedbackModal(scheme, e)}>
                              Rate
                            </Button>
                          )}
                          {userRole === 'admin' && scheme.feedbackCount > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-zinc-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewFeedbackScheme(scheme);
                              }}
                            >
                              Feedback
                            </Button>
                          )}
                          <ChevronRight size={16} className="text-zinc-300 transition-colors group-hover:text-zinc-500" aria-hidden />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSchemes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                      {totalSchemes === 0 ? 'No schemes yet.' : 'No schemes match these filters.'}
                      {filtersActive && (
                        <button onClick={clearFilters} className="ml-2 font-medium text-zinc-900 hover:underline">
                          Clear filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Feedback Modal */}
      {feedbackScheme && <SchemeFeedbackModal scheme={feedbackScheme} onClose={() => setFeedbackScheme(null)} />}

      {/* Scheme Details Modal */}
      {showDetailsModal && selectedScheme && (
        <SchemeDetailsModal 
          scheme={selectedScheme}
          initialTab={modalInitialTab}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedScheme(null);
            setModalInitialTab('overview');
          }}
        />
      )}

      {/* Add Scheme Modal */}
      {showAddSchemeModal && (
        <AddSchemeModal 
          onClose={() => setShowAddSchemeModal(false)}
          onSubmit={async (newScheme) => {
            console.log('New scheme added:', newScheme);
            setShowAddSchemeModal(false);
            // Refresh schemes after adding
            await fetchSchemes();
          }}
        />
      )}

      {/* RAG Query Modal */}
      {showRagModal && (
        <RagQueryModal
          isOpen={showRagModal}
          onClose={() => setShowRagModal(false)}
          onHighlightCitation={(citation: Citation) => {
            console.log('Highlight citation on map:', citation);
            // TODO: Implement map highlighting when map instance is available
            // For now, just show an alert
            alert(`Citation Location:\n\nType: ${citation.type}\nSnippet: ${citation.snippet}\nCoordinates: ${citation.geo?.lat}, ${citation.geo?.lon}`);
          }}
        />
      )}

      {/* Feedback View Modal (Admin Only) */}
      {viewFeedbackScheme && (
        <FeedbackView
          scheme={viewFeedbackScheme}
          onClose={() => setViewFeedbackScheme(null)}
        />
      )}
    </div>
  );
}

// Scheme Details Modal Component
function SchemeDetailsModal({ 
  scheme, 
  onClose, 
  initialTab = 'overview' 
}: { 
  scheme: GovernmentScheme; 
  onClose: () => void; 
  initialTab?: 'overview' | 'phases' | 'reports' | 'reviews';
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'phases' | 'reports' | 'reviews'>(initialTab);
  const userRole = useAppStore((state) => state.userRole);
  const deleteScheme = useAppStore((state) => state.deleteScheme);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'phases', label: 'Phases' },
    { id: 'reports', label: 'Vendor reports' },
    ...(userRole === 'admin' ? [{ id: 'reviews' as const, label: 'Citizen reviews' }] : []),
  ];
  const spentPct = percentOf(scheme.budgetUtilized, scheme.totalBudget);

  const handleDelete = async () => {
    if (!window.confirm('Delete this scheme? This cannot be undone.')) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteScheme(scheme.id);
      setIsDeleting(false);
      onClose();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete scheme');
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      size="lg"
      title={scheme.name}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusLabel status={scheme.status} />
          <span className="text-zinc-300">·</span>
          <span>{scheme.category}</span>
          <span className="text-zinc-300">·</span>
          <span>
            {scheme.area}, {scheme.district}
          </span>
          <span className="text-zinc-300">·</span>
          <span className="font-mono text-xs">{scheme.id}</span>
        </span>
      }
      onClose={onClose}
      footer={
        userRole === 'admin' ? (
          <div className="flex items-center justify-between gap-3">
            <p role={deleteError ? 'alert' : undefined} className="text-sm text-red-600">
              {deleteError}
            </p>
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-red-600 hover:bg-red-50 hover:text-red-700">
              {isDeleting ? 'Deleting' : 'Delete scheme'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-px border-b border-zinc-200 bg-zinc-200 md:grid-cols-4">
        <div className="bg-white px-5 py-3 md:px-6">
          <dt className="text-xs text-zinc-500">Progress</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{scheme.overallProgress}%</dd>
        </div>
        <div className="bg-white px-5 py-3 md:px-6">
          <dt className="text-xs text-zinc-500">Spent</dt>
          <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${spentPct > 100 ? 'text-red-600' : 'text-zinc-900'}`}>
            {lakh(scheme.budgetUtilized)}
            <span className="ml-1 text-xs font-normal text-zinc-500">of {lakh(scheme.totalBudget)}</span>
          </dd>
        </div>
        <div className="bg-white px-5 py-3 md:px-6">
          <dt className="text-xs text-zinc-500">Rating</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-lg font-semibold tabular-nums text-zinc-900">
            {scheme.feedbackCount > 0 ? (
              <>
                <Star size={15} className="fill-amber-400 text-amber-400" aria-hidden />
                {scheme.citizenRating.toFixed(1)}
                <span className="text-xs font-normal text-zinc-500">({scheme.feedbackCount})</span>
              </>
            ) : (
              <span className="text-sm font-normal text-zinc-400">No reviews</span>
            )}
          </dd>
        </div>
        <div className="bg-white px-5 py-3 md:px-6">
          <dt className="text-xs text-zinc-500">Deadline</dt>
          <dd className="mt-0.5 text-lg font-semibold text-zinc-900">{monthYear(scheme.endDate)}</dd>
        </div>
      </dl>

      <nav className="sticky top-0 z-10 flex gap-5 overflow-x-auto border-b border-zinc-200 bg-white px-5 md:px-6" role="tablist" aria-label="Scheme sections">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`relative whitespace-nowrap py-3 text-sm transition-colors ${
                active ? 'font-medium text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {tab.label}
              {active && (
                <motion.span
                  layoutId="scheme-tab-indicator"
                  transition={SPRING_SNAPPY}
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-zinc-900"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-5 md:p-6" role="tabpanel">
          {activeTab === 'overview' && (
            <div className="space-y-7">
              {scheme.discrepancies.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Open issues <span className="font-normal text-zinc-500">({scheme.discrepancies.length})</span>
                  </h3>
                  <ul className="mt-2 divide-y divide-red-100 overflow-hidden rounded-xl border border-red-200 bg-red-50/50">
                    {scheme.discrepancies.map((disc, idx) => (
                      <li key={idx} className="flex gap-3 px-4 py-3">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-relaxed text-zinc-900">{disc.description}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {disc.reportedBy || 'Citizens (anonymised)'} · {fullDate(disc.reportedDate || disc.date || new Date().toISOString())}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold text-zinc-900">About</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{scheme.description}</p>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-zinc-900">Timeline</h3>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500">Start</p>
                    <p className="text-zinc-900">{fullDate(scheme.startDate)}</p>
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${BAR_COLOR[scheme.status]}`} style={{ width: `${Math.min(100, scheme.overallProgress)}%` }} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">End</p>
                    <p className="text-zinc-900">{fullDate(scheme.endDate)}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-zinc-900">Budget</h3>
                <dl className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 text-sm">
                  {[
                    ['Allocated', lakh(scheme.totalBudget, 2)],
                    ['Spent', lakh(scheme.budgetUtilized, 2)],
                    ['Remaining', lakh(scheme.totalBudget - scheme.budgetUtilized, 2)],
                    ['Utilisation', `${spentPct}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-4 py-2.5">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd
                        className={`tabular-nums ${
                          (label === 'Remaining' && scheme.totalBudget < scheme.budgetUtilized) || (label === 'Utilisation' && spentPct > 100)
                            ? 'font-medium text-red-600'
                            : 'text-zinc-900'
                        }`}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}

          {activeTab === 'phases' &&
            (scheme.phases.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No phases recorded for this scheme.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto md:-mx-6">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                      <th scope="col" className="px-5 py-2 font-medium md:px-6">Phase</th>
                      <th scope="col" className="px-3 py-2 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2 font-medium">Progress</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Budget</th>
                      <th scope="col" className="px-5 py-2 text-right font-medium md:px-6">Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {scheme.phases.map((phase, idx) => (
                      <tr key={phase.id}>
                        <td className="px-5 py-3 md:px-6">
                          <p className="font-medium text-zinc-900">
                            <span className="mr-1.5 tabular-nums text-zinc-400">{idx + 1}</span>
                            {phase.name}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {fullDate(phase.startDate)} – {fullDate(phase.endDate)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <StatusLabel status={phase.status} />
                        </td>
                        <td className="px-3 py-3">
                          <ProgressBar value={phase.progress} status={phase.status} className="w-20" />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-700">{lakh(phase.budget)}</td>
                        <td className={`px-5 py-3 text-right tabular-nums md:px-6 ${phase.spent > phase.budget ? 'font-medium text-red-600' : 'text-zinc-700'}`}>
                          {lakh(phase.spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {activeTab === 'reports' && <VendorReportsTab scheme={scheme} />}

          {activeTab === 'reviews' && <CitizenReviews scheme={scheme} />}
      </div>
    </Modal>
  );
}

// Vendor Reports Tab Component
function VendorReportsTab({ scheme }: { scheme: GovernmentScheme }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  const [openReportId, setOpenReportId] = useState<string | number | null>(scheme.vendorReports?.[0]?.id ?? null);
  const userRole = useAppStore((state) => state.userRole);
  const fetchSchemes = useAppStore((state) => state.fetchSchemes);

  const handleVendorReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadNotice('');

    try {
      console.log('Uploading vendor report for analysis:', file.name);
      
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_URL}/api/schemes/${scheme.id}/vendor-report`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        console.log('Vendor report analyzed:', result.report);
        console.log('Scheme metrics updated:', result.updatedScheme);
        
        // Refresh the schemes data to get updated information
        await fetchSchemes();
        
        const updatedScheme = result.updatedScheme;
        setUploadNotice(
          `Report analysed. Progress is now ${updatedScheme.overallProgress}%, ${lakh(updatedScheme.budgetUtilized, 2)} spent, status ${STATUS_META[updatedScheme.status as SchemeStatus]?.label.toLowerCase() ?? updatedScheme.status}.`,
        );
      } else {
        throw new Error(result.error || 'Failed to analyze vendor report');
      }
    } catch (err: any) {
      console.error('Vendor report upload error:', err);
      setUploadError(err.message || 'Failed to upload vendor report');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const reports = scheme.vendorReports ?? [];

  return (
    <div className="space-y-6">
      {userRole === 'admin' && (
        <div className="space-y-2">
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">Upload a vendor report</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                PDF only. It is compared with the scheme plan for discrepancies, overdue work and budget variance.
              </p>
            </div>
            <label
              className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-zinc-300 ${
                isUploading ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleVendorReportUpload}
                className="sr-only"
                disabled={isUploading}
              />
              {isUploading ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
              {isUploading ? 'Analysing…' : 'Upload PDF'}
            </label>
          </div>
          {uploadError && (
            <p role="alert" className="text-sm text-red-600">
              {uploadError}
            </p>
          )}
          {uploadNotice && (
            <p role="status" className="text-sm text-zinc-600">
              {uploadNotice}
            </p>
          )}
        </div>
      )}

      {reports.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No vendor reports yet.{userRole === 'admin' && ' Upload a PDF to get a compliance analysis.'}
        </p>
      ) : (
        <div className="-mx-5 overflow-x-auto md:-mx-6">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                <th scope="col" className="px-5 py-2 font-medium md:px-6">Vendor</th>
                <th scope="col" className="px-3 py-2 font-medium">Submitted</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Claimed</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Compliance</th>
                <th scope="col" className="w-10 px-5 py-2 md:px-6">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reports.map((report: any) => {
                const analysis = report.complianceAnalysis;
                const open = openReportId === report.id;
                const verification = VERIFICATION_META[report.verificationStatus] ?? VERIFICATION_META.pending;
                const risk = analysis?.riskLevel as string | undefined;
                const toggle = () => setOpenReportId(open ? null : report.id);
                return (
                  <Fragment key={report.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={toggle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle();
                        }
                      }}
                      data-no-press
                      className={`cursor-pointer transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none ${open ? 'bg-zinc-50' : ''}`}
                    >
                      <td className="px-5 py-3 md:px-6">
                        <p className="font-medium text-zinc-900">{report.vendorName}</p>
                        <p className="mt-0.5 max-w-[240px] truncate text-xs text-zinc-500">
                          Phase {report.phase}
                          {report.pdfFileName && ` · ${report.pdfFileName}`}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-zinc-700">{dateOrDash(report.submittedDate)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-700">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${verification.dot}`} aria-hidden />
                          {verification.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-zinc-700">
                        {lakhOrDash(report.expenseClaimed ?? analysis?.budgetAnalysis?.claimedExpense)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p className={`tabular-nums ${complianceTone(analysis?.overallCompliance)}`}>
                          {percentOrDash(analysis?.overallCompliance)}
                        </p>
                        {risk && (
                          <p className={`mt-0.5 text-xs ${SEVERITY_TONE[risk] ?? 'text-zinc-500'}`}>
                            {risk.charAt(0).toUpperCase() + risk.slice(1)} risk
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-zinc-400 md:px-6">
                        <ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-5 md:px-6">
                          <ReportDetails report={report} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const VERIFICATION_META: Record<string, { label: string; dot: string }> = {
  approved: { label: 'Approved', dot: 'bg-brand-500' },
  verified: { label: 'Verified', dot: 'bg-brand-500' },
  'under-review': { label: 'Under review', dot: 'bg-amber-500' },
  rejected: { label: 'Rejected', dot: 'bg-red-500' },
  pending: { label: 'Pending', dot: 'bg-zinc-300' },
};

const SEVERITY_TONE: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-red-600',
  medium: 'text-amber-700',
  low: 'text-zinc-500',
};

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};
const percentOrDash = (value: unknown, digits = 0) => {
  const n = toNumber(value);
  return n === null ? '—' : `${n.toFixed(digits)}%`;
};
const lakhOrDash = (value: unknown) => {
  const n = toNumber(value);
  return n === null ? '—' : lakh(n, 2);
};
const dateOrDash = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? fullDate(value) : '—';
const complianceTone = (value: unknown) => {
  const n = toNumber(value);
  if (n === null) return 'text-zinc-400';
  if (n >= 80) return 'text-zinc-900';
  if (n >= 60) return 'text-amber-700';
  return 'font-medium text-red-600';
};

function ReportDetails({ report }: { report: any }) {
  const analysis = report.complianceAnalysis;

  if (!analysis?.aiProcessed) {
    return (
      <div className="space-y-4 text-sm">
        <section>
          <h4 className="font-semibold text-zinc-900">Work completed</h4>
          <p className="mt-1 leading-relaxed text-zinc-600">{report.workCompleted || '—'}</p>
        </section>
        <p className="text-xs text-zinc-500">This report has not been analysed against the scheme plan.</p>
      </div>
    );
  }

  const breakdown: Array<[string, unknown]> = [
    ['Budget', analysis.budgetCompliance],
    ['Timeline', analysis.timelineCompliance],
    ['Scope', analysis.scopeCompliance],
    ['Quality', analysis.qualityCompliance],
  ];
  const hasBreakdown = breakdown.some(([, value]) => toNumber(value) !== null);
  const discrepancies: any[] = analysis.discrepancies ?? [];
  const overdue: any[] = analysis.overdueWork ?? [];
  const matching: string[] = analysis.matchingItems ?? [];
  const recommendations: string[] = analysis.recommendations ?? [];
  const budget = analysis.budgetAnalysis;
  const overBudget =
    budget && (toNumber(budget.claimedExpense) ?? 0) > (toNumber(budget.plannedBudget) ?? Infinity);
  const expenses = report.expenseBreakdown ? Object.entries(report.expenseBreakdown) : [];

  return (
    <div className="space-y-6 text-sm">
      {hasBreakdown && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
          {breakdown.map(([label, value]) => (
            <div key={label} className="bg-white px-3 py-2.5">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className={`mt-0.5 text-base tabular-nums ${complianceTone(value)}`}>{percentOrDash(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {analysis.aiSummary && (
        <section>
          <h4 className="font-semibold text-zinc-900">Summary</h4>
          <p className="mt-1 leading-relaxed text-zinc-600">{analysis.aiSummary}</p>
          {report.analysisMethod && (
            <p className="mt-1.5 text-xs text-zinc-500">
              Analysed with {report.analysisMethod === 'pathway_python' ? 'Pathway' : 'the standard analyser'}
            </p>
          )}
        </section>
      )}

      {discrepancies.length > 0 && (
        <section>
          <h4 className="font-semibold text-zinc-900">
            Discrepancies <span className="font-normal text-zinc-500">({discrepancies.length})</span>
          </h4>
          <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {discrepancies.map((disc, idx) => (
              <li key={idx} className="px-4 py-3">
                <p className="text-xs">
                  <span className={`font-medium capitalize ${SEVERITY_TONE[disc.severity] ?? 'text-zinc-500'}`}>{disc.severity}</span>
                  {disc.category && <span className="text-zinc-500"> · {disc.category}</span>}
                </p>
                {disc.title && <p className="mt-1 font-medium text-zinc-900">{disc.title}</p>}
                <p className="mt-0.5 leading-relaxed text-zinc-600">{disc.description}</p>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <div className="flex gap-1.5">
                    <dt className="text-zinc-500">Planned</dt>
                    <dd className="text-zinc-900">{disc.plannedValue ?? '—'}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-zinc-500">Actual</dt>
                    <dd className="text-zinc-900">{disc.actualValue ?? '—'}</dd>
                  </div>
                  {disc.variance != null && disc.variance !== '' && (
                    <div className="flex gap-1.5">
                      <dt className="text-zinc-500">Variance</dt>
                      <dd className="tabular-nums text-zinc-900">
                        {typeof disc.variance === 'number'
                          ? `${disc.variance > 0 ? '+' : ''}${disc.variance.toLocaleString('en-IN')}`
                          : disc.variance}
                        {disc.variancePercentage != null && ` (${disc.variancePercentage}%)`}
                      </dd>
                    </div>
                  )}
                </dl>
                {disc.recommendation && (
                  <p className="mt-2 text-xs text-zinc-600">
                    <span className="text-zinc-500">Action: </span>
                    {disc.recommendation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {overdue.length > 0 && (
        <section>
          <h4 className="font-semibold text-zinc-900">
            Overdue work <span className="font-normal text-zinc-500">({overdue.length})</span>
          </h4>
          <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th scope="col" className="px-4 py-2 font-medium">Task</th>
                  <th scope="col" className="px-3 py-2 font-medium">Planned</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Delay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {overdue.map((task, idx) => {
                  const delay = toNumber(task.delayDays ?? task.delay_days);
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 text-zinc-900">{task.task}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">{dateOrDash(task.plannedDate)}</td>
                      <td className="px-3 py-2.5 text-zinc-600">{task.currentStatus || task.status || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-red-600">
                        {delay === null ? '—' : `${delay} days`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {budget && (
        <section>
          <h4 className="font-semibold text-zinc-900">Budget</h4>
          <dl className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {[
              ['Planned', lakhOrDash(budget.plannedBudget)],
              ['Claimed', lakhOrDash(budget.claimedExpense)],
              ['Variance', lakhOrDash(budget.variance)],
              ['Variance %', percentOrDash(budget.variancePercentage, 1)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-zinc-500">{label}</dt>
                <dd className={`tabular-nums ${overBudget && label !== 'Planned' ? 'font-medium text-red-600' : 'text-zinc-900'}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {overBudget && <p className="mt-1.5 text-xs text-red-600">Claimed expense exceeds the planned budget.</p>}
        </section>
      )}

      {expenses.length > 0 && (
        <section>
          <h4 className="font-semibold text-zinc-900">Expense breakdown</h4>
          <dl className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {expenses.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5">
                <dt className="capitalize text-zinc-500">{key.replace(/_/g, ' ')}</dt>
                <dd className="tabular-nums text-zinc-900">{lakhOrDash(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {matching.length > 0 && (
        <section>
          <h4 className="font-semibold text-zinc-900">
            Completed as planned <span className="font-normal text-zinc-500">({matching.length})</span>
          </h4>
          <ul className="mt-2 space-y-1.5">
            {matching.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-zinc-600">
                <Check size={14} className="mt-0.5 shrink-0 text-brand-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recommendations.length > 0 && (
        <section>
          <h4 className="font-semibold text-zinc-900">Recommendations</h4>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-zinc-600 marker:text-zinc-400">
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

// Helper Components for Scheme Creation

const textareaClass =
  'w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-400 focus:outline-none';

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function FormSection({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-no-press
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
      >
        <span className="text-sm font-medium text-zinc-900">{title}</span>
        <span className="flex items-center gap-2 text-xs text-zinc-500">
          {summary}
          <ChevronRight size={15} className={`text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        </span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600"
    >
      <X size={15} />
    </button>
  );
}

function AddRowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      <Plus size={14} />
      {children}
    </button>
  );
}

const countLabel = (count: number, noun: string) => (count > 0 ? `${count} ${noun}${count === 1 ? '' : 's'}` : undefined);

function PhasesMilestonesSection({ phases, onChange }: { phases: any[]; onChange: (phases: any[]) => void }) {
  const addPhase = () => {
    onChange([...phases, {
      id: phases.length + 1,
      name: `Phase ${phases.length + 1}`,
      milestones: [],
      deliverables: [],
      plannedWork: '',
      timeline: '',
      budget: 0,
      startDate: '',
      endDate: ''
    }]);
  };

  return (
    <FormSection title="Phases" summary={countLabel(phases.length, 'phase')}>
      {phases.map((phase, index) => (
        <div key={index} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={phase.name}
              onChange={(e) => onChange(updateAt(phases, index, { name: e.target.value }))}
              className={`${fieldClass} flex-1`}
              placeholder="Phase name"
              aria-label={`Phase ${index + 1} name`}
            />
            <RemoveButton onClick={() => onChange(phases.filter((_, i) => i !== index))} label={`Remove phase ${index + 1}`} />
          </div>
          <textarea
            value={phase.plannedWork}
            onChange={(e) => onChange(updateAt(phases, index, { plannedWork: e.target.value }))}
            className={textareaClass}
            rows={2}
            placeholder="Planned work for this phase"
            aria-label={`Phase ${index + 1} planned work`}
          />
        </div>
      ))}
      <AddRowButton onClick={addPhase}>Add phase</AddRowButton>
    </FormSection>
  );
}

function ContractorsSection({ contractors, onChange }: { contractors: any[]; onChange: (contractors: any[]) => void }) {
  const addContractor = () => {
    onChange([...contractors, {
      name: '',
      company: '',
      contact: '',
      role: '',
      assignedPhase: ''
    }]);
  };

  return (
    <FormSection title="Contractors and vendors" summary={countLabel(contractors.length, 'contractor')}>
      {contractors.map((contractor, index) => (
        <div key={index} className="flex gap-2">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={contractor.name}
              onChange={(e) => onChange(updateAt(contractors, index, { name: e.target.value }))}
              className={fieldClass}
              placeholder="Name"
              aria-label={`Contractor ${index + 1} name`}
            />
            <input
              type="text"
              value={contractor.company}
              onChange={(e) => onChange(updateAt(contractors, index, { company: e.target.value }))}
              className={fieldClass}
              placeholder="Company"
              aria-label={`Contractor ${index + 1} company`}
            />
            <input
              type="text"
              value={contractor.contact}
              onChange={(e) => onChange(updateAt(contractors, index, { contact: e.target.value }))}
              className={fieldClass}
              placeholder="Contact"
              aria-label={`Contractor ${index + 1} contact`}
            />
          </div>
          <RemoveButton onClick={() => onChange(contractors.filter((_, i) => i !== index))} label={`Remove contractor ${index + 1}`} />
        </div>
      ))}
      <AddRowButton onClick={addContractor}>Add contractor</AddRowButton>
    </FormSection>
  );
}

function DocumentsSection({ documents, onChange }: { documents: string[]; onChange: (documents: string[]) => void }) {
  const [newDoc, setNewDoc] = useState('');

  const addDocument = () => {
    if (newDoc.trim()) {
      onChange([...documents, newDoc.trim()]);
      setNewDoc('');
    }
  };

  return (
    <FormSection title="Supporting documents" summary={countLabel(documents.length, 'document')}>
      {documents.length > 0 && (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {documents.map((doc, index) => (
            <li key={index} className="flex items-center justify-between gap-2 py-0.5 pl-3 pr-0.5">
              <span className="min-w-0 truncate text-sm text-zinc-700">{doc}</span>
              <RemoveButton onClick={() => onChange(documents.filter((_, i) => i !== index))} label={`Remove ${doc}`} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newDoc}
          onChange={(e) => setNewDoc(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addDocument();
            }
          }}
          className={`${fieldClass} flex-1`}
          placeholder="Document name or URL"
          aria-label="Document name or URL"
        />
        <Button type="button" variant="outline" size="sm" onClick={addDocument} disabled={!newDoc.trim()}>
          Add
        </Button>
      </div>
    </FormSection>
  );
}

function MonitoringSection({ checkpoints, onChange }: { checkpoints: any[]; onChange: (checkpoints: any[]) => void }) {
  const addCheckpoint = () => {
    onChange([...checkpoints, {
      title: '',
      date: '',
      description: '',
      responsible: ''
    }]);
  };

  return (
    <FormSection title="Monitoring checkpoints" summary={countLabel(checkpoints.length, 'checkpoint')}>
      {checkpoints.map((checkpoint, index) => (
        <div key={index} className="flex gap-2">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={checkpoint.title}
              onChange={(e) => onChange(updateAt(checkpoints, index, { title: e.target.value }))}
              className={fieldClass}
              placeholder="Checkpoint"
              aria-label={`Checkpoint ${index + 1} title`}
            />
            <input
              type="date"
              value={checkpoint.date}
              onChange={(e) => onChange(updateAt(checkpoints, index, { date: e.target.value }))}
              className={fieldClass}
              aria-label={`Checkpoint ${index + 1} date`}
            />
            <input
              type="text"
              value={checkpoint.responsible}
              onChange={(e) => onChange(updateAt(checkpoints, index, { responsible: e.target.value }))}
              className={fieldClass}
              placeholder="Responsible person"
              aria-label={`Checkpoint ${index + 1} responsible person`}
            />
          </div>
          <RemoveButton onClick={() => onChange(checkpoints.filter((_, i) => i !== index))} label={`Remove checkpoint ${index + 1}`} />
        </div>
      ))}
      <AddRowButton onClick={addCheckpoint}>Add checkpoint</AddRowButton>
    </FormSection>
  );
}

// Add Scheme Modal Component
function AddSchemeModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (scheme: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    area: '',
    district: '',
    totalBudget: '',
    startDate: '',
    endDate: '',
    description: '',
    phases: [] as any[],
    contractors: [] as any[],
    documents: [] as string[],
    monitoringCheckpoints: [] as any[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isExtractingPDF, setIsExtractingPDF] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractNotice, setExtractNotice] = useState('');
  const formId = useId();

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    setIsExtractingPDF(true);
    setError('');
    setExtractNotice('');

    try {
      console.log('Uploading PDF for extraction:', file.name);
      
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_URL}/api/schemes/extract-from-pdf`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        console.log('PDF data extracted:', result.data);
        
        // Auto-fill form with extracted data
        setFormData({
          name: result.data.name || '',
          category: result.data.category || '',
          area: result.data.area || '',
          district: result.data.district || '',
          totalBudget: result.data.totalBudget?.toString() || '',
          startDate: result.data.startDate || '',
          endDate: result.data.endDate || '',
          description: result.data.description || '',
          phases: result.data.phases || [],
          contractors: [],
          documents: [],
          monitoringCheckpoints: []
        });

        const method = result.extractionMethod || 'standard';
        const confidence = result.confidence || 'Medium';
        const methodDisplay = method.includes('pathway') ? 'Pathway' : method === 'llm' ? 'LLM extraction' : method;
        setExtractNotice(`Filled from ${file.name} using ${methodDisplay} (confidence: ${confidence}). Check every field before saving.`);
      } else {
        throw new Error(result.error || 'Failed to extract data from PDF');
      }
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      setError(err.message || 'Failed to extract data from PDF. Please fill manually.');
    } finally {
      setIsExtractingPDF(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      console.log('Submitting new scheme:', formData);
      
      const response = await fetch(`${API_URL}/api/schemes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create scheme');
      }

      const result = await response.json();
      console.log('Scheme created:', result);
      
      onSubmit(formData);
    } catch (err: any) {
      console.error('Error creating scheme:', err);
      setError(err.message || 'Failed to create scheme. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const budgetValue = Number(formData.totalBudget);

  return (
    <Modal
      size="lg"
      title="New scheme"
      description="Register a public development project."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} size="sm" className="gap-2" disabled={isSubmitting || isExtractingPDF}>
            {isSubmitting && <Loader size={15} className="animate-spin" />}
            {isSubmitting ? 'Creating…' : 'Create scheme'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5 p-5 md:p-6">
        <div className="space-y-2">
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">Fill from a PDF</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {pdfFile ? pdfFile.name : 'Upload the scheme document to fill the fields below.'}
              </p>
            </div>
            <label
              className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-zinc-300 ${
                isExtractingPDF ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <input type="file" accept=".pdf,application/pdf" onChange={handlePDFUpload} className="sr-only" disabled={isExtractingPDF} />
              {isExtractingPDF ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
              {isExtractingPDF ? 'Reading…' : pdfFile ? 'Replace PDF' : 'Upload PDF'}
            </label>
          </div>
          {extractNotice && (
            <p role="status" className="text-sm text-zinc-600">
              {extractNotice}
            </p>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Scheme name</span>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`${fieldClass} w-full`}
            placeholder="e.g. Swachh Bharat Mission – Phase 3"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Category</span>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className={`${fieldClass} w-full`}
            >
              <option value="">Select category</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Housing">Housing</option>
              <option value="Employment">Employment</option>
              <option value="Power">Power</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Total budget (₹)</span>
            <input
              type="number"
              required
              min={0}
              value={formData.totalBudget}
              onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
              className={`${fieldClass} w-full tabular-nums`}
              placeholder="e.g. 5000000"
            />
            {formData.totalBudget && Number.isFinite(budgetValue) && (
              <span className="mt-1 block text-xs text-zinc-500">{lakh(budgetValue, 2)}</span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Area</span>
            <input
              type="text"
              required
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              className={`${fieldClass} w-full`}
              placeholder="Area or locality"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">District</span>
            <input
              type="text"
              required
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              className={`${fieldClass} w-full`}
              placeholder="District"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Start date</span>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className={`${fieldClass} w-full`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">End date</span>
            <input
              type="date"
              required
              value={formData.endDate}
              min={formData.startDate || undefined}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className={`${fieldClass} w-full`}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Description</span>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={textareaClass}
            rows={4}
            placeholder="Objectives and scope of the scheme"
          />
        </label>

        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-600">Optional details</p>
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <PhasesMilestonesSection phases={formData.phases} onChange={(phases) => setFormData({ ...formData, phases })} />
            <ContractorsSection
              contractors={formData.contractors}
              onChange={(contractors) => setFormData({ ...formData, contractors })}
            />
            <DocumentsSection documents={formData.documents} onChange={(documents) => setFormData({ ...formData, documents })} />
            <MonitoringSection
              checkpoints={formData.monitoringCheckpoints}
              onChange={(checkpoints) => setFormData({ ...formData, monitoringCheckpoints: checkpoints })}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
