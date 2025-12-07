const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database');

const db = new Database();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('инвайт')
        .setDescription('Показать статистику приглашений пользователя')
        .addUserOption(option =>
            option
                .setName('пользователь')
                .setDescription('Пользователь для просмотра статистики')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('пользователь') || interaction.user;
            const guildId = interaction.guild.id;

            // Получаем статистику приглашений
            const inviteStats = await db.getUserInviteStats(targetUser.id, guildId);
            
            // Если данных нет, создаем пустую статистику
            if (!inviteStats || inviteStats.total_invites === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📬 Статистика приглашений')
                    .setDescription(`**Пользователь:** ${targetUser}\n\n**Статистика:**\n• Всего приглашено: 0\n• Осталось на сервере: 0\n• Покинули сервер: 0\n• Возвратившихся: 0\n• Действительных приглашений: 0`)
                    .setColor(0x3498db)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .setTimestamp()
                    .setFooter({ 
                        text: 'Система отслеживания приглашений • Возвратившиеся пользователи (5+ сообщений) не засчитываются',
                        iconURL: interaction.client.user.displayAvatarURL()
                    });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Создаем embed с данными
            const embed = new EmbedBuilder()
                .setTitle('📬 Статистика приглашений')
                .setDescription(`**Пользователь:** ${targetUser}`)
                .addFields(
                    { 
                        name: '📊 Общая статистика', 
                        value: `• **Всего приглашено:** ${inviteStats.total_invites || 0}\n• **Осталось на сервере:** ${inviteStats.current_members || 0}\n• **Покинули сервер:** ${inviteStats.left_members || 0}`, 
                        inline: false 
                    },
                    { 
                        name: '🔍 Детальная статистика', 
                        value: `• **Возвратившихся пользователей:** ${inviteStats.fake_accounts || 0}\n• **Действительных приглашений:** ${inviteStats.valid_invites || 0}`, 
                        inline: false 
                    }
                )
                .setColor(inviteStats.valid_invites > 0 ? 0x00ff00 : 0x3498db)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp()
                .setFooter({ 
                    text: 'Система отслеживания приглашений • Возвратившиеся пользователи (5+ сообщений) не засчитываются',
                    iconURL: interaction.client.user.displayAvatarURL()
                });

            // Добавляем поле с лучшим приглашением, если есть данные
            if (inviteStats.most_used_invite) {
                embed.addFields({
                    name: '🏆 Самое популярное приглашение',
                    value: `Код: \`${inviteStats.most_used_invite}\``,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Ошибка команды /инвайт:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Ошибка')
                .setDescription('Произошла ошибка при получении статистики приглашений.')
                .setColor(0xff0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
