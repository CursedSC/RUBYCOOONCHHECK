const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');
const { handleCustomStylingMenu } = require('./customStylingHandler');

const db = new Database();

module.exports = {
    name: 'interactionCreate',

    // Функция для проверки, может ли этот обработчик обработать взаимодействие
    canHandle(interaction) {
        return interaction.isStringSelectMenu() && interaction.customId.startsWith('profile_manage_');
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

        const characterId = interaction.customId.split('_')[2];
        const action = interaction.values[0];

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


            } else if (action === 'custom_styling') {
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
    }
};
