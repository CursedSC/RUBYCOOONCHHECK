// commands/gallery-add.js
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const Database = require('../database');
const db = new Database();

const URL_RE = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(\?\S+)?$/i;
const MAX_IMAGES_PER_CHAR = 20;
const ADMIN_ROLE_ID = '1382005661369368586'; // при необходимости

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gallery-add')
    .setDescription('Добавить изображения в галерею персонажа')
    .addIntegerOption(o =>
      o.setName('character_id')
       .setDescription('ID персонажа')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('urls')
       .setDescription('Ссылки через пробел или запятую (png/jpg/gif/webp)')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('captions')
       .setDescription('Подписи через | (по порядку, опционально)')
       .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const characterId = interaction.options.getInteger('character_id');
      const urlsRaw = interaction.options.getString('urls') || '';
      const captionsRaw = interaction.options.getString('captions') || '';

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const character = await db.getCharacterById(characterId);
      if (!character) {
        return await interaction.editReply('❌ Персонаж не найден!');
      }

      const isOwner = interaction.user.id === character.user_id;
      const isAdmin = interaction.member.roles.cache.has(ADMIN_ROLE_ID) ||
                      interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isOwner && !isAdmin) {
        return await interaction.editReply('❌ Можно добавлять изображения только к своим персонажам.');
      }

      const tokens = urlsRaw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      const captions = captionsRaw ? captionsRaw.split('|').map(s => s.trim()) : [];
      const images = tokens
        .filter(u => URL_RE.test(u))
        .map((u, i) => ({ url: u, caption: captions[i] || null }));

      if (images.length === 0) {
        return await interaction.editReply('❌ Нет валидных URL изображений (поддержка: png, jpg, jpeg, gif, webp).');
      }

      const currentCount = await db.getGalleryCount(characterId);
      const available = Math.max(0, MAX_IMAGES_PER_CHAR - currentCount);
      if (available === 0) {
        return await interaction.editReply(`⚠️ Лимит галереи достигнут: ${currentCount}/${MAX_IMAGES_PER_CHAR}.`);
      }

      const toInsert = images.slice(0, available);
      await db.addGalleryImages(characterId, toInsert);

      const newTotal = currentCount + toInsert.length;
      const skipped = images.length - toInsert.length;
      let msg = `✅ Добавлено: ${toInsert.length}. Итого: ${newTotal}/${MAX_IMAGES_PER_CHAR}.`;
      if (skipped > 0) msg += ` Пропущено из-за лимита: ${skipped}.`;
      await interaction.editReply(msg);
    } catch (err) {
      console.error('gallery-add error:', err);
      try { await interaction.editReply('❌ Произошла ошибка при добавлении изображений.'); } catch {}
    }
  }
};
