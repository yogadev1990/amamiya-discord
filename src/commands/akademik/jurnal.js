const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// --- FUNGSI AI TERISOLASI (STATELESS) ---

async function generateOptimizedQuery(rawTopic) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Tugasmu adalah merakit Advanced Boolean Query untuk pencarian jurnal kedokteran gigi (PubMed/Google Scholar). 
Topik: "${rawTopic}"
Aturan Mutlak:
1. Gunakan bahasa Inggris medis yang standar.
2. Gunakan operator (AND, OR, NOT) dan tanda kutip ("") dengan presisi tinggi.
3. Kembalikan HANYA format JSON. Dilarang memberikan teks atau penjelasan lain.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                // Fitur mutlak untuk memaksa AI mengembalikan data dalam format JSON murni
                responseMimeType: "application/json", 
            }
        });

        // Karena responseMimeType aktif, kita bisa langsung mem-parsing teksnya menjadi objek JSON
        const data = JSON.parse(response.text);
        
        // Asumsi AI mengembalikan format: {"query": "(\"Dental Caries\" OR \"Tooth Decay\") AND \"Children\""}
        // Jika format key berbeda, kita ambil nilai pertama dari objek tersebut
        return data.query || Object.values(data)[0];
    } catch (error) {
        console.error("AI Query Gen Error:", error);
        return rawTopik; // Fallback ke topik asli jika AI gagal
    }
}

// --- FUNGSI HELPER: API PUBMED ---
async function fetchPubMed(query, tahunAwal, tahunAkhir) {
    try {
        let dateFilter = "";
        if (tahunAwal || tahunAkhir) {
            const min = tahunAwal || 1900;
            const max = tahunAkhir || new Date().getFullYear();
            dateFilter = `&datetype=pdat&mindate=${min}&maxdate=${max}`;
        }

        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=3${dateFilter}`;
        const searchRes = await axios.get(searchUrl);
        const ids = searchRes.data.esearchresult.idlist;
        
        if (!ids || ids.length === 0) return null; // Mengembalikan null agar bisa ditangkap oleh sistem Fallback

        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
        const summaryRes = await axios.get(summaryUrl);
        const summaries = summaryRes.data.result;

        let resultText = "";
        ids.forEach((id, index) => {
            const title = summaries[id].title;
            const pubDate = summaries[id].pubdate || 'N/A';
            resultText += `**${index + 1}.** [${title}](https://pubmed.ncbi.nlm.nih.gov/${id}/) (${pubDate})\n\n`;
        });
        return resultText.trim();
    } catch (error) {
        console.error("PubMed API Error:", error);
        return null;
    }
}

// --- MAIN MODULE ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('jurnal')
        .setDescription('Cari referensi jurnal klinis dan riset medis secara instan')
        .addStringOption(option =>
            option.setName('topik')
                .setDescription('Topik medis atau kueri pencarian')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('bantu_ai')
                .setDescription('Otomatis rakit Advanced Boolean Query menggunakan AI?')
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
        await interaction.deferReply();

        const rawTopik = interaction.options.getString('topik');
        const gunakanAI = interaction.options.getBoolean('bantu_ai') || false;
        const tAwal = interaction.options.getInteger('tahun_awal');
        const tAkhir = interaction.options.getInteger('tahun_akhir');
        const currentYear = new Date().getFullYear();

        // 1. Penentuan Kueri Pencarian
        let finalQuery = rawTopik;
        let isOptimized = false;

        if (gunakanAI) {
            finalQuery = await generateOptimizedQuery(rawTopik);
            isOptimized = (finalQuery !== rawTopik);
        }

        // 2. Persiapan Tautan (Links)
// 2. Persiapan Tautan (Links) dengan Proteksi Discord API
        let queryEncoded = encodeURIComponent(finalQuery);
        let linkScholar = `https://scholar.google.com/scholar?q=${queryEncoded}`;
        let linkPubMed = `https://pubmed.ncbi.nlm.nih.gov/?term=${queryEncoded}`;
        
        // --- PROTEKSI MUTLAK LIMIT 512 KARAKTER DISCORD ---
        let isUrlCapped = false;
        if (linkScholar.length > 500 || linkPubMed.length > 500) {
            // Jika melebihi batas, URL tombol dikembalikan ke topik mentah
            const rawEncoded = encodeURIComponent(rawTopik);
            linkScholar = `https://scholar.google.com/scholar?q=${rawEncoded}`;
            linkPubMed = `https://pubmed.ncbi.nlm.nih.gov/?term=${rawEncoded}`;
            isUrlCapped = true;
        }

        let infoTahun = "Semua Waktu";
        if (tAwal || tAkhir) {
            const min = tAwal || 1900;
            const max = tAkhir || currentYear;
            infoTahun = `${min} - ${max}`;
            linkScholar += `&as_ylo=${min}&as_yhi=${max}`;
            linkPubMed += `&filter=years.${min}-${max}`;
        }

        // 3. Eksekusi Pencarian PubMed
        const pubMedData = await fetchPubMed(finalQuery, tAwal, tAkhir);

        // 4. Pembangunan Antarmuka Visual
        const embed = new EmbedBuilder()
            .addFields(
                { name: 'Topik Asli', value: `\`${rawTopik}\``, inline: true },
                { name: 'Rentang Tahun', value: `\`${infoTahun}\``, inline: true }
            )
            .setFooter({ text: isOptimized ? 'Kueri dioptimalkan secara otomatis oleh AI' : 'Pencarian Kueri Mentah (Raw)' })
            .setTimestamp();

        // Tambahkan peringatan jika URL terpaksa dipotong oleh sistem
        const warningText = isUrlCapped ? `\n\n⚠️ *Kueri AI terlalu panjang untuk tombol Discord. Tombol di bawah menggunakan topik asli. Salin kueri di atas secara manual untuk hasil maksimal.*` : "";

        // --- SKENARIO A: PUBMED MENDAPATKAN HASIL ---
        if (pubMedData) {
            embed.setColor('#2ECC71')
                 .setTitle('📚 Literatur Medis Ditemukan')
                 .setDescription(`**Kueri Pencarian:**\n\`\`\`${finalQuery}\`\`\`\n**📑 Top 3 PubMed:**\n${pubMedData}${warningText}`);
        } 
        // --- SKENARIO B: PUBMED KOSONG (FALLBACK KE SCHOLAR) ---
        else {
            embed.setColor('#E74C3C')
                 .setTitle('⚠️ PubMed Nihil / Tidak Ditemukan')
                 .setDescription(`Sistem tidak menemukan artikel di pangkalan data PubMed untuk kueri ini.\n\n**Tindakan Disarankan:**\nSilakan salin (*copy*) kueri yang telah dirakit di bawah ini dan cari secara manual di **Google Scholar**:\n\`\`\`${finalQuery}\`\`\`${warningText}`);
        }

        // 5. Perakitan Tombol Eksternal
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Buka di Google Scholar').setStyle(ButtonStyle.Link).setURL(linkScholar),
            new ButtonBuilder().setLabel('Buka di PubMed').setStyle(ButtonStyle.Link).setURL(linkPubMed)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
    },
};