import mongoose from 'mongoose';

// Define sub-schemas to avoid casting issues
const phaseSchema = new mongoose.Schema({
  id: Number,
  name: String,
  progress: Number,
  status: String,
  startDate: String,
  endDate: String,
  budget: Number,
  spent: Number,
  // Enhanced phase details from PDF
  milestones: [String],
  deliverables: [String],
  plannedWork: String,
  timeline: String
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  source: { type: String, enum: ['plan-document', 'scheme-record', 'vendor-report'] },
  quote: { type: String, default: null },
  page: { type: Number, default: null },
  section: { type: String, default: null }
}, { _id: false });

const modelSourceSchema = new mongoose.Schema({
  provider: String,
  modelId: String
}, { _id: false });

// A flagged item for official review; not a determination of wrongdoing.
const reportFindingSchema = new mongoose.Schema({
  id: String,
  source: { type: String, enum: ['deterministic', 'ai', 'legacy'] },
  type: String,
  category: String, // 'budget', 'timeline', 'quality', 'scope', 'compliance'
  severity: String, // 'critical', 'high', 'medium', 'low'
  title: String,
  description: String,
  planEvidence: { type: evidenceSchema, default: null },
  vendorEvidence: { type: evidenceSchema, default: null },
  plannedValue: { type: String, default: null },
  reportedValue: { type: String, default: null },
  actualValue: { type: String, default: null }, // legacy name for reportedValue
  variance: { type: Number, default: null },
  varianceUnit: { type: String, default: null },
  variancePercentage: { type: Number, default: null },
  pageOrSection: { type: String, default: null },
  confidence: { type: Number, default: null },
  reviewStatus: { type: String, enum: ['pending-review', 'confirmed', 'dismissed'], default: 'pending-review' },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: null },
  modelSource: { type: modelSourceSchema, default: null },
  generatedAt: { type: Date, default: null },
  supersededAt: { type: Date, default: null }
}, { _id: false });

const aiErrorSchema = new mongoose.Schema({
  code: String,
  message: String,
  retryable: Boolean
}, { _id: false });

const vendorReportSchema = new mongoose.Schema({
  id: String,
  vendorName: String,
  submittedDate: Date,
  phase: Number,
  workCompleted: String,
  expenseClaimed: Number,
  verificationStatus: String,
  verificationDecision: {
    type: new mongoose.Schema({ by: String, at: Date, note: String }, { _id: false }),
    default: null
  },
  documents: [String],
  complianceAnalysis: {
    overallCompliance: Number, // legacy LLM score; not produced by the current analysis
    matchingItems: [String],
    discrepancies: [reportFindingSchema],
    overdueWork: [{
      task: String,
      plannedDate: String,
      currentStatus: String,
      delayDays: Number
    }],
    budgetAnalysis: {
      plannedBudget: Number,
      claimedExpense: Number,
      priorUtilized: Number,
      variance: Number,
      variancePercentage: Number
    },
    aiSummary: String,
    aiProcessed: Boolean
  },
  pdfFileName: String,
  // Original PDF in GridFS bucket "documents"; the hash prevents duplicate reports.
  documentFileId: String,
  documentSha256: String,
  uploadedBy: String,
  analysisMethod: String,
  analysisStatus: { type: String, enum: ['completed', 'deterministic_only'] },
  analyzedAt: Date,
  planEvidenceSource: { type: String, enum: ['plan-document', 'scheme-record'] },
  textExtraction: {
    numPages: Number,
    pagesAnalyzed: Number,
    truncated: Boolean
  },
  aiAnalysis: {
    status: { type: String, enum: ['succeeded', 'failed', 'not_configured'] },
    error: { type: aiErrorSchema, default: null },
    modelSource: { type: modelSourceSchema, default: null },
    generatedAt: Date,
    discardedUnverified: Number,
    lastSuccess: {
      type: new mongoose.Schema({
        summary: String,
        matchingItems: [String],
        generatedAt: Date,
        modelSource: { type: modelSourceSchema, default: null }
      }, { _id: false }),
      default: null
    }
  }
}, { _id: false });

const discrepancySchema = new mongoose.Schema({
  id: String,
  type: String,
  severity: String,
  description: String,
  reportedDate: String,
  date: String,
  reportedBy: String,
  categories: [String],
  concerns: [String],
  status: String
}, { _id: false });

const schemeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  category: String,
  area: String,
  district: String,
  totalBudget: Number,
  budgetUtilized: Number,
  startDate: String,
  endDate: String,
  overallProgress: Number,
  status: {
    type: String,
    enum: ['on-track', 'delayed', 'completed', 'discrepant']
  },
  description: String,
  // Original scheme plan PDF in GridFS bucket "documents", when uploaded.
  planDocument: {
    type: new mongoose.Schema({
      fileId: String,
      fileName: String,
      sha256: String,
      uploadedAt: Date
    }, { _id: false }),
    default: null
  },
  phases: [phaseSchema],
  vendorReports: [vendorReportSchema],
  discrepancies: [discrepancySchema],
  citizenRating: {
    type: Number,
    default: 0
  },
  feedbackCount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Update lastUpdated on save
schemeSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

export default mongoose.model('Scheme', schemeSchema);
