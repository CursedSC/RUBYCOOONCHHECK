const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const SPECIAL_USER_ID = '416602253160480769';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-panel')
        .setDescription('Создать панель для работы с тикетами')
        .addChannelOption(option =>
            option
                .setName('канал')
                .setDescription('Канал для отправки панели тикетов')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Проверка прав доступа
        if (interaction.user.id !== SPECIAL_USER_ID) {
            return await interaction.reply({
                content: '❌ У вас нет прав для использования этой команды!',
                ephemeral: true
            });
        }

        const targetChannel = interaction.options.getChannel('канал');

        if (!targetChannel || !targetChannel.isTextBased()) {
            return await interaction.reply({
                content: '❌ Указанный канал не является текстовым!',
                ephemeral: true
            });
        }

        try {
            // Создаем embed с информацией о тикетах
            const ticketEmbed = new EmbedBuilder()
                .setTitle('🎫 Работа с тикетами')
                .setDescription('**Создание тикета:**\n\n*Создать тикет можно двумя способами -*\n*1 - Использовать кнопку "создать тикет" под этим сообщением.*\n*2 - Воспользоваться командой "/тикет" и в открывшемся меню выбрать графу "создать тикет"*')
                .setColor(0x3498db)
                .addFields(
                    { 
                        name: '📝 Способ 1 - Кнопка', 
                        value: 'Нажмите кнопку "📝 Создать тикет" ниже для быстрого создания тикета', 
                        inline: false 
                    },
                    { 
                        name: '💬 Способ 2 - Команда', 
                        value: 'Используйте команду `/тикет` для расширенного меню управления тикетами', 
                        inline: false 
                    },
                    {
                        name: '⏰ Важная информация',
                        value: 'Между созданием тикетов действует кулдаун в 48 часов для предотвращения спама',
                        inline: false
                    }
                )
                .setImage("https://cdn.discordapp.com/attachments/1383161274896220231/1399271200936431676/1.png?ex=6888645b&is=688712db&hm=17f71b45bc0717d918df5535342037bead83a2d6ffb77ddb7c5aaf7c46e6e498&")
                .setTimestamp()
                .setFooter({ text: 'Система тикетов • Создано администратором' });

            // Создаем dropdown меню
            const ticketSelect = new StringSelectMenuBuilder()
                .setCustomId('permanent_ticket_menu')
                .setPlaceholder('🎫 Выберите действие с тикетами')
                .addOptions([
                    new StringSelectMenuOptionBuilder()
                        .setLabel('📝 Создать тикет')
                        .setDescription('Создать новый тикет для работы с персонажем')
                        .setValue('create_new_ticket')
                        .setEmoji('📝'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('📋 Мои тикеты')
                        .setDescription('Просмотреть ваши активные и закрытые тикеты')
                        .setValue('view_my_tickets')
                        .setEmoji('📋'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('❓ Помощь по тикетам')
                        .setDescription('Получить информацию о системе тикетов')
                        .setValue('ticket_help')
                        .setEmoji('❓')
                ]);

            // Создаем кнопку для быстрого создания тикета
            const createTicketButton = new ButtonBuilder()
                .setCustomId('quick_create_ticket')
                .setLabel('📝 Создать тикет')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row1 = new ActionRowBuilder().addComponents(ticketSelect);
            const row2 = new ActionRowBuilder().addComponents(createTicketButton);

            // Отправляем сообщение в указанный канал
            await targetChannel.send({
                embeds: [ticketEmbed],
                components: [row1, row2]
            });

            // Подтверждаем успешную отправку
            await interaction.reply({
                content: `✅ Панель тикетов успешно создана в канале ${targetChannel}!`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Ошибка создания панели тикетов:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании панели тикетов!',
                ephemeral: true
            });
        }
    }
};
