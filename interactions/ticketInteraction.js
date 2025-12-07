const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags, ChannelType } = require('discord.js');
const Database = require('../database');
const db = new Database();

const CURATOR_ROLE_ID = '1382005661369368586';
const SPECIAL_USER_ID = '416602253160480769';
const ADMIN_ROLES = ['1382006178451685377', '1382005661369368586'];
const HIGH_ADMIN_ROLES = ['1382006799028322324'];
const ADMIN_PING_ROLE_ID = '1382005661369368586';
const TICKET_CATEGORY_ID = '1382492043216949359';

const { TicketLogger, TICKET_ACTION_TYPES } = require('../utils/ticketLogger');

const CUSTOM_EMOJIS = {
    TICKET_FREE: '<:emptybox:1396816640196476998>',
    TICKET_OCCUPIED: '<:Lock:1396817745399644270>',
    TICKET_COMPLETED: '<:Tick:1396822406751981702>',
    TICKET_PENDING: '<:PokemonTCGPWonderHourglass:1396822944252039268>',
    TICKET_PAUSED: '<:Pause:1396823161512919141>',
    TICKET_CLOSED: '<:Incorrect:1396823239669448845>',
    CURATOR: '<:chief:1396827256596467742>',
    USER: '<:user:1396827248098545726>',
    ADMIN: '<:rubine:1396827267769962567>',
    ACCEPT: '<:Tick:1396822406751981702>',
    DECLINE: '<:Incorrect:1396823239669448845>',
    MANAGE: '⚙️',
    ARCHIVE: '📦',
    STATUS_CHANGE: '🔄',
    PARTICIPANTS: '👥',
    STAR_EMPTY: '<:star:1396814932397396048>',
    STAR_FULL: '<:starf:1396828897244610590>',
    STAR_HALF: '<:starh:1396828886939074710>',
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
    PLAYER_GREETING: 'https://cdn.discordapp.com/attachments/1383161274896220231/1396839686911299754/Slide_16_9_-_5.png',
    MANAGEMENT_PANEL: 'https://media.discordapp.net/attachments/1383161274896220231/1396839688014401598/Slide_16_9_-_4.png',
    SELECT_MENU: 'https://media.discordapp.net/attachments/1383161274896220231/1396839686911299754/Slide_16_9_-_5.png'
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

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============
function isAdmin(member) {
    return ADMIN_ROLES.some(roleId => member.roles.cache.has(roleId)) || member.id === SPECIAL_USER_ID;
}

function isHighAdmin(member) {
    return HIGH_ADMIN_ROLES.some(roleId => member.roles.cache.has(roleId)) || member.id === SPECIAL_USER_ID;
}

function isCurator(member) {
    return member.roles.cache.has(CURATOR_ROLE_ID) || isAdmin(member);
}

function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    return CUSTOM_EMOJIS.STAR_FULL.repeat(fullStars) +
           (hasHalfStar ? CUSTOM_EMOJIS.STAR_HALF : '') +
           CUSTOM_EMOJIS.STAR_EMPTY.repeat(emptyStars);
}

function getMedalEmoji(index) {
    const medals = [CUSTOM_EMOJIS.MEDAL_GOLD, CUSTOM_EMOJIS.MEDAL_SILVER, CUSTOM_EMOJIS.MEDAL_BRONZE];
    return medals[index] || CUSTOM_EMOJIS.TROPHY;
}

function getStatusEmoji(status) {
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
}

function getStatusColor(status) {
    return STATUS_COLORS[status] || 0x808080;
}

function getStatusText(status) {
    const statusTexts = {
        'online': '🟢 В сети',
        'idle': '🟡 Не активен',
        'dnd': '🔴 Не беспокоить',
        'offline': '⚪ Не в сети'
    };
    return statusTexts[status] || '⚪ Не в сети';
}

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
        throw error;
    }
}

module.exports = {
    canHandle(interaction) {
        return (
            interaction.isStringSelectMenu() && (
                interaction.customId.startsWith('ticket_main_menu_') || // Новое главное меню
                interaction.customId.startsWith('ticket_action_menu_') || // SelectMenu действий с тикетом
                interaction.customId.startsWith('ticket_menu_') ||
                interaction.customId.startsWith('ticket_category_') ||
                interaction.customId.startsWith('accept_ticket') ||
                interaction.customId.startsWith('manage_occupied_') ||
                interaction.customId.startsWith('curator_assign_') ||
                interaction.customId.startsWith('status_change_') ||
                interaction.customId.startsWith('curator_change_status_')
            )
        ) || (
            interaction.isButton() && (
                interaction.customId.startsWith('ticket_menu_') || // Components V2 buttons
                interaction.customId.startsWith('take_ticket_') ||
                interaction.customId.startsWith('ticket_action_') ||
                interaction.customId.startsWith('confirm_accept_') ||
                interaction.customId.startsWith('cancel_accept_') ||
                interaction.customId.startsWith('curator_status_') ||
                interaction.customId.startsWith('curator_complete_') ||
                interaction.customId.startsWith('curator_close_') ||
                interaction.customId.startsWith('rate_curator_') ||
                interaction.customId.startsWith('reset_cooldown_') ||
                interaction.customId.startsWith('view_cooldown_users_') ||
                interaction.customId.startsWith('view_curator_ratings_') ||
                interaction.customId.startsWith('free_tickets_') ||
                interaction.customId.startsWith('occupied_tickets_') ||
                interaction.customId.startsWith('expand_ticket_admin_') ||
                interaction.customId.startsWith('curator_page_') ||
                interaction.customId.startsWith('searchticket')
            )
        ) || (
            interaction.isModalSubmit() && (
                interaction.customId.startsWith('participants_modal_')
            )
            
        );
    },

    async execute(interaction) {
        try {
            // SELECT MENU
            if (interaction.isStringSelectMenu()) {
                // Новое главное меню
                if (interaction.customId.startsWith('ticket_main_menu_')) {
                    await this.handleMainMenu(interaction);
                } else if (interaction.customId.startsWith('ticket_action_menu_')) {
                    // SelectMenu действий с тикетом
                    await this.handleTicketActionMenu(interaction);
                } else if (interaction.customId.startsWith('ticket_menu_')) {
                    await this.handleTicketMenu(interaction);
                } else if (interaction.customId.startsWith('ticket_category_')) {
                    await this.handleTicketCategory(interaction);
                } else if (interaction.customId.startsWith('accept_ticket')) {
                    await this.handleAcceptTicket(interaction);
                } else if (interaction.customId.startsWith('manage_occupied_')) {
                    await this.handleManageOccupied(interaction);
                } else if (interaction.customId.startsWith('curator_assign_')) {
                    await this.handleCuratorAssign(interaction);
                } else if (interaction.customId.startsWith('review_comment_')) {
                    await this.handleReviewCommentModal(interaction);
                } else if (interaction.customId.startsWith('status_change_')) {
                    await this.handleStatusChange(interaction);
                } else if (interaction.customId.startsWith('curator_change_status_')) {
                    await this.handleCuratorStatusChange(interaction);
                }
            }
            // BUTTONS
            else if (interaction.isButton()) {
                // Components V2 ticket menu buttons (format: ticket_menu_{userId}:action)
                if (interaction.customId.startsWith('ticket_menu_') && interaction.customId.includes(':')) {
                    await this.handleTicketMenuButton(interaction);
                } else if (interaction.customId.startsWith('take_ticket_')) {
                    await this.handleTakeTicket(interaction);
                } else if (interaction.customId.startsWith('ticket_action_')) {
                    await this.handleTicketAction(interaction);
                } else if (interaction.customId.startsWith('confirm_accept_')) {
                    await this.confirmAcceptTicket(interaction);
                } else if (interaction.customId.startsWith('cancel_accept_')) {
                    await this.cancelAcceptTicket(interaction);
                } else if (interaction.customId.startsWith('curator_status_')) {
                    await this.handleCuratorStatusButton(interaction);
                } else if (interaction.customId.startsWith('curator_complete_')) {
                    await this.handleCuratorCompleteButton(interaction);
                } else if (interaction.customId.startsWith('curator_close_')) {
                    await this.handleCuratorCloseButton(interaction);
                } else if (interaction.customId.startsWith('rate_curator_')) {
                    await this.handleCuratorRating(interaction);
                } else if (interaction.customId.startsWith('reset_cooldown_')) {
                    await this.showCooldownResetModal(interaction);
                } else if (interaction.customId.startsWith('view_cooldown_users_')) {
                    await this.showUsersWithCooldown(interaction);
                } else if (interaction.customId.startsWith('view_curator_ratings_')) {
                    await this.showCuratorRatings(interaction);
                } else if (interaction.customId.startsWith('expand_ticket_admin_')) {
                    await this.handleExpandTicketForAdmin(interaction);
                } else if (interaction.customId.startsWith('curator_page_')) {
                    const parts = interaction.customId.split('_');
                    const ticketNumber = parseInt(parts[2]);
                    const newPage = parseInt(parts[3]);
                    await this.handleCuratorPagination(interaction, ticketNumber, newPage);
                } else if (interaction.customId.startsWith('searchticket')) {
                    await this.showSearchTicketModal(interaction);
                } else if (interaction.customId.startsWith('free_tickets_')) {
                    await this.handleFreeTicketsPagination(interaction);
                } else if (interaction.customId.startsWith('occupied_tickets_')) {
                    await this.handleOccupiedTicketsPagination(interaction);
                }
            }
            // MODALS
            else if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('participants_modal_')) {
                    await this.handleParticipantsModal(interaction);
                } else if (interaction.customId.startsWith('complete_ticket_modal_')) {
                    await this.handleCompleteTicketModal(interaction);
                }
            }
        } catch (error) {
            console.error('Ошибка в обработчике тикетов:', error);
            if (!interaction.replied && !interaction.deferred) {
                await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при обработке запроса!`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },
async handleReviewCommentModal(interaction) {
    const parts = interaction.customId.split('_');
    const ticketNumber = parseInt(parts[2]);
    const reviewerId = parts[3];
    const rating = parseInt(parts[4]);
    const comment = interaction.fields.getTextInputValue('comment');

    try {
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || !ticket.curator_id) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Ошибка: тикет или куратор не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Сохраняем отзыв
        await db.addCuratorReview(ticketNumber, ticket.curator_id, reviewerId, rating, comment);

        const starRating = generateStarRating(rating);
        const successEmbed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Спасибо за отзыв!`)
            .setDescription(`${starRating}\n\n${CUSTOM_EMOJIS.INFO} Ваша оценка куратора <@${ticket.curator_id}> сохранена!`)
            .setColor(0x32cd32)
            .setTimestamp();

        if (comment) {
            successEmbed.addFields({
                name: '💬 Ваш комментарий',
                value: comment,
                inline: false
            });
        }

        await safeReply(interaction, {
            embeds: [successEmbed],
            flags: MessageFlags.Ephemeral
        });

        // Уведомляем куратора
        try {
            const curator = await interaction.client.users.fetch(ticket.curator_id);
            const curatorEmbed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.STAR_FULL} Вы получили новый отзыв!`)
                .setDescription(`Пользователь <@${reviewerId}> оценил вашу работу в тикете #${ticketNumber}`)
                .addFields(
                    { name: '⭐ Оценка', value: starRating, inline: true },
                    { name: '🎫 Тикет', value: `#${ticketNumber}`, inline: true }
                )
                .setColor(0xffd700)
                .setTimestamp();

            if (comment) {
                curatorEmbed.addFields({
                    name: '💬 Комментарий',
                    value: comment,
                    inline: false
                });
            }

            await curator.send({ embeds: [curatorEmbed] });
        } catch (error) {
            console.log('Не удалось отправить уведомление куратору:', error.message);
        }

    } catch (error) {
        console.error('Ошибка сохранения отзыва:', error);
        await safeReply(interaction, {
            content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при сохранении отзыва!`,
            flags: MessageFlags.Ephemeral
        });
    }
},

async handleCompleteTicketModal(interaction) {
    const parts = interaction.customId.split('_');
    const ticketNumber = parseInt(parts[3]);
    const completionNotes = interaction.fields.getTextInputValue('completion_notes');

    try {
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Обновляем статус на "Завершен"
        await db.updateTicketStatus(ticketNumber, 'Завершен');

        // КД на всех участников
        const participantsSet = new Set();
        if (ticket.creator_id) participantsSet.add(ticket.creator_id);
        if (ticket.participants) {
            ticket.participants.split(',').map(id => id.trim()).filter(Boolean).forEach(id => participantsSet.add(id));
        }

        for (const userId of participantsSet) {
            try {
                await db.setTicketCooldownOnCompletion(userId);
            } catch (err) {
                console.error('Ошибка установки КД для', userId, err);
            }
        }

        const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
        if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
            const completionEmbed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_COMPLETED} Тикет завершён`)
                .setDescription(`Тикет #${ticketNumber} успешно завершён куратором ${interaction.user}`)
                .addFields(
                    { name: `${CUSTOM_EMOJIS.USER} Создатель`, value: `<@${ticket.creator_id}>`, inline: true },
                    { name: `${CUSTOM_EMOJIS.CURATOR} Куратор`, value: ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не назначен', inline: true },
                    { name: `${CUSTOM_EMOJIS.INFO} Статус`, value: 'Завершен', inline: true }
                )
                .setColor(STATUS_COLORS['Завершен'])
                .setTimestamp();

            if (completionNotes) {
                completionEmbed.addFields({
                    name: '📝 Заметки куратора',
                    value: completionNotes,
                    inline: false
                });
            }

            completionEmbed.addFields({
                name: '⏰ Информация о кулдауне',
                value: `${CUSTOM_EMOJIS.WARNING} Участники тикета могут создать новый тикет через **72 часа** (3 дня)`,
                inline: false
            });

            await ticketChannel.send({
                content: `${CUSTOM_EMOJIS.TICKET_COMPLETED} **Тикет #${ticketNumber} завершён!**\n\n${CUSTOM_EMOJIS.INFO} Куратор: ${interaction.user}`,
                embeds: [completionEmbed]
            });

            // Показываем кнопки оценки куратора создателю и участникам
            if (ticket.curator_id) {
                const ratingButtons = [];
                for (let i = 1; i <= 5; i++) {
                    ratingButtons.push(
                        new ButtonBuilder()
                            .setCustomId(`rate_curator_${ticketNumber}_${ticket.creator_id}_${i}`)
                            .setLabel(`${i} ${CUSTOM_EMOJIS.STAR_FULL}`)
                            .setStyle(i <= 2 ? ButtonStyle.Danger : i <= 3 ? ButtonStyle.Secondary : i === 4 ? ButtonStyle.Primary : ButtonStyle.Success)
                    );
                }

                const ratingRow = new ActionRowBuilder().addComponents(ratingButtons);

                const ratingEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.STAR_FULL} Оцените работу куратора`)
                    .setDescription(`${CUSTOM_EMOJIS.INFO} Пожалуйста, оцените работу куратора <@${ticket.curator_id}> по 5-балльной шкале.\n\nВаша оценка поможет улучшить качество работы с тикетами!`)
                    .setColor(0xffd700)
                    .setTimestamp();

                await ticketChannel.send({
                    content: `<@${ticket.creator_id}>`,
                    embeds: [ratingEmbed],
                    components: [ratingRow]
                });
            }

            // Удаляем канал через 60 секунд
            setTimeout(async () => {
                try {
                    await ticketChannel.delete(`Завершение тикета #${ticketNumber}`);
                    console.log(`✅ Канал тикета #${ticketNumber} удалён после завершения`);
                } catch (deleteError) {
                    console.error('Ошибка удаления канала:', deleteError);
                }
            }, 60_000);
        }

        // Лог
        await TicketLogger.logTicketAction(interaction.client, {
            admin_id: interaction.user.id,
            action_type: TICKET_ACTION_TYPES.TICKET_COMPLETED,
            ticket_number: ticketNumber,
            target_user_id: ticket.creator_id,
            details: { 
                curator_id: ticket.curator_id,
                completion_notes: completionNotes,
                cooldown_hours: 72
            },
            success: true,
            channel_id: ticket.channel_id,
            guild_id: interaction.guildId
        });

        const successEmbed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Тикет успешно завершён!`)
            .setDescription(`${CUSTOM_EMOJIS.TICKET_COMPLETED} Тикет #${ticketNumber} помечен как завершённый.\n\n${CUSTOM_EMOJIS.INFO} Канал будет удалён через 60 секунд.\n${CUSTOM_EMOJIS.WARNING} Участники получили кулдаун 72 часа (3 дня).`)
            .setColor(0x32cd32)
            .setTimestamp();

        await safeReply(interaction, {
            embeds: [successEmbed],
            flags: MessageFlags.Ephemeral
        });

    } catch (error) {
        console.error('Ошибка завершения тикета:', error);
        await safeReply(interaction, {
            content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка при завершении тикета!`,
            flags: MessageFlags.Ephemeral
        });
    }
},

    // ========== ОБРАБОТКА ГЛАВНОГО МЕНЮ (SELECTMENU) ==========
    async handleMainMenu(interaction) {
        const userId = interaction.customId.replace('ticket_main_menu_', '');
        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedValue = interaction.values[0];
        
        switch (selectedValue) {
            case 'create_ticket':
                await this.handleCreateTicket(interaction);
                break;
            case 'my_tickets':
                await this.showUserTickets(interaction);
                break;
            case 'search_ticket':
                await this.showSearchTicketModal(interaction);
                break;
            case 'ticket_help':
                await this.showTicketHelp(interaction);
                break;
            case 'manage_free':
                await this.showManageFreeTickets(interaction);
                break;
            case 'manage_occupied':
                await this.showManageOccupiedTickets(interaction);
                break;
            case 'manage_all':
                await this.showAllTickets(interaction);
                break;
            case 'curator_stats':
                await this.showCuratorRatings(interaction);
                break;
            case 'manage_users':
                await this.showUserManagement(interaction);
                break;
            case 'system_settings':
                await this.showSystemSettings(interaction);
                break;
            default:
                await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Неизвестное действие!`,
                    flags: MessageFlags.Ephemeral
                });
        }
    },

    // ========== ПОМОЩЬ ПО ТИКЕТАМ ==========
    async showTicketHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.INFO} Справка по системе тикетов`)
            .setDescription(`
**🎫 Что такое тикет?**
Тикет - это заявка на работу с вашим персонажем. Куратор возьмёт тикет и поможет вам.

**📝 Как создать тикет:**
1. Выберите "Создать тикет" в меню
2. Укажите цель тикета и ID персонажей
3. Дождитесь, пока куратор возьмёт тикет

**⏰ Кулдаун:**
После завершения тикета вы не сможете создать новый в течение **72 часов** (3 дня).

**📋 Статусы тикетов:**
• ${CUSTOM_EMOJIS.TICKET_PENDING} **Ожидает куратора** - тикет ещё не взят
• ${CUSTOM_EMOJIS.TICKET_OCCUPIED} **В работе** - куратор работает над тикетом
• ${CUSTOM_EMOJIS.LOADING} **Ожидает ответа** - ждём вашего ответа
• ${CUSTOM_EMOJIS.SUCCESS} **Почти готов** - тикет почти завершён
• ${CUSTOM_EMOJIS.TICKET_PAUSED} **Приостановлен** - работа временно приостановлена
• ${CUSTOM_EMOJIS.TICKET_COMPLETED} **Завершён** - работа окончена
• ${CUSTOM_EMOJIS.TICKET_CLOSED} **Закрыт** - тикет принудительно закрыт
            `)
            .setColor(0x3498db)
            .setTimestamp();

        await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
    },

    // ========== НАСТРОЙКИ СИСТЕМЫ (ДЛЯ ВЫСШИХ АДМИНОВ) ==========
    async showSystemSettings(interaction) {
        if (!isHighAdmin(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет доступа к настройкам!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Получаем статистику
        let freeCount = 0, occupiedCount = 0, totalCount = 0;
        try {
            const freeTickets = await db.getFreeTickets();
            const occupiedTickets = await db.getOccupiedTickets();
            freeCount = freeTickets?.length || 0;
            occupiedCount = occupiedTickets?.length || 0;
            totalCount = freeCount + occupiedCount;
        } catch (e) {}

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.MANAGE} Настройки системы тикетов`)
            .setDescription(`
**📊 Текущая статистика:**
• Всего открытых: **${totalCount}**
• Свободных: **${freeCount}**
• В работе: **${occupiedCount}**

**⚙️ Текущие настройки:**
• Кулдаун: **72 часа (3 дня)**
• Макс. активных тикетов: **1**
• Авто-удаление: **Включено**

**🔧 Управление:**
Для изменения настроек отредактируйте \`ticketConfig.json\`
            `)
            .setColor(0xe74c3c)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`reset_cooldown_${interaction.user.id}`)
                .setLabel('Сбросить КД пользователю')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId(`view_cooldown_users_${interaction.user.id}`)
                .setLabel('Пользователи с КД')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥')
        );

        await safeReply(interaction, { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    },

    // ========== ОБРАБОТКА ГЛАВНОГО МЕНЮ (КНОПКИ V2) ==========
    async handleTicketMenuButton(interaction) {
        // Format: ticket_menu_{userId}:action
        const [prefix, userId, actionPart] = interaction.customId.split(':')[0].split('_').slice(0, 3).concat(interaction.customId.split(':')[1]);
        const realUserId = interaction.customId.split('_')[2].split(':')[0];
        const action = interaction.customId.split(':')[1];

        if (interaction.user.id !== realUserId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        switch (action) {
            case 'create_ticket':
                await this.handleCreateTicket(interaction);
                break;
            case 'my_tickets':
                await this.showUserTickets(interaction);
                break;
            case 'manage_tickets':
                await this.showAllTickets(interaction);
                break;
            case 'manage_users':
                await this.showUserManagement(interaction);
                break;
            default:
                await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Неизвестное действие!`,
                    flags: MessageFlags.Ephemeral
                });
        }
    },

    // ========== ОБРАБОТКА ГЛАВНОГО МЕНЮ (SELECT MENU LEGACY) ==========
    async handleTicketMenu(interaction) {
        const userId = interaction.customId.split('_')[2];
        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedValue = interaction.values[0];
        switch (selectedValue) {
            case 'create_ticket':
                await this.handleCreateTicket(interaction);
                break;
            case 'my_tickets':
                await this.showUserTickets(interaction);
                break;
            case 'manage_tickets':
                await this.showAllTickets(interaction);
                break;
            case 'manage_users':
                await this.showUserManagement(interaction);
                break;
        }
    },

    async handleCreateTicket(interaction) {
        try {
            const activeTickets = await db.getUserActiveTickets(interaction.user.id);
            if (activeTickets.length > 0) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} У вас уже есть активный тикет!\n\n📋 **Активные тикеты:**\n${activeTickets.map(t => `• Тикет #${t.ticket_number} (${t.status})`).join('\n')}`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверка прав (кураторы/админы могут создавать без КД)
            if (!isCurator(interaction.member)) {
                const cooldownHours = await db.getCooldownHours(interaction.user.id);
                if (cooldownHours > 0) {
                    return await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.ERROR} Вы можете создать следующий тикет через **${cooldownHours} часов**!\n⏰ Кулдаун между тикетами: 72 часа (3 дня).`,
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            await this.showCreateTicketModal(interaction);
        } catch (error) {
            console.error('Ошибка создания тикета:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async showCreateTicketModal(interaction) {
        const characters = await db.getAllCharactersByUserId(interaction.user.id);
        if (characters.length === 0) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет персонажей!`,
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
            .setPlaceholder('Опишите, что нужно сделать...');

        const characterInput = new TextInputBuilder()
            .setCustomId('character_ids')
            .setLabel('ID персонажей (через запятую)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200)
            .setPlaceholder('Например: 123, 456')
            .setValue(characters.map(c => c.id).join(', '));

        modal.addComponents(
            new ActionRowBuilder().addComponents(purposeInput),
            new ActionRowBuilder().addComponents(characterInput)
        );

        await interaction.showModal(modal);
    },

    // ========== ПРОСМОТР ТИКЕТОВ ==========
    async showUserTickets(interaction) {
        const tickets = await db.getUserTickets(interaction.user.id);
        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_FREE} Ваши тикеты`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} У вас пока нет тикетов.`)
                .setColor(0x3498db)
                .setTimestamp();
            return await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.USER} Ваши тикеты`)
            .setDescription(`${CUSTOM_EMOJIS.INFO} Показаны последние 10 тикетов.`)
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: `Всего тикетов: ${tickets.length}` });

        for (const ticket of tickets.slice(0, 10)) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const statusEmoji = getStatusEmoji(ticket.status);
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_FREE} #${ticket.ticket_number}`,
                value: [
                    `${statusEmoji} Статус: ${ticket.status}`,
                    `${CUSTOM_EMOJIS.CURATOR} Куратор: ${ticket.curator_id ? `<@${ticket.curator_id}>` : '—'}`,
                    `${CUSTOM_EMOJIS.INFO} Канал: ${channel ? `<#${ticket.channel_id}>` : 'Удалён'}`
                ].join('\n'),
                inline: true
            });
        }

        await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
    },

    async showAllTickets(interaction) {
        if (!isCurator(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Только кураторы могут управлять тикетами!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.MANAGE} Панель управления тикетами`)
            .setDescription('Выберите категорию тикетов или найдите тикет по номеру:')
            .addFields(
                { name: `${CUSTOM_EMOJIS.TICKET_FREE} Свободные`, value: 'Тикеты без куратора', inline: true },
                { name: `${CUSTOM_EMOJIS.TICKET_OCCUPIED} Занятые`, value: 'Тикеты с куратором', inline: true },
                { name: `🔍 Поиск`, value: 'Найти тикет по номеру', inline: true }
            )
            .setColor(0xe74c3c)
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`ticket_category_${interaction.user.id}`)
            .setPlaceholder('Выберите категорию')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Свободные тикеты')
                    .setValue('free_tickets')
                    .setEmoji(CUSTOM_EMOJIS.TICKET_FREE),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Занятые тикеты')
                    .setValue('occupied_tickets')
                    .setEmoji(CUSTOM_EMOJIS.TICKET_OCCUPIED)
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        // Кнопка поиска тикета по номеру
        const searchButton = new ButtonBuilder()
            .setCustomId(`searchticket_${interaction.user.id}`)
            .setLabel('Поиск по номеру')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔍');
        
        const buttonRow = new ActionRowBuilder().addComponents(searchButton);

        await safeReply(interaction, { embeds: [embed], components: [row, buttonRow], flags: MessageFlags.Ephemeral });
    },

    async handleTicketCategory(interaction) {
        const selectedValue = interaction.values[0];
        if (selectedValue === 'free_tickets') {
            await this.showManageFreeTickets(interaction, 1);
        } else if (selectedValue === 'occupied_tickets') {
            await this.showManageOccupiedTickets(interaction, 1);
        }
    },

    // ========== ПАГИНАЦИЯ СВОБОДНЫХ ТИКЕТОВ ==========
    async handleFreeTicketsPagination(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[2]; // first, prev, next, last
        const userAndPage = parts[3]; // "userId:page"
        const [userId, pageStr] = userAndPage.split(':');

        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        let page = 1;
        if (action === 'first') {
            page = 1;
        } else if (action === 'last') {
            const tickets = await db.getFreeTickets();
            page = Math.ceil(tickets.length / 10);
        } else {
            page = parseInt(pageStr) || 1;
        }

        await this.showManageFreeTickets(interaction, page);
    },

    async showManageFreeTickets(interaction, page = 1) {
        const TICKETS_PER_PAGE = 10;
        const tickets = await db.getFreeTickets();

        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_FREE} Свободные тикеты`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Сейчас нет свободных тикетов.`)
                .setColor(0xffa500)
                .setTimestamp();
            return await interaction.update({ embeds: [embed], components: [] });
        }

        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const startIndex = (page - 1) * TICKETS_PER_PAGE;
        const endIndex = startIndex + TICKETS_PER_PAGE;
        const ticketsOnPage = tickets.slice(startIndex, endIndex);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.TICKET_FREE} Свободные тикеты`)
            .setDescription(`Страница ${page}/${totalPages}, всего: ${tickets.length}`)
            .setColor(0xffa500)
            .setTimestamp()
            .setFooter({ text: `Показано: ${ticketsOnPage.length} из ${tickets.length} (стр. ${page}/${totalPages})` });

        const ticketOptions = [];
        for (const ticket of ticketsOnPage) {
            const creator = interaction.guild.members.cache.get(ticket.creator_id);
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_FREE} #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.USER} Создатель: ${creator ? creator.displayName : ticket.creator_id}\n${CUSTOM_EMOJIS.INFO} ${ticket.purpose.substring(0, 100)}...`,
                inline: true
            });

            ticketOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`#${ticket.ticket_number}`)
                    .setDescription(creator ? creator.displayName : ticket.creator_id)
                    .setValue(`ticket_${ticket.ticket_number}`)
                    .setEmoji(CUSTOM_EMOJIS.ACCEPT)
            );
        }

        const components = [];
        if (ticketOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`accept_ticket:${interaction.user.id}`)
                .setPlaceholder('Выберите тикет для принятия')
                .addOptions(ticketOptions);
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Кнопки пагинации
        if (totalPages > 1) {
            const navButtons = [];
            if (page > 1) {
                navButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_first_${interaction.user.id}:1`)
                        .setLabel('⏮ Первая')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_prev_${interaction.user.id}:${page - 1}`)
                        .setLabel('◀ Назад')
                        .setStyle(ButtonStyle.Primary)
                );
            }
            if (page < totalPages) {
                navButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_next_${interaction.user.id}:${page + 1}`)
                        .setLabel('Вперёд ▶')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`free_tickets_last_${interaction.user.id}:${totalPages}`)
                        .setLabel('⏭ Последняя')
                        .setStyle(ButtonStyle.Secondary)
                );
            }
            if (navButtons.length > 0) {
                components.push(new ActionRowBuilder().addComponents(navButtons));
            }
        }

        await interaction.update({ embeds: [embed], components });
    },

    // ========== ПАГИНАЦИЯ ЗАНЯТЫХ ТИКЕТОВ ==========
    async handleOccupiedTicketsPagination(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[2]; // first, prev, next, last
        const userId = parts[3];

        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        let page = 1;
        if (action === 'first') {
            page = 1;
        } else if (action === 'last') {
            const tickets = await db.getOccupiedTickets();
            page = Math.ceil(tickets.length / 10);
        } else {
            page = parseInt(parts[4]) || 1;
        }

        await this.showManageOccupiedTickets(interaction, page);
    },

    async showManageOccupiedTickets(interaction, page = 1) {
        const TICKETS_PER_PAGE = 10;
        const tickets = await db.getOccupiedTickets();

        if (tickets.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Занятые тикеты`)
                .setDescription(`${CUSTOM_EMOJIS.INFO} Занятых тикетов не найдено.`)
                .setColor(0x00ff00)
                .setTimestamp();
            return await interaction.update({ embeds: [embed], components: [] });
        }

        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const startIndex = (page - 1) * TICKETS_PER_PAGE;
        const endIndex = startIndex + TICKETS_PER_PAGE;
        const ticketsOnPage = tickets.slice(startIndex, endIndex);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.TICKET_OCCUPIED} Занятые тикеты`)
            .setDescription(`Страница ${page}/${totalPages} | Всего: ${tickets.length}`)
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ text: `Показано: ${ticketsOnPage.length} из ${tickets.length} • Страница ${page}/${totalPages}` });

        const ticketOptions = [];
        for (const ticket of ticketsOnPage) {
            const curator = interaction.guild.members.cache.get(ticket.curator_id);
            const statusEmoji = getStatusEmoji(ticket.status);
            embed.addFields({
                name: `${CUSTOM_EMOJIS.TICKET_OCCUPIED} #${ticket.ticket_number}`,
                value: `${CUSTOM_EMOJIS.CURATOR} Куратор: ${curator ? curator.displayName : 'Неизвестно'}\n${statusEmoji} Статус: ${ticket.status}`,
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
        if (ticketOptions.length > 0) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`manage_occupied_${interaction.user.id}`)
                .setPlaceholder('Выберите тикет для управления')
                .addOptions(ticketOptions);
            components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        // Кнопки пагинации
        if (totalPages > 1) {
            const navButtons = [];
            if (page > 1) {
                navButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_first_${interaction.user.id}_1`)
                        .setLabel('⏮ Первая')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_prev_${interaction.user.id}_${page - 1}`)
                        .setLabel('◀ Назад')
                        .setStyle(ButtonStyle.Primary)
                );
            }
            if (page < totalPages) {
                navButtons.push(
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_next_${interaction.user.id}_${page + 1}`)
                        .setLabel('Вперёд ▶')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`occupied_tickets_last_${interaction.user.id}_${totalPages}`)
                        .setLabel('⏭ Последняя')
                        .setStyle(ButtonStyle.Secondary)
                );
            }
            if (navButtons.length > 0) {
                components.push(new ActionRowBuilder().addComponents(navButtons));
            }
        }

        await interaction.update({ embeds: [embed], components });
    },

    // ========== ВЗЯТИЕ ТИКЕТА ==========
    async handleAcceptTicket(interaction) {
        const ticketValue = interaction.values[0]; // "ticket_123"
        const ticketNumber = parseInt(ticketValue.split('_')[1]);

        if (!isCurator(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Только кураторы могут брать тикеты!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Подтверждение принятия тикета`)
            .setDescription(`${CUSTOM_EMOJIS.WARNING} Вы уверены, что хотите принять тикет #${ticketNumber}?`)
            .setColor(0xffa500)
            .setTimestamp();

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

        await safeReply(interaction, { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
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

            await db.assignCurator(ticketNumber, interaction.user.id);
            await db.updateTicketStatus(ticketNumber, 'В работе');

            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                // Даём права куратору
                try {
                    await ticketChannel.permissionOverwrites.create(interaction.user.id, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true,
                        AttachFiles: true,
                        ManageMessages: true
                    });
                    console.log(`✅ Куратор ${interaction.user.id} добавлен в канал тикета #${ticketNumber}`);
                } catch (permError) {
                    console.error(`❌ Ошибка добавления куратора в канал:`, permError);
                    // Пробуем альтернативный метод
                    try {
                        await ticketChannel.permissionOverwrites.edit(interaction.user.id, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            AttachFiles: true,
                            ManageMessages: true
                        });
                        console.log(`✅ Куратор ${interaction.user.id} добавлен в канал (edit метод)`);
                    } catch (editError) {
                        console.error(`❌ Альтернативный метод тоже не сработал:`, editError);
                    }
                }

                // Переименовываем канал
                const curatorNickname = interaction.member.displayName.substring(0, 12);
                try {
                    await ticketChannel.setName(`тикет-${ticketNumber}-${curatorNickname}`);
                } catch (nameError) {
                    console.error('Ошибка переименования канала:', nameError);
                }

                // ОБНОВЛЯЕМ ВЕБХУК В КАНАЛЕ
                const messages = await ticketChannel.messages.fetch({ limit: 10 });
                const ticketMessage = messages.find(msg => 
                    msg.embeds.length > 0 && msg.embeds[0].title?.includes(`Тикет #${ticketNumber}`)
                );

                if (ticketMessage) {
                    const updatedEmbed = EmbedBuilder.from(ticketMessage.embeds[0])
                        .setColor(STATUS_COLORS['В работе'])
                        .spliceFields(1, 1, {
                            name: `${CUSTOM_EMOJIS.CURATOR} Куратор`,
                            value: `${interaction.user}`,
                            inline: true
                        })
                        .spliceFields(2, 1, {
                            name: `${getStatusEmoji('В работе')} Статус`,
                            value: 'В работе',
                            inline: true
                        });

                    const curatorRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`curator_status_${ticketNumber}`)
                            .setLabel('Статус')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(CUSTOM_EMOJIS.STATUS_CHANGE),
                        new ButtonBuilder()
                            .setCustomId(`curator_complete_${ticketNumber}`)
                            .setLabel('Завершить')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji(CUSTOM_EMOJIS.TICKET_COMPLETED),
                        new ButtonBuilder()
                            .setCustomId(`curator_close_${ticketNumber}`)
                            .setLabel('Закрыть')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(CUSTOM_EMOJIS.TICKET_CLOSED)
                    );

                    await ticketMessage.edit({
                        embeds: [updatedEmbed],
                        components: [curatorRow]
                    });
                }

                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.CURATOR} **Куратор ${interaction.user} взял тикет #${ticketNumber}!**\n\n${CUSTOM_EMOJIS.INFO} Работа над тикетом начата.`
                });
            }

            // Лог
            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_TAKEN,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: { curator_id: interaction.user.id },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });

            const successEmbed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Тикет успешно принят!`)
                .setDescription(`Вы получили доступ к каналу тикета #${ticketNumber}.`)
                .setColor(0x32cd32)
                .setTimestamp();

            await interaction.update({ embeds: [successEmbed], components: [] });

        } catch (error) {
            console.error('Ошибка принятия тикета:', error);
            await interaction.update({
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                embeds: [],
                components: []
            });
        }
    },

    async cancelAcceptTicket(interaction) {
        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.DECLINE} Принятие отменено`)
            .setDescription(`${CUSTOM_EMOJIS.INFO} Принятие тикета было отменено.`)
            .setColor(0xff6b6b)
            .setTimestamp();
        await interaction.update({ embeds: [embed], components: [] });
    },

    // ========== УПРАВЛЕНИЕ ТИКЕТАМИ (КУРАТОРЫ И АДМИНЫ) ==========
    async handleManageOccupied(interaction) {
        if (!isCurator(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав для управления занятыми тикетами!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const ticketNumber = parseInt(interaction.values[0].split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);

        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Проверяем права
        const isCuratorOfTicket = ticket.curator_id === interaction.user.id;
        const hasHighAdminRights = isHighAdmin(interaction.member);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.MANAGE} Управление тикетом #${ticket.ticket_number}`)
            .setDescription('Выберите действие из меню ниже:')
            .setColor(getStatusColor(ticket.status))
            .addFields(
                { name: `${CUSTOM_EMOJIS.USER} Создатель`, value: `<@${ticket.creator_id}>`, inline: true },
                { name: `${CUSTOM_EMOJIS.CURATOR} Куратор`, value: ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не назначен', inline: true },
                { name: `${CUSTOM_EMOJIS.STATUS_CHANGE} Статус`, value: ticket.status, inline: true }
            )
            .setTimestamp();

        // Создаём опции SelectMenu
        const menuOptions = [];

        // Изменить статус - доступно куратору тикета или высшим админам
        if (isCuratorOfTicket || hasHighAdminRights) {
            menuOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Изменить статус')
                    .setDescription('Изменить текущий статус тикета')
                    .setValue(`action_status_${ticketNumber}`)
                    .setEmoji('🔄')
            );
        }

        // Сменить/снять куратора - доступно куратору тикета или высшим админам
        if (isCuratorOfTicket || hasHighAdminRights) {
            menuOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Сменить куратора')
                    .setDescription('Назначить другого куратора или снять себя')
                    .setValue(`action_curator_${ticketNumber}`)
                    .setEmoji(CUSTOM_EMOJIS.CURATOR || '👤')
            );
        }

        // Участники - доступно высшим админам
        if (hasHighAdminRights) {
            menuOptions.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Управление участниками')
                    .setDescription('Добавить или удалить участников тикета')
                    .setValue(`action_participants_${ticketNumber}`)
                    .setEmoji('👥')
            );
        }

        // Раскрыть - доступно всем кураторам
        menuOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel('Раскрыть тикет')
                .setDescription('Подробная информация о тикете')
                .setValue(`action_expand_${ticketNumber}`)
                .setEmoji('📋')
        );

        // Закрыть - доступно куратору тикета, любому куратору, высшим админам
        menuOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel('Закрыть тикет')
                .setDescription('Принудительно закрыть тикет')
                .setValue(`action_close_${ticketNumber}`)
                .setEmoji('❌')
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`ticket_action_menu_${interaction.user.id}:${ticketNumber}`)
            .setPlaceholder('Выберите действие...')
            .addOptions(menuOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await safeReply(interaction, { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    },

    // ========== ОБРАБОТКА SELECTMENU ДЕЙСТВИЙ С ТИКЕТОМ ==========
    async handleTicketActionMenu(interaction) {
        // Format: ticket_action_menu_{userId}:{ticketNumber}
        const [prefixPart, ticketPart] = interaction.customId.split(':');
        const userId = prefixPart.replace('ticket_action_menu_', '');
        const ticketNumber = parseInt(ticketPart);

        if (interaction.user.id !== userId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете управлять только своим меню!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedValue = interaction.values[0];
        const action = selectedValue.split('_')[1]; // status, curator, participants, expand, close

        // Получаем тикет для проверки прав
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Проверяем права
        const isCuratorOfTicket = ticket.curator_id === interaction.user.id;
        const hasHighAdminRights = isHighAdmin(interaction.member);
        const hasCuratorRights = isCurator(interaction.member);

        switch (action) {
            case 'status':
                if (!isCuratorOfTicket && !hasHighAdminRights) {
                    return await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.ERROR} Только куратор тикета или высший администратор может менять статус!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                await this.showStatusChangeMenu(interaction, ticketNumber);
                break;

            case 'curator':
                if (!isCuratorOfTicket && !hasHighAdminRights) {
                    return await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.ERROR} Только куратор тикета или высший администратор может менять куратора!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                await this.showCuratorChangeMenu(interaction, ticketNumber);
                break;

            case 'participants':
                if (!hasHighAdminRights) {
                    return await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.ERROR} Только высшие администраторы могут управлять участниками!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                await this.showParticipantsModal(interaction, ticketNumber);
                break;

            case 'expand':
                await this.handleExpandTicketForAdmin(interaction, ticketNumber);
                break;

            case 'close':
                if (!isCuratorOfTicket && !hasCuratorRights && !hasHighAdminRights) {
                    return await safeReply(interaction, {
                        content: `${CUSTOM_EMOJIS.ERROR} Только куратор тикета, кураторы или высшие администраторы могут закрыть тикет!`,
                        flags: MessageFlags.Ephemeral
                    });
                }
                await this.closeTicket(interaction, ticketNumber);
                break;

            default:
                await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Неизвестное действие!`,
                    flags: MessageFlags.Ephemeral
                });
        }
    },

    async handleTicketAction(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[2];
        const ticketNumber = parseInt(parts[3]);

        // Получаем тикет для проверки прав
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Проверяем права
        const isCuratorOfTicket = ticket.curator_id === interaction.user.id;
        const hasHighAdminRights = isHighAdmin(interaction.member);
        const hasCuratorRights = isCurator(interaction.member);

        // Для смены куратора и участников - высшие админы или куратор тикета
        if ((action === 'curator' || action === 'participants')) {
            if (!hasHighAdminRights && !isCuratorOfTicket) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Только высшие администраторы или куратор этого тикета могут менять куратора и участников!`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // Для закрытия - куратор тикета, любой куратор или высший админ
        if (action === 'close') {
            if (!isCuratorOfTicket && !hasHighAdminRights && !hasCuratorRights) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Только куратор тикета, кураторы или высшие администраторы могут закрыть тикет!`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // Для изменения статуса - куратор тикета или высший админ
        if (action === 'status') {
            if (!isCuratorOfTicket && !hasHighAdminRights) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Только куратор этого тикета или высший администратор может менять статус!`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        switch (action) {
            case 'status':
                await this.showStatusChangeMenu(interaction, ticketNumber);
                break;
            case 'curator':
                await this.showCuratorChangeMenu(interaction, ticketNumber);
                break;
            case 'participants':
                await this.showParticipantsModal(interaction, ticketNumber);
                break;
            case 'close':
                await this.closeTicket(interaction, ticketNumber);
                break;
        }
    },

    async showStatusChangeMenu(interaction, ticketNumber) {
        const statusOptions = [
            new StringSelectMenuOptionBuilder().setLabel('Ожидает куратора').setValue('Ожидает куратора').setEmoji('⏳'),
            new StringSelectMenuOptionBuilder().setLabel('В работе').setValue('В работе').setEmoji('🛠️'),
            new StringSelectMenuOptionBuilder().setLabel('Ожидает ответа').setValue('Ожидает ответа').setEmoji('💬'),
            new StringSelectMenuOptionBuilder().setLabel('Завершен').setValue('Завершен').setEmoji('✅'),
            new StringSelectMenuOptionBuilder().setLabel('Приостановлен').setValue('Приостановлен').setEmoji('⏸️'),
            new StringSelectMenuOptionBuilder().setLabel('Почти готов').setValue('Почти готов').setEmoji('🎯')
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`status_change_${ticketNumber}_${interaction.user.id}`)
            .setPlaceholder('Выберите новый статус')
            .addOptions(statusOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.STATUS_CHANGE} Изменение статуса`)
            .setDescription(`Выберите новый статус для тикета #${ticketNumber}:`)
            .setColor(0x3498db)
            .setTimestamp();

        await safeReply(interaction, { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    },

    async handleStatusChange(interaction) {
        const parts = interaction.customId.split('_');
        const ticketNumber = parseInt(parts[2]);
        const newStatus = interaction.values[0];

        try {
            await db.updateTicketStatus(ticketNumber, newStatus);
            const ticket = await db.getTicketByNumber(ticketNumber);

            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                const statusEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Статус обновлен`)
                    .setDescription(`Тикет **#${ticketNumber}** теперь имеет статус: **${newStatus}**`)
                    .setColor(getStatusColor(newStatus))
                    .setTimestamp();

                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.STATUS_CHANGE} **Статус изменён на "${newStatus}" администратором <@${interaction.user.id}>**`,
                    embeds: [statusEmbed]
                });
            }

            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_STATUS_CHANGED,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: { old_status: ticket.status, new_status: newStatus },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });

            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.SUCCESS} Статус тикета #${ticketNumber} изменён на "${newStatus}"!`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // ========== СМЕНА КУРАТОРА ==========
    async showCuratorChangeMenu(interaction, ticketNumber) {
        try {
            const curatorRole = interaction.guild.roles.cache.get(CURATOR_ROLE_ID);
            if (!curatorRole) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Роль куратора не найдена!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Используем кэш роли вместо полного fetch чтобы избежать rate limit
            const allCurators = Array.from(curatorRole.members.values());

            if (allCurators.length === 0) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.WARNING} На сервере нет кураторов!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const totalPages = Math.ceil(allCurators.length / 23);
            await this.showCuratorPage(interaction, ticketNumber, allCurators, 1, totalPages);
        } catch (error) {
            console.error('Ошибка showCuratorChangeMenu:', error);
            await safeReply(interaction, {
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
                .setDescription(`ID: ${curator.id} | Статус: ${getStatusText(curator.presence?.status || 'offline')}`)
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
                    .setCustomId(`curator_info_${ticketNumber}_${currentPage}`)
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
                { name: `${CUSTOM_EMOJIS.INFO} Всего кураторов`, value: curatorsArray.length.toString(), inline: true },
                { name: `${CUSTOM_EMOJIS.INFO} Страница`, value: `${currentPage} из ${totalPages}`, inline: true },
                { name: `${CUSTOM_EMOJIS.INFO} На странице`, value: curatorsOnPage.length.toString(), inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();

        // Используем safeReply для корректной работы как при первом вызове, так и при пагинации
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    embeds: [embed],
                    components: components
                });
            } else if (interaction.isButton()) {
                // Для кнопок пагинации используем update
                await interaction.update({
                    embeds: [embed],
                    components: components
                });
            } else {
                // Для первого вызова из меню
                await safeReply(interaction, {
                    embeds: [embed],
                    components: components,
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            console.error('Ошибка обновления сообщения куратора:', error);
            // Fallback
            try {
                await safeReply(interaction, {
                    embeds: [embed],
                    components: components,
                    flags: MessageFlags.Ephemeral
                });
            } catch (err) {
                console.error('Fallback ошибка:', err);
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

        // Используем кэш роли вместо полного fetch чтобы избежать rate limit
        const allCurators = Array.from(curatorRole.members.values());
        const totalPages = Math.ceil(allCurators.length / 23);

        // ИСПРАВЛЕНИЕ: Используем update вместо reply
        await this.showCuratorPage(interaction, ticketNumber, allCurators, newPage, totalPages);
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
        if (selectedCuratorId === 'remove_curator') {
            // СНЯТИЕ КУРАТОРА
            if (!ticket.curator_id) {
                return await interaction.reply({
                    content: `${CUSTOM_EMOJIS.WARNING} У этого тикета нет куратора!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const oldCuratorId = ticket.curator_id;
            await db.removeCurator(ticketNumber);

            // Удаляем старого куратора из канала
            try {
                await ticketChannel.permissionOverwrites.delete(oldCuratorId);
                console.log(`Куратор ${oldCuratorId} удален из канала тикета #${ticketNumber}`);
            } catch (error) {
                console.log(`Не удалось удалить куратора из канала:`, error.message);
            }

            // Меняем статус на "Ожидает куратора"
            await db.updateTicketStatus(ticketNumber, 'Ожидает куратора');

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
                    value: `<@${oldCuratorId}>`,
                    inline: true
                })
                .setColor(0xffa500)
                .setTimestamp();

            await ticketChannel.send({
                content: `${CUSTOM_EMOJIS.WARNING} **Куратор снят с тикета #${ticketNumber} администратором <@${interaction.user.id}>**\n${CUSTOM_EMOJIS.TICKET_PENDING} Тикет снова ожидает куратора.`,
                embeds: [removeEmbed]
            });

            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_CURATOR_REMOVED,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: {
                    old_curator: oldCuratorId,
                    new_curator: null
                },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });

            await interaction.reply({
                content: `${CUSTOM_EMOJIS.SUCCESS} Куратор снят с тикета #${ticketNumber}! Канал переименован в "${newChannelName}".`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            // НАЗНАЧЕНИЕ/СМЕНА КУРАТОРА (остаётся без изменений)
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
                    { name: `${CUSTOM_EMOJIS.CURATOR} Старый куратор`, value: ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не было', inline: true },
                    { name: `${CUSTOM_EMOJIS.CURATOR} Новый куратор`, value: `<@${selectedCuratorId}>`, inline: true },
                    { name: `${CUSTOM_EMOJIS.INFO} Изменения канала`, value: `Название изменено на: **${newChannelName}**`, inline: false }
                )
                .setColor(getStatusColor('В работе'))
                .setTimestamp();

            await ticketChannel.send({
                content: `${CUSTOM_EMOJIS.SUCCESS} **Куратор тикета #${ticketNumber} изменен администратором <@${interaction.user.id}>**`,
                embeds: [changeEmbed]
            });

            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_CURATOR_CHANGED,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: {
                    old_curator: ticket.curator_id,
                    new_curator: selectedCuratorId
                },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
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


    // ========== КУРАТОР: ИЗМЕНЕНИЕ СТАТУСА ==========
    async handleCuratorStatusButton(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);

        if (!ticket || ticket.curator_id !== interaction.user.id) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы не являетесь куратором этого тикета!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const statusOptions = [
            new StringSelectMenuOptionBuilder().setLabel('В работе').setValue('В работе').setEmoji(CUSTOM_EMOJIS.TICKET_OCCUPIED),
            new StringSelectMenuOptionBuilder().setLabel('Ожидает ответа').setValue('Ожидает ответа').setEmoji(CUSTOM_EMOJIS.LOADING),
            new StringSelectMenuOptionBuilder().setLabel('Приостановлен').setValue('Приостановлен').setEmoji(CUSTOM_EMOJIS.TICKET_PAUSED),
            new StringSelectMenuOptionBuilder().setLabel('Почти готов').setValue('Почти готов').setEmoji(CUSTOM_EMOJIS.SUCCESS)
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`curator_change_status_${ticketNumber}`)
            .setPlaceholder('Выберите новый статус')
            .addOptions(statusOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle(`${CUSTOM_EMOJIS.STATUS_CHANGE} Изменение статуса`)
            .setDescription(`Выберите новый статус для тикета #${ticketNumber}:`)
            .setColor(0x3498db);

        await safeReply(interaction, { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
    },

    async handleCuratorStatusChange(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[3]);
        const newStatus = interaction.values[0];

        try {
            await db.updateTicketStatus(ticketNumber, newStatus);
            const ticket = await db.getTicketByNumber(ticketNumber);

            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                const statusEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Статус обновлен`)
                    .setDescription(`Тикет **#${ticketNumber}** теперь имеет статус: **${newStatus}**`)
                    .setColor(getStatusColor(newStatus))
                    .setTimestamp();

                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.STATUS_CHANGE} **Статус изменён на "${newStatus}" куратором <@${interaction.user.id}>**`,
                    embeds: [statusEmbed]
                });
            }

            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.SUCCESS} Статус изменён на "${newStatus}"!`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // ========== КУРАТОР: ЗАВЕРШЕНИЕ ТИКЕТА ==========
    async handleCuratorCompleteButton(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);

        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ИСПРАВЛЕНИЕ: Куратор этого тикета ИЛИ админы могут завершить тикет
        const isCuratorOfTicket = ticket.curator_id === interaction.user.id;
        const canComplete = isCuratorOfTicket || isHighAdmin(interaction.member);

        if (!canComplete) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Только куратор этого тикета или администратор может его завершить!\n\n${CUSTOM_EMOJIS.CURATOR} Куратор тикета: ${ticket.curator_id ? `<@${ticket.curator_id}>` : 'не назначен'}`,
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
            .setPlaceholder('Опишите, что было сделано...');

        modal.addComponents(new ActionRowBuilder().addComponents(notesInput));
        await interaction.showModal(modal);
    },

    // ========== КУРАТОР: ЗАКРЫТИЕ ТИКЕТА (КНОПКА) ==========
    async handleCuratorCloseButton(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const ticket = await db.getTicketByNumber(ticketNumber);

        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Куратор тикета, любой куратор или высший админ может закрыть
        const isCuratorOfTicket = ticket.curator_id === interaction.user.id;
        const hasCuratorRights = isCurator(interaction.member);
        const hasHighAdminRights = isHighAdmin(interaction.member);

        if (!isCuratorOfTicket && !hasCuratorRights && !hasHighAdminRights) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Только куратор тикета, кураторы или высшие администраторы могут закрыть тикет!\n\n${CUSTOM_EMOJIS.CURATOR} Куратор тикета: ${ticket.curator_id ? `<@${ticket.curator_id}>` : 'не назначен'}`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Закрываем тикет
        await this.closeTicket(interaction, ticketNumber);
    },

    // ========== ОТЗЫВЫ О КУРАТОРАХ ==========
    async handleCuratorRating(interaction) {
        const parts = interaction.customId.split('_');
        const ticketNumber = parseInt(parts[2]);
        const reviewerId = parts[3];
        const rating = parseInt(parts[4]);

        if (interaction.user.id !== reviewerId) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Вы можете оценить только свой тикет!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || !ticket.curator_id) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Ошибка: тикет или куратор не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const hasReviewed = await db.hasUserReviewedTicket(ticketNumber, reviewerId);
        if (hasReviewed) {
            return await safeReply(interaction, {
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
            .setPlaceholder('Поделитесь своим мнением...');

        modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
        await interaction.showModal(modal);
    },

    // ========== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ==========
    async showUserManagement(interaction) {
        if (!isHighAdmin(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав!`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const usersWithCooldown = await db.getUsersWithCooldown();
            const curatorRatings = await db.getAllCuratorRatings();

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.ADMIN} Управление пользователями`)
                .setDescription('Выберите действие:')
                .addFields(
                    { name: '👥 Пользователи с кулдауном', value: `${usersWithCooldown.length} пользователей`, inline: true },
                    { name: `${CUSTOM_EMOJIS.TROPHY} Рейтинг кураторов`, value: `${curatorRatings.length} кураторов`, inline: true }
                )
                .setColor(0xe74c3c)
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`reset_cooldown_${interaction.user.id}`)
                    .setLabel('Сбросить кулдаун')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⏰'),
                new ButtonBuilder()
                    .setCustomId(`view_cooldown_users_${interaction.user.id}`)
                    .setLabel('Показать пользователей')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👥'),
                new ButtonBuilder()
                    .setCustomId(`view_curator_ratings_${interaction.user.id}`)
                    .setLabel('Топ кураторов')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(CUSTOM_EMOJIS.TROPHY)
            );

            await safeReply(interaction, { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Ошибка showUserManagement:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
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
            .setPlaceholder('Введите ID пользователя');

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
    },

    async showUsersWithCooldown(interaction) {
        try {
            const usersWithCooldown = await db.getUsersWithCooldown();

            if (usersWithCooldown.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.SUCCESS} Пользователи с кулдауном`)
                    .setDescription('🎉 Нет пользователей с активным кулдауном!')
                    .setColor(0x00ff00)
                    .setTimestamp();
                return await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.LOADING} Пользователи с активным кулдауном`)
                .setDescription(`Найдено: ${usersWithCooldown.length}`)
                .setColor(0xffa500)
                .setTimestamp();

            for (const user of usersWithCooldown.slice(0, 10)) {
                const member = interaction.guild.members.cache.get(user.creator_id);
                const cooldownEnd = new Date(user.next_ticket_allowed);
                const now = new Date();
                const hoursLeft = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60));

                embed.addFields({
                    name: `👤 ${member ? member.displayName : 'Неизвестный'}`,
                    value: `**ID:** ${user.creator_id}\n⏰ **Осталось:** ${hoursLeft} часов`,
                    inline: true
                });
            }

            await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Ошибка showUsersWithCooldown:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
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
                return await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.TROPHY} Топ кураторов`)
                .setDescription(`Найдено кураторов: ${curatorRatings.length}`)
                .setColor(0xffd700)
                .setTimestamp();

            curatorRatings.slice(0, 10).forEach((curator, index) => {
                const member = interaction.guild.members.cache.get(curator.curator_id);
                const rating = parseFloat(curator.average_rating);
                const starRating = generateStarRating(rating);
                const medal = getMedalEmoji(index);

                embed.addFields({
                    name: `${medal} ${member ? member.displayName : 'Неизвестный'}`,
                    value: `${starRating} **${rating.toFixed(1)}/5.0**\n📊 Отзывов: ${curator.total_reviews} | Тикетов: ${curator.total_tickets}`,
                    inline: true
                });
            });

            await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('Ошибка showCuratorRatings:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // ========== УЧАСТНИКИ ТИКЕТА ==========
    async showParticipantsModal(interaction, ticketNumber) {
        if (!isHighAdmin(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`participants_modal_${ticketNumber}`)
            .setTitle(`Управление участниками #${ticketNumber}`);

        const participantsInput = new TextInputBuilder()
            .setCustomId('participants')
            .setLabel('ID участников (через запятую)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500)
            .setPlaceholder('Например: 123456789, 987654321');

        modal.addComponents(new ActionRowBuilder().addComponents(participantsInput));
        await interaction.showModal(modal);
    },

    async handleParticipantsModal(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        const participants = interaction.fields.getTextInputValue('participants');

        try {
            const ticket = await db.getTicketByNumber(ticketNumber);
            if (!ticket) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const participantIds = participants.split(',').map(id => id.trim()).filter(id => id && /^\d+$/.test(id));

            if (participantIds.length === 0) {
                return await safeReply(interaction, {
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
                    console.log(`Пользователь ${userId} не найден`);
                }
            }

            if (validatedIds.length === 0) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Ни один пользователь не найден на сервере!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            await db.updateTicketParticipants(ticketNumber, validatedIds.join(','));

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
                    } catch (error) {
                        console.log(`Не удалось добавить участника ${userId}:`, error.message);
                    }
                }

                const participantMentions = validatedIds.map(id => `<@${id}>`).join(', ');
                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.PARTICIPANTS} **Участники тикета #${ticketNumber} обновлены администратором <@${interaction.user.id}>**\n\n👥 Новые участники: ${participantMentions}`
                });
            }

            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_PARTICIPANTS_UPDATED,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: { participants_count: validatedIds.length, participant_ids: validatedIds },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });

            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.SUCCESS} Участники тикета #${ticketNumber} обновлены!\n👥 Добавлено: ${validatedIds.length}`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка обновления участников:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // ========== РАСКРЫТИЕ ТИКЕТА ДЛЯ АДМИНОВ ==========
    async handleExpandTicketForAdmin(interaction, ticketNumberParam = null) {
        // Разрешаем любому куратору раскрывать тикет
        if (!isCurator(interaction.member)) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} У вас нет прав!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Если передан параметр - используем его, иначе берём из customId
        const ticketNumber = ticketNumberParam || parseInt(interaction.customId.split('_')[3]);

        try {
            const ticket = await db.getTicketByNumber(ticketNumber);
            if (!ticket) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (!ticketChannel || ticketChannel.type !== ChannelType.GuildText) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Канал тикета не найден!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const adminRole = interaction.guild.roles.cache.get(ADMIN_PING_ROLE_ID);
            if (!adminRole) {
                return await safeReply(interaction, {
                    content: `${CUSTOM_EMOJIS.ERROR} Роль администрации не найдена!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Даём доступ роли администрации
            await ticketChannel.permissionOverwrites.create(ADMIN_PING_ROLE_ID, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                ManageMessages: true
            });

            // Даём доступ всем админским ролям
            for (const roleId of [...ADMIN_ROLES, ...HIGH_ADMIN_ROLES]) {
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

            const expansionEmbed = new EmbedBuilder()
                .setTitle('🚨 Тикет раскрыт для администрации')
                .setDescription(`Тикет #${ticketNumber} раскрыт для всех администраторов пользователем <@${interaction.user.id}>`)
                .setColor(0xff6600)
                .setTimestamp();

            await ticketChannel.send({
                content: `${adminRole.toString()} - тикет раскрыт!`,
                embeds: [expansionEmbed]
            });

            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_EXPANDED_FOR_ADMINS,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: { expanded_by: interaction.user.id, admin_role_id: ADMIN_PING_ROLE_ID },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });

            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.SUCCESS} Тикет #${ticketNumber} раскрыт для администрации!`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка раскрытия тикета:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Произошла ошибка!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // ========== ЗАКРЫТИЕ ТИКЕТА ==========
    async closeTicket(interaction, ticketNumber) {
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket) {
            return await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Тикет не найден!`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await db.updateTicketStatus(ticketNumber, 'Закрыт');

            // КД на всех участников
            const participantsSet = new Set();
            if (ticket.creator_id) participantsSet.add(ticket.creator_id);
            if (ticket.participants) {
                ticket.participants.split(',').map(id => id.trim()).filter(Boolean).forEach(id => participantsSet.add(id));
            }

            for (const userId of participantsSet) {
                try {
                    await db.setTicketCooldownOnCompletion(userId);
                } catch (err) {
                    console.error('Ошибка установки КД для', userId, err);
                }
            }

            const ticketChannel = interaction.guild.channels.cache.get(ticket.channel_id);
            if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                const closeEmbed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.TICKET_CLOSED} Тикет закрыт`)
                    .setDescription(`Тикет #${ticketNumber} будет удалён через 10 секунд.\nКулдаун: 72 часа (3 дня).`)
                    .setColor(0x666666)
                    .setTimestamp();

                await ticketChannel.send({
                    content: `${CUSTOM_EMOJIS.TICKET_CLOSED} Тикет #${ticketNumber} закрыт модератором <@${interaction.user.id}>. Удаление через 10 секунд.`,
                    embeds: [closeEmbed]
                });

                setTimeout(async () => {
                    try {
                        await ticketChannel.delete(`Закрытие тикета #${ticketNumber}`);
                    } catch (deleteError) {
                        console.error('Ошибка удаления канала:', deleteError);
                    }
                }, 10_000);
            }

            await TicketLogger.logTicketAction(interaction.client, {
                admin_id: interaction.user.id,
                action_type: TICKET_ACTION_TYPES.TICKET_CLOSED,
                ticket_number: ticketNumber,
                target_user_id: ticket.creator_id,
                details: { curator_id: ticket.curator_id },
                success: true,
                channel_id: ticket.channel_id,
                guild_id: interaction.guildId
            });

            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.SUCCESS} Тикет #${ticketNumber} закрыт. Канал будет удалён через 10 секунд.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('Ошибка закрытия тикета:', error);
            await safeReply(interaction, {
                content: `${CUSTOM_EMOJIS.ERROR} Не удалось закрыть тикет!`,
                flags: MessageFlags.Ephemeral
            });
        }
    },

    // ========== ПОИСК ТИКЕТА ==========
    async showSearchTicketModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId(`searchticketmodal:${interaction.user.id}`)
            .setTitle('Поиск тикета по номеру');

        const input = new TextInputBuilder()
            .setCustomId('ticketnumber')
            .setLabel('Номер тикета')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(6)
            .setPlaceholder('Например, 205');

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }
};
