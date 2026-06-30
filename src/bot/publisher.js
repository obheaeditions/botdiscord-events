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
  const isBlocked = event.is_blocked === 1;

  // If the bot client is not logged in / ready, fall back to writing mock message IDs (for testing)
  if (!client.readyAt) {
    console.warn("Client Discord non connecté. Enregistrement de faux message IDs (Mode Test).");
    const mockMessages = JSON.parse(event.discord_messages || '{}');
    channels.forEach(chanId => {
      if (!mockMessages[chanId]) {
        mockMessages[chanId] = `mock_msg_${Math.floor(Math.random() * 100000000)}`;
      }
    });
    db.prepare('UPDATE events SET discord_messages = ? WHERE id = ?')
      .run(JSON.stringify(mockMessages), eventId);
    return;
  }

  // 1. Fetch registrations responses to render current stats
  const registrations = db.prepare('SELECT * FROM registrations WHERE event_id = ?').all(eventId);
  const counts = { inscrit: 0, interesse: 0, pas_interesse: 0, desinscrit: 0 };
  registrations.forEach(r => {
    if (counts[r.status] !== undefined) {
      counts[r.status]++;
    }
  });

  // 2. Build the Rich Embed
  const embed = buildEmbed(event, counts);

  // 3. Build the Button Action Rows (disabled if blocked)
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_inscrit`)
      .setLabel("S'inscrire")
      .setStyle(ButtonStyle.Success)
      .setDisabled(isBlocked),
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_desinscrit`)
      .setLabel("Se désinscrire")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isBlocked),
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_interesse`)
      .setLabel("Intéressé")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isBlocked),
    new ButtonBuilder()
      .setCustomId(`event_${eventId}_pas_interesse`)
      .setLabel("Pas intéressé")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isBlocked)
  );

  // 4. Resolve Ping content
  let content = '';
  if (event.is_pinged) {
    content = roles.length > 0 ? roles.map(rid => `<@&${rid}>`).join(' ') : '@everyone';
  }

  const currentMessages = JSON.parse(event.discord_messages || '{}');
  const messageIds = {};

  // 5. Send or Edit in target channels
  for (const channelId of channels) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        console.error(`Le canal ${channelId} n'est pas un canal texte valide.`);
        continue;
      }

      let msg = null;
      const existingMsgId = currentMessages[channelId];

      if (existingMsgId) {
        try {
          msg = await channel.messages.fetch(existingMsgId);
          if (msg) {
            // Edit existing message
            await msg.edit({
              content: content || null,
              embeds: [embed],
              components: [actionRow]
            });
            messageIds[channelId] = msg.id;
          }
        } catch (fetchErr) {
          console.warn(`Message ${existingMsgId} non trouvé sur le canal ${channelId}. Recréation d'un nouveau.`);
        }
      }

      // If no existing message was edited successfully, send a new one
      if (!msg) {
        msg = await channel.send({
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
      }

    } catch (sendErr) {
      console.error(`Échec d'envoi ou d'édition sur le canal ${channelId}:`, sendErr.message);
    }
  }

  // 6. Save updated mapping in DB
  db.prepare('UPDATE events SET discord_messages = ? WHERE id = ?')
    .run(JSON.stringify(messageIds), eventId);
}

export async function deleteEventFromDiscord(eventId) {
  // Fetch event details from DB
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return;

  const currentMessages = JSON.parse(event.discord_messages || '{}');

  if (!client.readyAt) {
    console.warn("Client Discord non connecté. Suppression simulée (Mode Test).");
    return;
  }

  for (const [channelId, msgId] of Object.entries(currentMessages)) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && channel.isTextBased()) {
        const msg = await channel.messages.fetch(msgId);
        if (msg) {
          await msg.delete();
        }
      }
    } catch (err) {
      console.error(`Erreur lors de la suppression du message ${msgId} sur le canal ${channelId}:`, err.message);
    }
  }
}
