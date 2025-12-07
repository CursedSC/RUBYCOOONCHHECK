const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

class ProfileImageGenerator {
    constructor() {
        this.fontFamily = 'Arial';
        this.loadFont();
    }

    loadFont() {
        try {
            const fontPath = path.join(__dirname, '../fonts/Gilroy-Light.ttf');
            if (fs.existsSync(fontPath)) {
                registerFont(fontPath, {
                    family: 'Gilroy-Light',
                    weight: 'normal',
                    style: 'normal'
                });
                this.fontFamily = 'Gilroy-Light';
                console.log('Шрифт Gilroy-Light успешно зарегистрирован');
            } else {
                console.log('Файл шрифта Gilroy-Light.ttf не найден, используется системный шрифт');
                this.fontFamily = 'Arial';
            }
        } catch (error) {
            console.error('Ошибка регистрации шрифта:', error);
            this.fontFamily = 'Arial';
        }
    }

    formatTime(seconds) {
        if (seconds === null || seconds === undefined || seconds === '' || isNaN(seconds)) {
            console.log('formatTime: некорректное значение времени:', seconds);
            return '0:00:00';
        }

        const numSeconds = Number(seconds);
        if (isNaN(numSeconds) || numSeconds < 0) {
            console.log('formatTime: NaN или отрицательное значение:', numSeconds);
            return '0:00:00';
        }

        const totalSeconds = Math.floor(numSeconds);
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        const formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        console.log('formatTime: результат форматирования:', formattedTime);
        return formattedTime;
    }

    async generateProfileImage(userData, discordUser, userCharacters = [], guildMember = null) {
        try {
            const backgroundPath = path.join(__dirname, '../images/profile_bg.png');
            if (!fs.existsSync(backgroundPath)) {
                throw new Error(`Фоновое изображение не найдено: ${backgroundPath}`);
            }

            const background = await loadImage(backgroundPath);
            const canvas = createCanvas(background.naturalWidth || background.width, background.naturalHeight || background.height);
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.patternQuality = 'best';
            ctx.textRenderingOptimization = 'optimizeQuality';

            ctx.drawImage(background, 0, 0, background.naturalWidth || background.width, background.naturalHeight || background.height);

            ctx.fillStyle = '#A8A8A9';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // Время в голосовых каналах
            ctx.font = `40pt ${this.fontFamily}`;
            console.log('generateProfileImage: входное время:', userData.voiceTime, typeof userData.voiceTime);
            const voiceTimeFormatted = this.formatTime(userData.voiceTime);
            console.log('generateProfileImage: отформатированное время:', voiceTimeFormatted);
            ctx.fillText(voiceTimeFormatted, Math.round(985), Math.round(118));

            // Количество сообщений
            ctx.font = `40pt ${this.fontFamily}`;
            ctx.fillText(userData.messagesCount.toString(), Math.round(985), Math.round(270));

            // Позиция в топе
            ctx.font = `40pt ${this.fontFamily}`;
            const topText = userData.topPosition !== 'Не в топе' ? `№${userData.topPosition}` : 'Не в топе';
            ctx.fillText(topText, Math.round(985), Math.round(425));

            // RubyCoins
            ctx.font = `45pt ${this.fontFamily}`;
            ctx.fillStyle = '#A8A8A9';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const coinText = `${(userData.rubycoins || 0).toLocaleString()}`;
            ctx.fillText(coinText, Math.round(184), Math.round(615));

            ctx.fillStyle = '#A8A8A9';

            let actualGuildMember = guildMember;
            if (guildMember) {
                try {
                    actualGuildMember = await guildMember.fetch();
                } catch (error) {
                    console.log('Не удалось обновить данные участника, используем кэшированные');
                }
            }

            const displayName = actualGuildMember ?
                (actualGuildMember.displayName || actualGuildMember.user.globalName || actualGuildMember.user.username) :
                (discordUser.displayName || discordUser.globalName || discordUser.username);

            let nameFontSize;
            if (displayName.length > 12) {
                nameFontSize = `35pt ${this.fontFamily}`;
            } else if (displayName.length > 8) {
                nameFontSize = `40pt ${this.fontFamily}`;
            } else {
                nameFontSize = `50pt ${this.fontFamily}`;
            }

            ctx.font = nameFontSize;
            ctx.fillStyle = '#A8A8A9';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayName, Math.round(645), Math.round(604));

            // Отображение роли
            const displayedRole = this.getDisplayedRole(actualGuildMember);
            let roleFontSize;
            if (displayedRole.name.length > 12) {
                roleFontSize = `22pt ${this.fontFamily}`;
            } else if (displayedRole.name.length > 8) {
                roleFontSize = `26pt ${this.fontFamily}`;
            } else {
                roleFontSize = `30pt ${this.fontFamily}`;
            }

            ctx.font = roleFontSize;
            ctx.fillStyle = displayedRole.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(displayedRole.name, Math.round(645), Math.round(660));

            // Отображение упоминания пользователя
            const userTag = discordUser.tag || `${discordUser.username}#${discordUser.discriminator}`;
            let mentionFontSize;
            let mentionY = 627;
            if (userTag.length > 7) {
                mentionFontSize = `24pt ${this.fontFamily}`;
                mentionY = 627;
            } else {
                mentionFontSize = `28pt ${this.fontFamily}`;
            }

            ctx.font = mentionFontSize;
            ctx.fillStyle = '#A8A8A9';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`@${userTag}`, Math.round(990), Math.round(mentionY));

            // Отображение аватара
            const avatarUrl = discordUser.displayAvatarURL({
                extension: 'png',
                size: 1024,
                dynamic: false
            });

            const avatarSize = 210;
            const centerX = Math.round(641);
            const centerY = Math.round(413);

            await this.drawUserAvatar(ctx, avatarUrl, centerX, centerY, avatarSize, displayName);
            await this.drawCharacterSlots(ctx, userCharacters);

            return canvas.toBuffer('image/png');

        } catch (error) {
            console.error('Ошибка генерации изображения профиля:', error);
            throw error;
        }
    }

    async drawUserAvatar(ctx, avatarUrl, centerX, centerY, size, fallbackName) {
        const radius = size / 2;
        try {
            const avatar = await loadImage(avatarUrl);

            const prevSmoothing = ctx.imageSmoothingEnabled;
            const prevQuality = ctx.imageSmoothingQuality;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const avatarX = Math.round(centerX - radius);
            const avatarY = Math.round(centerY - radius);

            ctx.drawImage(avatar, avatarX, avatarY, size, size);
            ctx.restore();

            ctx.imageSmoothingEnabled = prevSmoothing;
            ctx.imageSmoothingQuality = prevQuality;

        } catch (avatarError) {
            console.error('Ошибка загрузки аватара пользователя:', avatarError);
            this.drawDefaultAvatar(ctx, centerX, centerY, size, fallbackName);
        }
    }

    async drawCharacterSlots(ctx, characters) {
        const slotPositions = [
            { centerX: Math.round(200), nameY: Math.round(116), idY: Math.round(160) },
            { centerX: Math.round(200), nameY: Math.round(271), idY: Math.round(314) },
            { centerX: Math.round(200), nameY: Math.round(423), idY: Math.round(474) }
        ];

        const sortedCharacters = characters.slice(0, 3);

        ctx.fillStyle = '#A8A8A9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i < slotPositions.length; i++) {
            const position = slotPositions[i];
            const character = sortedCharacters[i];

            if (character) {
                const nameLength = character.name.length;
                let nameFontSize;
                if (nameLength > 12) {
                    nameFontSize = `14pt ${this.fontFamily}`;
                } else {
                    nameFontSize = `18pt ${this.fontFamily}`;
                }

                const maxNameLength = 15;
                const displayName = character.name.length > maxNameLength
                    ? character.name.substring(0, maxNameLength) + '...'
                    : character.name;

                ctx.font = nameFontSize;
                ctx.fillText(displayName, position.centerX, position.nameY);

                ctx.font = `16pt ${this.fontFamily}`;
                ctx.fillText(`ID: ${character.id}`, position.centerX, position.idY);
            } else {
                ctx.fillStyle = '#888888';
                ctx.font = `18pt ${this.fontFamily}`;
                ctx.fillText('Отсутствует', position.centerX, position.nameY);

                ctx.font = `16pt ${this.fontFamily}`;
                ctx.fillText('-', position.centerX, position.idY);
                ctx.fillStyle = '#A8A8A9';
            }
        }

        ctx.font = `40pt ${this.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    drawDefaultAvatar(ctx, centerX, centerY, size, username) {
        const radius = size / 2;
        ctx.save();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const gradient = ctx.createLinearGradient(
            centerX - radius, centerY - radius,
            centerX + radius, centerY + radius
        );
        gradient.addColorStop(0, '#7289da');
        gradient.addColorStop(1, '#5865f2');

        ctx.fillStyle = gradient;
        const rectX = Math.round(centerX - radius);
        const rectY = Math.round(centerY - radius);
        ctx.fillRect(rectX, rectY, size, size);

        ctx.fillStyle = '#A8A8A9';
        ctx.font = `${Math.floor(size/3)}pt ${this.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const firstLetter = username ? username.charAt(0).toUpperCase() : '?';
        ctx.fillText(firstLetter, centerX, centerY);

        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    getDefaultColorForRole(roleName) {
        const defaultColors = {
            'Owner': '#FF0000',
            'Co-Owner': '#FF6600',
            'Высшая админиистрация': '#FFFF00',
            'Аадминиистрация': '#9900FF',
            'Спонсор': '#00FF00'
        };
        return defaultColors[roleName] || '#A8A8A9';
    }

    getDisplayedRole(guildMember) {
        const priorityRoles = [
            { id: '1382006178451685377', name: 'Owner', priority: 1 },
            { id: '1381454973576941568', name: 'Co-Owner', priority: 2 },
            { id: '1382006799028322324', name: 'Высшая админиистрация', priority: 3 },
            { id: '1382006705860382763', name: 'Админиистрация', priority: 4 },
            { id: '1383879027596460053', name: 'Спонсор', priority: 5 }
        ];

        if (!guildMember || !guildMember.roles) {
            return { name: 'Участник', color: '#A8A8A9' };
        }

        const userRoles = guildMember.roles.cache;

        // Проверяем только приоритетные роли
        for (const priorityRole of priorityRoles) {
            const foundRole = userRoles.get(priorityRole.id);
            if (foundRole) {
                return {
                    name: priorityRole.name,
                    color: foundRole.hexColor && foundRole.hexColor !== '#000000'
                        ? foundRole.hexColor
                        : this.getDefaultColorForRole(priorityRole.name)
                };
            }
        }

        // Если ни одной приоритетной роли не найдено, возвращаем "Участник"
        return { name: 'Участник', color: '#A8A8A9' };
    }
}

module.exports = ProfileImageGenerator;
