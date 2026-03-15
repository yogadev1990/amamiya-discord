const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Menampilkan pusat kendali, status sistem, dan daftar perintah Amamiya'),

    async execute(interaction) {
        let totalModules = 0;
        const categories = []; // Penampung kategori/folder
        const commandsPath = path.join(__dirname, '..'); 
        
        const commandFolders = fs.readdirSync(commandsPath);

        // 1. Fase Pemindaian Kategori dan Modul
        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            
            if (fs.statSync(folderPath).isDirectory()) {
                const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
                
                // Lewati folder jika kosong
                if (commandFiles.length === 0) continue;

                let categoryCommands = [];
                for (const file of commandFiles) {
                    const filePath = path.join(folderPath, file);
                    const command = require(filePath);
                    
                    if ('data' in command) {
                        // Memformat baris perintah agar ringkas dan rapi di dalam kategori
                        categoryCommands.push(`**\`/${command.data.name}\`** - ${command.data.description}`);
                        totalModules++; 
                    }
                }

                // Jika ada perintah di dalam folder, buatkan field kategori baru
                if (categoryCommands.length > 0) {
                    // Mengkapitalisasi huruf pertama nama folder (contoh: 'akademik' -> 'Akademik')
                    const categoryName = folder.charAt(0).toUpperCase() + folder.slice(1);
                    
                    categories.push({
                        name: `📂 Modul ${categoryName}`,
                        value: categoryCommands.join('\n'),
                        inline: false
                    });
                }
            }
        }

        // 2. Kalkulasi Telemetri Sistem
        const wsPing = interaction.client.ws.ping;
        const apiPing = Date.now() - interaction.createdTimestamp;
        
        const totalSeconds = (interaction.client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const uptimeString = `${days}h ${hours}j ${minutes}m`;

        // Menambahkan status sistem sebagai field terakhir
        categories.push({
            name: '📊 Status Sistem Pusat',
            value: `> 🧠 **Total Modul:** ${totalModules} Perintah Aktif\n> 📡 **Ping WS:** ${wsPing}ms\n> ⏱️ **Latensi:** ${apiPing}ms\n> ⏳ **Uptime:** ${uptimeString}`,
            inline: false
        });

        // 3. Merender Antarmuka (Embed)
        const menuEmbed = new EmbedBuilder()
            .setColor('#00BFFF')
            .setTitle('🏥 Menu Amamiya AI')
            .setDescription('Sistem telah memindai memori direktori. Berikut adalah daftar seluruh modul yang diklasifikasikan berdasarkan kategori operasional:')
            .addFields(categories) // Memasukkan semua kategori dan status yang sudah disusun
            .setFooter({
                text: 'Amamiya AI • Sistem Asisten Kedokteran Gigi',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // 4. Eksekusi Pengiriman
        await interaction.reply({ embeds: [menuEmbed] });
    },
};