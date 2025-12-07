const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Database = require('./database');
const db = new Database();

const LOG_CHANNEL_ID = '1381454654440865934';

// Отправка лога в канал
async function sendLogToChannel(client, logData) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('❌ Канал логирования RubyCoin не найден!');
            return;
        }

        const changeType = logData.amount >= 0 ? 'Выдача' : 'Списание';
        const emoji = logData.amount >= 0 ? '➕' : '➖';

        const logEmbed = new EmbedBuilder()
            .setTitle(`💎 ${changeType} RubyCoin`)
            .setDescription(
                `${emoji} **Модератор:** <@${logData.moderatorId}> (\`${logData.moderatorUsername}\`)\n` +
                `👤 **Получатель:** <@${logData.targetUserId}> (\`${logData.targetUsername}\`)`
            )
            .setColor(logData.amount >= 0 ? 0xFFD700 : 0xFF4444)
            .addFields(
                {
                    name: `💎 ${changeType}:`,
                    value: `${logData.amountDetails} RubyCoin`,
                    inline: false
                },
                {
                    name: '📊 Изменение баланса:',
                    value: `**Было:** ${logData.previousBalance} 💎\n` +
                           `**Стало:** ${logData.newBalance} 💎\n` +
                           `**Изменение:** ${logData.amount > 0 ? '+' : ''}${logData.amount} 💎`,
                    inline: true
                },
                {
                    name: '📈 Информация:',
                    value: `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                           `**Канал:** <#${logData.channelId}>`,
                    inline: false
                }
            )
            .setFooter({
                text: `ID: Модератор ${logData.moderatorId} | Получатель ${logData.targetUserId}`
            })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
        console.log('✅ Лог выдачи RubyCoin отправлен');
    } catch (error) {
        console.error('❌ Ошибка отправки лога:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('рубикоин')
        .setDescription('Управление RubyCoin')
        .addSubcommand(subcommand =>
            subcommand
                .setName('выдать')
                .setDescription('Выдать или списать RubyCoin')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('количество')
                        .setDescription('Количество (15.50 или -10.25 для списания)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('баланс')
                .setDescription('Проверить баланс RubyCoin')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь (необязательно)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('топ')
                .setDescription('Топ по RubyCoin'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('история')
                .setDescription('История транзакций')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('тип')
                        .setDescription('Тип операции')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Все', value: 'all' },
                            { name: 'Выдачи админом', value: 'admin_add' },
                            { name: 'Списания админом', value: 'admin_remove' },
                            { name: 'Заработано', value: 'earn' },
                            { name: 'Потрачено', value: 'spend' }
                        ))
                .addIntegerOption(option =>
                    option.setName('лимит')
                        .setDescription('Количество записей (по умолчанию 10)')
                        .setMinValue(5)
                        .setMaxValue(50)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('поиск')
                .setDescription('Поиск транзакций')
                .addStringOption(option =>
                    option.setName('никнейм')
                        .setDescription('Никнейм пользователя (частичное совпадение)')
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName('модератор')
                        .setDescription('Модератор, совершивший операцию')
                        .setRequired(false))
                .addNumberOption(option =>
                    option.setName('мин_сумма')
                        .setDescription('Минимальная сумма')
                        .setRequired(false))
                .addNumberOption(option =>
                    option.setName('макс_сумма')
                        .setDescription('Максимальная сумма')
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // ВЫДАТЬ
        if (subcommand === 'выдать') {
            const requiredRoleId = '1387823915631378504';
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: '❌ У вас нет прав для выдачи RubyCoin!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetUser = interaction.options.getUser('пользователь');
            const amountInput = interaction.options.getString('количество');

            try {
                const amount = this.parseAmount(amountInput);
                if (amount === null) {
                    return await interaction.reply({
                        content: '❌ Неверный формат! Используйте: 15.50 или -10.25',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Небольшая задержка для предотвращения race conditions
                await new Promise(resolve => setTimeout(resolve, 50));

                // Получаем баланс ДО изменения
                const previousBalance = await db.getUserRubyCoins(targetUser.id);
                
                // Изменяем баланс
                await db.addRubyCoins(targetUser.id, amount);
                
                // Получаем баланс ПОСЛЕ изменения
                const newBalance = await db.getUserRubyCoins(targetUser.id);

                // Логируем транзакцию в rubycoin_logs
                await db.logRubyCoinTransaction({
                    userId: targetUser.id,
                    adminId: interaction.user.id,
                    actionType: amount >= 0 ? 'admin_add' : 'admin_remove',
                    amount: amount,
                    balanceBefore: previousBalance,
                    balanceAfter: newBalance,
                    category: 'admin_operation',
                    description: `${amount >= 0 ? 'Выдано' : 'Списано'} модератором`,
                    guildId: interaction.guildId,
                    channelId: interaction.channelId
                }, targetUser, interaction.user);

                const operationType = amount >= 0 ? 'выданы' : 'списаны';
                const emoji = amount >= 0 ? '➕' : '➖';

                const embed = new EmbedBuilder()
                    .setTitle(`${emoji} RubyCoin ${operationType}!`)
                    .setColor(amount >= 0 ? 0xFFD700 : 0xFF4444)
                    .addFields(
                        { name: 'Получатель', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Операция', value: `${this.formatDecimal(Math.abs(amount))} 💎`, inline: false },
                        { name: 'Баланс до', value: `${this.formatDecimal(previousBalance)} 💎`, inline: true },
                        { name: 'Новый баланс', value: `${this.formatDecimal(newBalance)} 💎`, inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                // Отправка лога в канал
                await sendLogToChannel(interaction.client, {
                    moderatorId: interaction.user.id,
                    moderatorUsername: interaction.user.username,
                    targetUserId: targetUser.id,
                    targetUsername: targetUser.username,
                    amountDetails: this.formatDecimal(Math.abs(amount)),
                    amount: amount,
                    previousBalance: this.formatDecimal(previousBalance),
                    newBalance: this.formatDecimal(newBalance),
                    channelId: interaction.channelId
                });

            } catch (error) {
                console.error('❌ Ошибка выдачи RubyCoin:', error);
                await interaction.reply({
                    content: '❌ Произошла ошибка при выдаче RubyCoin!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // БАЛАНС
        else if (subcommand === 'баланс') {
            const targetUser = interaction.options.getUser('пользователь') || interaction.user;

            try {
                const balance = await db.getUserRubyCoins(targetUser.id);
                const stats = await db.getRubyCoinUserStats(targetUser.id);

                const embed = new EmbedBuilder()
                    .setTitle(`💎 Баланс RubyCoin`)
                    .setDescription(`**${targetUser.username}**\n\n💰 **Текущий баланс:** ${this.formatDecimal(balance)} 💎`)
                    .setColor(0xFFD700)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                if (stats) {
                    embed.addFields({
                        name: '📊 Статистика',
                        value: [
                            `📈 Всего заработано: ${this.formatDecimal(stats.total_earned)} 💎`,
                            `📉 Всего потрачено: ${this.formatDecimal(stats.total_spent)} 💎`,
                            `🔢 Транзакций: ${stats.total_transactions}`,
                            `⏱️ Первая операция: <t:${Math.floor(new Date(stats.first_transaction).getTime() / 1000)}:R>`
                        ].join('\n'),
                        inline: false
                    });
                }

                const isOwnBalance = targetUser.id === interaction.user.id;
                await interaction.reply({
                    embeds: [embed],
                    flags: isOwnBalance ? MessageFlags.Ephemeral : undefined
                });

            } catch (error) {
                console.error('❌ Ошибка получения баланса:', error);
                await interaction.reply({
                    content: '❌ Произошла ошибка!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ТОП
        else if (subcommand === 'топ') {
            try {
                const leaderboard = await db.getRubyCoinTopEarners(interaction.guildId, 10);

                if (leaderboard.length === 0) {
                    return await interaction.reply({
                        content: '❌ Топ пуст!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Топ по RubyCoin')
                    .setColor(0xFFD700)
                    .setTimestamp();

                let description = '';
                for (let i = 0; i < leaderboard.length; i++) {
                    const user = leaderboard[i];
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                    const username = user.username ? `(\`${user.username}\`)` : '';
                    description += `${medal} <@${user.user_id}> ${username}\n💎 **${this.formatDecimal(user.current_balance)}** | Заработано: ${this.formatDecimal(user.total_earned)}\n\n`;
                }

                embed.setDescription(description);
                await interaction.reply({ embeds: [embed] });

            } catch (error) {
                console.error('❌ Ошибка топа:', error);
                await interaction.reply({
                    content: '❌ Произошла ошибка!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ИСТОРИЯ
        else if (subcommand === 'история') {
            try {
                const targetUser = interaction.options.getUser('пользователь') || interaction.user;
                const actionType = interaction.options.getString('тип') || 'all';
                const limit = interaction.options.getInteger('лимит') || 10;

                const searchOptions = {
                    userId: targetUser.id,
                    guildId: interaction.guildId,
                    limit: limit
                };

                if (actionType !== 'all') {
                    searchOptions.actionType = actionType;
                }

                const history = await db.searchRubyCoinTransactions(searchOptions);

                if (history.length === 0) {
                    return await interaction.reply({
                        content: '❌ История пуста!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(`📜 История транзакций: ${targetUser.username}`)
                    .setColor(0xFFD700)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                const historyText = history.map(log => {
                    const date = new Date(log.created_at);
                    const timeStamp = Math.floor(date.getTime() / 1000);
                    const emoji = log.amount >= 0 ? '➕' : '➖';
                    const amountStr = `${log.amount > 0 ? '+' : ''}${this.formatDecimal(log.amount)} 💎`;
                    const admin = log.admin_username ? `| Модератор: ${log.admin_username}` : '';
                    return `${emoji} <t:${timeStamp}:R> | ${amountStr}\n📝 ${log.description} ${admin}\n`;
                }).join('\n');

                embed.setDescription(historyText);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });

            } catch (error) {
                console.error('❌ Ошибка истории:', error);
                await interaction.reply({
                    content: '❌ Произошла ошибка!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ПОИСК
        else if (subcommand === 'поиск') {
            try {
                const username = interaction.options.getString('никнейм');
                const moderator = interaction.options.getUser('модератор');
                const minAmount = interaction.options.getNumber('мин_сумма');
                const maxAmount = interaction.options.getNumber('макс_сумма');

                const searchOptions = {
                    limit: 20,
                    guildId: interaction.guildId
                };

                if (username) searchOptions.username = username;
                if (moderator) searchOptions.adminId = moderator.id;
                if (minAmount !== null) searchOptions.minAmount = minAmount;
                if (maxAmount !== null) searchOptions.maxAmount = maxAmount;

                const results = await db.searchRubyCoinTransactions(searchOptions);

                if (results.length === 0) {
                    return await interaction.reply({
                        content: '❌ Ничего не найдено!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🔍 Результаты поиска')
                    .setColor(0xFFD700)
                    .setTimestamp();

                const resultsText = results.map(log => {
                    const date = new Date(log.created_at);
                    const timeStamp = Math.floor(date.getTime() / 1000);
                    const emoji = log.amount >= 0 ? '➕' : '➖';
                    return `${emoji} <t:${timeStamp}:R>\n👤 ${log.username || 'Неизвестно'} (${log.user_id})\n💎 ${this.formatDecimal(log.amount)} | ${log.description}\n`;
                }).join('\n');

                embed.setDescription(resultsText);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });

            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                await interaction.reply({
                    content: '❌ Произошла ошибка!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    },

    parseAmount(input) {
        try {
            const cleanInput = input.trim();
            if (!/^-?\d+(\.\d{1,2})?$/.test(cleanInput)) {
                return null;
            }

            const amount = parseFloat(cleanInput);
            if (isNaN(amount)) {
                return null;
            }

            return amount;
        } catch (error) {
            return null;
        }
    },

    formatDecimal(number) {
        return parseFloat(number.toFixed(2)).toLocaleString('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
};
