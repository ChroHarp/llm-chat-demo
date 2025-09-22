import { NextRequest } from "next/server";
import { getGeminiClient } from "@/lib/googleClient";

export const runtime = "edge";

type IncomingMessage = {
  role: string;
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : null;

    if (!messages) {
      return Response.json(
        { error: "The request body must include a messages array." },
        { status: 400 }
      );
    }

    const sanitizedMessages = (messages as IncomingMessage[])
      .filter(
        (message) =>
          message &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .slice(-20);

    const model = getGeminiClient();
    const history = sanitizedMessages.map((message) => ({
      role: message.role === "user" ? "user" : "model",
      parts: [{ text: message.content }],
    }));

    const response = await model.generateContentStream({
      contents: history,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          for await (const chunk of response.stream) {
            const text = chunk.text();
            if (text) {
              send({ delta: text });
            }
          }
          send({ done: true });
        } catch (error) {
          console.error("[chat] stream failure", error);
          send({ error: "Streaming response failed." });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[chat] request failure", error);
    return Response.json(
      { error: "Failed to generate a response from Gemini." },
      { status: 500 }
    );
  }
}
