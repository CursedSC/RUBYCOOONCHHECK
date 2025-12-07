const { google } = require('googleapis');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const configFile = require('./config.json');

// --- НАСТРОЙКИ ДИЗАЙНА (Как на фото) ---
const THEME = {
    HEADER_BG: { red: 0.20, green: 0.0, blue: 0.0 },
    ROW_BG:    { red: 0.30, green: 0.02, blue: 0.02 },
    TEXT:      { red: 1, green: 1, blue: 1 },
    BORDER:    { red: 1, green: 1, blue: 1 }
};
const LEVELS = {
    strength: [
      { min: 0, max: 999, name: "Ребенок" },
      { min: 1000, max: 9999, name: "Человек" },
      { min: 10000, max: 29999, name: "Камень" },
      { min: 30000, max: 59999, name: "Стена" },
      { min: 60000, max: 119999, name: "Частный дом" },
      { min: 120000, max: 199999, name: "Здание 2-5 этажей" },
      { min: 200000, max: 399999, name: "Здание 6-9 этажей" },
      { min: 400000, max: 699999, name: "Многоэтажное здание" },
      { min: 700000, max: 999999, name: "Небоскреб" },
      { min: 1000000, max: 1999999, name: "Средний Жилой комплекс" },
      { min: 2000000, max: 4999999, name: "Бункер" },
      { min: 5000000, max: 7999999, name: "Улица" },
      { min: 8000000, max: 9999999, name: "Микрорайон" },
      { min: 10000000, max: 14999999, name: "Холм" },
      { min: 15000000, max: 19999999, name: "Район" },
      { min: 20000000, max: 29999999, name: "Город" },
      { min: 30000000, max: 44999999, name: "Мегаполис" },
      { min: 45000000, max: 69999999, name: "Остров" },
      { min: 70000000, max: 89999999, name: "Гора" },
      { min: 90000000, max: 99999999, name: "Страна" },
      { min: 100000000, max: 129999999, name: "Континент" },
      { min: 130000000, max: 159999999, name: "Карликовая планета" },
      { min: 160000000, max: 199999999, name: "Планета" },
      { min: 200000000, max: 499999999, name: "Белый Карлик" },
      { min: 500000000, max: 799999999, name: "Звёзда главной последовательности" },
      { min: 800000000, max: 999999999, name: "Красный гигант" },
      { min: 1000000000, max: 2999999999, name: "Планетная система" },
      { min: 3000000000, max: 5999999999, name: "Сверх Гигант" },
      { min: 6000000000, max: 9999999999, name: "Скопление звезд" },
      { min: 10000000000, max: 39999999999, name: "Сверх Скопление звезд" },
      { min: 40000000000, max: 99999999999, name: "Маленький Рукав" },
      { min: 100000000000, max: 299999999999, name: "Рукав галактики" },
      { min: 300000000000, max: 699999999999, name: "Галактика" },
      { min: 700000000000, max: 999999999999, name: "Туманность" },
      { min: 1000000000000, max: 9999999999999, name: "Черная Дыра" },
      { min: 10000000000000, max: 24999999999999, name: "Сверх массивная Черная дыра" },
      { min: 25000000000000, max: 59999999999999, name: "Видимая вселенная" },
      { min: 60000000000000, max: 74999999999999, name: "Половина Вселенной" },
      { min: 75000000000000, max: 84999999999999, name: "Вся вселенная" },
      { min: 85000000000000, max: 100000000000000, name: "Мультивселенная" }
    ],
    agility: [
      { min: 0, max: 999, name: "18 км/ч" },
      { min: 1000, max: 9999, name: "32 км/ч" },
      { min: 10000, max: 29999, name: "72 км/ч" },
      { min: 30000, max: 59999, name: "180 км/ч" },
      { min: 60000, max: 119999, name: "360 км/ч" },
      { min: 120000, max: 199999, name: "540 км/ч" },
      { min: 200000, max: 399999, name: "720 км/ч" },
      { min: 400000, max: 699999, name: "1260 км/ч" },
      { min: 700000, max: 999999, name: "1800 км/ч" },
      { min: 1000000, max: 1999999, name: "1 км/с" },
      { min: 2000000, max: 4999999, name: "3 км/с" },
      { min: 5000000, max: 7999999, name: "7 км/с" },
      { min: 8000000, max: 9999999, name: "10 км/с" },
      { min: 10000000, max: 14999999, name: "15 км/с" },
      { min: 15000000, max: 19999999, name: "20 км/с" },
      { min: 20000000, max: 29999999, name: "25 км/с" },
      { min: 30000000, max: 44999999, name: "50 км/с" },
      { min: 45000000, max: 69999999, name: "100 км/с" },
      { min: 70000000, max: 89999999, name: "250 км/с" },
      { min: 90000000, max: 99999999, name: "500 км/с" },
      { min: 100000000, max: 129999999, name: "1000 км/с" },
      { min: 130000000, max: 159999999, name: "2500 км/с" },
      { min: 160000000, max: 199999999, name: "5000 км/с" },
      { min: 200000000, max: 499999999, name: "10000 км/с" },
      { min: 500000000, max: 799999999, name: "25000 км/с" },
      { min: 800000000, max: 999999999, name: "50000 км/с" },
      { min: 1000000000, max: 2999999999, name: "75000 км/с" },
      { min: 3000000000, max: 5999999999, name: "100000 км/с" },
      { min: 6000000000, max: 9999999999, name: "125000 км/с" },
      { min: 10000000000, max: 39999999999, name: "135000 км/с" },
      { min: 40000000000, max: 99999999999, name: "150000 км/с" },
      { min: 100000000000, max: 299999999999, name: "190000 км/с" },
      { min: 300000000000, max: 699999999999, name: "260000 км/с" },
      { min: 700000000000, max: 999999999999, name: "Скорость света" },
      { min: 1000000000000, max: 9999999999999, name: "х1.25 Скорости света" },
      { min: 10000000000000, max: 24999999999999, name: "х1.5 Скорости света" },
      { min: 25000000000000, max: 59999999999999, name: "х1.75 Скорости света" },
      { min: 60000000000000, max: 74999999999999, name: "х2 Скорости света" },
      { min: 75000000000000, max: 84999999999999, name: "х2.5 Скорости света" },
      { min: 85000000000000, max: 100000000000000, name: "х3 Скорости света" }
    ],
    durability: [
      { min: 0, max: 999, name: "Человек" },
      { min: 1000, max: 9999, name: "Камень" },
      { min: 10000, max: 29999, name: "Стена" },
      { min: 30000, max: 59999, name: "Частный дом" },
      { min: 60000, max: 119999, name: "Здание 2-5 этажей" },
      { min: 120000, max: 199999, name: "Здание 6-9 этажей" },
      { min: 200000, max: 399999, name: "Многоэтажное здание" },
      { min: 400000, max: 699999, name: "Небоскреб" },
      { min: 700000, max: 999999, name: "Средний Жилой комплекс" },
      { min: 1000000, max: 1999999, name: "Бункер" },
      { min: 2000000, max: 4999999, name: "Улица" },
      { min: 5000000, max: 7999999, name: "Микрорайон" },
      { min: 8000000, max: 9999999, name: "Холм" },
      { min: 10000000, max: 14999999, name: "Район" },
      { min: 15000000, max: 19999999, name: "Город" },
      { min: 20000000, max: 29999999, name: "Мегаполис" },
      { min: 30000000, max: 44999999, name: "Остров" },
      { min: 45000000, max: 69999999, name: "Гора" },
      { min: 70000000, max: 89999999, name: "Страна" },
      { min: 90000000, max: 99999999, name: "Континент" },
      { min: 100000000, max: 129999999, name: "Карликовая планета" },
      { min: 130000000, max: 159999999, name: "Планета" },
      { min: 160000000, max: 199999999, name: "Белый Карлик" },
      { min: 200000000, max: 499999999, name: "Звёзда главной последовательности" },
      { min: 500000000, max: 799999999, name: "Красный гигант" },
      { min: 800000000, max: 999999999, name: "Планетная система" },
      { min: 1000000000, max: 2999999999, name: "Сверх Гигант" },
      { min: 3000000000, max: 5999999999, name: "Скопление звезд" },
      { min: 6000000000, max: 9999999999, name: "Сверх Скопление звезд" },
      { min: 10000000000, max: 39999999999, name: "Маленький Рукав" },
      { min: 40000000000, max: 99999999999, name: "Рукав галактики" },
      { min: 100000000000, max: 299999999999, name: "Галактика" },
      { min: 300000000000, max: 699999999999, name: "Туманность" },
      { min: 700000000000, max: 999999999999, name: "Черная Дыра" },
      { min: 1000000000000, max: 9999999999999, name: "Сверх массивная Черная дыра" },
      { min: 10000000000000, max: 24999999999999, name: "Видимая вселенная" },
      { min: 25000000000000, max: 59999999999999, name: "Половина Вселенной" },
      { min: 60000000000000, max: 74999999999999, name: "Вся вселенная" },
      { min: 75000000000000, max: 84999999999999, name: "Мультивселенная" },
      { min: 85000000000000, max: 100000000000000, name: "Двойная Мультивселенная" }
    ],
    magic: [
      { min: 0, max: 999, name: "Человек без знаний о магии" },
      { min: 1000, max: 9999, name: "Палка" },
      { min: 10000, max: 29999, name: "Камень" },
      { min: 30000, max: 59999, name: "Стена" },
      { min: 60000, max: 119999, name: "Частный дом" },
      { min: 120000, max: 199999, name: "Здание 2-5 этажей" },
      { min: 200000, max: 399999, name: "Здание 6-9 этажей" },
      { min: 400000, max: 699999, name: "Многоэтажное здание" },
      { min: 700000, max: 999999, name: "Небоскреб" },
      { min: 1000000, max: 1999999, name: "Средний Жилой комплекс" },
      { min: 2000000, max: 4999999, name: "Бункер" },
      { min: 5000000, max: 7999999, name: "Улица" },
      { min: 8000000, max: 9999999, name: "Микрорайон" },
      { min: 10000000, max: 14999999, name: "Холм" },
      { min: 15000000, max: 19999999, name: "Район" },
      { min: 20000000, max: 29999999, name: "Город" },
      { min: 30000000, max: 44999999, name: "Мегаполис" },
      { min: 45000000, max: 69999999, name: "Остров" },
      { min: 70000000, max: 89999999, name: "Гора" },
      { min: 90000000, max: 99999999, name: "Страна" },
      { min: 100000000, max: 129999999, name: "Континент" },
      { min: 130000000, max: 159999999, name: "Карликовая планета" },
      { min: 160000000, max: 199999999, name: "Планета" },
      { min: 200000000, max: 499999999, name: "Белый Карлик" },
      { min: 500000000, max: 799999999, name: "Звёзда главной последовательности" },
      { min: 800000000, max: 999999999, name: "Красный гигант" },
      { min: 1000000000, max: 2999999999, name: "Планетная система" },
      { min: 3000000000, max: 5999999999, name: "Сверх Гигант" },
      { min: 6000000000, max: 9999999999, name: "Скопление звезд" },
      { min: 10000000000, max: 39999999999, name: "Сверх Скопление звезд" },
      { min: 40000000000, max: 99999999999, name: "Маленький Рукав" },
      { min: 100000000000, max: 299999999999, name: "Рукав галактики" },
      { min: 300000000000, max: 699999999999, name: "Галактика" },
      { min: 700000000000, max: 999999999999, name: "Туманность" },
      { min: 1000000000000, max: 9999999999999, name: "Черная Дыра" },
      { min: 10000000000000, max: 24999999999999, name: "Сверх массивная Черная дыра" },
      { min: 25000000000000, max: 59999999999999, name: "Видимая вселенная" },
      { min: 60000000000000, max: 74999999999999, name: "Половина Вселенной" },
      { min: 75000000000000, max: 84999999999999, name: "Вся вселенная" },
      { min: 85000000000000, max: 100000000000000, name: "Мультивселенная" }
    ],
    reaction: [
      { min: 0, max: 999, name: "18 км/ч" },
      { min: 1000, max: 9999, name: "32 км/ч" },
      { min: 10000, max: 29999, name: "72 км/ч" },
      { min: 30000, max: 59999, name: "180 км/ч" },
      { min: 60000, max: 119999, name: "360 км/ч" },
      { min: 120000, max: 199999, name: "540 км/ч" },
      { min: 200000, max: 399999, name: "720 км/ч" },
      { min: 400000, max: 699999, name: "1260 км/ч" },
      { min: 700000, max: 999999, name: "1800 км/ч" },
      { min: 1000000, max: 1999999, name: "1 км/с" },
      { min: 2000000, max: 4999999, name: "3 км/с" },
      { min: 5000000, max: 7999999, name: "7 км/с" },
      { min: 8000000, max: 9999999, name: "10 км/с" },
      { min: 10000000, max: 14999999, name: "15 км/с" },
      { min: 15000000, max: 19999999, name: "20 км/с" },
      { min: 20000000, max: 29999999, name: "25 км/с" },
      { min: 30000000, max: 44999999, name: "50 км/с" },
      { min: 45000000, max: 69999999, name: "100 км/с" },
      { min: 70000000, max: 89999999, name: "250 км/с" },
      { min: 90000000, max: 99999999, name: "500 км/с" },
      { min: 100000000, max: 129999999, name: "1000 км/с" },
      { min: 130000000, max: 159999999, name: "2500 км/с" },
      { min: 160000000, max: 199999999, name: "5000 км/с" },
      { min: 200000000, max: 499999999, name: "10000 км/с" },
      { min: 500000000, max: 799999999, name: "25000 км/с" },
      { min: 800000000, max: 999999999, name: "50000 км/с" },
      { min: 1000000000, max: 2999999999, name: "75000 км/с" },
      { min: 3000000000, max: 5999999999, name: "100000 км/с" },
      { min: 6000000000, max: 9999999999, name: "125000 км/с" },
      { min: 10000000000, max: 39999999999, name: "135000 км/с" },
      { min: 40000000000, max: 99999999999, name: "150000 км/с" },
      { min: 100000000000, max: 299999999999, name: "190000 км/с" },
      { min: 300000000000, max: 699999999999, name: "260000 км/с" },
      { min: 700000000000, max: 999999999999, name: "Скорость света" },
      { min: 1000000000000, max: 9999999999999, name: "х1.25 Скорости света" },
      { min: 10000000000000, max: 24999999999999, name: "х1.5 Скорости света" },
      { min: 25000000000000, max: 59999999999999, name: "х1.75 Скорости света" },
      { min: 60000000000000, max: 74999999999999, name: "х2 Скорости света" },
      { min: 75000000000000, max: 84999999999999, name: "х2.5 Скорости света" },
      { min: 85000000000000, max: 100000000000000, name: "х3 Скорости света" }
    ],
    accuracy: [
      { min: 0, max: 999, name: "Грубая (10 м)" },
      { min: 1000, max: 9999, name: "Очень Примерная (25 м)" },
      { min: 10000, max: 29999, name: "Примерная (50 м)" },
      { min: 30000, max: 59999, name: "Стандартная (100 м)" },
      { min: 60000, max: 119999, name: "Высокая (250 м)" },
      { min: 120000, max: 199999, name: "Инженерная (500 м)" },
      { min: 200000, max: 399999, name: "Промышленная (750 м)" },
      { min: 400000, max: 699999, name: "Механическая (1 км)" },
      { min: 700000, max: 999999, name: "Хирургическая (2 км)" },
      { min: 1000000, max: 1999999, name: "Хирургическая (3 км)" },
      { min: 2000000, max: 4999999, name: "Микроскопическая (5 км)" },
      { min: 5000000, max: 7999999, name: "Микроскопическая (10 км)" },
      { min: 8000000, max: 9999999, name: "Микроскопическая (25 км)" },
      { min: 10000000, max: 14999999, name: "Биологическая (50 км)" },
      { min: 15000000, max: 19999999, name: "Биологическая (75 км)" },
      { min: 20000000, max: 29999999, name: "Биологическая (100 км)" },
      { min: 30000000, max: 44999999, name: "Молекулярная (250 км)" },
      { min: 45000000, max: 69999999, name: "Молекулярная (500 км)" },
      { min: 70000000, max: 89999999, name: "Молекулярная (750 км)" },
      { min: 90000000, max: 99999999, name: "Молекулярная (900 км)" },
      { min: 100000000, max: 129999999, name: "Молекулярная (1тыс. км)" },
      { min: 130000000, max: 159999999, name: "Нано (5тыс. км)" },
      { min: 160000000, max: 199999999, name: "Нано (10тыс. км)" },
      { min: 200000000, max: 499999999, name: "Нано (25тыс. км)" },
      { min: 500000000, max: 799999999, name: "Нано (50тыс. км)" },
      { min: 800000000, max: 999999999, name: "Нано (75тыс. км)" },
      { min: 1000000000, max: 2999999999, name: "Атомная (100тыс. км)" },
      { min: 3000000000, max: 5999999999, name: "Атомная (125тыс. км)" },
      { min: 6000000000, max: 9999999999, name: "Атомная (150тыс. км)" },
      { min: 10000000000, max: 39999999999, name: "Квантовая (200тыс. км)" },
      { min: 40000000000, max: 99999999999, name: "Квантовая (1 св. сек)" },
      { min: 100000000000, max: 299999999999, name: "Квантовая (2 св. сек)" },
      { min: 300000000000, max: 699999999999, name: "Квантовая (4 св. сек)" },
      { min: 700000000000, max: 999999999999, name: "Нейтринновая (7 св. сек)" },
      { min: 1000000000000, max: 9999999999999, name: "Фотонная (10 св. сек)" },
      { min: 10000000000000, max: 24999999999999, name: "Планковская (15 св. сек)" },
      { min: 25000000000000, max: 59999999999999, name: "Фундаментальная (25 св. сек)" },
      { min: 60000000000000, max: 74999999999999, name: "Экзотическая (35 св. сек)" },
      { min: 75000000000000, max: 84999999999999, name: "Идеальная (50 св. сек)" },
      { min: 85000000000000, max: 100000000000000, name: "Абсолютная (1 св. мин)" }
    ],
    endurance: [
      { min: 0, max: 999, name: "70%" },
      { min: 1000, max: 9999, name: "72%" },
      { min: 10000, max: 29999, name: "75%" },
      { min: 30000, max: 59999, name: "78%" },
      { min: 60000, max: 119999, name: "80%" },
      { min: 120000, max: 199999, name: "85%" },
      { min: 200000, max: 399999, name: "90%" },
      { min: 400000, max: 699999, name: "100%" },
      { min: 700000, max: 999999, name: "102%" },
      { min: 1000000, max: 1999999, name: "105%" },
      { min: 2000000, max: 4999999, name: "107%" },
      { min: 5000000, max: 7999999, name: "110%" },
      { min: 8000000, max: 9999999, name: "112%" },
      { min: 10000000, max: 14999999, name: "115%" },
      { min: 15000000, max: 19999999, name: "117%" },
      { min: 20000000, max: 29999999, name: "120%" },
      { min: 30000000, max: 44999999, name: "122%" },
      { min: 45000000, max: 69999999, name: "125%" },
      { min: 70000000, max: 89999999, name: "127%" },
      { min: 90000000, max: 99999999, name: "130%" },
      { min: 100000000, max: 129999999, name: "132%" },
      { min: 130000000, max: 159999999, name: "135%" },
      { min: 160000000, max: 199999999, name: "137%" },
      { min: 200000000, max: 499999999, name: "140%" },
      { min: 500000000, max: 799999999, name: "142%" },
      { min: 800000000, max: 999999999, name: "145%" },
      { min: 1000000000, max: 2999999999, name: "147%" },
      { min: 3000000000, max: 5999999999, name: "150%" },
      { min: 6000000000, max: 9999999999, name: "152%" },
      { min: 10000000000, max: 39999999999, name: "155%" },
      { min: 40000000000, max: 99999999999, name: "157%" },
      { min: 100000000000, max: 299999999999, name: "160%" },
      { min: 300000000000, max: 699999999999, name: "162%" },
      { min: 700000000000, max: 999999999999, name: "165%" },
      { min: 1000000000000, max: 9999999999999, name: "170%" },
      { min: 10000000000000, max: 24999999999999, name: "175%" },
      { min: 25000000000000, max: 59999999999999, name: "185%" },
      { min: 60000000000000, max: 74999999999999, name: "190%" },
      { min: 75000000000000, max: 84999999999999, name: "195%" },
      { min: 85000000000000, max: 100000000000000, name: "200%" }
    ]
  };
function getStatLevel(statValue, statType) {
    const levels = LEVELS[statType] || LEVELS['strength'];
    const v = Number(statValue) || 0;

    for (const level of levels) {
        if (v >= level.min && v <= level.max) {
            return level.name;
        }
    }

    return '';
}


class GoogleSheetsSync {
    constructor(config = {}) {
        this.spreadsheetId = config.googleSheetId || '10u62OooenyH_mOlB0CL5eXmP6EEzrRzMAdBgwwBZjdw';
        this.sheetName = 'main';
        this.adminRoleId = config.adminRoleId || '1381909203005866034';
        this.dbPath = path.join(__dirname, 'characters.db');
        this.backupDir = path.join(__dirname, 'backups');

        // A–O (визуал как на скрине) + P–AF (скрытые/системные, можно потом использовать)
        this.COLUMN_COUNT = 32; // A–AF

        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir);
        }

        this.serviceAccountPath = path.join(__dirname, 'service-account.json');
        if (!fs.existsSync(this.serviceAccountPath)) {
            console.error('❌ ФАТАЛЬНАЯ ОШИБКА: Файл service-account.json не найден!');
            process.exit(1);
        }

        this.initGoogleSheets();
    }

    initGoogleSheets() {
        try {
            const credentials = JSON.parse(fs.readFileSync(this.serviceAccountPath, 'utf8'));
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            this.sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets API инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error.message);
        }
    }

    getDatabase() {
        return new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE);
    }

    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(this.backupDir, `characters_${timestamp}.db`);
            fs.copyFileSync(this.dbPath, backupPath);
            console.log(`📦 Бекап создан: ${backupPath}`);

            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.endsWith('.db'))
                .map(f => ({
                    name: f,
                    time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            if (files.length > 20) {
                const toDelete = files.slice(20);
                for (const file of toDelete) {
                    fs.unlinkSync(path.join(this.backupDir, file.name));
                }
            }
        } catch (error) {
            console.error('❌ Ошибка создания бекапа:', error);
        }
    }

    // ---------------- SHEET → DB ----------------

    async getSheetData() {
        try {
            // Читаем только визуальную часть A2:O1000 (как на скрине)
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A2:O1000`,
            });

            const rows = response.data.values;
            if (!rows) return [];

            return rows.map((row, index) => ({
                sheetRowIndex: index + 2,
                // A: №           row[0]
                name: row[1] || null,        // B: Персонаж
                race: row[2] || null,        // C: Раса
                strength: this.parseNumber(row[3]), // D: Сила
                agility: this.parseNumber(row[4]),  // E: Ловкость
                reaction: this.parseNumber(row[5]), // F: Реакция
                accuracy: this.parseNumber(row[6]), // G: Точность
                endurance: this.parseNumber(row[7]),// H: Стойкость
                durability: this.parseNumber(row[8]),// I: Прочность
                magic: this.parseNumber(row[9]),   // J: Магия
                // K: Общ. характеристика (не берем, считаем сами)
                nickname: row[11] || null,   // L: Прозвище
                patronage: row[12] || null,  // M: Покровитель
                devilfruit: row[13] || null, // N: Плод
                core: row[14] || null,       // O: Ядро
                // Остальные поля (ID, user_id и т.д.) живут только в БД,
                // при необходимости можно добавить скрытые колонки справа.
            })).filter(r => r.name && r.name.trim() !== '-');
        } catch (error) {
            console.error('⚠️ Ошибка чтения данных из таблицы:', error.message);
            return null;
        }
    }

    parseNumber(value) {
        if (!value) return 0;
        const cleaned = String(value).split('\n')[0].replace(/\s/g, '');
        return parseInt(cleaned, 10) || 0;
    }

    async syncFromSheetToDB() {
        console.log('🔄 Синхронизация Таблица → База данных...');
        const sheetData = await this.getSheetData();
        if (sheetData === null) {
            console.log('⛔ СТОП: Ошибка чтения таблицы. Синхронизация отменена.');
            return { success: false, message: 'Ошибка чтения таблицы' };
        }

        if (sheetData.length === 0) {
            console.log('⚠️ Таблица пуста, пропускаем удаление персонажей из базы.');
            return { success: true, results: { added: 0, updated: 0, deleted: 0, errors: [] } };
        }

        const dbCharacters = await this.loadCharactersFromDB();
        const dbNames = dbCharacters.map(c => c.name);
        const sheetNames = sheetData.map(c => c.name);

        const toDelete = dbNames.filter(name => !sheetNames.includes(name));
        const deleteRatio = toDelete.length / (dbNames.length || 1);

        if (dbNames.length > 0 && deleteRatio > 0.3 && toDelete.length > 5) {
            console.log(`⛔ СТОП: Попытка удалить ${toDelete.length} персонажей (${Math.round(deleteRatio * 100)}%). Отмена.`);
            return { success: false, message: 'Слишком много удалений. Отмена.' };
        }

        this.createBackup();

        const results = { added: 0, updated: 0, deleted: 0, errors: [] };

        for (const sheetChar of sheetData) {
            try {
                const existing = dbCharacters.find(c => c.name === sheetChar.name);
                if (existing) {
                    if (sheetChar.id && sheetChar.id !== existing.id) {
                        await this.updateCharacterID(sheetChar.name, sheetChar.id);
                    }
                    await this.updateCharacterInDB(sheetChar.name, sheetChar);
                    results.updated++;
                } else {
                    await this.addCharacterFromSheet(sheetChar);
                    results.added++;
                }
            } catch (err) {
                results.errors.push(`Ошибка ${sheetChar.name}: ${err.message}`);
            }
        }

        for (const name of toDelete) {
            try {
                await this.deleteCharacterFromDB(name);
                results.deleted++;
            } catch (err) {
                results.errors.push(`Ошибка удаления ${name}: ${err.message}`);
            }
        }

        console.log(`✅ Синхронизация завершена: +${results.added} ⬆️${results.updated} -${results.deleted}`);
        if (results.errors.length > 0) console.log('⚠️ Ошибки:', results.errors);

        return { success: true, results };
    }

    // ---------------- DB helpers (твоя логика) ----------------

    async addCharacterFromSheet(characterData) {
        return new Promise((resolve, reject) => {
            const db = this.getDatabase();
            const query = `
                INSERT INTO characters (
                    id, user_id, name, race, age, nickname, organization, position, mention,
                    strength, agility, reaction, accuracy, endurance, durability, magic,
                    devilfruit, patronage, core, hakivor, hakinab, hakiconq, elements, martialarts,
                    budget, additional, avatar_url, embed_color, icon_url, slot, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(query, [
                characterData.id || null,
                characterData.user_id || '0',
                characterData.name,
                characterData.race || 'Неизвестно',
                characterData.age || 0,
                characterData.nickname || null,
                characterData.organization || null,
                characterData.position || null,
                characterData.mention || null,
                characterData.strength || 0,
                characterData.agility || 0,
                characterData.reaction || 0,
                characterData.accuracy || 0,
                characterData.endurance || 0,
                characterData.durability || 0,
                characterData.magic || 0,
                characterData.devilfruit || null,
                characterData.patronage || null,
                characterData.core || null,
                characterData.hakivor || null,
                characterData.hakinab || null,
                characterData.hakiconq || null,
                characterData.elements || null,
                characterData.martialarts || null,
                characterData.budget || 0,
                characterData.additional || null,
                characterData.avatar_url || null,
                characterData.embed_color || '#9932cc',
                characterData.icon_url || null,
                characterData.slot || 1,
                characterData.created_at || new Date().toISOString()
            ], function (err) {
                db.close();
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async updateCharacterInDB(name, characterData) {
        return new Promise((resolve, reject) => {
            const db = this.getDatabase();
            const query = `
                UPDATE characters SET
                    user_id = ?, race = ?, age = ?, nickname = ?, organization = ?, position = ?, mention = ?,
                    strength = ?, agility = ?, reaction = ?, accuracy = ?, endurance = ?, durability = ?, magic = ?,
                    devilfruit = ?, patronage = ?, core = ?, hakivor = ?, hakinab = ?, hakiconq = ?, elements = ?, martialarts = ?,
                    budget = ?, additional = ?, avatar_url = ?, embed_color = ?, icon_url = ?, slot = ?, created_at = ?
                WHERE name = ?
            `;
            db.run(query, [
                characterData.user_id || '0',
                characterData.race || 'Неизвестно',
                characterData.age || 0,
                characterData.nickname || null,
                characterData.organization || null,
                characterData.position || null,
                characterData.mention || null,
                characterData.strength || 0,
                characterData.agility || 0,
                characterData.reaction || 0,
                characterData.accuracy || 0,
                characterData.endurance || 0,
                characterData.durability || 0,
                characterData.magic || 0,
                characterData.devilfruit || null,
                characterData.patronage || null,
                characterData.core || null,
                characterData.hakivor || null,
                characterData.hakinab || null,
                characterData.hakiconq || null,
                characterData.elements || null,
                characterData.martialarts || null,
                characterData.budget || 0,
                characterData.additional || null,
                characterData.avatar_url || null,
                characterData.embed_color || '#9932cc',
                characterData.icon_url || null,
                characterData.slot || 1,
                characterData.created_at || new Date().toISOString(),
                name
            ], function (err) {
                db.close();
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async updateCharacterID(name, newID) {
        return new Promise((resolve, reject) => {
            const db = this.getDatabase();
            db.run('UPDATE characters SET id = ? WHERE name = ?', [newID, name], function (err) {
                db.close();
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async deleteCharacterFromDB(name) {
        return new Promise((resolve, reject) => {
            const db = this.getDatabase();
            db.run('DELETE FROM characters WHERE name = ?', [name], function (err) {
                db.close();
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async loadCharactersFromDB() {
        return new Promise((resolve, reject) => {
            const db = this.getDatabase();
            db.all('SELECT * FROM characters', [], (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    // ---------------- DB → SHEET (новый вид таблицы) ----------------

    prepareRowData(characters) {
        const processed = characters.map(char => {
            const total =
                (char.strength || 0) +
                (char.agility || 0) +
                (char.reaction || 0) +
                (char.accuracy || 0) +
                (char.endurance || 0) +
                (char.durability || 0) +
                (char.magic || 0);
            return { ...char, totalStats: total };
        });

        processed.sort((a, b) => b.totalStats - a.totalStats);

        const numCell = (v) => ({
            userEnteredValue: { numberValue: v || 0 },
            userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } }
        });
        const strCell = (s) => ({ userEnteredValue: { stringValue: s || '-' } });

        return processed.map((char, idx) => ({
            values: [
                { userEnteredValue: { numberValue: idx + 1 } },     // A: №
                strCell(char.name),                                 // B: Персонаж
                strCell(char.race),                                 // C: Раса
                numCell(char.strength),                             // D: Сила
                numCell(char.agility),                              // E: Ловкость
                numCell(char.reaction),                             // F: Реакция
                numCell(char.accuracy),                             // G: Точность
                numCell(char.endurance),                            // H: Стойкость
                numCell(char.durability),                           // I: Прочность
                numCell(char.magic),                                // J: Магия
                numCell(char.totalStats),                           // K: Общ. Характеристики
                strCell(char.nickname),                             // L: Прозвище
                strCell(char.patronage),                            // M: Покровитель
                strCell(char.devilfruit),                           // N: Дьявольский Плод
                strCell(char.core),                                 // O: Ядро
            ]
        }));
    }

    async getSheetId() {
        try {
            const response = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
            const sheet = response.data.sheets.find(s => s.properties.title === this.sheetName) || response.data.sheets[0];
            this.sheetName = sheet.properties.title;
            return sheet.properties.sheetId;
        } catch {
            return 0;
        }
    }

    async updateGoogleSheets(rowData) {
        if (!this.sheets) return false;

        try {
            const sheetId = await this.getSheetId();

            // Сначала чистим фильтры, если есть
            const info = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
                fields: 'sheets(properties(sheetId,gridProperties,hidden,tabColor,basicFilter),filterViews)'
            });
            const sheet = info.data.sheets.find(s => s.properties.sheetId === sheetId);
            const preRequests = [];

            if (sheet?.properties?.basicFilter) {
                preRequests.push({ clearBasicFilter: { sheetId } });
            }
            if (sheet?.filterViews?.length) {
                sheet.filterViews.forEach(fv => preRequests.push({ deleteFilterView: { filterId: fv.filterViewId } }));
            }

            if (preRequests.length) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: { requests: preRequests }
                });
            }

            // Основные запросы
            const requests = [];

            // Размер и фриз
            requests.push({
                updateSheetProperties: {
                    properties: { sheetId, gridProperties: { columnCount: this.COLUMN_COUNT, frozenRowCount: 1 } },
                    fields: 'gridProperties.columnCount,gridProperties.frozenRowCount'
                }
            });

            // Снять все мерджи
            requests.push({
                unmergeCells: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: this.COLUMN_COUNT }
                }
            });

            // Очистка значений
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${this.sheetName}!A1:AF1000`
            });

            // Заголовки
            const headers = [
                '№', 'Персонаж', 'Раса',
                'Сила', 'Ловкость', 'Реакция', 'Точность', 'Стойкость', 'Прочность', 'Магия',
                'Общ. Характеристики', 'Прозвище', 'Покровительство', 'Дьявольский Плод:', 'Ядро:'
            ];
            const headerRow = {
                values: headers.map(h => ({ userEnteredValue: { stringValue: h } }))
            };

            // Запись заголовка и строк
            requests.push({
                updateCells: {
                    start: { sheetId, rowIndex: 0, columnIndex: 0 },
                    rows: [headerRow, ...rowData],
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });

            // Стили заголовка
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: THEME.HEADER_BG,
                            textFormat: { foregroundColor: THEME.TEXT, bold: true, fontSize: 10, fontFamily: 'Arial' },
                            horizontalAlignment: 'CENTER',
                            verticalAlignment: 'MIDDLE',
                            wrapStrategy: 'WRAP',
                            borders: {
                                top: { style: 'SOLID', width: 1, color: THEME.BORDER },
                                bottom: { style: 'SOLID', width: 1, color: THEME.BORDER },
                                left: { style: 'SOLID', width: 1, color: THEME.BORDER },
                                right: { style: 'SOLID', width: 1, color: THEME.BORDER }
                            }
                        }
                    },
                    fields: 'userEnteredFormat'
                }
            });

            // Стили строк
            if (rowData.length) {
                requests.push({
                    repeatCell: {
                        range: {
                            sheetId,
                            startRowIndex: 1,
                            endRowIndex: 1 + rowData.length,
                            startColumnIndex: 0,
                            endColumnIndex: 15
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: THEME.ROW_BG,
                                textFormat: { foregroundColor: THEME.TEXT, bold: true, fontSize: 10, fontFamily: 'Arial' },
                                horizontalAlignment: 'CENTER',
                                verticalAlignment: 'MIDDLE',
                                wrapStrategy: 'WRAP',
                                borders: {
                                    top: { style: 'SOLID', width: 1, color: THEME.BORDER },
                                    bottom: { style: 'SOLID', width: 1, color: THEME.BORDER },
                                    left: { style: 'SOLID', width: 1, color: THEME.BORDER },
                                    right: { style: 'SOLID', width: 1, color: THEME.BORDER }
                                }
                            }
                        },
                        fields: 'userEnteredFormat'
                    }
                });
            }

            // Ширина колонок
            const colWidths = [
                { i: 0, w: 40 },
                { i: 1, w: 200 },
                { i: 2, w: 140 },
                { i: 3, w: 110 },
                { i: 4, w: 110 },
                { i: 5, w: 110 },
                { i: 6, w: 110 },
                { i: 7, w: 110 },
                { i: 8, w: 110 },
                { i: 9, w: 110 },
                { i: 10, w: 160 },
                { i: 11, w: 200 },
                { i: 12, w: 220 },
                { i: 13, w: 240 },
                { i: 14, w: 140 },
            ];
            colWidths.forEach(cw => {
                requests.push({
                    updateDimensionProperties: {
                        range: { sheetId, dimension: 'COLUMNS', startIndex: cw.i, endIndex: cw.i + 1 },
                        properties: { pixelSize: cw.w },
                        fields: 'pixelSize'
                    }
                });
            });

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: { requests }
            });

            console.log(`✅ Таблица обновлена (${rowData.length} строк)`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления:', error.message);
            return false;
        }
    }

    async loadTable(checkDeletion = false) {
        console.log(`🔄 Запуск синхронизации (Режим удаления: ${checkDeletion})...`);
        try {
            if (checkDeletion) {
                await this.syncFromSheetToDB();
            }
            const characters = await this.loadCharactersFromDB();
            const rowData = this.prepareRowData(characters);
            return await this.updateGoogleSheets(rowData);
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            return false;
        }
    }

    startAutoSync(minutes = 30) {
        const interval = minutes * 60 * 1000;
        console.log(`⏰ Автоматическая синхронизация запущена (каждые ${minutes} минут)`);
        this.loadTable(true);
        setInterval(() => {
            console.log('🔄 Автоматическая синхронизация...');
            this.loadTable(true);
        }, interval);
    }

    setupDiscordCommand(client) {
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            if (interaction.commandName !== 'синк-таблица') return;

            const hasAdminRole = interaction.member?.roles?.cache?.has(this.adminRoleId);
            if (!hasAdminRole) {
                try {
                    await interaction.reply({
                        content: '❌ У вас нет прав администратора.',
                        flags: 64
                    });
                } catch { }
                return;
            }

            try {
                await interaction.deferReply({ flags: 64 });
                const result = await this.syncFromSheetToDB();
                if (result.success) {
                    const { added, updated, deleted } = result.results;
                    await interaction.editReply(
                        `✅ Двусторонняя синхронизация завершена:\n` +
                        `➕ Добавлено: ${added}\n` +
                        `🔄 Обновлено: ${updated}\n` +
                        `➖ Удалено: ${deleted}`
                    );
                } else {
                    await interaction.editReply(`❌ Ошибка: ${result.message}`);
                }
            } catch (error) {
                console.error('❌ Ошибка синхронизации:', error);
                try {
                    await interaction.editReply('❌ Внутренняя ошибка синхронизации.');
                } catch { }
            }
        });
    }
}

module.exports = GoogleSheetsSync;