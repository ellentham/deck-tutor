# Deck Tutor — Requirements Document

> Interactive knowledge base for building Magic: The Gathering decks.  
> *Last updated: February 18, 2025*

---

## 1. Project Overview

**Deck Tutor** is a web application that helps users build Magic: The Gathering decks by providing an interactive, AI-supported knowledge base. Users can search for cards, explore format-specific options, and receive guidance on deck construction through a chat-based interface.

### 1.1 Core Value Proposition

- **Problem:** MTG has thousands of cards with different functions; building competitive or thematic decks requires understanding format rules, card synergies, and meta considerations.
- **Solution:** A chat-driven interface that helps users discover cards, filter by criteria, and build decks suited to different formats.

---

## 2. Functional Requirements

### 2.1 Card Discovery & Lookup

| ID | Requirement | Priority |
|----|--------------|----------|
| FR-1 | Search cards by name, text, type, color, mana cost, and other attributes | Must |
| FR-2 | Display card images and oracle text from Scryfall | Must |
| FR-3 | Support autocomplete for card names during search | Should |
| FR-4 | Show card details (mana cost, type line, oracle text, legality, prices) | Must |
| FR-5 | Handle multiface cards (split, transform, modal DFCs) | Should |

### 2.2 Format Support

| ID | Requirement | Priority |
|----|--------------|----------|
| FR-6 | Filter cards by format legality (Standard, Modern, Commander, etc.) | Must |
| FR-7 | Display format-specific rules or constraints when relevant | Should |
| FR-8 | Support at least: Standard, Modern, Pioneer, Commander, Legacy, Vintage | Must |

### 2.3 Deck Building

| ID | Requirement | Priority |
|----|--------------|----------|
| FR-9 | Allow users to add/remove cards to a working deck list | Must |
| FR-10 | Enforce deck size and composition rules per format | Must |
| FR-11 | Persist deck state (localStorage or backend) | Should |
| FR-12 | Export deck list in common formats (e.g., Arena, MTGO) | Could |

### 2.4 AI Chat Interface

| ID | Requirement | Priority |
|----|--------------|----------|
| FR-13 | Chat-based UI as primary interaction model | Must |
| FR-14 | AI assistant that understands deck-building context and format rules | Must |
| FR-15 | AI can query Scryfall (or cached data) to suggest cards | Must |
| FR-16 | AI can reference cards in conversation (names, images, text) | Must |
| FR-17 | Support follow-up questions and multi-turn conversations | Must |

### 2.5 Knowledge Base

| ID | Requirement | Priority |
|----|--------------|----------|
| FR-18 | Provide format rules, deck structure guidelines, and meta context | Should |
| FR-19 | Surface card synergies, combos, or common archetypes when relevant | Could |

---

## 3. Technical Requirements

### 3.1 Frontend

| ID | Requirement | Notes |
|----|--------------|-------|
| TR-1 | React application | SPA or SSR TBD |
| TR-2 | Deployable as static or server-rendered frontend | Vercel, Netlify, etc. |
| TR-3 | Responsive design | Mobile and desktop |
| TR-4 | UI follows Frontend Aesthetics rule (see §5) | Typography, color, motion, backgrounds |

### 3.2 Scryfall API Integration

| ID | Requirement | Notes |
|----|--------------|-------|
| TR-5 | Integrate Scryfall REST API (`api.scryfall.com`) | Cards, search, sets |
| TR-6 | Use required headers: `User-Agent`, `Accept` | Per API docs |
| TR-7 | Respect rate limits (50–100ms between requests) | ~10 req/sec |
| TR-8 | Cache card data where appropriate | 24h+ recommended |
| TR-9 | Use `*.scryfall.io` for images (no rate limit) | Card imagery |
| TR-10 | Adhere to Fan Content Policy | No paywalling, attribution, etc. |

### 3.3 Chat / AI Integration

| ID | Requirement | Notes |
|----|--------------|-------|
| TR-11 | Chat UI component(s) | Message history, input, send |
| TR-12 | AI backend or provider integration | Start with Google Gemini 1.5 Flash |
| TR-13 | Tool/function calling for AI to query Scryfall | Card search, lookup |
| TR-14 | Context injection: format rules, deck state, conversation history | For coherent responses |
| TR-15 | **Provider-agnostic AI layer** | All AI calls must go through an abstraction (e.g. `aiService`). The rest of the app must not depend on Gemini-specific code. This allows swapping to OpenAI, Anthropic, or another provider later without major refactoring. |

---

## 4. Non-Functional Requirements

| ID | Requirement |
|----|--------------|
| NFR-1 | Page load and interaction feel responsive (< 3s for initial load) |
| NFR-2 | Accessible (keyboard nav, screen readers, contrast) |
| NFR-3 | Works in modern browsers (Chrome, Firefox, Safari, Edge) |
| NFR-4 | No paywall for core features (per Scryfall policy) |

---

## 5. UI / UX — Frontend Aesthetics Rule

The UI must follow the project's **Frontend Aesthetics** rule:

- **Typography:** Distinctive fonts; avoid Arial, Inter, Roboto, system fonts.
- **Color & Theme:** Cohesive palette with dominant colors and sharp accents; CSS variables.
- **Motion:** Animations for effects; Motion library for React; staggered reveals on load.
- **Backgrounds:** Atmosphere and depth (gradients, patterns); avoid flat solid colors.
- **Avoid:** Generic layouts, overused fonts, predictable patterns.

*Reference: `.cursor/rules/frontend-aesthetics.mdc`*

---

## 6. Data Sources

| Source | Purpose |
|--------|---------|
| Scryfall API | Card data, images, search, sets, legality |
| Google Gemini 1.5 Flash | Chat responses, deck suggestions, format guidance *(provider swappable)* |
| (Optional) Local/cached data | Reduced API calls, offline support |

---

## 7. Out of Scope (for now)

- User accounts / authentication
- Social features (sharing decks, comments)
- Real-time price tracking beyond Scryfall’s daily updates
- Mobile native apps
- Tournament or event management

---

## 8. Open Questions & Decisions Needed

Use this section to capture decisions as you make them.

### 8.1 AI / Chat

| Question | Options | Decision |
|----------|---------|----------|
| Which AI provider? | OpenAI, Anthropic, local (Ollama), other | **Google Gemini 1.5 Flash** — cost-effective for passion project; can switch later |
| Provider abstraction? | Tightly coupled vs abstracted | **Abstracted** — AI layer must be provider-agnostic so model can be swapped without major refactor |
| Backend for AI? | Serverless functions, dedicated backend, edge | |
| How does AI access Scryfall? | Tool/function calling, pre-fetched context, RAG | |

### 8.2 Architecture

| Question | Options | Decision |
|----------|---------|----------|
| SPA vs SSR? | CRA/Vite SPA, Next.js, Remix | |
| State management? | React Context, Zustand, Redux, TanStack Query | |
| Deployment target? | Vercel, Netlify, Cloudflare Pages, other | |

### 8.3 Deck Building

| Question | Options | Decision |
|----------|---------|----------|
| Deck persistence? | localStorage only, backend DB, both | |
| Multiple decks per session? | Single deck, multiple named decks | |
| Export formats? | Arena, MTGO, Moxfield, Archidekt, plain text | |

### 8.4 Scope

| Question | Options | Decision |
|----------|---------|----------|
| MVP feature set? | Chat + search + basic deck list vs full feature set | |
| Initial format focus? | Commander-first, multi-format from start | |

---

## 9. Additional Details to Provide (Optional)

Consider adding:

1. **Target audience:** Casual players, competitive players, new players, or mix?
2. **Format priority:** Which format(s) matter most for v1?
3. **AI behavior:** Should the AI be proactive (suggest cards) or reactive (answer questions)?
4. **Deck limits:** Min/max deck sizes, sideboard rules per format.
5. **Budget/constraints:** API costs, hosting budget, build timeline.
6. **Accessibility:** Any specific WCAG level or user needs?
7. **Localization:** English only, or plan for i18n?

---

## 10. Document History

| Date | Change |
|------|--------|
| 2025-02-18 | Initial requirements document created |
| 2025-02-18 | AI provider: Gemini 1.5 Flash; added TR-15 provider-agnostic AI layer |
