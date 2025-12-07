const { SlashCommandBuilder, MessageFlags, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js');

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
                .setRequired(false))
        .addStringOption(option =>
            option.setName('биография')
                .setDescription('Краткая биография персонажа (до 200 символов)')
                .setRequired(false)
                .setMaxLength(200))
        .addAttachmentOption(option =>
            option.setName('баннер')
                .setDescription('Баннер профиля (изображение)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('эмодзи')
                .setDescription('Эмодзи для никнейма (будет в начале имени)')
                .setRequired(false)
                .setMaxLength(50)),

    async execute(interaction) {
        const db = new Database();
        
        try {
            const keyword = interaction.options.getString('ключевое-слово').toLowerCase().trim();
            const name = interaction.options.getString('имя').trim();
            const avatarAttachment = interaction.options.getAttachment('аватар');
            const color = interaction.options.getString('цвет') || '#FFD700';
            const bio = interaction.options.getString('биография') || '';
            const bannerAttachment = interaction.options.getAttachment('баннер');
            const emoji = interaction.options.getString('эмодзи') || '';

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

            // Проверка размера файла (максимум 8 МБ)
            if (avatarAttachment.size > 8 * 1024 * 1024) {
                return await interaction.reply({
                    content: '❌ Размер изображения не должен превышать 8 МБ!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Валидация баннера если он есть
            let bannerUrl = null;
            if (bannerAttachment) {
                if (!bannerAttachment.contentType || !bannerAttachment.contentType.startsWith('image/')) {
                    return await interaction.reply({
                        content: '❌ Баннер должен быть изображением!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                if (bannerAttachment.size > 8 * 1024 * 1024) {
                    return await interaction.reply({
                        content: '❌ Размер баннера не должен превышать 8 МБ!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                bannerUrl = bannerAttachment.url;
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

            // Формируем отображаемое имя с эмодзи
            const displayName = emoji ? `${emoji} ${name}` : name;

            // Создаем профиль с расширенными данными
            await db.createProfile(interaction.user.id, keyword, displayName, avatarUrl, color, bio, bannerUrl);

            // Создаём красивый embed для подтверждения
            const embed = new EmbedBuilder()
                .setTitle('✅ Профиль успешно создан!')
                .setColor(parseInt(color.replace('#', ''), 16))
                .setThumbnail(avatarUrl)
                .addFields(
                    { name: '🏷️ Ключевое слово', value: `\`${keyword}\``, inline: true },
                    { name: '👤 Имя', value: displayName, inline: true },
                    { name: '🎨 Цвет', value: color, inline: true }
                )
                .setFooter({ text: `Использование: ${keyword}: ваш текст` })
                .setTimestamp();

            if (bio) {
                embed.addFields({ name: '📝 Биография', value: bio, inline: false });
            }

            if (bannerUrl) {
                embed.setImage(bannerUrl);
                embed.addFields({ name: '🖼️ Баннер', value: 'Установлен', inline: true });
            }

            // Кнопки для дальнейшего управления
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`profile_manage_${keyword}_${interaction.user.id}`)
                    .setLabel('Управление профилем')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚙️'),
                new ButtonBuilder()
                    .setCustomId(`profile_preview_${keyword}_${interaction.user.id}`)
                    .setLabel('Предпросмотр')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👁️')
            );

            await interaction.reply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });

            console.log(`✅ Пользователь ${interaction.user.username} создал профиль "${displayName}" с ключевым словом "${keyword}"`);

        } catch (error) {
            console.error('Ошибка создания профиля:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании профиля. Попробуйте позже.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
