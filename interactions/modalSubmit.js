const { 
    EmbedBuilder, 
    MessageFlags, 
    ChannelType, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const Database = require('../database');
const { TicketLogger, TICKET_ACTION_TYPES } = require('../utils/ticketLogger');
const { handleCustomStylingModal } = require('./customStylingHandler');

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
    STATUSCHANGE: 'ℹ️',
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
    canHandle(interaction) {
        // Обрабатываем ВСЕ модальные окна
        if (interaction.isModalSubmit()) {
            return true;
        }
       
        // Обрабатываем кнопки тренировок
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('training_approve_') || 
                interaction.customId.startsWith('training_reject_')) {
                console.log(`✅ modalSubmit.canHandle: кнопка тренировки ${interaction.customId}`);
                return true;
            }
        }
        
        return false;
    },
    async execute(interaction) {
        // Проверка дубликатов (если есть)
        const interactionKey = `${interaction.id}_${interaction.user.id}`;
        if (processedInteractions.has(interactionKey)) {
            console.log('⚠️ Дублированная интеракция, пропуск:', interactionKey);
            return;
        }
        processedInteractions.add(interactionKey);
        setTimeout(() => processedInteractions.delete(interactionKey), 15000);


        // ===== ОБРАБОТКА КНОПОК ТРЕНИРОВОК =====
        if (interaction.isButton()) {
            // Одобрение тренировки - показываем модальное окно
            if (interaction.customId.startsWith('training_approve_')) {
                const sessionId = interaction.customId.split('_')[2];
                
                const modal = new ModalBuilder()
                    .setCustomId(`training_approve_modal_${sessionId}`)
                    .setTitle('Одобрение тренировки');

                const commentInput = new TextInputBuilder()
                    .setCustomId('approval_comment')
                    .setLabel('Комментарий аналитика')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Введите комментарий к тренировке...')
                    .setRequired(false)
                    .setMaxLength(1000);

                const statsInput = new TextInputBuilder()
                    .setCustomId('stats_bonus')
                    .setLabel('Прибавка к статам (если есть)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Например: сила+5, ловкость+3')
                    .setRequired(false)
                    .setMaxLength(200);

                const rewardsInput = new TextInputBuilder()
                    .setCustomId('additional_rewards')
                    .setLabel('Дополнительные награды')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Например: 1/3 прогресс, новая способность')
                    .setRequired(false)
                    .setMaxLength(300);

                const row1 = new ActionRowBuilder().addComponents(commentInput);
                const row2 = new ActionRowBuilder().addComponents(statsInput);
                const row3 = new ActionRowBuilder().addComponents(rewardsInput);

                modal.addComponents(row1, row2, row3);

                await interaction.showModal(modal);
                console.log(`✅ Модальное окно одобрения показано для сессии ${sessionId}`);
                return;
            }

            // Отклонение тренировки - показываем модальное окно
            if (interaction.customId.startsWith('training_reject_')) {
                const sessionId = interaction.customId.split('_')[2];

                const modal = new ModalBuilder()
                    .setCustomId(`training_reject_modal_${sessionId}`)
                    .setTitle('Отклонение тренировки');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('rejection_reason')
                    .setLabel('Причина отклонения')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Укажите причину отклонения тренировки...')
                    .setRequired(true)
                    .setMaxLength(1000);

                const row = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                console.log(`✅ Модальное окно отклонения показано для сессии ${sessionId}`);
                return;
            }
        }

        // ===== ОБРАБОТКА МОДАЛЬНЫХ ОКОН =====
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('customstyling_modal_')) {
                await handleCustomStylingModal(interaction);
                return;
            }
    
            if (interaction.customId.startsWith('searchticketmodal')) {
              const parts = interaction.customId.split(':');
              const ownerId = parts[1];
            
              if (ownerId && interaction.user.id !== ownerId) {
                return await safeReply(interaction, {
                  content: `${CUSTOM_EMOJIS.ERROR} Эта модалка поиска не для вас.`,
                  flags: MessageFlags.Ephemeral
                });
              }
          
              const raw = interaction.fields.getTextInputValue('ticketnumber')?.trim();
              const ticketNumber = parseInt(raw, 10);
          
              if (!Number.isInteger(ticketNumber) || ticketNumber <= 0) {
                return await safeReply(interaction, {
                  content: `${CUSTOM_EMOJIS.ERROR} Введите корректный номер тикета.`,
                  flags: MessageFlags.Ephemeral
                });
              }
          
              try {
                const ticket = await db.getTicketByNumber(ticketNumber);
                if (!ticket) {
                  return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Тикет #${ticketNumber} не найден.`,
                    flags: MessageFlags.Ephemeral
                  });
                }
            
                const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
                const creator = interaction.guild.members.cache.get(ticket.creator_id);
                const curator = ticket.curator_id
                  ? interaction.guild.members.cache.get(ticket.curator_id)
                  : null;
            
                // Эмодзи статусов
                const STATUS_EMOJIS = {
                  'Ожидает куратора': '⏳',
                  'В работе': '🔧',
                  'Ожидает ответа': '💬',
                  'Завершен': '✅',
                  'Приостановлен': '⏸️',
                  'Закрыт': '🔒',
                  'Почти готов': '🎯'
                };

                const STATUS_COLORS = {
                  'Ожидает куратора': 0xffa500,
                  'В работе': 0x00ff00,
                  'Ожидает ответа': 0xffff00,
                  'Завершен': 0x32cd32,
                  'Приостановлен': 0xff6347,
                  'Закрыт': 0x666666,
                  'Почти готов': 0x9370db
                };

                const statusEmoji = STATUS_EMOJIS[ticket.status] || '❓';
                const statusColor = STATUS_COLORS[ticket.status] || 0x3498db;

                // Персонажи с красивым оформлением
                let charactersBlock = '```\n• Персонажи не найдены\n```';
                if (ticket.character_ids) {
                  const ids = ticket.character_ids
                    .split(',')
                    .map(id => parseInt(id.trim(), 10))
                    .filter(id => !isNaN(id));
                
                  const charParts = [];
                  for (const id of ids.slice(0, 5)) {
                    const char = await db.getCharacterById(id);
                    if (char) {
                      charParts.push(`• ID ${char.id} — ${char.name}`);
                    } else {
                      charParts.push(`• ID ${id} — Не найден`);
                    }
                  }
                  if (charParts.length > 0) {
                    charactersBlock = '```\n' + charParts.join('\n') + '\n```';
                  }
                  if (ids.length > 5) {
                    charactersBlock += `\n*...и ещё ${ids.length - 5} персонажей*`;
                  }
                }
            
                const purpose =
                  ticket.purpose && ticket.purpose.length > 300
                    ? `${ticket.purpose.substring(0, 300)}...`
                    : (ticket.purpose || 'Без описания.');

                // Информация о времени
                const createdAt = ticket.created_at ? new Date(ticket.created_at) : null;
                const timeInfo = createdAt 
                  ? `<t:${Math.floor(createdAt.getTime() / 1000)}:R>` 
                  : 'Неизвестно';

                // Основная информация
                const infoList = [
                  `${CUSTOM_EMOJIS.USER} **Создатель:** ${creator ? `${creator}` : `<@${ticket.creator_id}>`}`,
                  `${CUSTOM_EMOJIS.CURATOR} **Куратор:** ${curator ? `${curator}` : (ticket.curator_id ? `<@${ticket.curator_id}>` : '*Не назначен*')}`,
                  `${statusEmoji} **Статус:** ${ticket.status || 'Неизвестно'}`,
                  `📅 **Создан:** ${timeInfo}`,
                  `📁 **Канал:** ${ticketChannel ? `<#${ticket.channel_id}>` : '*Канал удалён*'}`
                ].join('\n');

                const embed = new EmbedBuilder()
                  .setTitle(`🔍 Тикет #${ticket.ticket_number}`)
                  .setDescription(`**📝 Цель тикета:**\n> ${purpose}`)
                  .addFields(
                    {
                      name: '📋 Основная информация',
                      value: infoList,
                      inline: false
                    },
                    {
                      name: '🎭 Персонажи',
                      value: charactersBlock,
                      inline: false
                    }
                  )
                  .setColor(statusColor)
                  .setFooter({ text: `Поиск выполнен пользователем ${interaction.user.tag}` })
                  .setTimestamp();

                // Добавляем thumbnail если есть аватар создателя
                if (creator) {
                  embed.setThumbnail(creator.user.displayAvatarURL({ dynamic: true, size: 128 }));
                }

                // ===== КНОПКИ УПРАВЛЕНИЯ ТИКЕТОМ ИЗ ПОИСКА =====
                const buttons1 = [];
                
                // Кнопка "Взять тикет" только если тикет свободен
                if (!ticket.curator_id) {
                  buttons1.push(
                    new ButtonBuilder()
                      .setCustomId(`take_ticket_${ticketNumber}`)
                      .setLabel('Взять тикет')
                      .setStyle(ButtonStyle.Success)
                      .setEmoji(CUSTOM_EMOJIS.ACCEPT)
                  );
                }
                
                buttons1.push(
                  new ButtonBuilder()
                    .setCustomId(`ticket_action_status_${ticketNumber}`)
                    .setLabel('Статус')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(CUSTOM_EMOJIS.STATUS_CHANGE),
                
                  new ButtonBuilder()
                    .setCustomId(`ticket_action_participants_${ticketNumber}`)
                    .setLabel('Участники')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(CUSTOM_EMOJIS.PARTICIPANTS)
                );

                const row1 = new ActionRowBuilder().addComponents(buttons1);
                
                const row2 = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(`ticket_action_curator_${ticketNumber}`)
                    .setLabel('Сменить куратора')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(CUSTOM_EMOJIS.CURATOR),
                
                  new ButtonBuilder()
                    .setCustomId(`expand_ticket_admin_${ticketNumber}`)
                    .setLabel('Раскрыть для админов')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚨'),
                
                  new ButtonBuilder()
                    .setCustomId(`ticket_action_close_${ticketNumber}`)
                    .setLabel('Закрыть тикет')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(CUSTOM_EMOJIS.ERROR)
                );

                // Кнопка перехода в канал если он существует
                const components = [row1, row2];
                if (ticketChannel) {
                  const row3 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setLabel('Перейти в канал')
                      .setStyle(ButtonStyle.Link)
                      .setURL(`https://discord.com/channels/${interaction.guildId}/${ticket.channel_id}`)
                      .setEmoji('🔗')
                  );
                  components.push(row3);
                }

                await safeReply(interaction, {
                    embeds: [embed],
                    components: components,
                    flags: MessageFlags.Ephemeral
                });
              } catch (error) {
                console.error('searchticketmodal error:', error);
                await safeReply(interaction, {
                  content: `${CUSTOM_EMOJIS.ERROR} Не удалось получить информацию о тикете #${ticketNumber}.`,
                  flags: MessageFlags.Ephemeral
                });
              }
          
              return;
            }
            if (interaction.customId.startsWith('training_approve_modal_')) {
                const sessionId = parseInt(interaction.customId.split('_')[3]);
                const comment = interaction.fields.getTextInputValue('approval_comment') || 'Без комментариев';
                const statsBonus = interaction.fields.getTextInputValue('stats_bonus') || 'Нет';
                const additionalRewards = interaction.fields.getTextInputValue('additional_rewards') || 'Нет';

                await interaction.deferUpdate();

                try {
                    const session = await db.getTrainingSessionById(sessionId);
                    if (!session) {
                        return await interaction.followUp({
                            content: '❌ Сессия не найдена!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const character = await db.getCharacterById(session.character_id);
                    if (!character) {
                        return await interaction.followUp({
                            content: '❌ Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await db.updateTrainingReviewStatus(sessionId, interaction.user.id, true, 'approved');

                    const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#00FF00')
                        .setTitle('✅ Тренировка одобрена')
                        .addFields(
                            {
                                name: '👤 Проверил',
                                value: `${interaction.user} (${interaction.user.tag})`,
                                inline: false
                            },
                            {
                                name: '💬 Комментарий',
                                value: comment,
                                inline: false
                            },
                            {
                                name: '📊 Прибавка к статам',
                                value: statsBonus,
                                inline: true
                            },
                            {
                                name: '🎁 Дополнительные награды',
                                value: additionalRewards,
                                inline: true
                            }
                        );

                    await interaction.message.edit({
                        embeds: [approvedEmbed],
                        components: []
                    });

                    // Уведомление пользователю
                    try {
                        const user = await interaction.client.users.fetch(session.user_id);
                        
                        const characterName = character.emoji 
                            ? `${character.emoji} / ${character.name}` 
                            : character.name;

                        const notificationEmbed = new EmbedBuilder()
                            .setTitle('✅ Тренировка одобрена!')
                            .setDescription(
                                `Ваша тренировка (ID: ${sessionId}) успешно прошла проверку!\n\n` +
                                `**🎭 Персонаж:** ${characterName}\n` +
                                `✔️ Проверил: **${interaction.user.tag}**\n` +
                                `📅 Дата проверки: **${new Date().toLocaleString('ru-RU')}**\n\n` +
                                `💬 **Комментарий аналитика:**\n${comment}\n\n` +
                                `📊 **Прибавка к статам:**\n${statsBonus}\n\n` +
                                `🎁 **Дополнительные награды:**\n${additionalRewards}\n\n` +
                                `Спасибо за выполнение тренировки! 🎉`
                            )
                            .setColor('#00FF00')
                            .setTimestamp();

                        if (character.avatarurl) {
                            notificationEmbed.setThumbnail(character.avatarurl);
                        }

                        await user.send({ embeds: [notificationEmbed] });

                    } catch (error) {
                        console.log('Не удалось отправить уведомление пользователю:', error.message);
                    }

                    console.log(`✅ Тренировка ${sessionId} одобрена аналитиком ${interaction.user.tag}`);
                    return;

                } catch (error) {
                    console.error('Ошибка одобрения тренировки:', error);
                    return;
                }
            }

            // Отклонение тренировки
            if (interaction.customId.startsWith('training_reject_modal_')) {
                const sessionId = parseInt(interaction.customId.split('_')[3]);
                const reason = interaction.fields.getTextInputValue('rejection_reason');

                await interaction.deferUpdate();

                try {
                    const session = await db.getTrainingSessionById(sessionId);
                    if (!session) {
                        return await interaction.followUp({
                            content: '❌ Сессия не найдена!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const character = await db.getCharacterById(session.character_id);

                    await db.updateTrainingReviewStatus(sessionId, interaction.user.id, false, 'rejected');

                    const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#FF0000')
                        .setTitle('❌ Тренировка отклонена')
                        .addFields(
                            {
                                name: '👤 Проверил',
                                value: `${interaction.user} (${interaction.user.tag})`,
                                inline: false
                            },
                            {
                                name: '📝 Причина отклонения',
                                value: reason,
                                inline: false
                            }
                        );

                    await interaction.message.edit({
                        embeds: [rejectedEmbed],
                        components: []
                    });

                    // Уведомление пользователю
                    try {
                        const user = await interaction.client.users.fetch(session.user_id);

                        const characterName = character 
                            ? (character.emoji ? `${character.emoji} / ${character.name}` : character.name)
                            : 'Неизвестно';

                        const notificationEmbed = new EmbedBuilder()
                            .setTitle('❌ Тренировка отклонена')
                            .setDescription(
                                `Ваша тренировка (ID: ${sessionId}) не прошла проверку.\n\n` +
                                `**🎭 Персонаж:** ${characterName}\n` +
                                `❌ Проверил: **${interaction.user.tag}**\n` +
                                `📅 Дата проверки: **${new Date().toLocaleString('ru-RU')}**\n\n` +
                                `📝 **Причина отклонения:**\n${reason}\n\n` +
                                `Пожалуйста, свяжитесь с аналитиком для уточнения деталей.`
                            )
                            .setColor('#FF0000')
                            .setTimestamp();

                        if (character && character.avatarurl) {
                            notificationEmbed.setThumbnail(character.avatarurl);
                        }

                        await user.send({ embeds: [notificationEmbed] });

                    } catch (error) {
                        console.log('Не удалось отправить уведомление пользователю:', error.message);
                    }

                    console.log(`❌ Тренировка ${sessionId} отклонена аналитиком ${interaction.user.tag}. Причина: ${reason}`);
                    return;

                } catch (error) {
                    console.error('Ошибка отклонения тренировки:', error);
                    return;
                }
            }
        }
        try {
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
            
            if (interaction.customId.startsWith('gallery_modal_')) {
                const characterId = parseInt(interaction.customId.split('_')[2], 10);
                const character = await db.getCharacterById(characterId);
                if (!character) {
                  return await safeReply(interaction, { content: '❌ Персонаж не найден!', flags: MessageFlags.Ephemeral });
                }
                if (interaction.user.id !== character.user_id &&
                    !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                  return await safeReply(interaction, { content: '❌ Можно добавлять изображения только к своим персонажам!', flags: MessageFlags.Ephemeral });
                }
              
                const urlsRaw = interaction.fields.getTextInputValue('urls') || '';
                const titlesRaw = interaction.fields.getTextInputValue('titles') || '';
                const URL_RE = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|jpeg)(\?\S+)?$/i;
              
                const tokens = urlsRaw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
                const titles = titlesRaw.split('|').map(s => s.trim());
              
                const images = tokens.filter(u => URL_RE.test(u)).map((u, i) => ({ url: u, caption: titles[i] || null }));
                if (images.length === 0) {
                  return await safeReply(interaction, { content: '❌ Нет валидных URL изображений.', flags: MessageFlags.Ephemeral });
                }
              
                const MAX_IMAGES_PER_CHAR = 60;
                const currentCount = await db.getGalleryCount(characterId);
                const available = Math.max(0, MAX_IMAGES_PER_CHAR - currentCount);
                if (available === 0) {
                  return await safeReply(interaction, { content: `❌ Достигнут лимит галереи: ${MAX_IMAGES_PER_CHAR}`, flags: MessageFlags.Ephemeral });
                }
              
                const toInsert = images.slice(0, available);
                const inserted = await db.addGalleryImages(characterId, toInsert);
              
                await safeReply(interaction, {
                  content: `✅ Добавлено изображений: ${inserted}. Всего теперь: ${currentCount + inserted}/${MAX_IMAGES_PER_CHAR}`,
                  flags: MessageFlags.Ephemeral
                });
                return;
              }              
  
            if (interaction.isCommand && interaction.commandName === 'тренировка') {
                await this.startTrainingFlow(interaction);
                return;
            }
                // Выбор персонажа
            if (interaction.isStringSelectMenu && interaction.customId.startsWith('training_character_')) {
                await this.handleCharacterSelection(interaction);
                return;
            }

            // Выбор количества часов
            if (interaction.isStringSelectMenu && interaction.customId.startsWith('training_hours_')) {
                await this.handleHoursSelection(interaction);
                return;
            }

            // Выбор типа тренировки
            if (interaction.isStringSelectMenu && interaction.customId.startsWith('training_type_')) {
                await this.handleTypeSelection(interaction);
                return;
            }
            if (interaction.customId.startsWith('customstyling_modal_')) {
                await handleCustomStylingModal(interaction);
                return;
            }
            if (interaction.isButton()) {
            // Одобрение тренировки - показываем модальное окно
            if (interaction.customId.startsWith('training_approve_')) {
                const sessionId = interaction.customId.split('_')[2];

                const modal = new ModalBuilder()
                    .setCustomId(`training_approve_modal_${sessionId}`)
                    .setTitle('Одобрение тренировки');
            
                const commentInput = new TextInputBuilder()
                    .setCustomId('approval_comment')
                    .setLabel('Комментарий аналитика')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Введите комментарий к тренировке...')
                    .setRequired(false)
                    .setMaxLength(1000);
            
                const statsInput = new TextInputBuilder()
                    .setCustomId('stats_bonus')
                    .setLabel('Прибавка к статам (если есть)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Например: сила+5, ловкость+3')
                    .setRequired(false)
                    .setMaxLength(200);
            
                const rewardsInput = new TextInputBuilder()
                    .setCustomId('additional_rewards')
                    .setLabel('Дополнительные награды')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Например: 1/3 прогресс, новая способность')
                    .setRequired(false)
                    .setMaxLength(300);
            
                const row1 = new ActionRowBuilder().addComponents(commentInput);
                const row2 = new ActionRowBuilder().addComponents(statsInput);
                const row3 = new ActionRowBuilder().addComponents(rewardsInput);
            
                modal.addComponents(row1, row2, row3);
            
                await interaction.showModal(modal);
                console.log(`✅ Модальное окно одобрения показано для сессии ${sessionId}`);
                return;
            }
                // Отклонение тренировки - показываем модальное окно
                if (interaction.customId.startsWith('training_reject_')) {
                    const sessionId = interaction.customId.split('_')[2];
                
                    const modal = new ModalBuilder()
                        .setCustomId(`training_reject_modal_${sessionId}`)
                        .setTitle('Отклонение тренировки');
                
                    const reasonInput = new TextInputBuilder()
                        .setCustomId('rejection_reason')
                        .setLabel('Причина отклонения')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Укажите причину отклонения тренировки...')
                        .setRequired(true)
                        .setMaxLength(1000);
                
                    const row = new ActionRowBuilder().addComponents(reasonInput);
                    modal.addComponents(row);
                
                    await interaction.showModal(modal);
                    console.log(`✅ Модальное окно отклонения показано для сессии ${sessionId}`);
                    return;
                }
            }

            // ===== ОБРАБОТКА МОДАЛЬНЫХ ОКОН ТРЕНИРОВОК =====
            if (interaction.customId.startsWith('training_approve_modal_')) {
                const sessionId = parseInt(interaction.customId.split('_')[3]);
                const comment = interaction.fields.getTextInputValue('approval_comment') || 'Без комментариев';
                const statsBonus = interaction.fields.getTextInputValue('stats_bonus') || 'Нет';
                const additionalRewards = interaction.fields.getTextInputValue('additional_rewards') || 'Нет';
            
                await interaction.deferUpdate();
            
                try {
                    const session = await db.getTrainingSessionById(sessionId);
                    if (!session) {
                        return await interaction.followUp({
                            content: '❌ Сессия не найдена!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                
                    const character = await db.getCharacterById(session.character_id);
                    if (!character) {
                        return await interaction.followUp({
                            content: '❌ Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                
                    await db.updateTrainingReviewStatus(sessionId, interaction.user.id, true, 'approved');
                
                    const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#00FF00')
                        .setTitle('✅ Тренировка одобрена')
                        .addFields(
                            {
                                name: '👤 Проверил',
                                value: `${interaction.user} (${interaction.user.tag})`,
                                inline: false
                            },
                            {
                                name: '💬 Комментарий',
                                value: comment,
                                inline: false
                            },
                            {
                                name: '📊 Прибавка к статам',
                                value: statsBonus,
                                inline: true
                            },
                            {
                                name: '🎁 Дополнительные награды',
                                value: additionalRewards,
                                inline: true
                            }
                        );
                    
                    await interaction.message.edit({
                        embeds: [approvedEmbed],
                        components: []
                    });
                
                    // Уведомление пользователю
                    try {
                        const user = await interaction.client.users.fetch(session.user_id);

                        const characterName = character.emoji 
                            ? `${character.emoji} / ${character.name}` 
                            : character.name;
                    
                        const notificationEmbed = new EmbedBuilder()
                            .setTitle('✅ Тренировка одобрена!')
                            .setDescription(
                                `Ваша тренировка (ID: ${sessionId}) успешно прошла проверку!\n\n` +
                                `**🎭 Персонаж:** ${characterName}\n` +
                                `✔️ Проверил: **${interaction.user.tag}**\n` +
                                `📅 Дата проверки: **${new Date().toLocaleString('ru-RU')}**\n\n` +
                                `💬 **Комментарий аналитика:**\n${comment}\n\n` +
                                `📊 **Прибавка к статам:**\n${statsBonus}\n\n` +
                                `🎁 **Дополнительные награды:**\n${additionalRewards}\n\n` +
                                `Спасибо за выполнение тренировки! 🎉`
                            )
                            .setColor('#00FF00')
                            .setTimestamp();
                        
                        if (character.avatarurl) {
                            notificationEmbed.setThumbnail(character.avatarurl);
                        }
                    
                        await user.send({ embeds: [notificationEmbed] });
                    
                    } catch (error) {
                        console.log('Не удалось отправить уведомление пользователю:', error.message);
                    }
                
                    console.log(`✅ Тренировка ${sessionId} одобрена аналитиком ${interaction.user.tag}`);
                    return;
                
                } catch (error) {
                    console.error('Ошибка одобрения тренировки:', error);
                    return;
                }
            }

            if (interaction.customId.startsWith('training_reject_modal_')) {
                const sessionId = parseInt(interaction.customId.split('_')[3]);
                const reason = interaction.fields.getTextInputValue('rejection_reason');
            
                await interaction.deferUpdate();
            
                try {
                    const session = await db.getTrainingSessionById(sessionId);
                    if (!session) {
                        return await interaction.followUp({
                            content: '❌ Сессия не найдена!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                
                    const character = await db.getCharacterById(session.character_id);
                
                    await db.updateTrainingReviewStatus(sessionId, interaction.user.id, false, 'rejected');
                
                    const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#FF0000')
                        .setTitle('❌ Тренировка отклонена')
                        .addFields(
                            {
                                name: '👤 Проверил',
                                value: `${interaction.user} (${interaction.user.tag})`,
                                inline: false
                            },
                            {
                                name: '📝 Причина отклонения',
                                value: reason,
                                inline: false
                            }
                        );
                    
                    await interaction.message.edit({
                        embeds: [rejectedEmbed],
                        components: []
                    });
                
                    // Уведомление пользователю
                    try {
                        const user = await interaction.client.users.fetch(session.user_id);
                    
                        const characterName = character 
                            ? (character.emoji ? `${character.emoji} / ${character.name}` : character.name)
                            : 'Неизвестно';
                    
                        const notificationEmbed = new EmbedBuilder()
                            .setTitle('❌ Тренировка отклонена')
                            .setDescription(
                                `Ваша тренировка (ID: ${sessionId}) не прошла проверку.\n\n` +
                                `**🎭 Персонаж:** ${characterName}\n` +
                                `❌ Проверил: **${interaction.user.tag}**\n` +
                                `📅 Дата проверки: **${new Date().toLocaleString('ru-RU')}**\n\n` +
                                `📝 **Причина отклонения:**\n${reason}\n\n` +
                                `Пожалуйста, свяжитесь с аналитиком для уточнения деталей.`
                            )
                            .setColor('#FF0000')
                            .setTimestamp();
                        
                        if (character && character.avatarurl) {
                            notificationEmbed.setThumbnail(character.avatarurl);
                        }
                    
                        await user.send({ embeds: [notificationEmbed] });
                    
                    } catch (error) {
                        console.log('Не удалось отправить уведомление пользователю:', error.message);
                    }
                
                    console.log(`❌ Тренировка ${sessionId} отклонена аналитиком ${interaction.user.tag}. Причина: ${reason}`);
                    return;
                
                } catch (error) {
                    console.error('Ошибка отклонения тренировки:', error);
                    return;
                }
            }
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
                    content: `❌ Следующий тикет можно создать через ${cooldownHours} часов.`
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
                    { name: '⏰ Кулдаун', value: '72 часа (3 дня) до следующего тикета', inline: true },
                    { name: '👥 Участники', value: Array.from(characterOwners).map(id => `<@${id}>`).join(', '), inline: false },
                    { name: '🎭 Персонажи', value: charactersList, inline: false },
                    { name: '📝 Цель', value: purpose, inline: false }
                  )
                  .setColor(isAdminTicket ? 0xff0000 : 0xffa500)
                  .setTimestamp()
                  .setFooter({
                    text: `ID тикета: ${ticketNumber} • Персонажей: ${allValidCharacters.length} • Участников: ${characterOwners.size} • Кулдаун: 72ч (3 дня)${isAdminTicket ? ' • АДМИН ТИКЕТ' : ''}${selectedCategoryId === OVERFLOW_TICKET_CATEGORY_ID ? ' • ДОПОЛНИТЕЛЬНАЯ КАТЕГОРИЯ' : ''}`
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
                  .setDescription(`Ваш тикет #${ticketNumber} создан и ожидает куратора.\n\n⏰ **Важно:** Следующий тикет можно будет создать через **72 часа** (3 дня).${isAdminTicket ? '\n\n🚨 **Тикет раскрыт для администрации** - все администраторы имеют доступ к каналу.' : ''}${selectedCategoryId === OVERFLOW_TICKET_CATEGORY_ID ? '\n\n📁 **Тикет создан в дополнительной категории** из-за переполнения основной.' : ''}`)
                  .addFields(
                    { name: '🔗 Ссылка на канал', value: `<#${ticketChannel.id}>`, inline: false },
                    { name: '📋 Статус', value: 'Ожидает куратора', inline: true },
                    { name: '🎭 Персонажей', value: allValidCharacters.length.toString(), inline: true },
                    { name: '👥 Участников', value: characterOwners.size.toString(), inline: true },
                    { name: '⏰ Кулдаун', value: '72 часа (3 дня)', inline: true }
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
                    const activeTickets = await db.getUserActiveTickets(userId);
                    if (activeTickets.length > 0) {
                        const list = activeTickets
                            .map(t => `#${t.ticketnumber} (${t.status || 'pending'})`)
                            .join(', ');

                        return await safeReply(interaction, {
                            content: `${CUSTOM_EMOJIS.ERROR} У вас уже есть активный тикет: ${list}. Дождитесь его завершения прежде чем создавать новый.`,
                            flags: MessageFlags.Ephemeral
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
                            { name: '👨💼 Администратор', value: `<@${interaction.user.id}>`, inline: true },
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

            // =============================
            // ЗАВЕРШЕНИЕ ТИКЕТА КУРАТОРОМ
            // =============================
            if (interaction.customId.startsWith('complete_ticket_modal_')) {
            const parts = interaction.customId.split(':');
            const ticketNumber = parseInt(parts[1], 10);
            const curatorId = parts[2];

            if (interaction.user.id !== curatorId) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Только куратор этого тикета может завершить его.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        
            const completionNotes = interaction.fields.getTextInputValue('completionnotes') || 'Без комментария.';
        
            try {
                const ticket = await db.getTicketByNumber(ticketNumber);
                if (!ticket) {
                    return await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.ERROR} Тикет #${ticketNumber} не найден.`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            
                // Статус "completed"
                await db.updateTicketStatus(ticketNumber, 'completed');
            
                // Лог
                await TicketLogger.logTicketAction(interaction.client, {
                    adminid: curatorId,
                    actiontype: TICKETACTIONTYPES.TICKETCOMPLETED,
                    ticketnumber: ticketNumber,
                    targetuserid: ticket.creatorid,
                    details: {
                        curatorid: curatorId,
                        completionnotes: completionNotes
                    },
                    success: true,
                    channelid: ticket.channelid,
                    guildid: interaction.guildId
                });
            
                // Вешаем КД на всех участников (creator + participants)
                const participantsSet = new Set();
                if (ticket.creatorid) participantsSet.add(ticket.creatorid);
                if (ticket.participants) {
                    ticket.participants
                        .split(',')
                        .map(id => id.trim())
                        .filter(Boolean)
                        .forEach(id => participantsSet.add(id));
                }
            
                for (const userId of participantsSet) {
                    try {
                        await db.setTicketCooldownOnCompletion(userId);
                    } catch (err) {
                        console.error('setTicketCooldownOnCompletion error for', userId, err);
                    }
                }
            
                const ticketChannel = interaction.guild.channels.cache.get(ticket.channelid);
                if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                    const completionEmbed = new EmbedBuilder()
                        .setTitle('✅ Тикет завершён')
                        .setDescription(`Тикет #${ticketNumber} был завершён куратором <@${curatorId}>.`)
                        .addFields({
                            name: 'Комментарий куратора',
                            value: completionNotes
                        })
                        .setColor(0x00ff00)
                        .setTimestamp();
                    
                    const rateButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ratecurator:${ticketNumber}:${ticket.creatorid}:1`)
                            .setLabel('1')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`ratecurator:${ticketNumber}:${ticket.creatorid}:2`)
                            .setLabel('2')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`ratecurator:${ticketNumber}:${ticket.creatorid}:3`)
                            .setLabel('3')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`ratecurator:${ticketNumber}:${ticket.creatorid}:4`)
                            .setLabel('4')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`ratecurator:${ticketNumber}:${ticket.creatorid}:5`)
                            .setLabel('5')
                            .setStyle(ButtonStyle.Success)
                    );
                
                    const reviewEmbed = new EmbedBuilder()
                        .setTitle('Оцените работу куратора')
                        .setDescription(
                            [
                                `Создатель: <@${ticket.creatorid}>`,
                                `Куратор: <@${curatorId}>`,
                                '',
                                'Нажмите на кнопку с оценкой от 1 до 5.'
                            ].join('\n')
                        )
                        .setColor(0xffd700)
                        .setTimestamp();
                    
                    await ticketChannel.send({
                        embeds: [completionEmbed, reviewEmbed],
                        components: [rateButtons]
                    });
                
                    // Удаляем канал через 10 минут
                    setTimeout(async () => {
                        try {
                            await ticketChannel.delete(`Завершение тикета #${ticketNumber}`);
                            console.log('Ticket channel deleted after completion:', ticketNumber);
                        } catch (deleteError) {
                            console.error('Error deleting ticket channel after completion', ticketNumber, deleteError);
                        }
                    }, 10 * 60 * 1000);
                }
            
                await safeReply(interaction, {
                    content: `✅ Тикет #${ticketNumber} завершён. Канал будет удалён через 10 минут. КД на участников: 72 часа (3 дня).`,
                    flags: MessageFlags.Ephemeral
                });
            } catch (error) {
                console.error('completeticketmodal error:', error);
                await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Не удалось завершить тикет #${ticketNumber}.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        
            return;
        }

        // Добавить обработку модального окна для отзывов
            
        if (interaction.customId.startsWith('review_comment_')) {
    const parts = interaction.customId.split('_');
    const ticketNumber = parseInt(parts[2]);
    const reviewerId = parts[3];
    const rating = parseInt(parts[4]);
    
    if (interaction.user.id !== reviewerId) {
        return await safeReply(interaction, {
            content: '❌ Вы можете оценить только свой тикет!',
            flags: MessageFlags.Ephemeral
        });
    }

    const comment = interaction.fields.getTextInputValue('comment') || null;

    try {
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || !ticket.curator_id) {
            return await safeReply(interaction, {
                content: '❌ Ошибка: тикет или куратор не найден!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Сохраняем отзыв
        await db.addCuratorReview(ticketNumber, ticket.curator_id, reviewerId, rating, comment);

        const embed = new EmbedBuilder()
            .setTitle('✅ Спасибо за отзыв!')
            .setDescription(`Ваша оценка куратора <@${ticket.curator_id}> сохранена!`)
            .addFields(
                { name: '⭐ Оценка', value: '⭐'.repeat(rating), inline: true },
                { name: '💬 Комментарий', value: comment || 'Без комментария', inline: false }
            )
            .setColor(0x00ff00)
            .setTimestamp();

        await safeReply(interaction, {
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });

        // Уведомляем куратора
        try {
            const curator = await interaction.client.users.fetch(ticket.curator_id);
            const curatorEmbed = new EmbedBuilder()
                .setTitle('⭐ Новый отзыв о вашей работе!')
                .setDescription(`Вы получили отзыв за работу над тикетом #${ticketNumber}`)
                .addFields(
                    { name: '⭐ Оценка', value: '⭐'.repeat(rating), inline: true },
                    { name: '💬 Комментарий', value: comment || 'Без комментария', inline: false },
                    { name: '👤 От пользователя', value: `<@${reviewerId}>`, inline: true }
                )
                .setColor(0xffd700)
                .setTimestamp();

            await curator.send({ embeds: [curatorEmbed] });
        } catch (error) {
            console.log('Не удалось отправить уведомление куратору:', error.message);
        }

    } catch (error) {
        console.error('Ошибка сохранения отзыва:', error);
        await safeReply(interaction, {
            content: '❌ Произошла ошибка при сохранении отзыва!',
            flags: MessageFlags.Ephemeral
        });
    }
    return;
        }

            // =============================
            // ОБНОВЛЕНИЕ УЧАСТНИКОВ ТИКЕТА
            // =============================
            if (interaction.customId.startsWith('participants_modal_')) {
                const ticketNumber = parseInt(interaction.customId.split('_')[2]);
                const participants = interaction.fields.getTextInputValue('participants');

                try {
                    const ticket = await db.getTicketByNumber(ticketNumber);
                    if (!ticket) {
                        return await safeReply(interaction, {
                            content: '❌ Тикет не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const participantIds = participants.split(',')
                        .map(id => id.trim())
                        .filter(id => id && /^\d+$/.test(id));

                    if (participantIds.length === 0) {
                        return await safeReply(interaction, {
                            content: '❌ Не указаны корректные ID участников!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const validatedIds = [];
                    for (const userId of participantIds) {
                        try {
                            await interaction.guild.members.fetch(userId);
                            validatedIds.push(userId);
                        } catch (error) {
                            console.log(`Пользователь ${userId} не найден на сервере`);
                        }
                    }

                    if (validatedIds.length === 0) {
                        return await safeReply(interaction, {
                            content: '❌ Ни один из указанных пользователей не найден на сервере!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await db.updateTicketParticipants(ticketNumber, validatedIds.join(','));

                    // РАБОТАЕМ С КАНАЛОМ ВМЕСТО ВЕТКИ
                    const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
                    if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                        for (const userId of validatedIds) {
                            try {
                                await ticketChannel.permissionOverwrites.create(userId, {
                                    ViewChannel: true,
                                    SendMessages: true,
                                    ReadMessageHistory: true,
                                    AttachFiles: true
                                });
                                console.log(`Участник ${userId} добавлен в канал тикета #${ticketNumber}`);
                            } catch (error) {
                                console.log(`Не удалось добавить участника ${userId} в канал:`, error.message);
                            }
                        }

                        const participantMentions = validatedIds.map(id => `<@${id}>`).join(', ');
                        await ticketChannel.send({
                            content: `${CUSTOM_EMOJIS.PARTICIPANTS} **Участники тикета #${ticketNumber} обновлены администратором <@${interaction.user.id}>**\n\n👥 **Новые участники:** ${participantMentions}\n\n${CUSTOM_EMOJIS.INFO} Участники будут получать уведомления о новых сообщениях от куратора в личные сообщения.`
                        });
                    }

                    await TicketLogger.logTicketAction(interaction.client, {
                        admin_id: interaction.user.id,
                        action_type: TICKET_ACTION_TYPES.TICKET_PARTICIPANTS_UPDATED,
                        ticket_number: ticketNumber,
                        target_user_id: ticket.creator_id,
                        details: {
                            participants_count: validatedIds.length,
                            participant_ids: validatedIds
                        },
                        success: true,
                        channel_id: ticket.channel_id,
                        guild_id: interaction.guildId
                    });

                    await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.SUCCESS} Участники тикета #${ticketNumber} успешно обновлены!\n👥 Добавлено: ${validatedIds.length} участников\n${CUSTOM_EMOJIS.INFO} Участники будут получать уведомления в ЛС`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления участников:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при обновлении участников!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // =============================
            // СИСТЕМА ПЕРСОНАЖЕЙ
            // =============================
            // Обработка создания персонажа
            if (interaction.customId.startsWith('characterCreationModal_')) {
                const targetUserId = interaction.customId.split('_')[1];
                // Проверка роли
                const requiredRoleId = '1382005661369368586';
                if (!interaction.member.roles.cache.has(requiredRoleId)) {
                    return await safeReply(interaction, {
                        content: 'У вас нет прав для создания персонажей!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply();
                const name = interaction.fields.getTextInputValue('name');
                const race = interaction.fields.getTextInputValue('race');
                const age = interaction.fields.getTextInputValue('age');
                const nickname = interaction.fields.getTextInputValue('nickname') || '';
                const quote = interaction.fields.getTextInputValue('quote') || '';

                try {
                    const nextSlot = await db.getNextAvailableSlot(targetUserId);
                    const maxSlots = await db.getUserSlots(targetUserId);
                    if (nextSlot > maxSlots) {
                        return await interaction.editReply({
                            content: `У пользователя заняты все слоты! Максимум: ${maxSlots}`
                        });
                    }

                    const characterData = {
                        user_id: targetUserId,
                        name: name,
                        race: race,
                        age: age,
                        nickname: nickname,
                        mention: quote,
                        slot: nextSlot,
                        strength: 0,
                        agility: 0,
                        reaction: 0,
                        accuracy: 0,
                        endurance: 0,
                        durability: 0,
                        magic: 0,
                        budget: 0
                    };

                    const characterId = await db.createCharacter(characterData);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Персонаж создан!')
                        .setColor(0x00ff00)
                        .addFields(
                            { name: 'ID персонажа', value: characterId.toString(), inline: true },
                            { name: 'Имя', value: name, inline: true },
                            { name: 'Раса', value: race, inline: true },
                            { name: 'Возраст', value: age, inline: true },
                            { name: 'Прозвище', value: nickname || 'Не указано', inline: true },
                            { name: 'Слот', value: nextSlot.toString(), inline: true },
                            { name: 'Владелец', value: `<@${targetUserId}>`, inline: false }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed] });
                } catch (error) {
                    console.error('Ошибка создания персонажа:', error);
                    await interaction.editReply({
                        content: 'Произошла ошибка при создании персонажа!'
                    });
                }

                return;
            }

            // Обработка выдачи характеристик
            if (interaction.customId.startsWith('giveStatsModal_')) {
                const characterId = interaction.customId.split('_')[1];
                const requiredRoleId = '1382005661369368586';
                if (!interaction.member.roles.cache.has(requiredRoleId)) {
                    return await safeReply(interaction, {
                        content: 'У вас нет прав для выдачи характеристик!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply();
                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character) {
                        return await interaction.editReply({
                            content: 'Персонаж не найден!'
                        });
                    }

                    const stats = {
                        strength: parseInt(interaction.fields.getTextInputValue('strength')) || 0,
                        agility: parseInt(interaction.fields.getTextInputValue('agility')) || 0,
                        reaction: parseInt(interaction.fields.getTextInputValue('reaction')) || 0,
                        accuracy: parseInt(interaction.fields.getTextInputValue('accuracy')) || 0,
                        endurance: parseInt(interaction.fields.getTextInputValue('endurance')) || 0
                    };

                    // Проверяем, что все значения корректные
                    for (const [key, value] of Object.entries(stats)) {
                        if (isNaN(value) || value < 0) {
                            return await interaction.editReply({
                                content: `Некорректное значение для ${key}: ${value}. Используйте только положительные числа.`
                            });
                        }
                    }

                    await db.addCharacterStats(characterId, stats);

                    const totalAdded = Object.values(stats).reduce((sum, val) => sum + val, 0);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Характеристики выданы!')
                        .setColor(0x00ff00)
                        .addFields(
                            { name: 'Персонаж', value: character.name, inline: true },
                            { name: 'Владелец', value: `<@${character.user_id}>`, inline: true },
                            { name: 'Всего добавлено', value: totalAdded.toString(), inline: true },
                            { name: '💪 Сила', value: `+${stats.strength}`, inline: true },
                            { name: '🤸 Ловкость', value: `+${stats.agility}`, inline: true },
                            { name: '⚡ Реакция', value: `+${stats.reaction}`, inline: true },
                            { name: '🎯 Точность', value: `+${stats.accuracy}`, inline: true },
                            { name: '🏋️ Стойкость', value: `+${stats.endurance}`, inline: true }
                        )
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed] });
                } catch (error) {
                    console.error('Ошибка выдачи характеристик:', error);
                    await interaction.editReply({
                        content: 'Произошла ошибка при выдаче характеристик!'
                    });
                }

                return;
            }

            // Обработка индивидуального модального окна для изменения атрибутов
            if (interaction.customId.startsWith('individual_modal_')) {
                const parts = interaction.customId.split('_');
                const characterId = parts[2];
                const selectedAttributes = parts[3].split(',');

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character) {
                        return await safeReply(interaction, {
                            content: 'Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const requiredRoleId = '1382005661369368586';
                    if (!interaction.member.roles.cache.has(requiredRoleId)) {
                        return await safeReply(interaction, {
                            content: 'У вас нет прав для изменения персонажей!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const updateData = {};
                    const changes = [];

                    for (const attribute of selectedAttributes) {
                        try {
                            const value = interaction.fields.getTextInputValue(attribute);
                            if (value !== undefined && value !== null && value.trim() !== '') {
                                if (['strength', 'agility', 'reaction', 'accuracy', 'endurance', 'durability', 'magic', 'budget'].includes(attribute)) {
                                    const numValue = parseInt(value);
                                    if (!isNaN(numValue)) {
                                        updateData[attribute] = numValue;
                                        const sign = numValue >= 0 ? '+' : '';
                                        changes.push(`**${getAttributeName(attribute)}:** ${sign}${numValue}`);
                                    }
                                } else {
                                    updateData[attribute] = value.trim();
                                    const preview = value.length > 50 ? value.substring(0, 47) + '...' : value;
                                    changes.push(`**${getAttributeName(attribute)}:** ${preview}`);
                                }
                            }
                        } catch (fieldError) {
                            console.log(`Поле ${attribute} не найдено в модальном окне`);
                        }
                    }

                    if (changes.length === 0) {
                        return await interaction.editReply({
                            content: '⚠️ Не было внесено никаких изменений!'
                        });
                    }

                    const result = await db.updateCharacterStatsAdvanced(characterId, updateData);

                    if (result === 0) {
                        throw new Error('Не удалось обновить характеристики в базе данных!');
                    }

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Характеристики успешно обновлены')
                        .setDescription(`**Персонаж:** ${character.name}\n\n**Внесенные изменения:**\n${changes.join('\n')}`)
                        .setColor(0x00ff00)
                        .setThumbnail(character.avatar_url)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed] });

                    await sendLogToChannel(interaction.client, {
                        moderatorId: interaction.user.id,
                        characterId: character.id,
                        characterName: character.name,
                        changes: changes,
                        channelId: interaction.channelId
                    });
                } catch (error) {
                    console.error('Ошибка обновления атрибутов:', error);
                    await safeInteractionReply(interaction, {
                        content: 'Произошла ошибка при обновлении атрибутов!'
                    });
                }

                return;
            }

            // Обработка stats_modal_
            if (interaction.customId.startsWith('stats_modal_')) {
                const parts = interaction.customId.split('_');
                const characterId = parts[2];
                const selectedAttributes = parts[3].split(',');

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character) {
                        return await safeReply(interaction, {
                            content: 'Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const requiredRoleId = '1382005661369368586';
                    if (!interaction.member.roles.cache.has(requiredRoleId)) {
                        return await safeReply(interaction, {
                            content: 'У вас нет прав для изменения персонажей!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                    const updateData = {};
                    const changes = [];

                    for (const attribute of selectedAttributes) {
                        try {
                            const value = interaction.fields.getTextInputValue(attribute);
                            if (value && value.trim() !== '') {
                                if (['strength', 'agility', 'reaction', 'accuracy', 'endurance', 'durability', 'magic', 'budget'].includes(attribute)) {
                                    const numValue = parseInt(value);
                                    if (!isNaN(numValue)) {
                                        updateData[attribute] = numValue;
                                        const sign = numValue >= 0 ? '+' : '';
                                        changes.push(`**${getAttributeName(attribute)}:** ${sign}${numValue}`);
                                    }
                                } else {
                                    updateData[attribute] = value.trim();
                                    const preview = value.length > 50 ? value.substring(0, 47) + '...' : value;
                                    changes.push(`**${getAttributeName(attribute)}:** ${preview}`);
                                }
                            }
                        } catch (fieldError) {
                            console.log(`Поле ${attribute} не найдено в модальном окне`);
                        }
                    }

                    if (changes.length === 0) {
                        return await interaction.editReply({
                            content: '⚠️ Не было внесено никаких изменений!'
                        });
                    }

                    const result = await db.updateCharacterStatsAdvanced(characterId, updateData);

                    if (result === 0) {
                        throw new Error('Не удалось обновить характеристики в базе данных!');
                    }

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Характеристики успешно обновлены')
                        .setDescription(`**Персонаж:** ${character.name}\n\n**Внесенные изменения:**\n${changes.join('\n')}`)
                        .setColor(0x00ff00)
                        .setThumbnail(character.avatar_url)
                        .setTimestamp();

                    await interaction.editReply({ embeds: [successEmbed] });

                    await sendLogToChannel(interaction.client, {
                        moderatorId: interaction.user.id,
                        characterId: character.id,
                        characterName: character.name,
                        changes: changes,
                        channelId: interaction.channelId
                    });
                } catch (error) {
                    console.error('Ошибка обновления характеристик:', error);
                    await safeInteractionReply(interaction, {
                        content: 'Произошла ошибка при обновлении характеристик!'
                    });
                }

                return;
            }

            // Обработка изменения аватара
            if (interaction.customId.startsWith('avatar_modal_')) {
                const characterId = interaction.customId.split('_')[2];
                const avatarUrl = interaction.fields.getTextInputValue('avatar_url');

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character || character.user_id !== interaction.user.id) {
                        return await safeReply(interaction, {
                            content: 'Персонаж не найден или не принадлежит вам!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (!avatarUrl.startsWith('http')) {
                        return await safeReply(interaction, {
                            content: 'Некорректный URL изображения!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await db.updateCharacterAvatar(characterId, avatarUrl);

                    await safeReply(interaction, {
                        content: '✅ Аватар персонажа обновлен!',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления аватара:', error);
                    await safeReply(interaction, {
                        content: 'Произошла ошибка при обновлении аватара!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // Обработка изменения цвета
            if (interaction.customId.startsWith('color_modal_')) {
                const characterId = interaction.customId.split('_')[2];
                const colorInput = interaction.fields.getTextInputValue('color_value');

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character || character.user_id !== interaction.user.id) {
                        return await safeReply(interaction, {
                            content: 'Персонаж не найден или не принадлежит вам!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    function parseColor(colorInput) {
                        const colorNames = {
                            'красный': '#ED4245',
                            'синий': '#3498DB',
                            'зеленый': '#57F287',
                            'фиолетовый': '#9B59B6',
                            'желтый': '#FEE75C',
                            'оранжевый': '#E67E22',
                            'розовый': '#EB459E',
                            'черный': '#23272A',
                            'белый': '#FFFFFF',
                            'серый': '#95A5A6',
                            'золотой': '#F1C40F'
                        };

                        if (colorNames[colorInput.toLowerCase()]) {
                            return colorNames[colorInput.toLowerCase()];
                        }

                        if (colorInput.startsWith('#') && colorInput.length === 7) {
                            return colorInput;
                        }

                        return '#9932cc';
                    }

                    const parsedColor = parseColor(colorInput);

                    await db.updateCharacterColor(characterId, parsedColor);

                    await safeReply(interaction, {
                        content: `✅ Цвет профиля изменен на ${parsedColor}!`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления цвета:', error);
                    await safeReply(interaction, {
                        content: 'Произошла ошибка при обновлении цвета!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // Обработка изменения иконки
            if (interaction.customId.startsWith('icon_modal_')) {
                const characterId = interaction.customId.split('_')[2];
                const iconUrl = interaction.fields.getTextInputValue('icon_url');

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character || character.user_id !== interaction.user.id) {
                        return await safeReply(interaction, {
                            content: 'Персонаж не найден или не принадлежит вам!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (!iconUrl.startsWith('http')) {
                        return await safeReply(interaction, {
                            content: 'Некорректный URL изображения!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await db.updateCharacterIcon(characterId, iconUrl);

                    await safeReply(interaction, {
                        content: '✅ Иконка персонажа обновлена!',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления иконки:', error);
                    await safeReply(interaction, {
                        content: 'Произошла ошибка при обновлении иконки!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // === ГАЛЕРЕЯ ПЕРСОНАЖА ===
            if (interaction.customId.startsWith('gallery_add_modal_')) {
                const characterId = interaction.customId.split('_')[3];
                const imageUrl = interaction.fields.getTextInputValue('image_url');
                const description = interaction.fields.getTextInputValue('description') || null;

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character || character.user_id !== interaction.user.id) {
                        return await safeReply(interaction, {
                            content: '❌ Персонаж не найден или не принадлежит вам!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (!imageUrl.startsWith('http')) {
                        return await safeReply(interaction, {
                            content: '❌ Некорректный URL изображения!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await db.addToCharacterGallery(characterId, imageUrl, description);

                    await safeReply(interaction, {
                        content: '✅ Изображение добавлено в галерею!',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка добавления в галерею:', error);
                    await safeReply(interaction, {
                        content: `❌ ${error.message || 'Произошла ошибка при добавлении изображения!'}`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // === БИОГРАФИЯ ПЕРСОНАЖА ===
            if (interaction.customId.startsWith('bio_edit_modal_')) {
                const characterId = interaction.customId.split('_')[3];

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character || character.user_id !== interaction.user.id) {
                        return await safeReply(interaction, {
                            content: '❌ Персонаж не найден или не принадлежит вам!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const bioData = {
                        biography: interaction.fields.getTextInputValue('biography') || null,
                        backstory: interaction.fields.getTextInputValue('backstory') || null,
                        personality: interaction.fields.getTextInputValue('personality') || null,
                        goals: interaction.fields.getTextInputValue('goals') || null
                    };

                    await db.ensureBioColumns();
                    await db.updateCharacterBio(characterId, bioData);

                    await safeReply(interaction, {
                        content: '✅ Биография персонажа обновлена!',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления биографии:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при обновлении биографии!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // === РЕДАКТИРОВАНИЕ ИНФОРМАЦИИ ===
            if (interaction.customId.startsWith('info_edit_modal_')) {
                const characterId = interaction.customId.split('_')[3];

                try {
                    const character = await db.getCharacterById(characterId);
                    if (!character || character.user_id !== interaction.user.id) {
                        return await safeReply(interaction, {
                            content: '❌ Персонаж не найден или не принадлежит вам!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const name = interaction.fields.getTextInputValue('name');
                    const nickname = interaction.fields.getTextInputValue('nickname') || null;
                    const race = interaction.fields.getTextInputValue('race') || null;
                    const ageStr = interaction.fields.getTextInputValue('age');
                    const mention = interaction.fields.getTextInputValue('mention') || null;

                    const age = ageStr ? parseInt(ageStr) : null;

                    await db.updateCharacter(characterId, {
                        name: name,
                        nickname: nickname,
                        race: race,
                        age: age,
                        mention: mention
                    });

                    await safeReply(interaction, {
                        content: '✅ Информация о персонаже обновлена!',
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления информации:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при обновлении информации!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // === АДМИНСКИЕ СТАТИСТИКИ ===
            if (interaction.customId.startsWith('admin_stats_modal_')) {
                const characterId = interaction.customId.split('_')[3];

                try {
                    // Проверяем права
                    const member = await interaction.guild.members.fetch(interaction.user.id);
                    const hasAdminRole = member.roles.cache.has('1257024474654285967') || 
                                         member.permissions.has('Administrator');
                    
                    if (!hasAdminRole) {
                        return await safeReply(interaction, {
                            content: '❌ У вас нет прав для этого действия!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const character = await db.getCharacterById(characterId);
                    if (!character) {
                        return await safeReply(interaction, {
                            content: '❌ Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const strength = parseInt(interaction.fields.getTextInputValue('strength')) || 0;
                    const agility = parseInt(interaction.fields.getTextInputValue('agility')) || 0;
                    const hakivor = parseInt(interaction.fields.getTextInputValue('hakivor')) || 0;
                    const hakinab = parseInt(interaction.fields.getTextInputValue('hakinab')) || 0;
                    const budget = parseInt(interaction.fields.getTextInputValue('budget')) || 0;

                    await db.updateCharacter(characterId, {
                        strength: strength,
                        agility: agility,
                        hakivor: hakivor,
                        hakinab: hakinab,
                        budget: budget
                    });

                    await safeReply(interaction, {
                        content: `✅ Характеристики персонажа **${character.name}** обновлены!\n` +
                                 `💪 Сила: ${strength}\n🏃 Ловкость: ${agility}\n` +
                                 `🛡️ Хаки Вооружения: ${hakivor}\n👁️ Хаки Наблюдения: ${hakinab}\n` +
                                 `💰 Бюджет: ${budget}`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления админских статистик:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при обновлении статистик!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // === ВЫДАЧА ДОСТИЖЕНИЯ ===
            if (interaction.customId.startsWith('achievement_add_modal_')) {
                const characterId = interaction.customId.split('_')[3];

                try {
                    // Проверяем права
                    const member = await interaction.guild.members.fetch(interaction.user.id);
                    const hasAdminRole = member.roles.cache.has('1257024474654285967') || 
                                         member.permissions.has('Administrator');
                    
                    if (!hasAdminRole) {
                        return await safeReply(interaction, {
                            content: '❌ У вас нет прав для выдачи достижений!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const character = await db.getCharacterById(characterId);
                    if (!character) {
                        return await safeReply(interaction, {
                            content: '❌ Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const title = interaction.fields.getTextInputValue('title');
                    const description = interaction.fields.getTextInputValue('description') || null;
                    const icon = interaction.fields.getTextInputValue('icon') || '🏆';
                    let rarity = interaction.fields.getTextInputValue('rarity') || 'common';

                    // Валидация редкости
                    const validRarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
                    if (!validRarities.includes(rarity.toLowerCase())) {
                        rarity = 'common';
                    }

                    await db.addCharacterAchievement(
                        characterId, 
                        title, 
                        description, 
                        icon, 
                        rarity.toLowerCase(), 
                        interaction.user.id
                    );

                    const rarityNames = { 
                        mythic: '🔴 Мифическое', 
                        legendary: '🟠 Легендарное', 
                        epic: '🟣 Эпическое', 
                        rare: '🔵 Редкое', 
                        common: '⚪ Обычное' 
                    };

                    await safeReply(interaction, {
                        content: `✅ Достижение выдано персонажу **${character.name}**!\n\n` +
                                 `${icon} **${title}**\n` +
                                 `> ${description || 'Без описания'}\n` +
                                 `Редкость: ${rarityNames[rarity.toLowerCase()]}`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка выдачи достижения:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при выдаче достижения!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // === НАГРАДА ЗА ГОЛОВУ ===
            if (interaction.customId.startsWith('bounty_modal_')) {
                const characterId = interaction.customId.split('_')[2];

                try {
                    // Проверяем права
                    const member = await interaction.guild.members.fetch(interaction.user.id);
                    const hasAdminRole = member.roles.cache.has('1381909203005866034') || 
                                         member.permissions.has('Administrator');
                    
                    if (!hasAdminRole) {
                        return await safeReply(interaction, {
                            content: '❌ У вас нет прав для изменения награды!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const character = await db.getCharacterById(characterId);
                    if (!character) {
                        return await safeReply(interaction, {
                            content: '❌ Персонаж не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const bountyStr = interaction.fields.getTextInputValue('bounty');
                    const bounty = parseInt(bountyStr.replace(/[^\d]/g, '')) || 0;

                    await db.updateCharacterBounty(characterId, bounty);

                    let bountyText;
                    if (bounty >= 1000000000) {
                        bountyText = `${(bounty / 1000000000).toFixed(1)} млрд`;
                    } else if (bounty >= 1000000) {
                        bountyText = `${Math.floor(bounty / 1000000)} млн`;
                    } else {
                        bountyText = bounty.toLocaleString();
                    }

                    await safeReply(interaction, {
                        content: `✅ Награда за голову **${character.name}** обновлена!\n\n💰 **Новая награда:** ฿ ${bountyText}`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка обновления награды:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при обновлении награды!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // =============================
            // СИСТЕМА ЗАЯВОК НА РАБОТУ
            // =============================
            if (interaction.customId.startsWith('job_application_')) {
                const jobType = interaction.customId.split('_')[2];
                const name = interaction.fields.getTextInputValue('applicant_name');
                const age = interaction.fields.getTextInputValue('applicant_age');
                const experience = interaction.fields.getTextInputValue('experience');
                const motivation = interaction.fields.getTextInputValue('motivation');
                const additional = interaction.fields.getTextInputValue('additional') || 'Не указано';

                const jobTitles = {
                    'editor': 'Editor',
                    'analytic': 'Analytic',
                    'rp_curator': 'RP Curator'
                };

                const applicationEmbed = new EmbedBuilder()
                    .setTitle(`📋 Заявка на должность: ${jobTitles[jobType]}`)
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '👤 Имя', value: name, inline: true },
                        { name: '🎂 Возраст', value: age, inline: true },
                        { name: '💼 Должность', value: jobTitles[jobType], inline: true },
                        { name: '📚 Опыт работы', value: experience, inline: false },
                        { name: '💭 Мотивация', value: motivation, inline: false },
                        { name: '📝 Дополнительно', value: additional, inline: false },
                        { name: '👤 Пользователь', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: `ID заявки: ${Date.now()}` });

                const applicationChannelId = '1386022056503545858';
                const applicationChannel = interaction.guild.channels.cache.get(applicationChannelId);

                if (applicationChannel) {
                    await applicationChannel.send({ embeds: [applicationEmbed] });
                }

                await safeReply(interaction, {
                    content: '✅ Ваша заявка успешно отправлена! Мы рассмотрим её в ближайшее время.',
                    flags: MessageFlags.Ephemeral
                });
                
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

// Функция для получения названий атрибутов
function getAttributeName(attribute) {
    const attributeNames = {
        'strength': '💪 Сила',
        'agility': '🤸 Ловкость',
        'reaction': '⚡ Реакция',
        'accuracy': '🎯 Точность',
        'endurance': '🏋️ Стойкость',
        'durability': '🛡️ Прочность',
        'magic': '🔮 Магия',
        'hakivor': '🗡️ Воля Вооружения',
        'hakinab': '👁️ Воля Наблюдения',
        'hakiconq': '👑 Королевская Воля',
        'name': '💎 Имя',
        'race': '🦁 Раса',
        'age': '🎂 Возраст',
        'nickname': '🧨 Прозвище',
        'organization': '🏛️ Организация',
        'position': '📜 Должность',
        'budget': '💰 Бюджет',
        'devilfruit': '🍎 Дьявольский плод',
        'patronage': '👼 Покровительство',
        'core': '💠 Искры',
        'elements': '🌪️ Стихии',
        'martialarts': '🥋 Боевые искусства',
        'additional': '📝 Дополнительное',
        'mention': '🧾 Упоминание/Цитата'
    };
    return attributeNames[attribute] || attribute;
}

// Функция для отправки логов
async function sendLogToChannel(client, logData) {
    try {
        const LOG_CHANNEL_ID = '1381454654440865934';
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setTitle('📊 Лог выдачи характеристик')
            .setDescription(`🔧 **Модератор:** <@${logData.moderatorId}>\n👤 **Персонаж:** ${logData.characterName} (ID: ${logData.characterId})`)
            .setColor(0x3498db)
            .addFields({
                name: '📈 Выданные характеристики:',
                value: logData.changes.join('\n'),
                inline: false
            }, {
                name: '📊 Информация:',
                value: `**Время:** ${new Date().toLocaleString('ru-RU')}\n**Канал:** <#${logData.channelId}>`,
                inline: false
            })
            .setFooter({ text: `ID модератора: ${logData.moderatorId}` })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
        console.error('❌ Ошибка отправки лога:', error);
    }
}

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
