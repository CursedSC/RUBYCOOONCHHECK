const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const Database = require('../database');

// Шахматные фигуры Unicode
const PIECES = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

// Буквы колонок
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

// Хранилище активных игр
const activeGames = new Map();

// Класс для шахматной доски
class ChessGame {
    constructor(whitePlayer, blackPlayer, isVsBot = false) {
        this.whitePlayer = whitePlayer;
        this.blackPlayer = blackPlayer;
        this.isVsBot = isVsBot;
        this.currentTurn = 'white';
        this.selectedPiece = null;
        this.validMoves = [];
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.winner = null;
        this.lastMove = null;
        
        // Инициализация доски
        this.board = this.initializeBoard();
    }
    
    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Расставляем черные фигуры
        board[0] = [
            { type: 'rook', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'rook', color: 'black' }
        ];
        board[1] = Array(8).fill(null).map(() => ({ type: 'pawn', color: 'black' }));
        
        // Расставляем белые фигуры
        board[6] = Array(8).fill(null).map(() => ({ type: 'pawn', color: 'white' }));
        board[7] = [
            { type: 'rook', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'rook', color: 'white' }
        ];
        
        return board;
    }
    
    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }
    
    setPiece(row, col, piece) {
        this.board[row][col] = piece;
    }
    
    // Получить все валидные ходы для фигуры
    getValidMoves(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece || piece.color !== this.currentTurn) return [];
        
        const moves = [];
        
        switch (piece.type) {
            case 'pawn':
                this.getPawnMoves(row, col, piece.color, moves);
                break;
            case 'rook':
                this.getRookMoves(row, col, piece.color, moves);
                break;
            case 'knight':
                this.getKnightMoves(row, col, piece.color, moves);
                break;
            case 'bishop':
                this.getBishopMoves(row, col, piece.color, moves);
                break;
            case 'queen':
                this.getRookMoves(row, col, piece.color, moves);
                this.getBishopMoves(row, col, piece.color, moves);
                break;
            case 'king':
                this.getKingMoves(row, col, piece.color, moves);
                break;
        }
        
        return moves;
    }
    
    getPawnMoves(row, col, color, moves) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        // Ход вперёд
        if (!this.getPiece(row + direction, col)) {
            moves.push({ row: row + direction, col });
            // Двойной ход с начальной позиции
            if (row === startRow && !this.getPiece(row + 2 * direction, col)) {
                moves.push({ row: row + 2 * direction, col });
            }
        }
        
        // Взятие по диагонали
        for (const dc of [-1, 1]) {
            const newCol = col + dc;
            const target = this.getPiece(row + direction, newCol);
            if (target && target.color !== color) {
                moves.push({ row: row + direction, col: newCol });
            }
        }
    }
    
    getRookMoves(row, col, color, moves) {
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;
                if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                
                const target = this.getPiece(newRow, newCol);
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else if (target.color !== color) {
                    moves.push({ row: newRow, col: newCol });
                    break;
                } else {
                    break;
                }
            }
        }
    }
    
    getKnightMoves(row, col, color, moves) {
        const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of offsets) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
                const target = this.getPiece(newRow, newCol);
                if (!target || target.color !== color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    }
    
    getBishopMoves(row, col, color, moves) {
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dr * i;
                const newCol = col + dc * i;
                if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) break;
                
                const target = this.getPiece(newRow, newCol);
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else if (target.color !== color) {
                    moves.push({ row: newRow, col: newCol });
                    break;
                } else {
                    break;
                }
            }
        }
    }
    
    getKingMoves(row, col, color, moves) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (newRow >= 0 && newRow <= 7 && newCol >= 0 && newCol <= 7) {
                    const target = this.getPiece(newRow, newCol);
                    if (!target || target.color !== color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }
    }
    
    // Сделать ход
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        const captured = this.getPiece(toRow, toCol);
        
        if (captured) {
            this.capturedPieces[piece.color].push(captured);
            
            // Проверка на мат (взятие короля)
            if (captured.type === 'king') {
                this.gameOver = true;
                this.winner = piece.color;
            }
        }
        
        // Превращение пешки
        if (piece.type === 'pawn') {
            if ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
                piece.type = 'queen';
            }
        }
        
        this.setPiece(toRow, toCol, piece);
        this.setPiece(fromRow, fromCol, null);
        
        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
        this.moveHistory.push({
            piece: piece.type,
            from: `${FILES[fromCol]}${RANKS[fromRow]}`,
            to: `${FILES[toCol]}${RANKS[toRow]}`,
            captured: captured?.type
        });
        
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        this.selectedPiece = null;
        this.validMoves = [];
    }
    
    // Ход бота (случайный ход)
    makeBotMove() {
        if (this.gameOver) return null;
        
        const allMoves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && piece.color === this.currentTurn) {
                    const moves = this.getValidMoves(row, col);
                    for (const move of moves) {
                        allMoves.push({ fromRow: row, fromCol: col, toRow: move.row, toCol: move.col });
                    }
                }
            }
        }
        
        if (allMoves.length === 0) {
            this.gameOver = true;
            this.winner = this.currentTurn === 'white' ? 'black' : 'white';
            return null;
        }
        
        // Простой AI: предпочитаем взятия и угрозы королю
        const captures = allMoves.filter(m => this.getPiece(m.toRow, m.toCol)?.type === 'king');
        if (captures.length > 0) {
            const move = captures[0];
            this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            return move;
        }
        
        const pieceCaptures = allMoves.filter(m => this.getPiece(m.toRow, m.toCol));
        if (pieceCaptures.length > 0 && Math.random() > 0.3) {
            const move = pieceCaptures[Math.floor(Math.random() * pieceCaptures.length)];
            this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            return move;
        }
        
        const move = allMoves[Math.floor(Math.random() * allMoves.length)];
        this.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        return move;
    }
    
    // Рендеринг доски
    renderBoard() {
        let boardStr = '';
        boardStr += '  ┌─────────────────┐\n';
        
        for (let row = 0; row < 8; row++) {
            boardStr += `${RANKS[row]} │`;
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                const isLight = (row + col) % 2 === 0;
                const isSelected = this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col;
                const isValidMove = this.validMoves.some(m => m.row === row && m.col === col);
                const isLastMove = this.lastMove && 
                    ((this.lastMove.from.row === row && this.lastMove.from.col === col) ||
                     (this.lastMove.to.row === row && this.lastMove.to.col === col));
                
                let cell;
                if (piece) {
                    cell = PIECES[piece.color][piece.type];
                } else if (isValidMove) {
                    cell = '•';
                } else {
                    cell = isLight ? '░' : '█';
                }
                
                if (isSelected) cell = `[${cell}]`.slice(0, 2);
                
                boardStr += ` ${cell}`;
            }
            boardStr += ' │\n';
        }
        
        boardStr += '  └─────────────────┘\n';
        boardStr += '    a b c d e f g h';
        
        return boardStr;
    }
    
    // Статус игры
    getStatus() {
        if (this.gameOver) {
            return `🏆 **${this.winner === 'white' ? 'Белые' : 'Чёрные'} победили!**`;
        }
        return `⏳ Ход: **${this.currentTurn === 'white' ? '⚪ Белые' : '⚫ Чёрные'}**`;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('шахматы')
        .setDescription('Играть в шахматы')
        .addSubcommand(sub =>
            sub.setName('бот')
                .setDescription('Играть против бота'))
        .addSubcommand(sub =>
            sub.setName('вызов')
                .setDescription('Вызвать игрока на партию')
                .addUserOption(opt =>
                    opt.setName('соперник')
                        .setDescription('Выберите соперника')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('сдаться')
                .setDescription('Сдаться в текущей партии')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const db = new Database();
        
        if (subcommand === 'бот') {
            return await this.startBotGame(interaction, db);
        } else if (subcommand === 'вызов') {
            return await this.challengePlayer(interaction, db);
        } else if (subcommand === 'сдаться') {
            return await this.surrender(interaction, db);
        }
    },
    
    async startBotGame(interaction, db) {
        const gameId = `chess_${interaction.user.id}_bot`;
        
        // Проверяем, нет ли уже активной игры
        if (activeGames.has(gameId)) {
            return await interaction.reply({
                content: '❌ У вас уже есть активная игра! Завершите её или сдайтесь.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const game = new ChessGame(interaction.user.id, 'BOT', true);
        activeGames.set(gameId, game);
        
        const embed = this.createGameEmbed(game, interaction.user, null);
        const components = this.createBoardButtons(game, interaction.user.id);
        
        await interaction.reply({
            embeds: [embed],
            components: components
        });
    },
    
    async challengePlayer(interaction, db) {
        const opponent = interaction.options.getUser('соперник');
        
        if (opponent.id === interaction.user.id) {
            return await interaction.reply({
                content: '❌ Вы не можете играть сами с собой!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        if (opponent.bot) {
            return await interaction.reply({
                content: '❌ Используйте `/шахматы бот` для игры против бота!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('♟️ Шахматный вызов!')
            .setDescription(`${interaction.user} вызывает ${opponent} на партию в шахматы!`)
            .setColor(0x8B4513)
            .setFooter({ text: 'У соперника есть 60 секунд на ответ' })
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`chess_accept_${interaction.user.id}_${opponent.id}`)
                .setLabel('Принять')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`chess_decline_${interaction.user.id}_${opponent.id}`)
                .setLabel('Отклонить')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );
        
        await interaction.reply({
            content: `${opponent}`,
            embeds: [embed],
            components: [row]
        });
    },
    
    async surrender(interaction, db) {
        // Ищем игру пользователя
        let gameId = null;
        for (const [id, game] of activeGames.entries()) {
            if (game.whitePlayer === interaction.user.id || game.blackPlayer === interaction.user.id) {
                gameId = id;
                break;
            }
        }
        
        if (!gameId) {
            return await interaction.reply({
                content: '❌ У вас нет активной игры!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const game = activeGames.get(gameId);
        const isWhite = game.whitePlayer === interaction.user.id;
        game.gameOver = true;
        game.winner = isWhite ? 'black' : 'white';
        
        const embed = new EmbedBuilder()
            .setTitle('🏳️ Сдача!')
            .setDescription(`${interaction.user} сдался!\n\n🏆 **${game.winner === 'white' ? 'Белые' : 'Чёрные'}** победили!`)
            .setColor(0x8B4513)
            .setTimestamp();
        
        activeGames.delete(gameId);
        
        await interaction.reply({ embeds: [embed] });
    },
    
    createGameEmbed(game, whiteUser, blackUser) {
        const embed = new EmbedBuilder()
            .setTitle('♟️ Шахматы')
            .setDescription(`\`\`\`\n${game.renderBoard()}\n\`\`\``)
            .setColor(game.currentTurn === 'white' ? 0xFFFFFF : 0x000000)
            .addFields(
                { name: '⚪ Белые', value: `<@${game.whitePlayer}>`, inline: true },
                { name: '⚫ Чёрные', value: game.isVsBot ? '🤖 Бот' : `<@${game.blackPlayer}>`, inline: true },
                { name: '📊 Статус', value: game.getStatus(), inline: false }
            )
            .setFooter({ text: 'Выберите клетку для хода' })
            .setTimestamp();
        
        if (game.capturedPieces.white.length > 0) {
            embed.addFields({
                name: '⚪ Съедены белыми',
                value: game.capturedPieces.white.map(p => PIECES.black[p.type]).join(' '),
                inline: true
            });
        }
        
        if (game.capturedPieces.black.length > 0) {
            embed.addFields({
                name: '⚫ Съедены чёрными',
                value: game.capturedPieces.black.map(p => PIECES.white[p.type]).join(' '),
                inline: true
            });
        }
        
        if (game.moveHistory.length > 0) {
            const lastMoves = game.moveHistory.slice(-5).map((m, i) => 
                `${game.moveHistory.length - 4 + i}. ${m.from}→${m.to}${m.captured ? ' ×' : ''}`
            ).join('\n');
            embed.addFields({ name: '📜 Последние ходы', value: lastMoves, inline: false });
        }
        
        return embed;
    },
    
    createBoardButtons(game, playerId) {
        const rows = [];
        
        // Создаём кнопки для выбора клеток (упрощённо - SelectMenu для колонок и рядов)
        const colSelect = new StringSelectMenuBuilder()
            .setCustomId(`chess_col_${playerId}`)
            .setPlaceholder('Выберите колонку (a-h)')
            .addOptions(
                FILES.map((f, i) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(f.toUpperCase())
                        .setValue(String(i))
                )
            );
        
        const rowSelect = new StringSelectMenuBuilder()
            .setCustomId(`chess_row_${playerId}`)
            .setPlaceholder('Выберите ряд (1-8)')
            .addOptions(
                RANKS.map((r, i) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(r)
                        .setValue(String(i))
                )
            );
        
        rows.push(new ActionRowBuilder().addComponents(colSelect));
        rows.push(new ActionRowBuilder().addComponents(rowSelect));
        
        // Кнопки действий
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`chess_confirm_${playerId}`)
                .setLabel('Подтвердить выбор')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`chess_cancel_${playerId}`)
                .setLabel('Отменить')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️'),
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

// Экспортируем для обработчика кнопок
module.exports.activeGames = activeGames;
module.exports.ChessGame = ChessGame;

