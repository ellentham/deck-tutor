# Synergy Criteria for Deck Tutor

When comparing oracle text between cards to identify strategy synergies, use these criteria. Inject this context when an LLM analyzes cards for deck-building recommendations.

## 0. Strategy Extraction (All Deck Types)

Decks have a strategy or objective—counters, tokens, prowess triggers, tribal, etc. Extract commonalities from key cards to build Scryfall queries.

- **Commander**: Extract from the commander's oracle text (see `deck-tutor://resources/strategy-examples` for examples).
- **Constructed** (Standard, Modern, etc.): Extract from archetype or key payoff cards (e.g., prowess deck → `kw:prowess`).

When the user names a commander or key card, **extract ALL relevant strategy elements** and encode them in your Scryfall query:

- **Keywords from oracle text**: Extract abilities like vigilance, mobilize, flying, lifelink → use `kw:vigilance`, `kw:mobilize`, etc. Do NOT add type filters (t:enchantment, t:creature) just because the mentioned cards happen to be that type—focus on the abilities.
- **Tribal/creature types**: Maralen mentions Elf, Faerie → `(t:elf OR t:faerie)`; dragon tribal → `t:dragon`.
- **Mechanics**: Animar cares about +1/+1 counters → `o:"+1/+1"` or `o:counter`; sacrifice decks → `o:sacrifice`; draw matters → `o:draw`.
- **Power/toughness**: Zinnia gets +X/+0 for creatures with base power 1 → `pow:1` or `pow=1`; commanders that care about toughness → `tou:`.
- **Triggers**: "whenever you cast" → `o:"whenever you cast"`; "enters the battlefield" → `o:"enters the battlefield"`.
- **Color identity**: Always restrict to the commander's colors using `id:` (e.g., Maralen = BGU → `id:ubg`).
- **Powerful = synergistic**: When the user asks for "powerful" cards, prioritize cards whose oracle text directly enables or benefits from the commander's abilities.

## 1. Mechanical Overlap

Cards that share triggers, keywords, or mechanics often work well together:

- **Shared triggers**: "whenever you draw", "whenever a creature enters", "whenever you cast"
- **Keyword synergies**: Cards that care about flying, lifelink, +1/+1 counters
- **Mechanic alignment**: Sacrifice outlets with sacrifice payoffs; discard outlets with reanimation

## 2. Strategy Alignment

Cards should advance the commander's or deck's primary game plan:

- **Commander-centric**: Does this card enable what the commander wants to do?
- **Win condition support**: Ramp for big spells; card draw for combo pieces; removal for control
- **Redundancy**: Similar effects are good; exact duplicates are usually not

## 3. Color Identity

- Cards must fit the commander's color identity
- Hybrid and Phyrexian mana expand options within identity
- Colorless cards are universally playable

## 4. Mana Curve

- Prefer lower CMC for early-game support and consistency
- Balance ramp, interaction, and threats across the curve
- Consider when the commander comes down and what the deck needs before/after

## 5. What to Avoid

- **Nonbos**: Cards that conflict (e.g., "can't draw" with draw payoffs)
- **Overlap without redundancy value**: Multiple copies of narrow effects when one is enough
- **Strictly worse**: A card that does the same thing but costs more or has downsides

## 6. Oracle Text Comparison Priorities

When comparing two cards' oracle text:

1. Identify the primary function (removal, draw, ramp, threat, etc.)
2. Check for shared vocabulary: "draw", "sacrifice", "counter", "enters the battlefield"
3. Look for enabling relationships: A enables B (e.g., "whenever you draw" + "draw a card")
4. Note restrictions: "nonland", "creature you control", "target permanent"
