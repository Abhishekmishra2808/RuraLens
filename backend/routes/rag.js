import express from 'express';
import rateLimit from 'express-rate-limit';
import { sanitizePII, normalizeCacheKey, containsPII } from '../utils/piiSanitizer.js';
import ragCache from '../utils/ragCache.js';
import Scheme from '../models/Scheme.js';
import AnonymousReport from '../models/AnonymousReport.js';
import { requireAuth } from '../middleware/auth.js';
import { sendAIError } from '../services/ai/aiErrors.js';
import { runCopilotTurn } from '../services/copilot/copilotService.js';
import { defaultCopilotDeps } from '../services/copilot/copilotDeps.js';

const router = express.Router();

function isTopPerformingSchemeQuestion(question = '') {
  const q = question.toLowerCase();
  return (
    /top|best|highest/.test(q) &&
    /scheme|perform|progress|success/.test(q)
  );
}

function rankSchemeForPerformance(scheme) {
  const progress = Number(scheme.overallProgress) || 0;
  const utilized = Number(scheme.budgetUtilized) || 0;
  const total = Number(scheme.totalBudget) || 0;
  const utilizationRatio = total > 0 ? Math.min(utilized / total, 1.2) : 0;

  const statusBonusMap = {
    completed: 8,
    'on-track': 4,
    delayed: -12,
    discrepant: -25
  };
  const statusBonus = statusBonusMap[scheme.status] ?? 0;

  // Composite score: mostly progress, small contribution from healthy utilization, plus status quality.
  const score = progress + (utilizationRatio * 10) + statusBonus;

  return {
    ...scheme,
    score,
    utilizationPercent: total > 0 ? Math.round((utilized / total) * 100) : 0
  };
}

async function buildTopSchemeResponse({ question, scheme_id, maxCitations }) {
  const filter = scheme_id ? { id: scheme_id } : {};
  const schemes = await Scheme.find(filter)
    .select('id name category area district status overallProgress totalBudget budgetUtilized')
    .lean();

  if (!schemes || schemes.length === 0) {
    return null;
  }

  const ranked = schemes
    .map(rankSchemeForPerformance)
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const topN = ranked.slice(0, Math.min(maxCitations || 5, ranked.length));

  const answer = [
    `Top performing scheme is ${top.name} (${top.id}).`,
    `Status: ${top.status}, Overall Progress: ${top.overallProgress || 0}%, Budget Utilization: ${top.utilizationPercent}% (${top.budgetUtilized || 0}/${top.totalBudget || 0}).`,
    `This is based on scheme progress, status reliability, and budget utilization for the question: "${question}".`
  ].join(' ');

  const citations = topN.map((s) => ({
    doc_id: `scheme-${s.id}`,
    snippet: `Scheme ${s.id} (${s.name}) | Status: ${s.status} | Progress: ${s.overallProgress || 0}% | Budget: ${s.budgetUtilized || 0}/${s.totalBudget || 0} (${s.utilizationPercent}%)`,
    score: Number(s.score.toFixed(3)),
    metadata: {
      source: 'structured-scheme-ranking',
      scheme_id: s.id
    }
  }));

  return {
    answer,
    citations
  };
}

// Rate limiter: 10 queries per minute per user
const ragRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many RAG queries. Please try again in a minute.' },
  keyGenerator: (req) => req.user.userId,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/rag-query
 * Question answering over scheme records (MongoDB) through the Bedrock Copilot
 * tools, with auth, caching, rate limiting, and citation enrichment.
 */
router.post('/', requireAuth, ragRateLimiter, async (req, res) => {
  const startTime = Date.now();
  let trace_id = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Validate request body
    const { question, scheme_id, bbox, max_citations } = req.body;
    const user_id = req.user.userId;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: question is required and must be a non-empty string' 
      });
    }

    if (question.length > 500) {
      return res.status(400).json({ 
        error: 'Question too long. Maximum 500 characters allowed.' 
      });
    }

    // Validate bbox if provided
    if (bbox && (!Array.isArray(bbox) || bbox.length !== 4)) {
      return res.status(400).json({ 
        error: 'Invalid bbox format. Expected [minLon, minLat, maxLon, maxLat]' 
      });
    }

    const maxCitations = Math.min(max_citations || 5, 10); // Cap at 10

    if (scheme_id != null && (typeof scheme_id !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(scheme_id))) {
      return res.status(400).json({ error: 'Invalid scheme_id.' });
    }

    // Answers depend on role (vendor findings are restricted), so the role is part of the key.
    const cacheKey = `${req.user.role}|${normalizeCacheKey(question, scheme_id, bbox)}`;
    const cachedResponse = ragCache.get(cacheKey);
    if (cachedResponse) {
      return res.json({ ...cachedResponse, cached: true });
    }

    // Sanitize PII from question before sending to the model
    const sanitizedQuestion = sanitizePII(question);
    const hasPII = containsPII(question);

    // Structured intent: ranking/best-scheme questions should use DB metrics, not generic semantic retrieval.
    if (isTopPerformingSchemeQuestion(sanitizedQuestion)) {
      const structured = await buildTopSchemeResponse({
        question: sanitizedQuestion,
        scheme_id,
        maxCitations: maxCitations
      });

      if (structured) {
        const structuredResponse = {
          answer: structured.answer,
          citations: await enrichCitations(structured.citations, scheme_id, bbox),
          trace_id,
          cached: false,
          answerSource: 'database-ranking',
          generatedAt: new Date().toISOString()
        };

        ragCache.set(cacheKey, structuredResponse);
        return res.json(structuredResponse);
      }
    }

    // Log request (avoid logging full question if contains PII)
    console.log(`🔍 RAG Query from ${user_id}: ${hasPII ? '[QUESTION_CONTAINS_PII]' : sanitizedQuestion.substring(0, 100)}`);
    console.log(`   Filters: scheme_id=${scheme_id || 'null'}, bbox=${bbox ? 'yes' : 'no'}`);

    let copilotResult;
    try {
      copilotResult = await runCopilotTurn({
        user: req.user,
        messages: [
          {
            role: 'user',
            content: scheme_id ? `${sanitizedQuestion}\n\n(The question is about scheme id ${scheme_id}.)` : sanitizedQuestion
          }
        ],
        deps: defaultCopilotDeps
      });
      trace_id = copilotResult.traceId || trace_id;
    } catch (error) {
      return sendAIError(res, error, 'rag-query', { trace_id });
    }

    // Citations are the records the tools actually retrieved, never model-written ids.
    const citations = copilotResult.sources.slice(0, maxCitations).map((source) => ({
      doc_id: source.id,
      type: source.type,
      snippet: source.snippet || source.title || '',
      score: null,
      timestamp: source.timestamp ?? null
    }));

    // Enrich citations with metadata and geo coordinates
    const enrichedCitations = await enrichCitations(
      citations,
      scheme_id,
      bbox
    );

    // Build response
    const response = {
      answer: copilotResult.answer,
      citations: enrichedCitations,
      trace_id,
      cached: false,
      answerSource: 'amazon-bedrock',
      model: copilotResult.model,
      generatedAt: copilotResult.generatedAt
    };

    // Cache the response
    ragCache.set(cacheKey, response);

    // Log completion
    const latency = Date.now() - startTime;
    console.log(`✅ RAG Query completed [${trace_id}] in ${latency}ms, ${enrichedCitations.length} citations`);

    // Audit log (without PII)
    logAudit({
      trace_id,
      user_id,
      has_pii: hasPII,
      scheme_id,
      citations_count: enrichedCitations.length,
      latency_ms: latency
    });

    res.json(response);

  } catch (error) {
    console.error(`❌ RAG query error [${trace_id}]:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process RAG query',
      trace_id
    });
  }
});

/**
 * Enrich citations with metadata and geo coordinates from MongoDB
 * Geo fallback order: direct doc → doc metadata → nearest sensor (same scheme) → scheme centroid
 */
async function enrichCitations(citations, scheme_id, bbox) {
  if (!citations || citations.length === 0) {
    return [];
  }

  const enriched = [];

  for (const citation of citations) {
    try {
      const enrichedCitation = {
        doc_id: citation.doc_id,
        snippet: citation.snippet || '',
        score: typeof citation.score === 'number' ? citation.score : null,
        type: citation.type || 'unknown',
        timestamp: citation.timestamp ?? null,
        geo: null
      };

      // Determine doc type and fetch metadata based on doc_id pattern
      if (citation.doc_id.startsWith('vendor-report-')) {
        await enrichVendorReport(enrichedCitation, scheme_id);
      } else if (citation.doc_id.startsWith('scheme-')) {
        await enrichScheme(enrichedCitation);
      } else if (citation.doc_id.startsWith('citizen-report-')) {
        await enrichCitizenReport(enrichedCitation);
      } else if (citation.doc_id.startsWith('sensor-')) {
        enrichedCitation.type = 'sensor-event';
        // Sensor data is in-memory, fallback to scheme geo
        if (scheme_id) {
          await fallbackToSchemeGeo(enrichedCitation, scheme_id);
        }
      }

      // If still no geo and bbox provided, try to find nearby items
      if (!enrichedCitation.geo && bbox) {
        await fallbackToBboxGeo(enrichedCitation, bbox);
      }

      enriched.push(enrichedCitation);
    } catch (error) {
      console.error(`⚠️  Failed to enrich citation ${citation.doc_id}:`, error.message);
      // Still include citation with available data
      enriched.push({
        doc_id: citation.doc_id,
        snippet: citation.snippet || '',
        score: typeof citation.score === 'number' ? citation.score : null,
        type: 'unknown',
        timestamp: null,
        geo: null
      });
    }
  }

  return enriched;
}

/**
 * Enrich vendor report citation
 */
async function enrichVendorReport(citation, scheme_id) {
  // Vendor reports are embedded in schemes
  const reportId = citation.doc_id.replace('vendor-report-', '');
  const schemes = await Scheme.find({
    'vendorReports.id': reportId
  }).limit(1);

  if (schemes.length > 0) {
    const scheme = schemes[0];
    const report = scheme.vendorReports.find(r => r.id === reportId);
    
    citation.type = 'vendor-report';
    citation.timestamp = citation.timestamp || report?.analyzedAt || report?.submittedDate || null;
    
    // Use scheme location as geo
    if (scheme.location) {
      citation.geo = {
        lat: scheme.location.lat || null,
        lon: scheme.location.lng || null
      };
    }
  }
}

/**
 * Enrich scheme citation
 */
async function enrichScheme(citation) {
  const schemeId = citation.doc_id.replace('scheme-', '');
  const scheme = await Scheme.findOne({ id: schemeId });

  if (scheme) {
    citation.type = 'government-scheme';
    citation.timestamp = citation.timestamp || scheme.startDate;
    
    if (scheme.location) {
      citation.geo = {
        lat: scheme.location.lat || null,
        lon: scheme.location.lng || null
      };
    }
  }
}

/**
 * Enrich citizen report citation (now uses AnonymousReport)
 */
async function enrichCitizenReport(citation) {
  const report = await AnonymousReport.findOne({ id: citation.doc_id });

  if (report) {
    citation.type = 'citizen-report';
    citation.timestamp = report.createdAt;
    
    if (report.location?.approximateCoords && report.location.approximateCoords.length === 2) {
      citation.geo = {
        lat: report.location.approximateCoords[1], // [lon, lat] -> lat
        lon: report.location.approximateCoords[0]
      };
    }
  }
}

/**
 * Fallback to scheme centroid geo
 */
async function fallbackToSchemeGeo(citation, scheme_id) {
  const scheme = await Scheme.findOne({ id: scheme_id });
  if (scheme && scheme.location) {
    citation.geo = {
      lat: scheme.location.lat || null,
      lon: scheme.location.lng || null
    };
  }
}

/**
 * Fallback to nearest item in bbox
 */
async function fallbackToBboxGeo(citation, bbox) {
  // Try to find any geo-tagged item in bbox (anonymous reports)
  const [minLon, minLat, maxLon, maxLat] = bbox;
  
  const report = await AnonymousReport.findOne({
    'location.approximateCoords': {
      $geoWithin: {
        $box: [[minLon, minLat], [maxLon, maxLat]]
      }
    }
  }).limit(1);

  if (report && report.location?.approximateCoords && report.location.approximateCoords.length === 2) {
    citation.geo = {
      lat: report.location.approximateCoords[1],
      lon: report.location.approximateCoords[0]
    };
  }
}

/**
 * Audit logging (without PII)
 */
function logAudit(data) {
  // In production, send to logging service (e.g., CloudWatch, Datadog)
  console.log('📊 AUDIT:', JSON.stringify(data));
}

export default router;
