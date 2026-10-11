import express from 'express';
import crypto from 'crypto';
import Scheme from '../models/Scheme.js';
import Feedback from '../models/Feedback.js';
// Switched from Gemini to Hugging Face Llama 3.1-8B-Instruct
import { processFeedbackWithAI } from '../utils/huggingfaceService.js';
import { extractSchemeFromPDF } from '../utils/pdfService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { documentStore } from '../services/documents/documentStore.js';
import { createVendorReportRouter, pdfUpload as upload } from './vendorReports.js';

const router = express.Router();

router.use(createVendorReportRouter());

// Get all schemes
router.get('/', async (req, res) => {
  try {
    const schemes = await Scheme.find().sort({ lastUpdated: -1 });
    res.json({ schemes });
  } catch (error) {
    console.error('Error fetching schemes:', error);
    res.status(500).json({ error: 'Failed to fetch schemes' });
  }
});

// Create new scheme (admin only)
router.post('/', async (req, res) => {
  try {
    console.log('📝 Creating new scheme:', req.body);

    const {
      name,
      description,
      category,
      area,
      district,
      totalBudget,
      startDate,
      endDate,
      planDocumentId,
    } = req.body;

    // Validate required fields
    if (!name || !description || !totalBudget) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, description, and totalBudget are required' 
      });
    }

    // Generate unique ID
    const schemeId = `SCHEME-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create new scheme
    const newScheme = new Scheme({
      id: schemeId,
      name,
      description,
      category: category || 'General',
      area: area || 'Central Delhi',
      district: district || 'New Delhi',
      totalBudget: parseFloat(totalBudget) || 0,
      budgetUtilized: 0,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      overallProgress: 0,
      status: 'on-track',
      phases: [
        {
          id: 1,
          name: 'Planning',
          progress: 0,
          status: 'not-started',
          startDate: startDate || new Date().toISOString(),
          endDate: endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          budget: parseFloat(totalBudget) || 0,
          spent: 0
        }
      ],
      vendorReports: [],
      discrepancies: [],
      citizenRating: 0,
      feedbackCount: 0,
      lastUpdated: new Date().toISOString()
    });

    // Link the plan PDF stored during extraction so vendor reports can be compared with it.
    let planDocumentWarning = null;
    if (planDocumentId) {
      try {
        const doc = await documentStore.assignScheme(String(planDocumentId), schemeId);
        newScheme.planDocument = { fileId: doc.fileId, fileName: doc.filename, sha256: doc.sha256, uploadedAt: new Date() };
      } catch (error) {
        planDocumentWarning = `The scheme was created without its plan PDF: ${error.message}`;
      }
    }

    const savedScheme = await newScheme.save();
    console.log('✅ Scheme created successfully:', savedScheme.id);

    // Broadcast to all connected clients
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      const allSchemes = await Scheme.find().sort({ lastUpdated: -1 });
      broadcast({
        type: 'scheme_added',
        scheme: savedScheme,
        allSchemes: allSchemes,
        timestamp: new Date().toISOString()
      });
      console.log('📡 Broadcasted new scheme to all clients');
    }

    res.status(201).json({
      success: true,
      message: 'Scheme created successfully',
      scheme: savedScheme,
      warnings: planDocumentWarning ? [planDocumentWarning] : []
    });
  } catch (error) {
    console.error('❌ Error creating scheme:', error);
    res.status(500).json({ 
      error: 'Failed to create scheme', 
      details: error.message 
    });
  }
});

// Get single scheme
router.get('/:id', async (req, res) => {
  try {
    const scheme = await Scheme.findOne({ id: req.params.id });
    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }

    // Get feedback for this scheme
    const feedback = await Feedback.find({ schemeId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ scheme, feedback });
  } catch (error) {
    console.error('Error fetching scheme:', error);
    res.status(500).json({ error: 'Failed to fetch scheme' });
  }
});

// Submit feedback (AI processed)
router.post('/:id/feedback', async (req, res) => {
  try {
    const { rating, comment, isUrgent, userId } = req.body;

    // Validate
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) required' });
    }

    // Create anonymous user hash (use userId or IP address)
    const userIdentifier = userId || req.ip || req.headers['x-forwarded-for'] || 'anonymous';
    const userHash = crypto.createHash('sha256').update(userIdentifier).digest('hex');

    // Find scheme
    const scheme = await Scheme.findOne({ id: req.params.id });
    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }

    // Check if user already submitted feedback in the last 3 weeks (21 days)
    const threeWeeksAgo = new Date();
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    const recentFeedback = await Feedback.findOne({
      schemeId: req.params.id,
      userHash: userHash,
      createdAt: { $gte: threeWeeksAgo }
    }).select('+userHash');

    if (recentFeedback) {
      const daysSinceLastFeedback = Math.ceil((Date.now() - recentFeedback.createdAt) / (1000 * 60 * 60 * 24));
      const daysRemaining = 21 - daysSinceLastFeedback;
      
      return res.status(429).json({ 
        error: 'You have already submitted feedback for this scheme recently',
        message: `Please wait ${daysRemaining} more day(s) before submitting feedback again`,
        nextAllowedDate: new Date(recentFeedback.createdAt.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    console.log(`🤖 Processing feedback with Hugging Face Llama 3.1-8B for: ${scheme.name}`);

    // Process with Hugging Face Llama 3.1-8B
    const aiResult = await processFeedbackWithAI(
      comment || 'No comment provided',
      rating,
      scheme.name
    );

    const aiAnalysis = aiResult.analysis;

    // Save feedback to database
    const feedback = await Feedback.create({
      schemeId: req.params.id,
      userHash: userHash,
      rating,
      rawComment: comment, // Stored but never exposed
      aiSummary: aiAnalysis.summary,
      concerns: aiAnalysis.concerns,
      sentiment: aiAnalysis.sentiment,
      categories: aiAnalysis.categories,
      urgency: aiAnalysis.urgency,
      isUrgent: isUrgent || (aiAnalysis.urgency === 'Critical' || aiAnalysis.urgency === 'High'),
      aiProcessed: aiResult.success
    });

    // Update scheme statistics - FIX: Properly calculate average rating
    const previousCount = scheme.feedbackCount || 0;
    const previousRating = scheme.citizenRating || 0;
    
    // New count
    scheme.feedbackCount = previousCount + 1;
    
    // Calculate new average: ((old_avg * old_count) + new_rating) / new_count
    const totalRating = (previousRating * previousCount) + rating;
    scheme.citizenRating = totalRating / scheme.feedbackCount;
    scheme.citizenRating = Math.round(scheme.citizenRating * 10) / 10; // Round to 1 decimal

    // Add discrepancy only if explicitly marked as urgent by the citizen
    if (feedback.isUrgent) {
      // Create a more meaningful aggregated message
      const concernsSummary = aiAnalysis.concerns && aiAnalysis.concerns.length > 0 
        ? aiAnalysis.concerns.slice(0, 2).join('; ')
        : 'Issue reported';
      
      const categoriesText = aiAnalysis.categories && aiAnalysis.categories.length > 0
        ? ` in ${aiAnalysis.categories.join(', ')}`
        : '';
      
      const ratingContext = rating <= 2 ? ` (${rating}/5 rating)` : '';
      
      scheme.discrepancies.push({
        id: `disc-${Date.now()}`,
        type: 'citizen_reported',
        description: `Citizens report ${aiAnalysis.sentiment.toLowerCase()} feedback${categoriesText}${ratingContext}. Key concerns: ${concernsSummary}`,
        severity: aiAnalysis.urgency === 'Critical' || rating === 1 ? 'critical' : 'high',
        reportedBy: 'Citizens (Anonymized)',
        categories: aiAnalysis.categories,
        concerns: aiAnalysis.concerns,
        date: new Date().toISOString(),
        status: 'pending'
      });
    }

    await scheme.save();

    console.log(`✅ Feedback saved: ${scheme.name} - Rating: ${rating}/5 - New Avg: ${scheme.citizenRating} - Total: ${scheme.feedbackCount} - Sentiment: ${aiAnalysis.sentiment}`);

    // Broadcast updated scheme to all clients
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      const allSchemes = await Scheme.find().sort({ lastUpdated: -1 });
      broadcast({
        type: 'scheme_updated',
        schemeId: scheme.id,
        allSchemes: allSchemes,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: {
        id: feedback._id,
        aiSummary: feedback.aiSummary,
        sentiment: feedback.sentiment,
        urgency: feedback.urgency
      },
      scheme: {
        id: scheme.id,
        citizenRating: scheme.citizenRating,
        feedbackCount: scheme.feedbackCount
      }
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get feedback for a scheme (admin only - anonymized with rating visible)
router.get('/:id/feedback', async (req, res) => {
  try {
    const feedback = await Feedback.find({ schemeId: req.params.id })
      .select('-rawComment -userHash') // Never expose raw comments or user identity
      .sort({ createdAt: -1 })
      .limit(50);

    // Return anonymized feedback with rating visible
    const anonymizedFeedback = feedback.map(f => ({
      id: f._id,
      schemeId: f.schemeId,
      rating: f.rating, // Rating is visible to admin
      aiSummary: f.aiSummary,
      concerns: f.concerns,
      sentiment: f.sentiment,
      categories: f.categories,
      urgency: f.urgency,
      isUrgent: f.isUrgent,
      aiProcessed: f.aiProcessed,
      createdAt: f.createdAt,
      // userHash is never exposed - anonymity preserved
    }));

    res.json({ feedback: anonymizedFeedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Extract scheme details from a plan PDF (Hugging Face extraction) and keep the
// original PDF in GridFS so later vendor reports can be compared with it.
router.post('/extract-from-pdf', requireAuth, requireRole('admin'), upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log('📄 Processing scheme PDF, size:', req.file.size);

    let planDocument = null;
    let storageWarning = null;
    try {
      planDocument = await documentStore.storePdf({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        kind: 'scheme-plan',
        schemeId: null,
        uploadedBy: req.user.userId
      });
    } catch (error) {
      storageWarning = `The plan PDF could not be stored (${error.message}); vendor reports will be compared with the scheme record only.`;
    }

    const result = await extractSchemeFromPDF(req.file.buffer);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        extractionMethod: result.extractionMethod || 'standard',
        confidence: result.data?.extractionConfidence || 'Medium',
        planDocumentId: planDocument?.fileId ?? null,
        warnings: storageWarning ? [storageWarning] : [],
        message: 'Scheme data extracted. Please review and submit.'
      });
    } else {
      console.error('❌ Failed to extract scheme data:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        planDocumentId: planDocument?.fileId ?? null,
        message: 'Failed to extract data from PDF. Please fill manually.'
      });
    }
  } catch (error) {
    console.error('❌ PDF extraction error:', error.message);
    res.status(500).json({ error: 'Failed to process PDF file' });
  }
});

// Delete a scheme (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const scheme = await Scheme.findOneAndDelete({ id: req.params.id });
    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }

    // Optionally, delete related feedback
    await Feedback.deleteMany({ schemeId: req.params.id });

    // Broadcast to all connected clients
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      const allSchemes = await Scheme.find().sort({ lastUpdated: -1 });
      broadcast({
        type: 'scheme_deleted',
        schemeId: req.params.id,
        allSchemes: allSchemes,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Scheme deleted successfully', schemeId: req.params.id });
  } catch (error) {
    console.error('Error deleting scheme:', error);
    res.status(500).json({ error: 'Failed to delete scheme' });
  }
});

export default router;

