const fs = require('fs');
const path = require('path');

// Функция форматирования десятичных чисел
function formatDecimal(number) {
    return parseFloat(number.toFixed(2)).toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Функция загрузки искр
function loadSparkles() {
    try {
        const sparklePath = path.join(__dirname, '..', 'sparkle.json');
        if (fs.existsSync(sparklePath)) {
            const sparkleData = fs.readFileSync(sparklePath, 'utf-8');
            const sparkles = JSON.parse(sparkleData);
            console.log(`Загружено ${sparkles.length} искр для магазина`);
            return sparkles;
        } else {
            console.error('Файл sparkle.json не найден!');
            return ['Искра Огня', 'Искра Воды', 'Искра Земли', 'Искра Воздуха', 'Искра Света'];
        }
    } catch (error) {
        console.error('Ошибка загрузки sparkle.json:', error);
        return ['Искра Огня', 'Искра Воды', 'Искра Земли', 'Искра Воздуха', 'Искра Света'];
    }
}

module.exports = {
    formatDecimal,
    loadSparkles
};
