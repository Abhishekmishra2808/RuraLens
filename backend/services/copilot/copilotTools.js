import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const TWIN_ASSET_TYPES = ['tank', 'pump', 'pipe', 'hospital', 'school', 'power', 'market', 'sensor', 'road', 'building'];
export const VENDOR_FINDING_ROLES = ['admin', 'field_worker'];
export const MAX_TOOL_CALLS = 8;

const idSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.:-]+$/, 'Only letters, digits, and _ . : - are allowed');
const failureTypeSchema = z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

function summarizeImpact(impact) {
  const affected = Array.isArray(impact?.affectedNodes) ? impact.affectedNodes : [];
  return {
    totalAffected: Number.isFinite(impact?.totalAffected) ? impact.totalAffected : affected.length,
    criticalCount: Number.isFinite(impact?.criticalCount) ? impact.criticalCount : null,
    highCount: Number.isFinite(impact?.highCount) ? impact.highCount : null,
    riskLevel: impact?.overallAssessment?.riskLevel ?? null,
    assessmentSummary: impact?.overallAssessment?.summary ?? null,
    affected: affected.slice(0, 15).map((node) => ({
      nodeId: node.nodeId,
      name: node.nodeName ?? node.nodeId,
      type: node.nodeType ?? null,
      severity: node.severity ?? null,
      probability: round(node.probability),
      timeToImpact: Number.isFinite(node.timeToImpact) ? node.timeToImpact : null,
    })),
    omittedCount: Math.max(0, affected.length - 15),
  };
}

/**
 * Builds the per-request tool set. Every tool closes over the authenticated
 * user and the request's twin context, validates its input with zod, reads
 * only through existing services, and records the sources it actually used.
 * No tool writes to the database or performs arbitrary queries or HTTP calls.
 */
export function buildCopilotTools({ user, twin, deps, collector }) {
  const assets = twin?.assets ?? [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const provenanceNote = (asset) =>
    asset?.provenance === 'verified'
      ? 'verified dataset record'
      : asset?.provenance === 'user-added'
        ? 'user-added scenario asset (not real infrastructure)'
        : 'synthetic demonstration asset (not real infrastructure)';

  let calls = 0;
  const guarded = (name, fn) => async (input) => {
    calls += 1;
    if (calls > MAX_TOOL_CALLS) {
      collector.calls.push({ name, ok: false, error: 'tool_budget_exhausted' });
      return { error: 'tool_budget_exhausted', message: `Only ${MAX_TOOL_CALLS} tool calls are allowed per question. Answer with the data already retrieved.` };
    }
    try {
      const result = await fn(input);
      collector.calls.push({ name, ok: !result?.error, ...(result?.error ? { error: result.error } : {}) });
      return result;
    } catch (error) {
      collector.calls.push({ name, ok: false, error: 'tool_failed' });
      return { error: 'tool_failed', message: `The ${name} lookup failed: ${String(error?.message || 'unknown error').slice(0, 160)}` };
    }
  };

  const requireTwin = () =>
    twin?.infraState && assets.length > 0
      ? null
      : { error: 'twin_unavailable', message: 'No digital twin dataset was sent with this question. Open the 3D twin to ask about infrastructure.' };

  const ensureGraph = () => {
    if (!collector.graphSynced) {
      deps.gnn.syncGraph(twin.infraState);
      collector.graphSynced = true;
    }
  };

  const scenarioFor = (asset, failureType) => {
    const scenario = deps.gnn.getScenarios().find((s) => s.id === failureType);
    if (!scenario) return { error: 'unknown_failure_type', message: `Unknown failure type "${failureType}".` };
    if (Array.isArray(scenario.applicableTo) && !scenario.applicableTo.includes(asset.type)) {
      return {
        error: 'failure_type_not_applicable',
        message: `${scenario.name} does not apply to ${asset.type} assets. Applicable failure types: ${deps.gnn
          .getScenarios()
          .filter((s) => !s.applicableTo || s.applicableTo.includes(asset.type))
          .map((s) => s.id)
          .join(', ')}.`,
      };
    }
    return { scenario };
  };

  const runPrediction = async (assetId, failureType, severity) => {
    const asset = assetById.get(assetId);
    if (!asset) return { error: 'asset_not_found', message: `No asset with id "${assetId}" is in the current twin dataset.` };
    const check = scenarioFor(asset, failureType);
    if (check.error) return check;
    ensureGraph();
    if (!deps.gnn.hasNode(assetId)) {
      return { error: 'asset_not_in_graph', message: `"${asset.name}" is not part of the backend dependency graph, so no prediction can be made.` };
    }
    const { impact, modelSource, modelError } = await deps.gnn.predict(assetId, failureType, severity);
    collector.sources.push({
      id: `prediction-${assetId}-${failureType}-${severity}`,
      type: 'prediction',
      title: `${check.scenario.name} at ${asset.name} (${severity})`,
      snippet: `${modelSource === 'python-model' ? 'Trained GNN model' : 'Rule-based JS fallback (not the trained model)'} predicted ${summarizeImpact(impact).totalAffected} affected node(s).`,
    });
    return {
      dataKind: 'prediction',
      modelSource,
      modelSourceNote:
        modelSource === 'python-model'
          ? 'Output of the trained GNN model service.'
          : 'The trained model was unavailable; this is the local rule-based fallback, not trained GNN output.',
      modelError: modelError ? 'The trained model service did not respond.' : null,
      target: { id: asset.id, name: asset.name, type: asset.type, provenance: provenanceNote(asset) },
      failureType,
      failureTypeLabel: check.scenario.name,
      severity,
      ...summarizeImpact(impact),
    };
  };

  const searchSchemes = tool({
    name: 'search_schemes',
    description:
      'Search government schemes stored in the RuraLens database by keyword, status, or category. Returns observed records: budget, progress, status, dates, citizen rating, and open issue count.',
    inputSchema: z.object({
      query: z.string().trim().max(120).optional().describe('Keywords matched against name, description, category, area, district'),
      status: z.enum(['on-track', 'delayed', 'completed', 'discrepant']).optional(),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    callback: guarded('search_schemes', async ({ query, status, limit }) => {
      const filter = {};
      if (status) filter.status = status;
      if (query) {
        const pattern = new RegExp(escapeRegex(query), 'i');
        filter.$or = ['name', 'description', 'category', 'area', 'district'].map((field) => ({ [field]: pattern }));
      }
      const schemes = await deps.schemes.find(filter, limit);
      for (const s of schemes) {
        collector.sources.push({
          id: `scheme-${s.id}`,
          type: 'scheme',
          title: s.name,
          snippet: `Status ${s.status ?? 'unknown'}, progress ${s.overallProgress ?? 'unknown'}%, budget ₹${s.totalBudget ?? 'unknown'}, utilised ₹${s.budgetUtilized ?? 'unknown'}.`,
          timestamp: s.lastUpdated ? new Date(s.lastUpdated).toISOString() : null,
        });
      }
      return {
        dataKind: 'observed',
        count: schemes.length,
        schemes: schemes.map((s) => ({
          schemeId: s.id,
          name: s.name,
          category: s.category ?? null,
          area: s.area ?? null,
          district: s.district ?? null,
          status: s.status ?? null,
          overallProgress: s.overallProgress ?? null,
          totalBudget: s.totalBudget ?? null,
          budgetUtilized: s.budgetUtilized ?? null,
          startDate: s.startDate ?? null,
          endDate: s.endDate ?? null,
          citizenRating: s.feedbackCount ? s.citizenRating : null,
          feedbackCount: s.feedbackCount ?? 0,
          openIssues: Array.isArray(s.discrepancies) ? s.discrepancies.length : 0,
        })),
      };
    }),
  });

  const getSchemeDetails = tool({
    name: 'get_scheme_details',
    description: 'Get one scheme by id: phases with budgets and dates, and citizen-reported issues (anonymised summaries).',
    inputSchema: z.object({ schemeId: idSchema }),
    callback: guarded('get_scheme_details', async ({ schemeId }) => {
      const s = await deps.schemes.findById(schemeId);
      if (!s) return { error: 'scheme_not_found', message: `No scheme with id "${schemeId}".` };
      collector.sources.push({
        id: `scheme-${s.id}`,
        type: 'scheme',
        title: s.name,
        snippet: (s.description || '').slice(0, 200),
        timestamp: s.lastUpdated ? new Date(s.lastUpdated).toISOString() : null,
      });
      return {
        dataKind: 'observed',
        schemeId: s.id,
        name: s.name,
        description: (s.description || '').slice(0, 600),
        status: s.status ?? null,
        totalBudget: s.totalBudget ?? null,
        budgetUtilized: s.budgetUtilized ?? null,
        overallProgress: s.overallProgress ?? null,
        phases: (s.phases || []).map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status ?? null,
          progress: p.progress ?? null,
          startDate: p.startDate ?? null,
          endDate: p.endDate ?? null,
          budget: p.budget ?? null,
          spent: p.spent ?? null,
        })),
        citizenIssues: (s.discrepancies || []).slice(0, 10).map((d) => ({
          severity: d.severity ?? null,
          description: d.description ?? null,
          status: d.status ?? null,
          date: d.date ?? d.reportedDate ?? null,
        })),
        vendorReportCount: (s.vendorReports || []).length,
        vendorFindingsAccess: VENDOR_FINDING_ROLES.includes(user.role)
          ? 'Use get_vendor_findings for vendor-report findings.'
          : 'Vendor-report findings are restricted to officials and field workers.',
      };
    }),
  });

  const getVendorFindings = tool({
    name: 'get_vendor_findings',
    description:
      'Get vendor progress-report comparison findings for a scheme. Findings are flagged items awaiting or after official review, not proof of wrongdoing. Restricted to officials and field workers.',
    inputSchema: z.object({ schemeId: idSchema }),
    callback: guarded('get_vendor_findings', async ({ schemeId }) => {
      if (!VENDOR_FINDING_ROLES.includes(user.role)) {
        return { error: 'forbidden', message: 'Vendor-report findings are restricted to officials and field workers.' };
      }
      const s = await deps.schemes.findById(schemeId);
      if (!s) return { error: 'scheme_not_found', message: `No scheme with id "${schemeId}".` };
      const reports = (s.vendorReports || []).slice(-5);
      for (const r of reports) {
        collector.sources.push({
          id: `vendor-report-${r.id}`,
          type: 'vendor_report',
          title: `${r.vendorName || 'Vendor report'} — ${s.name}`,
          snippet: `${(r.complianceAnalysis?.discrepancies || []).length} finding(s); verification ${r.verificationStatus || 'pending'}.`,
          timestamp: r.analyzedAt ? new Date(r.analyzedAt).toISOString() : r.submittedDate ? new Date(r.submittedDate).toISOString() : null,
        });
      }
      return {
        dataKind: 'findings_for_review',
        schemeId: s.id,
        schemeName: s.name,
        reports: reports.map((r) => ({
          reportId: r.id,
          vendorName: r.vendorName ?? null,
          submittedDate: r.submittedDate ?? null,
          verificationStatus: r.verificationStatus ?? 'pending',
          analysisStatus: r.analysisStatus ?? null,
          analyzedAt: r.analyzedAt ?? null,
          findings: (r.complianceAnalysis?.discrepancies || []).slice(0, 12).map((d) => ({
            type: d.type ?? d.category ?? null,
            severity: d.severity ?? null,
            title: d.title ?? null,
            description: d.description ?? null,
            plannedValue: d.plannedValue ?? null,
            reportedValue: d.reportedValue ?? d.actualValue ?? null,
            variance: d.variance ?? null,
            pageOrSection: d.pageOrSection ?? null,
            method: d.source === 'ai' ? 'AI interpretation' : d.source === 'deterministic' ? 'calculated check' : 'legacy analysis',
            reviewStatus: d.reviewStatus ?? 'pending-review',
          })),
        })),
      };
    }),
  });

  const listAssets = tool({
    name: 'list_infrastructure_assets',
    description:
      'List infrastructure assets in the currently open digital twin dataset, optionally filtered by type or name. Each asset carries its data provenance.',
    inputSchema: z.object({
      type: z.enum(TWIN_ASSET_TYPES).optional(),
      nameQuery: z.string().trim().max(80).optional(),
      limit: z.number().int().min(1).max(30).default(15),
    }),
    callback: guarded('list_infrastructure_assets', async ({ type, nameQuery, limit }) => {
      const missing = requireTwin();
      if (missing) return missing;
      const needle = nameQuery?.toLowerCase();
      const matches = assets.filter((a) => (!type || a.type === type) && (!needle || a.name.toLowerCase().includes(needle)));
      for (const a of matches.slice(0, limit)) {
        collector.sources.push({ id: `asset-${a.id}`, type: 'asset', title: a.name, snippet: `${a.type}; ${provenanceNote(a)}.` });
      }
      return {
        dataKind: 'dataset_records',
        datasetId: twin.datasetId ?? null,
        total: matches.length,
        assets: matches.slice(0, limit).map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          status: a.status ?? null,
          provenance: provenanceNote(a),
        })),
      };
    }),
  });

  const getDependencies = tool({
    name: 'get_asset_dependencies',
    description:
      'Get the dependency relationships of one asset from the backend infrastructure graph (what it depends on and what depends on it).',
    inputSchema: z.object({ assetId: idSchema }),
    callback: guarded('get_asset_dependencies', async ({ assetId }) => {
      const missing = requireTwin();
      if (missing) return missing;
      const asset = assetById.get(assetId);
      if (!asset) return { error: 'asset_not_found', message: `No asset with id "${assetId}" is in the current twin dataset.` };
      ensureGraph();
      const nodes = new Map(deps.gnn.getNodes().map((n) => [n.id, n]));
      const edges = deps.gnn.getEdges().filter((e) => e.type !== 'proximity');
      const describe = (id, edge) => ({
        id,
        name: nodes.get(id)?.name ?? id,
        type: nodes.get(id)?.type ?? null,
        relationship: [edge.type, edge.relationship].filter(Boolean).join(': ') || null,
        onMap: assetById.has(id),
      });
      const outgoing = edges.filter((e) => e.source === assetId).map((e) => describe(e.target, e));
      const incoming = edges.filter((e) => e.target === assetId).map((e) => describe(e.source, e));
      collector.sources.push({
        id: `asset-${asset.id}`,
        type: 'asset',
        title: asset.name,
        snippet: `${outgoing.length} outgoing and ${incoming.length} incoming dependency link(s) in the backend graph.`,
      });
      return {
        dataKind: 'graph_structure',
        note: 'Links are built by the backend graph builder from the dataset; proximity-only links are excluded.',
        asset: { id: asset.id, name: asset.name, type: asset.type, provenance: provenanceNote(asset) },
        outgoing: outgoing.slice(0, 20),
        incoming: incoming.slice(0, 20),
      };
    }),
  });

  const predictImpact = tool({
    name: 'predict_failure_impact',
    description:
      'Run the existing failure-impact prediction (trained GNN service, or its labelled rule-based fallback) for one asset. Read-only: it does not change any data or the map.',
    inputSchema: z.object({
      assetId: idSchema,
      failureType: failureTypeSchema.describe('A failure type id applicable to the asset type, e.g. outage, leak, fire, flood, failure'),
      severity: z.enum(SEVERITIES),
    }),
    callback: guarded('predict_failure_impact', async ({ assetId, failureType, severity }) => {
      const missing = requireTwin();
      if (missing) return missing;
      return runPrediction(assetId, failureType, severity);
    }),
  });

  const compareScenarios = tool({
    name: 'compare_failure_scenarios',
    description:
      'Compare 2 to 4 failure scenarios by running the existing prediction for each and computing overlap of affected assets. Read-only.',
    inputSchema: z.object({
      scenarios: z
        .array(z.object({ assetId: idSchema, failureType: failureTypeSchema, severity: z.enum(SEVERITIES) }))
        .min(2)
        .max(4),
    }),
    callback: guarded('compare_failure_scenarios', async ({ scenarios }) => {
      const missing = requireTwin();
      if (missing) return missing;
      const results = [];
      for (const s of scenarios) {
        const prediction = await runPrediction(s.assetId, s.failureType, s.severity);
        results.push({ scenario: s, prediction });
      }
      const ok = results.filter((r) => !r.prediction.error);
      const sets = ok.map((r) => new Set(r.prediction.affected.map((a) => a.nodeId)));
      const union = new Set(sets.flatMap((set) => [...set]));
      const shared = [...union].filter((id) => sets.every((set) => set.has(id)));
      const ranked = [...ok].sort((a, b) => b.prediction.totalAffected - a.prediction.totalAffected);
      return {
        dataKind: 'prediction_comparison',
        results: results.map((r) =>
          r.prediction.error
            ? { scenario: r.scenario, error: r.prediction.error, message: r.prediction.message }
            : {
                scenario: r.scenario,
                modelSource: r.prediction.modelSource,
                totalAffected: r.prediction.totalAffected,
                criticalCount: r.prediction.criticalCount,
                riskLevel: r.prediction.riskLevel,
              },
        ),
        comparison: {
          largestImpact: ranked[0] ? ranked[0].scenario : null,
          uniqueAffectedAcrossScenarios: union.size,
          affectedInAllScenarios: shared.length,
          note: 'Counts come from the prediction responses; affected lists are truncated to 15 nodes per scenario.',
        },
      };
    }),
  });

  const proposeSimulation = tool({
    name: 'propose_map_simulation',
    description:
      'Propose a failure simulation for the user to run on the 3D map. This does NOT run anything; the user must confirm it in the interface. Use when the user wants to see a scenario on the map.',
    inputSchema: z.object({
      assetId: idSchema,
      failureType: failureTypeSchema,
      severity: z.enum(SEVERITIES),
      focusTypes: z.array(z.enum(TWIN_ASSET_TYPES)).max(5).default([]),
      rationale: z.string().trim().min(1).max(300),
    }),
    callback: guarded('propose_map_simulation', async ({ assetId, failureType, severity, focusTypes, rationale }) => {
      const missing = requireTwin();
      if (missing) return missing;
      const asset = assetById.get(assetId);
      if (!asset) return { error: 'asset_not_found', message: `No asset with id "${assetId}" is in the current twin dataset.` };
      const check = scenarioFor(asset, failureType);
      if (check.error) return check;
      if (collector.proposals.length >= 3) return { error: 'too_many_proposals', message: 'At most 3 simulations can be proposed per answer.' };
      collector.proposals.push({
        action: 'simulate-failure',
        targetAssetId: asset.id,
        targetName: asset.name,
        failureType,
        failureTypeLabel: check.scenario.name,
        severity,
        focusTypes,
        rationale,
      });
      return { status: 'proposed', requiresUserConfirmation: true, message: 'The user will see a confirm button for this simulation.' };
    }),
  });

  return [searchSchemes, getSchemeDetails, getVendorFindings, listAssets, getDependencies, predictImpact, compareScenarios, proposeSimulation];
}
