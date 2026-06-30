import client from '../../src/bot/index.js';
import db from '../../src/database/db.js';

describe('Bot Interactions Integration Tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    db.close();
  });

  test('should reject interaction if user does not have the required role', async () => {
    // 1. Insert event requiring role '777'
    const eventInsert = db.prepare(`
      INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, discord_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'JdR Star Wars',
      'Partie de JdR',
      '2026-07-12',
      null,
      '20:00',
      null,
      '05:00',
      'Short',
      'Org',
      '[]',
      JSON.stringify(['777']),
      '[]',
      '[]',
      '[]',
      '{}'
    );

    const eventId = eventInsert.lastInsertRowid;

    // 2. Mock interaction object where user doesn't have role '777'
    const replyCalls = [];
    const mockInteraction = {
      isButton: () => true,
      customId: `event_${eventId}_inscrit`,
      user: { id: 'u1', username: 'User1' },
      member: {
        roles: {
          cache: {
            some: (fn) => fn({ id: '888' }) // User only has role 888, not 777
          }
        }
      },
      reply: async (args) => {
        replyCalls.push(args);
        return true;
      }
    };

    // 3. Emit event on client
    await client.emit('interactionCreate', mockInteraction);

    // 4. Asserts
    expect(replyCalls.length).toBe(1);
    expect(replyCalls[0].content).toContain("ne possédez pas le rôle requis");
    expect(replyCalls[0].ephemeral).toBe(true);

    // Verify DB remains empty
    const regs = db.prepare('SELECT * FROM registrations').all();
    expect(regs.length).toBe(0);
  });

  test('should save registration and update embed if role matches', async () => {
    // 1. Insert event requiring role '777'
    const eventInsert = db.prepare(`
      INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, discord_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'JdR Star Wars',
      'Partie de JdR',
      '2026-07-12',
      null,
      '20:00',
      null,
      '05:00',
      'Short',
      'Org',
      '[]',
      JSON.stringify(['777']),
      '[]',
      '[]',
      '[]',
      '{}'
    );

    const eventId = eventInsert.lastInsertRowid;

    // 2. Mock interaction object where user has role '777'
    const updateCalls = [];
    const mockInteraction = {
      isButton: () => true,
      customId: `event_${eventId}_inscrit`,
      user: { id: 'u1', username: 'User1' },
      member: {
        roles: {
          cache: {
            some: (fn) => fn({ id: '777' }) // User has role 777
          }
        }
      },
      update: async (args) => {
        updateCalls.push(args);
        return true;
      }
    };

    // 3. Emit event on client
    await client.emit('interactionCreate', mockInteraction);

    // 4. Asserts
    expect(updateCalls.length).toBe(1);
    expect(
      updateCalls[0].embeds[0].data.fields.find(f => f.name === '📊 Inscriptions / Réponses').value
    ).toContain('Inscrits : **1**');

    // Verify written to DB
    const regs = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(eventId);
    expect(regs.length).toBe(1);
    expect(regs[0].user_id).toBe('u1');
    expect(regs[0].status).toBe('inscrit');
  });
});
