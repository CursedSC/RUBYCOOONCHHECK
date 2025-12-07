const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../../database');
const db = new Database();

// Настройки эмодзи монет (кастомные)
const COIN_EMOJI = {
    POUND: '<:pound:000000000000000000>', // Замените на ваши ID
    SOL: '<:sol:000000000000000000>',
    PESSO: '<:pesso:000000000000000000>'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('экономика')
        .setDescription('Управление экономической системой (только для администраторов)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ Эта команда доступна только администраторам!',
                ephemeral: true
            });
        }

        const mainMenu = new StringSelectMenuBuilder()
            .setCustomId(`economy_main_${interaction.user.id}`)
            .setPlaceholder('Выберите раздел управления экономикой')
            .addOptions([
                {
                    label: '💰 Управление балансами',
                    description: 'Выдача/списание валюты пользователям',
                    value: 'manage_balance',
                    emoji: '💰'
                },
                {
                    label: '🏪 Управление магазином',
                    description: 'Добавление/редактирование товаров',
                    value: 'manage_shop',
                    emoji: '🏪'
                },
                {
                    label: '📋 Предложения покупки',
                    description: 'Рассмотрение запросов от игроков',
                    value: 'manage_proposals',
                    emoji: '📋'
                },
                {
                    label: '📊 Статистика экономики',
                    description: 'Просмотр общей статистики',
                    value: 'economy_stats',
                    emoji: '📊'
                },
                {
                    label: '⚙️ Настройка валют',
                    description: 'Изменение эмодзи и курсов валют',
                    value: 'currency_settings',
                    emoji: '⚙️'
                }
            ]);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Панель управления экономикой')
            .setDescription(
                `**Система валют:**\n` +
                `${COIN_EMOJI.POUND} **Фунт** — основная валюта\n` +
                `${COIN_EMOJI.SOL} **Соль** = 1/20 фунта (5 пессо)\n` +
                `${COIN_EMOJI.PESSO} **Пессо** = 1/100 фунта\n\n` +
                `**Доступные функции:**\n` +
                `• Выдача и списание валюты\n` +
                `• Управление товарами магазина\n` +
                `• Обработка предложений покупки\n` +
                `• Просмотр статистики\n\n` +
                `Выберите раздел из меню ниже:`
            )
            .setColor('#FFD700')
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(mainMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
};
