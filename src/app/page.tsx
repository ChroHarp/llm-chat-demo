'use client';

import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const assistantGreeting =
  "Hi, I'm your Gemini-powered assistant. Ask me anything!";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: assistantGreeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    let assistantText = "";
    let assistantCreated = false;
    let receivedDone = false;

    const processSegment = (segment: string) => {
      const line = segment.trim();
      if (!line.startsWith("data:")) return;

      const payloadText = line.slice(5).trim();
      if (!payloadText) return;

      let payload: { delta?: string; done?: boolean; error?: string };
      try {
        payload = JSON.parse(payloadText);
      } catch {
        console.warn("Unable to parse payload:", payloadText);
        return;
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      if (payload.delta) {
        assistantText += payload.delta;
        setMessages((prev) => {
          const updated = [...prev];
          if (
            !assistantCreated ||
            updated[updated.length - 1]?.role !== "assistant"
          ) {
            updated.push({ role: "assistant", content: assistantText });
            assistantCreated = true;
          } else {
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
          }
          return updated;
        });
      }

      if (payload.done) {
        receivedDone = true;
      }
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        const reason = await response.text();
        throw new Error(reason || "The assistant could not respond.");
      }

      if (!response.body) {
        throw new Error("No response body received from the assistant.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), {
          stream: !done,
        });

        const segments = buffer.split("\n\n");
        buffer = segments.pop() ?? "";

        for (const segment of segments) {
          processSegment(segment);
        }

        if (done || receivedDone) {
          break;
        }
      }

      if (buffer.trim()) {
        processSegment(buffer);
      }

      if (!assistantText) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I wasn't able to produce a response this time.",
          },
        ]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while talking to Gemini.";
      setError(message);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant") {
          updated[updated.length - 1] = {
            role: "assistant",
            content: message,
          };
        } else {
          updated.push({ role: "assistant", content: message });
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold">Gemini Chat</h1>
        <p className="text-sm text-slate-300">
          A lightweight chat experience powered by Google Gemini.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/60 p-4 shadow-inner"
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.length}`}
              className={`mb-4 flex ${
                message.role === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-white/5 text-slate-100 backdrop-blur"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-100">
                Thinking...
              </div>
            </div>
          )}
        </div>

        <form
          className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/60 p-4 shadow-lg sm:flex-row sm:items-end"
          onSubmit={sendMessage}
        >
          <label className="flex-1 text-sm text-slate-300">
            Ask Gemini
            <textarea
              className="mt-2 w-full resize-none rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
              placeholder="How can Gemini help today?"
              disabled={loading}
            />
          </label>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-blue-500 px-5 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50"
            disabled={loading || !input.trim()}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
        {error && (
          <p className="text-sm text-red-400" role="status">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
