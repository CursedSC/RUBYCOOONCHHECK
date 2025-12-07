const { EmbedBuilder } = require('discord.js');
const Database = require('../database');

const db = new Database();

const TECHNICAL_CHANNEL_ID = '1381454654440865934'; // ID технического канала

// Типы действий с тикетами
const TICKET_ACTION_TYPES = {
    TICKET_CREATED: 'TICKET_CREATED',
    TICKET_TAKEN: 'TICKET_TAKEN',
    TICKET_COMPLETED: 'TICKET_COMPLETED',
    TICKET_CLOSED: 'TICKET_CLOSED',
    TICKET_STATUS_CHANGED: 'TICKET_STATUS_CHANGED',
    TICKET_CURATOR_CHANGED: 'TICKET_CURATOR_CHANGED',
    TICKET_PARTICIPANTS_UPDATED: 'TICKET_PARTICIPANTS_UPDATED',
    COOLDOWN_RESET: 'COOLDOWN_RESET',
    TICKET_EXPANDED_FOR_ADMINS: 'ticket_expanded_for_admins'
};

// Эмоджи для типов действий
const ACTION_EMOJIS = {
    TICKET_CREATED: '🆕',
    TICKET_TAKEN: '✋',
    TICKET_COMPLETED: '✅',
    TICKET_CLOSED: '🔒',
    TICKET_STATUS_CHANGED: '🔄',
    TICKET_CURATOR_CHANGED: '👨‍💼',
    TICKET_PARTICIPANTS_UPDATED: '👥',
    COOLDOWN_RESET: '⏰'
};

// Цвета для типов действий
const ACTION_COLORS = {
    TICKET_CREATED: 0x00ff00,
    TICKET_TAKEN: 0x3498db,
    TICKET_COMPLETED: 0x32cd32,
    TICKET_CLOSED: 0x666666,
    TICKET_STATUS_CHANGED: 0xffa500,
    TICKET_CURATOR_CHANGED: 0x9b59b6,
    TICKET_PARTICIPANTS_UPDATED: 0xe67e22,
    COOLDOWN_RESET: 0xff6b6b
};

class TicketLogger {
    static async logTicketAction(client, logData) {
        try {
            // Сохраняем в базу данных
            await db.addTicketLog({
                admin_id: logData.admin_id,
                action_type: logData.action_type,
                ticket_number: logData.ticket_number,
                target_user_id: logData.target_user_id,
                details: JSON.stringify(logData.details),
                success: logData.success,
                channel_id: logData.channel_id,
                guild_id: logData.guild_id
            });

            // Отправляем в технический канал
            await this.sendToTechnicalChannel(client, logData);

        } catch (error) {
            console.error('❌ Ошибка логирования действия с тикетом:', error);
        }
    }

    static async sendToTechnicalChannel(client, logData) {
        try {
            const technicalChannel = client.channels.cache.get(TECHNICAL_CHANNEL_ID);
            if (!technicalChannel) {
                console.error('❌ Технический канал не найден:', TECHNICAL_CHANNEL_ID);
                return;
            }

            const actionEmoji = ACTION_EMOJIS[logData.action_type] || '📋';
            const actionColor = ACTION_COLORS[logData.action_type] || 0x3498db;

            const embed = new EmbedBuilder()
                .setTitle(`${actionEmoji} ${this.getActionTitle(logData.action_type)}`)
                .setDescription(this.formatLogDescription(logData))
                .setColor(actionColor)
                .addFields(
                    { name: '👨‍💼 Администратор', value: `<@${logData.admin_id}>`, inline: true },
                    { name: '🎫 Тикет', value: logData.ticket_number ? `#${logData.ticket_number}` : 'Не указан', inline: true },
                    { name: '✅ Статус', value: logData.success !== false ? 'Успешно' : 'Ошибка', inline: true }
                )
                .setTimestamp()
                .setFooter({ 
                    text: `ID админа: ${logData.admin_id} | Сервер: ${logData.guild_id || 'N/A'}` 
                });

            if (logData.target_user_id) {
                embed.addFields({ 
                    name: '👤 Пользователь', 
                    value: `<@${logData.target_user_id}>`, 
                    inline: true 
                });
            }

            if (logData.channel_id) {
                embed.addFields({ 
                    name: '📍 Канал', 
                    value: `<#${logData.channel_id}>`, 
                    inline: true 
                });
            }

            if (logData.details) {
                const detailsText = this.formatDetails(logData.details);
                if (detailsText.length > 0) {
                    embed.addFields({ 
                        name: '📝 Детали', 
                        value: detailsText, 
                        inline: false 
                    });
                }
            }

            await technicalChannel.send({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Ошибка отправки лога в технический канал:', error);
        }
    }

    static getActionTitle(actionType) {
        const titles = {
            TICKET_CREATED: 'Создан новый тикет',
            TICKET_TAKEN: 'Тикет взят в работу',
            TICKET_COMPLETED: 'Тикет завершен',
            TICKET_CLOSED: 'Тикет закрыт',
            TICKET_STATUS_CHANGED: 'Изменен статус тикета',
            TICKET_CURATOR_CHANGED: 'Изменен куратор тикета',
            TICKET_PARTICIPANTS_UPDATED: 'Обновлены участники тикета',
            COOLDOWN_RESET: 'Сброшен кулдаун тикета'
        };
        return titles[actionType] || 'Действие с тикетом';
    }

    static formatLogDescription(logData) {
        const descriptions = {
            TICKET_CREATED: `Создан тикет #${logData.ticket_number} пользователем <@${logData.details?.creator_id || logData.target_user_id}>`,
            TICKET_TAKEN: `Куратор <@${logData.admin_id}> взял тикет #${logData.ticket_number}`,
            TICKET_COMPLETED: `Завершен тикет #${logData.ticket_number} куратором <@${logData.admin_id}>`,
            TICKET_CLOSED: `Закрыт тикет #${logData.ticket_number} администратором <@${logData.admin_id}>`,
            TICKET_STATUS_CHANGED: `Статус тикета #${logData.ticket_number} изменен на "${logData.details?.new_status}"`,
            TICKET_CURATOR_CHANGED: `Куратор тикета #${logData.ticket_number} изменен`,
            TICKET_PARTICIPANTS_UPDATED: `Обновлены участники тикета #${logData.ticket_number}`,
            COOLDOWN_RESET: `Сброшен кулдаун пользователя <@${logData.target_user_id}>`
        };
        return descriptions[logData.action_type] || 'Выполнено действие с тикетом';
    }

    static formatDetails(details) {
        if (typeof details === 'string') {
            try {
                details = JSON.parse(details);
            } catch {
                return details.length > 500 ? details.substring(0, 497) + '...' : details;
            }
        }

        if (!details || typeof details !== 'object') {
            return '';
        }

        const formatted = [];
        
        if (details.old_status && details.new_status) {
            formatted.push(`**Статус:** ${details.old_status} → ${details.new_status}`);
        }
        
        if (details.old_curator && details.new_curator) {
            formatted.push(`**Куратор:** <@${details.old_curator}> → <@${details.new_curator}>`);
        }
        
        if (details.purpose) {
            const shortPurpose = details.purpose.length > 100 ? details.purpose.substring(0, 97) + '...' : details.purpose;
            formatted.push(`**Цель:** ${shortPurpose}`);
        }
        
        if (details.character_count) {
            formatted.push(`**Персонажей:** ${details.character_count}`);
        }
        
        if (details.participants_count) {
            formatted.push(`**Участников:** ${details.participants_count}`);
        }
        
        if (details.completion_notes) {
            const shortNotes = details.completion_notes.length > 100 ? details.completion_notes.substring(0, 97) + '...' : details.completion_notes;
            formatted.push(`**Заметки:** ${shortNotes}`);
        }

        return formatted.join('\n').substring(0, 1000);
    }
}

module.exports = { TicketLogger, TICKET_ACTION_TYPES };
