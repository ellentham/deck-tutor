#!/usr/bin/env node
/**
 * Deck Tutor MCP Server
 *
 * Exposes deck-building context as MCP resources and tools for use by AI agents.
 * Resources include synergy criteria, format rules, and comparison priorities.
 * Tools include strategy extraction from card oracle text.
 *
 * Run with: npx tsx src/index.ts
 * Or: node dist/index.js (after npm run build)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { z } from 'zod'
import { extractStrategyFromCardName } from './strategyExtraction.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const RESOURCES_DIR = join(__dirname, '..', 'resources')

const RESOURCE_DEFINITIONS = [
  {
    name: 'synergy-criteria',
    uri: 'deck-tutor://resources/synergy-criteria',
    title: 'Synergy Criteria',
    description: 'What counts as synergy when comparing oracle text between cards',
    path: 'synergy-criteria.md',
  },
  {
    name: 'strategy-examples',
    uri: 'deck-tutor://resources/strategy-examples',
    title: 'Strategy Extraction Examples',
    description: 'Examples of extracting strategy from card oracle text (Commander and Constructed)',
    path: 'strategy-examples.md',
  },
  {
    name: 'comparison-priorities',
    uri: 'deck-tutor://resources/comparison-priorities',
    title: 'Comparison Priorities',
    description: 'What to weight when evaluating and comparing cards',
    path: 'comparison-priorities.md',
  },
  {
    name: 'format-rules-commander',
    uri: 'deck-tutor://resources/format-rules/commander',
    title: 'Commander Format Rules',
    description: 'Deck structure and rules for Commander (EDH)',
    path: 'format-rules/commander.md',
  },
  {
    name: 'commander-brackets',
    uri: 'deck-tutor://resources/commander-brackets',
    title: 'Commander Brackets',
    description: 'Power level brackets (Exhibition through cEDH) for Commander deckbuilding',
    path: 'commander-brackets.md',
  },
  {
    name: 'format-rules-modern',
    uri: 'deck-tutor://resources/format-rules/modern',
    title: 'Modern Format Rules',
    description: 'Deck structure and rules for Modern',
    path: 'format-rules/modern.md',
  },
  {
    name: 'format-rules-standard',
    uri: 'deck-tutor://resources/format-rules/standard',
    title: 'Standard Format Rules',
    description: 'Deck structure and rules for Standard (rotating)',
    path: 'format-rules/standard.md',
  },
  {
    name: 'format-rules-pioneer',
    uri: 'deck-tutor://resources/format-rules/pioneer',
    title: 'Pioneer Format Rules',
    description: 'Deck structure and rules for Pioneer',
    path: 'format-rules/pioneer.md',
  },
  {
    name: 'format-rules-pauper',
    uri: 'deck-tutor://resources/format-rules/pauper',
    title: 'Pauper Format Rules',
    description: 'Deck structure and rules for Pauper (commons only)',
    path: 'format-rules/pauper.md',
  },
  {
    name: 'format-rules-legacy',
    uri: 'deck-tutor://resources/format-rules/legacy',
    title: 'Legacy Format Rules',
    description: 'Deck structure and rules for Legacy',
    path: 'format-rules/legacy.md',
  },
  {
    name: 'format-rules-vintage',
    uri: 'deck-tutor://resources/format-rules/vintage',
    title: 'Vintage Format Rules',
    description: 'Deck structure and rules for Vintage',
    path: 'format-rules/vintage.md',
  },
  {
    name: 'format-rules-brawl',
    uri: 'deck-tutor://resources/format-rules/brawl',
    title: 'Brawl Format Rules',
    description: 'Deck structure and rules for Brawl (60-card Commander)',
    path: 'format-rules/brawl.md',
  },
  {
    name: 'format-rules-oathbreaker',
    uri: 'deck-tutor://resources/format-rules/oathbreaker',
    title: 'Oathbreaker Format Rules',
    description: 'Deck structure and rules for Oathbreaker',
    path: 'format-rules/oathbreaker.md',
  },
  {
    name: 'format-rules-booster-draft',
    uri: 'deck-tutor://resources/format-rules/booster-draft',
    title: 'Booster Draft Format Rules',
    description: 'Deck structure and rules for Booster Draft (limited)',
    path: 'format-rules/booster-draft.md',
  },
  {
    name: 'format-rules-sealed-deck',
    uri: 'deck-tutor://resources/format-rules/sealed-deck',
    title: 'Sealed Deck Format Rules',
    description: 'Deck structure and rules for Sealed Deck (limited)',
    path: 'format-rules/sealed-deck.md',
  },
  {
    name: 'magic-comprehensive-rules',
    uri: 'deck-tutor://resources/magic-comprehensive-rules',
    title: 'Magic: The Gathering Comprehensive Rules',
    description: 'Official rules for Magic: The Gathering, for looking up specific rule situations.',
    path: 'magic-comprehensive-rules.md',
  },
] as const

async function readResourceContent(relativePath: string): Promise<string> {
  const fullPath = join(RESOURCES_DIR, relativePath)
  try {
    return await readFile(fullPath, 'utf-8')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `# Error loading resource\n\nCould not load: ${msg}`
  }
}

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'deck-tutor-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {
          listChanged: false,
        },
      },
    }
  )

  for (const def of RESOURCE_DEFINITIONS) {
    server.registerResource(
      def.name,
      def.uri,
      {
        title: def.title,
        description: def.description,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [
          {
            uri: def.uri,
            mimeType: 'text/markdown',
            text: await readResourceContent(def.path),
          },
        ],
      })
    )
  }

  server.registerTool(
    'extract_strategy_from_card',
    {
      title: 'Extract Strategy from Card',
      description:
        'Fetches a card from Scryfall by name and extracts deck-building strategy from its oracle text. Returns creature types, mechanics, triggers, power/toughness, and Scryfall query fragments. Use for Commander (extract from commander) or any deck where a key card defines the strategy.',
      inputSchema: z.object({
        cardName: z.string().describe('Card name (fuzzy match supported, e.g. "Maralen, Fae Ascendant" or "Animar")'),
      }),
      outputSchema: z.object({
        cardName: z.string(),
        colorIdentity: z.array(z.string()),
        colorIdentityScryfall: z.string(),
        creatureTypes: z.array(z.string()),
        mechanics: z.array(z.string()),
        triggers: z.array(z.string()),
        powerToughness: z
          .object({
            power: z.number().optional(),
            toughness: z.number().optional(),
          })
          .optional(),
        scryfallQueryFragments: z.array(z.string()),
        suggestedQuery: z.string(),
        error: z.string().optional(),
      }),
    },
    async (args) => {
      const { cardName } = args as { cardName: string }
      try {
        const result = await extractStrategyFromCardName(cardName)
        const output = !result
          ? {
              error: `Card not found: ${cardName}`,
              cardName,
              colorIdentity: [] as string[],
              colorIdentityScryfall: '',
              creatureTypes: [] as string[],
              mechanics: [] as string[],
              triggers: [] as string[],
              scryfallQueryFragments: [] as string[],
              suggestedQuery: '',
            }
          : {
              cardName: result.cardName,
              colorIdentity: result.colorIdentity,
              colorIdentityScryfall: result.colorIdentityScryfall,
              creatureTypes: result.creatureTypes,
              mechanics: result.mechanics,
              triggers: result.triggers,
              powerToughness: result.powerToughness,
              scryfallQueryFragments: result.scryfallQueryFragments,
              suggestedQuery: result.suggestedQuery,
            }
        const text = JSON.stringify(output, null, 2)
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const text = JSON.stringify(
          {
            error: msg,
            cardName,
            colorIdentity: [],
            colorIdentityScryfall: '',
            creatureTypes: [],
            mechanics: [],
            triggers: [],
            scryfallQueryFragments: [],
            suggestedQuery: '',
          },
          null,
          2
        )
        return { content: [{ type: 'text' as const, text }] }
      }
    }
  )

  return server
}

async function main(): Promise<void> {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Deck Tutor MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
