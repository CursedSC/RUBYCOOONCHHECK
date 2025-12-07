const { MessageFlags, EmbedBuilder } = require('discord.js');
const Database = require('../database');
const fs = require('fs');
const path = require('path');

class InteractionHandler {
    constructor(client) {
        this.client = client;
        this.db = new Database();
        this.processedInteractions = new Set();
        this.interactionTimeouts = new Map();
        
        // Очищаем старые взаимодействия каждые 2 минуты
        setInterval(() => {
            this.cleanupOldInteractions();
        }, 2 * 60 * 1000);
    }

    // Основной метод обработки всех взаимодействий
    async handleInteraction(interaction) {
        try {
            // Проверяем валидность взаимодействия
            if (!this.isValidInteraction(interaction)) {
                console.log(`⚠️ Взаимодействие ${interaction.id} невалидно или уже обработано`);
                return;
            }

            // Отмечаем взаимодействие как обрабатываемое
            this.markInteractionAsProcessing(interaction);

            // Маршрутизируем взаимодействие к соответствующему обработчику
            if (interaction.isChatInputCommand()) {
                await this.handleSlashCommand(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }

        } catch (error) {
            console.error('❌ Критическая ошибка обработки взаимодействия:', error);
            await this.handleError(interaction, error);
        } finally {
            // Убираем взаимодействие из обработки через 10 минут
            setTimeout(() => {
                this.processedInteractions.delete(interaction.id);
                this.interactionTimeouts.delete(interaction.id);
            }, 10 * 60 * 1000);
        }
    }

    // Проверка валидности взаимодействия
    isValidInteraction(interaction) {
        // Проверяем, не обработано ли уже
        if (this.processedInteractions.has(interaction.id)) {
            return false;
        }

        // Проверяем состояние взаимодействия
        if (interaction.replied || interaction.deferred) {
            console.log(`⚠️ Взаимодействие ${interaction.id} уже отвечено или отложено`);
            return false;
        }

        // Проверяем возраст взаимодействия (Discord взаимодействия истекают через 15 минут)
        const interactionAge = Date.now() - interaction.createdTimestamp;
        if (interactionAge > 13 * 60 * 1000) { // 13 минут для безопасности
            console.log(`⚠️ Взаимодействие ${interaction.id} слишком старое: ${Math.floor(interactionAge / 1000)}с`);
            return false;
        }

        return true;
    }

    // Отмечаем взаимодействие как обрабатываемое
    markInteractionAsProcessing(interaction) {
        this.processedInteractions.add(interaction.id);
        this.interactionTimeouts.set(interaction.id, Date.now());
    }

    // Безопасная отправка ответа
    async safeReply(interaction, options) {
        try {
            // Проверяем состояние взаимодействия перед отправкой
            if (interaction.replied) {
                return await interaction.followUp(options);
            } else if (interaction.deferred) {
                return await interaction.editReply(options);
            } else {
                return await interaction.reply(options);
            }
        } catch (error) {
            if (error.code === 10062) { // Unknown interaction
                console.log(`⚠️ Взаимодействие ${interaction.id} истекло, пропускаем ответ`);
                return null;
            }
            if (error.code === 40060) { // Interaction already acknowledged
                console.log(`⚠️ Взаимодействие ${interaction.id} уже подтверждено`);
                try {
                    return await interaction.followUp(options);
                } catch (followUpError) {
                    console.log(`⚠️ Не удалось отправить followUp для ${interaction.id}`);
                    return null;
                }
            }
            throw error;
        }
    }

    // Безопасное обновление
    async safeUpdate(interaction, options) {
        try {
            // Проверяем состояние взаимодействия перед обновлением
            if (interaction.replied || interaction.deferred) {
                return await interaction.editReply(options);
            } else {
                return await interaction.update(options);
            }
        } catch (error) {
            if (error.code === 10062) { // Unknown interaction
                console.log(`⚠️ Взаимодействие ${interaction.id} истекло, пропускаем обновление`);
                return null;
            }
            if (error.code === 40060) { // Interaction already acknowledged
                console.log(`⚠️ Взаимодействие ${interaction.id} уже подтверждено, используем editReply`);
                try {
                    return await interaction.editReply(options);
                } catch (editError) {
                    console.log(`⚠️ Не удалось обновить ${interaction.id}`);
                    return null;
                }
            }
            throw error;
        }
    }

    // Обработка slash команд
    async handleSlashCommand(interaction) {
        const command = this.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`❌ Команда ${interaction.commandName} не найдена`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`❌ Ошибка команды ${interaction.commandName}:`, error);
            await this.safeReply(interaction, {
                content: 'Произошла ошибка при выполнении команды!',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    // Обработка кнопок
    async handleButtonInteraction(interaction) {
        await this.loadSpecializedHandler(interaction, 'button');
    }

    // Обработка select меню
    async handleSelectMenuInteraction(interaction) {
        await this.loadSpecializedHandler(interaction, 'select');
    }

    // Обработка модальных окон
    async handleModalSubmit(interaction) {
        await this.loadSpecializedHandler(interaction, 'modal');
    }

    // Динамическая загрузка и выполнение обработчиков
    async loadSpecializedHandler(interaction, type) {
        const interactionsPath = path.join(__dirname, '..', 'interactions');
        
        if (!fs.existsSync(interactionsPath)) {
            console.log('⚠️ Папка interactions не найдена');
            return;
        }

        const handlerFiles = fs.readdirSync(interactionsPath)
            .filter(file => file.endsWith('.js'));

        for (const file of handlerFiles) {
            try {
                const handlerPath = path.join(interactionsPath, file);
                
                // Очищаем кэш для горячей перезагрузки
                delete require.cache[require.resolve(handlerPath)];
                
                const handler = require(handlerPath);
                
                // Проверяем, может ли обработчик обработать это взаимодействие
                if (handler.canHandle && handler.canHandle(interaction)) {
                    await handler.execute(interaction);
                    return; // Выходим после первого успешного обработчика
                }
            } catch (error) {
                console.error(`❌ Ошибка в обработчике ${file}:`, error);
            }
        }

        console.log(`⚠️ Обработчик не найден для: ${interaction.customId || interaction.commandName}`);
    }

    // Обработка ошибок
    async handleError(interaction, error) {
        console.error('❌ Обработка ошибки взаимодействия:', error);
        
        try {
            await this.safeReply(interaction, {
                content: 'Произошла неожиданная ошибка при обработке взаимодействия!',
                flags: MessageFlags.Ephemeral
            });
        } catch (replyError) {
            console.error('❌ Не удалось отправить сообщение об ошибке:', replyError);
        }
    }

    // Очистка старых взаимодействий
    cleanupOldInteractions() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 минут

        let cleanedCount = 0;
        for (const [interactionId, timestamp] of this.interactionTimeouts.entries()) {
            if (now - timestamp > maxAge) {
                this.processedInteractions.delete(interactionId);
                this.interactionTimeouts.delete(interactionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 Очищено ${cleanedCount} старых взаимодействий`);
        }
    }
}

module.exports = InteractionHandler;
