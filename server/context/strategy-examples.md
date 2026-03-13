# Strategy Extraction Examples

Strategy extraction identifies commonalities among cards—creature types, mechanics, triggers, power/toughness—that define a deck's objective. Use this for **any deck type**: Commander (extract from commander), Constructed (extract from archetype or key cards), or Limited (extract from bombs/payoffs).

## Commander Examples (from [EDHREC Top Commanders](https://edhrec.com/commanders))

| Commander | Oracle Text Elements | Scryfall Query Fragments |
|-----------|----------------------|---------------------------|
| **The Ur-Dragon** | Dragons, flying, attack triggers, draw, put permanent from hand | `t:dragon` `o:"whenever"` `o:attack` `id:wubrg` |
| **Edgar Markov** | Vampires, tokens, +1/+1 counters, "whenever you cast" | `t:vampire` `o:token` `o:"+1/+1"` `id:wbr` |
| **Atraxa, Praetors' Voice** | Proliferate, counters (any kind) | `o:proliferate` `o:counter` `id:gwub` |
| **Krenko, Mob Boss** | Goblins, tokens (X based on Goblins) | `t:goblin` `o:token` `id:r` |
| **Kaalia of the Vast** | Angels, Demons, Dragons, attack, put from hand | `(t:angel OR t:demon OR t:dragon)` `o:attack` `id:wbr` |
| **Maralen, Fae Ascendant** | Elves, Faeries, enters battlefield, exile, cast from exile | `(t:elf OR t:faerie)` `o:"enters the battlefield"` `id:ubg` |
| **Animar, Soul of Elements** | +1/+1 counters, "whenever you cast" creature, cost reduction | `o:"+1/+1"` `o:"whenever you cast"` `t:creature` `id:gur` |
| **Zinnia, Valley's Voice** | Base power 1, offspring/tokens | `pow:1` `o:token` `id:urw` |
| **Chatterfang, Squirrel General** | Squirrels, tokens, sacrifice | `t:squirrel` `o:token` `o:sacrifice` `id:bg` |
| **Isshin, Two Heavens as One** | Attack triggers (doubled) | `o:"whenever"` `o:attack` `id:wbr` |

## Strategy Categories to Extract

1. **Tribal / creature types**: `t:elf`, `t:dragon`, `(t:angel OR t:demon OR t:dragon)`
2. **Mechanics**: `o:"+1/+1"`, `o:proliferate`, `o:sacrifice`, `o:token`, `o:draw`
3. **Triggers**: `o:"whenever you cast"`, `o:"enters the battlefield"`, `o:"whenever"` `o:attack`
4. **Power/toughness**: `pow:1`, `tou>=4` (when the card cares about specific stats)
5. **Color identity**: `id:ubg`, `c:r`, etc.

## Constructed / Non-Commander Decks

For Standard, Modern, Pioneer, etc., strategy often comes from:

- **Archetype**: "Prowess deck" → `kw:prowess` `o:"whenever you cast"`; "Tokens" → `o:token`
- **Key cards**: Extract strategy from the deck's main payoff or engine (e.g., Murktide → `o:exile` `t:instant` `t:sorcery`)
- **Win condition**: Counters, combat, combo—derive oracle terms that support it

## Common Strategy Patterns

| Pattern | Oracle / Scryfall Terms |
|---------|--------------------------|
| +1/+1 counters | `o:"+1/+1"`, `o:counter`, `o:proliferate` |
| Token creation | `o:token`, `o:create` |
| Sacrifice | `o:sacrifice` |
| Draw matters | `o:draw` |
| Cast/ETB triggers | `o:"whenever you cast"`, `o:"enters the battlefield"` |
| Attack triggers | `o:attack`, `o:"whenever"` |
| Prowess / spells matter | `kw:prowess`, `o:"whenever you cast"` `t:instant` `t:sorcery` |
