const { GoogleGenAI, mcpToTool } = require("@google/genai");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const axios = require("axios");
const User = require("../models/User"); // Import Model Database
global.EventSource = require("eventsource"); 

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
    let mcpClient;
    try {
      // 1. Setup Koneksi MCP
      mcpClient = new Client({ name: "amamiya-discord", version: "1.0.0" });
      await mcpClient.connect(new SSEClientTransport(new URL("https://mcp.revanetic.my.id/sse/")));

      // 2. DATABASE: Ambil atau Buat User Baru
      let user = await User.findOne({ userId });
      if (!user) {
          user = await User.create({ userId, username, chatHistory: [] });
      }

      // 3. DATABASE: Update History User (Input Baru)
      let userParts = [{ text: message }];
      if (imageUrl) {
          const imagePart = await urlToGenerativePart(imageUrl, mimeType);
          userParts.push(imagePart);
      }

      // Push chat user ke array history database
        user.chatHistory.push({ role: 'user', parts: userParts });
      
      // LOGIC AMAN: Ambil history dan bersihkan formatnya
      const historyForGemini = user.chatHistory
          .slice(-20) // Ambil 20 chat terakhir
          .map(h => {
              return {
                  role: h.role,
                  parts: h.parts.map(p => {
                      // Cek apakah ini bagian File (Gambar/PDF)
                      if (p.inlineData && p.inlineData.data) {
                          return {
                              inlineData: {
                                  data: p.inlineData.data, // Pastikan data terambil
                                  mimeType: p.inlineData.mimeType
                              }
                          };
                      }
                      // Jika bukan file, berarti teks
                      return { text: p.text || "" }; 
                  })
              };
          });

      // 4. Generate Jawaban
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const systemInstruction = `
        Kamu adalah Amamiya, asisten mahasiswa FKG.
        User saat ini: ${username} (Level ${user.level}).
        Gaya bicara: Ramah, logis, medis.
        Gunakan tools MCP jika relevan.
      `.trim();

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: historyForGemini, // Kirim history dari DB
        config: {
          systemInstruction,
          tools: [mcpToTool(mcpClient, { allowAll: true })],
        },
      });

      const parts = result?.candidates?.[0]?.content?.parts;
      let finalResponseText = Array.isArray(parts)
        ? parts.map((p) => p.text).filter(Boolean).join("\n")
        : "Maaf, saya tidak bisa memproses jawaban.";

      // 5. DATABASE: Simpan Jawaban Bot & Update XP
      user.chatHistory.push({ role: 'model', parts: [{ text: finalResponseText }] });
      user.xp += 10; // Tambah 10 XP setiap tanya

      user.lastInteraction = new Date();
      await user.save(); // Simpan ke MongoDB

      return finalResponseText;

    } catch (error) {
      console.error("❌ Gemini DB Error:", error);
      return `Maaf, ada gangguan sistem: ${error.message}`;
    } finally {
      if (mcpClient) await mcpClient.close();
    }
  }
}

module.exports = GeminiAi;