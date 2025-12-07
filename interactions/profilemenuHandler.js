const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags, ComponentType, ButtonStyle, ButtonBuilder, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const Database = require('../database');
const { handleCustomStylingMenu } = require('./customStylingHandler');

const db = new Database();

// ID роли высших админов
const ADMIN_ROLE_ID = '1381909203005866034';

// Кнопки, которые обрабатывает этот модуль
const PROFILE_BUTTON_PREFIXES = [
    'profile_manage_',
    'profile_gallery_',
    'profile_bio_',
    'profile_achievements_',
    'profile_edit_info_',
    'profile_admin_',
    'profile_gallery_add_',
    'profile_gallery_remove_',
    'profile_back_',
    'achievement_add_',
    'achievement_remove_',
    // Новые кнопки навигации
    'pnav_prev_',
    'pnav_next_',
    'pnav_cat_',
    // Действия владельца
    'pact_avatar_',
    'pact_color_',
    'pact_gallery_',
    'pact_bio_',
    // Админские кнопки
    'padm_info_',
    'padm_stats_',
    'padm_achieve_',
    'padm_shop_',
    'padm_bounty_',
    'pview_wanted_'
];

// Select menu которые обрабатывает этот модуль
const PROFILE_SELECT_PREFIXES = [
    'profile_view_',
    'profile_admin_',
    'profile_manage_',
    'gallery_delete_select_',
    'achievement_delete_select_'
];

// Категории для навигации
const PROFILE_CATEGORIES = [
    { id: 0, name: '📋 Профиль', key: 'profile' },
    { id: 1, name: '🖼️ Галерея', key: 'gallery' },
    { id: 2, name: '🏆 Достижения', key: 'achievements' },
    { id: 3, name: '📖 Биография', key: 'bio' }
];

// Генератор изображений
let profileGenerator;
try {
    profileGenerator = require('../utils/profileGenerator');
} catch (e) {
    console.log('⚠️ profileGenerator не найден, генерация изображений недоступна');
    profileGenerator = null;
}

module.exports = {
    name: 'interactionCreate',

    // Функция для проверки, может ли этот обработчик обработать взаимодействие
    canHandle(interaction) {
        if (interaction.isStringSelectMenu()) {
            return PROFILE_SELECT_PREFIXES.some(prefix => interaction.customId.startsWith(prefix));
        }
        if (interaction.isButton()) {
            return PROFILE_BUTTON_PREFIXES.some(prefix => interaction.customId.startsWith(prefix));
        }
        return false;
    },

    // Проверка прав администратора
    async checkAdminRole(interaction) {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            return member.roles.cache.has(ADMIN_ROLE_ID) || member.permissions.has('Administrator');
        } catch {
            return false;
        }
    },

    async execute(interaction) {
        // Проверяем, что это наш тип взаимодействия
        if (!this.canHandle(interaction)) {
            return;
        }

        // КРИТИЧЕСКИ ВАЖНО: Проверяем состояние взаимодействия
        if (interaction.replied || interaction.deferred) {
            console.log('⚠️ Взаимодействие уже обработано, пропускаем');
            return;
        }

        // Парсим ID персонажа из customId
        const parts = interaction.customId.split('_');
        const characterId = parts[parts.length - 1];
        const customId = interaction.customId;

        // === РОУТИНГ ДЛЯ SELECT MENU ===
        if (interaction.isStringSelectMenu()) {
        const action = interaction.values[0];

            // Просмотр для всех пользователей
            if (customId.startsWith('profile_view_')) {
                if (action === 'gallery') {
                    return await this.handleGallery(interaction, characterId);
                }
                if (action === 'achievements') {
                    return await this.handleAchievements(interaction, characterId);
                }
                if (action === 'bio') {
                    return await this.handleBio(interaction, characterId);
                }
            }

            // Админ-панель (только для админов)
            if (customId.startsWith('profile_admin_')) {
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isAdmin) {
                    return await interaction.reply({
                        content: '❌ У вас нет прав для использования админ-панели!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                switch (action) {
                    case 'edit_info':
                        return await this.handleEditInfo(interaction, characterId);
                    case 'avatar':
                        return await this.handleAvatar(interaction, characterId);
                    case 'color':
                        return await this.handleColor(interaction, characterId);
                    case 'gallery_manage':
                        return await this.handleGalleryManage(interaction, characterId);
                    case 'bio_edit':
                        return await this.handleBioEdit(interaction, characterId);
                    case 'achievement_add':
                        return await this.handleAchievementAdd(interaction, characterId);
                    case 'stats_edit':
                        return await this.handleAdminStats(interaction, characterId);
                    case 'shop':
                        // Редирект в магазин
                        return await interaction.reply({
                            content: `🎨 Используйте кнопку в профиле или команду для открытия магазина.`,
                            flags: MessageFlags.Ephemeral
                        });
                    case 'custom_styling':
                        return await handleCustomStylingMenu(interaction);
                }
            }

            // Удаление из галереи (для владельцев и админов)
            if (customId.startsWith('gallery_delete_select_')) {
                const imageId = interaction.values[0];
                try {
                    const deleted = await db.removeFromCharacterGallery(imageId);
                    if (deleted) {
                        await interaction.reply({
                            content: '✅ Изображение удалено из галереи!',
                            flags: MessageFlags.Ephemeral
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ Изображение не найдено!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                } catch (error) {
                    console.error('Ошибка удаления из галереи:', error);
                    await interaction.reply({
                        content: '❌ Произошла ошибка при удалении!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return;
            }

            // Удаление достижения
            if (customId.startsWith('achievement_delete_select_')) {
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isAdmin) {
                    return await interaction.reply({
                        content: '❌ Только админы могут удалять достижения!',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const achievementId = interaction.values[0];
                try {
                    const deleted = await db.removeCharacterAchievement(achievementId);
                    if (deleted) {
                        await interaction.reply({
                            content: '✅ Достижение удалено!',
                            flags: MessageFlags.Ephemeral
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ Достижение не найдено!',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                } catch (error) {
                    console.error('Ошибка удаления достижения:', error);
                    await interaction.reply({
                        content: '❌ Произошла ошибка при удалении!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return;
            }
        }

        // === РОУТИНГ ДЛЯ КНОПОК ===
        if (interaction.isButton()) {
            
            // === НАВИГАЦИЯ (стрелочки) ===
            if (customId.startsWith('pnav_prev_') || customId.startsWith('pnav_next_')) {
                return await this.handleNavigation(interaction, customId);
            }

            // === ДЕЙСТВИЯ ВЛАДЕЛЬЦА ===
            if (customId.startsWith('pact_')) {
                return await this.handleOwnerAction(interaction, customId);
            }

            // === WANTED ПОСТЕР ===
            if (customId.startsWith('pview_wanted_')) {
                return await this.handleShowWanted(interaction, customId);
            }

            // === АДМИНСКИЕ КНОПКИ ===
            if (customId.startsWith('padm_')) {
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isAdmin) {
                    return await interaction.reply({
                        content: '❌ Только для администраторов!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return await this.handleAdminAction(interaction, customId);
            }

            // Галерея (владелец или админ могут добавлять/удалять)
            if (customId.startsWith('profile_gallery_add_')) {
                const character = await db.getCharacterById(characterId);
                const isOwner = character && character.user_id === interaction.user.id;
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isOwner && !isAdmin) {
                    return await interaction.reply({
                        content: '❌ Вы не можете добавлять изображения в эту галерею!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return await this.handleGalleryAdd(interaction, characterId);
            }
            if (customId.startsWith('profile_gallery_remove_')) {
                const character = await db.getCharacterById(characterId);
                const isOwner = character && character.user_id === interaction.user.id;
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isOwner && !isAdmin) {
                    return await interaction.reply({
                        content: '❌ Вы не можете удалять изображения из этой галереи!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return await this.handleGalleryRemove(interaction, characterId);
            }
            if (customId.startsWith('profile_gallery_')) {
                return await this.handleGallery(interaction, characterId);
            }
            
            // Достижения
            if (customId.startsWith('profile_achievements_')) {
                return await this.handleAchievements(interaction, characterId);
            }
            if (customId.startsWith('achievement_add_')) {
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isAdmin) {
                    return await interaction.reply({
                        content: '❌ Только админы могут выдавать достижения!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return await this.handleAchievementAdd(interaction, characterId);
            }
            if (customId.startsWith('achievement_remove_')) {
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isAdmin) {
                    return await interaction.reply({
                        content: '❌ Только админы могут удалять достижения!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return await this.handleAchievementRemove(interaction, characterId);
            }

            // Биография (владелец или админ)
            if (customId.startsWith('profile_bio_edit_')) {
                const character = await db.getCharacterById(characterId);
                const isOwner = character && character.user_id === interaction.user.id;
                const isAdmin = await this.checkAdminRole(interaction);
                if (!isOwner && !isAdmin) {
                    return await interaction.reply({
                        content: '❌ Вы не можете редактировать эту биографию!',
                        flags: MessageFlags.Ephemeral
                    });
                }
                return await this.handleBioEdit(interaction, characterId);
            }
            if (customId.startsWith('profile_bio_')) {
                return await this.handleBio(interaction, characterId);
            }

            // Назад к профилю
            if (customId.startsWith('profile_back_')) {
                return await interaction.reply({
                    content: `📋 Используйте команду \`/профиль\` для возврата к профилю.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        
        // Определяем действие
        let action;
        if (interaction.isButton()) {
            // Для кнопок: profile_manage_avatar_123 -> avatar
            action = parts[2];
        } else {
            // Для select menu: profile_manage_123 -> берем из values
            action = interaction.values[0];
        }

        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: 'Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (character.user_id !== interaction.user.id) {
                return await interaction.reply({
                    content: 'Вы можете редактировать только своих персонажей!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (action === 'avatar') {
                const modal = new ModalBuilder()
                    .setCustomId(`avatar_modal_${characterId}`)
                    .setTitle('Изменить аватар персонажа');

                const avatarInput = new TextInputBuilder()
                    .setCustomId('avatar_url')
                    .setLabel('URL изображения')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('https://example.com/image.png')
                    .setValue(character.avatar_url || '');

                const firstActionRow = new ActionRowBuilder().addComponents(avatarInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);


            } else             if (action === 'custom' || action === 'custom_styling') {
                await handleCustomStylingMenu(interaction);
            } else if (action === 'color') {
                const modal = new ModalBuilder()
                    .setCustomId(`color_modal_${characterId}`)
                    .setTitle('Изменить цвет профиля');

                const colorInput = new TextInputBuilder()
                    .setCustomId('color_value')
                    .setLabel('Цвет (HEX код или название)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('#FF0000 или красный')
                    .setValue(character.embed_color || '#9932cc');

                const firstActionRow = new ActionRowBuilder().addComponents(colorInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);

            } else if (action === 'icon') {
                const modal = new ModalBuilder()
                    .setCustomId(`icon_modal_${characterId}`)
                    .setTitle('Изменить иконку для топа');

                const iconInput = new TextInputBuilder()
                    .setCustomId('icon_url')
                    .setLabel('URL иконки (512x512 пикселей)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setPlaceholder('https://example.com/icon.png')
                    .setValue(character.icon_url || '');

                const firstActionRow = new ActionRowBuilder().addComponents(iconInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
            } else if (action === 'personal') {
                const modal = new ModalBuilder()
                    .setCustomId(`personal_modal_${characterId}`)
                    .setTitle('Изменить личную информацию');

                const nameInput = new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel('Имя персонажа')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(50)
                    .setValue(character.name || '');

                const raceInput = new TextInputBuilder()
                    .setCustomId('race')
                    .setLabel('Раса')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(30)
                    .setValue(character.race || '');

                const ageInput = new TextInputBuilder()
                    .setCustomId('age')
                    .setLabel('Возраст')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(3)
                    .setValue(character.age ? character.age.toString() : '');

                const nicknameInput = new TextInputBuilder()
                    .setCustomId('nickname')
                    .setLabel('Прозвище')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(50)
                    .setValue(character.nickname || '');

                const mentionInput = new TextInputBuilder()
                    .setCustomId('mention')
                    .setLabel('Упоминание/Цитата')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(200)
                    .setValue(character.mention || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(raceInput),
                    new ActionRowBuilder().addComponents(ageInput),
                    new ActionRowBuilder().addComponents(nicknameInput),
                    new ActionRowBuilder().addComponents(mentionInput)
                );

                await interaction.showModal(modal);

            } else if (action === 'abilities') {
                const modal = new ModalBuilder()
                    .setCustomId(`abilities_modal_${characterId}`)
                    .setTitle('Изменить способности');

                const devilFruitInput = new TextInputBuilder()
                    .setCustomId('devilfruit')
                    .setLabel('Дьявольский плод')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(200)
                    .setValue(character.devilfruit || '');

                const patronageInput = new TextInputBuilder()
                    .setCustomId('patronage')
                    .setLabel('Покровительство')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(200)
                    .setValue(character.patronage || '');

                const coreInput = new TextInputBuilder()
                    .setCustomId('core')
                    .setLabel('Ядро')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(200)
                    .setValue(character.core || '');

                const elementsInput = new TextInputBuilder()
                    .setCustomId('elements')
                    .setLabel('Стихии')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(200)
                    .setValue(character.elements || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(devilFruitInput),
                    new ActionRowBuilder().addComponents(patronageInput),
                    new ActionRowBuilder().addComponents(coreInput),
                    new ActionRowBuilder().addComponents(elementsInput)
                );

                await interaction.showModal(modal);

            } else if (action === 'misc') {
                const modal = new ModalBuilder()
                    .setCustomId(`misc_modal_${characterId}`)
                    .setTitle('Изменить прочее');

                const organizationInput = new TextInputBuilder()
                    .setCustomId('organization')
                    .setLabel('Организация')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(100)
                    .setValue(character.organization || '');

                const positionInput = new TextInputBuilder()
                    .setCustomId('position')
                    .setLabel('Должность')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setMaxLength(100)
                    .setValue(character.position || '');

                const budgetInput = new TextInputBuilder()
                    .setCustomId('budget')
                    .setLabel('Бюджет (добавить к текущему)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const additionalInput = new TextInputBuilder()
                    .setCustomId('additional')
                    .setLabel('Дополнительная информация')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(500)
                    .setValue(character.additional || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(organizationInput),
                    new ActionRowBuilder().addComponents(positionInput),
                    new ActionRowBuilder().addComponents(budgetInput),
                    new ActionRowBuilder().addComponents(additionalInput)
                );

                await interaction.showModal(modal);

            } else if (action === 'stats') {
                const modal = new ModalBuilder()
                    .setCustomId(`stats_modal_${characterId}`)
                    .setTitle('Изменить характеристики');

                const strengthInput = new TextInputBuilder()
                    .setCustomId('strength')
                    .setLabel('Сила (добавить к текущему)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const agilityInput = new TextInputBuilder()
                    .setCustomId('agility')
                    .setLabel('Ловкость (добавить к текущему)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const reactionInput = new TextInputBuilder()
                    .setCustomId('reaction')
                    .setLabel('Реакция (добавить к текущему)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const accuracyInput = new TextInputBuilder()
                    .setCustomId('accuracy')
                    .setLabel('Точность (добавить к текущему)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(strengthInput),
                    new ActionRowBuilder().addComponents(agilityInput),
                    new ActionRowBuilder().addComponents(reactionInput),
                    new ActionRowBuilder().addComponents(accuracyInput)
                );

                await interaction.showModal(modal);

            } else if (action === 'haki') {
                const modal = new ModalBuilder()
                    .setCustomId(`haki_modal_${characterId}`)
                    .setTitle('Изменить хаки');

                const armamentInput = new TextInputBuilder()
                    .setCustomId('hakivor')
                    .setLabel('Воля Вооружения (добавить)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const observationInput = new TextInputBuilder()
                    .setCustomId('hakinab')
                    .setLabel('Воля Наблюдения (добавить)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const conquerorInput = new TextInputBuilder()
                    .setCustomId('hakiconq')
                    .setLabel('Королевская Воля (добавить)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setPlaceholder('Введите число для добавления');

                const martialArtsInput = new TextInputBuilder()
                    .setCustomId('martialarts')
                    .setLabel('Боевые искусства')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(200)
                    .setValue(character.martialarts || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(armamentInput),
                    new ActionRowBuilder().addComponents(observationInput),
                    new ActionRowBuilder().addComponents(conquerorInput),
                    new ActionRowBuilder().addComponents(martialArtsInput)
                );

                await interaction.showModal(modal);

            } else {
                return await interaction.reply({
                    content: 'Неизвестное действие!',
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            console.error('❌ Ошибка обработки управления профилем:', error);
            
            // Безопасная отправка ошибки
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Произошла ошибка при обработке запроса!',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                console.error('❌ Не удалось отправить сообщение об ошибке:', replyError);
            }
        }
    },

    // === НОВЫЕ ОБРАБОТЧИКИ ===

    /**
     * Навигация по категориям профиля (стрелочки)
     */
    async handleNavigation(interaction, customId) {
        try {
            // Формат: pnav_prev_0_charId_userId или pnav_next_0_charId_userId
            const parts = customId.split('_');
            const direction = parts[1]; // prev или next
            const currentCat = parseInt(parts[2]);
            const characterId = parts[3];
            const allowedUserId = parts[4];

            // Проверяем, что листать может только тот, кто вызвал
            if (interaction.user.id !== allowedUserId) {
                return await interaction.reply({
                    content: '❌ Только автор команды может листать профиль!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Вычисляем новую категорию
            let newCat = currentCat;
            if (direction === 'prev') {
                newCat = currentCat > 0 ? currentCat - 1 : PROFILE_CATEGORIES.length - 1;
            } else {
                newCat = currentCat < PROFILE_CATEGORIES.length - 1 ? currentCat + 1 : 0;
            }

            const category = PROFILE_CATEGORIES[newCat];
            
            // Показываем соответствующую категорию
            switch (category.key) {
                case 'profile':
                    return await this.showCategoryProfile(interaction, character, newCat, allowedUserId);
                case 'power':
                    return await this.showCategoryPower(interaction, character, newCat, allowedUserId);
                case 'gallery':
                    return await this.showCategoryGallery(interaction, character, newCat, allowedUserId);
                case 'achievements':
                    return await this.showCategoryAchievements(interaction, character, newCat, allowedUserId);
                case 'bio':
                    return await this.showCategoryBio(interaction, character, newCat, allowedUserId);
            }

        } catch (error) {
            console.error('❌ Ошибка навигации:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Показать профиль в режиме навигации (Components V2)
     */
    async showCategoryProfile(interaction, character, catIndex, userId) {
        const color = parseInt(character.embed_color?.replace('#', '') || '5865F2', 16);
        
        const components = [];

        // Заголовок
        let titleText = `## ${character.name}`;
        if (character.nickname) titleText += ` | *"${character.nickname}"*`;
        
        components.push({
            type: ComponentType.Container,
            accent_color: color,
            components: [{
                type: ComponentType.TextDisplay,
                content: titleText
            }]
        });

        // Аватар
        if (character.avatar_url) {
            components.push({
                type: ComponentType.MediaGallery,
                items: [{
                    type: ComponentType.MediaGalleryItem,
                    media: { url: character.avatar_url },
                    description: character.name
                }]
            });
        }

        // Основная информация
        const basicInfo = [];
        if (character.race) basicInfo.push(`👤 **Раса:** ${character.race}`);
        if (character.age) basicInfo.push(`🎂 **Возраст:** ${character.age}`);
        if (character.organization) basicInfo.push(`🏛️ **Организация:** ${character.organization}`);
        if (character.position) basicInfo.push(`👔 **Должность:** ${character.position}`);

        if (basicInfo.length > 0) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('3498DB', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### 📋 Основная информация\n${basicInfo.join('\n')}`
                }]
            });
        }

        // Характеристики
        const stats = [];
        if (character.strength) stats.push(`💪 Сила: **${character.strength}**`);
        if (character.agility) stats.push(`🏃 Ловкость: **${character.agility}**`);
        if (character.reaction) stats.push(`⚡ Реакция: **${character.reaction}**`);
        if (character.accuracy) stats.push(`🎯 Точность: **${character.accuracy}**`);
        
        if (stats.length > 0) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('E74C3C', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### ⚔️ Боевые характеристики\n${stats.join(' | ')}`
                }]
            });
        }

        // Хаки
        const haki = [];
        if (character.hakivor) haki.push(`🛡️ Вооружение: **${character.hakivor}**`);
        if (character.hakinab) haki.push(`👁️ Наблюдение: **${character.hakinab}**`);
        if (character.hakiconq) haki.push(`👑 Королевская: **${character.hakiconq}**`);
        
        if (haki.length > 0) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('9B59B6', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### 🔮 Хаки\n${haki.join(' | ')}`
                }]
            });
        }

        // Способности
        const abilities = [];
        if (character.devilfruit) abilities.push(`🍎 **Дьявольский плод:** ${character.devilfruit}`);
        if (character.patronage) abilities.push(`✨ **Покровительство:** ${character.patronage}`);
        if (character.core) abilities.push(`💠 **Ядро:** ${character.core}`);
        if (character.elements) abilities.push(`🌪️ **Стихии:** ${character.elements}`);
        if (character.martialarts) abilities.push(`🥋 **Боевые искусства:** ${character.martialarts}`);

        if (abilities.length > 0) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('F39C12', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### ⚡ Способности\n${abilities.join('\n')}`
                }]
            });
        }

        // Финансы
        if (character.budget) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('2ECC71', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### 💰 Бюджет\n**${character.budget.toLocaleString()}** белли`
                }]
            });
        }

        // Цитата
        if (character.mention) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('5865F2', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `> *"${character.mention}"*`
                }]
            });
        }

        // Дополнительная информация
        if (character.additional) {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('95A5A6', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### 📝 Дополнительно\n${character.additional.substring(0, 500)}`
                }]
            });
        }

        // Навигация
        components.push(this.buildNavButtons(catIndex, character.id, userId));

        await interaction.update({
            components: components,
            flags: MessageFlags.IsComponentsV2
        });
    },

    /**
     * Показать вкладку СИЛА (тир, шестиугольник, награда)
     */
    async showCategoryPower(interaction, character, catIndex, userId) {
        const { AttachmentBuilder } = require('discord.js');
        const color = parseInt(character.embed_color?.replace('#', '') || '5865F2', 16);
        
        const components = [];
        const files = [];

        // Рассчитываем силу и тир
        let tierInfo = { tier: 'E', name: 'Новичок', color: '#808080' };
        let totalPower = 0;
        let hexagonBuffer = null;
        let wantedBuffer = null;
        let tierBuffer = null;

        if (profileGenerator) {
            totalPower = profileGenerator.calculateTotalPower(character);
            tierInfo = profileGenerator.getPowerTier(totalPower);
            
            try {
                // Генерируем изображения
                hexagonBuffer = await profileGenerator.generateHexagonStats(character);
                wantedBuffer = await profileGenerator.generateWantedPoster(character, character.avatar_url);
                tierBuffer = await profileGenerator.generateTierCard(character);
            } catch (e) {
                console.error('Ошибка генерации изображений:', e);
            }
        } else {
            // Простой расчёт без генератора
            totalPower = (character.strength || 0) + (character.agility || 0) + 
                         (character.reaction || 0) + (character.accuracy || 0) +
                         (character.hakivor || 0) + (character.hakinab || 0) + (character.hakiconq || 0);
        }

        // Заголовок с тиром
        const tierColor = parseInt(tierInfo.color?.replace('#', '') || 'FFD700', 16);
        components.push({
            type: ComponentType.Container,
            accent_color: tierColor,
            components: [{
                type: ComponentType.TextDisplay,
                content: `## ⚔️ ${character.name} | Тир ${tierInfo.tier}\n### ${tierInfo.name}`
            }]
        });

        // Если есть изображения - добавляем
        if (tierBuffer) {
            const tierAttachment = new AttachmentBuilder(tierBuffer, { name: 'tier.png' });
            files.push(tierAttachment);
            
            components.push({
                type: ComponentType.MediaGallery,
                items: [{
                    type: ComponentType.MediaGalleryItem,
                    media: { url: 'attachment://tier.png' },
                    description: `Тир ${tierInfo.tier}`
                }]
            });
        }

        // Характеристики текстом
        const statsText = [
            `💪 **Сила:** ${(character.strength || 0).toLocaleString()}`,
            `🏃 **Ловкость:** ${(character.agility || 0).toLocaleString()}`,
            `⚡ **Реакция:** ${(character.reaction || 0).toLocaleString()}`,
            `🎯 **Точность:** ${(character.accuracy || 0).toLocaleString()}`
        ].join(' | ');

        const hakiText = [
            `🛡️ **Вооружение:** ${(character.hakivor || 0).toLocaleString()}`,
            `👁️ **Наблюдение:** ${(character.hakinab || 0).toLocaleString()}`,
            `👑 **Королевская:** ${(character.hakiconq || 0).toLocaleString()}`
        ].join(' | ');

        components.push({
            type: ComponentType.Container,
            accent_color: parseInt('E74C3C', 16),
            components: [{
                type: ComponentType.TextDisplay,
                content: `### 📊 Характеристики\n${statsText}\n\n### 🔮 Хаки\n${hakiText}\n\n**Общая сила:** ${totalPower.toLocaleString()}`
            }]
        });

        // Награда за голову
        const bounty = character.bounty || 0;
        let bountyText;
        if (bounty >= 1000000000) {
            bountyText = `${(bounty / 1000000000).toFixed(1)} млрд`;
        } else if (bounty >= 1000000) {
            bountyText = `${(bounty / 1000000).toFixed(0)} млн`;
        } else if (bounty >= 1000) {
            bountyText = `${(bounty / 1000).toFixed(0)} тыс`;
        } else {
            bountyText = bounty.toLocaleString();
        }

        components.push({
            type: ComponentType.Container,
            accent_color: parseInt('8B0000', 16),
            components: [{
                type: ComponentType.TextDisplay,
                content: `### 💰 Награда за голову\n# ฿ ${bountyText}${bounty === 0 ? '\n*Награда не назначена*' : ''}`
            }]
        });

        // Шестиугольник характеристик
        if (hexagonBuffer) {
            const hexAttachment = new AttachmentBuilder(hexagonBuffer, { name: 'hexagon.png' });
            files.push(hexAttachment);
            
            components.push({
                type: ComponentType.MediaGallery,
                items: [{
                    type: ComponentType.MediaGalleryItem,
                    media: { url: 'attachment://hexagon.png' },
                    description: 'Характеристики'
                }]
            });
        }

        // Навигация
        components.push(this.buildNavButtons(catIndex, character.id, userId));

        // Админские кнопки
        const isAdmin = await this.checkAdminRole(interaction);
        if (isAdmin) {
            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Danger,
                        label: '💰 Изменить награду',
                        custom_id: `padm_bounty_${character.id}`
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Danger,
                        label: '📊 WANTED постер',
                        custom_id: `pview_wanted_${character.id}_${userId}`
                    }
                ]
            });
        }

        await interaction.update({
            components: components,
            files: files,
            flags: MessageFlags.IsComponentsV2
        });
    },

    /**
     * Построить кнопки навигации (Components V2)
     */
    buildNavButtons(currentCat, characterId, userId) {
        const category = PROFILE_CATEGORIES[currentCat];
        return {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    label: '◀',
                    custom_id: `pnav_prev_${currentCat}_${characterId}_${userId}`
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    label: category.name,
                    custom_id: `pnav_cat_${currentCat}_${characterId}_${userId}`,
                    disabled: true
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Secondary,
                    label: '▶',
                    custom_id: `pnav_next_${currentCat}_${characterId}_${userId}`
                }
            ]
        };
    },

    /**
     * Показать галерею в режиме навигации (Components V2)
     */
    async showCategoryGallery(interaction, character, catIndex, userId) {
        const gallery = await db.getCharacterGallery(character.id);
        const color = parseInt(character.embed_color?.replace('#', '') || '5865F2', 16);
        
        const components = [];

        // Заголовок
        components.push({
            type: ComponentType.Container,
            accent_color: color,
            components: [{
                type: ComponentType.TextDisplay,
                content: `## 🖼️ Галерея: ${character.name}`
            }]
        });

        if (gallery && gallery.length > 0) {
            // MediaGallery
            const mediaItems = gallery.slice(0, 5).map((img, index) => ({
                type: ComponentType.MediaGalleryItem,
                media: { url: img.image_url },
                description: img.description || `Изображение ${index + 1}`
            }));

            components.push({
                type: ComponentType.MediaGallery,
                items: mediaItems
            });

            // Описания
            const descriptions = gallery.map((img, i) => 
                `**${i + 1}.** ${img.description || 'Без описания'}`
            ).join('\n');

            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('2F3136', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: descriptions.substring(0, 1000)
                }]
            });
        } else {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('5865F2', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: '*Галерея пуста*'
                }]
            });
        }

        // Навигация
        components.push(this.buildNavButtons(catIndex, character.id, userId));

        await interaction.update({
            components: components,
            flags: MessageFlags.IsComponentsV2
        });
    },

    /**
     * Показать достижения в режиме навигации (Components V2)
     */
    async showCategoryAchievements(interaction, character, catIndex, userId) {
        const achievements = await db.getCharacterAchievements(character.id);
        const color = parseInt(character.embed_color?.replace('#', '') || 'FFD700', 16);
        
        const components = [];

        // Заголовок
        components.push({
            type: ComponentType.Container,
            accent_color: color,
            components: [{
                type: ComponentType.TextDisplay,
                content: `## 🏆 Достижения: ${character.name}`
            }]
        });

        if (achievements && achievements.length > 0) {
            const rarityEmoji = { mythic: '🔴', legendary: '🟠', epic: '🟣', rare: '🔵', common: '⚪' };
            const achievementsList = achievements.map(ach => {
                const icon = ach.icon || '🏆';
                const rarity = rarityEmoji[ach.rarity] || '⚪';
                return `${icon} **${ach.title}** ${rarity}\n> ${ach.description || 'Без описания'}`;
            }).join('\n\n');

            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('F1C40F', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: achievementsList.substring(0, 1500)
                }]
            });
        } else {
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('5865F2', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: '*Нет достижений*\n\nДостижения выдаются администрацией!'
                }]
            });
        }

        // Навигация
        components.push(this.buildNavButtons(catIndex, character.id, userId));

        await interaction.update({
            components: components,
            flags: MessageFlags.IsComponentsV2
        });
    },

    /**
     * Показать биографию в режиме навигации (Components V2)
     */
    async showCategoryBio(interaction, character, catIndex, userId) {
        const color = parseInt(character.embed_color?.replace('#', '') || '5865F2', 16);
        
        const bio = character.biography || '*Не заполнено*';
        const backstory = character.backstory || '*Не заполнено*';
        const personality = character.personality || '*Не заполнено*';
        const goals = character.goals || '*Не заполнено*';

        const components = [];

        // Заголовок
        components.push({
            type: ComponentType.Container,
            accent_color: color,
            components: [{
                type: ComponentType.TextDisplay,
                content: `## 📖 Биография: ${character.name}`
            }]
        });

        // История
        components.push({
            type: ComponentType.Container,
            accent_color: parseInt('3498DB', 16),
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### 📜 История\n${bio.substring(0, 500)}`
                },
                {
                    type: ComponentType.Separator,
                    divider: true
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `### 🔮 Предыстория\n${backstory.substring(0, 500)}`
                }
            ]
        });

        // Характер и цели
        components.push({
            type: ComponentType.Container,
            accent_color: parseInt('9B59B6', 16),
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `### 🎭 Характер\n${personality.substring(0, 300)}`
                },
                {
                    type: ComponentType.Separator,
                    divider: true
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `### 🎯 Цели\n${goals.substring(0, 300)}`
                }
            ]
        });

        // Навигация
        components.push(this.buildNavButtons(catIndex, character.id, userId));

        await interaction.update({
            components: components,
            flags: MessageFlags.IsComponentsV2
        });
    },

    /**
     * Обработка действий владельца персонажа
     */
    async handleOwnerAction(interaction, customId) {
        try {
            // Формат: pact_avatar_charId_userId
            const parts = customId.split('_');
            const action = parts[1];
            const characterId = parts[2];
            const allowedUserId = parts[3];

            // Проверяем что это владелец
            if (interaction.user.id !== allowedUserId) {
                return await interaction.reply({
                    content: '❌ Это не ваш персонаж!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Дополнительная проверка владельца
            if (character.user_id !== interaction.user.id) {
                return await interaction.reply({
                    content: '❌ Вы не владелец этого персонажа!',
                    flags: MessageFlags.Ephemeral
                });
            }

            switch (action) {
                case 'avatar':
                    return await this.handleAvatar(interaction, characterId);
                case 'color':
                    return await this.handleColor(interaction, characterId);
                case 'gallery':
                    return await this.handleGalleryManage(interaction, characterId);
                case 'bio':
                    return await this.handleBioEdit(interaction, characterId);
                default:
                    return await interaction.reply({
                        content: '❌ Неизвестное действие!',
                        flags: MessageFlags.Ephemeral
                    });
            }

        } catch (error) {
            console.error('❌ Ошибка действия владельца:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Обработка админских действий
     */
    async handleAdminAction(interaction, customId) {
        try {
            // Формат: padm_info_charId
            const parts = customId.split('_');
            const action = parts[1];
            const characterId = parts[2];

            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            switch (action) {
                case 'info':
                    return await this.handleEditInfo(interaction, characterId);
                case 'stats':
                    return await this.handleAdminStats(interaction, characterId);
                case 'achieve':
                    return await this.handleAchievementAdd(interaction, characterId);
                case 'bounty':
                    return await this.handleBountyEdit(interaction, characterId);
                case 'shop':
                    // Редирект в магазин
                    const separatorShopHandler = require('./separatorShopHandler');
                    return await separatorShopHandler.showSeparatorShop(interaction, characterId);
                default:
                    return await interaction.reply({
                        content: '❌ Неизвестное действие!',
                        flags: MessageFlags.Ephemeral
                    });
            }

        } catch (error) {
            console.error('❌ Ошибка админского действия:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Показать галерею персонажа
     */
    async handleGallery(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Получаем галерею персонажа
            const gallery = await db.getCharacterGallery(characterId);
            
            const components = [];
            
            // Заголовок
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt(character.embed_color?.replace('#', '') || 'FF6B6B', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## 🖼️ Галерея: ${character.name}`
                    }
                ]
            });

            if (gallery && gallery.length > 0) {
                // MediaGallery для отображения изображений
                const mediaItems = gallery.slice(0, 5).map((img, index) => ({
                    type: ComponentType.MediaGalleryItem,
                    media: { url: img.image_url },
                    description: img.description || `Изображение ${index + 1}`,
                    spoiler: false
                }));

                components.push({
                    type: ComponentType.MediaGallery,
                    items: mediaItems
                });

                // Описания изображений
                const descriptions = gallery.map((img, index) => 
                    `**${index + 1}.** ${img.description || 'Без описания'}`
                ).join('\n');

                components.push({
                    type: ComponentType.Container,
                    accent_color: parseInt('2F3136', 16),
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `### 📝 Описания\n${descriptions}`
                    }]
                });
            } else {
                components.push({
                    type: ComponentType.Container,
                    accent_color: parseInt('5865F2', 16),
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `*В галерее пока нет изображений*\n\nДобавьте изображения с помощью кнопки ниже!`
                    }]
                });
            }

            // Кнопки управления галереей (для владельца и админов)
            const isAdmin = await this.checkAdminRole(interaction);
            const isOwner = character.user_id === interaction.user.id;
            
            if (isAdmin || isOwner) {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Success,
                            label: '➕ Добавить',
                            custom_id: `profile_gallery_add_${characterId}`,
                            disabled: gallery && gallery.length >= 5
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Danger,
                            label: '🗑️ Удалить',
                            custom_id: `profile_gallery_remove_${characterId}`,
                            disabled: !gallery || gallery.length === 0
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: '◀️ Назад',
                            custom_id: `profile_back_${characterId}`
                        }
                    ]
                });
            } else {
                // Для других пользователей только кнопка назад
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: '◀️ Назад',
                            custom_id: `profile_back_${characterId}`
                        }
                    ]
                });
            }

            await interaction.reply({
                flags: MessageFlags.IsComponentsV2,
                components: components
            });

        } catch (error) {
            console.error('❌ Ошибка показа галереи:', error);
            await interaction.reply({
                content: 'Произошла ошибка при загрузке галереи!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Показать биографию персонажа
     */
    async handleBio(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const bio = character.biography || '*Биография не заполнена*';
            const backstory = character.backstory || '*Предыстория не заполнена*';
            
            const components = [];
            
            // Основной контейнер с биографией
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt(character.embed_color?.replace('#', '') || 'FF6B6B', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## 📖 Биография: ${character.name}`
                    },
                    {
                        type: ComponentType.Separator,
                        divider: true
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 📜 История\n${bio}`
                    },
                    {
                        type: ComponentType.Separator,
                        divider: true
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 🔮 Предыстория\n${backstory}`
                    }
                ]
            });

            // Дополнительная информация
            const personality = character.personality || '*Не указано*';
            const goals = character.goals || '*Не указано*';
            
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('5865F2', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 🎭 Характер\n${personality}`
                    },
                    {
                        type: ComponentType.Separator,
                        divider: true
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 🎯 Цели\n${goals}`
                    }
                ]
            });

            // Кнопки управления (для владельца и админов)
            const isAdmin = await this.checkAdminRole(interaction);
            const isOwner = character.user_id === interaction.user.id;
            
            if (isAdmin || isOwner) {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Primary,
                            label: '✏️ Редактировать',
                            custom_id: `profile_bio_edit_${characterId}`
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: '◀️ Назад',
                            custom_id: `profile_back_${characterId}`
                        }
                    ]
                });
            } else {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: '◀️ Назад',
                            custom_id: `profile_back_${characterId}`
                        }
                    ]
                });
            }

            await interaction.reply({
                flags: MessageFlags.IsComponentsV2,
                components: components
            });

        } catch (error) {
            console.error('❌ Ошибка показа биографии:', error);
            await interaction.reply({
                content: 'Произошла ошибка при загрузке биографии!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Показать статистику персонажа
     */
    async handleStats(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Вычисляем показатели
            const stats = {
                strength: character.strength || 0,
                agility: character.agility || 0,
                reaction: character.reaction || 0,
                accuracy: character.accuracy || 0,
                hakivor: character.hakivor || 0,
                hakinab: character.hakinab || 0,
                hakiconq: character.hakiconq || 0
            };

            const totalStats = stats.strength + stats.agility + stats.reaction + stats.accuracy;
            const totalHaki = stats.hakivor + stats.hakinab + stats.hakiconq;

            // Функция для создания прогресс-бара
            const createBar = (value, max = 100) => {
                const filled = Math.min(Math.floor((value / max) * 10), 10);
                const empty = 10 - filled;
                return '█'.repeat(filled) + '░'.repeat(empty);
            };

            const components = [];

            // Заголовок
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt(character.embed_color?.replace('#', '') || 'FF6B6B', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## 📊 Статистика: ${character.name}`
                    }
                ]
            });

            // Основные характеристики
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('43B581', 16), // Зеленый
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### ⚔️ Боевые характеристики\n` +
                            `**💪 Сила:** \`${createBar(stats.strength)}\` ${stats.strength}\n` +
                            `**🏃 Ловкость:** \`${createBar(stats.agility)}\` ${stats.agility}\n` +
                            `**⚡ Реакция:** \`${createBar(stats.reaction)}\` ${stats.reaction}\n` +
                            `**🎯 Точность:** \`${createBar(stats.accuracy)}\` ${stats.accuracy}\n` +
                            `\n**Σ Всего:** ${totalStats} очков`
                    }
                ]
            });

            // Хаки
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('9B59B6', 16), // Фиолетовый
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 🔮 Хаки\n` +
                            `**🛡️ Вооружение:** \`${createBar(stats.hakivor)}\` ${stats.hakivor}\n` +
                            `**👁️ Наблюдение:** \`${createBar(stats.hakinab)}\` ${stats.hakinab}\n` +
                            `**👑 Королевская:** \`${createBar(stats.hakiconq)}\` ${stats.hakiconq}\n` +
                            `\n**Σ Всего:** ${totalHaki} очков`
                    }
                ]
            });

            // Боевые искусства и способности
            const martialArts = character.martialarts || '*Не изучены*';
            const devilfruit = character.devilfruit || '*Отсутствует*';
            
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('E74C3C', 16), // Красный
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 🥋 Боевые искусства\n${martialArts}`
                    },
                    {
                        type: ComponentType.Separator,
                        divider: true
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 🍎 Дьявольский плод\n${devilfruit}`
                    }
                ]
            });

            // Финансы и активность
            const budget = character.budget || 0;
            const messageCount = await db.getCharacterMessageCount(characterId) || 0;
            
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('F1C40F', 16), // Золотой
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 💰 Финансы и активность\n` +
                            `**💎 Бюджет:** ${budget.toLocaleString()} белли\n` +
                            `**💬 Сообщений:** ${messageCount.toLocaleString()}`
                    }
                ]
            });

            // Кнопка назад
            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: '◀️ Назад к профилю',
                        custom_id: `profile_back_${characterId}`
                    }
                ]
            });

            await interaction.reply({
                flags: MessageFlags.IsComponentsV2,
                components: components
            });

        } catch (error) {
            console.error('❌ Ошибка показа статистики:', error);
            await interaction.reply({
                content: 'Произошла ошибка при загрузке статистики!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Показать достижения персонажа
     */
    async handleAchievements(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const achievements = await db.getCharacterAchievements(characterId);
            const components = [];

            // Заголовок
            components.push({
                type: ComponentType.Container,
                accent_color: parseInt(character.embed_color?.replace('#', '') || 'FFD700', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `## 🏆 Достижения: ${character.name}`
                    }
                ]
            });

            if (achievements && achievements.length > 0) {
                // Группировка по редкости
                const rarityOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
                const rarityEmoji = { mythic: '🔴', legendary: '🟠', epic: '🟣', rare: '🔵', common: '⚪' };
                const rarityNames = { mythic: 'Мифическое', legendary: 'Легендарное', epic: 'Эпическое', rare: 'Редкое', common: 'Обычное' };

                const sorted = achievements.sort((a, b) => 
                    (rarityOrder[a.rarity] || 4) - (rarityOrder[b.rarity] || 4)
                );

                const achievementsList = sorted.map(ach => {
                    const icon = ach.icon || '🏆';
                    const rarity = rarityEmoji[ach.rarity] || '⚪';
                    return `${icon} **${ach.title}** ${rarity}\n> ${ach.description || 'Без описания'}`;
                }).join('\n\n');

                components.push({
                    type: ComponentType.Container,
                    accent_color: parseInt('F1C40F', 16),
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `### 📜 Список достижений (${achievements.length})\n\n${achievementsList}`
                    }]
                });
            } else {
                components.push({
                    type: ComponentType.Container,
                    accent_color: parseInt('5865F2', 16),
                    components: [{
                        type: ComponentType.TextDisplay,
                        content: `*У персонажа пока нет достижений*\n\nДостижения выдаются администрацией за особые заслуги!`
                    }]
                });
            }

            // Кнопки управления (только для админов)
            const isAdmin = await this.checkAdminRole(interaction);
            if (isAdmin) {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Success,
                            label: '🏆 Выдать достижение',
                            custom_id: `achievement_add_${characterId}`
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Danger,
                            label: '🗑️ Удалить достижение',
                            custom_id: `achievement_remove_${characterId}`,
                            disabled: !achievements || achievements.length === 0
                        },
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: '◀️ Назад',
                            custom_id: `profile_back_${characterId}`
                        }
                    ]
                });
            } else {
                components.push({
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            style: ButtonStyle.Secondary,
                            label: '◀️ Назад',
                            custom_id: `profile_back_${characterId}`
                        }
                    ]
                });
            }

            await interaction.reply({
                flags: MessageFlags.IsComponentsV2,
                components: components
            });

        } catch (error) {
            console.error('❌ Ошибка показа достижений:', error);
            await interaction.reply({
                content: 'Произошла ошибка при загрузке достижений!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Выдать достижение (только для админов)
     */
    async handleAchievementAdd(interaction, characterId) {
        try {
            const modal = new ModalBuilder()
                .setCustomId(`achievement_add_modal_${characterId}`)
                .setTitle('🏆 Выдать достижение');

            const titleInput = new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Название достижения')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(50)
                .setPlaceholder('Например: Победитель турнира');

            const descInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Описание достижения')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(200)
                .setPlaceholder('За что выдано достижение');

            const iconInput = new TextInputBuilder()
                .setCustomId('icon')
                .setLabel('Иконка (эмодзи)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(10)
                .setPlaceholder('🏆');

            const rarityInput = new TextInputBuilder()
                .setCustomId('rarity')
                .setLabel('Редкость (common/rare/epic/legendary/mythic)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('epic');

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(iconInput),
                new ActionRowBuilder().addComponents(rarityInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка открытия модального окна достижений:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Удалить достижение (только для админов)
     */
    async handleAchievementRemove(interaction, characterId) {
        try {
            const achievements = await db.getCharacterAchievements(characterId);
            if (!achievements || achievements.length === 0) {
                return await interaction.reply({
                    content: '❌ У персонажа нет достижений для удаления!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const options = achievements.map(ach => ({
                label: ach.title.substring(0, 50),
                value: ach.id.toString(),
                description: (ach.description || 'Без описания').substring(0, 50),
                emoji: ach.icon || '🏆'
            }));

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`achievement_delete_select_${characterId}`)
                    .setPlaceholder('Выберите достижение для удаления...')
                    .addOptions(options)
            );

            await interaction.reply({
                content: '🗑️ **Выберите достижение для удаления:**',
                components: [row],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('❌ Ошибка показа списка достижений:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Изменить аватар (админ)
     */
    async handleAvatar(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`avatar_modal_${characterId}`)
                .setTitle('Изменить аватар персонажа');

            const avatarInput = new TextInputBuilder()
                .setCustomId('avatar_url')
                .setLabel('URL изображения')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('https://example.com/image.png')
                .setValue(character.avatar_url || '');

            modal.addComponents(new ActionRowBuilder().addComponents(avatarInput));
            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка изменения аватара:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Изменить цвет (админ)
     */
    async handleColor(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`color_modal_${characterId}`)
                .setTitle('Изменить цвет профиля');

            const colorInput = new TextInputBuilder()
                .setCustomId('color_value')
                .setLabel('Цвет (HEX код или название)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('#FF0000 или красный')
                .setValue(character.embed_color || '#9932cc');

            modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка изменения цвета:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Управление галереей (админ)
     */
    async handleGalleryManage(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const gallery = await db.getCharacterGallery(characterId);

            const components = [];

            components.push({
                type: ComponentType.Container,
                accent_color: parseInt('5865F2', 16),
                components: [{
                    type: ComponentType.TextDisplay,
                    content: `### 📸 Управление галереей: ${character.name}\n` +
                             `Изображений: **${gallery.length}/5**`
                }]
            });

            components.push({
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Success,
                        label: '➕ Добавить изображение',
                        custom_id: `profile_gallery_add_${characterId}`,
                        disabled: gallery.length >= 5
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Danger,
                        label: '🗑️ Удалить изображение',
                        custom_id: `profile_gallery_remove_${characterId}`,
                        disabled: gallery.length === 0
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: '◀️ Назад',
                        custom_id: `profile_back_${characterId}`
                    }
                ]
            });

            await interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: components
            });

        } catch (error) {
            console.error('❌ Ошибка управления галереей:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Добавить изображение в галерею
     */
    async handleGalleryAdd(interaction, characterId) {
        try {
            const modal = new ModalBuilder()
                .setCustomId(`gallery_add_modal_${characterId}`)
                .setTitle('Добавить изображение в галерею');

            const urlInput = new TextInputBuilder()
                .setCustomId('image_url')
                .setLabel('URL изображения')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('https://example.com/image.png');

            const descInput = new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Описание (опционально)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(200)
                .setPlaceholder('Краткое описание изображения');

            modal.addComponents(
                new ActionRowBuilder().addComponents(urlInput),
                new ActionRowBuilder().addComponents(descInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка открытия модального окна галереи:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Редактировать биографию
     */
    async handleBioEdit(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`bio_edit_modal_${characterId}`)
                .setTitle('Редактировать биографию');

            const bioInput = new TextInputBuilder()
                .setCustomId('biography')
                .setLabel('Биография')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000)
                .setValue(character.biography || '');

            const backstoryInput = new TextInputBuilder()
                .setCustomId('backstory')
                .setLabel('Предыстория')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000)
                .setValue(character.backstory || '');

            const personalityInput = new TextInputBuilder()
                .setCustomId('personality')
                .setLabel('Характер')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(500)
                .setValue(character.personality || '');

            const goalsInput = new TextInputBuilder()
                .setCustomId('goals')
                .setLabel('Цели')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(500)
                .setValue(character.goals || '');

            modal.addComponents(
                new ActionRowBuilder().addComponents(bioInput),
                new ActionRowBuilder().addComponents(backstoryInput),
                new ActionRowBuilder().addComponents(personalityInput),
                new ActionRowBuilder().addComponents(goalsInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка редактирования биографии:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Редактировать базовую информацию
     */
    async handleEditInfo(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`info_edit_modal_${characterId}`)
                .setTitle('Редактировать информацию');

            const nameInput = new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Имя персонажа')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(50)
                .setValue(character.name || '');

            const nicknameInput = new TextInputBuilder()
                .setCustomId('nickname')
                .setLabel('Прозвище')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50)
                .setValue(character.nickname || '');

            const raceInput = new TextInputBuilder()
                .setCustomId('race')
                .setLabel('Раса')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(30)
                .setValue(character.race || '');

            const ageInput = new TextInputBuilder()
                .setCustomId('age')
                .setLabel('Возраст')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(10)
                .setValue(character.age ? character.age.toString() : '');

            const mentionInput = new TextInputBuilder()
                .setCustomId('mention')
                .setLabel('Цитата / Упоминание')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(200)
                .setValue(character.mention || '');

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(nicknameInput),
                new ActionRowBuilder().addComponents(raceInput),
                new ActionRowBuilder().addComponents(ageInput),
                new ActionRowBuilder().addComponents(mentionInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка редактирования информации:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Удалить изображение из галереи
     */
    async handleGalleryRemove(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверка владельца или админа
            const isOwner = character.user_id === interaction.user.id;
            const isAdmin = await this.checkAdminRole(interaction);
            
            if (!isOwner && !isAdmin) {
                return await interaction.reply({
                    content: '❌ Вы можете редактировать только свои галереи!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const gallery = await db.getCharacterGallery(characterId);
            if (!gallery || gallery.length === 0) {
                return await interaction.reply({
                    content: '❌ Галерея пуста!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Создаем Select Menu для выбора изображения
            const options = gallery.map((img, index) => ({
                label: `${index + 1}. ${(img.description || 'Без описания').substring(0, 50)}`,
                value: img.id.toString(),
                description: 'Удалить это изображение'
            }));

            const components = [
                {
                    type: ComponentType.Container,
                    accent_color: parseInt('ED4245', 16),
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: `### 🗑️ Удаление изображения\nВыберите изображение для удаления:`
                        },
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.StringSelect,
                                    custom_id: `gallery_delete_select_${characterId}`,
                                    placeholder: 'Выберите изображение...',
                                    options: options
                                }
                            ]
                        }
                    ]
                }
            ];

            await interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: components
            });

        } catch (error) {
            console.error('❌ Ошибка удаления из галереи:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Админская статистика персонажа
     */
    async handleAdminStats(interaction, characterId) {
        try {
            // Проверяем права администратора
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasAdminRole = member.roles.cache.has(ADMIN_ROLE_ID) || 
                                 member.permissions.has('Administrator');
            
            if (!hasAdminRole) {
                return await interaction.reply({
                    content: '❌ У вас нет прав для использования этой функции!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`admin_stats_modal_${characterId}`)
                .setTitle('⚡ Редактор характеристик (Админ)');

            const strengthInput = new TextInputBuilder()
                .setCustomId('strength')
                .setLabel('Сила (текущее значение)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue((character.strength || 0).toString());

            const agilityInput = new TextInputBuilder()
                .setCustomId('agility')
                .setLabel('Ловкость (текущее значение)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue((character.agility || 0).toString());

            const hakivorInput = new TextInputBuilder()
                .setCustomId('hakivor')
                .setLabel('Хаки Вооружения')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue((character.hakivor || 0).toString());

            const hakinabInput = new TextInputBuilder()
                .setCustomId('hakinab')
                .setLabel('Хаки Наблюдения')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue((character.hakinab || 0).toString());

            const budgetInput = new TextInputBuilder()
                .setCustomId('budget')
                .setLabel('Бюджет (белли)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue((character.budget || 0).toString());

            modal.addComponents(
                new ActionRowBuilder().addComponents(strengthInput),
                new ActionRowBuilder().addComponents(agilityInput),
                new ActionRowBuilder().addComponents(hakivorInput),
                new ActionRowBuilder().addComponents(hakinabInput),
                new ActionRowBuilder().addComponents(budgetInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка админской статистики:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Редактировать награду за голову (только админ)
     */
    async handleBountyEdit(interaction, characterId) {
        try {
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`bounty_modal_${characterId}`)
                .setTitle('💰 Изменить награду за голову');

            const bountyInput = new TextInputBuilder()
                .setCustomId('bounty')
                .setLabel('Награда (в белли)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Например: 500000000')
                .setValue((character.bounty || 0).toString());

            modal.addComponents(
                new ActionRowBuilder().addComponents(bountyInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Ошибка редактирования награды:', error);
            await interaction.reply({
                content: 'Произошла ошибка!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    /**
     * Показать WANTED постер
     */
    async handleShowWanted(interaction, customId) {
        try {
            const { AttachmentBuilder } = require('discord.js');
            
            const parts = customId.split('_');
            const characterId = parts[2];
            const allowedUserId = parts[3];

            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!profileGenerator) {
                return await interaction.reply({
                    content: '❌ Генератор изображений недоступен!',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            const wantedBuffer = await profileGenerator.generateWantedPoster(character, character.avatar_url);
            const attachment = new AttachmentBuilder(wantedBuffer, { name: 'wanted.png' });

            const bounty = character.bounty || 0;
            let bountyText;
            if (bounty >= 1000000000) {
                bountyText = `${(bounty / 1000000000).toFixed(1)} млрд`;
            } else if (bounty >= 1000000) {
                bountyText = `${Math.floor(bounty / 1000000)} млн`;
            } else {
                bountyText = bounty.toLocaleString();
            }

            await interaction.editReply({
                content: `# 🏴‍☠️ WANTED\n**${character.name}**${character.nickname ? ` *"${character.nickname}"*` : ''}\n\n💰 **Награда:** ฿ ${bountyText}`,
                files: [attachment]
            });

        } catch (error) {
            console.error('❌ Ошибка генерации WANTED:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: 'Произошла ошибка при генерации постера!' });
            } else {
                await interaction.reply({
                    content: 'Произошла ошибка!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
