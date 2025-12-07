const Database = require('../database');

const db = new Database();

module.exports = {
    name: 'guildMemberRemove',
    async execute(member) {
        try {
            console.log(`👋 Пользователь ${member.user.username} покинул сервер ${member.guild.name}`);
            
            // Проверяем, был ли пользователь активным
            const wasActive = await db.isExistingUser(member.user.id, member.guild.id);
            
            const LOG_CHANNEL_ID = '1381454654440865934'; // Замените на ваш лог-канал
            const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
            
            if (logChannel) {
                const statusText = wasActive ? 
                    "Активный пользователь (5+ сообщений)" : 
                    "Неактивный пользователь";
                    
                await logChannel.send({
                    content: `📤 **Пользователь покинул сервер:** ${member.user.username} (${member.user.id})\n📊 **Статус:** ${statusText}`
                });
            }
            
            console.log(`📝 Отмечен уход пользователя ${member.user.username} (был ${wasActive ? 'активным' : 'неактивным'})`);
            
        } catch (error) {
            console.error('Ошибка обработки ухода пользователя:', error);
        }
    }
};
