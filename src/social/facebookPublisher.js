import db from '../database/db.js';
import { resolveImageUrls } from '../shared/images.js';

const GRAPH_API_VERSION = 'v19.0';

// Publish (or, on subsequent calls, update the caption of) an event on the configured
// Facebook Page. Requires FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in the environment.
export async function publishEventToFacebook(eventId) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    console.warn('Configuration Facebook absente (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN). Publication ignorée.');
    return;
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    throw new Error(`Événement ${eventId} introuvable en base.`);
  }

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
  const registrationUrl = `${backendUrl}/register/${eventId}`;
  const dateValue = event.start_time ? `${event.start_date} à ${event.start_time}` : event.start_date;
  const caption = `${event.title}\n\n${event.desc_short}\n\n📅 ${dateValue}\n\n👉 Inscrivez-vous : ${registrationUrl}`;

  if (!event.facebook_post_id) {
    // First publication: requires a photo (Graph API's /photos endpoint has no image-less equivalent here)
    const images = JSON.parse(event.images || '[]');
    const resolvedImages = resolveImageUrls(images, backendUrl);
    if (resolvedImages.length === 0) {
      console.warn(`Événement ${eventId} : aucune image disponible, publication Facebook ignorée.`);
      return;
    }

    const body = new URLSearchParams({ url: resolvedImages[0], caption, access_token: accessToken });
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`, {
      method: 'POST',
      body
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Échec de publication Facebook : ${data?.error?.message || response.statusText}`);
    }

    db.prepare('UPDATE events SET facebook_post_id = ? WHERE id = ?').run(data.id, eventId);
  } else {
    // Republication: only the caption can be updated, the photo itself is immutable via the API
    const body = new URLSearchParams({ message: caption, access_token: accessToken });
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${event.facebook_post_id}`, {
      method: 'POST',
      body
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Échec de mise à jour du post Facebook : ${data?.error?.message || response.statusText}`);
    }
  }
}
