// utils/economyUtils.js
const Database = require('../database');
const db = new Database();

async function getConfig(guildId) {
  return db.getEconomyConfig(guildId);
}

// amountPeso → объект {pounds, sol, peso}
function splitAmount(amountPeso, cfg) {
  const pesoPerPound = cfg.peso_per_pound || 100;
  const pesoPerSol = Math.floor(pesoPerPound / (cfg.sol_per_pound || 20)); // 5
  const pounds = Math.floor(amountPeso / pesoPerPound);
  let rest = amountPeso % pesoPerPound;
  const sol = Math.floor(rest / pesoPerSol);
  const peso = rest % pesoPerSol;
  return { pounds, sol, peso };
}

function formatAmount(amountPeso, cfg) {
  const { pounds, sol, peso } = splitAmount(amountPeso, cfg);
  const parts = [];
  if (pounds) parts.push(`${pounds} ${cfg.pound_name}`);
  if (sol)    parts.push(`${sol} ${cfg.sol_name}`);
  if (peso || parts.length === 0) parts.push(`${peso} ${cfg.peso_name}`);
  return parts.join(' ');
}

// парсер строки вида "1ф 3с 2п" или "1 3 2"
function parseAmountToPeso(input, cfg) {
  const pesoPerPound = cfg.peso_per_pound || 100;
  const pesoPerSol = Math.floor(pesoPerPound / (cfg.sol_per_pound || 20));

  const cleaned = input.replace(',', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!cleaned) return 0;

  let pounds = 0, sol = 0, peso = 0;

  // примеры: "1ф", "2фунт", "3f"
  const tokens = cleaned.split(' ');
  for (const token of tokens) {
    const m = token.match(/^(\d+)(.*)$/);
    if (!m) continue;
    const value = parseInt(m[1], 10);
    const suffix = m[2];

    if (!suffix || suffix === 'ф' || suffix.startsWith('фун')) {
      pounds += value;
    } else if (suffix === 'с' || suffix.startsWith('соль')) {
      sol += value;
    } else if (suffix === 'п' || suffix.startsWith('песс')) {
      peso += value;
    } else {
      // если суффикса нет у нескольких токенов — первый считаем фунтами, второй солями и т.д. по желанию
      pounds += value;
    }
  }

  return pounds * pesoPerPound + sol * pesoPerSol + peso;
}

module.exports = {
  getConfig,
  splitAmount,
  formatAmount,
  parseAmountToPeso
};
