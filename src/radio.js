const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// --- KONFIGURASI ---
const RADIO_CHANNEL_ID = '1455761578178908170'; 

// PERBAIKAN 1: Gunakan HTTP (bukan HTTPS) dan subdomain langsung biar stabil
const LOFI_URL = 'http://stream-178.zeno.fm/f3wvbbqmdg8uv';

async function startRadio(guild) {
    const channel = guild.channels.cache.get(RADIO_CHANNEL_ID);
    if (!channel) return console.error("❌ Channel Radio tidak ditemukan!");

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false, // Biar bot dianggap aktif mendengarkan
    });

    const player = createAudioPlayer({
        behaviors: { 
            noSubscriber: NoSubscriberBehavior.Play,
            maxMissedFrames: 250 // Toleransi lag lebih tinggi (Penting buat VPS)
        } 
    });

    const playStream = () => {
        try {
            console.log('🔄 Mengambil audio stream...');
            
            // PERBAIKAN 2: Matikan Inline Volume (Set ke false)
            // Biarkan suara RAW mengalir biar HP gak putus-putus
            const resource = createAudioResource(LOFI_URL, { 
                inlineVolume: false 
            });
            
            player.play(resource);
        } catch (e) {
            console.error("Gagal play stream:", e);
            setTimeout(playStream, 5000); // Coba lagi nanti kalau error
        }
    };

    playStream();
    connection.subscribe(player);

    console.log(`🎶 Radio 24/7 Berjalan di: ${channel.name}`);

    // --- EVENT LISTENER ---

    // Tambahan: Log kalau berhasil nyanyi
    player.on(AudioPlayerStatus.Playing, () => {
        console.log('▶️  Radio sedang memutar lagu!');
    });

    // PERBAIKAN 3: Kasih Jeda Waktu saat Reconnect (Anti-Loop)
    player.on(AudioPlayerStatus.Idle, () => {
        console.log('⚠️ Buffer habis/Stream putus. Reconnect dalam 5 detik...');
        setTimeout(() => {
            playStream();
        }, 5000); // JEDA 5 DETIK (Wajib!)
    });

    player.on('error', error => {
        console.error('⚠️ Player Error:', error.message);
        // Gak perlu panggil playStream disini, karena habis error dia bakal ke state IDLE otomatis
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch (error) {
            console.log("🔌 Koneksi putus total. Restarting radio system...");
            connection.destroy();
            setTimeout(() => startRadio(guild), 10000); // Tunggu 10 detik biar gak spam join/leave
        }
    });
}

client.once(Events.ClientReady, async () => {
    console.log(`📻 Radio System Online (${client.user.tag})`);
    const channel = client.channels.cache.get(RADIO_CHANNEL_ID);
    if (channel) startRadio(channel.guild);
});

// Anti Crash biar bot utama gak ikut mati kalau radio error
process.on('uncaughtException', (err) => console.log('Radio Error Handler:', err.message));

client.login(process.env.RADIO_TOKEN);