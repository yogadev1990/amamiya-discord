const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const GeminiAi = require('../../utils/geminiHelper');

// --- FUNGSI HELPER: API PUBMED ---
async function fetchPubMed(query, tahunAwal, tahunAkhir) {
    try {
        let dateFilter = "";
        
        // Format filter tanggal untuk NCBI E-utilities
        if (tahunAwal || tahunAkhir) {
            const min = tahunAwal || 1900;
            const max = tahunAkhir || new Date().getFullYear();
            dateFilter = `&datetype=pdat&mindate=${min}&maxdate=${max}`;
        }

        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=3${dateFilter}`;
        const searchRes = await axios.get(searchUrl);
        const ids = searchRes.data.esearchresult.idlist;
        
        if (!ids || ids.length === 0) return "*Tidak ada literatur PubMed yang ditemukan untuk kueri dan rentang tahun ini.*";

        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
        const summaryRes = await axios.get(summaryUrl);
        const summaries = summaryRes.data.result;

        let resultText = "";
        ids.forEach((id, index) => {
            const title = summaries[id].title;
            const pubDate = summaries[id].pubdate || 'N/A';
            resultText += `**${index + 1}.** [${title}](https://pubmed.ncbi.nlm.nih.gov/${id}/) (${pubDate})\n`;
        });
        return resultText;
    } catch (error) {
        console.error("PubMed API Error:", error);
        return "*Gagal mengambil pratinjau data dari PubMed.*";
    }
}

// --- FUNGSI HELPER: TAMPILKAN HASIL ---
async function prosesPencarian(interaction, rawTopik, query, isAI, tahunAwal, tahunAkhir) {
    const queryEncoded = encodeURIComponent(query);
    const currentYear = new Date().getFullYear();

    // 1. Siapkan URL Dasar
    let linkScholar = `https://scholar.google.com/scholar?q=${queryEncoded}`;
    let linkPubMed = `https://pubmed.ncbi.nlm.nih.gov/?term=${queryEncoded}`;
    let linkGaruda = `https://garuda.kemdikbud.go.id/documents?q=${encodeURIComponent(rawTopik)}`;

    // 2. Modifikasi URL jika ada filter tahun
    let infoTahun = "Semua Waktu";
    if (tahunAwal || tahunAkhir) {
        const min = tahunAwal || 1900;
        const max = tahunAkhir || currentYear;
        infoTahun = `${min} - ${max}`;
        
        // Inject parameter tahun ke URL
        linkScholar += `&as_ylo=${min}&as_yhi=${max}`;
        linkPubMed += `&filter=years.${min}-${max}`;
        // Catatan: Portal Garuda tidak mendukung parameter URL filter tahun yang simpel, jadi dilewati.
    }

    // 3. Tarik Preview PubMed
    const pubMedPreview = await fetchPubMed(query, tahunAwal, tahunAkhir);

    // 4. Bangun UI
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setLabel('Buka di Scholar').setStyle(ButtonStyle.Link).setURL(linkScholar),
            new ButtonBuilder().setLabel('Buka di PubMed').setStyle(ButtonStyle.Link).setURL(linkPubMed),
            new ButtonBuilder().setLabel('Buka di Garuda').setStyle(ButtonStyle.Link).setURL(linkGaruda)
        );

    const embed = new EmbedBuilder()
        .setColor(0x00A8FF)
        .setTitle(`📚 Hasil Pencarian Jurnal`)
        .addFields(
            { name: 'Topik Asli', value: `\`${rawTopik}\``, inline: true },
            { name: 'Rentang Tahun', value: `\`${infoTahun}\``, inline: true }
        )
        .setDescription(`**Query yang digunakan:**\n\`${query}\`\n\n**📑 Top 3 Literatur PubMed:**\n${pubMedPreview}`)
        .setFooter({ text: isAI ? 'Query dioptimalkan oleh Amamiya AI' : 'Pencarian langsung (Raw)' });

    await interaction.editReply({ content: '', embeds: [embed], components: [row] });
}

// --- MAIN MODULE ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('jurnal')
        .setDescription('Cari referensi jurnal ilmiah secara instan')
        .addStringOption(option =>
            option.setName('topik')
                .setDescription('Topik atau query pencarian jurnal')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('bantu_ai')
                .setDescription('Gunakan AI untuk merakit query spesifik (Boolean AND/OR)?')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('tahun_awal')
                .setDescription('Filter batas tahun paling lama (Contoh: 2019)')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('tahun_akhir')
                .setDescription('Filter batas tahun paling baru (Contoh: 2024)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const rawTopik = interaction.options.getString('topik');
        const gunakanAI = interaction.options.getBoolean('bantu_ai') || false;
        const tAwal = interaction.options.getInteger('tahun_awal');
        const tAkhir = interaction.options.getInteger('tahun_akhir');

        await interaction.deferReply();

        let finalQuery = rawTopik;

        // --- JIKA MENGGUNAKAN AI ---
        if (gunakanAI) {
            try {
                const prompt = `
                Tugasmu adalah mengubah kalimat biasa menjadi query pencarian jurnal medis/kedokteran gigi tingkat lanjut (Advanced Boolean Query).
                Kalimat user: "${rawTopik}"
                
                Aturan:
                1. Gunakan bahasa Inggris (standar PubMed/Scholar).
                2. Gunakan operator AND, OR, atau tanda kutip ("") jika perlu.
                3. JANGAN berikan penjelasan apapun. Berikan HANYA teks query-nya saja.
                `;

                const aiResponse = await GeminiAi.run(interaction.user.id, interaction.user.username, prompt);
                finalQuery = aiResponse.replace(/^"|"$/g, '').trim();

                const confirmEmbed = new EmbedBuilder()
                    .setColor(0xF39C12)
                    .setTitle('⚙️ Review Query AI')
                    .addFields(
                        { name: 'Input Kamu', value: `\`${rawTopik}\`` },
                        { name: 'Rekomendasi AI (Boolean)', value: `\`${finalQuery}\`` }
                    )
                    .setDescription('Apakah kamu ingin menggunakan query rekomendasi ini untuk mencari jurnal?');

                const confirmButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('acc_query').setLabel('Gunakan & Cari').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('rej_query').setLabel('Batal').setStyle(ButtonStyle.Danger)
                );

                const msg = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmButtons] });

                const collector = msg.createMessageComponentCollector({ time: 60000 });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ content: '❌ Hanya pembuat perintah yang bisa menekan tombol ini.', ephemeral: true });
                    }

                    if (i.customId === 'rej_query') {
                        return i.update({ content: '🛑 Pencarian dibatalkan oleh pengguna.', embeds: [], components: [] });
                    }

                    if (i.customId === 'acc_query') {
                        await i.deferUpdate();
                        // Lempar data ke fungsi pencarian beserta filter tahunnya
                        await prosesPencarian(interaction, rawTopik, finalQuery, true, tAwal, tAkhir);
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({ content: '⏱️ Waktu konfirmasi habis. Silakan ulangi perintah.', embeds: [], components: [] }).catch(() => {});
                    }
                });

                return;

            } catch (error) {
                console.error("AI Query Gen Error:", error);
                return interaction.editReply('❌ Gagal mengoptimasi query dengan AI. Coba beberapa saat lagi atau matikan opsi `bantu_ai`.');
            }
        }

        // --- JIKA TANPA AI ---
        await prosesPencarian(interaction, rawTopik, finalQuery, false, tAwal, tAkhir);
    },
};