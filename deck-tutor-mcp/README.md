# Deck Tutor MCP Server

MCP server that provides deck-building context for AI agents. Exposes synergy criteria, format rules, and comparison priorities as resources that can be injected into LLM prompts.

## Tools

| Tool | Description |
|------|--------------|
| `extract_strategy_from_card` | Fetches a card from Scryfall by name and extracts deck-building strategy from its oracle text. Returns creature types, mechanics, triggers, power/toughness, and Scryfall query fragments. Use for Commander (extract from commander) or any deck where a key card defines the strategy. |

## Resources

| Resource | URI | Description |
|----------|-----|--------------|
| Synergy Criteria | `deck-tutor://resources/synergy-criteria` | What counts as synergy when comparing oracle text |
| Strategy Examples | `deck-tutor://resources/strategy-examples` | Examples of extracting strategy from top EDHREC commanders and Constructed archetypes |
| Comparison Priorities | `deck-tutor://resources/comparison-priorities` | What to weight when evaluating cards |
| Commander Rules | `deck-tutor://resources/format-rules/commander` | Commander (EDH) format structure and rules |
| Modern Rules | `deck-tutor://resources/format-rules/modern` | Modern format structure and rules |
| Standard Rules | `deck-tutor://resources/format-rules/standard` | Standard format (rotating) |
| Pioneer Rules | `deck-tutor://resources/format-rules/pioneer` | Pioneer format |
| Pauper Rules | `deck-tutor://resources/format-rules/pauper` | Pauper format (commons only) |
| Legacy Rules | `deck-tutor://resources/format-rules/legacy` | Legacy format |
| Vintage Rules | `deck-tutor://resources/format-rules/vintage` | Vintage format |
| Brawl Rules | `deck-tutor://resources/format-rules/brawl` | Brawl format (60-card Commander) |
| Oathbreaker Rules | `deck-tutor://resources/format-rules/oathbreaker` | Oathbreaker format |
| Booster Draft Rules | `deck-tutor://resources/format-rules/booster-draft` | Booster Draft (limited) |
| Sealed Deck Rules | `deck-tutor://resources/format-rules/sealed-deck` | Sealed Deck (limited) |
| Comprehensive Rules | `deck-tutor://resources/magic-comprehensive-rules` | Official MTG rules for rule lookups |

## Running the Server

### Development (with tsx)

```bash
cd deck-tutor-mcp
npm install
npm run dev
```

### Production (compiled)

```bash
cd deck-tutor-mcp
npm install
npm run build
npm start
```

### Via npx (from project root)

```bash
npx tsx deck-tutor-mcp/src/index.ts
```

## Cursor Integration

Add to your Cursor MCP settings (`.cursor/mcp.json` or Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "npx",
      "args": ["tsx", "deck-tutor-mcp/src/index.ts"],
      "cwd": "/path/to/deck-tutor"
    }
  }
}
```

Or use the compiled version:

```json
{
  "mcpServers": {
    "deck-tutor": {
      "command": "node",
      "args": ["deck-tutor-mcp/dist/index.js"],
      "cwd": "/path/to/deck-tutor"
    }
  }
}
```

## Using in Your Backend

Your Deck Tutor backend can connect as an MCP client, fetch these resources, and inject them into prompts when calling Gemini or another LLM. Example flow:

1. Connect to this MCP server (stdio or HTTP)
2. Call `resources/list` to discover resources
3. Call `resources/read` with the URIs you need
4. Prepend the resource content to your LLM prompt when analyzing cards
