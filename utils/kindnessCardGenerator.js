// ==================== utils/kindnessCardGenerator.js ====================
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

// Регистрация шрифта
const fontPath = path.join(__dirname, '../fonts/Gilroy-Light.ttf');
if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Gilroy' });
}

// Массив атмосферных цветовых схем (градиенты)
const colorSchemes = [
    { start: '#FF6B9D', end: '#C06C84', accent: '#FFFFFF' }, // Розовый
    { start: '#A8E6CF', end: '#3DDC97', accent: '#FFFFFF' }, // Мятный
    { start: '#FFD93D', end: '#F95738', accent: '#FFFFFF' }, // Солнечный
    { start: '#6C5CE7', end: '#A29BFE', accent: '#FFFFFF' }, // Фиолетовый
    { start: '#74B9FF', end: '#0984E3', accent: '#FFFFFF' }, // Голубой
    { start: '#FD79A8', end: '#E84393', accent: '#FFFFFF' }, // Малиновый
    { start: '#FDCB6E', end: '#E17055', accent: '#FFFFFF' }, // Персиковый
    { start: '#00B894', end: '#00CEC9', accent: '#FFFFFF' }, // Бирюзовый
];

// Функция для создания градиента
function createGradient(ctx, width, height, startColor, endColor) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    return gradient;
}

// Функция переноса текста
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// Основная функция генерации карточки
async function generateKindnessCard(senderName, recipientName, message) {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Выбираем случайную цветовую схему
    const scheme = colorSchemes[Math.floor(Math.random() * colorSchemes.length)];

    // Заливаем фон градиентом
    const gradient = createGradient(ctx, width, height, scheme.start, scheme.end);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Рисуем полупрозрачные декоративные круги
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = scheme.accent;
    
    ctx.beginPath();
    ctx.arc(150, 100, 120, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(650, 450, 150, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(700, 150, 80, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;

    // Рисуем центральную карточку (белый прямоугольник с тенью)
    const cardPadding = 60;
    const cardX = cardPadding;
    const cardY = cardPadding;
    const cardWidth = width - cardPadding * 2;
    const cardHeight = height - cardPadding * 2;

    // Тень
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 20);
    ctx.fill();

    // Убираем тень для текста
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Эмодзи сердца
    ctx.font = '60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('💌', width / 2, cardY + 80);

    // Заголовок
    ctx.font = '32px Gilroy, sans-serif';
    ctx.fillStyle = scheme.start;
    ctx.textAlign = 'center';
    ctx.fillText('Открытка', width / 2, cardY + 140);

    // Линия-разделитель
    ctx.strokeStyle = scheme.start;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 150, cardY + 160);
    ctx.lineTo(width - cardX - 150, cardY + 160);
    ctx.stroke();

    // От кого
    ctx.font = '22px Gilroy, sans-serif';
    ctx.fillStyle = '#555555';
    ctx.textAlign = 'left';
    ctx.fillText('От:', cardX + 50, cardY + 210);
    
    ctx.font = 'bold 22px Gilroy, sans-serif';
    ctx.fillStyle = scheme.end;
    ctx.fillText(senderName, cardX + 90, cardY + 210);

    // Кому
    ctx.font = '22px Gilroy, sans-serif';
    ctx.fillStyle = '#555555';
    ctx.fillText('Для:', cardX + 50, cardY + 250);
    
    ctx.font = 'bold 22px Gilroy, sans-serif';
    ctx.fillStyle = scheme.end;
    ctx.fillText(recipientName, cardX + 110, cardY + 250);

    // Сообщение (с переносом строк)
    ctx.font = '20px Gilroy, sans-serif';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    
    const maxMessageWidth = cardWidth - 100;
    const lines = wrapText(ctx, message, maxMessageWidth);
    
    let messageY = cardY + 320;
    const lineHeight = 30;
    
    lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, messageY + index * lineHeight);
    });

    // Нижняя декоративная линия
    ctx.strokeStyle = scheme.start;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 150, cardHeight + cardY - 40);
    ctx.lineTo(width - cardX - 150, cardHeight + cardY - 40);
    ctx.stroke();

    // Футер
    ctx.font = '18px Gilroy, sans-serif';
    ctx.fillStyle = '#999999';
    ctx.textAlign = 'center';
    ctx.fillText('День доброты', width / 2, cardHeight + cardY - 10);

    return canvas.toBuffer('image/png');
}

module.exports = { generateKindnessCard };
