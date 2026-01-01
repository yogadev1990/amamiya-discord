const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    // PENTING: Kata 'async' harus ada di sini sebelum (interaction)
    async execute(interaction) { 

        // --- 1. HANDLE BUTTONS (Role & Verifikasi) ---
        if (interaction.isButton()) {
            
            // A. LOGIKA VERIFIKASI RULES (Warga FKG)
            if (interaction.customId === 'verify_agree') {
                // Pastikan nama role di Discord persis 'Warga FKG' (Case sensitive)
                const roleVerified = interaction.guild.roles.cache.find(r => r.name === 'Warga KG');

                if (!roleVerified) {
                    return interaction.reply({ content: '❌ Error: Role "Warga KG" belum dibuat oleh admin!', ephemeral: true });
                }

                // Cek kalau user udah punya rolenya
                if (interaction.member.roles.cache.has(roleVerified.id)) {
                    return interaction.reply({ content: 'Kamu sudah terverifikasi kok! Silakan cek channel lain.', ephemeral: true });
                }

                // Kasih Role
                try {
                    await interaction.member.roles.add(roleVerified);
                    await interaction.reply({ 
                        content: '✅ **Verifikasi Berhasil!** Akses ke server telah dibuka.\nSilakan ke channel `#🆔registrasi-ulang` untuk memilih angkatan.', 
                        ephemeral: true 
                    });
                } catch (error) {
                    console.error("Gagal kasih role:", error);
                    await interaction.reply({ content: '❌ Gagal memberi role. Pastikan Role Bot Amamiya posisinya DI ATAS role Warga KG di Server Settings.', ephemeral: true });
                }
            }

            // B. LOGIKA PILIH ANGKATAN
            else if (interaction.customId.startsWith('role_')) {
                
                // Mapping ID Tombol ke Nama Role di Server
                const roleMap = {
                    'role_2023': 'KG 23',
                    'role_2024': 'KG 24',
                    'role_2025': 'KG 25'
                };

                const roleName = roleMap[interaction.customId];
                const role = interaction.guild.roles.cache.find(r => r.name === roleName);

                if (!role) {
                    return interaction.reply({ content: `❌ Error: Role **"${roleName}"** tidak ditemukan di server. Lapor admin!`, ephemeral: true });
                }

                const member = interaction.member;

                // LOGIKA TOGGLE (Kalau punya -> Cabut. Kalau belum -> Pasang)
                try {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        await interaction.reply({ content: `➖ Role **${roleName}** dilepas.`, ephemeral: true });
                    } else {
                        await member.roles.add(role);
                        await interaction.reply({ content: `✅ Role **${roleName}** berhasil dipasang! Selamat datang.`, ephemeral: true });
                    }
                } catch (error) {
                    console.error("Gagal ganti role angkatan:", error);
                    await interaction.reply({ content: '❌ Gagal mengubah role. Cek permission bot.', ephemeral: true });
                }
            }
        }
        
        // --- 2. HANDLE SLASH COMMANDS (Jika nanti kamu pakai) ---
        else if (interaction.isChatInputCommand()) {
             // Kode handler slash command bisa ditaruh sini nanti
        }
    },
};