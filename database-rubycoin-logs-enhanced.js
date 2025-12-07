const sqlite3 = require('sqlite3').verbose();

class RubyCoinLoggerEnhanced {
    constructor(db) {
        this.db = db;
        this.initRubyCoinLogsTable();
    }

    initRubyCoinLogsTable() {
        const createLogsTable = `
            CREATE TABLE IF NOT EXISTS rubycoin_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                username TEXT,
                admin_id TEXT,
                admin_username TEXT,
                action_type TEXT NOT NULL,
                amount REAL NOT NULL,
                balance_before REAL NOT NULL,
                balance_after REAL NOT NULL,
                category TEXT,
                item_name TEXT,
                item_id TEXT,
                description TEXT,
                guild_id TEXT,
                guild_name TEXT,
                channel_id TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES characters(discord_id)
            )
        `;

        const createIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_user ON rubycoin_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_action ON rubycoin_logs(action_type)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_created ON rubycoin_logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_category ON rubycoin_logs(category)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_guild ON rubycoin_logs(guild_id)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_admin ON rubycoin_logs(admin_id)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_amount ON rubycoin_logs(amount)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_logs_user_created ON rubycoin_logs(user_id, created_at DESC)'
        ];

        const createStatsView = `
            CREATE VIEW IF NOT EXISTS rubycoin_user_stats AS
            SELECT 
                user_id,
                username,
                COUNT(*) as total_transactions,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
                MAX(balance_after) as peak_balance,
                MIN(created_at) as first_transaction,
                MAX(created_at) as last_transaction,
                COUNT(DISTINCT DATE(created_at)) as active_days
            FROM rubycoin_logs
            GROUP BY user_id
        `;

        this.db.run(createLogsTable, (err) => {
            if (err) {
                console.error('❌ Ошибка создания таблицы rubycoin_logs:', err);
            } else {
                console.log('✅ Таблица rubycoin_logs создана/проверена');
                
                createIndexes.forEach(indexQuery => {
                    this.db.run(indexQuery, (indexErr) => {
                        if (indexErr && !indexErr.message.includes('already exists')) {
                            console.error('Ошибка создания индекса:', indexErr);
                        }
                    });
                });

                this.db.run(createStatsView, (viewErr) => {
                    if (viewErr && !viewErr.message.includes('already exists')) {
                        console.error('Ошибка создания представления:', viewErr);
                    } else {
                        console.log('✅ Представление rubycoin_user_stats создано');
                    }
                });
            }
        });
    }

    async logTransaction(data) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO rubycoin_logs 
                (user_id, username, admin_id, admin_username, action_type, amount, 
                 balance_before, balance_after, category, item_name, item_id, 
                 description, guild_id, guild_name, channel_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            this.db.run(query, [
                data.userId,
                data.username || null,
                data.adminId || null,
                data.adminUsername || null,
                data.actionType,
                data.amount,
                data.balanceBefore,
                data.balanceAfter,
                data.category || null,
                data.itemName || null,
                data.itemId || null,
                data.description || null,
                data.guildId || null,
                data.guildName || null,
                data.channelId || null,
                data.metadata ? JSON.stringify(data.metadata) : null
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

    async getUserTransactionHistory(userId, options = {}) {
        return new Promise((resolve, reject) => {
            const {
                limit = 50,
                offset = 0,
                actionType = null,
                category = null,
                startDate = null,
                endDate = null,
                minAmount = null,
                maxAmount = null
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

            if (minAmount !== null) {
                query += ' AND ABS(amount) >= ?';
                params.push(Math.abs(minAmount));
            }

            if (maxAmount !== null) {
                query += ' AND ABS(amount) <= ?';
                params.push(Math.abs(maxAmount));
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Ошибка получения истории:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
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
                    COALESCE(category, 'other') as category,
                    COUNT(*) as transaction_count,
                    SUM(ABS(amount)) as total_spent,
                    AVG(ABS(amount)) as avg_spent,
                    MAX(ABS(amount)) as max_spent,
                    MIN(ABS(amount)) as min_spent
                FROM rubycoin_logs
                WHERE user_id = ? AND amount < 0
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
                    COALESCE(category, 'other') as category,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_earned,
                    AVG(amount) as avg_earned,
                    MAX(amount) as max_earned,
                    MIN(amount) as min_earned
                FROM rubycoin_logs
                WHERE user_id = ? AND amount > 0
                GROUP BY category
                ORDER BY total_earned DESC
            `;

            this.db.all(query, [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getTopSpenders(guildId = null, limit = 10, timeframe = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    user_id,
                    username,
                    COUNT(*) as transaction_count,
                    SUM(ABS(amount)) as total_spent,
                    AVG(ABS(amount)) as avg_transaction
                FROM rubycoin_logs
                WHERE amount < 0
            `;

            const params = [];

            if (guildId) {
                query += ' AND guild_id = ?';
                params.push(guildId);
            }

            if (timeframe) {
                query += ' AND created_at >= datetime("now", ?)';
                params.push(timeframe);
            }

            query += ' GROUP BY user_id ORDER BY total_spent DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getTopEarners(guildId = null, limit = 10, timeframe = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    user_id,
                    username,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_earned,
                    AVG(amount) as avg_transaction
                FROM rubycoin_logs
                WHERE amount > 0
            `;

            const params = [];

            if (guildId) {
                query += ' AND guild_id = ?';
                params.push(guildId);
            }

            if (timeframe) {
                query += ' AND created_at >= datetime("now", ?)';
                params.push(timeframe);
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
            const query = 'SELECT * FROM rubycoin_user_stats WHERE user_id = ?';

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

    async getTransactionById(transactionId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM rubycoin_logs WHERE id = ?';

            this.db.get(query, [transactionId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    async searchTransactions(searchParams) {
        return new Promise((resolve, reject) => {
            const {
                userId = null,
                itemName = null,
                description = null,
                minAmount = null,
                maxAmount = null,
                startDate = null,
                endDate = null,
                limit = 50
            } = searchParams;

            let query = 'SELECT * FROM rubycoin_logs WHERE 1=1';
            const params = [];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            if (itemName) {
                query += ' AND item_name LIKE ?';
                params.push(`%${itemName}%`);
            }

            if (description) {
                query += ' AND description LIKE ?';
                params.push(`%${description}%`);
            }

            if (minAmount !== null) {
                query += ' AND ABS(amount) >= ?';
                params.push(Math.abs(minAmount));
            }

            if (maxAmount !== null) {
                query += ' AND ABS(amount) <= ?';
                params.push(Math.abs(maxAmount));
            }

            if (startDate) {
                query += ' AND created_at >= ?';
                params.push(startDate);
            }

            if (endDate) {
                query += ' AND created_at <= ?';
                params.push(endDate);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(limit);

            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async getDailyStats(userId, days = 30) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as transactions,
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as earned,
                    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as spent,
                    MAX(balance_after) as balance_at_end
                FROM rubycoin_logs
                WHERE user_id = ? AND created_at >= datetime('now', ? || ' days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `;

            this.db.all(query, [userId, -days], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async cleanOldLogs(daysToKeep = 90) {
        return new Promise((resolve, reject) => {
            const query = `
                DELETE FROM rubycoin_logs
                WHERE created_at < datetime('now', ? || ' days')
            `;

            this.db.run(query, [-daysToKeep], function(err) {
                if (err) reject(err);
                else {
                    console.log(`🗑️ Удалено ${this.changes} старых записей логов`);
                    resolve(this.changes);
                }
            });
        });
    }

    async exportUserLogs(userId, format = 'json') {
        const transactions = await this.getUserTransactionHistory(userId, { limit: 10000 });
        const stats = await this.getUserStats(userId);

        const exportData = {
            userId,
            exportDate: new Date().toISOString(),
            stats,
            transactions
        };

        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        }

        return exportData;
    }
}

module.exports = RubyCoinLoggerEnhanced;
