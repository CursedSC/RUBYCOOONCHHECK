const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Database = require('../../database.js');
const db = new Database();

// Конфигурация ролей
const PUNISHMENT_ROLES = {
    // Базовая роль (выдаётся при любом наказании)
    BASE_VIOLATION: '1437355256723013662', // Роль "Нарушения"
    
    // Выговоры
    WARNING_1: '1401959483189497967', // 1 Выговор
    WARNING_2: '1401959663070609419', // 2 Выговора
    
    // ЧСП
    BLACKLIST_POST_1: '1437351105347457118', // ЧСП 1 LVL
    BLACKLIST_POST_2: '1437351215733276672', // ЧСП 2 LVL
    
    // ЧС Админки
    BLACKLIST_ADMIN_TEMP: '1401959473358307418', // ЧС Админки (временный)
    BLACKLIST_ADMIN_PERM: '1401959481146998864', // ЧС Админки (навсегда)
    
    // ЧС Анкет
    BLACKLIST_FORMS: '1437355421626011679' // ЧС Анкет
};

// Каналы для логов
const LOG_CHANNELS = {
    WARNINGS: '1234567890123456789', // Канал для выговоров/предупреждений - ЗАМЕНИТЕ
    BLACKLIST: '1234567890123456789'  // Канал для ЧСП/ЧС - ЗАМЕНИТЕ
};

// Роли с доступом к командам ЧСП/ЧС
const ADMIN_ROLES = ['1382006178451685377', '1381454973576941568'];

// Длительности
const DURATIONS = {
    WARNING_1: 10 * 24 * 60 * 60 * 1000, // 10 дней
    WARNING_2: 20 * 24 * 60 * 60 * 1000, // 20 дней (пример)
    BLACKLIST_FORMS: 60 * 24 * 60 * 60 * 1000, // 2 месяца
    BLACKLIST_ADMIN_TEMP: 30 * 24 * 60 * 60 * 1000 // 30 дней
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('наказание')
        .setDescription('Система выдачи наказаний')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName('пользователь')
                .setDescription('Кому выдать/снять наказание')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('мера')
                .setDescription('Мера наказания')
                .setRequired(true)
                .addChoices(
                    { name: '⚠️ 1 Выговор', value: 'warning_1' },
                    { name: '❗ 2 Выговора', value: 'warning_2' },
                    { name: '🚫 ЧСП [ 1 LVL ]', value: 'blacklist_post_1' },
                    { name: '🚫 ЧСП [ 2 LVL ]', value: 'blacklist_post_2' },
                    { name: '🔒 ЧС Админки (временный)', value: 'blacklist_admin_temp' },
                    { name: '🔒 ЧС Админки (навсегда)', value: 'blacklist_admin_perm' },
                    { name: '📋 ЧС Анкет', value: 'blacklist_forms' },
                    { name: '✅ Снятие наказания', value: 'remove' }
                )
        )
        .addStringOption(option =>
            option
                .setName('причина')
                .setDescription('Причина выдачи/снятия наказания')
                .setRequired(true)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('пользователь');
        const measure = interaction.options.getString('мера');
        const reason = interaction.options.getString('причина');
        const moderator = interaction.user;

        // Проверка прав для специальных команд (ЧСП, ЧС Админки)
        const isBlacklistAction = ['blacklist_post_1', 'blacklist_post_2', 'blacklist_admin_temp', 'blacklist_admin_perm', 'blacklist_forms'].includes(measure);
        
        if (isBlacklistAction) {
            const hasAccess = ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
            if (!hasAccess) {
                return await interaction.reply({
                    content: '❌ У вас нет прав для использования этой меры наказания!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            if (measure === 'remove') {
                await handleRemovePunishment(interaction, targetUser, moderator, reason);
            } else {
                await handleAddPunishment(interaction, targetUser, moderator, measure, reason);
            }
        } catch (error) {
            console.error('[Punishment Command]', error);
            await interaction.editReply({
                content: '❌ Произошла ошибка при выполнении команды!'
            }).catch(() => {});
        }
    }
};

// === ВЫДАЧА НАКАЗАНИЯ ===
async function handleAddPunishment(interaction, targetUser, moderator, measure, reason) {
    const guild = interaction.guild;
    const targetMember = await guild.members.fetch(targetUser.id);

    let roleId, roleName, duration, logChannel, embedColor, embedIcon;

    // Определяем параметры в зависимости от меры
    switch (measure) {
        case 'warning_1':
            roleId = PUNISHMENT_ROLES.WARNING_1;
            roleName = '1 Выговор';
            duration = DURATIONS.WARNING_1;
            logChannel = LOG_CHANNELS.WARNINGS;
            embedColor = '#FFA500';
            embedIcon = '⚠️';
            break;
        
        case 'warning_2':
            roleId = PUNISHMENT_ROLES.WARNING_2;
            roleName = '2 Выговора';
            duration = DURATIONS.WARNING_2;
            logChannel = LOG_CHANNELS.WARNINGS;
            embedColor = '#FF0000';
            embedIcon = '❗';
            break;
        
        case 'blacklist_post_1':
            roleId = PUNISHMENT_ROLES.BLACKLIST_POST_1;
            roleName = 'ЧСП [ 1 LVL ]';
            duration = null; // Без автоснятия
            logChannel = LOG_CHANNELS.BLACKLIST;
            embedColor = '#000000';
            embedIcon = '🚫';
            break;
        
        case 'blacklist_post_2':
            roleId = PUNISHMENT_ROLES.BLACKLIST_POST_2;
            roleName = 'ЧСП [ 2 LVL ]';
            duration = null;
            logChannel = LOG_CHANNELS.BLACKLIST;
            embedColor = '#000000';
            embedIcon = '🚫';
            break;
        
        case 'blacklist_admin_temp':
            roleId = PUNISHMENT_ROLES.BLACKLIST_ADMIN_TEMP;
            roleName = 'ЧС Админки (временный)';
            duration = DURATIONS.BLACKLIST_ADMIN_TEMP;
            logChannel = LOG_CHANNELS.BLACKLIST;
            embedColor = '#8B0000';
            embedIcon = '🔒';
            break;
        
        case 'blacklist_admin_perm':
            roleId = PUNISHMENT_ROLES.BLACKLIST_ADMIN_PERM;
            roleName = 'ЧС Админки (навсегда)';
            duration = null;
            logChannel = LOG_CHANNELS.BLACKLIST;
            embedColor = '#8B0000';
            embedIcon = '🔒';
            break;
        
        case 'blacklist_forms':
            roleId = PUNISHMENT_ROLES.BLACKLIST_FORMS;
            roleName = 'ЧС Анкет';
            duration = DURATIONS.BLACKLIST_FORMS;
            logChannel = LOG_CHANNELS.BLACKLIST;
            embedColor = '#FF6600';
            embedIcon = '📋';
            break;
        
        default:
            return await interaction.editReply({ content: '❌ Неизвестная мера наказания!' });
    }

    // Получаем роли
    const punishmentRole = guild.roles.cache.get(roleId);
    const baseRole = guild.roles.cache.get(PUNISHMENT_ROLES.BASE_VIOLATION);

    if (!punishmentRole) {
        return await interaction.editReply({
            content: `❌ Роль "${roleName}" не найдена на сервере!`
        });
    }

    // Выдаём базовую роль "Нарушения" (если ещё нет)
    if (baseRole && !targetMember.roles.cache.has(PUNISHMENT_ROLES.BASE_VIOLATION)) {
        await targetMember.roles.add(baseRole, `Базовая роль нарушений от ${moderator.tag}`);
    }

    // Выдаём роль наказания
    if (!targetMember.roles.cache.has(roleId)) {
        await targetMember.roles.add(punishmentRole, `${roleName} от ${moderator.tag}: ${reason}`);
    } else {
        return await interaction.editReply({
            content: `⚠️ У пользователя ${targetUser} уже есть роль "${roleName}"!`
        });
    }

    // Сохраняем в БД
    const expiresAt = duration ? new Date(Date.now() + duration) : null;
    await db.addPunishment({
        userId: targetUser.id,
        guildId: guild.id,
        moderatorId: moderator.id,
        type: measure,
        roleId: roleId,
        reason: reason,
        expiresAt: expiresAt
    });

    // Отправляем в канал логов
    await sendPunishmentLog(guild, logChannel, targetUser, moderator, roleName, reason, expiresAt, embedColor, embedIcon, 'add');

    // Отправляем ЛС пользователю
    await sendDM(targetUser, guild, moderator, roleName, reason, expiresAt, embedColor, embedIcon, 'add');

    // Ответ модератору
    let response = `${embedIcon} **${roleName}** успешно выдана ${targetUser}!\n\n**Причина:** ${reason}`;
    if (duration) {
        response += `\n⏰ **Автоснятие:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;
    } else {
        response += `\n⏰ **Автоснятие:** Нет`;
    }

    await interaction.editReply({ content: response });
}

// === СНЯТИЕ НАКАЗАНИЯ ===
async function handleRemovePunishment(interaction, targetUser, moderator, reason) {
    const guild = interaction.guild;
    const targetMember = await guild.members.fetch(targetUser.id);

    // Получаем все наказания пользователя из БД
    const userPunishments = await db.getActivePunishments(targetUser.id, guild.id);

    if (!userPunishments || userPunishments.length === 0) {
        return await interaction.editReply({
            content: `⚠️ У пользователя ${targetUser} нет активных наказаний!`
        });
    }

    let removedRoles = [];

    // Удаляем все роли наказаний
    for (const punishment of userPunishments) {
        const role = guild.roles.cache.get(punishment.roleid);
        if (role && targetMember.roles.cache.has(punishment.roleid)) {
            await targetMember.roles.remove(role, `Снятие наказания модератором ${moderator.tag}: ${reason}`);
            removedRoles.push(role.name);
        }
        
        // Помечаем в БД как снятое
        await db.removePunishment(punishment.id);
    }

    // Удаляем базовую роль "Нарушения"
    const baseRole = guild.roles.cache.get(PUNISHMENT_ROLES.BASE_VIOLATION);
    if (baseRole && targetMember.roles.cache.has(PUNISHMENT_ROLES.BASE_VIOLATION)) {
        await targetMember.roles.remove(baseRole, `Снятие всех наказаний модератором ${moderator.tag}`);
    }

    // Логируем снятие
    await sendRemovalLog(guild, targetUser, moderator, removedRoles, reason);

    // ЛС пользователю
    await sendDM(targetUser, guild, moderator, removedRoles.join(', '), reason, null, '#00FF00', '✅', 'remove');

    // Ответ модератору
    await interaction.editReply({
        content: `✅ **Все наказания** успешно сняты с ${targetUser}!\n\n` +
                 `**Снятые роли:** ${removedRoles.join(', ')}\n` +
                 `**Причина:** ${reason}`
    });
}

// === ЛОГИРОВАНИЕ ВЫДАЧИ ===
async function sendPunishmentLog(guild, channelId, targetUser, moderator, roleName, reason, expiresAt, color, icon, action) {
    try {
        const logChannel = guild.channels.cache.get(channelId);
        if (!logChannel) return;

        let description = 
            `**Пользователь:** ${targetUser} (${targetUser.tag})\n` +
            `**Модератор:** ${moderator} (${moderator.tag})\n` +
            `**Мера:** ${roleName}\n` +
            `**Причина:** ${reason}\n\n` +
            `📅 **Дата:** <t:${Math.floor(Date.now() / 1000)}:F>`;

        if (expiresAt) {
            description += `\n⏰ **Истекает:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`${icon} Выдано наказание: ${roleName}`)
            .setDescription(description)
            .setColor(color)
            .setTimestamp()
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[sendPunishmentLog]', error);
    }
}

// === ЛОГИРОВАНИЕ СНЯТИЯ ===
async function sendRemovalLog(guild, targetUser, moderator, removedRoles, reason) {
    try {
        const logChannel = guild.channels.cache.get(LOG_CHANNELS.WARNINGS);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('✅ Снято наказание')
            .setDescription(
                `**Пользователь:** ${targetUser} (${targetUser.tag})\n` +
                `**Модератор:** ${moderator} (${moderator.tag})\n` +
                `**Снятые роли:** ${removedRoles.join(', ')}\n` +
                `**Причина:** ${reason}\n\n` +
                `📅 **Дата:** <t:${Math.floor(Date.now() / 1000)}:F>`
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[sendRemovalLog]', error);
    }
}

// === ОТПРАВКА ЛС ===
async function sendDM(targetUser, guild, moderator, roleName, reason, expiresAt, color, icon, action) {
    try {
        let title, description;

        if (action === 'add') {
            title = `${icon} Вам выдано наказание: ${roleName}`;
            description = 
                `**Сервер:** ${guild.name}\n` +
                `**Модератор:** ${moderator.tag}\n` +
                `**Причина:** ${reason}\n\n` +
                `📅 **Дата:** <t:${Math.floor(Date.now() / 1000)}:F>`;

            if (expiresAt) {
                description += `\n⏰ **Истекает:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;
            }
        } else {
            title = '✅ Наказание снято';
            description = 
                `**Сервер:** ${guild.name}\n` +
                `**Модератор:** ${moderator.tag}\n` +
                `**Снятые роли:** ${roleName}\n` +
                `**Причина:** ${reason}\n\n` +
                `📅 **Дата:** <t:${Math.floor(Date.now() / 1000)}:F>`;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        await targetUser.send({ embeds: [embed] });
    } catch (error) {
        console.log(`[DM] Не удалось отправить ЛС пользователю ${targetUser.tag}`);
    }
}
