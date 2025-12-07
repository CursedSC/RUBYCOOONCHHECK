// interactions/trainingInteraction.js

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('../database');

const TRAINING_CONFIG = {
    SYMBOLS_PER_HOUR: 3200,
    MAX_POSTS_PER_HOUR: 4,
    MIN_SYMBOLS_PER_POST: 400,
    MAX_HOURS: 10,
    MIN_HOURS: 1,
    COOLDOWN_HOURS: 24,
    REVIEW_CHANNEL_ID: '1433827349086081106',
    ANALYTICS_ROLE_ID: '1382006799028322324',
    HOUR_TIMEOUT_MS: 60 * 60 * 1000, // 1 час
    SPAM_WARNING_INTERVAL: 3 * 60 * 1000, // 3 минуты
    OVERDUE_REMINDER_INTERVAL: 20 * 60 * 1000 // 20 минут
};

class TrainingInteractionHandler {
    constructor() {
        this.db = new Database();
        this.activeSessions = new Map(); // userId -> sessionData
        this.hourTimers = new Map(); // timerId -> timeout
        this.cooldownTimers = new Map(); // userId -> timeout
        this.spamWarnings = new Map(); // userId -> lastWarningTime
        this.overdueReminders = new Map(); // userId -> intervalId
        
        // Восстанавливаем активные тренировки при запуске
        this.restoreActiveSessions();
    }

    // НОВЫЙ МЕТОД: Восстановление активных тренировок при перезагрузке бота
    async restoreActiveSessions() {
        try {
            console.log('[Training] Восстановление активных тренировок...');
            const activeSessions = await this.db.getAllActiveTrainingSessions();
            
            for (const session of activeSessions) {
                const now = Date.now();
                const lastUpdate = new Date(session.last_update).getTime();
                const hourStartTime = session.hour_start_time 
                    ? new Date(session.hour_start_time).getTime() 
                    : new Date(session.created_at).getTime();
                const elapsedSinceHourStart = now - hourStartTime;
                
                // Проверяем, истёк ли таймер текущего часа
                if (elapsedSinceHourStart >= TRAINING_CONFIG.HOUR_TIMEOUT_MS) {
                    // Время истекло - помечаем сессию как failed
                    await this.db.failTrainingSession(session.id, 'timeout');
                    console.log(`[Training] Тренировка ${session.id} пользователя ${session.user_id} провалена из-за истекшего времени`);
                    continue;
                }
                
                // Восстанавливаем данные сессии
                const posts = await this.db.getTrainingSessionPosts(session.id);
                const hourPosts = posts.filter(p => p.hour_number === session.current_hour);
                const symbolsThisHour = hourPosts.reduce((sum, p) => sum + p.symbols_count, 0);
                const postsThisHour = hourPosts.length;
                
                // Определяем, находится ли час на кулдауне
                const hourOnCooldown = symbolsThisHour >= TRAINING_CONFIG.SYMBOLS_PER_HOUR;
                
                this.activeSessions.set(session.user_id, {
                    sessionId: session.id,
                    characterId: session.character_id,
                    hours: session.total_hours,
                    type: session.training_type,
                    currentHour: session.current_hour,
                    postsThisHour: postsThisHour,
                    symbolsThisHour: symbolsThisHour,
                    hourStartTime: hourStartTime,
                    hourOnCooldown: hourOnCooldown
                });
                
                console.log(`[Training] Восстановлена тренировка ${session.id} для пользователя ${session.user_id}, час ${session.current_hour}/${session.total_hours}`);
                
                // Сохраняем информацию для последующего восстановления таймеров
                this._pendingSessions = this._pendingSessions || [];
                this._pendingSessions.push({
                    userId: session.user_id,
                    sessionId: session.id,
                    hourNumber: session.current_hour,
                    channelId: session.channel_id,
                    guildId: session.guild_id,
                    remainingTime: TRAINING_CONFIG.HOUR_TIMEOUT_MS - elapsedSinceHourStart,
                    hourOnCooldown: hourOnCooldown
                });
            }
            
            console.log(`[Training] Восстановлено ${activeSessions.length} активных тренировок`);
        } catch (error) {
            console.error('[Training] Ошибка при восстановлении тренировок:', error);
        }
    }

    // НОВЫЙ МЕТОД: Восстановление таймеров после получения доступа к client
    async restoreTimers(client) {
        if (!this._pendingSessions || this._pendingSessions.length === 0) {
            console.log('[Training] Нет ожидающих сессий для восстановления таймеров');
            return;
        }
        
        console.log('[Training] Восстановление таймеров...');
        
        for (const pending of this._pendingSessions) {
            try {
                const guild = await client.guilds.fetch(pending.guildId);
                const channel = await guild.channels.fetch(pending.channelId);
                
                if (pending.hourOnCooldown) {
                    // Восстанавливаем таймер окончания кулдауна
                    this.scheduleCooldownEndWithDelay(
                        pending.userId,
                        pending.sessionId,
                        pending.hourNumber,
                        channel,
                        pending.remainingTime
                    );
                } else {
                    // Восстанавливаем таймер провала тренировки
                    this.scheduleHourTimeoutWithDelay(
                        pending.userId,
                        pending.sessionId,
                        pending.hourNumber,
                        channel,
                        pending.remainingTime
                    );
                }
            } catch (error) {
                console.error(`[Training] Ошибка восстановления таймера для сессии ${pending.sessionId}:`, error);
            }
        }
        
        this._pendingSessions = [];
        console.log('[Training] Таймеры восстановлены');
    }

    canHandle(interaction) {
        if (interaction.isCommand?.() && interaction.commandName === 'тренировка') {
            return true;
        }
        
        if (interaction.isStringSelectMenu?.()) {
            const customId = interaction.customId;
            if (customId.startsWith('traininghours') ||
                customId.startsWith('trainingtype') ||
                customId.startsWith('trainingcharacter')) {
                return true;
            }
        }
        
        if (interaction.isButton?.()) {
            const customId = interaction.customId;
            if (customId.startsWith('trainingapprove_') ||
                customId.startsWith('trainingreject_')) {
                return true;
            }
        }
        
        return false;
    }

    async execute(interaction) {
        try {
            if (interaction.isCommand?.() && interaction.commandName === 'тренировка') {
                await this.startTrainingFlow(interaction);
                return;
            }
            
            if (interaction.isStringSelectMenu?.()) {
                if (interaction.customId.startsWith('trainingcharacter')) {
                    await this.handleCharacterSelection(interaction);
                    return;
                }
                if (interaction.customId.startsWith('traininghours')) {
                    await this.handleHoursSelection(interaction);
                    return;
                }
                if (interaction.customId.startsWith('trainingtype')) {
                    await this.handleTypeSelection(interaction);
                    return;
                }
            }

            if (interaction.isButton?.()) {
                if (interaction.customId.startsWith('trainingapprove_')) {
                    await this.handleApprove(interaction);
                    return;
                }
                if (interaction.customId.startsWith('trainingreject_')) {
                    await this.handleReject(interaction);
                    return;
                }
            }
        } catch (error) {
            console.error('[TrainingInteractionHandler]', error);
            await this.safeReply(interaction, {
                content: '❌ Произошла ошибка при выполнении команды!',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    async startTrainingFlow(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const activeSession = await this.db.getActiveTraining(interaction.user.id);
            if (activeSession) {
                return await interaction.editReply({
                    content: `⚠️ У вас уже есть активная тренировка в канале <#${activeSession.channel_id}>!`
                });
            }
            
            const cooldown = await this.db.checkTrainingCooldown(interaction.user.id);
            if (cooldown > 0) {
                return await interaction.editReply({
                    content: `⏳ Вы можете начать новую тренировку через ${cooldown} ч.`
                });
            }
            
            const characters = await this.db.getAllCharactersByUserId(interaction.user.id);
            if (characters.length === 0) {
                return await interaction.editReply({
                    content: '❌ У вас нет персонажей для тренировки!'
                });
            }
            
            const characterMenu = new StringSelectMenuBuilder()
                .setCustomId(`trainingcharacter_${interaction.user.id}_${Date.now()}`)
                .setPlaceholder('Выберите персонажа')
                .addOptions(characters.slice(0, 25).map(char => ({
                    label: `${char.name} (ID: ${char.id})`,
                    description: `Уровень ${char.level || 1}`,
                    value: char.id.toString(),
                    emoji: char.emoji || '⚔️'
                })));
            
            const row = new ActionRowBuilder().addComponents(characterMenu);
            
            const embed = new EmbedBuilder()
                .setTitle('🏋️ Начало тренировки')
                .setDescription(
                    '**Правила тренировки:**\n' +
                    '• Минимум 3200 символов за 1 час\n' +
                    '• Максимум 4 поста в час\n' +
                    '• Кулдаун: 24 часа после завершения\n\n' +
                    '**Важно:** У вас есть ровно 1 час с момента начала каждого часа тренировки.'
                )
                .setColor('#FFD700')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[startTrainingFlow]', error);
            await interaction.editReply({ content: '❌ Произошла ошибка!' });
        }
    }

    async handleCharacterSelection(interaction) {
        await interaction.deferUpdate();
        
        try {
            const characterId = parseInt(interaction.values[0]);
            const userId = interaction.user.id;
            
            if (!this.activeSessions.has(userId)) {
                this.activeSessions.set(userId, {});
            }
            this.activeSessions.get(userId).characterId = characterId;
            
            const hoursMenu = new StringSelectMenuBuilder()
                .setCustomId(`traininghours_${userId}_${Date.now()}`)
                .setPlaceholder('Выберите количество часов')
                .addOptions(
                    Array.from({ length: TRAINING_CONFIG.MAX_HOURS }, (_, i) => {
                        const hours = i + 1;
                        const totalSymbols = hours * TRAINING_CONFIG.SYMBOLS_PER_HOUR;
                        const maxPosts = hours * TRAINING_CONFIG.MAX_POSTS_PER_HOUR;
                        return {
                            label: `${hours} час(ов)`,
                            description: `${totalSymbols} символов, до ${maxPosts} постов`,
                            value: hours.toString()
                        };
                    })
                );
            
            const row = new ActionRowBuilder().addComponents(hoursMenu);
            
            const embed = new EmbedBuilder()
                .setTitle('⏱️ Выбор длительности')
                .setDescription('Выберите, сколько часов вы хотите тренироваться.\nМинимум: 3200 символов за час.')
                .setColor('#FFD700')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[handleCharacterSelection]', error);
            await interaction.editReply({ content: '❌ Произошла ошибка!', components: [] });
        }
    }

    async handleHoursSelection(interaction) {
        await interaction.deferUpdate();
        
        try {
            const hours = parseInt(interaction.values[0]);
            const userId = interaction.user.id;
            const sessionData = this.activeSessions.get(userId);
            
            if (!sessionData) {
                return await interaction.followUp({
                    content: '⚠️ Сессия не найдена. Пожалуйста, начните заново.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            sessionData.hours = hours;
            
            const typeMenu = new StringSelectMenuBuilder()
                .setCustomId(`trainingtype_${userId}_${Date.now()}`)
                .setPlaceholder('Что хотите тренировать?')
                .addOptions([
                    {
                        label: 'Статы',
                        value: 'stats',
                        emoji: '💪',
                        description: 'Сила, ловкость, реакция, точность, выносливость, стойкость, магия'
                    },
                    {
                        label: 'Способности',
                        value: 'abilities',
                        emoji: '✨',
                        description: 'Хаки, фрукты, патронаж и т.д.'
                    },
                    {
                        label: 'Сила воли',
                        value: 'willpower',
                        emoji: '🔥',
                        description: 'Тренировка силы воли'
                    },
                    {
                        label: 'Боевые искусства',
                        value: 'martialarts',
                        emoji: '🥋',
                        description: 'Изучение новых техник'
                    }
                ]);
            
            const row = new ActionRowBuilder().addComponents(typeMenu);
            
            const totalSymbols = hours * TRAINING_CONFIG.SYMBOLS_PER_HOUR;
            const maxPosts = hours * TRAINING_CONFIG.MAX_POSTS_PER_HOUR;
            
            const embed = new EmbedBuilder()
                .setTitle('🎯 Выбор типа тренировки')
                .setDescription(`Выбрано: ${hours} час(ов)\nВсего символов: ${totalSymbols}\nМаксимум постов: ${maxPosts}`)
                .setColor('#FFD700')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[handleHoursSelection]', error);
            await interaction.editReply({ content: '❌ Произошла ошибка!', components: [] });
        }
    }

    async handleTypeSelection(interaction) {
        await interaction.deferUpdate();
        
        try {
            const type = interaction.values[0];
            const userId = interaction.user.id;
            const sessionData = this.activeSessions.get(userId);
            
            if (!sessionData || !sessionData.hours || !sessionData.characterId) {
                return await interaction.followUp({
                    content: '⚠️ Сессия не найдена. Пожалуйста, начните заново.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            const sessionId = await this.db.createTrainingSession({
                userId: userId,
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                characterId: sessionData.characterId,
                hours: sessionData.hours,
                type: type
            });
            
            sessionData.sessionId = sessionId;
            sessionData.type = type;
            sessionData.currentHour = 1;
            sessionData.postsThisHour = 0;
            sessionData.symbolsThisHour = 0;
            sessionData.hourStartTime = Date.now(); // ВАЖНО: Запоминаем время начала часа
            sessionData.hourOnCooldown = false;
            
            // Сохраняем время начала часа в БД
            await this.db.updateTrainingSessionHourStartTime(sessionId, sessionData.hourStartTime);
            
            const typeNames = {
                stats: 'Статы',
                abilities: 'Способности',
                willpower: 'Сила воли',
                martialarts: 'Боевые искусства'
            };
            
            const startEmbed = new EmbedBuilder()
                .setTitle('✅ Тренировка начата!')
                .setDescription(
                    `**Тип:** ${typeNames[type]}\n` +
                    `**Длительность:** ${sessionData.hours} час(ов)\n` +
                    `**Канал:** <#${interaction.channelId}>\n\n` +
                    `📝 Начинайте писать посты (минимум ${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов за час)!\n` +
                    `⏰ **У вас есть ровно 1 час с текущего момента на выполнение ${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов (до ${TRAINING_CONFIG.MAX_POSTS_PER_HOUR} постов)!**\n\n` +
                    `⚠️ Если вы не выполните норму за час — тренировка провалится.`
                )
                .setColor('#00FF00')
                .setTimestamp()
                .setFooter({ text: `ID сессии: ${sessionId} | Час: 1 из ${sessionData.hours}` });
            
            await interaction.editReply({ embeds: [startEmbed], components: [] });
            
            const publicEmbed = new EmbedBuilder()
                .setTitle('🏋️ Тренировка начата!')
                .setDescription(
                    `${interaction.user} начал${this.getGenderSuffix(interaction.user.username)} тренировку!\n\n` +
                    `**Тип:** ${typeNames[type]}\n` +
                    `**Длительность:** ${sessionData.hours} час(ов)`
                )
                .setColor('#FFD700')
                .setTimestamp();
            
            await interaction.channel.send({ embeds: [publicEmbed] });
            
            // Запускаем таймер на ВЕСЬ ЧАС (не после завершения постов)
            this.scheduleHourTimeout(userId, sessionId, 1, interaction.channel);
            
        } catch (error) {
            console.error('[handleTypeSelection]', error);
            await interaction.editReply({ content: '❌ Произошла ошибка!', components: [] });
        }
    }

    async handleTrainingPost(message) {
        if (message.author.bot) return false;
        
        try {
            const sessionData = this.activeSessions.get(message.author.id);
            
            if (!sessionData || !sessionData.sessionId) {
                return false;
            }
            
            const session = await this.db.getTrainingSessionById(sessionData.sessionId);
            
            if (!session || session.channel_id !== message.channel.id || session.status !== 'active') {
                return false;
            }
            
            // Проверяем не кулдаун, а прошёл ли час с начала
            const now = Date.now();
            const timeSinceHourStart = now - sessionData.hourStartTime;
            
            if (timeSinceHourStart >= TRAINING_CONFIG.HOUR_TIMEOUT_MS && !sessionData.hourOnCooldown) {
                // Час прошёл, но пользователь не завершил норму - провал
                const warningKey = `${message.author.id}_timeout`;
                const lastWarning = this.spamWarnings.get(warningKey) || 0;
                
                if (now - lastWarning > TRAINING_CONFIG.SPAM_WARNING_INTERVAL) {
                    await message.reply({
                        content: `⏰ **Время истекло!** Вы не успели выполнить норму символов за текущий час. Тренировка провалена.`
                    });
                    this.spamWarnings.set(warningKey, now);
                }
                return false;
            }
            
            if (sessionData.hourOnCooldown) {
                const timeLeft = Math.ceil((TRAINING_CONFIG.HOUR_TIMEOUT_MS - timeSinceHourStart) / 1000);
                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                
                const warningKey = `${message.author.id}_cooldown`;
                const lastWarning = this.spamWarnings.get(warningKey) || 0;
                
                if (now - lastWarning > TRAINING_CONFIG.SPAM_WARNING_INTERVAL) {
                    await message.reply({
                        content: `⏸️ **Час завершён!** Ожидайте начала следующего часа (осталось ${minutes}м ${seconds}с).`
                    });
                    this.spamWarnings.set(warningKey, now);
                }
                return false;
            }
            
            const content = message.content.trim();
            const symbolsCount = content.replace(/\s/g, '').length;
            
            if (symbolsCount < TRAINING_CONFIG.MIN_SYMBOLS_PER_POST) {
                await message.reply({
                    content: `❌ **Пост слишком короткий!** Минимум 400 символов (у вас ${symbolsCount})`,
                    flags: MessageFlags.Ephemeral
                });
                return false;
            }
            
            if (sessionData.postsThisHour >= TRAINING_CONFIG.MAX_POSTS_PER_HOUR) {
                const warningKey = `${message.author.id}_postlimit`;
                const lastWarning = this.spamWarnings.get(warningKey) || 0;
                
                if (now - lastWarning > TRAINING_CONFIG.SPAM_WARNING_INTERVAL) {
                    const timeLeft = Math.ceil((TRAINING_CONFIG.HOUR_TIMEOUT_MS - timeSinceHourStart) / 1000 / 60);
                    await message.reply({
                        content: `⚠️ Вы исчерпали лимит постов (4). Ожидайте следующего часа (${timeLeft > 0 ? `~${timeLeft} мин` : 'скоро'}).`
                    });
                    this.spamWarnings.set(warningKey, now);
                }
                return false;
            }
            
            await this.db.saveTrainingPost({
                sessionId: sessionData.sessionId,
                hourNumber: sessionData.currentHour,
                postNumber: sessionData.postsThisHour + 1,
                messageId: message.id,
                content: content,
                symbolsCount: symbolsCount
            });
            
            sessionData.postsThisHour++;
            sessionData.symbolsThisHour += symbolsCount;
            
            const symbolsLeft = TRAINING_CONFIG.SYMBOLS_PER_HOUR - sessionData.symbolsThisHour;
            const postsLeft = TRAINING_CONFIG.MAX_POSTS_PER_HOUR - sessionData.postsThisHour;
            const progress = Math.min(100, Math.round((sessionData.symbolsThisHour / TRAINING_CONFIG.SYMBOLS_PER_HOUR) * 100));
            const progressBar = this.createProgressBar(progress, 20);
            
            if (sessionData.symbolsThisHour >= TRAINING_CONFIG.SYMBOLS_PER_HOUR) {
                await this.completeHour(message, sessionData, session);
            } else {
                const progressEmbed = new EmbedBuilder()
                    .setTitle(`⏱️ Час ${sessionData.currentHour}/${session.total_hours}`)
                    .setDescription(
                        `${progressBar} **${progress}%**\n\n` +
                        `📝 **Пост #${sessionData.postsThisHour}:** ${symbolsCount} символов\n` +
                        `📊 **Прогресс:** ${sessionData.symbolsThisHour}/${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов\n` +
                        `📬 **Посты:** ${sessionData.postsThisHour}/${TRAINING_CONFIG.MAX_POSTS_PER_HOUR}\n\n` +
                        `⏰ **Осталось символов:** ${symbolsLeft > 0 ? symbolsLeft : 0}\n` +
                        `💬 **Осталось постов:** ${postsLeft}`
                    )
                    .setColor(progress >= 100 ? '#00FF00' : '#FFD700')
                    .setTimestamp();
                
                await message.reply({ embeds: [progressEmbed] });
            }
            
            return true;
        } catch (error) {
            console.error('[handleTrainingPost]', error);
            return false;
        }
    }

    async completeHour(message, sessionData, session) {
        try {
            await this.db.updateTrainingSessionHour(sessionData.sessionId, sessionData.currentHour);
            
            const hourCompleteEmbed = new EmbedBuilder()
                .setTitle(`✅ Час ${sessionData.currentHour} завершён!`)
                .setDescription(
                    `🎉 **Отличная работа!**\n\n` +
                    `📊 **Написано:** ${sessionData.symbolsThisHour}/${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов\n` +
                    `📬 **Постов:** ${sessionData.postsThisHour}/${TRAINING_CONFIG.MAX_POSTS_PER_HOUR}\n\n` +
                    `⏱️ **Следующий час начнётся автоматически!**`
                )
                .setColor('#00FF00')
                .setTimestamp();
            
            await message.channel.send({ embeds: [hourCompleteEmbed] });
            
            // Рассчитываем время до следующего часа
            const now = Date.now();
            const elapsedSinceHourStart = now - sessionData.hourStartTime;
            const timeUntilNextHour = TRAINING_CONFIG.HOUR_TIMEOUT_MS - elapsedSinceHourStart;
            
            const nextHourTime = new Date(now + timeUntilNextHour);
            const unixTime = Math.floor(nextHourTime.getTime() / 1000);
            
            try {
                await message.author.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Час завершён!')
                        .setDescription(
                            `Вы завершили час ${sessionData.currentHour}/${session.total_hours}!\n\n` +
                            `📊 Написано: ${sessionData.symbolsThisHour} символов\n` +
                            `📬 Постов: ${sessionData.postsThisHour}\n\n` +
                            `⏰ Следующий час начнётся <t:${unixTime}:R>`
                        )
                        .setColor('#00FF00')
                        .setTimestamp()]
                });
            } catch (error) {
                console.log('[DM Error]', error.message);
            }
            
            // Удаляем старый таймер провала (если есть)
            const currentTimerKey = `${message.author.id}_${sessionData.sessionId}_${sessionData.currentHour}`;
            if (this.hourTimers.has(currentTimerKey)) {
                clearTimeout(this.hourTimers.get(currentTimerKey));
                this.hourTimers.delete(currentTimerKey);
            }
            
            if (sessionData.currentHour >= session.total_hours) {
                await this.completeTraining(message, sessionData, session);
            } else {
                sessionData.currentHour++;
                sessionData.hourOnCooldown = true;
                sessionData.postsThisHour = 0;
                sessionData.symbolsThisHour = 0;
                // НЕ меняем hourStartTime - следующий час начнётся ровно через 1 час от начала текущего
                
                const nextHourEmbed = new EmbedBuilder()
                    .setTitle(`⏱️ Час ${sessionData.currentHour}/${session.total_hours} — Ожидание`)
                    .setDescription(
                        `⏰ **Следующий час начнётся <t:${unixTime}:R>**\n\n` +
                        `Пожалуйста, дождитесь начала следующего часа!\n` +
                        `Прогресс: ${sessionData.currentHour - 1}/${session.total_hours} час(ов) выполнено`
                    )
                    .setColor('#FFA500')
                    .setTimestamp()
                    .setFooter({ text: `${sessionData.currentHour - 1} из ${session.total_hours} завершено` });
                
                await message.channel.send({ embeds: [nextHourEmbed] });
                
                // Запускаем кулдаун до следующего часа
                this.scheduleCooldownEnd(message.author.id, sessionData.sessionId, sessionData.currentHour, message.channel, timeUntilNextHour);
            }
            
        } catch (error) {
            console.error('[completeHour]', error);
        }
    }

    scheduleCooldownEnd(userId, sessionId, hourNumber, channel, customDelay = null) {
        const cooldownKey = `cooldown_${userId}_${sessionId}_${hourNumber}`;
        
        if (this.cooldownTimers.has(cooldownKey)) {
            clearTimeout(this.cooldownTimers.get(cooldownKey));
            this.cooldownTimers.delete(cooldownKey);
        }
        
        const delay = customDelay !== null ? customDelay : TRAINING_CONFIG.HOUR_TIMEOUT_MS;
        
        const cooldownTimeout = setTimeout(async () => {
            try {
                const sessionData = this.activeSessions.get(userId);
                if (!sessionData || sessionData.sessionId !== sessionId || sessionData.currentHour !== hourNumber) {
                    this.cooldownTimers.delete(cooldownKey);
                    return;
                }
                
                if (!sessionData.hourOnCooldown) {
                    this.cooldownTimers.delete(cooldownKey);
                    return;
                }
                
                console.log(`[Training] Кулдаун завершён для ${userId}, час ${hourNumber}`);
                
                sessionData.hourOnCooldown = false;
                sessionData.postsThisHour = 0;
                sessionData.symbolsThisHour = 0;
                sessionData.hourStartTime = Date.now(); // ВАЖНО: Новый час начинается СЕЙЧАС
                
                // Обновляем время начала часа в БД
                await this.db.updateTrainingSessionHourStartTime(sessionId, sessionData.hourStartTime);
                
                const nextHourAvailableEmbed = new EmbedBuilder()
                    .setTitle('✅ Час начался!')
                    .setDescription(
                        `⏰ **Час ${sessionData.currentHour} начался!**\n\n` +
                        `Вы можете писать посты (минимум ${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов, до ${TRAINING_CONFIG.MAX_POSTS_PER_HOUR} постов).\n\n` +
                        `⚠️ **У вас ровно 1 час (60 минут) на выполнение!**`
                    )
                    .setColor('#00FF00')
                    .setTimestamp();
                
                await channel.send({ embeds: [nextHourAvailableEmbed] });
                
                try {
                    const user = await channel.client.users.fetch(userId);
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('✅ Час начался!')
                            .setDescription(
                                `⏰ **Час ${sessionData.currentHour} начался!**\n\n` +
                                `Минимум: ${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов\n` +
                                `Максимум постов: ${TRAINING_CONFIG.MAX_POSTS_PER_HOUR}\n\n` +
                                `⏱️ **У вас 1 час!**`
                            )
                            .setColor('#00FF00')
                            .setTimestamp()]
                    });
                } catch (error) {
                    console.log('[DM Error]', error.message);
                }
                
                // Запускаем таймер провала на новый час
                this.scheduleHourTimeout(userId, sessionId, hourNumber, channel);
                this.cooldownTimers.delete(cooldownKey);
                
            } catch (error) {
                console.error('[scheduleCooldownEnd]', error);
            }
        }, delay);
        
        this.cooldownTimers.set(cooldownKey, cooldownTimeout);
        console.log(`[Training] Кулдаун запланирован для часа ${hourNumber} (через ${Math.round(delay / 1000)}с)`);
    }

    scheduleCooldownEndWithDelay(userId, sessionId, hourNumber, channel, delay) {
        this.scheduleCooldownEnd(userId, sessionId, hourNumber, channel, delay);
    }

    async completeTraining(message, sessionData, session) {
        try {
            const posts = await this.db.getTrainingSessionPosts(sessionData.sessionId);
            const totalSymbols = posts.reduce((sum, post) => sum + post.symbols_count, 0);
            const totalPosts = posts.length;
            
            await this.db.completeTrainingSession(sessionData.sessionId);
            this.activeSessions.delete(message.author.id);
            
            // Очищаем все таймеры
            const timerPrefix = `${message.author.id}_${sessionData.sessionId}`;
            for (const [key, timeout] of this.hourTimers.entries()) {
                if (key.startsWith(timerPrefix)) {
                    clearTimeout(timeout);
                    this.hourTimers.delete(key);
                }
            }
            
            const cooldownPrefix = `cooldown_${message.author.id}_${sessionData.sessionId}`;
            for (const [key, timeout] of this.cooldownTimers.entries()) {
                if (key.startsWith(cooldownPrefix)) {
                    clearTimeout(timeout);
                    this.cooldownTimers.delete(key);
                }
            }
            
            const completionEmbed = new EmbedBuilder()
                .setTitle('🎉 Тренировка завершена!')
                .setDescription(
                    `${message.author} завершил${this.getGenderSuffix(message.author.username)} тренировку!\n\n` +
                    `📊 **Часов:** ${session.total_hours}\n` +
                    `📝 **Всего символов:** ${totalSymbols}\n` +
                    `📬 **Всего постов:** ${totalPosts}\n` +
                    `🎯 **Тип:** ${this.getTypeName(session.training_type)}\n\n` +
                    `✅ **Тренировка отправлена на проверку!**`
                )
                .setColor('#00FF00')
                .setTimestamp();
            
            await message.channel.send({ embeds: [completionEmbed] });
            
            try {
                await message.author.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎉 Тренировка завершена!')
                        .setDescription(
                            `Поздравляем! Вы успешно завершили тренировку!\n\n` +
                            `📊 Всего символов: ${totalSymbols}\n` +
                            `📬 Всего постов: ${totalPosts}\n\n` +
                            `Ваша тренировка отправлена на проверку администраторам.\n` +
                            `Ожидайте результатов!`
                        )
                        .setColor('#00FF00')
                        .setTimestamp()]
                });
            } catch (error) {
                console.log('[DM Error]', error.message);
            }
            
            await this.sendToReview(message, session, posts, totalSymbols, totalPosts);
            
        } catch (error) {
            console.error('[completeTraining]', error);
        }
    }

    async sendToReview(message, session, posts, totalSymbols, totalPosts) {
        try {
            const reviewChannel = await message.client.channels.fetch(TRAINING_CONFIG.REVIEW_CHANNEL_ID);
            if (!reviewChannel) {
                console.error('[sendToReview] Канал проверки не найден!');
                return;
            }
            
            const character = await this.db.getCharacterById(session.character_id);
            if (!character) {
                console.error(`[sendToReview] Персонаж не найден, sessionId: ${session.id}`);
                return;
            }
            
            const hourlyBreakdown = [];
            for (let hour = 1; hour <= session.total_hours; hour++) {
                const hourPosts = posts.filter(p => p.hour_number === hour);
                const hourSymbols = hourPosts.reduce((sum, p) => sum + p.symbols_count, 0);
                const postCount = hourPosts.length;
                hourlyBreakdown.push(`**Час ${hour}:** ${hourSymbols}/${TRAINING_CONFIG.SYMBOLS_PER_HOUR} символов (${postCount}/${TRAINING_CONFIG.MAX_POSTS_PER_HOUR} постов)`);
            }
            
            const totalStats = (character.strength || 0) + (character.agility || 0) + (character.reaction || 0) +
                              (character.accuracy || 0) + (character.endurance || 0) + (character.durability || 0) + (character.magic || 0);
            
            const characterName = character.emoji ? `${character.emoji} ${character.name}` : character.name;
            
            const reviewEmbed = new EmbedBuilder()
                .setTitle('📋 Проверка тренировки')
                .setDescription(
                    `**Пользователь:** ${message.author} (${message.author.tag})\n` +
                    `**ID сессии:** ${session.id}\n\n` +
                    `**Персонаж:** ${characterName} (ID: ${character.id})\n` +
                    `**Общие статы персонажа:** ${totalStats.toLocaleString('ru-RU')}\n\n` +
                    `**Тип тренировки:** ${this.getTypeName(session.training_type)}\n` +
                    `**Длительность:** ${session.total_hours} час(ов)\n` +
                    `**Всего символов:** ${totalSymbols.toLocaleString('ru-RU')} / ${(session.total_hours * TRAINING_CONFIG.SYMBOLS_PER_HOUR).toLocaleString('ru-RU')}\n` +
                    `**Всего постов:** ${totalPosts}\n\n` +
                    `**Канал:** <#${session.channel_id}>\n\n` +
                    `**Разбивка по часам:**\n${hourlyBreakdown.join('\n')}`
                )
                .setColor(character.embed_color || '#FFD700')
                .setTimestamp()
                .setFooter({ text: `Дата: ${new Date().toLocaleString('ru-RU')}` });
            
            if (character.avatar_url) {
                reviewEmbed.setImage(character.avatar_url);
            }
            
            const approveButton = new ButtonBuilder()
                .setCustomId(`trainingapprove_${session.id}`)
                .setLabel('✅ Одобрить')
                .setStyle(ButtonStyle.Success);
            
            const rejectButton = new ButtonBuilder()
                .setCustomId(`trainingreject_${session.id}`)
                .setLabel('❌ Отклонить')
                .setStyle(ButtonStyle.Danger);
            
            const row = new ActionRowBuilder().addComponents(approveButton, rejectButton);
            
            const reviewMessage = await reviewChannel.send({
                content: `<@&${TRAINING_CONFIG.ANALYTICS_ROLE_ID}> — новая тренировка на проверку!`,
                embeds: [reviewEmbed],
                components: [row]
            });
            
            await this.db.createTrainingReview(session.id, reviewMessage.id);
            
        } catch (error) {
            console.error('[sendToReview]', error);
        }
    }

    scheduleHourTimeout(userId, sessionId, hourNumber, channel) {
        const timerId = `${userId}_${sessionId}_${hourNumber}`;
        
        if (this.hourTimers.has(timerId)) {
            clearTimeout(this.hourTimers.get(timerId));
            this.hourTimers.delete(timerId);
        }
        
        const timeout = setTimeout(async () => {
            try {
                const sessionData = this.activeSessions.get(userId);
                if (!sessionData || sessionData.sessionId !== sessionId || sessionData.currentHour !== hourNumber) {
                    this.hourTimers.delete(timerId);
                    return;
                }
                
                if (sessionData.hourOnCooldown) {
                    this.hourTimers.delete(timerId);
                    return;
                }
                
                console.log(`[Training] Таймаут для ${userId}, час ${hourNumber}`);
                
                await this.db.failTrainingSession(sessionId, 'timeout');
                this.activeSessions.delete(userId);
                this.hourTimers.delete(timerId);
                
                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Тренировка провалена')
                    .setDescription(
                        `<@${userId}>, ваша тренировка (час ${hourNumber}) провалена!\n\n` +
                        `Причина: вы не выполнили норму символов за отведённое время.\n\n` +
                        `Следующая тренировка будет доступна через 24 часа.`
                    )
                    .setColor('#FF0000')
                    .setTimestamp();
                
                await channel.send({ embeds: [failEmbed] });
                
                try {
                    const user = await channel.client.users.fetch(userId);
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Тренировка провалена')
                            .setDescription(
                                `Ваша тренировка (час ${hourNumber}) была провалена.\n\n` +
                                `Причина: не выполнена норма символов за час.\n\n` +
                                `Следующая тренировка доступна через 24 часа.`
                            )
                            .setColor('#FF0000')
                            .setTimestamp()]
                    });
                } catch (error) {
                    console.log('[DM Error]', error.message);
                }
                
            } catch (error) {
                console.error('[scheduleHourTimeout]', error);
            }
        }, TRAINING_CONFIG.HOUR_TIMEOUT_MS);
        
        this.hourTimers.set(timerId, timeout);
        console.log(`[Training] Таймер провала установлен для часа ${hourNumber} пользователя ${userId} (${TRAINING_CONFIG.HOUR_TIMEOUT_MS / 1000}с)`);
    }

    scheduleHourTimeoutWithDelay(userId, sessionId, hourNumber, channel, delay) {
        const timerId = `${userId}_${sessionId}_${hourNumber}`;
        
        if (this.hourTimers.has(timerId)) {
            clearTimeout(this.hourTimers.get(timerId));
            this.hourTimers.delete(timerId);
        }
        
        const timeout = setTimeout(async () => {
            try {
                const sessionData = this.activeSessions.get(userId);
                if (!sessionData || sessionData.sessionId !== sessionId || sessionData.currentHour !== hourNumber) {
                    this.hourTimers.delete(timerId);
                    return;
                }
                
                if (sessionData.hourOnCooldown) {
                    this.hourTimers.delete(timerId);
                    return;
                }
                
                console.log(`[Training] Таймаут для ${userId}, час ${hourNumber}`);
                
                await this.db.failTrainingSession(sessionId, 'timeout');
                this.activeSessions.delete(userId);
                this.hourTimers.delete(timerId);
                
                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Тренировка провалена')
                    .setDescription(
                        `<@${userId}>, ваша тренировка (час ${hourNumber}) провалена!\n\n` +
                        `Причина: вы не выполнили норму символов за отведённое время.\n\n` +
                        `Следующая тренировка будет доступна через 24 часа.`
                    )
                    .setColor('#FF0000')
                    .setTimestamp();
                
                await channel.send({ embeds: [failEmbed] });
                
                try {
                    const user = await channel.client.users.fetch(userId);
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('❌ Тренировка провалена')
                            .setDescription(
                                `Ваша тренировка (час ${hourNumber}) была провалена.\n\n` +
                                `Причина: не выполнена норма символов за час.\n\n` +
                                `Следующая тренировка доступна через 24 часа.`
                            )
                            .setColor('#FF0000')
                            .setTimestamp()]
                    });
                } catch (error) {
                    console.log('[DM Error]', error.message);
                }
                
            } catch (error) {
                console.error('[scheduleHourTimeout]', error);
            }
        }, delay);
        
        this.hourTimers.set(timerId, timeout);
        console.log(`[Training] Таймер провала восстановлен для часа ${hourNumber} пользователя ${userId} (через ${Math.round(delay / 1000)}с)`);
    }

    async handleApprove(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const sessionId = parseInt(interaction.customId.split('_')[1]);
            const session = await this.db.getTrainingSessionById(sessionId);
            
            if (!session) {
                return await interaction.editReply({ content: '❌ Тренировка не найдена!' });
            }
            
            if (session.status !== 'completed') {
                return await interaction.editReply({ content: '❌ Тренировка не завершена!' });
            }
            
            await this.db.approveTraining(sessionId, interaction.user.id);
            
            await interaction.message.edit({
                embeds: [
                    EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#00FF00')
                        .setFooter({ text: `Одобрено ${interaction.user.username} | ${new Date().toLocaleString('ru-RU')}` })
                ],
                components: []
            });
            
            await interaction.editReply({ content: '✅ Тренировка одобрена!' });
            
            try {
                const user = await interaction.client.users.fetch(session.user_id);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Тренировка одобрена!')
                        .setDescription(
                            `Ваша тренировка (ID: ${sessionId}) успешно одобрена!\n\n` +
                            `Администратор: ${interaction.user.username}`
                        )
                        .setColor('#00FF00')
                        .setTimestamp()]
                });
            } catch (error) {
                console.log('[DM Error]', error.message);
            }
            
        } catch (error) {
            console.error('[handleApprove]', error);
            await interaction.editReply({ content: '❌ Ошибка при одобрении!' });
        }
    }

    async handleReject(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const sessionId = parseInt(interaction.customId.split('_')[1]);
            const session = await this.db.getTrainingSessionById(sessionId);
            
            if (!session) {
                return await interaction.editReply({ content: '❌ Тренировка не найдена!' });
            }
            
            if (session.status !== 'completed') {
                return await interaction.editReply({ content: '❌ Тренировка не завершена!' });
            }
            
            await this.db.rejectTraining(sessionId, interaction.user.id, 'Причина не указана');
            
            await interaction.message.edit({
                embeds: [
                    EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#FF0000')
                        .setFooter({ text: `Отклонено ${interaction.user.username} | ${new Date().toLocaleString('ru-RU')}` })
                ],
                components: []
            });
            
            await interaction.editReply({ content: '❌ Тренировка отклонена!' });
            
            try {
                const user = await interaction.client.users.fetch(session.user_id);
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Тренировка отклонена')
                        .setDescription(
                            `Ваша тренировка (ID: ${sessionId}) была отклонена.\n\n` +
                            `Администратор: ${interaction.user.username}\n` +
                            `Причина: Причина не указана`
                        )
                        .setColor('#FF0000')
                        .setTimestamp()]
                });
            } catch (error) {
                console.log('[DM Error]', error.message);
            }
            
        } catch (error) {
            console.error('[handleReject]', error);
            await interaction.editReply({ content: '❌ Ошибка при отклонении!' });
        }
    }

    createProgressBar(percent, length = 20) {
        const filled = Math.round((percent / 100) * length);
        const empty = length - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }

    getTypeName(type) {
        const names = {
            stats: 'Статы',
            abilities: 'Способности',
            willpower: 'Сила воли',
            martialarts: 'Боевые искусства'
        };
        return names[type] || type;
    }

    getGenderSuffix(username) {
        if (username.endsWith('а') || username.endsWith('я')) {
            return 'а';
        }
        return '';
    }

    async safeReply(interaction, options) {
        try {
            if (interaction.replied) {
                return await interaction.followUp(options);
            } else if (interaction.deferred) {
                return await interaction.editReply(options);
            } else {
                return await interaction.reply(options);
            }
        } catch (error) {
            console.error('[safeReply]', error);
        }
    }
}

module.exports = TrainingInteractionHandler;
