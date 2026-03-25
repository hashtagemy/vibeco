/**
 * Google Gemini provider using the REST API.
 */

import { LLMProvider } from "../types";

export class GeminiProvider implements LLMProvider {
  name = "gemini";

  constructor(
    private apiKey: string,
    private model: string = "gemini-2.0-flash"
  ) {}

  async *stream(
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 4096,
        },
      }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini error (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("No response body from Gemini");
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
        if (!line.startsWith("data: ")) {
          continue;
        }
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") {
          continue;
        }
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield text;
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}
