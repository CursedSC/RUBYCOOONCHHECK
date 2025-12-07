const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'characters.db'), (err) => {
        if (err) {
            console.error('Ошибка подключения к БД:', err);
        } else {
            this.db.run('PRAGMA journal_mode = WAL');
            this.db.configure('busyTimeout', 5000);
            console.log('✅ База данных подключена');
        }
    });
    this.initDatabase();
    this.initUserActivityTable();
    this.initRubyCoinTable();
    this.initTempBanTable();
    this.initTempMuteTable();
    this.initHakiSpinsTable();
    this.initHakiHistoryTable();
    this.initTicketTable();
    this.initTicketLogsTable();
    this.initProfilesTable();
    this.initInviteTrackTable();
    this.initTrainingSystemTables();
    this.initCharacterGalleryTable();
    this.initPunishmentSystem();
    this.initEconomyTables();
    this.initKindnessSystem();
    this.initCustomProfileStyling();
    this.initSeparatorShopSystem();
    this.initUserEmojisTable();
}

runWithRetry(query, params = [], retries = 3) {
    return new Promise((resolve, reject) => {
        const attempt = (retriesLeft) => {
            this.db.run(query, params, function(err) {
                if (err) {
                    if (err.code === 'SQLITE_BUSY' && retriesLeft > 0) {
                        console.log(`⚠️ База занята, повтор через 100мс (осталось попыток: ${retriesLeft})`);
                        setTimeout(() => attempt(retriesLeft - 1), 100);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        };
        attempt(retries);
    });
}

getWithRetry(query, params = [], retries = 3) {
    return new Promise((resolve, reject) => {
        const attempt = (retriesLeft) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    if (err.code === 'SQLITE_BUSY' && retriesLeft > 0) {
                        console.log(`⚠️ База занята, повтор через 100мс (осталось попыток: ${retriesLeft})`);
                        setTimeout(() => attempt(retriesLeft - 1), 100);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(row);
                }
            });
        };
        attempt(retries);
    });
}
// ==== ЭКОНОМИЧЕСКАЯ СИСТЕМА ====
initEconomySystem() {
    // Таблица балансов пользователей
    const createEconomyBalance = `
    CREATE TABLE IF NOT EXISTS economy_balance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        pounds INTEGER DEFAULT 0,
        sols INTEGER DEFAULT 0,
        pessos INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id)
    )`;

    // Таблица товаров магазина
    const createShopItems = `
    CREATE TABLE IF NOT EXISTS shop_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT NOT NULL,
        description TEXT,
        price_pounds INTEGER DEFAULT 0,
        price_sols INTEGER DEFAULT 0,
        price_pessos INTEGER DEFAULT 0,
        stock INTEGER DEFAULT -1,
        category TEXT DEFAULT 'Общее',
        emoji TEXT,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

    // Таблица предложений покупки
    const createPurchaseProposals = `
    CREATE TABLE IF NOT EXISTS purchase_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        description TEXT NOT NULL,
        offer_pounds INTEGER DEFAULT 0,
        offer_sols INTEGER DEFAULT 0,
        offer_pessos INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        admin_id TEXT,
        admin_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
    )`;

    // Таблица истории транзакций
    const createTransactions = `
    CREATE TABLE IF NOT EXISTS economy_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        pounds_change INTEGER DEFAULT 0,
        sols_change INTEGER DEFAULT 0,
        pessos_change INTEGER DEFAULT 0,
        description TEXT,
        admin_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

    this.db.run(createEconomyBalance, (err) => {
        if (err) console.error('Ошибка создания economy_balance:', err);
        else console.log('✅ Таблица economy_balance создана');
    });

    this.db.run(createShopItems, (err) => {
        if (err) console.error('Ошибка создания shop_items:', err);
        else console.log('✅ Таблица shop_items создана');
    });

    this.db.run(createPurchaseProposals, (err) => {
        if (err) console.error('Ошибка создания purchase_proposals:', err);
        else console.log('✅ Таблица purchase_proposals создана');
    });

    this.db.run(createTransactions, (err) => {
        if (err) console.error('Ошибка создания economy_transactions:', err);
        else console.log('✅ Таблица economy_transactions создана');
    });
}

// === РАБОТА С БАЛАНСАМИ ===
getBalance(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM economy_balance WHERE user_id = ? AND guild_id = ?';
        this.db.get(query, [userId, guildId], (err, row) => {
            if (err) reject(err);
            else resolve(row || { pounds: 0, sols: 0, pessos: 0 });
        });
    });
}

updateBalance(userId, guildId, pounds, sols, pessos, description = null, adminId = null) {
    return new Promise((resolve, reject) => {
        this.db.serialize(() => {
            // Создаем баланс если не существует
            const insertQuery = `
                INSERT INTO economy_balance (user_id, guild_id, pounds, sols, pessos)
                VALUES (?, ?, 0, 0, 0)
                ON CONFLICT(user_id, guild_id) DO NOTHING
            `;
            this.db.run(insertQuery, [userId, guildId]);

            // Обновляем баланс
            const updateQuery = `
                UPDATE economy_balance 
                SET pounds = pounds + ?,
                    sols = sols + ?,
                    pessos = pessos + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND guild_id = ?
            `;
            this.db.run(updateQuery, [pounds, sols, pessos, userId, guildId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Логируем транзакцию
                    const logQuery = `
                        INSERT INTO economy_transactions 
                        (user_id, guild_id, transaction_type, pounds_change, sols_change, pessos_change, description, admin_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    this.db.run(logQuery, [
                        userId, guildId, 'admin_transaction', 
                        pounds, sols, pessos, description, adminId
                    ]);
                    resolve(this.changes);
                }
            }.bind(this));
        });
    });
}

// === МАГАЗИН ===
getAllShopItems() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM shop_items WHERE enabled = 1 ORDER BY category, item_name';
        this.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

getShopItem(itemId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM shop_items WHERE id = ?';
        this.db.get(query, [itemId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

addShopItem(itemData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO shop_items (item_name, description, price_pounds, price_sols, price_pessos, stock, category, emoji)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        this.db.run(query, [
            itemData.name,
            itemData.description || null,
            itemData.pricePounds || 0,
            itemData.priceSols || 0,
            itemData.pricePessos || 0,
            itemData.stock || -1,
            itemData.category || 'Общее',
            itemData.emoji || null
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

purchaseItem(userId, guildId, itemId, quantity) {
    return new Promise((resolve, reject) => {
        this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');

            // Получаем товар
            const itemQuery = 'SELECT * FROM shop_items WHERE id = ? AND enabled = 1';
            this.db.get(itemQuery, [itemId], (err, item) => {
                if (err || !item) {
                    this.db.run('ROLLBACK');
                    return reject(err || new Error('Товар не найден'));
                }

                // Проверяем запас
                if (item.stock !== -1 && item.stock < quantity) {
                    this.db.run('ROLLBACK');
                    return reject(new Error('Недостаточно товара на складе'));
                }

                // Получаем баланс
                const balanceQuery = 'SELECT * FROM economy_balance WHERE user_id = ? AND guild_id = ?';
                this.db.get(balanceQuery, [userId, guildId], (err, balance) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        return reject(err);
                    }

                    const userPounds = balance?.pounds || 0;
                    const userSols = balance?.sols || 0;
                    const userPessos = balance?.pessos || 0;

                    // Рассчитываем стоимость
                    const totalPounds = item.price_pounds * quantity;
                    const totalSols = item.price_sols * quantity;
                    const totalPessos = item.price_pessos * quantity;

                    // Конвертируем в общую валюту (в пессо)
                    const userTotalPessos = userPounds * 100 + userSols * 5 + userPessos;
                    const itemTotalPessos = totalPounds * 100 + totalSols * 5 + totalPessos;

                    if (userTotalPessos < itemTotalPessos) {
                        this.db.run('ROLLBACK');
                        return reject(new Error('Недостаточно средств'));
                    }

                    // Списываем деньги
                    const updateBalanceQuery = `
                        UPDATE economy_balance
                        SET pounds = pounds - ?,
                            sols = sols - ?,
                            pessos = pessos - ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ? AND guild_id = ?
                    `;
                    this.db.run(updateBalanceQuery, [totalPounds, totalSols, totalPessos, userId, guildId]);

                    // Уменьшаем запас
                    if (item.stock !== -1) {
                        const updateStockQuery = 'UPDATE shop_items SET stock = stock - ? WHERE id = ?';
                        this.db.run(updateStockQuery, [quantity, itemId]);
                    }

                    // Логируем покупку
                    const logQuery = `
                        INSERT INTO economy_transactions 
                        (user_id, guild_id, transaction_type, pounds_change, sols_change, pessos_change, description)
                        VALUES (?, ?, 'purchase', ?, ?, ?, ?)
                    `;
                    this.db.run(logQuery, [
                        userId, guildId,
                        -totalPounds, -totalSols, -totalPessos,
                        `Покупка: ${item.item_name} x${quantity}`
                    ]);

                    this.db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve({ item, quantity });
                    });
                });
            });
        });
    });
}

// === ПРЕДЛОЖЕНИЯ ПОКУПКИ ===
createPurchaseProposal(userId, guildId, description, offerPounds, offerSols, offerPessos) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO purchase_proposals 
            (user_id, guild_id, description, offer_pounds, offer_sols, offer_pessos)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        this.db.run(query, [userId, guildId, description, offerPounds, offerSols, offerPessos], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

getPendingProposals(guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM purchase_proposals 
            WHERE guild_id = ? AND status = 'pending'
            ORDER BY created_at DESC
        `;
        this.db.all(query, [guildId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

processProposal(proposalId, adminId, approved, comment = null) {
    return new Promise((resolve, reject) => {
        this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');

            // Получаем предложение
            const getQuery = 'SELECT * FROM purchase_proposals WHERE id = ? AND status = \'pending\'';
            this.db.get(getQuery, [proposalId], (err, proposal) => {
                if (err || !proposal) {
                    this.db.run('ROLLBACK');
                    return reject(err || new Error('Предложение не найдено'));
                }

                if (approved) {
                    // Списываем деньги
                    const updateBalanceQuery = `
                        UPDATE economy_balance
                        SET pounds = pounds - ?,
                            sols = sols - ?,
                            pessos = pessos - ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ? AND guild_id = ?
                    `;
                    this.db.run(updateBalanceQuery, [
                        proposal.offer_pounds,
                        proposal.offer_sols,
                        proposal.offer_pessos,
                        proposal.user_id,
                        proposal.guild_id
                    ]);

                    // Логируем транзакцию
                    const logQuery = `
                        INSERT INTO economy_transactions 
                        (user_id, guild_id, transaction_type, pounds_change, sols_change, pessos_change, description, admin_id)
                        VALUES (?, ?, 'proposal_approved', ?, ?, ?, ?, ?)
                    `;
                    this.db.run(logQuery, [
                        proposal.user_id, proposal.guild_id,
                        -proposal.offer_pounds, -proposal.offer_sols, -proposal.offer_pessos,
                        `Одобренное предложение: ${proposal.description}`,
                        adminId
                    ]);
                }

                // Обновляем статус предложения
                const updateQuery = `
                    UPDATE purchase_proposals
                    SET status = ?,
                        admin_id = ?,
                        admin_comment = ?,
                        processed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;
                this.db.run(updateQuery, [
                    approved ? 'approved' : 'rejected',
                    adminId,
                    comment,
                    proposalId
                ], (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        reject(err);
                    } else {
                        this.db.run('COMMIT', (err) => {
                            if (err) reject(err);
                            else resolve(proposal);
                        });
                    }
                });
            });
        });
    });
}


initKindnessSystem() {
    const createKindnessTable = `
        CREATE TABLE IF NOT EXISTS kindness_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            message TEXT NOT NULL,
            sender_nickname TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(sender_id, recipient_id)
        )
    `;
    
    this.db.run(createKindnessTable, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы kindness_cards:', err);
        } else {
            console.log('✅ Таблица kindness_cards создана');
        }
    });
}

sendKindnessCard(senderId, recipientId, message, senderNickname = null) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO kindness_cards (sender_id, recipient_id, message, sender_nickname)
            VALUES (?, ?, ?, ?)
        `;
        
        this.db.run(query, [senderId, recipientId, message, senderNickname], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    reject(new Error('DUPLICATE'));
                } else {
                    reject(err);
                }
            } else {
                resolve(this.lastID);
            }
        });
    });
}

getUserKindnessCardsSent(userId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) as count FROM kindness_cards WHERE sender_id = ?`;
        this.db.get(query, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
        });
    });
}

getUserKindnessCardsReceived(userId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) as count FROM kindness_cards WHERE recipient_id = ?`;
        this.db.get(query, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
        });
    });
}

getKindnessTopSenders(limit = 10) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT sender_id, COUNT(*) as sent_count
            FROM kindness_cards
            GROUP BY sender_id
            ORDER BY sent_count DESC
            LIMIT ?
        `;
        
        this.db.all(query, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

deleteKindnessCardsBySender(senderId) {
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM kindnesscards WHERE senderid = ?`;
        
        this.db.run(query, [senderId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes); // Возвращает количество удалённых записей
            }
        });
    });
}

getKindnessTopRecipients(limit = 10) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT recipient_id, COUNT(*) as received_count
            FROM kindness_cards
            GROUP BY recipient_id
            ORDER BY received_count DESC
            LIMIT ?
        `;
        
        this.db.all(query, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

getAllKindnessCards() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM kindness_cards 
            ORDER BY created_at DESC
        `;
        
        this.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

canSendKindnessCard(userId) {
    return new Promise((resolve, reject) => {
        this.getUserKindnessCardsSent(userId)
            .then(count => resolve(count < 3))
            .catch(reject);
    });
}




// === СИСТЕМА НАКАЗАНИЙ ===

// Инициализация таблицы
initPunishmentSystem() {
    const createPunishmentsTable = `
        CREATE TABLE IF NOT EXISTS punishments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userid TEXT NOT NULL,
            guildid TEXT NOT NULL,
            moderatorid TEXT NOT NULL,
            type TEXT NOT NULL,
            roleid TEXT NOT NULL,
            reason TEXT NOT NULL,
            expiresat DATETIME,
            createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
            removed BOOLEAN DEFAULT 0
        )
    `;
    
    this.db.run(createPunishmentsTable, (err) => {
        if (err) console.error('[database] Ошибка создания таблицы punishments:', err);
        else console.log('[database] Таблица punishments инициализирована');
    });
}

// Добавить наказание
addPunishment(data) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO punishments (userid, guildid, moderatorid, type, roleid, reason, expiresat)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const expiresAtISO = data.expiresAt ? data.expiresAt.toISOString() : null;
        
        this.db.run(query, [
            data.userId,
            data.guildId,
            data.moderatorId,
            data.type,
            data.roleId,
            data.reason,
            expiresAtISO
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Получить активные наказания пользователя
getActivePunishments(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM punishments 
            WHERE userid = ? AND guildid = ? AND removed = 0
            ORDER BY createdat DESC
        `;
        
        this.db.all(query, [userId, guildId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Снять наказание
removePunishment(punishmentId) {
    return new Promise((resolve, reject) => {
        const query = `UPDATE punishments SET removed = 1 WHERE id = ?`;
        
        this.db.run(query, [punishmentId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Получить истёкшие наказания
getExpiredPunishments() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM punishments 
            WHERE expiresat IS NOT NULL 
            AND expiresat <= datetime('now') 
            AND removed = 0
        `;
        
        this.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

initCustomProfileStyling() {
    const createCustomStylingTable = `
        CREATE TABLE IF NOT EXISTS customprofilestyling (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            characterid INTEGER NOT NULL UNIQUE,
            separator1url TEXT,
            separator2url TEXT,
            separatorwidth INTEGER DEFAULT 250,
            separatorheight INTEGER DEFAULT 60,
            enablerecolor BOOLEAN DEFAULT 1,
            enablealternate BOOLEAN DEFAULT 1,
            createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedat DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (characterid) REFERENCES characters(id) ON DELETE CASCADE
        )
    `;
    
    this.db.run(createCustomStylingTable, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы customprofilestyling:', err);
        } else {
            console.log('✅ Таблица customprofilestyling создана/проверена');
        }
    });
}

// Получить кастомное оформление для персонажа
getCustomStyling(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM customprofilestyling WHERE characterid = ?';
        this.db.get(query, [characterId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

// Создать или обновить кастомное оформление
setCustomStyling(characterId, stylingData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO customprofilestyling 
            (characterid, separator1url, separator2url, separatorwidth, separatorheight, enablerecolor, enablealternate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(characterid) DO UPDATE SET
                separator1url = CASE WHEN ? IS NOT NULL THEN ? ELSE separator1url END,
                separator2url = CASE WHEN ? IS NOT NULL THEN ? ELSE separator2url END,
                separatorwidth = ?,
                separatorheight = ?,
                enablerecolor = ?,
                enablealternate = ?,
                updatedat = CURRENT_TIMESTAMP
        `;
        
        this.db.run(query, [
            characterId,
            stylingData.separator1url || null,
            stylingData.separator2url || null,
            stylingData.separatorwidth || 250,
            stylingData.separatorheight || 60,
            stylingData.enablerecolor !== undefined ? (stylingData.enablerecolor ? 1 : 0) : 1,
            stylingData.enablealternate !== undefined ? (stylingData.enablealternate ? 1 : 0) : 1,
            // для ON CONFLICT UPDATE
            stylingData.separator1url,
            stylingData.separator1url,
            stylingData.separator2url,
            stylingData.separator2url,
            stylingData.separatorwidth || 250,
            stylingData.separatorheight || 60,
            stylingData.enablerecolor !== undefined ? (stylingData.enablerecolor ? 1 : 0) : 1,
            stylingData.enablealternate !== undefined ? (stylingData.enablealternate ? 1 : 0) : 1
        ], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Удалить кастомное оформление
deleteCustomStyling(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM customprofilestyling WHERE characterid = ?';
        this.db.run(query, [characterId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Получить все персонажи с кастомным оформлением
getAllCustomStyledCharacters() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM customprofilestyling ORDER BY updatedat DESC';
        this.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

initCharacterGalleryTable() {
    const q = `
    CREATE TABLE IF NOT EXISTS character_gallery1 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id)
    )`;
    this.db.run(q, (err) => {
      if (err) console.error('Ошибка создания таблицы галереи:', err);
      else console.log('Таблица character_gallery1 готова');
    });
  }
  
  addGalleryImages(characterId, items) {
    // items: [{url, caption, sort_order?}]
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN');
        const stmt = this.db.prepare(`
          INSERT INTO character_gallery1 (character_id, image_url, caption, sort_order)
          VALUES (?, ?, ?, ?)
        `);
        let inserted = 0;
        for (const it of items) {
          stmt.run([characterId, it.url, it.caption || null, it.sort_order ?? 0], (e) => {
            if (e) console.error('addGalleryImages row err:', e);
            else inserted++;
          });
        }
        stmt.finalize((e) => {
          if (e) { this.db.run('ROLLBACK'); return reject(e); }
          this.db.run('COMMIT', (ce) => ce ? reject(ce) : resolve(inserted));
        });
      });
    });
  }
  
  getGalleryPage(characterId, page = 1, pageSize = 9) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * pageSize;
      const q = `
        SELECT id, image_url, caption, sort_order, created_at
        FROM character_gallery1
        WHERE character_id = ?
        ORDER BY sort_order ASC, id DESC
        LIMIT ? OFFSET ?`;
      this.db.all(q, [characterId, pageSize, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
  
  getGalleryCount(characterId) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT COUNT(*) as cnt FROM character_gallery1 WHERE character_id = ?`, [characterId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.cnt || 0);
      });
    });
  }
  
  removeGalleryImage(imageId, characterId) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM character_gallery1 WHERE id = ? AND character_id = ?`, [imageId, characterId], function (err) {
        if (err) reject(err);
        else resolve(this.changes || 0);
      });
    });
  }
  

  
// Проверка является ли пользователь "старым" (имеет активность на сервере)
isExistingUser(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT SUM(messages_count) as total_messages 
            FROM user_activity 
            WHERE user_id = ? AND guild_id = ?
        `;
        
        this.db.get(query, [userId, guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                // Если у пользователя есть хотя бы 5 сообщений, считаем его "старым"
                const totalMessages = row ? (row.total_messages || 0) : 0;
                resolve(totalMessages >= 5);
            }
        });
    });
}

// Инициализация таблицы отслеживания приглашений
initInviteTrackTable() {
    // Таблица для отслеживания использованных приглашений
    const createInviteTrackTableQuery = `
        CREATE TABLE IF NOT EXISTS invite_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            inviter_id TEXT,
            invite_code TEXT,
            account_created_at DATETIME NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            verified BOOLEAN DEFAULT 0,
            left_server BOOLEAN DEFAULT 0,
            is_fake BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, guild_id)
        )
    `;

    this.db.run(createInviteTrackTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы invite tracking:', err);
        } else {
            console.log('Таблица invite tracking создана успешно');
        }
    });

    // Таблица для хранения снимков приглашений
    const createInviteSnapshotsTableQuery = `
        CREATE TABLE IF NOT EXISTS invite_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            invite_code TEXT NOT NULL,
            inviter_id TEXT,
            uses INTEGER DEFAULT 0,
            max_uses INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, invite_code)
        )
    `;
    
    this.db.run(createInviteSnapshotsTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы invite snapshots:', err);
        } else {
            console.log('Таблица invite snapshots создана успешно');
        }
    });
}
// Проверка является ли пользователь "старым" (имеет активность на сервере)
isExistingUser(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT SUM(messages_count) as total_messages 
            FROM user_activity 
            WHERE user_id = ? AND guild_id = ?
        `;
        
        this.db.get(query, [userId, guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                // Если у пользователя есть хотя бы 5 сообщений, считаем его "старым"
                const totalMessages = row ? (row.total_messages || 0) : 0;
                resolve(totalMessages >= 5);
            }
        });
    });
}

// Отметка пользователя как потенциально фейкового (вернувшийся пользователь)
markUserAsReturning(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE invite_tracking 
            SET is_fake = 1 
            WHERE user_id = ? AND guild_id = ? AND left_at IS NULL
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

// Получение всей активности пользователя (включая прошлые недели)
getUserTotalMessages(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT SUM(messages_count) as total_messages 
            FROM user_activity 
            WHERE user_id = ? AND guild_id = ?
        `;
        
        this.db.get(query, [userId, guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? (row.total_messages || 0) : 0);
            }
        });
    });
}
// Сохранение снимка приглашений
saveInviteSnapshot(guildId, invites) {
    return new Promise((resolve, reject) => {
        this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            let completedCount = 0;
            const totalInvites = invites.length;
            
            if (totalInvites === 0) {
                this.db.run('COMMIT');
                resolve();
                return;
            }
            
            invites.forEach((invite) => {
                const query = `
                    INSERT INTO invite_snapshots (guild_id, invite_code, inviter_id, uses, max_uses, updated_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(guild_id, invite_code) 
                    DO UPDATE SET 
                        uses = ?, 
                        max_uses = ?, 
                        updated_at = CURRENT_TIMESTAMP
                `;
                
                this.db.run(query, [
                    guildId, invite.code, invite.inviterId, invite.uses, invite.maxUses,
                    invite.uses, invite.maxUses
                ], (err) => {
                    if (err) {
                        console.error('Ошибка сохранения invite snapshot:', err);
                    }
                    
                    completedCount++;
                    if (completedCount === totalInvites) {
                        this.db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                reject(commitErr);
                            } else {
                                resolve();
                            }
                        });
                    }
                });
            });
        });
    });
}

// Получение снимков приглашений
getInviteSnapshots(guildId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM invite_snapshots WHERE guild_id = ?';
        this.db.all(query, [guildId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Добавление записи о присоединении
addInviteTrack(data) {
    return new Promise((resolve, reject) => {
        const accountAgeMs = Date.now() - new Date(data.accountCreatedAt).getTime();
        const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
        const isFake = accountAgeDays < 7; // Считаем фейком если аккаунт младше 7 дней
        
        const query = `
            INSERT INTO invitetrack (user_id, guild_id, inviter_id, invite_code, account_age_days, is_fake)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, guild_id) 
            DO UPDATE SET 
                inviter_id = ?, 
                invite_code = ?, 
                joined_at = CURRENT_TIMESTAMP,
                has_left = 0,
                account_age_days = ?,
                is_fake = ?
        `;
        
        this.db.run(query, [
            data.userId, data.guildId, data.inviterId, data.inviteCode, accountAgeDays, isFake ? 1 : 0,
            data.inviterId, data.inviteCode, accountAgeDays, isFake ? 1 : 0
        ], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Отметить пользователя как покинувшего сервер
markUserLeft(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE invitetrack 
            SET has_left = 1, verification_completed = 0, is_valid = 0
            WHERE user_id = ? AND guild_id = ?
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

// Отметить пользователя как прошедшего верификацию (после 10 минут)
markUserVerified(userId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE invitetrack 
            SET verification_completed = 1, is_valid = CASE WHEN is_fake = 0 AND has_left = 0 THEN 1 ELSE 0 END
            WHERE user_id = ? AND guild_id = ?
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

// Получение статистики приглашений пользователя
getUserInviteStats(inviterId, guildId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                COUNT(*) as total_invites,
                SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_invites,
                SUM(CASE WHEN is_fake = 1 THEN 1 ELSE 0 END) as fake_invites,
                SUM(CASE WHEN has_left = 1 THEN 1 ELSE 0 END) as left_invites
            FROM invitetrack 
            WHERE inviter_id = ? AND guild_id = ?
        `;
        
        this.db.get(query, [inviterId, guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || {
                    total_invites: 0,
                    valid_invites: 0,
                    fake_invites: 0,
                    left_invites: 0
                });
            }
        });
    });
}

// Получение топа по приглашениям
getInviteLeaderboard(guildId, limit = 10) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                inviter_id,
                COUNT(*) as total_invites,
                SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_invites,
                SUM(CASE WHEN is_fake = 1 THEN 1 ELSE 0 END) as fake_invites,
                SUM(CASE WHEN has_left = 1 THEN 1 ELSE 0 END) as left_invites
            FROM invitetrack 
            WHERE guild_id = ?
            GROUP BY inviter_id
            HAVING valid_invites > 0
            ORDER BY valid_invites DESC, total_invites DESC
            LIMIT ?
        `;
        
        this.db.all(query, [guildId, limit], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Получение пользователей для проверки верификации
getUsersForVerification() {
    return new Promise((resolve, reject) => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const query = `
            SELECT user_id, guild_id
            FROM invitetrack 
            WHERE verification_completed = 0 
            AND has_left = 0 
            AND joined_at <= ?
        `;
        
        this.db.all(query, [tenMinutesAgo], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

initProfilesTable() {
    const createProfilesTableQuery = `
        CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            keyword TEXT NOT NULL,
            name TEXT NOT NULL,
            avatar TEXT NOT NULL,
            color TEXT DEFAULT '#FFD700',
            bio TEXT DEFAULT '',
            banner TEXT DEFAULT NULL,
            emoji TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, keyword)
        )
    `;
    
    this.db.run(createProfilesTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы профилей:', err);
        } else {
            console.log('Таблица профилей создана успешно');
            // Добавляем новые колонки если их нет
            this.db.run(`ALTER TABLE user_profiles ADD COLUMN bio TEXT DEFAULT ''`, () => {});
            this.db.run(`ALTER TABLE user_profiles ADD COLUMN banner TEXT DEFAULT NULL`, () => {});
            this.db.run(`ALTER TABLE user_profiles ADD COLUMN emoji TEXT DEFAULT ''`, () => {});
            this.db.run(`ALTER TABLE user_profiles ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
        }
    });
}

// Создание профиля с расширенными данными
createProfile(userId, keyword, name, avatar, color = '#FFD700', bio = '', banner = null) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO user_profiles (user_id, keyword, name, avatar, color, bio, banner)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [userId, keyword, name, avatar, color, bio, banner], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Обновление профиля
updateProfile(userId, keyword, updates) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const values = [];
        
        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.avatar !== undefined) { fields.push('avatar = ?'); values.push(updates.avatar); }
        if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
        if (updates.bio !== undefined) { fields.push('bio = ?'); values.push(updates.bio); }
        if (updates.banner !== undefined) { fields.push('banner = ?'); values.push(updates.banner); }
        if (updates.emoji !== undefined) { fields.push('emoji = ?'); values.push(updates.emoji); }
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        
        if (fields.length === 1) {
            return resolve(0);
        }
        
        values.push(userId, keyword);
        const query = `UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = ? AND keyword = ?`;
        
        this.db.run(query, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Получение профиля по ключевому слову
getProfileByKeyword(userId, keyword) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM user_profiles WHERE user_id = ? AND keyword = ?';
        this.db.get(query, [userId, keyword], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Получение всех профилей пользователя
getUserProfiles(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM user_profiles WHERE user_id = ? ORDER BY created_at DESC';
        this.db.all(query, [userId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

// Удаление профиля
deleteProfile(userId, keyword) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM user_profiles WHERE user_id = ? AND keyword = ?';
        this.db.run(query, [userId, keyword], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Подсчет профилей пользователя
getUserProfileCount(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT COUNT(*) as count FROM user_profiles WHERE user_id = ?';
        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// Обновление профиля
updateProfile(userId, keyword, updateData) {
    return new Promise((resolve, reject) => {
        const updates = [];
        const values = [];
        
        if (updateData.profile_name) {
            updates.push('profile_name = ?');
            values.push(updateData.profile_name);
        }
        if (updateData.display_name) {
            updates.push('display_name = ?');
            values.push(updateData.display_name);
        }
        if (updateData.avatar_url !== undefined) {
            updates.push('avatar_url = ?');
            values.push(updateData.avatar_url);
        }
        if (updateData.description !== undefined) {
            updates.push('description = ?');
            values.push(updateData.description);
        }
        if (updateData.embed_color) {
            updates.push('embed_color = ?');
            values.push(updateData.embed_color);
        }

        if (updates.length === 0) {
            resolve(0);
            return;
        }

        values.push(userId, keyword.toLowerCase());
        const query = `UPDATE fake_profiles SET ${updates.join(', ')} WHERE user_id = ? AND keyword = ?`;
        
        this.db.run(query, values, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
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

    // Получить персонажа по имени и ID пользователя
    getCharacterByName(userId, name) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM characters WHERE user_id = ? AND name = ? LIMIT 1';
            this.db.get(query, [userId, name], (err, row) => {
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

    // Универсальная функция обновления персонажа
    updateCharacter(characterId, data) {
        return new Promise((resolve, reject) => {
            const allowedFields = [
                'name', 'nickname', 'race', 'age', 'mention', 'avatar_url', 'embed_color',
                'strength', 'agility', 'reaction', 'accuracy', 
                'hakivor', 'hakinab', 'hakiconq', 
                'devilfruit', 'patronage', 'core', 'elements', 'martialarts',
                'organization', 'position', 'budget', 'additional',
                'biography', 'backstory', 'personality', 'goals'
            ];

            const updates = [];
            const values = [];

            for (const [key, value] of Object.entries(data)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (updates.length === 0) {
                return resolve(false);
            }

            values.push(characterId);
            const query = `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`;

            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
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

    getTopUsersSinceContestStart(guildId, limit = 1000) {
        return new Promise((resolve, reject) => {
            // Дата начала конкурса
            const contestStart = new Date('2025-11-13T12:00:00+03:00'); // МСК
        
            // Считаем понедельник той недели, где находится 13.11.2025 (как getWeekStart, но для фиксированной даты)
            const dayOfWeek = contestStart.getDay(); // 0 = воскресенье, 1 = понедельник, ...
            const diff = contestStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(contestStart.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            const contestWeekStart = monday.toISOString().split('T')[0];
        
            const query = `
                SELECT 
                    user_id,
                    SUM(messages_count) AS messages_count,
                    SUM(voice_time) AS voice_time,
                    (SUM(messages_count) + SUM(voice_time) / 60.0) AS total_score
                FROM user_activity
                WHERE guild_id = ? 
                  AND week_start >= ?
                GROUP BY user_id
                ORDER BY total_score DESC
                LIMIT ?
            `;
        
            this.db.all(query, [guildId, contestWeekStart, limit], (err, rows) => {
                if (err) {
                    console.error('Ошибка getTopUsersSinceContestStart:', err);
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
        );
    `;

    // Создаем таблицу логов транзакций
    const createRubyCoinLogsTable = `
        CREATE TABLE IF NOT EXISTS rubycoin_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            admin_id TEXT,
            action_type TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_before REAL NOT NULL,
            balance_after REAL NOT NULL,
            category TEXT,
            description TEXT,
            username TEXT,
            admin_username TEXT,
            guild_id TEXT,
            channel_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES user_rubycoins(user_id) ON DELETE CASCADE
        );
    `;

    // Создаем индексы для ускорения запросов
    const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_user_id ON rubycoin_logs(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_admin_id ON rubycoin_logs(admin_id);',
        'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_action_type ON rubycoin_logs(action_type);',
        'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_created_at ON rubycoin_logs(created_at DESC);'
    ];

    // Создаем главную таблицу
    this.db.run(createRubyCoinTableQuery, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы user_rubycoins:', err);
        } else {
            console.log('✅ Таблица user_rubycoins создана');
            
            // После создания главной таблицы создаем таблицу логов
            this.db.run(createRubyCoinLogsTable, (logErr) => {
                if (logErr) {
                    console.error('❌ Ошибка создания таблицы rubycoin_logs:', logErr);
                } else {
                    console.log('✅ Таблица rubycoin_logs создана (связана с user_rubycoins)');
                    
                    // Создаем индексы
                    createIndexes.forEach(indexQuery => {
                        this.db.run(indexQuery, (indexErr) => {
                            if (indexErr && !indexErr.message.includes('already exists')) {
                                console.error('❌ Ошибка создания индекса:', indexErr);
                            }
                        });
                    });
                    console.log('✅ Индексы для rubycoin_logs созданы');
                }
            });
        }
    });
    }
    // Логирование транзакции
    logRubyCoinTransaction(data, targetUser = null, adminUser = null) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO rubycoin_logs 
                (user_id, admin_id, action_type, amount, balance_before, balance_after, 
                 category, description, username, admin_username, guild_id, channel_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                data.userId,
                data.adminId || null,
                data.actionType,
                data.amount,
                data.balanceBefore,
                data.balanceAfter,
                data.category || null,
                data.description || null,
                targetUser?.username || null,
                adminUser?.username || null,
                data.guildId || null,
                data.channelId || null
            ], function(err) {
                if (err) {
                    console.error('❌ Ошибка логирования транзакции RubyCoin:', err);
                    reject(err);
                } else {
                    console.log('✅ Транзакция RubyCoin залогирована, ID:', this.lastID);
                    resolve(this.lastID);
                }
            });
        });
    }

    // Получение статистики пользователя
    getRubyCoinUserStats(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
                    COUNT(*) as total_transactions,
                    MIN(created_at) as first_transaction
                FROM rubycoin_logs 
                WHERE user_id = ?
            `;

            this.db.get(query, [userId], (err, row) => {
                if (err) {
                    console.error('❌ Ошибка получения статистики RubyCoin:', err);
                    reject(err);
                } else {
                    resolve(row && row.total_transactions > 0 ? row : null);
                }
            });
        });
    }

    // Поиск транзакций с фильтрами
    searchRubyCoinTransactions(options = {}) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM rubycoin_logs WHERE 1=1';
            const params = [];

            if (options.userId) {
                query += ' AND user_id = ?';
                params.push(options.userId);
            }

            if (options.adminId) {
                query += ' AND admin_id = ?';
                params.push(options.adminId);
            }

            if (options.actionType) {
                query += ' AND action_type = ?';
                params.push(options.actionType);
            }

            if (options.username) {
                query += ' AND username LIKE ?';
                params.push(`%${options.username}%`);
            }

            if (options.minAmount !== undefined && options.minAmount !== null) {
                query += ' AND ABS(amount) >= ?';
                params.push(options.minAmount);
            }

            if (options.maxAmount !== undefined && options.maxAmount !== null) {
                query += ' AND ABS(amount) <= ?';
                params.push(options.maxAmount);
            }

            if (options.guildId) {
                query += ' AND guild_id = ?';
                params.push(options.guildId);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(options.limit || 10);

            console.log('🔍 Поиск транзакций RubyCoin, параметров:', params.length);

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка поиска транзакций RubyCoin:', err);
                    reject(err);
                } else {
                    console.log(`✅ Найдено ${rows?.length || 0} транзакций RubyCoin`);
                    resolve(rows || []);
                }
            });
        });
    }

    // Топ по заработку RubyCoin
    getRubyCoinTopEarners(guildId, limit = 10) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    r.user_id,
                    r.rubycoins as current_balance,
                    r.total_earned,
                    r.total_spent,
                    (SELECT username FROM rubycoin_logs WHERE user_id = r.user_id LIMIT 1) as username
                FROM user_rubycoins r
                WHERE EXISTS (
                    SELECT 1 FROM rubycoin_logs l 
                    WHERE l.user_id = r.user_id AND l.guild_id = ?
                )
                ORDER BY r.total_earned DESC
                LIMIT ?
            `;

            this.db.all(query, [guildId, limit], (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка получения топа RubyCoin:', err);
                    reject(err);
                } else {
                    console.log(`✅ Топ RubyCoin: ${rows?.length || 0} пользователей`);
                    resolve(rows || []);
                }
            });
        });
    }

    // Получить полную историю транзакций пользователя
    getRubyCoinHistory(userId, limit = 50) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM rubycoin_logs 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            this.db.all(query, [userId, limit], (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка получения истории RubyCoin:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
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

   // === ОСНОВНАЯ ФУНКЦИЯ addRubyCoins ===
    addRubyCoins(userId, amount) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Шаг 1: Создаём запись если не существует
                const insertQuery = `
                    INSERT INTO user_rubycoins (user_id, rubycoins, total_earned, total_spent)
                    VALUES (?, 0, 0, 0)
                    ON CONFLICT(user_id) DO NOTHING
                `;

                this.runWithRetry(insertQuery, [userId])
                    .then(() => {
                        // Шаг 2: Обновляем баланс с учётом заработка/траты
                        const earnedAmount = amount >= 0 ? amount : 0;
                        const spentAmount = amount < 0 ? Math.abs(amount) : 0;

                        const updateQuery = `
                            UPDATE user_rubycoins
                            SET rubycoins = rubycoins + ?,
                                total_earned = total_earned + ?,
                                total_spent = total_spent + ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ?
                        `;

                        return this.runWithRetry(updateQuery, [amount, earnedAmount, spentAmount, userId]);
                    })
                    .then((result) => {
                        console.log(`✅ RubyCoin изменён для ${userId}: ${amount >= 0 ? '+' : ''}${amount}`);
                        resolve(result.changes);
                    })
                    .catch((err) => {
                        console.error('❌ Ошибка addRubyCoins:', err);
                        reject(err);
                    });
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
            counter INTEGER DEFAULT 1
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

// Убираем установку кулдауна при создании тикета
createTicket(ticketData) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO tickets (ticket_number, purpose, character_ids, creator_id, channel_id, participants)
                       VALUES (?, ?, ?, ?, ?, ?)`;
        
        this.db.run(query, [
            ticketData.ticket_number,
            ticketData.purpose,
            ticketData.character_ids,
            ticketData.creator_id,
            ticketData.channel_id,
            ticketData.participants || ''
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// Проверка активных тикетов (НЕ кулдауна!)
async hasActiveTicket(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as count 
        FROM tickets 
        WHERE creator_id = ? 
        AND status NOT IN ('Закрыт', 'Завершён')
      `;
      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row && row.count > 0);
        }
      });
    });
}

// Установка кулдауна при закрытии/завершении тикета
async setTicketClosureCooldown(userId) {
    return new Promise((resolve, reject) => {
        const nextAllowed = new Date();
        nextAllowed.setHours(nextAllowed.getHours() + 72); // 72 часов
        
        const query = `UPDATE tickets 
                       SET nextticketallowed = ?
                       WHERE creatorid = ? 
                       AND status IN ('Закрыт', 'Завершён')
                       ORDER BY updatedat DESC 
                       LIMIT 1`;
        
        this.db.run(query, [nextAllowed.toISOString(), userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Получить кулдаун пользователя (в часах)
// Получить количество часов до окончания кулдауна
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
// Получение количества тикетов пользователя
getUserTicketsCount(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT COUNT(*) as count FROM tickets WHERE creator_id = ?';
        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count || 0);
            }
        });
    });
}

// Получение тикетов по куратору
getTicketsByCurator(curatorId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM tickets WHERE curator_id = ? AND status NOT IN ("Завершен", "Закрыт")';
        this.db.all(query, [curatorId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

getUserActiveTickets(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM tickets
            WHERE creator_id = ?
            AND status NOT IN ('Закрыт', 'Завершён')
        `;
        this.db.all(query, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
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
async getUserCharacters(userId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM characters WHERE user_id = ? ORDER BY name ASC`;
        this.db.all(query, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
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



createTicketWithValidation(ticketData) {
    return new Promise(async (resolve, reject) => {
        try {
            // 1. Проверка кулдауна (48 часов между тикетами)
            const lastTicket = await this.getLastUserTicket(ticketData.creator_id);
            if (lastTicket) {
                const lastTicketTime = new Date(lastTicket.created_at);
                const now = new Date();
                const hoursDiff = (now - lastTicketTime) / (1000 * 60 * 60);
                
                if (hoursDiff < 72) {
                    const remainingHours = Math.ceil(72 - hoursDiff);
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


// Получение тикета по ID канала
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

resetUserTicketCooldown(userId) {
    return new Promise((resolve, reject) => {
        // Находим последний тикет пользователя с кулдауном
        const selectQuery = `
            SELECT id FROM tickets
            WHERE creator_id = ? AND next_ticket_allowed IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        `;
        this.db.get(selectQuery, [userId], (selectErr, row) => {
            if (selectErr) return reject(selectErr);
            if (!row) return resolve(0); // Нет тикетов с кулдауном

            // Обнуляем кулдаун
            const updateQuery = `
                UPDATE tickets
                SET next_ticket_allowed = NULL
                WHERE id = ?
            `;
            this.db.run(updateQuery, [row.id], function (updateErr) {
                if (updateErr) return reject(updateErr);
                resolve(this.changes); // Возвращаем число изменённых строк
            });
        });
    });
}


initTrainingSystemTables() {
    console.log('🔧 Инициализация таблиц системы тренировок...');

    // Таблица сессий тренировок
    const createTrainingSessionsTable = `
        CREATE TABLE IF NOT EXISTS trainingsystem_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            character_id INTEGER,
            total_hours INTEGER NOT NULL,
            current_hour INTEGER DEFAULT 1,
            training_type TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (character_id) REFERENCES characters(id)
        )
    `;

    this.db.run(createTrainingSessionsTable, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы trainingsystem_sessions:', err);
        } else {
            console.log('✅ Таблица trainingsystem_sessions создана/проверена');
        }
    });

    // Добавляем колонку character_id если её нет (миграция для существующих БД)
    const addCharacterIdColumn = `ALTER TABLE trainingsystem_sessions ADD COLUMN character_id INTEGER`;
    this.db.run(addCharacterIdColumn, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('⚠️ Ошибка добавления character_id:', err.message);
        } else if (!err) {
            console.log('✅ Колонка character_id добавлена в trainingsystem_sessions');
        }
    });

    // Таблица постов тренировок
    const createTrainingPostsTable = `
        CREATE TABLE IF NOT EXISTS trainingsystem_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            hour_number INTEGER NOT NULL,
            post_number INTEGER NOT NULL,
            message_id TEXT NOT NULL,
            content TEXT NOT NULL,
            symbols_count INTEGER NOT NULL,
            posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES trainingsystem_sessions(id)
        )
    `;

    this.db.run(createTrainingPostsTable, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы trainingsystem_posts:', err);
        } else {
            console.log('✅ Таблица trainingsystem_posts создана/проверена');
        }
    });

    // Таблица проверок тренировок
    const createTrainingReviewsTable = `
        CREATE TABLE IF NOT EXISTS trainingsystem_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            reviewer_id TEXT,
            status TEXT DEFAULT 'pending',
            review_message_id TEXT,
            feedback TEXT,
            approved BOOLEAN DEFAULT 0,
            reviewed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES trainingsystem_sessions(id)
        )
    `;

    this.db.run(createTrainingReviewsTable, (err) => {
        if (err) {
            console.error('❌ Ошибка создания таблицы trainingsystem_reviews:', err);
        } else {
            console.log('✅ Таблица trainingsystem_reviews создана/проверена');
        }
    });
    // Добавляем колонку hour_start_time (без DEFAULT CURRENT_TIMESTAMP при ALTER)
    const addHourStartTimeColumn = `
        ALTER TABLE trainingsystem_sessions 
        ADD COLUMN hour_start_time DATETIME
    `;

    this.db.run(addHourStartTimeColumn, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('⚠️ Ошибка добавления hour_start_time:', err.message);
        } else if (!err) {
            console.log('✅ Колонка hour_start_time добавлена в trainingsystem_sessions');

            // После добавления колонки, устанавливаем значения для существующих записей
            const updateExistingRows = `
                UPDATE trainingsystem_sessions 
                SET hour_start_time = created_at 
                WHERE hour_start_time IS NULL
            `;
            this.db.run(updateExistingRows, (updateErr) => {
                if (updateErr) {
                    console.error('⚠️ Ошибка обновления hour_start_time:', updateErr.message);
                } else {
                    console.log('✅ Значения hour_start_time обновлены для существующих записей');
                }
            });
        }
    });
    console.log('✅ Инициализация таблиц системы тренировок завершена');

}

// ===== МЕТОДЫ ДЛЯ РАБОТЫ С ТРЕНИРОВКАМИ =====
getAllActiveTrainingSessions() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM trainingsystem_sessions 
            WHERE status = 'active' 
            ORDER BY created_at DESC
        `;
        this.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

updateTrainingSessionHourStartTime(sessionId, hourStartTime) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE trainingsystem_sessions 
            SET hour_start_time = ?, last_update = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        this.db.run(query, [new Date(hourStartTime).toISOString(), sessionId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}


getActiveTraining(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM trainingsystem_sessions 
            WHERE user_id = ? AND status = 'active' 
            ORDER BY created_at DESC LIMIT 1
        `;
        this.db.get(query, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

createTrainingSession(data) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO trainingsystem_sessions 
            (user_id, guild_id, channel_id, character_id, total_hours, training_type, current_hour, status)
            VALUES (?, ?, ?, ?, ?, ?, 1, 'active')
        `;
        
        this.db.run(query, [
            data.userId,
            data.guildId,
            data.channelId,
            data.characterId || null,
            data.hours,
            data.type
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

checkTrainingCooldown(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT completed_at FROM trainingsystem_sessions 
            WHERE user_id = ? AND status = 'completed' 
            ORDER BY completed_at DESC LIMIT 1
        `;
        
        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else if (!row) {
                resolve(0); // Нет завершенных тренировок
            } else {
                const completedTime = new Date(row.completed_at).getTime();
                const now = Date.now();
                const hoursPassed = (now - completedTime) / (1000 * 60 * 60);
                const hoursLeft = Math.max(0, 24 - hoursPassed);
                resolve(Math.ceil(hoursLeft));
            }
        });
    });
}


getTrainingSessionById(sessionId) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM trainingsystem_sessions WHERE id = ?`;
        this.db.get(query, [sessionId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

saveTrainingPost(data) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO trainingsystem_posts 
            (session_id, hour_number, post_number, message_id, content, symbols_count)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [
            data.sessionId,
            data.hourNumber,
            data.postNumber,
            data.messageId,
            data.content,
            data.symbolsCount
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

getTrainingSessionPosts(sessionId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM trainingsystem_posts 
            WHERE session_id = ? 
            ORDER BY hour_number, post_number
        `;
        this.db.all(query, [sessionId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

updateTrainingSessionHour(sessionId, hourNumber) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE trainingsystem_sessions 
            SET current_hour = ?, last_update = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        this.db.run(query, [hourNumber, sessionId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

completeTrainingSession(sessionId) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE trainingsystem_sessions 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        this.db.run(query, [sessionId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

failTrainingSession(sessionId, reason) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE trainingsystem_sessions 
            SET status = ? 
            WHERE id = ?
        `;
        this.db.run(query, [`failed_${reason}`, sessionId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

createTrainingReview(sessionId, messageId) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO trainingsystem_reviews 
            (session_id, review_message_id) 
            VALUES (?, ?)
        `;
        this.db.run(query, [sessionId, messageId], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

updateTrainingReviewStatus(sessionId, reviewerId, approved, status) {
    return new Promise((resolve, reject) => {
        const query = `
            UPDATE trainingsystem_reviews 
            SET reviewer_id = ?, approved = ?, status = ?, reviewed_at = CURRENT_TIMESTAMP 
            WHERE session_id = ?
        `;
        this.db.run(query, [reviewerId, approved ? 1 : 0, status, sessionId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}


checkTrainingCooldown(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT completed_at FROM trainingsystem_sessions 
            WHERE user_id = ? AND status = 'completed' 
            ORDER BY completed_at DESC LIMIT 1
        `;
        
        this.db.get(query, [userId], (err, row) => {
            if (err) {
                reject(err);
            } else if (!row) {
                resolve(0); // Нет завершенных тренировок
            } else {
                const completedTime = new Date(row.completed_at).getTime();
                const now = Date.now();
                const hoursPassed = (now - completedTime) / (1000 * 60 * 60);
                const hoursLeft = Math.max(0, 24 - hoursPassed);
                resolve(Math.ceil(hoursLeft));
            }
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


// Метод для установки кулдауна при завершении тикета
setTicketCooldownOnCompletion(userId) {
    return new Promise((resolve, reject) => {
        const nextAllowed = new Date();
        nextAllowed.setHours(nextAllowed.getHours() + 72); // 72 часа (3 дня) кулдаун
        
        // Обновляем последний тикет пользователя или создаём запись в отдельной таблице
        const updateQuery = `
            UPDATE tickets 
            SET next_ticket_allowed = ?
            WHERE creator_id = ? 
            AND ticket_number = (
                SELECT ticket_number FROM tickets 
                WHERE creator_id = ? 
                ORDER BY created_at DESC 
                LIMIT 1
            )
        `;
        
        this.db.run(updateQuery, [nextAllowed.toISOString(), userId, userId], function(err) {
            if (err) {
                reject(err);
            } else {
                if (this.changes === 0) {
                    // Если нет тикетов, создаём запись-заглушку для кулдауна
                    const insertQuery = `
                        INSERT INTO tickets (creator_id, ticket_number, purpose, character_ids, status, next_ticket_allowed)
                        VALUES (?, -1, 'COOLDOWN_RECORD', '', 'COOLDOWN', ?)
                    `;
                    this.db.run(insertQuery, [userId, nextAllowed.toISOString()], function(insertErr) {
                        if (insertErr) {
                            // Игнорируем ошибку дубликата
                            console.log('Cooldown insert note:', insertErr.message);
                        }
                        resolve(1);
                    });
                } else {
                    resolve(this.changes);
                }
            }
        });
    });
}

// Модифицируйте createTicketWithCooldown чтобы НЕ устанавливать кулдаун при создании
createTicketWithCooldown(ticketData) {
    return new Promise((resolve, reject) => {
        // Убираем установку next_ticket_allowed при создании
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

// Добавьте метод для установки кулдауна при завершении конкретного тикета
setTicketCompletionCooldown(ticketNumber, userId) {
    return new Promise((resolve, reject) => {
        const nextAllowed = new Date();
        nextAllowed.setHours(nextAllowed.getHours() + 72); // 72 часа (3 дня) кулдаун
        
        // Обновляем текущий тикет
        const updateQuery = `
            UPDATE tickets 
            SET next_ticket_allowed = ?, updated_at = CURRENT_TIMESTAMP
            WHERE ticket_number = ?
        `;
        
        this.db.run(updateQuery, [nextAllowed.toISOString(), ticketNumber], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// Обновите метод getUserCooldown для правильной работы с новой логикой
getUserCooldown(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT next_ticket_allowed
            FROM tickets
            WHERE creator_id = ? AND next_ticket_allowed IS NOT NULL
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




// ===============================
// СИСТЕМА МАГАЗИНА РАЗДЕЛИТЕЛЕЙ
// ===============================
initSeparatorShopSystem() {
    // Таблица доступных разделителей в магазине
    const createSeparatorItemsTable = `
        CREATE TABLE IF NOT EXISTS separator_shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            preview_url TEXT NOT NULL,
            separator1_url TEXT NOT NULL,
            separator2_url TEXT,
            price INTEGER DEFAULT 0,
            category TEXT DEFAULT 'Стандартные',
            rarity TEXT DEFAULT 'common',
            is_default BOOLEAN DEFAULT 0,
            enabled BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `;

    // Таблица купленных разделителей пользователями
    const createUserSeparatorsTable = `
        CREATE TABLE IF NOT EXISTS user_separators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            separator_id INTEGER NOT NULL,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, separator_id),
            FOREIGN KEY (separator_id) REFERENCES separator_shop_items(id) ON DELETE CASCADE
        )
    `;

    // Таблица кастомных эмодзи для персонажей
    const createCustomEmojisTable = `
        CREATE TABLE IF NOT EXISTS character_custom_emojis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL UNIQUE,
            emoji_url TEXT NOT NULL,
            emoji_name TEXT,
            discord_emoji_id TEXT,
            discord_emoji_identifier TEXT,
            animated BOOLEAN DEFAULT 0,
            original_url TEXT,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        )
    `;

    // Таблица активных разделителей для персонажей
    const createActiveSepatorsTable = `
        CREATE TABLE IF NOT EXISTS character_active_separator (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL UNIQUE,
            separator_id INTEGER,
            is_custom BOOLEAN DEFAULT 0,
            custom_separator1_url TEXT,
            custom_separator2_url TEXT,
            recolorable BOOLEAN DEFAULT 1,
            alternate BOOLEAN DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (separator_id) REFERENCES separator_shop_items(id) ON DELETE SET NULL
        )
    `;

    this.db.serialize(() => {
        this.db.run(createSeparatorItemsTable, (err) => {
            if (err) console.error('❌ Ошибка создания separator_shop_items:', err);
            else console.log('✅ Таблица separator_shop_items создана');
        });

        this.db.run(createUserSeparatorsTable, (err) => {
            if (err) console.error('❌ Ошибка создания user_separators:', err);
            else console.log('✅ Таблица user_separators создана');
        });

        this.db.run(createCustomEmojisTable, (err) => {
            if (err) {
                console.error('❌ Ошибка создания character_custom_emojis:', err);
            } else {
                console.log('✅ Таблица character_custom_emojis создана');
                // Добавляем новые колонки если таблица уже существует
                this.migrateCustomEmojisTable();
            }
        });

        this.db.run(createActiveSepatorsTable, (err) => {
            if (err) console.error('❌ Ошибка создания character_active_separator:', err);
            else {
                console.log('✅ Таблица character_active_separator создана');
                this.seedDefaultSeparators();
            }
        });
    });
}

// Миграция таблицы character_custom_emojis для добавления новых колонок
migrateCustomEmojisTable() {
    const alterQueries = [
        'ALTER TABLE character_custom_emojis ADD COLUMN discord_emoji_id TEXT',
        'ALTER TABLE character_custom_emojis ADD COLUMN discord_emoji_identifier TEXT',
        'ALTER TABLE character_custom_emojis ADD COLUMN animated BOOLEAN DEFAULT 0',
        'ALTER TABLE character_custom_emojis ADD COLUMN original_url TEXT'
    ];

    alterQueries.forEach(query => {
        this.db.run(query, (err) => {
            // Игнорируем ошибку если колонка уже существует
            if (err && !err.message.includes('duplicate column name')) {
                console.error('❌ Ошибка миграции character_custom_emojis:', err);
            }
        });
    });
    
    console.log('✅ Миграция character_custom_emojis выполнена');
}

// Заполнение стандартными разделителями
seedDefaultSeparators() {
    const defaultSeparators = [
        {
            name: 'Ruby Classic',
            description: 'Классический рубиновый разделитель',
            preview_url: 'https://i.imgur.com/ruby_classic.png',
            separator1_url: './images/rubycon.png',
            separator2_url: './images/rubycon1.png',
            price: 0,
            category: 'Стандартные',
            rarity: 'common',
            is_default: 1
        },
        {
            name: 'Золотая линия',
            description: 'Элегантный золотой разделитель',
            preview_url: 'https://i.imgur.com/gold_line.png',
            separator1_url: 'https://i.imgur.com/gold_sep1.png',
            separator2_url: 'https://i.imgur.com/gold_sep2.png',
            price: 50,
            category: 'Премиум',
            rarity: 'rare'
        },
        {
            name: 'Неоновый блеск',
            description: 'Яркий неоновый разделитель',
            preview_url: 'https://i.imgur.com/neon_glow.png',
            separator1_url: 'https://i.imgur.com/neon_sep1.png',
            separator2_url: 'https://i.imgur.com/neon_sep2.png',
            price: 75,
            category: 'Премиум',
            rarity: 'rare'
        },
        {
            name: 'Космическая пыль',
            description: 'Разделитель с эффектом космоса',
            preview_url: 'https://i.imgur.com/cosmic.png',
            separator1_url: 'https://i.imgur.com/cosmic_sep1.png',
            separator2_url: 'https://i.imgur.com/cosmic_sep2.png',
            price: 100,
            category: 'Эпические',
            rarity: 'epic'
        },
        {
            name: 'Драконье пламя',
            description: 'Огненный разделитель с драконьим мотивом',
            preview_url: 'https://i.imgur.com/dragon.png',
            separator1_url: 'https://i.imgur.com/dragon_sep1.png',
            separator2_url: 'https://i.imgur.com/dragon_sep2.png',
            price: 150,
            category: 'Легендарные',
            rarity: 'legendary'
        }
    ];

    const checkQuery = 'SELECT COUNT(*) as count FROM separator_shop_items';
    this.db.get(checkQuery, [], (err, row) => {
        if (err || (row && row.count > 0)) return;

        const insertQuery = `
            INSERT INTO separator_shop_items 
            (name, description, preview_url, separator1_url, separator2_url, price, category, rarity, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        defaultSeparators.forEach(sep => {
            this.db.run(insertQuery, [
                sep.name, sep.description, sep.preview_url,
                sep.separator1_url, sep.separator2_url,
                sep.price, sep.category, sep.rarity, sep.is_default || 0
            ]);
        });
        console.log('✅ Стандартные разделители добавлены в магазин');
    });
}

// Получить все разделители из магазина
getAllSeparatorItems() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM separator_shop_items WHERE enabled = 1 ORDER BY price ASC';
        this.db.all(query, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Получить разделитель по ID
getSeparatorById(separatorId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM separator_shop_items WHERE id = ?';
        this.db.get(query, [separatorId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Проверить, куплен ли разделитель пользователем
hasUserSeparator(userId, separatorId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM user_separators WHERE user_id = ? AND separator_id = ?';
        this.db.get(query, [userId, separatorId], (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
        });
    });
}

// Получить все купленные разделители пользователя
getUserSeparators(userId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT s.*, us.purchased_at 
            FROM separator_shop_items s
            JOIN user_separators us ON s.id = us.separator_id
            WHERE us.user_id = ?
            ORDER BY us.purchased_at DESC
        `;
        this.db.all(query, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Купить разделитель
purchaseSeparator(userId, separatorId) {
    return new Promise(async (resolve, reject) => {
        try {
            const separator = await this.getSeparatorById(separatorId);
            if (!separator) return reject(new Error('Разделитель не найден'));

            const alreadyOwned = await this.hasUserSeparator(userId, separatorId);
            if (alreadyOwned) return reject(new Error('Разделитель уже куплен'));

            const userBalance = await this.getUserRubyCoins(userId);
            if (userBalance < separator.price) return reject(new Error('Недостаточно RubyCoins'));

            // Списываем деньги
            await this.removeRubyCoins(userId, separator.price);

            // Добавляем разделитель пользователю
            const insertQuery = 'INSERT INTO user_separators (user_id, separator_id) VALUES (?, ?)';
            this.db.run(insertQuery, [userId, separatorId], function(err) {
                if (err) reject(err);
                else resolve({ separator, spent: separator.price });
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Установить активный разделитель для персонажа
setCharacterActiveSeparator(characterId, separatorId, isCustom = false, customUrls = null, options = {}) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO character_active_separator 
            (character_id, separator_id, is_custom, custom_separator1_url, custom_separator2_url, recolorable, alternate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(character_id) DO UPDATE SET
                separator_id = ?,
                is_custom = ?,
                custom_separator1_url = ?,
                custom_separator2_url = ?,
                recolorable = ?,
                alternate = ?,
                updated_at = CURRENT_TIMESTAMP
        `;
        
        const sep1 = customUrls?.separator1 || null;
        const sep2 = customUrls?.separator2 || null;
        const recolorable = options.recolorable !== false ? 1 : 0;
        const alternate = options.alternate !== false && sep2 ? 1 : 0;
        
        this.db.run(query, [
            characterId, separatorId, isCustom ? 1 : 0, sep1, sep2, recolorable, alternate,
            separatorId, isCustom ? 1 : 0, sep1, sep2, recolorable, alternate
        ], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Получить активный разделитель персонажа
getCharacterActiveSeparator(characterId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT cas.*, ssi.name, ssi.separator1_url as shop_sep1, ssi.separator2_url as shop_sep2
            FROM character_active_separator cas
            LEFT JOIN separator_shop_items ssi ON cas.separator_id = ssi.id
            WHERE cas.character_id = ?
        `;
        this.db.get(query, [characterId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

// Добавить кастомное эмодзи для персонажа
setCharacterCustomEmoji(characterId, emojiUrl, emojiName = null, extraData = {}) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO character_custom_emojis (
                character_id, 
                emoji_url, 
                emoji_name,
                discord_emoji_id,
                discord_emoji_identifier,
                animated,
                original_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(character_id) DO UPDATE SET
                emoji_url = ?,
                emoji_name = ?,
                discord_emoji_id = ?,
                discord_emoji_identifier = ?,
                animated = ?,
                original_url = ?,
                purchased_at = CURRENT_TIMESTAMP
        `;
        
        const discordEmojiId = extraData.discord_emoji_id || null;
        const discordEmojiIdentifier = extraData.discord_emoji_identifier || null;
        const animated = extraData.animated || 0;
        const originalUrl = extraData.original_url || null;
        
        this.db.run(query, [
            characterId, 
            emojiUrl, 
            emojiName,
            discordEmojiId,
            discordEmojiIdentifier,
            animated,
            originalUrl,
            // UPDATE части
            emojiUrl, 
            emojiName,
            discordEmojiId,
            discordEmojiIdentifier,
            animated,
            originalUrl
        ], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Получить кастомное эмодзи персонажа
getCharacterCustomEmoji(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM character_custom_emojis WHERE character_id = ?';
        this.db.get(query, [characterId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

// Удалить кастомное эмодзи персонажа
deleteCharacterCustomEmoji(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM character_custom_emojis WHERE character_id = ?';
        this.db.run(query, [characterId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Добавить новый разделитель в магазин (для админов)
addSeparatorToShop(separatorData) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO separator_shop_items 
            (name, description, preview_url, separator1_url, separator2_url, price, category, rarity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        this.db.run(query, [
            separatorData.name,
            separatorData.description || '',
            separatorData.preview_url,
            separatorData.separator1_url,
            separatorData.separator2_url || null,
            separatorData.price || 0,
            separatorData.category || 'Стандартные',
            separatorData.rarity || 'common'
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

// ===============================
// СИСТЕМА ЭМОДЗИ ПОЛЬЗОВАТЕЛЕЙ
// ===============================

// Инициализация таблицы эмодзи пользователей
initUserEmojisTable() {
    const createTable = `
        CREATE TABLE IF NOT EXISTS user_emojis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            emoji_id TEXT,
            name TEXT NOT NULL,
            image_url TEXT NOT NULL,
            discord_emoji_id TEXT,
            rarity TEXT DEFAULT 'common',
            category TEXT,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        )
    `;
    this.db.run(createTable, (err) => {
        if (err) console.error('❌ Ошибка создания user_emojis:', err);
        else console.log('✅ Таблица user_emojis создана');
    });
}

// Получить все эмодзи пользователя
getUserEmojis(userId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM user_emojis WHERE user_id = ? ORDER BY purchased_at DESC';
        this.db.all(query, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Добавить эмодзи пользователю из конфига
addUserEmojiFromConfig(userId, emojiData, client = null, discordEmojiData = null) {
    return new Promise(async (resolve, reject) => {
        try {
            // Проверяем, есть ли уже такое эмодзи
            const existing = await this.getUserEmojis(userId);
            if (existing.some(e => e.name === emojiData.name)) {
                return reject(new Error('Эмодзи уже куплено'));
            }

            let discordEmojiId = null;
            let discordIdentifier = null;

            // Если переданы Discord данные из uploadEmojiToGuild - используем их
            if (discordEmojiData && discordEmojiData.id) {
                discordEmojiId = discordEmojiData.id;
                discordIdentifier = discordEmojiData.identifier;
                console.log(`✅ Используются предзагруженные Discord данные: ${discordIdentifier}`);
            }
            // Иначе пытаемся загрузить эмодзи в Discord (старая логика для обратной совместимости)
            else if (client && emojiData.image_url) {
                try {
                    const guild = client.guilds.cache.first();
                    if (guild) {
                        const emoji = await guild.emojis.create({
                            attachment: emojiData.image_url,
                            name: emojiData.id.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32)
                        });
                        discordEmojiId = emoji.id;
                        discordIdentifier = emoji.identifier;
                        console.log(`✅ Эмодзи ${emojiData.name} загружено в Discord: ${emoji.id}`);
                    }
                } catch (emojiError) {
                    console.error('⚠️ Не удалось загрузить эмодзи в Discord:', emojiError.message);
                }
            }

            const query = `
                INSERT INTO user_emojis (user_id, emoji_id, name, image_url, discord_emoji_id, rarity, category)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            this.db.run(query, [
                userId,
                emojiData.id,
                emojiData.name,
                emojiData.image_url,
                discordEmojiId,
                emojiData.rarity || 'common',
                emojiData.category || null
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Добавить разделитель пользователю из конфига
addUserSeparatorFromConfig(userId, separatorData) {
    return new Promise(async (resolve, reject) => {
        try {
            // Проверяем, есть ли уже в БД
            let separator = await this.getSeparatorByConfigId(separatorData.id);
            
            // Если нет - добавляем в магазин
            if (!separator) {
                const insertQuery = `
                    INSERT INTO separator_shop_items 
                    (name, description, preview_url, separator1_url, separator2_url, price, category, rarity)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await new Promise((res, rej) => {
                    this.db.run(insertQuery, [
                        separatorData.name,
                        separatorData.description || '',
                        separatorData.preview_urls?.[0] || '',
                        separatorData.separator1_url,
                        separatorData.separator2_url || null,
                        separatorData.price || 0,
                        separatorData.category || 'Стандартные',
                        separatorData.rarity || 'common'
                    ], function(err) {
                        if (err) rej(err);
                        else res(this.lastID);
                    });
                });
                separator = await this.getSeparatorByConfigId(separatorData.id);
            }

            if (!separator) {
                // Получаем последний добавленный
                separator = await new Promise((res, rej) => {
                    this.db.get('SELECT * FROM separator_shop_items ORDER BY id DESC LIMIT 1', [], (err, row) => {
                        if (err) rej(err);
                        else res(row);
                    });
                });
            }

            if (!separator) {
                return reject(new Error('Не удалось добавить разделитель'));
            }

            // Добавляем пользователю
            const userQuery = 'INSERT OR IGNORE INTO user_separators (user_id, separator_id) VALUES (?, ?)';
            this.db.run(userQuery, [userId, separator.id], function(err) {
                if (err) reject(err);
                else resolve(separator.id);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Получить разделитель по ID из конфига
getSeparatorByConfigId(configId) {
    return new Promise((resolve, reject) => {
        // Ищем по имени, так как config ID не хранится
        const query = 'SELECT * FROM separator_shop_items WHERE name = ? LIMIT 1';
        this.db.get(query, [configId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Удалить эмодзи пользователя
deleteUserEmoji(userId, emojiId) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM user_emojis WHERE user_id = ? AND id = ?';
        this.db.run(query, [userId, emojiId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// === ГАЛЕРЕЯ ПЕРСОНАЖА ===

// Создать таблицу галереи
createCharacterGalleryTable() {
    return new Promise((resolve, reject) => {
        // Сначала проверяем есть ли колонка image_url
        this.db.all("PRAGMA table_info(character_gallery)", (err, columns) => {
            if (err) {
                // Таблицы нет - создаём
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS character_gallery (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        character_id INTEGER NOT NULL,
                        image_url TEXT NOT NULL,
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
                    )
                `, (createErr) => {
                    if (createErr) reject(createErr);
                    else resolve();
                });
                return;
            }

            // Проверяем есть ли колонка image_url
            const hasImageUrl = columns && columns.some(col => col.name === 'image_url');
            
            if (!hasImageUrl && columns && columns.length > 0) {
                // Таблица существует но без image_url - пересоздаём
                console.log('⚠️ Пересоздаём таблицу character_gallery с правильной схемой...');
                this.db.run('DROP TABLE IF EXISTS character_gallery', (dropErr) => {
                    if (dropErr) {
                        console.error('Ошибка удаления таблицы:', dropErr);
                        return reject(dropErr);
                    }
                    this.db.run(`
                        CREATE TABLE character_gallery (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            character_id INTEGER NOT NULL,
                            image_url TEXT NOT NULL,
                            description TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
                        )
                    `, (createErr) => {
                        if (createErr) reject(createErr);
                        else {
                            console.log('✅ Таблица character_gallery пересоздана');
                            resolve();
                        }
                    });
                });
            } else {
                // Всё ок или таблицы нет
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS character_gallery (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        character_id INTEGER NOT NULL,
                        image_url TEXT NOT NULL,
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
                    )
                `, (createErr) => {
                    if (createErr) reject(createErr);
                    else resolve();
                });
            }
        });
    });
}

// Получить галерею персонажа
getCharacterGallery(characterId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Сначала убедимся что таблица существует
            await this.createCharacterGalleryTable();
            
            const query = 'SELECT * FROM character_gallery WHERE character_id = ? ORDER BY created_at DESC';
            this.db.all(query, [characterId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Добавить изображение в галерею
addToCharacterGallery(characterId, imageUrl, description = null) {
    return new Promise(async (resolve, reject) => {
        try {
            // Убеждаемся, что таблица существует
            await this.createCharacterGalleryTable();
            
            // Проверяем лимит (макс 5 изображений)
            const gallery = await this.getCharacterGallery(characterId);
            if (gallery.length >= 5) {
                return reject(new Error('Достигнут лимит галереи (максимум 5 изображений)'));
            }

            const query = 'INSERT INTO character_gallery (character_id, image_url, description) VALUES (?, ?, ?)';
            this.db.run(query, [characterId, imageUrl, description], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, characterId, imageUrl, description });
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Удалить изображение из галереи
removeFromCharacterGallery(imageId) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM character_gallery WHERE id = ?';
        this.db.run(query, [imageId], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

// Обновить описание изображения в галерее
updateGalleryImage(imageId, description) {
    return new Promise((resolve, reject) => {
        const query = 'UPDATE character_gallery SET description = ? WHERE id = ?';
        this.db.run(query, [description, imageId], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

// === ДОСТИЖЕНИЯ ПЕРСОНАЖА ===

// Создать таблицу достижений
createAchievementsTable() {
    return new Promise((resolve, reject) => {
        const query = `
            CREATE TABLE IF NOT EXISTS character_achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                icon TEXT DEFAULT '🏆',
                rarity TEXT DEFAULT 'common',
                awarded_by TEXT,
                awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )
        `;
        this.db.run(query, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Получить достижения персонажа
getCharacterAchievements(characterId) {
    return new Promise(async (resolve, reject) => {
        try {
            await this.createAchievementsTable();
            const query = 'SELECT * FROM character_achievements WHERE character_id = ? ORDER BY awarded_at DESC';
            this.db.all(query, [characterId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Добавить достижение персонажу
addCharacterAchievement(characterId, title, description, icon, rarity, awardedBy) {
    return new Promise(async (resolve, reject) => {
        try {
            await this.createAchievementsTable();
            const query = 'INSERT INTO character_achievements (character_id, title, description, icon, rarity, awarded_by) VALUES (?, ?, ?, ?, ?, ?)';
            this.db.run(query, [characterId, title, description, icon || '🏆', rarity || 'common', awardedBy], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, characterId, title, description, icon, rarity });
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Удалить достижение
removeCharacterAchievement(achievementId) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM character_achievements WHERE id = ?';
        this.db.run(query, [achievementId], function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

// === СТАТИСТИКА СООБЩЕНИЙ ===

// Получить количество сообщений персонажа
getCharacterMessageCount(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT COUNT(*) as count FROM message_log WHERE character_id = ?';
        this.db.get(query, [characterId], (err, row) => {
            if (err) {
                // Если таблицы нет, возвращаем 0
                if (err.message.includes('no such table')) {
                    resolve(0);
                } else {
                    reject(err);
                }
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// Создать таблицу для лога сообщений
createMessageLogTable() {
    return new Promise((resolve, reject) => {
        const query = `
            CREATE TABLE IF NOT EXISTS message_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                channel_id TEXT,
                message_length INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )
        `;
        this.db.run(query, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Записать сообщение в лог
logCharacterMessage(characterId, channelId, messageLength) {
    return new Promise(async (resolve, reject) => {
        try {
            await this.createMessageLogTable();
            const query = 'INSERT INTO message_log (character_id, channel_id, message_length) VALUES (?, ?, ?)';
            this.db.run(query, [characterId, channelId, messageLength], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Обновить биографию персонажа
updateCharacterBio(characterId, data) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const values = [];
        
        if (data.biography !== undefined) {
            fields.push('biography = ?');
            values.push(data.biography);
        }
        if (data.backstory !== undefined) {
            fields.push('backstory = ?');
            values.push(data.backstory);
        }
        if (data.personality !== undefined) {
            fields.push('personality = ?');
            values.push(data.personality);
        }
        if (data.goals !== undefined) {
            fields.push('goals = ?');
            values.push(data.goals);
        }

        if (fields.length === 0) {
            return resolve(false);
        }

        values.push(characterId);
        const query = `UPDATE characters SET ${fields.join(', ')} WHERE id = ?`;
        
        this.db.run(query, values, function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
        });
    });
}

// Добавить колонки биографии если их нет
ensureBioColumns() {
    return new Promise((resolve, reject) => {
        const columns = ['biography', 'backstory', 'personality', 'goals'];
        let completed = 0;
        
        columns.forEach(col => {
            const query = `ALTER TABLE characters ADD COLUMN ${col} TEXT`;
            this.db.run(query, (err) => {
                // Игнорируем ошибку если колонка уже существует
                completed++;
                if (completed === columns.length) {
                    resolve();
                }
            });
        });
    });
}

// Добавить колонку bounty (награда за голову)
ensureBountyColumn() {
    return new Promise((resolve, reject) => {
        const query = `ALTER TABLE characters ADD COLUMN bounty INTEGER DEFAULT 0`;
        this.db.run(query, (err) => {
            // Игнорируем ошибку если колонка уже существует
            resolve();
        });
    });
}

// Обновить награду за голову
updateCharacterBounty(characterId, bounty) {
    return new Promise(async (resolve, reject) => {
        try {
            await this.ensureBountyColumn();
            const query = 'UPDATE characters SET bounty = ? WHERE id = ?';
            this.db.run(query, [bounty, characterId], function(err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Получить награду за голову
getCharacterBounty(characterId) {
    return new Promise(async (resolve, reject) => {
        try {
            await this.ensureBountyColumn();
            const query = 'SELECT bounty FROM characters WHERE id = ?';
            this.db.get(query, [characterId], (err, row) => {
                if (err) reject(err);
                else resolve(row?.bounty || 0);
            });
        } catch (error) {
            reject(error);
        }
    });
}

}

module.exports = Database;



