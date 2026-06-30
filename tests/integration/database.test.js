import db from '../../src/database/db.js';

describe('Database Integration Tests', () => {
  // Clear tables before running tests
  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    db.close();
  });

  test('should insert and retrieve an event', () => {
    const event = {
      title: 'Soirée JdR Cthulhu',
      type: 'Partie de JdR',
      start_date: '2026-07-12',
      end_date: '2026-07-14',
      start_time: '20:00',
      end_time: '23:30',
      duration: '04:00',
      desc_short: 'Un scénario d’horreur indicible.',
      desc_org: 'Venez nombreux et avec des dés.',
      channels: JSON.stringify(['111', '222']),
      roles: JSON.stringify([]),
      images: JSON.stringify([]),
      documents: JSON.stringify([]),
      links: JSON.stringify([]),
      is_pinned: 1,
      is_pinged: 0,
      discord_messages: JSON.stringify({})
    };

    const stmt = db.prepare(`
      INSERT INTO events (
        title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org,
        channels, roles, images, documents, links, is_pinned, is_pinged, discord_messages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      event.title, event.type, event.start_date, event.end_date, event.start_time, event.end_time, event.duration, event.desc_short, event.desc_org,
      event.channels, event.roles, event.images, event.documents, event.links,
      event.is_pinned, event.is_pinged, event.discord_messages
    );

    expect(result.lastInsertRowid).toBeDefined();

    const savedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    expect(savedEvent.title).toBe('Soirée JdR Cthulhu');
    expect(JSON.parse(savedEvent.channels)).toEqual(['111', '222']);
  });

  test('should handle registrations and unique constraints (ON CONFLICT)', () => {
    // 1. Insert an event
    const eventInsert = db.prepare(`
      INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, discord_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Event A', 'Partie', '2026-07-12', null, '20:00', null, '01:00', 'Accroche', 'Log', '[]', '[]', '[]', '[]', '[]', '{}');

    const eventId = eventInsert.lastInsertRowid;

    // 2. Insert registration
    const stmtReg = db.prepare(`
      INSERT INTO registrations (event_id, user_id, username, status)
      VALUES (?, ?, ?, ?)
    `);

    stmtReg.run(eventId, '12345', 'PlayerOne', 'interesse');

    const reg = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND user_id = ?').get(eventId, '12345');
    expect(reg.status).toBe('interesse');

    // 3. Test unique constraint override (ON CONFLICT DO UPDATE)
    db.prepare(`
      INSERT INTO registrations (event_id, user_id, username, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(event_id, user_id) DO UPDATE SET status = ?, updated_at = CURRENT_TIMESTAMP
    `).run(eventId, '12345', 'PlayerOne', 'inscrit', 'inscrit');

    const regUpdated = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND user_id = ?').get(eventId, '12345');
    expect(regUpdated.status).toBe('inscrit');
  });

  test('should delete registrations on cascade when event is deleted', () => {
    const eventInsert = db.prepare(`
      INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, discord_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('Event B', 'Partie', '2026-07-13', null, '20:00', null, '02:00', 'Accroche', 'Log', '[]', '[]', '[]', '[]', '[]', '{}');

    const eventId = eventInsert.lastInsertRowid;

    db.prepare(`
      INSERT INTO registrations (event_id, user_id, username, status)
      VALUES (?, ?, ?, ?)
    `).run(eventId, '99999', 'PlayerTwo', 'interesse');

    // Verify it exists
    let regCount = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?').get(eventId).count;
    expect(regCount).toBe(1);

    // Delete event
    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);

    // Verify registrations CASCADE deleted
    regCount = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?').get(eventId).count;
    expect(regCount).toBe(0);
  });
});
