const Database = require('../database');

const db = new Database();

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            console.log(`👋 Пользователь ${member.user.username} присоединился к серверу ${member.guild.name}`);
            
            // Проверяем, является ли пользователь "старым" (имеет активность)
            const isExistingUser = await db.isExistingUser(member.user.id, member.guild.id);
            
            if (isExistingUser) {
                console.log(`🔄 Пользователь ${member.user.username} уже был активен на сервере (5+ сообщений) - инвайт НЕ засчитывается`);
                
                // Можно добавить логирование или отправку в канал логов
                const LOG_CHANNEL_ID = '1381454654440865934'; // Замените на ваш лог-канал
                const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
                
                if (logChannel) {
                    await logChannel.send({
                        content: `🔄 **Возвратившийся пользователь:** ${member.user.username} (${member.user.id})\n📊 **Статус:** Инвайт не засчитан (пользователь имел активность на сервере)`
                    });
                }
                
                return;
            }
            
            console.log(`✅ Пользователь ${member.user.username} новый - инвайт ЗАСЧИТЫВАЕТСЯ`);
            
            // Можно добавить логирование нового пользователя
            const LOG_CHANNEL_ID = '1381454654440865934'; // Замените на ваш лог-канал
            const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
            
            if (logChannel) {
                const accountAge = Math.floor((new Date() - member.user.createdAt) / (1000 * 60 * 60 * 24));
                
                await logChannel.send({
                    content: `👋 **Новый пользователь:** ${member.user.username} (${member.user.id})\n📊 **Статус:** Инвайт засчитан\n📅 **Возраст аккаунта:** ${accountAge} дней`
                });
            }
            
        } catch (error) {
            console.error('Ошибка обработки присоединения пользователя:', error);
        }
    }
};
