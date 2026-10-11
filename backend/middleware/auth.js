import jwt from 'jsonwebtoken';

export const ROLES = Object.freeze(['admin', 'field_worker', 'user']);

function readBearerToken(req) {
  const header = req.headers?.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Verifies the JWT issued by /api/auth (payload `{ userId, role }`) and sets
 * `req.user`. Responds 401 when the token is missing, invalid, or expired.
 */
export function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Sign in to use this feature.', code: 'auth_required' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server authentication is not configured.', code: 'auth_misconfigured' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.userId || !ROLES.includes(payload.role)) {
      return res.status(401).json({ error: 'Your session is invalid. Sign in again.', code: 'auth_invalid' });
    }
    req.user = { userId: String(payload.userId), role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.', code: 'auth_invalid' });
  }
}

/** Must run after `requireAuth`. */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `This action requires one of these roles: ${allowed.join(', ')}.`,
        code: 'forbidden',
      });
    }
    return next();
  };
}
