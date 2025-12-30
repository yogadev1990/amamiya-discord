const { EmbedBuilder } = require('discord.js');

const khodamList = [
    { nama: 'Sonde Bengkok', sifat: 'Suka mencari-cari kesalahan orang lain.' },
    { nama: 'Tang Cabut Berkarat', sifat: 'Keras kepala tapi rapuh hatinya.' },
    { nama: 'Phantom Gigi', sifat: 'Sering jadi bahan percobaan teman.' },
    { nama: 'Kapas Basah', sifat: 'Beban kelompok, nambah-nambahin masalah.' },
    { nama: 'Bor High Speed', sifat: 'Berisik, omongannya pedas menyakitkan.' },
    { nama: 'Kursi Dental Rusak', sifat: 'Sering bikin orang sakit pinggang (menyusahkan).' },
    { nama: 'Masker Hijau', sifat: 'Pura-pura kuat menutupi aib.' },
    { nama: 'Alginat Encer', sifat: 'Lembek, pendiriannya tidak tetap.' }
];

module.exports = {
    name: 'khodam',
    description: 'Cek khodam dental yang bersemayam di dirimu',
    async execute(message, args) {
        // Algoritma Random berdasarkan Nama User (Biar konsisten hari ini)
        // Jadi kalau user cek berkali-kali hari ini, hasilnya sama.
        const today = new Date().getDate();
        const input = message.author.id + today;
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = input.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const index = Math.abs(hash) % khodamList.length;
        const khodam = khodamList[index];

        const embed = new EmbedBuilder()
            .setColor(0x8E44AD)
            .setTitle('👻 Cek Khodam Dental')
            .setDescription(`Di dalam diri **${message.author.username}**, bersemayam khodam:\n\n# **${khodam.nama}**\n\n*Sifat: ${khodam.sifat}*`)
            .setFooter({ text: 'Khodam ini bisa berubah setiap hari.' });

        await message.reply({ embeds: [embed] });
    },
};