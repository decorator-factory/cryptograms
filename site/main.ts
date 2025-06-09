import * as puzzles from "./puzzles"
import * as storage from "./storage"
import { quoteSpecs, QuoteSpec } from "./quotes"
import { defaultMap } from "./utils"

type MainOptions = {
  cryptogramWordsNode: HTMLElement,
  puzzleLinksNode: HTMLElement,
  setAuthor: (name: string, year: number | null) => void,
}

export function main(opts: MainOptions): void {
  puzzles.generateStyles()

  const stats = storage.getStats()
  const quotes = quoteSpecs.map(scrambleQuote)
  const progress = defaultMap<Map<string, string>>(() => new Map)

  function markAsSolved(quoteId: string) {
    if (!stats.solvedCryptograms.includes(quoteId)) {
      stats.solvedCryptograms.push(quoteId)
      storage.writeStats(stats)
    }
    document.getElementById(linkFragment(quoteId))?.classList.add("puzzle-link-solved")
  }

  function selectPuzzle(quoteId: string) {
    showStatus("")
    const quote = quotes.find(q => q.id === quoteId)
    if (!quote) return
    opts.setAuthor(quote.fullAuthor, quote.year)
    opts.cryptogramWordsNode.textContent = ""

    const puzzle = puzzles.Puzzle.createAt(
      opts.cryptogramWordsNode,
      quote.encryptedText,
      quote.hintClues,
      {
        onClueFilled(event) {
          if (event.guess) {
            progress.get(quoteId).set(event.clue, event.guess)
          } else {
            progress.get(quoteId).delete(event.clue)
            showStatus("")
          }
        },
        onCompleted(solution) {
          if (isSolvedCorrectly(quote, solution)) {
            markAsSolved(quote.id)
            showStatus("You solved the puzzle! 🎸")
          } else {
            showStatus("That's not quite the right quote 🤔")
          }
        },
      }
    )
    puzzle.applyProgress(progress.get(quoteId))
  }

  initQuoteList(opts.puzzleLinksNode, stats.solvedCryptograms, quotes, selectPuzzle)
}

function isSolvedCorrectly(
  quote: PuzzleQuote,
  solution: Iterable<Readonly<{ guess: string, clue: string }>>,
): boolean {
  for (const { guess, clue } of solution)
    if (quote.clueToOriginal.get(clue) !== guess)
      return false
  return true
}

function showStatus(message: string) {
  const statusBox = document.querySelector(".status")!
  statusBox.textContent = message
  if (message)
    statusBox.classList.add("status__show")
  else
    statusBox.classList.remove("status__show")
}

function initQuoteList(
  listRoot: HTMLElement,
  solvedIds: readonly string[],
  quotes: readonly PuzzleQuote[],
  selectPuzzle: (id: string) => void,
) {
  for (const quote of quotes) {
    const li = document.createElement("li")
    const a = document.createElement("a")

    a.id = linkFragment(quote.id)
    a.href = "#" + a.id
    a.textContent = quote.year ? `${quote.shortAuthor}, ${quote.year}` : quote.shortAuthor

    a.addEventListener("click", () => selectPuzzle(quote.id))
    if (solvedIds.includes(quote.id))
      a.classList.add("puzzle-link-solved")

    li.appendChild(a)
    listRoot.appendChild(li)
  }

  const selectedQuoteId = unLinkFragment(document.location.hash)
  if (selectedQuoteId) {
    selectPuzzle(selectedQuoteId)
  } else {
    document.location.hash = linkFragment(quotes[0]!.id)
    selectPuzzle(quotes[0]!.id)
  }
}

function linkFragment(quoteId: string): string {
  return `quote_${quoteId}`
}

function unLinkFragment(fragment: string): string | null {
  const match = /^#?quote_(.*)$/.exec(fragment)
  return match ? match[1]! : null
}

const ALPHABET: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"]

type PuzzleQuote = {
  id: string,
  fullAuthor: string,
  shortAuthor: string,
  year: number | null,
  originalText: string,

  hintClues: Map<string, string>,  // clue->guess
  clueToOriginal: Map<string, string>,
  encryptedText: string,
}

function scrambleQuote(doc: QuoteSpec): PuzzleQuote {
  const ring = generateRing()

  const origToClue = new Map<string, string>()
  for (let i = 0; i < ring.length - 1; i++)
    origToClue.set(ring[i]!, ring[i + 1]!)
  origToClue.set(ring[ring.length - 1]!, ring[0]!)

  const hintClues = new Map((doc.hints || []).map(hint => [origToClue.get(hint)!, hint]))

  const encryptedText = [...doc.text.toLowerCase()].map(ch => origToClue.get(ch) || ch).join("")

  return {
    id: doc.id,
    fullAuthor: doc.author,
    shortAuthor: doc.shortAuthor || doc.author,
    year: doc.year ?? null,
    originalText: doc.text,
    clueToOriginal: new Map([...origToClue.entries()].map(([real, clue]) => [clue, real])),
    encryptedText,
    hintClues,
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
