# Gunakan image Node.js yang ringan
FROM node:18-alpine

# Set folder kerja di dalam container
WORKDIR /app

# --- UPDATE DI SINI ---
# Tambahkan python3 dan curl untuk kebutuhan yt-dlp
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    pango-dev \
    giflib-dev \
    ffmpeg \
    python3 \
    curl \
    font-noto \
    font-noto-emoji

# Download yt-dlp versi terbaru langsung dari GitHub
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

RUN apk add --no-cache \
    nodejs-current \
    npm

RUN apk add --no-cache \
    ghostscript \
    graphicsmagick
    
# Copy package.json dulu
COPY package.json ./

# Install library
RUN npm install

# Copy seluruh kode bot
COPY . .

# Jalankan bot
CMD ["node", "index.js"]