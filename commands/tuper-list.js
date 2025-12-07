const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('мои-профили')
        .setDescription('Показать список всех ваших профилей'),

    async execute(interaction) {
        const db = new Database();
        
        try {
            const profiles = await db.getUserProfiles(interaction.user.id);

            if (!profiles || profiles.length === 0) {
                return await interaction.reply({
                    content: '❌ У вас нет созданных профилей!\n\n' +
                            '💡 Создайте первый профиль командой `/создать-профиль`',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Создаем embed со списком профилей
            const embed = new EmbedBuilder()
                .setTitle('📋 Ваши профили')
                .setDescription(`Всего профилей: **${profiles.length}/10**`)
                .setColor('#9932CC')
                .setTimestamp()
                .setFooter({ 
                    text: `Запросил: ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            // Добавляем информацию о каждом профиле
            for (let i = 0; i < profiles.length; i++) {
                const profile = profiles[i];
                const createdDate = new Date(profile.created_at).toLocaleDateString('ru-RU');
                
                embed.addFields({
                    name: `${i + 1}. ${profile.name}`,
                    value: `🏷️ **Ключевое слово:** \`${profile.keyword}\`\n` +
                          `🎨 **Цвет:** ${profile.color}\n` +
                          `📅 **Создан:** ${createdDate}\n` +
                          `📝 **Использование:** \`${profile.keyword}: ваш текст\``,
                    inline: true
                });

                // Добавляем разделитель после каждых двух профилей
                if ((i + 1) % 2 === 0 && i < profiles.length - 1) {
                    embed.addFields({
                        name: '\u200B',
                        value: '\u200B',
                        inline: false
                    });
                }
            }

            // Добавляем инструкцию по использованию
            embed.addFields({
                name: '💡 Как использовать профили?',
                value: 'Напишите в любом канале: `ключевое_слово: ваш текст`\n' +
                      'Пример: `аня: Привет всем! Как дела?`',
                inline: false
            });

            // Добавляем информацию об управлении профилями
            embed.addFields({
                name: '🛠️ Управление профилями',
                value: '• `/создать-профиль` - создать новый профиль\n' +
                      '• `/удалить-профиль` - удалить профиль\n' +
                      '• `/мои-профили` - показать все профили',
                inline: false
            });

            await interaction.reply({ 
                embeds: [embed], 
                flags: MessageFlags.Ephemeral 
            });

            console.log(`📋 Пользователь ${interaction.user.username} просмотрел свои профили (${profiles.length})`);

        } catch (error) {
            console.error('Ошибка получения профилей:', error);
            
            await interaction.reply({
                content: '❌ Произошла ошибка при загрузке профилей. Попробуйте позже.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};



const { EmbedBuilder, MessageFlags, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const Database = require('../database');

const { TicketLogger, TICKET_ACTION_TYPES } = require('../utils/ticketLogger');

const db = new Database();

// Хранилище обработанных взаимодействий
const processedInteractions = new Set();

// ID категорий для тикетов
const TICKET_CATEGORY_ID = '1398570943533678736'; // Основная категория для тикетов
const OVERFLOW_TICKET_CATEGORY_ID = '1410130168156000288'; // Дополнительная категория при переполнении

// ID роли "Состав Администрации" - ЗАМЕНИТЕ НА РЕАЛЬНЫЙ ID
const ADMIN_PING_ROLE_ID = '1382005661369368586'; // ID роли "Состав Администрации"
const ADMIN_ROLES = ['1382006178451685377', '1382005661369368586'];
const HIGH_ADMIN_ROLES = ['1382006799028322324'];

const CUSTOM_EMOJIS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  CURATOR: '<:chief:1396827256596467742>',
  USER: '<:user:1396827248098545726>',
  TICKET_FREE: '<:emptybox:1396816640196476998>',
  TICKET_OCCUPIED: '<:Lock:1396817745399644270>',
  STATUS_CHANGE: '🔄',
  PARTICIPANTS: '👥',
  STAR_FULL: '<:star_f:1396828897244610590>',
  STAR_HALF: '<:star_h:1396828886939074710>',
  STAR_EMPTY: '<:star:1396814932397396048>',
  ACCEPT: '<:Tick:1396822406751981702>',
  TROPHY: '🏆',
  MEDAL_GOLD: '🥇',
  MEDAL_SILVER: '🥈',
  MEDAL_BRONZE: '🥉'
};

// Функция для выбора категории с учетом лимита каналов
async function selectTicketCategory(guild) {
  try {
    // Получаем основную категорию
    const mainCategory = guild.channels.cache.get(TICKET_CATEGORY_ID);
    if (!mainCategory) {
      console.log('⚠️ Основная категория тикетов не найдена!');
      return OVERFLOW_TICKET_CATEGORY_ID; // Используем дополнительную как fallback
    }

    // Подсчитываем количество каналов в основной категории
    const channelsInMainCategory = guild.channels.cache.filter(
      channel => channel.parentId === TICKET_CATEGORY_ID && channel.type === ChannelType.GuildText
    ).size;

    console.log(`📊 Каналов в основной категории: ${channelsInMainCategory}/50`);

    // Если в основной категории меньше 50 каналов, используем её
    if (channelsInMainCategory < 50) {
      return TICKET_CATEGORY_ID;
    }

    // Иначе используем дополнительную категорию
    console.log('📁 Основная категория заполнена, используем дополнительную категорию');
    return OVERFLOW_TICKET_CATEGORY_ID;
  } catch (error) {
    console.error('Ошибка при выборе категории:', error);
    return OVERFLOW_TICKET_CATEGORY_ID; // Fallback к дополнительной категории
  }
}

// Функция для раскрытия тикета для администрации
async function expandTicketForAdmins(ticketChannel, guild, purpose) {
  // Проверяем, есть ли упоминание роли администрации в цели тикета
  const adminRoleMention = `<@&${ADMIN_PING_ROLE_ID}>`;
  const hasAdminMention = purpose.includes(adminRoleMention) ||
    purpose.includes('@Состав Администрации') ||
    purpose.toLowerCase().includes('состав администрации');

  if (!hasAdminMention) {
    return false;
  }

  try {
    // Получаем роль администрации
    const adminRole = guild.roles.cache.get(ADMIN_PING_ROLE_ID);
    if (!adminRole) {
      console.log('⚠️ Роль "Состав Администрации" не найдена');
      return false;
    }

    // Даем доступ роли администрации к каналу
    await ticketChannel.permissionOverwrites.create(ADMIN_PING_ROLE_ID, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      ManageMessages: true
    });

    // Даем доступ всем ролям из ADMIN_ROLES и HIGH_ADMIN_ROLES
    const allAdminRoles = [...ADMIN_ROLES, ...HIGH_ADMIN_ROLES];
    for (const roleId of allAdminRoles) {
      try {
        await ticketChannel.permissionOverwrites.create(roleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          ManageMessages: true
        });
      } catch (error) {
        console.log(`Ошибка добавления роли ${roleId}:`, error.message);
      }
    }
    return true;
  } catch (error) {
    console.error('Ошибка раскрытия тикета для администрации:', error);
    return false;
  }
}

module.exports = {
  name: 'modalSubmit',
  async execute(interaction) {
    try {
      // Проверяем уникальность взаимодействия
      if (processedInteractions.has(interaction.id)) {
        console.log(`⚠️ Взаимодействие ${interaction.id} уже обработано`);
        return;
      }

      if (interaction.replied || interaction.deferred) {
        console.log('ModalSubmit: взаимодействие уже обработано');
        return;
      }

      processedInteractions.add(interaction.id);
      setTimeout(() => {
        processedInteractions.delete(interaction.id);
      }, 5 * 60 * 1000);

      // =============================
      // СИСТЕМА ТИКЕТОВ С КУЛДАУНОМ
      // =============================
      if (interaction.customId.startsWith('create_ticket_modal_')) {
        const userId = interaction.customId.split('_')[3];
        if (interaction.user.id !== userId) {
          return await safeReply(interaction, {
            content: '❌ Вы можете создавать только свои тикеты!',
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          // Проверяем кулдаун ПЕРЕД валидацией
          const cooldownHours = await db.getCooldownHours(userId);
          if (cooldownHours > 0) {
            return await interaction.editReply({
              content: `❌ Вы можете создать следующий тикет через **${cooldownHours} часов**!\n⏰ Кулдаун между тикетами составляет 48 часов.\n\n📋 Система кулдауна предотвращает спам тикетов и обеспечивает качественную обработку каждого обращения.`
            });
          }

          const purpose = interaction.fields.getTextInputValue('purpose');
          const characterIds = interaction.fields.getTextInputValue('character_ids');

          // Валидация цели тикета
          if (!purpose || purpose.length < 10) {
            return await interaction.editReply({
              content: '❌ Цель тикета должна содержать минимум 10 символов!'
            });
          }

          if (!characterIds || characterIds.trim() === '') {
            return await interaction.editReply({
              content: '❌ Укажите ID персонажей!'
            });
          }

          // Парсим ID персонажей через запятую
          const characterIdArray = characterIds.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);

          if (characterIdArray.length === 0) {
            return await interaction.editReply({
              content: '❌ Не указаны корректные ID персонажей! Используйте числовые ID через запятую.'
            });
          }

          // Получаем персонажей создателя тикета
          const userCharacters = await db.getAllCharactersByUserId(userId);

          // Проверяем, есть ли хотя бы один персонаж создателя
          const userOwnedCharacterIds = characterIdArray.filter(id =>
            userCharacters.some(char => char.id === id)
          );

          if (userOwnedCharacterIds.length === 0) {
            return await interaction.editReply({
              content: '❌ В списке должен быть хотя бы один ваш персонаж! Вы можете включать только персонажей, которые принадлежат вам или другим игрокам.'
            });
          }

          // Получаем информацию о всех указанных персонажах
          const allValidCharacters = [];
          const characterOwners = new Set([userId]); // Создатель всегда добавляется

          for (const charId of characterIdArray) {
            const character = await db.getCharacterById(charId);
            if (character) {
              allValidCharacters.push(character);
              characterOwners.add(character.user_id); // Добавляем владельца персонажа
            }
          }

          if (allValidCharacters.length === 0) {
            return await interaction.editReply({
              content: '❌ Указанные персонажи не найдены в базе данных!'
            });
          }

          // Проверяем, что есть хотя бы один персонаж создателя
          const hasUserCharacter = allValidCharacters.some(char => char.user_id === userId);
          if (!hasUserCharacter) {
            return await interaction.editReply({
              content: '❌ В тикете должен быть хотя бы один ваш персонаж!'
            });
          }

          // Получаем следующий номер тикета
          const ticketNumber = await db.getNextTicketNumber();

          // Определяем категорию с учетом лимита
          const selectedCategoryId = await selectTicketCategory(interaction.guild);

          // СОЗДАЕМ КАНАЛ В ВЫБРАННОЙ КАТЕГОРИИ
          const ticketChannel = await interaction.guild.channels.create({
            name: `тикет-${ticketNumber}`,
            type: ChannelType.GuildText,
            parent: selectedCategoryId, // Используем выбранную категорию
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: ['ViewChannel'] // Скрываем от всех
              },
              {
                id: userId,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles']
              }
            ]
          });

          // Логируем информацию о выбранной категории
          const categoryName = selectedCategoryId === TICKET_CATEGORY_ID ? 'основной' : 'дополнительной';
          console.log(`✅ Тикет #${ticketNumber} создан в ${categoryName} категории (ID: ${selectedCategoryId})`);

          // Проверяем на упоминание администрации и раскрываем тикет если нужно
          const isAdminTicket = await expandTicketForAdmins(ticketChannel, interaction.guild, purpose);

          // Добавляем всех владельцев персонажей в канал через права доступа
          const addedUsers = [];
          for (const ownerId of characterOwners) {
            if (ownerId !== userId) { // Создатель уже добавлен
              try {
                await ticketChannel.permissionOverwrites.create(ownerId, {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true,
                  AttachFiles: true
                });
                const member = interaction.guild.members.cache.get(ownerId);
                if (member) {
                  addedUsers.push(member.displayName);
                }
              } catch (error) {
                console.log(`Не удалось добавить пользователя ${ownerId} в канал:`, error.message);
              }
            }
          }

          // Создаем тикет в базе данных С КУЛДАУНОМ
          await db.createTicket({
            ticket_number: ticketNumber,
            purpose: purpose,
            character_ids: allValidCharacters.map(char => char.id).join(','),
            creator_id: userId,
            channel_id: ticketChannel.id,
            participants: Array.from(characterOwners).join(',')
          });

          await TicketLogger.logTicketAction(interaction.client, {
            admin_id: userId,
            action_type: TICKET_ACTION_TYPES.TICKET_CREATED,
            ticket_number: ticketNumber,
            target_user_id: userId,
            details: {
              creator_id: userId,
              purpose: purpose.substring(0, 200),
              character_count: allValidCharacters.length,
              participants_count: characterOwners.size,
              is_admin_ticket: isAdminTicket,
              category_id: selectedCategoryId,
              category_type: selectedCategoryId === TICKET_CATEGORY_ID ? 'main' : 'overflow'
            },
            success: true,
            channel_id: ticketChannel.id,
            guild_id: interaction.guildId
          });

          // Формируем информацию о персонажах для отображения
          const charactersList = allValidCharacters.map(char => {
            const owner = interaction.guild.members.cache.get(char.user_id);
            const ownerName = owner ? owner.displayName : 'Неизвестный игрок';
            return `**${char.name}** (ID: ${char.id}) - ${ownerName}`;
          }).join('\n');

          // Создаем embed для тикета
          const ticketEmbed = new EmbedBuilder()
            .setTitle(`🎫 Тикет #${ticketNumber}`)
            .setDescription('**Новый тикет создан!**')
            .addFields(
              { name: '👤 Создатель', value: `<@${userId}>`, inline: true },
              { name: '📋 Статус', value: 'Ожидает куратора', inline: true },
              { name: '⏰ Кулдаун', value: '48 часов до следующего тикета', inline: true },
              { name: '👥 Участники', value: Array.from(characterOwners).map(id => `<@${id}>`).join(', '), inline: false },
              { name: '🎭 Персонажи', value: charactersList, inline: false },
              { name: '📝 Цель', value: purpose, inline: false }
            )
            .setColor(isAdminTicket ? 0xff0000 : 0xffa500)
            .setTimestamp()
            .setFooter({
              text: `ID тикета: ${ticketNumber} • Персонажей: ${allValidCharacters.length} • Участников: ${characterOwners.size} • Кулдаун: 48ч${isAdminTicket ? ' • АДМИН ТИКЕТ' : ''}${selectedCategoryId === OVERFLOW_TICKET_CATEGORY_ID ? ' • ДОПОЛНИТЕЛЬНАЯ КАТЕГОРИЯ' : ''}`
            });

          // Отправляем сообщение в канал
          let welcomeMessage = `🎫 **Добро пожаловать в тикет #${ticketNumber}!**\n\n`;
          welcomeMessage += `👤 **Создатель:** <@${userId}>\n`;
          if (addedUsers.length > 0) {
            welcomeMessage += `👥 **Автоматически добавлены владельцы персонажей:** ${addedUsers.join(', ')}\n`;
          }
          welcomeMessage += `\n📝 **Цель тикета:** ${purpose}`;

          // Если тикет раскрыт для администрации - добавляем уведомление
          if (isAdminTicket) {
            const adminRole = interaction.guild.roles.cache.get(ADMIN_PING_ROLE_ID);
            if (adminRole) {
              welcomeMessage += `\n\n🚨 **ВНИМАНИЕ! Тикет раскрыт для администрации!**\n${adminRole.toString()} - требуется внимание администрации к данному тикету.`;
            }
          }

          await ticketChannel.send({
            content: welcomeMessage,
            embeds: [ticketEmbed]
          });

          // Если тикет для администрации - отправляем дополнительное уведомление
          if (isAdminTicket) {
            const adminNotificationEmbed = new EmbedBuilder()
              .setTitle('🚨 Административный тикет')
              .setDescription(`Тикет #${ticketNumber} содержит упоминание администрации и требует особого внимания.`)
              .addFields(
                { name: '👤 Создатель', value: `<@${userId}>`, inline: true },
                { name: '🎫 Номер тикета', value: ticketNumber.toString(), inline: true },
                { name: '⏰ Время создания', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                { name: '📝 Цель тикета', value: purpose.substring(0, 200) + (purpose.length > 200 ? '...' : ''), inline: false }
              )
              .setColor(0xff0000)
              .setTimestamp();

            const adminRole = interaction.guild.roles.cache.get(ADMIN_PING_ROLE_ID);
            if (adminRole) {
              await ticketChannel.send({
                content: `${adminRole.toString()} 🚨 **ТРЕБУЕТСЯ ВНИМАНИЕ АДМИНИСТРАЦИИ**`,
                embeds: [adminNotificationEmbed]
              });
            }
          }

          // Отправляем уведомление создателю
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Тикет создан успешно!')
            .setDescription(`Ваш тикет #${ticketNumber} создан и ожидает куратора.\n\n⏰ **Важно:** Следующий тикет можно будет создать через **48 часов**.${isAdminTicket ? '\n\n🚨 **Тикет раскрыт для администрации** - все администраторы имеют доступ к каналу.' : ''}${selectedCategoryId === OVERFLOW_TICKET_CATEGORY_ID ? '\n\n📁 **Тикет создан в дополнительной категории** из-за переполнения основной.' : ''}`)
            .addFields(
              { name: '🔗 Ссылка на канал', value: `<#${ticketChannel.id}>`, inline: false },
              { name: '📋 Статус', value: 'Ожидает куратора', inline: true },
              { name: '🎭 Персонажей', value: allValidCharacters.length.toString(), inline: true },
              { name: '👥 Участников', value: characterOwners.size.toString(), inline: true },
              { name: '⏰ Кулдаун', value: '48 часов', inline: true }
            )
            .setColor(isAdminTicket ? 0xff0000 : 0x00ff00)
            .setTimestamp();

          if (addedUsers.length > 0) {
            successEmbed.addFields({
              name: '👥 Добавлены автоматически',
              value: `Владельцы персонажей: ${addedUsers.join(', ')}`,
              inline: false
            });
          }

          if (isAdminTicket) {
            successEmbed.addFields({
              name: '🚨 Административный тикет',
              value: 'Тикет автоматически раскрыт для всех администраторов из-за упоминания "Состав Администрации" в цели тикета.',
              inline: false
            });
          }

          await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
          console.error('Ошибка создания тикета:', error);
          await safeInteractionReply(interaction, {
            content: '❌ Произошла ошибка при создании тикета!'
          });
        }

        return;
      }

      // =============================
      // СБРОС КУЛДАУНА ТИКЕТОВ
      // =============================
      if (interaction.customId.startsWith('cooldown_reset_modal_')) {
        const adminId = interaction.customId.split('_')[3];

        // Проверка прав доступа
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === '416602253160480769';

        if (interaction.user.id !== adminId || (!hasHighAdminRole && !isSpecialUser)) {
          return await safeReply(interaction, {
            content: '❌ У вас нет прав для сброса кулдаунов!',
            flags: MessageFlags.Ephemeral
          });
        }

        const userInput = interaction.fields.getTextInputValue('user_id').trim();

        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          let userId;
          // Извлекаем ID из упоминания или используем как есть
          if (userInput.startsWith('<@') && userInput.endsWith('>')) {
            userId = userInput.slice(2, -1);
            if (userId.startsWith('!')) {
              userId = userId.slice(1);
            }
          } else if (/^\d+$/.test(userInput)) {
            userId = userInput;
          } else {
            return await interaction.editReply({
              content: '❌ Неверный формат! Используйте ID пользователя или упоминание (@user)'
            });
          }

          // Проверяем, существует ли пользователь на сервере
          const member = interaction.guild.members.cache.get(userId);
          if (!member) {
            return await interaction.editReply({
              content: '❌ Пользователь не найден на этом сервере!'
            });
          }

          // Получаем информацию о кулдауне
          const cooldownInfo = await db.getUserCooldownInfo(userId);
          if (!cooldownInfo) {
            return await interaction.editReply({
              content: `❌ У пользователя **${member.displayName}** нет активного кулдауна тикетов!`
            });
          }

          // Сбрасываем кулдаун
          const resetResult = await db.resetUserTicketCooldown(userId);

          if (resetResult > 0) {
            // Логируем сброс кулдауна
            await TicketLogger.logTicketAction(interaction.client, {
              admin_id: interaction.user.id,
              action_type: TICKET_ACTION_TYPES.COOLDOWN_RESET,
              ticket_number: null,
              target_user_id: userId,
              details: {
                target_username: member.displayName,
                reason: 'Административный сброс кулдауна'
              },
              success: true,
              channel_id: interaction.channelId,
              guild_id: interaction.guildId
            });
          }

          if (resetResult === 0) {
            return await interaction.editReply({
              content: `❌ Не удалось сбросить кулдаун для **${member.displayName}**. Возможно, кулдаун уже истек.`
            });
          }

          // Создаем embed с подтверждением
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Кулдаун сброшен!')
            .setDescription(`**Кулдаун тикета успешно сброшен для пользователя:**`)
            .addFields(
              { name: '👤 Пользователь', value: `${member.displayName} (${member.user.tag})`, inline: true },
              { name: '🆔 ID', value: userId, inline: true },
              { name: '👨‍💼 Администратор', value: `<@${interaction.user.id}>`, inline: true },
              { name: '⏰ Время сброса', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ text: 'Пользователь теперь может создать новый тикет' });

          await interaction.editReply({ embeds: [successEmbed] });

          // Отправляем уведомление в лог-канал (опционально)
          const LOG_CHANNEL_ID = '1381454654440865934'; // Замените на ваш лог-канал
          const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);

          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('📊 Лог сброса кулдауна тикета')
              .setDescription(`🔧 **Администратор:** <@${interaction.user.id}>\n👤 **Пользователь:** ${member.displayName} (${userId})`)
              .setColor(0x3498db)
              .addFields({
                name: '📈 Действие:',
                value: 'Сброс кулдауна тикета (48 часов)',
                inline: false
              }, {
                name: '📊 Информация:',
                value: `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Канал:** <#${interaction.channelId}>`,
                inline: false
              })
              .setFooter({ text: `ID администратора: ${interaction.user.id}` })
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
          }

        } catch (error) {
          console.error('Ошибка сброса кулдауна:', error);
          await safeInteractionReply(interaction, {
            content: '❌ Произошла ошибка при сбросе кулдауна!'
          });
        }

        return;
      }

      console.log(`Необработанное модальное окно: ${interaction.customId}`);

    } catch (error) {
      console.error('Критическая ошибка в modalSubmit:', error);
      try {
        await safeInteractionReply(interaction, {
          content: 'Произошла критическая ошибка!'
        });
      } catch (replyError) {
        console.error('Не удалось отправить сообщение об ошибке:', replyError);
      }
    }
  }
};

// Безопасная функция для ответа на взаимодействие
async function safeReply(interaction, options) {
  try {
    if (interaction.replied) {
      return await interaction.followUp(options);
    } else if (interaction.deferred) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  } catch (error) {
    if (error.code === 10062) {
      console.log(`⚠️ Взаимодействие ${interaction.id} истекло`);
      return null;
    }
    if (error.code === 40060) {
      console.log(`⚠️ Взаимодействие ${interaction.id} уже подтверждено`);
      try {
        return await interaction.followUp(options);
      } catch (followUpError) {
        console.log(`⚠️ Не удалось отправить followUp для ${interaction.id}`);
        return null;
      }
    }
    throw error;
  }
}

// Безопасная функция для ответа с проверкой состояния
async function safeInteractionReply(interaction, options) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        ...options,
        flags: MessageFlags.Ephemeral
      });
    } else if (interaction.deferred) {
      await interaction.editReply(options);
    } else {
      await interaction.followUp({
        ...options,
        flags: MessageFlags.Ephemeral
      });
    }
  } catch (error) {
    console.error('Ошибка безопасного ответа:', error);
  }
}
