const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const Database = require('../database');

const db = new Database();

// Определяем группы ролей и их права доступа
const ROLE_GROUPS = {
    RP_ROLES: {
        name: 'РП Роли',
        emoji: '🎭',
        roles: [
            '1382009783263039498',
            '1382000040977109003',
            '1382018825196666891',
            '1382023950258671616',
            '1382006388636778548'
        ],
        requiredRole: '1382006705860382763'
    },
    CURATOR: {
        name: 'Куратор',
        emoji: '👑',
        roles: [
            '1382006705860382763',
            '1382005661369368586',
            '1382009784315809923'
        ],
        requiredRole: '1382006799028322324'
    },
    ANALYST: {
        name: 'Аналитик',
        emoji: '📊',
        roles: [
            '1382006705860382763',
            '1382005661369368586',
            '1382014660332748840'
        ],
        requiredRole: '1382006799028322324'
    },
    EDITOR: {
        name: 'Эдитор',
        emoji: '✏️',
        roles: [
            '1382005661369368586',
            '1382006705860382763',
            '1382009786085671035'
        ],
        requiredRole: '1382006799028322324'
    }
};

const OWNER_ID = '416602253160480769';
const LOG_CHANNEL_ID = '1381454654440865934';

module.exports = {
    name: 'roleInteraction',

    canHandle(interaction) {
        // Проверяем, может ли этот обработчик обработать взаимодействие
        const customId = interaction.customId;
        
        if (!customId) return false;
        
        // Обрабатываем только взаимодействия, связанные с ролями
        return customId.startsWith('role_group_select_') ||
               customId.startsWith('role_manage_') ||
               customId.startsWith('role_back_to_groups_') ||
               customId.startsWith('role_cancel_');
    },

    async execute(interaction) {
        try {
            console.log(`🎭 [ROLE HANDLER] Обработка: ${interaction.customId}`);

            // Обработка выбора группы ролей (только StringSelectMenu)
            if (interaction.customId.startsWith('role_group_select_')) {
                if (interaction.isStringSelectMenu()) {
                    await this.handleGroupSelect(interaction);
                } else {
                    console.log(`❌ [ROLE HANDLER] Неверный тип для role_group_select: ${interaction.constructor.name}`);
                }
                return;
            }

            // Обработка управления конкретными ролями (только StringSelectMenu)
            if (interaction.customId.startsWith('role_manage_')) {
                if (interaction.isStringSelectMenu()) {
                    await this.handleRoleManage(interaction);
                } else {
                    console.log(`❌ [ROLE HANDLER] Неверный тип для role_manage: ${interaction.constructor.name}`);
                }
                return;
            }

            // Обработка возврата к группам (только Button)
            if (interaction.customId.startsWith('role_back_to_groups_')) {
                if (interaction.isButton()) {
                    await this.handleBackToGroups(interaction);
                } else {
                    console.log(`❌ [ROLE HANDLER] Неверный тип для role_back_to_groups: ${interaction.constructor.name}`);
                }
                return;
            }

            // Обработка отмены (только Button)
            if (interaction.customId.startsWith('role_cancel_')) {
                if (interaction.isButton()) {
                    await this.handleCancel(interaction);
                } else {
                    console.log(`❌ [ROLE HANDLER] Неверный тип для role_cancel: ${interaction.constructor.name}`);
                }
                return;
            }

            console.log(`❌ [ROLE HANDLER] Неизвестное взаимодействие: ${interaction.customId}`);
        } catch (error) {
            console.error('❌ [ROLE HANDLER] Ошибка:', error);
            const errorMessage = '❌ Произошла ошибка при управлении ролями!';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
            }
        }
    },

    // =============================
    // ОБРАБОТКА ВЫБОРА ГРУППЫ РОЛЕЙ
    // =============================
    async handleGroupSelect(interaction) {
        console.log(`🔄 [ROLE HANDLER] Обработка выбора группы: ${interaction.customId}`);
        
        // ДОБАВЛЯЕМ ПРОВЕРКУ ТИПА ВЗАИМОДЕЙСТВИЯ
        if (!interaction.isStringSelectMenu()) {
            console.log(`❌ [ROLE HANDLER] Неверный тип взаимодействия для handleGroupSelect: ${interaction.type}`);
            return;
        }
        
        // ПРОВЕРЯЕМ НАЛИЧИЕ VALUES
        if (!interaction.values || interaction.values.length === 0) {
            console.log(`❌ [ROLE HANDLER] Отсутствуют values в select menu`);
            return await this.safeReply(interaction, {
                content: '❌ Не выбрана группа ролей!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // ИСПРАВЛЕННЫЙ ПАРСИНГ
        const parts = interaction.customId.split('_');
        const targetUserId = parts[parts.length - 2];
        const adminUserId = parts[parts.length - 1];

        console.log(`🔍 [ROLE HANDLER] Group Select Debug:
- customId: ${interaction.customId}
- parts: [${parts.join(', ')}]
- targetUserId: ${targetUserId}
- adminUserId: ${adminUserId}
- values: [${interaction.values.join(', ')}]`);

        // Проверяем права
        if (interaction.user.id !== adminUserId) {
            console.log(`❌ [ROLE HANDLER] Проверка прав не пройдена: ${interaction.user.id} !== ${adminUserId}`);
            return await this.safeReply(interaction, {
                content: '❌ Только тот, кто вызвал команду, может управлять ролями!',
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedGroup = interaction.values[0];
        const group = ROLE_GROUPS[selectedGroup];
        if (!group) {
            return await this.safeReply(interaction, {
                content: '❌ Выбранная группа ролей не найдена!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Проверяем права доступа к группе
        const isOwner = interaction.user.id === OWNER_ID;
        const hasRequiredRole = interaction.member.roles.cache.has(group.requiredRole);
        if (!isOwner && !hasRequiredRole) {
            return await this.safeReply(interaction, {
                content: `❌ У вас нет прав для управления группой "${group.name}"!\n🔑 Требуется роль: <@&${group.requiredRole}>`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Получаем целевого пользователя
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUserId);
        } catch (error) {
            return await this.safeReply(interaction, {
                content: '❌ Целевой пользователь не найден на сервере!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Создаем embed для управления ролями в группе
        const embed = new EmbedBuilder()
            .setTitle(`${group.emoji} Управление группой: ${group.name}`)
            .setDescription(`**Пользователь:** ${targetMember.user}\n**Выберите роли для добавления или удаления:**`)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
            .setColor('#9932CC')
            .setTimestamp()
            .setFooter({
                text: `Управляет: ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        // Создаем меню с ролями
        const roleSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`role_manage_${selectedGroup}_${targetUserId}_${adminUserId}`)
            .setPlaceholder('Выберите роли для управления...')
            .setMinValues(1)
            .setMaxValues(Math.min(group.roles.length, 25)); // Discord лимит

        // Добавляем роли в меню
        let addedRoles = 0;
        for (const roleId of group.roles) {
            const role = interaction.guild.roles.cache.get(roleId);
            if (role) {
                const hasRole = targetMember.roles.cache.has(roleId);
                roleSelectMenu.addOptions({
                    label: role.name,
                    value: roleId,
                    description: hasRole ? '✅ Роль у пользователя есть (нажмите для удаления)' : '❌ Роли у пользователя нет (нажмите для добавления)',
                    emoji: hasRole ? '➖' : '➕'
                });
                addedRoles++;
            }
        }

        if (addedRoles === 0) {
            return await this.safeReply(interaction, {
                content: `❌ В группе "${group.name}" не найдено ни одной действительной роли!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Показываем текущие роли из этой группы
        const currentGroupRoles = group.roles
            .filter(roleId => targetMember.roles.cache.has(roleId))
            .map(roleId => interaction.guild.roles.cache.get(roleId))
            .filter(role => role)
            .map(role => role.toString());

        if (currentGroupRoles.length > 0) {
            embed.addFields({
                name: `📋 Текущие роли из группы "${group.name}"`,
                value: currentGroupRoles.join(', '),
                inline: false
            });
        } else {
            embed.addFields({
                name: `📋 Текущие роли из группы "${group.name}"`,
                value: '*Нет ролей из этой группы*',
                inline: false
            });
        }

        // Добавляем информацию о доступе
        embed.addFields({
            name: '🔑 Информация о доступе',
            value: `Группа: **${group.name}**\nТребуется роль: <@&${group.requiredRole}>\nРолей в группе: **${addedRoles}**`,
            inline: false
        });

        const row = new ActionRowBuilder().addComponents(roleSelectMenu);

        // Кнопки навигации
        const backButton = new ButtonBuilder()
            .setCustomId(`role_back_to_groups_${targetUserId}_${adminUserId}`)
            .setLabel('⬅️ Назад к группам')
            .setStyle(ButtonStyle.Secondary);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`role_cancel_${adminUserId}`)
            .setLabel('❌ Отмена')
            .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder().addComponents(backButton, cancelButton);

        await interaction.update({
            embeds: [embed],
            components: [row, buttonRow]
        });
    },

    // =============================
    // ОБРАБОТКА УПРАВЛЕНИЯ РОЛЯМИ
    // =============================
    async handleRoleManage(interaction) {
        console.log(`🔄 [ROLE HANDLER] Обработка управления ролями: ${interaction.customId}`);
        
        // ИСПРАВЛЕННЫЙ ПАРСИНГ
        const parts = interaction.customId.split('_');
        const groupKey = parts.slice(2, -2).join('_'); // RP_ROLES
        const targetUserId = parts[parts.length - 2];  // 416602253160480769
        const adminUserId = parts[parts.length - 1];   // 416602253160480769

        console.log(`🔍 [ROLE HANDLER] Role Manage Debug:
- customId: ${interaction.customId}
- parts: [${parts.join(', ')}]
- groupKey: "${groupKey}"
- targetUserId: "${targetUserId}"
- adminUserId: "${adminUserId}"`);

        if (interaction.user.id !== adminUserId) {
            console.log(`❌ [ROLE HANDLER] Проверка прав не пройдена: ${interaction.user.id} !== ${adminUserId}`);
            return await this.safeReply(interaction, {
                content: '❌ Только тот, кто вызвал команду, может управлять ролями!',
                flags: MessageFlags.Ephemeral
            });
        }

        console.log(`✅ [ROLE HANDLER] Проверка прав пройдена: ${interaction.user.id} === ${adminUserId}`);

        const selectedRoleIds = interaction.values;
        const group = ROLE_GROUPS[groupKey];

        if (!group) {
            console.log(`❌ [ROLE HANDLER] Группа ролей не найдена: "${groupKey}"`);
            console.log(`🔍 [ROLE HANDLER] Доступные группы: ${Object.keys(ROLE_GROUPS).join(', ')}`);
            return await this.safeReply(interaction, {
                content: '❌ Группа ролей не найдена!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Получаем целевого пользователя
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(targetUserId);
        } catch (error) {
            return await this.safeReply(interaction, {
                content: '❌ Целевой пользователь не найден на сервере!',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferUpdate();

        const results = [];
        const addedRoles = [];
        const removedRoles = [];

        // Обрабатываем каждую выбранную роль
        for (const roleId of selectedRoleIds) {
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                results.push(`❌ Роль с ID ${roleId} не найдена`);
                continue;
            }

            const hasRole = targetMember.roles.cache.has(roleId);

            try {
                if (hasRole) {
                    // Удаляем роль
                    await targetMember.roles.remove(roleId, `Управление ролями: ${interaction.user.username} (группа: ${group.name})`);
                    results.push(`➖ Удалена роль: **${role.name}**`);
                    removedRoles.push(role.name);
                } else {
                    // Добавляем роль
                    await targetMember.roles.add(roleId, `Управление ролями: ${interaction.user.username} (группа: ${group.name})`);
                    results.push(`➕ Добавлена роль: **${role.name}**`);
                    addedRoles.push(role.name);
                }
            } catch (error) {
                console.error(`❌ [ROLE HANDLER] Ошибка управления ролью ${role.name}:`, error);
                results.push(`❌ Ошибка с ролью: **${role.name}** - ${error.message}`);
            }
        }

        // Создаем embed с результатами
        const resultEmbed = new EmbedBuilder()
            .setTitle('✅ Управление ролями завершено')
            .setDescription(`**Пользователь:** ${targetMember.user}\n**Группа:** ${group.emoji} ${group.name}`)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({
                text: `Управлял: ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        if (results.length > 0) {
            // Разбиваем результаты на блоки, если слишком много
            const resultText = results.join('\n');
            if (resultText.length <= 1024) {
                resultEmbed.addFields({
                    name: '📝 Результаты',
                    value: resultText,
                    inline: false
                });
            } else {
                // Если результатов слишком много, показываем сводку
                resultEmbed.addFields(
                    {
                        name: '➕ Добавлено ролей',
                        value: addedRoles.length > 0 ? addedRoles.join(', ') : 'Нет',
                        inline: true
                    },
                    {
                        name: '➖ Удалено ролей',
                        value: removedRoles.length > 0 ? removedRoles.join(', ') : 'Нет',
                        inline: true
                    },
                    {
                        name: '📊 Статистика',
                        value: `Всего изменений: ${addedRoles.length + removedRoles.length}`,
                        inline: true
                    }
                );
            }
        } else {
            resultEmbed.addFields({
                name: '📝 Результаты',
                value: 'Нет изменений',
                inline: false
            });
        }

        // Отправляем лог в канал
        if (results.length > 0) {
            await this.sendRoleLog(interaction.client, {
                administrator: interaction.user,
                targetUser: targetMember.user,
                targetMember: targetMember,
                group: group,
                addedRoles: addedRoles,
                removedRoles: removedRoles,
                guildName: interaction.guild.name
            });
        }


        await interaction.editReply({
            embeds: [resultEmbed],
        });
    },

    // =============================
    // ОБРАБОТКА ВОЗВРАТА К ГРУППАМ
    // =============================
    async handleBackToGroups(interaction) {
        console.log(`🔄 [ROLE HANDLER] Возврат к выбору групп: ${interaction.customId}`);
        
        // ИСПРАВЛЕННЫЙ ПАРСИНГ
        const parts = interaction.customId.split('_');
        const targetUserId = parts[parts.length - 2];
        const adminUserId = parts[parts.length - 1];

        // Проверяем права
        if (interaction.user.id !== adminUserId) {
            return await this.safeReply(interaction, {
                content: '❌ Только тот, кто вызвал команду, может управлять ролями!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Получаем целевого пользователя
        let targetUser;
        try {
            const targetMember = await interaction.guild.members.fetch(targetUserId);
            targetUser = targetMember.user;
        } catch (error) {
            return await this.safeReply(interaction, {
                content: '❌ Целевой пользователь не найден на сервере!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Определяем доступные группы ролей для пользователя
        const isOwner = interaction.user.id === OWNER_ID;
        const hasHighRole = interaction.member.roles.cache.has('1382006799028322324');
        const hasRPRole = interaction.member.roles.cache.has('1382006705860382763');

        let availableGroups = [];
        if (isOwner || hasHighRole) {
            // Полный доступ ко всем группам
            availableGroups = Object.keys(ROLE_GROUPS);
        } else if (hasRPRole) {
            // Доступ только к РП ролям
            availableGroups = ['RP_ROLES'];
        }

        if (availableGroups.length === 0) {
            return await this.safeReply(interaction, {
                content: '❌ У вас нет доступа ни к одной группе ролей!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Создаем embed с информацией о пользователе
        const embed = new EmbedBuilder()
            .setTitle('🎭 Управление ролями')
            .setDescription(`**Пользователь:** ${targetUser}\n**Выберите группу ролей для управления:**`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setColor('#9932CC')
            .setTimestamp()
            .setFooter({
                text: `Управляет: ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        // Создаем меню выбора группы ролей
        const groupSelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`role_group_select_${targetUserId}_${adminUserId}`)
            .setPlaceholder('Выберите группу ролей...')
            .setMinValues(1)
            .setMaxValues(1);

        // Добавляем опции для доступных групп
        for (const groupKey of availableGroups) {
            const group = ROLE_GROUPS[groupKey];
            const roleNames = await this.getRoleNames(interaction.guild, group.roles);
            groupSelectMenu.addOptions({
                label: group.name,
                value: groupKey,
                description: `Управление: ${roleNames.slice(0, 3).join(', ')}${roleNames.length > 3 ? '...' : ''}`,
                emoji: group.emoji
            });
        }

        const row = new ActionRowBuilder().addComponents(groupSelectMenu);

        // Добавляем кнопку отмены
        const cancelButton = new ButtonBuilder()
            .setCustomId(`role_cancel_${adminUserId}`)
            .setLabel('❌ Отмена')
            .setStyle(ButtonStyle.Secondary);

        const buttonRow = new ActionRowBuilder().addComponents(cancelButton);

        await interaction.update({
            embeds: [embed],
            components: [row, buttonRow]
        });
    },

    // =============================
    // ОБРАБОТКА ОТМЕНЫ
    // =============================
    async handleCancel(interaction) {
        console.log(`❌ [ROLE HANDLER] Отмена: ${interaction.customId}`);
        const adminUserId = interaction.customId.split('_')[2];

        if (interaction.user.id !== adminUserId) {
            return await this.safeReply(interaction, {
                content: '❌ Только тот, кто вызвал команду, может её отменить!',
                flags: MessageFlags.Ephemeral
            });
        }

        const cancelEmbed = new EmbedBuilder()
            .setTitle('❌ Управление ролями отменено')
            .setDescription('Команда была отменена пользователем.')
            .setColor('#FF0000')
            .setTimestamp()
            .setFooter({
                text: `Отменил: ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        await interaction.update({
            embeds: [cancelEmbed],
            components: []
        });
    },

    // =============================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // =============================

    // Безопасный ответ на взаимодействие
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
            console.error('❌ [ROLE HANDLER] Ошибка безопасного ответа:', error);
            return null;
        }
    },

    // Отправка лога в канал
    async sendRoleLog(client, logData) {
        try {
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) {
                console.log('⚠️ [ROLE HANDLER] Лог-канал не найден');
                return;
            }

            const logEmbed = new EmbedBuilder()
                .setTitle('🎭 Управление ролями')
                .setColor('#9932CC')
                .setTimestamp()
                .setFooter({ text: `ID пользователя: ${logData.targetUser.id}` });

            // Основная информация
            logEmbed.addFields(
                { name: '👤 Пользователь', value: `<@${logData.targetUser.id}> (${logData.targetUser.username})`, inline: true },
                { name: '👨‍💼 Администратор', value: `<@${logData.administrator.id}>`, inline: true },
                { name: '📋 Группа ролей', value: `${logData.group.emoji} ${logData.group.name}`, inline: true }
            );

            // Изменения
            if (logData.addedRoles.length > 0) {
                logEmbed.addFields({
                    name: '➕ Добавленные роли',
                    value: logData.addedRoles.join(', '),
                    inline: false
                });
            }

            if (logData.removedRoles.length > 0) {
                logEmbed.addFields({
                    name: '➖ Удаленные роли',
                    value: logData.removedRoles.join(', '),
                    inline: false
                });
            }

            // Статистика
            logEmbed.addFields({
                name: '📊 Статистика',
                value: `Добавлено: **${logData.addedRoles.length}** | Удалено: **${logData.removedRoles.length}** | Всего: **${logData.addedRoles.length + logData.removedRoles.length}**`,
                inline: false
            });

            await logChannel.send({ embeds: [logEmbed] });
            console.log(`📝 [ROLE HANDLER] Лог отправлен для ${logData.targetUser.username}`);
        } catch (error) {
            console.error('❌ [ROLE HANDLER] Ошибка отправки лога:', error);
        }
    },

    // Получение названий ролей по ID
    async getRoleNames(guild, roleIds) {
        const names = [];
        for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                names.push(role.name);
            } else {
                names.push(`Неизвестная роль (${roleId})`);
            }
        }
        return names;
    }
};
