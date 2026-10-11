/**
 * MongoDB persistence for vendor reports embedded in Scheme documents.
 * Writes are single atomic updates so retries cannot duplicate a report or
 * double-count its claimed expense.
 */
export function createReportRepository(Scheme) {
  async function findScheme(schemeId) {
    return Scheme.findOne({ id: schemeId }).lean();
  }

  /** Inserts the report unless one with the same PDF hash already exists. */
  async function insertReportOnce(schemeId, record) {
    const inc = {};
    const options = {};
    if (Number.isFinite(record.expenseClaimed) && record.expenseClaimed > 0) {
      inc.budgetUtilized = record.expenseClaimed;
      if (Number.isFinite(record.phase)) {
        inc['phases.$[reported].spent'] = record.expenseClaimed;
        options.arrayFilters = [{ 'reported.id': record.phase }];
      }
    }
    const update = { $push: { vendorReports: record }, $set: { lastUpdated: new Date() } };
    if (Object.keys(inc).length) update.$inc = inc;

    const result = await Scheme.updateOne(
      { id: schemeId, 'vendorReports.documentSha256': { $ne: record.documentSha256 } },
      update,
      options,
    );
    return result.modifiedCount === 1;
  }

  async function replaceReport(schemeId, reportId, record) {
    const result = await Scheme.updateOne(
      { id: schemeId, 'vendorReports.id': reportId },
      { $set: { 'vendorReports.$': record, lastUpdated: new Date() } },
    );
    return result.matchedCount === 1;
  }

  async function loadForUpdate(schemeId) {
    return Scheme.findOne({ id: schemeId });
  }

  return { findScheme, insertReportOnce, replaceReport, loadForUpdate };
}
