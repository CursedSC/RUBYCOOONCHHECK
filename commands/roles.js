const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');

// Определяем роли и их группы
const ROLE_GROUPS = {
    RP_ROLES: {
        name: 'РП Роли',
        roles: [
            '1382009783263039498',
            '1382000040977109003', 
            '1382018825196666891',
            '1382023950258671616',
            '1382006388636778548'
        ],
        requiredRole: '1382005661369368586'
    },
    CURATOR: {
        name: 'Куратор',
        roles: [
            '1382006705860382763',
            '1382005661369368586',
            '1382009784315809923'
        ],
        requiredRole: '1382006799028322324'
    },
    ANALYST: {
        name: 'Аналитик',
        roles: [
            '1382006705860382763',
            '1382005661369368586',
            '1382014660332748840'
        ],
        requiredRole: '1382006799028322324'
    },
    EDITOR: {
        name: 'Эдитор',
        roles: [
            '1382005661369368586',
            '1382006705860382763',
            '1382009786085671035'
        ],
        requiredRole: '1382006799028322324'
    }
};

const OWNER_ID = '416602253160480769';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('роли')
        .setDescription('Управление ролями пользователей')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Выберите пользователя')
                .setRequired(true)),

    async execute(interaction) {
        try {
            // Проверка прав доступа ТОЛЬКО для исполнителя команды
            const isOwner = interaction.user.id === OWNER_ID;
            const hasHighRole = interaction.member.roles.cache.has('1382006799028322324');
            const hasRPRole = interaction.member.roles.cache.has('1382006705860382763');

            if (!isOwner && !hasHighRole && !hasRPRole) {
                return await interaction.reply({
                    content: '❌ У вас нет прав для использования этой команды!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetUser = interaction.options.getUser('пользователь');
            
            // Получаем участника сервера (без проверки его ролей)
            let targetMember;
            try {
                targetMember = await interaction.guild.members.fetch(targetUser.id);
            } catch (error) {
                return await interaction.reply({
                    content: '❌ Пользователь не найден на сервере!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Определяем доступные группы ролей ТОЛЬКО на основе ролей исполнителя
            let availableGroups = [];
            
            if (isOwner || hasHighRole) {
                // Полный доступ ко всем группам
                availableGroups = Object.keys(ROLE_GROUPS);
            } else if (hasRPRole) {
                // Доступ только к РП ролям
                availableGroups = ['RP_ROLES'];
            }

            if (availableGroups.length === 0) {
                return await interaction.reply({
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

            // Добавляем информацию о текущих ролях пользователя
            const currentRoles = targetMember.roles.cache
                .filter(role => role.id !== interaction.guild.id) // Исключаем @everyone
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, 10); // Ограничиваем количество

            if (currentRoles.length > 0) {
                embed.addFields({
                    name: '📋 Текущие роли',
                    value: currentRoles.join(', ') + (targetMember.roles.cache.size > 11 ? '\n*...и другие*' : ''),
                    inline: false
                });
            }

            // Создаем меню выбора группы ролей
            const groupSelectMenu = new StringSelectMenuBuilder()
                .setCustomId(`role_group_select_${targetUser.id}_${interaction.user.id}`)
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
                    emoji: this.getGroupEmoji(groupKey)
                });
            }

            const row = new ActionRowBuilder().addComponents(groupSelectMenu);

            // Добавляем кнопку отмены
            const cancelButton = new ButtonBuilder()
                .setCustomId(`role_cancel_${interaction.user.id}`)
                .setLabel('❌ Отмена')
                .setStyle(ButtonStyle.Secondary);

            const buttonRow = new ActionRowBuilder().addComponents(cancelButton);

            await interaction.reply({
                embeds: [embed],
                components: [row, buttonRow],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Ошибка в команде /роли:', error);
            
            const errorMessage = '❌ Произошла ошибка при выполнении команды!';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
            }
        }
    },

    // Вспомогательные методы
    async getRoleNames(guild, roleIds) {
        const names = [];
        for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                names.push(role.name);
            }
        }
        return names;
    },

    getGroupEmoji(groupKey) {
        const emojis = {
            'RP_ROLES': '🎭',
            'CURATOR': '👑',
            'ANALYST': '📊',
            'EDITOR': '✏️'
        };
        return emojis[groupKey] || '🔧';
    }
};
