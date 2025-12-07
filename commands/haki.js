const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Database = require('../database');
const fs = require('fs');
const path = require('path');

const db = new Database();

let HAKI_LIST = [];
try {
    const hakiPath = path.join(__dirname, '..', 'haki.json');
    if (fs.existsSync(hakiPath)) {
        const hakiData = fs.readFileSync(hakiPath, 'utf-8');
        HAKI_LIST = JSON.parse(hakiData);
        console.log(`Загружено ${HAKI_LIST.length} видов хаки`);
    } else {
        console.error('Файл haki.json не найден!');
        HAKI_LIST = ['Воля Вооружения', 'Воля наблюдения', 'Королевская воля', '-'];
    }
} catch (error) {
    console.error('Ошибка загрузки haki.json:', error);
    HAKI_LIST = ['Воля Вооружения', 'Воля наблюдения', 'Королевская воля', '-'];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('хаки')
        .setDescription('Система круток хаки')
        .addSubcommand(subcommand =>
            subcommand
                .setName('крутить')
                .setDescription('Открыть меню круток хаки')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('баланс')
                .setDescription('Посмотреть количество круток хаки')
        ),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'крутить') {
                await handleHakiSpins(interaction);
            } else if (subcommand === 'баланс') {
                await showHakiBalance(interaction);
            } else if (subcommand === 'история') {
                await showHakiHistory(interaction);
            }

        } catch (error) {
            console.error('Ошибка команды хаки:', error);
            await interaction.reply({
                content: 'Произошла ошибка при выполнении команды!',
                ephemeral: true
            });
        }
    },

    // Обработка взаимодействий с меню
    async handleHakiSpinExecution(interaction) {
        if (!interaction.isStringSelectMenu()) return;
        
        if (interaction.customId.startsWith('haki_spin_select_')) {
            await handleSpinSelection(interaction);
        }
    }
};

async function handleHakiSpins(interaction) {
    const userSpins = await db.getUserHakiSpins(interaction.user.id);
    
    if (userSpins === 0) {
        const noSpinsEmbed = new EmbedBuilder()
            .setTitle('❌ Нет круток хаки')
            .setDescription('У вас нет доступных круток хаки!')
            .addFields(
                { name: '💫 Доступно круток', value: '0', inline: true },
                { name: '📝 Как получить?', value: 'Используйте команду `/хаки-выдать` (только администраторы)', inline: false }
            )
            .setColor(0xFF0000)
            .setTimestamp();

        return await interaction.reply({
            embeds: [noSpinsEmbed],
            ephemeral: true
        });
    }

    const spinMenuEmbed = new EmbedBuilder()
        .setTitle('💫 Крутки хаки')
        .setDescription('Выберите количество круток для прокрутки!')
        .addFields(
            { name: '💫 Доступно круток', value: userSpins.toString(), inline: true },
            // { name: '🎲 Возможные результаты', value: `${HAKI_LIST.filter(h => h !== '-').length} видов хаки`, inline: true },
        )
        .setColor(0x9932CC)
        .setTimestamp();

    const maxSpins = Math.min(userSpins, 10);
    const selectOptions = [];
    
    for (let i = 1; i <= maxSpins; i++) {
        let spinWord;
        if (i === 1) {
            spinWord = 'крутка';
        } else if (i >= 2 && i <= 4) {
            spinWord = 'крутки';
        } else {
            spinWord = 'круток';
        }
        
        selectOptions.push({
            label: `${i} ${spinWord}`,
            description: `Быстро прокрутить ${i} раз`,
            value: i.toString(),
            emoji: '💫'
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`haki_spin_select_${interaction.user.id}`)
        .setPlaceholder('Выберите количество круток...')
        .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [spinMenuEmbed],
        components: [row]
    });
}

async function handleSpinSelection(interaction) {
    const userId = interaction.customId.split('_')[3];
    
    // Проверяем, что пользователь имеет право на это взаимодействие
    if (userId !== interaction.user.id) {
        return await interaction.reply({
            content: '❌ Это меню принадлежит другому пользователю!',
            ephemeral: true
        });
    }

    const spinCount = parseInt(interaction.values[0]);
    const userSpins = await db.getUserHakiSpins(interaction.user.id);

    if (userSpins < spinCount) {
        return await interaction.reply({
            content: `❌ У вас недостаточно круток! Доступно: ${userSpins}, требуется: ${spinCount}`,
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        // Списываем крутки
        await db.removeHakiSpins(interaction.user.id, spinCount);

        // Выполняем крутки
        const results = [];
        const sessionId = `${interaction.user.id}_${Date.now()}`;
        
        for (let i = 0; i < spinCount; i++) {
            const availableHaki = HAKI_LIST.filter(h => h !== '-');
            const randomHaki = availableHaki[Math.floor(Math.random() * availableHaki.length)];
            results.push(randomHaki);
        }

        // Сохраняем результаты в историю
        await db.addHakiHistory(interaction.user.id, sessionId, results, spinCount);

        // Подсчитываем статистику
        const hakiCounts = {};
        results.forEach(haki => {
            hakiCounts[haki] = (hakiCounts[haki] || 0) + 1;
        });

        // Создаем embed с результатами
        const resultsEmbed = new EmbedBuilder()
            .setTitle('🎉 Результаты круток хаки')
            .setDescription(`Вы прокрутили ${spinCount} раз и получили:`)
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: `Сессия: ${sessionId}` });

        // Добавляем результаты
        let resultsText = '';
        Object.entries(hakiCounts).forEach(([haki, count]) => {
            resultsText += `**${haki}** - ${count}x\n`;
        });

        resultsEmbed.addFields(
            { name: '🏆 Полученные хаки', value: resultsText || 'Нет результатов', inline: false },
            { name: '📊 Статистика', value: `Всего круток: ${spinCount}\nУникальных хаки: ${Object.keys(hakiCounts).length}`, inline: true },
            { name: '💫 Осталось круток', value: (userSpins - spinCount).toString(), inline: true }
        );

        // Добавляем детальный список если круток было немного
        if (spinCount <= 5) {
            const detailedResults = results.map((haki, index) => `${index + 1}. ${haki}`).join('\n');
            resultsEmbed.addFields({
                name: '📋 Подробные результаты',
                value: detailedResults,
                inline: false
            });
        }

        // Отправляем результаты
        await interaction.editReply({
            embeds: [resultsEmbed],
            components: []
        });

    } catch (error) {
        console.error('Ошибка выполнения круток хаки:', error);
        await interaction.editReply({
            content: '❌ Произошла ошибка при выполнении круток!',
            components: []
        });
    }
}

async function showHakiBalance(interaction) {
    const userSpins = await db.getUserHakiSpins(interaction.user.id);
    
    // Получаем статистику пользователя
    const hakiHistory = await db.getUserHakiHistory(interaction.user.id, 1);
    const totalSessions = await db.getUserHakiHistoryCount(interaction.user.id);
    
    const balanceEmbed = new EmbedBuilder()
        .setTitle('💫 Баланс круток хаки')
        .setDescription(`Информация о ваших крутках хаки`)
        .addFields(
            { name: '💫 Доступно круток', value: userSpins.toString(), inline: true },
            { name: '📊 Всего сессий', value: totalSessions.toString(), inline: true }
        )
        .setColor(0x9932CC)
        .setTimestamp()
        .setFooter({ text: `Пользователь: ${interaction.user.username}` });

    // Добавляем информацию о последней сессии если есть
    if (hakiHistory.length > 0) {
        const lastSession = hakiHistory[0];
        const lastResults = lastSession.results.split(',').slice(0, 5).join(', ');
        balanceEmbed.addFields({
            name: '🕐 Последняя сессия',
            value: `${lastSession.total_spins} круток: ${lastResults}${lastSession.total_spins > 5 ? '...' : ''}`,
            inline: false
        });
    }

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`haki_spin_menu_${interaction.user.id}`)
                .setLabel('🎰 Крутить хаки')
                .setStyle(ButtonStyle.Success)
                .setDisabled(userSpins === 0),
            new ButtonBuilder()
                .setCustomId(`haki_history_${interaction.user.id}`)
                .setLabel('📜 История')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({
        embeds: [balanceEmbed],
        components: [actionRow],
        ephemeral: true
    });
}

async function showHakiHistory(interaction) {
    const page = interaction.options.getInteger('страница') || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    const hakiHistory = await db.getUserHakiHistory(interaction.user.id, limit, offset);
    const totalSessions = await db.getUserHakiHistoryCount(interaction.user.id);
    const totalPages = Math.ceil(totalSessions / limit);

    if (hakiHistory.length === 0) {
        const noHistoryEmbed = new EmbedBuilder()
            .setTitle('📜 История круток хаки')
            .setDescription('У вас пока нет истории круток хаки!')
            .setColor(0xFF0000)
            .setTimestamp();

        return await interaction.reply({
            embeds: [noHistoryEmbed],
            ephemeral: true
        });
    }

    const historyEmbed = new EmbedBuilder()
        .setTitle('📜 История круток хаки')
        .setDescription(`Страница ${page} из ${totalPages} • Всего сессий: ${totalSessions}`)
        .setColor(0x9932CC)
        .setTimestamp()
        .setFooter({ text: `Пользователь: ${interaction.user.username}` });

    hakiHistory.forEach((session, index) => {
        const results = session.results.split(',');
        const sessionDate = new Date(session.session_start).toLocaleString('ru-RU');
        
        // Подсчитываем уникальные хаки
        const hakiCounts = {};
        results.forEach(haki => {
            hakiCounts[haki] = (hakiCounts[haki] || 0) + 1;
        });

        const hakiSummary = Object.entries(hakiCounts)
            .map(([haki, count]) => `${haki} (${count}x)`)
            .slice(0, 3)
            .join(', ');

        historyEmbed.addFields({
            name: `🎲 Сессия ${offset + index + 1} - ${session.total_spins} круток`,
            value: `📅 **Дата:** ${sessionDate}\n🏆 **Результаты:** ${hakiSummary}${Object.keys(hakiCounts).length > 3 ? '...' : ''}`,
            inline: false
        });
    });

    const actionRow = new ActionRowBuilder();
    
    if (page > 1) {
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`haki_history_page_${interaction.user.id}_${page - 1}`)
                .setLabel('◀️ Назад')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (page < totalPages) {
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`haki_history_page_${interaction.user.id}_${page + 1}`)
                .setLabel('Вперед ▶️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    actionRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`haki_spin_menu_${interaction.user.id}`)
            .setLabel('🎰 Крутить хаки')
            .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
        embeds: [historyEmbed],
        components: actionRow.components.length > 0 ? [actionRow] : [],
        ephemeral: true
    });
}
