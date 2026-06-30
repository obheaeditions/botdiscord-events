import { EmbedBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const TYPE_COLORS = {
  'Partie de JdR': '#E74C3C',     // Red
  'Partie de Jeu': '#2ECC71',     // Green
  'Présentation': '#3498DB',      // Blue
  'Table ronde': '#9B59B6'        // Purple
};

export function buildEmbed(event, counts = {}) {
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

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(event.desc_short)
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
    embed.addFields({ name: '🌐 Liens utiles', value: formattedLinks });
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
    embed.addFields({ name: '📎 Documents joints', value: formattedDocs });
  }

  // Add Inscription Counts
  const countText = `🟢 Inscrits : **${counts.inscrit || 0}**\n` +
                    `🟡 Intéressés : **${counts.interesse || 0}**\n` +
                    `🟠 En attente : **${counts.en_attente || 0}**\n` +
                    `🔴 Pas intéressés : **${counts.pas_interesse || 0}**`;
  
  embed.addFields({ name: '📊 Inscriptions / Réponses', value: countText });

  // Add the first image as the main visual image of the embed
  const images = JSON.parse(event.images || '[]');
  if (images.length > 0) {
    const imgUrl = images[0].startsWith('http') ? images[0] : `${backendUrl}${images[0]}`;
    embed.setImage(imgUrl);
  }

  embed.setTimestamp();

  return embed;
}
