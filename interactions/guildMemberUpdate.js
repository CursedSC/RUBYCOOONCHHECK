const Database = require('../database');
const { EmbedBuilder, ChannelType } = require('discord.js');

const db = new Database();
const CURATOR_ROLE_ID = '1382005661369368586';
const ADMIN_ROLES = ['1382006178451685377', '1382006799028322324'];

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        try {
            // Проверяем изменения ролей
            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;
            
            const hadStaffRole = oldRoles.has(CURATOR_ROLE_ID) || 
                                ADMIN_ROLES.some(roleId => oldRoles.has(roleId));
            const hasStaffRole = newRoles.has(CURATOR_ROLE_ID) || 
                                ADMIN_ROLES.some(roleId => newRoles.has(roleId));
            
            // Если потерял роль состава
            if (hadStaffRole && !hasStaffRole) {
                console.log(`👤 Пользователь ${newMember.user.username} потерял роль состава`);
                await handleStaffRoleRemoval(newMember);
            }
        } catch (error) {
            console.error('Ошибка в guildMemberUpdate:', error);
        }
    }
};

async function handleStaffRoleRemoval(member) {
    try {
        // Получаем все тикеты, где пользователь является куратором
        const curatorTickets = await db.getTicketsByCurator(member.id);
        
        if (curatorTickets.length === 0) {
            return;
        }
        
        console.log(`🔄 Найдено ${curatorTickets.length} тикетов для снятия куратора ${member.user.username}`);
        
        for (const ticket of curatorTickets) {
            try {
                // Снимаем куратора с тикета
                await db.removeCurator(ticket.ticket_number);
                
                // Работаем с каналом
                const ticketChannel = member.guild.channels.cache.get(ticket.channel_id);
                if (ticketChannel && ticketChannel.type === ChannelType.GuildText) {
                    // Убираем права доступа
                    try {
                        await ticketChannel.permissionOverwrites.delete(member.id);
                    } catch (permError) {
                        console.log(`Не удалось убрать права доступа: ${permError.message}`);
                    }
                    
                    // Уведомляем в канале
                    const removalEmbed = new EmbedBuilder()
                        .setTitle('⚠️ Куратор автоматически снят')
                        .setDescription(`Куратор ${member.user.username} потерял роль состава и был автоматически снят с тикета #${ticket.ticket_number}`)
                        .addFields(
                            { name: '📋 Статус', value: 'Ожидает нового куратора', inline: true },
                            { name: '⏰ Время снятия', value: new Date().toLocaleString('ru-RU'), inline: true }
                        )
                        .setColor(0xffa500)
                        .setTimestamp();
                    
                    await ticketChannel.send({
                        content: `🔔 <@${ticket.creator_id}>, ваш тикет снова ожидает куратора.`,
                        embeds: [removalEmbed]
                    });
                }
                
                console.log(`✅ Куратор ${member.user.username} снят с тикета #${ticket.ticket_number}`);
            } catch (ticketError) {
                console.error(`Ошибка снятия куратора с тикета #${ticket.ticket_number}:`, ticketError);
            }
        }
    } catch (error) {
        console.error('Ошибка обработки снятия роли состава:', error);
    }
}
