const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const sharp = require('sharp');
const axios = require('axios');
const path = require('path');

// Pastikan letak path ini sama persis dengan yang ada di guildMemberAdd.js
const BG_IMAGE_PATH = path.join(__dirname, '../../assets/bg-welcome.png'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testwelcome')
        .setDescription('Simulasi pengujian antarmuka render kartu selamat datang (Khusus Administrator)')
        // Mutlak: Mengunci akses hanya untuk entitas berstatus Admin
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Mengunci sesi eksekusi. Memberikan waktu tambahan bagi bot untuk mengunduh avatar dan merender gambar tanpa terkena timeout 3 detik Discord.
        await interaction.deferReply();

        try {
            const member = interaction.member;
            
            // 1. Persiapan Presisi Username
            let username = member.user.username.toUpperCase();
            if (username.length > 15) username = username.substring(0, 15) + '...';

            // 2. Ekstraksi Avatar Pengguna
            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatarResponse = await axios.get(avatarURL, { responseType: 'arraybuffer' });
            const avatarBuffer = Buffer.from(avatarResponse.data);

            // 3. Eksekusi Masking Presisi Lingkaran (SVG)
            const circleMask = Buffer.from(
                `<svg><circle cx="80" cy="80" r="80" fill="black"/></svg>`
            );

            const processedAvatar = await sharp(avatarBuffer)
                .resize(160, 160)
                .composite([{ input: circleMask, blend: 'dest-in' }])
                .png()
                .toBuffer();

            // 4. Render Teks SVG (Identik dengan Produksi)
            const width = 750;
            const height = 250;
            
            const textSvg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .title { fill: #ffffff; font-family: sans-serif; font-weight: bold; font-size: 32px; text-shadow: 2px 2px 4px rgba(0,0,0,0.7); }
                    .name { fill: #f1c40f; font-family: sans-serif; font-weight: bold; font-size: 40px; text-shadow: 2px 2px 4px rgba(0,0,0,0.7); }
                    .sub { fill: #dddddd; font-family: sans-serif; font-size: 18px; text-shadow: 1px 1px 2px rgba(0,0,0,0.7); }
                </style>
                <line x1="220" y1="20" x2="220" y2="230" style="stroke:rgba(255,255,255,0.4);stroke-width:2" />
                <text x="250" y="80" class="title">SELAMAT DATANG</text>
                <text x="250" y="130" class="name">${username}</text>
                <text x="250" y="170" class="sub">Mahasiswa Baru Kedokteran Gigi</text>
                <text x="250" y="200" class="sub">[ Mode Simulasi Uji Coba Render ]</text>
            </svg>
            `;
            const textBuffer = Buffer.from(textSvg);

            // 5. Eksekusi Komposisi Lapis Tiga (Background Statis -> Avatar -> Teks)
            const finalImage = await sharp(BG_IMAGE_PATH)
                .resize(750, 250)
                .composite([
                    { input: processedAvatar, top: 45, left: 30 },
                    { input: textBuffer, top: 0, left: 0 }
                ])
                .png()
                .toBuffer();

            // 6. Pengiriman Hasil Akhir
            const attachment = new AttachmentBuilder(finalImage, { name: 'welcome-test.png' });
            
            await interaction.editReply({ 
                content: `✅ **Pengujian Valid!** Berikut adalah pratinjau akurat dari kartu selamat datang Anda:`, 
                files: [attachment] 
            });

        } catch (error) {
            console.error('Kesalahan Simulasi Render:', error);
            await interaction.editReply(`❌ **Kegagalan Sistem Rendering:** \`${error.message}\`\nPastikan lokasi *file* gambar latar belakang pada kode ini selaras dengan struktur map Anda.`);
        }
    },
};
