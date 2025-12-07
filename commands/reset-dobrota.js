const { SlashCommandBuilder } = require('discord.js');
const Database = require('../database');
const db = new Database();

const ALLOWED_ROLE_ID = '1382006178451685377';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('сброс-открыток')
        .setDescription('Обнуляет отправленные открытки у указанного пользователя (0/3)')
        .setDMPermission(false)
        .addUserOption(option =>
            option
                .setName('пользователь')
                .setDescription('Пользователь, у которого нужно обнулить открытки')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Проверка роли
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return await interaction.reply({
                content: '❌ У вас нет доступа к этой команде.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('пользователь');

            // Удаление всех отправленных открыток пользователя
            const deletedCount = await db.deleteKindnessCardsBySender(targetUser.id);

            if (deletedCount === 0) {
                return await interaction.editReply({
                    content: `ℹ️ У ${targetUser} не найдено отправленных открыток.`
                });
            }

            await interaction.editReply({
                content: `✅ Успешно обнулены открытки у ${targetUser}!\n📊 Удалено открыток: **${deletedCount}**\n🔄 Теперь пользователь может снова отправить **0/3** открыток.`
            });

            console.log(`[Сброс открыток] Модератор ${interaction.user.tag} обнулил открытки у ${targetUser.tag} (удалено: ${deletedCount})`);

        } catch (error) {
            console.error('Ошибка при сбросе открыток:', error);
            await interaction.editReply({
                content: '❌ Произошла ошибка при обнулении открыток.'
            });
        }
    }
};
