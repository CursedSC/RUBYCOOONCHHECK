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
    this.initProfilesTable();
    this.initInviteTrackTable();
    this.initTrainingSystemTables();
    this.initCharacterGalleryTable();
    this.initPunishmentSystem();
    this.initEconomyTables();
    this.initKindnessSystem();
    this.initCustomProfileStyling();
}

getAverageStatsForConsole(minTotalStats = 10000) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                COUNT(*) AS players_count,
                ROUND(AVG(strength + agility + reaction + accuracy + endurance + durability + magic), 2) AS avg_total_stats
            FROM characters
            WHERE (strength + agility + reaction + accuracy + endurance + durability + magic) > ?
        `;

        this.db.get(query, [minTotalStats], (err, row) => {
            if (err) {
                reject(err);
            } else {
                const result = row || { players_count: 0, avg_total_stats: 0 };
                console.log(`\n🔥 СТАТИСТИКА ПЕРСОНАЖЕЙ 🔥`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`👥 Количество игроков с общим статом > ${minTotalStats}: ${result.players_count}`);
                console.log(`⚡ Среднее количество статов на персонажа: ${result.avg_total_stats}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                resolve(result);
            }
        });
    });
}


  initEconomyTables() {
    const createConfigTable = `
      CREATE TABLE IF NOT EXISTS economyconfig (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildid TEXT NOT NULL UNIQUE,
        baseunit TEXT NOT NULL DEFAULT 'peso',
        pound_name TEXT NOT NULL DEFAULT 'Фунт',
        sol_name   TEXT NOT NULL DEFAULT 'Соль',
        peso_name  TEXT NOT NULL DEFAULT 'Пессо',
        sol_per_pound   INTEGER NOT NULL DEFAULT 20,
        peso_per_pound  INTEGER NOT NULL DEFAULT 100,
        admin_only_issuance BOOLEAN NOT NULL DEFAULT 1,
        offer_channel_id TEXT,
        createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedat DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createWalletsTable = `
      CREATE TABLE IF NOT EXISTS userwallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userid  TEXT NOT NULL,
        guildid TEXT NOT NULL,
        balance_peso   INTEGER NOT NULL DEFAULT 0,
        totalearned_peso INTEGER NOT NULL DEFAULT 0,
        totalspent_peso  INTEGER NOT NULL DEFAULT 0,
        createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedat DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userid, guildid)
      );
    `;

    const createOffersTable = `
      CREATE TABLE IF NOT EXISTS purchaseoffers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userid  TEXT NOT NULL,
        guildid TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_peso INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        adminid TEXT,
        admincomment TEXT,
        messageid TEXT,
        channelid TEXT,
        createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
        decidedat DATETIME
      );
    `;

    this.db.run(createConfigTable, err => {
      if (err) console.error('economyconfig', err);
      else console.log('economyconfig');
    });

    this.db.run(createWalletsTable, err => {
      if (err) console.error('userwallets', err);
      else console.log('userwallets');
    });

    this.db.run(createOffersTable, err => {
      if (err) console.error('purchaseoffers', err);
      else console.log('purchaseoffers');
    });
  }

  getEconomyConfig(guildId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM economyconfig WHERE guildid = ?`;
      this.db.get(query, [guildId], (err, row) => {
        if (err) return reject(err);
        if (!row) {
          return resolve({
            guildid: guildId,
            baseunit: 'peso',
            pound_name: 'Фунт',
            sol_name: 'Соль',
            peso_name: 'Пессо',
            sol_per_pound: 20,
            peso_per_pound: 100,
            admin_only_issuance: 1,
            offer_channel_id: null
          });
        }
        resolve(row);
      });
    });
  }

  setEconomyConfig(guildId, data) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO economyconfig
          (guildid, baseunit, pound_name, sol_name, peso_name,
           sol_per_pound, peso_per_pound, admin_only_issuance, offer_channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guildid) DO UPDATE SET
          baseunit = excluded.baseunit,
          pound_name = excluded.pound_name,
          sol_name   = excluded.sol_name,
          peso_name  = excluded.peso_name,
          sol_per_pound  = excluded.sol_per_pound,
          peso_per_pound = excluded.peso_per_pound,
          admin_only_issuance = excluded.admin_only_issuance,
          offer_channel_id    = excluded.offer_channel_id,
          updatedat = CURRENT_TIMESTAMP;
      `;
      this.db.run(
        query,
        [
          guildId,
          data.baseunit || 'peso',
          data.pound_name || 'Фунт',
          data.sol_name || 'Соль',
          data.peso_name || 'Пессо',
          data.sol_per_pound ?? 20,
          data.peso_per_pound ?? 100,
          data.admin_only_issuance ? 1 : 0,
          data.offer_channel_id || null
        ],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }
    getUserBalance(userId, guildId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT balance_peso FROM userwallets WHERE userid = ? AND guildid = ?`;
      this.db.get(query, [userId, guildId], (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.balance_peso : 0);
      });
    });
  }

  setUserBalance(userId, guildId, amountPeso) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO userwallets (userid, guildid, balance_peso, totalearned_peso, totalspent_peso)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(userid, guildid) DO UPDATE SET
          balance_peso = excluded.balance_peso,
          updatedat = CURRENT_TIMESTAMP;
      `;
      this.db.run(query, [userId, guildId, amountPeso, amountPeso], function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  }

  addBalance(userId, guildId, amountPeso) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO userwallets (userid, guildid, balance_peso, totalearned_peso, totalspent_peso)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(userid, guildid) DO UPDATE SET
          balance_peso     = balance_peso + ?,
          totalearned_peso = totalearned_peso + ?,
          updatedat        = CURRENT_TIMESTAMP;
      `;
      this.db.run(
        query,
        [userId, guildId, amountPeso, amountPeso, amountPeso, amountPeso],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }

  removeBalance(userId, guildId, amountPeso) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE userwallets
           SET balance_peso   = balance_peso - ?,
               totalspent_peso = totalspent_peso + ?,
               updatedat       = CURRENT_TIMESTAMP
         WHERE userid = ? AND guildid = ? AND balance_peso >= ?;
      `;
      this.db.run(
        query,
        [amountPeso, amountPeso, userId, guildId, amountPeso],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes);
        }
      );
    });
  }





initEconomySystem() {
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
            const insertQuery = `
                INSERT INTO economy_balance (user_id, guild_id, pounds, sols, pessos)
                VALUES (?, ?, 0, 0, 0)
                ON CONFLICT(user_id, guild_id) DO NOTHING
            `;
            this.db.run(insertQuery, [userId, guildId]);

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

            const itemQuery = 'SELECT * FROM shop_items WHERE id = ? AND enabled = 1';
            this.db.get(itemQuery, [itemId], (err, item) => {
                if (err || !item) {
                    this.db.run('ROLLBACK');
                    return reject(err || new Error('Товар не найден'));
                }

                if (item.stock !== -1 && item.stock < quantity) {
                    this.db.run('ROLLBACK');
                    return reject(new Error('Недостаточно товара на складе'));
                }

                const balanceQuery = 'SELECT * FROM economy_balance WHERE user_id = ? AND guild_id = ?';
                this.db.get(balanceQuery, [userId, guildId], (err, balance) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        return reject(err);
                    }

                    const userPounds = balance?.pounds || 0;
                    const userSols = balance?.sols || 0;
                    const userPessos = balance?.pessos || 0;

                    const totalPounds = item.price_pounds * quantity;
                    const totalSols = item.price_sols * quantity;
                    const totalPessos = item.price_pessos * quantity;

                    const userTotalPessos = userPounds * 100 + userSols * 5 + userPessos;
                    const itemTotalPessos = totalPounds * 100 + totalSols * 5 + totalPessos;

                    if (userTotalPessos < itemTotalPessos) {
                        this.db.run('ROLLBACK');
                        return reject(new Error('Недостаточно средств'));
                    }

                    const updateBalanceQuery = `
                        UPDATE economy_balance
                        SET pounds = pounds - ?,
                            sols = sols - ?,
                            pessos = pessos - ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ? AND guild_id = ?
                    `;
                    this.db.run(updateBalanceQuery, [totalPounds, totalSols, totalPessos, userId, guildId]);

                    if (item.stock !== -1) {
                        const updateStockQuery = 'UPDATE shop_items SET stock = stock - ? WHERE id = ?';
                        this.db.run(updateStockQuery, [quantity, itemId]);
                    }

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

            const getQuery = 'SELECT * FROM purchase_proposals WHERE id = ? AND status = \'pending\'';
            this.db.get(getQuery, [proposalId], (err, proposal) => {
                if (err || !proposal) {
                    this.db.run('ROLLBACK');
                    return reject(err || new Error('Предложение не найдено'));
                }

                if (approved) {
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
                resolve(this.changes);
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

removePunishment(punishmentId) {
    return new Promise((resolve, reject) => {
        const query = `UPDATE punishments SET removed = 1 WHERE id = ?`;
        
        this.db.run(query, [punishmentId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

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

getCustomStyling(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM customprofilestyling WHERE characterid = ?';
        this.db.get(query, [characterId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

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

deleteCustomStyling(characterId) {
    return new Promise((resolve, reject) => {
        const query = 'DELETE FROM customprofilestyling WHERE characterid = ?';
        this.db.run(query, [characterId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

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
                const totalMessages = row ? (row.total_messages || 0) : 0;
                resolve(totalMessages >= 5);
            }
        });
    });
}

initInviteTrackTable() {
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
                const totalMessages = row ? (row.total_messages || 0) : 0;
                resolve(totalMessages >= 5);
            }
        });
    });
}

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

addInviteTrack(data) {
    return new Promise((resolve, reject) => {
        const accountAgeMs = Date.now() - new Date(data.accountCreatedAt).getTime();
        const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
        const isFake = accountAgeDays < 7;
        
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, keyword)
        )
    `;
    
    this.db.run(createProfilesTableQuery, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы профилей:', err);
        } else {
            console.log('Таблица профилей создана успешно');
        }
    });
}

createProfile(userId, keyword, name, avatar, color = '#FFD700') {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO user_profiles (user_id, keyword, name, avatar, color)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [userId, keyword, name, avatar, color], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

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

        const addIconColumnQuery = `
            ALTER TABLE characters ADD COLUMN icon_url TEXT DEFAULT NULL
        `;
        this.db.run(addIconColumnQuery, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Ошибка добавления колонки icon_url:', err);
            }
        });

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


async addHakiColumns() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Добавление новых столбцов Хаки...');
        
        const newColumns = [
            { name: 'hakinab', type: 'TEXT', default: 'NULL' },
            { name: 'hakiconq', type: 'TEXT', default: 'NULL' },
            { name: 'hakivor', type: 'TEXT', default: 'NULL' }
        ];

        this.db.all("PRAGMA table_info(characters)", [], (err, columns) => {
            if (err) {
                console.error('❌ Ошибка получения информации о столбцах:', err);
                reject(err);
                return;
            }

            const existingColumns = columns.map(col => col.name);
            console.log('📋 Существующие столбцы:', existingColumns);

            const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col.name));
            
            if (columnsToAdd.length === 0) {
                console.log('✅ Все столбцы Хаки уже существуют');
                resolve();
                return;
            }

            console.log(`📝 Добавляем ${columnsToAdd.length} новых столбцов:`, columnsToAdd.map(col => col.name));

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
                    addNextColumn();
                });
            };

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

        const numericFields = ['strength', 'agility', 'reaction', 'accuracy', 'endurance', 'durability', 'magic', 'budget'];
        
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
            this.db.run("PRAGMA foreign_keys=off");
            
            this.db.run("BEGIN TRANSACTION");
            
            this.db.run("ALTER TABLE characters RENAME TO characters_old", (err) => {
                if (err) {
                    console.error('Ошибка переименования таблицы:', err);
                    this.db.run("ROLLBACK");
                    reject(err);
                    return;
                }
                
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
                        
                        this.db.run("DROP TABLE characters_old", (err) => {
                            if (err) {
                                console.error('Ошибка удаления старой таблицы:', err);
                                this.db.run("ROLLBACK");
                                reject(err);
                                return;
                            }
                            
                            this.db.run("COMMIT", (err) => {
                                if (err) {
                                    console.error('Ошибка коммита:', err);
                                    reject(err);
                                } else {
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