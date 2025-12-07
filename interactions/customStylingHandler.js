// interactions/customStylingHandler.js
const { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  MessageFlags 
} = require('discord.js');
const Database = require('../database');
const db = new Database();

const ADMIN_ROLE_ID = '1381909203005866034';

// Импорт команды профиля для очистки кэша
let profileCommand;
try {
  profileCommand = require('../commands/profile');
} catch (error) {
  console.error('⚠️ Не удалось импортировать profile.js для очистки кэша:', error);
}

/**
 * Валидация URL изображений с поддержкой Discord CDN
 */
function isValidImageUrl(url) {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    
    // Discord CDN - всегда разрешаем
    if (
      parsed.hostname === 'media.discordapp.net' || 
      parsed.hostname === 'cdn.discordapp.com' ||
      parsed.hostname === 'images-ext-1.discordapp.net' ||
      parsed.hostname === 'images-ext-2.discordapp.net'
    ) {
      return true;
    }
    
    // Для остальных URL проверяем расширение файла
    const pathname = parsed.pathname.toLowerCase();
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    
    return validExtensions.some(ext => pathname.endsWith(ext));
  } catch (error) {
    return false;
  }
}

/**
 * Обработчик выбора пункта меню "Кастомное оформление"
 * Показывает модальное окно с текущими настройками разделителей
 */
async function handleCustomStylingMenu(interaction) {
  // Проверка роли администратора
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
    return await interaction.reply({
      content: '❌ У вас нет доступа к кастомному оформлению! Требуется роль администратора.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Извлекаем ID персонажа из customId
  const parts = interaction.customId.split('_');
  const characterId = parts[parts.length - 1];

  // Получаем данные персонажа
  const character = await db.getCharacterById(characterId);
  if (!character) {
    return await interaction.reply({
      content: '❌ Персонаж не найден!',
      flags: MessageFlags.Ephemeral
    });
  }

  // Загружаем текущие настройки оформления (если есть)
  let current = null;
  if (typeof db.getCustomStyling === 'function') {
    try {
      current = await db.getCustomStyling(characterId);
    } catch (error) {
      console.error('Ошибка загрузки кастомного оформления:', error);
    }
  }

  // Создаём модальное окно
  const modal = new ModalBuilder()
    .setCustomId(`customstyling_modal_${characterId}`)
    .setTitle(`✨ Оформление: ${character.name.slice(0, 30)}`);

  // Поле 1: URL первого разделителя
  const separator1Input = new TextInputBuilder()
    .setCustomId('separator1url')
    .setLabel('URL разделителя 1 (PNG/JPG/WebP/Discord CDN)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://media.discordapp.net/attachments/...')
    .setRequired(false)
    .setValue(current?.separator1url || '');

  // Поле 2: URL второго разделителя
  const separator2Input = new TextInputBuilder()
    .setCustomId('separator2url')
    .setLabel('URL разделителя 2 (для чередования)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://media.discordapp.net/attachments/...')
    .setRequired(false)
    .setValue(current?.separator2url || '');

  // Поле 3: Ширина
  const widthInput = new TextInputBuilder()
    .setCustomId('separatorwidth')
    .setLabel('Ширина разделителя (px)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('250')
    .setRequired(false)
    .setMaxLength(4)
    .setValue(String(current?.separatorwidth ?? 250));

  // Поле 4: Высота
  const heightInput = new TextInputBuilder()
    .setCustomId('separatorheight')
    .setLabel('Высота разделителя (px)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('60')
    .setRequired(false)
    .setMaxLength(4)
    .setValue(String(current?.separatorheight ?? 60));

  // Поле 5: Настройки
  const flagsInput = new TextInputBuilder()
    .setCustomId('flags')
    .setLabel('Настройки (recolor=да/нет; alternate=да/нет)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('recolor=да; alternate=да')
    .setRequired(false)
    .setMaxLength(50)
    .setValue(
      `recolor=${current?.enablerecolor ? 'да' : 'нет'}; alternate=${current?.enablealternate ? 'да' : 'нет'}`
    );

  // Добавляем поля в модальное окно
  modal.addComponents(
    new ActionRowBuilder().addComponents(separator1Input),
    new ActionRowBuilder().addComponents(separator2Input),
    new ActionRowBuilder().addComponents(widthInput),
    new ActionRowBuilder().addComponents(heightInput),
    new ActionRowBuilder().addComponents(flagsInput)
  );

  await interaction.showModal(modal);
}

/**
 * Обработчик отправки модального окна с настройками оформления
 */
async function handleCustomStylingModal(interaction) {
  // Проверка роли
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
    return await interaction.reply({
      content: '❌ У вас нет доступа к кастомному оформлению!',
      flags: MessageFlags.Ephemeral
    });
  }

  const characterId = interaction.customId.split('_')[2];

  // Получаем значения полей
  const s1 = interaction.fields.getTextInputValue('separator1url').trim() || null;
  const s2 = interaction.fields.getTextInputValue('separator2url').trim() || null;
  const wRaw = interaction.fields.getTextInputValue('separatorwidth').trim();
  const hRaw = interaction.fields.getTextInputValue('separatorheight').trim();
  const flagsText = interaction.fields.getTextInputValue('flags').toLowerCase();

  const w = parseInt(wRaw) || 250;
  const h = parseInt(hRaw) || 60;

  // Валидация размеров
  if (w < 50 || w > 2000) {
    return await interaction.reply({
      content: '❌ Ширина должна быть от 50 до 2000 пикселей.',
      flags: MessageFlags.Ephemeral
    });
  }
  if (h < 20 || h > 500) {
    return await interaction.reply({
      content: '❌ Высота должна быть от 20 до 500 пикселей.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Валидация URL
  if (s1 && !isValidImageUrl(s1)) {
    return await interaction.reply({
      content: '❌ Неверный формат URL для разделителя 1.\n' +
               '✅ Поддерживаются:\n' +
               '• Discord CDN (media.discordapp.net, cdn.discordapp.com)\n' +
               '• Прямые ссылки на PNG/JPG/WebP/GIF',
      flags: MessageFlags.Ephemeral
    });
  }

  if (s2 && !isValidImageUrl(s2)) {
    return await interaction.reply({
      content: '❌ Неверный формат URL для разделителя 2.\n' +
               '✅ Поддерживаются:\n' +
               '• Discord CDN (media.discordapp.net, cdn.discordapp.com)\n' +
               '• Прямые ссылки на PNG/JPG/WebP/GIF',
      flags: MessageFlags.Ephemeral
    });
  }

  // Парсинг флагов
  const enablerecolor = flagsText.includes('recolor=да') || flagsText.includes('recolor = да');
  const enablealternate = flagsText.includes('alternate=да') || flagsText.includes('alternate = да');

  // Проверка поддержки базой данных
  if (typeof db.setCustomStyling !== 'function') {
    return await interaction.reply({
      content: '❌ База данных не поддерживает кастомное оформление. Добавьте методы в database.js.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    // Сохраняем настройки в базу данных
    await db.setCustomStyling(characterId, {
      separator1url: s1,
      separator2url: s2,
      separatorwidth: w,
      separatorheight: h,
      enablerecolor,
      enablealternate
    });

    // КРИТИЧЕСКИ ВАЖНО: Очищаем кэш для этого персонажа
    if (profileCommand && typeof profileCommand.clearStylingCache === 'function') {
      profileCommand.clearStylingCache(characterId);
      console.log(`✅ Кэш оформления очищен для персонажа ${characterId}`);
    }

    const savedSettings = [
      `🖼️ **Разделитель 1:** ${s1 ? '✅ Установлен' : '❌ Не указан'}`,
      `🖼️ **Разделитель 2:** ${s2 ? '✅ Установлен' : '❌ Не указан'}`,
      `📏 **Размеры:** ${w}×${h} px`,
      `🎨 **Перекраска:** ${enablerecolor ? '✅ Включена' : '❌ Выключена'}`,
      `🔄 **Чередование:** ${enablealternate ? '✅ Включено' : '❌ Выключено'}`
    ].join('\n');

    await interaction.reply({
      content: 
        `✅ **Кастомное оформление сохранено!**\n\n${savedSettings}\n\n` +
        `💡 *Откройте профиль снова — изменения уже применены!*`,
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    console.error('Ошибка сохранения кастомного оформления:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при сохранении настроек оформления.',
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = {
  handleCustomStylingMenu,
  handleCustomStylingModal
};
