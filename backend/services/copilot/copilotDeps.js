import Scheme from '../../models/Scheme.js';
import gnnService from '../../utils/gnnImpactService.js';
import { predictImpactWithModelOrFallback, syncGraphFromRequestState } from '../../routes/gnn.js';

/** Read-only adapters over the existing Scheme model and GNN service. */
export const defaultCopilotDeps = {
  schemes: {
    find: (filter, limit) => Scheme.find(filter).sort({ lastUpdated: -1 }).limit(limit).lean(),
    findById: (id) => Scheme.findOne({ id }).lean(),
  },
  gnn: {
    syncGraph: (infraState) => syncGraphFromRequestState({ infraState }),
    hasNode: (id) => Boolean(gnnService.graph?.nodes?.has(id)),
    getNodes: () => gnnService.getGraphNodes(),
    getEdges: () => gnnService.getGraphEdges(),
    getScenarios: () => gnnService.getFailureScenarios(),
    predict: (nodeId, failureType, severity) => predictImpactWithModelOrFallback(nodeId, failureType, severity),
  },
};
