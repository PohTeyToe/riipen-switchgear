import type { RolePlay } from './types'

export type QuoteStatus = 'agent' | 'customer' | 'missing'

export interface QuoteCheck {
  quote: string
  status: QuoteStatus
  /** 0-based transcript line where the quote (or its first piece) was found, or -1. */
  line: number
}

/** Loose enough to forgive typography, strict enough that a paraphrase fails. */
export function normalize(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

function trimEnds(s: string): string {
  return s.replace(/^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g, '')
}

/** Splits a quote on ellipses, and drops a leading "[3] Agent:" style label. */
export function quotePieces(quote: string): string[] {
  const q = normalize(quote).replace(/^\[\d+\]\s*/, '').replace(/^(agent|customer)\s*:\s*/, '')
  return q
    .split(/\.\.\.|…/)
    .map(trimEnds)
    .filter((p) => p.length >= 3)
}

export function checkQuote(quote: string, rp: RolePlay): QuoteCheck {
  const pieces = quotePieces(quote)
  if (pieces.length === 0) return { quote, status: 'missing', line: -1 }
  const lines = rp.lines.map(([who, text]) => ({ who, text: normalize(text) }))
  const find = (piece: string, who?: string) =>
    lines.findIndex((l) => (who ? l.who === who : true) && l.text.includes(piece))
  const agentHits = pieces.map((p) => find(p, 'agent'))
  if (agentHits.every((i) => i >= 0)) return { quote, status: 'agent', line: agentHits[0] }
  const anyHits = pieces.map((p) => find(p))
  if (anyHits.every((i) => i >= 0)) return { quote, status: 'customer', line: anyHits[0] }
  return { quote, status: 'missing', line: -1 }
}
