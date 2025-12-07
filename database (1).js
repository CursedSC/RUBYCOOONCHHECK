const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'characters.db'));
    this.initDatabase();
    this.initUserActivityTable();
    this.initRubyCoinTable();
    this.initTempBanTable();
    this.initTempMuteTable();
    this.initHakiSpinsTable();
    this.initHakiHistoryTable();
    this.initTicketTable();
    this.initTicketLogsTable();

}


    

    initDatabase() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                race TEXT,
                age INTEGER,
                nickname TEXT,
                organization TEXT,
                position TEXT,
                mention TEXT,
                strength INTEGER DEFAULT 0,
                agility INTEGER DEFAULT 0,
                reaction INTEGER DEFAULT 0,
                accuracy INTEGER DEFAULT 0,
                endurance INTEGER DEFAULT 0,
                durability INTEGER DEFAULT 0,
                magic INTEGER DEFAULT 0,
                devilfruit TEXT,
                patronage TEXT,
                core TEXT,
                hakivor TEXT,
                hakinab TEXT,
                hakiconq TEXT,
                elements TEXT,
                martialarts TEXT,
                budget INTEGER DEFAULT 0,
                additional TEXT,
                avatar_url TEXT,
                embed_color TEXT DEFAULT '#9932cc',
                icon_url TEXT DEFAULT NULL,
                slot INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(createTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы персонажей:', err);
            } else {
                console.log('Таблица персонажей создана успешно');
            }
        });

        // Добавляем колонку icon_url если её нет
        const addIconColumnQuery = `
            ALTER TABLE characters ADD COLUMN icon_url TEXT DEFAULT NULL
        `;
        this.db.run(addIconColumnQuery, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Ошибка добавления колонки icon_url:', err);
            }
        });

        // Создание таблицы слотов пользователей
        const createSlotsTableQuery = `
            CREATE TABLE IF NOT EXISTS user_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                max_slots INTEGER DEFAULT 3,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;


        this.db.run(createSlotsTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы слотов:', err);
            } else {
                console.log('Таблица слотов создана успешно');
            }
        });

        // Создание таблицы коинов
        const createCoinsTableQuery = `
            CREATE TABLE IF NOT EXISTS user_coins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                coins INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.run(createCoinsTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы коинов:', err);
            } else {
                console.log('Таблица коинов создана успешно');
            }
        });

        // Создание таблицы товаров магазина
        const createShopItemsTableQuery = `
            CREATE TABLE IF NOT EXISTS shop_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price INTEGER NOT NULL,
                category TEXT DEFAULT 'general',
                is_active BOOLEAN DEFAULT 1,
                item_type TEXT NOT NULL,
                item_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.run(createShopItemsTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы товаров:', err);
            } else {
                console.log('Таблица товаров создана успешно');
            }
        });

        // Создание таблицы покупок
        const createPurchasesTableQuery = `
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                price_paid INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES shop_items (id)
            )
        `;
        this.db.run(createPurchasesTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы покупок:', err);
            } else {
                console.log('Таблица покупок создана успешно');
            }
        });
    }


// Метод для добавления новых столбцов Хаки
async addHakiColumns() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Добавление новых столбцов Хаки...');
        
        // Массив новых столбцов для добавления
        const newColumns = [
            { name: 'hakinab', type: 'TEXT', default: 'NULL' },
            { name: 'hakiconq', type: 'TEXT', default: 'NULL' },
            { name: 'hakivor', type: 'TEXT', default: 'NULL' }
        ];

        // Сначала проверяем существующие столбцы
        this.db.all("PRAGMA table_info(characters)", [], (err, columns) => {
            if (err) {
                console.error('❌ Ошибка получения информации о столбцах:', err);
                reject(err);
                return;
            }

            const existingColumns = columns.map(col => col.name);
            console.log('📋 Существующие столбцы:', existingColumns);

            // Добавляем только те столбцы, которых еще нет
            const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col.name));
            
            if (columnsToAdd.length === 0) {
                console.log('✅ Все столбцы Хаки уже существуют');
                resolve();
                return;
            }

            console.log(`📝 Добавляем ${columnsToAdd.length} новых столбцов:`, columnsToAdd.map(col => col.name));

            // Добавляем столбцы последовательно
            let addedCount = 0;
            const addNextColumn = () => {
                if (addedCount >= columnsToAdd.length) {
                    console.log('✅ Все новые столбцы Хаки добавлены успешно');
                    resolve();
                    return;
                }

                const column = columnsToAdd[addedCount];
                const query = `ALTER TABLE characters ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`;
                
                console.log(`🔧 Добавляем столбец: ${column.name}`);
                
                this.db.run(query, [], (err) => {
                    if (err) {
                        console.error(`❌ Ошибка добавления столбца ${column.name}:`, err);
                        reject(err);
                        return;
                    }
                    
                    console.log(`✅ Столбец ${column.name} добавлен успешно`);
                    addedCount++;
                    addNextColumn(); // Добавляем следующий столбец
                });
            };

            // Начинаем добавление столбцов
            addNextColumn();
        });
    });
}

updateCharacterAttributes(characterId, attributes) {
    return new Promise((resolve, reject) => {
        if (!attributes || Object.keys(attributes).length === 0) {
            resolve(0);
            return;
        }

        const updates = [];
        const values = [];

        // Числовые поля (добавляются к текущим значениям)
        const numericFields = ['strength', 'agility', 'reaction', 'accuracy', 'endurance', 'durability', 'magic', 'budget'];
        
        // Текстовые поля (заменяются)
        const textFields = ['name', 'race', 'age', 'nickname', 'organization', 'position', 'mention', 
                           'hakivor', 'hakinab', 'hakiconq', 'devilfruit', 'martialarts', 'patronage', 
                           'core', 'elements', 'additional'];

        for (const [field, value] of Object.entries(attributes)) {
            if (numericFields.includes(field)) {
                updates.push(`${field} = COALESCE(${field}, 0) + ?`);
                values.push(value);
            } else if (textFields.includes(field)) {
                updates.push(`${field} = ?`);
                values.push(value);
            }
        }

        if (updates.length === 0) {
            resolve(0);
            return;
        }

        values.push(characterId);
        const query = `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`;

        this.db.run(query, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

async changeColumnTypes() {
    return new Promise((resolve, reject) => {
        this.db.serialize(() => {
            // Отключаем проверку внешних ключей
            this.db.run("PRAGMA foreign_keys=off");
            
            this.db.run("BEGIN TRANSACTION");
            
            // Переименовываем старую таблицу
            this.db.run("ALTER TABLE characters RENAME TO characters_old", (err) => {
                if (err) {
                    console.error('Ошибка переименования таблицы:', err);
                    this.db.run("ROLLBACK");
                    reject(err);
                    return;
                }
                
                // Создаем новую таблицу с измененными типами колонок
                const createNewTableQuery = `
                    CREATE TABLE characters (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        race TEXT,
                        age TEXT,
                        nickname TEXT,
                        organization TEXT,
                        position TEXT,
                        mention TEXT,
                        strength INTEGER DEFAULT 0,
                        agility INTEGER DEFAULT 0,
                        reaction INTEGER DEFAULT 0,
                        accuracy INTEGER DEFAULT 0,
                        endurance INTEGER DEFAULT 0,
                        durability INTEGER DEFAULT 0,
                        magic INTEGER DEFAULT 0,
                        devilfruit TEXT,
                        patronage TEXT,
                        core TEXT,
                        hakivor TEXT,
                        hakinab TEXT,
                        hakiconq TEXT,
                        elements TEXT,
                        martialarts TEXT,
                        budget INTEGER DEFAULT 0,
                        additional TEXT,
                        avatar_url TEXT,
                        embed_color TEXT DEFAULT '#9932cc',
                        icon_url TEXT DEFAULT NULL,
                        slot INTEGER DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                
                this.db.run(createNewTableQuery, (err) => {
                    if (err) {
                        console.error('Ошибка создания новой таблицы:', err);
                        this.db.run("ROLLBACK");
                        reject(err);
                        return;
                    }
                    
                    // Копируем данные из старой таблицы в новую с преобразованием типов
                    const copyDataQuery = `
                        INSERT INTO characters (
                            id, user_id, name, race, age, nickname, organization, position, mention,
                            strength, agility, reaction, accuracy, endurance, durability, magic,
                            devilfruit, patronage, core, hakivor, hakinab, hakiconq,
                            elements, martialarts, budget, additional, avatar_url, embed_color, icon_url, slot, created_at
                        )
                        SELECT 
                            id, user_id, name, race, 
                            CAST(age AS TEXT), 
                            nickname, organization, position, mention,
                            strength, agility, reaction, accuracy, endurance, durability, magic,
                            devilfruit, patronage, core, 
                            CAST(hakivor AS TEXT), 
                            CAST(hakinab AS TEXT), 
                            CAST(hakiconq AS TEXT),
                            elements, martialarts, budget, additional, avatar_url, embed_color, icon_url, slot, created_at
                        FROM characters_old
                    `;
                    
                    this.db.run(copyDataQuery, (err) => {
                        if (err) {
                            console.error('Ошибка копирования данных:', err);
                            this.db.run("ROLLBACK");
                            reject(err);
                            return;
                        }
                        
                        // Удаляем старую таблицу
                        this.db.run("DROP TABLE characters_old", (err) => {
                            if (err) {
                                console.error('Ошибка удаления старой таблицы:', err);
                                this.db.run("ROLLBACK");
                                reject(err);
                                return;
                            }
                            
                            // Завершаем транзакцию
                            this.db.run("COMMIT", (err) => {
                                if (err) {
                                    console.error('Ошибка коммита:', err);
                                    reject(err);
                                } else {
                                    // Включаем обратно проверку внешних ключей
                                    this.db.run("PRAGMA foreign_keys=on");
                                    console.log('✅ Типы колонок успешно изменены');
                                    resolve();
                                }
                            });
                        });
                    });
                });
            });
        });
    });
}

    // Инициализация таблицы темп-банов
    initTempBanTable() {
        const createTempBanTableQuery = `
            CREATE TABLE IF NOT EXISTS temp_bans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                ban_end_time DATETIME NOT NULL,
                reason TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guild_id)
            )
        `;
        this.db.run(createTempBanTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы темп-банов:', err);
            } else {
                console.log('Таблица темп-банов создана успешно');
            }
        });
    }

    // Инициализация таблицы темп-мутов
    initTempMuteTable() {
        const createTempMuteTableQuery = `
            CREATE TABLE IF NOT EXISTS temp_mutes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                mute_end_time DATETIME NOT NULL,
                reason TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guild_id)
            )
        `;
        this.db.run(createTempMuteTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы темп-мутов:', err);
            } else {
                console.log('Таблица темп-мутов создана успешно');
            }
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ С ТЕМП-БАНАМИ
    // ===============================
    addTempBan(userId, guildId, banEndTime, reason, moderatorId) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO temp_bans (user_id, guild_id, ban_end_time, reason, moderator_id)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, guild_id)
                DO UPDATE SET
                    ban_end_time = ?,
                    reason = ?,
                    moderator_id = ?,
                    created_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [
                userId, guildId, banEndTime.toISOString(), reason, moderatorId,
                banEndTime.toISOString(), reason, moderatorId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    removeTempBan(userId, guildId) {
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?';
            this.db.run(query, [userId, guildId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    getExpiredTempBans() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM temp_bans WHERE ban_end_time <= datetime("now")';
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getTempBan(userId, guildId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM temp_bans WHERE user_id = ? AND guild_id = ?';
            this.db.get(query, [userId, guildId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getAllTempBans(guildId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM temp_bans WHERE guild_id = ? ORDER BY created_at DESC';
            this.db.all(query, [guildId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ С ТЕМП-МУТАМИ
    // ===============================
    addTempMute(userId, guildId, muteEndTime, reason, moderatorId) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO temp_mutes (user_id, guild_id, mute_end_time, reason, moderator_id)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id, guild_id)
                DO UPDATE SET
                    mute_end_time = ?,
                    reason = ?,
                    moderator_id = ?,
                    created_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [
                userId, guildId, muteEndTime.toISOString(), reason, moderatorId,
                muteEndTime.toISOString(), reason, moderatorId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    removeTempMute(userId, guildId) {
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM temp_mutes WHERE user_id = ? AND guild_id = ?';
            this.db.run(query, [userId, guildId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    getExpiredTempMutes() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM temp_mutes WHERE mute_end_time <= datetime("now")';
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getTempMute(userId, guildId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM temp_mutes WHERE user_id = ? AND guild_id = ?';
            this.db.get(query, [userId, guildId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getAllTempMutes(guildId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM temp_mutes WHERE guild_id = ? ORDER BY created_at DESC';
            this.db.all(query, [guildId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ С ПЕРСОНАЖАМИ
    // ===============================
    createCharacter(characterData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO characters (
                    user_id, name, race, age, nickname, organization, position, mention,
                    strength, agility, reaction, accuracy, endurance, durability, magic,
                    devilfruit, patronage, core, hakivor, hakinab,
                    hakiconq, elements, martialarts, budget, additional, avatar_url, embed_color, slot
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            this.db.run(query, [
                characterData.user_id, characterData.name, characterData.race,
                characterData.age, characterData.nickname, characterData.organization,
                characterData.position, characterData.mention, characterData.strength,
                characterData.agility, characterData.reaction, characterData.accuracy,
                characterData.endurance, characterData.durability, characterData.magic,
                characterData.devilfruit, characterData.patronage, characterData.core,
                characterData.hakivor, characterData.hakinab,
                characterData.hakiconq, characterData.elements,
                characterData.martialarts, characterData.budget, characterData.additional,
                characterData.avatar_url || null, characterData.embed_color || '#9932cc',
                characterData.slot || 1
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    getCharacterByUserId(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM characters WHERE user_id = ?';
            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getAllCharactersByUserId(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM characters WHERE user_id = ? ORDER BY slot ASC, created_at DESC';
            this.db.all(query, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getCharacterById(characterId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM characters WHERE id = ?';
            this.db.get(query, [characterId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    addCharacterStats(characterId, stats) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE characters SET
                    strength = strength + ?,
                    agility = agility + ?,
                    reaction = reaction + ?,
                    accuracy = accuracy + ?,
                    endurance = endurance + ?,
                    durability = durability + ?,
                    magic = magic + ?,
                    devilfruit = CASE WHEN ? != '' THEN ? ELSE devilfruit END,
                    patronage = CASE WHEN ? != '' THEN ? ELSE patronage END,
                    core = CASE WHEN ? != '' THEN ? ELSE core END,
                    hakivor = CASE WHEN ? != '' THEN ? ELSE hakivor END,
                    hakinab = CASE WHEN ? != '' THEN ? ELSE hakinab END,
                    hakiconq = CASE WHEN ? != '' THEN ? ELSE hakiconq END,
                    elements = CASE WHEN ? != '' THEN ? ELSE elements END,
                    martialarts = CASE WHEN ? != '' THEN ? ELSE martialarts END,
                    budget = budget + ?,
                    organization = CASE WHEN ? != '' THEN ? ELSE organization END,
                    position = CASE WHEN ? != '' THEN ? ELSE position END,
                    additional = CASE WHEN ? != '' THEN ? ELSE additional END
                WHERE id = ?
            `;
            this.db.run(query, [
                stats.strength || 0, stats.agility || 0, stats.reaction || 0, stats.accuracy || 0,
                stats.endurance || 0, stats.durability || 0, stats.magic || 0,
                stats.devilfruit || '', stats.devilfruit || '',
                stats.patronage || '', stats.patronage || '',
                stats.core || '', stats.core || '',
                stats.hakivor || '', stats.hakinab || '', stats.hakiconq || '',
                stats.elements || '', stats.elements || '',
                stats.martialarts || '', stats.martialarts || '',
                stats.budget || 0,
                stats.organization || '', stats.organization || '',
                stats.position || '', stats.position || '',
                stats.additional || '', stats.additional || '',
                characterId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterStats(characterId, stats) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE characters SET
                    strength = ?, agility = ?, reaction = ?, accuracy = ?,
                    endurance = ?, durability = ?, magic = ?, devilfruit = ?,
                    patronage = ?, core = ?, hakivor = ?, hakinab = ?,
                    hakiconq = ?, elements = ?, martialarts = ?, budget = ?,
                    organization = ?, position = ?, additional = ?
                WHERE id = ?
            `;
            this.db.run(query, [
                stats.strength, stats.agility, stats.reaction, stats.accuracy,
                stats.endurance, stats.durability, stats.magic, stats.devilfruit,
                stats.patronage, stats.core, stats.elements, stats.martialarts, stats.budget,
                stats.organization, stats.position, stats.additional, characterId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterAvatar(characterId, avatarUrl) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE characters SET avatar_url = ? WHERE id = ?';
            this.db.run(query, [avatarUrl, characterId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterColor(characterId, color) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE characters SET embed_color = ? WHERE id = ?';
            this.db.run(query, [color, characterId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterIcon(characterId, iconUrl) {
        return new Promise((resolve, reject) => {
            const query = 'UPDATE characters SET icon_url = ? WHERE id = ?';
            this.db.run(query, [iconUrl, characterId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterPersonalInfo(characterId, personalData) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE characters SET
                    name = CASE WHEN ? != '' THEN ? ELSE name END,
                    race = CASE WHEN ? != '' THEN ? ELSE race END,
                    age = CASE WHEN ? != 0 THEN ? ELSE age END,
                    nickname = CASE WHEN ? != '' THEN ? ELSE nickname END,
                    mention = CASE WHEN ? != '' THEN ? ELSE mention END
                WHERE id = ?
            `;
            this.db.run(query, [
                personalData.name || '', personalData.name || '',
                personalData.race || '', personalData.race || '',
                personalData.age || 0, personalData.age || 0,
                personalData.nickname || '', personalData.nickname || '',
                personalData.mention || '', personalData.mention || '',
                characterId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterAbilities(characterId, abilities) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE characters SET
                    devilfruit = CASE WHEN ? != '' THEN ? ELSE devilfruit END,
                    patronage = CASE WHEN ? != '' THEN ? ELSE patronage END,
                    core = CASE WHEN ? != '' THEN ? ELSE core END,
                    hakiconq = CASE WHEN ? != '' THEN ? ELSE hakiconq END,
                    hakivor = CASE WHEN ? != '' THEN ? ELSE hakivor END,
                    hakinab = CASE WHEN ? != '' THEN ? ELSE hakinab END,
                    elements = CASE WHEN ? != '' THEN ? ELSE elements END
                WHERE id = ?
            `;
            this.db.run(query, [
                abilities.devilfruit || '', abilities.devilfruit || '',
                abilities.patronage || '', abilities.patronage || '',
                abilities.hakivor || '', abilities.hakivor || '',
                abilities.hakinab || '', abilities.hakinab || '',
                abilities.hakiconq || '',abilities.hakiconq || '',
                abilities.core || '',abilities.core || '',
                abilities.elements || '', abilities.elements || '',
                characterId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateCharacterMisc(characterId, miscData) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE characters SET
                    organization = CASE WHEN ? != '' THEN ? ELSE organization END,
                    position = CASE WHEN ? != '' THEN ? ELSE position END,
                    budget = budget + ?,
                    additional = CASE WHEN ? != '' THEN ? ELSE additional END
                WHERE id = ?
            `;
            this.db.run(query, [
                miscData.organization || '', miscData.organization || '',
                miscData.position || '', miscData.position || '',
                miscData.budget || 0,
                miscData.additional || '', miscData.additional || '',
                characterId
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    getAllCharacters() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM characters ORDER BY created_at DESC';
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getAllCharactersWithStats() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    id,
                    name,
                    user_id,
                    race,
                    strength,
                    agility,
                    reaction,
                    accuracy,
                    endurance,
                    durability,
                    magic,
                    avatar_url,
                    icon_url,
                    (strength + agility + reaction + accuracy + endurance + durability + magic) AS total_stats
                FROM characters
                ORDER BY total_stats DESC
            `;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    deleteCharacter(characterId) {
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM characters WHERE id = ?';
            this.db.run(query, [characterId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ СО СЛОТАМИ
    // ===============================
    getUserSlots(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT max_slots FROM user_slots WHERE user_id = ?';
            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.max_slots : 3); // По умолчанию 3 слота
                }
            });
        });
    }

    setUserSlots(userId, maxSlots) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO user_slots (user_id, max_slots)
                VALUES (?, ?)
                ON CONFLICT(user_id)
                DO UPDATE SET max_slots = ?, updated_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [userId, maxSlots, maxSlots], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    getNextAvailableSlot(userId) {
        return new Promise((resolve, reject) => {
            if (!userId) {
                resolve(1);
                return;
            }

            const query = 'SELECT slot FROM characters WHERE user_id = ? ORDER BY slot ASC';
            this.db.all(query, [userId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const usedSlots = rows.map(row => row.slot);
                    let nextSlot = 1;
                    while (usedSlots.includes(nextSlot)) {
                        nextSlot++;
                    }
                    resolve(nextSlot);
                }
            });
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ С АКТИВНОСТЬЮ
    // ===============================
    initUserActivityTable() {
        // Таблица для хранения активности пользователей
        const createActivityTableQuery = `
            CREATE TABLE IF NOT EXISTS user_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                messages_count INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                week_start DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, guild_id, week_start)
            )
        `;
        this.db.run(createActivityTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы активности:', err);
            } else {
                console.log('Таблица активности создана успешно');
            }
        });

        // Таблица для отслеживания времени в голосовых каналах
        const createVoiceSessionsTableQuery = `
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                join_time DATETIME NOT NULL,
                leave_time DATETIME,
                duration INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.run(createVoiceSessionsTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы голосовых сессий:', err);
            } else {
                console.log('Таблица голосовых сессий создана успешно');
            }
        });
    }

    getWeekStart() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday.toISOString().split('T')[0];
    }

    addMessageActivity(userId, guildId) {
        return new Promise((resolve, reject) => {
            const weekStart = this.getWeekStart();
            const query = `
                INSERT INTO user_activity (user_id, guild_id, messages_count, week_start)
                VALUES (?, ?, 1, ?)
                ON CONFLICT(user_id, guild_id, week_start)
                DO UPDATE SET
                    messages_count = messages_count + 1,
                    updated_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [userId, guildId, weekStart], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    addVoiceTime(userId, guildId, seconds) {
        return new Promise((resolve, reject) => {
            const weekStart = this.getWeekStart();
            const query = `
                INSERT INTO user_activity (user_id, guild_id, voice_time, week_start)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id, guild_id, week_start)
                DO UPDATE SET
                    voice_time = voice_time + ?,
                    updated_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [userId, guildId, seconds, weekStart, seconds], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    startVoiceSession(userId, guildId, channelId) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO voice_sessions (user_id, guild_id, channel_id, join_time)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `;
            this.db.run(query, [userId, guildId, channelId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    endVoiceSession(userId, guildId) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE voice_sessions
                SET leave_time = CURRENT_TIMESTAMP,
                    duration = (julianday(CURRENT_TIMESTAMP) - julianday(join_time)) * 86400
                WHERE user_id = ? AND guild_id = ? AND leave_time IS NULL
            `;
            this.db.run(query, [userId, guildId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    getUserWeekActivity(userId, guildId) {
        return new Promise((resolve, reject) => {
            const weekStart = this.getWeekStart();
            const query = `
                SELECT messages_count, voice_time
                FROM user_activity
                WHERE user_id = ? AND guild_id = ? AND week_start = ?
            `;
            this.db.get(query, [userId, guildId, weekStart], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || { messages_count: 0, voice_time: 0 });
                }
            });
        });
    }

    getTopUsersThisWeek(guildId, limit = 10) {
        return new Promise((resolve, reject) => {
            const weekStart = this.getWeekStart();
            const query = `
                SELECT user_id, messages_count, voice_time,
                    (messages_count + voice_time/60) as total_score
                FROM user_activity
                WHERE guild_id = ? AND week_start = ?
                ORDER BY total_score DESC
                LIMIT ?
            `;
            this.db.all(query, [guildId, weekStart, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getTopCharactersByStats(limit = 10) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    id,
                    name,
                    user_id,
                    (strength + agility + reaction + accuracy + endurance + durability + magic) AS total_stats
                FROM characters
                ORDER BY total_stats DESC
                LIMIT ?
            `;
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getCharacterRankByStats(characterId) {
        return new Promise((resolve, reject) => {
            const query = `
                WITH ranked_characters AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (ORDER BY (strength + agility + reaction + accuracy + endurance + durability + magic) DESC) as rank
                    FROM characters
                )
                SELECT rank FROM ranked_characters WHERE id = ?
            `;
            this.db.get(query, [characterId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.rank : null);
                }
            });
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ С RUBYCOINS
    // ===============================
    initRubyCoinTable() {
        const createRubyCoinTableQuery = `
            CREATE TABLE IF NOT EXISTS user_rubycoins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                rubycoins REAL DEFAULT 0.0,
                total_earned REAL DEFAULT 0.0,
                total_spent REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.run(createRubyCoinTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы RubyCoin:', err);
            } else {
                console.log('Таблица RubyCoin создана успешно');
            }
        });
    }

    getUserRubyCoins(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT rubycoins FROM user_rubycoins WHERE user_id = ?';
            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.rubycoins : 0);
                }
            });
        });
    }

    addRubyCoins(userId, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO user_rubycoins (user_id, rubycoins, total_earned)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    rubycoins = rubycoins + ?,
                    total_earned = total_earned + ?,
                    updated_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [userId, amount, amount, amount, amount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    removeRubyCoins(userId, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE user_rubycoins
                SET rubycoins = rubycoins - ?,
                    total_spent = total_spent + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND rubycoins >= ?
            `;
            this.db.run(query, [amount, amount, userId, amount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    setRubyCoins(userId, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO user_rubycoins (user_id, rubycoins)
                VALUES (?, ?)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    rubycoins = ?,
                    updated_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [userId, amount, amount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    getRubyCoinLeaderboard(limit = 10) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT user_id, rubycoins, total_earned, total_spent
                FROM user_rubycoins
                ORDER BY rubycoins DESC
                LIMIT ?
            `;
            this.db.all(query, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // ===============================
    // МЕТОДЫ ДЛЯ РАБОТЫ С КРУТКАМИ ХАКИ
    // ===============================
    initHakiSpinsTable() {
        const createHakiSpinsTableQuery = `
            CREATE TABLE IF NOT EXISTS user_haki_spins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                haki_spins INTEGER DEFAULT 0,
                total_earned INTEGER DEFAULT 0,
                total_used INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.run(createHakiSpinsTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы круток хаки:', err);
            } else {
                console.log('Таблица круток хаки создана успешно');
            }
        });
    }

    initHakiHistoryTable() {
        const createHakiHistoryTableQuery = `
            CREATE TABLE IF NOT EXISTS haki_spin_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                haki_result TEXT NOT NULL,
                spin_count INTEGER NOT NULL,
                total_spins INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.run(createHakiHistoryTableQuery, (err) => {
            if (err) {
                console.error('Ошибка создания таблицы истории хаки:', err);
            } else {
                console.log('Таблица истории хаки создана успешно');
            }
        });
    }

    getUserHakiSpins(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT haki_spins FROM user_haki_spins WHERE user_id = ?';
            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.haki_spins : 0);
                }
            });
        });
    }

    addHakiSpins(userId, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO user_haki_spins (user_id, haki_spins, total_earned)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id)
                DO UPDATE SET
                    haki_spins = haki_spins + ?,
                    total_earned = total_earned + ?,
                    updated_at = CURRENT_TIMESTAMP
            `;
            this.db.run(query, [userId, amount, amount, amount, amount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    removeHakiSpins(userId, amount) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE user_haki_spins
                SET haki_spins = haki_spins - ?,
                    total_used = total_used + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND haki_spins >= ?
            `;
            this.db.run(query, [amount, amount, userId, amount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    saveHakiSpinResult(userId, hakiResult, spinCount, totalSpins, sessionId) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO haki_spin_history (user_id, haki_result, spin_count, total_spins, session_id)
                VALUES (?, ?, ?, ?, ?)
            `;
            this.db.run(query, [userId, hakiResult, spinCount, totalSpins, sessionId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    getUserHakiHistory(userId, limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT session_id, COUNT(*) as total_spins,
                    GROUP_CONCAT(haki_result) as results,
                    MIN(created_at) as session_start
                FROM haki_spin_history
                WHERE user_id = ?
                GROUP BY session_id
                ORDER BY session_start DESC
                LIMIT ? OFFSET ?
            `;
            this.db.all(query, [userId, limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getUserHakiHistoryCount(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT COUNT(DISTINCT session_id) as total_sessions
                FROM haki_spin_history
                WHERE user_id = ?
            `;
            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.total_sessions : 0);
                }
            });
        });
    }

    getHakiSessionDetails(userId, sessionId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT haki_result, spin_count, created_at
                FROM haki_spin_history
                WHERE user_id = ? AND session_id = ?
                ORDER BY spin_count ASC
            `;
            this.db.all(query, [userId, sessionId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Добавляем недостающий метод addHakiHistory
    addHakiHistory(userId, sessionId, results, totalSpins) {
        return new Promise(async (resolve, reject) => {
            try {
                // Сохраняем каждый результат отдельно
                for (let i = 0; i < results.length; i++) {
                    await this.saveHakiSpinResult(userId, results[i], i + 1, totalSpins, sessionId);
                }
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    }

    async updateCharacterStatsAdvanced(characterId, stats) {
        return new Promise((resolve, reject) => {
            console.log(`🔄 Обновление персонажа ${characterId}:`, stats);
            if (!stats || Object.keys(stats).length === 0) {
                console.warn('⚠️ Нет данных для обновления');
                resolve(0);
                return;
            }
    
            // ИСПРАВЛЕННЫЕ массивы полей
            const numericAddFields = [
                'strength', 'agility', 'reaction', 'accuracy',
                'endurance', 'durability', 'magic', 'budget'
            ];
            

            const hakiFields = []; // Оставляем пустым
            
            const replaceNumericFields = ['age'];
            
            // ДОБАВЛЯЕМ поля хаки в textFields
            const textFields = [
                'name', 'race', 'nickname', 'organization', 'position',
                'devilfruit', 'martialarts', 'patronage', 'core',
                'elements', 'mention', 'additional', 
                'hakivor', 'hakinab', 'hakiconq'
            ];
    
            const updates = [];
            const values = [];
    
            for (const [field, value] of Object.entries(stats)) {
                console.log(`📝 Обработка поля: ${field} = ${value}`);
                
                if (numericAddFields.includes(field)) {
                    // Обычные числовые поля (INTEGER)
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue !== 0) {
                        updates.push(`${field} = COALESCE(${field}, 0) + ?`);
                        values.push(numValue);
                        console.log(`➕ ${field}: добавляем ${numValue}`);
                    }
                } else if (replaceNumericFields.includes(field)) {
                    // Заменяем значение для возраста
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        updates.push(`${field} = ?`);
                        values.push(numValue.toString());
                        console.log(`🔄 ${field}: заменяем на ${numValue}`);
                    }
                } else if (textFields.includes(field)) {
                    // Обычные текстовые поля (ВКЛЮЧАЯ ХАКИ)
                    if (value !== undefined && value !== null) {
                        const stringValue = value.toString().trim();
                        if (stringValue !== '') {
                            updates.push(`${field} = ?`);
                            values.push(stringValue);
                            console.log(`📝 ${field}: заменяем на "${stringValue}"`);
                        } else {
                            updates.push(`${field} = NULL`);
                            console.log(`🗑️ ${field}: очищаем (NULL)`);
                        }
                    }
                } else {
                    console.warn(`⚠️ Неизвестное поле: ${field}`);
                }
            }
    
            if (updates.length === 0) {
                console.warn('⚠️ Нет корректных полей для обновления');
                resolve(0);
                return;
            }
    
            values.push(characterId);
            const query = `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`;
            
            console.log(`📋 SQL запрос: ${query}`);
            console.log(`📊 Значения: [${values.join(', ')}]`);
    
            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('❌ Ошибка базы данных:', err);
                    reject(new Error(`Ошибка базы данных: ${err.message}`));
                } else {
                    console.log(`✅ Обновлено строк: ${this.changes}`);
                    resolve(this.changes);
                }
            });
        });
    }
    
// Инициализация таблицы тикетов с счетчиком
// Инициализация таблицы тикетов с счетчиком
initTicketTable() {
    const createTicketTableQuery = `
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number INTEGER NOT NULL UNIQUE,
        curator_id TEXT,
        purpose TEXT NOT NULL,
        character_ids TEXT NOT NULL,
        status TEXT DEFAULT 'Ожидает куратора',
        creator_id TEXT NOT NULL,
        channel_id TEXT,
        participants TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        next_ticket_allowed DATETIME DEFAULT NULL
    )
    `;

    this.db.run(createTicketTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы тикетов:', err);
        } else {
            console.log('Таблица тикетов создана успешно');
            
            // Добавляем новый столбец если его нет
            this.db.run('ALTER TABLE tickets ADD COLUMN next_ticket_allowed DATETIME DEFAULT NULL', (alterErr) => {
                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                    console.error('Ошибка добавления столбца next_ticket_allowed:', alterErr);
                } else if (!alterErr) {
                    console.log('Столбец next_ticket_allowed добавлен');
                }
            });
        }
    });


    // Таблица для отзывов о кураторах
    const createReviewsTableQuery = `
        CREATE TABLE IF NOT EXISTS curator_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number INTEGER NOT NULL,
            curator_id TEXT NOT NULL,
            reviewer_id TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_number) REFERENCES tickets (ticket_number)
        )
    `;
    
    this.db.run(createReviewsTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы отзывов:', err);
        } else {
            console.log('Таблица отзывов создана успешно');
        }
    });
    this.db.run(createTicketTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы тикетов:', err);
        } else {
            console.log('Таблица тикетов создана успешно');
            
            // Добавляем недостающий столбец participants если его нет
            this.db.run('ALTER TABLE tickets ADD COLUMN participants TEXT DEFAULT ""', (alterErr) => {
                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                    console.error('Ошибка добавления столбца participants:', alterErr);
                } else if (!alterErr) {
                    console.log('Столбец participants добавлен');
                }
            });
        }
    });

    // Таблица для хранения счетчика тикетов
    const createCounterTableQuery = `
        CREATE TABLE IF NOT EXISTS ticket_counter (
            id INTEGER PRIMARY KEY,
            counter INTEGER DEFAULT 200
        )
    `;

    this.db.run(createCounterTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы счетчика:', err);
        } else {
            // Инициализируем счетчик если его нет
            this.db.run('INSERT OR IGNORE INTO ticket_counter (id, counter) VALUES (1, 200)');
        }
    });
}


// Получение следующего номера тикета
getNextTicketNumber() {
    return new Promise((resolve, reject) => {
        this.db.get('SELECT counter FROM ticket_counter WHERE id = 1', (err, row) => {
            if (err) {
                reject(err);
            } else {
                const nextNumber = row ? row.counter : 200;
                // Увеличиваем счетчик
                this.db.run('UPDATE ticket_counter SET counter = counter + 1 WHERE id = 1', (updateErr) => {
                    if (updateErr) {
                        reject(updateErr);
                    } else {
                        resolve(nextNumber);
                    }
                });
            }
        });
    });
}

// Создание нового тикета
createTicket(ticketData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO tickets (ticket_number, purpose, character_ids, creator_id, channel_id, participants)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [
            ticketData.ticket_number,
            ticketData.purpose,
            ticketData.character_ids,
            ticketData.creator_id,
            ticketData.channel_id,
            ticketData.participants || ''
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Получение тикета по номеру
getTicketByNumber(ticketNumber) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE ticket_number = ?';
        this.db.get(query, [ticketNumber], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Получение всех тикетов пользователя
getUserTickets(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE creator_id = ? ORDER BY created_at DESC';
        this.db.all(query, [userId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Получение всех активных тикетов
getAllActiveTickets() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE status != "Закрыт" ORDER BY created_at DESC';
        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Получение свободных тикетов (без куратора)
getFreeTickets() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE curator_id IS NULL AND status = "Ожидает куратора" ORDER BY created_at ASC';
        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Назначение куратора
assignCurator(ticketNumber, curatorId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET curator_id = ?, status = 'В работе', updated_at = CURRENT_TIMESTAMP 
            WHERE ticket_number = ?
        `;
        
        this.db.run(query, [curatorId, ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Обновление статуса тикета
updateTicketStatus(ticketNumber, status) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE ticket_number = ?
        `;
        
        this.db.run(query, [status, ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}
// Получение занятых тикетов (с куратором)
getOccupiedTickets() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE curator_id IS NOT NULL AND status != "Закрыт" ORDER BY created_at DESC';
        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}
// Добавьте эти методы в класс Database

// Методы для работы с отзывами кураторов
addCuratorReview(ticketNumber, curatorId, reviewerId, rating, comment) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO curator_reviews (ticket_number, curator_id, reviewer_id, rating, comment)
            VALUES (?, ?, ?, ?, ?)
        `;
        this.db.run(query, [ticketNumber, curatorId, reviewerId, rating, comment], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Проверка, оставлял ли пользователь отзыв
hasUserReviewedTicket(ticketNumber, userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT COUNT(*) as count FROM curator_reviews WHERE ticket_number = ? AND reviewer_id = ?';
        this.db.get(query, [ticketNumber, userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count > 0);
            }
        });
    });
}

// Получение рейтинга куратора
getCuratorRating(curatorId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                AVG(CAST(rating as REAL)) as average_rating,
                COUNT(*) as total_reviews
            FROM curator_reviews 
            WHERE curator_id = ?
        `;
        this.db.get(query, [curatorId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    average_rating: row.average_rating || 0,
                    total_reviews: row.total_reviews || 0
                });
            }
        });
    });
}

// Получение всех рейтингов кураторов
getAllCuratorRatings() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                curator_id,
                AVG(CAST(rating as REAL)) as average_rating,
                COUNT(*) as total_reviews,
                COUNT(DISTINCT ticket_number) as total_tickets
            FROM curator_reviews 
            GROUP BY curator_id
            ORDER BY average_rating DESC, total_reviews DESC
        `;
        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Смена куратора
changeCurator(ticketNumber, newCuratorId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET curator_id = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE ticket_number = ?
        `;
        
        this.db.run(query, [newCuratorId, ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Удаление куратора
removeCurator(ticketNumber) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET curator_id = NULL, status = 'Ожидает куратора', updated_at = CURRENT_TIMESTAMP 
            WHERE ticket_number = ?
        `;
        
        this.db.run(query, [ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Получение всех закрытых тикетов
getClosedTickets() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE status = "Закрыт" ORDER BY updated_at DESC';
        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Обновление участников тикета
updateTicketParticipants(ticketNumber, participants) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET participants = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE ticket_number = ?
        `;
        
        this.db.run(query, [participants, ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}
// Добавить в database.js в класс Database

createTicketWithValidation(ticketData) {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Проверка кулдауна (48 часов между тикетами)
            const lastTicket = await this.getLastUserTicket(ticketData.creator_id);
            if (lastTicket) {
                const lastTicketTime = new Date(lastTicket.created_at);
                const now = new Date();
                const hoursDiff = (now - lastTicketTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 48) {
                    const remainingHours = Math.ceil(48 - hoursDiff);
                    throw new Error(`COOLDOWN:${remainingHours}`);
                }
            }

            // 2. Проверка активного тикета
            const activeTickets = await this.getUserActiveTickets(ticketData.creator_id);
            if (activeTickets.length > 0) {
                throw new Error('ACTIVE_TICKET');
            }

            // 3. Валидация персонажей
            const characterIds = ticketData.character_ids.split(',')
                .map(id => id.trim())
                .filter(id => id && !isNaN(parseInt(id)))
                .map(id => parseInt(id));

            if (characterIds.length === 0) {
                throw new Error('NO_VALID_CHARACTERS');
            }

            // 4. Проверка принадлежности персонажей пользователю
            const validatedCharacters = [];
            for (const charId of characterIds) {
                const character = await this.getCharacterById(charId);
                if (!character) {
                    continue; // Пропускаем несуществующие персонажи
                }
                if (character.user_id !== ticketData.creator_id) {
                    continue; // Пропускаем чужие персонажи
                }
                validatedCharacters.push(character);
            }

            if (validatedCharacters.length === 0) {
                throw new Error('NO_USER_CHARACTERS');
            }

            // 5. Создание тикета
            const ticketId = await this.createTicket(ticketData);

            resolve({
                ticketId,
                validatedCharacters
            });

        } catch (error) {
            reject(error);
        }
    });
}

// Вспомогательные методы для проверок
getLastUserTicket(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1';
        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

getUserActiveTickets(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE creator_id = ? AND status NOT IN ("Завершен", "Закрыт")';
        this.db.all(query, [userId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Методы для управления кураторами (если еще нет)
changeCurator(ticketNumber, newCuratorId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET curator_id = ?, status = 'В работе', updated_at = CURRENT_TIMESTAMP
            WHERE ticket_number = ?
        `;
        this.db.run(query, [newCuratorId, ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

removeCurator(ticketNumber) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET curator_id = NULL, status = 'Ожидает куратора', updated_at = CURRENT_TIMESTAMP
            WHERE ticket_number = ?
        `;
        this.db.run(query, [ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}
getTicketByChannelId(channelId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE channel_id = ?';
        this.db.get(query, [channelId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

updateTicketParticipants(ticketNumber, participants) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE tickets 
            SET participants = ?, updated_at = CURRENT_TIMESTAMP
            WHERE ticket_number = ?
        `;
        this.db.run(query, [participants, ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Метод для получения закрытых тикетов
getClosedTickets() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE status IN ("Завершен", "Закрыт") ORDER BY updated_at DESC';
        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}
// Сброс кулдауна пользователя
// Сброс кулдауна пользователя
resetUserTicketCooldown(userId) {
    return new Promise((resolve, reject) => {
        // Сначала получаем последний тикет пользователя с кулдауном
        const selectQuery = `
        SELECT id 
        FROM tickets 
        WHERE creator_id = ? AND next_ticket_allowed IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 1
        `;

        this.db.get(selectQuery, [userId], (selectErr, row) => {
            if (selectErr) {
                reject(selectErr);
                return;
            }

            if (!row) {
                // Нет тикетов с кулдауном
                resolve(0);
                return;
            }

            // Теперь обновляем найденный тикет
            const updateQuery = `
            UPDATE tickets 
            SET next_ticket_allowed = NULL 
            WHERE id = ?
            `;

            this.db.run(updateQuery, [row.id], function(updateErr) {
                if (updateErr) {
                    reject(updateErr);
                } else {
                    resolve(this.changes);
                }
            });
        });
    });
}

// Инициализация таблицы логов тикетов
initTicketLogsTable() {
    const createTicketLogsTableQuery = `
    CREATE TABLE IF NOT EXISTS ticket_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        ticket_number INTEGER,
        target_user_id TEXT,
        details TEXT,
        success BOOLEAN DEFAULT 1,
        channel_id TEXT,
        guild_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    `;

    this.db.run(createTicketLogsTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы логов тикетов:', err);
        } else {
            console.log('Таблица логов тикетов создана успешно');
        }
    });
}

// Добавление записи в логи тикетов
addTicketLog(logData) {
    return new Promise((resolve, reject) => {
        const query = `
        INSERT INTO ticket_logs (admin_id, action_type, ticket_number, target_user_id, details, success, channel_id, guild_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        this.db.run(query, [
            logData.admin_id,
            logData.action_type,
            logData.ticket_number || null,
            logData.target_user_id || null,
            logData.details || null,
            logData.success !== false ? 1 : 0,
            logData.channel_id || null,
            logData.guild_id || null
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Получение пользователей с активным кулдауном
getUsersWithCooldown() {
    return new Promise((resolve, reject) => {
        const query = `
        SELECT DISTINCT creator_id, next_ticket_allowed 
        FROM tickets 
        WHERE next_ticket_allowed > datetime('now')
        ORDER BY next_ticket_allowed ASC
        `;

        this.db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Получение информации о кулдауне конкретного пользователя
getUserCooldownInfo(userId) {
    return new Promise((resolve, reject) => {
        const query = `
        SELECT next_ticket_allowed, created_at 
        FROM tickets 
        WHERE creator_id = ? AND next_ticket_allowed IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 1
        `;

        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Создание тикета с кулдауном
createTicketWithCooldown(ticketData) {
    return new Promise((resolve, reject) => {
        const nextAllowed = new Date();
        nextAllowed.setHours(nextAllowed.getHours() + 48); // 48 часов кулдаун

        const query = `
        INSERT INTO tickets (ticket_number, purpose, character_ids, creator_id, channel_id, participants, next_ticket_allowed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        this.db.run(query, [
            ticketData.ticket_number,
            ticketData.purpose,
            ticketData.character_ids,
            ticketData.creator_id,
            ticketData.channel_id,
            ticketData.participants || '',
            nextAllowed.toISOString()
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Проверка кулдауна пользователя
getUserCooldown(userId) {
    return new Promise((resolve, reject) => {
        const query = `
        SELECT next_ticket_allowed 
        FROM tickets 
        WHERE creator_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
        `;

        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                if (!row || !row.next_ticket_allowed) {
                    resolve(null); // Нет кулдауна
                } else {
                    const cooldownEnd = new Date(row.next_ticket_allowed);
                    const now = new Date();
                    
                    if (now >= cooldownEnd) {
                        resolve(null); // Кулдаун закончился
                    } else {
                        resolve(cooldownEnd); // Кулдаун активен
                    }
                }
            }
        });
    });
}

// Получение времени до окончания кулдауна в часах
getCooldownHours(userId) {
    return new Promise(async (resolve, reject) => {
        try {
            const cooldownEnd = await this.getUserCooldown(userId);
            if (!cooldownEnd) {
                resolve(0);
            } else {
                const now = new Date();
                const hoursLeft = Math.ceil((cooldownEnd - now) / (1000 * 60 * 60));
                resolve(Math.max(0, hoursLeft));
            }
        } catch (error) {
            reject(error);
        }
    });
}


}

module.exports = Database;



