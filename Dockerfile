# Gunakan Node.js versi 22 (Wajib untuk pdf-parse v2)
FROM node:22-alpine

# Set folder kerja di dalam container
WORKDIR /app

# Gabungkan instalasi library OS agar image lebih ringan dan optimal
# Termasuk build-base & dev tools untuk kompilasi Canvas
# Termasuk ghostscript & graphicsmagick untuk pdf2pic
# Termasuk ffmpeg, python3, curl untuk yt-dlp
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    ffmpeg \
    python3 \
    curl \
    font-noto \
    font-noto-emoji \
    ghostscript \
    graphicsmagick

# Download yt-dlp versi terbaru langsung dari GitHub
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Copy konfigurasi dependensi
COPY package*.json ./

# Install library NPM
RUN npm install

# Copy seluruh kode bot
COPY . .

# Jalankan bot
CMD ["node", "index.js"]