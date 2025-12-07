const Database = require('../database');

const db = new Database();

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ Инициализация системы отслеживания приглашений...`);
        
        try {
            // Инициализируем таблицы для приглашений
            db.initInviteTrackTable();
            
            // Для каждого сервера создаем начальный снимок приглашений
            for (const guild of client.guilds.cache.values()) {
                try {
                    const invites = await guild.invites.fetch();
                    const inviteData = Array.from(invites.values()).map(invite => ({
                        code: invite.code,
                        inviterId: invite.inviterId,
                        uses: invite.uses,
                        maxUses: invite.maxUses
                    }));
                    
                    await db.saveInviteSnapshot(guild.id, inviteData);
                    console.log(`📸 Создан снимок ${inviteData.length} приглашений для сервера ${guild.name}`);
                } catch (error) {
                    console.error(`Ошибка создания снимка приглашений для ${guild.name}:`, error);
                }
            }
            
            console.log(`✅ Система отслеживания приглашений инициализирована`);
        } catch (error) {
            console.error('Ошибка инициализации системы приглашений:', error);
        }
    }
};
