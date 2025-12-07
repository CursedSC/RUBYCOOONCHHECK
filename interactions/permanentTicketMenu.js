const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    canHandle(interaction) {
        return (
            (interaction.isStringSelectMenu() && interaction.customId === 'permanent_ticket_menu') ||
            (interaction.isButton() && interaction.customId === 'quick_create_ticket')
        );
    },

    async execute(interaction) {
        try {
            // Обработка dropdown меню
            if (interaction.isStringSelectMenu() && interaction.customId === 'permanent_ticket_menu') {
                const selectedValue = interaction.values[0];

                switch (selectedValue) {
                    case 'create_new_ticket':
                        await this.handleCreateTicket(interaction);
                        break;
                    case 'view_my_tickets':
                        await this.handleViewMyTickets(interaction);
                        break;
                    case 'ticket_help':
                        await this.handleTicketHelp(interaction);
                        break;
                }
            }

            // Обработка кнопки быстрого создания
            if (interaction.isButton() && interaction.customId === 'quick_create_ticket') {
                await this.handleCreateTicket(interaction);
            }

        } catch (error) {
            console.error('Ошибка в обработчике перманентных тикетов:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Произошла ошибка при обработке запроса!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },

    async handleCreateTicket(interaction) {
        // Проверяем кулдаун
        const cooldownHours = await db.getCooldownHours(interaction.user.id);
        if (cooldownHours > 0) {
            const cooldownEmbed = new EmbedBuilder()
                .setTitle('⏰ Активен кулдаун тикетов')
                .setDescription(`Вы можете создать следующий тикет через **${cooldownHours} часов**!`)
                .setColor(0xff6b6b)
                .addFields(
                    { 
                        name: '📋 Информация о кулдауне', 
                        value: `Кулдаун между тикетами составляет 48 часов.\nЭто сделано для предотвращения спама и обеспечения качественной обработки каждого тикета.`, 
                        inline: false 
                    },
                    { 
                        name: '💡 Что можно сделать?', 
                        value: `• Просмотреть свои активные тикеты\n• Обратиться к куратору в существующем тикете\n• Подождать окончания кулдауна`, 
                        inline: false 
                    }
                )
                .setTimestamp();

            return await interaction.reply({
                embeds: [cooldownEmbed],
                flags: MessageFlags.Ephemeral
            });
        }

        // Показываем модальное окно для создания тикета
        await this.showCreateTicketModal(interaction);
    },

    async showCreateTicketModal(interaction) {
        const characters = await db.getAllCharactersByUserId(interaction.user.id);
        
        if (characters.length === 0) {
            const noCharactersEmbed = new EmbedBuilder()
                .setTitle('❌ Нет персонажей')
                .setDescription('У вас нет персонажей для создания тикета!')
                .setColor(0xff6b6b)
                .addFields({
                    name: '💡 Что делать?',
                    value: 'Сначала создайте персонажа, а затем возвращайтесь к созданию тикета.',
                    inline: false
                });

            return await interaction.reply({
                embeds: [noCharactersEmbed],
                flags: MessageFlags.Ephemeral
            });
        }

        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`create_ticket_modal_${interaction.user.id}`)
            .setTitle('🎫 Создание нового тикета');

        const purposeInput = new TextInputBuilder()
            .setCustomId('purpose')
            .setLabel('Цель проведения тикета')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500)
            .setPlaceholder('Опишите подробно, что нужно сделать с персонажем...');

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

    async handleViewMyTickets(interaction) {
        const tickets = await db.getUserTickets(interaction.user.id);
        
        if (tickets.length === 0) {
            const noTicketsEmbed = new EmbedBuilder()
                .setTitle('📋 Ваши тикеты')
                .setDescription('У вас пока нет тикетов.')
                .setColor(0x3498db)
                .addFields({
                    name: '💡 Создайте свой первый тикет!',
                    value: 'Используйте кнопку или меню выше для создания тикета.',
                    inline: false
                })
                .setTimestamp();

            return await interaction.reply({
                embeds: [noTicketsEmbed],
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Ваши тикеты')
            .setDescription('**Список всех ваших тикетов:**')
            .setColor(0x3498db)
            .setTimestamp()
            .setFooter({ text: `Всего тикетов: ${tickets.length}` });

        // Функция для получения эмодзи статуса
        const getStatusEmoji = (status) => {
            const statusEmojis = {
                'Ожидает куратора': '⏳',
                'В работе': '🔧',
                'Ожидает ответа': '⏰',
                'Завершен': '✅',
                'Приостановлен': '⏸️',
                'Закрыт': '❌',
                'Почти готов': '⚡'
            };
            return statusEmojis[status] || 'ℹ️';
        };

        for (const ticket of tickets.slice(0, 10)) {
            const channel = interaction.guild.channels.cache.get(ticket.channel_id);
            const channelMention = channel ? `<#${ticket.channel_id}>` : 'Канал удален';
            const statusEmoji = getStatusEmoji(ticket.status);

            embed.addFields({
                name: `🎫 Тикет #${ticket.ticket_number}`,
                value: `${statusEmoji} **Статус:** ${ticket.status}\n👨‍💼 **Куратор:** ${ticket.curator_id ? `<@${ticket.curator_id}>` : 'Не назначен'}\n📍 **Канал:** ${channelMention}`,
                inline: true
            });
        }

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    },

    async handleTicketHelp(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('❓ Помощь по системе тикетов')
            .setDescription('**Подробная информация о работе с тикетами**')
            .setColor(0x9932cc)
            .addFields(
                {
                    name: '🎫 Что такое тикет?',
                    value: 'Тикет - это персональный канал для работы с вашими персонажами. В нем куратор проведёт для вас RP ситуацию, которая поможет вам в развитии вашего персонажа.',
                    inline: false
                },
                {
                    name: '📝 Как создать тикет?',
                    value: '**Способ 1:** Нажмите кнопку "📝 Создать тикет"\n**Способ 2:** Используйте команду `/тикет`\n**Способ 3:** Выберите "📝 Создать тикет" в меню выше',
                    inline: false
                },
                {
                    name: '⏰ Кулдаун тикетов',
                    value: 'Между созданием тикетов действует кулдаун в **48 часов**. Это предотвращает спам и обеспечивает качественное обслуживание.',
                    inline: false
                },
                {
                    name: '👨‍💼 Работа с куратором',
                    value: 'После создания тикета его возьмет свободный куратор.',
                    inline: false
                },
                {
                    name: '📊 Статусы тикетов',
                    value: '⏳ **Ожидает куратора** - тикет создан, ждет куратора\n🔧 **В работе** - куратор работает с тикетом\n⏰ **Ожидает ответа** - ждет вашего ответа\n✅ **Завершен** - работа завершена',
                    inline: false
                },
                {
                    name: '⭐ Оценка работы',
                    value: 'После завершения тикета вы можете оценить работу куратора от 1 до 5 звезд и оставить комментарий.',
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Система тикетов • Помощь' });

        await interaction.reply({
            embeds: [helpEmbed],
            flags: MessageFlags.Ephemeral
        });
    }
};
