const { SlashCommandBuilder } = require('discord.js');
const GeminiAi = require('../../shared/utils/geminiHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uji_proposal')
        .setDescription('Simulasi sidang. Dosen AI akan membantai draf proposalmu dari file PDF.')
        .addAttachmentOption(option =>
            option.setName('dokumen')
                .setDescription('Upload file PDF Bab 1 atau Bab 3 penelitianmu.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const file = interaction.options.getAttachment('dokumen');
        
        // 1. Validasi Ekstensi
        if (file.contentType !== 'application/pdf') {
            return interaction.reply({ content: '❌ Dosen penguji menolak dokumenmu. Format wajib PDF.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // 2. Susun Prompt Dosen Penguji
            const prompt = `
            Kamu adalah Amamiya, seorang Dosen Penguji Sidang Skripsi yang sangat kritis, teliti, perfeksionis, dan skeptis di Fakultas Kedokteran Gigi.
            
            TUGASMU:
            Baca dan evaluasi dokumen proposal yang dilampirkan ini secara menyeluruh. Cari celah fatal, bias penelitian, dan kelemahan argumen dari draf tersebut. Jawab dengan format markdown berikut:

            **💥 1. Serangan Utama (Fatal Flaws)**
            (Sebutkan 1-2 kelemahan paling mematikan dari draf ini. Apakah argumennya melompat? Apakah urgensinya kurang kuat? Apakah variabelnya sulit diukur secara objektif?)

            **❓ 2. Pertanyaan Sidang (Wajib Dijawab Mahasiswa)**
            (Berikan 3 pertanyaan interogasi tingkat tinggi yang menohok dan menjebak. Jangan berikan pertanyaan hafalan dasar).

            **🛠️ 3. Tuntutan Revisi**
            (Berikan instruksi tegas dan konkret tentang apa yang harus diubah atau ditambahkan agar proposal ini layak diteruskan).

            ATURAN TEGAS:
            - Jangan memuji berlebihan. Langsung serang kelemahan metodologi atau teorinya.
            - Gunakan bahasa Indonesia formal namun mengintimidasi layaknya dosen penguji sesungguhnya.
            - JANGAN memakai kata "melakukan" dalam seluruh teks jawabanmu. Ganti dengan kata lain seperti mengeksekusi, menjalankan, menerapkan, menyusun, atau memproses.
            `;

            // 3. Lempar ke Helper (Bawa URL dan MimeType)
            // Helper akan otomatis mengubah URL menjadi Base64
            const jawabanAI = await GeminiAi.run(
                interaction.user.id, 
                interaction.user.username, 
                prompt, 
                file.url, 
                file.contentType
            );

            // 4. Sistem Anti-Terpotong (Discord 2000 chars limit)
            if (jawabanAI.length > 1900) {
                const lines = jawabanAI.split('\n');
                const chunks = [];
                let currentChunk = '';

                for (const line of lines) {
                    if (currentChunk.length + line.length + 1 > 1900) {
                        chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                if (currentChunk) chunks.push(currentChunk);

                await interaction.editReply(`🎓 **Simulasi Sidang Proposal Dimulai!**\n📄 *Membaca dokumen: ${file.name}*\n\n${chunks[0]}`);
                
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp({ content: chunks[i] });
                }
            } else {
                await interaction.editReply(`🎓 **Simulasi Sidang Proposal Dimulai!**\n📄 *Membaca dokumen: ${file.name}*\n\n${jawabanAI}`);
            }

        } catch (error) {
            console.error("Uji Proposal PDF Error:", error);
            await interaction.editReply('❌ Terjadi kesalahan sistem. AI gagal membaca PDF tersebut. Pastikan teks di dalam PDF tidak dikunci/diproteksi sandi.');
        }
    },
};
