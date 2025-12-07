// commands/gallery-list.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('../database');
const db = new Database();

const PAGE_SIZE = 9;

function makeRow(characterId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`gal_prev_${characterId}_${page}`).setLabel('« Пред').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`gal_next_${characterId}_${page}`).setLabel('След »').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages)
  );
}

function makeEmbed(character, images, page, totalPages, totalCount) {
  const emb = new EmbedBuilder()
    .setTitle(`🖼️ Галерея: ${character.name} (ID: ${character.id})`)
    .setColor(character.embed_color || '#9932cc')
    .setFooter({ text: `Страница ${page}/${totalPages} • Всего: ${totalCount}` })
    .setTimestamp();

  if (images.length > 0) {
    emb.setDescription(
      images.map((img, idx) =>
        `#${(page - 1) * PAGE_SIZE + idx + 1} • ${img.caption ? `«${img.caption}» — ` : ''}${img.image_url}`
      ).join('\n')
    );
    emb.setImage(images.image_url);
  } else {
    emb.setDescription('Пока пусто.');
  }
  return emb;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gallery-list')
    .setDescription('Показать изображения галереи персонажа')
    .addIntegerOption(o =>
      o.setName('character_id')
       .setDescription('ID персонажа')
       .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('page')
       .setDescription('Страница (по умолчанию 1)')
       .setRequired(false)
    ),

  async execute(interaction) {
    const characterId = interaction.options.getInteger('character_id');
    const pageReq = interaction.options.getInteger('page') || 1;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const character = await db.getCharacterById(characterId);
      if (!character) return await interaction.editReply('❌ Персонаж не найден.');

      const total = await db.getGalleryCount(characterId);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.min(Math.max(1, pageReq), totalPages);

      const rows = await db.getGalleryPage(characterId, page, PAGE_SIZE);
      const embed = makeEmbed(character, rows, page, totalPages, total);
      const row = makeRow(characterId, page, totalPages);

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('gallery-list error:', err);
      try { await interaction.editReply('❌ Ошибка при загрузке галереи.'); } catch {}
    }
  },

  // Обработка кнопок в index.js через общий обработчик
  async handleButton(interaction) {
    if (!interaction.customId.startsWith('gal_')) return false;
    try {
      const [, kind, charIdStr, pageStr] = interaction.customId.split('_'); // gal_prev_123_1
      const characterId = parseInt(charIdStr);
      let page = parseInt(pageStr);

      const character = await db.getCharacterById(characterId);
      if (!character) {
        await interaction.update({ content: '❌ Персонаж не найден.', components: [] });
        return true;    
      }

      const total = await db.getGalleryCount(characterId);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

      if (kind === 'prev') page = Math.max(1, page - 1);
      if (kind === 'next') page = Math.min(totalPages, page + 1);

      const rows = await db.getGalleryPage(characterId, page, PAGE_SIZE);
      const embed = makeEmbed(character, rows, page, totalPages, total);
      const row = makeRow(characterId, page, totalPages);

      await interaction.update({ embeds: [embed], components: [row] });
      return true;
    } catch (e) {
      console.error('gallery-list button error:', e);
      try { await interaction.update({ content: '❌ Ошибка обновления страницы.', components: [] }); } catch {}
      return true;
    }
  }
};
