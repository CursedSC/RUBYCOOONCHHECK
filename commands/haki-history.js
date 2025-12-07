const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('хаки-история')
        .setDescription('Посмотреть историю круток хаки'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const totalSessions = await db.getUserHakiHistoryCount(userId);
            
            if (totalSessions === 0) {
                const noHistoryEmbed = new EmbedBuilder()
                    .setTitle('📜 История круток хаки')
                    .setDescription('У вас пока нет истории круток хаки!')
                    .addFields(
                        { name: '🎲 Всего сессий', value: '0', inline: true },
                        { name: '💡 Совет', value: 'Используйте `/хаки крутить` чтобы начать крутить!', inline: false }
                    )
                    .setColor(0x9932CC)
                    .setTimestamp();

                return await interaction.reply({
                    embeds: [noHistoryEmbed],
                    ephemeral: true
                });
            }

            await showHakiHistoryPage(interaction, userId, 0);

        } catch (error) {
            console.error('Ошибка команды хаки-история:', error);
            await interaction.reply({
                content: 'Произошла ошибка при выполнении команды!',
                ephemeral: true
            });
        }
    }
};

async function showHakiHistoryPage(interaction, userId, page = 0) {
    const sessionsPerPage = 5;
    const offset = page * sessionsPerPage;
    
    const [history, totalSessions] = await Promise.all([
        db.getUserHakiHistory(userId, sessionsPerPage, offset),
        db.getUserHakiHistoryCount(userId)
    ]);

    const totalPages = Math.ceil(totalSessions / sessionsPerPage);

    const embed = new EmbedBuilder()
        .setTitle('📜 История круток хаки')
        .setDescription(`Ваша история круток хаки (страница ${page + 1} из ${totalPages})`)
        .setColor(0x9932CC)
        .setTimestamp();

    if (history.length === 0) {
        embed.addFields({ name: '❌ Нет данных', value: 'На этой странице нет истории круток.', inline: false });
    } else {
        history.forEach((session, index) => {
            const results = session.results.split(',');
            const hakiCount = {};
            results.forEach(haki => {
                hakiCount[haki] = (hakiCount[haki] || 0) + 1;
            });

            const summary = Object.entries(hakiCount)
                .map(([haki, count]) => `${haki}: ${count}x`)
                .join(', ');

            const sessionDate = new Date(session.session_start).toLocaleString('ru-RU');
            
            embed.addFields({
                name: `🎲 Сессия ${offset + index + 1} (${session.total_spins} круток)`,
                value: `**Дата:** ${sessionDate}\n**Результаты:** ${summary}\n**ID:** ${session.session_id.split('_')[1]}`,
                inline: false
            });
        });
    }

    embed.addFields(
        { name: '📊 Статистика', value: `Всего сессий: ${totalSessions}`, inline: true }
    );

    const components = [];

    // Кнопки пагинации
    if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder();
        
        if (page > 0) {
            paginationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`haki_history_page_${userId}_${page - 1}`)
                    .setLabel('⬅️ Назад')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        paginationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`haki_history_info_${page + 1}_${totalPages}`)
                .setLabel(`${page + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        );

        if (page < totalPages - 1) {
            paginationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`haki_history_page_${userId}_${page + 1}`)
                    .setLabel('Вперед ➡️')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        components.push(paginationRow);
    }

    // Кнопки действий для каждой сессии
    if (history.length > 0) {
        const sessionRows = [];
        let currentRow = new ActionRowBuilder();
        
        history.forEach((session, index) => {
            if (currentRow.components.length >= 5) {
                sessionRows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`haki_session_details_${userId}_${session.session_id}`)
                    .setLabel(`📋 Сессия ${offset + index + 1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📋')
            );
        });

        if (currentRow.components.length > 0) {
            sessionRows.push(currentRow);
        }

        components.push(...sessionRows);
    }

    // Кнопка закрытия
    const closeRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('close_haki_history')
                .setLabel('👋 Закрыть')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('👋')
        );

    components.push(closeRow);

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            embeds: [embed],
            components: components,
            ephemeral: true
        });
    } else {
        await interaction.reply({
            embeds: [embed],
            components: components,
            ephemeral: true
        });
    }
}
