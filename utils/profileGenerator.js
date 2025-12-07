/**
 * Генератор изображений для профиля персонажа
 * - Шестиугольник характеристик (как в JoJo/One Piece)
 * - WANTED постер
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Тиры силы персонажа
const POWER_TIERS = [
    { tier: 'SSS', name: 'Йонко/Адмирал', minPower: 5000000000, color: '#FFD700', bgColor: '#8B0000' },
    { tier: 'SS', name: 'Командир Йонко', minPower: 500000000, color: '#FF6B6B', bgColor: '#4A0E0E' },
    { tier: 'S', name: 'Шичибукай', minPower: 200000000, color: '#FF4500', bgColor: '#2D1B00' },
    { tier: 'A+', name: 'Суперновая (Топ)', minPower: 80000, color: '#9932CC', bgColor: '#1A0A2E' },
    { tier: 'A', name: 'Суперновая', minPower: 50000, color: '#8A2BE2', bgColor: '#15082B' },
    { tier: 'B+', name: 'Капитан (Опытный)', minPower: 30000, color: '#4169E1', bgColor: '#0A1628' },
    { tier: 'B', name: 'Капитан', minPower: 15000, color: '#1E90FF', bgColor: '#081220' },
    { tier: 'C+', name: 'Офицер (Опытный)', minPower: 8000, color: '#32CD32', bgColor: '#0A200A' },
    { tier: 'C', name: 'Офицер', minPower: 4000, color: '#228B22', bgColor: '#061806' },
    { tier: 'D+', name: 'Рядовой (Опытный)', minPower: 2000, color: '#DAA520', bgColor: '#1A1500' },
    { tier: 'D', name: 'Рядовой', minPower: 1000, color: '#B8860B', bgColor: '#141000' },
    { tier: 'E', name: 'Новичок', minPower: 0, color: '#808080', bgColor: '#1A1A1A' }
];

// Параметры шестиугольника
const HEXAGON_STATS = [
    { key: 'power', name: 'СИЛА', nameEn: 'POWER', angle: -90 },
    { key: 'speed', name: 'СКОРОСТЬ', nameEn: 'SPEED', angle: -30 },
    { key: 'range', name: 'ДАЛЬНОСТЬ', nameEn: 'RANGE', angle: 30 },
    { key: 'durability', name: 'СТОЙКОСТЬ', nameEn: 'DURABILITY', angle: 90 },
    { key: 'precision', name: 'ТОЧНОСТЬ', nameEn: 'PRECISION', angle: 150 },
    { key: 'potential', name: 'ПОТЕНЦИАЛ', nameEn: 'POTENTIAL', angle: 210 }
];

/**
 * Вычислить общую силу персонажа
 */
function calculateTotalPower(character) {
    const strength = character.strength || 0;
    const agility = character.agility || 0;
    const reaction = character.reaction || 0;
    const accuracy = character.accuracy || 0;
    const hakivor = character.hakivor || 0;
    const hakinab = character.hakinab || 0;
    const hakiconq = character.hakiconq || 0;
    
    // Формула расчёта общей силы
    const baseStats = strength + agility + reaction + accuracy;
    const hakiBonus = (hakivor * 1.2) + (hakinab * 1.2) + (hakiconq * 2);
    
    return Math.floor(baseStats + hakiBonus);
}

/**
 * Определить тир силы
 */
function getPowerTier(totalPower) {
    for (const tier of POWER_TIERS) {
        if (totalPower >= tier.minPower) {
            return tier;
        }
    }
    return POWER_TIERS[POWER_TIERS.length - 1];
}

/**
 * Конвертировать статы в ранги A-E
 */
function statToRank(value, maxValue = 100000) {
    const percentage = Math.min((value / maxValue) * 100, 100);
    if (percentage >= 90) return { rank: 'A', value: 5 };
    if (percentage >= 70) return { rank: 'B', value: 4 };
    if (percentage >= 50) return { rank: 'C', value: 3 };
    if (percentage >= 30) return { rank: 'D', value: 2 };
    return { rank: 'E', value: 1 };
}

/**
 * Генерировать шестиугольник характеристик
 */
async function generateHexagonStats(character) {
    const size = 500;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 180;
    
    // Фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);
    
    // Золотая рамка
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size/2 - 10, 0, Math.PI * 2);
    ctx.stroke();
    
    // Внутренняя рамка
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size/2 - 25, 0, Math.PI * 2);
    ctx.stroke();
    
    // Белый круг внутри
    ctx.fillStyle = '#f5f5dc';
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius + 40, 0, Math.PI * 2);
    ctx.fill();
    
    // Сетка (линии от центра)
    ctx.strokeStyle = '#cc6600';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(angle) * maxRadius,
            centerY + Math.sin(angle) * maxRadius
        );
        ctx.stroke();
    }
    
    // Концентрические шестиугольники (уровни A-E)
    const levels = ['E', 'D', 'C', 'B', 'A'];
    for (let level = 1; level <= 5; level++) {
        const radius = (maxRadius / 5) * level;
        ctx.strokeStyle = '#cc6600';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60 - 90) * Math.PI / 180;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    
    // Подписи уровней (A, B, C, D, E)
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    for (let level = 1; level <= 5; level++) {
        const radius = (maxRadius / 5) * level;
        ctx.fillText(levels[level - 1], centerX + 5, centerY - radius + 15);
    }
    
    // Получаем значения статов
    const stats = {
        power: character.strength || 0,
        speed: character.agility || 0,
        range: character.accuracy || 0, // Используем точность как дальность
        durability: character.reaction || 0, // Реакция как стойкость
        precision: character.accuracy || 0,
        potential: Math.floor(((character.hakivor || 0) + (character.hakinab || 0) + (character.hakiconq || 0)) / 3)
    };
    
    // Рисуем заполненный шестиугольник статов
    ctx.fillStyle = 'rgba(135, 206, 250, 0.6)';
    ctx.strokeStyle = '#4169e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const statPoints = [];
    HEXAGON_STATS.forEach((stat, i) => {
        const rank = statToRank(stats[stat.key]);
        const radius = (maxRadius / 5) * rank.value;
        const angle = stat.angle * Math.PI / 180;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        statPoints.push({ x, y, rank: rank.rank });
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Точки на вершинах
    statPoints.forEach(point => {
        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Подписи статов и рангов
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    
    HEXAGON_STATS.forEach((stat, i) => {
        const rank = statToRank(stats[stat.key]);
        const labelRadius = maxRadius + 55;
        const angle = stat.angle * Math.PI / 180;
        const x = centerX + Math.cos(angle) * labelRadius;
        const y = centerY + Math.sin(angle) * labelRadius;
        
        // Ранг (красная буква)
        ctx.fillStyle = '#cc0000';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(rank.rank, x, y - 8);
        
        // Название стата
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(stat.nameEn, x, y + 8);
        
        // Японское название
        ctx.fillStyle = '#666666';
        ctx.font = '9px Arial';
        ctx.fillText(stat.name, x, y + 20);
    });
    
    return canvas.toBuffer('image/png');
}

/**
 * Генерировать WANTED постер
 */
async function generateWantedPoster(character, avatarUrl) {
    const width = 400;
    const height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Фон (старая бумага)
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f4e4bc');
    gradient.addColorStop(0.5, '#e8d5a3');
    gradient.addColorStop(1, '#d4c089');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Эффект потёртости
    ctx.fillStyle = 'rgba(139, 90, 43, 0.1)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 20 + 5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Рамка
    ctx.strokeStyle = '#5c3d2e';
    ctx.lineWidth = 8;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 3;
    ctx.strokeRect(25, 25, width - 50, height - 50);
    
    // WANTED текст
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', width / 2, 75);
    
    // Подзаголовок
    ctx.font = 'italic 14px serif';
    ctx.fillStyle = '#5c3d2e';
    ctx.fillText('DEAD OR ALIVE', width / 2, 95);
    
    // Рамка для фото
    const photoX = 50;
    const photoY = 115;
    const photoW = width - 100;
    const photoH = 250;
    
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(photoX - 5, photoY - 5, photoW + 10, photoH + 10);
    
    // Загружаем аватар
    try {
        if (avatarUrl) {
            const avatar = await loadImage(avatarUrl);
            ctx.drawImage(avatar, photoX, photoY, photoW, photoH);
        } else {
            // Заглушка если нет аватара
            ctx.fillStyle = '#3a2a1a';
            ctx.fillRect(photoX, photoY, photoW, photoH);
            ctx.fillStyle = '#8b5a2b';
            ctx.font = 'bold 20px serif';
            ctx.fillText('NO PHOTO', width / 2, photoY + photoH / 2);
        }
    } catch (e) {
        // Ошибка загрузки - рисуем заглушку
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(photoX, photoY, photoW, photoH);
        ctx.fillStyle = '#8b5a2b';
        ctx.font = 'bold 20px serif';
        ctx.fillText('NO PHOTO', width / 2, photoY + photoH / 2);
    }
    
    // Имя персонажа
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px serif';
    ctx.fillText(character.name || 'UNKNOWN', width / 2, 405);
    
    // Прозвище
    if (character.nickname) {
        ctx.font = 'italic 16px serif';
        ctx.fillStyle = '#5c3d2e';
        ctx.fillText(`"${character.nickname}"`, width / 2, 428);
    }
    
    // Награда
    const bounty = character.bounty || 0;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px serif';
    ctx.fillText('REWARD', width / 2, 465);
    
    // Сумма награды
    ctx.font = 'bold 32px serif';
    ctx.fillStyle = '#8b0000';
    
    let bountyText;
    if (bounty >= 1000000000) {
        bountyText = `${(bounty / 1000000000).toFixed(1)}B`;
    } else if (bounty >= 1000000) {
        bountyText = `${(bounty / 1000000).toFixed(0)}M`;
    } else if (bounty >= 1000) {
        bountyText = `${(bounty / 1000).toFixed(0)}K`;
    } else {
        bountyText = bounty.toLocaleString();
    }
    
    ctx.fillText(`฿ ${bountyText}`, width / 2, 500);
    
    // Подпись морского дозора
    ctx.fillStyle = '#5c3d2e';
    ctx.font = 'italic 12px serif';
    ctx.fillText('— MARINE —', width / 2, 535);
    
    return canvas.toBuffer('image/png');
}

/**
 * Генерировать карточку тира силы
 */
async function generateTierCard(character) {
    const totalPower = calculateTotalPower(character);
    const tier = getPowerTier(totalPower);
    
    const width = 450;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Фон с градиентом тира
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, tier.bgColor);
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Рамка цвета тира
    ctx.strokeStyle = tier.color;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, width - 10, height - 10);
    
    // Тир (большая буква)
    ctx.fillStyle = tier.color;
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(tier.tier, 30, 120);
    
    // Название тира
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(tier.name, 150, 70);
    
    // Имя персонажа
    ctx.fillStyle = tier.color;
    ctx.font = 'bold 20px Arial';
    ctx.fillText(character.name || 'Unknown', 150, 100);
    
    // Общая сила
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px Arial';
    ctx.fillText(`Общая сила: ${totalPower.toLocaleString()}`, 150, 130);
    
    // Прогресс бар до следующего тира
    const currentTierIndex = POWER_TIERS.findIndex(t => t.tier === tier.tier);
    const nextTier = POWER_TIERS[currentTierIndex - 1];
    
    if (nextTier) {
        const progress = (totalPower - tier.minPower) / (nextTier.minPower - tier.minPower);
        const barWidth = 250;
        const barHeight = 15;
        const barX = 150;
        const barY = 150;
        
        // Фон бара
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Заполнение
        ctx.fillStyle = tier.color;
        ctx.fillRect(barX, barY, barWidth * Math.min(progress, 1), barHeight);
        
        // Текст
        ctx.fillStyle = '#888888';
        ctx.font = '12px Arial';
        ctx.fillText(`До ${nextTier.tier}: ${(nextTier.minPower - totalPower).toLocaleString()}`, barX, barY + 30);
    } else {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'italic 14px Arial';
        ctx.fillText('Максимальный уровень!', 150, 160);
    }
    
    return canvas.toBuffer('image/png');
}

module.exports = {
    generateHexagonStats,
    generateWantedPoster,
    generateTierCard,
    calculateTotalPower,
    getPowerTier,
    POWER_TIERS,
    HEXAGON_STATS
};

