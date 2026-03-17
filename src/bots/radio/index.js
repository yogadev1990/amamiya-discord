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
const User = require('../../shared/models/User');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
/* =======================
   SISTEM ANTI-BLOKIR YOUTUBE
======================= */
async function getYouTubeStream(url) {
    return new Promise((resolve, reject) => {

const ytdlp = spawn('yt-dlp', [
'-f', 'bestaudio/best',
'--no-playlist',
'--cookies', '/app/www.youtube.com_cookies.txt',
'--js-runtimes', 'node',
'-o', '-',
url
]);

        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ]);

        ytdlp.stdout.pipe(ffmpeg.stdin);

        const encoder = new prism.opus.Encoder({
            rate: 48000,
            channels: 2,
            frameSize: 960
        });

        ffmpeg.stdout.pipe(encoder);

        ytdlp.stderr.on('data', d => console.log("[YTDLP]", d.toString()));
        ffmpeg.stderr.on('data', d => console.log("[FFMPEG]", d.toString()));

        ytdlp.on('error', reject);
        ffmpeg.on('error', reject);

        resolve(encoder);
    });
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
let currentTrack = null; // <--- BARU: Menyimpan lagu yang SEDANG diputar
const player = createAudioPlayer(); // Player global

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
        currentTrack = null; // Bersihkan variabel
        return playZenoRadio(); // FALLBACK KE RADIO JIKA ANTREAN HABIS
    }

    currentMode = 'CUSTOM';
    currentTrack = queue.shift(); // Ambil lagu urutan pertama dan simpan ke currentTrack

    // Matikan radio jika masih menyala
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
        ffmpegProcess = null;
    }

    try {
        // PERHATIKAN: Semua kata 'track' di bawah ini sudah diubah menjadi 'currentTrack'
        console.log(`🎵 [MODE CUSTOM] Mengekstrak: ${currentTrack.url}`);
        const stream = await getYouTubeStream(currentTrack.url);

        const resource = createAudioResource(stream, {
            inputType: StreamType.Opus
        });
        
        player.play(resource);
        console.log(`▶️ Sedang memutar: ${currentTrack.title}`);
    } catch (error) {
        console.error(`❌ [YT-DLP ERROR] Gagal memutar lagu:`, error.message);
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

    // --- COMMAND: /queue ---
    if (commandName === 'queue') {
        if (currentMode === 'RADIO') {
            return interaction.reply('📻 Saat ini sedang memutar **Radio Zeno.fm 24/7**. Antrean lagu custom kosong.');
        }

        let qText = `**🎶 Sedang Diputar:**\n${currentTrack ? currentTrack.title : 'Tidak ada'}\n\n**📋 Antrean Berikutnya:**\n`;
        
        if (queue.length === 0) {
            qText += '*Kosong. Setelah lagu ini habis, bot akan kembali memutar Radio.*';
        } else {
            const max = Math.min(queue.length, 10); // Tampilkan maksimal 10 lagu aja biar gak spam
            for (let i = 0; i < max; i++) {
                qText += `${i + 1}. ${queue[i].title}\n`;
            }
            if (queue.length > 10) qText += `\n*...dan ${queue.length - 10} lagu lainnya.*`;
        }

        return interaction.reply({ content: qText });
    }

    // --- COMMAND: /playlist ---
    if (commandName === 'playlist') {
        const subCommand = interaction.options.getSubcommand();
        const playlistName = interaction.options.getString('nama').toLowerCase();
        const userId = interaction.user.id;

        await interaction.deferReply();

        try {
            // Cari data user di MongoDB
            let userDb = await User.findOne({ userId: userId });
            
            // Jika user belum ada di DB (misal member baru yang belum main Roblox/AI), buat profilnya otomatis
            if (!userDb) {
                userDb = new User({ userId: userId, username: interaction.user.username });
            }

            if (subCommand === 'add') {
                if (currentMode === 'RADIO' || !currentTrack) {
                    return interaction.editReply('❌ Bot sedang memutar Radio. Putar lagu custom dulu pakai `/play` sebelum menyimpannya ke playlist.');
                }

                // Cari apakah playlist dengan nama tersebut sudah dibuat user ini
                let playlist = userDb.customPlaylists.find(p => p.playlistName.toLowerCase() === playlistName);
                
                if (!playlist) {
                    // Buat wadah playlist baru jika belum ada
                    userDb.customPlaylists.push({ playlistName: playlistName, tracks: [] });
                    playlist = userDb.customPlaylists[userDb.customPlaylists.length - 1];
                }

                // Mencegah simpan lagu yang sama 2x di playlist yang sama
                const isDuplicate = playlist.tracks.some(t => t.url === currentTrack.url);
                if (isDuplicate) {
                    return interaction.editReply(`⚠️ Lagu **${currentTrack.title}** sudah ada di playlist \`${playlistName}\`.`);
                }

                // Masukkan lagu ke Database
                playlist.tracks.push({
                    title: currentTrack.title,
                    url: currentTrack.url,
                    source: 'youtube',
                    duration: currentTrack.duration
                });

                await userDb.save();
                return interaction.editReply(`✅ Berhasil menyimpan **${currentTrack.title}** ke playlist \`${playlistName}\`!`);
            }

            if (subCommand === 'play') {
                const playlist = userDb.customPlaylists.find(p => p.playlistName.toLowerCase() === playlistName);

                if (!playlist || playlist.tracks.length === 0) {
                    return interaction.editReply(`❌ Playlist \`${playlistName}\` tidak ditemukan atau masih kosong.`);
                }

                // Tarik semua lagu dari DB, dan push berurutan ke Antrean (RAM)
                playlist.tracks.forEach(track => {
                    queue.push({
                        title: track.title,
                        url: track.url,
                        duration: track.duration || "Unknown"
                    });
                });

                interaction.editReply(`✅ Berhasil memuat **${playlist.tracks.length} lagu** dari playlist \`${playlistName}\` ke antrean!`);

                // Jika bot sedang mode Radio, langsung paksa ganti ke Custom Music
                if (currentMode === 'RADIO') {
                    playNextCustom();
                }
            }

        } catch (error) {
            console.error("Playlist Error:", error);
            interaction.editReply('❌ Terjadi kesalahan saat memproses database playlist.');
        }
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
        },
        {
            name: 'queue',
            description: 'Lihat daftar antrean lagu saat ini'
        },
        {
            name: 'playlist',
            description: 'Kelola playlist pribadi kamu',
            options: [
                {
                    type: 1, // SUB_COMMAND
                    name: 'add',
                    description: 'Simpan lagu yang SEDANG DIPUTAR ke playlist kamu',
                    options: [{ type: 3, name: 'nama', description: 'Nama playlist (contoh: Lofi, Phonk)', required: true }]
                },
                {
                    type: 1, // SUB_COMMAND
                    name: 'play',
                    description: 'Putar seluruh lagu dari playlist kamu',
                    options: [{ type: 3, name: 'nama', description: 'Nama playlist yang ingin diputar', required: true }]
                }
            ]
        }
    ]);
    console.log("✅ Commands /play & /skip berhasil didaftarkan.");
});

client.login(process.env.RADIO_TOKEN);