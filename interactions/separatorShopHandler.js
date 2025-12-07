// interactions/separatorShopHandler.js
// Обработчик магазина оформления для профиля персонажа

const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    ComponentType
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const Database = require('../database');
const db = new Database();

// Загружаем конфиг магазина
let shopConfig;
try {
    shopConfig = require('../shopConfig.json');
} catch (e) {
    console.error('❌ Ошибка загрузки shopConfig.json:', e);
    shopConfig = {
        shopName: "Покупка оформления",
        accessRoleId: "1381909203005866034",
        itemsPerPage: 5,
        rarityConfig: {
            common: { name: "Обычный", emoji: "⚪", color: "#9E9E9E" },
            rare: { name: "Редкий", emoji: "🔵", color: "#2196F3" },
            epic: { name: "Эпический", emoji: "🟣", color: "#9C27B0" },
            legendary: { name: "Легендарный", emoji: "🟠", color: "#FF9800" },
            mythic: { name: "Мифический", emoji: "🔴", color: "#F44336" }
        },
        separators: [],
        emojis: [],
        customEmojiSettings: { enabled: true, basePrice: 100 }
    };
}

const SHOP_ACCESS_ROLE_ID = shopConfig.accessRoleId;
const ITEMS_PER_PAGE = shopConfig.itemsPerPage || 5;

// Хелперы для редкости
function getRarityEmoji(rarity) {
    return shopConfig.rarityConfig[rarity]?.emoji || '⚪';
}

function getRarityName(rarity) {
    return shopConfig.rarityConfig[rarity]?.name || 'Обычный';
}

function getRarityColor(rarity) {
    const color = shopConfig.rarityConfig[rarity]?.color || '#9E9E9E';
    return parseInt(color.replace('#', ''), 16);
}

/**
 * Скачать изображение по URL
 */
async function downloadImage(url) {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        if (!response.ok) return null;
        return Buffer.from(await response.arrayBuffer());
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        return null;
    }
}

/**
 * Генерация превью профиля с разделителями
 * Создаёт изображение с примером профиля
 */
async function generateProfilePreview(separator1Url, separator2Url, embedColor = '#9932CC') {
    try {
        const width = 400;
        const height = 500;
        const sepWidth = 300;
        const sepHeight = 50;

        // Загружаем разделители
        let sep1Buffer = null;
        let sep2Buffer = null;

        if (separator1Url) {
            if (separator1Url.startsWith('./') || separator1Url.startsWith('/')) {
                // Локальный файл
                const localPath = path.join(__dirname, '..', separator1Url);
                if (fs.existsSync(localPath)) {
                    sep1Buffer = fs.readFileSync(localPath);
                }
            } else {
                // URL
                sep1Buffer = await downloadImage(separator1Url);
            }
        }

        if (separator2Url) {
            if (separator2Url.startsWith('./') || separator2Url.startsWith('/')) {
                const localPath = path.join(__dirname, '..', separator2Url);
                if (fs.existsSync(localPath)) {
                    sep2Buffer = fs.readFileSync(localPath);
                }
            } else {
                sep2Buffer = await downloadImage(separator2Url);
            }
        }

        // Если нет второго - используем первый
        if (!sep2Buffer) sep2Buffer = sep1Buffer;

        // Создаём базовое изображение профиля
        const bgColor = { r: 47, g: 49, b: 54, alpha: 1 }; // Discord dark theme
        const accentColor = embedColor.replace('#', '');
        const r = parseInt(accentColor.substr(0, 2), 16) || 153;
        const g = parseInt(accentColor.substr(2, 2), 16) || 50;
        const b = parseInt(accentColor.substr(4, 2), 16) || 204;

        // SVG для текста профиля
        const svgText = `
        <svg width="${width}" height="${height}">
            <defs>
                <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:rgb(${r},${g},${b});stop-opacity:1" />
                    <stop offset="100%" style="stop-color:rgb(${Math.min(r+50,255)},${Math.min(g+50,255)},${Math.min(b+50,255)});stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="rgb(47,49,54)"/>
            <rect x="0" y="0" width="5" height="100%" fill="url(#accent)"/>
            
            <text x="20" y="40" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white">Имя Персонажа</text>
            <text x="20" y="65" font-family="Arial, sans-serif" font-size="14" fill="#888">«Прозвище»</text>
            
            <text x="20" y="150" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">【 Основная информация 】</text>
            <text x="20" y="175" font-family="Arial, sans-serif" font-size="14" fill="#ddd">🦁 Раса: Человек</text>
            <text x="20" y="195" font-family="Arial, sans-serif" font-size="14" fill="#ddd">🎂 Возраст: 25</text>
            <text x="20" y="215" font-family="Arial, sans-serif" font-size="14" fill="#ddd">🏛️ Организация: Гильдия</text>
            
            <text x="20" y="295" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">【 Характеристики 】</text>
            <text x="20" y="320" font-family="Arial, sans-serif" font-size="14" fill="#ddd">💪 Сила: 10,000</text>
            <text x="20" y="340" font-family="Arial, sans-serif" font-size="14" fill="#ddd">🤸 Ловкость: 8,500</text>
            <text x="20" y="360" font-family="Arial, sans-serif" font-size="14" fill="#ddd">⚡️ Реакция: 7,200</text>
            
            <text x="20" y="440" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">【 Способности 】</text>
            <text x="20" y="465" font-family="Arial, sans-serif" font-size="14" fill="#ddd">🔮 Магия огня</text>
        </svg>`;

        // Создаём базовое изображение
        let composite = sharp(Buffer.from(svgText))
            .resize(width, height);

        const composites = [];

        // Добавляем разделитель 1 (после имени)
        if (sep1Buffer) {
            try {
                const sep1Resized = await sharp(sep1Buffer)
                    .resize(sepWidth, sepHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png()
                    .toBuffer();
                composites.push({ input: sep1Resized, top: 80, left: 50 });
            } catch (e) {
                console.error('Ошибка обработки sep1:', e);
            }
        }

        // Добавляем разделитель 2 (после основной информации)
        if (sep2Buffer) {
            try {
                const sep2Resized = await sharp(sep2Buffer)
                    .resize(sepWidth, sepHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png()
                    .toBuffer();
                composites.push({ input: sep2Resized, top: 235, left: 50 });
            } catch (e) {
                console.error('Ошибка обработки sep2:', e);
            }
        }

        // Добавляем разделитель 1 снова (после характеристик)
        if (sep1Buffer) {
            try {
                const sep1Resized = await sharp(sep1Buffer)
                    .resize(sepWidth, sepHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .png()
                    .toBuffer();
                composites.push({ input: sep1Resized, top: 380, left: 50 });
            } catch (e) {
                console.error('Ошибка обработки sep1 (2):', e);
            }
        }

        // Композируем всё вместе
        if (composites.length > 0) {
            composite = composite.composite(composites);
        }

        const previewBuffer = await composite.png().toBuffer();
        return previewBuffer;
    } catch (error) {
        console.error('Ошибка генерации превью:', error);
        return null;
    }
}

/**
 * Проверка доступа к магазину
 * Теперь доступен всем у кого есть персонаж
 */
function hasShopAccess(member) {
    // Разрешаем всем доступ к магазину
    return member.roles.cache.has(SHOP_ACCESS_ROLE_ID);
    // Старая проверка (закомментирована):
    // return member.roles.cache.has(SHOP_ACCESS_ROLE_ID);
}

/**
 * Валидация URL изображения
 */
function isValidImageUrl(url) {
    if (!url) return false;
    const urlPattern = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i;
    const discordPattern = /^https?:\/\/(media\.discordapp\.net|cdn\.discordapp\.com)\/.+/i;
    return urlPattern.test(url) || discordPattern.test(url);
}

/**
 * Главное меню магазина оформления
 */
async function showSeparatorShop(interaction, characterId) {
    if (!hasShopAccess(interaction.member)) {
        return await interaction.reply({
            content: '❌ У вас нет доступа к покупке оформления!',
            flags: MessageFlags.Ephemeral
        });
    }

    const character = await db.getCharacterById(characterId);
    if (!character) {
        return await interaction.reply({
            content: '❌ Персонаж не найден!',
            flags: MessageFlags.Ephemeral
        });
    }

    const userBalance = await db.getUserRubyCoins(interaction.user.id);
    const userSeparators = await db.getUserSeparators(interaction.user.id);
    const userEmojis = await db.getUserEmojis(interaction.user.id);
    const activeSeparator = await db.getCharacterActiveSeparator(characterId);
    const customEmoji = await db.getCharacterCustomEmoji(characterId);

    const container = {
        type: ComponentType.Container,
        accent_color: 0x9932CC,
        components: []
    };

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `# � ${shopConfig.shopName}`
    });

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `**Персонаж:** ${character.name}\n💰 **Баланс:** ${userBalance.toFixed(2)} RubyCoins`
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    // Текущее оформление
    let currentSep = '📦 Стандартный';
    if (activeSeparator) {
        if (activeSeparator.is_custom) currentSep = '🎨 Кастомный';
        else if (activeSeparator.name) currentSep = `✨ ${activeSeparator.name}`;
    }

    let currentEmoji = '❌ Не установлено';
    if (customEmoji) {
        currentEmoji = customEmoji.emoji_name ? `✅ ${customEmoji.emoji_name}` : '✅ Установлено';
    }

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `### 📋 Текущее оформление\n**Разделитель:** ${currentSep}\n**Эмодзи:** ${currentEmoji}`
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `### 📊 Коллекция\n🎁 **Разделителей:** ${userSeparators.length}\n🖼️ **Эмодзи:** ${userEmojis?.length || 0}`
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    // Кнопки навигации - первый ряд (Разделители и Эмодзи)
    container.components.push({
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: '🎨 Разделители',
                custom_id: `shop_catalog_sep_0_${characterId}`,
                emoji: { name: '🎨' }
            },
            {
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: '✨ Эмодзи',
                custom_id: `shop_catalog_emoji_0_${characterId}`,
                emoji: { name: '✨' }
            },
            {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                label: '📦 Мои покупки',
                custom_id: `shop_myitems_sep_${characterId}`,
                emoji: { name: '📦' }
            }
        ]
    });

    // Второй ряд - Загрузка своего эмодзи и Назад
    container.components.push({
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: '➕ Загрузить своё эмодзи',
                custom_id: `sep_shop_emoji_${characterId}`,
                emoji: { name: '➕' }
            },
            {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                label: '◀️ Закрыть',
                custom_id: `sep_shop_back_${characterId}`,
                emoji: { name: '◀️' }
            }
        ]
    });

    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
        } else {
            await interaction.reply({ flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral, components: [container] });
        }
    } catch (error) {
        console.error('Ошибка показа магазина:', error);
    }
}

/**
 * Показать каталог разделителей с пагинацией
 */
async function showCatalog(interaction, characterId, page = 0, type = 'sep') {
    const userBalance = await db.getUserRubyCoins(interaction.user.id);
    const userSeparators = await db.getUserSeparators(interaction.user.id);
    const ownedIds = userSeparators.map(s => s.id);

    // Получаем товары из конфига или БД
    let items = type === 'sep' ? shopConfig.separators : shopConfig.emojis;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    const pageItems = items.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

    const container = {
        type: ComponentType.Container,
        accent_color: type === 'sep' ? 0x2196F3 : 0xFF9800,
        components: []
    };

    const title = type === 'sep' ? '🛒 Каталог разделителей' : '🖼️ Каталог эмодзи';
    container.components.push({
        type: ComponentType.TextDisplay,
        content: `# ${title}\n💰 **Баланс:** ${userBalance.toFixed(2)} RC | 📄 Стр. ${currentPage + 1}/${totalPages}`
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    // Показываем товары текущей страницы
    pageItems.forEach(item => {
        const owned = type === 'sep' ? ownedIds.includes(item.id) : false;
        const rarityEmoji = getRarityEmoji(item.rarity);
        const rarityName = getRarityName(item.rarity);
        const priceText = item.price === 0 ? '🆓 Бесплатно' : `💰 ${item.price} RC`;
        const statusText = owned ? '✅ Куплено' : (userBalance >= item.price ? '🛒 Доступно' : '❌ Недостаточно');

        container.components.push({
            type: ComponentType.TextDisplay,
            content: `${rarityEmoji} **${item.name}** — ${rarityName}\n> ${item.description || 'Без описания'}\n> ${priceText} | ${statusText}`
        });
    });

    // Select Menu для выбора товара (просмотр/покупка)
    if (pageItems.length > 0) {
        container.components.push({ type: ComponentType.Separator, spacing: 1 });

        const selectOptions = pageItems.map(item => ({
            label: `${item.name} — ${item.price === 0 ? 'Бесплатно' : item.price + ' RC'}`,
            value: item.id,
            description: 'Просмотреть превью и купить',
            emoji: getRarityEmoji(item.rarity)
        }));

        container.components.push({
            type: ComponentType.ActionRow,
            components: [{
                type: ComponentType.StringSelect,
                custom_id: `shop_preview_${type}_${characterId}`,
                placeholder: '�️ Выберите для просмотра...',
                options: selectOptions
            }]
        });
    }

    // Кнопки пагинации
    const navButtons = [];
    if (currentPage > 0) {
        navButtons.push({
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: '◀️ Назад',
            custom_id: `shop_page_${type}_${currentPage - 1}_${characterId}`
        });
    }
    if (currentPage < totalPages - 1) {
        navButtons.push({
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: 'Вперёд ▶️',
            custom_id: `shop_page_${type}_${currentPage + 1}_${characterId}`
        });
    }
    navButtons.push({
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: '🏠 В магазин',
        custom_id: `sep_shop_main_${characterId}`
    });

    container.components.push({
        type: ComponentType.ActionRow,
        components: navButtons
    });

    await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    });
}

/**
 * Показать превью товара с примерами оформления
 */
async function showItemPreview(interaction, characterId, itemId, type = 'sep') {
    const items = type === 'sep' ? shopConfig.separators : shopConfig.emojis;
    const item = items.find(i => i.id === itemId);
    
    if (!item) {
        return await interaction.reply({
            content: '❌ Товар не найден!',
            flags: MessageFlags.Ephemeral
        });
    }

    const userBalance = await db.getUserRubyCoins(interaction.user.id);
    const userSeparators = await db.getUserSeparators(interaction.user.id);
    const owned = type === 'sep' ? userSeparators.some(s => s.id === itemId) : false;

    const container = {
        type: ComponentType.Container,
        accent_color: getRarityColor(item.rarity),
        components: []
    };

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `# ${getRarityEmoji(item.rarity)} ${item.name}`
    });

    // Информация о разделителе с флагами
    let infoText = `**Редкость:** ${getRarityName(item.rarity)}\n**Категория:** ${item.category}\n**Цена:** ${item.price === 0 ? '🆓 Бесплатно' : `💰 ${item.price} RC`}`;
    
    if (type === 'sep') {
        // Добавляем информацию о свойствах разделителя
        const recolorText = item.recolorable !== false ? '🎨 Меняет цвет под embed' : '🔒 Уникальный цвет (не меняется)';
        const alternateText = item.alternate !== false && item.separator2_url ? '🔄 Чередующийся (2 изображения)' : '📷 Одиночный (1 изображение)';
        infoText += `\n\n**Свойства:**\n> ${recolorText}\n> ${alternateText}`;
    }
    
    infoText += `\n\n> ${item.description}`;

    container.components.push({
        type: ComponentType.TextDisplay,
        content: infoText
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    // Файлы для прикрепления
    const files = [];

    if (type === 'sep') {
        // === ПРЕВЬЮ РАЗДЕЛИТЕЛЕЙ ===
        
        // 1. Генерируем превью профиля с разделителями
        container.components.push({
            type: ComponentType.TextDisplay,
            content: '### � Пример в профиле'
        });

        try {
            const previewBuffer = await generateProfilePreview(
                item.separator1_url, 
                item.separator2_url,
                shopConfig.rarityConfig[item.rarity]?.color || '#9932CC'
            );
            
            if (previewBuffer) {
                files.push({ 
                    attachment: previewBuffer, 
                    name: `preview_${item.id}.png` 
                });
                
                // Показываем превью как изображение через MediaGallery
                container.components.push({
                    type: ComponentType.MediaGallery,
                    items: [{ media: { url: `attachment://preview_${item.id}.png` } }]
                });
            }
        } catch (previewError) {
            console.error('Ошибка генерации превью:', previewError);
            container.components.push({
                type: ComponentType.TextDisplay,
                content: '> ⚠️ Не удалось сгенерировать превью'
            });
        }

        container.components.push({ type: ComponentType.Separator, spacing: 1 });

        // 2. Показываем отдельные PNG разделителей
        container.components.push({
            type: ComponentType.TextDisplay,
            content: '### �️ Разделители отдельно'
        });

        // Загружаем и прикрепляем локальные файлы как изображения
        try {
            // Разделитель 1
            if (item.separator1_url) {
                let sep1Buffer = null;
                if (item.separator1_url.startsWith('./') || item.separator1_url.startsWith('/')) {
                    const localPath = path.join(__dirname, '..', item.separator1_url);
                    if (fs.existsSync(localPath)) {
                        sep1Buffer = fs.readFileSync(localPath);
                    }
                } else {
                    sep1Buffer = await downloadImage(item.separator1_url);
                }
                
                if (sep1Buffer) {
                    files.push({ attachment: sep1Buffer, name: `sep1_${item.id}.png` });
                }
            }

            // Разделитель 2
            if (item.separator2_url) {
                let sep2Buffer = null;
                if (item.separator2_url.startsWith('./') || item.separator2_url.startsWith('/')) {
                    const localPath = path.join(__dirname, '..', item.separator2_url);
                    if (fs.existsSync(localPath)) {
                        sep2Buffer = fs.readFileSync(localPath);
                    }
                } else {
                    sep2Buffer = await downloadImage(item.separator2_url);
                }
                
                if (sep2Buffer) {
                    files.push({ attachment: sep2Buffer, name: `sep2_${item.id}.png` });
                }
            }

            // Показываем разделители как изображения
            const sepMediaItems = [];
            if (files.find(f => f.name === `sep1_${item.id}.png`)) {
                sepMediaItems.push({ media: { url: `attachment://sep1_${item.id}.png` } });
            }
            if (files.find(f => f.name === `sep2_${item.id}.png`)) {
                sepMediaItems.push({ media: { url: `attachment://sep2_${item.id}.png` } });
            }

            if (sepMediaItems.length > 0) {
                container.components.push({
                    type: ComponentType.MediaGallery,
                    items: sepMediaItems
                });
            } else {
                container.components.push({
                    type: ComponentType.TextDisplay,
                    content: '> ⚠️ Не удалось загрузить разделители'
                });
            }
        } catch (sepError) {
            console.error('Ошибка загрузки разделителей:', sepError);
        }
    } else {
        // === ПРЕВЬЮ ЭМОДЗИ ===
        container.components.push({
            type: ComponentType.TextDisplay,
            content: '### 🖼️ Превью эмодзи'
        });

        if (item.image_url) {
            container.components.push({
                type: ComponentType.MediaGallery,
                items: [{ media: { url: item.image_url } }]
            });
        }

        // Пример в имени
        container.components.push({
            type: ComponentType.TextDisplay,
            content: `**Пример в профиле:**\n\`[ 🖼️ ] | Имя Персонажа\``
        });
    }

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    // Кнопки действий
    const actionButtons = [];
    
    if (owned) {
        actionButtons.push({
            type: ComponentType.Button,
            style: ButtonStyle.Success,
            label: '✅ Уже куплено',
            custom_id: `shop_owned_${characterId}`,
            disabled: true
        });
        if (type === 'sep') {
            actionButtons.push({
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: '🎨 Применить',
                custom_id: `shop_apply_${type}_${itemId}_${characterId}`
            });
        }
    } else {
        const canAfford = userBalance >= item.price;
        actionButtons.push({
            type: ComponentType.Button,
            style: canAfford ? ButtonStyle.Success : ButtonStyle.Danger,
            label: canAfford ? `🛒 Купить за ${item.price} RC` : '❌ Недостаточно RC',
            custom_id: `shop_buy_${type}_${itemId}_${characterId}`,
            disabled: !canAfford
        });
    }

    actionButtons.push({
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: '◀️ Назад',
        custom_id: `shop_catalog_${type}_0_${characterId}`
    });

    container.components.push({
        type: ComponentType.ActionRow,
        components: actionButtons
    });

    // Отправляем с файлами если есть
    const updateOptions = {
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    };
    
    if (files.length > 0) {
        updateOptions.files = files;
    }

    await interaction.update(updateOptions);
}

/**
 * Показать мои покупки (разделители и эмодзи)
 */
async function showMyItems(interaction, characterId, tab = 'sep') {
    const userSeparators = await db.getUserSeparators(interaction.user.id);
    const userEmojis = await db.getUserEmojis(interaction.user.id) || [];
    const activeSeparator = await db.getCharacterActiveSeparator(characterId);
    const activeEmoji = await db.getCharacterCustomEmoji(characterId);

    const container = {
        type: ComponentType.Container,
        accent_color: 0x4CAF50,
        components: []
    };

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `# 📦 Мои покупки\n🎁 **Разделителей:** ${userSeparators.length} | 🖼️ **Эмодзи:** ${userEmojis.length}`
    });

    // Табы для переключения
    container.components.push({
        type: ComponentType.ActionRow,
        components: [
            {
                type: ComponentType.Button,
                style: tab === 'sep' ? ButtonStyle.Primary : ButtonStyle.Secondary,
                label: `🎁 Разделители (${userSeparators.length})`,
                custom_id: `shop_mytab_sep_${characterId}`
            },
            {
                type: ComponentType.Button,
                style: tab === 'emoji' ? ButtonStyle.Primary : ButtonStyle.Secondary,
                label: `🖼️ Эмодзи (${userEmojis.length})`,
                custom_id: `shop_mytab_emoji_${characterId}`
            }
        ]
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    if (tab === 'sep') {
        // Показываем разделители
        if (userSeparators.length === 0) {
            container.components.push({
                type: ComponentType.TextDisplay,
                content: '> 😔 У вас пока нет купленных разделителей.\n> Посетите каталог, чтобы приобрести!'
            });
        } else {
            userSeparators.slice(0, 10).forEach(sep => {
                const isActive = activeSeparator && activeSeparator.separator_id === sep.id && !activeSeparator.is_custom;
                const activeText = isActive ? ' 🟢 **АКТИВЕН**' : '';
                const rarityEmoji = getRarityEmoji(sep.rarity);

                container.components.push({
                    type: ComponentType.TextDisplay,
                    content: `${rarityEmoji} **${sep.name}**${activeText}\n> ${sep.description || 'Без описания'}`
                });
            });

            // Select Menu для активации
            const selectOptions = userSeparators.slice(0, 25).map(sep => ({
                label: sep.name,
                value: `${sep.id}`,
                description: 'Установить как активный',
                emoji: getRarityEmoji(sep.rarity)
            }));

            container.components.push({
                type: ComponentType.ActionRow,
                components: [{
                    type: ComponentType.StringSelect,
                    custom_id: `shop_activate_sep_${characterId}`,
                    placeholder: '✨ Выберите разделитель для активации...',
                    options: selectOptions
                }]
            });
        }
    } else {
        // Показываем эмодзи
        if (userEmojis.length === 0) {
            container.components.push({
                type: ComponentType.TextDisplay,
                content: '> 😔 У вас пока нет купленных эмодзи.\n> Посетите каталог или добавьте своё!'
            });
        } else {
            userEmojis.slice(0, 10).forEach(emoji => {
                const isActive = activeEmoji && activeEmoji.emoji_id === emoji.id;
                const activeText = isActive ? ' 🟢 **АКТИВЕН**' : '';

                container.components.push({
                    type: ComponentType.TextDisplay,
                    content: `🖼️ **${emoji.name}**${activeText}`
                });
            });

            // Select Menu для активации эмодзи
            const selectOptions = userEmojis.slice(0, 25).map(emoji => ({
                label: emoji.name,
                value: `${emoji.id}`,
                description: 'Установить как активный'
            }));

            container.components.push({
                type: ComponentType.ActionRow,
                components: [{
                    type: ComponentType.StringSelect,
                    custom_id: `shop_activate_emoji_${characterId}`,
                    placeholder: '✨ Выберите эмодзи для активации...',
                    options: selectOptions
                }]
            });
        }
    }

    // Кнопка назад
    container.components.push({
        type: ComponentType.ActionRow,
        components: [{
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: '🏠 В магазин',
            custom_id: `sep_shop_main_${characterId}`
        }]
    });

    await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    });
}

/**
 * Показать меню кастомного эмодзи (добавление своего)
 */
async function showCustomEmojiMenu(interaction, characterId) {
    const character = await db.getCharacterById(characterId);
    const customEmoji = await db.getCharacterCustomEmoji(characterId);
    const userBalance = await db.getUserRubyCoins(interaction.user.id);
    const customPrice = shopConfig.customEmojiSettings?.basePrice || 100;

    const container = {
        type: ComponentType.Container,
        accent_color: 0xFF9800,
        components: []
    };

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `# ➕ Добавить своё эмодзи\n**Персонаж:** ${character.name}\n💰 **Баланс:** ${userBalance.toFixed(2)} RC`
    });

    container.components.push({ type: ComponentType.Separator, spacing: 1 });

    container.components.push({
        type: ComponentType.TextDisplay,
        content: `### ℹ️ Как это работает?\nВы можете загрузить своё изображение как эмодзи.\nОно будет добавлено в бота и отображаться в профиле:\n\`[ <:emoji:> ] | ${character.name}\`\n\n💰 **Стоимость:** ${customPrice} RC\n📏 **Макс. размер:** 256x256 px\n📁 **Форматы:** PNG, JPG, GIF, WebP`
    });

    if (customEmoji) {
        container.components.push({ type: ComponentType.Separator, spacing: 1 });
        container.components.push({
            type: ComponentType.TextDisplay,
            content: `### ✅ Текущее эмодзи\n**Название:** ${customEmoji.emoji_name || 'Без названия'}`
        });

        if (customEmoji.emoji_url) {
            container.components.push({
                type: ComponentType.MediaGallery,
                items: [{ media: { url: customEmoji.emoji_url } }]
            });
        }
    }

    const actionButtons = [{
        type: ComponentType.Button,
        style: ButtonStyle.Success,
        label: customEmoji ? '🔄 Изменить эмодзи' : '➕ Добавить эмодзи',
        custom_id: `sep_shop_emoji_add_${characterId}`
    }];

    if (customEmoji) {
        actionButtons.push({
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            label: '🗑️ Удалить',
            custom_id: `sep_shop_emoji_delete_${characterId}`
        });
    }

    container.components.push({ type: ComponentType.ActionRow, components: actionButtons });
    container.components.push({
        type: ComponentType.ActionRow,
        components: [{
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: '🏠 В магазин',
            custom_id: `sep_shop_main_${characterId}`
        }]
    });

    await interaction.update({
        flags: MessageFlags.IsComponentsV2,
        components: [container]
    });
}

/**
 * Покупка товара из конфига
 */
async function handlePurchaseFromConfig(interaction, characterId, itemId, type) {
    const items = type === 'sep' ? shopConfig.separators : shopConfig.emojis;
    const item = items.find(i => i.id === itemId);

    if (!item) {
        return await interaction.reply({
            content: '❌ Товар не найден!',
            flags: MessageFlags.Ephemeral
        });
    }

    const userBalance = await db.getUserRubyCoins(interaction.user.id);
    if (userBalance < item.price) {
        return await interaction.reply({
            content: `❌ Недостаточно RubyCoins!\n💰 Нужно: ${item.price} RC\n💳 У вас: ${userBalance.toFixed(2)} RC`,
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Списываем деньги
        if (item.price > 0) {
            await db.removeRubyCoins(interaction.user.id, item.price);
        }

        // Добавляем товар пользователю
        if (type === 'sep') {
            await db.addUserSeparatorFromConfig(interaction.user.id, item);
            
            await interaction.editReply({
                content: `✅ **Покупка успешна!**\n\n${getRarityEmoji(item.rarity)} **${item.name}**\n💰 **Потрачено:** ${item.price} RC\n\n*Разделитель добавлен в "Мои покупки"*`
            });
        } else {
            // Для эмодзи - пробуем загрузить на Discord сервер
            let emojiData = null;
            
            if (shopConfig.customEmojiSettings?.uploadToBot && item.image_url) {
                try {
                    emojiData = await uploadEmojiToGuild(interaction.client, item.image_url, item.name);
                    console.log(`✅ Эмодзи из каталога загружено: ${emojiData.identifier}`);
                } catch (uploadError) {
                    console.error('Не удалось загрузить эмодзи из каталога:', uploadError);
                }
            }
            
            await db.addUserEmojiFromConfig(interaction.user.id, item, interaction.client, emojiData);
            
            const emojiDisplay = emojiData ? emojiData.identifier : `🖼️`;
            const uploadStatus = emojiData 
                ? '\n\n✨ *Эмодзи загружено в Discord и доступно как ${emojiDisplay}*'
                : '\n\n📎 *Эмодзи сохранено как изображение*';

            await interaction.editReply({
                content: `✅ **Покупка успешна!**\n\n${emojiDisplay} **${item.name}**\n💰 **Потрачено:** ${item.price} RC${uploadStatus}\n\n*Товар добавлен в "Мои покупки"*`
            });
        }
    } catch (error) {
        console.error('Ошибка покупки:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: `❌ Ошибка покупки: ${error.message}`
            });
        } else {
            await interaction.reply({
                content: `❌ Ошибка покупки: ${error.message}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

/**
 * Применение товара к персонажу
 */
async function handleApplyItem(interaction, characterId, itemId, type) {
    try {
        if (type === 'sep') {
            // Находим разделитель в конфиге
            const item = shopConfig.separators.find(s => s.id === itemId);
            if (!item) {
                return await interaction.reply({
                    content: '❌ Разделитель не найден!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Устанавливаем как активный с флагами из конфига
            await db.setCharacterActiveSeparator(characterId, null, true, {
                separator1: item.separator1_url,
                separator2: item.separator2_url || null
            }, {
                recolorable: item.recolorable !== false,
                alternate: item.alternate !== false && item.separator2_url
            });

            const recolorInfo = item.recolorable !== false ? '🎨 Цвет будет меняться под embed' : '🔒 Уникальный цвет сохранён';
            await interaction.reply({
                content: `✅ **Разделитель применён!**\n\n✨ **${item.name}** установлен для персонажа.\n${recolorInfo}\n\n*Откройте профиль, чтобы увидеть изменения.*`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            // Для эмодзи
            const item = shopConfig.emojis.find(e => e.id === itemId);
            if (!item) {
                return await interaction.reply({
                    content: '❌ Эмодзи не найдено!',
                    flags: MessageFlags.Ephemeral
                });
            }

            await db.setCharacterCustomEmoji(characterId, item.image_url, item.name);

            await interaction.reply({
                content: `✅ **Эмодзи применено!**\n\n🖼️ **${item.name}** установлено для персонажа.`,
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Ошибка применения товара:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при применении!',
            flags: MessageFlags.Ephemeral
        });
    }
}

/**
 * Активация эмодзи для персонажа
 */
async function handleEmojiActivation(interaction, characterId, emojiId) {
    try {
        const userEmojis = await db.getUserEmojis(interaction.user.id);
        const emoji = userEmojis?.find(e => e.id == emojiId);

        if (!emoji) {
            return await interaction.reply({
                content: '❌ Эмодзи не найдено в вашей коллекции!',
                flags: MessageFlags.Ephemeral
            });
        }

        await db.setCharacterCustomEmoji(characterId, emoji.image_url, emoji.name);

        await interaction.reply({
            content: `✅ **Эмодзи активировано!**\n\n🖼️ **${emoji.name}** установлено для персонажа.`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Ошибка активации эмодзи:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при активации!',
            flags: MessageFlags.Ephemeral
        });
    }
}

/**
 * Показать модальное окно для добавления эмодзи
 */
async function showEmojiModal(interaction, characterId) {
    const modal = new ModalBuilder()
        .setCustomId(`sep_emoji_modal_${characterId}`)
        .setTitle('🖼️ Добавить кастомное эмодзи');

    const urlInput = new TextInputBuilder()
        .setCustomId('emoji_url')
        .setLabel('URL изображения (PNG/JPG/WebP)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://example.com/emoji.png')
        .setRequired(true);

    const nameInput = new TextInputBuilder()
        .setCustomId('emoji_name')
        .setLabel('Название эмодзи (опционально)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Мой крутой эмодзи')
        .setRequired(false)
        .setMaxLength(32);

    modal.addComponents(
        new ActionRowBuilder().addComponents(urlInput),
        new ActionRowBuilder().addComponents(nameInput)
    );

    await interaction.showModal(modal);
}

/**
 * Загрузить изображение как эмодзи на Discord сервер
 * Использует отдельную гильдию для хранения эмодзи (emojiGuildId)
 */
async function uploadEmojiToGuild(client, imageUrl, emojiName) {
    try {
        // Используем специальную гильдию для эмодзи (emojiGuildId)
        const guildId = shopConfig.customEmojiSettings?.emojiGuildId || 
                        shopConfig.customEmojiSettings?.guildId || 
                        client.guilds.cache.first()?.id;
        
        if (!guildId) {
            throw new Error('ID гильдии для эмодзи не настроен в shopConfig.json (emojiGuildId)');
        }

        const guild = client.guilds.cache.get(guildId.toString());
        if (!guild) {
            // Пробуем fetch гильдии
            try {
                await client.guilds.fetch(guildId.toString());
            } catch {
                throw new Error(`Бот не имеет доступа к гильдии ${guildId}. Добавьте бота на этот сервер.`);
            }
        }

        const targetGuild = client.guilds.cache.get(guildId.toString());
        if (!targetGuild) {
            throw new Error(`Гильдия ${guildId} не найдена в кэше бота`);
        }

        // Скачиваем изображение
        const imageBuffer = await downloadImage(imageUrl);
        if (!imageBuffer) {
            throw new Error('Не удалось загрузить изображение по URL');
        }

        // Проверяем размер (макс 256KB для Discord)
        if (imageBuffer.length > 256 * 1024) {
            throw new Error(`Изображение слишком большое (${Math.round(imageBuffer.length/1024)}KB). Максимум 256KB`);
        }

        // Создаём безопасное имя эмодзи (только латиница, цифры и _)
        const prefix = shopConfig.customEmojiSettings?.emojiPrefix || 'rb_';
        const cleanName = (emojiName || 'emoji')
            .toLowerCase()
            .replace(/[а-яё]/g, c => {
                const map = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
                return map[c] || c;
            })
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 28 - prefix.length);
        
        const safeEmojiName = prefix + cleanName;

        // Проверяем лимит эмодзи на сервере
        const emojiCount = targetGuild.emojis.cache.size;
        const maxEmojis = targetGuild.premiumTier === 3 ? 250 : 
                          targetGuild.premiumTier === 2 ? 150 : 
                          targetGuild.premiumTier === 1 ? 100 : 50;
        
        if (emojiCount >= maxEmojis) {
            throw new Error(`Достигнут лимит эмодзи на сервере (${emojiCount}/${maxEmojis})`);
        }

        // Создаём эмодзи на сервере
        const emoji = await targetGuild.emojis.create({
            attachment: imageBuffer,
            name: safeEmojiName,
            reason: `Кастомное эмодзи для RubyBot | ${new Date().toISOString()}`
        });

        console.log(`✅ Эмодзи ${emoji.name} загружено на сервер ${targetGuild.name}: <:${emoji.name}:${emoji.id}>`);
        
        return {
            id: emoji.id,
            name: emoji.name,
            url: emoji.url,
            identifier: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
            animated: emoji.animated,
            guildId: targetGuild.id,
            guildName: targetGuild.name
        };
    } catch (error) {
        console.error('❌ Ошибка загрузки эмодзи на сервер:', error.message);
        throw error;
    }
}

/**
 * Обработка модального окна эмодзи
 */
async function handleEmojiModalSubmit(interaction, characterId) {
    const emojiUrl = interaction.fields.getTextInputValue('emoji_url').trim();
    const emojiName = interaction.fields.getTextInputValue('emoji_name').trim() || 'custom_emoji';

    // Валидация URL
    if (!isValidImageUrl(emojiUrl)) {
        return await interaction.reply({
            content: '❌ Неверный формат URL изображения!\n✅ Поддерживаются: PNG, JPG, WebP, GIF\n✅ Discord CDN ссылки',
            flags: MessageFlags.Ephemeral
        });
    }

    // Проверяем баланс
    const userBalance = await db.getUserRubyCoins(interaction.user.id);
    const existingEmoji = await db.getCharacterCustomEmoji(characterId);
    
    // Если эмодзи уже есть - замена бесплатная, иначе платная
    const customEmojiPrice = shopConfig.customEmojiSettings?.basePrice || 20;
    const price = existingEmoji ? 0 : customEmojiPrice;

    if (userBalance < price) {
        return await interaction.reply({
            content: `❌ Недостаточно RubyCoins!\n💰 Нужно: ${price} RC\n💳 У вас: ${userBalance.toFixed(2)} RC`,
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Списываем деньги если это первая установка
        if (price > 0) {
            await db.removeRubyCoins(interaction.user.id, price);
        }

        let emojiData;
        
        // Если включена загрузка на сервер Discord
        if (shopConfig.customEmojiSettings?.uploadToBot) {
            try {
                emojiData = await uploadEmojiToGuild(interaction.client, emojiUrl, emojiName);
                console.log(`✅ Эмодзи загружено на Discord сервер: ${emojiData.identifier}`);
                
                // Сохраняем данные Discord эмодзи
                await db.setCharacterCustomEmoji(characterId, emojiData.url, emojiData.name, {
                    discord_emoji_id: emojiData.id,
                    discord_emoji_identifier: emojiData.identifier,
                    animated: emojiData.animated,
                    original_url: emojiUrl
                });

                await interaction.editReply({
                    content: `✅ **Кастомное эмодзи загружено в бота!**\n\n${emojiData.identifier} **${emojiData.name}**\n💰 **Потрачено:** ${price} RubyCoins\n\n*Эмодзи теперь является частью сервера и будет отображаться в профиле персонажа как настоящее Discord эмодзи!*`
                });
            } catch (uploadError) {
                console.error('Ошибка загрузки в Discord, используем URL:', uploadError);
                
                // Fallback на обычный URL если загрузка не удалась
                await db.setCharacterCustomEmoji(characterId, emojiUrl, emojiName);

                await interaction.editReply({
                    content: `✅ **Кастомное эмодзи установлено!**\n\n🖼️ **Название:** ${emojiName}\n💰 **Потрачено:** ${price} RubyCoins\n\n⚠️ *Не удалось загрузить в Discord (${uploadError.message}), используется прямая ссылка.*`
                });
            }
        } else {
            // Просто сохраняем URL без загрузки
            await db.setCharacterCustomEmoji(characterId, emojiUrl, emojiName);

            await interaction.editReply({
                content: `✅ **Кастомное эмодзи установлено!**\n\n🖼️ **Название:** ${emojiName}\n💰 **Потрачено:** ${price} RubyCoins\n\n*Эмодзи будет отображаться в профиле персонажа.*`
            });
        }
    } catch (error) {
        console.error('Ошибка установки эмодзи:', error);
        
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ Произошла ошибка при установке эмодзи!'
            });
        } else {
            await interaction.reply({
                content: '❌ Произошла ошибка при установке эмодзи!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

/**
 * Купить разделитель
 */
async function handlePurchase(interaction, characterId, separatorId) {
    try {
        const result = await db.purchaseSeparator(interaction.user.id, parseInt(separatorId));
        
        await interaction.reply({
            content: `✅ **Разделитель куплен!**\n\n🎁 **${result.separator.name}**\n💰 **Потрачено:** ${result.spent} RubyCoins\n\n*Теперь вы можете активировать его в разделе "Мои разделители".*`,
            flags: MessageFlags.Ephemeral
        });

        // Обновляем каталог
        setTimeout(() => showCatalog(interaction, characterId), 1000);
    } catch (error) {
        await interaction.reply({
            content: `❌ Ошибка покупки: ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
}

/**
 * Активировать разделитель для персонажа
 */
async function handleActivation(interaction, characterId, separatorId) {
    try {
        // Проверяем, что пользователь владеет этим разделителем
        const hasIt = await db.hasUserSeparator(interaction.user.id, parseInt(separatorId));
        if (!hasIt) {
            return await interaction.reply({
                content: '❌ Вы не владеете этим разделителем!',
                flags: MessageFlags.Ephemeral
            });
        }

        await db.setCharacterActiveSeparator(characterId, parseInt(separatorId), false);

        const separator = await db.getSeparatorById(parseInt(separatorId));

        await interaction.reply({
            content: `✅ **Разделитель активирован!**\n\n✨ **${separator.name}** теперь установлен для этого персонажа.\n\n*Откройте профиль снова, чтобы увидеть изменения.*`,
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Ошибка активации разделителя:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при активации разделителя!',
            flags: MessageFlags.Ephemeral
        });
    }
}

/**
 * Удалить кастомное эмодзи
 */
async function handleEmojiDelete(interaction, characterId) {
    try {
        await db.deleteCharacterCustomEmoji(characterId);
        
        await interaction.reply({
            content: '✅ Кастомное эмодзи удалено!',
            flags: MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error('Ошибка удаления эмодзи:', error);
        await interaction.reply({
            content: '❌ Произошла ошибка при удалении эмодзи!',
            flags: MessageFlags.Ephemeral
        });
    }
}

/**
 * Главный обработчик взаимодействий магазина
 */
async function handleSeparatorShopInteraction(interaction) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const characterId = parts[parts.length - 1];

    if (!hasShopAccess(interaction.member)) {
        return await interaction.reply({
            content: '❌ У вас нет доступа к покупке оформления!',
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        // Главное меню
        if (customId.startsWith('sep_shop_main_')) {
            await showSeparatorShop(interaction, characterId);
        }
        // Навигация по Select Menu (старая логика для совместимости)
        else if (customId.startsWith('shop_nav_')) {
            const action = interaction.values[0];
            if (action === 'catalog_sep') await showCatalog(interaction, characterId, 0, 'sep');
            else if (action === 'catalog_emoji') await showCatalog(interaction, characterId, 0, 'emoji');
            else if (action === 'my_items') await showMyItems(interaction, characterId, 'sep');
            else if (action === 'custom_emoji') await showCustomEmojiMenu(interaction, characterId);
        }
        // Мои покупки через кнопку
        else if (customId.startsWith('shop_myitems_')) {
            const tab = parts[2]; // sep или emoji
            await showMyItems(interaction, characterId, tab);
        }
        // Пагинация каталога
        else if (customId.startsWith('shop_page_')) {
            const type = parts[2]; // sep или emoji
            const page = parseInt(parts[3]);
            await showCatalog(interaction, characterId, page, type);
        }
        // Превью товара
        else if (customId.startsWith('shop_preview_')) {
            const type = parts[2];
            const itemId = interaction.values[0];
            await showItemPreview(interaction, characterId, itemId, type);
        }
        // Покупка товара
        else if (customId.startsWith('shop_buy_')) {
            const type = parts[2];
            const itemId = parts[3];
            await handlePurchaseFromConfig(interaction, characterId, itemId, type);
        }
        // Применение товара
        else if (customId.startsWith('shop_apply_')) {
            const type = parts[2];
            const itemId = parts[3];
            await handleApplyItem(interaction, characterId, itemId, type);
        }
        // Возврат в каталог
        else if (customId.startsWith('shop_catalog_')) {
            const type = parts[2];
            const page = parseInt(parts[3]) || 0;
            await showCatalog(interaction, characterId, page, type);
        }
        // Табы в Мои покупки
        else if (customId.startsWith('shop_mytab_')) {
            const tab = parts[2];
            await showMyItems(interaction, characterId, tab);
        }
        // Активация разделителя
        else if (customId.startsWith('shop_activate_sep_')) {
            const separatorId = interaction.values[0];
            await handleActivation(interaction, characterId, separatorId);
        }
        // Активация эмодзи
        else if (customId.startsWith('shop_activate_emoji_')) {
            const emojiId = interaction.values[0];
            await handleEmojiActivation(interaction, characterId, emojiId);
        }
        // Добавление кастомного эмодзи
        else if (customId.startsWith('sep_shop_emoji_add_')) {
            await showEmojiModal(interaction, characterId);
        }
        else if (customId.startsWith('sep_shop_emoji_delete_')) {
            await handleEmojiDelete(interaction, characterId);
        }
        else if (customId.startsWith('sep_shop_emoji_')) {
            await showCustomEmojiMenu(interaction, characterId);
        }
        // Назад к профилю
        else if (customId.startsWith('sep_shop_back_')) {
            await interaction.update({
                content: '✅ Магазин закрыт. Используйте /профиль для просмотра изменений.',
                components: [],
                flags: MessageFlags.Ephemeral
            });
        }
        // Старые обработчики для совместимости
        else if (customId.startsWith('sep_shop_catalog_')) {
            await showCatalog(interaction, characterId, 0, 'sep');
        }
        else if (customId.startsWith('sep_shop_owned_')) {
            await showMyItems(interaction, characterId, 'sep');
        }
        else if (customId.startsWith('sep_shop_buy_')) {
            const separatorId = interaction.values[0];
            await handlePurchase(interaction, characterId, separatorId);
        }
        else if (customId.startsWith('sep_shop_activate_')) {
            const separatorId = interaction.values[0];
            await handleActivation(interaction, characterId, separatorId);
        }
    } catch (error) {
        console.error('Ошибка обработки магазина оформления:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Произошла ошибка! Попробуйте снова.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

/**
 * Обработчик модальных окон магазина
 */
async function handleSeparatorShopModal(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('sep_emoji_modal_')) {
        const characterId = customId.split('_')[3];
        await handleEmojiModalSubmit(interaction, characterId);
    }
}

/**
 * Проверка, может ли этот обработчик обработать взаимодействие
 */
function canHandle(interaction) {
    const customId = interaction.customId;
    if (!customId) return false;
    
    // Все паттерны магазина оформления
    return customId.startsWith('sep_shop_') || 
           customId.startsWith('sep_emoji_modal_') ||
           customId.startsWith('shop_nav_') ||
           customId.startsWith('shop_page_') ||
           customId.startsWith('shop_preview_') ||
           customId.startsWith('shop_buy_') ||
           customId.startsWith('shop_apply_') ||
           customId.startsWith('shop_catalog_') ||
           customId.startsWith('shop_mytab_') ||
           customId.startsWith('shop_myitems_') ||
           customId.startsWith('shop_activate_') ||
           customId.startsWith('shop_owned_');
}

/**
 * Выполнение обработки взаимодействия
 */
async function execute(interaction) {
    const customId = interaction.customId;
    
    // Модальные окна
    if (interaction.isModalSubmit()) {
        await handleSeparatorShopModal(interaction);
        return;
    }
    
    // Кнопки и Select меню
    await handleSeparatorShopInteraction(interaction);
}

module.exports = {
    canHandle,
    execute,
    showSeparatorShop,
    handleSeparatorShopInteraction,
    handleSeparatorShopModal,
    hasShopAccess,
    SHOP_ACCESS_ROLE_ID
};
