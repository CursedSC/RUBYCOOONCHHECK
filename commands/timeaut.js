const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('таймаут')
        .setDescription('[РАЗРАБОТКА] Выдать временный тайм-аут пользователю')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь для тайм-аута')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('время')
                .setDescription('Время тайм-аута (например: 1h, 30m, 2d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('причина')
                .setDescription('Причина тайм-аута')
                .setRequired(true)),

    async execute(interaction) {
        // Проверяем состояние взаимодействия в самом начале
        if (interaction.replied || interaction.deferred) {
            console.log('Взаимодействие уже обработано в tempban, пропускаем');
            return;
        }

        // Проверка роли и конкретного пользователя
        const requiredRoleId = '1382006799028322324';
        const specificUserId = '416602253160480769';
        
        const hasRole = interaction.member.roles.cache.has(requiredRoleId);
        const isSpecificUser = interaction.user.id === specificUserId;
        
        if (!hasRole && !isSpecificUser) {
            return await interaction.reply({
                content: 'У вас нет прав для использования этой команды!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Откладываем ответ для длительных операций
        try {
            await interaction.deferReply();
        } catch (deferError) {
            console.error('Ошибка deferReply:', deferError);
            return;
        }

        const targetUser = interaction.options.getUser('пользователь');
        const duration = interaction.options.getString('время');
        const reason = interaction.options.getString('причина');

        // ID канала для логов
        const logChannelId = '1381454654440865934';

        try {
            // Проверяем, что пользователь существует на сервере
            let member;
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (fetchError) {
                return await interaction.editReply({
                    content: 'Пользователь не найден на сервере!'
                });
            }

            // Проверяем, что нельзя забанить администратора
            if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: 'Нельзя выдать тайм-аут администратору!'
                });
            }

            // Проверяем, что нельзя забанить самого себя
            if (targetUser.id === interaction.user.id) {
                return await interaction.editReply({
                    content: 'Вы не можете выдать тайм-аут самому себе!'
                });
            }

            // Парсим время
            const timeoutDuration = this.parseDuration(duration);
            if (!timeoutDuration) {
                return await interaction.editReply({
                    content: 'Неверный формат времени! Используйте: 1h, 30m, 2d\n\n**Примеры:**\n• `30m` - 30 минут\n• `2h` - 2 часа\n• `1d` - 1 день\n• `7d` - 7 дней (максимум)'
                });
            }

            const timeoutEndTime = new Date(Date.now() + timeoutDuration);

            // Проверяем, есть ли уже тайм-аут у пользователя
            if (member.communicationDisabledUntil && member.communicationDisabledUntil > new Date()) {
                return await interaction.editReply({
                    content: 'У пользователя уже есть активный тайм-аут!'
                });
            }

            // Выдаем тайм-аут Discord
            await member.timeout(timeoutDuration, `Тайм-аут: ${reason}`);

            try {
                await db.addTempBan(targetUser.id, interaction.guild.id, timeoutEndTime, reason, interaction.user.id);
            } catch (dbError) {
                console.error('Ошибка сохранения в БД:', dbError);
                await member.timeout(null, 'Ошибка сохранения в БД');
                return await interaction.editReply({
                    content: 'Ошибка сохранения в базе данных!'
                });
            }

            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🚫 Вы получили тайм-аут')
                    .setColor('#FF0000')
                    .addFields(
                        { name: 'Сервер', value: interaction.guild.name, inline: true },
                        { name: 'Причина', value: reason, inline: true },
                        { name: 'Длительность', value: duration, inline: true },
                        { name: 'Окончание', value: `<t:${Math.floor(timeoutEndTime.getTime() / 1000)}:F>`, inline: false },
                        { name: 'Модератор', value: interaction.user.username, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Тайм-аут автоматически снимется по истечении времени' });

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Не удалось отправить ЛС пользователю ${targetUser.username}: ${dmError.message}`);
            }

            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                try {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🚫 Выдан тайм-аут')
                        .setColor('#FF0000')
                        .addFields(
                            { name: 'Пользователь', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
                            { name: 'Модератор', value: `<@${interaction.user.id}>`, inline: true },
                            { name: 'Причина', value: reason, inline: false },
                            { name: 'Длительность', value: duration, inline: true },
                            { name: 'Окончание', value: `<t:${Math.floor(timeoutEndTime.getTime() / 1000)}:F>`, inline: true }
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
                .setTitle('✅ Тайм-аут выдан')
                .setColor('#00FF00')
                .addFields(
                    { name: 'Пользователь', value: `${targetUser.tag}`, inline: true },
                    { name: 'Длительность', value: duration, inline: true },
                    { name: 'Причина', value: reason, inline: false },
                    { name: 'Окончание', value: `<t:${Math.floor(timeoutEndTime.getTime() / 1000)}:F>`, inline: false }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: 'Тайм-аут автоматически снимется по истечении времени' });

            await interaction.editReply({ embeds: [responseEmbed] });

        } catch (error) {
            console.error('Ошибка выдачи тайм-аута:', error);
            try {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: 'Произошла ошибка при выдаче тайм-аута!'
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: 'Произошла ошибка при выдаче тайм-аута!',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (editError) {
                console.error('Не удалось отредактировать ответ:', editError);
            }
        }
    },

    parseDuration(duration) {
        const regex = /^(\d+)([smhdw])$/i;
        const match = duration.match(regex);

        if (!match) return null;

        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        if (value <= 0 || value > 999) return null;

        const multipliers = {
            's': 1000, // секунды
            'm': 60 * 1000, // минуты
            'h': 60 * 60 * 1000, // часы
            'd': 24 * 60 * 60 * 1000, // дни
            'w': 7 * 24 * 60 * 60 * 1000 // недели
        };

        const result = value * (multipliers[unit] || 0);

        // Максимальный тайм-аут Discord - 28 дней
        const maxDuration = 28 * 24 * 60 * 60 * 1000;
        if (result > maxDuration) return null;

        return result;
    }
};
