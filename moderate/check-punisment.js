const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Database = require('../../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('проверить-наказания')
        .setDescription('Проверить активные темп-баны и темп-муты')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь для проверки (необязательно)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        // Проверка роли
        const requiredRoleId = '1375115715673198614';
        if (!interaction.member.roles.cache.has(requiredRoleId)) {
            return await interaction.reply({
                content: 'У вас нет прав для использования этой команды!',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        const targetUser = interaction.options.getUser('пользователь');

        try {
            let tempBans, tempMutes;

            if (targetUser) {
                // Проверяем конкретного пользователя
                const tempBan = await db.getTempBan(targetUser.id, interaction.guild.id);
                const tempMute = await db.getTempMute(targetUser.id, interaction.guild.id);
                
                tempBans = tempBan ? [tempBan] : [];
                tempMutes = tempMute ? [tempMute] : [];
            } else {
                // Получаем все активные наказания на сервере
                tempBans = await db.getAllTempBans(interaction.guild.id);
                tempMutes = await db.getAllTempMutes(interaction.guild.id);
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Активные временные наказания')
                .setColor('#FFA500')
                .setTimestamp();

            if (targetUser) {
                embed.setDescription(`Проверка для пользователя: ${targetUser.tag}`);
                embed.setThumbnail(targetUser.displayAvatarURL());
            } else {
                embed.setDescription(`Всего активных наказаний: **${tempBans.length + tempMutes.length}**`);
            }

            // Добавляем информацию о темп-банах
            if (tempBans.length > 0) {
                let bansList = '';
                for (const ban of tempBans.slice(0, 10)) { // Показываем максимум 10
                    const endTime = Math.floor(new Date(ban.ban_end_time).getTime() / 1000);
                    const timeLeft = endTime - Math.floor(Date.now() / 1000);
                    const timeLeftStr = timeLeft > 0 ? `<t:${endTime}:R>` : '**ИСТЕК**';
                    
                    bansList += `<@${ban.user_id}> - ${timeLeftStr}\n`;
                    bansList += `└ Причина: ${ban.reason}\n`;
                    bansList += `└ Модератор: <@${ban.moderator_id}>\n\n`;
                }

                embed.addFields({
                    name: `🚫 Темп-баны (${tempBans.length})`,
                    value: bansList || 'Нет активных темп-банов',
                    inline: false
                });
            }

            // Добавляем информацию о темп-мутах
            if (tempMutes.length > 0) {
                let mutesList = '';
                for (const mute of tempMutes.slice(0, 10)) { // Показываем максимум 10
                    const endTime = Math.floor(new Date(mute.mute_end_time).getTime() / 1000);
                    const timeLeft = endTime - Math.floor(Date.now() / 1000);
                    const timeLeftStr = timeLeft > 0 ? `<t:${endTime}:R>` : '**ИСТЕК**';
                    
                    mutesList += `<@${mute.user_id}> - ${timeLeftStr}\n`;
                    mutesList += `└ Причина: ${mute.reason}\n`;
                    mutesList += `└ Модератор: <@${mute.moderator_id}>\n\n`;
                }

                embed.addFields({
                    name: `🔇 Темп-муты (${tempMutes.length})`,
                    value: mutesList || 'Нет активных темп-мутов',
                    inline: false
                });
            }

            if (tempBans.length === 0 && tempMutes.length === 0) {
                embed.setDescription(targetUser ? 
                    `У пользователя ${targetUser.tag} нет активных наказаний` : 
                    'На сервере нет активных временных наказаний'
                );
                embed.setColor('#00FF00');
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Ошибка проверки наказаний:', error);
            await interaction.editReply({
                content: 'Произошла ошибка при проверке наказаний!'
            });
        }
    }
};
