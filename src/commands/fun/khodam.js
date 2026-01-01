const { EmbedBuilder } = require('discord.js');

const khodamList = [
    { nama: 'Sonde Bengkok', sifat: 'Suka mencari-cari kesalahan orang lain.' },
    { nama: 'Tang Cabut Berkarat', sifat: 'Keras kepala tapi rapuh hatinya.' },
    { nama: 'Phantom Gigi', sifat: 'Sering jadi bahan percobaan teman.' },
    { nama: 'Kapas Basah', sifat: 'Beban kelompok, nambah-nambahin masalah.' },
    { nama: 'Bor High Speed', sifat: 'Berisik, omongannya pedas menyakitkan.' },
    { nama: 'Kursi Dental Rusak', sifat: 'Sering bikin orang sakit pinggang (menyusahkan).' },
    { nama: 'Masker Hijau', sifat: 'Pura-pura kuat menutupi aib.' },
    { nama: 'Alginat Encer', sifat: 'Lembek, pendiriannya tidak tetap.' },
    // --- KELOMPOK ALAT & INSTRUMEN ---
{ nama: 'Saliva Ejector Mampet', sifat: 'Toxic, bukannya membantu malah bikin banjir masalah.' },
{ nama: 'Light Cure Lowbat', sifat: 'Pemberi harapan palsu, kelihatannya terang padahal aslinya lemah.' },
{ nama: 'Kaca Mulut Berembun', sifat: 'Pemalu, pandangannya sering kabur dan nggak jelas arah hidupnya.' },
{ nama: 'Jarum Suntik Bengkok', sifat: 'Menakutkan, sekali mendekat bikin orang trauma mendalam.' },
{ nama: 'Matrix Band Longgar', sifat: 'Gak punya pendirian, suka lepas tanggung jawab di saat genting.' },
{ nama: 'Artikulator Macet', sifat: 'Kaku, susah diajak kompromi (susah mangap).' },

// --- KELOMPOK BAHAN ---
{ nama: 'Tambalan Sementara', sifat: 'Gak setia, datang cuma singgah sebentar lalu pergi (lepas).' },
{ nama: 'Malam Merah (Wax)', sifat: 'Baperan, kena panas sedikit langsung meleleh hatinya.' },
{ nama: 'Gips Stone', sifat: 'Keras kepala, kalau sudah ngambek susah dibentuk.' },
{ nama: 'Bonding Kedaluwarsa', sifat: 'Tidak bisa dipercaya, janjinya merekatkan hubungan tapi gagal terus.' },
{ nama: 'Chlorophyll (Obat Kumur)', sifat: 'Pencitraan, luarnya manis/segar tapi aslinya pahit.' },
{ nama: 'Composite Shade A1', sifat: 'Pick-me girl, merasa dirinya paling putih dan bersinar dibanding yang lain.' },

// --- KELOMPOK SITUASI/LAINNYA ---
{ nama: 'Gigi Molar 3', sifat: 'Datang terlambat, pas muncul malah bikin sakit semua orang.' },
{ nama: 'Resep Dokter Tulisan Cakar Ayam', sifat: 'Misterius, sangat sulit dipahami maksud hatinya.' },
{ nama: 'Lecron', sifat: 'Suka ghosting, menghilang saat lagi sayang-sayangnya (dibutuhkan).' },
{ nama: 'Rubber Dam', sifat: 'Posesif, suka mengekang kebebasan orang lain (mengisolasi).' }
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