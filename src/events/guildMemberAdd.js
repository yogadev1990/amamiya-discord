const { Events, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');

// ID KONFIGURASI MUTLAK
const WELCOME_CHANNEL_ID = '1455563264019796019'; 
const RESEPSIONIS_CHANNEL_ID = '1455562995890393208'; // GANTI dengan ID Channel Resepsionis Anda
const BG_IMAGE_PATH = path.join(__dirname, '../assets/bg-welcome.png'); // GANTI dengan path & nama gambar background Anda

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // 1. Validasi Kanal
        const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!channel) return;

        try {
            // 2. Persiapan Data Teks
            let username = member.user.username.toUpperCase();
            if (username.length > 15) username = username.substring(0, 15) + '...';

            // 3. Tarik Avatar dari CDN Discord
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatarResponse = await axios.get(avatarURL, { responseType: 'arraybuffer' });
            const avatarBuffer = Buffer.from(avatarResponse.data);

            // 4. Proses Masking Avatar Bulat (160x160)
            const circleMask = Buffer.from(
                `<svg><circle cx="80" cy="80" r="80" fill="black"/></svg>`
            );

            const processedAvatar = await sharp(avatarBuffer)
                .resize(160, 160)
                .composite([{ input: circleMask, blend: 'dest-in' }])
                .png()
                .toBuffer();

            // 5. Render Teks SVG Transparan (Tanpa Background)
            // Resolusi disesuaikan, kita asumsikan background Anda 750x250 (Bisa diganti jika beda)
            const width = 750;
            const height = 250;
            
            const textSvg = `
            <svg width="${width}" height="${height}">
                <style>
                    /* Anda bisa mengganti warna fill sesuai kecocokan dengan background Anda */
                    .title { fill: #ffffff; font-family: sans-serif; font-weight: bold; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.7); }
                    .name { fill: #f1c40f; font-family: sans-serif; font-weight: bold; font-size: 40px; text-shadow: 2px 2px 4px rgba(0,0,0,0.7); }
                    .sub { fill: #dddddd; font-family: sans-serif; font-size: 18px; text-shadow: 1px 1px 2px rgba(0,0,0,0.7); }
                </style>
                
                <line x1="220" y1="20" x2="220" y2="230" style="stroke:rgba(255,255,255,0.4);stroke-width:2" />
                
                <text x="250" y="80" class="title">SELAMAT DATANG</text>
                <text x="250" y="130" class="name">${username}</text>
                <text x="250" y="170" class="sub">Mahasiswa Baru Kedokteran Gigi</text>
                <text x="250" y="200" class="sub">Silakan verifikasi diri di Resepsionis</text>
            </svg>
            `;
            const textBuffer = Buffer.from(textSvg);

            // 6. Komposisi Tiga Lapis (Background -> Avatar -> Teks)
            // Memastikan gambar background di-resize ke ukuran standar kartu 750x250
            const finalImage = await sharp(BG_IMAGE_PATH)
                .resize(750, 250) 
                .composite([
                    { input: processedAvatar, top: 45, left: 30 }, // Pasang Avatar di kiri
                    { input: textBuffer, top: 0, left: 0 } // Pasang lapisan Teks di atasnya
                ])
                .png()
                .toBuffer();

            // 7. Pengiriman Antarmuka
            const attachment = new AttachmentBuilder(finalImage, { name: 'welcome-card.png' });
            
            await channel.send({ 
                content: `Halo ${member}, selamat datang di **Duniawi KG UNSRI**! 🦷\nSilakan menuju ke <#${RESEPSIONIS_CHANNEL_ID}> untuk melakukan verifikasi data mahasiswa.`, 
                files: [attachment] 
            });

        } catch (error) {
            console.error('Kesalahan Rendering Kartu Welcome:', error);
            // Fallback teks jika Sharp gagal (misal: file background tidak ditemukan)
            channel.send(`Halo ${member}, selamat datang di **Duniawi KG UNSRI**! 🦷\nSilakan menuju ke <#${RESEPSIONIS_CHANNEL_ID}> untuk melakukan verifikasi.`);
        }
    },
};