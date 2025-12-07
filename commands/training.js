const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const TrainingSystem = require('../interactions/trainingSystem');
const Database = require('../database');

const db = new Database();
const trainingSystem = new TrainingSystem();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('тренировка')
        .setDescription('Начать тренировку персонажа')
        .addStringOption(option =>
            option.setName('персонаж')
                .setDescription('Выберите персонажа для тренировки')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        try {
            // Получаем ТОЛЬКО персонажей текущего пользователя
            const userCharacters = await db.getUserCharacters(interaction.user.id);
            
            // Фильтруем персонажей по имени и ID
            const filtered = userCharacters.filter(char => {
                const nameMatch = char.name.toLowerCase().includes(focusedValue.toLowerCase());
                const idMatch = char.id.toString().includes(focusedValue);
                return nameMatch || idMatch;
            }).slice(0, 25); // Ограничиваем до 25 результатов
            
            // Формируем варианты для автодополнения
            const choices = filtered.map(char => ({
                name: `${char.name} (ID: ${char.id})`,
                value: char.id.toString()
            }));
            
            await interaction.respond(choices);
        } catch (error) {
            console.error('Ошибка автодополнения тренировок:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const characterId = parseInt(interaction.options.getString('персонаж'));
        
        try {
            // Проверяем существование персонажа
            const character = await db.getCharacterById(characterId);
            if (!character) {
                return await interaction.reply({
                    content: '❌ Персонаж не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверяем владельца персонажа
            if (character.user_id !== interaction.user.id) {
                return await interaction.reply({
                    content: '❌ Вы можете тренировать только своих персонажей!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Проверяем активную тренировку
            const activeTraining = await trainingSystem.getActiveTraining(characterId);
            if (activeTraining) {
                return await interaction.reply({
                    content: '❌ У этого персонажа уже есть активная тренировка! Завершите её перед началом новой.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Показываем выбор стези тренировки
            const embed = new EmbedBuilder()
                .setTitle('🏋️ Выбор стези тренировки')
                .setDescription(`**Персонаж:** ${character.name}\n\nВыберите стезю для тренировки:`)
                .setColor('#3498db')
                .addFields([
                    { name: '🎯 Точность-Реакция', value: 'Развивает точность и реакцию персонажа', inline: true },
                    { name: '🛡️ Стойкость-Прочность', value: 'Укрепляет стойкость и прочность', inline: true },
                    { name: '💪 Сила-Ловкость', value: 'Повышает силу и ловкость', inline: true },
                    { name: '🔮 Магия-Стойкость', value: 'Развивает магические способности и выносливость', inline: true }
                ])
                .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`training_path_select_${character.id}_${interaction.user.id}`)
                .setPlaceholder('Выберите стезю тренировки')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Точность-Реакция')
                        .setDescription('Развивает точность и реакцию')
                        .setValue('accuracy_reaction')
                        .setEmoji('🎯'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Стойкость-Прочность')
                        .setDescription('Укрепляет стойкость и прочность')
                        .setValue('endurance_durability')
                        .setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Сила-Ловкость')
                        .setDescription('Повышает силу и ловкость')
                        .setValue('strength_agility')
                        .setEmoji('💪'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Магия-Стойкость')
                        .setDescription('Развивает магические способности')
                        .setValue('magic_endurance')
                        .setEmoji('🔮')
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error('Ошибка создания тренировки:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании тренировки!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
