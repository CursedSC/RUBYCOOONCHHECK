// interactions/shopInteraction.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const fs = require('fs');
const path = require('path');

// Хранилище для ожидания ввода количества
const awaitingQuantityInput = new Map();

// ФИКСИРОВАННАЯ ЦЕНА ЗА НАБОР КРУТОК (независимо от количества)
const FIXED_PRICE = 20.0;

// ID канала для логирования
const LOG_CHANNEL_ID = '1381454654440865934';

// Функция для детального логирования
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[SHOP DEBUG ${timestamp}] ${message}`);
    if (data) {
        console.log(`[SHOP DEBUG DATA]`, JSON.stringify(data, null, 2));
    }
}

// Загружаем список искр
function loadSparks() {
    try {
        const sparkleData = JSON.parse(fs.readFileSync(path.join(__dirname, '../sparkle.json'), 'utf8'));
        debugLog('Искры успешно загружены', { count: sparkleData.sparks.length });
        return sparkleData.sparks;
    } catch (error) {
        debugLog('Ошибка загрузки sparkle.json', { error: error.message });
        return ['Искра Огня', 'Искра Воды', 'Искра Земли', 'Искра Воздуха', 'Искра Света'];
    }
}

// Загружаем список глаз
function loadEyes() {
    try {
        const eyesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../glaza.json'), 'utf8'));
        debugLog('Глаза успешно загружены', { count: eyesData.eyes.length });
        return eyesData.eyes;
    } catch (error) {
        debugLog('Ошибка загрузки glaza.json', { error: error.message });
        return ['Шаринган', 'Риннеган', 'Бьякуган', 'Хронос', 'Глаза истины'];
    }
}

// Загружаем список контрактов
function loadContracts() {
    try {
        const contractsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts.json'), 'utf8'));
        debugLog('Контракты успешно загружены', { count: contractsData.contracts.length });
        return contractsData.contracts;
    } catch (error) {
        debugLog('Ошибка загрузки contracts.json', { error: error.message });
        return ['Контракт с демоном Огня', 'Контракт с демоном Воды', 'Контракт с демоном Земли'];
    }
}

function getRandomSparks(count = 5) {
    const sparks = loadSparks();
    const selectedSparks = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * sparks.length);
        selectedSparks.push(sparks[randomIndex]);
    }
    debugLog('Сгенерированы случайные искры', { count, selectedSparks });
    return selectedSparks;
}

function getRandomItems(itemType, count = 5) {
    let items = [];
    switch(itemType) {
        case 'eyes':
            items = loadEyes();
            break;
        case 'contracts':
            items = loadContracts();
            break;
        default:
            return [];
    }
    
    const selectedItems = [];
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * items.length);
        selectedItems.push(items[randomIndex]);
    }
    
    debugLog(`Сгенерированы случайные ${itemType}`, { count, selectedItems });
    return selectedItems;
}

// Функция для отправки логов в канал
async function sendLogToChannel(client, logData) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('Канал логирования не найден!');
            return;
        }

        const logEmbed = new EmbedBuilder()
            .setTitle('📊 Лог покупки в Донате')
            .setDescription(`🛒 **Пользователь:** <@${logData.userId}>\n💰 **Потрачено:** ${FIXED_PRICE} RubyCoins\n🎲 **Количество круток:** ${logData.totalSpins}`)
            .setColor(0x9932CC)
            .addFields(
                {
                    name: '🎁 Полученные искры:',
                    value: logData.results.map((result, index) =>
                        `**Крутка ${index + 1}:** ${result.chosenSpark}`
                    ).join('\n'),
                    inline: false
                },
                {
                    name: '👀 Все варианты по круткам:',
                    value: logData.results.map((result, index) =>
                        `**Крутка ${index + 1}:** ${result.allSparks.join(', ')}`
                    ).join('\n\n'),
                    inline: false
                },
                {
                    name: '📈 Статистика:',
                    value: `**Время покупки:** ${new Date().toLocaleString('ru-RU')}\n**Сессия:** ${logData.sessionHash}`,
                    inline: false
                }
            )
            .setFooter({ text: `ID пользователя: ${logData.userId}` })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
        debugLog('Лог отправлен в канал', { userId: logData.userId });
    } catch (error) {
        console.error('Ошибка отправки лога в канал:', error);
    }
}

module.exports = {
    canHandle(interaction) {
        const canHandle = interaction.customId?.startsWith('shop_') ||
                        interaction.customId?.startsWith('spark_') ||
                        interaction.customId?.startsWith('eyes_') ||
                        interaction.customId?.startsWith('demon_') ||
                        interaction.customId?.startsWith('gift_') ||
                        interaction.customId?.startsWith('return_shop');
        
        debugLog('Проверка возможности обработки', {
            customId: interaction.customId,
            canHandle,
            userId: interaction.user.id,
            type: interaction.type
        });
        return canHandle;
    },

    async execute(interaction) {
        const Database = require('../database');
        const db = new Database();
        
        debugLog('Начало выполнения взаимодействия', {
            customId: interaction.customId,
            userId: interaction.user.id,
            type: interaction.type
        });

        try {
            if (interaction.customId.startsWith('shop_select_')) {
                await this.handleShopSelection(interaction, db);
            }
            else if (interaction.customId.startsWith('spark_confirm_')) {
                await this.handlePurchaseConfirmation(interaction, db);
            }
            else if (interaction.customId.startsWith('eyes_confirm_') || interaction.customId.startsWith('demon_confirm_')) {
                await this.handleDirectPurchase(interaction, db);
            }
            else if (interaction.customId.startsWith('gift_select_')) {
                await this.handleGiftSelection(interaction, db);
            }
            else if (interaction.customId.startsWith('return_shop')) {
                await this.handleReturnToShop(interaction, db);
            }
            else {
                debugLog('Неизвестный customId', { customId: interaction.customId });
            }
        } catch (error) {
            debugLog('Критическая ошибка в execute', {
                error: error.message,
                stack: error.stack,
                customId: interaction.customId,
                userId: interaction.user.id
            });
            await this.safeReply(interaction, {
                content: '❌ Произошла ошибка при обработке запроса! Попробуйте снова.',
                ephemeral: true
            });
        }
    },

    async handleShopSelection(interaction, db) {
        debugLog('Обработка выбора в Донате', {
            values: interaction.values,
            userId: interaction.user.id
        });

        const selectedItem = interaction.values[0];
        const userId = interaction.user.id;

        if (selectedItem === 'spark_pack') {
            try {
                const userBalance = await db.getUserRubyCoins(userId);
                debugLog('Получен баланс пользователя', {
                    userId,
                    balance: userBalance
                });

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✨ Покупка Набора Искр')
                    .setDescription(`🎁 **Товар:** Набор Искр\n💰 **Цена:** ${FIXED_PRICE} RubyCoins (фиксированная цена)\n💳 **Ваш баланс:** ${userBalance.toFixed(2)} RubyCoins\n\n🎲 После покупки вы сможете выбрать количество круток от 1 до 4`)
                    .setColor(0xFF6B35)
                    .addFields(
                        {
                            name: '🎯 Как это работает:',
                            value: '1. Подтвердите покупку\n2. Введите количество круток (1-4)\n3. Получите результаты с выбором подарков\n4. Результаты будут записаны в лог',
                            inline: false
                        },
                        {
                            name: '💎 Преимущества:',
                            value: '• Фиксированная цена за любое количество\n• Интерактивный выбор подарков\n• Детальная статистика результатов\n• Автоматическое логирование',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Фиксированная цена независимо от количества круток!' })
                    .setTimestamp();

                const confirmButton = new ButtonBuilder()
                    .setCustomId(`spark_confirm_${userId}`)
                    .setLabel(`✅ Купить за ${FIXED_PRICE} RC`)
                    .setStyle(ButtonStyle.Success);

                const cancelButton = new ButtonBuilder()
                    .setCustomId(`shop_cancel_${userId}`)
                    .setLabel('❌ Отменить')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                await interaction.update({
                    embeds: [confirmEmbed],
                    components: [row]
                });

                debugLog('Показано подтверждение покупки');
            } catch (error) {
                debugLog('Ошибка при обработке выбора товара', {
                    error: error.message,
                    userId
                });
                throw error;
            }
        }
        else if (selectedItem === 'eyes_roll') {
            try {
                const userBalance = await db.getUserRubyCoins(userId);
                
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('👁️ Покупка Ролла Глаз')
                    .setDescription(`🎁 **Товар:** Ролл Глаз\n💰 **Цена:** 15.0 RubyCoins\n💳 **Ваш баланс:** ${userBalance.toFixed(2)} RubyCoins\n\n🔮 Получите случайные глаза с захватывающей интригой!`)
                    .setColor(0x4169E1)
                    .addFields(
                        {
                            name: '🎪 Что вас ждет:',
                            value: '1. Выберите один из 5 подарков\n2. Испытайте захватывающую интригу\n3. Узнайте, что могло выпасть\n4. Получите свою уникальную награду!',
                            inline: false
                        },
                        {
                            name: '✨ Особенности:',
                            value: '• Один ролл за покупку\n• Интрига с альтернативами\n• Уникальные глаза демонов\n• Автоматическое логирование',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Приготовьтесь к интриге с глазами!' })
                    .setTimestamp();

                const confirmButton = new ButtonBuilder()
                    .setCustomId(`eyes_confirm_${userId}`)
                    .setLabel('✅ Купить за 15.0 RC')
                    .setStyle(ButtonStyle.Success);

                const cancelButton = new ButtonBuilder()
                    .setCustomId(`shop_cancel_${userId}`)
                    .setLabel('❌ Отменить')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                await interaction.update({
                    embeds: [confirmEmbed],
                    components: [row]
                });

                debugLog('Показано подтверждение покупки глаз');
            } catch (error) {
                debugLog('Ошибка при обработке выбора глаз', {
                    error: error.message,
                    userId
                });
                throw error;
            }
        }
        else if (selectedItem === 'demon_contract') {
            try {
                const userBalance = await db.getUserRubyCoins(userId);
                
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('📜 Покупка Контракта с Демоном')
                    .setDescription(`🎁 **Товар:** Контракт с Демоном\n💰 **Цена:** 25.0 RubyCoins\n💳 **Ваш баланс:** ${userBalance.toFixed(2)} RubyCoins\n\n🔥 Заключите договор с могущественным демоном!`)
                    .setColor(0x8B0000)
                    .addFields(
                        {
                            name: '🎪 Что вас ждет:',
                            value: '1. Выберите один из 5 подарков\n2. Испытайте демоническую интригу\n3. Узнайте альтернативные контракты\n4. Заключите свой договор с тьмой!',
                            inline: false
                        },
                        {
                            name: '🔥 Особенности:',
                            value: '• Один контракт за покупку\n• Демоническая интрига\n• Уникальные способности\n• Автоматическое логирование',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Готовы заключить сделку с демоном?' })
                    .setTimestamp();

                const confirmButton = new ButtonBuilder()
                    .setCustomId(`demon_confirm_${userId}`)
                    .setLabel('✅ Купить за 25.0 RC')
                    .setStyle(ButtonStyle.Success);

                const cancelButton = new ButtonBuilder()
                    .setCustomId(`shop_cancel_${userId}`)
                    .setLabel('❌ Отменить')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

                await interaction.update({
                    embeds: [confirmEmbed],
                    components: [row]
                });

                debugLog('Показано подтверждение покупки контракта');
            } catch (error) {
                debugLog('Ошибка при обработке выбора контракта', {
                    error: error.message,
                    userId
                });
                throw error;
            }
        }
    },

    async handlePurchaseConfirmation(interaction, db) {
        const userId = interaction.user.id;
        debugLog('Обработка подтверждения покупки', { userId });

        try {
            const purchaseEmbed = new EmbedBuilder()
                .setTitle('🎲 Выбор количества круток')
                .setDescription('**Введите количество круток от 1 до 4 в чат:**')
                .setColor(0xFFD700)
                .addFields(
                    {
                        name: '💰 Информация о покупке:',
                        value: `**Цена:** ${FIXED_PRICE} RubyCoins (фиксированная)\n**Доступно круток:** 1-4\n**Время на ввод:** 60 секунд`,
                        inline: false
                    },
                    {
                        name: '💡 Примеры ввода:',
                        value: 'Напишите: `1`, `2`, `3` или `4`',
                        inline: false
                    },
                    {
                        name: '🎁 Что вас ждет:',
                        value: 'После ввода вы получите указанное количество круток с возможностью выбора подарков из 5 вариантов в каждой. Все результаты будут записаны в лог.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Напишите число от 1 до 4 в этот чат' })
                .setTimestamp();

            await interaction.update({
                embeds: [purchaseEmbed],
                components: []
            });

            // Сохраняем состояние ожидания ввода
            awaitingQuantityInput.set(userId, {
                channelId: interaction.channelId,
                timestamp: Date.now()
            });

            debugLog('Установлено ожидание ввода количества', {
                userId,
                channelId: interaction.channelId
            });

            // Удаляем состояние через 60 секунд
            setTimeout(() => {
                if (awaitingQuantityInput.has(userId)) {
                    awaitingQuantityInput.delete(userId);
                    debugLog('Таймаут ожидания ввода', { userId });
                    interaction.channel.send({
                        content: `⏰ <@${userId}>, время ввода истекло. Используйте команду /донат снова.`,
                        allowedMentions: { users: [userId] }
                    }).catch(error => {
                        debugLog('Ошибка отправки сообщения о таймауте', { error: error.message });
                    });
                }
            }, 60000);

        } catch (error) {
            debugLog('Ошибка подтверждения покупки', {
                error: error.message,
                userId
            });
            await interaction.update({
                content: '❌ Ошибка при обработке покупки!',
                embeds: [],
                components: []
            });
        }
    },

    async handleDirectPurchase(interaction, db) {
        const userId = interaction.user.id;
        const itemType = interaction.customId.startsWith('eyes_') ? 'eyes' : 'contracts';
        const price = itemType === 'eyes' ? 199.0 : 1888.0;
        
        debugLog('Обработка прямой покупки', { userId, itemType, price });

        try {
            const userBalance = await db.getUserRubyCoins(userId);

            if (userBalance < price) {
                await interaction.update({
                    content: `❌ Недостаточно средств! Нужно: ${price} RubyCoins, у вас: ${userBalance.toFixed(2)} RubyCoins`,
                    embeds: [],
                    components: []
                });
                return;
            }

            // Списываем сумму
            await db.removeRubyCoins(userId, price);
            
            // Генерируем 5 вариантов
            const variants = getRandomItems(itemType, 5);
            const sessionHash = this.createSessionHash(userId, Date.now());

            debugLog('Средства списаны, варианты сгенерированы', {
                userId,
                price,
                newBalance: userBalance - price,
                variants,
                sessionHash
            });

            // Сохраняем в сессию
            this.spinResults.set(sessionHash, {
                userId,
                itemType,
                variants,
                chosenIndex: null,
                timestamp: Date.now(),
                price
            });

            // Показываем SelectMenu с 5 вариантами подарков
            const itemNames = {
                'eyes': 'Глаза',
                'contracts': 'Контракты'
            };

            const itemEmojis = {
                'eyes': '👁️',
                'contracts': '📜'
            };

            const colors = {
                'eyes': 0x4169E1,
                'contracts': 0x8B0000
            };

            const embed = new EmbedBuilder()
                .setTitle(`${itemEmojis[itemType]} Ваш ролл: ${itemNames[itemType]}`)
                .setDescription(`🎁 **Выберите один из 5 подарков ниже:**\n\n*Каждый подарок скрывает уникальные ${itemNames[itemType].toLowerCase()}!*\n\n🌟 **Приготовьтесь к захватывающей интриге!**`)
                .setColor(colors[itemType])
                .addFields(
                    {
                        name: '💰 Информация о покупке:',
                        value: `**Потрачено:** ${price} RubyCoins\n**Новый баланс:** ${(userBalance - price).toFixed(2)} RubyCoins\n**Дата покупки:** ${new Date().toLocaleString('ru-RU')}`,
                        inline: false
                    },
                    {
                        name: '🎪 Что происходит дальше:',
                        value: `После выбора подарка вас ждет:\n• 4 интригующих сообщения "Вам могло выпасти..."\n• Показ альтернативных вариантов\n• Финальное раскрытие вашей награды!\n• Автоматическая запись в лог канал`,
                        inline: false
                    }
                )
                .setFooter({ text: `Сессия: ${sessionHash} | Выберите подарок и готовьтесь к интриге!` })
                .setTimestamp();

            const select = new StringSelectMenuBuilder()
                .setCustomId(`gift_select_${userId}_0_1_${itemType}_${sessionHash}`)
                .setPlaceholder(`${itemEmojis[itemType]} Выберите подарок и начните интригу...`)
                .addOptions([
                    { label: `${itemEmojis[itemType]} Подарок #1`, description: 'Что скрывается за первой дверью?', value: '0', emoji: itemEmojis[itemType] },
                    { label: `${itemEmojis[itemType]} Подарок #2`, description: 'Тайна второго выбора ждет!', value: '1', emoji: itemEmojis[itemType] },
                    { label: `${itemEmojis[itemType]} Подарок #3`, description: 'Третий путь полон загадок!', value: '2', emoji: itemEmojis[itemType] },
                    { label: `${itemEmojis[itemType]} Подарок #4`, description: 'Четвертая возможность манит!', value: '3', emoji: itemEmojis[itemType] },
                    { label: `${itemEmojis[itemType]} Подарок #5`, description: 'Пятый шанс может быть решающим!', value: '4', emoji: itemEmojis[itemType] }
                ]);

            await interaction.update({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(select)]
            });

        } catch (error) {
            debugLog('Ошибка прямой покупки', {
                error: error.message,
                userId,
                itemType
            });
            await interaction.update({
                content: '❌ Произошла ошибка при обработке покупки!',
                embeds: [],
                components: []
            });
        }
    },

    async handleGiftSelection(interaction, db) {
        const parts = interaction.customId.split('_');
        debugLog('Разбор customId', {
            customId: interaction.customId,
            parts: parts,
            userId: interaction.user.id
        });

        // Проверяем формат customId
        if (parts.length < 6) {
            debugLog('Неверный формат customId', { customId: interaction.customId });
            await interaction.update({
                content: '❌ Неверный формат запроса. Используйте команду /донат снова.',
                embeds: [],
                components: []
            });
            return;
        }

        const targetUserId = parts[2];
        const spinIndex = parseInt(parts[3]);
        const totalSpins = parseInt(parts[4]);
        
        // Определяем тип товара и хеш сессии
        let itemType, sessionHash;
        if (parts.length === 6) {
            // Старый формат для искр: gift_select_userId_spinIndex_totalSpins_sparksHash
            itemType = 'sparks';
            sessionHash = parts[5];
        } else if (parts.length >= 7) {
            // Новый формат: gift_select_userId_spinIndex_totalSpins_itemType_sessionHash
            itemType = parts[5];
            sessionHash = parts[6];
        }

        const selectedIndex = parseInt(interaction.values);

        // Проверяем права доступа
        if (targetUserId !== interaction.user.id) {
            debugLog('Пользователь не имеет права на это взаимодействие', {
                targetUserId,
                actualUserId: interaction.user.id
            });
            await interaction.update({
                content: '❌ Это взаимодействие принадлежит другому пользователю.',
                embeds: [],
                components: []
            });
            return;
        }

        try {
            if (itemType === 'sparks') {
                // Логика для искр (старая система)
                await this.handleSparkGiftSelection(interaction, targetUserId, spinIndex, totalSpins, sessionHash, selectedIndex);
            } else if (itemType === 'eyes' || itemType === 'contracts') {
                // Логика для глаз и контрактов (новая система с интригой)
                await this.handleIntrigueGiftSelection(interaction, targetUserId, itemType, sessionHash, selectedIndex);
            }

        } catch (error) {
            debugLog('Ошибка обработки выбора подарка', {
                error: error.message,
                stack: error.stack,
                itemType
            });
            await interaction.update({
                content: '❌ Произошла ошибка при обработке выбора!',
                embeds: [],
                components: []
            });
        }
    },

    async handleSparkGiftSelection(interaction, targetUserId, spinIndex, totalSpins, sessionHash, selectedIndex) {
        // Восстанавливаем искры из хеша (старая логика)
        const currentSparks = this.generateSparksFromHash(sessionHash, spinIndex);
        const chosenSpark = currentSparks[selectedIndex];

        debugLog('Выбор подарка (искры)', {
            spinIndex,
            selectedIndex,
            chosenSpark,
            totalSpins,
            currentSparks
        });

        // Сохраняем результат
        await this.saveSpinResult(targetUserId, sessionHash, spinIndex, selectedIndex, chosenSpark, currentSparks);

        // Красивый результат текущей крутки
        const resultEmbed = new EmbedBuilder()
            .setTitle(`🎉 Результат крутки ${spinIndex + 1}/${totalSpins}`)
            .setDescription(`🎯 **Ваш выбор:** Подарок #${selectedIndex + 1}\n✨ **Вы получили:** **${chosenSpark}**`)
            .setColor(0x00FF7F)
            .addFields(
                {
                    name: '🏆 Ваша награда:',
                    value: `\`\`\`fix\n${chosenSpark}\n\`\`\``,
                    inline: false
                },
                {
                    name: '👀 Альтернативные варианты:',
                    value: currentSparks.map((spark, index) =>
                        index === selectedIndex ?
                        `🟢 **${index + 1}.** ${spark} ⭐` :
                        `🔴 **${index + 1}.** ${spark}`
                    ).join('\n'),
                    inline: false
                },
                {
                    name: '📊 Прогресс:',
                    value: `Крутка ${spinIndex + 1} из ${totalSpins} завершена ${spinIndex + 1 < totalSpins ? '• Следующая крутка через 5 секунд...' : '• Подготовка итогов...'}`,
                    inline: false
                }
            )
            .setFooter({ text: `Потрачено: ${FIXED_PRICE} RubyCoins • Хеш: ${sessionHash}` })
            .setTimestamp();

        await interaction.update({
            embeds: [resultEmbed],
            components: []
        });

        debugLog('Показан результат крутки', {
            spinIndex,
            hasMoreSpins: spinIndex + 1 < totalSpins
        });

        // Если есть еще крутки, показываем следующую через 5 секунд (увеличено с 3)
        if (spinIndex + 1 < totalSpins) {
            setTimeout(async () => {
                try {
                    await this.showNextSpin(interaction.channel, targetUserId, spinIndex + 1, totalSpins, sessionHash);
                    debugLog('Показана следующая крутка', {
                        nextSpinIndex: spinIndex + 1
                    });
                } catch (error) {
                    debugLog('Ошибка показа следующей крутки', {
                        error: error.message
                    });
                }
            }, 5000); // Увеличено с 3000 до 5000
        } else {
            // Показываем итоговую статистику через 3 секунды (увеличено с 2)
            setTimeout(async () => {
                try {
                    await this.showFinalResults(interaction.channel, targetUserId, totalSpins, sessionHash);
                    // Отправляем лог в канал после завершения всех круток
                    await this.sendFinalLogToChannel(interaction.client, targetUserId, totalSpins, sessionHash);
                    debugLog('Показаны финальные результаты и отправлен лог');
                } catch (error) {
                    debugLog('Ошибка показа финальных результатов', {
                        error: error.message
                    });
                }
            }, 3000); // Увеличено с 2000 до 3000
        }
    },

    async handleIntrigueGiftSelection(interaction, targetUserId, itemType, sessionHash, selectedIndex) {
        debugLog('Поиск сессии для интриги', {
            targetUserId,
            itemType,
            sessionHash,
            selectedIndex,
            availableSessions: Array.from(this.spinResults.keys())
        });

        // Получаем варианты из памяти
        const session = this.spinResults.get(sessionHash);
        if (!session) {
            debugLog('Сессия не найдена, создаем новую', {
                sessionHash,
                targetUserId,
                itemType
            });
            
            // Создаем новую сессию с новыми вариантами
            const newVariants = getRandomItems(itemType, 5);
            const newSession = {
                userId: targetUserId,
                itemType,
                variants: newVariants,
                chosenIndex: null,
                timestamp: Date.now(),
                price: itemType === 'eyes' ? 15.0 : 25.0
            };
            
            this.spinResults.set(sessionHash, newSession);
            debugLog('Новая сессия создана', { sessionHash, newVariants });
        }

        const finalSession = this.spinResults.get(sessionHash);
        
        // Запоминаем выбор
        finalSession.chosenIndex = selectedIndex;
        const chosenItem = finalSession.variants[selectedIndex];

        debugLog('Выбор подарка с интригой', {
            itemType,
            selectedIndex,
            chosenItem,
            variants: finalSession.variants
        });

        // Обновляем сообщение на "ожидание интриги"
        const waitingEmbed = new EmbedBuilder()
            .setTitle('⏳ Запускаем крут...')
            .setDescription(`🎪 **Секунду... готовим захватывающее шоу!**\n\n🎭 Сейчас вы узнаете, что могло выпасть из других подарков...\n\n🌟 **Приготовьтесь к раскрытию тайны!**`)
            .setColor(0xFFD700)
            .addFields({
                name: '🎯 Ваш выбор:',
                value: `Подарок #${selectedIndex + 1}`,
                inline: true
            },
            {
                name: '⏰ Статус:',
                value: 'Готовим интригу...',
                inline: true
            })
            .setFooter({ text: 'Интрига начинается через мгновение...' })
            .setTimestamp();

        await interaction.update({
            embeds: [waitingEmbed],
            components: []
        });

        // Показываем сериал интриги с увеличенной задержкой
        const otherVariants = finalSession.variants.filter((_, index) => index !== selectedIndex);
        
        for (let i = 0; i < otherVariants.length; i++) {
            setTimeout(() => {
                const intrigueEmbed = new EmbedBuilder()
                    .setTitle('😱 Интрига!')
                    .setDescription(`**Вам могло выпасть... ${otherVariants[i]}**`)
                    .setColor(0xFF4500)
                    .addFields({
                        name: '🎭 Альтернативный вариант:',
                        value: `\`\`\`\n${otherVariants[i]}\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: `Вариант ${i + 1} из ${otherVariants.length} • Но это НЕ ваш выбор!` })
                    .setTimestamp();

                interaction.followUp({
                    embeds: [intrigueEmbed],
                    ephemeral: false
                }).catch(error => {
                    debugLog('Ошибка отправки интригующего сообщения', { error: error.message });
                });
            }, (i + 1) * 2500); // Увеличено с 1500 до 2500 мс между сообщениями
        }

        // Показываем итоговое сообщение с результатом с еще большей задержкой
        setTimeout(async () => {
            try {
                const itemNames = {
                    'eyes': 'глаза',
                    'contracts': 'контракт'
                };

                const itemEmojis = {
                    'eyes': '👁️',
                    'contracts': '📜'
                };

                const colors = {
                    'eyes': 0x4169E1,
                    'contracts': 0x8B0000
                };

                const finalEmbed = new EmbedBuilder()
                    .setTitle(`🎉 ИТОГОВЫЙ РЕЗУЛЬТАТ!`)
                    .setDescription(`${itemEmojis[itemType]} **ПОЗДРАВЛЯЕМ! Вы вытянули:**\n\n🌟 **${chosenItem}** 🌟`)
                    .setColor(colors[itemType])
                    .addFields(
                        {
                            name: '🏆 Ваша награда:',
                            value: `\`\`\`fix\n${chosenItem}\n\`\`\``,
                            inline: false
                        },
                        {
                            name: '😱 Все варианты в этом ролле:',
                            value: finalSession.variants.map((item, index) =>
                                index === selectedIndex ?
                                `🎯 **${index + 1}.** ${item} ⭐ *(ВАШ ВЫБОР)*` :
                                `😢 **${index + 1}.** ${item} *(упущенная возможность)*`
                            ).join('\n'),
                            inline: false
                        },
                        {
                            name: '💰 Информация о покупке:',
                            value: `**Потрачено:** ${finalSession.price} RubyCoins\n**Дата:** ${new Date().toLocaleString('ru-RU')}\n**Тип:** ${itemNames[itemType]}`,
                            inline: true
                        },
                        {
                            name: '📊 Статистика:',
                            value: `**Всего вариантов:** 5\n**Ваш выбор:** #${selectedIndex + 1}\n**Сессия:** ${sessionHash.slice(-6)}`,
                            inline: true
                        }
                    )
                    .setFooter({ text: `Сессия: ${sessionHash} • Результат записан в лог • Спасибо за покупку!` })
                    .setTimestamp();

                const returnButton = new ButtonBuilder()
                    .setCustomId(`return_shop_${targetUserId}`)
                    .setLabel('🛒 Вернуться в Донат')
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder().addComponents(returnButton);

                await interaction.followUp({
                    embeds: [finalEmbed],
                    components: [row]
                });

                // Отправляем лог в канал
                await this.sendDirectLogToChannel(interaction.client, finalSession, chosenItem);

                // Удаляем сессию
                this.spinResults.delete(sessionHash);

                debugLog('Интрига завершена, результат показан', { chosenItem });

            } catch (error) {
                debugLog('Ошибка показа итогового результата', {
                    error: error.message
                });
            }
        }, (otherVariants.length + 1) * 2500 + 2000); // Увеличено время ожидания финала
    },

    // Временное хранилище результатов круток
    spinResults: new Map(),

    // Сохранение результата крутки (для искр)
    async saveSpinResult(userId, sessionHash, spinIndex, selectedIndex, chosenSpark, allSparks) {
        const key = `${userId}_${sessionHash}`;
        if (!this.spinResults.has(key)) {
            this.spinResults.set(key, {
                userId,
                sessionHash,
                timestamp: Date.now(),
                results: []
            });
        }

        const session = this.spinResults.get(key);
        session.results[spinIndex] = {
            spinIndex,
            selectedIndex,
            chosenSpark,
            allSparks: [...allSparks]
        };

        debugLog('Результат крутки сохранен', {
            userId,
            sessionHash,
            spinIndex,
            chosenSpark
        });
    },

    // Отправка лога для прямых покупок (глаза, контракты)
    async sendDirectLogToChannel(client, session, chosenItem) {
        try {
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (!logChannel) {
                console.error('Канал логирования не найден!');
                return;
            }

            const itemNames = {
                'eyes': 'Глаза',
                'contracts': 'Контракты'
            };

            const itemEmojis = {
                'eyes': '👁️',
                'contracts': '📜'
            };

            const logEmbed = new EmbedBuilder()
                .setTitle(`📊 Лог покупки: ${itemNames[session.itemType]}`)
                .setDescription(`🛒 **Пользователь:** <@${session.userId}>\n💰 **Потрачено:** ${session.price} RubyCoins\n${itemEmojis[session.itemType]} **Тип:** ${itemNames[session.itemType]}`)
                .setColor(session.itemType === 'eyes' ? 0x4169E1 : 0x8B0000)
                .addFields(
                    {
                        name: `${itemEmojis[session.itemType]} Полученная награда:`,
                        value: `**Получено:** ${chosenItem}`,
                        inline: false
                    },
                    {
                        name: '😱 Альтернативные варианты:',
                        value: session.variants.filter(item => item !== chosenItem).join('\n• '),
                        inline: false
                    },
                    {
                        name: '📈 Информация:',
                        value: `**Время покупки:** ${new Date().toLocaleString('ru-RU')}\n**Сессия:** ${this.createSessionHash(session.userId, session.timestamp)}\n**Выбран подарок:** #${session.chosenIndex + 1}`,
                        inline: false
                    }
                )
                .setFooter({ text: `ID пользователя: ${session.userId}` })
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
            debugLog('Прямой лог отправлен', { userId: session.userId, chosenItem });
        } catch (error) {
            console.error('Ошибка отправки лога в канал:', error);
        }
    },

    // Отправка финального лога в канал (для искр)
    async sendFinalLogToChannel(client, userId, totalSpins, sessionHash) {
        const key = `${userId}_${sessionHash}`;
        const sessionData = this.spinResults.get(key);
        
        if (!sessionData) {
            debugLog('Данные сессии не найдены для лога', { key });
            return;
        }

        const logData = {
            userId: sessionData.userId,
            totalSpins,
            sessionHash,
            timestamp: sessionData.timestamp,
            results: sessionData.results.filter(r => r !== undefined)
        };

        await sendLogToChannel(client, logData);
        
        // Удаляем данные после отправки лога
        this.spinResults.delete(key);
        debugLog('Данные сессии удалены после отправки лога', { key });
    },

    // Генерация искр на основе хеша (детерминированная)
    generateSparksFromHash(hash, spinIndex) {
        const sparks = loadSparks();
        const seed = parseInt(hash, 36) + spinIndex * 1000;
        const selectedSparks = [];
        
        for (let i = 0; i < 5; i++) {
            const index = (seed + i * 123) % sparks.length;
            selectedSparks.push(sparks[index]);
        }

        return selectedSparks;
    },

    // Создание хеша для детерминированной генерации
    createSparksHash(userId, timestamp) {
        return (parseInt(userId) + parseInt(timestamp)).toString(36).substr(0, 8);
    },

    // Создание хеша сессии
    createSessionHash(userId, timestamp) {
        return `${userId.toString().slice(-8)}_${timestamp.toString().slice(-8)}`;
    },

    async showSpinResults(channel, userId, allResults, currentPage, newBalance) {
        const timestamp = Date.now().toString();
        const sparksHash = this.createSparksHash(userId, timestamp);
        
        debugLog('Создание первой крутки', {
            userId,
            totalSpins: allResults.length,
            currentPage,
            timestamp,
            sparksHash
        });

        const resultEmbed = new EmbedBuilder()
            .setTitle(`🎰 Крутка ${currentPage + 1}/${allResults.length}`)
            .setDescription('🎁 **Выберите один из 5 подарков ниже:**\n\n*Каждый подарок содержит уникальную искру!*\n\n✨ **Время для выбора настало!**')
            .setColor(0xFF1493)
            .addFields(
                {
                    name: '📈 Прогресс круток:',
                    value: `\`\`\`\n${currentPage + 1} из ${allResults.length}\n\`\`\``,
                    inline: true
                },
                {
                    name: '💰 Потрачено:',
                    value: `\`\`\`\n${FIXED_PRICE} RubyCoins\n\`\`\``,
                    inline: true
                },
                {
                    name: '💳 Новый баланс:',
                    value: `\`\`\`\n${newBalance.toFixed(2)} RC\n\`\`\``,
                    inline: true
                },
                {
                    name: '🎯 Инструкция:',
                    value: 'Выберите один подарок из меню ниже. После выбора вы увидите результат и альтернативные варианты.',
                    inline: false
                }
            )
            .setFooter({ text: `Хеш: ${sparksHash} • Выберите подарок в меню ниже • Результаты логируются` })
            .setTimestamp();

        // Создаем dropdown с встроенными данными в customId
        const giftSelect = new StringSelectMenuBuilder()
            .setCustomId(`gift_select_${userId}_${currentPage}_${allResults.length}_${sparksHash}`)
            .setPlaceholder('🎁 Выберите подарок и раскройте тайну...')
            .addOptions([
                { label: '🎁 Подарок #1', description: 'Таинственная искра ждет вас!', value: '0', emoji: '🎁' },
                { label: '🎁 Подарок #2', description: 'Что скрывается внутри?', value: '1', emoji: '🎁' },
                { label: '🎁 Подарок #3', description: 'Удача улыбается смелым!', value: '2', emoji: '🎁' },
                { label: '🎁 Подарок #4', description: 'Возможно, это ваш шанс!', value: '3', emoji: '🎁' },
                { label: '🎁 Подарок #5', description: 'Последний, но не менее ценный!', value: '4', emoji: '🎁' }
            ]);

        const row = new ActionRowBuilder().addComponents(giftSelect);

        try {
            await channel.send({
                content: `🎊 <@${userId}>, ваши крутки готовы! Время сделать выбор!`,
                embeds: [resultEmbed],
                components: [row],
                allowedMentions: { users: [userId] }
            });

            debugLog('Отправлена первая крутка', {
                userId,
                currentPage,
                customId: `gift_select_${userId}_${currentPage}_${allResults.length}_${sparksHash}`
            });
        } catch (error) {
            debugLog('Ошибка отправки результатов крутки', {
                error: error.message,
                userId
            });
        }
    },

    async showNextSpin(channel, userId, spinIndex, totalSpins, sparksHash) {
        debugLog('Показ следующей крутки', {
            userId,
            spinIndex,
            totalSpins,
            sparksHash
        });

        const spinEmbed = new EmbedBuilder()
            .setTitle(`🎰 Крутка ${spinIndex + 1}/${totalSpins}`)
            .setDescription('🎁 **Выберите один из 5 подарков ниже:**\n\n*Новая крутка, новые возможности!*\n\n🌟 **Продолжаем захватывающее путешествие!**')
            .setColor(0xFF1493)
            .addFields(
                {
                    name: '📈 Прогресс круток:',
                    value: `\`\`\`\n${spinIndex + 1} из ${totalSpins}\n\`\`\``,
                    inline: true
                },
                {
                    name: '💰 Потрачено:',
                    value: `\`\`\`\n${FIXED_PRICE} RubyCoins\n\`\`\``,
                    inline: true
                },
                {
                    name: '🎯 Статус:',
                    value: `\`\`\`\nПродолжаем!\n\`\`\``,
                    inline: true
                },
                {
                    name: '✨ Мотивация:',
                    value: `Вы уже прошли ${spinIndex} ${spinIndex === 1 ? 'крутку' : 'круток'}! Осталось ${totalSpins - spinIndex}. Удача на вашей стороне!`,
                    inline: false
                }
            )
            .setFooter({ text: `Хеш: ${sparksHash} • Продолжаем крутки! • Результаты логируются` })
            .setTimestamp();

        const giftSelect = new StringSelectMenuBuilder()
            .setCustomId(`gift_select_${userId}_${spinIndex}_${totalSpins}_${sparksHash}`)
            .setPlaceholder('🎁 Выберите следующий подарок...')
            .addOptions([
                { label: '🎁 Подарок #1', description: 'Новая надежда в первом подарке!', value: '0', emoji: '🎁' },
                { label: '🎁 Подарок #2', description: 'Второй шанс на удачу!', value: '1', emoji: '🎁' },
                { label: '🎁 Подарок #3', description: 'Третий путь к победе!', value: '2', emoji: '🎁' },
                { label: '🎁 Подарок #4', description: 'Четвертая возможность!', value: '3', emoji: '🎁' },
                { label: '🎁 Подарок #5', description: 'Пятый элемент удачи!', value: '4', emoji: '🎁' }
            ]);

        const row = new ActionRowBuilder().addComponents(giftSelect);

        try {
            await channel.send({
                content: `🎊 <@${userId}>, следующая крутка готова! Продолжаем приключение!`,
                embeds: [spinEmbed],
                components: [row],
                allowedMentions: { users: [userId] }
            });

            debugLog('Следующая крутка отправлена успешно', {
                userId,
                spinIndex,
                customId: `gift_select_${userId}_${spinIndex}_${totalSpins}_${sparksHash}`
            });
        } catch (error) {
            debugLog('Ошибка отправки следующей крутки', {
                error: error.message,
                userId,
                spinIndex
            });
        }
    },

    async showFinalResults(channel, userId, totalSpins, sparksHash) {
        debugLog('Показ финальных результатов', {
            userId,
            totalSpins,
            sparksHash
        });

        // Получаем сохраненные результаты
        const key = `${userId}_${sparksHash}`;
        const sessionData = this.spinResults.get(key);

        const summaryEmbed = new EmbedBuilder()
            .setTitle('🏆 ФИНАЛЬНЫЕ ИТОГИ ВСЕХ КРУТОК')
            .setDescription(`🎊 **ПОЗДРАВЛЯЕМ С ЗАВЕРШЕНИЕМ!** 🎊\n\nВы успешно завершили все ${totalSpins} ${totalSpins === 1 ? 'крутку' : totalSpins < 5 ? 'крутки' : 'круток'}!\n\n📋 **Подробные результаты вашего путешествия:**`)
            .setColor(0x9932CC)
            .setTimestamp();

        if (sessionData && sessionData.results.length > 0) {
            // Добавляем результаты каждой крутки с красивым оформлением
            sessionData.results.forEach((result, index) => {
                if (result) {
                    const otherSparks = result.allSparks.filter(spark => spark !== result.chosenSpark).slice(0, 3).join(', ');
                    summaryEmbed.addFields({
                        name: `🎲 Крутка ${index + 1}`,
                        value: `🏆 **Ваш выигрыш:** \`${result.chosenSpark}\`\n👀 **Упущенные варианты:** ${otherSparks}${result.allSparks.length > 4 ? '...' : ''}\n🎯 **Выбор:** Подарок #${result.selectedIndex + 1}`,
                        inline: false
                    });
                }
            });

            // Итоговая статистика
            summaryEmbed.addFields(
                {
                    name: '📊 Общая статистика',
                    value: `\`\`\`\n🎰 Всего круток: ${totalSpins}\n💰 Потрачено: ${FIXED_PRICE} RubyCoins\n🎁 Получено искр: ${sessionData.results.filter(r => r).length}\n⏱️ Хеш сессии: ${sparksHash}\n📅 Дата: ${new Date().toLocaleString('ru-RU')}\n\`\`\``,
                    inline: false
                },
                {
                    name: '🎯 ВСЕ ВАШИ НАГРАДЫ:',
                    value: sessionData.results.filter(r => r).map((r, i) => `${i + 1}. **${r.chosenSpark}**`).join('\n') || 'Нет данных',
                    inline: false
                },
                {
                    name: '🎉 Поздравления!',
                    value: 'Спасибо за игру! Надеемся, вам понравились полученные искры. Удачи в будущих приключениях!',
                    inline: false
                }
            );
        } else {
            summaryEmbed.addFields({
                name: '📊 Общая статистика',
                value: `\`\`\`\n🎰 Всего круток: ${totalSpins}\n💰 Потрачено: ${FIXED_PRICE} RubyCoins\n⏱️ Хеш сессии: ${sparksHash}\n📅 Дата: ${new Date().toLocaleString('ru-RU')}\n\`\`\``,
                inline: false
            });
        }

        summaryEmbed.addFields({
            name: '📝 Логирование',
            value: '✅ Все результаты автоматически записаны в лог канал для администрации',
            inline: false
        });

        const returnButton = new ButtonBuilder()
            .setCustomId(`return_shop_${userId}`)
            .setLabel('🛒 Вернуться в Донат')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(returnButton);

        try {
            await channel.send({
                content: `🎉 <@${userId}>, ВСЕ КРУТКИ ЗАВЕРШЕНЫ! Вот полный отчет о вашем приключении:`,
                embeds: [summaryEmbed],
                components: [row],
                allowedMentions: { users: [userId] }
            });

            debugLog('Финальные результаты показаны', { userId });
        } catch (error) {
            debugLog('Ошибка показа финальных результатов', {
                error: error.message,
                userId
            });
        }
    },

    async handleReturnToShop(interaction, db) {
        debugLog('Возврат в Донат', { userId: interaction.user.id });
        
        try {
            const userBalance = await db.getUserRubyCoins(interaction.user.id);

            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Донат RubyCoins')
                .setDescription(`💰 **Ваш текущий баланс:** ${userBalance.toFixed(2)} RubyCoins\n\n📦 **Добро пожаловать обратно в наш магазин!**\n\nВыберите товар из списка ниже для новых приключений:`)
                .setColor(0x9932CC)
                .addFields(
                    {
                        name: '✨ Набор Искр',
                        value: `**💰 Цена:** ${FIXED_PRICE} RubyCoins (фиксированная)\n**📝 Описание:** Получите от 1 до 4 круток с искрами!\n**🎯 Особенность:** Интерактивный выбор подарков\n**📊 Логирование:** Все результаты записываются в лог\n**⏰ Время:** Увеличенные задержки между крутками`,
                        inline: false
                    },
                    {
                        name: '👁️ Ролл Глаз',
                        value: `**💰 Цена:** 15.0 RubyCoins\n**📝 Описание:** Получите случайные глаза с интригой!\n**🎪 Особенность:** Захватывающая интрига с 4 альтернативами\n**📊 Логирование:** Все результаты записываются в лог\n**⏰ Время:** Длительная интрига 10+ секунд`,
                        inline: false
                    },
                    {
                        name: '📜 Контракт с Демоном',
                        value: `**💰 Цена:** 25.0 RubyCoins\n**📝 Описание:** Заключите контракт с демоном!\n**🎪 Особенность:** Демоническая интрига с альтернативами\n**📊 Логирование:** Все результаты записываются в лог\n**⏰ Время:** Мистическая интрига 10+ секунд`,
                        inline: false
                    }
                )
                .setFooter({ text: 'Выберите товар в меню ниже для покупки • Все покупки логируются • Улучшенная визуальная система' })
                .setTimestamp();

            const shopSelect = new StringSelectMenuBuilder()
                .setCustomId(`shop_select_${interaction.user.id}`)
                .setPlaceholder('🛒 Выберите товар для нового приключения...')
                .addOptions([
                    {
                        label: '✨ Набор Искр',
                        description: `Крутки с искрами (${FIXED_PRICE} RubyCoins фиксированная цена)`,
                        value: 'spark_pack',
                        emoji: '✨'
                    },
                    {
                        label: '👁️ Ролл Глаз',
                        description: 'Получить глаза с долгой интригой (15.0 RubyCoins)',
                        value: 'eyes_roll',
                        emoji: '👁️'
                    },
                    {
                        label: '📜 Контракт с Демоном',
                        description: 'Контракт с мистической интригой (25.0 RubyCoins)',
                        value: 'demon_contract',
                        emoji: '📜'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(shopSelect);

            await interaction.update({
                embeds: [shopEmbed],
                components: [row]
            });

            debugLog('Донат показан успешно');
        } catch (error) {
            debugLog('Ошибка возврата в Донат', {
                error: error.message,
                userId: interaction.user.id
            });
        }
    },

    // Обработка ввода количества в чате (только для искр)
    async handleQuantityInput(message) {
        const userId = message.author.id;
        const waitingData = awaitingQuantityInput.get(userId);
        
        debugLog('Обработка ввода количества', {
            userId,
            content: message.content,
            hasWaitingData: !!waitingData,
            channelMatch: waitingData?.channelId === message.channel.id
        });

        if (!waitingData || waitingData.channelId !== message.channel.id) {
            return false;
        }

        const quantity = parseInt(message.content.trim());
        if (isNaN(quantity) || quantity < 1 || quantity > 4) {
            await message.reply('❌ Пожалуйста, введите число от 1 до 4!');
            return true;
        }

        // Удаляем состояние ожидания
        awaitingQuantityInput.delete(userId);

        try {
            await message.delete().catch(() => {
                debugLog('Не удалось удалить сообщение пользователя');
            });
        } catch (error) {
            debugLog('Ошибка удаления сообщения', { error: error.message });
        }

        const Database = require('../database');
        const db = new Database();

        try {
            const userBalance = await db.getUserRubyCoins(userId);
            
            debugLog('Проверка баланса для покупки', {
                userId,
                quantity,
                fixedPrice: FIXED_PRICE,
                userBalance
            });

            if (userBalance < FIXED_PRICE) {
                await message.channel.send({
                    content: `❌ <@${userId}>, недостаточно средств! Нужно: ${FIXED_PRICE} RubyCoins, у вас: ${userBalance.toFixed(2)} RubyCoins`,
                    allowedMentions: { users: [userId] }
                });
                return true;
            }

            // Списываем ФИКСИРОВАННУЮ сумму
            await db.removeRubyCoins(userId, FIXED_PRICE);
            
            debugLog('Средства списаны успешно', {
                userId,
                fixedPrice: FIXED_PRICE,
                newBalance: userBalance - FIXED_PRICE
            });

            // Генерируем результаты для всех круток
            const allResults = [];
            for (let i = 0; i < quantity; i++) {
                allResults.push(getRandomSparks(5));
            }

            debugLog('Результаты круток сгенерированы', {
                userId,
                quantity,
                resultsCount: allResults.length
            });

            // Создаем первую страницу результатов
            await this.showSpinResults(message.channel, userId, allResults, 0, userBalance - FIXED_PRICE);

        } catch (error) {
            debugLog('Ошибка обработки покупки', {
                error: error.message,
                stack: error.stack,
                userId
            });
            await message.channel.send({
                content: `❌ <@${userId}>, произошла ошибка при обработке покупки!`,
                allowedMentions: { users: [userId] }
            });
        }

        return true;
    },

    async safeReply(interaction, options) {
        debugLog('Безопасный ответ', {
            replied: interaction.replied,
            deferred: interaction.deferred,
            userId: interaction.user.id
        });

        try {
            if (interaction.replied) {
                return await interaction.followUp(options);
            } else if (interaction.deferred) {
                return await interaction.editReply(options);
            } else {
                return await interaction.reply(options);
            }
        } catch (error) {
            debugLog('Ошибка безопасного ответа', {
                error: error.message,
                userId: interaction.user.id
            });
            try {
                if (interaction.channel) {
                    return await interaction.channel.send(options);
                }
            } catch (channelError) {
                debugLog('Критическая ошибка отправки сообщения', {
                    error: channelError.message
                });
            }
        }
    }
};
