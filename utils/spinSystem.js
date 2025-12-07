const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatDecimal, loadSparkles } = require('./helpers');

const SPARKLES = loadSparkles();

// Функция показа страницы множественных круток
async function showMultiSpinPage(channel, userId, pageIndex) {
    const multiSpinData = channel.client.multiSpinResults.get(userId);
    if (!multiSpinData) return;

    const result = multiSpinData.results[pageIndex];
    const totalPages = multiSpinData.results.length;

    const pageEmbed = new EmbedBuilder()
        .setTitle(`🎰 Крутка ${result.spinNumber} из ${totalPages}`)
        .setDescription(`**Результат крутки №${result.spinNumber}**`)
        .addFields(
            { name: '🏆 Ваш выигрыш', value: `**${result.selectedSparkle}** ⭐`, inline: false },
            { name: '🔍 Что было в других подарках:', value: result.sparkles.map((sparkle, index) => 
                `${index === result.selectedIndex ? '🏆 **' + sparkle + '** ⭐ (ВАШ ВЫБОР)' : '🎁 ' + sparkle}`
            ).join('\n'), inline: false }
        )
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: `Страница ${pageIndex + 1} из ${totalPages} | Потрачено: ${formatDecimal(multiSpinData.totalCost)} RubyCoin` });

    const navigationRow = new ActionRowBuilder();

    // Кнопки навигации
    navigationRow.addComponents(
        new ButtonBuilder()
            .setCustomId('multi_spin_first')
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId('multi_spin_prev')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId('multi_spin_next')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1),
        new ButtonBuilder()
            .setCustomId('multi_spin_last')
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1)
    );

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('show_summary')
                .setLabel('📊 Итоги всех круток')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊'),
            new ButtonBuilder()
                .setCustomId('return_to_shop')
                .setLabel('🛒 В Донат')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛒')
        );

    await channel.send({
        embeds: [pageEmbed],
        components: [navigationRow, actionRow]
    });
}

// Функция показа страницы через взаимодействие
async function showMultiSpinPageInteraction(interaction, userId, pageIndex) {
    const multiSpinData = interaction.client.multiSpinResults.get(userId);
    if (!multiSpinData) return;

    const result = multiSpinData.results[pageIndex];
    const totalPages = multiSpinData.results.length;

    const pageEmbed = new EmbedBuilder()
        .setTitle(`🎰 Крутка ${result.spinNumber} из ${totalPages}`)
        .setDescription(`**Результат крутки №${result.spinNumber}**`)
        .addFields(
            { name: '🏆 Ваш выигрыш', value: `**${result.selectedSparkle}** ⭐`, inline: false },
            { name: '🔍 Что было в других подарках:', value: result.sparkles.map((sparkle, index) => 
                `${index === result.selectedIndex ? '🏆 **' + sparkle + '** ⭐ (ВАШ ВЫБОР)' : '🎁 ' + sparkle}`
            ).join('\n'), inline: false }
        )
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: `Страница ${pageIndex + 1} из ${totalPages} | Потрачено: ${formatDecimal(multiSpinData.totalCost)} RubyCoin` });

    const navigationRow = new ActionRowBuilder();

    // Кнопки навигации
    navigationRow.addComponents(
        new ButtonBuilder()
            .setCustomId('multi_spin_first')
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId('multi_spin_prev')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId('multi_spin_next')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1),
        new ButtonBuilder()
            .setCustomId('multi_spin_last')
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1)
    );

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('show_summary')
                .setLabel('📊 Итоги всех круток')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📊'),
            new ButtonBuilder()
                .setCustomId('return_to_shop')
                .setLabel('🛒 В Донат')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛒')
        );

    await interaction.update({
        embeds: [pageEmbed],
        components: [navigationRow, actionRow]
    });
}

// Функция показа итогов всех круток
async function showSpinSummary(interaction, userId) {
    const multiSpinData = interaction.client.multiSpinResults.get(userId);
    if (!multiSpinData) return;

    const allWins = multiSpinData.results.map(result => result.selectedSparkle);
    const uniqueWins = [...new Set(allWins)];
    const winCounts = {};

    allWins.forEach(sparkle => {
        winCounts[sparkle] = (winCounts[sparkle] || 0) + 1;
    });

    const summaryEmbed = new EmbedBuilder()
        .setTitle('📊 Итоги всех круток')
        .setDescription(`**Результаты ${multiSpinData.results.length} круток ${multiSpinData.itemName}**`)
        .addFields(
            { name: '🏆 Все выигрыши:', value: allWins.map((sparkle, index) => 
                `${index + 1}. **${sparkle}** ⭐`
            ).join('\n'), inline: false },
            { name: '📈 Статистика:', value: uniqueWins.map(sparkle => 
                `**${sparkle}**: ${winCounts[sparkle]}x`
            ).join('\n'), inline: false },
            { name: '💰 Потрачено', value: `${formatDecimal(multiSpinData.totalCost)} RubyCoin`, inline: true },
            { name: '🎯 Количество круток', value: `${multiSpinData.results.length} шт.`, inline: true },
            { name: '🎁 Уникальных искр', value: `${uniqueWins.length} шт.`, inline: true }
        )
        .setColor(0xFFD700)
        .setTimestamp()
        .setFooter({ text: 'Спасибо за игру!' });

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('return_to_shop')
                .setLabel('🛒 Вернуться в Донат')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🛒'),
            new ButtonBuilder()
                .setCustomId('close_shop')
                .setLabel('👋 Закрыть')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👋')
        );

    await interaction.update({
        embeds: [summaryEmbed],
        components: [actionRow]
    });
}

// Функция обработки системы круток (одиночная)
async function handleSpinSystem(interaction, item) {
    // Убеждаемся, что spinData инициализирован
    if (!interaction.client.spinData) {
        interaction.client.spinData = new Map();
    }

    // Генерируем 5 случайных искр
    const selectedSparkles = [];
    const usedIndices = new Set();
    
    while (selectedSparkles.length < 5) {
        const randomIndex = Math.floor(Math.random() * SPARKLES.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            selectedSparkles.push(SPARKLES[randomIndex]);
        }
    }

    // Создаем embed с системой круток - ТОЛЬКО ЭМОДЗИ ПОДАРКОВ
    const spinEmbed = new EmbedBuilder()
        .setTitle('🎰')
        .setDescription('🎁 🎁 🎁 🎁 🎁')
        .setColor(0x808080) // Серый цвет
        .setTimestamp()
        .setFooter({ text: '🎁 🎁 🎁 🎁 🎁' }); // ТОЛЬКО эмодзи подарков, никаких данных

    // Сохраняем данные в отдельном месте для использования при выборе
    interaction.client.spinData.set(interaction.user.id, { sparkles: selectedSparkles });

    // Создаем 5 серых кнопок для выбора - ТОЛЬКО ЭМОДЗИ ПОДАРКОВ
    const buttonRows = [];
    const buttons1 = new ActionRowBuilder();
    const buttons2 = new ActionRowBuilder();

    for (let i = 0; i < 5; i++) {
        const button = new ButtonBuilder()
            .setCustomId(`spin_choice_${i}_${interaction.user.id}`) // Добавляем ID пользователя
            .setLabel('🎁') // Эмодзи подарка
            .setStyle(ButtonStyle.Secondary) // Серый цвет
            .setEmoji('🎲');

        if (i < 3) {
            buttons1.addComponents(button);
        } else {
            buttons2.addComponents(button);
        }
    }

    buttonRows.push(buttons1);
    if (buttons2.components.length > 0) {
        buttonRows.push(buttons2);
    }

    await interaction.update({
        embeds: [spinEmbed],
        components: buttonRows
    });
}

// Функция показа результата круток (одиночная)
async function showSpinResult(interaction, selectedSparkle, allSparkles, selectedIndex) {
    // Создаем embed с результатом
    const resultEmbed = new EmbedBuilder()
        .setTitle('🎉 Поздравляем с выигрышем!')
        .setDescription(`**Вы выбрали подарок №${selectedIndex + 1}**`)
        .addFields(
            { name: '🏆 Ваш выигрыш', value: `**${selectedSparkle}** ⭐`, inline: false },
            { name: '🔍 Что было в других подарках:', value: allSparkles.map((sparkle, index) => 
                `${index === selectedIndex ? '🏆 **' + sparkle + '** ⭐ (ВАШ ВЫБОР)' : '🎁 ' + sparkle}`
            ).join('\n'), inline: false },
            { name: '✨ Удача', value: `Из ${allSparkles.length} подарков вы выбрали именно этот!`, inline: false }
        )
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: `Поздравляем с получением: ${selectedSparkle}` });

    // Создаем кнопки для возврата в Донат или закрытия
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('return_to_shop')
                .setLabel('🛒 Вернуться в Донат')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🛒'),
            new ButtonBuilder()
                .setCustomId('close_shop')
                .setLabel('👋 Закрыть')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👋')
        );

    await interaction.update({
        embeds: [resultEmbed],
        components: [actionRow]
    });
}

module.exports = {
    showMultiSpinPage,
    showMultiSpinPageInteraction,
    showSpinSummary,
    handleSpinSystem,
    showSpinResult
};
