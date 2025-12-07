const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('донат')
        .setDescription('🛒 Донат товары за RubyCoins'),

    async execute(interaction) {
        const Database = require('../database.js');
        const db = new Database();

        try {
            const userBalance = await db.getUserRubyCoins(interaction.user.id);

            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Донат RubyCoins')
                .setDescription(`💰 **Ваш баланс:** ${userBalance.toFixed(2)} RubyCoins\n\n📦 Выберите товар из списка ниже:`)
                .setColor(0x9932CC)
                .addFields(
                    {
                        name: '✨ Набор Искр',
                        value: '**💰 Цена:** 20.0 RubyCoins',
                        inline: false
                    },
                    {
                        name: 'РАЗРАБОТКА - 👁️ Ролл Глаз',
                        value: '**💰 Цена:** 105.0 RubyCoins',
                        inline: false
                    },
                    {
                        name: 'РАЗРАБОТКА - 📜 Контракт с Демоном',
                        value: '**💰 Цена:** 205.0 RubyCoins',
                        inline: false
                    }
                )
                .setFooter({ text: 'Выберите товар в меню ниже для покупки • Все покупки логируются' })
                .setTimestamp();

            const shopSelect = new StringSelectMenuBuilder()
                .setCustomId(`shop_select_${interaction.user.id}`)
                .setPlaceholder('🛒 Выберите товар для покупки...')
                .addOptions([
                    {
                        label: '✨ Набор Искр',
                        description: 'Крутки с искрами (20.0 RubyCoins)',
                        value: 'spark_pack',
                        emoji: '✨'
                    },
                    {
                        label: 'РАЗРАБОТКА - 👁️ Ролл Глаз',
                        description: 'Получить глаза (15.0 RubyCoins)',
                        value: 'eyes_roll',
                        emoji: '👁️'
                    },
                    {
                        label: 'РАЗРАБОТКА - 📜 Контракт с Демоном',
                        description: 'Заключите контракт с демоном (25.0 RubyCoins)',
                        value: 'demon_contract',
                        emoji: '📜'
                    }
                ]);

            const row = new ActionRowBuilder().addComponents(shopSelect);

            await interaction.reply({
                embeds: [shopEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('Ошибка команды shop:', error);
            await interaction.reply({
                content: '❌ Произошла ошибка при загрузке Доната!',
                ephemeral: true
            });
        }
    }
};
