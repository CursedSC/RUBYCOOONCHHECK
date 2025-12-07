const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class CoinLogger {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, '../characters.db'));
        this.initTables();
    }

    initTables() {
        const createTransactionsTable = `
            CREATE TABLE IF NOT EXISTS coin_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT,
                coin_type TEXT NOT NULL,
                amount REAL NOT NULL,
                balance_before REAL NOT NULL,
                balance_after REAL NOT NULL,
                transaction_type TEXT NOT NULL,
                description TEXT,
                admin_id TEXT,
                related_id TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_coin (user_id, coin_type),
                INDEX idx_created_at (created_at)
            )
        `;

        const createStatsTable = `
            CREATE TABLE IF NOT EXISTS coin_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                rubycoin_total_earned REAL DEFAULT 0,
                rubycoin_total_spent REAL DEFAULT 0,
                peso_total_earned REAL DEFAULT 0,
                peso_total_spent REAL DEFAULT 0,
                sol_total_earned REAL DEFAULT 0,
                sol_total_spent REAL DEFAULT 0,
                pound_total_earned REAL DEFAULT 0,
                pound_total_spent REAL DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(createTransactionsTable, (err) => {
            if (err) console.error('❌ Ошибка создания coin_transactions:', err);
            else console.log('✅ Таблица coin_transactions готова');
        });

        this.db.run(createStatsTable, (err) => {
            if (err) console.error('❌ Ошибка создания coin_statistics:', err);
            else console.log('✅ Таблица coin_statistics готова');
        });
    }

    async logTransaction(data) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO coin_transactions (
                    user_id, guild_id, coin_type, amount, balance_before, 
                    balance_after, transaction_type, description, admin_id, 
                    related_id, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

            this.db.run(query, [
                data.userId,
                data.guildId || null,
                data.coinType,
                data.amount,
                data.balanceBefore,
                data.balanceAfter,
                data.transactionType,
                data.description,
                data.adminId || null,
                data.relatedId || null,
                metadata
            ], function(err) {
                if (err) {
                    console.error('❌ Ошибка логирования транзакции:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateUserStats(userId, coinType, amount, isIncome) {
        return new Promise((resolve, reject) => {
            const field = isIncome 
                ? `${coinType.toLowerCase()}_total_earned`
                : `${coinType.toLowerCase()}_total_spent`;

            const query = `
                INSERT INTO coin_statistics (user_id, ${field})
                VALUES (?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    ${field} = ${field} + ?,
                    updated_at = CURRENT_TIMESTAMP
            `;

            this.db.run(query, [userId, Math.abs(amount), Math.abs(amount)], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async getUserTransactions(userId, options = {}) {
        return new Promise((resolve, reject) => {
            const {
                coinType = null,
                limit = 50,
                offset = 0,
                startDate = null,
                endDate = null
            } = options;

            let query = 'SELECT * FROM coin_transactions WHERE user_id = ?';
            const params = [userId];

            if (coinType) {
                query += ' AND coin_type = ?';
                params.push(coinType);
            }

            if (startDate) {
                query += ' AND created_at >= ?';
                params.push(startDate);
            }

            if (endDate) {
                query += ' AND created_at <= ?';
                params.push(endDate);
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getUserStatistics(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM coin_statistics WHERE user_id = ?';
            this.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {
                    rubycoin_total_earned: 0,
                    rubycoin_total_spent: 0,
                    peso_total_earned: 0,
                    peso_total_spent: 0,
                    sol_total_earned: 0,
                    sol_total_spent: 0,
                    pound_total_earned: 0,
                    pound_total_spent: 0
                });
            });
        });
    }

    async getTransactionCount(userId, coinType = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT COUNT(*) as count FROM coin_transactions WHERE user_id = ?';
            const params = [userId];

            if (coinType) {
                query += ' AND coin_type = ?';
                params.push(coinType);
            }

            this.db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });
    }

    async getTopSpenders(coinType, limit = 10) {
        return new Promise((resolve, reject) => {
            const field = `${coinType.toLowerCase()}_total_spent`;
            const query = `
                SELECT user_id, ${field} as total_spent
                FROM coin_statistics
                WHERE ${field} > 0
                ORDER BY ${field} DESC
                LIMIT ?
            `;

            this.db.all(query, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getTopEarners(coinType, limit = 10) {
        return new Promise((resolve, reject) => {
            const field = `${coinType.toLowerCase()}_total_earned`;
            const query = `
                SELECT user_id, ${field} as total_earned
                FROM coin_statistics
                WHERE ${field} > 0
                ORDER BY ${field} DESC
                LIMIT ?
            `;

            this.db.all(query, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
}

module.exports = new CoinLogger();
