import crypto from 'crypto';

const AUTHORITY_LEVELS = {
  0: { name: 'local_representative', title: 'Local Representative', timeframeDays: 7 },
  1: { name: 'area_officer', title: 'Area Officer', timeframeDays: 10 },
  2: { name: 'district_magistrate', title: 'District Magistrate', timeframeDays: 14 },
  3: { name: 'state_authority', title: 'State Level Authority', timeframeDays: 21 }
};

export function verifyEscalationChain(escalationHistory) {
  if (!escalationHistory || escalationHistory.length === 0) {
    return { valid: true, message: 'No escalations to verify' };
  }

  for (let i = 0; i < escalationHistory.length; i++) {
    const record = escalationHistory[i];
    if (!record.level && record.level !== 0) {
      return { valid: false, message: `Escalation level missing at record ${i}`, failedAt: i };
    }
    if (!record.authority || !record.escalatedAt) {
      return { valid: false, message: `Escalation record incomplete at ${i}`, failedAt: i };
    }

    if (i > 0) {
      const prevTs = new Date(escalationHistory[i - 1].escalatedAt).getTime();
      const currTs = new Date(record.escalatedAt).getTime();
      if (Number.isNaN(prevTs) || Number.isNaN(currTs) || currTs < prevTs) {
        return { valid: false, message: `Escalation timeline invalid at record ${i}`, failedAt: i };
      }
    }
  }

  return { valid: true, message: 'Escalation timeline verified successfully' };
}

export async function createEscalationRecord(reportId, level, reason) {
  const authority = AUTHORITY_LEVELS[level];
  if (!authority) {
    throw new Error(`Invalid escalation level: ${level}`);
  }

  const escalatedAt = new Date().toISOString();

  return {
    reportId,
    level,
    authority: authority.name,
    authorityName: authority.title,
    escalatedAt,
    reason,
    escalationId: crypto.randomUUID()
  };
}

export function getNextEscalationLevel(currentLevel) {
  const nextLevel = currentLevel + 1;
  if (nextLevel > 3) {
    return null;
  }
  return {
    level: nextLevel,
    ...AUTHORITY_LEVELS[nextLevel]
  };
}

export function getAuthorityDetails(level) {
  return AUTHORITY_LEVELS[level] || AUTHORITY_LEVELS[0];
}

export function calculateEscalationDeadline(currentLevel, fromDate = new Date()) {
  const authority = AUTHORITY_LEVELS[currentLevel];
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() + (authority?.timeframeDays || 7));
  return deadline;
}

export function generateReporterToken(identifier) {
  const timestamp = Date.now().toString();
  const random = crypto.randomBytes(16).toString('hex');
  const combined = `${identifier}-${timestamp}-${random}`;

  return crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex')
    .substring(0, 32);
}

export function hashOriginalReport(reportData) {
  const content = JSON.stringify({
    title: reportData.title,
    description: reportData.description,
    timestamp: reportData.timestamp || Date.now()
  });

  return crypto.createHash('sha256').update(content).digest('hex');
}

export function generateVoterId(reportId, voterIdentifier) {
  const combined = `${reportId}-${voterIdentifier}`;
  return crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex')
    .substring(0, 24);
}

export { AUTHORITY_LEVELS };
