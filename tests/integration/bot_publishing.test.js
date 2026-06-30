import client from '../../src/bot/index.js';
import { publishEventToDiscord } from '../../src/bot/publisher.js';
import db from '../../src/database/db.js';

describe('Bot Publishing Integration Tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    db.close();
  });

  test('should format embed and components and call send on mock channel', async () => {
    // 1. Insert fake event
    const eventInsert = db.prepare(`
      INSERT INTO events (title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org, channels, roles, images, documents, links, is_pinned, is_pinged, discord_messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(['9988']),
      JSON.stringify(['7777']),
      '[]',
      '[]',
      '[]',
      1,
      1,
      '{}'
    );

    const eventId = eventInsert.lastInsertRowid;

    // 2. Set up mock message and send function using pure JS spies
    const pinCalls = [];
    const mockPin = async () => {
      pinCalls.push([]);
      return true;
    };

    const sendCalls = [];
    const mockSend = async (args) => {
      sendCalls.push(args);
      return { id: 'msg_123456', pin: mockPin };
    };
    
    const mockChannel = {
      isTextBased: () => true,
      send: mockSend
    };

    // Override client.readyAt using Object.defineProperty since it has only a getter
    Object.defineProperty(client, 'readyAt', {
      get: () => new Date(),
      configurable: true
    });
    
    const fetchCalls = [];
    client.channels.fetch = async (chanId) => {
      fetchCalls.push(chanId);
      return mockChannel;
    };

    // 3. Publish event
    await publishEventToDiscord(eventId);

    // 4. Asserts
    expect(fetchCalls).toContain('9988');
    expect(sendCalls.length).toBe(1);

    const sendCallArgs = sendCalls[0];
    expect(sendCallArgs.content).toBe('<@&7777>'); // ping formatting
    expect(sendCallArgs.embeds[0].data.title).toBe('JdR Star Wars');
    
    // Check buttons
    const actionRow = sendCallArgs.components[0];
    expect(actionRow.components[0].data.custom_id).toBe(`event_${eventId}_inscrit`);
    expect(actionRow.components[1].data.custom_id).toBe(`event_${eventId}_desinscrit`);

    // Verify DB updated with message mapping
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    expect(JSON.parse(event.discord_messages)).toEqual({ '9988': 'msg_123456' });
    expect(pinCalls.length).toBe(1);

    // Restore readyAt getter
    Object.defineProperty(client, 'readyAt', {
      get: () => null,
      configurable: true
    });
  });
});
