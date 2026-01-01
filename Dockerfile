# Gunakan image Node.js yang ringan
FROM node:18-alpine

# Set folder kerja di dalam container
WORKDIR /app

# --- UPDATE DI SINI ---
# Tambahkan 'font-noto' agar teks di gambar terbaca (tidak kotak-kotak)
# Alpine menggunakan 'apk', bukan 'apt-get'
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    pango-dev \
    giflib-dev \
    ffmpeg \
    font-noto \
    font-noto-emoji

# Copy package.json dulu
COPY package.json ./

# Install library
RUN npm install

# Copy seluruh kode bot
COPY . .

# Jalankan bot
CMD ["node", "index.js"]