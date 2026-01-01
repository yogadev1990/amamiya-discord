require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// 1. Setup Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Wajib agar bisa baca chat
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
});

// 2. Koleksi Command (Wadah untuk menyimpan perintah)
client.commands = new Collection();

// 3. LOAD COMMANDS (Membaca folder src/commands)
const foldersPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Simpan command ke dalam koleksi
        if ('name' in command && 'execute' in command) {
            client.commands.set(command.name, command);
        } else {
            console.log(`[WARNING] Command di ${filePath} tidak punya properti 'name' atau 'execute'.`);
        }
    }
}

// 4. LOAD EVENTS (Membaca folder src/events)
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            // Opsi tambahan agar koneksi stabil di network Indo
            family: 4, // Paksa pakai IPv4 (IPv6 sering bermasalah)
        });
        console.log('🍃 Terhubung ke MongoDB Atlas!');
    } catch (error) {
        console.error('❌ Gagal connect MongoDB:', error.message);
    }
})();

// 5. Login
client.login(process.env.DISCORD_TOKEN);