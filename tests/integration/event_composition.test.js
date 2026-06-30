import request from 'supertest';
import app from '../../src/server/index.js';
import db from '../../src/database/db.js';

describe('Event Composition & Waitlist Integration Tests', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';
  let createdEventId;

  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();

    // Insert dummy event
    const stmt = db.prepare(`
      INSERT INTO events (
        title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org,
        channels, roles, images, documents, links, is_pinned, is_pinged, is_blocked, discord_messages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      'Event Composition Test',
      'Partie de JdR',
      '2026-07-25',
      '2026-07-25',
      '19:00',
      '22:00',
      '03:00',
      'Accroche composition',
      'Logistique composition',
      JSON.stringify(['111222']),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      0,
      0,
      0,
      JSON.stringify({ '111222': 'msg_abc' })
    );

    createdEventId = result.lastInsertRowid;
  });

  test('should manually add a participant via POST /events/:id/registrations/add', async () => {
    const response = await request(app)
      .post(`/events/${createdEventId}/registrations/add`)
      .send({ user_id: '999888777', username: 'TestManualPlayer', status: 'inscrit' })
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);

    const reg = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND user_id = ?').get(createdEventId, '999888777');
    expect(reg).toBeDefined();
    expect(reg.username).toBe('TestManualPlayer');
    expect(reg.status).toBe('inscrit');
  });

  test('should move an existing participant to waitlist via POST /events/:id/registrations/:userId/waitlist', async () => {
    // Insert initial registered participant
    db.prepare('INSERT INTO registrations (event_id, user_id, username, status) VALUES (?, ?, ?, ?)')
      .run(createdEventId, '12345', 'JohnDoe', 'inscrit');

    const response = await request(app)
      .post(`/events/${createdEventId}/registrations/12345/waitlist`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);

    const reg = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND user_id = ?').get(createdEventId, '12345');
    expect(reg.status).toBe('en_attente');
  });

  test('should trigger composition publishing via POST /events/:id/publish-composition', async () => {
    const response = await request(app)
      .post(`/events/${createdEventId}/publish-composition`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);
  });
});
