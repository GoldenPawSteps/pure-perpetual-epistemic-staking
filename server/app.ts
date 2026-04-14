import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import type { AppState } from '../src/types.js';
import { isValidAppState } from '../src/stateValidation.js';
import { AuthStore } from './store.js';

interface AuthenticatedRequest extends Request {
  accountId?: string;
}

interface AppOptions {
  authStore?: AuthStore;
  jwtSecret?: string;
}

const DEFAULT_JWT_SECRET = process.env.PPES_JWT_SECRET ?? 'ppes-dev-secret-change-me';

function createToken(accountId: string, jwtSecret: string): string {
  return jwt.sign({ sub: accountId }, jwtSecret, { expiresIn: '7d' });
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

function requireAuth(jwtSecret: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = readBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
      if (typeof payload.sub !== 'string') {
        res.status(401).json({ error: 'Invalid session token.' });
        return;
      }

      req.accountId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Session expired or invalid.' });
    }
  };
}

export function createServerApp(options: AppOptions = {}) {
  const authStore = options.authStore ?? new AuthStore();
  const jwtSecret = options.jwtSecret ?? DEFAULT_JWT_SECRET;
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    const { name, password } = req.body as { name?: string; password?: string };
    try {
      const session = await authStore.createAccount(name ?? '', password ?? '');
      const token = createToken(session.accountId, jwtSecret);
      res.status(201).json({ ...session, token });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create account.' });
    }
  });

  app.post('/api/auth/signin', async (req: Request, res: Response) => {
    const { name, password } = req.body as { name?: string; password?: string };
    try {
      const session = await authStore.authenticate(name ?? '', password ?? '');
      const token = createToken(session.accountId, jwtSecret);
      res.json({ ...session, token });
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : 'Unable to sign in.' });
    }
  });

  app.get('/api/auth/session', requireAuth(jwtSecret), async (req: AuthenticatedRequest, res: Response) => {
    const session = await authStore.getSession(req.accountId!);
    if (!session) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    res.json(session);
  });

  app.post('/api/auth/logout', requireAuth(jwtSecret), (_req: AuthenticatedRequest, res: Response) => {
    res.status(204).send();
  });

  app.put('/api/state', requireAuth(jwtSecret), async (req: AuthenticatedRequest, res: Response) => {
    const state = (req.body as { state?: AppState }).state;
    if (!isValidAppState(state)) {
      res.status(400).json({ error: 'Invalid app state payload.' });
      return;
    }

    const session = await authStore.saveState(req.accountId!, state);
    if (!session) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    res.json(session);
  });

  app.post('/api/state/reset', requireAuth(jwtSecret), async (req: AuthenticatedRequest, res: Response) => {
    const session = await authStore.resetState(req.accountId!);
    if (!session) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    res.json(session);
  });

  app.put('/api/auth/password', requireAuth(jwtSecret), async (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    try {
      await authStore.changePassword(req.accountId!, currentPassword ?? '', newPassword ?? '');
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to change password.' });
    }
  });

  app.delete('/api/auth/account', requireAuth(jwtSecret), async (req: AuthenticatedRequest, res: Response) => {
    const { password } = req.body as { password?: string };
    try {
      await authStore.deleteAccount(req.accountId!, password ?? '');
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to delete account.' });
    }
  });

  return app;
}