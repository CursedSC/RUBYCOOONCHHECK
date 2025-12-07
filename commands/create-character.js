const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const Database = require('../database');

const db = new Database();

// ID канала для логирования (замените на ваш ID канала)
const LOG_CHANNEL_ID = '1382005661369368586'; // Замените на реальный ID канала

// Функция для отправки логов в канал
async function sendLogToChannel(client, logData) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('Канал логирования не найден!');
            return;
        }

        const { EmbedBuilder } = require('discord.js');
        
        const logEmbed = new EmbedBuilder()
            .setTitle('📝 Лог команды создания персонажа')
            .setDescription(`🔧 **Модератор:** <@${logData.moderatorId}>\n👤 **Целевой пользователь:** <@${logData.targetUserId}>\n📋 **Команда:** \`/создать\``)
            .setColor(0x00FF00)
            .addFields(
                {
                    name: '📊 Информация:',
                    value: `**Время выполнения:** <t:${Math.floor(logData.timestamp / 1000)}:F>\n**Канал:** <#${logData.channelId}>\n**Сервер:** ${logData.guildName}`,
                    inline: false
                },
                {
                    name: '🎯 Действие:',
                    value: 'Открыто модальное окно для создания персонажа',
                    inline: false
                }
            )
            .setFooter({ text: `ID модератора: ${logData.moderatorId} | ID пользователя: ${logData.targetUserId}` })
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
        console.log('Лог команды /создать отправлен в канал');
        
    } catch (error) {
        console.error('Ошибка отправки лога в канал:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('создать')
        .setDescription('Создать персонажа для пользователя')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь для которого создается персонаж')
                .setRequired(true))
        // УБИРАЕМ ЭТУ СТРОКУ: .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setDefaultMemberPermissions(null), // Разрешаем всем видеть команду

    async execute(interaction) {
        try {
            // Проверка роли - теперь это единственная проверка
            const allowedRoles = ['1382005661369368586', '1387514959482589184'];
            const hasPermission = allowedRoles.some(roleId => interaction.member.roles.cache.has(roleId));
            
            if (!hasPermission) {
                return await interaction.reply({
                    content: 'У вас нет прав для использования этой команды!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const targetUser = interaction.options.getUser('пользователь');

            // Проверяем следующий доступный слот
            try {
                const nextSlot = await db.getNextAvailableSlot(targetUser.id);
                console.log(`Следующий доступный слот: ${nextSlot}`);
            } catch (error) {
                console.error('Ошибка проверки слотов:', error);
            }

            // Создаем модальное окно
            const modal = new ModalBuilder()
                .setCustomId(`characterCreationModal_${targetUser.id}`)
                .setTitle('Создание персонажа');

            // Поля ввода
            const nameInput = new TextInputBuilder()
                .setCustomId('name')
                .setLabel('Имя персонажа')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(50);

            const raceInput = new TextInputBuilder()
                .setCustomId('race')
                .setLabel('Раса')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(30);

            const ageInput = new TextInputBuilder()
                .setCustomId('age')
                .setLabel('Возраст')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(3);

            const nicknameInput = new TextInputBuilder()
                .setCustomId('nickname')
                .setLabel('Прозвище')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(50);

            const quoteInput = new TextInputBuilder()
                .setCustomId('quote')
                .setLabel('Цитата персонажа')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(200);

            // Создаем строки для модального окна
            const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
            const secondActionRow = new ActionRowBuilder().addComponents(raceInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(ageInput);
            const fourthActionRow = new ActionRowBuilder().addComponents(nicknameInput);
            const fifthActionRow = new ActionRowBuilder().addComponents(quoteInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

            await interaction.showModal(modal);

            // Отправляем лог в канал
            const logData = {
                moderatorId: interaction.user.id,
                targetUserId: targetUser.id,
                timestamp: Date.now(),
                channelId: interaction.channelId,
                guildName: interaction.guild?.name || 'Неизвестный сервер'
            };

            await sendLogToChannel(interaction.client, logData);

        } catch (error) {
            console.error('Ошибка в команде создания персонажа:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Произошла ошибка при создании персонажа!',
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }
};
