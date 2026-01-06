const {
    Client,
    GatewayIntentBits,
    Events
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType,
} = require('@discordjs/voice');
const {
    spawn
} = require('child_process');
const {
    PassThrough
} = require('stream');
const prism = require('prism-media'); // Tambahkan prism-media
const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../.env')
});

// PAKAI FFMPEG SISTEM (WAJIB DI WINDOWS)
const ffmpegPath = 'ffmpeg';

/* =======================
   KONFIGURASI
======================= */
const RADIO_CHANNEL_ID = '1455761578178908170';
const STREAM_URL = 'http://stream-178.zeno.fm/f3wvbbqmdg8uv';

/* =======================
   DISCORD CLIENT
======================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

/* =======================
   RADIO CORE (REVISED)
======================= */
async function startRadio(guild) {
    const channel = guild.channels.cache.get(RADIO_CHANNEL_ID);
    if (!channel || channel.type !== 2) {
        console.error('❌ Voice channel tidak ditemukan');
        return;
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    const player = createAudioPlayer();
    
    // Debugging Player Status
    player.on(AudioPlayerStatus.Playing, () => {
        console.log('✅ Radio sedang memutar audio!');
    });
    player.on(AudioPlayerStatus.Buffering, () => {
        console.log('⏳ Radio sedang buffering...');
    });
    player.on('error', error => {
        console.error('❌ Error pada AudioPlayer:', error.message);
    });

    connection.subscribe(player);

    let ffmpeg = null;

    const play = () => {
        if (ffmpeg) {
            ffmpeg.kill('SIGKILL');
            ffmpeg = null;
        }

        console.log("🔄 Memulai spawn FFmpeg...");

        const args = [
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept: */*\r\nConnection: keep-alive\r\n',
            '-i', STREAM_URL,
            '-vn',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-bufsize', '64k',
            'pipe:1',
        ];

        // Pastikan path ffmpeg benar
        ffmpeg = spawn('ffmpeg', args, {
            stdio: ['ignore', 'pipe', 'pipe'], // pipe stderr juga buat debug
        });

        // >>> TANGKAP ERROR FFMPEG (PENTING) <<<
        ffmpeg.on('error', (err) => {
             console.error('❌ GAGAL MENJALANKAN FFMPEG (Binary tidak ditemukan?):', err);
        });

        ffmpeg.stderr.on('data', (data) => {
             // Uncomment baris bawah kalau mau liat log ffmpeg yang bejibun (buat debug doang)
             // console.log(`ffmpeg log: ${data}`); 
        });

        ffmpeg.on('close', (code) => {
             if (code !== 0 && code !== null) {
                 console.log(`⚠️ FFmpeg berhenti dengan code ${code}`);
             }
        });

        const prismStream = new prism.opus.Encoder({
            rate: 48000,
            channels: 2,
            frameSize: 960,
        });

        // Error handling prism
        prismStream.on('error', (err) => {
            console.error('❌ Prism Error:', err);
        });

        // Pipe output
        ffmpeg.stdout.pipe(prismStream);

        const resource = createAudioResource(prismStream, {
            inputType: StreamType.Opus,
        });

        player.play(resource);
    };

    player.on(AudioPlayerStatus.Idle, () => {
        console.log("⚠️ Audio mati (Idle), mencoba restart stream...");
        // Tunggu sebentar sebelum restart biar gak spamming kalau link mati
        setTimeout(play, 5000); 
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch {
            connection.destroy();
            console.log("🔌 Koneksi putus, reconnecting in 8s...");
            setTimeout(() => startRadio(guild), 8000);
        }
    });

    play();
}

/* =======================
   READY
======================= */
client.once(Events.ClientReady, () => {
    const channel = client.channels.cache.get(RADIO_CHANNEL_ID);
    if (channel) startRadio(channel.guild);
});

client.login(process.env.RADIO_TOKEN);