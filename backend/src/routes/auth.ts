import { Router, Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db';
import { authenticate } from '../middleware/auth';
import { audit } from '../services/auditService';
import { logger } from '../utils/logger';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

function getMsalApp(tenantId?: string) {
  const authority = tenantId
    ? `https://login.microsoftonline.com/${tenantId}`
    : `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`;

  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      authority,
    },
  });
}

// GET /api/auth/login - Initiate OAuth flow
router.get('/login', async (req: Request, res: Response) => {
  try {
    const app = getMsalApp();
    const authUrl = await app.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: `${process.env.API_BASE_URL}/api/auth/callback`,
      state: req.query.redirect as string || '/',
      prompt: 'select_account',
    });
    res.json({ authUrl });
  } catch (err) {
    logger.error('Failed to generate auth URL', err);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

// GET /api/auth/callback - Handle OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    logger.warn('OAuth callback error', { error, error_description });
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=No+authorization+code`);
  }

  try {
    const app = getMsalApp();
    const tokenResponse = await app.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: `${process.env.API_BASE_URL}/api/auth/callback`,
    });

    if (!tokenResponse?.account) {
      return res.redirect(`${frontendUrl}/login?error=Authentication+failed`);
    }

    const { localAccountId: oid, name, username: email } = tokenResponse.account;

    // Upsert user
    const { rows } = await query<{ id: string; role: string; is_active: boolean; display_name: string }>(
      `INSERT INTO users (azure_oid, display_name, email, role)
       VALUES ($1, $2, $3, 'viewer')
       ON CONFLICT (azure_oid) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             email = EXCLUDED.email,
             last_login = NOW()
       RETURNING id, role, is_active, display_name`,
      [oid, name || email, email]
    );

    const user = rows[0];
    if (!user.is_active) {
      return res.redirect(`${frontendUrl}/login?error=Account+deactivated`);
    }

    const token = jwt.sign(
      { id: user.id, azure_oid: oid, display_name: user.display_name, email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any }
    );

    await audit({
      userId: user.id,
      userName: user.display_name,
      action: 'user.login',
      details: { email },
    });

    const redirectPath = state && state.startsWith('/') ? state : '/';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&redirect=${encodeURIComponent(redirectPath)}`);
  } catch (err) {
    logger.error('OAuth callback failed', err);
    res.redirect(`${frontendUrl}/login?error=Authentication+failed`);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT id, azure_oid, display_name, email, role, last_login, created_at
     FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (!rows[0]) throw new AppError(404, 'User not found');
  res.json(rows[0]);
}));

// POST /api/auth/logout
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await audit({
    userId: req.user!.id,
    userName: req.user!.display_name,
    action: 'user.logout',
  });
  res.json({ message: 'Logged out successfully' });
}));

export default router;
