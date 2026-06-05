import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Google GenAI client safely
const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. AI features might fail.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// 1. API Route: Generate highly customized Python AI/ML projects
app.post("/api/project/generate", async (req, res) => {
  try {
    const preferences = req.body;
    const { skillLevel, targetArea, timeline, focus, additionalPrompt } = preferences;

    if (!skillLevel || !targetArea || !timeline || !focus) {
      return res.status(400).json({ error: "Missing required preferences fields" });
    }

    const ai = getGeminiClient();

  const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            tagline: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            estimatedTime: { type: Type.STRING },
            focusArea: { type: Type.STRING },
            targetMetrics: { type: Type.STRING },
            problemStatement: { type: Type.STRING },
            datasetDetails: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                urlOrSource: { type: Type.STRING },
                dataType: { type: Type.STRING }
              },
              required: ["name", "description", "urlOrSource", "dataType"]
            },
            architecture: { type: Type.STRING, description: "ASCII diagram or modular flow description representing pipeline" },
            phases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  tasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        notes: { type: Type.STRING }
                      },
                      required: ["id", "label"]
                    }
                  }
                },
                required: ["title", "duration", "tasks"]
              }
            },
            files: {
              type: Type.OBJECT,
              description: "Files mapping filename/filepath to complete written code content",
              properties: {} // Let it accept dynamic filename keys
            }
          },
          required: ["title", "tagline", "difficulty", "estimatedTime", "focusArea", "targetMetrics", "problemStatement", "datasetDetails", "architecture", "phases", "files"]
        }
      }
    });

    const textOutput = response.text || "{}";
    const cleanedText = textOutput.trim();

    // Parse the JSON safely
    const parsedProject = JSON.parse(cleanedText);
    res.json(parsedProject);

  } catch (error: any) {
    console.error("Project generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate project structure" });
  }
});

// 2. API Route: Dynamic AI Advisor Chat/Co-Pilot
app.post("/api/project/chat", async (req, res) => {
  try {
    const { messages, projectContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are "AI Advisor Co-Pilot", a friendly, brilliant companion for a Python AI/ML engineer.
You are helping the user build their newly generated project: "${projectContext?.title || "AI/ML Project"}".
The project description is: ${projectContext?.problemStatement || "Developing machine learning architectures"}.
The tagline is: ${projectContext?.tagline || ""}.
Target metrics: ${projectContext?.targetMetrics || ""}.

Answer their questions specifically, providing:
1. Genuine step-by-step PyTorch, scikit-learn, TensorFlow, or FastAPI code help if asked.
2. Best practices for committing to GitHub, structuring repositories, or deploying to Hugging Face / AWS / Docker.
3. Realistic debugging tips (e.g. tracking CUDA out-of-memory errors, gradient exploding, overfitting, low F1 scores).
Keep your tone encouraging, knowledgeable, concise, and professional. Avoid generic answers.`;

    // Convert messages array to model chat system rules
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "model" ? "model" as const : "user" as const,
      parts: [{ text: m.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    res.json({ text: response.text || "I'm ready to help you build this project!" });

  } catch (error: any) {
    console.error("Chat co-pilot error:", error);
    res.status(500).json({ error: error.message || "Failed to communicate with project advisor" });
  }
});

// Setup Vite & Static Assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
