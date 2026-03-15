const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder,
    ComponentType 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Menampilkan panel interaktif sistem Amamiya'),

    async execute(interaction) {
        const commandsPath = path.join(__dirname, '..'); 
        const commandFolders = fs.readdirSync(commandsPath);
        
        let totalModules = 0;
        const categoryData = new Map(); // Menyimpan data perintah per kategori
        const selectOptions = []; // Pilihan untuk dropdown

        // 1. Fase Pemindaian Data
        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            
            if (fs.statSync(folderPath).isDirectory()) {
                const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
                if (commandFiles.length === 0) continue;

                let commandsInFolder = [];
                for (const file of commandFiles) {
                    const filePath = path.join(folderPath, file);
                    const command = require(filePath);
                    if ('data' in command) {
                        commandsInFolder.push(`**\`/${command.data.name}\`**\n> ${command.data.description}`);
                        totalModules++;
                    }
                }

                if (commandsInFolder.length > 0) {
                    const categoryName = folder.charAt(0).toUpperCase() + folder.slice(1);
                    categoryData.set(folder, commandsInFolder.join('\n\n'));
                    
                    // Membuat opsi untuk Dropdown menu
                    selectOptions.push(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`Modul ${categoryName}`)
                            .setDescription(`Lihat perintah untuk ${categoryName}`)
                            .setValue(folder)
                            // Anda bisa menyesuaikan emoji berdasarkan nama folder
                            .setEmoji(folder === 'akademik' ? '📚' : folder === 'ai' ? '🤖' : '⚙️') 
                    );
                }
            }
        }

        // 2. Persiapan Data UI Utama
        const ping = interaction.client.ws.ping;
        const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

        // Membuat Dropdown Menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('kategori_menu')
            .setPlaceholder('Pilih kategori modul...')
            .addOptions(selectOptions);

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        // 3. Merender UI Utama (Beranda)
        const mainEmbed = new EmbedBuilder()
            .setColor('#2b98ff') // Warna dark mode yang elegan
            .setAuthor({ name: '🏥 LIST COMMAND AMAMIYA' })
            .setDescription(`Halo **${interaction.user.username}**, staff akademik Amamiya siap membantu.\n\nSaat ini terdeteksi **${totalModules} modul perintah** aktif.\nSilakan pilih kategori di bawah untuk mengakses manual.`)
            .addFields(
                { name: '📆 Tanggal', value: today, inline: true },
                { name: '⚡ Latency', value: `${ping}ms`, inline: true }
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: 'Developed by Revanda • KG UNSRI' });

        // Mengirim pesan dengan komponen
        const response = await interaction.reply({ 
            embeds: [mainEmbed], 
            components: [actionRow],
            fetchReply: true // Penting agar bisa melacak interaksi
        });

        // 4. Sistem Kolektor Interaksi (Sub Menu Logic)
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 // Waktu aktif menu: 60 detik
        });

        collector.on('collect', async i => {
            // Memastikan hanya user yang memanggil perintah yang bisa menekan tombol
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Anda tidak bisa menggunakan menu ini.', ephemeral: true });
            }

            const selectedCategory = i.values[0];
            const categoryName = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
            const commandsList = categoryData.get(selectedCategory);

            // Merender UI baru berdasarkan kategori yang dipilih
            const categoryEmbed = new EmbedBuilder()
                .setColor('#00BFFF')
                .setAuthor({ name: `📂 Modul ${categoryName}` })
                .setDescription(commandsList)
                .setFooter({
                    text: 'Amamiya AI • Sistem Asisten Kedokteran Gigi',
                    iconURL: interaction.client.user.displayAvatarURL()
                })

            // Mengupdate pesan (mengubah embed, tapi membiarkan dropdown tetap ada)
            await i.update({ embeds: [categoryEmbed], components: [actionRow] });
        });

        // 5. Penanganan Saat Sesi Berakhir (Timeout)
        collector.on('end', () => {
            // Menonaktifkan dropdown saat waktu habis
            selectMenu.setDisabled(true);
            const disabledRow = new ActionRowBuilder().addComponents(selectMenu);

            const timeoutEmbed = EmbedBuilder.from(mainEmbed)
                .setDescription('🔒 **Sesi berakhir.** Ketik `/menu` untuk membuka kembali.');

            // Mengupdate pesan dengan dropdown yang sudah mati
            interaction.editReply({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(console.error);
        });
    },
};