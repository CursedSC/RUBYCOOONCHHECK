const { SlashCommandBuilder, MessageFlags, ComponentType, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Загрузка конфига
let ticketConfig;
try {
    ticketConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ticketConfig.json'), 'utf8'));
} catch (e) {
    console.error('Ошибка загрузки ticketConfig.json:', e);
    ticketConfig = {
        specialUsers: { owner: '416602253160480769' },
        images: {},
        emojis: {},
        design: {}
    };
}

const SPECIAL_USER_ID = ticketConfig.specialUsers?.owner || '416602253160480769';

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
                flags: MessageFlags.Ephemeral
            });
        }

        const targetChannel = interaction.options.getChannel('канал');

        if (!targetChannel || !targetChannel.isTextBased()) {
            return await interaction.reply({
                content: '❌ Указанный канал не является текстовым!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const components = [];
            const EMOJIS = ticketConfig.emojis || {};
            const IMAGES = ticketConfig.images || {};
            const DESIGN = ticketConfig.design || {};

            // === ГЛАВНЫЙ КОНТЕЙНЕР ===
            const mainContainer = {
                type: ComponentType.Container,
                accent_color: parseInt(DESIGN.primaryColor?.replace('#', '') || '3498db', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `# ${EMOJIS.ticket || '🎫'} Работа с тикетами`
                    },
                    {
                        type: ComponentType.Separator,
                        divider: true
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: `### Создание тикета\n\n` +
                                 `*Создать тикет можно двумя способами:*\n\n` +
                                 `**1.** Использовать кнопку **"📝 Создать тикет"** под этим сообщением.\n` +
                                 `**2.** Воспользоваться командой \`/тикет\` и в открывшемся меню выбрать нужное действие.`
                    }
                ]
            };
            components.push(mainContainer);

            // === ИЗОБРАЖЕНИЕ ===
            if (IMAGES.ticketPanel) {
                components.push({
                    type: ComponentType.MediaGallery,
                    items: [{
                        type: ComponentType.MediaGalleryItem,
                        media: { url: IMAGES.ticketPanel },
                        description: 'Система тикетов RubyBot'
                    }]
                });
            }

            // === ИНФОРМАЦИОННЫЙ БЛОК ===
            const infoContainer = {
                type: ComponentType.Container,
                accent_color: parseInt('2ecc71', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 📝 Способ 1 — Кнопка\n` +
                                 `Нажмите кнопку **"📝 Создать тикет"** ниже для быстрого создания тикета`
                    },
                    {
                        type: ComponentType.Separator,
                        divider: true
                    },
                    {
                        type: ComponentType.TextDisplay,
                        content: `### 💬 Способ 2 — Команда\n` +
                                 `Используйте команду \`/тикет\` для расширенного меню управления тикетами`
                    }
                ]
            };
            components.push(infoContainer);

            // === ВАЖНАЯ ИНФОРМАЦИЯ ===
            const warningContainer = {
                type: ComponentType.Container,
                accent_color: parseInt('f39c12', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `### ⏰ Важная информация\n` +
                                 `Между созданием тикетов действует кулдаун **72 часа** (3 дня) для предотвращения спама.\n\n` +
                                 `После завершения тикета вы сможете создать новый через указанное время.`
                    }
                ]
            };
            components.push(warningContainer);

            // === КНОПКИ ДЕЙСТВИЙ ===
            const buttonsRow = {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Success,
                        label: 'Создать тикет',
                        custom_id: 'quick_create_ticket',
                        emoji: { name: '📝' }
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Primary,
                        label: 'Мои тикеты',
                        custom_id: 'permanent_my_tickets',
                        emoji: { name: '📋' }
                    },
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Secondary,
                        label: 'Помощь',
                        custom_id: 'permanent_ticket_help',
                        emoji: { name: '❓' }
                    }
                ]
            };
            components.push(buttonsRow);

            // === ФУТЕР ===
            const footerContainer = {
                type: ComponentType.Container,
                accent_color: parseInt('95a5a6', 16),
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `*${DESIGN.embedFooter || 'Система тикетов RubyBot'} • Создано администратором*`
                    }
                ]
            };
            components.push(footerContainer);

            // Отправляем панель в указанный канал
            await targetChannel.send({
                flags: MessageFlags.IsComponentsV2,
                components: components
            });

            // Подтверждаем успешную отправку
            await interaction.reply({
                content: `✅ Панель тикетов успешно создана в канале ${targetChannel}!`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Ошибка создания панели тикетов:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при создании панели тикетов!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
