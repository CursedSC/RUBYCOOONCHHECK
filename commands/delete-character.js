// commands/delete-character.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('удалить-персонажа')
        .setDescription('Удалить персонажа')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь, персонажа которого нужно удалить')
                .setRequired(true))
        .setDefaultMemberPermissions(null),

    async execute(interaction) {
        const allowedRoles = ['1382006178451685377', '1404145913928355891'];
        const hasPermission = allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        
        if (!hasPermission) {
            return await interaction.reply({
                content: 'У вас нет прав для использования этой команды!',
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('пользователь');

        try {
            const characters = await db.getAllCharactersByUserId(targetUser.id);
            
            if (characters.length === 0) {
                return await interaction.reply({
                    content: `У пользователя ${targetUser.username} нет персонажей!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const characterSelect = new StringSelectMenuBuilder()
                .setCustomId(`delete_character_select_${targetUser.id}`)
                .setPlaceholder('Выберите персонажа для удаления')
                .addOptions(
                    characters.map(char =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(char.name)
                            .setDescription(`ID: ${char.id} | Раса: ${char.race || 'Не указано'} | Слот: ${char.slot}`)
                            .setValue(char.id.toString())
                            .setEmoji('🗑️')
                    )
                );

            const row = new ActionRowBuilder().addComponents(characterSelect);

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Удаление персонажа')
                .setDescription(`Выберите персонажа пользователя ${targetUser} для удаления:`)
                .setColor(0xff0000)
                .setThumbnail(targetUser.displayAvatarURL({ format: 'png', size: 1024 }))
                .addFields({
                    name: '⚠️ Предупреждение',
                    value: 'Удаление персонажа необратимо! Все данные будут потеряны.',
                    inline: false
                })
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Ошибка получения персонажей для удаления:', error);
            await interaction.reply({
                content: 'Произошла ошибка при получении списка персонажей!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
