const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const CUSTOM_EMOJIS = {
    CURATOR: '<:chief:1396827256596467742>',
    USER: '<:user:1396827248098545726>',
    SUCCESS: '✅',
    INFO: 'ℹ️',
    TICKET_OCCUPIED: '<:Lock:1396817745399644270>'
};

class TicketNotifications {
    static async handleTicketMessage(message, ticket) {
        if (!ticket || !message || message.author.bot) return;
        
        try {
            const isCurator = ticket.curator_id === message.author.id;
            const isParticipant = this.isUserParticipant(message.author.id, ticket);
            
            if (!isCurator && !isParticipant) return;

            if (isCurator) {
                await this.notifyParticipants(message, ticket);
            } else if (isParticipant) {
                await this.notifyCurator(message, ticket);
            }
        } catch (error) {
            console.error('Ошибка отправки уведомления:', error);
        }
    }

    static isUserParticipant(userId, ticket) {
        if (ticket.creator_id === userId) return true;
        
        if (ticket.participants) {
            const participantIds = ticket.participants.split(',').map(id => id.trim()).filter(id => id);
            return participantIds.includes(userId);
        }
        
        return false;
    }

    static async notifyParticipants(message, ticket) {
        const participantIds = this.getParticipantIds(ticket);
        const channelUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
        
        for (const participantId of participantIds) {
            try {
                const participant = await message.guild.members.fetch(participantId);
                if (!participant) continue;

                const embed = new EmbedBuilder()
                    .setTitle(`${CUSTOM_EMOJIS.CURATOR} Новое сообщение от куратора`)
                    .setDescription(`**Тикет #${ticket.ticket_number}**\n\nКуратор написал новое сообщение в вашем тикете`)
                    .addFields(
                        { name: `${CUSTOM_EMOJIS.CURATOR} Куратор`, value: `<@${message.author.id}>`, inline: true },
                        { name: `${CUSTOM_EMOJIS.INFO} Тикет`, value: `#${ticket.ticket_number}`, inline: true },
                        { name: '💬 Сообщение', value: this.formatMessage(message.content), inline: false }
                    )
                    .setColor(0x3498db)
                    .setTimestamp()
                    .setFooter({ text: 'Система уведомлений тикетов' });

                const goToButton = new ButtonBuilder()
                    .setLabel('Перейти к сообщению')
                    .setStyle(ButtonStyle.Link)
                    .setURL(channelUrl)
                    .setEmoji('🔗');

                const row = new ActionRowBuilder().addComponents(goToButton);

                await participant.send({
                    embeds: [embed],
                    components: [row]
                });

                console.log(`✅ Уведомление отправлено участнику ${participantId} (тикет #${ticket.ticket_number})`);
            } catch (error) {
                console.log(`❌ Не удалось отправить уведомление участнику ${participantId}:`, error.message);
            }
        }
    }

    static async notifyCurator(message, ticket) {
        if (!ticket.curator_id) return;

        try {
            const curator = await message.guild.members.fetch(ticket.curator_id);
            if (!curator) return;

            const channelUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;

            const embed = new EmbedBuilder()
                .setTitle(`${CUSTOM_EMOJIS.USER} Новое сообщение от участника`)
                .setDescription(`**Тикет #${ticket.ticket_number}**\n\nПользователь написал новое сообщение в тикете`)
                .addFields(
                    { name: `${CUSTOM_EMOJIS.USER} Отправитель`, value: `<@${message.author.id}>`, inline: true },
                    { name: `${CUSTOM_EMOJIS.INFO} Тикет`, value: `#${ticket.ticket_number}`, inline: true },
                    { name: '💬 Сообщение', value: this.formatMessage(message.content), inline: false }
                )
                .setColor(0xe74c3c)
                .setTimestamp()
                .setFooter({ text: 'Система уведомлений тикетов' });

            const goToButton = new ButtonBuilder()
                .setLabel('Перейти к сообщению')
                .setStyle(ButtonStyle.Link)
                .setURL(channelUrl)
                .setEmoji('🔗');

            const row = new ActionRowBuilder().addComponents(goToButton);

            await curator.send({
                embeds: [embed],
                components: [row]
            });

            console.log(`✅ Уведомление отправлено куратору ${ticket.curator_id} (тикет #${ticket.ticket_number})`);
        } catch (error) {
            console.log(`❌ Не удалось отправить уведомление куратору ${ticket.curator_id}:`, error.message);
        }
    }

    static getParticipantIds(ticket) {
        const ids = [ticket.creator_id];
        
        if (ticket.participants) {
            const participantIds = ticket.participants.split(',')
                .map(id => id.trim())
                .filter(id => id && id !== ticket.creator_id);
            ids.push(...participantIds);
        }
        
        return [...new Set(ids)];
    }

    static formatMessage(content) {
        if (!content) return 'Сообщение без текста';
        if (content.length > 200) {
            return content.substring(0, 197) + '...';
        }
        return content;
    }
}

module.exports = TicketNotifications;
