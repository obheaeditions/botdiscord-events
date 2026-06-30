import request from 'supertest';
import app from '../../src/server/index.js';
import db from '../../src/database/db.js';

describe('Event Creation Integration Tests', () => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';

  beforeEach(() => {
    db.prepare('DELETE FROM registrations').run();
    db.prepare('DELETE FROM events').run();
  });

  afterAll(() => {
    db.close();
  });

  test('should GET the creation form', async () => {
    const response = await request(app)
      .get('/events/create')
      .auth(adminUser, adminPassword);
    expect(response.status).toBe(200);
    expect(response.text).toContain('Créer un Nouvel Événement');
  });

  test('should create a valid event and write to database', async () => {
    const response = await request(app)
      .post('/events/create')
      .auth(adminUser, adminPassword)
      .field('title', 'Soirée Jeux')
      .field('type', 'Partie de Jeu')
      .field('start_date', '2026-07-12')
      .field('end_date', '2026-07-14')
      .field('start_time', '18:30')
      .field('end_time', '21:00')
      .field('duration', '02:00')
      .field('desc_short', 'Résumé court')
      .field('desc_org', 'Organisation longue')
      .field('channels', '1234567')
      .field('channels', '8901234')
      .field('roles', '1111')
      .field('roles', '2222')
      .attach('images', Buffer.from('fake image content'), 'test_image.png')
      .attach('documents', Buffer.from('fake document content'), 'test_doc.pdf');

    expect(response.status).toBe(302); // Redirects on success

    // Verify written to database
    const events = db.prepare('SELECT * FROM events').all();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Soirée Jeux');
    expect(JSON.parse(events[0].channels)).toEqual(['1234567', '8901234']);
    expect(JSON.parse(events[0].roles)).toEqual(['1111', '2222']);
    
    // Check if filenames are randomized
    const images = JSON.parse(events[0].images);
    expect(images.length).toBe(1);
    expect(images[0]).not.toContain('test_image.png');
    expect(images[0]).toContain('/uploads/');
  });

  test('should reject creation if required fields are missing', async () => {
    const response = await request(app)
      .post('/events/create')
      .auth(adminUser, adminPassword)
      .field('title', 'Missing fields'); // channels is missing, which is required

    expect(response.status).toBe(400);
    expect(response.text).toContain('Veuillez remplir tous les champs obligatoires.');

    // Database should be empty
    const events = db.prepare('SELECT * FROM events').all();
    expect(events.length).toBe(0);
  });

  test('should reject creation and generate alert if role validation fails', async () => {
    // ID 999999 triggers a mock error in our validateRolePermissionsForChannels function
    const response = await request(app)
      .post('/events/create')
      .auth(adminUser, adminPassword)
      .field('title', 'Role fail')
      .field('type', 'Présentation')
      .field('start_date', '2026-07-12')
      .field('start_time', '20:00')
      .field('duration', '01:00')
      .field('desc_short', 'Accroche')
      .field('desc_org', 'Organisation')
      .field('channels', '123456')
      .field('roles', '999999') // triggers mock failure
      .attach('images', Buffer.from('image content'), 'avatar.jpg');

    expect(response.status).toBe(400);
    expect(response.text).toContain('999999');

    // Database should be empty
    const events = db.prepare('SELECT * FROM events').all();
    expect(events.length).toBe(0);
  });
});
