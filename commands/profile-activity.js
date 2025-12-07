const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Database = require('../database');
const ProfileImageGenerator = require('../utils/ProfileImageGenerator');

const db = new Database();
const imageGen = new ProfileImageGenerator();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('профиль_общ')
        .setDescription('Показать профиль активности пользователя')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь для просмотра профиля')
                .setRequired(false)
        ),

    async execute(interaction) {
        // ВАЖНО: Откладываем ответ сразу в начале
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('пользователь') || interaction.user;

        try {
            // Получаем полную информацию о пользователе из гильдии с обновлением
            let guildMember = null;
            try {
                guildMember = await interaction.guild.members.fetch(targetUser.id);
                // Обновляем данные участника для получения актуального никнейма
                guildMember = await guildMember.fetch();
            } catch (error) {
                console.log('Не удалось получить участника гильдии, используем базовые данные пользователя');
            }

            const userToDisplay = guildMember ? guildMember.user : targetUser;

            // Получаем активность пользователя за неделю
            const activity = await db.getUserWeekActivity(targetUser.id, interaction.guild.id);

            // ИСПРАВЛЕНО: Безопасная обработка времени в голосовых каналах
            let voiceTimeSeconds = 0;
            if (activity && activity.voice_time !== null && activity.voice_time !== undefined) {
                // Преобразуем в число и проверяем валидность
                const rawTime = Number(activity.voice_time);
                if (!isNaN(rawTime) && rawTime >= 0) {
                    voiceTimeSeconds = Math.floor(rawTime); // Убираем дробную часть
                }
            }

            // Отладочная информация
            console.log('Отладка времени в голосовых каналах:', {
                activity: activity,
                voice_time_raw: activity?.voice_time,
                voice_time_type: typeof activity?.voice_time,
                voice_time_isNaN: isNaN(activity?.voice_time),
                processed_seconds: voiceTimeSeconds
            });

            // Получаем топ пользователей для определения позиции
            const topUsers = await db.getTopUsersThisWeek(interaction.guild.id, 100);
            const userPosition = topUsers.findIndex(user => user.user_id === targetUser.id) + 1;

            // Получаем персонажей пользователя отсортированных по силе
            const userCharacters = await db.getAllCharactersByUserId(targetUser.id);

            // Вычисляем общие статы для каждого персонажа и сортируем
            const charactersWithStats = userCharacters.map(char => ({
                ...char,
                total_stats: (char.strength || 0) + (char.agility || 0) + (char.reaction || 0) +
                    (char.accuracy || 0) + (char.endurance || 0) + (char.durability || 0) + (char.magic || 0)
            })).sort((a, b) => b.total_stats - a.total_stats);

            // Получаем количество RubyCoin пользователя
            const userRubyCoins = await db.getUserRubyCoins(targetUser.id);

            // Данные для генерации изображения - передаем время как число секунд
            const userData = {
                voiceTime: voiceTimeSeconds, // Передаем как число секунд
                messagesCount: activity ? (activity.messages_count || 0) : 0,
                topPosition: userPosition > 0 ? userPosition : 'Не в топе',
                rubycoins: userRubyCoins || 0
            };

            // Генерируем изображение профиля с персонажами
            const profileImage = await imageGen.generateProfileImage(userData, userToDisplay, charactersWithStats, guildMember);

            // Создаем вложение
            const attachment = new AttachmentBuilder(profileImage, {
                name: 'profile.png'
            });

            // Получаем отображаемое имя пользователя
            const displayName = guildMember ?
                (guildMember.displayName || guildMember.user.globalName || guildMember.user.username) :
                (targetUser.displayName || targetUser.globalName || targetUser.username);

            // Создаем embed с информацией о персонажах
            const embed = new EmbedBuilder()
                .setTitle(`📊 Профиль активности: ${displayName}`)
                .setDescription(`Статистика активности за текущую неделю`)
                .setColor(0x00AE86)
                .setImage('attachment://profile.png')
                .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 128 }))
                .setTimestamp()
                .setFooter({
                    text: `ID пользователя: ${targetUser.id}`,
                    iconURL: interaction.client.user.displayAvatarURL()
                });

            await interaction.editReply({
                embeds: [embed],
                files: [attachment]
            });

        } catch (error) {
            console.error('Ошибка создания профиля:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: 'Произошла ошибка при создании профиля активности!'
                });
            } else {
                await interaction.reply({
                    content: 'Произошла ошибка при создании профиля активности!',
                    ephemeral: true
                });
            }
        }
    }
};
