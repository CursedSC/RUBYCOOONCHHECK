// commands/transfer-character.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('передать-персонажа')
        .setDescription('Передать персонажа другому пользователю')
        .addUserOption(option =>
            option.setName('от-кого')
                .setDescription('Пользователь, от которого передается персонаж')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('кому')
                .setDescription('Пользователь, которому передается персонаж')
                .setRequired(true))
        .setDefaultMemberPermissions(null),

    async execute(interaction) {
        const allowedRoles = ['1382006178451685377', '1381454973576941568'];
        const hasPermission = allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
        
        if (!hasPermission) {
            return await interaction.reply({
                content: 'У вас нет прав для использования этой команды!',
                flags: MessageFlags.Ephemeral
            });
        }

        const fromUser = interaction.options.getUser('от-кого');
        const toUser = interaction.options.getUser('кому');


        if (fromUser.id === toUser.id) {
            return await interaction.reply({
                content: 'Нельзя передать персонажа самому себе!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const characters = await db.getAllCharactersByUserId(fromUser.id);
            
            if (characters.length === 0) {
                return await interaction.reply({
                    content: `У пользователя ${fromUser.username} нет персонажей!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const receiverSlots = await db.getUserSlots(toUser.id);
            const receiverCharacters = await db.getAllCharactersByUserId(toUser.id);
            
            if (receiverCharacters.length >= receiverSlots) {
                return await interaction.reply({
                    content: `У пользователя ${toUser.username} заняты все слоты! (${receiverCharacters.length}/${receiverSlots})`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const characterSelect = new StringSelectMenuBuilder()
                .setCustomId(`transfer_character_select_${fromUser.id}_${toUser.id}`)
                .setPlaceholder('Выберите персонажа для передачи')
                .addOptions(
                    characters.map(char => {
                        const totalStats = (char.strength || 0) + (char.agility || 0) + (char.reaction || 0) + 
                                         (char.accuracy || 0) + (char.endurance || 0) + (char.durability || 0) + (char.magic || 0);
                        
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(char.name)
                            .setDescription(`ID: ${char.id} | Сила: ${totalStats.toLocaleString()} | Слот: ${char.slot}`)
                            .setValue(char.id.toString())
                            .setEmoji('🔄');
                    })
                );

            const row = new ActionRowBuilder().addComponents(characterSelect);

            const embed = new EmbedBuilder()
                .setTitle('🔄 Передача персонажа')
                .setDescription(`**От:** ${fromUser}\n**Кому:** ${toUser}\n\nВыберите персонажа для передачи:`)
                .setColor(0x3498db)
                .addFields(
                    { name: '📊 Доступно слотов у получателя', value: `${receiverCharacters.length}/${receiverSlots}`, inline: true },
                    { name: '👥 Персонажей у отправителя', value: characters.length.toString(), inline: true }
                )
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Ошибка получения персонажей для передачи:', error);
            await interaction.reply({
                content: 'Произошла ошибка при получении списка персонажей!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
