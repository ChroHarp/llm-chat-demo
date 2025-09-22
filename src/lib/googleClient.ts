import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_AI_STUDIO_API_KEY is not set");
}

export function getGeminiClient() {
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: "gemini-1.5-flash",
  });
}
