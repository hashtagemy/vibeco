/**
 * Shared type definitions for Vibeco extension.
 */

/** Common interface for all LLM providers. */
export interface LLMProvider {
  /** Provider display name (e.g. "anthropic", "openai"). */
  name: string;

  /**
   * Stream a response from the LLM.
   * Yields text chunks as they arrive.
   */
  stream(
    prompt: string,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<string>;
}

/** Data sent from the extension to the provider for explanation. */
export interface ExplainRequest {
  selectedCode: string;
  fileContent: string;
  filePath: string;
  projectStructure: string;
  language: string;
}
