// sqliteSafe.js
const sqlite3 = require('sqlite3').verbose();

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isBusy(err) {
  return err && (err.code === 'SQLITE_BUSY' || err.code === 'SQLITE_LOCKED');
}

class SQLiteSafe {
  constructor(filename, opts = {}) {
    const {
      busyTimeoutMs = 5000,
      maxRetries = 8,
      retryBaseDelayMs = 30,
    } = opts;

    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;

    // По умолчанию node-sqlite3 открывает с OPEN_FULLMUTEX; оставим это поведение.
    this.db = new sqlite3.Database(filename, (err) => {
      if (err) console.error('SQLite open error:', err);
    });

    // Встроенный busy timeout в node-sqlite3
    this.db.configure('busyTimeout', busyTimeoutMs);

    // Практичный набор PRAGMA для многопоточности/многих запросов
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = ${busyTimeoutMs};
    `, (err) => {
      if (err) console.error('SQLite PRAGMA error:', err);
    });

    // Одна очередь на все операции (сильно снижает вероятность SQLITE_BUSY внутри процесса)
    this._queue = Promise.resolve();
  }

  _enqueue(fn) {
    this._queue = this._queue.then(fn, fn);
    return this._queue;
  }

  async _withRetry(op) {
    let attempt = 0;
    while (true) {
      try {
        return await op();
      } catch (err) {
        if (!isBusy(err) || attempt >= this.maxRetries) throw err;
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt); // экспонента
        attempt++;
        await sleep(delay);
      }
    }
  }

  run(sql, params = []) {
    return this._enqueue(() =>
      this._withRetry(() => new Promise((resolve, reject) => {
        this.db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      }))
    );
  }

  get(sql, params = []) {
    return this._enqueue(() =>
      this._withRetry(() => new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      }))
    );
  }

  all(sql, params = []) {
    return this._enqueue(() =>
      this._withRetry(() => new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      }))
    );
  }

  async tx(fn) {
    // IMMEDIATE — сразу берет write-lock (быстрее “фейлится”, но ретраи/timeout отработают предсказуемее)
    return this._enqueue(() =>
      this._withRetry(async () => {
        await this.run('BEGIN IMMEDIATE');
        try {
          const res = await fn(this);
          await this.run('COMMIT');
          return res;
        } catch (e) {
          try { await this.run('ROLLBACK'); } catch {}
          throw e;
        }
      })
    );
  }
}

module.exports = { SQLiteSafe };
