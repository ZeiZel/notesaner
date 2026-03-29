---
title: AI Assistant
description: AI-powered writing, summarization, and Q&A in Notesaner.
---

# AI Assistant

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

The AI Assistant plugin integrates large language models into your note-taking workflow.

## Features

- **Autocomplete**: Press `Tab` to accept AI writing suggestions inline
- **Summarize**: Summarize the current note or a selection
- **Ask a question**: Chat with the AI about the current note's context
- **Transform**: Rewrite, expand, condense, or change tone of selected text

## Privacy

By default, the AI Assistant uses your configured LLM API key. Note content is sent to the configured API provider. For sensitive notes, you can disable AI for specific notes via front matter:

```yaml
---
ai: false
---
```

## Configuration

Go to **Settings → Plugins → AI Assistant** to configure:

- LLM provider (OpenAI, Anthropic, Ollama)
- Model selection
- Context window size
- API key
