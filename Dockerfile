# Gunakan image Node.js yang ringan
FROM node:18-alpine

# Set folder kerja di dalam container
WORKDIR /app

# Install dependencies sistem (opsional, jaga-jaga butuh buat canvas/pdf)
RUN apk add --no-cache build-base g++ cairo-dev pango-dev giflib-dev

# Copy package.json dulu (biar cache layer optimal)
COPY package.json ./

# Install library
RUN npm install

# Copy seluruh kode bot
COPY . .

# Jalankan bot
CMD ["node", "index.js"]