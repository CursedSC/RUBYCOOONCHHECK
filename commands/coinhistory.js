const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const coinLogger = require('../utils/coinLogger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinhistory')
        .setDescription('📊 Просмотр истории транзакций с коинами')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Пользователь (только для админов)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Тип валюты')
                .setRequired(false)
                .addChoices(
                    { name: '💎 RubyCoin', value: 'RUBYCOIN' },
                    { name: '💰 Peso', value: 'PESO' },
                    { name: '🪙 Sol', value: 'SOL' },
                    { name: '💵 Pound', value: 'POUND' },
                    { name: '📊 Все', value: 'ALL' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const coinTypeFilter = interaction.options.getString('type') || 'ALL';

            if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('❌ Только администраторы могут просматривать историю других пользователей!');
            }

            const stats = await coinLogger.getUserStatistics(targetUser.id);
            const options = {
                coinType: coinTypeFilter === 'ALL' ? null : coinTypeFilter,
                limit: 10,
                offset: 0
            };

            const transactions = await coinLogger.getUserTransactions(targetUser.id, options);
            const totalCount = await coinLogger.getTransactionCount(targetUser.id, options.coinType);

            const embed = createHistoryEmbed(targetUser, stats, transactions, coinTypeFilter, 1, Math.ceil(totalCount / 10));
            const components = createComponents(coinTypeFilter, 1, Math.ceil(totalCount / 10));

            const message = await interaction.editReply({ 
                embeds: [embed], 
                components,
                ephemeral: true 
            });

            const collector = message.createMessageComponentCollector({ 
                time: 300000 
            });

            let currentPage = 1;
            let currentFilter = coinTypeFilter;

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ Это не ваше меню!', ephemeral: true });
                }

                await i.deferUpdate();

                if (i.customId === 'coin_type_select') {
                    currentFilter = i.values[0];
                    currentPage = 1;
                } else if (i.customId === 'prev_page') {
                    currentPage = Math.max(1, currentPage - 1);
                } else if (i.customId === 'next_page') {
                    currentPage = Math.min(Math.ceil(totalCount / 10), currentPage + 1);
                } else if (i.customId === 'refresh') {
                    
                }

                const newOptions = {
                    coinType: currentFilter === 'ALL' ? null : currentFilter,
                    limit: 10,
                    offset: (currentPage - 1) * 10
                };

                const newTransactions = await coinLogger.getUserTransactions(targetUser.id, newOptions);
                const newStats = await coinLogger.getUserStatistics(targetUser.id);
                const newTotalCount = await coinLogger.getTransactionCount(targetUser.id, newOptions.coinType);

                const newEmbed = createHistoryEmbed(
                    targetUser, 
                    newStats, 
                    newTransactions, 
                    currentFilter, 
                    currentPage, 
                    Math.ceil(newTotalCount / 10)
                );
                const newComponents = createComponents(
                    currentFilter, 
                    currentPage, 
                    Math.ceil(newTotalCount / 10)
                );

                await i.editReply({ embeds: [newEmbed], components: newComponents });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });

        } catch (error) {
            console.error('❌ Ошибка в coinhistory:', error);
            await interaction.editReply('❌ Произошла ошибка при загрузке истории транзакций!');
        }
    },
};

function createHistoryEmbed(user, stats, transactions, filterType, page, totalPages) {
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setAuthor({ 
            name: `💰 История транзакций: ${user.username}`,
            iconURL: user.displayAvatarURL() 
        })
        .setTimestamp();

    let statsText = '```ansi\n';
    statsText += `\x1b[1;36m╔═════════════════════════════════════╗\x1b[0m\n`;
    statsText += `\x1b[1;36m║\x1b[0m       \x1b[1;33m💎 СТАТИСТИКА ВАЛЮТ\x1b[0m         \x1b[1;36m║\x1b[0m\n`;
    statsText += `\x1b[1;36m╚═════════════════════════════════════╝\x1b[0m\n\n`;

    const currencies = [
        { name: '💎 RubyCoin', earned: stats.rubycoin_total_earned, spent: stats.rubycoin_total_spent, color: '35' },
        { name: '💰 Peso', earned: stats.peso_total_earned, spent: stats.peso_total_spent, color: '33' },
        { name: '🪙 Sol', earned: stats.sol_total_earned, spent: stats.sol_total_spent, color: '36' },
        { name: '💵 Pound', earned: stats.pound_total_earned, spent: stats.pound_total_spent, color: '32' }
    ];

    currencies.forEach(curr => {
        const balance = curr.earned - curr.spent;
        statsText += `\x1b[1;${curr.color}m${curr.name}\x1b[0m\n`;
        statsText += `  ├─ Заработано: \x1b[1;32m+${curr.earned.toFixed(2)}\x1b[0m\n`;
        statsText += `  ├─ Потрачено: \x1b[1;31m-${curr.spent.toFixed(2)}\x1b[0m\n`;
        statsText += `  └─ Баланс: \x1b[1;37m${balance.toFixed(2)}\x1b[0m\n\n`;
    });

    statsText += '```';
    embed.setDescription(statsText);

    if (transactions.length > 0) {
        let transactionsText = '```ansi\n';
        transactionsText += `\x1b[1;36m═══ 📊 ИСТОРИЯ ТРАНЗАКЦИЙ (${page}/${totalPages}) ═══\x1b[0m\n\n`;

        transactions.forEach((tx, index) => {
            const emoji = getCoinEmoji(tx.coin_type);
            const amountColor = tx.amount > 0 ? '32' : '31';
            const sign = tx.amount > 0 ? '+' : '';
            const typeEmoji = getTransactionTypeEmoji(tx.transaction_type);
            
            const date = new Date(tx.created_at);
            const dateStr = `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

            transactionsText += `\x1b[1;37m${index + 1}.\x1b[0m ${typeEmoji} \x1b[1;${amountColor}m${sign}${tx.amount}\x1b[0m ${emoji}\n`;
            transactionsText += `   \x1b[2m${dateStr}\x1b[0m\n`;
            if (tx.description) {
                transactionsText += `   📝 ${tx.description.substring(0, 40)}${tx.description.length > 40 ? '...' : ''}\n`;
            }
            transactionsText += `   💼 ${tx.balance_before.toFixed(1)} → ${tx.balance_after.toFixed(1)}\n\n`;
        });

        transactionsText += '```';
        embed.addFields({ name: '\u200b', value: transactionsText });
    } else {
        embed.addFields({ name: '\u200b', value: '```\n❌ Транзакции не найдены\n```' });
    }

    embed.setFooter({ text: `Фильтр: ${getFilterName(filterType)} • Страница ${page}/${totalPages}` });

    return embed;
}

function createComponents(filterType, currentPage, totalPages) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('coin_type_select')
        .setPlaceholder('🔍 Выберите тип валюты')
        .addOptions([
            { label: '📊 Все валюты', value: 'ALL', emoji: '📊', default: filterType === 'ALL' },
            { label: 'RubyCoin', value: 'RUBYCOIN', emoji: '💎', default: filterType === 'RUBYCOIN' },
            { label: 'Peso', value: 'PESO', emoji: '💰', default: filterType === 'PESO' },
            { label: 'Sol', value: 'SOL', emoji: '🪙', default: filterType === 'SOL' },
            { label: 'Pound', value: 'POUND', emoji: '💵', default: filterType === 'POUND' }
        ]);

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('◀️ Назад')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('refresh')
                .setLabel('🔄 Обновить')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Вперёд ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages)
        );

    return [new ActionRowBuilder().addComponents(selectMenu), buttons];
}

function getCoinEmoji(coinType) {
    const emojis = {
        'RUBYCOIN': '💎',
        'PESO': '💰',
        'SOL': '🪙',
        'POUND': '💵'
    };
    return emojis[coinType] || '💰';
}

function getTransactionTypeEmoji(type) {
    const emojis = {
        'earned': '✅',
        'spent': '💸',
        'admin_add': '➕',
        'admin_remove': '➖',
        'purchase': '🛒',
        'reward': '🎁',
        'transfer': '🔄',
        'refund': '↩️'
    };
    return emojis[type] || '📌';
}

function getFilterName(filter) {
    const names = {
        'ALL': '📊 Все валюты',
        'RUBYCOIN': '💎 RubyCoin',
        'PESO': '💰 Peso',
        'SOL': '🪙 Sol',
        'POUND': '💵 Pound'
    };
    return names[filter] || 'Все';
}
