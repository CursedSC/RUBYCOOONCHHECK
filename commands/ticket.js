const { SlashCommandBuilder, MessageFlags, ComponentType, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database');
const fs = require('fs');
const path = require('path');
const db = new Database();

// Загрузка конфига
let ticketConfig;
try {
  ticketConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ticketConfig.json'), 'utf8'));
} catch (e) {
  console.error('Ошибка загрузки ticketConfig.json:', e);
  ticketConfig = {
    roles: { curator: '', admin: [], highAdmin: [], profileAdmin: '' },
    emojis: {},
    system: { cooldownHours: 72 }
  };
}

const CURATOR_ROLE_ID = ticketConfig.roles.curator || '1382005661369368586';
const SPECIAL_USER_ID = ticketConfig.specialUsers?.owner || '416602253160480769';
const ADMIN_ROLES = ticketConfig.roles.admin || ['1382006178451685377', '1382005661369368586'];
const HIGH_ADMIN_ROLES = ticketConfig.roles.highAdmin || ['1382006799028322324'];
const EMOJIS = ticketConfig.emojis || {};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('тикет')
    .setDescription('Система работы с тикетами'),

  async execute(interaction) {
    try {
      const hasCuratorRole = interaction.member.roles.cache.has(CURATOR_ROLE_ID);
      const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
      const hasAdminRole = ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
      const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
      const isCuratorOrAdmin = hasCuratorRole || isSpecialUser || hasAdminRole;

      let cooldownHours = 0;
      
      if (!isCuratorOrAdmin) {
        try {
          cooldownHours = await db.getCooldownHours(interaction.user.id);
        } catch (error) {
          console.error('Ошибка проверки кулдауна:', error);
          cooldownHours = 0;
        }
      }

      // Получаем статистику тикетов для отображения
      let freeCount = 0, occupiedCount = 0;
      try {
        const freeTickets = await db.getFreeTickets();
        const occupiedTickets = await db.getOccupiedTickets();
        freeCount = freeTickets?.length || 0;
        occupiedCount = occupiedTickets?.length || 0;
      } catch (e) {
        console.error('Ошибка получения статистики тикетов:', e);
      }

      // === ОПЦИИ ДЛЯ SELECTMENU ===
      const menuOptions = [];

      // Для обычных пользователей
      menuOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(cooldownHours > 0 ? `Создать тикет (КД: ${cooldownHours}ч)` : 'Создать тикет')
          .setDescription(cooldownHours > 0 ? 'Недоступно из-за кулдауна' : 'Создать новый тикет для персонажа')
          .setValue('create_ticket')
          .setEmoji('📝'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Мои тикеты')
          .setDescription('Просмотр ваших активных и завершённых тикетов')
          .setValue('my_tickets')
          .setEmoji('📋'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Поиск тикета')
          .setDescription('Найти тикет по номеру')
          .setValue('search_ticket')
          .setEmoji('🔍'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Помощь')
          .setDescription('Информация о системе тикетов')
          .setValue('ticket_help')
          .setEmoji('❓')
      );

      // Для кураторов/админов
      if (isCuratorOrAdmin) {
        menuOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel('Свободные тикеты')
            .setDescription(`${freeCount} тикетов ожидают куратора`)
            .setValue('manage_free')
            .setEmoji(EMOJIS.ticketFree || '📭'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Занятые тикеты')
            .setDescription(`${occupiedCount} тикетов в работе`)
            .setValue('manage_occupied')
            .setEmoji(EMOJIS.ticketOccupied || '📬'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Все тикеты')
            .setDescription('Просмотр всех активных тикетов')
            .setValue('manage_all')
            .setEmoji('📊'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Статистика кураторов')
            .setDescription('Рейтинг и статистика кураторов')
            .setValue('curator_stats')
            .setEmoji('📈')
        );
      }

      // Для высших админов
      if (hasHighAdminRole || isSpecialUser) {
        menuOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel('Управление пользователями')
            .setDescription('Сброс КД, просмотр пользователей')
            .setValue('manage_users')
            .setEmoji('👑'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Настройки системы')
            .setDescription('Общие настройки тикетов')
            .setValue('system_settings')
            .setEmoji('⚙️')
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_main_menu_${interaction.user.id}`)
        .setPlaceholder('🎫 Выберите действие...')
        .addOptions(menuOptions);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      // Создаём embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.ticket || '🎫'} Система тикетов RubyBot`)
        .setColor(parseInt(ticketConfig.design?.primaryColor?.replace('#', '') || '3498db', 16))
        .setTimestamp();

      // Описание в зависимости от роли
      let description = `Добро пожаловать в систему тикетов!\n\n`;
      
      if (cooldownHours > 0) {
        description += `${EMOJIS.warning || '⚠️'} **Кулдаун:** ${cooldownHours} часов до создания нового тикета\n\n`;
      } else if (!isCuratorOrAdmin) {
        description += `${EMOJIS.success || '✅'} Вы можете создать тикет прямо сейчас!\n\n`;
      }

      description += `📋 **Основные действия:**\n`;
      description += `• Создание тикета для персонажа\n`;
      description += `• Просмотр ваших тикетов\n`;
      description += `• Поиск по номеру\n\n`;

      if (isCuratorOrAdmin) {
        description += `⚙️ **Панель куратора:**\n`;
        description += `• ${EMOJIS.ticketFree || '📭'} Свободных: **${freeCount}**\n`;
        description += `• ${EMOJIS.ticketOccupied || '📬'} В работе: **${occupiedCount}**\n\n`;
      }

      description += `*⏰ Кулдаун: 72 часа (3 дня)*`;

      embed.setDescription(description);

      if (ticketConfig.images?.playerGreeting) {
        embed.setImage(ticketConfig.images.playerGreeting);
      }

      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Ошибка в команде /тикет:', error);
      await interaction.reply({
        content: '❌ Произошла ошибка при обработке команды!',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
