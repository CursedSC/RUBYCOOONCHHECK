const sqlite3 = require('sqlite3').verbose();

class RubyCoinLogger {
    constructor(db) {
        this.db = db;
        this.initRubyCoinLogsTable();
    }

    initRubyCoinLogsTable() {
        const createLogsTable = `
            CREATE TABLE IF NOT EXISTS rubycoin_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                admin_id TEXT,
                action_type TEXT NOT NULL,
                amount REAL NOT NULL,
                balance_before REAL NOT NULL,
                balance_after REAL NOT NULL,
                category TEXT,
                item_name TEXT,
                description TEXT,
                guild_id TEXT,
                channel_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_user ON rubycoin_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_action ON rubycoin_logs(action_type)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_created ON rubycoin_logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_category ON rubycoin_logs(category)'
        ];

        this.db.run(createLogsTable, (err) => {
            if (err) {
                console.error('❌ Ошибка создания таблицы rubycoin_logs:', err);
            } else {
                console.log('✅ Таблица rubycoin_logs создана/проверена');
                
                createIndexes.forEach(indexQuery => {
                    this.db.run(indexQuery, (indexErr) => {
                        if (indexErr) console.error('Ошибка создания индекса:', indexErr);
                    });
                });
            }
        });
    }

    async logTransaction(data) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO rubycoin_logs 
                (user_id, admin_id, action_type, amount, balance_before, balance_after, 
                 category, item_name, description, guild_id, channel_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                data.userId,
                data.adminId || null,
                data.actionType,
                data.amount,
                data.balanceBefore,
                data.balanceAfter,
                data.category || null,
                data.itemName || null,
                data.description || null,
                data.guildId || null,
                data.channelId || null
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    async getUserTransactionHistory(userId, options = {}) {
        return new Promise((resolve, reject) => {
            const {
                limit = 50,
                offset = 0,
                actionType = null,
                category = null,
                startDate = null,
                endDate = null
            } = options;

            let query = 'SELECT * FROM rubycoin_logs WHERE user_id = ?';
            const params = [userId];

            if (actionType) {
                query += ' AND action_type = ?';
                params.push(actionType);
            }

            if (category) {
                query += ' AND category = ?';
                params.push(category);
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

    async getUserTransactionCount(userId, options = {}) {
        return new Promise((resolve, reject) => {
            const { actionType = null, category = null } = options;

            let query = 'SELECT COUNT(*) as count FROM rubycoin_logs WHERE user_id = ?';
            const params = [userId];

            if (actionType) {
                query += ' AND action_type = ?';
                params.push(actionType);
            }

            if (category) {
                query += ' AND category = ?';
                params.push(category);
            }

            this.db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row?.count || 0);
            });
        });
    }

    async getUserSpendingByCategory(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    category,
                    COUNT(*) as transaction_count,
                    SUM(ABS(amount)) as total_spent
                FROM rubycoin_logs
                WHERE user_id = ? AND action_type IN ('spend', 'purchase', 'transfer_out')
                GROUP BY category
                ORDER BY total_spent DESC
            `;

            this.db.all(query, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getUserEarningsBySource(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    category,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_earned
                FROM rubycoin_logs
                WHERE user_id = ? AND action_type IN ('earn', 'admin_add', 'transfer_in', 'reward')
                GROUP BY category
                ORDER BY total_earned DESC
            `;

            this.db.all(query, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getTopSpenders(guildId = null, limit = 10) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    user_id,
                    COUNT(*) as transaction_count,
                    SUM(ABS(amount)) as total_spent
                FROM rubycoin_logs
                WHERE action_type IN ('spend', 'purchase', 'transfer_out')
            `;

            const params = [];

            if (guildId) {
                query += ' AND guild_id = ?';
                params.push(guildId);
            }

            query += ' GROUP BY user_id ORDER BY total_spent DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getTopEarners(guildId = null, limit = 10) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    user_id,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_earned
                FROM rubycoin_logs
                WHERE action_type IN ('earn', 'admin_add', 'transfer_in', 'reward')
            `;

            const params = [];

            if (guildId) {
                query += ' AND guild_id = ?';
                params.push(guildId);
            }

            query += ' GROUP BY user_id ORDER BY total_earned DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getUserStats(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
                    MAX(created_at) as last_transaction,
                    MIN(created_at) as first_transaction
                FROM rubycoin_logs
                WHERE user_id = ?
            `;

            this.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    async getRecentTransactions(limit = 50, guildId = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM rubycoin_logs';
            const params = [];

            if (guildId) {
                query += ' WHERE guild_id = ?';
                params.push(guildId);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getAdminActionHistory(adminId, limit = 100) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM rubycoin_logs
                WHERE admin_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `;

            this.db.all(query, [adminId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async cleanOldLogs(daysToKeep = 90) {
        return new Promise((resolve, reject) => {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const query = `
                DELETE FROM rubycoin_logs
                WHERE created_at < ?
            `;

            this.db.run(query, [cutoffDate.toISOString()], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
}

module.exports = RubyCoinLogger;