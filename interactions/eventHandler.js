const fs = require('node:fs');
const path = require('node:path');

class EventHandler {
    constructor(client) {
        this.client = client;
    }

    loadEvents() {
        const eventsPath = path.join(__dirname, '..', 'events');
        if (fs.existsSync(eventsPath)) {
            const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
            
            for (const file of eventFiles) {
                const filePath = path.join(eventsPath, file);
                try {
                    const event = require(filePath);
                    if (event.once) {
                        this.client.once(event.name, (...args) => event.execute(...args));
                    } else {
                        this.client.on(event.name, (...args) => event.execute(...args));
                    }
                    console.log(`✅ Событие ${event.name} загружено из ${file}`);
                } catch (error) {
                    console.error(`❌ Ошибка загрузки события ${filePath}:`, error);
                }
            }
        } else {
            console.log('⚠️ Папка events не найдена');
        }
    }
}

module.exports = EventHandler;
