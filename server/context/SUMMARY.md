# Deck-Building Context — Summary

This folder contains the markdown files injected into the LLM system prompt for natural-language → Scryfall conversion. Below is a condensed summary of each.

---

## Synergy Criteria

**Purpose:** How to identify cards that work well together when comparing oracle text.

- **Strategy extraction:** Pull keywords, tribal types, mechanics, triggers, power/toughness, and color identity from commanders or key cards. Encode in Scryfall queries.
- **Mechanical overlap:** Shared triggers, keywords, and mechanics (e.g., "whenever you draw", sacrifice outlets + payoffs).
- **Strategy alignment:** Cards should support the commander or deck plan; avoid nonbos and strictly worse options.
- **Color identity:** Cards must fit commander colors; hybrid/Phyrexian expand options; colorless is universal.
- **Mana curve:** Prefer lower CMC; balance ramp, interaction, and threats.
- **Oracle comparison:** Compare primary function, shared vocabulary, enabling relationships, and restrictions.

---

## Comparison Priorities

**Purpose:** How to weight factors when evaluating cards.

1. **Function** — What the card does (removal, draw, ramp, threat).
2. **Efficiency** — Mana cost vs. effect.
3. **Synergy** — Fit with commander or strategy.
4. **Flexibility** — Modal spells, broad applicability.
5. **Meta relevance** — Answers common threats.

**Format adjustments:** Commander favors synergy and redundancy; 60-card constructed favors efficiency and sideboard options.

---

## Strategy Examples

**Purpose:** How to turn commander/archetype oracle text into Scryfall query fragments.

| Commander | Key elements | Example fragments |
|-----------|--------------|--------------------|
| The Ur-Dragon | Dragons, attack triggers | `t:dragon` `o:attack` |
| Edgar Markov | Vampires, tokens, +1/+1 | `t:vampire` `o:token` `o:"+1/+1"` |
| Atraxa | Proliferate, counters | `o:proliferate` `o:counter` |
| Animar | +1/+1, cast triggers | `o:"+1/+1"` `o:"whenever you cast"` |
| Maralen | Elves, Faeries, ETB | `(t:elf OR t:faerie)` `o:"enters the battlefield"` |

**Categories:** Tribal (`t:`), mechanics (`o:`), triggers (`o:"whenever"`), power/toughness (`pow:`, `tou:`), color identity (`id:`).

---

## Scryfall Keywords

**Purpose:** When and how to use `kw:` in Scryfall queries.

- **Rule:** For keyword abilities (flying, mobilize, lifelink, prowess, etc.), use `kw:keyword` — not `o:keyword`.
- **Examples:** `kw:flying`, `kw:mobilize`, `kw:prowess`, `kw:"double strike"`.
- **Combining:** `kw:mobilize t:creature`, `kw:flying id:wubrg`.
- **Avoid:** Don’t add type filters (t:creature, t:enchantment) just because mentioned cards are that type; extract the ability and use `kw:` alone unless the user asks for a specific type.

---

## Commander Format Rules

- **Structure:** 99 main + 1 commander, singleton, 100 total.
- **Commander:** Legendary creature; sets color identity; starts in command zone; can return from graveyard/exile (cost increases).
- **Color identity:** All mana symbols on the card; hybrid and Phyrexian count; colorless is universal.
- **Ratios:** ~36–40 lands, 8–12 ramp, 8–12 draw, 5–10 interaction.
- **Power levels:** Casual → Focused → Optimized → Competitive.

---

## Standard Format Rules

- **Structure:** 60 cards minimum, up to 4 copies each, 15-card sideboard.
- **Definition:** Rotating format; uses most recent sets; oldest four rotate out each fall.
- **Play:** 1v1, Bo1 or Bo3, ~20 min games.
- **Ratios:** 22–26 lands; lower curve than eternal formats.
