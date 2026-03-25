/**
 * OpenAI provider using the official SDK.
 */

import OpenAI from "openai";
import { LLMProvider } from "../types";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string = "gpt-4o"
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async *stream(
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    for await (const chunk of response) {
      if (signal?.aborted) {
        return;
      }

      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}
