import * as vscode from "vscode";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _isVisible = false;
  private _onFollowup: ((question: string) => void) | undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    onFollowup?: (question: string) => void
  ) {
    this._onFollowup = onFollowup;
  }

  public get isVisible(): boolean {
    return this._isVisible;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    this._isVisible = webviewView.visible;

    webviewView.onDidChangeVisibility(() => {
      this._isVisible = webviewView.visible;
    });

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent();

    // Handle messages from webview (setup form saves + ollama model fetch)
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "fetchOllamaModels") {
        try {
          const url = msg.ollamaUrl || "http://localhost:11434";
          const resp = await fetch(`${url}/api/tags`);
          if (!resp.ok) {
            throw new Error(`Ollama returned ${resp.status}`);
          }
          const data = await resp.json() as { models?: Array<{ name: string }> };
          const models = (data.models || []).map((m: { name: string }) => m.name);
          this._view?.webview.postMessage({ type: "ollamaModels", models });
        } catch (e: any) {
          this._view?.webview.postMessage({
            type: "ollamaModelsError",
            message: "Cannot reach Ollama. Is it running? (ollama serve)",
          });
        }
        return;
      }

      if (msg.type === "followup") {
        if (this._onFollowup && msg.question) {
          this._onFollowup(msg.question);
        }
        return;
      }

      if (msg.type === "saveSettings") {
        const config = vscode.workspace.getConfiguration("vibeco");
        if (msg.provider) {
          await config.update("provider", msg.provider, true);
        }
        if (msg.apiKey) {
          await config.update("apiKey", msg.apiKey, true);
        }
        if (msg.model) {
          await config.update("model", msg.model, true);
        }
        if (msg.ollamaUrl) {
          await config.update("ollamaUrl", msg.ollamaUrl, true);
        }
        if (msg.awsAccessKeyId) {
          await config.update("awsAccessKeyId", msg.awsAccessKeyId, true);
        }
        if (msg.awsSecretAccessKey) {
          await config.update("awsSecretAccessKey", msg.awsSecretAccessKey, true);
        }
        if (msg.awsRegion) {
          await config.update("awsRegion", msg.awsRegion, true);
        }
        // Tell webview to switch to welcome state
        this._view?.webview.postMessage({ type: "setupDone" });
        vscode.window.showInformationMessage("Vibeco configured! Select some code to get started.");
      }
    });

    // Check if already configured - if not, show setup
    const config = vscode.workspace.getConfiguration("vibeco");
    const currentProvider = config.get<string>("provider", "");
    const currentApiKey = config.get<string>("apiKey", "");
    if (!currentProvider && !currentApiKey) {
      this._view?.webview.postMessage({ type: "showSetup" });
    }
  }

  public showSetup() {
    this._view?.webview.postMessage({ type: "showSetup" });
  }

  public showLoading() {
    this._view?.webview.postMessage({ type: "loading" });
  }

  public appendChunk(text: string) {
    this._view?.webview.postMessage({ type: "chunk", text });
  }

  public showComplete() {
    this._view?.webview.postMessage({ type: "done" });
  }

  public showError(message: string) {
    this._view?.webview.postMessage({ type: "error", message });
  }

  private _getHtmlContent(): string {
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      line-height: 1.5;
      display: flex;
      flex-direction: column;
    }

    #main-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .state { display: none; }
    .state.active { display: block; }

    /* Setup */
    #setup {
      padding: 16px 8px;
    }
    #setup h2 {
      font-size: 16px;
      margin-bottom: 4px;
    }
    #setup .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-bottom: 16px;
    }
    .form-group {
      margin-bottom: 12px;
    }
    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--vscode-foreground);
    }
    .form-group select,
    .form-group input {
      width: 100%;
      padding: 6px 8px;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 4px;
      outline: none;
    }
    .form-group select:focus,
    .form-group input:focus {
      border-color: var(--vscode-focusBorder);
    }
    .form-group .hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 2px;
    }
    .hidden { display: none; }
    #save-btn {
      width: 100%;
      padding: 8px;
      font-size: 13px;
      font-weight: 600;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 8px;
    }
    #save-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Welcome */
    #welcome {
      text-align: center;
      padding: 40px 16px;
    }
    #welcome h2 {
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }
    #welcome p {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    .welcome-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    /* Loading */
    #loading {
      text-align: center;
      padding: 40px 16px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--vscode-progressBar-background, #0078d4);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    #loading p {
      color: var(--vscode-descriptionForeground);
    }

    /* Explanation content */
    #content {
      padding: 4px 0;
    }
    #content h2 {
      font-size: 14px;
      font-weight: 600;
      margin: 16px 0 8px;
      padding: 6px 0 6px 10px;
      border-left: 3px solid var(--vscode-progressBar-background, #0078d4);
      color: var(--vscode-foreground);
    }
    #content h2:first-child {
      margin-top: 0;
    }
    #content p {
      margin: 6px 0;
      color: var(--vscode-foreground);
    }
    #content ul, #content ol {
      margin: 6px 0;
      padding-left: 20px;
    }
    #content li {
      margin: 4px 0;
    }
    #content code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    #content pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }
    #content pre code {
      background: none;
      padding: 0;
    }
    #content strong {
      color: var(--vscode-foreground);
    }

    /* Follow-up chat input - fixed at bottom */
    #followup-bar {
      display: none;
      padding: 8px 12px;
      border-top: 1px solid var(--vscode-panel-border, #333);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
    }
    #followup-bar.visible {
      display: flex;
      gap: 6px;
    }
    #followup-input {
      flex: 1;
      padding: 6px 8px;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 4px;
      outline: none;
    }
    #followup-input:focus {
      border-color: var(--vscode-focusBorder);
    }
    #followup-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    #followup-btn {
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }
    #followup-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Error */
    #error {
      padding: 16px;
    }
    .error-box {
      background: var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.1));
      border: 1px solid var(--vscode-inputValidation-errorBorder, #f44);
      border-radius: 4px;
      padding: 12px;
    }
    .error-box p {
      color: var(--vscode-errorForeground);
      font-size: 13px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="main-content">
  <!-- Setup Screen -->
  <div id="setup" class="state">
    <h2>Welcome to Vibeco</h2>
    <p class="subtitle">Configure your AI provider to get started</p>

    <div class="form-group">
      <label for="provider">Provider</label>
      <select id="provider">
        <option value="">-- Select --</option>
        <option value="anthropic">Anthropic Claude</option>
        <option value="openai">OpenAI GPT</option>
        <option value="ollama">Ollama (local)</option>
        <option value="bedrock">AWS Bedrock</option>
        <option value="gemini">Google Gemini</option>
      </select>
    </div>

    <div class="form-group hidden" id="apikey-group">
      <label for="apikey">API Key</label>
      <input type="password" id="apikey" placeholder="sk-... or sk-ant-...">
      <p class="hint" id="apikey-hint"></p>
    </div>

    <div class="form-group hidden" id="model-group">
      <label for="model">Model (optional)</label>
      <input type="text" id="model" placeholder="">
      <p class="hint" id="model-hint"></p>
    </div>

    <div class="form-group hidden" id="bedrock-group">
      <label for="aws-access-key">AWS Access Key ID</label>
      <input type="password" id="aws-access-key" placeholder="AKIA...">
      <div style="margin-top:8px;">
        <label for="aws-secret-key">AWS Secret Access Key</label>
        <input type="password" id="aws-secret-key" placeholder="wJalr...">
      </div>
      <div style="margin-top:8px;">
        <label for="aws-region">Region</label>
        <input type="text" id="aws-region" value="us-east-1" placeholder="us-east-1">
      </div>
    </div>

    <div class="form-group hidden" id="ollama-model-group">
      <label for="ollama-model">Model</label>
      <div style="display:flex;gap:6px;">
        <select id="ollama-model" style="flex:1;">
          <option value="">-- Click refresh to load models --</option>
        </select>
        <button id="refresh-models-btn" title="Refresh models" style="
          padding:4px 10px;font-size:13px;cursor:pointer;
          background:var(--vscode-button-secondaryBackground);
          color:var(--vscode-button-secondaryForeground);
          border:1px solid var(--vscode-input-border,#444);
          border-radius:4px;">Refresh</button>
      </div>
      <p class="hint" id="ollama-model-hint">Click Refresh to list installed models</p>
    </div>

    <div class="form-group hidden" id="ollama-group">
      <label for="ollama-url">Ollama URL</label>
      <input type="text" id="ollama-url" value="http://localhost:11434">
    </div>

    <button id="save-btn">Save & Start</button>
  </div>

  <!-- Welcome Screen -->
  <div id="welcome" class="state active">
    <div class="welcome-icon">?</div>
    <h2>Vibeco</h2>
    <p>Select some code to get a beginner-friendly explanation</p>
  </div>

  <!-- Loading -->
  <div id="loading" class="state">
    <div class="spinner"></div>
    <p>Analyzing your code...</p>
  </div>

  <!-- Explanation -->
  <div id="explanation" class="state">
    <div id="content"></div>
  </div>

  <!-- Error -->
  <div id="error" class="state">
    <div class="error-box">
      <p id="error-text"></p>
    </div>
  </div>
  </div><!-- end main-content -->

  <!-- Chat input - fixed at bottom -->
  <div id="followup-bar">
    <input type="text" id="followup-input" placeholder="Ask a follow-up question...">
    <button id="followup-btn">Ask</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const states = document.querySelectorAll('.state');
    const contentEl = document.getElementById('content');
    const errorTextEl = document.getElementById('error-text');

    // Setup elements
    const providerSelect = document.getElementById('provider');
    const apikeyGroup = document.getElementById('apikey-group');
    const apikeyInput = document.getElementById('apikey');
    const apikeyHint = document.getElementById('apikey-hint');
    const modelGroup = document.getElementById('model-group');
    const modelInput = document.getElementById('model');
    const modelHint = document.getElementById('model-hint');
    const ollamaGroup = document.getElementById('ollama-group');
    const ollamaUrlInput = document.getElementById('ollama-url');
    const ollamaModelGroup = document.getElementById('ollama-model-group');
    const ollamaModelSelect = document.getElementById('ollama-model');
    const ollamaModelHint = document.getElementById('ollama-model-hint');
    const refreshModelsBtn = document.getElementById('refresh-models-btn');
    const bedrockGroup = document.getElementById('bedrock-group');
    const awsAccessKeyInput = document.getElementById('aws-access-key');
    const awsSecretKeyInput = document.getElementById('aws-secret-key');
    const awsRegionInput = document.getElementById('aws-region');
    const saveBtn = document.getElementById('save-btn');

    const followupBar = document.getElementById('followup-bar');
    const followupInput = document.getElementById('followup-input');
    const followupBtn = document.getElementById('followup-btn');

    let textBuffer = '';

    function sendFollowup() {
      const q = followupInput.value.trim();
      if (!q) return;
      followupInput.value = '';
      followupBar.classList.remove('visible');
      vscode.postMessage({ type: 'followup', question: q });
    }

    followupBtn.addEventListener('click', sendFollowup);
    followupInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendFollowup();
    });

    function showState(id) {
      states.forEach(s => s.classList.remove('active'));
      document.getElementById(id)?.classList.add('active');
    }

    // Provider selection logic
    providerSelect.addEventListener('change', () => {
      const val = providerSelect.value;

      apikeyGroup.classList.add('hidden');
      modelGroup.classList.add('hidden');
      ollamaGroup.classList.add('hidden');
      ollamaModelGroup.classList.add('hidden');
      bedrockGroup.classList.add('hidden');

      if (val === 'anthropic') {
        apikeyGroup.classList.remove('hidden');
        modelGroup.classList.remove('hidden');
        apikeyHint.textContent = 'Get your key at console.anthropic.com';
        modelInput.placeholder = 'claude-sonnet-4-20250514';
        modelHint.textContent = 'Leave empty for default';
      } else if (val === 'openai') {
        apikeyGroup.classList.remove('hidden');
        modelGroup.classList.remove('hidden');
        apikeyHint.textContent = 'Get your key at platform.openai.com';
        modelInput.placeholder = 'gpt-4o';
        modelHint.textContent = 'Leave empty for default';
      } else if (val === 'ollama') {
        ollamaGroup.classList.remove('hidden');
        ollamaModelGroup.classList.remove('hidden');
      } else if (val === 'bedrock') {
        bedrockGroup.classList.remove('hidden');
        modelGroup.classList.remove('hidden');
        modelInput.placeholder = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
        modelHint.textContent = 'Leave empty for default';
      } else if (val === 'gemini') {
        apikeyGroup.classList.remove('hidden');
        modelGroup.classList.remove('hidden');
        apikeyHint.textContent = 'Get your key at aistudio.google.com/apikey';
        modelInput.placeholder = 'gemini-2.0-flash';
        modelHint.textContent = 'Leave empty for default (gemini-2.0-flash)';
      }
    });

    // Refresh Ollama models
    refreshModelsBtn.addEventListener('click', () => {
      const url = ollamaUrlInput.value || 'http://localhost:11434';
      ollamaModelHint.textContent = 'Loading models...';
      vscode.postMessage({ type: 'fetchOllamaModels', ollamaUrl: url });
    });

    // Save button
    saveBtn.addEventListener('click', () => {
      const provider = providerSelect.value;
      if (!provider) {
        return;
      }

      const selectedModel = provider === 'ollama'
        ? ollamaModelSelect.value
        : modelInput.value;

      vscode.postMessage({
        type: 'saveSettings',
        provider: provider,
        apiKey: apikeyInput.value || '',
        model: selectedModel || '',
        ollamaUrl: ollamaUrlInput.value || 'http://localhost:11434',
        awsAccessKeyId: awsAccessKeyInput.value || '',
        awsSecretAccessKey: awsSecretKeyInput.value || '',
        awsRegion: awsRegionInput.value || 'us-east-1',
      });
    });

    function renderMarkdown(text) {
      let html = text
        .replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
        .replace(/^[\\-\\*] (.+)$/gm, '<li>$1</li>')
        .replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>')
        .replace(/\\n\\n/g, '</p><p>')
        .replace(/\\n/g, '<br>');

      html = html.replace(/(<li>.*?<\\/li>(?:<br>)?)+/g, (match) => {
        return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
      });

      return '<p>' + html + '</p>';
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;

      switch (msg.type) {
        case 'showSetup':
          showState('setup');
          break;

        case 'setupDone':
          showState('welcome');
          break;

        case 'loading':
          textBuffer = '';
          contentEl.innerHTML = '';
          followupBar.classList.remove('visible');
          showState('loading');
          break;

        case 'chunk':
          textBuffer += msg.text;
          contentEl.innerHTML = renderMarkdown(textBuffer);
          showState('explanation');
          break;

        case 'done':
          contentEl.innerHTML = renderMarkdown(textBuffer);
          followupBar.classList.add('visible');
          showState('explanation');
          break;

        case 'error':
          errorTextEl.textContent = msg.message;
          showState('error');
          break;

        case 'ollamaModels':
          ollamaModelSelect.innerHTML = '';
          if (msg.models && msg.models.length > 0) {
            msg.models.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = m;
              ollamaModelSelect.appendChild(opt);
            });
            ollamaModelHint.textContent = msg.models.length + ' model(s) found';
          } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- No models found --';
            ollamaModelSelect.appendChild(opt);
            ollamaModelHint.textContent = 'Run: ollama pull llama3';
          }
          break;

        case 'ollamaModelsError':
          ollamaModelHint.textContent = msg.message;
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
