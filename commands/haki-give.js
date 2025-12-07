const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Database = require('../database');

const db = new Database();
const ADMIN_ROLE_ID = '1382006799028322324';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('хаки-выдать')
        .setDescription('Выдать крутки хаки пользователю (только администраторы)')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь для выдачи круток')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('количество')
                .setDescription('Количество круток для выдачи')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('пользователь');
            const amount = interaction.options.getInteger('количество');

            // Проверка роли по ID
            const hasRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);
            
            if (!hasRole) {
                return await interaction.reply({
                    content: '❌ У вас нет прав для использования этой команды!',
                    ephemeral: true
                });
            }

            await db.addHakiSpins(targetUser.id, amount);
            const newBalance = await db.getUserHakiSpins(targetUser.id);

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Крутки хаки выданы!')
                .setDescription(`Успешно выдано круток хаки пользователю ${targetUser}`)
                .addFields(
                    { name: '👤 Получатель', value: `<@${targetUser.id}>`, inline: true },
                    { name: '💫 Выдано круток', value: amount.toString(), inline: true },
                    { name: '💫 Новый баланс', value: newBalance.toString(), inline: true },
                    { name: '👮 Администратор', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({
                embeds: [successEmbed]
            });

        } catch (error) {
            console.error('Ошибка команды хаки-выдать:', error);
            await interaction.reply({
                content: 'Произошла ошибка при выдаче круток!',
                ephemeral: true
            });
        }
    }
};
