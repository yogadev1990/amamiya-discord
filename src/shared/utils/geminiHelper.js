const { GoogleGenAI } = require("@google/genai");
const axios = require("axios");
const User = require("../models/User"); // Import Model Database
require("dotenv").config();

// Fungsi helper: Download gambar
async function urlToGenerativePart(url, mimeType) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return {
        inlineData: {
            data: Buffer.from(response.data).toString('base64'),
            mimeType
        }
    };
}

class GeminiAi {
  static async run(userId, username, message, imageUrl = null, mimeType = null) {
    try {
      // 1. DATABASE: Ambil atau Buat User Baru
      let user = await User.findOne({ userId });
      if (!user) {
          user = await User.create({ userId, username, chatHistory: [] });
      }

      // 2. SETUP INPUT SAAT INI (Teks + File)
      let currentInputParts = [{ text: message }];
      if (imageUrl) {
          const imagePart = await urlToGenerativePart(imageUrl, mimeType);
          currentInputParts.push(imagePart);
      }

      // SIMPAN KE DATABASE: HANYA TEKS SAJA (Mencegah MongoDB Overload)
      user.chatHistory.push({ role: 'user', parts: [{ text: message }] });
      
      // Ambil history percakapan dari DB
      let historyForGemini = user.chatHistory
          .slice(-20)
          .map(h => ({
              role: h.role,
              parts: h.parts.map(p => ({ text: p.text || "" }))
          }));

      historyForGemini.pop(); 
      historyForGemini.push({ role: 'user', parts: currentInputParts });
      
      // 3. Generate Jawaban langsung via Gemini API
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const systemInstruction = `
        Kamu adalah Amamiya, asisten akademik pintar mahasiswa Kedokteran Gigi (KG) UNSRI.
        User saat ini: ${username} (Level ${user.level}).
        Gaya bicara: Ramah, logis, medis, edukatif, dan suportif.
      `.trim();

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: historyForGemini,
        config: {
          systemInstruction,
        },
      });

      const parts = result?.candidates?.[0]?.content?.parts;
      let finalResponseText = Array.isArray(parts)
        ? parts.map((p) => p.text).filter(Boolean).join("\n")
        : "Maaf, saya tidak bisa memproses jawaban.";

      // 4. DATABASE: Simpan Jawaban Bot & Update XP
      user.chatHistory.push({ role: 'model', parts: [{ text: finalResponseText }] });
      user.xp += 10;
      user.lastInteraction = new Date();
      await user.save();

      return finalResponseText;

    } catch (error) {
      console.error("❌ Gemini Error:", error);
      return `Maaf, ada gangguan sistem: ${error.message}`;
    }
  }
}

module.exports = GeminiAi;