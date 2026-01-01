const { AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
const axios = require('axios');

module.exports = {
    name: 'testwelcome',
    description: 'Test tampilan gambar welcome (Admin Only)',
    async execute(message, args) {
        
        // Beri tahu sedang proses (karena render gambar butuh 1-2 detik)
        const loadingMsg = await message.reply("🎨 Sedang merender kartu selamat datang...");

        try {
            // Kita pakai data pengirim pesan sebagai simulasi member baru
            const member = message.member;
            
            // 1. Siapkan Username
            let username = member.user.username.toUpperCase();
            if (username.length > 15) username = username.substring(0, 15) + '...';

            // 2. Download Avatar
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatarResponse = await axios.get(avatarURL, { responseType: 'arraybuffer' });
            const avatarBuffer = Buffer.from(avatarResponse.data);

            // 3. Masking Lingkaran (SVG)
            const circleMask = Buffer.from(
                `<svg><circle cx="80" cy="80" r="80" fill="black"/></svg>`
            );

            const processedAvatar = await sharp(avatarBuffer)
                .resize(160, 160)
                .composite([{ input: circleMask, blend: 'dest-in' }])
                .png()
                .toBuffer();

            // 4. Background & Teks (SVG)
            // PENTING: Tambahkan xmlns di tag svg biar valid di beberapa parser
            const svgImage = `
            <svg width="750" height="250" xmlns="http://www.w3.org/2000/svg">
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
                <text x="250" y="170" class="sub">Mahasiswa Baru Fakultas Kedokteran Gigi</text>
                <text x="250" y="200" class="sub">Simulasi Command Test Welcome</text>
            </svg>
            `;

            // 5. Gabungkan
            const finalImage = await sharp(Buffer.from(svgImage))
                .composite([{ input: processedAvatar, top: 45, left: 30 }])
                .png()
                .toBuffer();

            // 6. Kirim
            const attachment = new AttachmentBuilder(finalImage, { name: 'welcome-test.png' });
            
            await message.channel.send({ 
                content: `✅ **Sukses!** Ini preview tampilannya:`, 
                files: [attachment] 
            });

            // Hapus pesan loading
            await loadingMsg.delete();

        } catch (error) {
            console.error(error);
            await loadingMsg.edit(`❌ **Error Render:** ${error.message}`);
        }
    },
};