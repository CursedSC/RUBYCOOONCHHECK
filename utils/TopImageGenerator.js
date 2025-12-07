const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

class TopImageGenerator {
    constructor() {
        // Регистрируем шрифты если есть
        try {
            registerFont(path.join(__dirname, '../fonts/arial.ttf'), { family: 'Arial' });
        } catch (error) {
            console.log('Шрифт не найден, используется системный');
        }
    }

    async generateTopImage(characters, currentPage, totalPages) {
        // Создаем canvas 512x512
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');

        // Загружаем фоновое изображение top_1bg
        try {
            const backgroundImage = await loadImage('./images/top_1bg.png'); // или .jpg
            ctx.drawImage(backgroundImage, 0, 0, 512, 512);
        } catch (error) {
            console.error('Ошибка загрузки фона:', error);
            // Заливаем градиентом если фон не загрузился
            const gradient = ctx.createLinearGradient(0, 0, 0, 512);
            gradient.addColorStop(0, '#2C2F33');
            gradient.addColorStop(1, '#23272A');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
        }

        // Координаты для цифр топа
        const rankPositions = [
            { x: 50, y: 140 }, // 1 место
            { x: 50, y: 280 }, // 2 место  
            { x: 50, y: 420 }, // 3 место
            { x: 50, y: 540 }, // 4 место
            { x: 50, y: 660 }  // 5 место
        ];

        // Координаты для иконок (111x111)
        const iconPositions = [
            { x: 111, y: 130 }, // 1 иконка
            { x: 111, y: 307 }, // 2 иконка
            { x: 111, y: 480 }, // 3 иконка
            { x: 111, y: 671 }, // 4 иконка
            { x: 111, y: 847 }  // 5 иконка
        ];

        // Координаты для имен персонажей
        const namePositions = [
            { x: 330, y: 139 }, // 1 имя
            { x: 301, y: 314 }, // 2 имя
            { x: 369, y: 496 }, // 3 имя
            { x: 424, y: 676 }, // 4 имя
            { x: 514, y: 856 }  // 5 имя
        ];

        for (let i = 0; i < Math.min(characters.length, 5); i++) {
            const character = characters[i];
            const globalRank = ((currentPage - 1) * 5) + i + 1;

            // Рисуем номер места
            ctx.fillStyle = this.getRankColor(globalRank);
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`#${globalRank}`, rankPositions[i].x, rankPositions[i].y);

            // Рисуем иконку персонажа
            try {
                if (character.icon_url) {
                    const iconImage = await loadImage(character.icon_url);
                    
                    // Создаем круглую маску для иконки
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(iconPositions[i].x + 55.5, iconPositions[i].y + 55.5, 55.5, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(iconImage, iconPositions[i].x, iconPositions[i].y, 111, 111);
                    ctx.restore();
                    
                    // Добавляем рамку
                    ctx.strokeStyle = this.getRankColor(globalRank);
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(iconPositions[i].x + 55.5, iconPositions[i].y + 55.5, 55.5, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    // Рисуем placeholder если нет иконки
                    ctx.fillStyle = '#36393F';
                    ctx.beginPath();
                    ctx.arc(iconPositions[i].x + 55.5, iconPositions[i].y + 55.5, 55.5, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('НЕТ', iconPositions[i].x + 55.5, iconPositions[i].y + 50);
                    ctx.fillText('ФОТО', iconPositions[i].x + 55.5, iconPositions[i].y + 70);
                }
            } catch (error) {
                console.error('Ошибка загрузки иконки:', error);
                // Рисуем placeholder
                ctx.fillStyle = '#36393F';
                ctx.beginPath();
                ctx.arc(iconPositions[i].x + 55.5, iconPositions[i].y + 55.5, 55.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Рисуем имя персонажа
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'left';
            const maxNameWidth = 150;
            const truncatedName = this.truncateText(ctx, character.name, maxNameWidth);
            ctx.fillText(truncatedName, namePositions[i].x, namePositions[i].y);

            // Рисуем ID и характеристики (на 10 пикселей ниже имени)
            ctx.fillStyle = '#B9BBBE';
            ctx.font = '14px Arial';
            ctx.fillText(`ID: ${character.id}`, namePositions[i].x, namePositions[i].y + 10);
            ctx.fillText(`Сила: ${character.total_stats.toLocaleString()}`, namePositions[i].x, namePositions[i].y + 30);
        }

        return canvas.toBuffer('image/png');
    }

    getRankColor(rank) {
        switch (rank) {
            case 1: return '#FFD700'; // Золотой
            case 2: return '#C0C0C0'; // Серебряный
            case 3: return '#CD7F32'; // Бронзовый
            default: return '#FFFFFF'; // Белый
        }
    }

    truncateText(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) {
            return text;
        }
        
        let truncated = text;
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
    }
}

module.exports = TopImageGenerator;
