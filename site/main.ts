import * as puzzles from "./puzzles"
import { allQuotes, QuoteSpec } from "./quotes"

type MainOptions = {
  cryptogramWordsNode: HTMLElement,
  setAuthor: (name: string, year: number | null) => void,
}

export function main(opts: MainOptions): void {
  puzzles.generateStyles()
  asyncMain(opts)
}

const ALPHABET: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"]

type PuzzleQuote = {
  id: string,
  author: string,
  year: number | null,
  originalText: string,
  mapping: { clue: string, real: string }[],
  encryptedText: string,
}

async function asyncMain(opts: MainOptions) {
  const quoteDoc = allQuotes[Math.floor(Math.random() * allQuotes.length)]!
  const puzzleQuote = generateQuote(quoteDoc)

  opts.setAuthor(puzzleQuote.author, puzzleQuote.year)
  const puzzle = puzzles.Puzzle.createAt(opts.cryptogramWordsNode, puzzleQuote.encryptedText, () => { })
}

function generateQuote(doc: QuoteSpec): PuzzleQuote {
  const ring = generateRing()

  const guessToClue = new Map<string, string>()
  for (let i = 0; i < ring.length - 1; i++)
    guessToClue.set(ring[i]!, ring[i + 1]!)
  guessToClue.set(ring[ring.length - 1]!, ring[0]!)

  const encryptedText = [...doc.text.toLowerCase()].map(ch => guessToClue.get(ch) || ch).join("")

  return {
    id: doc.id,
    author: doc.author,
    year: doc.year ?? null,
    originalText: doc.text,
    mapping: [...guessToClue.entries()].map(([real, clue]) => ({ clue, real })),
    encryptedText,
  }
}

function generateRing(): string[] {
  // A shuffled alphabet like 'ahzxy...rv', which indicates that a->h, h->z, ..., r->v, v->a.
  // It can simplify the puzzles if you know this detail, but that's fine for now
  const ring = shuffle(ALPHABET)

  // ensure that letters don't map to themselves:
  const repeating = ring.map((ch, i) => [ch, i] as const).filter(([ch, i]) => ALPHABET[i]! === ch)

  if (repeating.length === 0) {
    return ring
  } else if (repeating.length === 1) {
    return generateRing()
  } else {
    // rotate the repeating letters among themselves
    repeating.push(repeating[0]!)
    for (let j = 0; j < repeating.length - 1; j++) {
      const [_, i] = repeating[j]!
      const [ch, __] = repeating[j + 1]!
      ring[i] = ch
    }
  }
  return ring
}

function shuffle<T>(items: Iterable<T>): T[] {
  const rv = [...items]
  for (let i = rv.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rv[i], rv[j]] = [rv[j]!, rv[i]!];
  }
  return rv
}
