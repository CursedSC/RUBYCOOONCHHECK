const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class RubyCoinLogViewer {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
        this.itemsPerPage = 10;
        
        this.actionTypeEmojis = {
            earn: '💰',
            spend: '💸',
            purchase: '🛒',
            transfer_in: '📥',
            transfer_out: '📤',
            admin_add: '➕',
            admin_remove: '➖',
            reward: '🎁',
            penalty: '⚠️',
            refund: '↩️'
        };

        this.actionTypeNames = {
            earn: 'Заработок',
            spend: 'Трата',
            purchase: 'Покупка',
            transfer_in: 'Получено',
            transfer_out: 'Отправлено',
            admin_add: 'Выдача админом',
            admin_remove: 'Снятие админом',
            reward: 'Награда',
            penalty: 'Штраф',
            refund: 'Возврат'
        };

        this.categoryEmojis = {
            shop: '🏪',
            work: '💼',
            daily: '📅',
            quest: '⚔️',
            gambling: '🎲',
            gift: '🎁',
            trade: '🤝',
            admin: '👑',
            other: '📋'
        };
    }

    async createUserHistoryEmbed(userId, user, page = 1) {
        const offset = (page - 1) * this.itemsPerPage;
        const transactions = await this.logger.getUserTransactionHistory(userId, {
            limit: this.itemsPerPage,
            offset: offset
        });

        const totalCount = await this.logger.getUserTransactionCount(userId);
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`💎 История рубикоинов: ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Страница ${page}/${totalPages} • Всего транзакций: ${totalCount}`,
                iconURL: this.client.user.displayAvatarURL()
            })
            .setTimestamp();

        if (transactions.length === 0) {
            embed.setDescription('📭 История транзакций пуста');
            return embed;
        }

        let description = '';
        for (const tx of transactions) {
            const emoji = this.actionTypeEmojis[tx.action_type] || '📝';
            const actionName = this.actionTypeNames[tx.action_type] || tx.action_type;
            const categoryEmoji = this.categoryEmojis[tx.category] || '';
            
            const amountColor = tx.amount >= 0 ? '+' : '';
            const amountStr = `${amountColor}${tx.amount.toLocaleString('ru-RU')} RC`;
            
            const date = new Date(tx.created_at);
            const dateStr = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
            
            description += `\n${emoji} **${actionName}** ${categoryEmoji}\n`;
            description += `└ ${amountStr} • Баланс: ${tx.balance_after.toLocaleString('ru-RU')} RC\n`;
            
            if (tx.item_name) {
                description += `└ Предмет: \`${tx.item_name}\`\n`;
            }
            
            if (tx.description) {
                description += `└ ${tx.description}\n`;
            }
            
            description += `└ ${dateStr}\n`;
        }

        embed.setDescription(description);
        return embed;
    }

    async createStatsEmbed(userId, user) {
        const stats = await this.logger.getUserStats(userId);
        const spendingByCategory = await this.logger.getUserSpendingByCategory(userId);
        const earningsBySource = await this.logger.getUserEarningsBySource(userId);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`📊 Статистика рубикоинов: ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        if (!stats || stats.total_transactions === 0) {
            embed.setDescription('📭 Нет данных о транзакциях');
            return embed;
        }

        const netBalance = stats.total_earned - stats.total_spent;
        const netEmoji = netBalance >= 0 ? '📈' : '📉';

        embed.addFields(
            {
                name: '💰 Общая информация',
                value: [
                    `📝 Всего транзакций: **${stats.total_transactions}**`,
                    `💎 Заработано: **${stats.total_earned.toLocaleString('ru-RU')} RC**`,
                    `💸 Потрачено: **${stats.total_spent.toLocaleString('ru-RU')} RC**`,
                    `${netEmoji} Чистый баланс: **${netBalance.toLocaleString('ru-RU')} RC**`
                ].join('\n'),
                inline: false
            }
        );

        if (earningsBySource.length > 0) {
            const earningsText = earningsBySource
                .slice(0, 5)
                .map((item, index) => {
                    const emoji = this.categoryEmojis[item.category] || '📋';
                    return `${index + 1}. ${emoji} ${item.category || 'Прочее'}: **${item.total_earned.toLocaleString('ru-RU')} RC** (${item.transaction_count}x)`;
                })
                .join('\n');

            embed.addFields({
                name: '💰 Топ-5 источников дохода',
                value: earningsText || 'Нет данных',
                inline: false
            });
        }

        if (spendingByCategory.length > 0) {
            const spendingText = spendingByCategory
                .slice(0, 5)
                .map((item, index) => {
                    const emoji = this.categoryEmojis[item.category] || '📋';
                    return `${index + 1}. ${emoji} ${item.category || 'Прочее'}: **${item.total_spent.toLocaleString('ru-RU')} RC** (${item.transaction_count}x)`;
                })
                .join('\n');

            embed.addFields({
                name: '💸 Топ-5 категорий трат',
                value: spendingText || 'Нет данных',
                inline: false
            });
        }

        if (stats.first_transaction) {
            const firstDate = new Date(stats.first_transaction);
            const lastDate = new Date(stats.last_transaction);
            
            embed.addFields({
                name: '⏱️ Активность',
                value: [
                    `Первая транзакция: <t:${Math.floor(firstDate.getTime() / 1000)}:D>`,
                    `Последняя транзакция: <t:${Math.floor(lastDate.getTime() / 1000)}:R>`
                ].join('\n'),
                inline: false
            });
        }

        return embed;
    }

    async createSpendingAnalysisEmbed(userId, user) {
        const spendingByCategory = await this.logger.getUserSpendingByCategory(userId);
        const earningsBySource = await this.logger.getUserEarningsBySource(userId);

        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(`💸 Анализ трат: ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        if (spendingByCategory.length === 0) {
            embed.setDescription('📭 Нет данных о тратах');
            return embed;
        }

        const totalSpent = spendingByCategory.reduce((sum, item) => sum + item.total_spent, 0);
        const totalEarned = earningsBySource.reduce((sum, item) => sum + item.total_earned, 0);

        embed.setDescription(`💰 Всего заработано: **${totalEarned.toLocaleString('ru-RU')} RC**\n💸 Всего потрачено: **${totalSpent.toLocaleString('ru-RU')} RC**`);

        const spendingText = spendingByCategory
            .map((item, index) => {
                const emoji = this.categoryEmojis[item.category] || '📋';
                const percentage = ((item.total_spent / totalSpent) * 100).toFixed(1);
                const progressBar = this.createProgressBar(item.total_spent, totalSpent);
                
                return [
                    `**${index + 1}. ${emoji} ${item.category || 'Прочее'}**`,
                    `${progressBar} ${percentage}%`,
                    `💸 ${item.total_spent.toLocaleString('ru-RU')} RC (${item.transaction_count} транз.)`,
                    ''
                ].join('\n');
            })
            .join('\n');

        embed.addFields({
            name: '📊 Детализация по категориям',
            value: spendingText,
            inline: false
        });

        return embed;
    }

    async createTopUsersEmbed(type, limit, guildId) {
        const isEarners = type === 'earners';
        const data = isEarners 
            ? await this.logger.getTopEarners(guildId, limit)
            : await this.logger.getTopSpenders(guildId, limit);

        const embed = new EmbedBuilder()
            .setColor(isEarners ? '#00FF00' : '#FF6B6B')
            .setTitle(isEarners ? '🏆 Топ заработавших' : '💸 Топ потративших')
            .setTimestamp();

        if (data.length === 0) {
            embed.setDescription('📭 Нет данных');
            return embed;
        }

        const fieldValue = isEarners ? 'total_earned' : 'total_spent';
        const emoji = isEarners ? '💰' : '💸';

        let description = '';
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            try {
                const user = await this.client.users.fetch(item.user_id);
                const username = user.username;
                description += `${medal} **${username}**\n`;
                description += `└ ${emoji} ${item[fieldValue].toLocaleString('ru-RU')} RC (${item.transaction_count} транз.)\n\n`;
            } catch (error) {
                description += `${medal} *Пользователь не найден*\n`;
                description += `└ ${emoji} ${item[fieldValue].toLocaleString('ru-RU')} RC\n\n`;
            }
        }

        embed.setDescription(description);
        return embed;
    }

    async createRecentTransactionsEmbed(limit, guildId) {
        const transactions = await this.logger.getRecentTransactions(limit, guildId);

        const embed = new EmbedBuilder()
            .setColor('#4A90E2')
            .setTitle('⏱️ Последние транзакции')
            .setTimestamp();

        if (transactions.length === 0) {
            embed.setDescription('📭 Нет недавних транзакций');
            return embed;
        }

        let description = '';
        for (const tx of transactions) {
            try {
                const user = await this.client.users.fetch(tx.user_id);
                const emoji = this.actionTypeEmojis[tx.action_type] || '📝';
                const actionName = this.actionTypeNames[tx.action_type] || tx.action_type;
                
                const amountColor = tx.amount >= 0 ? '+' : '';
                const amountStr = `${amountColor}${tx.amount.toLocaleString('ru-RU')} RC`;
                
                const date = new Date(tx.created_at);
                const dateStr = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
                
                description += `${emoji} **${user.username}**: ${actionName}\n`;
                description += `└ ${amountStr} • ${dateStr}\n`;
                
                if (tx.item_name) {
                    description += `└ \`${tx.item_name}\`\n`;
                }
                
                description += '\n';
            } catch (error) {
                continue;
            }
        }

        embed.setDescription(description || 'Нет данных для отображения');
        return embed;
    }

    async createPaginationButtons(userId, currentPage, type) {
        const totalCount = await this.logger.getUserTransactionCount(userId);
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);

        if (totalPages <= 1) return [];

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`rubylogs_${type}_${userId}_${currentPage - 1}`)
                    .setLabel('◀ Назад')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`rubylogs_${type}_${userId}_${currentPage + 1}`)
                    .setLabel('Вперёд ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage >= totalPages)
            );

        return [row];
    }

    createProgressBar(value, max, length = 10) {
        const percentage = Math.min(value / max, 1);
        const filled = Math.round(length * percentage);
        const empty = length - filled;
        
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
}

module.exports = RubyCoinLogViewer;
