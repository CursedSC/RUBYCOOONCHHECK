const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const RubyCoinLogger = require('../database-rubycoin-logs');

const ACTION_EMOJIS = {
    'earn': '💵',
    'admin_add': '📥',
    'reward': '🎁',
    'transfer_in': '📨',
    'spend': '💸',
    'purchase': '🛍️',
    'transfer_out': '📤',
    'admin_remove': '📤'
};

const ACTION_COLORS = {
    'earn': 0x00FF00,
    'admin_add': 0x0099FF,
    'reward': 0xFFD700,
    'transfer_in': 0x00FF7F,
    'spend': 0xFF4500,
    'purchase': 0xFF1493,
    'transfer_out': 0xFF6347,
    'admin_remove': 0xFF0000
};

const ACTION_NAMES = {
    'earn': 'Заработано',
    'admin_add': 'Выдано админом',
    'reward': 'Награда',
    'transfer_in': 'Получен перевод',
    'spend': 'Потрачено',
    'purchase': 'Покупка',
    'transfer_out': 'Отправлен перевод',
    'admin_remove': 'Снято админом'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rubycoin-history')
        .setDescription('📋 Просмотр истории транзакций рубикоинов')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Пользователь (для админов)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Тип транзакций')
                .setRequired(false)
                .addChoices(
                    { name: 'Все транзакции', value: 'all' },
                    { name: 'Только траты', value: 'spending' },
                    { name: 'Только заработок', value: 'earning' }
                )
        ),

    async execute(interaction, database) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const logger = new RubyCoinLogger(database.db);
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const filterType = interaction.options.getString('type') || 'all';

            const hasPermission = interaction.member.permissions.has('Administrator') || 
                                targetUser.id === interaction.user.id;

            if (!hasPermission) {
                return interaction.editReply({
                    content: '❌ Вы можете просматривать только свою историю!',
                    ephemeral: true
                });
            }

            const options = {};
            if (filterType === 'spending') {
                options.actionType = null;
            } else if (filterType === 'earning') {
                options.actionType = null;
            }

            const [transactions, stats, spendingByCategory, earningsBySource] = await Promise.all([
                logger.getUserTransactionHistory(targetUser.id, { limit: 10, ...options }),
                logger.getUserStats(targetUser.id),
                logger.getUserSpendingByCategory(targetUser.id),
                logger.getUserEarningsBySource(targetUser.id)
            ]);

            if (filterType === 'spending') {
                transactions = transactions.filter(t => t.amount < 0);
            } else if (filterType === 'earning') {
                transactions = transactions.filter(t => t.amount > 0);
            }

            const currentBalance = await database.getUserRubyCoins(targetUser.id);

            const embed = new EmbedBuilder()
                .setColor(0x9932CC)
                .setTitle(`📋 История рубикоинов: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const statsText = [
                `💰 **Текущий баланс:** ${currentBalance.toFixed(2)} <:rubyy:1314676196255117433>`,
                `💵 **Всего заработано:** ${(stats?.total_earned || 0).toFixed(2)} <:rubyy:1314676196255117433>`,
                `💸 **Всего потрачено:** ${(stats?.total_spent || 0).toFixed(2)} <:rubyy:1314676196255117433>`,
                `📄 **Всего транзакций:** ${stats?.total_transactions || 0}`
            ].join('\n');

            embed.addFields({ name: '📊 Статистика', value: statsText });

            if (spendingByCategory.length > 0) {
                const spendingText = spendingByCategory
                    .slice(0, 5)
                    .map((cat, i) => 
                        `${i + 1}. **${cat.category || 'Без категории'}**: ${cat.total_spent.toFixed(2)} <:rubyy:1314676196255117433> (${cat.transaction_count} транзакций)`
                    )
                    .join('\n');
                embed.addFields({ name: '🛍️ Топ-5 категорий трат', value: spendingText });
            }

            if (transactions.length === 0) {
                embed.addFields({
                    name: '📄 Последние транзакции',
                    value: 'Нет транзакций'
                });
            } else {
                const transactionsText = transactions
                    .slice(0, 10)
                    .map(t => {
                        const emoji = ACTION_EMOJIS[t.action_type] || '💰';
                        const actionName = ACTION_NAMES[t.action_type] || t.action_type;
                        const amountStr = t.amount >= 0 ? `+${t.amount.toFixed(2)}` : t.amount.toFixed(2);
                        const color = t.amount >= 0 ? '🟢' : '🔴';
                        const date = new Date(t.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        let line = `${emoji} **${actionName}** ${color} ${amountStr} <:rubyy:1314676196255117433>`;
                        
                        if (t.item_name) {
                            line += ` | ${t.item_name}`;
                        }
                        if (t.description) {
                            line += ` | ${t.description}`;
                        }
                        if (t.category && t.category !== 'uncategorized') {
                            line += ` | 🏷️ ${t.category}`;
                        }
                        line += ` | 🕒 ${date}`;
                        line += `\n└ Баланс: ${t.balance_before.toFixed(2)} → ${t.balance_after.toFixed(2)}`;

                        return line;
                    })
                    .join('\n\n');

                embed.addFields({
                    name: '📄 Последние 10 транзакций',
                    value: transactionsText.substring(0, 1024)
                });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`history_refresh_${targetUser.id}_${filterType}`)
                        .setLabel('Обновить')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`history_category_${targetUser.id}`)
                        .setLabel('По категориям')
                        .setEmoji('📈')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`history_export_${targetUser.id}`)
                        .setLabel('Экспорт')
                        .setEmoji('📄')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(transactions.length === 0)
                );

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error('Ошибка при получении истории:', error);
            await interaction.editReply({
                content: '❌ Ошибка при получении истории транзакций',
                ephemeral: true
            });
        }
    }
};