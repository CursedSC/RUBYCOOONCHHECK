const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];

const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandItems = fs.readdirSync(commandsPath);
    
    for (const item of commandItems) {
        const itemPath = path.join(commandsPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
            const commandFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(itemPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`📁 Команда ${command.data.name} добавлена из папки ${item}`);
                }
            }
        } else if (item.endsWith('.js')) {
            const command = require(itemPath);
            
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
                console.log(`📄 Команда ${command.data.name} добавлена`);
            }
        }
    }
} else {
    console.log('⚠️ Папка commands не найдена');
}

// Создаем REST клиент
const rest = new REST().setToken(token);

// Регистрируем команды
(async () => {
    try {
        console.log(`🔄 Начинаю регистрацию ${commands.length} slash команд...`);

        // Для конкретного сервера (быстрая регистрация)
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`✅ Успешно зарегистрировано ${data.length} slash команд`);

    } catch (error) {
        console.error('❌ Ошибка при регистрации команд:', error);
    }
})();
