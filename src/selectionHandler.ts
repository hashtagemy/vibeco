/**
 * Handles code selection events and triggers LLM explanations.
 */

import * as vscode from "vscode";
import { SidebarProvider } from "./sidebarProvider";
import { ExplainRequest } from "./types";
import { getSystemPrompt, buildUserPrompt, getFileSystemPrompt, buildFilePrompt, getFollowupSystemPrompt, buildFollowupPrompt } from "./prompts";
import { createProvider } from "./providers";
import { SessionMemory } from "./sessionMemory";

export class SelectionHandler {
  private debounceTimer: NodeJS.Timeout | undefined;
  private fileDebounceTimer: NodeJS.Timeout | undefined;
  private abortController: AbortController | undefined;
  private lastExplainedFile: string | undefined;
  private lastExplanation: string = "";
  private lastSelectedCode: string = "";
  private lastFilePath: string = "";
  private sessionMemory = new SessionMemory();

  constructor(private readonly sidebar: SidebarProvider) {}

  /**
   * Handle text editor selection change events with debounce.
   */
  public onSelectionChanged(
    event: vscode.TextEditorSelectionChangeEvent
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const editor = event.textEditor;
    const selection = editor.selection;

    if (selection.isEmpty) {
      return;
    }

    // Don't process if sidebar is not visible
    if (!this.sidebar.isVisible) {
      return;
    }

    const selectedText = editor.document.getText(selection);

    if (selectedText.trim().length < 10) {
      return;
    }

    const debounceMs = vscode.workspace
      .getConfiguration("vibeco")
      .get<number>("debounceMs", 800);

    this.debounceTimer = setTimeout(() => {
      this.sendExplanationRequest(editor, selectedText);
    }, debounceMs);
  }

  /**
   * Handle active editor change - explain the file's role.
   */
  public onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    if (!this.sidebar.isVisible) {
      return;
    }

    const explainOnFileOpen = vscode.workspace
      .getConfiguration("vibeco")
      .get<boolean>("explainOnFileOpen", true);

    if (!explainOnFileOpen) {
      return;
    }

    const filePath = editor.document.uri.fsPath;

    // Don't re-explain the same file
    if (filePath === this.lastExplainedFile) {
      return;
    }

    // Skip non-file schemes (output, debug console, etc.)
    if (editor.document.uri.scheme !== "file") {
      return;
    }

    if (this.fileDebounceTimer) {
      clearTimeout(this.fileDebounceTimer);
    }

    this.fileDebounceTimer = setTimeout(() => {
      this.lastExplainedFile = filePath;
      this.sendFileExplanation(editor);
    }, 1000);
  }

  /**
   * Explain the currently selected code (triggered by command).
   */
  public explainCurrentSelection(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("No active editor");
      return;
    }

    const selectedText = editor.document.getText(editor.selection);
    if (!selectedText.trim()) {
      vscode.window.showWarningMessage("No code selected");
      return;
    }

    this.sendExplanationRequest(editor, selectedText);
  }

  /**
   * Gather context and stream explanation from provider.
   */
  private async sendExplanationRequest(
    editor: vscode.TextEditor,
    selectedCode: string
  ): Promise<void> {
    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.sidebar.showLoading();

    try {
      const language = vscode.workspace
        .getConfiguration("vibeco")
        .get<string>("language", "en");

      const request: ExplainRequest = {
        selectedCode,
        fileContent: editor.document.getText(),
        filePath: vscode.workspace.asRelativePath(editor.document.uri),
        projectStructure: await this.getProjectStructure(),
        language,
      };

      const provider = createProvider();
      const systemPrompt = getSystemPrompt(language);
      const sessionContext = this.sessionMemory.buildContext();
      const userPrompt = buildUserPrompt(request, sessionContext);

      this.lastSelectedCode = selectedCode;
      this.lastFilePath = request.filePath;
      this.lastExplanation = "";

      for await (const chunk of provider.stream(
        userPrompt,
        systemPrompt,
        this.abortController.signal
      )) {
        this.lastExplanation += chunk;
        this.sidebar.appendChunk(chunk);
      }

      // Save to session memory
      this.sessionMemory.add(request.filePath, selectedCode, this.lastExplanation);

      this.sidebar.showComplete();
    } catch (error: any) {
      if (error.name === "AbortError" || error.message === "Aborted") {
        return; // New selection was made, ignore
      }

      this.sidebar.showError(error.message || "Unknown error");
    }
  }

  /**
   * Explain the entire file's role in the project.
   */
  private async sendFileExplanation(editor: vscode.TextEditor): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.sidebar.showLoading();

    try {
      const language = vscode.workspace
        .getConfiguration("vibeco")
        .get<string>("language", "en");

      const filePath = vscode.workspace.asRelativePath(editor.document.uri);
      const fileContent = editor.document.getText();
      const projectStructure = await this.getProjectStructure();

      const provider = createProvider();
      const systemPrompt = getFileSystemPrompt(language);
      const userPrompt = buildFilePrompt(filePath, fileContent, projectStructure);

      this.lastSelectedCode = fileContent.substring(0, 2000);
      this.lastFilePath = filePath;
      this.lastExplanation = "";

      for await (const chunk of provider.stream(
        userPrompt,
        systemPrompt,
        this.abortController.signal
      )) {
        this.lastExplanation += chunk;
        this.sidebar.appendChunk(chunk);
      }

      // Save to session memory
      this.sessionMemory.add(filePath, `[file: ${filePath}]`, this.lastExplanation);

      this.sidebar.showComplete();
    } catch (error: any) {
      if (error.name === "AbortError" || error.message === "Aborted") {
        return;
      }
      this.sidebar.showError(error.message || "Unknown error");
    }
  }

  /**
   * Handle a follow-up question about the last explanation.
   */
  public async sendFollowupQuestion(question: string): Promise<void> {
    if (!this.lastExplanation) {
      this.sidebar.showError("No previous explanation to follow up on. Select some code first.");
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.sidebar.showLoading();

    try {
      const language = vscode.workspace
        .getConfiguration("vibeco")
        .get<string>("language", "en");

      const provider = createProvider();
      const systemPrompt = getFollowupSystemPrompt(language);
      const userPrompt = buildFollowupPrompt(
        question,
        this.lastExplanation,
        this.lastSelectedCode,
        this.lastFilePath
      );

      this.lastExplanation = "";

      for await (const chunk of provider.stream(
        userPrompt,
        systemPrompt,
        this.abortController.signal
      )) {
        this.lastExplanation += chunk;
        this.sidebar.appendChunk(chunk);
      }

      this.sidebar.showComplete();
    } catch (error: any) {
      if (error.name === "AbortError" || error.message === "Aborted") {
        return;
      }
      this.sidebar.showError(error.message || "Unknown error");
    }
  }

  /**
   * Get a simple project structure string from workspace files.
   */
  private async getProjectStructure(): Promise<string> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return "(no workspace open)";
    }

    try {
      const files = await vscode.workspace.findFiles(
        "**/*",
        "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/__pycache__/**,**/.venv/**,**/.env/**,**/venv/**}",
        200
      );

      const relativePaths = files
        .map((f) => vscode.workspace.asRelativePath(f))
        .sort();

      return relativePaths.join("\n");
    } catch {
      return "(could not read project structure)";
    }
  }
}
