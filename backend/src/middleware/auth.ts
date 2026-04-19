import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db';
import { logger } from '../utils/logger';

export interface AuthUser {
  id: string;
  azure_oid: string;
  display_name: string;
  email: string;
  role: 'super_admin' | 'ca_admin' | 'azure_admin' | 'viewer';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser & { iat: number; exp: number };
    req.user = {
      id: payload.id,
      azure_oid: payload.azure_oid,
      display_name: payload.display_name,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err) {
    logger.warn('Invalid JWT token', { err });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
}

export async function refreshUserFromDB(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next();
  try {
    const { rows } = await query<AuthUser>(
      'SELECT id, azure_oid, display_name, email, role FROM users WHERE id = $1 AND is_active = true',
      [req.user.id]
    );
    if (rows[0]) req.user = rows[0];
  } catch (err) {
    logger.error('Failed to refresh user from DB', err);
  }
  next();
}
