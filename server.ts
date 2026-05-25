import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup high body limits for Base64 PDF processing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize GoogleGenAI client (lazy initialization / secure check)
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });
};

// API Endpoint for processing PDF PYQ and extracting structured quiz JSON
app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { pdfBase64, fileName } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: "Missing pdfBase64 payload" });
    }

    // Clean up base64 string (strip header if present)
    let cleanBase64 = pdfBase64;
    if (pdfBase64.includes(";base64,")) {
      cleanBase64 = pdfBase64.split(";base64,")[1];
    }

    const ai = getGeminiClient();

    // Define the schema using raw Type primitives
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        quiz_title: {
          type: Type.STRING,
          description: "A clear, descriptive title of the quiz extracted from the document header or content topic."
        },
        questions: {
          type: Type.ARRAY,
          description: "An array of standard multiple choice questions parsed from the document.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: "A unique short string or index identifier for this question (e.g., 'q1', 'q2')."
              },
              question_text: {
                type: Type.STRING,
                description: "The full text of the question. Extract the exact text cleanly without numbering prefix."
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of multiple choice options extracted from the question (exactly 4 options or whatever is available in the PDF)."
              },
              correct_option_index: {
                type: Type.INTEGER,
                description: "The zero-based index of the correct option (0 for Option A, 1 for Option B, 2 for Option C, 3 for Option D). Deduced from the PDF content or based on the correct answer key if present, or logically analyzed if missing."
              },
              explanation: {
                type: Type.STRING,
                description: "A comprehensive, pedagogical step-by-step explanation detailing why the chosen option is correct and why other options are incorrect."
              }
            },
            required: ["id", "question_text", "options", "correct_option_index", "explanation"]
          }
        }
      },
      required: ["quiz_title", "questions"]
    };

    const promptText = `Analyze the uploaded PDF document (which contains exam questions/Previous Year Questions) and extract its contents into a fully-structured interactive quiz.
Ensure all questions have exactly 4 multiple-choice options (or as present in the document).
Provide a descriptive title for this quiz based on the course/exam title or file name "${fileName || "PYQs"}".
Deduce the correct_option_index (0, 1, 2, or 3) logically.
Write a supportive, elaborate, and pedagogical explanation for each answer, explaining the logic clearly line-by-line so users can learn effectively in practice mode.`;

    const pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: cleanBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [pdfPart, promptText],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response returned from Gemini API");
    }

    const parsedJson = JSON.parse(resultText);
    return res.status(200).json(parsedJson);

  } catch (error: any) {
    console.error("Error generating quiz from PDF:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred while parsing the quiz PDF."
    });
  }
});

// Vite middleware & Static asset serving integration
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
