const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');
const RubyCoinLogger = require('../database-rubycoin-logs');
const db = new Database();

const LOG_CHANNEL_ID = '1381454654440865934';

async function sendLogToChannel(client, logData) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('❌ Канал логирования RubyCoin не найден!');
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setTitle('💎 Лог выдачи RubyCoin')
            .setDescription(`💰 **Модератор:** <@${logData.moderatorId}>\n👤 **Получатель:** <@${logData.targetUserId}>`)
            .setColor(0xFFD700)
            .addFields(
                {
                    name: '💎 Выдано RubyCoin:',
                    value: logData.amountDetails,
                    inline: false
                },
                {
                    name: '📊 Баланс:',
                    value: `**Было:** ${logData.previousBalance} RubyCoin\n**Стало:** ${logData.newBalance} RubyCoin`,
                    inline: true
                },
                {
                    name: '📈 Информация:',
                    value: `**Время:** ${new Date().toLocaleString('ru-RU')}\n**Канал:** <#${logData.channelId}>`,
                    inline: false
                }
            )
            .setFooter({ text: `ID модератора: ${logData.moderatorId} | ID получателя: ${logData.targetUserId}` })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
        console.log('✅ Лог выдачи RubyCoin отправлен в канал');
    } catch (error) {
        console.error('❌ Ошибка отправки лога в канал:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('рубикоин')
        .setDescription('Управление RubyCoin')
        .addSubcommand(subcommand =>
            subcommand
                .setName('выдать')
                .setDescription('Выдать RubyCoin пользователю')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь для выдачи')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('количество')
                        .setDescription('Количество RubyCoin (например: 100.50 или -25.75 для списания)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('баланс')
                .setDescription('Проверить баланс RubyCoin')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь для проверки (необязательно)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('топ')
                .setDescription('Показать топ по RubyCoin')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'выдать') {
            const requiredRoleId = '1387823915631378504';
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: 'У вас нет прав для выдачи RubyCoin!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetUser = interaction.options.getUser('пользователь');
            const amountInput = interaction.options.getString('количество');

            try {
                const amount = this.parseAmount(amountInput);
                if (amount === null) {
                    return await interaction.reply({
                        content: 'Неверный формат! Используйте число: 15.50 или -10.25 (для списания)',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const previousBalance = await db.getUserRubyCoins(targetUser.id);
                await db.addRubyCoins(targetUser.id, amount);
                const newBalance = await db.getUserRubyCoins(targetUser.id);

                const logger = new RubyCoinLogger(db.db);
                await logger.logTransaction({
                    userId: targetUser.id,
                    adminId: interaction.user.id,
                    actionType: amount >= 0 ? 'admin_add' : 'admin_remove',
                    amount: amount,
                    balanceBefore: previousBalance,
                    balanceAfter: newBalance,
                    category: 'admin_operation',
                    description: `${amount >= 0 ? 'Выдано' : 'Снято'} администратором ${interaction.user.username}`,
                    guildId: interaction.guildId,
                    channelId: interaction.channelId
                });

                const operationType = amount >= 0 ? 'выданы' : 'списаны';
                const amountDetails = `💎 ${this.formatDecimal(Math.abs(amount))}`;

                const embed = new EmbedBuilder()
                    .setTitle(`💎 RubyCoin ${operationType}!`)
                    .setColor(0xFFD700)
                    .addFields(
                        { name: 'Получатель', value: `<@${targetUser.id}>`, inline: true },
                        { name: operationType === 'выданы' ? 'Выдано' : 'Списано', value: amountDetails, inline: false },
                        { name: 'Баланс до операции', value: `💎 ${this.formatDecimal(previousBalance)}`, inline: true },
                        { name: 'Новый баланс', value: `💎 ${this.formatDecimal(newBalance)}`, inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                await sendLogToChannel(interaction.client, {
                    moderatorId: interaction.user.id,
                    targetUserId: targetUser.id,
                    amountDetails: amountDetails,
                    previousBalance: this.formatDecimal(previousBalance),
                    newBalance: this.formatDecimal(newBalance),
                    channelId: interaction.channelId,
                    timestamp: Date.now()
                });

            } catch (error) {
                console.error('Ошибка выдачи RubyCoin:', error);
                await interaction.reply({
                    content: 'Произошла ошибка при выдаче RubyCoin!',
                    flags: MessageFlags.Ephemeral
                });
            }

        } else if (subcommand === 'баланс') {
            const targetUser = interaction.options.getUser('пользователь') || interaction.user;

            try {
                const balance = await db.getUserRubyCoins(targetUser.id);

                const embed = new EmbedBuilder()
                    .setTitle(`💎 Баланс RubyCoin`)
                    .setDescription(`**${targetUser.username}** имеет **${this.formatDecimal(balance)}** 💎 RubyCoin`)
                    .setColor(0xFFD700)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                const isOwnBalance = targetUser.id === interaction.user.id;
                
                await interaction.reply({ 
                    embeds: [embed],
                    flags: isOwnBalance ? MessageFlags.Ephemeral : undefined
                });
            } catch (error) {
                console.error('Ошибка получения баланса:', error);
                await interaction.reply({
                    content: 'Произошла ошибка при получении баланса!',
                    flags: MessageFlags.Ephemeral
                });
            }

        } else if (subcommand === 'топ') {
            try {
                const leaderboard = await db.getRubyCoinLeaderboard(10);

                if (leaderboard.length === 0) {
                    return await interaction.reply({
                        content: 'Топ RubyCoin пуст!',
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
                    description += `${medal} <@${user.user_id}> - **${this.formatDecimal(user.rubycoins)}** 💎\n`;
                }

                embed.setDescription(description);
                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Ошибка получения топа:', error);
                await interaction.reply({
                    content: 'Произошла ошибка при получении топа!',
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