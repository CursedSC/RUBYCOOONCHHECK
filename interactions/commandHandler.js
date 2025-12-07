const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

class CommandHandler {
    constructor(client) {
        this.client = client;
        this.client.commands = new Collection();
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        if (fs.existsSync(commandsPath)) {
            const commandItems = fs.readdirSync(commandsPath);
            
            for (const item of commandItems) {
                const itemPath = path.join(commandsPath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    const commandFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
                    for (const file of commandFiles) {
                        const filePath = path.join(itemPath, file);
                        this.loadCommand(filePath, item);
                    }
                } else if (item.endsWith('.js')) {
                    this.loadCommand(itemPath);
                }
            }
        } else {
            console.log('⚠️ Папка commands не найдена');
        }
    }

    loadCommand(filePath, folder = null) {
        try {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                this.client.commands.set(command.data.name, command);
                const folderInfo = folder ? ` из папки ${folder}` : '';
                console.log(`✅ Команда ${command.data.name} загружена${folderInfo}`);
            } else {
                console.log(`⚠️ Команда в ${filePath} не имеет обязательных свойств "data" или "execute"`);
            }
        } catch (error) {
            console.error(`❌ Ошибка загрузки команды ${filePath}:`, error);
        }
    }
}

module.exports = CommandHandler;
