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
                    const activeTickets = await db.getUserActiveTickets(userId);
                    if (activeTickets.length > 0) {
                      return await interaction.editReply({
                        content: '❌ У вас уже есть активный тикет! Закройте текущий, прежде чем создавать новый.'
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
                const ticketNumber = parseInt(interaction.customId.split('_')[3]);
                const curatorId = interaction.customId.split('_')[4];

                if (interaction.user.id !== curatorId) {
                    return await safeReply(interaction, {
                        content: '❌ Вы можете завершить только свой тикет!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const completionNotes = interaction.fields.getTextInputValue('completion_notes');
                try {
                    const ticket = await db.getTicketByNumber(ticketNumber);
                    if (!ticket) {
                        return await safeReply(interaction, {
                            content: '❌ Тикет не найден!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Обновляем статус тикета
                    await db.updateTicketStatus(ticketNumber, 'Завершен');

                    await TicketLogger.logTicketAction(interaction.client, {
                        admin_id: curatorId,
                        action_type: TICKET_ACTION_TYPES.TICKET_COMPLETED,
                        ticket_number: ticketNumber,
                        target_user_id: ticket.creator_id,
                        details: {
                            curator_id: curatorId,
                            completion_notes: completionNotes || 'Не указаны'
                        },
                        success: true,
                        channel_id: ticket.channel_id,
                        guild_id: interaction.guildId
                    });

                    // РАБОТАЕМ С КАНАЛОМ ВМЕСТО ВЕТКИ
                    const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
                    if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                        const completionEmbed = new EmbedBuilder()
                            .setTitle('✅ Тикет завершен')
                            .setDescription(`Тикет #${ticketNumber} был завершен куратором <@${curatorId}>`)
                            .addFields(
                                { name: '📝 Заметки куратора', value: completionNotes || 'Не указаны' }
                            )
                            .setColor(0x00ff00)
                            .setTimestamp();

                        // Кнопки для оценки куратора
                        const rateButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`rate_curator_${ticketNumber}_${ticket.creator_id}_1`)
                                .setLabel('1⭐')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`rate_curator_${ticketNumber}_${ticket.creator_id}_2`)
                                .setLabel('2⭐')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`rate_curator_${ticketNumber}_${ticket.creator_id}_3`)
                                .setLabel('3⭐')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`rate_curator_${ticketNumber}_${ticket.creator_id}_4`)
                                .setLabel('4⭐')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`rate_curator_${ticketNumber}_${ticket.creator_id}_5`)
                                .setLabel('5⭐')
                                .setStyle(ButtonStyle.Success)
                        );

                        const reviewEmbed = new EmbedBuilder()
                            .setTitle('⭐ Оцените работу куратора')
                            .setDescription(`<@${ticket.creator_id}>, пожалуйста, оцените работу куратора <@${curatorId}> по этому тикету.\nВаша оценка поможет улучшить качество обслуживания.`)
                            .setColor(0xffd700)
                            .setTimestamp();

                        await ticketChannel.send({
                            embeds: [completionEmbed, reviewEmbed],
                            components: [rateButtons]
                        });

                        // Удаляем канал через 10 минут вместо архивации
                        setTimeout(async () => {
                            try {
                                await ticketChannel.delete(`Тикет #${ticketNumber} завершен и удален`);
                                console.log(`🗑️ Канал тикета #${ticketNumber} удален`);
                            } catch (deleteError) {
                                console.error(`❌ Ошибка удаления канала тикета #${ticketNumber}:`, deleteError);
                            }
                        }, 10 * 60 * 1000); // 10 минут
                    }

                    await safeReply(interaction, {
                        content: `✅ Тикет #${ticketNumber} успешно завершен! Канал будет удален через 10 минут.`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (error) {
                    console.error('Ошибка завершения тикета:', error);
                    await safeReply(interaction, {
                        content: '❌ Произошла ошибка при завершении тикета!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

            // =============================
            // СИСТЕМА ОТЗЫВОВ КУРАТОРОВ
            // =============================
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

                    // Проверяем, не оставлял ли уже отзыв
                    const hasReviewed = await db.hasUserReviewedTicket(ticketNumber, reviewerId);
                    if (hasReviewed) {
                        return await safeReply(interaction, {
                            content: '❌ Вы уже оставили отзыв на этот тикет!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Сохраняем отзыв
                    await db.addCuratorReview(ticketNumber, ticket.curator_id, reviewerId, rating, comment);
                    
                    // Получаем обновленный рейтинг куратора
                    const curatorRating = await db.getCuratorRating(ticket.curator_id);

                    const starsEmoji = CUSTOM_EMOJIS.STAR_FULL.repeat(rating) + CUSTOM_EMOJIS.STAR_EMPTY.repeat(5 - rating);

                    const thankYouEmbed = new EmbedBuilder()
                        .setTitle('✅ Спасибо за отзыв!')
                        .setDescription(`Ваша оценка **${starsEmoji}** сохранена!`)
                        .addFields(
                            { name: '🎫 Тикет', value: `#${ticketNumber}`, inline: true },
                            { name: '👨💼 Куратор', value: `<@${ticket.curator_id}>`, inline: true },
                            { name: `${CUSTOM_EMOJIS.STAR_FULL} Новый рейтинг`, value: `${generateStarRatingFromValue(curatorRating.average_rating)} ${curatorRating.average_rating ? curatorRating.average_rating.toFixed(1) : '0.0'}/5.0 (${curatorRating.total_reviews} отзывов)`, inline: true }
                        )
                        .setColor(0x00ff00)
                        .setTimestamp();

                    if (comment) {
                        thankYouEmbed.addFields({ name: '💬 Ваш комментарий', value: comment });
                    }

                    function generateStarRatingFromValue(rating) {
                        if (!rating) rating = 0;
                        const fullStars = Math.floor(rating);
                        const hasHalfStar = rating % 1 >= 0.5;
                        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
                        return CUSTOM_EMOJIS.STAR_FULL.repeat(fullStars) +
                            (hasHalfStar ? CUSTOM_EMOJIS.STAR_HALF : '') +
                            CUSTOM_EMOJIS.STAR_EMPTY.repeat(emptyStars);
                    }

                    await safeReply(interaction, {
                        embeds: [thankYouEmbed],
                        flags: MessageFlags.Ephemeral
                    });

                    // Уведомляем куратора о новом отзыве
                    const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
                    if (ticketChannel) {
                        const curatorNotifyEmbed = new EmbedBuilder()
                            .setTitle('⭐ Получен новый отзыв!')
                            .setDescription(`<@${ticket.curator_id}>, вы получили оценку **${starsEmoji}** за работу с тикетом #${ticketNumber}`)
                            .addFields(
                                { name: '⭐ Текущий рейтинг', value: `${curatorRating.average_rating ? curatorRating.average_rating.toFixed(1) : '0.0'}/5.0`, inline: true },
                                { name: '📊 Всего отзывов', value: curatorRating.total_reviews.toString(), inline: true }
                            )
                            .setColor(rating >= 4 ? 0x00ff00 : rating >= 3 ? 0xffa500 : 0xff0000)
                            .setTimestamp();

                        if (comment) {
                            curatorNotifyEmbed.addFields({ name: '💬 Комментарий', value: comment });
                        }

                        await ticketChannel.send({ embeds: [curatorNotifyEmbed] });
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
