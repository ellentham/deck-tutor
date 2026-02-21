# Deck Tutor

Build Magic: The Gathering decks with AI guidance. Ask about cards, formats, or strategies in plain English and get tailored Scryfall search results.

## What It Does

Deck Tutor is a web app that helps you discover and evaluate Magic cards for deck building. You can:

- **Ask in natural language** — e.g. "ramp cards for Maralen commander deck", "cheaper alternatives to Rhystic Study", "powerful elves for Animar"
- **Get AI-powered Scryfall queries** — Your prompts are converted into optimized [Scryfall](https://scryfall.com) searches using an LLM (Gemini or OpenAI)
- **Browse results** — View cards in list or grid layout with images and details
- **Use format-aware logic** — Commander rules, color identity, synergy criteria, and budget filters are applied automatically

When the backend is unavailable, a rule-based fallback still converts many prompts into Scryfall syntax.

## Tech Stack

- **Frontend**: React, Vite, Motion
- **Backend**: Express (Node.js)
- **APIs**: [Scryfall API](https://scryfall.com/docs/api), Google Gemini or OpenAI GPT-4o-mini
- **Context**: MCP resources for synergy criteria, Commander format rules, and strategy examples

## Prerequisites

- Node.js 18+
- npm

## Quick Start

1. **Clone and install**

   ```bash
   git clone https://github.com/YOUR_USERNAME/deck-tutor.git
   cd deck-tutor
   npm install
   ```

2. **Configure API keys** (optional but recommended for AI features)

   Copy `.env.example` to `.env` and add your keys:

   ```bash
   cp .env.example .env
   ```

   Set `GEMINI_API_KEY` and/or `OPENAI_API_KEY` in `.env`:

   - [Get a Gemini API key](https://ai.google.dev/)
   - [Get an OpenAI API key](https://platform.openai.com/api-keys)

3. **Run the app**

   ```bash
   npm run dev
   ```

   This starts the backend (port 3001) and frontend (Vite dev server). The app will open in your browser.

4. **Use it**

   Type a prompt like "ramp for a green commander deck" or "budget removal in black" and press Enter. Results appear in list or grid view.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend (recommended) |
| `npm run server` | Start backend only |
| `npm run dev:frontend` | Start frontend only (requires backend on port 3001) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
deck-tutor/
├── server/           # Express API (LLM chat, Scryfall proxy)
├── src/              # React frontend
│   ├── components/   # ChatBox, ChatPanel, CardGrid, CardList
│   ├── hooks/       # useScryfallSearch
│   └── lib/         # llmChat, promptParser, scryfallApi
├── deck-tutor-mcp/  # MCP resources (synergy, format rules)
└── .env             # API keys (copy from .env.example)
```

## Example Prompts

- "Ramp cards for Maralen, Fae Ascendant commander deck"
- "Cheaper alternatives to Demonic Tutor"
- "10 budget removal spells in white"
- "Build a full commander deck with Animar as commander"
- "Powerful cards that care about +1/+1 counters"

## License

MIT License — see [LICENSE](LICENSE) for details.
