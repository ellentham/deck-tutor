/** App-level card representation used across components */
export interface Card {
  id: string
  name: string
  typeLine: string
  manaCost: string
  imageUrl: string
  oracleText?: string
  scryfallUri?: string
  /** AI-generated reason why this card fits the user's prompt */
  reason?: string
  /** Position in LLM recommendations (0 = top pick). Undefined = not explicitly recommended. */
  recommendedRank?: number
  /** Color identity (W, U, B, R, G). Empty = colorless. */
  colorIdentity?: string[]
  /** Non-foil USD price. null if unavailable. */
  priceUsd?: number | null
}
