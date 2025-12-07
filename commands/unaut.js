const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('размут')
        .setDescription('[РАЗРАБОТКА] Снять временный тайм-аут с пользователя')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь для разбана')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('причина')
                .setDescription('Причина разбана')
                .setRequired(false)),

    async execute(interaction) {
        // ВАЖНО: Проверяем состояние взаимодействия в самом начале
        if (interaction.replied || interaction.deferred) {
            console.log('Взаимодействие уже обработано в unban, пропускаем');
            return;
        }

        try {
            // Проверка роли
            const requiredRoleId = '1382013064261537942';
            if (!interaction.member.roles.cache.has(requiredRoleId)) {
                return await interaction.reply({
                    content: 'У вас нет прав для использования этой команды!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Откладываем ответ для длительных операций
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('пользователь');
            const reason = interaction.options.getString('причина') || 'Не указана';

            // ID канала для логов
            const logChannelId = '1383530474034565292';

            // Проверяем, что пользователь существует на сервере
            let member;
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (fetchError) {
                console.error('Ошибка поиска пользователя:', fetchError);
                return await interaction.editReply({
                    content: 'Пользователь не найден на сервере!'
                });
            }

            // Проверяем, что нельзя разбанить самого себя
            if (targetUser.id === interaction.user.id) {
                return await interaction.editReply({
                    content: 'Вы не можете разбанить самого себя!'
                });
            }

            // Проверяем, есть ли у пользователя активный тайм-аут
            if (!member.communicationDisabledUntil || member.communicationDisabledUntil <= new Date()) {
                return await interaction.editReply({
                    content: 'У пользователя нет активного тайм-аута!'
                });
            }

            // Снимаем тайм-аут Discord
            await member.timeout(null, `Разбан: ${reason}`);

            // Удаляем из базы данных
            try {
                await db.removeTempBan(targetUser.id, interaction.guild.id);
            } catch (dbError) {
                console.error('Ошибка удаления из БД:', dbError);
                // Не критично, так как тайм-аут уже снят
            }

            // Отправляем ЛС пользователю
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('✅ Ваш тайм-аут снят')
                    .setColor('#00FF00')
                    .addFields(
                        { name: 'Сервер', value: interaction.guild.name, inline: true },
                        { name: 'Причина', value: reason, inline: true },
                        { name: 'Модератор', value: interaction.user.username, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Вы снова можете отправлять сообщения' });

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Не удалось отправить ЛС пользователю ${targetUser.username}: ${dmError.message}`);
            }

            // Логируем в канал
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                try {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('✅ Снят тайм-аут')
                        .setColor('#00FF00')
                        .addFields(
                            { name: 'Пользователь', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                            { name: 'Модератор', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Причина', value: reason, inline: false }
                        )
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: `ID пользователя: ${targetUser.id}` });

                    await logChannel.send({ embeds: [logEmbed] });
                } catch (logError) {
                    console.error('Ошибка отправки в лог-канал:', logError);
                }
            }

            // Ответ модератору
            const responseEmbed = new EmbedBuilder()
                .setTitle('✅ Тайм-аут снят')
                .setColor('#00FF00')
                .addFields(
                    { name: 'Пользователь', value: `${targetUser.tag}`, inline: true },
                    { name: 'Причина', value: reason, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Пользователь может снова отправлять сообщения' });

            await interaction.editReply({ embeds: [responseEmbed] });

        } catch (error) {
            console.error('Ошибка снятия тайм-аута:', error);
            
            // Безопасная обработка ошибок
            const errorMessage = 'Произошла ошибка при снятии тайм-аута!';
            
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ content: errorMessage });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: errorMessage,
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (editError) {
                console.error('Не удалось отредактировать ответ:', editError);
            }
        }
    }
};
