const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('слоты')
        .setDescription('Управление слотами персонажей')
        .addSubcommand(subcommand =>
            subcommand
                .setName('установить')
                .setDescription('Установить количество слотов для пользователя')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('количество')
                        .setDescription('Количество слотов (1-10)')
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('проверить')
                .setDescription('Проверить слоты пользователя')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Пользователь')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'установить') {
            const requiredRoleId = '1382006799028322324';
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: 'У вас нет прав для использования этой команды!',
                    flags: [4096]
                });
            }

            const targetUser = interaction.options.getUser('пользователь');
            const slotsCount = interaction.options.getInteger('количество');

            try {
                await db.setUserSlots(targetUser.id, slotsCount);

                const embed = new EmbedBuilder()
                    .setTitle('✅ Слоты обновлены!')
                    .setColor(0x00ff00)
                    .addFields(
                        { name: 'Пользователь', value: `<@${targetUser.id}>`, inline: true },
                        { name: 'Количество слотов', value: slotsCount.toString(), inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Ошибка установки слотов:', error);
                await interaction.reply({
                    content: 'Произошла ошибка при установке слотов!',
                    flags: [4096]
                });
            }

        } else if (subcommand === 'проверить') {
            const targetUser = interaction.options.getUser('пользователь') || interaction.user;

            try {
                const maxSlots = await db.getUserSlots(targetUser.id);
                const characters = await db.getAllCharactersByUserId(targetUser.id);

                const slotsInfo = [];
                for (let i = 1; i <= maxSlots; i++) {
                    const char = characters.find(c => c.slot === i);
                    if (char) {
                        slotsInfo.push(`**${i}.** ${char.name} (${char.race})`);
                    } else {
                        slotsInfo.push(`**${i}.** *Пустой слот*`);
                    }
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🎰 Слоты персонажей: ${targetUser.username}`)
                    .setColor(0x2F3136)
                    .setDescription(slotsInfo.join('\n'))
                    .addFields(
                        { name: 'Всего слотов', value: maxSlots.toString(), inline: true },
                        { name: 'Занято', value: characters.length.toString(), inline: true },
                        { name: 'Свободно', value: (maxSlots - characters.length).toString(), inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Ошибка проверки слотов:', error);
                await interaction.reply({
                    content: 'Произошла ошибка при проверке слотов!',
                    flags: [4096]
                });
            }
        }
    }
};
