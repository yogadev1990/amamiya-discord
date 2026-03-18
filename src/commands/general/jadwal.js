const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../shared/models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jadwal')
        .setDescription('Kelola jadwal kuliah pribadi')
        .addSubcommand(subcommand =>
            subcommand
                .setName('lihat')
                .setDescription('Lihat jadwal kuliah kamu')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tambah')
                .setDescription('Tambah jadwal kuliah baru')
                .addStringOption(option => 
                    option.setName('hari')
                        .setDescription('Hari perkuliahan (contoh: senin)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Senin', value: 'senin' },
                            { name: 'Selasa', value: 'selasa' },
                            { name: 'Rabu', value: 'rabu' },
                            { name: 'Kamis', value: 'kamis' },
                            { name: 'Jumat', value: 'jumat' },
                            { name: 'Sabtu', value: 'sabtu' },
                            { name: 'Minggu', value: 'minggu' }
                        )
                )
                .addStringOption(option => 
                    option.setName('jam')
                        .setDescription('Jam perkuliahan (contoh: 08:00)')
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName('matkul')
                        .setDescription('Nama Mata Kuliah')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Hapus semua jadwal kuliah kamu')
        ),
    async execute(interaction) {
        let user = await User.findOne({ userId: interaction.user.id });
        if (!user) {
            user = await User.create({ userId: interaction.user.id, username: interaction.user.username, schedule: [] });
        }

        const subCommand = interaction.options.getSubcommand();

        if (subCommand === 'lihat') {
            const jadwalUser = user.schedule || [];

            if (jadwalUser.length === 0) {
                return interaction.reply('📅 Jadwal kamu masih kosong.\nCara isi: `/jadwal tambah [hari] [jam] [nama_matkul]`\nContoh: `/jadwal tambah senin 08:00 Blok 9`');
            }

            const hariUrut = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
            
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle(`📅 Jadwal Kuliah: ${user.username}`)
                .setDescription('Ini jadwal yang kamu simpan:');

            hariUrut.forEach(hari => {
                const jadwalHariIni = jadwalUser.filter(j => j.hari.toLowerCase() === hari);
                
                if (jadwalHariIni.length > 0) {
                    const listMatkul = jadwalHariIni
                        .sort((a, b) => a.jam.localeCompare(b.jam))
                        .map(j => `⏰ **${j.jam}** : ${j.matkul}`)
                        .join('\n');

                    const namaHari = hari.charAt(0).toUpperCase() + hari.slice(1);
                    embed.addFields({ name: namaHari, value: listMatkul });
                }
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subCommand === 'tambah') {
            const hariInput = interaction.options.getString('hari');
            const jamInput = interaction.options.getString('jam');
            const matkulInput = interaction.options.getString('matkul');
            
            user.schedule.push({
                hari: hariInput,
                jam: jamInput,
                matkul: matkulInput
            });

            await user.save();

            return interaction.reply(`✅ Berhasil menyimpan jadwal: **${matkulInput}** pada **${hariInput}, ${jamInput}**.`);
        }

        if (subCommand === 'reset') {
            user.schedule = [];
            await user.save();
            return interaction.reply('🗑️ Semua jadwal kamu telah dihapus.');
        }
    },
};
