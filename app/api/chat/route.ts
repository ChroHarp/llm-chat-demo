  import { NextRequest } from 'next/server';
  import { getGeminiClient } from '@/lib/googleClient';

  export async function POST(req: NextRequest) {
    const { messages } = await req.json();
    const model = getGeminiClient();
    const history = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await model.generateContentStream({
      contents: history,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.8 },
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(`data: ${JSON.stringify({ delta: text })}\n\n`);
        }
        controller.enqueue(`data: ${JSON.stringify({ done: true })}\n\n`);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
