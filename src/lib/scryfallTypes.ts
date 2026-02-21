/**
 * Scryfall API types (subset used by deck-tutor).
 * @see https://scryfall.com/docs/api/cards
 */

export interface ScryfallCard {
  id: string
  name: string
  type_line: string
  mana_cost?: string
  oracle_text?: string
  scryfall_uri?: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
    png?: string
    art_crop?: string
    border_crop?: string
  }
  card_faces?: Array<{
    name: string
    type_line?: string
    mana_cost?: string
    oracle_text?: string
    image_uris?: {
      small?: string
      normal?: string
      large?: string
      png?: string
      art_crop?: string
      border_crop?: string
    }
  }>
  legalities?: Record<string, string>
  set_name?: string
  rarity?: string
  colors?: string[]
  color_identity?: string[]
}

export interface ScryfallList {
  object: 'list'
  has_more: boolean
  total_cards?: number
  next_page?: string
  data: ScryfallCard[]
}

export interface ScryfallError {
  object: 'error'
  code: string
  status: number
  details: string
}

export interface BulkDataItem {
  id: string
  type: string
  name: string
  description: string
  download_uri: string
  updated_at: string
  size: number
  content_type: string
  content_encoding: string
}
