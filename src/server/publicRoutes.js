import express from 'express';
import crypto from 'crypto';
import db from '../database/db.js';
import { resolveGuildMemberByUsername } from '../bot/index.js';
import { syncEventToDiscord } from '../bot/publisher.js';

const router = express.Router();

// GET public registration form for an event (no authentication required)
router.get('/:eventId', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.eventId);
  if (!event) {
    return res.status(404).render('register_public', { event: null, isBlocked: false, error: null, success: false });
  }

  res.render('register_public', {
    event,
    isBlocked: event.is_blocked === 1,
    error: null,
    success: false
  });
});

// POST public registration submission
router.post('/:eventId', async (req, res) => {
  const eventId = req.params.eventId;
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    return res.status(404).render('register_public', { event: null, isBlocked: false, error: null, success: false });
  }

  if (event.is_blocked === 1) {
    return res.status(400).render('register_public', { event, isBlocked: true, error: null, success: false });
  }

  const discordHandle = (req.body.discord_handle || '').trim();
  const email = (req.body.email || '').trim();

  if (!discordHandle) {
    return res.status(400).render('register_public', {
      event,
      isBlocked: false,
      error: 'Merci de renseigner votre pseudo Discord.',
      success: false
    });
  }

  // Try to resolve the entered handle to a real guild member; fall back to a synthetic
  // identifier if not found so the registration is still recorded for manual review.
  const member = await resolveGuildMemberByUsername(discordHandle);
  const userId = member ? member.user.id : `fb_${crypto.randomBytes(6).toString('hex')}`;
  const username = member ? member.user.username : discordHandle;

  db.prepare(`
    INSERT INTO registrations (event_id, user_id, username, status, source, email, updated_at)
    VALUES (?, ?, ?, 'inscrit', 'facebook', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(event_id, user_id) DO UPDATE SET
      status = 'inscrit', username = excluded.username, email = excluded.email, updated_at = CURRENT_TIMESTAMP
  `).run(eventId, userId, username, email || null);

  // Reflect the new registration on the Discord embed counters
  await syncEventToDiscord(eventId, 'inscription publique Facebook');

  res.render('register_public', { event, isBlocked: false, error: null, success: true });
});

export default router;
