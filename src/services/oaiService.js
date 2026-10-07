const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const DB_PATH = path.join(__dirname, '../data/skripsi_db.json');
const OAI_BASE_URL = 'https://repository.unsri.ac.id/cgi/oai2';
const DENTISTRY_SET = '7375626A656374733D52:524B'; // Subjects = R Medicine: RK Dentistry

let inMemoryCache = null;
let lastCacheLoad = 0;

/**
 * Deteksi Departemen / Spesialisasi Kedokteran Gigi dari judul & abstrak
 */
function detectSpecialization(title = '', abstract = '', subjects = []) {
    const combined = `${title} ${abstract} ${Array.isArray(subjects) ? subjects.join(' ') : subjects}`.toLowerCase();

    if (/orto|maloklusi|bracket|kawat gigi|cephalometri|sefalometri|angaule/i.test(combined)) {
        return 'Ortodonsia';
    }
    if (/karies|tambal|komposit|endodontik|saluran akar|pulpa|tumpatan|resin/i.test(combined)) {
        return 'Konservasi Gigi';
    }
    if (/periodont|gingiv|gingiva|plak|kalkulus|karang gigi|poket|sulkus/i.test(combined)) {
        return 'Periodonsia';
    }
    if (/anak|pedodonti|pediatrik|desidui|gigi susu|kebiasaan buruk|bruxism anak/i.test(combined)) {
        return 'Pedodonsia';
    }
    if (/ekstraksi|bedah|pencabutan|impaksi|odontektomi|fraktur mandibula|anestesi/i.test(combined)) {
        return 'Bedah Mulut';
    }
    if (/tiruan|geligi|protesa|denture|jembatan|mahkota|kehilangan gigi/i.test(combined)) {
        return 'Prostodonsia';
    }
    if (/masyarakat|puskesmas|penyuluhan|ohis|dmf|perilaku|pengetahuan ibu|sd negeri/i.test(combined)) {
        return 'IKGM';
    }
    if (/saliva|bakteri|streptococcus|candida|flora|sitologi|histopatologi/i.test(combined)) {
        return 'Oral Biologi';
    }
    if (/radiograf|panoramik|periapikal|cbct|rontgen/i.test(combined)) {
        return 'Radiologi Kedokteran Gigi';
    }
    if (/sariawan|stomatitis|ulkus|mukosa|kanker mulut|leukoplakia/i.test(combined)) {
        return 'Penyakit Mulut';
    }
    return 'Umum / Lainnya';
}

/**
 * Memuat database skripsi lokal ke memori (caching cepat)
 */
function getLocalSkripsi() {
    const now = Date.now();
    // Cache di memori selama 5 menit
    if (inMemoryCache && (now - lastCacheLoad < 300000)) {
        return inMemoryCache;
    }

    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            inMemoryCache = JSON.parse(raw);
            lastCacheLoad = now;
            return inMemoryCache;
        }
    } catch (err) {
        console.error('❌ Gagal membaca skripsi_db.json:', err.message);
    }

    return inMemoryCache || [];
}

/**
 * Pencarian lokal skripsi berbasis relevansi (responsif di Discord <50ms)
 */
function searchLocalSkripsi(query, limit = 5) {
    const data = getLocalSkripsi();
    if (!data || data.length === 0) return [];

    const queryClean = (query || '').toLowerCase().trim();
    if (!queryClean) return data.slice(0, limit);

    const tokens = queryClean.split(/\s+/).filter(t => t.length > 2);

    const scored = data.map(item => {
        let score = 0;
        const titleLower = (item.title || '').toLowerCase();
        const abstractLower = (item.abstract || '').toLowerCase();
        const specLower = (item.specialization || '').toLowerCase();

        // Exact match pada judul
        if (titleLower.includes(queryClean)) {
            score += 100;
        }

        // Token match
        for (const token of tokens) {
            if (titleLower.includes(token)) score += 15;
            if (specLower.includes(token)) score += 10;
            if (abstractLower.includes(token)) score += 3;
        }

        return { item, score };
    });

    return scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => s.item);
}

/**
 * Parsing XML dari OAI-PMH response menjadi format standar skripsi
 */
function parseOaiRecords(xmlString) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xmlString);
    const rawRecords = parsed?.['OAI-PMH']?.ListRecords?.record;
    if (!rawRecords) return { records: [], resumptionToken: null };

    const recordList = Array.isArray(rawRecords) ? rawRecords : [rawRecords];
    const results = [];

    for (const rec of recordList) {
        const header = rec.header;
        const dc = rec.metadata?.['oai_dc:dc'];
        if (!dc) continue;

        // Ambil ID eprint
        const identifier = header?.identifier || '';
        const idMatch = identifier.match(/:(\d+)$/);
        const id = idMatch ? idMatch[1] : String(Math.random());

        // Ambil author
        const creators = dc['dc:creator'];
        const authors = Array.isArray(creators) ? creators : (creators ? [creators] : ['Tanpa Nama']);

        // Ambil tahun
        const dateStr = dc['dc:date'] || '';
        const year = parseInt(dateStr.substring(0, 4)) || new Date().getFullYear();

        // Ambil title & abstract
        const title = (dc['dc:title'] || '').toString().trim();
        const abstract = (dc['dc:description'] || '').toString().trim();

        // Filter: Hanya S1 Kedokteran Gigi / Thesis
        const typeStr = JSON.stringify(dc['dc:type'] || '');
        const idenStr = JSON.stringify(dc['dc:identifier'] || '');
        const isS1 = typeStr.toLowerCase().includes('thesis') || idenStr.includes('RAMA_12201') || idenStr.includes('Undergraduate thesis');

        // URL eprint
        const url = dc['dc:relation'] || `http://repository.unsri.ac.id/${id}/`;

        // Departemen/Spesialisasi
        const specialization = detectSpecialization(title, abstract, dc['dc:subject']);

        if (title && isS1) {
            results.push({
                id: id,
                title: title,
                abstract: abstract,
                authors: authors,
                year: year,
                department: 'Dentistry',
                keywords: Array.isArray(dc['dc:subject']) ? dc['dc:subject'] : [dc['dc:subject'] || 'Dentistry'],
                institution: 'Sriwijaya University',
                degree_level: 'undergraduate',
                access: 'open',
                url: url,
                specialization: specialization
            });
        }
    }

    const resumptionToken = parsed?.['OAI-PMH']?.ListRecords?.resumptionToken;
    const nextToken = typeof resumptionToken === 'object' ? resumptionToken?.['#text'] : resumptionToken;

    return { records: results, resumptionToken: nextToken };
}

/**
 * Melakukan penarikan data baru dari OAI 2.0 Unsri dan menyimpannya ke cache
 */
async function harvestFromOai() {
    console.log('🔄 [OAI-PMH] Memulai pemeriksaan update skripsi dari repository.unsri.ac.id...');
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/xml, application/xml, */*'
        };

        if (process.env.UNSRI_WAF_COOKIE) {
            headers['Cookie'] = process.env.UNSRI_WAF_COOKIE;
        }

        const url = `${OAI_BASE_URL}?verb=ListRecords&metadataPrefix=oai_dc&set=${DENTISTRY_SET}`;
        const res = await axios.get(url, { headers, timeout: 15000 });

        if (res.status === 200 && typeof res.data === 'string' && res.data.includes('<OAI-PMH')) {
            const { records } = parseOaiRecords(res.data);
            if (records.length > 0) {
                mergeIntoCache(records);
                console.log(`✅ [OAI-PMH] Sukses memproses ${records.length} skripsi baru dari OAI Unsri.`);
                return records.length;
            }
        }
    } catch (err) {
        if (err.response?.status === 468) {
            console.warn('⚠️ [OAI-PMH] SafeLine WAF Unsri memblokir permintaan otomatis (HTTP 468). Menggunakan database cache lokal yang sudah ada.');
        } else {
            console.warn(`⚠️ [OAI-PMH] Gagal menghubungi OAI server: ${err.message}. Tetap menggunakan database cache lokal.`);
        }
    }
    return 0;
}

/**
 * Menggabungkan data baru ke database cache lokal tanpa duplikasi
 */
function mergeIntoCache(newRecords) {
    const existing = getLocalSkripsi();
    const map = new Map();

    for (const item of existing) {
        map.set(item.id || item.url, item);
    }

    let addedCount = 0;
    for (const item of newRecords) {
        const key = item.id || item.url;
        if (!map.has(key)) {
            map.set(key, item);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        const merged = Array.from(map.values());
        fs.writeFileSync(DB_PATH, JSON.stringify(merged, null, 2), 'utf8');
        inMemoryCache = merged;
        lastCacheLoad = Date.now();
        console.log(`💾 [OAI-PMH] Database skripsi diperbarui: +${addedCount} judul baru (Total: ${merged.length})`);
    }
}

/**
 * Menjadwalkan sinkronisasi berkala di latar belakang (tanpa menghambat bot)
 */
function startPeriodicHarvesting(intervalHours = 24) {
    const ms = intervalHours * 60 * 60 * 1000;
    console.log(`⏰ [OAI-PMH] Penjadwalan sync skripsi aktif (setiap ${intervalHours} jam).`);
    
    // Coba harvest awal setelah 30 detik bot start
    setTimeout(() => {
        harvestFromOai().catch(() => {});
    }, 30000);

    // Interval berkala
    setInterval(() => {
        harvestFromOai().catch(() => {});
    }, ms);
}

module.exports = {
    getLocalSkripsi,
    searchLocalSkripsi,
    parseOaiRecords,
    harvestFromOai,
    mergeIntoCache,
    startPeriodicHarvesting
};
