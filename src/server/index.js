import express from 'express';
import basicAuth from 'express-basic-auth';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Allow Google Fonts, Tailwind CSS Play CDN, Flatpickr (jsdelivr.net) and self resources
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; " +
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'self'"
  );
  next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve uploaded files
app.use('/uploads', (req, res, next) => {
  // Enforce correct headers for file uploads
  res.setHeader('Content-Disposition', 'inline'); // or attachment if we want to force download
  next();
}, express.static(path.join(__dirname, '../../public/uploads')));

// Configure Basic Authentication
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'password';

// Middleware for Basic Auth
const authMiddleware = basicAuth({
  users: { [adminUser]: adminPassword },
  challenge: true,
  realm: 'Backoffice Bot Discord'
});

import router from './routes.js';

// Apply basic auth to all routes except uploads or favicon
app.use((req, res, next) => {
  // If requesting uploads or favicon, allow public access
  if (req.path.startsWith('/uploads') || req.path === '/favicon.ico') {
    return next();
  }
  return authMiddleware(req, res, next);
});

// Mount routes
app.use('/', router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Une erreur interne est survenue.'); // Generic user-facing message to prevent info leakage
});

export default app;
