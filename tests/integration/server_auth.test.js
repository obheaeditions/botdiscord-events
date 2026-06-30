import request from 'supertest';
import app from '../../src/server/index.js';

describe('Server & Authentication Integration Tests', () => {
  // Read whatever credentials the server actually resolved from process.env (or defaults)
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';

  test('should return 302 Redirect to /login for access without credentials', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(302);
    expect(response.headers['location']).toBe('/login');
  });

  test('should return 401 Unauthorized for access with incorrect credentials', async () => {
    const response = await request(app)
      .get('/')
      .auth('wronguser', 'wrongpassword');
    expect(response.status).toBe(401);
  });

  test('should return 200 OK for access with correct credentials', async () => {
    const response = await request(app)
      .get('/')
      .auth(adminUser, adminPassword);
    expect(response.status).toBe(200);
  });

  test('should include security headers in responses', async () => {
    const response = await request(app).get('/');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  test('should login successfully with correct credentials and set a session cookie', async () => {
    const response = await request(app)
      .post('/login')
      .send({ username: adminUser, password: adminPassword });

    expect(response.status).toBe(302);
    expect(response.headers['location']).toBe('/');
    expect(response.headers['set-cookie']).toBeDefined();
    expect(response.headers['set-cookie'][0]).toContain('session=');
  });

  test('should reject login with wrong credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({ username: 'baduser', password: 'badpassword' });

    expect(response.status).toBe(200); // Renders the login page again
    expect(response.text).toContain('Identifiants incorrects.');
  });
});
