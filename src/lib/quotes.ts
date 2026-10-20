import type { RolePlay } from './types'

export type QuoteStatus = 'agent' | 'customer' | 'missing'

export interface QuoteCheck {
  quote: string
  status: QuoteStatus
  /** 0-based transcript line where the quote (or its first piece) was found, or -1. */
  line: number
}

/** Loose enough to forgive typography and case, strict enough that a paraphrase fails. */
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

/** Splits a quote on ellipses and drops a leading "[3] Agent:" style label. Keeps every non-empty piece. */
export function quotePieces(quote: string): string[] {
  const q = normalize(quote).replace(/^\[\d+\]\s*/, '').replace(/^(agent|customer)\s*:\s*/, '')
  return q
    .split(/\.\.\.|…/)
    .map(trimEnds)
    .filter((p) => p.length > 0)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A piece must match whole words: "not" must not match inside "nothing". */
function pieceRegex(piece: string): RegExp {
  const pre = /^[a-z0-9]/.test(piece) ? '(?<![a-z0-9])' : ''
  const post = /[a-z0-9]$/.test(piece) ? '(?![a-z0-9])' : ''
  return new RegExp(pre + escape(piece) + post, 'g')
}

/**
 * Finds the pieces in order, each starting after the end of the one before, in one line or across
 * consecutive lines of the given speakers. Returns the line of the first piece, or -1.
 */
function findInOrder(pieces: string[], lines: { text: string; idx: number }[]): number {
  for (let start = 0; start < lines.length; start++) {
    let li = start
    let pos = 0
    let first = -1
    let ok = true
    for (const p of pieces) {
      let found = false
      while (li < lines.length) {
        const re = pieceRegex(p)
        re.lastIndex = pos
        const m = re.exec(lines[li].text)
        if (m) {
          if (first < 0) first = lines[li].idx
          pos = m.index + m[0].length
          found = true
          break
        }
        li++
        pos = 0
      }
      if (!found) {
        ok = false
        break
      }
    }
    if (ok) return first
  }
  return -1
}

export function checkQuote(quote: string, rp: RolePlay): QuoteCheck {
  const pieces = quotePieces(quote)
  if (pieces.length === 0) return { quote, status: 'missing', line: -1 }
  const all = rp.lines.map(([who, text], idx) => ({ who, text: normalize(text), idx }))
  const agentLine = findInOrder(pieces, all.filter((l) => l.who === 'agent'))
  if (agentLine >= 0) return { quote, status: 'agent', line: agentLine }
  const anyLine = findInOrder(pieces, all)
  if (anyLine >= 0) return { quote, status: 'customer', line: anyLine }
  return { quote, status: 'missing', line: -1 }
}

/** Character ranges where any piece matches in a transcript line, for highlighting. */
export function pieceRanges(text: string, pieces: string[]): [number, number][] {
  const low = normalize(text)
  const out: [number, number][] = []
  for (const p of pieces) {
    const re = pieceRegex(p)
    const m = re.exec(low)
    if (m) out.push([m.index, m.index + m[0].length])
  }
  return out
}
