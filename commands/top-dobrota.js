const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database');
const db = new Database();

const ALLOWED_ROLE_ID = '1382000040977109003';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('топ-доброта')
        .setDescription('Топ пользователей по отправленным и полученным открыток')
        .setDMPermission(false) // Команда только для сервера
        .addStringOption(option =>
            option
                .setName('тип')
                .setDescription('Тип топа')
                .setRequired(false)
                .addChoices(
                    { name: '📤 Топ отправителей', value: 'senders' },
                    { name: '📥 Топ получателей', value: 'recipients' },
                    { name: '📊 Общий топ', value: 'both' }
                )
        ),

    async execute(interaction) {
        // Проверка роли
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return await interaction.reply({
                content: '❌ У вас нет прав для использования этой команды.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            const topType = interaction.options.getString('тип') || 'both';

            const embed = new EmbedBuilder()
                .setTitle('🏆 Топ пользователей - День доброты')
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({ text: 'День доброты 💗' });

            if (topType === 'senders' || topType === 'both') {
                const topSenders = await db.getKindnessTopSenders(10);
                if (topSenders.length > 0) {
                    let sendersText = '';
                    for (let i = 0; i < topSenders.length; i++) {
                        const sender = topSenders[i];
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        sendersText += `${medal} <@${sender.sender_id}> - **${sender.sent_count}** отправлено\n`;
                    }
                    embed.addFields({
                        name: '📤 Топ отправителей открыток',
                        value: sendersText || 'Нет данных',
                        inline: false
                    });
                }
            }

            if (topType === 'recipients' || topType === 'both') {
                const topRecipients = await db.getKindnessTopRecipients(10);
                if (topRecipients.length > 0) {
                    let recipientsText = '';
                    for (let i = 0; i < topRecipients.length; i++) {
                        const recipient = topRecipients[i];
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        recipientsText += `${medal} <@${recipient.recipient_id}> - **${recipient.received_count}** получено\n`;
                    }
                    embed.addFields({
                        name: '📥 Топ получателей открыток',
                        value: recipientsText || 'Нет данных',
                        inline: false
                    });
                }
            }

            const allCards = await db.getAllKindnessCards();
            const totalCards = allCards.length;
            const uniqueSenders = new Set(allCards.map(card => card.sender_id)).size;
            const uniqueRecipients = new Set(allCards.map(card => card.recipient_id)).size;

            embed.addFields({
                name: '📊 Общая статистика',
                value: `💌 Всего открыток отправлено: **${totalCards}**\n👥 Уникальных отправителей: **${uniqueSenders}**\n🎁 Уникальных получателей: **${uniqueRecipients}**`,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Ошибка в команде топ-доброта:', error);
            await interaction.editReply({
                content: '❌ Произошла ошибка при получении статистики.'
            });
        }
    }
};
