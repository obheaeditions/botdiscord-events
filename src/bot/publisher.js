import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database/db.js';
import client from './index.js';
import { buildEmbed } from './embedBuilder.js';

export async function publishEventToDiscord(eventId) {
  // Fetch event details from db
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    throw new Error(`Événement ${eventId} introuvable en base.`);
  }

  const channels = JSON.parse(event.channels);
  const roles = JSON.parse(event.roles);

  // If the bot client is not logged in / ready, fall back to writing mock message IDs (for testing)
  if (!client.readyAt) {
    console.warn("Client Discord non connecté. Enregistrement de faux message IDs (Mode Test).");
    const mockMessages = {};
    channels.forEach(chanId => {
      mockMessages[chanId] = `mock_msg_${Math.floor(Math.random() * 100000000)}`;
    });
    db.prepare('UPDATE events SET discord_messages = ? WHERE id = ?')
      .run(JSON.stringify(mockMessages), eventId);
    return;
  }

  // 1. Build the Rich Embed
  const embed = buildEmbed(event);

  // 2. Build the Button Action Rows
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_inscrit`)
      .setLabel("S'inscrire")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_desinscrit`)
      .setLabel("Se désinscrire")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_interesse`)
      .setLabel("Intéressé")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_pas_interesse`)
      .setLabel("Pas intéressé")
      .setStyle(ButtonStyle.Danger)
  );

  // 3. Resolve Ping content
  let content = '';
  if (event.is_pinged) {
    content = roles.length > 0 ? roles.map(rid => `<@&${rid}>`).join(' ') : '@everyone';
  }

  const messageIds = {};

  // 4. Send to all target channels
  for (const channelId of channels) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        console.error(`Le canal ${channelId} n'est pas un canal texte valide.`);
        continue;
      }

      // Send message
      const msg = await channel.send({
        content: content || undefined,
        embeds: [embed],
        components: [actionRow]
      });

      messageIds[channelId] = msg.id;

      // Pin if requested
      if (event.is_pinned) {
        try {
          await msg.pin();
        } catch (pinErr) {
          console.error(`Impossible d'épingler le message ${msg.id} dans le canal ${channelId}:`, pinErr.message);
        }
      }

    } catch (sendErr) {
      console.error(`Échec d'envoi de l'événement au canal ${channelId}:`, sendErr.message);
    }
  }

  // 5. Save the generated message mapping in SQLite database
  db.prepare('UPDATE events SET discord_messages = ? WHERE id = ?')
    .run(JSON.stringify(messageIds), eventId);
}
