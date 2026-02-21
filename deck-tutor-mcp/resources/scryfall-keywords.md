# Scryfall Keyword Search Guidance

When the user mentions a **specific keyword** (e.g. flying, mobilize, lifelink, haste, prowess), you **must** use the `kw:` (or `keyword:`) operator in your Scryfall query. This ensures results include cards that actually have that keyword ability.

## Critical Rule: Use kw: for Keyword Abilities

**When the user asks for cards with a specific keyword, ALWAYS use `kw:keyword`.**

- "cards with mobilize" → `kw:mobilize`
- "flying creatures" → `kw:flying t:creature`
- "lifelink for my deck" → `kw:lifelink`
- "haste enablers" → `kw:haste`
- "prowess deck" → `kw:prowess`

Do **not** use `o:keyword` (oracle text) for keyword abilities. Oracle text search matches raw text and may miss cards or return irrelevant matches. The `kw:` operator matches Scryfall's curated keyword index.

## Common Keywords (Examples)

| User says | Scryfall query |
|-----------|-----------------|
| flying | `kw:flying` |
| trample | `kw:trample` |
| haste | `kw:haste` |
| lifelink | `kw:lifelink` |
| deathtouch | `kw:deathtouch` |
| vigilance | `kw:vigilance` |
| prowess | `kw:prowess` |
| mobilize | `kw:mobilize` |
| menace | `kw:menace` |
| hexproof | `kw:hexproof` |
| indestructible | `kw:indestructible` |
| double strike | `kw:"double strike"` |
| first strike | `kw:"first strike"` |

Scryfall supports 200+ keywords. If the user names any keyword, use `kw:keyword`—even for newer or less common ones (mobilize, blitz, toxic, etc.).

## Combining with Other Filters

- `kw:mobilize t:creature` — creatures with mobilize
- `kw:flying id:wubrg` — flying cards in 5-color identity
- `kw:prowess o:"whenever you cast"` — prowess plus spell triggers

## Do NOT Infer Card Type from Mentioned Cards

When the user mentions specific cards (e.g. "cards like [Card A] and [Card B]"), extract **keywords and mechanics from the oracle text**—do NOT add type filters (t:enchantment, t:creature, etc.) just because those cards happen to be enchantments or creatures.

- **Wrong**: User mentions two enchantments with vigilance → `t:enchantment kw:vigilance` (excludes creatures, artifacts, etc. that also have vigilance)
- **Right**: Extract the ability → `kw:vigilance` (returns all cards with vigilance, any type)
- **Right**: User mentions cards with mobilize and vigilance → `(kw:mobilize OR kw:vigilance)` or `kw:mobilize kw:vigilance` depending on intent

Only add `t:creature`, `t:enchantment`, etc. when the user **explicitly** asks for a type (e.g. "enchantments with vigilance", "creatures with flying").
