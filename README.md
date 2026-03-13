# Deck Tutor

Build Magic: The Gathering decks with AI guidance. Ask about cards, formats, or strategies in plain English and get tailored Scryfall search results.

## What It Does

Deck Tutor is a web app that helps you discover and evaluate Magic cards for deck building. You can:

- **Ask in natural language** — e.g. "ramp cards for Maralen commander deck", "cheaper alternatives to Demonic Tutor", "powerful creatures for Animar"
- **Get AI-powered results** — Your prompts are converted into [Scryfall](https://scryfall.com) searches using an LLM (Gemini or OpenAI). The backend runs the full pipeline (search + card reasons) and returns cards with explanations.
- **Browse results** — View cards in list or grid layout with images and details. Filter by color or reason, sort, and paginate.
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
   git clone https://github.com/ellentham/deck-tutor.git
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

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed diagram of how user input flows from the frontend through the backend. The backend runs the full pipeline: LLM → Scryfall search → card reasons → returns cards with explanations in a single response. When the backend is unavailable, a rule-based fallback converts prompts to Scryfall syntax on the client.

## Project Structure

```
deck-tutor/
├── server/           # Express API (LLM chat, Scryfall search + reasons pipeline, proxy)
├── src/              # React frontend
│   ├── components/   # ChatBox, ChatPanel, CardGrid, CardList, CardsFilterPopover, CardsPagination
│   ├── hooks/        # useScryfallSearch, useMentionedCards, useMediaQuery, useLazyLoad
│   ├── lib/          # llmChat, promptParser, scryfallApi, cardSort, mentionedCards
│   └── types/        # Card type definitions
├── deck-tutor-mcp/   # MCP resources (synergy, format rules) + extract_strategy_from_card tool
├── docs/             # ARCHITECTURE.md (data flow, API reference)
└── .env              # API keys (copy from .env.example)
```

## Example Prompts

- "Creature cards for Maralen, Fae Ascendant commander deck"
- "Cheaper alternatives to Demonic Tutor"
- "10 budget removal spells in white"
- "Build a full commander deck with Animar as commander"
- "Powerful cards that care about +1/+1 counters"

## License

MIT License — see [LICENSE](LICENSE) for details.
