const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const RubyCoinLogViewer = require('../utils/rubycoin-log-viewer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rubycoin-logs')
        .setDescription('📊 Просмотр истории рубикоинов')
        .addSubcommand(subcommand =>
            subcommand
                .setName('my')
                .setDescription('🔍 Моя история транзакций')
                .addIntegerOption(option =>
                    option
                        .setName('page')
                        .setDescription('Страница (по умолчанию 1)')
                        .setMinValue(1)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('🔍 История транзакций пользователя')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('Пользователь')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('page')
                        .setDescription('Страница (по умолчанию 1)')
                        .setMinValue(1)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('📈 Статистика по рубикоинам')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Пользователь (по умолчанию вы)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('spending')
                .setDescription('💸 Анализ трат по категориям')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Пользователь (по умолчанию вы)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('top')
                .setDescription('🏆 Топ пользователей')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Тип рейтинга')
                        .addChoices(
                            { name: '💰 Топ заработавших', value: 'earners' },
                            { name: '💸 Топ потративших', value: 'spenders' }
                        )
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Количество пользователей')
                        .setMinValue(5)
                        .setMaxValue(25)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('recent')
                .setDescription('⏱️ Последние транзакции сервера')
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Количество транзакций (макс 25)')
                        .setMinValue(5)
                        .setMaxValue(25)
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const logger = interaction.client.rubyCoinLogger;
        const viewer = new RubyCoinLogViewer(interaction.client, logger);

        if (!logger) {
            return interaction.reply({
                content: '❌ Система логирования рубикоинов недоступна!',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply();

            switch (subcommand) {
                case 'my': {
                    const page = interaction.options.getInteger('page') || 1;
                    const embed = await viewer.createUserHistoryEmbed(
                        interaction.user.id,
                        interaction.user,
                        page
                    );
                    
                    const components = await viewer.createPaginationButtons(
                        interaction.user.id,
                        page,
                        'my'
                    );

                    await interaction.editReply({ embeds: [embed], components });
                    break;
                }

                case 'user': {
                    const targetUser = interaction.options.getUser('target');
                    const page = interaction.options.getInteger('page') || 1;
                    
                    const embed = await viewer.createUserHistoryEmbed(
                        targetUser.id,
                        targetUser,
                        page
                    );
                    
                    const components = await viewer.createPaginationButtons(
                        targetUser.id,
                        page,
                        'user'
                    );

                    await interaction.editReply({ embeds: [embed], components });
                    break;
                }

                case 'stats': {
                    const targetUser = interaction.options.getUser('user') || interaction.user;
                    const embed = await viewer.createStatsEmbed(targetUser.id, targetUser);
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'spending': {
                    const targetUser = interaction.options.getUser('user') || interaction.user;
                    const embed = await viewer.createSpendingAnalysisEmbed(targetUser.id, targetUser);
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'top': {
                    const type = interaction.options.getString('type');
                    const limit = interaction.options.getInteger('limit') || 10;
                    const embed = await viewer.createTopUsersEmbed(
                        type,
                        limit,
                        interaction.guild.id
                    );
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'recent': {
                    const limit = interaction.options.getInteger('limit') || 10;
                    const embed = await viewer.createRecentTransactionsEmbed(
                        limit,
                        interaction.guild.id
                    );
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('Ошибка в команде rubycoin-logs:', error);
            const errorMessage = {
                content: '❌ Произошла ошибка при получении данных!',
                ephemeral: true
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};
