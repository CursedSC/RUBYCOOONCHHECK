// commands/training/training-test.js

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('тест-тренировка')
        .setDescription('🧪 Команды для тестирования системы тренировок')
        .addSubcommand(subcommand =>
            subcommand
                .setName('быстрый-час')
                .setDescription('⚡ Запустить тренировку с часом = 10 секунд (для теста)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('сброс-кд')
                .setDescription('🔄 Сбросить кулдаун тренировки')
                .addUserOption(option =>
                    option
                        .setName('пользователь')
                        .setDescription('Пользователь для сброса')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('удалить-сессию')
                .setDescription('🗑️ Удалить активную сессию тренировки')
                .addUserOption(option =>
                    option
                        .setName('пользователь')
                        .setDescription('Пользователь для удаления')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('информация')
                .setDescription('📊 Получить информацию о тренировке пользователя')
                .addUserOption(option =>
                    option
                        .setName('пользователь')
                        .setDescription('Пользователь')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions('0') // Только разработчики/боты
        .setDMPermission(false),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const ownerId = '416602253160480769'; // Замени на свой ID

        // Проверка разработчика
        if (interaction.user.id !== ownerId) {
            return await interaction.reply({
                content: '❌ Эта команда доступна только разработчику!',
                flags: MessageFlags.Ephemeral
            });
        }

        const db = require('../database');
        const database = new db();

        if (subcommand === 'быстрый-час') {
            await handleFastHourTest(interaction, database);
        } else if (subcommand === 'сброс-кд') {
            await handleResetCooldown(interaction, database);
        } else if (subcommand === 'удалить-сессию') {
            await handleDeleteSession(interaction, database);
        } else if (subcommand === 'информация') {
            await handleTrainingInfo(interaction, database);
        }
    }
};







// ===== БЫСТРЫЙ ЧАС (10 секунд) =====
async function handleFastHourTest(interaction, database) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const TrainingHandler = require('../../interactions/trainingInteraction');
        const trainingHandler = new TrainingHandler();

        // Проверка активной сессии
        const activeSession = await database.getActiveTraining(interaction.user.id);
        if (activeSession) {
            return await interaction.editReply({
                content: `❌ У вас уже есть активная тренировка!\n<#${activeSession.channel_id}>`
            });
        }

        // Создаем быструю сессию
        const sessionId = await database.createTrainingSession({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            hours: 1,
            type: 'stats'
        });

        // Инициализируем данные в памяти
        trainingHandler.activeSessions.set(interaction.user.id, {
            sessionId: sessionId,
            type: 'stats',
            currentHour: 1,
            postsThisHour: 0,
            symbolsThisHour: 0,
            hourStartTime: Date.now(),
            hourOnCooldown: false,
            hours: 1
        });

        const testEmbed = new EmbedBuilder()
            .setTitle('🧪 ТЕСТОВАЯ ТРЕНИРОВКА')
            .setDescription(
                `**Параметры теста:**\n` +
                `⏱️ Длительность часа: **10 секунд**\n` +
                `📝 Требуется: **100 символов** (вместо 3200)\n` +
                `📋 Максимум постов: **4**\n` +
                `🎯 Тип: **Характеристики**\n\n` +
                `**ID сессии:** ${sessionId}\n\n` +
                `✅ Быстро напишите **100 символов** перед окончанием 10 секунд!`
            )
            .setColor('#00FFFF')
            .setTimestamp()
            .setFooter({ text: 'Режим тестирования' });

        await interaction.editReply({ embeds: [testEmbed] });

        // Публичное сообщение
        const publicEmbed = new EmbedBuilder()
            .setTitle('🧪 Тестовая тренировка началась!')
            .setDescription(
                `${interaction.user} запустил тестовый режим!\n\n` +
                `⏱️ Час = 10 секунд\n` +
                `📝 Квота = 100 символов\n` +
                `🎯 Тип: Характеристики`
            )
            .setColor('#00FFFF');

        await interaction.channel.send({ embeds: [publicEmbed] });

        // Запускаем таймер на 10 секунд вместо 1 часа
        const TEST_HOUR_MS = 10 * 1000; // 10 секунд
        const timerId = `${interaction.user.id}_${sessionId}_test`;

        const timeout = setTimeout(async () => {
            try {
                const sessionData = trainingHandler.activeSessions.get(interaction.user.id);

                // Если сессия не завершена
                if (sessionData && sessionData.sessionId === sessionId) {
                    await database.failTrainingSession(sessionId, 'test_timeout');
                    trainingHandler.activeSessions.delete(interaction.user.id);

                    const failEmbed = new EmbedBuilder()
                        .setTitle('❌ Тестовая тренировка провалена')
                        .setDescription(
                            `<@${interaction.user.id}>, 10 секунд истекли!\n\n` +
                            `📝 Вы написали: **${sessionData.symbolsThisHour}}** символов (требовалось 100)\n` +
                            `📋 Постов: **${sessionData.postsThisHour}}**`
                        )
                        .setColor('#FF0000')
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [failEmbed] });
                }
            } catch (error) {
                console.error('Ошибка тестового таймера:', error);
            }
        }, TEST_HOUR_MS);

        trainingHandler.hourTimers.set(timerId, timeout);

        // Уведомляем в ЛС
        try {
            await interaction.user.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🧪 Тестовая тренировка')
                        .setDescription(
                            `Быстрая тренировка запущена!\n\n` +
                            `⏱️ Осталось: **10 секунд**\n` +
                            `📝 Напишите: **100 символов**\n` +
                            `📋 Максимум: **4 поста**`
                        )
                        .setColor('#00FFFF')
                        .setTimestamp()
                ]
            });
        } catch (error) {
            console.log('Не удалось отправить ЛС:', error.message);
        }

    } catch (error) {
        console.error('Ошибка тестовой тренировки:', error);
        await interaction.editReply({
            content: `❌ Ошибка: ${error.message}`
        });
    }
}

// ===== СБРОС КУЛДАУНА =====
// ===== СБРОС КУЛДАУНА (ИСПРАВЛЕНО) =====
async function handleResetCooldown(interaction, database) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const targetUser = interaction.options.getUser('пользователь') || interaction.user;
        const userId = targetUser.id;

        // Сначала получаем ID последней завершенной сессии
        const lastSession = await new Promise((resolve, reject) => {
            const query = `
                SELECT id FROM trainingsystem_sessions 
                WHERE user_id = ? AND status = 'completed'
                ORDER BY completed_at DESC LIMIT 1
            `;
            database.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!lastSession) {
            return await interaction.editReply({
                content: `⚠️ Нет завершенных тренировок для ${targetUser}!\n\nКулдаун нечего сбрасывать.`
            });
        }

        // Теперь удаляем по конкретному ID
        await new Promise((resolve, reject) => {
            const query = `
                DELETE FROM trainingsystem_sessions 
                WHERE id = ?
            `;
            database.db.run(query, [lastSession.id], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Кулдаун сброшен')
            .setDescription(
                `**Пользователь:** ${targetUser}\n` +
                `**Удалена сессия:** \`${lastSession.id}\`\n` +
                `**Результат:** Кулдаун 24ч сброшен\n\n` +
                `✅ Пользователь может сразу начать новую тренировку!`
            )
            .setColor('#00FF00')
            .setTimestamp()
            .setFooter({ text: 'Команда разработчика' });

        await interaction.editReply({ embeds: [successEmbed] });

        // Логирование
        console.log(`🔄 Кулдаун сброшен для ${targetUser.tag} (${userId}) | Сессия ${lastSession.id}`);

        // Уведомляем целевого пользователя
        if (userId !== interaction.user.id) {
            try {
                const user = await interaction.client.users.fetch(userId);
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🔄 Ваш кулдаун тренировки сброшен!')
                            .setDescription(
                                `Разработчик сбросил ваш кулдаун тренировки.\n\n` +
                                `✅ Вы можете начать новую тренировку!`
                            )
                            .setColor('#00FF00')
                            .setTimestamp()
                    ]
                });
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Ошибка сброса кулдауна:', error);
        await interaction.editReply({
            content: `❌ Ошибка при сбросе кулдауна: ${error.message}`
        });
    }
}


// ===== УДАЛИТЬ АКТИВНУЮ СЕССИЮ =====
async function handleDeleteSession(interaction, database) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const targetUser = interaction.options.getUser('пользователь') || interaction.user;
        const userId = targetUser.id;

        // Получаем активную сессию
        const activeSession = await database.getActiveTraining(userId);

        if (!activeSession) {
            return await interaction.editReply({
                content: `❌ У пользователя ${targetUser} нет активной тренировки!`
            });
        }

        // Удаляем из памяти если есть
        const TrainingHandler = require('../../interactions/trainingInteraction');
        const trainingHandler = new TrainingHandler();
        
        if (trainingHandler.activeSessions.has(userId)) {
            trainingHandler.activeSessions.delete(userId);
        }

        // Обновляем статус в БД
        await new Promise((resolve, reject) => {
            const query = `
                UPDATE trainingsystem_sessions 
                SET status = 'cancelled' 
                WHERE id = ?
            `;
            database.db.run(query, [activeSession.id], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        const deleteEmbed = new EmbedBuilder()
            .setTitle('🗑️ Сессия удалена')
            .setDescription(
                `**Пользователь:** ${targetUser}\n` +
                `**ID сессии:** ${activeSession.id}\n` +
                `**Тип:** ${activeSession.training_type}\n` +
                `**Час:** ${activeSession.current_hour}/${activeSession.total_hours}\n\n` +
                `✅ Активная сессия удалена. Пользователь может начать новую.`
            )
            .setColor('#FF6600')
            .setTimestamp()
            .setFooter({ text: 'Команда разработчика' });

        await interaction.editReply({ embeds: [deleteEmbed] });

        // Логирование
        console.log(`🗑️ Сессия ${activeSession.id} удалена для ${targetUser.tag}`);

        // Уведомляем целевого пользователя
        if (userId !== interaction.user.id) {
            try {
                const user = await interaction.client.users.fetch(userId);
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🗑️ Ваша тренировка отменена')
                            .setDescription(
                                `Разработчик отменил вашу активную тренировку.\n\n` +
                                `📊 **Информация:**\n` +
                                `• Час: ${activeSession.current_hour}/${activeSession.total_hours}\n` +
                                `• Статус: Отменена\n\n` +
                                `✅ Вы можете начать новую!`
                            )
                            .setColor('#FF6600')
                            .setTimestamp()
                    ]
                });
            } catch (error) {
                console.log('Не удалось отправить уведомление пользователю:', error.message);
            }
        }

    } catch (error) {
        console.error('Ошибка удаления сессии:', error);
        await interaction.editReply({
            content: `❌ Ошибка при удалении сессии: ${error.message}`
        });
    }
}

// ===== ИНФОРМАЦИЯ О ТРЕНИРОВКЕ =====
async function handleTrainingInfo(interaction, database) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const targetUser = interaction.options.getUser('пользователь') || interaction.user;
        const userId = targetUser.id;

        // Получаем активную сессию
        const activeSession = await database.getActiveTraining(userId);

        // Получаем последнюю завершенную тренировку
        const lastCompleted = await new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM trainingsystem_sessions 
                WHERE user_id = ? AND status = 'completed'
                ORDER BY completed_at DESC LIMIT 1
            `;
            database.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Получаем кулдаун
        const cooldown = await database.checkTrainingCooldown(userId);

        const infoEmbed = new EmbedBuilder()
            .setTitle('📊 Информация о тренировке')
            .setDescription(`**Пользователь:** ${targetUser}\n**ID:** ${userId}`)
            .setColor('#00FFFF');

        // Активная сессия
        if (activeSession) {
            const posts = await new Promise((resolve, reject) => {
                database.db.all(
                    'SELECT * FROM trainingsystem_posts WHERE session_id = ?',
                    [activeSession.id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });

            const hourPosts = posts.filter(p => p.hour_number === activeSession.current_hour);
            const hourSymbols = hourPosts.reduce((sum, p) => sum + p.symbols_count, 0);

            infoEmbed.addFields(
                {
                    name: '🟢 АКТИВНАЯ СЕССИЯ',
                    value: `ID: \`${activeSession.id}\``,
                    inline: false
                },
                {
                    name: '🎯 Тип',
                    value: getTypeName(activeSession.training_type),
                    inline: true
                },
                {
                    name: '⏱️ Прогресс',
                    value: `${activeSession.current_hour}/${activeSession.total_hours} часов`,
                    inline: true
                },
                {
                    name: '📝 Текущий час',
                    value: `${hourSymbols}/3200 символов (${hourPosts.length}/4 постов)`,
                    inline: false
                },
                {
                    name: '📅 Начало',
                    value: `<t:${Math.floor(new Date(activeSession.start_time).getTime() / 1000)}:R>`,
                    inline: true
                }
            );
        } else {
            infoEmbed.addFields({
                name: '⚫ АКТИВНАЯ СЕССИЯ',
                value: 'Нет активной тренировки',
                inline: false
            });
        }

        // Последняя завершенная
        if (lastCompleted) {
            infoEmbed.addFields(
                {
                    name: '\n✅ ПОСЛЕДНЯЯ ЗАВЕРШЕННАЯ',
                    value: `ID: \`${lastCompleted.id}\``,
                    inline: false
                },
                {
                    name: '🎯 Тип',
                    value: getTypeName(lastCompleted.training_type),
                    inline: true
                },
                {
                    name: '⏱️ Длительность',
                    value: `${lastCompleted.total_hours}ч`,
                    inline: true
                },
                {
                    name: '📅 Завершено',
                    value: `<t:${Math.floor(new Date(lastCompleted.completed_at).getTime() / 1000)}:R>`,
                    inline: true
                }
            );

            // Кулдаун
            if (cooldown > 0) {
                infoEmbed.addFields({
                    name: '⏳ КУЛДАУН',
                    value: `**${cooldown}ч** до следующей тренировки`,
                    inline: false
                });
            } else {
                infoEmbed.addFields({
                    name: '✅ КУЛДАУН',
                    value: 'Кулдаун истек, можно начать новую!',
                    inline: false
                });
            }
        }

        await interaction.editReply({ embeds: [infoEmbed] });

    } catch (error) {
        console.error('Ошибка получения информации:', error);
        await interaction.editReply({
            content: `❌ Ошибка при получении информации: ${error.message}`
        });
    }
}

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ =====
function getTypeName(type) {
    const names = {
        'stats': '💪 Характеристики',
        'abilities': '✨ Способности',
        'willpower': '🧠 Воля',
        'martial_arts': '🥋 Боевое искусство'
    };
    return names[type] || type;
}
