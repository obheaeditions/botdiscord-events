import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../database/db.js';
import client, { validateRolePermissionsForChannels, getGuildChannelsAndRoles } from '../bot/index.js';
import { publishEventToDiscord, deleteEventFromDiscord, publishCompositionToThreads } from '../bot/publisher.js';
import { sessions, SESSION_COOKIE_NAME, parseCookies } from './sessionStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename using cryptographically strong random bytes (secure coding guideline)
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Multer File Type and Size Filter (secure coding guideline)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limit file size to 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedImageExts = ['.png', '.jpg', '.jpeg'];
    const allowedDocExts = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (file.fieldname === 'images' && allowedImageExts.includes(ext)) {
      cb(null, true);
    } else if (file.fieldname === 'documents' && allowedDocExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé : "${ext}"`));
    }
  }
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'documents', maxCount: 10 }
]);

// Normalize checkbox/multi-select outputs (which can be string, array or undefined)
function normalizeArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

// Extract uploaded file paths for a given multer field; safe even if req.files is undefined
// (e.g. non-multipart requests, which multer leaves untouched)
function filesToPaths(files, field) {
  return (files?.[field] || []).map(file => `/uploads/${file.filename}`);
}

// Remove uploaded files from disk (used to clean up orphans on validation/DB failure)
function removeUploadedFiles(files) {
  const allFiles = [...(files?.images || []), ...(files?.documents || [])];
  allFiles.forEach(file => {
    try { fs.unlinkSync(file.path); } catch (_) {}
  });
}

// Physically delete a previously uploaded public file (e.g. image/document removed during edit)
function deletePublicFile(relativePath) {
  const filePath = path.join(__dirname, '../../public', relativePath);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

// Republish an event to Discord, swallowing errors so it never blocks the HTTP response
async function syncEventToDiscord(eventId, actionLabel) {
  try {
    await publishEventToDiscord(eventId);
  } catch (botErr) {
    console.error(`Erreur de synchronisation Discord (${actionLabel}) pour l'événement ${eventId}:`, botErr);
  }
}

// GET login page
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// POST login handler
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password';

  if (username === adminUser && password === adminPassword) {
    // Generate secure random session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);

    // Set HttpOnly session cookie
    res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`);
    return res.redirect('/');
  }

  res.render('login', { error: 'Identifiants incorrects.' });
});

// POST logout handler
router.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (token) {
    sessions.delete(token);
  }

  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.redirect('/login');
});

// GET dashboard list of events
router.get('/', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events ORDER BY id DESC').all();
    res.render('dashboard', { events });
  } catch (err) {
    console.error('Error fetching dashboard:', err);
    res.status(500).send('Une erreur est survenue lors de la récupération des événements.');
  }
});

// GET render creation form
router.get('/events/create', async (req, res) => {
  try {
    const { channels, roles } = await getGuildChannelsAndRoles();
    res.render('create_event', { channels, roles, error: null });
  } catch (err) {
    console.error('Error fetching channels/roles:', err);
    res.render('create_event', { channels: [], roles: [], error: 'Impossible de récupérer les salons et rôles Discord.' });
  }
});

// POST handle event creation
router.post('/events/create', (req, res) => {
  upload(req, res, async (err) => {
    // Fetch channels and roles beforehand to pass them in case of rendering errors
    let discordData = { channels: [], roles: [] };
    try {
      discordData = await getGuildChannelsAndRoles();
    } catch (_) {}

    if (err) {
      return res.status(400).render('create_event', {
        channels: discordData.channels,
        roles: discordData.roles,
        error: err.message
      });
    }

    const {
      title,
      type,
      start_date,
      end_date,
      start_time,
      end_time,
      duration,
      desc_short,
      desc_org,
      channels,
      roles,
      links,
      is_pinned,
      is_pinged
    } = req.body;

    const channelList = normalizeArray(channels);
    const roleList = normalizeArray(roles);
    const linkList = links ? links.split('\n').map(s => s.trim()).filter(Boolean) : [];

    // Basic Input Validations
    if (!title || !type || !start_date || !start_time || !duration || !desc_short || !desc_org || channelList.length === 0) {
      return res.status(400).render('create_event', {
        channels: discordData.channels,
        roles: discordData.roles,
        error: 'Veuillez remplir tous les champs obligatoires.'
      });
    }

    // Capture uploaded files from multer
    const imageList = filesToPaths(req.files, 'images');
    const documentList = filesToPaths(req.files, 'documents');

    try {
      // 1. Validation de Cohérence Rôle / Canal (Client Discord check)
      await validateRolePermissionsForChannels(roleList, channelList);

      // 2. Insert event details in the database
      const insertStmt = db.prepare(`
        INSERT INTO events (
          title, type, start_date, end_date, start_time, end_time, duration, desc_short, desc_org,
          channels, roles, images, documents, links, is_pinned, is_pinged, discord_messages
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        title,
        type,
        start_date,
        end_date || null,
        start_time,
        end_time || null,
        duration,
        desc_short,
        desc_org,
        JSON.stringify(channelList),
        JSON.stringify(roleList),
        JSON.stringify(imageList),
        JSON.stringify(documentList),
        JSON.stringify(linkList),
        is_pinned ? 1 : 0,
        is_pinged ? 1 : 0,
        JSON.stringify({}) // Initially empty mapping of messages
      );

      const eventId = result.lastInsertRowid;

      // 3. Publish event asynchronously (fail-safe and non-blocking for Express response)
      publishEventToDiscord(eventId).catch(pubErr => {
        console.error(`Erreur de publication du bot pour l'événement ${eventId}:`, pubErr);
      });

      // Redirect to dashboard on success
      res.redirect('/');

    } catch (validationErr) {
      // If validation or insertion fails, delete uploaded files to prevent orphaned files on disk
      removeUploadedFiles(req.files);

      return res.status(400).render('create_event', {
        channels: discordData.channels,
        roles: discordData.roles,
        error: validationErr.message
      });
    }
  });
});

// GET edit event form
router.get('/events/:id/edit', async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).send("Événement non trouvé.");
    }

    const discordData = await getGuildChannelsAndRoles();

    res.render('edit_event', {
      event,
      channels: discordData.channels,
      roles: discordData.roles,
      error: null
    });
  } catch (err) {
    console.error('Error fetching edit event form:', err);
    res.status(500).send("Une erreur est survenue lors de la récupération du formulaire.");
  }
});

// POST edit event
router.post('/events/:id/edit', (req, res) => {
  upload(req, res, async (err) => {
    const eventId = req.params.id;
    
    // Fetch event again for error rendering
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).send("Événement non trouvé.");
    }

    const discordData = await getGuildChannelsAndRoles();

    if (err) {
      return res.status(400).render('edit_event', {
        event,
        channels: discordData.channels,
        roles: discordData.roles,
        error: err.message
      });
    }

    const {
      title,
      type,
      start_date,
      end_date,
      start_time,
      end_time,
      duration,
      desc_short,
      desc_org,
      channels,
      roles,
      links,
      is_pinned,
      is_pinged
    } = req.body;

    const channelList = normalizeArray(channels);
    const roleList = normalizeArray(roles);
    const linkList = links ? links.split('\n').map(s => s.trim()).filter(Boolean) : [];

    // Basic Input Validations
    if (!title || !type || !start_date || !start_time || !duration || !desc_short || !desc_org || channelList.length === 0) {
      return res.status(400).render('edit_event', {
        event,
        channels: discordData.channels,
        roles: discordData.roles,
        error: 'Veuillez remplir tous les champs obligatoires.'
      });
    }

    let currentImages = JSON.parse(event.images || '[]');
    let currentDocs = JSON.parse(event.documents || '[]');

    // Filter out deleted files
    const deleteImages = normalizeArray(req.body.delete_images);
    const deleteDocs = normalizeArray(req.body.delete_documents);

    // Physically delete files from public folder
    deleteImages.forEach(deletePublicFile);
    deleteDocs.forEach(deletePublicFile);

    currentImages = currentImages.filter(img => !deleteImages.includes(img));
    currentDocs = currentDocs.filter(doc => !deleteDocs.includes(doc));

    // Append new files
    const newImages = filesToPaths(req.files, 'images');
    const newDocs = filesToPaths(req.files, 'documents');

    const finalImages = [...currentImages, ...newImages];
    const finalDocs = [...currentDocs, ...newDocs];

    try {
      // 1. Validation de Cohérence Rôle / Canal (Client Discord check)
      await validateRolePermissionsForChannels(roleList, channelList);

      // 2. Update database
      db.prepare(`
        UPDATE events SET
          title = ?, type = ?, start_date = ?, end_date = ?, start_time = ?, end_time = ?, duration = ?,
          desc_short = ?, desc_org = ?, channels = ?, roles = ?, images = ?, documents = ?, links = ?,
          is_pinned = ?, is_pinged = ?
        WHERE id = ?
      `).run(
        title,
        type,
        start_date,
        end_date || null,
        start_time,
        end_time || null,
        duration,
        desc_short,
        desc_org,
        JSON.stringify(channelList),
        JSON.stringify(roleList),
        JSON.stringify(finalImages),
        JSON.stringify(finalDocs),
        JSON.stringify(linkList),
        is_pinned ? 1 : 0,
        is_pinged ? 1 : 0,
        eventId
      );

      // 3. Sync Discord messages
      await syncEventToDiscord(eventId, 'modification événement');

      res.redirect(`/events/${eventId}`);
    } catch (err) {
      console.error('Error updating event:', err);
      // Delete newly uploaded files to prevent orphaned files on disk if the update failed
      removeUploadedFiles(req.files);

      res.status(500).render('edit_event', {
        event,
        channels: discordData.channels,
        roles: discordData.roles,
        error: err.message || 'Une erreur est survenue lors de la modification de l’événement.'
      });
    }
  });
});

// GET event details by id
router.get('/events/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) {
      return res.status(404).send('Événement non trouvé.');
    }

    const registrations = db.prepare('SELECT * FROM registrations WHERE event_id = ? ORDER BY updated_at DESC').all(req.params.id);

    // Aggregate counts
    const counts = {
      inscrit: 0,
      interesse: 0,
      pas_interesse: 0,
      desinscrit: 0,
      en_attente: 0
    };

    registrations.forEach(reg => {
      if (counts[reg.status] !== undefined) {
        counts[reg.status]++;
      }
    });

    res.render('event_details', { event, registrations, counts });
  } catch (err) {
    console.error('Error fetching event details:', err);
    res.status(500).send('Une erreur est survenue lors de la récupération des détails de l’événement.');
  }
});

// POST toggle event block (close/open registrations)
router.post('/events/:id/toggle-block', async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = db.prepare('SELECT is_blocked FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).send('Événement non trouvé.');
    }

    const newBlockedState = event.is_blocked === 1 ? 0 : 1;
    db.prepare('UPDATE events SET is_blocked = ? WHERE id = ?').run(newBlockedState, eventId);

    // Sync state to Discord embeds
    await syncEventToDiscord(eventId, 'état bloqué');

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('Error toggling block state:', err);
    res.status(500).send('Une erreur est survenue lors de la modification de l’état d’inscription.');
  }
});

// POST republish / sync event on Discord
router.post('/events/:id/republish', async (req, res) => {
  try {
    const eventId = req.params.id;
    
    // Trigger resilient publish
    await publishEventToDiscord(eventId);

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('Error republishing event:', err);
    res.status(500).send('Une erreur est survenue lors de la republication de l’événement.');
  }
});

// POST delete event
router.post('/events/:id/delete', async (req, res) => {
  try {
    const eventId = req.params.id;

    // 1. Delete associated messages on Discord (async, fail-safe)
    try {
      await deleteEventFromDiscord(eventId);
    } catch (botErr) {
      console.error(`Erreur lors de la suppression des messages de l'événement ${eventId} sur Discord:`, botErr);
    }

    // 2. Delete event from SQLite (cascade deletes registrations)
    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);

    res.redirect('/');
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).send('Une erreur est survenue lors de la suppression de l’événement.');
  }
});

// POST edit event descriptions
router.post('/events/:id/edit-descriptions', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { desc_short, desc_org } = req.body;

    if (desc_short === undefined || desc_org === undefined) {
      return res.status(400).send("Descriptions requises.");
    }

    db.prepare('UPDATE events SET desc_short = ?, desc_org = ? WHERE id = ?')
      .run(desc_short.trim(), desc_org.trim(), eventId);

    // Sync updated descriptions to Discord embeds
    await syncEventToDiscord(eventId, 'modification descriptions');

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('Error editing event descriptions:', err);
    res.status(500).send("Une erreur est survenue lors de la modification de l'événement.");
  }
});

// POST add registration manually
router.post('/events/:id/registrations/add', async (req, res) => {
  try {
    const eventId = req.params.id;
    const { user_id, username, status } = req.body;

    if (!user_id || !username) {
      return res.status(400).send("User ID et Nom d'utilisateur requis.");
    }

    const regStatus = status || 'inscrit';
    db.prepare(`
      INSERT OR REPLACE INTO registrations (event_id, user_id, username, status, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(eventId, user_id.trim(), username.trim(), regStatus);

    // Sync embeds on Discord
    await syncEventToDiscord(eventId, 'ajout manuel');

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('Error adding registration manually:', err);
    res.status(500).send("Une erreur est survenue lors de l'ajout du participant.");
  }
});

// POST waitlist registration (Toggle)
router.post('/events/:id/registrations/:userId/waitlist', async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.params.userId;

    const event = db.prepare('SELECT title FROM events WHERE id = ?').get(eventId);
    if (!event) {
      return res.status(404).send("Événement non trouvé.");
    }

    const reg = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND user_id = ?').get(eventId, userId);
    if (!reg) {
      return res.status(404).send("Inscription non trouvée.");
    }

    let newStatus;
    let newPreviousStatus;
    let dmText = '';

    if (reg.status === 'en_attente') {
      // Toggle back to initial status
      newStatus = reg.previous_status || 'inscrit';
      newPreviousStatus = null;

      const statusLabel = newStatus === 'inscrit' ? 'Inscrit' : 'Intéressé';
      dmText = `Bonjour ! Vous avez été retiré(e) de la liste d'attente pour l'événement **${event.title}**. Votre statut est de nouveau : **${statusLabel}**.`;
    } else {
      // Put on waitlist
      newStatus = 'en_attente';
      newPreviousStatus = reg.status; // Save initial status ('inscrit' or 'interesse')
      dmText = `Bonjour ! Vous avez été mis(e) en liste d'attente pour l'événement **${event.title}**.`;
    }

    db.prepare('UPDATE registrations SET status = ?, previous_status = ?, updated_at = CURRENT_TIMESTAMP WHERE event_id = ? AND user_id = ?')
      .run(newStatus, newPreviousStatus, eventId, userId);

    // Sync embeds on Discord
    await syncEventToDiscord(eventId, 'mise en attente');

    // Send private message (DM) to the user on Discord
    if (client.readyAt && dmText) {
      try {
        const discordUser = await client.users.fetch(userId);
        if (discordUser) {
          await discordUser.send(dmText);
        }
      } catch (dmErr) {
        console.warn(`Impossible d'envoyer un message privé à l'utilisateur ${userId}:`, dmErr.message);
      }
    }

    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('Error putting registration on waitlist:', err);
    res.status(500).send("Une erreur est survenue lors du changement de statut.");
  }
});

// POST publish composition to Discord threads
router.post('/events/:id/publish-composition', async (req, res) => {
  try {
    const eventId = req.params.id;
    await publishCompositionToThreads(eventId);
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    console.error('Error publishing composition to threads:', err);
    res.status(500).send('Une erreur est survenue lors de la publication de la composition.');
  }
});

export default router;
