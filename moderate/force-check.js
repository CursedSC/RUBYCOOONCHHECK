const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const Database = require('../../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('принудительная-проверка')
        .setDescription('Принудительно проверить и снять истекшие наказания')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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

        try {
            let removedBans = 0;
            let removedMutes = 0;

            // Проверяем истекшие темп-баны
            const expiredBans = await db.getExpiredTempBans();
            const tempBanRoleId = '1386022056503545858';

            for (const ban of expiredBans) {
                try {
                    const member = await interaction.guild.members.fetch(ban.user_id).catch(() => null);
                    if (member) {
                        const tempBanRole = interaction.guild.roles.cache.get(tempBanRoleId);
                        if (tempBanRole && member.roles.cache.has(tempBanRoleId)) {
                            await member.roles.remove(tempBanRole, 'Принудительная проверка истекших банов');
                        }
                    }
                    await db.removeTempBan(ban.user_id, ban.guild_id);
                    removedBans++;
                } catch (error) {
                    console.error(`Ошибка снятия бана с ${ban.user_id}:`, error);
                }
            }

            // Проверяем истекшие темп-муты
            const expiredMutes = await db.getExpiredTempMutes();
            const tempMuteRoleId = '1386022056503545859';

            for (const mute of expiredMutes) {
                try {
                    const member = await interaction.guild.members.fetch(mute.user_id).catch(() => null);
                    if (member) {
                        const tempMuteRole = interaction.guild.roles.cache.get(tempMuteRoleId);
                        if (tempMuteRole && member.roles.cache.has(tempMuteRoleId)) {
                            await member.roles.remove(tempMuteRole, 'Принудительная проверка истекших мутов');
                        }
                    }
                    await db.removeTempMute(mute.user_id, mute.guild_id);
                    removedMutes++;
                } catch (error) {
                    console.error(`Ошибка снятия мута с ${mute.user_id}:`, error);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Принудительная проверка завершена')
                .setColor('#00FF00')
                .addFields(
                    { name: '🚫 Снято темп-банов', value: removedBans.toString(), inline: true },
                    { name: '🔇 Снято темп-мутов', value: removedMutes.toString(), inline: true },
                    { name: '📊 Всего обработано', value: (removedBans + removedMutes).toString(), inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Выполнено ${interaction.user.tag}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Ошибка принудительной проверки:', error);
            await interaction.editReply({
                content: 'Произошла ошибка при принудительной проверке!'
            });
        }
    }
};
