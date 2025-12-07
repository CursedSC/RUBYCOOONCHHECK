const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const Database = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('создать-профиль')
        .setDescription('Создать новый профиль для ролевых игр')
        .addStringOption(option =>
            option.setName('ключевое-слово')
                .setDescription('Ключевое слово для активации профиля (только английские буквы и цифры)')
                .setRequired(true)
                .setMaxLength(20))
        .addStringOption(option =>
            option.setName('имя')
                .setDescription('Имя персонажа для отображения')
                .setRequired(true)
                .setMaxLength(32))
        .addAttachmentOption(option =>
            option.setName('аватар')
                .setDescription('Изображение аватара персонажа')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('цвет')
                .setDescription('HEX цвет для embed (например: #FF0000, #00FF00, #0000FF)')
                .setRequired(false)),

    async execute(interaction) {
        const db = new Database();
        
        try {
            const keyword = interaction.options.getString('ключевое-слово').toLowerCase().trim();
            const name = interaction.options.getString('имя').trim();
            const avatarAttachment = interaction.options.getAttachment('аватар');
            const color = interaction.options.getString('цвет') || '#FFD700';

            // Валидация ключевого слова (только латиница и цифры)
            if (!/^[a-zA-Z0-9]+$/.test(keyword)) {
                return await interaction.reply({
                    content: '❌ Ключевое слово может содержать только английские буквы и цифры!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Валидация изображения аватара
            if (!avatarAttachment.contentType || !avatarAttachment.contentType.startsWith('image/')) {
                return await interaction.reply({
                    content: '❌ Прикрепленный файл должен быть изображением!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверка размера файла (например, максимум 8 МБ)
            if (avatarAttachment.size > 8 * 1024 * 1024) {
                return await interaction.reply({
                    content: '❌ Размер изображения не должен превышать 8 МБ!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Валидация цвета
            if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return await interaction.reply({
                    content: '❌ Неверный формат цвета! Используйте HEX формат: #FF0000',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверка лимита профилей (максимум 10)
            const profileCount = await db.getUserProfileCount(interaction.user.id);
            if (profileCount >= 10) {
                return await interaction.reply({
                    content: '❌ Достигнут максимальный лимит профилей (10)! Удалите старые профили перед созданием новых.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверка существования профиля с таким ключевым словом
            const existingProfile = await db.getProfileByKeyword(interaction.user.id, keyword);
            if (existingProfile) {
                return await interaction.reply({
                    content: `❌ Профиль с ключевым словом \`${keyword}\` уже существует!`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // Получаем URL изображения от Discord
            const avatarUrl = avatarAttachment.url;

            // Создаем профиль с URL изображения
            await db.createProfile(interaction.user.id, keyword, name, avatarUrl, color);

            await interaction.reply({
                content: `✅ **Профиль успешно создан!**\n\n` +
                    `🏷️ **Ключевое слово:** \`${keyword}\`\n` +
                    `👤 **Имя:** ${name}\n` +
                    `🎨 **Цвет:** ${color}\n` +
                    `🖼️ **Аватар:** ${avatarAttachment.name}\n\n` +
                    `📝 **Использование:** Напишите \`${keyword}: ваш текст\` в любом канале`,
                flags: MessageFlags.Ephemeral
            });

            console.log(`✅ Пользователь ${interaction.user.username} создал профиль "${name}" с ключевым словом "${keyword}"`);

        } catch (error) {
            console.error('Ошибка создания профиля:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании профиля. Попробуйте позже.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
