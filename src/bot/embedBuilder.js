import { EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { resolveImageUrls } from '../shared/images.js';

dotenv.config();

const TYPE_COLORS = {
  'Partie de JdR': '#E74C3C',     // Red
  'Partie de Jeu': '#2ECC71',     // Green
  'Présentation': '#3498DB',      // Blue
  'Table ronde': '#9B59B6'        // Purple
};

// Discord caps a message at 10 embeds total; 2 are reserved for the header/details cards above.
const MAX_GALLERY_IMAGES = 8;

// Returns an ordered array of embeds: [header (title+image), details (fields), ...gallery thumbnails]
export function buildEmbeds(event, counts = {}) {
  const isBlocked = event.is_blocked === 1;
  const color = isBlocked ? '#7F8C8D' : (TYPE_COLORS[event.type] || '#F1C40F');
  const title = isBlocked ? `🔒 [INSCRIPTIONS FERMÉES] ${event.title}` : event.title;
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

  let dateValue = '';
  if (event.end_date && event.end_date !== event.start_date) {
    if (event.end_time) {
      dateValue = `Du ${event.start_date} à ${event.start_time} au ${event.end_date} à ${event.end_time}`;
    } else {
      dateValue = `Du ${event.start_date} à ${event.start_time} au ${event.end_date}`;
    }
  } else {
    if (event.end_time && event.end_time !== event.start_time) {
      dateValue = `Le ${event.start_date} de ${event.start_time} à ${event.end_time}`;
    } else {
      dateValue = `Le ${event.start_date} à ${event.start_time}`;
    }
  }

  const images = JSON.parse(event.images || '[]');
  const resolvedImages = resolveImageUrls(images, backendUrl);

  // Header card: title + short pitch + the main image, kept free of fields so the image sits near the top
  const headerEmbed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(event.desc_short)
    .setColor(color);

  if (resolvedImages.length > 0) {
    headerEmbed.setImage(resolvedImages[0]);
  }

  // Details card: all informational fields
  const detailsEmbed = new EmbedBuilder()
    .setColor(color)
    .addFields(
      { name: '📅 Date / Période', value: dateValue, inline: true },
      { name: '⏳ Durée', value: `${event.duration}`, inline: true },
      { name: '📝 Type', value: event.type, inline: true },
      { name: '🛠️ Organisation', value: event.desc_org }
    );

  // Add External Links
  const links = JSON.parse(event.links || '[]');
  if (links.length > 0) {
    const formattedLinks = links.map(link => `🔗 [Lien externe](${link})`).join('\n');
    detailsEmbed.addFields({ name: '🌐 Liens utiles', value: formattedLinks });
  }

  // Add Uploaded Documents as download URLs pointing to Express
  const documents = JSON.parse(event.documents || '[]');
  if (documents.length > 0) {
    const formattedDocs = documents.map(doc => {
      const docName = doc.split('/').pop();
      // Ensure absolute URL (secure BFF/backend path)
      const docUrl = doc.startsWith('http') ? doc : `${backendUrl}${doc}`;
      return `📄 [${docName}](${docUrl})`;
    }).join('\n');
    detailsEmbed.addFields({ name: '📎 Documents joints', value: formattedDocs });
  }

  // Add Inscription Counts
  const countText = `🟢 Inscrits : **${counts.inscrit || 0}**\n` +
                    `🟡 Intéressés : **${counts.interesse || 0}**\n` +
                    `🟠 En attente : **${counts.en_attente || 0}**\n` +
                    `🔴 Pas intéressés : **${counts.pas_interesse || 0}**`;

  detailsEmbed.addFields({ name: '📊 Inscriptions / Réponses', value: countText });
  detailsEmbed.setTimestamp();

  const embeds = [headerEmbed, detailsEmbed];

  // Gallery thumbnails for the remaining images: image-only embeds sharing the same URL are
  // rendered by Discord as a clickable grid beneath the cards above.
  const galleryImages = resolvedImages.slice(1, 1 + MAX_GALLERY_IMAGES);
  if (galleryImages.length > 0) {
    const galleryGroupUrl = resolvedImages[0];
    galleryImages.forEach(imgUrl => {
      embeds.push(new EmbedBuilder().setURL(galleryGroupUrl).setImage(imgUrl));
    });
  }

  return embeds;
}
