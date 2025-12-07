// index.js

const {
    Client,
    Collection,
    GatewayIntentBits,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    REST,
    Routes,
    ActivityType,
    PresenceUpdateStatus,
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
const config = require('./config.json');

// База данных и утилиты
const Database = require('./database');
const KindnessFilter = require('./utils/kindnessFilter');
const TicketNotifications = require('./utils/ticketNotifications');

// Инициализация клиента
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
    ],
});
global.kindnessFilter = new KindnessFilter();
console.log('✅ Фильтр доброты инициализирован');
// Коллекции и состояния
client.commands = new Collection();
const db = new Database();
const voiceSessions = new Map();

// Внешние обработчики
const messageHandler = require('./utils/messageHandler');

// Инициализация Training Handler ПЕРВЫМ
const TrainingInteractionHandler = require('./interactions/trainingInteraction');
const trainingHandler = new TrainingInteractionHandler();
console.log('✅ TrainingInteractionHandler инициализирован');

let profileHandler = null;

// ---------------------------
// Загрузка событий (events/*)
// ---------------------------
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const event = require(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
            console.log(`✅ Событие ${event.name} загружено из ${file}`);
        } catch (error) {
            console.error(`❌ Ошибка загрузки события ${filePath}:`, error);
        }
    }
} else {
    console.log('⚠️ Папка events не найдена');
}

// ---------------------------
// Загрузка команд (commands/*)
// ---------------------------
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandItems = fs.readdirSync(commandsPath);
    for (const item of commandItems) {
        const itemPath = path.join(commandsPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            const commandFiles = fs.readdirSync(itemPath).filter((f) => f.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(itemPath, file);
                try {
                    const command = require(filePath);
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                        console.log(`✅ Команда ${command.data.name} загружена из папки ${item}`);
                    } else {
                        console.log(`⚠️ Команда в ${filePath} не имеет "data" или "execute"`);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка загрузки команды ${filePath}:`, error);
                }
            }
        } else if (item.endsWith('.js')) {
            try {
                const command = require(itemPath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`✅ Команда ${command.data.name} загружена`);
                } else {
                    console.log(`⚠️ Команда в ${itemPath} не имеет "data" или "execute"`);
                }
            } catch (error) {
                console.error(`❌ Ошибка загрузки команды ${itemPath}:`, error);
            }
        }
    }
} else {
    console.log('⚠️ Папка commands не найдена');
}

// =======================================
// Автодеплой команд в гильдию из config
// =======================================
async function autoDeployCommands() {
    if (client.commands.size === 0) {
        console.log('⚠️ Нет команд для развертывания');
        return;
    }

    const commands = Array.from(client.commands.values())
        .filter((c) => c.data)
        .map((c) => c.data.toJSON());

    const rest = new REST().setToken(config.token);
    try {
        console.log(`🔄 Автоматическое развертывание ${commands.length} команд...`);
        const data = await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );
        console.log(`✅ Автоматически развернуто ${data.length} команд`);
    } catch (error) {
        console.error('❌ Ошибка автоматического развертывания:', error);
    }
}

// Функция проверки истёкших наказаний
async function checkExpiredPunishments() {
    try {
        const expired = await db.getExpiredPunishments();
        for (const punishment of expired) {
            try {
                const guild = client.guilds.cache.get(punishment.guildid);
                if (!guild) {
                    await db.removePunishment(punishment.id);
                    continue;
                }

                const member = await guild.members.fetch(punishment.userid).catch(() => null);
                if (!member) {
                    await db.removePunishment(punishment.id);
                    continue;
                }

                // Удаляем роль наказания
                const punishmentRole = guild.roles.cache.get(punishment.roleid);
                if (punishmentRole && member.roles.cache.has(punishment.roleid)) {
                    await member.roles.remove(punishmentRole, 'Автоматическое снятие - истекло время');
                }

                // Проверяем, есть ли ещё другие активные наказания
                const otherPunishments = await db.getActivePunishments(punishment.userid, punishment.guildid);
                const hasOtherPunishments = otherPunishments.filter(p => p.id !== punishment.id).length > 0;

                // Если других наказаний нет - снимаем базовую роль "Нарушения"
                if (!hasOtherPunishments) {
                    const baseViolationRole = guild.roles.cache.get('1437355256723013662');
                    if (baseViolationRole && member.roles.cache.has('1437355256723013662')) {
                        await member.roles.remove(baseViolationRole, 'Автоснятие - нет активных наказаний');
                    }
                }

                // Отправляем ЛС
                try {
                    const roleName = punishmentRole ? punishmentRole.name : 'Наказание';
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('✅ Наказание автоматически снято')
                        .setDescription(
                            `**Сервер:** ${guild.name}\n` +
                            `**Роль:** ${roleName}\n\n` +
                            `Срок наказания истёк.\n` +
                            `📅 Дата: `
                        )
                        .setColor('#00FF00')
                        .setTimestamp();
                    await member.user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log(`[Punishment] Не удалось отправить ЛС ${member.user.tag}`);
                }

                await db.removePunishment(punishment.id);
                console.log(`[Punishment] Автоснятие наказания для ${member.user.username}`);
            } catch (error) {
                console.error('[checkExpiredPunishments] Ошибка:', error);
            }
        }
    } catch (error) {
        console.error('[checkExpiredPunishments]', error);
    }
}

// =======================================
// Снапшоты инвайтов (invite tracking)
// =======================================
async function updateInviteSnapshots() {
    try {
        const guilds = client.guilds.cache;
        for (const [guildId, guild] of guilds) {
            try {
                const invites = await guild.invites.fetch();
                const inviteData = invites.map((invite) => ({
                    code: invite.code,
                    inviterId: invite.inviter?.id || null,
                    uses: invite.uses || 0,
                    maxUses: invite.maxUses || 0,
                }));
                await db.saveInviteSnapshot(guildId, inviteData);
                console.log(`📸 Обновлены снимки приглашений для гильдии ${guild.name}`);
            } catch (error) {
                console.error(`Ошибка обновления снимков для гильдии ${guildId}:`, error);
            }
        }
    } catch (error) {
        console.error('Ошибка обновления снимков приглашений:', error);
    }
}

// =======================================
// Проверка верификации по инвайтам
// =======================================
async function checkUserVerification() {
    try {
        const usersToVerify = await db.getUsersForVerification();
        for (const user of usersToVerify) {
            try {
                const guild = client.guilds.cache.get(user.guild_id);
                if (guild) {
                    const member = await guild.members.fetch(user.user_id).catch(() => null);
                    if (member) {
                        await db.markUserVerified(user.user_id, user.guild_id);
                        console.log(`✅ Пользователь ${member.user.username} прошел верификацию`);
                    } else {
                        await db.markUserLeft(user.user_id, user.guild_id);
                        console.log(`❌ Пользователь ${user.user_id} покинул сервер`);
                    }
                }
            } catch (error) {
                console.error('Ошибка проверки верификации пользователя:', error);
            }
        }
    } catch (error) {
        console.error('Ошибка проверки верификации пользователей:', error);
    }
}

// =======================================
// Обработчик готовности
// =======================================
client.once('ready', async () => {
    console.log(`🤖 Бот ${client.user.tag} запущен и готов к работе!`);

    try {
        await db.getAverageStatsForConsole(10000);
    } catch (error) {
        console.error('Ошибка при получении статистики персонажей:', error);
    }

    // Профили
    try {
        const ProfileHandler = require('./interactions/ProfileHandler');
        profileHandler = new ProfileHandler(client, db);
        console.log('✅ ProfileHandler успешно инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации ProfileHandler:', error);
    }

    // ВОССТАНАВЛИВАЕМ ТАЙМЕРЫ ТРЕНИРОВОК
    try {
        await trainingHandler.restoreTimers(client);
        console.log('✅ Таймеры тренировок восстановлены');
    } catch (error) {
        console.error('❌ Ошибка восстановления таймеров:', error);
    }

    // Инициализация таблицы invite tracking
    db.initInviteTrackTable();

    // Деплой команд
    await autoDeployCommands();

    // Присутствие
    client.user.setPresence({
        activities: [
            {
                type: ActivityType.Custom,
                name: 'custom',
                state: 'Мой владелец это Роман Цветков. . . ||🎃||',
            },
        ],
        status: PresenceUpdateStatus.Online,
    });

    setInterval(async () => {
        await checkExpiredPunishments();
    }, 10 * 60 * 1000);

    // Начальное обновление инвайтов
    await updateInviteSnapshots();

    // Периодические задачи
    setInterval(async () => {
        await saveVoiceTime();
    }, 5 * 60 * 1000);

    setInterval(async () => {
        await checkExpiredTempBans();
    }, 30 * 1000);

    setInterval(async () => {
        await checkExpiredTempMutes();
    }, 30 * 1000);

    setInterval(updateInviteSnapshots, 2 * 60 * 1000);
    setInterval(checkUserVerification, 60 * 1000);
});

// =======================================
// Присоединение участника
// =======================================
client.on('guildMemberAdd', async (member) => {
    try {
        if (member.user.bot) return;

        const guild = member.guild;
        const currentInvites = await guild.invites.fetch();
        const previousInvites = await db.getInviteSnapshots(guild.id);
        let usedInvite = null;

        for (const invite of currentInvites.values()) {
            const prev = previousInvites.find((p) => p.invite_code === invite.code);
            if (prev && invite.uses > prev.uses) {
                usedInvite = invite;
                break;
            }
        }

        if (usedInvite && usedInvite.inviter) {
            await db.addInviteTrack({
                userId: member.id,
                guildId: guild.id,
                inviterId: usedInvite.inviter.id,
                inviteCode: usedInvite.code,
                accountCreatedAt: member.user.createdAt,
            });
            console.log(`📥 ${member.user.username} присоединился по приглашению ${usedInvite.inviter.username}`);
        }

        const inviteData = currentInvites.map((invite) => ({
            code: invite.code,
            inviterId: invite.inviter?.id || null,
            uses: invite.uses || 0,
            maxUses: invite.maxUses || 0,
        }));
        await db.saveInviteSnapshot(guild.id, inviteData);
    } catch (error) {
        console.error('Ошибка обработки присоединения:', error);
    }
});

// =======================================
// Уход участника
// =======================================
client.on('guildMemberRemove', async (member) => {
    try {
        if (member.user.bot) return;
        await db.markUserLeft(member.id, member.guild.id);
        console.log(`📤 ${member.user.username} покинул сервер`);
    } catch (error) {
        console.error('Ошибка обработки покидания:', error);
    }
});

// =======================================
// Автоснятие темп-банов
// =======================================
async function checkExpiredTempBans() {
    try {
        const expiredBans = await db.getExpiredTempBans();
        const tempBanRoleId = '1386021743352610836';

        for (const ban of expiredBans) {
            try {
                const guild = client.guilds.cache.get(ban.guild_id);
                if (!guild) {
                    await db.removeTempBan(ban.user_id, ban.guild_id);
                    continue;
                }

                const member = await guild.members.fetch(ban.user_id).catch(() => null);
                if (!member) {
                    await db.removeTempBan(ban.user_id, ban.guild_id);
                    console.log(`🔓 Пользователь ${ban.user_id} не найден, снят из БД`);
                    continue;
                }

                const tempBanRole = guild.roles.cache.get(tempBanRoleId);
                if (tempBanRole && member.roles.cache.has(tempBanRoleId)) {
                    await member.roles.remove(tempBanRole, 'Истек срок темп-бана');

                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('✅ Ваш временный бан истек')
                            .setColor('#00FF00')
                            .addFields(
                                { name: '🏛️ Сервер', value: guild.name, inline: true },
                                { name: '📅 Время снятия', value: new Date().toLocaleString('ru-RU'), inline: true }
                            )
                            .setTimestamp();
                        await member.user.send({ embeds: [dmEmbed] });
                        console.log(`📧 Уведомление о снятии темп-бана отправлено ${member.user.username}`);
                    } catch {
                        console.log(`❌ Не удалось отправить ЛС пользователю ${member.user.username}`);
                    }
                }

                await db.removeTempBan(ban.user_id, ban.guild_id);
                console.log(`🔓 Автоматически снят темп-бан с пользователя ${member.user.username}`);
            } catch (error) {
                console.error('❌ Ошибка автоматического снятия темп-бана:', error);
            }
        }
    } catch (error) {
        console.error('❌ Ошибка проверки истекших темп-банов:', error);
    }
}

// =======================================
// Автоснятие темп-мутов
// =======================================
async function checkExpiredTempMutes() {
    try {
        const expiredMutes = await db.getExpiredTempMutes();
        const tempMuteRoleId = '1386027839211704410';

        for (const mute of expiredMutes) {
            try {
                const guild = client.guilds.cache.get(mute.guild_id);
                if (!guild) {
                    await db.removeTempMute(mute.user_id, mute.guild_id);
                    continue;
                }

                const member = await guild.members.fetch(mute.user_id).catch(() => null);
                if (!member) {
                    await db.removeTempMute(mute.user_id, mute.guild_id);
                    console.log(`🔊 Пользователь ${mute.user_id} не найден, снят из БД`);
                    continue;
                }

                const tempMuteRole = guild.roles.cache.get(tempMuteRoleId);
                if (tempMuteRole && member.roles.cache.has(tempMuteRoleId)) {
                    await member.roles.remove(tempMuteRole, 'Истек срок темп-мута');

                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setTitle('🔊 Ваш временный мут истек')
                            .setColor('#00FF00')
                            .addFields(
                                { name: '🏛️ Сервер', value: guild.name, inline: true },
                                { name: '📅 Время снятия', value: new Date().toLocaleString('ru-RU'), inline: true }
                            )
                            .setTimestamp();
                        await member.user.send({ embeds: [dmEmbed] });
                        console.log(`📧 Уведомление о снятии темп-мута отправлено ${member.user.username}`);
                    } catch {
                        console.log(`❌ Не удалось отправить ЛС пользователю ${member.user.username}`);
                    }
                }

                await db.removeTempMute(mute.user_id, mute.guild_id);
                console.log(`🔊 Автоматически снят темп-мут с пользователя ${member.user.username}`);
            } catch (error) {
                console.error('❌ Ошибка автоматического снятия темп-мута:', error);
            }
        }
    } catch (error) {
        console.error('❌ Ошибка проверки истекших темп-мутов:', error);
    }
}

// =======================================
// Сохранение голосового времени
// =======================================
async function saveVoiceTime() {
    const now = Date.now();
    for (const [userId, sessionData] of voiceSessions) {
        const timeSpent = Math.floor((now - sessionData.startTime) / 1000);
        if (timeSpent > 0) {
            try {
                await db.addVoiceTime(userId, sessionData.guildId, timeSpent);
                sessionData.startTime = now;
                console.log(`💾 Сохранено ${timeSpent} секунд голосового времени для пользователя ${userId}`);
            } catch (error) {
                console.error('Ошибка сохранения голосового времени:', error);
            }
        }
    }
}

// =======================================
// Подсчет активности сообщений
// =======================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    try {
        // ===== ФИЛЬТР ДОБРОТЫ - ПРОВЕРЯЕТСЯ ПЕРВЫМ =====
        if (global.kindnessFilter) {
            console.log(`📨 Проверяю сообщение от ${message.author.username}: "${message.content.substring(0, 50)}..."`);
            const hasViolation = await global.kindnessFilter.handleMessage(message);
            console.log(`📊 Результат проверки: ${hasViolation ? 'НАРУШЕНИЕ' : 'OK'}`);
            // НЕ ВОЗВРАЩАЕМСЯ - продолжаем обработку других обработчиков
        }

        // Профили первыми (hot-path)
        if (profileHandler) {
            try {
                const profileHandled = await profileHandler.handleMessage(message);
                if (profileHandled) {
                    console.log(`📝 Сообщение обработано как профиль от ${message.author.username}`);
                    return;
                }
            } catch (profileError) {
                console.error('Ошибка обработки профиля:', profileError);
            }
        }

        // Добавляем активность
        try {
            await db.addMessageActivity(message.author.id, message.guild.id);
        } catch (error) {
            console.error('Ошибка подсчета сообщений:', error);
        }

        // ИСПРАВЛЕНО: Убираем return, чтобы не блокировать другие обработчики
        try {
            const handled = await trainingHandler.handleTrainingPost(message);
            if (handled) {
                console.log(`🏋️ Пост тренировки обработан от ${message.author.username}`);
            }
        } catch (error) {
            console.error('Ошибка обработки поста тренировки:', error);
        }

        // Уведомления по тикетам в тредах
        if (message.channel.isThread() && !message.author.bot) {
            try {
                const ticket = await db.getTicketByChannelId(message.channel.id);
                if (ticket) {
                    await TicketNotifications.handleTicketMessage(message, ticket);
                }
            } catch (error) {
                console.error('Ошибка обработки уведомления тикета:', error);
            }
        }

        // Ручной деплой команд
        if (message.content === '!deploy' && message.author.id === config.ownerId) {
            await autoDeployCommands();
            message.reply('🚀 Команды развернуты!');
            return;
        }

        // Ввод количества для магазина
        try {
            const shopHandler = require('./interactions/shopInteraction');
            if (shopHandler.handleQuantityInput && (await shopHandler.handleQuantityInput(message))) {
                return;
            }
        } catch (error) {
            console.error('Ошибка обработки ввода магазина:', error);
        }

    } catch (error) {
        console.error('Ошибка обработки сообщения:', error);
    }
});

// =======================================
// Обработка изменения сообщений
// =======================================
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.author.bot || !newMessage.guild) return;

    try {
        if (profileHandler) {
            try {
                const profileHandled = await profileHandler.handleMessage(newMessage);
                if (profileHandled) {
                    console.log(`📝 Измененное сообщение обработано как профиль от ${newMessage.author.username}`);
                    return;
                }
            } catch (profileError) {
                console.error('Ошибка обработки измененного профиля:', profileError);
            }
        }
    } catch (error) {
        console.error('Ошибка обработки изменения сообщения:', error);
    }
});

// =======================================
// Голосовые события
// =======================================
client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;
    const guildId = newState.guild.id;
    if (newState.member.user.bot) return;

    // Присоединение
    if (!oldState.channel && newState.channel) {
        voiceSessions.set(userId, {
            startTime: Date.now(),
            guildId,
            channelId: newState.channel.id,
        });
        try {
            await db.startVoiceSession(userId, guildId, newState.channel.id);
            console.log(`🎤 ${newState.member.user.username} присоединился к голосовому каналу ${newState.channel.name}`);
        } catch (error) {
            console.error('Ошибка начала голосовой сессии:', error);
        }
    }
    // Выход
    else if (oldState.channel && !newState.channel) {
        const sessionData = voiceSessions.get(userId);
        if (sessionData) {
            const timeSpent = Math.floor((Date.now() - sessionData.startTime) / 1000);
            try {
                await db.addVoiceTime(userId, guildId, timeSpent);
                await db.endVoiceSession(userId, guildId);
                console.log(`🎤 ${newState.member.user.username} покинул голос. Время: ${timeSpent} секунд`);
            } catch (error) {
                console.error('Ошибка окончания голосовой сессии:', error);
            }
        }
        voiceSessions.delete(userId);
    }
    // Переключение
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        const sessionData = voiceSessions.get(userId);
        if (sessionData) {
            const timeSpent = Math.floor((Date.now() - sessionData.startTime) / 1000);
            try {
                await db.addVoiceTime(userId, guildId, timeSpent);
                await db.endVoiceSession(userId, guildId);
                await db.startVoiceSession(userId, guildId, newState.channel.id);
                console.log(
                    `🎤 ${newState.member.user.username} переключился с ${oldState.channel.name} на ${newState.channel.name}`
                );
            } catch (error) {
                console.error('Ошибка переключения каналов:', error);
            }
            sessionData.startTime = Date.now();
            sessionData.channelId = newState.channel.id;
        }
    }
});

// =======================================
// Единая обработка взаимодействий
// =======================================
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.replied || interaction.deferred) {
            console.log('⏭️ Взаимодействие уже обработано, пропускаем');
            return;
        }

        // Slash-команды
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`Команда ${interaction.commandName} не найдена`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('Ошибка выполнения команды:', error);
                await safeReply(interaction, {
                    content: 'Произошла ошибка при выполнении команды!',
                    flags: MessageFlags.Ephemeral,
                });
            }
            return;
        }

        // Autocomplete
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`Команда ${interaction.commandName} не найдена для автодополнения`);
                return;
            }

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error('Ошибка автодополнения:', error);
            }
            return;
        }

        // Modal submit - ИСПРАВЛЕНО
        if (interaction.isModalSubmit()) {
            // ПРОВЕРЯЕМ TRAINING HANDLER ПЕРВЫМ
            if (trainingHandler.canHandle(interaction)) {
                console.log('✅ Training handler обработает модальное окно');
                await trainingHandler.execute(interaction);
                return;
            }

            // Стандартный обработчик модальных окон
            const modalSubmitHandler = require('./interactions/modalSubmit');
            await modalSubmitHandler.execute(interaction);
            return;
        }

        // Button
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
            return;
        }

        // Select menu
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
            return;
        }
    } catch (error) {
        console.error('Критическая ошибка обработки взаимодействия:', error);
        try {
            await safeReply(interaction, {
                content: 'Произошла критическая ошибка!',
                flags: MessageFlags.Ephemeral,
            });
        } catch (replyError) {
            console.error('Не удалось отправить сообщение об ошибке:', replyError);
        }
    }
});

// =======================================
// Безопасный ответ
// =======================================
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
        console.error('Ошибка безопасного ответа:', error);
    }
}

// =======================================
// Обработка кнопок - ИСПРАВЛЕНО
// =======================================
async function handleButtonInteraction(interaction) {
    if (interaction.replied || interaction.deferred) {
        console.log('⏭️ Кнопка: взаимодействие уже обработано');
        return;
    }

    console.log(`🔘 Обработка кнопки: ${interaction.customId}`);

    if (interaction.customId.startsWith('case_again_')) {
        const userId = interaction.customId.split('_')[2];
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Это не ваша кнопка!',
                ephemeral: true
            });
        }

        // Вызываем команду снова
        const command = client.commands.get('кейс');
        if (command) {
            await command.execute(interaction);
        }
        return;
    }

    if (interaction.customId.startsWith('case_inventory_')) {
        const userId = interaction.customId.split('_')[2];
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Это не ваша кнопка!',
                ephemeral: true
            });
        }

        // Показываем инвентарь (нужно реализовать)
        await interaction.reply({
            content: '📦 **Ваш инвентарь с фруктами:**\n\n🚧 Функция в разработке...',
            ephemeral: true
        });
        return;
    }

    // ПРОВЕРЯЕМ TRAINING HANDLER ПЕРВЫМ (до любых defer/reply)
    if (trainingHandler.canHandle(interaction)) {
        console.log('✅ Training handler обработает кнопку');
        await trainingHandler.execute(interaction);
        return;
    }

    // Пагинация истории хаки
    if (interaction.customId.startsWith('haki_history_page_')) {
        const parts = interaction.customId.split('_');
        const userId = parts[3];
        const page = parseInt(parts[4]);

        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: '❌ Вы можете управлять только своей историей!',
                flags: MessageFlags.Ephemeral,
            });
        }

        const hakiHistoryHandler = require('./commands/haki-history');
        await hakiHistoryHandler.showHakiHistoryPage(interaction, userId, page);
        return;
    }

    if (interaction.customId === 'close_haki_history') {
        const closeEmbed = new EmbedBuilder()
            .setTitle('👋 История закрыта')
            .setDescription('Используйте `/хаки-история` чтобы открыть снова.')
            .setColor(0x9932cc)
            .setTimestamp();
        await interaction.update({
            embeds: [closeEmbed],
            components: [],
        });
        return;
    }

    // Прочие обработчики
    await loadSpecializedHandler(interaction, 'button');
}

// =======================================
// Обработка Select меню - ИСПРАВЛЕНО
// =======================================
async function handleSelectMenuInteraction(interaction) {
    if (interaction.replied || interaction.deferred) {
        console.log('⏭️ SelectMenu: взаимодействие уже обработано');
        return;
    }

    console.log(`📋 Обработка Select меню: ${interaction.customId}`);

    // ПРОВЕРЯЕМ TRAINING HANDLER ПЕРВЫМ (до любых defer/reply)
    if (trainingHandler.canHandle(interaction)) {
        console.log('✅ Training handler обработает Select меню');
        await trainingHandler.execute(interaction);
        return;
    }

    // Выбор круток хаки
    if (interaction.customId.startsWith('haki_spin_select_')) {
        const userId = interaction.customId.split('_')[3];
        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: '❌ Вы можете крутить только свои крутки!',
                flags: MessageFlags.Ephemeral,
            });
        }

        const spinsCount = parseInt(interaction.values[0]);
        const hakiHandler = require('./commands/haki');
        await hakiHandler.handleHakiSpinExecution(interaction, spinsCount);
        return;
    }

    // Прочие обработчики
    await loadSpecializedHandler(interaction, 'select');
}

// =======================================
// Динамическая загрузка интеракшн-хендлеров
// =======================================
async function loadSpecializedHandler(interaction, type) {
    const interactionsPath = path.join(__dirname, 'interactions');
    if (!fs.existsSync(interactionsPath)) {
        console.log('⚠️ Папка interactions не найдена');
        return;
    }

    const handlerFiles = fs.readdirSync(interactionsPath).filter((f) => f.endsWith('.js'));
    let handlerFound = false;

    for (const file of handlerFiles) {
        if (file === 'trainingInteraction.js') continue; // Уже проверили

        try {
            const handlerPath = path.join(interactionsPath, file);
            delete require.cache[require.resolve(handlerPath)];
            const handler = require(handlerPath);

            if (handler.canHandle && handler.canHandle(interaction)) {
                console.log(`✅ Обработчик найден: ${file}`);
                await handler.execute(interaction);
                handlerFound = true;
                break;
            }
        } catch (handlerError) {
            console.error(`❌ Ошибка в обработчике ${file}:`, handlerError);
        }
    }

    if (!handlerFound) {
        console.log(`⚠️ Обработчик не найден для: ${interaction.customId || interaction.type}`);
    }
}

// =======================================
// Отлов ошибок процесса
// =======================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Необработанная ошибка Promise:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});

// =======================================
// Корректное завершение
// =======================================
process.on('SIGINT', async () => {
    console.log('🛑 SIGINT, завершаем работу...');
    await saveVoiceTime();

    if (db && db.db) {
        db.db.close((err) => {
            if (err) {
                console.error('Ошибка закрытия базы данных:', err);
            } else {
                console.log('✅ База данных закрыта');
            }
        });
    }

    client.destroy();
    console.log('✅ Бот отключен');
    process.exit(0);
});

// =======================================
// Экспорт и логин
// =======================================
module.exports = { profileHandler };

client.login(config.token).catch((error) => {
    console.error('❌ Ошибка входа в Discord:', error);
    process.exit(1);
});
