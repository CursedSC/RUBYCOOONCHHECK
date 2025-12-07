const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, registerFont } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');
const path = require('path');

const dfData = require('../df.json');
const fruits = dfData.df;

const ALLOWED_ROLE_ID = '1381909203005866034';

const SLOT_WIDTH = 1920;
const SLOT_HEIGHT = 1080;
const ITEM_HEIGHT = 120;
const VISIBLE_ITEMS = 7;
const TOTAL_SPIN_ITEMS = 50;
const FRAME_COUNT = 100;
const SLOWDOWN_FRAMES = 40;
const FINAL_FRAMES = 35;
const FRAME_DELAY = 50;

const fontPath = path.join(__dirname, '../fonts/Gilroy-Light.ttf');
if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: 'Gilroy' });
}

// КЕШИРОВАНИЕ ГРАДИЕНТОВ И ЦВЕТОВ
const gradientCache = new Map();
const colorCache = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('кейс')
        .setDescription('Открыть кейс с Дьявольским Плодом'),

    async execute(interaction) {
        const member = interaction.member;
        if (!member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return await interaction.reply({
                content: 'У вас нет доступа к этой команде! Требуется специальная роль.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            const spinItems = [];
            for (let i = 0; i < TOTAL_SPIN_ITEMS; i++) {
                spinItems.push(fruits[Math.floor(Math.random() * fruits.length)]);
            }

            const wonFruit = spinItems[TOTAL_SPIN_ITEMS - Math.floor(VISIBLE_ITEMS / 2) - 1];

            const startEmbed = new EmbedBuilder()
                .setTitle('КЕЙС ДЬЯВОЛЬСКИХ ПЛОДОВ')
                .setDescription('Генерация анимации...\nПодготовка слот-машины...')
                .setColor('#FF6B6B')
                .setTimestamp();

            await interaction.editReply({ embeds: [startEmbed] });

            const gifBuffer = await createSlotMachineGIF(spinItems, wonFruit);

            const tempPath = path.join(__dirname, '..', 'temp', 'case_' + interaction.user.id + '_' + Date.now() + '.gif');
            const tempDir = path.join(__dirname, '..', 'temp');
            
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(tempPath, gifBuffer);

            const spinningEmbed = new EmbedBuilder()
                .setTitle('КЕЙС ДЬЯВОЛЬСКИХ ПЛОДОВ')
                .setDescription('Прокрутка началась!\nСледите за результатом...')
                .setColor('#FFA500')
                .setImage('attachment://slot_machine.gif')
                .setFooter({ text: 'Открывает: ' + interaction.user.username })
                .setTimestamp();

            const attachment = new AttachmentBuilder(tempPath, { name: 'slot_machine.gif' });

            await interaction.editReply({ 
                embeds: [spinningEmbed],
                files: [attachment]
            });

            const animationDuration = (FRAME_COUNT + SLOWDOWN_FRAMES + FINAL_FRAMES) * FRAME_DELAY;
            await new Promise(resolve => setTimeout(resolve, animationDuration + 2000));

            const rarityEmoji = getRarityEmoji(wonFruit);
            const rarityColor = getRarityColor(wonFruit);
            const rarityName = getRarityName(wonFruit);

            const resultEmbed = new EmbedBuilder()
                .setTitle('РЕЗУЛЬТАТ ОТКРЫТИЯ КЕЙСА')
                .setDescription(
                    '================================\n' +
                    '       ВЫ ПОЛУЧИЛИ ФРУКТ:\n' +
                    '================================\n\n' +
                    rarityEmoji + ' ' + wonFruit + ' ' + rarityEmoji + '\n\n' +
                    'Редкость: ' + rarityName + '\n' +
                    'Шанс: ' + getDropChance(wonFruit) + '\n' +
                    'Владелец: ' + interaction.user.username
                )
                .setColor(rarityColor)
                .setFooter({ 
                    text: 'Открыл: ' + interaction.user.username + ' | ID: ' + interaction.user.id,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            const playAgainButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('case_again_' + interaction.user.id)
                        .setLabel('Открыть ещё раз')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('case_inventory_' + interaction.user.id)
                        .setLabel('Инвентарь')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('case_stats_' + interaction.user.id)
                        .setLabel('Статистика')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.followUp({ 
                embeds: [resultEmbed],
                components: [playAgainButton]
            });

            setTimeout(() => {
                try {
                    if (fs.existsSync(tempPath)) {
                        fs.unlinkSync(tempPath);
                    }
                } catch (err) {
                    console.error('Ошибка при удалении временного файла:', err);
                }
            }, 300000);

        } catch (error) {
            console.error('Ошибка при открытии кейса:', error);
            await interaction.editReply({
                content: 'Произошла ошибка при создании анимации кейса. Попробуйте позже.',
                embeds: [],
                components: [],
                files: []
            });
        }
    }
};

// ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ ТРИГОНОМЕТРИЧЕСКИХ ЗНАЧЕНИЙ
const sinCache = new Float32Array(360);
const cosCache = new Float32Array(360);
for (let i = 0; i < 360; i++) {
    const rad = (i * Math.PI) / 180;
    sinCache[i] = Math.sin(rad);
    cosCache[i] = Math.cos(rad);
}

function fastSin(angle) {
    return sinCache[Math.floor(Math.abs(angle * 57.2958)) % 360];
}

function fastCos(angle) {
    return cosCache[Math.floor(Math.abs(angle * 57.2958)) % 360];
}

async function createSlotMachineGIF(items, wonFruit) {
    const canvas = createCanvas(SLOT_WIDTH, SLOT_HEIGHT);
    const ctx = canvas.getContext('2d');

    // МАКСИМАЛЬНО БЫСТРЫЙ КОДИРОВЩИК
    const encoder = new GIFEncoder(SLOT_WIDTH, SLOT_HEIGHT, 'neuquant', false, 5);
    encoder.setQuality(30); // Баланс скорость/качество
    encoder.setDelay(FRAME_DELAY);
    encoder.setRepeat(0);
    encoder.start();

    let offset = 0;
    const maxOffset = (items.length - VISIBLE_ITEMS) * ITEM_HEIGHT;
    const particles = [];
    let screenShake = 0;
    let flashIntensity = 0;

    // ПРЕДВАРИТЕЛЬНЫЙ РАСЧЕТ ВСЕХ ЦВЕТОВ РЕДКОСТИ
    const itemColors = items.map(item => ({
        rgb: getRarityColorRGB(item),
        hex: getRarityColor(item),
        emoji: getRarityEmoji(item)
    }));

    // ФАЗА 1: Быстрая прокрутка (пропускаем каждый 2-й кадр для ускорения)
    for (let frame = 0; frame < FRAME_COUNT; frame += 2) {
        const progress = frame / FRAME_COUNT;
        offset = progress * maxOffset * 0.7;

        screenShake = fastSin(frame * 0.5) * 3;
        
        ctx.save();
        ctx.translate(screenShake, screenShake);
        
        drawBackgroundFast(ctx, frame, 0);
        drawSlotFrameFast(ctx, frame);
        drawSpinningItemsFast(ctx, items, itemColors, offset, frame, false);
        drawSpeedLinesFast(ctx, frame);
        drawCenterHighlightFast(ctx, frame);
        drawDecorationsFast(ctx, frame);
        
        ctx.restore();
        
        // Добавляем тот же кадр дважды для плавности
        encoder.addFrame(ctx);
        encoder.addFrame(ctx);
    }

    // ФАЗА 2: ДРАМАТИЧЕСКОЕ ЗАМЕДЛЕНИЕ
    for (let slowFrame = 0; slowFrame < SLOWDOWN_FRAMES; slowFrame++) {
        const slowProgress = slowFrame / SLOWDOWN_FRAMES;
        const slowEase = 1 - Math.pow(1 - slowProgress, 5);
        offset = maxOffset * 0.7 + (maxOffset * 0.3) * slowEase;

        if (slowFrame > SLOWDOWN_FRAMES - 10 && slowFrame < SLOWDOWN_FRAMES - 2) {
            offset += fastSin(slowFrame * 2) * 5;
        }

        screenShake = fastSin(slowFrame * 0.3) * (10 - slowProgress * 10);
        
        if (slowFrame === Math.floor(SLOWDOWN_FRAMES * 0.7)) {
            flashIntensity = 1;
        }
        flashIntensity *= 0.85;

        ctx.save();
        ctx.translate(screenShake, screenShake * 0.5);
        
        drawBackgroundFast(ctx, FRAME_COUNT + slowFrame, flashIntensity);
        drawSlotFrameFast(ctx, FRAME_COUNT + slowFrame);
        drawSpinningItemsFast(ctx, items, itemColors, offset, FRAME_COUNT + slowFrame, true);
        
        if (slowProgress > 0.6) {
            drawSlowMotionEffectFast(ctx, slowProgress);
        }
        
        drawCenterHighlightFast(ctx, FRAME_COUNT + slowFrame);
        drawTensionIndicatorFast(ctx, slowProgress);
        drawDecorationsFast(ctx, FRAME_COUNT + slowFrame);
        
        ctx.restore();
        
        if (slowFrame % 2 === 0) {
            for (let i = 0; i < 8; i++) {
                particles.push({
                    x: SLOT_WIDTH / 2 + (Math.random() - 0.5) * 400,
                    y: SLOT_HEIGHT / 2 + (Math.random() - 0.5) * 400,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    life: 25,
                    size: Math.random() * 12 + 6,
                    color: slowProgress > 0.7 ? 1 : 0
                });
            }
        }
        
        drawParticlesFast(ctx, particles);
        encoder.addFrame(ctx);
    }

    // ФАЗА 3: ЭПИЧНЫЙ ФИНАЛ
    for (let finalFrame = 0; finalFrame < FINAL_FRAMES; finalFrame++) {
        if (finalFrame < 5) {
            flashIntensity = 1.5 - (finalFrame / 5);
        }
        
        if (finalFrame < 8) {
            screenShake = (8 - finalFrame) * 5 * fastSin(finalFrame * 3);
        } else {
            screenShake = 0;
        }

        ctx.save();
        ctx.translate(screenShake, screenShake * 0.5);
        
        drawBackgroundFast(ctx, FRAME_COUNT + SLOWDOWN_FRAMES + finalFrame, flashIntensity);
        drawSlotFrameFast(ctx, FRAME_COUNT + SLOWDOWN_FRAMES + finalFrame);
        drawFinalResultFast(ctx, wonFruit, finalFrame);
        
        if (finalFrame < 15) {
            for (let i = 0; i < 12; i++) {
                const angle = i * Math.PI * 2 / 12;
                particles.push({
                    x: SLOT_WIDTH / 2,
                    y: SLOT_HEIGHT / 2,
                    vx: fastCos(angle) * (20 + finalFrame * 2),
                    vy: fastSin(angle) * (20 + finalFrame * 2),
                    life: 40,
                    size: Math.random() * 15 + 8,
                    color: 1
                });
            }
        }
        
        drawParticlesFast(ctx, particles);
        drawCelebrationEffectsFast(ctx, finalFrame);
        drawVictoryBurstFast(ctx, finalFrame);
        drawDecorationsFast(ctx, FRAME_COUNT + SLOWDOWN_FRAMES + finalFrame);
        
        ctx.restore();
        encoder.addFrame(ctx);
    }

    encoder.finish();
    return encoder.out.getData();
}

// ОПТИМИЗИРОВАННЫЕ ФУНКЦИИ РИСОВАНИЯ (убраны тяжелые операции)

function drawBackgroundFast(ctx, frame, flashIntensity) {
    const pulse = fastSin(frame / 20) * 0.1 + 0.9;
    
    if (!gradientCache.has('bg')) {
        const gradient = ctx.createRadialGradient(SLOT_WIDTH / 2, SLOT_HEIGHT / 2, 0, SLOT_WIDTH / 2, SLOT_HEIGHT / 2, SLOT_WIDTH);
        gradient.addColorStop(0, '#2a1a4a');
        gradient.addColorStop(0.4, '#1a0f2e');
        gradient.addColorStop(1, '#000000');
        gradientCache.set('bg', gradient);
    }
    ctx.fillStyle = gradientCache.get('bg');
    ctx.fillRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);

    // Упрощенные лучи (только каждый 3-й)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.translate(SLOT_WIDTH / 2, SLOT_HEIGHT / 2);
    ctx.rotate((frame * Math.PI) / 40);
    
    for (let i = 0; i < 12; i += 3) {
        ctx.rotate(Math.PI / 2);
        if (!gradientCache.has('ray')) {
            const rayGradient = ctx.createLinearGradient(0, 0, 0, SLOT_HEIGHT);
            rayGradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
            rayGradient.addColorStop(0.5, 'rgba(255, 100, 255, 0.3)');
            rayGradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
            gradientCache.set('ray', rayGradient);
        }
        ctx.fillStyle = gradientCache.get('ray');
        ctx.fillRect(-60, 0, 120, SLOT_HEIGHT);
    }
    
    ctx.restore();

    if (flashIntensity > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (flashIntensity * 0.6) + ')';
        ctx.fillRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);
    }
}

function drawSlotFrameFast(ctx, frame) {
    const glowIntensity = fastSin(frame / 8) * 0.4 + 0.8;
    
    // Только внешняя рамка (убираем тройную)
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 0, ' + glowIntensity + ')';
    ctx.shadowBlur = 40;
    
    if (!gradientCache.has('frame')) {
        const frameGradient = ctx.createLinearGradient(100, 100, 100, SLOT_HEIGHT - 100);
        frameGradient.addColorStop(0, '#ffd700');
        frameGradient.addColorStop(0.5, '#ff00ff');
        frameGradient.addColorStop(1, '#ffd700');
        gradientCache.set('frame', frameGradient);
    }
    ctx.strokeStyle = gradientCache.get('frame');
    ctx.lineWidth = 20;
    ctx.strokeRect(100, 100, SLOT_WIDTH - 200, SLOT_HEIGHT - 200);
    ctx.restore();

    // Упрощенный заголовок (без голографии)
    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 0, 1)';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 85px Gilroy, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ДЬЯВОЛЬСКИЕ ПЛОДЫ', SLOT_WIDTH / 2, 200);
    ctx.restore();
}

function drawSpinningItemsFast(ctx, items, itemColors, offset, frame, slowMode) {
    const startY = 320;
    const centerY = startY + (ITEM_HEIGHT * VISIBLE_ITEMS) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(150, startY, SLOT_WIDTH - 300, ITEM_HEIGHT * VISIBLE_ITEMS);
    ctx.clip();

    for (let i = 0; i < items.length; i++) {
        const y = startY + i * ITEM_HEIGHT - offset;

        if (y > startY - ITEM_HEIGHT && y < startY + ITEM_HEIGHT * VISIBLE_ITEMS) {
            const item = items[i];
            const itemColor = itemColors[i];
            const distanceFromCenter = Math.abs(y + ITEM_HEIGHT / 2 - centerY);
            const isCenterItem = distanceFromCenter < ITEM_HEIGHT / 2;
            const isNearCenter = distanceFromCenter < ITEM_HEIGHT * 1.5;

            if (isCenterItem) {
                ctx.save();
                ctx.shadowColor = itemColor.rgb;
                ctx.shadowBlur = slowMode ? 50 : 35;
                ctx.fillStyle = itemColor.rgb;
                ctx.fillRect(160, y, SLOT_WIDTH - 320, ITEM_HEIGHT - 10);
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(40, 40, 60, ' + (isNearCenter ? '0.75' : '0.45') + ')';
                ctx.fillRect(160, y, SLOT_WIDTH - 320, ITEM_HEIGHT - 10);
            }

            if (isCenterItem) {
                ctx.save();
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = slowMode ? 8 : 6;
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = slowMode ? 40 : 25;
                ctx.strokeRect(160, y, SLOT_WIDTH - 320, ITEM_HEIGHT - 10);
                ctx.restore();
            } else {
                ctx.strokeStyle = isNearCenter ? '#666666' : '#333333';
                ctx.lineWidth = 2;
                ctx.strokeRect(160, y, SLOT_WIDTH - 320, ITEM_HEIGHT - 10);
            }

            const scale = isCenterItem ? (slowMode ? 1.1 : 1.0) : (isNearCenter ? 0.85 : 0.7);
            const alpha = isCenterItem ? 1.0 : (isNearCenter ? 0.8 : 0.5);

            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
            const fontSize = Math.floor(48 * scale);
            ctx.font = (isCenterItem ? 'bold ' : '') + fontSize + 'px Gilroy, Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const truncatedText = item.length > 50 ? item.substring(0, 50) + '...' : item;
            
            if (isCenterItem) {
                ctx.shadowColor = 'rgba(255, 255, 255, 1)';
                ctx.shadowBlur = slowMode ? 25 : 18;
            }
            ctx.fillText(truncatedText, SLOT_WIDTH / 2, y + ITEM_HEIGHT / 2);
            ctx.restore();

            if (isCenterItem) {
                ctx.save();
                ctx.font = (slowMode ? '60' : '54') + 'px Arial';
                ctx.shadowColor = itemColor.hex;
                ctx.shadowBlur = slowMode ? 30 : 20;
                ctx.fillStyle = itemColor.hex;
                ctx.fillText(itemColor.emoji, 240, y + ITEM_HEIGHT / 2);
                ctx.fillText(itemColor.emoji, SLOT_WIDTH - 240, y + ITEM_HEIGHT / 2);
                ctx.restore();
            }
        }
    }

    ctx.restore();
}

function drawSpeedLinesFast(ctx, frame) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Рисуем только каждую 4-ю линию
    for (let i = 0; i < 20; i += 4) {
        const y = (frame * 20 + i * 60) % SLOT_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(150, y);
        ctx.lineTo(SLOT_WIDTH - 150, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawSlowMotionEffectFast(ctx, progress) {
    ctx.save();
    ctx.globalAlpha = progress * 0.4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);
    
    if (progress > 0.7) {
        ctx.globalAlpha = (progress - 0.7) / 0.3;
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 48px Gilroy, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SLOW MOTION', SLOT_WIDTH / 2, SLOT_HEIGHT - 180);
    }
    
    ctx.restore();
}

function drawTensionIndicatorFast(ctx, progress) {
    if (progress > 0.5) {
        const tension = (progress - 0.5) * 2;
        
        ctx.save();
        ctx.globalAlpha = tension;
        
        // Только 1 круг вместо 3
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
        ctx.lineWidth = 5;
        const radius = 100 + tension * 150;
        ctx.beginPath();
        ctx.arc(SLOT_WIDTH / 2, SLOT_HEIGHT / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

function drawCenterHighlightFast(ctx, frame) {
    const centerY = 320 + (ITEM_HEIGHT * VISIBLE_ITEMS) / 2;
    const pulse = fastSin(frame / 6) * 0.4 + 0.8;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 215, 0, ' + pulse + ')';
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(255, 215, 0, ' + pulse + ')';
    ctx.font = 'bold 110px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('>', 90, centerY);
    ctx.fillText('<', SLOT_WIDTH - 90, centerY);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 215, 0, ' + pulse + ')';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(255, 215, 0, 1)';
    ctx.shadowBlur = 25;
    ctx.setLineDash([25, 10]);
    ctx.beginPath();
    ctx.moveTo(150, centerY - ITEM_HEIGHT / 2);
    ctx.lineTo(SLOT_WIDTH - 150, centerY - ITEM_HEIGHT / 2);
    ctx.moveTo(150, centerY + ITEM_HEIGHT / 2);
    ctx.lineTo(SLOT_WIDTH - 150, centerY + ITEM_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawFinalResultFast(ctx, wonFruit, finalFrame) {
    const centerY = 320 + (ITEM_HEIGHT * VISIBLE_ITEMS) / 2;
    const alpha = Math.min(finalFrame / 8, 1);
    const scale = 1 + Math.min(finalFrame / 20, 0.3);
    const bounce = finalFrame < 10 ? fastSin(finalFrame * 0.8) * 15 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;

    const rarityColor = getRarityColorRGB(wonFruit);
    ctx.fillStyle = rarityColor;
    ctx.fillRect(140, centerY - ITEM_HEIGHT / 2 - 20 + bounce, SLOT_WIDTH - 280, ITEM_HEIGHT + 40);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 10;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 45;
    ctx.strokeRect(140, centerY - ITEM_HEIGHT / 2 - 20 + bounce, SLOT_WIDTH - 280, ITEM_HEIGHT + 40);

    ctx.shadowBlur = 35;
    ctx.shadowColor = 'rgba(255, 255, 255, 1)';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.floor(52 * scale) + 'px Gilroy, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const truncatedText = wonFruit.length > 45 ? wonFruit.substring(0, 45) + '...' : wonFruit;
    ctx.fillText(truncatedText, SLOT_WIDTH / 2, centerY + bounce);

    const emoji = getRarityEmoji(wonFruit);
    ctx.font = Math.floor(64 * scale) + 'px Arial';
    ctx.fillStyle = getRarityColor(wonFruit);
    ctx.fillText(emoji, 230, centerY + bounce);
    ctx.fillText(emoji, SLOT_WIDTH - 230, centerY + bounce);

    ctx.restore();

    if (finalFrame > 8) {
        ctx.save();
        const textAlpha = Math.min((finalFrame - 8) / 10, 1);
        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 70px Gilroy, Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 215, 0, 1)';
        ctx.shadowBlur = 40;
        ctx.fillText('ВЫПАЛО:', SLOT_WIDTH / 2, centerY - 140);
        ctx.restore();
    }
}

function drawParticlesFast(ctx, particles) {
    ctx.save();
    
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.6;
        p.vx *= 0.98;
        p.life--;
        
        if (p.life <= 0 || p.y > SLOT_HEIGHT) {
            particles.splice(i, 1);
            continue;
        }
        
        const alpha = p.life / 40;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color === 1 ? '#ffd700' : '#ffffff';
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawCelebrationEffectsFast(ctx, finalFrame) {
    // Только 2 волны вместо 4
    for (let wave = 0; wave < 2; wave++) {
        const waveProgress = (finalFrame + wave * 10) / 25;
        if (waveProgress < 1) {
            const radius = waveProgress * 600;
            const alpha = (1 - waveProgress) * 0.5;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(SLOT_WIDTH / 2, SLOT_HEIGHT / 2, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawVictoryBurstFast(ctx, finalFrame) {
    if (finalFrame < 20) {
        const burstProgress = finalFrame / 20;
        const lineCount = 12; // Уменьшено с 24
        
        ctx.save();
        ctx.translate(SLOT_WIDTH / 2, SLOT_HEIGHT / 2);
        
        for (let i = 0; i < lineCount; i++) {
            const angle = (Math.PI * 2 / lineCount) * i;
            const length = burstProgress * 500;
            const alpha = 1 - burstProgress;
            
            ctx.globalAlpha = alpha * 0.8;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 8;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(fastCos(angle) * length, fastSin(angle) * length);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

function drawDecorationsFast(ctx, frame) {
    const starSize = 40;
    const starPositions = [
        { x: 180, y: 240 },
        { x: SLOT_WIDTH - 180, y: 240 },
        { x: 180, y: SLOT_HEIGHT - 140 },
        { x: SLOT_WIDTH - 180, y: SLOT_HEIGHT - 140 }
    ];

    const rotation = (frame * Math.PI * 2) / 30;

    starPositions.forEach(function(pos, index) {
        const offset = (index * Math.PI) / 2;
        const pulse = 0.85 + fastSin(frame / 10 + offset) * 0.25;
        drawStarFast(ctx, pos.x, pos.y, 5, starSize * pulse, starSize * 0.45 * pulse, rotation + offset);
    });
}

function drawStarFast(ctx, cx, cy, spikes, outerRadius, innerRadius, rotation) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.beginPath();
    
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / spikes) * i;
        const x = fastCos(angle) * radius;
        const y = fastSin(angle) * radius;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.restore();
}

function getRarityName(fruit) {
    if (fruit.includes('мз') || fruit.includes('Миф') || fruit.includes('мфз')) {
        return 'МИФИЧЕСКИЙ';
    } else if (fruit.includes('Логия') || fruit.includes(' л')) {
        return 'ЛЕГЕНДАРНЫЙ';
    } else if (fruit.includes('Зоан') || fruit.includes(' з') || fruit.includes('дз')) {
        return 'РЕДКИЙ';
    } else if (fruit.includes('Парамеция') || fruit.includes(' п')) {
        return 'ОБЫЧНЫЙ';
    }
    return 'НЕИЗВЕСТНЫЙ';
}

function getRarityEmoji(fruit) {
    if (fruit.includes('мз') || fruit.includes('Миф') || fruit.includes('мфз')) {
        return '*';
    } else if (fruit.includes('Логия') || fruit.includes(' л')) {
        return '+';
    } else if (fruit.includes('Зоан') || fruit.includes(' з') || fruit.includes('дз')) {
        return '#';
    }
    return 'o';
}

function getRarityColor(fruit) {
    const key = 'color_' + fruit;
    if (!colorCache.has(key)) {
        let color = '#FF8C00';
        if (fruit.includes('мз') || fruit.includes('Миф') || fruit.includes('мфз')) {
            color = '#FF00FF';
        } else if (fruit.includes('Логия') || fruit.includes(' л')) {
            color = '#FFD700';
        } else if (fruit.includes('Зоан') || fruit.includes(' з') || fruit.includes('дз')) {
            color = '#00BFFF';
        }
        colorCache.set(key, color);
    }
    return colorCache.get(key);
}

function getRarityColorRGB(fruit) {
    const key = 'rgb_' + fruit;
    if (!colorCache.has(key)) {
        let color = 'rgba(255, 140, 0, 0.9)';
        if (fruit.includes('мз') || fruit.includes('Миф') || fruit.includes('мфз')) {
            color = 'rgba(255, 0, 255, 0.9)';
        } else if (fruit.includes('Логия') || fruit.includes(' л')) {
            color = 'rgba(255, 215, 0, 0.9)';
        } else if (fruit.includes('Зоан') || fruit.includes(' з') || fruit.includes('дз')) {
            color = 'rgba(0, 191, 255, 0.9)';
        }
        colorCache.set(key, color);
    }
    return colorCache.get(key);
}

function getDropChance(fruit) {
    if (fruit.includes('мз') || fruit.includes('Миф') || fruit.includes('мфз')) {
        return '0.5% (Очень редкий!)';
    } else if (fruit.includes('Логия') || fruit.includes(' л')) {
        return '2% (Редкий)';
    } else if (fruit.includes('Зоан') || fruit.includes(' з') || fruit.includes('дз')) {
        return '10% (Необычный)';
    }
    return '87.5% (Обычный)';
}
