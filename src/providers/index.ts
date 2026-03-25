/**
 * Provider factory - creates the appropriate LLM provider.
 * All settings read from VSCode settings.json.
 */

import * as vscode from "vscode";
import { LLMProvider } from "../types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OllamaProvider } from "./ollama";
import { BedrockProvider } from "./bedrock";
import { GeminiProvider } from "./gemini";

export function createProvider(): LLMProvider {
  const config = vscode.workspace.getConfiguration("vibeco");
  const providerName = config.get<string>("provider", "");
  const apiKey = config.get<string>("apiKey", "");
  const model = config.get<string>("model", "");
  const ollamaUrl = config.get<string>("ollamaUrl", "http://localhost:11434");

  switch (providerName) {
    case "anthropic":
      if (!apiKey) {
        throw new Error(
          "Anthropic API key is required.\n\n" +
            "Set it in Settings (Cmd+,) → search 'vibeco'"
        );
      }
      return new AnthropicProvider(apiKey, model || undefined);

    case "openai":
      if (!apiKey) {
        throw new Error(
          "OpenAI API key is required.\n\n" +
            "Set it in Settings (Cmd+,) → search 'vibeco'"
        );
      }
      return new OpenAIProvider(apiKey, model || undefined);

    case "ollama":
      return new OllamaProvider(ollamaUrl, model || "llama3");

    case "bedrock": {
      const awsAccessKeyId = config.get<string>("awsAccessKeyId", "");
      const awsSecretAccessKey = config.get<string>("awsSecretAccessKey", "");
      const awsRegion = config.get<string>("awsRegion", "us-east-1");
      if (!awsAccessKeyId || !awsSecretAccessKey) {
        throw new Error(
          "AWS credentials are required for Bedrock.\n\n" +
            "Set them in Settings (Cmd+,) → search 'vibeco'"
        );
      }
      return new BedrockProvider(awsRegion, model || undefined, awsAccessKeyId, awsSecretAccessKey);
    }

    case "gemini":
      if (!apiKey) {
        throw new Error(
          "Google API key is required.\n\n" +
            "Set it in Settings (Cmd+,) → search 'vibeco'"
        );
      }
      return new GeminiProvider(apiKey, model || undefined);

    default:
      if (apiKey) {
        return new AnthropicProvider(apiKey, model || undefined);
      }

      throw new Error(
        "No provider configured.\n\n" +
          "Click the Vibeco icon in the sidebar to set up your provider."
      );
  }
}
