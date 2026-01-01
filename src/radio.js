const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus } = require('@discordjs/voice');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// --- KONFIGURASI ---
const RADIO_CHANNEL_ID = '1455761578178908170'; 
const LOFI_URL = 'https://stream-178.zeno.fm/f3wvbbqmdg8uv';

// --- FUNGSI RADIO ---
async function startRadio(guild) {
    const channel = guild.channels.cache.get(RADIO_CHANNEL_ID);
    if (!channel) return console.error("❌ Channel Radio tidak ditemukan!");

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play } // Tetap main walau gak ada orang
    });

    // Fungsi bikin stream baru (biar fresh)
    const playStream = () => {
        const resource = createAudioResource(LOFI_URL, { inlineVolume: true });
        resource.volume.setVolume(0.5); // Volume 50%
        player.play(resource);
    };

    playStream();
    connection.subscribe(player);

    console.log(`🎶 Radio 24/7 Berjalan di: ${channel.name}`);

    // --- HANDLING RECONNECT ---
    
    // 1. Kalau lagu berhenti (buffer habis), mainkan lagi
    player.on(AudioPlayerStatus.Idle, () => {
        console.log('🔄 Stream buffer refresh...');
        playStream();
    });

    // 2. Kalau ada error di player
    player.on('error', error => {
        console.error('⚠️ Player Error:', error.message);
        setTimeout(playStream, 5000); // Coba lagi dalam 5 detik
    });

    // 3. Kalau Bot Terputus dari VC (Koneksi DC)
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log("⚠️ Koneksi putus! Mencoba reconnect...");
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
            // Kalau berhasil reconnect, aman.
        } catch (error) {
            // Kalau gagal total, hancurkan koneksi dan mulai dari awal
            connection.destroy();
            startRadio(guild);
        }
    });
}

// --- JALANKAN SAAT BOT NYALA ---
client.once(Events.ClientReady, async () => {
    console.log(`📻 Radio System Online (${client.user.tag})`);
    
    // Cari Guild (Server) dimana channel itu berada
    const channel = client.channels.cache.get(RADIO_CHANNEL_ID);
    if (channel) {
        startRadio(channel.guild);
    } else {
        console.log("❌ Bot belum join server atau ID Channel salah.");
    }
});

client.login(process.env.RADIO_TOKEN);