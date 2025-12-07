const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { activeGames, ChessGame } = require('../commands/chess');

const PIECES = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Временное хранилище для выбора клеток
const playerSelections = new Map();

module.exports = {
    name: 'chessInteraction',
    
    canHandle(interaction) {
        if (interaction.isButton()) {
            return interaction.customId.startsWith('chess_');
        }
        if (interaction.isStringSelectMenu()) {
            return interaction.customId.startsWith('chess_');
        }
        return false;
    },
    
    async execute(interaction) {
        try {
            if (interaction.isButton()) {
                await this.handleButton(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelect(interaction);
            }
        } catch (error) {
            console.error('Ошибка в шахматном обработчике:', error);
            try {
                await interaction.reply({
                    content: '❌ Произошла ошибка!',
                    flags: MessageFlags.Ephemeral
                });
            } catch {}
        }
    },
    
    async handleButton(interaction) {
        const [, action, ...params] = interaction.customId.split('_');
        
        switch (action) {
            case 'accept':
                await this.acceptChallenge(interaction, params);
                break;
            case 'decline':
                await this.declineChallenge(interaction, params);
                break;
            case 'confirm':
                await this.confirmMove(interaction, params[0]);
                break;
            case 'cancel':
                await this.cancelSelection(interaction, params[0]);
                break;
            case 'surrender':
                await this.surrenderGame(interaction, params[0]);
                break;
        }
    },
    
    async handleSelect(interaction) {
        const [, type, playerId] = interaction.customId.split('_');
        
        if (interaction.user.id !== playerId) {
            return await interaction.reply({
                content: '❌ Это не ваша игра!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const selection = playerSelections.get(playerId) || { col: null, row: null };
        
        if (type === 'col') {
            selection.col = parseInt(interaction.values[0]);
        } else if (type === 'row') {
            selection.row = parseInt(interaction.values[0]);
        }
        
        playerSelections.set(playerId, selection);
        
        await interaction.deferUpdate();
    },
    
    async acceptChallenge(interaction, params) {
        const [challengerId, opponentId] = params;
        
        if (interaction.user.id !== opponentId) {
            return await interaction.reply({
                content: '❌ Этот вызов не для вас!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const gameId = `chess_${challengerId}_${opponentId}`;
        
        if (activeGames.has(gameId)) {
            return await interaction.reply({
                content: '❌ Игра уже началась!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Случайно определяем цвета
        const isWhite = Math.random() > 0.5;
        const whitePlayer = isWhite ? challengerId : opponentId;
        const blackPlayer = isWhite ? opponentId : challengerId;
        
        const game = new ChessGame(whitePlayer, blackPlayer, false);
        activeGames.set(gameId, game);
        
        const embed = this.createGameEmbed(game);
        const components = this.createBoardButtons(game, whitePlayer);
        
        await interaction.update({
            content: null,
            embeds: [embed],
            components: components
        });
    },
    
    async declineChallenge(interaction, params) {
        const [challengerId, opponentId] = params;
        
        if (interaction.user.id !== opponentId) {
            return await interaction.reply({
                content: '❌ Этот вызов не для вас!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('❌ Вызов отклонён')
            .setDescription(`${interaction.user} отклонил вызов на шахматную партию.`)
            .setColor(0xFF0000)
            .setTimestamp();
        
        await interaction.update({
            content: null,
            embeds: [embed],
            components: []
        });
    },
    
    async confirmMove(interaction, playerId) {
        if (interaction.user.id !== playerId) {
            return await interaction.reply({
                content: '❌ Это не ваша игра!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const selection = playerSelections.get(playerId);
        if (!selection || selection.col === null || selection.row === null) {
            return await interaction.reply({
                content: '❌ Сначала выберите колонку и ряд!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Находим игру
        let game = null;
        let gameId = null;
        for (const [id, g] of activeGames.entries()) {
            if (g.whitePlayer === playerId || g.blackPlayer === playerId) {
                game = g;
                gameId = id;
                break;
            }
        }
        
        if (!game) {
            return await interaction.reply({
                content: '❌ Игра не найдена!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Проверяем, ходит ли этот игрок
        const isWhite = game.whitePlayer === playerId;
        const playerColor = isWhite ? 'white' : 'black';
        
        if (game.currentTurn !== playerColor) {
            return await interaction.reply({
                content: '❌ Сейчас не ваш ход!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const { row, col } = selection;
        
        // Если фигура не выбрана - выбираем
        if (!game.selectedPiece) {
            const piece = game.getPiece(row, col);
            if (!piece || piece.color !== playerColor) {
                return await interaction.reply({
                    content: '❌ Выберите свою фигуру!',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            const validMoves = game.getValidMoves(row, col);
            if (validMoves.length === 0) {
                return await interaction.reply({
                    content: '❌ У этой фигуры нет доступных ходов!',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            game.selectedPiece = { row, col };
            game.validMoves = validMoves;
            
            // Очищаем выбор
            playerSelections.delete(playerId);
            
            const embed = this.createGameEmbed(game);
            embed.setDescription(`\`\`\`\n${game.renderBoard()}\n\`\`\`\n📍 Выбрана фигура на ${FILES[col]}${RANKS[row]}. Выберите клетку для хода.`);
            
            await interaction.update({
                embeds: [embed],
                components: this.createBoardButtons(game, playerId)
            });
        } else {
            // Делаем ход
            const isValidMove = game.validMoves.some(m => m.row === row && m.col === col);
            
            if (!isValidMove) {
                return await interaction.reply({
                    content: '❌ Недопустимый ход! Выберите отмеченную клетку.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            game.makeMove(game.selectedPiece.row, game.selectedPiece.col, row, col);
            
            // Очищаем выбор
            playerSelections.delete(playerId);
            
            // Если игра против бота - бот ходит
            if (game.isVsBot && !game.gameOver) {
                game.makeBotMove();
            }
            
            // Проверяем окончание игры
            if (game.gameOver) {
                const embed = this.createGameEmbed(game);
                embed.setTitle('🏆 Игра окончена!');
                
                activeGames.delete(gameId);
                playerSelections.delete(playerId);
                
                await interaction.update({
                    embeds: [embed],
                    components: []
                });
                return;
            }
            
            // Определяем следующего игрока
            const nextPlayerId = game.currentTurn === 'white' ? game.whitePlayer : game.blackPlayer;
            
            const embed = this.createGameEmbed(game);
            const components = this.createBoardButtons(game, nextPlayerId === 'BOT' ? game.whitePlayer : nextPlayerId);
            
            await interaction.update({
                embeds: [embed],
                components: components
            });
        }
    },
    
    async cancelSelection(interaction, playerId) {
        if (interaction.user.id !== playerId) {
            return await interaction.reply({
                content: '❌ Это не ваша игра!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Находим игру
        let game = null;
        for (const [id, g] of activeGames.entries()) {
            if (g.whitePlayer === playerId || g.blackPlayer === playerId) {
                game = g;
                break;
            }
        }
        
        if (!game) {
            return await interaction.reply({
                content: '❌ Игра не найдена!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        game.selectedPiece = null;
        game.validMoves = [];
        playerSelections.delete(playerId);
        
        const embed = this.createGameEmbed(game);
        
        await interaction.update({
            embeds: [embed],
            components: this.createBoardButtons(game, playerId)
        });
    },
    
    async surrenderGame(interaction, playerId) {
        if (interaction.user.id !== playerId) {
            return await interaction.reply({
                content: '❌ Это не ваша игра!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Находим игру
        let game = null;
        let gameId = null;
        for (const [id, g] of activeGames.entries()) {
            if (g.whitePlayer === playerId || g.blackPlayer === playerId) {
                game = g;
                gameId = id;
                break;
            }
        }
        
        if (!game) {
            return await interaction.reply({
                content: '❌ Игра не найдена!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const isWhite = game.whitePlayer === playerId;
        game.gameOver = true;
        game.winner = isWhite ? 'black' : 'white';
        
        const embed = new EmbedBuilder()
            .setTitle('🏳️ Сдача!')
            .setDescription(`<@${playerId}> сдался!\n\n🏆 **${game.winner === 'white' ? '⚪ Белые' : '⚫ Чёрные'}** победили!`)
            .setColor(0x8B4513)
            .setTimestamp();
        
        activeGames.delete(gameId);
        playerSelections.delete(playerId);
        
        await interaction.update({
            embeds: [embed],
            components: []
        });
    },
    
    createGameEmbed(game) {
        const embed = new EmbedBuilder()
            .setTitle('♟️ Шахматы')
            .setDescription(`\`\`\`\n${game.renderBoard()}\n\`\`\``)
            .setColor(game.currentTurn === 'white' ? 0xEEEEEE : 0x333333)
            .addFields(
                { name: '⚪ Белые', value: `<@${game.whitePlayer}>`, inline: true },
                { name: '⚫ Чёрные', value: game.isVsBot ? '🤖 Бот' : `<@${game.blackPlayer}>`, inline: true },
                { name: '📊 Статус', value: game.getStatus(), inline: false }
            )
            .setTimestamp();
        
        if (game.capturedPieces.white.length > 0) {
            embed.addFields({
                name: '⚪ Взяты',
                value: game.capturedPieces.white.map(p => PIECES.black[p.type]).join(' '),
                inline: true
            });
        }
        
        if (game.capturedPieces.black.length > 0) {
            embed.addFields({
                name: '⚫ Взяты',
                value: game.capturedPieces.black.map(p => PIECES.white[p.type]).join(' '),
                inline: true
            });
        }
        
        if (game.moveHistory.length > 0) {
            const lastMoves = game.moveHistory.slice(-3).map((m, i) => 
                `${m.from}→${m.to}${m.captured ? ' ×' : ''}`
            ).join(' | ');
            embed.setFooter({ text: `Последние ходы: ${lastMoves}` });
        }
        
        return embed;
    },
    
    createBoardButtons(game, playerId) {
        const rows = [];
        
        const colSelect = new StringSelectMenuBuilder()
            .setCustomId(`chess_col_${playerId}`)
            .setPlaceholder('📍 Колонка (a-h)')
            .addOptions(
                FILES.map((f, i) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(f.toUpperCase())
                        .setDescription(`Колонка ${f}`)
                        .setValue(String(i))
                )
            );
        
        const rowSelect = new StringSelectMenuBuilder()
            .setCustomId(`chess_row_${playerId}`)
            .setPlaceholder('📍 Ряд (1-8)')
            .addOptions(
                RANKS.map((r, i) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(r)
                        .setDescription(`Ряд ${r}`)
                        .setValue(String(i))
                )
            );
        
        rows.push(new ActionRowBuilder().addComponents(colSelect));
        rows.push(new ActionRowBuilder().addComponents(rowSelect));
        
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`chess_confirm_${playerId}`)
                .setLabel(game.selectedPiece ? 'Сделать ход' : 'Выбрать фигуру')
                .setStyle(ButtonStyle.Success)
                .setEmoji(game.selectedPiece ? '♟️' : '👆'),
            new ButtonBuilder()
                .setCustomId(`chess_cancel_${playerId}`)
                .setLabel('Отменить выбор')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
                .setDisabled(!game.selectedPiece),
            new ButtonBuilder()
                .setCustomId(`chess_surrender_${playerId}`)
                .setLabel('Сдаться')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🏳️')
        );
        rows.push(actionRow);
        
        return rows;
    }
};

