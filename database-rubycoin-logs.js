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
                username TEXT,
                user_discriminator TEXT,
                admin_id TEXT,
                admin_username TEXT,
                action_type TEXT NOT NULL CHECK(action_type IN (
                    'admin_add', 'admin_remove', 'earn', 'spend', 
                    'purchase', 'transfer_in', 'transfer_out', 'reward'
                )),
                amount REAL NOT NULL,
                balance_before REAL NOT NULL,
                balance_after REAL NOT NULL,
                category TEXT CHECK(category IN (
                    'admin_operation', 'shop_purchase', 'activity_reward',
                    'transfer', 'event_reward', 'system'
                )),
                item_name TEXT,
                description TEXT NOT NULL,
                guild_id TEXT,
                channel_id TEXT,
                message_id TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT (datetime('now', 'localtime')),
                INDEX idx_user_id (user_id),
                INDEX idx_username (username),
                INDEX idx_admin_id (admin_id),
                INDEX idx_action_type (action_type),
                INDEX idx_category (category),
                INDEX idx_created_at (created_at),
                INDEX idx_user_created (user_id, created_at DESC),
                INDEX idx_admin_created (admin_id, created_at DESC)
            )
        `;

        const createIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_user ON rubycoin_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_username ON rubycoin_logs(username COLLATE NOCASE)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_action ON rubycoin_logs(action_type)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_created ON rubycoin_logs(created_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_category ON rubycoin_logs(category)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_admin ON rubycoin_logs(admin_id)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_combined ON rubycoin_logs(user_id, created_at DESC, action_type)',
            'CREATE INDEX IF NOT EXISTS idx_rubycoin_admin_combined ON rubycoin_logs(admin_id, created_at DESC)'
        ];

        this.db.run(createLogsTable, (err) => {
            if (err) {
                console.error('❌ Ошибка создания таблицы rubycoin_logs:', err);
            } else {
                console.log('✅ Таблица rubycoin_logs создана/проверена');
                
                createIndexes.forEach(indexQuery => {
                    this.db.run(indexQuery, (indexErr) => {
                        if (indexErr && !indexErr.message.includes('already exists')) {
                            console.error('❌ Ошибка создания индекса:', indexErr);
                        }
                    });
                });
            }
        });

        this.createAggregationViews();
    }

    createAggregationViews() {
        const userStatsView = `
            CREATE VIEW IF NOT EXISTS v_rubycoin_user_stats AS
            SELECT 
                user_id,
                MAX(username) as latest_username,
                COUNT(*) as total_transactions,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
                MAX(balance_after) as current_balance,
                MAX(created_at) as last_transaction,
                MIN(created_at) as first_transaction
            FROM rubycoin_logs
            GROUP BY user_id
        `;

        const categoryStatsView = `
            CREATE VIEW IF NOT EXISTS v_rubycoin_category_stats AS
            SELECT 
                user_id,
                MAX(username) as username,
                category,
                COUNT(*) as transaction_count,
                SUM(ABS(amount)) as total_amount,
                AVG(ABS(amount)) as avg_amount
            FROM rubycoin_logs
            WHERE category IS NOT NULL
            GROUP BY user_id, category
        `;

        const adminActivityView = `
            CREATE VIEW IF NOT EXISTS v_admin_rubycoin_activity AS
            SELECT 
                admin_id,
                MAX(admin_username) as admin_username,
                COUNT(*) as total_operations,
                SUM(CASE WHEN amount > 0 THEN 1 ELSE 0 END) as additions,
                SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) as removals,
                SUM(amount) as net_change,
                MAX(created_at) as last_operation
            FROM rubycoin_logs
            WHERE admin_id IS NOT NULL
            GROUP BY admin_id
        `;

        [userStatsView, categoryStatsView, adminActivityView].forEach(viewQuery => {
            this.db.run(viewQuery, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error('❌ Ошибка создания представления:', err);
                }
            });
        });
    }

    async logTransaction(data, user = null, admin = null) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO rubycoin_logs 
                (user_id, username, user_discriminator, admin_id, admin_username,
                 action_type, amount, balance_before, balance_after, 
                 category, item_name, description, guild_id, channel_id, message_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const metadata = JSON.stringify({
                timestamp: Date.now(),
                source: data.source || 'manual',
                extra: data.extra || {}
            });

            this.db.run(query, [
                data.userId,
                user?.username || null,
                user?.discriminator || null,
                data.adminId || null,
                admin?.username || null,
                data.actionType,
                data.amount,
                data.balanceBefore,
                data.balanceAfter,
                data.category || null,
                data.itemName || null,
                data.description || `Операция ${data.actionType}`,
                data.guildId || null,
                data.channelId || null,
                data.messageId || null,
                metadata
            ], function(err) {
                if (err) {
                    console.error('❌ Ошибка логирования транзакции:', err);
                    reject(err);
                } else {
                    console.log(`✅ Транзакция залогирована (ID: ${this.lastID})`);
                    resolve(this.lastID);
                }
            });
        });
    }

    async searchTransactions(searchOptions) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM rubycoin_logs WHERE 1=1';
            const params = [];

            if (searchOptions.userId) {
                query += ' AND user_id = ?';
                params.push(searchOptions.userId);
            }

            if (searchOptions.username) {
                query += ' AND username LIKE ? COLLATE NOCASE';
                params.push(`%${searchOptions.username}%`);
            }

            if (searchOptions.adminId) {
                query += ' AND admin_id = ?';
                params.push(searchOptions.adminId);
            }

            if (searchOptions.adminUsername) {
                query += ' AND admin_username LIKE ? COLLATE NOCASE';
                params.push(`%${searchOptions.adminUsername}%`);
            }

            if (searchOptions.actionType) {
                query += ' AND action_type = ?';
                params.push(searchOptions.actionType);
            }

            if (searchOptions.category) {
                query += ' AND category = ?';
                params.push(searchOptions.category);
            }

            if (searchOptions.minAmount !== undefined) {
                query += ' AND ABS(amount) >= ?';
                params.push(searchOptions.minAmount);
            }

            if (searchOptions.maxAmount !== undefined) {
                query += ' AND ABS(amount) <= ?';
                params.push(searchOptions.maxAmount);
            }

            if (searchOptions.startDate) {
                query += ' AND created_at >= datetime(?)';
                params.push(searchOptions.startDate);
            }

            if (searchOptions.endDate) {
                query += ' AND created_at <= datetime(?)';
                params.push(searchOptions.endDate);
            }

            query += ' ORDER BY created_at DESC';

            if (searchOptions.limit) {
                query += ' LIMIT ?';
                params.push(searchOptions.limit);
            }

            if (searchOptions.offset) {
                query += ' OFFSET ?';
                params.push(searchOptions.offset);
            }

            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('❌ Ошибка поиска транзакций:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async getUserHistory(userId, options = {}) {
        const searchOptions = {
            userId,
            limit: options.limit || 50,
            offset: options.offset || 0,
            ...options
        };
        
        return this.searchTransactions(searchOptions);
    }

    async getUserStats(userId) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM v_rubycoin_user_stats WHERE user_id = ?';
            
            this.db.get(query, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    async getAdminActivity(adminId, options = {}) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT * FROM rubycoin_logs 
                WHERE admin_id = ?
            `;
            const params = [adminId];

            if (options.startDate) {
                query += ' AND created_at >= datetime(?)';
                params.push(options.startDate);
            }

            if (options.endDate) {
                query += ' AND created_at <= datetime(?)';
                params.push(options.endDate);
            }

            query += ' ORDER BY created_at DESC';

            if (options.limit) {
                query += ' LIMIT ?';
                params.push(options.limit);
            }

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
                    MAX(username) as username,
                    COUNT(*) as transaction_count,
                    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_earned,
                    MAX(balance_after) as current_balance
                FROM rubycoin_logs
            `;

            const params = [];

            if (guildId) {
                query += ' WHERE guild_id = ?';
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

    async getRecentActivity(guildId = null, limit = 50) {
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

    async getUserSpendingByCategory(userId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM v_rubycoin_category_stats 
                WHERE user_id = ? 
                ORDER BY total_amount DESC
            `;
            
            this.db.all(query, [userId], (err, rows) => {
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
                WHERE created_at < datetime(?)
            `;

            this.db.run(query, [cutoffDate.toISOString()], function(err) {
                if (err) reject(err);
                else {
                    console.log(`🗑️ Удалено ${this.changes} старых записей логов`);
                    resolve(this.changes);
                }
            });
        });
    }

    async exportUserHistory(userId, format = 'json') {
        const history = await this.getUserHistory(userId, { limit: 1000 });
        const stats = await this.getUserStats(userId);

        if (format === 'csv') {
            const csv = [
                'Дата,Операция,Сумма,Баланс До,Баланс После,Описание,Администратор',
                ...history.map(row => [
                    row.created_at,
                    row.action_type,
                    row.amount,
                    row.balance_before,
                    row.balance_after,
                    row.description,
                    row.admin_username || 'Система'
                ].join(','))
            ].join('\n');

            return csv;
        }

        return {
            stats,
            history,
            exportDate: new Date().toISOString()
        };
    }
}

module.exports = RubyCoinLogger;
