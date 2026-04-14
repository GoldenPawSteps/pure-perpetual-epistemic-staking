import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServerApp } from './app.js';
import { AuthStore } from './store.js';

let tempDir = '';

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'ppes-auth-'));
});

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe('auth api', () => {
  it('creates an account and restores session state', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    expect(signup.body.accountName).toBe('Alice');
    expect(typeof signup.body.token).toBe('string');

    const session = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .expect(200);

    expect(session.body.accountId).toBe(signup.body.accountId);
    expect(session.body.state.user.name).toBe('Alice');
  });

  it('rejects duplicate usernames', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    const duplicate = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'alice', password: 'password123' })
      .expect(400);

    expect(duplicate.body.error).toContain('already registered');
  });

  it('persists updated market state per account', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    const nextState = {
      ...signup.body.state,
      user: {
        ...signup.body.state.user,
        balance: 0.25,
      },
    };

    await request(app)
      .put('/api/state')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ state: nextState })
      .expect(200);

    const signin = await request(app)
      .post('/api/auth/signin')
      .send({ name: 'Alice', password: 'password123' })
      .expect(200);

    expect(signin.body.state.user.balance).toBe(0.25);
  });

  it('changes password and allows sign-in with new password', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
      .expect(204);

    await request(app)
      .post('/api/auth/signin')
      .send({ name: 'Alice', password: 'newpassword456' })
      .expect(200);

    await request(app)
      .post('/api/auth/signin')
      .send({ name: 'Alice', password: 'password123' })
      .expect(401);
  });

  it('rejects password change with wrong current password', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' })
      .expect(400);

    expect(res.body.error).toContain('incorrect');
  });

  it('deletes account and rejects subsequent session restore', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ password: 'password123' })
      .expect(204);

    await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .expect(404);
  });

  it('rejects account deletion with wrong password', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ password: 'wrongpassword' })
      .expect(400);
  });

  it('resets only the authenticated account state', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const alice = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    const bob = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Bob', password: 'password123' })
      .expect(201);

    await request(app)
      .put('/api/state')
      .set('Authorization', `Bearer ${alice.body.token}`)
      .send({
        state: {
          ...alice.body.state,
          user: {
            ...alice.body.state.user,
            balance: 0.1,
          },
        },
      })
      .expect(200);

    const reset = await request(app)
      .post('/api/state/reset')
      .set('Authorization', `Bearer ${alice.body.token}`)
      .expect(200);

    expect(reset.body.state.user.balance).toBe(1);

    const bobSession = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${bob.body.token}`)
      .expect(200);

    expect(bobSession.body.accountName).toBe('Bob');
    expect(bobSession.body.state.user.balance).toBe(1);
  });

  it('claims created by one user are visible to other users', async () => {
    const app = createServerApp({
      authStore: new AuthStore(path.join(tempDir, 'db.json')),
      jwtSecret: 'test-secret',
    });

    const alice = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alice', password: 'password123' })
      .expect(201);

    const bob = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Bob', password: 'password123' })
      .expect(201);

    // Alice adds a new claim and saves her state.
    const newClaim = {
      id: 'claim-x',
      title: 'Shared claim',
      description: 'A claim Alice created.',
      creatorId: alice.body.accountId as string,
      createdAt: Date.now(),
      yesStake: 0,
      noStake: 0,
    };
    const aliceState = {
      ...alice.body.state,
      claims: [...alice.body.state.claims, newClaim],
      priceHistory: {
        ...alice.body.state.priceHistory,
        'claim-x': [{ timestamp: Date.now(), yesPrice: 0.5, noPrice: 0.5 }],
      },
    };

    await request(app)
      .put('/api/state')
      .set('Authorization', `Bearer ${alice.body.token}`)
      .send({ state: aliceState })
      .expect(200);

    // Bob should now see Alice's claim in his session.
    const bobSession = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${bob.body.token}`)
      .expect(200);

    const claimIds = (bobSession.body.state.claims as { id: string }[]).map(c => c.id);
    expect(claimIds).toContain('claim-x');
  });
});