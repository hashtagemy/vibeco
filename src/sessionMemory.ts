/**
 * Session memory for Vibeco.
 * Keeps track of what has been explained in the current session,
 * so the LLM can reference previous explanations naturally.
 * Scoped per workspace - different projects get separate memories.
 */

import * as vscode from "vscode";

interface MemoryEntry {
  filePath: string;
  codeSnippet: string; // first 100 chars of selected code
  summary: string;     // first 200 chars of explanation
  timestamp: number;
}

export class SessionMemory {
  private memories = new Map<string, MemoryEntry[]>();
  private readonly MAX_ENTRIES = 20;

  /**
   * Get workspace key to isolate memories between projects.
   */
  private getWorkspaceKey(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return "no-workspace";
    }
    return folders[0].uri.toString();
  }

  /**
   * Get or create memory array for current workspace.
   */
  private getMemories(): MemoryEntry[] {
    const key = this.getWorkspaceKey();
    if (!this.memories.has(key)) {
      this.memories.set(key, []);
    }
    return this.memories.get(key)!;
  }

  /**
   * Add an explanation to session memory.
   */
  public add(filePath: string, selectedCode: string, explanation: string): void {
    const memories = this.getMemories();

    memories.push({
      filePath,
      codeSnippet: selectedCode.trim().substring(0, 100),
      summary: explanation.trim().substring(0, 200),
      timestamp: Date.now(),
    });

    // Keep only the last N entries
    if (memories.length > this.MAX_ENTRIES) {
      memories.splice(0, memories.length - this.MAX_ENTRIES);
    }
  }

  /**
   * Build a session context string for the prompt.
   * Returns null if no previous explanations exist.
   */
  public buildContext(): string | undefined {
    const memories = this.getMemories();

    if (memories.length === 0) {
      return undefined;
    }

    const lines = memories.map((m, i) => {
      return `${i + 1}. ${m.filePath}: "${m.codeSnippet}..." → ${m.summary}`;
    });

    return lines.join("\n");
  }

  /**
   * Clear memory for current workspace.
   */
  public clear(): void {
    const key = this.getWorkspaceKey();
    this.memories.delete(key);
  }

  /**
   * Clear all memories.
   */
  public clearAll(): void {
    this.memories.clear();
  }
}
