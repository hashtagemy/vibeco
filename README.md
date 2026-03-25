<p align="center">
  <img src="vibeco.svg" alt="VibeCo Logo" width="256">
</p>

# Vibeco - Code Explainer for Vibe Coders

**Select code. Understand it. Learn while you build.**

Vibeco is a VS Code and Kiro extension that helps vibe coders understand the code they work with. Select any code and get beginner-friendly explanations in the sidebar.

## Install

- **VS Code** — [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Vibeco-emy.vibeco)
- **Kiro** — [Open VSX Registry](https://open-vsx.org/extension/Vibeco-emy/vibeco)

## Features

- **Select & Learn** - Highlight any code to get instant explanations
- **Follow-up Chat** - Ask follow-up questions about the explanation directly in the sidebar
- **File Overview** - Open a file and see its role in the project
- **Session Memory** - Remembers what you've explored, references previous explanations naturally
- **Beginner Friendly** - Explains like you're seeing it for the first time
- **Alternatives** - Shows other ways to achieve the same thing
- **Impact Analysis** - What happens if you change or remove it
- **Project Context** - Understands how the code fits in your project
- **Multi-language** - English and Turkish support

## Supported Providers

| Provider | Setup |
|----------|-------|
| **Anthropic Claude** | API key from [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | API key from [platform.openai.com](https://platform.openai.com) |
| **Google Gemini** | API key from [aistudio.google.com](https://aistudio.google.com/apikey) |
| **Ollama (local)** | Free, runs locally. Install from [ollama.com](https://ollama.com) |
| **AWS Bedrock** | AWS credentials configured locally |

## Getting Started

1. Install the extension
2. Click the Vibeco icon in the sidebar
3. Choose your provider and enter API key (or select Ollama for free local use)
4. Select any code - explanation appears automatically!

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `vibeco.provider` | LLM provider | Auto-detect |
| `vibeco.apiKey` | API key for your provider | - |
| `vibeco.model` | Model override | Provider default |
| `vibeco.language` | Explanation language (en/tr) | en |
| `vibeco.explainOnFileOpen` | Explain file role on open | true |
| `vibeco.debounceMs` | Delay before explaining | 800ms |
| `vibeco.ollamaUrl` | Ollama server URL | http://localhost:11434 |

## Why Vibeco?

If you use AI agents to write code, you know the struggle: the agent changes files, but you don't fully understand what changed or why. Vibeco bridges that gap by explaining every piece of code in simple terms, helping you learn as you build.

## License

MIT
