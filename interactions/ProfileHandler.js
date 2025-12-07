const { EmbedBuilder } = require('discord.js');
const { handleCustomStylingMenu } = require('./customStylingHandler');

class ProfileHandler {
    constructor(client, db) {
        this.client = client;
        this.db = db;
        // Список заблокированных символов/слов
        this.blockedContent = [
            // Заблокированные символы
            '@everyone', '@here', 
            // Заблокированные слова (добавьте свои)
            'спам', 'реклама', 'мат',
            // Можете добавить больше
        ];
        console.log('✅ ProfileHandler инициализирован');
    }

    async handleMessage(message) {
        if (!message.guild) return false;
        if (message.author.bot || message.webhookId) return false;

        try {
            // Проверяем формат профиля (ключевое_слово: текст)
            const profileMatch = message.content.match(/^\s*(\w+)\s*:\s*([\s\S]+)/);
            if (!profileMatch) return false;

            const [, keyword, content] = profileMatch;

            // Ищем профиль в базе данных
            const profile = await this.db.getProfileByKeyword(message.author.id, keyword);
            if (!profile) return false;

            // Проверяем заблокированный контент
            if (this.hasBlockedContent(content)) {
                console.log(`🚫 Заблокированный контент от ${message.author.username}: ${content}`);
                // Удаляем сообщение и не отправляем через профиль
                await message.delete();
                return true;
            }

            // Проверяем права и тип канала
            if (!message.channel.isTextBased()) {
                console.log('Канал не является текстовым');
                return false;
            }

            const botMember = message.guild.members.cache.get(this.client.user.id);
            if (!botMember || !message.channel.permissionsFor(botMember).has('ManageWebhooks')) {
                console.log('Недостаточно прав для управления вебхуками');
                return false;
            }

            // Получаем или создаем вебхук
            let webhooks = await message.channel.fetchWebhooks();
            let webhook = webhooks.find(wh => wh.owner && wh.owner.id === this.client.user.id);

            if (!webhook) {
                webhook = await message.channel.createWebhook({
                    name: 'TuperWebhook',
                    avatar: this.client.user.displayAvatarURL(),
                });
            }

            // Формируем текст сообщения
            let messageContent = content;

            // Обрабатываем ответы на сообщения с гиперссылкой и пингом
            if (message.reference && message.reference.messageId) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    if (repliedMessage) {
                        const replyText = repliedMessage.content.length > 100
                            ? repliedMessage.content.substring(0, 100) + '...'
                            : repliedMessage.content;
                        
                        // Создаем гиперссылку на оригинальное сообщение
                        const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${repliedMessage.id}`;
                        
                        // Добавляем ответ в начало сообщения с пингом автора и ссылкой
                        messageContent = `↩️ **В ответ на** <@${repliedMessage.author.id}>: [Перейти к сообщению](${messageLink})\n> ${replyText}\n\n${messageContent}`;
                    }
                } catch (error) {
                    console.error('Ошибка получения оригинального сообщения:', error);
                }
            }

            // Обрабатываем вложения (картинки)
            const files = [];
            if (message.attachments.size > 0) {
                message.attachments.forEach(attachment => {
                    files.push(attachment);
                });
            }

            // ПРИМЕЧАНИЕ: Discord webhook не поддерживает кастомные эмодзи в username
            // Эмодзи будут отображаться в профиле персонажа через команду /профиль
            
            // Отправляем через вебхук как обычное сообщение
            await webhook.send({
                content: messageContent,
                username: profile.name,
                avatarURL: profile.avatar,
                files: files,
                allowedMentions: {
                    // Разрешаем упоминания пользователей (для ответов)
                    parse: ['users'],
                    users: message.reference ? [message.reference.messageId] : [],
                    roles: [],
                    repliedUser: true
                }
            });

            // Логируем сообщение для статистики
            // Примечание: character_id нужно добавить в user_profiles или связать с characters
            try {
                if (profile.id) {
                    // Пытаемся найти связанного персонажа по имени
                    const character = await this.db.getCharacterByName(message.author.id, profile.name);
                    if (character) {
                        await this.db.logCharacterMessage(
                            character.id, 
                            message.channel.id, 
                            content.length
                        );
                    }
                }
            } catch (logError) {
                // Игнорируем ошибки логирования
            }

            // Удаляем оригинальное сообщение
            await message.delete();
            return true;

        } catch (error) {
            console.error('Ошибка обработки профиля:', error);
            return false;
        }
    }

    // Проверка на заблокированный контент
    hasBlockedContent(content) {
        const lowerContent = content.toLowerCase();
        return this.blockedContent.some(blocked => {
            const lowerBlocked = blocked.toLowerCase();
            return lowerContent.includes(lowerBlocked);
        });
    }

    // Добавление заблокированного контента
    addBlockedContent(item) {
        if (!this.blockedContent.includes(item)) {
            this.blockedContent.push(item);
            console.log(`🚫 Добавлен заблокированный контент: ${item}`);
        }
    }

    // Удаление заблокированного контента
    removeBlockedContent(item) {
        const index = this.blockedContent.indexOf(item);
        if (index > -1) {
            this.blockedContent.splice(index, 1);
            console.log(`✅ Удален заблокированный контент: ${item}`);
        }
    }

    // Получение списка заблокированного контента
    getBlockedContent() {
        return [...this.blockedContent];
    }
}

module.exports = ProfileHandler;
