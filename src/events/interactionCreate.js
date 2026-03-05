const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        // =========================
        // 1️⃣ HANDLE BUTTON
        // =========================
        if (interaction.isButton()) {

            // --- VERIFIKASI ---
            if (interaction.customId === 'verify_agree') {

                const roleVerified = interaction.guild.roles.cache.find(
                    r => r.name === 'Warga KG'
                );

                if (!roleVerified) {
                    return interaction.reply({
                        content: '❌ Role "Warga KG" belum dibuat!',
                        ephemeral: true
                    });
                }

                if (interaction.member.roles.cache.has(roleVerified.id)) {
                    return interaction.reply({
                        content: 'Kamu sudah terverifikasi.',
                        ephemeral: true
                    });
                }

                try {

                    await interaction.member.roles.add(roleVerified);

                    await interaction.reply({
                        content:
                            '✅ **Verifikasi berhasil!**\nSilakan ke channel `#🆔registrasi-ulang`.',
                        ephemeral: true
                    });

                } catch (error) {

                    console.error(error);

                    await interaction.reply({
                        content:
                            '❌ Gagal memberi role. Pastikan role bot di atas.',
                        ephemeral: true
                    });

                }

            }

            // --- ROLE ANGKATAN ---
            else if (interaction.customId.startsWith('role_')) {

                const roleMap = {
                    role_2023: 'KG 23',
                    role_2024: 'KG 24',
                    role_2025: 'KG 25'
                };

                const roleName = roleMap[interaction.customId];

                const role = interaction.guild.roles.cache.find(
                    r => r.name === roleName
                );

                if (!role) {
                    return interaction.reply({
                        content: `❌ Role ${roleName} tidak ditemukan.`,
                        ephemeral: true
                    });
                }

                const member = interaction.member;

                try {

                    if (member.roles.cache.has(role.id)) {

                        await member.roles.remove(role);

                        await interaction.reply({
                            content: `➖ Role **${roleName}** dilepas.`,
                            ephemeral: true
                        });

                    } else {

                        await member.roles.add(role);

                        await interaction.reply({
                            content: `✅ Role **${roleName}** dipasang!`,
                            ephemeral: true
                        });

                    }

                } catch (error) {

                    console.error(error);

                    await interaction.reply({
                        content: '❌ Gagal mengubah role.',
                        ephemeral: true
                    });

                }

            }
        }

        // =========================
        // 2️⃣ HANDLE SLASH COMMAND
        // =========================
        else if (interaction.isChatInputCommand()) {

            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            try {

                await command.execute(interaction);

            } catch (error) {

                console.error(error);

                if (interaction.replied || interaction.deferred) {

                    await interaction.followUp({
                        content: '❌ Terjadi error saat menjalankan command.',
                        ephemeral: true
                    });

                } else {

                    await interaction.reply({
                        content: '❌ Terjadi error saat menjalankan command.',
                        ephemeral: true
                    });

                }

            }
        }
    },
};