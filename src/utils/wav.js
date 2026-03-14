function getWavHeader(pcmLength, sampleRate = 24000, channels = 1, bitsPerSample = 16) {

    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmLength, 4);
    header.write('WAVE', 8);

    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);

    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);

    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);

    header.writeUInt16LE(bitsPerSample, 34);

    header.write('data', 36);
    header.writeUInt32LE(pcmLength, 40);

    return header;

}

module.exports = { getWavHeader };