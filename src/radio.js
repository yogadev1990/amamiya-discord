const { Client, GatewayIntentBits, Events } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const prism = require('prism-media');
const playdl = require('play-dl');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
/* =======================
   SISTEM ANTI-BLOKIR YOUTUBE
======================= */
let ytCookieString = "";
try {
    // Membaca file Netscape mentah
    const cookieRaw = fs.readFileSync(path.join(__dirname, '../www.youtube.com_cookies.txt'), 'utf8');
    const lines = cookieRaw.split('\n');
    const cookieArray = [];
    
    // Looping untuk mengambil nama cookie (kolom 6) dan isinya (kolom 7)
    for (const line of lines) {
        if (line.trim().startsWith('#') || line.trim() === '') continue;
        const parts = line.split('\t');
        if (parts.length >= 7) {
            cookieArray.push(`${parts[5]}=${parts[6].trim()}`);
        }
    }
    
    // Gabungkan menjadi satu string panjang
    ytCookieString = cookieArray.join('; ');

    // Suntikkan ke play-dl
    if (ytCookieString) {
        playdl.setToken({
            youtube: { cookie: ytCookieString }
        }).then(() => console.log('✅ [ANTI-BOT] Cookie YouTube berhasil disuntikkan!'));
    }
} catch (error) {
    console.log('⚠️ [ANTI-BOT] File youtube-cookies.txt tidak ditemukan. Bot berisiko diblokir YouTube.');
}
/* =======================
   KONEKSI DATABASE
======================= */
// Karena menggunakan host network di Docker, gunakan 127.0.0.1
const MONGO_URI = process.env.MONGO_URI || 'mongodb://revanda1990:Yogaart1990@127.0.0.1:27017/?authSource=admin';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ [DB] Radio Bot terhubung ke MongoDB'))
    .catch(err => console.error('❌ [DB] Radio Bot GAGAL terhubung ke MongoDB:', err.message));


/* =======================
   KONFIGURASI UTAMA
======================= */
const RADIO_CHANNEL_ID = '1455761578178908170';
const DEFAULT_RADIO_URL = 'http://stream-178.zeno.fm/f3wvbbqmdg8uv';

/* =======================
   STATE MANAGEMENT (RAM)
======================= */
const queue = []; // Antrean lagu custom
let currentMode = 'RADIO'; // 'RADIO' atau 'CUSTOM'
let ffmpegProcess = null; // Menyimpan proses FFmpeg Zeno.fm
const player = createAudioPlayer(); // Player global untuk channel ini

/* =======================
   DISCORD CLIENT
======================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
    ],
});

/* =======================
   ENGINE AUDIO DUAL MODE
======================= */

// 1. Fungsi Memutar Radio 24/7 (Zeno.fm)
function playZenoRadio() {
    currentMode = 'RADIO';
    console.log("📻 [MODE RADIO] Memulai stream Zeno.fm...");

    // Bersihkan FFmpeg lama jika ada
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
        ffmpegProcess = null;
    }

    const args = [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept: */*\r\nConnection: keep-alive\r\n',
        '-i', DEFAULT_RADIO_URL,
        '-vn',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-bufsize', '64k',
        'pipe:1',
    ];

    ffmpegProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] });

    ffmpegProcess.on('error', (err) => {
        console.error('❌ [FFMPEG ERROR]:', err.message);
    });

    ffmpegProcess.on('close', (code) => {
        if (code !== 0 && code !== null) console.log(`⚠️ FFmpeg Zeno berhenti dengan code ${code}`);
    });

    const prismStream = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
    ffmpegProcess.stdout.pipe(prismStream);

    const resource = createAudioResource(prismStream, { inputType: StreamType.Opus });
    player.play(resource);
}

// 2. Fungsi Memutar Custom Music dari Queue
async function playNextCustom() {
    if (queue.length === 0) {
        console.log("⚠️ [QUEUE KOSONG] Kembali ke Radio 24/7 Fallback...");
        return playZenoRadio(); // FALLBACK KE RADIO JIKA ANTREAN HABIS
    }

    currentMode = 'CUSTOM';
    const track = queue.shift(); // Ambil lagu urutan pertama

    // Matikan radio jika masih menyala
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
        ffmpegProcess = null;
    }

    try {
        console.log(`🎵 [MODE CUSTOM] Mengekstrak: ${track.url}`);
        const stream = await playdl.stream(track.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        
        player.play(resource);
        console.log(`▶️ Sedang memutar: ${track.title}`);
    } catch (error) {
        console.error(`❌ [PLAY-DL ERROR] Gagal memutar lagu:`, error.message);
        // Jika error/lagu dihapus YouTube, skip ke lagu berikutnya
        playNextCustom(); 
    }
}

/* =======================
   LISTENER PLAYER & KONEKSI
======================= */
player.on(AudioPlayerStatus.Idle, () => {
    console.log(`⏳ Audio Idle. Mode sebelumnya: ${currentMode}`);
    
    if (currentMode === 'CUSTOM') {
        // Jika mode custom selesai, cek antrean lagi
        playNextCustom();
    } else {
        // Jika radio putus tiba-tiba, restart radio
        setTimeout(playZenoRadio, 5000);
    }
});

player.on('error', error => {
    console.error('❌ AudioPlayer Error:', error.message);
    if (currentMode === 'CUSTOM') playNextCustom();
    else setTimeout(playZenoRadio, 5000);
});

async function startConnection(guild) {
    const channel = guild.channels.cache.get(RADIO_CHANNEL_ID);
    if (!channel || channel.type !== 2) return console.error('❌ Voice channel tidak ditemukan');

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch {
            connection.destroy();
            console.log("🔌 Koneksi putus, reconnecting in 8s...");
            setTimeout(() => startConnection(guild), 8000);
        }
    });

    // Mulai radio saat pertama kali join
    playZenoRadio();
}

/* =======================
   LISTENER PERINTAH (COMMANDS)
======================= */
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- COMMAND: /play ---
    if (commandName === 'play') {
        const query = interaction.options.getString('lagu');
        await interaction.deferReply();

        try {
            // Cari lagu di YouTube
            const searchResult = await playdl.search(query, { limit: 1 });
            if (!searchResult || searchResult.length === 0) {
                return interaction.editReply('❌ Lagu tidak ditemukan.');
            }

            const track = searchResult[0];
            
            // Masukkan ke memori antrean
            queue.push({
                title: track.title,
                url: track.url,
                duration: track.durationRaw
            });

            interaction.editReply(`✅ Ditambahkan ke antrean: **${track.title}** (${track.durationRaw})`);

            // Jika bot sedang memutar Radio, hentikan dan langsung mainkan lagu custom
            if (currentMode === 'RADIO') {
                playNextCustom();
            }

        } catch (error) {
            console.error(error);
            interaction.editReply('❌ Terjadi kesalahan saat memproses pencarian lagu.');
        }
    }

    // --- COMMAND: /skip ---
    if (commandName === 'skip') {
        if (currentMode === 'RADIO') {
            return interaction.reply({ content: '⚠️ Bot sedang dalam mode Radio 24/7. Tidak ada yang bisa di-skip.', ephemeral: true });
        }

        interaction.reply('⏭️ Melewati lagu saat ini...');
        player.stop(); // Ini akan memicu event AudioPlayerStatus.Idle secara otomatis
    }
});

/* =======================
   READY EVENT
======================= */
client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user.tag} (RADIO BOT)`);
    
    const channel = client.channels.cache.get(RADIO_CHANNEL_ID);
    if (channel) startConnection(channel.guild);

    // Register Slash Commands Global Khusus Radio Bot (Hanya berjalan sekali saat bot nyala)
    // Pastikan bot utamamu tidak memiliki command bernama 'play' dan 'skip' agar tidak bentrok.
    await client.application.commands.set([
        {
            name: 'play',
            description: 'Putar lagu dari YouTube',
            options: [{ type: 3, name: 'lagu', description: 'Judul atau URL YouTube', required: true }]
        },
        {
            name: 'skip',
            description: 'Lewati lagu custom yang sedang diputar'
        }
    ]);
    console.log("✅ Commands /play & /skip berhasil didaftarkan.");
});

client.login(process.env.RADIO_TOKEN);