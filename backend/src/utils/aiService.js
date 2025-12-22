const OpenAI = require("openai");

// Configuration
const OPENROUTER_API_KEY = process.env.AI_API_KEY;
const SITE_URL = process.env.CLIENT_URL || "http://localhost:5173";
const APP_NAME = "SafeLynx";

const generateDocumentSummary = async (text) => {
    // 1. Validate Input
    if (!text || text.length < 50) {
        throw new Error("Insufficient text content for summary.");
    }

    // 2. Setup Client
    if (!OPENROUTER_API_KEY) {
        throw new Error("AI API Key is NOT configured. Please check .env (AI_API_KEY).");
    }

    const openai = new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": SITE_URL,
            "X-Title": APP_NAME,
        },
    });

    // 3. System Prompt
    const systemPrompt = `You are an AI document assistant.
Summarize the document clearly in bullet points.
Include:
• Purpose of the document
• Key points
• Important names, dates, or IDs
• Any actions or conclusions
Keep it concise and easy to understand.`;

    try {
        console.log(`[AI-SERVICE] Requesting summary (Length: ${text.length} chars)...`);

        // 4. Call API
        // Truncate if insanely large to avoid token limits (approx 100k chars safe for Flash)
        const safeText = text.substring(0, 100000);

        const completion = await openai.chat.completions.create({
            model: "google/gemini-flash-1.5",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Document Content:\n\n${safeText}` },
            ],
        });

        const summary = completion.choices[0].message.content;
        return summary;
    } catch (error) {
        console.error("[AI-SERVICE] Error:", error);
        throw new Error(error.message || "Failed to generate summary via AI.");
    }
};

module.exports = { generateDocumentSummary };
