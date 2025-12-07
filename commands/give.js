const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');

const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('выдать')
        .setDescription('Выдать характеристики персонажу')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь, персонажу которого выдаются характеристики')
                .setRequired(true)),

    async execute(interaction) {
        // Проверка ролей - разрешаем использование для двух ролей
        const allowedRoles = ['1382005661369368586'];
        const hasPermission = allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        
        if (!hasPermission) {
            return await interaction.reply({
                content: 'У вас нет прав для использования этой команды!',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('пользователь');

        try {
            // Получаем всех персонажей пользователя
            const characters = await db.getAllCharactersByUserId(targetUser.id);

            if (characters.length === 0) {
                return await interaction.reply({
                    content: `У пользователя ${targetUser.username} нет персонажей!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Создаем dropdown для выбора персонажа
            const characterSelect = new StringSelectMenuBuilder()
                .setCustomId(`character_select_${targetUser.id}`)
                .setPlaceholder('Выберите персонажа для выдачи характеристик')
                .addOptions(
                    characters.map(char =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(char.name)
                            .setDescription(`ID: ${char.id} | Раса: ${char.race || 'Не указано'}`)
                            .setValue(char.id.toString())
                            .setEmoji('👤')
                    )
                );

            const row = new ActionRowBuilder()
                .addComponents(characterSelect);

            const embed = new EmbedBuilder()
                .setTitle('🎯 Выдача характеристик')
                .setDescription(`Выберите персонажа пользователя ${targetUser} для выдачи характеристик:`)
                .setColor(0x3498db)
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 1024 }))
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Ошибка получения персонажей:', error);
            await interaction.reply({
                content: 'Произошла ошибка при получении списка персонажей!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
