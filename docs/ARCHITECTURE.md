# Deck Tutor — Architecture & Data Flow

This document describes how user input flows from the frontend through the backend, LLM, and external APIs. It is intended for documentation and onboarding.

---

## Overview

Deck Tutor converts natural language prompts into Magic: The Gathering card searches. The flow has three main paths:

1. **Primary path**: User → Frontend → Backend → LLM → Scryfall API → Backend fetches reasons → Backend returns cards + reasons in single response
2. **Fallback path**: User → Frontend → Rule-based parser → Scryfall API (when backend/LLM unavailable)
3. **Client-side search fallback**: When backend returns `scryfallQuery` but no cards (e.g. pipeline error), frontend runs search and fetches reasons
4. **MCP path**: Cursor IDE ↔ deck-tutor-mcp (separate from app runtime; provides context to AI assistants)

---

## High-Level Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER                                                      │
│                         "ramp cards for Maralen commander deck"                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                                         │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────────┐  │
│  │  ChatBox    │───►│  App.tsx     │───►│  llmChat.ts     │───►│  useScryfallSearch       │  │
│  │  (textarea) │    │  handleSend  │    │  chatWithLLM()  │    │  setCardsFromResponse()  │  │
│  └─────────────┘    └──────────────┘    └────────┬────────┘    │  or searchWithQuery()    │  │
│                                                  │             └────────────┬─────────────┘  │
│                                                  │ POST /api/chat           │ (fallback)     │
│                                                  │ { message }              │ GET /api/      │
│                                                  │                          │ scryfall/search│
└──────────────────────────────────────────────────┼──────────────────────────┼────────────────┘
                                                   │                          │
                              Vite proxy /api → localhost:3001                │
                                                   │                          │
                                                   ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express, port 3001)                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  POST /api/chat                                                                         │ │
│  │  1. loadMCPContext() + lookupCardsOnScryfall(mentioned cards) → full system prompt     │ │
│  │  2. callGemini() or callOpenAI() with fullSystemPrompt + user message                  │ │
│  │  3. Parse JSON → { scryfallQuery, scryfallQueries?, message, limit, skipSearch }       │ │
│  │  4. If !skipSearch: fetchScryfallSearch() (single or multi-facet), apply fallback      │ │
│  │  5. Exclude mentioned cards, fetchReasonsForCards(), applyRecommendedRanks, sort       │ │
│  │  6. Return { cards, totalCards, message, scryfallQuery, ... } to frontend              │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                   │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  GET /api/scryfall/search?q=... (used by client fallback when server returns no cards) │ │
│  │  Proxy to https://api.scryfall.com/cards/search                                         │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL APIs                                                   │
│  ┌─────────────────────────────┐    ┌──────────────────────────────────────────────────────┐ │
│  │  Google Gemini API          │    │  Scryfall API (api.scryfall.com)                     │ │
│  │  or OpenAI API              │    │  - /cards/search (search by query)                   │ │
│  │  (LLM for NL → Scryfall)    │    │  - /cards/named (fuzzy lookup by name)               │ │
│  └─────────────────────────────┘    └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Message Flow

### 1. User Input Capture

| Step | Component | Action |
|------|-----------|--------|
| 1 | `ChatBox.tsx` | User types in textarea; submits via Enter or button |
| 2 | `ChatBox` | Calls `onSubmit(trimmedContent)` |
| 3 | `App.tsx` | `handleSend(content)` receives the message |

### 2. Frontend → Backend (Primary Path)

| Step | Component | Action |
|------|-----------|--------|
| 1 | `App.handleSend` | Adds user message to `messages`; adds placeholder "Searching..."; sets `isResponding = true` |
| 2 | `llmChat.chatWithLLM(content)` | `POST /api/chat` with `{ message: content }` |
| 3 | Vite proxy | Forwards `/api/*` to `http://localhost:3001` |
| 4 | Backend `POST /api/chat` | Receives `message`; validates; loads MCP context; calls LLM |

### 3. Backend → LLM

| Step | Component | Action |
|------|-----------|--------|
| 1 | `loadMCPContext()` | Reads markdown files from `server/context/`: `synergy-criteria.md`, `format-rules/commander.md`, `format-rules/standard.md`, `comparison-priorities.md`, `strategy-examples.md`, `scryfall-keywords.md` |
| 2 | `fullSystem` | Concatenates: `SYSTEM_PROMPT` + `"\n\n## Deck-building context (use when relevant)\n"` + `mcpContext` |
| 3 | LLM call | **Gemini**: `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with `systemInstruction` + `contents` |
| 4 | LLM call | **OpenAI** (fallback): `api.openai.com/v1/chat/completions` with `model: gpt-4o-mini`, `response_format: { type: "json_object" }` |
| 5 | Response | LLM returns JSON string |

### 4. LLM Response Shape

The LLM is instructed to return **JSON only**:

```json
{
  "scryfallQueries": [{"query": "id:ubg o:ramp is:commander", "label": "Ramp"}],
  "scryfallQuery": "id:ubg is:commander o:ramp order:edhrec -!\"Maralen, Fae Ascendant\"",
  "message": "Here are ramp options for a Maralen commander deck...",
  "limit": 200,
  "colorIdentity": "ubg",
  "skipSearch": false
}
```

| Field | Purpose |
|-------|---------|
| `scryfallQuery` | Primary Scryfall search (backward compatibility) |
| `scryfallQueries` | Array of `{query, label}` for multi-facet strategies (e.g. "mobilize and ETB") |
| `message` | Markdown text shown in chat (advice, tables, explanations) |
| `limit` | Max cards to return (e.g. 99 for full commander deck) |
| `colorIdentity` | Used for fallback query when primary returns few cards |
| `skipSearch` | `true` = rules/gameplay question only; no Scryfall search |

**Response types** (from system prompt):

1. **Rules questions** → `skipSearch: true`, `scryfallQuery: ""`, full markdown answer
2. **Deck/card suggestions** → Rich markdown + `scryfallQuery` / `scryfallQueries` for search
3. **Simple search** → Brief message + `scryfallQuery`

### 5. Backend → Frontend (Chat Response)

| Step | Component | Action |
|------|-----------|--------|
| 1 | Backend | Runs full pipeline: Scryfall search (single or multi-facet), fallback if needed, exclude mentioned cards, `fetchReasonsForCards()`, apply recommended ranks, sort |
| 2 | Backend | Returns `{ cards, totalCards, message, scryfallQuery, limit, skipSearch, fallbackQuery?, scryfallQueries? }` |
| 3 | `chatWithLLM` | Returns `ChatResponse` to `App.handleSend` |
| 4 | `App.handleSend` | Updates assistant message; if `llmResponse.cards?.length > 0`, calls `setCardsFromResponse(cards, totalCards)` — **no client-side search** |

### 6. Client-Side Search Fallback (when server returns no cards)

When the backend returns `scryfallQuery` but **no `cards`** (e.g. pipeline error in try/catch):

| Step | Component | Action |
|------|-----------|--------|
| 1 | `App.handleSend` | Calls `searchWithQuery(scryfallQuery, limit, fallbackQuery, content, message, scryfallQueries)` |
| 2 | `useScryfallSearch.searchWithQuery` | Calls `searchByQuery` from `scryfallApi` (single or multi-facet via `queryFacets`) |
| 3 | `scryfallApi.searchByQuery` | `fetch('/api/scryfall/search?q=...')` (proxied to backend) |
| 4 | Frontend | Maps to `AppCard`; excludes mentioned cards; optionally fetches reasons via `POST /api/cards/reasons`; sorts; displays |

### 7. Fallback Query (deck building)

When primary query returns **< 24 cards** and `fallbackQuery` exists:

- **Server**: Runs `fetchScryfallSearch(fallbackQuery)` and uses the larger result set before returning
- **Client** (fallback path): Runs `searchByQuery(fallbackQuery)` when using `searchWithQuery`

### 8. Card Reasons

| Context | Behavior |
|---------|----------|
| **Primary path** (server returns cards) | Backend calls `fetchReasonsForCards()` before returning; cards arrive with `reason` already set |
| **Client fallback** (searchWithQuery) | Frontend calls `fetchCardReasons()` after ~300ms delay; enriches cards and re-sorts |

---

## Fallback Path (Backend/LLM Unavailable)

When `chatWithLLM` returns `null` (503, 502, network error):

| Step | Component | Action |
|------|-----------|--------|
| 1 | `App.handleSend` | Uses `parseSearchPrompt(content)` from `promptParser.ts` |
| 2 | `parseSearchPrompt` | Extracts card names, format, commander context; maps NL → Scryfall via `SEMANTIC_MAPPINGS` |
| 3 | `parseSearchPrompt` | Output: `{ cardNames, searchQuery, useNamedLookup, format, isCommanderContext }` |
| 4 | `App.handleSend` | If `useNamedLookup`: `search(content)` → named lookup. Else: `searchWithQuery(parsed.searchQuery, ...)` |

**Rule-based translation examples** (`promptParser.ts`):

| User phrase | Scryfall output |
|-------------|-----------------|
| `ramp` | `o:ramp OR (o:add o:mana)` |
| `draw` | `o:draw` |
| `removal` | `(o:destroy OR o:exile OR o:target)` |
| `green` | `c:g` |
| `creatures` | `t:creature` |
| `flying` | `kw:flying` |
| `commander` | `is:commander` |
| "X as commander" | Named lookup for X |

---

## MCP Integration

### How MCP is Used

| Context | Usage |
|---------|-------|
| **Backend** | Reads `server/context/*.md` and injects into LLM system prompt. **Does not** connect to MCP server. |
| **Cursor IDE** | `deck-tutor-mcp` (sibling package) runs as MCP server (stdio); Cursor fetches resources and calls tools when assisting with deck-building code. |

### deck-tutor-mcp package (optional, for Cursor)

- **Transport**: stdio (for Cursor)
- **Resources**: 16 markdown files (synergy criteria, format rules, strategy examples, Scryfall keywords, comprehensive rules)
- **Tool**: `extract_strategy_from_card(cardName)` → fetches card from Scryfall, parses oracle text, returns strategy (creature types, mechanics, triggers, suggested Scryfall query)

### Backend context (self-contained in project)

```
server/context/
├── synergy-criteria.md
├── format-rules/commander.md
├── format-rules/standard.md
├── comparison-priorities.md
├── strategy-examples.md
└── scryfall-keywords.md
```

---

## API Endpoints Summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check; reports if LLM is configured |
| GET | `/api/scryfall/count` | Total card count from Scryfall |
| GET | `/api/scryfall/card?name=` | Named/fuzzy card lookup (proxy) |
| GET | `/api/scryfall/search?q=&page=` | Search proxy (avoids CORS) |
| POST | `/api/chat` | LLM: user message → Scryfall query + markdown |
| POST | `/api/cards/reasons` | LLM: explain why each card fits the prompt |

---

## Message Transformation Summary

| Layer | Input | Output |
|-------|-------|--------|
| **User** | Natural language | e.g. "ramp for Maralen commander deck" |
| **LLM** | System prompt + MCP context + user message | JSON: `scryfallQuery`, `scryfallQueries?`, `message`, `limit`, `skipSearch` |
| **Rule-based fallback** | User message | `ParsedPrompt`: `searchQuery` (Scryfall syntax), `useNamedLookup` |
| **mentionedCards** | User message | Card names for thumbnails and exclusion from results |
| **Scryfall API** | `scryfallQuery` (e.g. `id:ubg o:ramp is:commander`) | Card objects |
| **Card reasons LLM** | `prompt` + `cards` + `searchContext` | `{ reasons: [{ name, reason }] }` |

---

## Data Flow Diagram (Sequence)

**Primary path** (server returns cards with reasons):

```
User                ChatBox          App              llmChat           Backend           LLM            Scryfall
  │                   │               │                  │                 │               │                │
  │  type + submit    │               │                  │                 │               │                │
  │──────────────────►│               │                  │                 │               │                │
  │                   │  onSubmit()   │                  │                 │               │                │
  │                   │──────────────►│                  │                 │               │                │
  │                   │               │  chatWithLLM()   │                 │               │                │
  │                   │               │─────────────────►│                 │               │                │
  │                   │               │                  │  POST /api/chat │               │                │
  │                   │               │                  │────────────────►│               │                │
  │                   │               │                  │                 │ loadMCPContext│                │
  │                   │               │                  │                 │ callGemini/   │                │
  │                   │               │                  │                 │ callOpenAI    │                │
  │                   │               │                  │                 │──────────────►│                │
  │                   │               │                  │                 │               │  JSON response │
  │                   │               │                  │                 │◄──────────────│                │
  │                   │               │                  │                 │ fetchScryfall │                │
  │                   │               │                  │                 │───────────────┼───────────────►│
  │                   │               │                  │                 │               │  cards        │
  │                   │               │                  │                 │◄──────────────┼───────────────│
  │                   │               │                  │                 │ fetchReasons  │               │
  │                   │               │                  │                 │──────────────►│               │
  │                   │               │                  │  { cards,        │               │               │
  │                   │               │                  │    totalCards,   │               │               │
  │                   │               │                  │    message }     │               │               │
  │                   │               │                  │◄────────────────│               │               │
  │                   │               │ setCardsFromResponse(cards)        │               │               │
  │                   │               │─────────────────►│                 │               │               │
  │  cards + reasons  │               │                  │                 │               │               │
  │◄────────────────────────────────────────────────────────────────────────────────────────────────────────│
```

**Client fallback path** (when server returns scryfallQuery but no cards):

```
  │                   │               │ searchWithQuery  │                 │               │                │
  │                   │               │─────────────────►│  GET /api/      │               │                │
  │                   │               │                  │  scryfall/search│               │                │
  │                   │               │                  │────────────────►│──────────────►│                │
  │                   │               │                  │                 │               │  cards         │
  │                   │               │                  │                 │◄──────────────│                │
  │                   │               │                  │◄────────────────│               │                │
  │                   │               │ (300ms later)    │  POST /api/     │               │                │
  │                   │               │ fetchCardReasons │  cards/reasons  │               │                │
  │                   │               │─────────────────►│────────────────►│──────────────►│                │
  │                   │               │                  │                 │               │  reasons       │
  │                   │               │                  │                 │◄──────────────│                │
  │                   │               │                  │◄────────────────│               │                │
```

---

## Client-Side Filtering & Pagination

After cards are loaded, the user can filter and paginate:

| Feature | Component | Behavior |
|---------|-----------|----------|
| **Color filter** | `CardsFilterPopover` | Filter by color identity (W, U, B, R, G) |
| **Reason filter** | `CardsFilterPopover` | Filter by card reason category (e.g. "Gains life", "Life gain payoff") |
| **Sort** | `CardsFilterPopover` | Default (recommended), CMC, name, price |
| **Pagination** | `CardsPagination` | Page size (12, 24, 48), page navigation |
| **View mode** | `App.tsx` | Grid or list layout toggle |

Filtering and pagination are applied client-side in `App.tsx` via `filterCardsByColors`, `filterCardsByReasons`, `sortCardsBy`, and `paginatedCards`.

---

## Key Files Reference

| File | Responsibility |
|------|----------------|
| `src/components/ChatBox.tsx` | Input capture, submit handler |
| `src/components/ChatPanel.tsx` | Message list, markdown render, follow-up input, mentioned-card thumbnails |
| `src/components/CardsFilterPopover.tsx` | Color/reason filters, sort options |
| `src/components/CardsPagination.tsx` | Page size, page navigation |
| `src/components/CardsEmptyState.tsx` | Empty/loading/error states for card list/grid |
| `src/App.tsx` | Orchestrates chat, search fallback, filtering, pagination |
| `src/lib/llmChat.ts` | `chatWithLLM`, `fetchCardReasons` (API client) |
| `src/lib/promptParser.ts` | Rule-based NL → Scryfall (fallback) |
| `src/lib/mentionedCards.ts` | Extract card names from prompts |
| `src/lib/cardSort.ts` | `filterCardsByColors`, `filterCardsByReasons`, `sortCardsBy` |
| `src/lib/scryfallApi.ts` | Search, named lookup, caching |
| `src/hooks/useScryfallSearch.ts` | Card state, search, reasons, `setCardsFromResponse` |
| `server/index.ts` | Express API, LLM calls, Scryfall proxy, full search+reasons pipeline |
| `deck-tutor-mcp` (sibling) | MCP server (resources + tools) |
| `vite.config.ts` | Proxy `/api` → `localhost:3001` |
