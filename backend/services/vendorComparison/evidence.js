/**
 * Deterministic fact extraction from page text. Every fact keeps the page
 * number and the exact line it came from, so evidence is always quotable.
 */

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const MULTIPLIERS = { crore: 1e7, crores: 1e7, cr: 1e7, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, million: 1e6, mn: 1e6 };

const CLAIM_WORDS = /\b(claim(?:ed)?|expen(?:se|diture|ded)|spent|utili[sz](?:ed|ation)|invoice[ds]?|bill(?:ed)?|incurred|payment)\b/i;
const BUDGET_WORDS = /\b(budget|sanction(?:ed)?|allocat(?:ed|ion)|estimated cost|outlay|approved cost|project cost)\b/i;
const TOTAL_WORDS = /\b(total|cumulative|overall|grand)\b/i;
const COMPLETION_WORDS = /\b(complet(?:e|ed|ion)|progress|achieved|done|physical)\b/i;
const FINISH_DATE_WORDS = /\b(complet(?:e|ed|ion)|handover|commission(?:ed|ing)?|finish(?:ed)?|expected|revised|target)\b/i;

const QUANTITY_UNITS = {
  km: 'km', kms: 'km', kilometre: 'km', kilometres: 'km', kilometer: 'km', kilometers: 'km',
  m: 'm', metre: 'm', metres: 'm', meter: 'm', meters: 'm', rmt: 'm',
  kl: 'kl', kilolitre: 'kl', kilolitres: 'kl', kiloliter: 'kl', kiloliters: 'kl',
  litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  units: 'units', nos: 'units', 'no.': 'units', numbers: 'units',
  households: 'households', connections: 'connections', toilets: 'toilets', tanks: 'tanks', pumps: 'pumps',
  borewells: 'borewells', streetlights: 'streetlights', classrooms: 'classrooms', houses: 'houses',
};

const toNumber = (raw) => {
  const value = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
};

export function splitLines(pages) {
  const lines = [];
  for (const { page, text } of pages) {
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (line) lines.push({ page, line });
    }
  }
  return lines;
}

const looksLikeHeading = (line) =>
  line.length >= 3 &&
  line.length <= 80 &&
  !/[.:;,]$/.test(line) &&
  (/^(\d+(\.\d+)*[.)]?\s+)[A-Z]/.test(line) || /^(phase|section|part|annex(ure)?|schedule)\b/i.test(line) || (line === line.toUpperCase() && /[A-Z]{3}/.test(line)));

function withSections(lines) {
  let section = null;
  return lines.map((entry) => {
    if (looksLikeHeading(entry.line)) section = entry.line;
    return { ...entry, section };
  });
}

export function parseAmounts(line) {
  const results = [];
  const pattern = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lac|million|mn)?\b|([\d,]+(?:\.\d+)?)\s*(crores?|lakhs?|lacs?|lac)\b/gi;
  for (const match of line.matchAll(pattern)) {
    const number = toNumber(match[1] ?? match[3]);
    if (number === null) continue;
    const unit = (match[2] ?? match[4] ?? '').toLowerCase();
    results.push({ value: Math.round(number * (MULTIPLIERS[unit] ?? 1)), raw: match[0].trim() });
  }
  return results;
}

export function parseDates(line) {
  const results = [];
  const push = (y, m, d, raw) => {
    const date = new Date(Date.UTC(y, m, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m && date.getUTCDate() === d && y >= 1990 && y <= 2100) {
      results.push({ date: date.toISOString().slice(0, 10), raw });
    }
  };
  for (const m of line.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) push(+m[1], +m[2] - 1, +m[3], m[0]);
  // Indian convention: day/month/year.
  for (const m of line.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) push(+m[3], +m[2] - 1, +m[1], m[0]);
  for (const m of line.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g)) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) push(+m[3], month, +m[1], m[0]);
  }
  for (const m of line.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g)) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month !== undefined) push(+m[3], month, +m[2], m[0]);
  }
  return results;
}

export function parsePercentages(line) {
  return [...line.matchAll(/(\d{1,3}(?:\.\d+)?)\s*(?:%|per\s?cent)/gi)]
    .map((m) => ({ value: Number(m[1]), raw: m[0] }))
    .filter((p) => p.value >= 0 && p.value <= 100);
}

export function parseQuantities(line) {
  const results = [];
  for (const m of line.matchAll(/([\d,]+(?:\.\d+)?)\s*(kms?|kilomet(?:re|er)s?|met(?:re|er)s?|rmt|m|kl|kilolit(?:re|er)s?|lit(?:re|er)s?|units|nos|no\.|numbers|households|connections|toilets|tanks|pumps|borewells|streetlights|classrooms|houses)\b(?:\s+(?:of\s+)?([a-z]+))?/gi)) {
    const value = toNumber(m[1]);
    const unit = QUANTITY_UNITS[m[2].toLowerCase()];
    if (value === null || !unit) continue;
    results.push({ value, unit, item: m[3]?.toLowerCase() ?? null, raw: m[0].trim() });
  }
  return results;
}

/** Extracts quotable facts from one document's pages. */
export function extractFacts(pages) {
  const lines = withSections(splitLines(pages));
  const facts = { amounts: [], dates: [], percentages: [], quantities: [], vendorName: null, phase: null, sections: [] };

  for (const entry of lines) {
    const base = { page: entry.page, section: entry.section, quote: entry.line.slice(0, 300) };
    if (looksLikeHeading(entry.line)) facts.sections.push({ title: entry.line, page: entry.page });

    for (const amount of parseAmounts(entry.line)) {
      facts.amounts.push({
        ...base,
        ...amount,
        kind: CLAIM_WORDS.test(entry.line) ? 'claimed' : BUDGET_WORDS.test(entry.line) ? 'budget' : 'other',
        isTotal: TOTAL_WORDS.test(entry.line),
      });
    }
    for (const date of parseDates(entry.line)) {
      facts.dates.push({ ...base, ...date, isFinishDate: FINISH_DATE_WORDS.test(entry.line) });
    }
    if (COMPLETION_WORDS.test(entry.line)) {
      for (const pct of parsePercentages(entry.line)) facts.percentages.push({ ...base, ...pct });
    }
    for (const qty of parseQuantities(entry.line)) facts.quantities.push({ ...base, ...qty });

    if (!facts.vendorName) {
      const vendor = entry.line.match(/\b(?:vendor|contractor|agency|submitted by|firm)(?:\s+name)?\s*[:\-–]\s*(.{2,100})$/i);
      if (vendor) facts.vendorName = { value: vendor[1].trim(), ...base };
    }
    if (!facts.phase) {
      const phase = entry.line.match(/\bphase\s*[-:#]?\s*(\d{1,2}|i{1,3}|iv|v)\b/i);
      if (phase) {
        const roman = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 }[phase[1].toLowerCase()];
        facts.phase = { value: roman ?? Number(phase[1]), ...base };
      }
    }
  }
  return facts;
}

/** The vendor's claimed amount: a "total" claim line if present, otherwise the largest claim. */
export function pickClaimedTotal(facts) {
  const claims = facts.amounts.filter((a) => a.kind === 'claimed');
  if (claims.length === 0) return null;
  const totals = claims.filter((a) => a.isTotal);
  const pool = totals.length ? totals : claims;
  return pool.reduce((best, a) => (a.value > best.value ? a : best));
}
