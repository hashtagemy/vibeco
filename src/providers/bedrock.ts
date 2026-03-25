/**
 * AWS Bedrock provider using the AWS SDK.
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { LLMProvider } from "../types";

export class BedrockProvider implements LLMProvider {
  name = "bedrock";
  private client: BedrockRuntimeClient;

  constructor(
    private region: string = "us-east-1",
    private model: string = "anthropic.claude-3-5-sonnet-20241022-v2:0",
    accessKeyId?: string,
    secretAccessKey?: string
  ) {
    const clientConfig: any = { region };
    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }
    this.client = new BedrockRuntimeClient(clientConfig);
  }

  async *stream(
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.model,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    });

    const response = await this.client.send(command, {
      abortSignal: signal,
    });

    if (!response.body) {
      throw new Error("No response body from Bedrock");
    }

    for await (const event of response.body) {
      if (signal?.aborted) {
        return;
      }

      if (event.chunk?.bytes) {
        const decoded = new TextDecoder().decode(event.chunk.bytes);
        try {
          const parsed = JSON.parse(decoded);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}
