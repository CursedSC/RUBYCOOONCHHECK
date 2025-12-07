const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('тренировка')
    .setDescription('Начать новую тренировку персонажа'),
  
  async execute(interaction) {
    // ИСПРАВЛЕНИЕ: Используем правильный обработчик
    const TrainingInteractionHandler = require('../interactions/trainingInteraction');
    const trainingHandler = new TrainingInteractionHandler();
    await trainingHandler.execute(interaction);
  }
};
