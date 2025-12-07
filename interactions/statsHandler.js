const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();

// ID канала для логирования
const LOG_CHANNEL_ID = '1384144420126855178';

// Упрощенная конфигурация атрибутов
const ATTRIBUTE_CONFIG = {
    // Числовые характеристики (добавляются к текущим)
    'strength': { name: 'Сила', type: 'numeric', emoji: '💪', placeholder: 'Например: 100 или -50' },
    'agility': { name: 'Ловкость', type: 'numeric', emoji: '🤸', placeholder: 'Например: 150 или -30' },
    'reaction': { name: 'Реакция', type: 'numeric', emoji: '⚡', placeholder: 'Например: 200 или -75' },
    'accuracy': { name: 'Точность', type: 'numeric', emoji: '🎯', placeholder: 'Например: 120 или -40' },
    'endurance': { name: 'Стойкость', type: 'numeric', emoji: '🏋️', placeholder: 'Например: 180 или -60' },
    'durability': { name: 'Прочность', type: 'numeric', emoji: '🛡️', placeholder: 'Например: 160 или -55' },
    'magic': { name: 'Магия', type: 'numeric', emoji: '🔮', placeholder: 'Например: 90 или -25' },
    'budget': { name: 'Бюджет', type: 'numeric', emoji: '💰', placeholder: 'Например: 1000 или -500' },

    // Текстовые поля (заменяются)
    'name': { name: 'Имя персонажа', type: 'text', emoji: '💎', placeholder: 'Новое имя персонажа' },
    'race': { name: 'Раса', type: 'text', emoji: '🦁', placeholder: 'Раса персонажа' },
    'age': { name: 'Возраст', type: 'text', emoji: '🎂', placeholder: 'Например: 25 лет, неизвестен' },
    'nickname': { name: 'Прозвище', type: 'text', emoji: '🧨', placeholder: 'Прозвище персонажа' },
    'organization': { name: 'Организация', type: 'text', emoji: '🏛️', placeholder: 'Название организации' },
    'position': { name: 'Должность', type: 'text', emoji: '📜', placeholder: 'Должность в организации' },
    'mention': { name: 'Цитата', type: 'text', emoji: '🧾', placeholder: 'Цитата персонажа' },
    'hakivor': { name: 'Воля Вооружения', type: 'text', emoji: '🗡️', placeholder: 'Описание уровня воли вооружения' },
    'hakinab': { name: 'Воля Наблюдения', type: 'text', emoji: '👁️', placeholder: 'Описание уровня воли наблюдения' },
    'hakiconq': { name: 'Королевская Воля', type: 'text', emoji: '👑', placeholder: 'Описание уровня королевской воли' },
    'devilfruit': { name: 'Дьявольский плод', type: 'text', emoji: '🍎', placeholder: 'Название и описание плода' },
    'martialarts': { name: 'Боевые искусства', type: 'text', emoji: '🥋', placeholder: 'Список боевых искусств' },
    'patronage': { name: 'Покровительство', type: 'text', emoji: '👼', placeholder: 'Описание покровительства' },
    'core': { name: 'Искры', type: 'text', emoji: '💠', placeholder: 'Описание ядра' },
    'elements': { name: 'Стихии', type: 'text', emoji: '🌪️', placeholder: 'Список стихий' },
    'additional': { name: 'Дополнительное', type: 'text', emoji: '📝', placeholder: 'Дополнительная информация' }
};

module.exports = {
    name: 'interactionCreate',
    
    canHandle(interaction) {
        return (interaction.isStringSelectMenu() &&
            (interaction.customId.startsWith('character_select_') ||
                interaction.customId.startsWith('attribute_select_'))) ||
            (interaction.isModalSubmit() &&
                interaction.customId.startsWith('stats_modal_'));
    },

    async execute(interaction) {
        if (!this.canHandle(interaction)) return;

        try {
            if (interaction.customId.startsWith('character_select_')) {
                await this.handleCharacterSelect(interaction);
            } else if (interaction.customId.startsWith('attribute_select_')) {
                await this.handleAttributeSelect(interaction);
            } else if (interaction.customId.startsWith('stats_modal_')) {
                await this.handleStatsModal(interaction);
            }
        } catch (error) {
            console.error('❌ Ошибка в statsHandler:', error);
            await this.handleError(interaction, error);
        }
    },

    async handleCharacterSelect(interaction) {
        const userId = interaction.customId.split('_')[2];
        const characterId = interaction.values[0];

        const character = await db.getCharacterById(characterId);
        if (!character) {
            return await interaction.reply({
                content: '❌ Персонаж не найден!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Создаем меню выбора атрибутов
        const attributeOptions = Object.entries(ATTRIBUTE_CONFIG).map(([key, config]) => {
            const currentValue = this.formatCurrentValue(character, key, config);
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${config.emoji} ${config.name}`)
                .setDescription(`Текущее: ${currentValue}`)
                .setValue(key)
                .setEmoji(config.emoji);
        });

        const attributeSelect = new StringSelectMenuBuilder()
            .setCustomId(`attribute_select_${characterId}`)
            .setPlaceholder('Выберите до 5 атрибутов для изменения')
            .setMinValues(1)
            .setMaxValues(5)
            .addOptions(attributeOptions);

        const embed = new EmbedBuilder()
            .setTitle('🎯 Выбор атрибутов для изменения')
            .setDescription(`**Персонаж:** ${character.name}\n\nВыберите атрибуты для изменения:`)
            .setColor(0x9b59b6)
            .setThumbnail(character.avatar_url)
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(attributeSelect)]
        });
    },

    async handleAttributeSelect(interaction) {
        const characterId = interaction.customId.split('_')[2];
        const selectedAttributes = interaction.values;

        const character = await db.getCharacterById(characterId);
        if (!character) {
            return await interaction.reply({
                content: '❌ Персонаж не найден!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Создаем модальное окно
        const modal = new ModalBuilder()
            .setCustomId(`stats_modal_${characterId}_${selectedAttributes.join(',')}`)
            .setTitle(`Изменить атрибуты (${selectedAttributes.length})`);

        // Добавляем поля для каждого выбранного атрибута
        const actionRows = [];
        for (let i = 0; i < Math.min(selectedAttributes.length, 5); i++) {
            const attribute = selectedAttributes[i];
            const config = ATTRIBUTE_CONFIG[attribute];
            
            const input = new TextInputBuilder()
                .setCustomId(attribute)
                .setLabel(config.name)
                .setStyle(config.type === 'numeric' ? TextInputStyle.Short : TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder(config.placeholder);

            // Для текстовых полей показываем текущее значение
            if (config.type === 'text' && character[attribute]) {
                input.setValue(character[attribute]);
            }

            actionRows.push(new ActionRowBuilder().addComponents(input));
        }

        modal.addComponents(...actionRows);
        await interaction.showModal(modal);
    },

    async handleStatsModal(interaction) {
        // Проверка прав
        const requiredRoleId = '1382005661369368586';
        if (!interaction.member.roles.cache.has(requiredRoleId)) {
            return await interaction.reply({
                content: '❌ У вас нет прав для изменения персонажей!',
                flags: MessageFlags.Ephemeral
            });
        }

        const parts = interaction.customId.split('_');
        const characterId = parts[2];
        const attributes = parts[3].split(',');

        const character = await db.getCharacterById(characterId);
        if (!character) {
            return await interaction.reply({
                content: '❌ Персонаж не найден!',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const updateData = {};
        const changes = [];

        // Обрабатываем каждый атрибут
        for (const attribute of attributes) {
            const config = ATTRIBUTE_CONFIG[attribute];
            if (!config) continue;

            try {
                const value = interaction.fields.getTextInputValue(attribute);
                if (!value || value.trim() === '') continue;

                if (config.type === 'numeric') {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue)) {
                        updateData[attribute] = numValue;
                        const sign = numValue >= 0 ? '+' : '';
                        changes.push(`**${config.name}:** ${sign}${numValue}`);
                    }
                } else {
                    updateData[attribute] = value.trim();
                    const preview = value.length > 50 ? value.substring(0, 47) + '...' : value;
                    changes.push(`**${config.name}:** ${preview}`);
                }
            } catch (error) {
                console.log(`Поле ${attribute} не найдено`);
            }
        }

        if (changes.length === 0) {
            return await interaction.editReply({
                content: '⚠️ Не было внесено никаких изменений!'
            });
        }

        // Обновляем персонажа в базе данных
        await db.updateCharacterAttributes(characterId, updateData);

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Характеристики успешно обновлены')
            .setDescription(`**Персонаж:** ${character.name}\n\n**Внесенные изменения:**\n${changes.join('\n')}`)
            .setColor(0x00ff00)
            .setThumbnail(character.avatar_url)
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        // Отправляем лог
        await this.sendLog(interaction, character, changes);
    },

    // Вспомогательные методы
    formatCurrentValue(character, key, config) {
        const value = character[key];
        if (config.type === 'numeric') {
            return (value || 0).toLocaleString();
        } else {
            if (!value) return 'Не указано';
            return value.length > 40 ? value.substring(0, 37) + '...' : value;
        }
    },

    async sendLog(interaction, character, changes) {
        try {
            const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) return;

            const logEmbed = new EmbedBuilder()
                .setTitle('📊 Лог выдачи характеристик')
                .setDescription(`🔧 **Модератор:** <@${interaction.user.id}>\n👤 **Персонаж:** ${character.name} (ID: ${character.id})`)
                .setColor(0x3498db)
                .addFields({
                    name: '📈 Выданные характеристики:',
                    value: changes.join('\n'),
                    inline: false
                }, {
                    name: '📊 Информация:',
                    value: `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Канал:** <#${interaction.channelId}>`,
                    inline: false
                })
                .setFooter({ text: `ID модератора: ${interaction.user.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
            console.error('❌ Ошибка отправки лога:', error);
        }
    },

    async handleError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Ошибка обновления характеристик')
            .setDescription(`**Ошибка:** ${error.message}`)
            .setColor(0xff0000)
            .setTimestamp();

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        } catch (replyError) {
            console.error('❌ Не удалось отправить сообщение об ошибке:', replyError);
        }
    }
};
