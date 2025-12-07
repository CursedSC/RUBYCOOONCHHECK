const { ChannelType } = require('discord.js');

const CURATOR_ROLE_ID = '1382005661369368586';
const TICKET_CATEGORY_ID = '1398570943533678736'; // ID категории тикетов

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Игнорируем сообщения от ботов
        if (message.author.bot) return;

        // Проверяем, что сообщение в канале тикета
        if (!message.channel.parent || message.channel.parent.id !== TICKET_CATEGORY_ID) return;
        
        // Проверяем, что это текстовый канал
        if (message.channel.type !== ChannelType.GuildText) return;

        // Проверяем упоминание роли кураторов
        const roleMention = `<@&${CURATOR_ROLE_ID}>`;
        if (message.content.includes(roleMention)) {
            try {
                // Получаем текущие права роли для канала
                const currentPermissions = message.channel.permissionOverwrites.cache.get(CURATOR_ROLE_ID);
                
                // Если роль еще не имеет доступа к каналу, предоставляем его
                if (!currentPermissions || !currentPermissions.allow.has('ViewChannel')) {
                    await message.channel.permissionOverwrites.edit(CURATOR_ROLE_ID, {
                        ViewChannel: true,
                        ReadMessageHistory: true,
                        SendMessages: true,
                        AttachFiles: true
                    });

                    console.log(`🔓 Канал тикета ${message.channel.name} раскрыт для роли ${CURATOR_ROLE_ID}`);

                    // Отправляем уведомление
                    const { EmbedBuilder } = require('discord.js');
                    const revealEmbed = new EmbedBuilder()
                        .setTitle('🔓 Канал раскрыт для кураторов')
                        .setDescription(`Канал стал видимым для всех кураторов из-за упоминания <@&${CURATOR_ROLE_ID}>`)
                        .setColor(0xffa500)
                        .setTimestamp();

                    await message.channel.send({ embeds: [revealEmbed] });
                }
            } catch (error) {
                console.error('Ошибка при раскрытии канала тикета:', error);
            }
        }
    }
};
