const { Events, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const axios = require('axios');

// ID Channel Welcome (Jangan lupa ganti)
const WELCOME_CHANNEL_ID = '1455563264019796019'; // Ganti ID channel kamu

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // 1. Cek Channel
        const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
        if (!channel) return;

        try {
            // 2. Siapkan Username (Potong kalau kepanjangan biar gak nabrak)
            let username = member.user.username.toUpperCase();
            if (username.length > 15) username = username.substring(0, 15) + '...';

            // 3. Download Avatar User
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatarResponse = await axios.get(avatarURL, { responseType: 'arraybuffer' });
            const avatarBuffer = Buffer.from(avatarResponse.data);

            // 4. Buat Lingkaran Masking untuk Avatar (Pake SVG)
            const circleMask = Buffer.from(
                `<svg><circle cx="80" cy="80" r="80" fill="black"/></svg>`
            );

            // Proses Avatar: Resize -> Bulatkan
            const processedAvatar = await sharp(avatarBuffer)
                .resize(160, 160)
                .composite([{
                    input: circleMask,
                    blend: 'dest-in' // Teknik masking: cuma ambil gambar yang kena lingkaran
                }])
                .png()
                .toBuffer();

            // 5. Buat Teks Menggunakan SVG (Trik Sharp)
            // Kita bikin background gradient CSS di dalam SVG-nya langsung
            const width = 750;
            const height = 250;
            
            const svgImage = `
            <svg width="${width}" height="${height}">
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style="stop-color:#1a2a6c;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#b21f1f;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#grad)" rx="20" ry="20" />
                
                <line x1="220" y1="20" x2="220" y2="230" style="stroke:rgba(255,255,255,0.2);stroke-width:2" />
                
                <style>
                    .title { fill: white; font-family: sans-serif; font-weight: bold; font-size: 32px; }
                    .name { fill: #f1c40f; font-family: sans-serif; font-weight: bold; font-size: 40px; }
                    .sub { fill: #dddddd; font-family: sans-serif; font-size: 18px; }
                </style>
                <text x="250" y="80" class="title">SELAMAT DATANG</text>
                <text x="250" y="130" class="name">${username}</text>
                <text x="250" y="170" class="sub">Mahasiswa Baru Kedokteran Gigi</text>
                <text x="250" y="200" class="sub">Silakan verifikasi diri di #💁resepsionis</text>
            </svg>
            `;

            // 6. GABUNGKAN SEMUANYA (Komposisi)
            // Layer 0: Background & Teks (dari SVG di atas)
            // Layer 1: Avatar Bulat (ditaruh di koordinat x:30, y:45)
            const finalImage = await sharp(Buffer.from(svgImage))
                .composite([
                    { input: processedAvatar, top: 45, left: 30 } 
                ])
                .png()
                .toBuffer();

            // 7. Kirim ke Discord
            const attachment = new AttachmentBuilder(finalImage, { name: 'welcome-card.png' });
            
            await channel.send({ 
                content: `Halo ${member}, selamat datang di **Duniawi KG UNSRI**! 🦷`, 
                files: [attachment] 
            });

        } catch (error) {
            console.error('Gagal membuat gambar welcome:', error);
            // Fallback kalau gambar gagal, minimal sapa pake teks
            channel.send(`Halo ${member}, selamat datang! (Sistem gambar sedang gangguan, tapi semangat belajarnya jangan kendor!)`);
        }
    },
};