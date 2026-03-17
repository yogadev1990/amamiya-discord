require('dotenv').config();
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

// =====================
// CONFIG
// =====================
const AUTH_TOKEN = process.env.MULFU_TOKEN;
const AUTH_TOKEN2 = process.env.MULFU_TOKEN2;
const BEARER = process.env.MULFU_BEARER;

const TEMP_FOLDER = path.join(__dirname, "temp");
const OUTPUT_FOLDER = path.join(__dirname, "reports");

// Pastikan folder selalu ada saat bot pertama kali dijalankan
if (!fs.existsSync(TEMP_FOLDER)) fs.mkdirSync(TEMP_FOLDER, { recursive: true });
if (!fs.existsSync(OUTPUT_FOLDER)) fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

// =====================
// HELPER FUNCTIONS
// =====================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function generateTitle(filename) {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    // Hapus karakter aneh dari nama file untuk menghindari masalah sistem file
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, ""); 
    return `turnitin_${ts}_${rand}_${safeName}`;
}

// FUNGSI AUTO-DELETE FILE LAMA (Membersihkan file lebih tua dari 1 jam)
function cleanOldFiles(directory, maxAgeMs = 3600000) {
    fs.readdir(directory, (err, files) => {
        if (err) return console.error(`[Cleanup] Gagal membaca direktori ${directory}`, err);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(directory, file);
            fs.stat(filePath, (err, stat) => {
                if (err) return;
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.unlink(filePath, err => {
                        if (err) console.error(`[Cleanup] Gagal menghapus file lama: ${filePath}`);
                    });
                }
            });
        });
    });
}

// =====================
// API WRAPPERS
// =====================
async function upload(filePath) {
    const form = new FormData();
    form.append("files[]", fs.createReadStream(filePath));
    form.append("type", "regular");
    form.append("exc_biblio", "false");
    form.append("exc_quote", "false");
    form.append("exc_match", "0");

    const res = await axios.post("https://mulfu.co/api/turnitin/upload", form, {
        headers: {
            ...form.getHeaders(),
            cookie: `auth-token=${AUTH_TOKEN}`
        }
    });

    if (!res.data?.data?.request_id) throw new Error("Upload gagal: request_id tidak ditemukan dari API.");
    return res.data.data.request_id;
}

async function payment(request_id, title) {
    const payload = {
        request_id,
        phone_number: "6285159199040",
        voucher: "",
        is_using_token: true,
        file: {
            title,
            first_author: "bot",
            second_author: "",
            exclude_bibliography: false,
            exclude_quotes: false,
            exclude_match: false
        }
    };

    const res = await axios.post("https://mulfu.co/api/turnitin/make-payment2", payload, {
        headers: {
            authorization: `Bearer ${BEARER}`,
            cookie: `auth-token=${AUTH_TOKEN}`,
            "content-type": "application/json"
        }
    });

    if (res.data.error !== 0) throw new Error("Payment gagal diproses oleh sistem.");
}

async function getHistory() {
    const res = await axios.get("https://mulfu.co/api/history/plagiarism-regular?page=1", {
        headers: {
            authorization: `Bearer ${BEARER}`,
            cookie: `auth-token=${AUTH_TOKEN}`
        }
    });
    return res.data.data;
}

async function waitResult(title, maxAttempts = 60) {
    // maxAttempts = 60 iterasi * 5 detik = 5 menit maksimal tunggu
    let attempts = 0;
    while (attempts < maxAttempts) {
        attempts++;
        const history = await getHistory();
        const item = history[0]

        if (item) {
            if (item.status === "completed") return item;
            if (item.status === "failed" || item.status === "error") throw new Error("Pengecekan gagal di pihak Turnitin.");
        }
        await sleep(5000);
    }
    throw new Error("Waktu tunggu habis (Timeout). API pihak ketiga tidak merespons dalam waktu 5 menit.");
}

async function downloadReport(item, outputPath) {
    const fileId = item.id;
    const url = `https://mulfu.co/api/download/${fileId}?token=${AUTH_TOKEN2}`;
    
    const res = await axios({
        url,
        method: "GET",
        responseType: "stream"
    });

    const writer = fs.createWriteStream(outputPath);
    res.data.pipe(writer);

    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

    return item.result.similarity;
}

// =====================
// DISCORD COMMAND
// =====================
module.exports = {
    data: new SlashCommandBuilder()
        .setName("turnitin")
        .setDescription("Cek similarity Turnitin via Amamiya")
        .addAttachmentOption(option =>
            option.setName("file")
                .setDescription("Upload file PDF")
                .setRequired(true)
        ),

    async execute(interaction) {
        const file = interaction.options.getAttachment("file");

        if (file.contentType !== "application/pdf") {
            return interaction.reply({ content: "❌ File yang diunggah harus berformat PDF.", ephemeral: true });
        }

        await interaction.deferReply();

        // Jalankan auto-cleanup file lama secara asinkron di belakang layar setiap kali command dijalankan
        cleanOldFiles(TEMP_FOLDER);
        cleanOldFiles(OUTPUT_FOLDER);

        const title = generateTitle(file.name);
        const tempPath = path.join(TEMP_FOLDER, `${title}_input.pdf`);
        const reportPath = path.join(OUTPUT_FOLDER, `${title}_report.pdf`);

        // Helper untuk update UI
        const updateUI = async (status, desc, color = 0xFEE75C) => {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle("🔍 Pengecekan Turnitin")
                .setDescription(`**Status:** ${status}\n${desc}`)
                .setFooter({ text: "Turnitin by Amamiya" });
            await interaction.editReply({ embeds: [embed] });
        };

        try {
            // STEP 1: Download dari Discord
            await updateUI("Mengunduh File", "Menyimpan file dokumen Anda ke server bot...");
            const res = await axios({ url: file.url, method: "GET", responseType: "stream" });
            const writer = fs.createWriteStream(tempPath);
            res.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
            });

            // STEP 2: Upload ke API
            await updateUI("Mengunggah", "Mengunggah dokumen ke sistem Turnitin...");
            const request_id = await upload(tempPath);

            // STEP 3: Payment
            await updateUI("Verifikasi", "Memproses pembayaran / verifikasi kuota...");
            await payment(request_id, title);

            // STEP 4: Menunggu Hasil
            await updateUI("Memproses Pengecekan", "Menunggu hasil dari Turnitin. Ini biasanya memakan waktu 1-3 menit...", 0x5865F2);
            const result = await waitResult(title);

            // STEP 5: Unduh Report
            await updateUI("Menyiapkan Hasil", "Pengecekan selesai! Mengunduh laporan PDF...");
            const similarity = await downloadReport(result, reportPath);

            // STEP 6: Finalisasi & Kirim Hasil
            const finalEmbed = new EmbedBuilder()
                .setColor(0x57F287) // Hijau Sukses
                .setTitle("✅ Pengecekan Selesai")
                .addFields(
                    { name: "Nama File", value: file.name, inline: false },
                    { name: "Indeks Plagiarisme", value: `**${similarity}%**`, inline: true }
                )
                .setFooter({ text: "Turnitin by Amamiya" })
                .setTimestamp();

            const attachment = new AttachmentBuilder(reportPath, { name: `${title.substring(0, 15)}_${similarity}%.pdf` });

            await interaction.editReply({ embeds: [finalEmbed], files: [attachment] });

        } catch (err) {
            console.error(`[Turnitin Error] ${err.message}`);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245) // Merah Error
                .setTitle("❌ Pengecekan Gagal")
                .setDescription(`Terjadi kesalahan sistem:\n\`${err.message}\``);
            
            await interaction.editReply({ embeds: [errorEmbed], files: [] });
        } finally {
            // STEP 7: CLEANUP - Pastikan file dihapus LANGSUNG setelah selesai/gagal agar tidak membebani VPS
            if (fs.existsSync(tempPath)) {
                fs.unlink(tempPath, (err) => { if (err) console.error(`Gagal menghapus temp file: ${tempPath}`); });
            }
            if (fs.existsSync(reportPath)) {
                fs.unlink(reportPath, (err) => { if (err) console.error(`Gagal menghapus report file: ${reportPath}`); });
            }
        }
    }
};
