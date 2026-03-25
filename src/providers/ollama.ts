/**
 * Ollama provider using the REST API (no SDK needed).
 */

import { LLMProvider } from "../types";

export class OllamaProvider implements LLMProvider {
  name = "ollama";

  constructor(
    private baseUrl: string = "http://localhost:11434",
    private model: string = "llama3"
  ) {}

  async *stream(
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Ollama error (${response.status}): ${text || "Is Ollama running?"}`
      );
    }

    if (!response.body) {
      throw new Error("No response body from Ollama");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  }
}
