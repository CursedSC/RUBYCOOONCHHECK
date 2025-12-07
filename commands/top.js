const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('топ')
        .setDescription('Показать топ персонажей по силе'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Получаем всех персонажей с их статами
            const allCharacters = await db.getAllCharactersWithStats();
            
            if (allCharacters.length === 0) {
                return await interaction.editReply({
                    content: 'Персонажи не найдены!'
                });
            }

            // Настройки пагинации
            const charactersPerPage = 15;
            const totalPages = Math.ceil(allCharacters.length / charactersPerPage);
            const currentPage = 1;

            // Получаем персонажей для первой страницы
            const pageCharacters = allCharacters.slice(0, charactersPerPage);

            // Находим позицию персонажей пользователя в общем топе
            const userPosition = this.findUserPosition(allCharacters, interaction.user.id);

            // Находим сильнейшего персонажа на текущей странице
            const strongestOnPage = pageCharacters[0]; // Первый персонаж на странице - самый сильный

            // Создаем embed с топом
            const embed = await this.createTopEmbed(pageCharacters, currentPage, totalPages, allCharacters.length, userPosition, allCharacters[0], strongestOnPage);

            // Создаем dropdown для навигации по страницам
            const components = totalPages > 1 ? [this.createPageSelector(totalPages, currentPage)] : [];

            await interaction.editReply({
                embeds: [embed],
                components: components
            });

        } catch (error) {
            console.error('Ошибка создания топа:', error);
            await interaction.editReply({
                content: 'Произошла ошибка при создании топа персонажей!'
            });
        }
    },

    findUserPosition(allCharacters, userId) {
        const userCharacters = allCharacters.filter(char => char.user_id === userId);
        if (userCharacters.length === 0) return null;

        // Находим лучшего персонажа пользователя
        const bestCharacter = userCharacters[0]; // Уже отсортированы по убыванию
        const position = allCharacters.findIndex(char => char.id === bestCharacter.id) + 1;
        
        return {
            position: position,
            character: bestCharacter,
            totalUserCharacters: userCharacters.length
        };
    },

    createTopEmbed(characters, currentPage, totalPages, totalCharacters, userPosition, topCharacter, strongestOnPage) {
        const startIndex = (currentPage - 1) * 15;
        
        let description = `**🏆 Топ персонажей по силе**\n`;
        description += `Страница ${currentPage} из ${totalPages} • Всего персонажей: ${totalCharacters}\n\n`;

        characters.forEach((char, index) => {
            const position = startIndex + index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;
            
            // Добавляем эмодзи короны для топ-1
            const crownEmoji = position === 1 ? ' 👑' : '';
            
            description += `${medal} **ID:** ${char.id} / **${char.name}**${crownEmoji} / **${char.total_stats.toLocaleString()}** 🔱\n`;
        });

        // Добавляем разделитель и информацию о позиции пользователя
        if (userPosition) {
            description += `\n═══════════════════════════\n`;
            description += `**📍 Ваша позиция в топе:**\n`;
            description += `🎯 **${userPosition.position} место** - **${userPosition.character.name}** (${userPosition.character.total_stats.toLocaleString()} 🔱)\n`;
            if (userPosition.totalUserCharacters > 1) {
                description += `📊 У вас ${userPosition.totalUserCharacters} персонажей в топе\n`;
            }
        } else {
            description += `\n═══════════════════════════\n`;
            description += `**📍 У вас пока нет персонажей в топе**\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 Топ персонажей по силе')
            .setDescription(description)
            .setColor(0xFFD700)
            .setTimestamp()
            .setFooter({
                text: `Страница ${currentPage}/${totalPages} • Обновлено`,
                iconURL: 'https://cdn.discordapp.com/emojis/741243929760301086.png'
            });

        // Устанавливаем изображение топ-1 персонажа если есть (thumbnail)
        if (topCharacter && topCharacter.avatar_url) {
            embed.setThumbnail(topCharacter.avatar_url);
            embed.addFields({
                name: '👑 Лидер топа',
                value: `**${topCharacter.name}** с силой **${topCharacter.total_stats.toLocaleString()}** 🔱`,
                inline: false
            });
        }

        // Устанавливаем изображение сильнейшего персонажа на текущей странице (основное изображение)
        if (strongestOnPage && strongestOnPage.avatar_url) {
            embed.setImage(strongestOnPage.avatar_url);
            
            // Добавляем информацию о сильнейшем на странице если это не топ-1
            if (strongestOnPage.id !== topCharacter?.id) {
                embed.addFields({
                    name: `⭐ Сильнейший на странице ${currentPage}`,
                    value: `**${strongestOnPage.name}** с силой **${strongestOnPage.total_stats.toLocaleString()}** 🔱`,
                    inline: false
                });
            }
        }

        return embed;
    },

    createPageSelector(totalPages, currentPage) {
        const pageSelect = new StringSelectMenuBuilder()
            .setCustomId('top_page_select')
            .setPlaceholder(`📄 Страница ${currentPage} из ${totalPages}`)
            .addOptions(
                Array.from({ length: Math.min(totalPages, 25) }, (_, i) => {
                    const pageNum = i + 1;
                    const startIndex = i * 15;
                    const endIndex = Math.min(startIndex + 15, totalPages * 15);
                    
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(`Страница ${pageNum}`)
                        .setDescription(`Места ${startIndex + 1}-${Math.min(endIndex, totalPages * 15)} (${Math.min(15, totalPages * 15 - startIndex)} персонажей)`)
                        .setValue(`page_${pageNum}`)
                        .setEmoji(pageNum === currentPage ? '📍' : '📄')
                        .setDefault(pageNum === currentPage);
                })
            );

        return new ActionRowBuilder().addComponents(pageSelect);
    }
};
