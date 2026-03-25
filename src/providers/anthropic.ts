/**
 * Anthropic Claude provider using the official SDK.
 */

import Anthropic from "@anthropic-ai/sdk";
import { LLMProvider } from "../types";

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string = "claude-sonnet-4-20250514"
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async *stream(
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const response = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of response) {
      if (signal?.aborted) {
        response.abort();
        return;
      }

      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }
}
