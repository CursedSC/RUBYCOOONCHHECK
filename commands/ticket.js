const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');

const Database = require('../database');

const db = new Database();

const CURATOR_ROLE_ID = '1382005661369368586';

const SPECIAL_USER_ID = '416602253160480769';

const ADMIN_ROLES = ['1382006178451685377', '1382005661369368586'];

const HIGH_ADMIN_ROLES = ['1382006799028322324']; // Высшая администрация

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

      // Проверяем кулдаун для обычных пользователей
      let cooldownHours = 0;
      let cooldownInfo = '';

      if (!hasCuratorRole && !isSpecialUser && !hasAdminRole) {
        try {
          cooldownHours = await db.getCooldownHours(interaction.user.id);
          if (cooldownHours > 0) {
            cooldownInfo = ` (КД: ${cooldownHours}ч)`;
          }
        } catch (error) {
          console.error('Ошибка проверки кулдауна:', error);
          cooldownHours = 0;
        }
      }

      // Создаем опции меню
      const options = [
        new StringSelectMenuOptionBuilder()
          .setLabel(cooldownHours > 0 ? `📝 Создать тикет${cooldownInfo}` : '📝 Создать тикет')
          .setDescription(cooldownHours > 0 ? `Доступно через ${cooldownHours} часов` : 'Создать новый тикет')
          .setValue('create_ticket')
          .setEmoji(cooldownHours > 0 ? '⏰' : '📝'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📋 Мои тикеты')
          .setDescription('Просмотреть свои тикеты')
          .setValue('my_tickets')
          .setEmoji('📋')
      ];

      // Добавляем опции для кураторов и админов
      if (hasCuratorRole || isSpecialUser || hasAdminRole) {
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel('🛠️ Работать с тикетами')
            .setDescription('Управление всеми тикетами')
            .setValue('manage_tickets')
            .setEmoji('1396816610362261524')
        );
      }

      // Добавляем опцию управления пользователями для высшей администрации
      if (hasHighAdminRole || isSpecialUser) {
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel('👥 Управление пользователями')
            .setDescription('Сброс кулдаунов и управление пользователями')
            .setValue('manage_users')
            .setEmoji('👑')
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`ticket_menu_${interaction.user.id}`)
        .setPlaceholder('Выберите действие с тикетами')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      // Создаем embed с информацией о кулдауне
      const embed = new EmbedBuilder()
        .setTitle('🎫 Система тикетов')
        .setDescription('Выберите действие из меню ниже:')
        .addFields(
          { name: '📝 Создать тикет', value: cooldownHours > 0 ? `Создание нового тикета\n⏰ **Кулдаун:** ${cooldownHours} часов` : 'Создание нового тикета для работы с персонажем', inline: true },
          { name: '📋 Мои тикеты', value: 'Просмотр ваших активных и закрытых тикетов', inline: true }
        )
        .setColor(0x3498db)
        .setImage("https://cdn.discordapp.com/attachments/1383161274896220231/1396839686911299754/Slide_16_9_-_5.png?ex=687f8bd5&is=687e3a55&hm=f3bf29264546574bd1256ca23b01cfcc8f77a478438b32073ba0a6085ec25431&")
        .setTimestamp();

      // Добавляем информацию о кулдауне в футер
      if (cooldownHours > 0) {
        embed.setFooter({ text: `⏰ Система кулдауна: ${cooldownHours} часов до следующего тикета` });
        embed.addFields({
          name: '⚠️ Активен кулдаун',
          value: `Вы сможете создать следующий тикет через **${cooldownHours} часов**.\n\n📋 Система кулдауна (48 часов) предотвращает спам тикетов и обеспечивает качественную обработку каждого обращения.\n\n💡 Пока ждете, вы можете просмотреть свои активные тикеты или обратиться к куратору в существующем тикете.`,
          inline: false
        });
      } else if (!hasCuratorRole && !isSpecialUser && !hasAdminRole) {
        embed.setFooter({ text: '⏰ Кулдаун между тикетами: 48 часов | Создайте тикет прямо сейчас!' });
      }

      // Добавляем поля для кураторов и админов
      if (hasCuratorRole || isSpecialUser || hasAdminRole) {
        embed.addFields(
          { name: '🛠️ Работать с тикетами', value: 'Управление тикетами (без кулдауна)', inline: true }
        );
        if (hasAdminRole) {
          embed.addFields(
            { name: '📦 Архив тикетов', value: 'Просмотр закрытых тикетов', inline: true }
          );
        }
        if (hasHighAdminRole || isSpecialUser) {
          embed.addFields({
            name: '👑 Управление пользователями',
            value: 'Сброс кулдаунов тикетов и управление пользователями',
            inline: true
          });
        }
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
