import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json());

// ==================================================
// GEMINI
// ==================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ==================================================
// SYSTEM INSTRUCTION
// ==================================================

const SYSTEM_INSTRUCTION = `
You are Nari Sahayak, a simple and friendly government-service navigation assistant.

The target user is a first-time woman digital user who may not know English or technology.

Current demonstration service:
Pradhan Mantri Ujjwala Yojana (PMUY).

Rules:
1. Respond in the user's requested language.
2. Support Tamil, Telugu, Malayalam, Kannada, and Hindi.
3. Use very simple sentences.
4. Ask only one question at a time.
5. Never ask for Aadhaar numbers.
6. Never ask for OTPs.
7. Never ask for passwords or PINs.
8. Never request unnecessary sensitive information.
9. Do not invent eligibility requirements.
10. Do not claim that the user is definitely eligible.
11. Explain information in a beginner-friendly way.
12. If the user asks something outside the current service, explain that this prototype currently focuses on PMUY.
13. Guide the user toward the official government service when appropriate.

You are an assistant for guidance.
You are not the government authority.
`;

// ==================================================
// 🤖 CHAT API
// ==================================================

app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      language = "Tamil",
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    console.log("================================");
    console.log("🤖 GEMINI CHAT REQUEST");
    console.log("Language:", language);
    console.log("Message:", message);
    console.log("================================");

    const prompt = `
Preferred language: ${language}

User message:
${message}

Respond only in ${language}.
`;

    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",

        contents: prompt,

        config: {
          systemInstruction:
            SYSTEM_INSTRUCTION,
        },
      });

    const reply = response.text;

    console.log("✅ Gemini response generated");

    res.json({
      reply: reply,
    });

  } catch (error) {
    console.error(
      "❌ Gemini chat error:",
      error
    );

    res.status(500).json({
      error:
        error.message ||
        "Unable to process the request.",
    });
  }
});

// ==================================================
// 🔊 GEMINI TEXT-TO-SPEECH API
// ==================================================

app.post("/api/tts", async (req, res) => {
  try {
    const {
      text,
      language = "Tamil",
    } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    console.log("================================");
    console.log("🔊 GEMINI TTS REQUEST");
    console.log("Language:", language);
    console.log("Text length:", text.length);
    console.log("================================");

    const interaction =
      await ai.interactions.create({
        model: "gemini-3.8-flash-tts",

        input: [
          {
            type: "user_input",

            content: [
              {
                type: "text",

                text: text,

                annotations: [
                  {
                    type: "speech_metadata",

                    style:
                      "Speak the exact text naturally, clearly, warmly, and slowly in the language it is written in. Do not translate, shorten, summarize, or change the text.",
                  },
                ],
              },
            ],
          },
        ],

        response_format: {
          type: "audio",
        },

        generation_config: {
          speech_config: [
            {
              voice: "Kore",
            },
          ],
        },
      });

    // ==================================================
    // CHECK AUDIO
    // ==================================================

    if (
      !interaction.output_audio ||
      !interaction.output_audio.data
    ) {
      throw new Error(
        "Gemini did not return audio data."
      );
    }

    // ==================================================
    // CONVERT BASE64 → AUDIO BUFFER
    // ==================================================

    const audioBuffer = Buffer.from(
      interaction.output_audio.data,
      "base64"
    );

    console.log(
      "✅ TTS audio generated:",
      audioBuffer.length,
      "bytes"
    );

    // ==================================================
    // SEND AUDIO TO FRONTEND
    // ==================================================

    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "no-cache",
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error(
      "❌ TTS error:",
      error
    );

    res.status(500).json({
      error:
        error.message ||
        "Text-to-speech failed.",
    });
  }
});

// ==================================================
// ❤️ HEALTH CHECK
// ==================================================

app.get("/", (req, res) => {
  res.json({
    app: "Nari Sahayak",
    status: "running",
  });
});

// ==================================================
// 🚀 START SERVER
// ==================================================

const PORT =
  process.env.PORT || 3001;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Nari Sahayak backend running on port ${PORT}`
    );
  }
);