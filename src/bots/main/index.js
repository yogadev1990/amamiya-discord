const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function startMainBot(io) {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates
        ],
    });

    client.io = io;
    client.commands = new Collection();

    // Load Commands
    const foldersPath = path.join(__dirname, '../../commands');
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if (command.data && command.execute) {
                    client.commands.set(command.data.name, command);
                } else if (command.name && command.execute) {
                    client.commands.set(command.name, command);
                }
            } catch (error) {
                console.error(`[ERROR] Gagal memuat command di ${filePath}:`, error.message);
            }
        }
    }

    // Load Events
    const eventsPath = path.join(__dirname, '../../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const event = require(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        } catch (error) {
            console.error(`[ERROR] Gagal memuat event di ${filePath}:`, error.message);
        }
    }

    await client.login(process.env.DISCORD_TOKEN);
    console.log('🤖 Main Bot is online!');
    return client;
}

module.exports = { startMainBot };
