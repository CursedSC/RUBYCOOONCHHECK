const GoogleSheetsSync = require('../googleSheetsSync');
const sync = new GoogleSheetsSync(); // один инстанс

module.exports = {
  data: {
    name: 'загрузить-персонажей',
    description: 'Синхронизировать персонажей с Google Sheets',
  },
  async execute(interaction) {
    try {
      const member = interaction.member;
      const hasAdminRole = member?.roles?.cache?.has(sync.adminRoleId);
      if (!hasAdminRole) {
        await interaction.reply({
          content: '❌ У вас нет прав для использования этой команды (нужна роль администратора).',
          flags: 64, // вместо ephemeral
        });
        return;
      }

      // Один раз подтверждаем interaction
      await interaction.deferReply({ flags: 64 });

      const ok = await sync.loadTable(true);

      await interaction.editReply(
        ok
          ? '✅ Персонажи успешно синхронизированы с Google Sheets.'
          : '❌ Ошибка синхронизации. Смотри логи.'
      );
    } catch (err) {
      console.error('❌ Ошибка выполнения команды загрузить-персонажей:', err);
      // здесь interaction уже или deferred, или нет
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply('❌ Внутренняя ошибка при выполнении команды.');
        } else {
          await interaction.reply({
            content: '❌ Внутренняя ошибка при выполнении команды.',
            flags: 64,
          });
        }
      } catch {
        // если уж совсем мимо — просто молчим в дискорде, лог уже есть
      }
    }
  },
};
