// utils/kindnessFilter.js

const fs = require('fs');
const path = require('path');

class KindnessFilter {
    constructor() {
        this.badWords = [];
        this.userCooldowns = new Map();
        this.cooldownTime = 5000; // 5 секунд
        this.badWordsFilePath = path.join(__dirname, '..', 'data', 'badWords.json');
        this.loadBadWords();
    }

    loadBadWords() {
        try {
            if (fs.existsSync(this.badWordsFilePath)) {
                const data = fs.readFileSync(this.badWordsFilePath, 'utf8');
                this.badWords = JSON.parse(data);
                console.log(`✅ Загружено ${this.badWords.length} плохих слов`);
            } else {
                this.badWords = this.getDefaultBadWords();
                this.saveBadWords();
                console.log(`✅ Создан новый файл с ${this.badWords.length} плохими словами`);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки плохих слов:', error);
            this.badWords = this.getDefaultBadWords();
        }
    }

    saveBadWords() {
        try {
            const dir = path.dirname(this.badWordsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.badWordsFilePath, JSON.stringify(this.badWords, null, 2));
        } catch (error) {
            console.error('❌ Ошибка сохранения плохих слов:', error);
        }
    }

    getDefaultBadWords() {
        return ['сука', 'блять', 'хуй', 'пизда', 'ебать', 'гондон', 'аутист','долбоеб','шалава','даун','урод'];
    }

    // Исправленная проверка с поддержкой кириллицы
    checkMessage(message) {
        if (!message || typeof message !== 'string') return false;
        const lowerMessage = message.toLowerCase();
        
        for (const badWord of this.badWords) {
            // Используем группы для корректной работы с кириллицей
            const regex = new RegExp(`(?:^|[^а-яёa-z])${this.escapeRegex(badWord)}(?:[^а-яёa-z]|$)`, 'gi');
            if (regex.test(lowerMessage)) {
                return true;
            }
        }
        return false;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    isOnCooldown(userId) {
        const now = Date.now();
        const lastReply = this.userCooldowns.get(userId);
        
        if (!lastReply) return false;
        return (now - lastReply) < this.cooldownTime;
    }

    setCooldown(userId) {
        this.userCooldowns.set(userId, Date.now());
    }

    // Получение случайной картинки котика
    async getRandomCatImage() {
        try {
            const response = await fetch('https://api.thecatapi.com/v1/images/search');
            const data = await response.json();
            return data[0].url;
        } catch (error) {
            console.error('❌ Ошибка получения картинки котика:', error);
            // Запасной вариант - другой API
            return 'https://cataas.com/cat';
        }
    }

    async handleMessage(message) {
        // Проверяем, содержит ли сообщение плохие слова
        if (!this.checkMessage(message.content)) {
            return;
        }

        // Проверяем кулдаун
        if (this.isOnCooldown(message.author.id)) {
            console.log(`⏱️ Пользователь ${message.author.tag} на кулдауне`);
            return;
        }

        try {
            // Получаем случайную картинку котика
            const catImageUrl = await this.getRandomCatImage();
            
            // Отправляем ответ с картинкой
            await message.reply({
                content: 'Будь добрее! 🐱',
                files: [{
                    attachment: catImageUrl,
                    name: 'cat.jpg'
                }]
            });

            // Устанавливаем кулдаун
            this.setCooldown(message.author.id);
            console.log(`✅ Отправлен ответ пользователю ${message.author.tag} с котиком`);
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения:', error);
        }
    }

    // Методы управления списком слов
    addWord(word) {
        if (!this.badWords.includes(word.toLowerCase())) {
            this.badWords.push(word.toLowerCase());
            this.saveBadWords();
            return true;
        }
        return false;
    }

    removeWord(word) {
        const index = this.badWords.indexOf(word.toLowerCase());
        if (index > -1) {
            this.badWords.splice(index, 1);
            this.saveBadWords();
            return true;
        }
        return false;
    }

    getWords() {
        return [...this.badWords];
    }
}

module.exports = KindnessFilter;
