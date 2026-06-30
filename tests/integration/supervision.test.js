import request from 'supertest';
import app from '../../src/server/index.js';
import db from '../../src/database/db.js';

describe('Supervision & Dashboard Integration Tests', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';

  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    db.close();
  });

  test('should return 404 for non-existing event details', async () => {
    const response = await request(app)
      .get('/events/9999')
      .auth(adminUser, adminPassword);
    expect(response.status).toBe(404);
    expect(response.text).toContain('Événement non trouvé.');
  });

  test('should render details and aggregate correct counts', async () => {
    // 1. Insert an event
    const eventInsert = db.prepare(`
      INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, discord_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Cthulhu Session', 'Partie de JdR', '2026-07-12', null, '20:00', null, '04:00', 'Short', 'Org', '[]', '[]', '[]', '[]', '[]', '{}');

    const eventId = eventInsert.lastInsertRowid;

    // 2. Insert registrations with different statuses
    db.prepare('INSERT INTO registrations (event_id, user_id, username, status) VALUES (?, ?, ?, ?)')
      .run(eventId, 'user1', 'Alice', 'inscrit');
    db.prepare('INSERT INTO registrations (event_id, user_id, username, status) VALUES (?, ?, ?, ?)')
      .run(eventId, 'user2', 'Bob', 'interesse');
    db.prepare('INSERT INTO registrations (event_id, user_id, username, status) VALUES (?, ?, ?, ?)')
      .run(eventId, 'user3', 'Charlie', 'interesse');
    db.prepare('INSERT INTO registrations (event_id, user_id, username, status) VALUES (?, ?, ?, ?)')
      .run(eventId, 'user4', 'David', 'pas_interesse');

    // 3. GET event details page
    const response = await request(app)
      .get(`/events/${eventId}`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(200);
    expect(response.text).toContain('Cthulhu Session');
    // Check that counts are aggregated correctly
    expect(response.text).toContain('Alice');
    expect(response.text).toContain('Bob');
    expect(response.text).toContain('Charlie');
    expect(response.text).toContain('David');
  });
});
