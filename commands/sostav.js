// commands/sostav.js

const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, ComponentType, MessageFlags } = require('discord.js');

// Категории и роли администрации
const ADMIN_CATEGORIES = [
  {
    name: 'Owner Staff',
    roles: [
      '1382006178451685377', // Owner
      '1381454973576941568'  // Co-Owner
    ]
  },
  {
    name: 'High Adm Staff',
    roles: [
      '1382006968247517277',
      '1382006972034977942',
      '1382006967450472599',
      '1382006959401603202',
      '1381950509963018250',
      '1382009782738751578'
    ]
  },
  {
    name: 'Admin Staff',
    roles: [
      '1382016268101484707',
      '1382016269720748174',
      '1382014665579692072',
      '1382009784315809923',
      '1382009786085671035',
      '1382014660332748840'
    ]
  }
];

// Шаблонные описания для ролей
const ROLE_DESCRIPTIONS = {
  '1382006178451685377': 'Владелец сервера. Отвечает за стратегию, развитие и безопасность сообщества.',
  '1381454973576941568': 'Со-владелец. Помогает в управлении сервером и принятии ключевых решений.',
  '1382006968247517277': 'Старший администратор. Курирует работу администрации и следит за порядком.',
  '1382006972034977942': 'Старший администратор. Отвечает за организацию мероприятий и контроль модерации.',
  '1382006967450472599': 'Старший администратор. Помогает в технических вопросах и поддержке пользователей.',
  '1382006959401603202': 'Старший администратор. Следит за выполнением правил и помогает новичкам.',
  '1381950509963018250': 'Старший администратор. Отвечает за внутренние процессы и коммуникацию.',
  '1382009782738751578': 'Старший администратор. Контролирует работу модераторов и развитие сервера.',
  '1382016268101484707': 'Администратор. Следит за порядком, помогает участникам и модерирует чаты.',
  '1382016269720748174': 'Администратор. Отвечает за организацию и проведение ивентов.',
  '1382014665579692072': 'Администратор. Помогает в решении конфликтных ситуаций.',
  '1382009784315809923': 'Администратор. Следит за технической частью и поддержкой пользователей.',
  '1382009786085671035': 'Администратор. Контролирует соблюдение правил и помогает новичкам.',
  '1382014660332748840': 'Администратор. Участвует в развитии и продвижении сервера.'
};

// Индивидуальные профили (опционально, можно расширять)
const adminProfiles = {
  // 'user_id': { name: 'Имя', position: 'Должность', description: 'О себе', embed_color: '#цвет' }
};

// Список пользователей с доступом к команде
const allowedUserIds = [
  '416602253160480769'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('состав')
    .setDescription('Показать состав администрации по категориям'),

  async execute(interaction) {
    // Проверка доступа по userId
    if (!allowedUserIds.includes(interaction.user.id)) {
      return interaction.reply({
        content: 'У вас нет доступа к этой команде.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Формируем группы для select menu с категориями
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_admin_role')
      .setPlaceholder('Выберите категорию и роль')
      .setMinValues(1)
      .setMaxValues(1);

    for (const category of ADMIN_CATEGORIES) {
      const options = [];
      for (const roleId of category.roles) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          options.push({
            label: role.name,
            value: role.id,
            description: ROLE_DESCRIPTIONS[role.id]?.slice(0, 80) || category.name,
            emoji: '👤'
          });
        }
      }
      if (options.length > 0) {
        selectMenu.addOptions(options);
      }
    }

    await interaction.reply({
      content: 'Выберите категорию и роль администрации:',
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      flags: MessageFlags.Ephemeral
    });

    // Ожидаем выбор роли
    const roleSelect = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && i.customId === 'select_admin_role',
      componentType: ComponentType.StringSelect,
      time: 30_000
    }).catch(() => null);

    if (!roleSelect) return;

    const selectedRoleId = roleSelect.values[0];
    const selectedRole = interaction.guild.roles.cache.get(selectedRoleId);
    const members = selectedRole.members.filter(m => !m.user.bot);

    if (members.size === 0) {
      return roleSelect.update({
        content: 'Нет пользователей с этой ролью.',
        components: [],
        flags: MessageFlags.Ephemeral
      });
    }

    // Формируем dropdown с пользователями
    const userMenu = new StringSelectMenuBuilder()
      .setCustomId('select_admin_user')
      .setPlaceholder('Выберите администратора')
      .addOptions(
        members.map(member => ({
          label: member.displayName,
          value: member.id,
          description: member.user.tag,
          emoji: '👤'
        }))
      );

    await roleSelect.update({
      content: `Вы выбрали роль: **${selectedRole.name}**\nТеперь выберите администратора:`,
      components: [new ActionRowBuilder().addComponents(userMenu)],
      flags: MessageFlags.Ephemeral
    });

    // Ожидаем выбор пользователя
    const userSelect = await interaction.channel.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && i.customId === 'select_admin_user',
      componentType: ComponentType.StringSelect,
      time: 30_000
    }).catch(() => null);

    if (!userSelect) return;

    const selectedUserId = userSelect.values[0];
    const member = interaction.guild.members.cache.get(selectedUserId);

    // Получаем профиль администратора
    let profile = adminProfiles[selectedUserId];
    let about = profile?.description;

    // Если нет индивидуального описания — используем шаблон по роли
    if (!about || about === '') {
      about = ROLE_DESCRIPTIONS[selectedRoleId] || 'Информация не заполнена';
    }

    // Красивый embed-профиль
    const embed = new EmbedBuilder()
      .setTitle(`Профиль администратора`)
      .setColor(profile?.embed_color || '#9932cc')
      .setThumbnail(member.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Имя', value: profile?.name || member.displayName, inline: true },
        { name: 'Должность', value: profile?.position || selectedRole.name, inline: true },
        { name: 'О себе', value: about, inline: false }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await userSelect.update({
      content: '',
      embeds: [embed],
      components: [],
      flags: MessageFlags.Ephemeral
    });
  }
};
