const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();
const CURATOR_ROLE_ID = '1382005661369368586';

module.exports = {
    canHandle(interaction) {
        return interaction.isButton() && (
            interaction.customId.startsWith('curator_status_') ||
            interaction.customId.startsWith('curator_complete_') ||
            interaction.customId.startsWith('rate_curator_')
            
        );
    },

    async execute(interaction) {
        try {
            if (interaction.customId.startsWith('curator_status_')) {
                await this.handleStatusChange(interaction);
            } else if (interaction.customId.startsWith('curator_complete_')) {
                await this.handleTicketCompletion(interaction);
            } else if (interaction.customId.startsWith('rate_curator_')) {
                await this.handleCuratorRating(interaction);
            }
        } catch (error) {
            console.error('Ошибка в обработчике кнопок тикетов:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Произошла ошибка при обработке запроса!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },

    async handleStatusChange(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || ticket.curator_id !== interaction.user.id) {
            return await interaction.reply({
                content: '❌ Вы не являетесь куратором этого тикета!',
                flags: MessageFlags.Ephemeral
            });
        }

        const statusOptions = [
            new StringSelectMenuOptionBuilder()
                .setLabel('В работе')
                .setValue('В работе')
                .setEmoji('🔧'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ожидает ответа')
                .setValue('Ожидает ответа')
                .setEmoji('⏰'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Приостановлен')
                .setValue('Приостановлен')
                .setEmoji('⏸️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Почти готов')
                .setValue('Почти готов')
                .setEmoji('⏳')
        ];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`curator_change_status_${ticketNumber}`)
            .setPlaceholder('Выберите новый статус')
            .addOptions(statusOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: `Выберите новый статус для тикета #${ticketNumber}:`,
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    },

    async handleTicketCompletion(interaction) {
        const ticketNumber = parseInt(interaction.customId.split('_')[2]);
        
        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || ticket.curator_id !== interaction.user.id) {
            return await interaction.reply({
                content: '❌ Вы не являетесь куратором этого тикета!',
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
                content: '❌ Вы можете оценить только свой тикет!',
                flags: MessageFlags.Ephemeral
            });
        }

        const ticket = await db.getTicketByNumber(ticketNumber);
        if (!ticket || !ticket.curator_id) {
            return await interaction.reply({
                content: '❌ Ошибка: тикет или куратор не найден!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Проверяем, не оставлял ли уже отзыв
        const hasReviewed = await db.hasUserReviewedTicket(ticketNumber, reviewerId);
        if (hasReviewed) {
            return await interaction.reply({
                content: '❌ Вы уже оставили отзыв на этот тикет!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Показываем модальное окно для комментария
        const modal = new ModalBuilder()
            .setCustomId(`review_comment_${ticketNumber}_${reviewerId}_${rating}`)
            .setTitle(`Оценка: ${'⭐'.repeat(rating)}`);

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
    }
};
