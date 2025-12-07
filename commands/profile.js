const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags, ComponentType, ButtonStyle, ButtonBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Database = require('../database');
const db = new Database();

const ADMIN_ROLE_ID = '1381909203005866034'; // ID роли высших админов
const stylingCache = new Map();

function getStatLevel(statValue, statType) {
  const levels = {
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

  const statLevels = levels[statType] || levels.strength;
  for (const level of statLevels) {
    if (statValue >= level.min && statValue <= level.max) {
      return level.name;
    }
  }
  return "Неизвестный уровень";
}

async function recolorImage(imagePath, hexColor, outputPath) {
  try {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    await sharp(imagePath)
      .modulate({ brightness: 1.0, saturation: 0 })
      .tint({ r, g, b })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Ошибка перекраски изображения:', error);
    return false;
  }
}

function parseColor(colorInput) {
  const colorNames = {
    'красный': '#ED4245', 'синий': '#3498DB', 'зеленый': '#57F287',
    'фиолетовый': '#9B59B6', 'желтый': '#FEE75C', 'оранжевый': '#E67E22',
    'розовый': '#EB459E', 'черный': '#23272A', 'белый': '#FFFFFF',
    'серый': '#95A5A6', 'золотой': '#F1C40F', 'аква': '#1ABC9C',
    'темно-синий': '#206694', 'темно-зеленый': '#1F8B4C', 'темно-фиолетовый': '#71368A',
    'темно-красный': '#992D22',
  };
  if (colorInput && colorNames[colorInput.toLowerCase()]) {
    return colorNames[colorInput.toLowerCase()];
  }
  if (colorInput && colorInput.startsWith('#') && colorInput.length === 7) {
    return colorInput;
  }
  return '#9932cc';
}

async function loadCustomStyling(characterId) {
  if (stylingCache.has(characterId)) return stylingCache.get(characterId);
  if (typeof db.getCustomStyling !== 'function') return null;
  try {
    const row = await db.getCustomStyling(characterId);
    stylingCache.set(characterId, row || null);
    return row || null;
  } catch {
    return null;
  }
}

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('профиль')
    .setDescription('Показать профиль персонажа')
    .addStringOption(option =>
      option.setName('персонаж')
        .setDescription('Выберите персонажа')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    try {
      const allCharacters = await db.getAllCharacters();
      const filtered = allCharacters.filter(char => {
        const nameMatch = (char.name || '').toLowerCase().includes((focusedValue || '').toLowerCase());
        const idMatch = char.id?.toString().includes(focusedValue);
        return nameMatch || idMatch;
      }).slice(0, 25);

      const choices = filtered.map(char => ({
        name: `${char.name} (ID: ${char.id})`,
        value: char.id.toString()
      }));
      await interaction.respond(choices);
    } catch (error) {
      console.error('Ошибка автодополнения:', error);
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const characterId = interaction.options.getString('персонаж');

    try {
      const character = await db.getCharacterById(characterId);
      if (!character) {
        return await interaction.reply({
          content: 'Персонаж не найден!',
          flags: MessageFlags.Ephemeral
        });
      }

      const hasAdminRole = interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID);
      const totalPower =
        (character.strength || 0) +
        (character.agility || 0) +
        (character.reaction || 0) +
        (character.accuracy || 0) +
        (character.endurance || 0) +
        (character.durability || 0) +
        (character.magic || 0);

      const customStyling = await loadCustomStyling(character.id);
      
      // Загружаем активный разделитель из магазина и кастомное эмодзи
      let activeSeparator = null;
      let customEmoji = null;
      try {
        activeSeparator = await db.getCharacterActiveSeparator(character.id);
        customEmoji = await db.getCharacterCustomEmoji(character.id);
      } catch (err) {
        console.error('Ошибка загрузки данных магазина:', err);
      }

      const SEPARATOR_CONFIG = (() => {
        const base = {
          image1: './images/rubycon.png',
          image2: './images/rubycon1.png',
          width: 250,
          height: 60,
          enabled: true,
          alternate: true,
          recolor: true
        };

        // Приоритет: активный разделитель из магазина > кастомное оформление > базовый
        if (activeSeparator) {
          if (activeSeparator.is_custom) {
            // Кастомный разделитель из магазина (с флагами recolorable и alternate)
            const isRecolorable = activeSeparator.recolorable === 1 || activeSeparator.recolorable === true;
            const isAlternate = (activeSeparator.alternate === 1 || activeSeparator.alternate === true) && activeSeparator.custom_separator2_url;
            return {
              image1: activeSeparator.custom_separator1_url || base.image1,
              image2: activeSeparator.custom_separator2_url || activeSeparator.custom_separator1_url || base.image1,
              width: base.width,
              height: base.height,
              enabled: true,
              alternate: isAlternate,
              recolor: isRecolorable
            };
          } else if (activeSeparator.shop_sep1) {
            // Разделитель из магазина БД
            return {
              image1: activeSeparator.shop_sep1,
              image2: activeSeparator.shop_sep2 || activeSeparator.shop_sep1,
              width: base.width,
              height: base.height,
              enabled: true,
              alternate: !!activeSeparator.shop_sep2,
              recolor: true
            };
          }
        }

        if (!customStyling) return base;

        return {
          image1: customStyling.separator1url && customStyling.separator1url.length > 0 ? customStyling.separator1url : base.image1,
          image2: customStyling.separator2url && customStyling.separator2url.length > 0 ? customStyling.separator2url : base.image2,
          width: Number.isFinite(customStyling.separatorwidth) ? customStyling.separatorwidth : base.width,
          height: Number.isFinite(customStyling.separatorheight) ? customStyling.separatorheight : base.height,
          enabled: true,
          alternate: customStyling.enablealternate === 1 || customStyling.enablealternate === true ? true : base.alternate,
          recolor: customStyling.enablerecolor === 1 || customStyling.enablerecolor === true ? true : base.recolor
        };
      })();

      const embedColor = parseColor(character.embed_color);
      const tempDir = './temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const files = [];
      const fileMap = new Map();
      let sep1FileName = null;
      let sep2FileName = null;

      if (SEPARATOR_CONFIG.enabled) {
        if (SEPARATOR_CONFIG.image1) {
          const isUrl = /^https?:\/\//i.test(SEPARATOR_CONFIG.image1);
          
          if (isUrl) {
            const buffer = await downloadImage(SEPARATOR_CONFIG.image1);
            if (buffer) {
              let finalBuffer = buffer;
              
              if (SEPARATOR_CONFIG.recolor) {
                const tempInput = path.join(tempDir, `temp_${Date.now()}_1.png`);
                const tempOutput = path.join(tempDir, `sep1_${characterId}_${Date.now()}.png`);
                fs.writeFileSync(tempInput, buffer);
                await recolorImage(tempInput, embedColor, tempOutput);
                finalBuffer = fs.readFileSync(tempOutput);
                fs.unlinkSync(tempInput);
                fs.unlinkSync(tempOutput);
              }
              
              sep1FileName = `sep1_${characterId}.png`;
              files.push({ attachment: finalBuffer, name: sep1FileName });
              fileMap.set('sep1', sep1FileName);
            }
          } else {
            if (fs.existsSync(SEPARATOR_CONFIG.image1)) {
              if (SEPARATOR_CONFIG.recolor) {
                const tempOutput = path.join(tempDir, `sep1_${characterId}_${Date.now()}.png`);
                await recolorImage(SEPARATOR_CONFIG.image1, embedColor, tempOutput);
                sep1FileName = path.basename(tempOutput);
                files.push({ attachment: tempOutput, name: sep1FileName });
                fileMap.set('sep1', sep1FileName);
                setTimeout(() => {
                  if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                }, 10000);
              } else {
                sep1FileName = path.basename(SEPARATOR_CONFIG.image1);
                files.push({ attachment: SEPARATOR_CONFIG.image1, name: sep1FileName });
                fileMap.set('sep1', sep1FileName);
              }
            }
          }
        }

        if (SEPARATOR_CONFIG.alternate && SEPARATOR_CONFIG.image2) {
          const isUrl = /^https?:\/\//i.test(SEPARATOR_CONFIG.image2);
          
          if (isUrl) {
            const buffer = await downloadImage(SEPARATOR_CONFIG.image2);
            if (buffer) {
              let finalBuffer = buffer;
              
              if (SEPARATOR_CONFIG.recolor) {
                const tempInput = path.join(tempDir, `temp_${Date.now()}_2.png`);
                const tempOutput = path.join(tempDir, `sep2_${characterId}_${Date.now()}.png`);
                fs.writeFileSync(tempInput, buffer);
                await recolorImage(tempInput, embedColor, tempOutput);
                finalBuffer = fs.readFileSync(tempOutput);
                fs.unlinkSync(tempInput);
                fs.unlinkSync(tempOutput);
              }
              
              sep2FileName = `sep2_${characterId}.png`;
              files.push({ attachment: finalBuffer, name: sep2FileName });
              fileMap.set('sep2', sep2FileName);
            }
          } else {
            if (fs.existsSync(SEPARATOR_CONFIG.image2)) {
              if (SEPARATOR_CONFIG.recolor) {
                const tempOutput = path.join(tempDir, `sep2_${characterId}_${Date.now()}.png`);
                await recolorImage(SEPARATOR_CONFIG.image2, embedColor, tempOutput);
                sep2FileName = path.basename(tempOutput);
                files.push({ attachment: tempOutput, name: sep2FileName });
                fileMap.set('sep2', sep2FileName);
                setTimeout(() => {
                  if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                }, 10000);
              } else {
                sep2FileName = path.basename(SEPARATOR_CONFIG.image2);
                files.push({ attachment: SEPARATOR_CONFIG.image2, name: sep2FileName });
                fileMap.set('sep2', sep2FileName);
              }
            }
          }
        }
      }

      let separatorCounter = 0;
      const addSeparator = () => {
        if (!SEPARATOR_CONFIG.enabled || !fileMap.has('sep1')) return null;

        const useSep2 = SEPARATOR_CONFIG.alternate && fileMap.has('sep2') && separatorCounter % 2 === 1;
        const fileName = useSep2 ? fileMap.get('sep2') : fileMap.get('sep1');
        separatorCounter++;

        return {
          type: ComponentType.MediaGallery,
          items: [{
            media: {
              url: `attachment://${fileName}`,
              width: SEPARATOR_CONFIG.width,
              height: SEPARATOR_CONFIG.height
            }
          }]
        };
      };

      const container = {
        type: ComponentType.Container,
        accent_color: parseInt(embedColor.replace("#", ""), 16),
        components: []
      };

      // Формируем заголовок профиля с эмодзи
      let emojiPrefix = '';
      
      if (customEmoji && customEmoji.discord_emoji_id) {
        // Discord эмодзи - показываем как настоящий эмодзи
        emojiPrefix = customEmoji.animated 
          ? `<a:${customEmoji.emoji_name || 'custom'}:${customEmoji.discord_emoji_id}> `
          : `<:${customEmoji.emoji_name || 'custom'}:${customEmoji.discord_emoji_id}> `;
      }

      container.components.push({
        type: ComponentType.TextDisplay,
        content: `# ${emojiPrefix}${character.name}`
      });

      if (character.nickname) {
        container.components.push({
          type: ComponentType.TextDisplay,
          content: `*«${character.nickname}»*`
        });
      }

      if (character.avatar_url) {
        container.components.push({
          type: ComponentType.MediaGallery,
          items: [{ media: { url: character.avatar_url } }]
        });
      }

      const sep1 = addSeparator();
      if (sep1) container.components.push(sep1);

      container.components.push({
        type: ComponentType.TextDisplay,
        content: '### 【 Основная информация 】'
      });

      let ownerName = 'Неизвестный владелец';
      try {
        const owner = await interaction.client.users.fetch(character.user_id);
        ownerName = owner.username;
      } catch (error) {
        ownerName = `ID ${character.user_id}`;
      }

      container.components.push({
        type: ComponentType.TextDisplay,
        content:
          `🦁 Раса: **${character.race || 'Не указано'}**\n` +
          `🎂 Возраст: **${character.age || 'Не указано'}**\n` +
          `🏛️ Организация: **${character.organization || 'Не указано'}**\n` +
          `📜 Должность: **${character.position || 'Не указано'}**\n` +
          `🧾 Упоминание: **${character.mention || 'Не указано'}**\n` +
          `👤 Владелец: **${ownerName}**`
      });

      const sep2 = addSeparator();
      if (sep2) container.components.push(sep2);

      container.components.push({
        type: ComponentType.TextDisplay,
        content: `### 【 Характеристики 】⸺ 🔱 ${totalPower.toLocaleString()}`
      });

      container.components.push({
        type: ComponentType.TextDisplay,
        content:
          `💪 Сила: **${(character.strength || 0).toLocaleString()}** ⸺ *${getStatLevel(character.strength || 0, 'strength')}*\n` +
          `🤸 Ловкость: **${(character.agility || 0).toLocaleString()}** ⸺ *${getStatLevel(character.agility || 0, 'agility')}*\n` +
          `⚡️ Реакция: **${(character.reaction || 0).toLocaleString()}** ⸺ *${getStatLevel(character.reaction || 0, 'reaction')}*\n` +
          `🎯 Точность: **${(character.accuracy || 0).toLocaleString()}** ⸺ *${getStatLevel(character.accuracy || 0, 'accuracy')}*\n` +
          `🏋️ Стойкость: **${(character.endurance || 0).toLocaleString()}** ⸺ *${getStatLevel(character.endurance || 0, 'endurance')}*\n` +
          `🛡️ Прочность: **${(character.durability || 0).toLocaleString()}** ⸺ *${getStatLevel(character.durability || 0, 'durability')}*\n` +
          `🔮 Магия: **${(character.magic || 0).toLocaleString()}** ⸺ *${getStatLevel(character.magic || 0, 'magic')}*`
      });

      const sep3 = addSeparator();
      if (sep3) container.components.push(sep3);

      container.components.push({
        type: ComponentType.TextDisplay,
        content: '### 【 Способности и Навыки 】'
      });

      container.components.push({
        type: ComponentType.TextDisplay,
        content:
          `🍎 Дьявольский Плод: **${character.devilfruit || 'Нет'}**\n` +
          `👼 Покровительство: **${character.patronage || 'Нет'}**\n` +
          `💠 Искры: **${character.core || 'Нет'}**\n` +
          `🗡️ Воля Вооружения: **${character.hakivor || 'Нет'}**\n` +
          `👁️ Воля Наблюдения: **${character.hakinab || 'Нет'}**\n` +
          `👑 Королевская Воля: **${character.hakiconq || 'Нет'}**\n` +
          `🌪️ Стихии: **${character.elements || 'Нет'}**\n` +
          `🥋 Боевые Искусства: **${character.martialarts || 'Нет'}**`
      });

      if (character.additional) {
        const sep4 = addSeparator();
        if (sep4) container.components.push(sep4);

        container.components.push({
          type: ComponentType.TextDisplay,
          content: '### 【 Дополнительно 】'
        });

        container.components.push({
          type: ComponentType.TextDisplay,
          content: character.additional
        });
      }

      const sepFinal = addSeparator();
      if (sepFinal) container.components.push(sepFinal);

      container.components.push({
        type: ComponentType.TextDisplay,
        content: `*ID: ${character.id} • Бюджет: ${(character.budget || 0).toLocaleString()} 💰*`
      });

      let components = [container];

      // === НАВИГАЦИЯ ПО ПРОФИЛЮ (стрелочки) ===
      // Категории: профиль -> галерея -> достижения -> биография
      // userId хранится для проверки кто может листать
      
      const isOwner = character.user_id === interaction.user.id;
      
      // Навигационные кнопки для ВСЕХ пользователей
      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`pnav_prev_0_${character.id}_${interaction.user.id}`)
          .setLabel('◀')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`pnav_cat_0_${character.id}_${interaction.user.id}`)
          .setLabel('📋 Профиль')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`pnav_next_0_${character.id}_${interaction.user.id}`)
          .setLabel('▶')
          .setStyle(ButtonStyle.Secondary)
      );
      components.push(navRow);

      // Кнопки действий для ВЛАДЕЛЬЦА персонажа
      if (isOwner) {
        const ownerActionsRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`pact_avatar_${character.id}_${interaction.user.id}`)
            .setLabel('🖼️ Аватар')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`pact_color_${character.id}_${interaction.user.id}`)
            .setLabel('🎨 Цвет')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`pact_gallery_${character.id}_${interaction.user.id}`)
            .setLabel('📸 Галерея')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`pact_bio_${character.id}_${interaction.user.id}`)
            .setLabel('📖 Биография')
            .setStyle(ButtonStyle.Secondary)
        );
        components.push(ownerActionsRow);
      }

      // === АДМИНСКОЕ МЕНЮ (только для высших админов) ===
        if (hasAdminRole) {
        // Информация об оформлении
        let sepDisplay = '📦 Стандартный';
        if (activeSeparator) {
          if (activeSeparator.is_custom) {
            sepDisplay = '✨ Кастомный';
          } else if (activeSeparator.name) {
            sepDisplay = `🎨 ${activeSeparator.name}`;
          }
        }

        let emojiDisplay = '❌ Нет';
        if (customEmoji && customEmoji.discord_emoji_id) {
          const emojiStr = customEmoji.animated 
            ? `<a:${customEmoji.emoji_name}:${customEmoji.discord_emoji_id}>`
            : `<:${customEmoji.emoji_name}:${customEmoji.discord_emoji_id}>`;
          emojiDisplay = `${emojiStr}`;
        } else if (customEmoji && customEmoji.emoji_url) {
          emojiDisplay = `🖼️ URL`;
        }

        // Админский контейнер с информацией
        const stylingContainer = {
          type: ComponentType.Container,
          accent_color: parseInt('ED4245', 16),
          components: [{
            type: ComponentType.TextDisplay,
            content: `### ⚡ Панель администратора\n**Разделитель:** ${sepDisplay} | **Эмодзи:** ${emojiDisplay}`
          }]
        };
        components.push(stylingContainer);

        // SelectMenu для админских действий (магазин и прочее)
        const adminSelectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`profile_admin_${character.id}`)
            .setPlaceholder('⚙️ Выберите действие...')
            .addOptions([
              {
                label: '📝 Редактировать информацию',
                description: 'Изменить имя, расу, возраст и др.',
                value: 'edit_info',
                emoji: '📝'
              },
              {
                label: '🖼️ Изменить аватар',
                description: 'Установить новый аватар персонажа',
                value: 'avatar',
                emoji: '🖼️'
              },
              {
                label: '🎨 Изменить цвет',
                description: 'Изменить цвет профиля',
                value: 'color',
                emoji: '🎨'
              },
              {
                label: '⚔️ Редактировать статы',
                description: 'Изменить характеристики персонажа',
                value: 'stats_edit',
                emoji: '⚔️'
              },
              {
                label: '🏆 Выдать достижение',
                description: 'Добавить достижение персонажу',
                value: 'achievement_add',
                emoji: '🏆'
              },
              {
                label: '📸 Управление галереей',
                description: 'Добавить или удалить изображения',
                value: 'gallery_manage',
                emoji: '📸'
              },
              {
                label: '📖 Редактировать биографию',
                description: 'Изменить биографию персонажа',
                value: 'bio_edit',
                emoji: '📖'
              },
              {
                label: '🎨 Магазин оформления',
                description: 'Разделители, эмодзи и декорации',
                value: 'shop',
                emoji: '🛒'
              },
              {
                label: '✨ Кастомное оформление',
                description: 'Настроить индивидуальное оформление',
                value: 'custom_styling',
                emoji: '✨'
              }
            ])
        );
        components.push(adminSelectRow);

        // Кнопки быстрого доступа
        const adminRow1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`padm_info_${character.id}`)
            .setLabel('📝 Инфо')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`padm_stats_${character.id}`)
            .setLabel('⚔️ Статы')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`padm_achieve_${character.id}`)
            .setLabel('🏆 Достижение')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`padm_shop_${character.id}`)
            .setLabel('🛒 Магазин')
            .setStyle(ButtonStyle.Danger)
        );
        components.push(adminRow1);
      }

      await interaction.reply({
        flags: MessageFlags.IsComponentsV2,
        components: components,
        files: files
      });

    } catch (error) {
      console.error('Ошибка получения профиля:', error);
      await interaction.reply({
        content: 'Произошла ошибка при получении профиля персонажа!',
        flags: MessageFlags.Ephemeral
      });
    }
  },

  // ФУНКЦИЯ ОЧИСТКИ КЭША
  clearStylingCache: function(characterId) {
    if (characterId) {
      stylingCache.delete(characterId);
      console.log(`🗑️ Кэш оформления очищен для персонажа ID: ${characterId}`);
    } else {
      stylingCache.clear();
      console.log('🗑️ Весь кэш оформления очищен');
    }
  }
};
