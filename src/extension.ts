/**
 * Vibeco - Code Explainer for Vibe Coders
 *
 * Main extension entry point. Registers sidebar, selection listener, and commands.
 */

import * as vscode from "vscode";
import { SidebarProvider } from "./sidebarProvider";
import { SelectionHandler } from "./selectionHandler";

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri, (question: string) => {
    selectionHandler.sendFollowupQuestion(question);
  });
  const selectionHandler = new SelectionHandler(sidebarProvider);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "vibeco.explanationView",
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      selectionHandler.onSelectionChanged(event);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      selectionHandler.onActiveEditorChanged(editor);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vibeco.explainSelection", () => {
      selectionHandler.explainCurrentSelection();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("vibeco.openSettings", () => {
      sidebarProvider.showSetup();
    })
  );
}

export async function deactivate() {
  // Clear all vibeco settings on uninstall so next install starts fresh
  const config = vscode.workspace.getConfiguration("vibeco");
  await config.update("provider", undefined, true);
  await config.update("apiKey", undefined, true);
  await config.update("model", undefined, true);
  await config.update("ollamaUrl", undefined, true);
  await config.update("awsAccessKeyId", undefined, true);
  await config.update("awsSecretAccessKey", undefined, true);
  await config.update("awsRegion", undefined, true);
}
