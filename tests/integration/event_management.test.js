import request from 'supertest';
import app from '../../src/server/index.js';
import db from '../../src/database/db.js';

describe('Event Management Integration Tests (Delete, Block, Republish)', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';
  let createdEventId;

  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();

    // Insert a dummy event to test actions on it
    const stmt = db.prepare(`
      INSERT INTO events (
        title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org,
        channels, roles, images, documents, links, is_pinned, is_pinged, is_blocked, discord_messages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      'Event Test Management',
      'Table ronde',
      '2026-07-20',
      '2026-07-20',
      '14:00',
      '16:00',
      '02:00',
      'Accroche',
      'Organisation',
      JSON.stringify(['123456']),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      0,
      0,
      0,
      JSON.stringify({ '123456': 'msg_111' })
    );

    createdEventId = result.lastInsertRowid;
  });

  afterAll(() => {
    db.close();
  });

  test('should toggle block state on POST /events/:id/toggle-block', async () => {
    // 1. Toggle to block (is_blocked = 1)
    let response = await request(app)
      .post(`/events/${createdEventId}/toggle-block`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302); // Redirects to details page

    let event = db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    expect(event.is_blocked).toBe(1);

    // 2. Toggle back to unblock (is_blocked = 0)
    response = await request(app)
      .post(`/events/${createdEventId}/toggle-block`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);

    event = db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    expect(event.is_blocked).toBe(0);
  });

  test('should trigger republish logic on POST /events/:id/republish', async () => {
    const response = await request(app)
      .post(`/events/${createdEventId}/republish`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    const messages = JSON.parse(event.discord_messages);
    expect(messages['123456']).toBeDefined();
  });

  test('should delete the event on POST /events/:id/delete', async () => {
    // Register a dummy user registration first to assert cascade deletion
    db.prepare('INSERT INTO registrations (event_id, user_id, username, status) VALUES (?, ?, ?, ?)')
      .run(createdEventId, 'user_99', 'test_user', 'inscrit');

    const response = await request(app)
      .post(`/events/${createdEventId}/delete`)
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);

    // Verify event is deleted from database
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    expect(event).toBeUndefined();

    // Verify registrations are cascaded deleted
    const regs = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(createdEventId);
    expect(regs.length).toBe(0);
  });

  test('should edit descriptions on POST /events/:id/edit-descriptions', async () => {
    const response = await request(app)
      .post(`/events/${createdEventId}/edit-descriptions`)
      .send({ desc_short: 'New short desc', desc_org: 'New org logistics' })
      .auth(adminUser, adminPassword);

    expect(response.status).toBe(302);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(createdEventId);
    expect(event.desc_short).toBe('New short desc');
    expect(event.desc_org).toBe('New org logistics');
  });
});
