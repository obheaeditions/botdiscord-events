import request from 'supertest';
import app from '../../src/server/index.js';
import client, { resolveGuildMemberByUsername } from '../../src/bot/index.js';
import { publishEventToFacebook } from '../../src/social/facebookPublisher.js';
import db from '../../src/database/db.js';

function insertEvent(overrides = {}) {
  const insert = db.prepare(`
    INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, discord_messages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.title || 'Soirée Jeux',
    'Partie de Jeu',
    '2026-08-01',
    null,
    '20:00',
    null,
    '02:00',
    'Accroche',
    'Organisation',
    '[]',
    '[]',
    JSON.stringify(overrides.images || []),
    '[]',
    '[]',
    '{}'
  );
  return insert.lastInsertRowid;
}

function setClientReady(ready) {
  Object.defineProperty(client, 'readyAt', {
    get: () => (ready ? new Date() : null),
    configurable: true
  });
}

describe('Discord username resolution', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
    setClientReady(false);
  });

  afterAll(() => {
    setClientReady(false);
  });

  test('returns null when the Discord client is not ready', async () => {
    const result = await resolveGuildMemberByUsername('someone');
    expect(result).toBeNull();
  });

  test('returns the matching member (case-insensitive) when found', async () => {
    setClientReady(true);
    const mockMember = { user: { id: '42', username: 'jean_dupont' } };
    const mockGuild = {
      members: {
        search: async ({ query }) => {
          expect(query).toBe('Jean_Dupont');
          return [mockMember];
        }
      }
    };
    client.guilds.cache.first = () => mockGuild;

    const result = await resolveGuildMemberByUsername('Jean_Dupont');
    expect(result).toBe(mockMember);

    setClientReady(false);
  });

  test('returns null when no exact match is found', async () => {
    setClientReady(true);
    const mockGuild = {
      members: {
        search: async () => [{ user: { id: '99', username: 'someone_else' } }]
      }
    };
    client.guilds.cache.first = () => mockGuild;

    const result = await resolveGuildMemberByUsername('unknown_handle');
    expect(result).toBeNull();

    setClientReady(false);
  });
});

describe('Public registration page', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
    setClientReady(false);
  });

  afterAll(() => {
    setClientReady(false);
  });

  test('GET renders the form for an existing, open event', async () => {
    const eventId = insertEvent();
    const response = await request(app).get(`/register/${eventId}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain('Soirée Jeux');
  });

  test('GET returns 404 for an unknown event, without requiring authentication', async () => {
    const response = await request(app).get('/register/999999');
    expect(response.status).toBe(404);
  });

  test('POST records the registration with a synthetic id when the handle is not resolved', async () => {
    const eventId = insertEvent();

    const response = await request(app)
      .post(`/register/${eventId}`)
      .send({ discord_handle: 'inconnu_sur_discord', email: 'contact@example.com' });

    expect(response.status).toBe(200);
    expect(response.text).toContain('Inscription confirmée');

    const regs = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(eventId);
    expect(regs.length).toBe(1);
    expect(regs[0].source).toBe('facebook');
    expect(regs[0].status).toBe('inscrit');
    expect(regs[0].user_id.startsWith('fb_')).toBe(true);
    expect(regs[0].username).toBe('inconnu_sur_discord');
    expect(regs[0].email).toBe('contact@example.com');
  });

  test('POST records the registration with the real Discord user_id when the handle resolves', async () => {
    const eventId = insertEvent();

    setClientReady(true);
    const mockGuild = {
      members: {
        search: async () => [{ user: { id: '555', username: 'membre_reel' } }]
      }
    };
    client.guilds.cache.first = () => mockGuild;

    const response = await request(app)
      .post(`/register/${eventId}`)
      .send({ discord_handle: 'membre_reel' });

    expect(response.status).toBe(200);

    const regs = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(eventId);
    expect(regs.length).toBe(1);
    expect(regs[0].user_id).toBe('555');
    expect(regs[0].username).toBe('membre_reel');
    expect(regs[0].source).toBe('facebook');

    setClientReady(false);
  });

  test('POST rejects an empty handle without writing to the database', async () => {
    const eventId = insertEvent();

    const response = await request(app)
      .post(`/register/${eventId}`)
      .send({ discord_handle: '' });

    expect(response.status).toBe(400);
    const regs = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(eventId);
    expect(regs.length).toBe(0);
  });

  test('POST refuses registration when the event is blocked', async () => {
    const eventId = insertEvent();
    db.prepare('UPDATE events SET is_blocked = 1 WHERE id = ?').run(eventId);

    const response = await request(app)
      .post(`/register/${eventId}`)
      .send({ discord_handle: 'peu_importe' });

    expect(response.status).toBe(400);
    expect(response.text).toContain('fermées');
    const regs = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(eventId);
    expect(regs.length).toBe(0);
  });
});

describe('Facebook publisher', () => {
  const originalFetch = global.fetch;
  const originalPageId = process.env.FACEBOOK_PAGE_ID;
  const originalToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
    process.env.FACEBOOK_PAGE_ID = 'page_123';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'token_abc';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    if (originalPageId === undefined) delete process.env.FACEBOOK_PAGE_ID; else process.env.FACEBOOK_PAGE_ID = originalPageId;
    if (originalToken === undefined) delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN; else process.env.FACEBOOK_PAGE_ACCESS_TOKEN = originalToken;
  });

  test('does nothing when Facebook credentials are not configured', async () => {
    delete process.env.FACEBOOK_PAGE_ID;
    const fetchCalls = [];
    global.fetch = async (...args) => { fetchCalls.push(args); };

    const eventId = insertEvent({ images: ['/uploads/a.jpg'] });
    await publishEventToFacebook(eventId);

    expect(fetchCalls.length).toBe(0);
  });

  test('skips publication when the event has no image', async () => {
    const fetchCalls = [];
    global.fetch = async (...args) => { fetchCalls.push(args); };

    const eventId = insertEvent({ images: [] });
    await publishEventToFacebook(eventId);

    expect(fetchCalls.length).toBe(0);
  });

  test('creates a photo post and stores the returned id on first publication', async () => {
    const fetchCalls = [];
    global.fetch = async (url, opts) => {
      fetchCalls.push({ url, opts });
      return { ok: true, json: async () => ({ id: 'photo_999' }) };
    };

    const eventId = insertEvent({ images: ['/uploads/a.jpg'] });
    await publishEventToFacebook(eventId);

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v19.0/page_123/photos');

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    expect(event.facebook_post_id).toBe('photo_999');
  });

  test('updates the caption on a subsequent call instead of re-posting the photo', async () => {
    const eventId = insertEvent({ images: ['/uploads/a.jpg'] });
    db.prepare('UPDATE events SET facebook_post_id = ? WHERE id = ?').run('photo_999', eventId);

    const fetchCalls = [];
    global.fetch = async (url, opts) => {
      fetchCalls.push({ url, opts });
      return { ok: true, json: async () => ({ success: true }) };
    };

    await publishEventToFacebook(eventId);

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v19.0/photo_999');
  });

  test('throws when the Graph API responds with an error', async () => {
    global.fetch = async () => ({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'Token invalide' } })
    });

    const eventId = insertEvent({ images: ['/uploads/a.jpg'] });
    await expect(publishEventToFacebook(eventId)).rejects.toThrow('Token invalide');
  });
});

describe('Per-event Facebook opt-in (routes)', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';
  const originalFetch = global.fetch;

  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
    process.env.FACEBOOK_PAGE_ID = 'page_123';
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'token_abc';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    delete process.env.FACEBOOK_PAGE_ID;
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  });

  test('creating an event without checking the box does not publish to Facebook', async () => {
    const fetchCalls = [];
    global.fetch = async (...args) => { fetchCalls.push(args); return { ok: true, json: async () => ({ id: 'x' }) }; };

    const response = await request(app)
      .post('/events/create')
      .auth(adminUser, adminPassword)
      .field('title', 'Sans Facebook')
      .field('type', 'Partie de Jeu')
      .field('start_date', '2026-08-01')
      .field('start_time', '20:00')
      .field('duration', '01:00')
      .field('desc_short', 'Accroche')
      .field('desc_org', 'Organisation')
      .field('channels', '123456')
      .attach('images', Buffer.from('img'), 'a.png');

    expect(response.status).toBe(302);
    // Give the (non-triggered) fire-and-forget call a tick to prove it never fires
    await new Promise(resolve => setImmediate(resolve));
    expect(fetchCalls.length).toBe(0);

    const event = db.prepare('SELECT * FROM events ORDER BY id DESC').get();
    expect(event.publish_facebook).toBe(0);
  });

  test('creating an event with the box checked publishes to Facebook', async () => {
    const fetchCalls = [];
    global.fetch = async (url, opts) => { fetchCalls.push({ url, opts }); return { ok: true, json: async () => ({ id: 'photo_1' }) }; };

    const response = await request(app)
      .post('/events/create')
      .auth(adminUser, adminPassword)
      .field('title', 'Avec Facebook')
      .field('type', 'Partie de Jeu')
      .field('start_date', '2026-08-01')
      .field('start_time', '20:00')
      .field('duration', '01:00')
      .field('desc_short', 'Accroche')
      .field('desc_org', 'Organisation')
      .field('channels', '123456')
      .field('publish_facebook', '1')
      .attach('images', Buffer.from('img'), 'a.png');

    expect(response.status).toBe(302);
    await new Promise(resolve => setImmediate(resolve));

    const event = db.prepare('SELECT * FROM events ORDER BY id DESC').get();
    expect(event.publish_facebook).toBe(1);
    expect(fetchCalls.length).toBe(1);
    expect(event.facebook_post_id).toBe('photo_1');
  });

  test('enabling the checkbox on edit triggers the first publication', async () => {
    const eventId = insertEvent({ images: ['/uploads/a.jpg'] });

    const fetchCalls = [];
    global.fetch = async (url) => { fetchCalls.push(url); return { ok: true, json: async () => ({ id: 'photo_2' }) }; };

    const response = await request(app)
      .post(`/events/${eventId}/edit`)
      .auth(adminUser, adminPassword)
      .send({
        title: 'Soirée Jeux',
        type: 'Partie de Jeu',
        start_date: '2026-08-01',
        start_time: '20:00',
        duration: '02:00',
        desc_short: 'Accroche',
        desc_org: 'Organisation',
        channels: ['123456'],
        publish_facebook: '1'
      });

    expect(response.status).toBe(302);
    await new Promise(resolve => setImmediate(resolve));

    expect(fetchCalls.length).toBe(1);
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    expect(event.publish_facebook).toBe(1);
    expect(event.facebook_post_id).toBe('photo_2');
  });

  test('republish-facebook route rejects events where the option is disabled', async () => {
    const eventId = insertEvent();

    const response = await request(app)
      .post(`/events/${eventId}/republish-facebook`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(400);
  });
});
