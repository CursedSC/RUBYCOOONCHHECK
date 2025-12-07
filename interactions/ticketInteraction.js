const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags, ChannelType } = require('discord.js');

const Database = require('../database');
const db = new Database();

const CURATOR_ROLE_ID = '1382005661369368586';
const SPECIAL_USER_ID = '416602253160480769';
const ADMIN_ROLES = ['1382006178451685377'];
const HIGH_ADMIN_ROLES = ['1382006799028322324'];

const TICKET_CATEGORY_ID = '1382492043216949359'; // Укажите ID категории для тикетов

const { TicketLogger, TICKET_ACTION_TYPES } = require('../utils/ticketLogger');

const CUSTOM_EMOJIS = {
    TICKET_FREE: '<:emptybox:1396816640196476998>',
    TICKET_OCCUPIED: '<:Lock:1396817745399644270>',
    TICKET_COMPLETED: '<:Tick:1396822406751981702>',
    TICKET_PENDING: '<:Pokemon_TCGPWonderHourglass:1396822944252039268>',
    TICKET_PAUSED: '<:Pause:1396823161512919141>',
    TICKET_CLOSED: '<:Incorrect:1396823239669448845>',
    CURATOR: '<:chief:1396827256596467742>',
    USER: '<:user:1396827248098545726>',
    ADMIN: '<:rubine:1396827267769962567>',
    ACCEPT: '<:Tick:1396822406751981702>',
    DECLINE: '<:Incorrect:1396823239669448845>',
    MANAGE: '⚙️',
    ARCHIVE: '📁',
    STATUS_CHANGE: '🔄',
    PARTICIPANTS: '👥',
    STAR_EMPTY: '<:star:1396814932397396048>',
    STAR_FULL: '<:star_f:1396828897244610590>',
    STAR_HALF: '<:star_h:1396828886939074710>',
    LOADING: '⏳',
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    MEDAL_GOLD: '🥇',
    MEDAL_SILVER: '🥈',
    MEDAL_BRONZE: '🥉',
    TROPHY: '🏆'
};

const KEY_IMAGES = {
    PLAYER_GREETING: 'https://cdn.discordapp.com/attachments/1383161274896220231/1396839686911299754/Slide_16_9_-_5.png?ex=687f8bd5&is=687e3a55&hm=f3bf29264546574bd1256ca23b01cfcc8f77a478438b32073ba0a6085ec25431&',
    MANAGEMENT_PANEL: 'https://media.discordapp.net/attachments/1383161274896220231/1396839688014401598/Slide_16_9_-_4.png?ex=687f8bd5&is=687e3a55&hm=f7576d398e6f0ff2eec3a15f19a94eb576a059cf54cd6cb6e6c2f36b22dbacb0&=&format=webp&quality=lossless&width=1504&height=846',
    SELECT_MENU: 'https://media.discordapp.net/attachments/1383161274896220231/1396839686911299754/Slide_16_9_-_5.png?ex=687f8bd5&is=687e3a55&hm=f3bf29264546574bd1256ca23b01cfcc8f77a478438b32073ba0a6085ec25431&=&format=webp&quality=lossless&width=1504&height=846'
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

module.exports = {
    canHandle(interaction) {
        return (
            interaction.isStringSelectMenu() && (
                interaction.customId.startsWith('ticket_menu_') ||
                interaction.customId.startsWith('ticket_category_') ||
                interaction.customId.startsWith('accept_ticket_') ||
                interaction.customId.startsWith('manage_occupied_') ||
                interaction.customId.startsWith('curator_change_') ||
                interaction.customId.startsWith('curator_assign_') ||
                interaction.customId.startsWith('curator_page_') ||
                interaction.customId.startsWith('status_change_') ||
                interaction.customId.startsWith('curator_change_status_')
            )
        ) || (
            interaction.isButton() && (
                interaction.customId.startsWith('take_ticket_') ||
                interaction.customId.startsWith('ticket_action_') ||
                interaction.customId.startsWith('confirm_accept_') ||
                interaction.customId.startsWith('cancel_accept_') ||
                interaction.customId.startsWith('curator_status_') ||
                interaction.customId.startsWith('curator_complete_') ||
                interaction.customId.startsWith('rate_curator_') ||
                interaction.customId.startsWith('reset_cooldown_') ||
                interaction.customId.startsWith('view_cooldown_users_') ||
                interaction.customId.startsWith('view_curator_ratings_')||
                interaction.customId.startsWith('free_tickets_first_') ||
                interaction.customId.startsWith('free_tickets_prev_') ||
                interaction.customId.startsWith('free_tickets_next_') ||
                interaction.customId.startsWith('free_tickets_last_')||
                interaction.customId.startsWith('occupied_tickets_first_') ||
                interaction.customId.startsWith('occupied_tickets_prev_') ||
                interaction.customId.startsWith('occupied_tickets_next_') ||
                interaction.customId.startsWith('expand_ticket_admin_') ||
                interaction.customId.startsWith('quick_take_ticket_') ||
                interaction.customId.startsWith('occupied_tickets_last_')
            )   
        ) || (
            interaction.isModalSubmit() &&
            interaction.customId.startsWith('participants_modal_')
        );
    },

    async execute(interaction) {
        try {
            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_menu_')) {
                await this.handleTicketMenu(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_category_')) {
                await this.handleTicketCategory(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('accept_ticket_')) {
                await this.handleAcceptTicket(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('reset_cooldown_')) {
                await this.showCooldownResetModal(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('view_cooldown_users_')) {
                await this.showUsersWithCooldown(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('expand_ticket_admin_')) {
                await this.handleExpandTicketForAdmin(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('manage_occupied_')) {
                await this.handleManageOccupied(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('confirm_accept_')) {
                await this.confirmAcceptTicket(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('cancel_accept_')) {
                await this.cancelAcceptTicket(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('take_ticket_')) {
                await this.handleTakeTicket(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('ticket_action_')) {
                await this.handleTicketAction(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('curator_assign_')) {
                await this.handleCuratorAssign(interaction);
            }else if (interaction.isButton() && interaction.customId.startsWith('curator_page_')) {
                    const parts = interaction.customId.split('_');
                    const ticketNumber = parseInt(parts[2]);
                    const newPage = parseInt(parts[3]);
                    
                    await this.handleCuratorPagination(interaction, ticketNumber, newPage);
            } else if (interaction.isModalSubmit() && interaction.customId.startsWith('participants_modal_')) {
                await this.handleParticipantsModal(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('status_change_')) {
                await this.handleStatusChange(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('curator_status_')) {
                await this.handleCuratorStatusButton(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('curator_complete_')) {
                await this.handleCuratorCompleteButton(interaction);
            } else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('curator_change_status_')) {
                await this.handleCuratorStatusChange(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('rate_curator_')) {
                await this.handleCuratorRating(interaction);
            } else if (interaction.isButton() && interaction.customId.startsWith('view_curator_ratings_')) {
                await this.showCuratorRatings(interaction);
                
            // ОБРАБОТКА ПАГИНАЦИИ ДЛЯ СВОБОДНЫХ ТИКЕТОВ
            } else if (interaction.isButton() && (
                interaction.customId.startsWith('free_tickets_first_') ||
                interaction.customId.startsWith('free_tickets_prev_') ||
                interaction.customId.startsWith('free_tickets_next_') ||
                interaction.customId.startsWith('free_tickets_last_')
            )) {
                const parts = interaction.customId.split('_');
                const userId = parts[3];
                
                if (interaction.user.id !== userId) {
                    return await interaction.reply({
                        content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                let page = 1;
                if (parts[2] === 'first') {
                    page = 1;
                } else if (parts[2] === 'last') {
                    const tickets = await db.getFreeTickets();
                    page = Math.ceil(tickets.length / 10);
                } else {
                    page = parseInt(parts[4]) || 1;
                }
                
                await this.showManageFreeTickets(interaction, page);
                
            // ОБРАБОТКА ПАГИНАЦИИ ДЛЯ ЗАНЯТЫХ ТИКЕТОВ
            } else if (interaction.isButton() && (
                interaction.customId.startsWith('occupied_tickets_first_') ||
                interaction.customId.startsWith('occupied_tickets_prev_') ||
                interaction.customId.startsWith('occupied_tickets_next_') ||
                interaction.customId.startsWith('occupied_tickets_last_')
            )) {
                const parts = interaction.customId.split('_');
                const userId = parts[3];
                
                if (interaction.user.id !== userId) {
                    return await interaction.reply({
                        content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                let page = 1;
                if (parts[2] === 'first') {
                    page = 1;
                } else if (parts[2] === 'last') {
                    const tickets = await db.getOccupiedTickets();
                    page = Math.ceil(tickets.length / 10);
                } else {
                    page = parseInt(parts[4]) || 1;
                }
                
                await this.showManageOccupiedTickets(interaction, page);
            }
    
        } catch (error) {
            console.error('Ошибка в обработчике тикетов:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при обработке запроса!`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },
    async handleCuratorPagination(interaction, ticketNumber, newPage) {
        const guild = interaction.guild;
        const curatorRole = guild.roles.cache.get(CURATOR_ROLE_ID);
        
        if (!curatorRole) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Роль куратора не найдена!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        await guild.members.fetch();
        const allCurators = Array.from(curatorRole.members.values());
        const totalPages = Math.ceil(allCurators.length / 23);
        
        await this.showCuratorPage(interaction, ticketNumber, allCurators, newPage, totalPages);
    },
    async handleExpandTicketForAdmin(interaction) {
        // Проверка прав доступа
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
        const hasAdminRole = ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        
        if (!hasHighAdminRole && !isSpecialUser && !hasAdminRole) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для раскрытия тикета для администрации!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const ticketNumber = parseInt(interaction.customId.split('_')[3]);
        
        try {
            const ticket = await db.getTicketByNumber(ticketNumber);
            if (!ticket) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                    flags: MessageFlags.Ephemeral
                });
            }
    
            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Канал тикета не найден!`,
                    flags: MessageFlags.Ephemeral
                });
            }
    
            // Получаем роль администрации
            const adminRole = interaction.guild.roles.cache.get(ADMIN_PING_ROLE_ID);
            if (!adminRole) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Роль "Состав Администрации" не найдена!`,
                    flags: MessageFlags.Ephemeral
                });
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
    
            // Отправляем уведомление о раскрытии
            const expansionEmbed = new EmbedBuilder()
                .setTitle('🚨 Тикет раскрыт для администрации')
                .setDescription(`Тикет #${ticketNumber} раскрыт для всех администраторов пользователем <@${interaction.user.id}>`)
                .addFields(
                    { name: '👤 Инициатор раскрытия', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '🎫 Номер тикета', value: ticketNumber.toString(), inline: true },
                    { name: '⏰ Время раскрытия', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setColor(0xff6600)
                .setTimestamp();
    
            await ticketChannel.send({
                content: `${adminRole.toString()} - тикет раскрыт для администрации!`,
                embeds: [expansionEmbed]
            });
    
            // Логируем действие
            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_EXPANDED_FOR_ADMINS,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: {
                    expanded_by: interaction.user.id,
                    admin_role_id: ADMIN_PING_ROLE_ID
                },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });
    
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.SUCCESS} Тикет #${ticketNumber} успешно раскрыт для всех администраторов!`,
                flags: MessageFlags.Ephemeral
            });
    
        } catch (error) {
            console.error('Ошибка раскрытия тикета для администрации:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при раскрытии тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
    getStatusColor(status) {
        return STATUS_COLORS[status] || 0x808080;
    },

    generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        return CUSTOM_EMOJIS.STAR_FULL.repeat(fullStars) +
            (hasHalfStar ? CUSTOM_EMOJIS.STAR_HALF : '') +
            CUSTOM_EMOJIS.STAR_EMPTY.repeat(emptyStars);
    },

    getMedalEmoji(index) {
        const medals = [CUSTOM_EMOJIS.MEDAL_GOLD, CUSTOM_EMOJIS.MEDAL_SILVER, CUSTOM_EMOJIS.MEDAL_BRONZE];
        return medals[index] || CUSTOM_EMOJIS.TROPHY;
    },

    getStatusEmoji(status) {
        const statusEmojis = {
            'Ожидает куратора': CUSTOM_EMOJIS.TICKET_PENDING,
            'В работе': CUSTOM_EMOJIS.TICKET_OCCUPIED,
            'Ожидает ответа': CUSTOM_EMOJIS.LOADING,
            'Завершен': CUSTOM_EMOJIS.TICKET_COMPLETED,
            'Приостановлен': CUSTOM_EMOJIS.TICKET_PAUSED,
            'Закрыт': CUSTOM_EMOJIS.TICKET_CLOSED,
            'Почти готов': CUSTOM_EMOJIS.SUCCESS
        };
        return statusEmojis[status] || CUSTOM_EMOJIS.INFO;
    },

    async handleTicketMenu(interaction) {
        const userId = interaction.customId.split('_')[2];
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedValue = interaction.values[0];
        switch (selectedValue) {
            case 'create_ticket':
                const activeTickets = await db.getUserActiveTickets(userId);
                if (activeTickets.length > 0) {
                  return await interaction.reply({
                    content: `❌ У вас уже есть активный тикет! Закройте его перед созданием нового.\n\n📋 **Активные тикеты:**\n${activeTickets.map(t => `• Тикет #${t.ticket_number} (${t.status})`).join('\n')}`,
                    flags: MessageFlags.Ephemeral
                  });
                }
              
                
                const cooldownHours = await db.getCooldownHours(userId);
                if (cooldownHours > 0) {
                  return await interaction.reply({
                    content: `❌ Вы можете создать следующий тикет через **${cooldownHours} часов**!\n⏰ Кулдаун между тикетами составляет 48 часов.\n\n📋 Система кулдауна предотвращает спам тикетов и обеспечивает качественную обработку каждого обращения.`,
                    flags: MessageFlags.Ephemeral
                  });
                }
              
                await this.showCreateTicketModal(interaction);
                break;
              
            case 'manage_users':
                await this.showUserManagement(interaction);
                break;
            case 'my_tickets':
                await this.showUserTickets(interaction);
                break;
            case 'manage_tickets':
                await this.showAllTickets(interaction);
                break;
        }
    },

    async showUserManagement(interaction) {
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;

        if (!hasHighAdminRole && !isSpecialUser) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для управления пользователями!`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const usersWithCooldown = await db.getUsersWithCooldown();
            const curatorRatings = await db.getAllCuratorRatings();

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.ADMIN} Управление пользователями`)
                .setDescription('**Выберите действие для управления пользователями:**')
                .addFields(
                    { name: '👥 Пользователи с кулдауном', value: usersWithCooldown.length > 0 ? `${usersWithCooldown.length} пользователей` : 'Нет пользователей с активным кулдауном', inline: true },
                    { name: '⏰ Сброс кулдауна', value: 'Сброс кулдауна для конкретного пользователя', inline: true },
                    { name: `${CUSTOM_EMOJIS.TROPHY} Рейтинг кураторов`, value: curatorRatings.length > 0 ? `${curatorRatings.length} кураторов` : 'Нет оценок', inline: true }
                )
                .setColor(0xe74c3c)
                .setTimestamp();

            const resetButton = new ButtonBuilder()
                .setCustomId(`reset_cooldown_${interaction.user.id}`)
                .setLabel('Сбросить кулдаун')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏰');

            const viewUsersButton = new ButtonBuilder()
                .setCustomId(`view_cooldown_users_${interaction.user.id}`)
                .setLabel('Показать пользователей')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('👥');

            const viewRatingsButton = new ButtonBuilder()
                .setCustomId(`view_curator_ratings_${interaction.user.id}`)
                .setLabel('Топ кураторов')
                .setStyle(ButtonStyle.Success)
                .setEmoji(CUSTOM_EMOJIS.TROPHY);

            const row = new ActionRowBuilder().addComponents(resetButton, viewUsersButton, viewRatingsButton);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка показа управления пользователями:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при загрузке данных!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async showCuratorRatings(interaction) {
        try {
            const curatorRatings = await db.getAllCuratorRatings();
            if (curatorRatings.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.TROPHY} Рейтинг кураторов`)
                    .setDescription('📊 Пока нет оценок кураторов!')
                    .setColor(0x3498db)
                    .setTimestamp();

                return await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TROPHY} Топ кураторов по рейтингу`)
                .setDescription(`**Найдено кураторов: ${curatorRatings.length}**\n\n${CUSTOM_EMOJIS.INFO} *Рейтинг основан на отзывах пользователей*`)
                .setColor(0xffd700)
                .setTimestamp()
                .setFooter({ text: `Всего кураторов с оценками: ${curatorRatings.length}` });

            curatorRatings.slice(0, 10).forEach((curator, index) => {
                const member = interaction.guild.members.cache.get(curator.curator_id);
                const memberName = member ? member.displayName : 'Неизвестный куратор';
                const rating = parseFloat(curator.average_rating);
                const starRating = this.generateStarRating(rating);
                const medalEmoji = this.getMedalEmoji(index);

                embed.addFields({
                    name: `${medalEmoji} ${memberName}`,
                    value: `${starRating} **${rating.toFixed(1)}/5.0**\n📊 **Отзывов:** ${curator.total_reviews} | **Тикетов:** ${curator.total_tickets}`,
                    inline: true
                });
            });

            if (curatorRatings.length > 10) {
                embed.addFields({
                    name: `${CUSTOM_EMOJIS.INFO} Информация`,
                    value: `Показано топ-10 кураторов из ${curatorRatings.length}`,
                    inline: false
                });
            }

            // Статистика
            const totalReviews = curatorRatings.reduce((sum, curator) => sum + curator.total_reviews, 0);
            const averageRating = curatorRatings.reduce((sum, curator) => sum + parseFloat(curator.average_rating), 0) / curatorRatings.length;

            embed.addFields({
                name: '📈 Общая статистика',
                value: `**Всего отзывов:** ${totalReviews}\n**Средний рейтинг:** ${this.generateStarRating(averageRating)} ${averageRating.toFixed(1)}/5.0`,
                inline: false
            });

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка показа рейтинга кураторов:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при загрузке рейтинга!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async showCooldownResetModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId(`cooldown_reset_modal_${interaction.user.id}`)
            .setTitle('Сброс кулдауна тикета');

        const userInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('ID пользователя или @mention')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
            .setPlaceholder('Введите ID пользователя или упомяните его (@user)');

        const row = new ActionRowBuilder().addComponents(userInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },

    async showUsersWithCooldown(interaction) {
        try {
            const usersWithCooldown = await db.getUsersWithCooldown();
            if (usersWithCooldown.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Пользователи с кулдауном`)
                    .setDescription('🎉 В данный момент нет пользователей с активным кулдауном тикетов!')
                    .setColor(0x00ff00)
                    .setTimestamp();

                return await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.LOADING} Пользователи с активным кулдауном`)
                .setDescription(`**Найдено пользователей: ${usersWithCooldown.length}**`)
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({ text: `Всего пользователей с кулдауном: ${usersWithCooldown.length}` });

            for (const user of usersWithCooldown.slice(0, 10)) {
                const member = interaction.guild.members.cache.get(user.creator_id);
                const cooldownEnd = new Date(user.next_ticket_allowed);
                const now = new Date();
                const hoursLeft = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60));

                embed.addFields({
                    name: `👤 ${member ? member.displayName : 'Неизвестный пользователь'}`,
                    value: `**ID:** ${user.creator_id}\n⏰ **Осталось:** ${hoursLeft} часов`,
                    inline: true
                });
            }

            if (usersWithCooldown.length > 10) {
                embed.addFields({
                    name: 'ℹ️ Информация',
                    value: `Показано первые 10 пользователей из ${usersWithCooldown.length}`,
                    inline: false
                });
            }

            const resetButton = new ButtonBuilder()
                .setCustomId(`reset_cooldown_${interaction.user.id}`)
                .setLabel('Сбросить кулдаун')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏰');

            const row = new ActionRowBuilder().addComponents(resetButton);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка показа пользователей с кулдауном:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при загрузке пользователей!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleCuratorAssign(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const selectedCuratorId = interaction.values[0];
    
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
        if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Канал тикета не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        try {
            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_CURATOR_CHANGED,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: {
                    old_curator: ticket.curator_id,
                    new_curator: selectedCuratorId === 'remove_curator' ? null : selectedCuratorId
                },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });
    
            if (selectedCuratorId === 'remove_curator') {
                // СНЯТИЕ КУРАТОРА
                await db.removeCurator(ticketNumber);
                
                // Удаляем старого куратора из канала
                if (ticket.curator_id) {
                    try {
                        await ticketChannel.permissionOverwrites.delete(ticket.curator_id);
                        console.log(`Куратор ${ticket.curator_id} удален из канала тикета #${ticketNumber}`);
                    } catch (error) {
                        console.log(`Не удалось удалить куратора из канала:`, error.message);
                    }
                }
    
                // ИЗМЕНЯЕМ НАЗВАНИЕ КАНАЛА (убираем ник куратора)
                const newChannelName = `тикет-${ticketNumber}`;
                try {
                    await ticketChannel.setName(newChannelName);
                    console.log(`📝 Название канала изменено на: ${newChannelName} (куратор снят)`);
                } catch (nameError) {
                    console.error('Ошибка изменения названия канала:', nameError);
                }
    
                const removeEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.WARNING} Куратор снят`)
                    .setDescription(`${CUSTOM_EMOJIS.TICKET_PENDING} Тикет **#${ticketNumber}** снова ожидает куратора`)
                    .addFields({
                        name: `${CUSTOM_EMOJIS.CURATOR} Снятый куратор`,
                        value: ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не было',
                        inline: true
                    })
                    .setColor(0xffa500)
                    .setTimestamp();
    
                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.WARNING} **Куратор снят с тикета #${ticketNumber} администратором <@${interaction.user.id}>**\n${CUSTOM_EMOJIS.TICKET_PENDING} Тикет снова ожидает куратора.`,
                    embeds: [removeEmbed]
                });
    
                await interaction.reply({
                    content: `${CUSTOM_EMOJIS.SUCCESS} Куратор снят с тикета #${ticketNumber}! Канал переименован.`,
                    flags: MessageFlags.Ephemeral
                });
    
            } else {
                // НАЗНАЧЕНИЕ/СМЕНА КУРАТОРА
                const newCurator = interaction.guild.members.cache.get(selectedCuratorId);
                if (!newCurator) {
                    return await interaction.reply({
                        content: `${CUSTOM_EMOJIS.ERROR} Куратор не найден!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
    
                await db.changeCurator(ticketNumber, selectedCuratorId);
    
                // Удаляем старого куратора из канала
                if (ticket.curator_id && ticket.curator_id !== selectedCuratorId) {
                    try {
                        await ticketChannel.permissionOverwrites.delete(ticket.curator_id);
                        console.log(`Старый куратор ${ticket.curator_id} удален из канала`);
                    } catch (error) {
                        console.log(`Не удалось удалить старого куратора из канала:`, error.message);
                    }
                }
    
                // Добавляем нового куратора в канал
                try {
                    await ticketChannel.permissionOverwrites.create(selectedCuratorId, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        ManageMessages: true
                    });
                    console.log(`Новый куратор ${selectedCuratorId} добавлен в канал`);
                } catch (error) {
                    console.log(`Не удалось добавить нового куратора в канал:`, error.message);
                }
    
                // ИЗМЕНЯЕМ НАЗВАНИЕ КАНАЛА (меняем ник куратора)
                const curatorNickname = newCurator.displayName;
                const truncatedNickname = curatorNickname.length > 12 ? 
                    curatorNickname.substring(0, 12) : curatorNickname;
                const newChannelName = `тикет-${ticketNumber}-${truncatedNickname}`;
    
                try {
                    await ticketChannel.setName(newChannelName);
                    console.log(`📝 Название канала изменено на: ${newChannelName}`);
                } catch (nameError) {
                    console.error('Ошибка изменения названия канала:', nameError);
                }
    
                const changeEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.CURATOR} Смена куратора`)
                    .setDescription(`${CUSTOM_EMOJIS.STATUS_CHANGE} Куратор тикета **#${ticketNumber}** изменен`)
                    .addFields(
                        { 
                            name: `${CUSTOM_EMOJIS.CURATOR} Старый куратор`, 
                            value: ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не было', 
                            inline: true 
                        },
                        { 
                            name: `${CUSTOM_EMOJIS.CURATOR} Новый куратор`, 
                            value: `<@${selectedCuratorId}>`, 
                            inline: true 
                        },
                        {
                            name: `${CUSTOM_EMOJIS.INFO} Изменения канала`,
                            value: `Название изменено на: **${newChannelName}**`,
                            inline: false
                        }
                    )
                    .setColor(this.getStatusColor('В работе'))
                    .setTimestamp();
    
                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.SUCCESS} **Куратор тикета #${ticketNumber} изменен администратором <@${interaction.user.id}>**`,
                    embeds: [changeEmbed]
                });
    
                await interaction.reply({
                    content: `${CUSTOM_EMOJIS.SUCCESS} Куратор тикета #${ticketNumber} изменен на ${newCurator.displayName}! Канал переименован в "${newChannelName}".`,
                    flags: MessageFlags.Ephemeral
                });
            }
    
        } catch (error) {
            console.error('Ошибка смены куратора:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при смене куратора!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
    
    // Улучшенная функция получения статуса
    getStatusText(status) {
        const statusTexts = {
            'online': '🟢 В сети',
            'idle': '🟡 Не активен', 
            'dnd': '🔴 Не беспокоить',
            'offline': '⚪ Не в сети'
        };
        return statusTexts[status] || '⚪ Не в сети';
    },
    

    async handleStatusChange(interaction) {
        const parts = interaction.customId.split('_');
        const ticketNumber = parseInt(parts[2]);
        const newStatus = interaction.values[0];

        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        await TicketLogger.logTicketAction(interaction.client, {
            admin_id: interaction.user.id,
            action_type: TICKET_ACTION_TYPES.TICKET_STATUS_CHANGED,
            ticket_number: ticketNumber,
            target_user_id: ticket.creator_id,
            details: {
                old_status: ticket.status,
                new_status: newStatus
            },
            success: true,
            channel_id: ticket.channel_id,
            guild_id: interaction.guildId
        });

        try {
            await db.updateTicketStatus(ticketNumber, newStatus);

            // РАБОТАЕМ С КАНАЛОМ ВМЕСТО ВЕТКИ
            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                const statusEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Статус обновлен`)
                    .setDescription(`${CUSTOM_EMOJIS.STATUS_CHANGE} Тикет **#${ticketNumber}** теперь имеет статус: **${newStatus}**`)
                    .setColor(this.getStatusColor(newStatus))
                    .setTimestamp();

                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.STATUS_CHANGE} **Статус тикета #${ticketNumber} изменен на "${newStatus}" администратором <@${interaction.user.id}>**`,
                    embeds: [statusEmbed]
                });
            }

            await interaction.reply({
                content: `${CUSTOM_EMOJIS.SUCCESS} Статус тикета #${ticketNumber} изменен на "${newStatus}"!`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при изменении статуса!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async confirmAcceptTicket(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        
        try {
            const ticket = await db.getTicketByNumber(ticketNumber);
            if (!ticket) {
                return await interaction.update({
                    content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                    embeds: [],
                    components: []
                });
            }
    
            if (ticket.curator_id) {
                return await interaction.update({
                    content: `${CUSTOM_EMOJIS.ERROR} Этот тикет уже взят другим куратором!`,
                    embeds: [],
                    components: []
                });
            }
    
            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_TAKEN,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: {
                    curator_id: interaction.user.id
                },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });
    
            await db.assignCurator(ticketNumber, interaction.user.id);
    
            // РАБОТАЕМ С КАНАЛОМ ВМЕСТО ВЕТКИ
            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                // ДОБАВЛЯЕМ ИЗМЕНЕНИЕ НАЗВАНИЯ КАНАЛА
                const curatorMember = interaction.guild.members.cache.get(interaction.user.id);
                const curatorNickname = curatorMember ? curatorMember.displayName : 'Куратор';
                
                // Обрезаем никнейм если больше 12 символов
                const truncatedNickname = curatorNickname.length > 12 ? 
                    curatorNickname.substring(0, 12) : curatorNickname;
                
                const newChannelName = `тикет-${ticketNumber}-${truncatedNickname}`;
                
                try {
                    await ticketChannel.setName(newChannelName);
                    console.log(`📝 Название канала изменено на: ${newChannelName}`);
                } catch (nameError) {
                    console.error('Ошибка изменения названия канала:', nameError);
                    // Не прерываем выполнение, если название не удалось изменить
                }
    
                // Добавляем куратора через права доступа
                await ticketChannel.permissionOverwrites.create(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    ManageMessages: true
                });
    
                const updatedEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Тикет #${ticketNumber}`)
                    .setDescription('**🔧 Тикет в работе**')
                    .addFields(
                        { name: `${CUSTOM_EMOJIS.USER} Создатель`, value: `<@${ticket.creator_id}>`, inline: true },
                        { name: `${CUSTOM_EMOJIS.CURATOR} Куратор`, value: `<@${interaction.user.id}>`, inline: true },
                        { name: `${CUSTOM_EMOJIS.STATUS_CHANGE} Статус`, value: 'В работе', inline: true }
                    )
                    .setColor(this.getStatusColor('В работе'))
                    .setTimestamp()
                    .setFooter({ text: `ID тикета: ${ticketNumber}` });
    
                const statusButton = new ButtonBuilder()
                    .setCustomId(`ticket_action_status_${ticketNumber}`)
                    .setLabel('Изменить статус')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(CUSTOM_EMOJIS.STATUS_CHANGE);
    
                const completeButton = new ButtonBuilder()
                    .setCustomId(`curator_complete_${ticketNumber}`)
                    .setLabel('Завершить тикет')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(CUSTOM_EMOJIS.SUCCESS);
    
                const managementRow = new ActionRowBuilder().addComponents(statusButton, completeButton);
    
                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.SUCCESS} **Куратор <@${interaction.user.id}> принял тикет #${ticketNumber}!**\n${CUSTOM_EMOJIS.STATUS_CHANGE} Статус изменен на "В работе"`,
                    embeds: [new EmbedBuilder()
                        .setDescription(`${CUSTOM_EMOJIS.INFO} Куратор готов приступить к работе над вашим тикетом!`)
                        .setColor(this.getStatusColor('В работе'))
                    ]
                });
    
                // Обновляем исходное сообщение в канале
                const messages = await ticketChannel.messages.fetch({ limit: 10 });
                const originalMessage = messages.find(msg => msg.embeds.length > 0 && msg.embeds[0].title?.includes(`Тикет #${ticketNumber}`));
                
                if (originalMessage) {
                    await originalMessage.edit({
                        embeds: [updatedEmbed],
                        components: [managementRow]
                    });
                }
    
                const successEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Тикет успешно принят!`)
                    .setDescription(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} **Тикет #${ticketNumber}** теперь находится в вашей работе.\n${CUSTOM_EMOJIS.INFO} Вы получили доступ к каналу и можете начинать работу.`)
                    .setColor(0x32cd32)
                    .setTimestamp();
    
                await interaction.update({
                    embeds: [successEmbed],
                    components: []
                });
            }
    
        } catch (error) {
            console.error('Ошибка при принятии тикета:', error);
            await interaction.update({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при принятии тикета!`,
                embeds: [],
                components: []
            });
        }
    },
    
    async closeTicket(interaction, ticketNumber) {
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        await TicketLogger.logTicketAction(interaction.client, {
            adminid: interaction.user.id,
            actiontype: TICKET_ACTION_TYPES.TICKET_CLOSED,
            ticketnumber: ticketNumber,
            targetuserid: ticket.creatorid,
            details: { curatorid: ticket.curatorid },
            success: true,
            channelid: ticket.channelid,
            guildid: interaction.guildId
        });
    
        try {
            await db.updateTicketStatus(ticketNumber, 'Закрыт');
            
            // ✅ УСТАНОВКА КУЛДАУНА ПОСЛЕ ЗАКРЫТИЯ
            await db.setTicketCompletionCooldown(ticketNumber, ticket.creator_id);
            
            const ticketChannel = interaction.guild.channels.cache.get(ticket.channelid);
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                const closeEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.TICKETCLOSED} Тикет закрыт`)
                    .setDescription(`Тикет **#${ticketNumber}** будет удалён через **10 секунд**.\n\n⏱️ **Кулдаун:** 48 часов с момента закрытия.`)
                    .addFields(
                        { name: '👤 Создатель', value: `<@${ticket.creatorid}>`, inline: true },
                        { name: '👨‍💼 Куратор', value: ticket.curatorid ? `<@${ticket.curatorid}>` : 'Не назначен', inline: true }
                    )
                    .setColor(0x666666)
                    .setTimestamp();
    
                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.TICKETCLOSED} Тикет **#${ticketNumber}** закрыт <@${interaction.user.id}>. Канал будет удалён через **10 секунд**!`,
                    embeds: [closeEmbed]
                });
    
                setTimeout(async () => {
                    try {
                        await ticketChannel.delete(`Тикет #${ticketNumber} закрыт`);
                        console.log(`✅ Канал тикета #${ticketNumber} удалён`);
                    } catch (deleteError) {
                        console.error(`Ошибка удаления канала тикета #${ticketNumber}:`, deleteError);
                    }
                }, 10000);
            }
    
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.SUCCESS} Тикет **#${ticketNumber}** закрыт! Канал будет удалён через **10 секунд**.\n⏱️ Кулдаун на создание нового тикета: **48 часов**.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка закрытия тикета:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при закрытии тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleParticipantsModal(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const participants = interaction.fields.getTextInputValue('participants');

        try {
            const ticket = await db.getTicketByNumber(ticketNumber);
            if (!ticket) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const participantIds = participants.split(',')
                .map(id => id.trim())
                .filter(id => id && /^\d+$/.test(id));

            if (participantIds.length === 0) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Не указаны корректные ID участников!`,
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
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Ни один из указанных пользователей не найден на сервере!`,
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

            await interaction.reply({
                content: `${CUSTOM_EMOJIS.SUCCESS} Участники тикета #${ticketNumber} успешно обновлены!\n👥 Добавлено: ${validatedIds.length} участников\n${CUSTOM_EMOJIS.INFO} Участники будут получать уведомления в ЛС`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка обновления участников:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при обновлении участников!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // Остальные методы остаются без изменений, но везде добавляем проверки на каналы
    async handleTicketCategory(interaction) {
        const selectedValue = interaction.values[0];
        switch (selectedValue) {
            case 'manage_free_tickets':
                await this.showManageFreeTickets(interaction);
                break;
            case 'manage_occupied_tickets':
                await this.showManageOccupiedTickets(interaction);
                break;
            case 'manage_archived_tickets':
                await this.showManageArchivedTickets(interaction);
                break;
        }
    },

    async showCreateTicketModal(interaction) {
        const characters = await db.getAllCharactersByUserId(interaction.user.id);
        if (characters.length === 0) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет персонажей! Сначала создайте персонажа.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`create_ticket_modal_${interaction.user.id}`)
            .setTitle('Создание нового тикета');

        const purposeInput = new TextInputBuilder()
            .setCustomId('purpose')
            .setLabel('Цель проведения тикета')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500)
            .setPlaceholder('Опишите, что нужно сделать с персонажем...');

        const characterInput = new TextInputBuilder()
            .setCustomId('character_ids')
            .setLabel('ID персонажей (через запятую)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200)
            .setPlaceholder('Например: 123, 456, 789')
            .setValue(characters.map(c => c.id).join(', '));

        const row1 = new ActionRowBuilder().addComponents(purposeInput);
        const row2 = new ActionRowBuilder().addComponents(characterInput);

        modal.addComponents(row1, row2);
        await interaction.showModal(modal);
    },

    async showUserTickets(interaction) {
        const tickets = await db.getUserTickets(interaction.user.id);
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_FREE} Ваши тикеты`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} У вас пока нет тикетов. Создайте свой первый тикет!`)
                .setColor(0x3498db)
                .setImage(KEY_IMAGES.PLAYER_GREETING)
                .setTimestamp();

            return await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.USER} Ваши тикеты`)
            .setDescription('**Список всех ваших тикетов:**')
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: `Всего тикетов: ${tickets.length}` });

        for (const ticket of tickets.slice(0, 10)) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const channelMention = channel ? `<#${ticket.channel_id}>` : 'Канал удален';
            const statusEmoji = this.getStatusEmoji(ticket.status);

            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_FREE} Тикет #${ticket.ticket_number}`,
                value: `${statusEmoji} **Статус:** ${ticket.status}\n${CUSTOM_EMOJIS.CURATOR} **Куратор:** ${ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не назначен'}\n${CUSTOM_EMOJIS.INFO} **Канал:** ${channelMention}`,
                inline: true
            });
        }

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    },

    async showAllTickets(interaction) {
        const hasPermission = interaction.member.roles.cache.has(CURATOR_ROLE_ID) ||
            interaction.user.id === SPECIAL_USER_ID ||
            ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!hasPermission) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для управления тикетами!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.MANAGE} Управление тикетами`)
            .setDescription('**Выберите категорию тикетов для просмотра:**')
            .addFields(
                { name: `${CUSTOM_EMOJIS.TICKET_FREE} Свободные тикеты`, value: 'Тикеты без куратора', inline: true },
                { name: `${CUSTOM_EMOJIS.TICKET_OCCUPIED} Занятые тикеты`, value: 'Тикеты с кураторами', inline: true },
                { name: `${CUSTOM_EMOJIS.ARCHIVE} Архив тикетов`, value: 'Закрытые тикеты', inline: true }
            )
            .setColor(0xe74c3c)
            .setImage(KEY_IMAGES.SELECT_MENU)
            .setTimestamp();

        const categoryOptions = [
            new StringSelectMenuOptionBuilder()
                .setLabel('Свободные тикеты')
                .setDescription('Тикеты без куратора')
                .setValue('manage_free_tickets')
                .setEmoji(CUSTOM_EMOJIS.TICKET_FREE),
            new StringSelectMenuOptionBuilder()
                .setLabel('Занятые тикеты')
                .setDescription('Тикеты с кураторами')
                .setValue('manage_occupied_tickets')
                .setEmoji(CUSTOM_EMOJIS.TICKET_OCCUPIED)
        ];

        const hasAdminRole = ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        if (hasAdminRole) {
            categoryOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Архив тикетов')
                    .setDescription('Закрытые тикеты')
                    .setValue('manage_archived_tickets')
                    .setEmoji(CUSTOM_EMOJIS.ARCHIVE)
            );
        }

        const categorySelectMenu = new StringSelectMenuBuilder()
            .setCustomId(`ticket_category_${interaction.user.id}`)
            .setPlaceholder('Выберите категорию тикетов')
            .addOptions(categoryOptions);

        const row = new ActionRowBuilder().addComponents(categorySelectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },

    async showManageFreeTickets(interaction, page = 1) {
        const TICKETS_PER_PAGE = 10;
        const tickets = await db.getFreeTickets();
        
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_FREE} Управление свободными тикетами`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Свободных тикетов не найдено.`)
                .setColor(0xffa500)
                .setTimestamp();
    
            return await interaction.update({
                embeds: [embed],
                components: []
            });
        }
    
        // Вычисляем пагинацию
        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
        const startIndex = (page - 1) * TICKETS_PER_PAGE;
        const endIndex = startIndex + TICKETS_PER_PAGE;
        const ticketsOnPage = tickets.slice(startIndex, endIndex);
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.TICKET_FREE} Управление свободными тикетами`)
            .setDescription(`**Выберите тикет для принятия:**\n\n📄 **Страница ${page} из ${totalPages}** | **Всего тикетов: ${tickets.length}**`)
            .setColor(0xffa500)
            .setImage(KEY_IMAGES.MANAGEMENT_PANEL)
            .setTimestamp()
            .setFooter({ text: `Показано тикетов: ${ticketsOnPage.length} из ${tickets.length} • Страница ${page}/${totalPages}` });
    
        const ticketOptions = [];
        
        for (const ticket of ticketsOnPage) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const creator = interaction.guild.members.cache.get(ticket.creator_id);
    
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_FREE} Тикет #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.USER} **Создатель:** ${creator ? creator.displayName : 'Неизвестно'}\n${CUSTOM_EMOJIS.INFO} **Цель:** ${ticket.purpose.substring(0, 330)}${ticket.purpose.length > 330 ? '...' : ''}\n${CUSTOM_EMOJIS.INFO} **Канал:** ${channel ? `<#${ticket.channel_id}>` : 'Удален'}`,
                inline: true
            });
    
            ticketOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Принять тикет #${ticket.ticket_number}`)
                    .setDescription(`От: ${creator ? creator.displayName : 'Неизвестно'}`)
                    .setValue(`accept_ticket_${ticket.ticket_number}`)
                    .setEmoji(CUSTOM_EMOJIS.ACCEPT)
            );
        }
    
        const components = [];
    
        // Добавляем select menu если есть тикеты
        if (ticketOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`accept_ticket_${interaction.user.id}`)
                .setPlaceholder('Выберите тикет для принятия')
                .addOptions(ticketOptions);
            
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    
        // Добавляем кнопки пагинации если нужно
        if (totalPages > 1) {
            const navigationButtons = [];
    
            // ИСПРАВЛЕНИЕ: Уникальные custom_id для каждой кнопки
            if (page > 1) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_first_${interaction.user.id}_${Date.now()}`)
                        .setLabel('Первая')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏪')
                );
    
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_prev_${interaction.user.id}_${page - 1}`)
                        .setLabel('Назад')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('◀️')
                );
            }
    
            if (page < totalPages) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_next_${interaction.user.id}_${page + 1}`)
                        .setLabel('Вперед')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );
    
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_last_${interaction.user.id}_${Date.now() + 1}`)
                        .setLabel('Последняя')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏩')
                );
            }
    
            if (navigationButtons.length > 0) {
                components.push(new ActionRowBuilder().addComponents(navigationButtons));
            }
        }
    
        await interaction.update({
            embeds: [embed],
            components: components
        });
    },
    
    async showManageOccupiedTickets(interaction, page = 1) {
        const TICKETS_PER_PAGE = 10;
        const tickets = await db.getOccupiedTickets();
        
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Управление занятыми тикетами`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Занятых тикетов не найдено.`)
                .setColor(0x00ff00)
                .setTimestamp();
    
            return await interaction.update({
                embeds: [embed],
                components: []
            });
        }
    
        // Вычисляем пагинацию
        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
        const startIndex = (page - 1) * TICKETS_PER_PAGE;
        const endIndex = startIndex + TICKETS_PER_PAGE;
        const ticketsOnPage = tickets.slice(startIndex, endIndex);
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Управление занятыми тикетами`)
            .setDescription(`**Выберите тикет для управления:**\n\n📄 **Страница ${page} из ${totalPages}** | **Всего тикетов: ${tickets.length}**`)
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ text: `Показано тикетов: ${ticketsOnPage.length} из ${tickets.length} • Страница ${page}/${totalPages}` });
    
        const ticketOptions = [];
        
        for (const ticket of ticketsOnPage) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const creator = interaction.guild.members.cache.get(ticket.creator_id);
            const curator = interaction.guild.members.cache.get(ticket.curator_id);
            const statusEmoji = this.getStatusEmoji(ticket.status);
    
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_OCCUPIED} Тикет #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.USER} **Создатель:** ${creator ? creator.displayName : 'Неизвестно'}\n${CUSTOM_EMOJIS.CURATOR} **Куратор:** ${curator ? curator.displayName : 'Неизвестно'}\n${statusEmoji} **Статус:** ${ticket.status}\n${CUSTOM_EMOJIS.INFO} **Канал:** ${channel ? `<#${ticket.channel_id}>` : 'Удален'}`,
                inline: true
            });
    
            ticketOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Управлять #${ticket.ticket_number}`)
                    .setDescription(`Куратор: ${curator ? curator.displayName : 'Неизвестно'}`)
                    .setValue(`manage_ticket_${ticket.ticket_number}`)
                    .setEmoji(CUSTOM_EMOJIS.MANAGE)
            );
        }
    
        const components = [];
    
        // Добавляем select menu если есть тикеты
        if (ticketOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`manage_occupied_${interaction.user.id}`)
                .setPlaceholder('Выберите тикет для управления')
                .addOptions(ticketOptions);
            
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    
        // Добавляем кнопки пагинации если нужно
        if (totalPages > 1) {
            const navigationButtons = [];
    
            // ИСПРАВЛЕНИЕ: Уникальные custom_id для каждой кнопки
            if (page > 1) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_first_${interaction.user.id}_${Date.now()}`)
                        .setLabel('Первая')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏪')
                );
    
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_prev_${interaction.user.id}_${page - 1}`)
                        .setLabel('Назад')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('◀️')
                );
            }
    
            if (page < totalPages) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_next_${interaction.user.id}_${page + 1}`)
                        .setLabel('Вперед')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );
    
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_last_${interaction.user.id}_${Date.now() + 1}`)
                        .setLabel('Последняя')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏩')
                );
            }
    
            if (navigationButtons.length > 0) {
                components.push(new ActionRowBuilder().addComponents(navigationButtons));
            }
        }
    
        await interaction.update({
            embeds: [embed],
            components: components
        });
    },    
    
    async showManageOccupiedTickets(interaction, page = 1) {
        const TICKETS_PER_PAGE = 10;
        const tickets = await db.getOccupiedTickets();
        
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Управление занятыми тикетами`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Занятых тикетов не найдено.`)
                .setColor(0x00ff00)
                .setTimestamp();
    
            return await interaction.update({
                embeds: [embed],
                components: []
            });
        }
    
        // Вычисляем пагинацию
        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
        const startIndex = (page - 1) * TICKETS_PER_PAGE;
        const endIndex = startIndex + TICKETS_PER_PAGE;
        const ticketsOnPage = tickets.slice(startIndex, endIndex);
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Управление занятыми тикетами`)
            .setDescription(`**Выберите тикет для управления:**\n\n📄 **Страница ${page} из ${totalPages}** | **Всего тикетов: ${tickets.length}**`)
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ text: `Показано тикетов: ${ticketsOnPage.length} из ${tickets.length} • Страница ${page}/${totalPages}` });
    
        const ticketOptions = [];
        
        for (const ticket of ticketsOnPage) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const creator = interaction.guild.members.cache.get(ticket.creator_id);
            const curator = interaction.guild.members.cache.get(ticket.curator_id);
            const statusEmoji = this.getStatusEmoji(ticket.status);
    
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_OCCUPIED} Тикет #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.USER} **Создатель:** ${creator ? creator.displayName : 'Неизвестно'}\n${CUSTOM_EMOJIS.CURATOR} **Куратор:** ${curator ? curator.displayName : 'Неизвестно'}\n${statusEmoji} **Статус:** ${ticket.status}\n${CUSTOM_EMOJIS.INFO} **Канал:** ${channel ? `<#${ticket.channel_id}>` : 'Удален'}`,
                inline: true
            });
    
            ticketOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Управлять #${ticket.ticket_number}`)
                    .setDescription(`Куратор: ${curator ? curator.displayName : 'Неизвестно'}`)
                    .setValue(`manage_ticket_${ticket.ticket_number}`)
                    .setEmoji(CUSTOM_EMOJIS.MANAGE)
            );
        }
    
        const components = [];
    
        // Добавляем select menu если есть тикеты
        if (ticketOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`manage_occupied_${interaction.user.id}`)
                .setPlaceholder('Выберите тикет для управления')
                .addOptions(ticketOptions);
            
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    
        // Добавляем кнопки пагинации если нужно
        if (totalPages > 1) {
            const navigationButtons = [];
    
            // Кнопка "Первая страница"
            if (page > 1) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_page_${interaction.user.id}_1`)
                        .setLabel('Первая')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏪')
                );
            }
    
            // Кнопка "Предыдущая"
            if (page > 1) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_page_${interaction.user.id}_${page - 1}`)
                        .setLabel('Назад')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('◀️')
                );
            }
    
            // Кнопка "Следующая"
            if (page < totalPages) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_page_${interaction.user.id}_${page + 1}`)
                        .setLabel('Вперед')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );
            }
    
            // Кнопка "Последняя страница"
            if (page < totalPages) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_page_${interaction.user.id}_${totalPages}`)
                        .setLabel('Последняя')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏩')
                );
            }
    
            if (navigationButtons.length > 0) {
                components.push(new ActionRowBuilder().addComponents(navigationButtons));
            }
        }
    
        await interaction.update({
            embeds: [embed],
            components: components
        });
    },    

    async showManageOccupiedTickets(interaction, page = 1) {
        const TICKETS_PER_PAGE = 10;
        const tickets = await db.getOccupiedTickets();
        
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Управление занятыми тикетами`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Занятых тикетов не найдено.`)
                .setColor(0x00ff00)
                .setTimestamp();
    
            return await interaction.update({
                embeds: [embed],
                components: []
            });
        }
    
        // Вычисляем пагинацию
        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
        const startIndex = (page - 1) * TICKETS_PER_PAGE;
        const endIndex = startIndex + TICKETS_PER_PAGE;
        const ticketsOnPage = tickets.slice(startIndex, endIndex);
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Управление занятыми тикетами`)
            .setDescription(`**Выберите тикет для управления:**\n\n📄 **Страница ${page} из ${totalPages}** | **Всего тикетов: ${tickets.length}**`)
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ text: `Показано тикетов: ${ticketsOnPage.length} из ${tickets.length} • Страница ${page}/${totalPages}` });
    
        const ticketOptions = [];
        
        for (const ticket of ticketsOnPage) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const creator = interaction.guild.members.cache.get(ticket.creator_id);
            const curator = interaction.guild.members.cache.get(ticket.curator_id);
            const statusEmoji = this.getStatusEmoji(ticket.status);
    
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_OCCUPIED} Тикет #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.USER} **Создатель:** ${creator ? creator.displayName : 'Неизвестно'}\n${CUSTOM_EMOJIS.CURATOR} **Куратор:** ${curator ? curator.displayName : 'Неизвестно'}\n${statusEmoji} **Статус:** ${ticket.status}\n${CUSTOM_EMOJIS.INFO} **Канал:** ${channel ? `<#${ticket.channel_id}>` : 'Удален'}`,
                inline: true
            });
    
            ticketOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Управлять #${ticket.ticket_number}`)
                    .setDescription(`Куратор: ${curator ? curator.displayName : 'Неизвестно'}`)
                    .setValue(`manage_ticket_${ticket.ticket_number}`)
                    .setEmoji(CUSTOM_EMOJIS.MANAGE)
            );
        }
    
        const components = [];
    
        // Добавляем select menu если есть тикеты
        if (ticketOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`manage_occupied_${interaction.user.id}`)
                .setPlaceholder('Выберите тикет для управления')
                .addOptions(ticketOptions);
            
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }
    
        // Добавляем кнопки пагинации если нужно
        if (totalPages > 1) {
            const navigationButtons = [];
    
            // ИСПРАВЛЕНИЕ: Уникальные custom_id для каждой кнопки
            if (page > 1) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_first_${interaction.user.id}_${Date.now()}`)
                        .setLabel('Первая')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏪')
                );
    
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_prev_${interaction.user.id}_${page - 1}`)
                        .setLabel('Назад')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('◀️')
                );
            }
    
            if (page < totalPages) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_next_${interaction.user.id}_${page + 1}`)
                        .setLabel('Вперед')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('▶️')
                );
    
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_last_${interaction.user.id}_${Date.now() + 1}`)
                        .setLabel('Последняя')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏩')
                );
            }
    
            if (navigationButtons.length > 0) {
                components.push(new ActionRowBuilder().addComponents(navigationButtons));
            }
        }
    
        await interaction.update({
            embeds: [embed],
            components: components
        });
    },

    async showManageArchivedTickets(interaction) {
        const hasAdminRole = ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!hasAdminRole) {
            return await interaction.update({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для просмотра архива!`,
                embeds: [],
                components: []
            });
        }

        const tickets = await db.getClosedTickets();
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.ARCHIVE} Архив тикетов`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Архив тикетов пуст.`)
                .setColor(0x666666)
                .setTimestamp();

            return await interaction.update({
                embeds: [embed],
                components: []
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.ARCHIVE} Архив тикетов`)
            .setDescription('**Закрытые тикеты (только просмотр):**')
            .setColor(0x666666)
            .setTimestamp()
            .setFooter({ text: `Архивных тикетов: ${tickets.length}` });

        for (const ticket of tickets.slice(0, 15)) {
            const creator = interaction.guild.members.cache.get(ticket.creator_id);
            const curator = ticket.curator_id ? interaction.guild.members.cache.get(ticket.curator_id) : null;

            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_CLOSED} Тикет #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.USER} **Создатель:** ${creator ? creator.displayName : 'Неизвестно'}\n${CUSTOM_EMOJIS.CURATOR} **Куратор:** ${curator ? curator.displayName : 'Не было'}\n${CUSTOM_EMOJIS.INFO} **Цель:** ${ticket.purpose.substring(0, 60)}${ticket.purpose.length > 60 ? '...' : ''}`,
                inline: true
            });
        }

        await interaction.update({
            embeds: [embed],
            components: []
        });
    },

    async handleAcceptTicket(interaction) {
        const ticketNumber = parseInt(interaction.values[0].split('_')[2]);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Подтверждение принятия тикета`)
            .setDescription(`${CUSTOM_EMOJIS.WARNING} **Вы уверены, что хотите принять тикет #${ticketNumber}?**\n\n${CUSTOM_EMOJIS.INFO} После принятия вы будете добавлены в канал игрока и сможете начать работу.`)
            .setColor(0xffa500)
            .setTimestamp()
            .setFooter({ text: `Тикет #${ticketNumber}` });

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_accept_${ticketNumber}`)
            .setLabel('Да, принять')
            .setStyle(ButtonStyle.Success)
            .setEmoji(CUSTOM_EMOJIS.ACCEPT);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_accept_${ticketNumber}`)
            .setLabel('Отменить')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(CUSTOM_EMOJIS.DECLINE);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },

    async cancelAcceptTicket(interaction) {
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.DECLINE} Принятие отменено`)
            .setDescription(`${CUSTOM_EMOJIS.INFO} Принятие тикета было отменено.`)
            .setColor(0xff6b6b)
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: []
        });
    },

    async handleCuratorStatusButton(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);

        if (!ticket || ticket.curator_id !== interaction.user.id) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Вы не являетесь куратором этого тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const statusOptions = [
            new StringSelectMenuOptionBuilder()
                .setLabel('В работе')
                .setValue('В работе')
                .setEmoji(CUSTOM_EMOJIS.TICKET_OCCUPIED),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ожидает ответа')
                .setValue('Ожидает ответа')
                .setEmoji(CUSTOM_EMOJIS.LOADING),
            new StringSelectMenuOptionBuilder()
                .setLabel('Приостановлен')
                .setValue('Приостановлен')
                .setEmoji(CUSTOM_EMOJIS.TICKET_PAUSED),
            new StringSelectMenuOptionBuilder()
                .setLabel('Почти готов')
                .setValue('Почти готов')
                .setEmoji(CUSTOM_EMOJIS.SUCCESS)
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`curator_change_status_${ticketNumber}`)
            .setPlaceholder('Выберите новый статус')
            .addOptions(statusOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.STATUS_CHANGE} Изменение статуса`)
            .setDescription(`Выберите новый статус для тикета **#${ticketNumber}**:`)
            .setColor(0x3498db);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },

    async handleCuratorStatusChange(interaction) {
        const parts = interaction.customId.split('_');
        const ticketNumber = parseInt(parts[3]);
        const newStatus = interaction.values[0];

        try {
            await db.updateTicketStatus(ticketNumber, newStatus);

            const ticket = await db.getTicketByNumber(ticketNumber);
            // РАБОТАЕМ С КАНАЛОМ ВМЕСТО ВЕТКИ
            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);

            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                const statusEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Статус обновлен`)
                    .setDescription(`${CUSTOM_EMOJIS.STATUS_CHANGE} Тикет **#${ticketNumber}** теперь имеет статус: **${newStatus}**`)
                    .setColor(this.getStatusColor(newStatus))
                    .setTimestamp();

                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.STATUS_CHANGE} **Статус тикета #${ticketNumber} изменен на "${newStatus}" куратором <@${interaction.user.id}>**`,
                    embeds: [statusEmbed]
                });
            }

            await interaction.reply({
                content: `${CUSTOM_EMOJIS.SUCCESS} Статус тикета #${ticketNumber} изменен на "${newStatus}"!`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при изменении статуса!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async handleCuratorCompleteButton(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);

        if (!ticket || ticket.curator_id !== interaction.user.id) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Вы не являетесь куратором этого тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`complete_ticket_modal_${ticketNumber}_${interaction.user.id}`)
            .setTitle(`Завершение тикета #${ticketNumber}`);

        const notesInput = new TextInputBuilder()
            .setCustomId('completion_notes')
            .setLabel('Заметки о выполненной работе')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(1000)
            .setPlaceholder('Опишите, что было сделано в рамках этого тикета...');

        const row = new ActionRowBuilder().addComponents(notesInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },

    async handleCuratorRating(interaction) {
        const parts = interaction.customId.split('_');
        const ticketNumber = parseInt(parts[2]);
        const reviewerId = parts[3];
        const rating = parseInt(parts[4]);

        if (interaction.user.id !== reviewerId) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете оценить только свой тикет!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || !ticket.curator_id) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Ошибка: тикет или куратор не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const hasReviewed = await db.hasUserReviewedTicket(ticketNumber, reviewerId);
        if (hasReviewed) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Вы уже оставили отзыв на этот тикет!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`review_comment_${ticketNumber}_${reviewerId}_${rating}`)
            .setTitle(`Оценка: ${CUSTOM_EMOJIS.STAR_FULL.repeat(rating)}`);

        const commentInput = new TextInputBuilder()
            .setCustomId('comment')
            .setLabel('Комментарий (необязательно)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500)
            .setPlaceholder('Поделитесь своим мнением о работе куратора...');

        const row = new ActionRowBuilder().addComponents(commentInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },

    async handleManageOccupied(interaction) {
        // ДОБАВЛЯЕМ ПРОВЕРКУ ПРАВ ДОСТУПА
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
        if (!hasHighAdminRole && !isSpecialUser) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для управления занятыми тикетами! Требуется роль высшей администрации.`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const ticketNumber = parseInt(interaction.values[0].split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);
        
        if (!ticket) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const statusButton = new ButtonBuilder()
            .setCustomId(`ticket_action_status_${ticketNumber}`)
            .setLabel('Изменить статус')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(CUSTOM_EMOJIS.STATUS_CHANGE);
        const expandButton = new ButtonBuilder()
            .setCustomId(`expand_ticket_admin_${ticketNumber}`)
            .setLabel('Раскрыть для админов')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🚨');
        const participantsButton = new ButtonBuilder()
            .setCustomId(`ticket_action_participants_${ticketNumber}`)
            .setLabel('Участники')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CUSTOM_EMOJIS.PARTICIPANTS);
    
        const curatorButton = new ButtonBuilder()
            .setCustomId(`ticket_action_curator_${ticketNumber}`)
            .setLabel('Сменить куратора')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(CUSTOM_EMOJIS.CURATOR);
    
        const closeButton = new ButtonBuilder()
            .setCustomId(`ticket_action_close_${ticketNumber}`)
            .setLabel('Закрыть')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(CUSTOM_EMOJIS.TICKET_CLOSED);
    
        const row = new ActionRowBuilder().addComponents(statusButton, participantsButton, curatorButton, expandButton, closeButton);
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.MANAGE} Управление тикетом #${ticket.ticket_number}`)
            .setDescription('**Выберите действие для управления тикетом:**\n\n👑 **Доступно только высшей администрации**')
            .setColor(this.getStatusColor(ticket.status))
            .addFields(
                { name: `${CUSTOM_EMOJIS.USER} Создатель`, value: `<@${ticket.creator_id}>`, inline: true },
                { name: `${CUSTOM_EMOJIS.CURATOR} Куратор`, value: ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не назначен', inline: true },
                { name: `${CUSTOM_EMOJIS.STATUS_CHANGE} Статус`, value: ticket.status, inline: true },
                {
                    name: `${CUSTOM_EMOJIS.INFO} Права доступа`,
                    value: `Управление занятыми тикетами доступно только пользователям с ролью высшей администрации.`,
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: `ID тикета: ${ticket.ticket_number} • Высшая администрация` });
    
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },
    

    async handleTicketAction(interaction) {
        // ДОБАВЛЯЕМ ПРОВЕРКУ ПРАВ ДОСТУПА ДЛЯ ВСЕХ ДЕЙСТВИЙ С ЗАНЯТЫМИ ТИКЕТАМИ
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
        
        if (!hasHighAdminRole && !isSpecialUser) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для выполнения этого действия! Требуется роль высшей администрации.`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const parts = interaction.customId.split('_');
        const action = parts[2];
        const ticketNumber = parseInt(parts[3]);
    
        switch (action) {
            case 'status':
                await this.showStatusChangeMenu(interaction, ticketNumber);
                break;
            case 'participants':
                await this.showParticipantsModal(interaction, ticketNumber);
                break;
            case 'curator':
                await this.showCuratorChangeMenu(interaction, ticketNumber);
                break;
            case 'close':
                await this.closeTicket(interaction, ticketNumber);
                break;
        }
    },
    
    async showStatusChangeMenu(interaction, ticketNumber) {
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
        
        if (!hasHighAdminRole && !isSpecialUser) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для изменения статуса тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const statusOptions = [
            new StringSelectMenuOptionBuilder()
                .setLabel('Ожидает куратора')
                .setValue('Ожидает куратора')
                .setEmoji(CUSTOM_EMOJIS.TICKET_PENDING),
            new StringSelectMenuOptionBuilder()
                .setLabel('В работе')
                .setValue('В работе')
                .setEmoji(CUSTOM_EMOJIS.TICKET_OCCUPIED),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ожидает ответа')
                .setValue('Ожидает ответа')
                .setEmoji(CUSTOM_EMOJIS.LOADING),
            new StringSelectMenuOptionBuilder()
                .setLabel('Завершен')
                .setValue('Завершен')
                .setEmoji(CUSTOM_EMOJIS.TICKET_COMPLETED),
            new StringSelectMenuOptionBuilder()
                .setLabel('Приостановлен')
                .setValue('Приостановлен')
                .setEmoji(CUSTOM_EMOJIS.TICKET_PAUSED)
        ];
    
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`status_change_${ticketNumber}_${interaction.user.id}`)
            .setPlaceholder('Выберите новый статус')
            .addOptions(statusOptions);
    
        const row = new ActionRowBuilder().addComponents(selectMenu);
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.STATUS_CHANGE} Изменение статуса`)
            .setDescription(`Выберите новый статус для тикета **#${ticketNumber}**:\n\n👑 **Действие доступно только высшей администрации**`)
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: 'Высшая администрация • Изменение статуса' });
    
        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },
    
    async showParticipantsModal(interaction, ticketNumber) {
        // ПРОВЕРКА ПРАВ ДОСТУПА
        const hasHighAdminRole = HIGH_ADMIN_ROLES.some(roleId => interaction.member.roles.cache.has(roleId));
        const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
        
        if (!hasHighAdminRole && !isSpecialUser) {
            return await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для управления участниками тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }
    
        const modal = new ModalBuilder()
            .setCustomId(`participants_modal_${ticketNumber}`)
            .setTitle(`Управление участниками тикета #${ticketNumber}`);
    
        const participantsInput = new TextInputBuilder()
            .setCustomId('participants')
            .setLabel('ID участников (через запятую)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500)
            .setPlaceholder('Например: 123456789, 987654321, 456789123');
    
        const row = new ActionRowBuilder().addComponents(participantsInput);
        modal.addComponents(row);
    
        await interaction.showModal(modal);
    },
    

    async showCuratorChangeMenu(interaction, ticketNumber) {
        const guild = interaction.guild;
        const curatorRoleId = CURATOR_ROLE_ID;
    
        try {
            // Принудительно загружаем всех участников сервера
            await guild.members.fetch();
            
            const curatorRole = guild.roles.cache.get(curatorRoleId);
            if (!curatorRole) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.ERROR} Роль куратора не найдена!`,
                    flags: MessageFlags.Ephemeral
                });
            }
    
            // ПОЛУЧАЕМ ВСЕХ КУРАТОРОВ (убираем ограничение в 24)
            const allCurators = curatorRole.members;
            
            if (allCurators.size === 0) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.WARNING} Нет участников с ролью куратора!`,
                    flags: MessageFlags.Ephemeral
                });
            }
    
            // Разбиваем кураторов на страницы по 23 (оставляем место для кнопки "Снять куратора")
            const curatorsArray = Array.from(allCurators.values());
            const totalPages = Math.ceil(curatorsArray.length / 23);
            
            await this.showCuratorPage(interaction, ticketNumber, curatorsArray, 1, totalPages);
    
        } catch (error) {
            console.error('Ошибка получения кураторов:', error);
            await interaction.reply({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при загрузке списка кураторов!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },
    
    async showCuratorPage(interaction, ticketNumber, curatorsArray, currentPage, totalPages) {
        const startIndex = (currentPage - 1) * 23;
        const endIndex = startIndex + 23;
        const curatorsOnPage = curatorsArray.slice(startIndex, endIndex);
    
        const curatorOptions = curatorsOnPage.map((curator, index) => {
            const globalIndex = startIndex + index + 1;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${globalIndex}. ${curator.displayName}`)
                .setDescription(`ID: ${curator.id} | Статус: ${this.getStatusText(curator.presence?.status || 'offline')}`)
                .setValue(curator.id)
                .setEmoji(CUSTOM_EMOJIS.CURATOR);
        });
    
        // Добавляем опцию для снятия куратора
        curatorOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel('🚫 Снять куратора')
                .setDescription('Убрать куратора с тикета')
                .setValue('remove_curator')
                .setEmoji(CUSTOM_EMOJIS.DECLINE)
        );
    
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`curator_assign_${ticketNumber}`)
            .setPlaceholder(`Выберите куратора (стр. ${currentPage}/${totalPages})`)
            .addOptions(curatorOptions);
    
        const components = [new ActionRowBuilder().addComponents(selectMenu)];
    
        // Добавляем кнопки пагинации если страниц больше 1
        if (totalPages > 1) {
            const navigationButtons = [];
    
            if (currentPage > 1) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`curator_page_${ticketNumber}_${currentPage - 1}`)
                        .setLabel('◀️ Назад')
                        .setStyle(ButtonStyle.Primary)
                );
            }
    
            navigationButtons.push(
                new ButtonBuilder()
                    .setCustomId(`curator_info_${ticketNumber}`)
                    .setLabel(`${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
    
            if (currentPage < totalPages) {
                navigationButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`curator_page_${ticketNumber}_${currentPage + 1}`)
                        .setLabel('Вперед ▶️')
                        .setStyle(ButtonStyle.Primary)
                );
            }
    
            components.push(new ActionRowBuilder().addComponents(navigationButtons));
        }
    
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.CURATOR} Смена куратора`)
            .setDescription(`**Тикет #${ticketNumber}**\n\n${CUSTOM_EMOJIS.INFO} Выберите нового куратора из списка:`)
            .addFields(
                {
                    name: `${CUSTOM_EMOJIS.INFO} Всего кураторов`,
                    value: curatorsArray.length.toString(),
                    inline: true
                },
                {
                    name: `${CUSTOM_EMOJIS.INFO} Страница`,
                    value: `${currentPage} из ${totalPages}`,
                    inline: true
                },
                {
                    name: `${CUSTOM_EMOJIS.INFO} На странице`,
                    value: curatorsOnPage.length.toString(),
                    inline: true
                }
            )
            .setColor(0x3498db)
            .setTimestamp();
    
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                embeds: [embed],
                components: components
            });
        } else {
            await interaction.reply({
                embeds: [embed],
                components: components,
                flags: MessageFlags.Ephemeral
            });
        }
    },
    


    getStatusText(status) {
        const statusTexts = {
            'online': 'В сети',
            'idle': 'Не активен',
            'dnd': 'Не беспокоить',
            'offline': 'Не в сети'
        };
        return statusTexts[status] || 'Не в сети';
    }
};
