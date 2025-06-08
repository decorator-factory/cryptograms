type MainOptions = {
  cryptogramWordsNode: HTMLElement,
  setAuthor: (name: string, year: number | null) => void,
}

export function main(opts: MainOptions): void {
  generateStyles()
  asyncMain(opts)
}

type QuoteDocument = {
  id: string,
  author: string,
  text: string,
  year?: number,
}

type PuzzleQuote = {
  id: string,
  author: string,
  year: number | null,
  originalText: string,
  mapping: { clue: string, real: string }[],
  encryptedText: string,
}

async function asyncMain(opts: MainOptions) {
  const response = await fetch("./quotes.json")
  if (response.status !== 200)
    throw new Error()

  const quotes: QuoteDocument[] = await response.json()

  const quoteDoc = quotes[Math.floor(Math.random() * quotes.length)]!
  const puzzleQuote = generateQuote(quoteDoc)

  opts.setAuthor(puzzleQuote.author, puzzleQuote.year)
  const puzzle = Puzzle.createAt(opts.cryptogramWordsNode, puzzleQuote.encryptedText, () => { })
}

function generateQuote(doc: QuoteDocument): PuzzleQuote {
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
  const ring = shuffle(ALL_LETTERS)

  // ensure that letters don't map to themselves:
  const repeating = ring.map((ch, i) => [ch, i] as const).filter(([ch, i]) => ALL_LETTERS[i]! === ch)

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


const ALL_LETTERS: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"]

class Puzzle {
  private clueToNodes
  private charNodes
  private onCompleted

  private constructor(
    charNodes: HTMLInputElement[],
    onCompleted: (guesses: [string, string][]) => void,
  ) {
    this.charNodes = charNodes
    this.clueToNodes = defaultMap<HTMLInputElement[]>(() => [])
    for (const node of charNodes)
      this.clueToNodes.get(getClue(node)).push(node)
    this.onCompleted = onCompleted
  }

  static createAt(
    root: HTMLElement,
    seed: string,
    onCompleted: (guesses: [string, string][]) => void,
  ): Puzzle {
    const charNodes: HTMLInputElement[] = []

    for (const word of seed.toLowerCase().split(" ")) {
      const wordNode = document.createElement("div")
      wordNode.classList.add("word")

      for (const clue of word) {
        if (ALL_LETTERS.includes(clue)) {
          const charNode = document.createElement("input")
          charNode.classList.add("char")
          charNode.placeholder = clue
          wordNode.appendChild(charNode)

          charNode.addEventListener("input", () => puzzle.onNewInputValue(charNode))
          charNode.addEventListener("focus", function () { this.select() })
          charNode.addEventListener("selectionchange", preventSelection)
          charNode.addEventListener("keydown", e => puzzle.onKeyPressed(charNode, e))

          setClue(charNode, clue)
          charNodes.push(charNode)
        } else {
          const charNode = document.createElement("div")
          charNode.classList.add("char", "char-punctuation")
          charNode.innerText = clue
          wordNode.appendChild(charNode)
        }
      }

      root.appendChild(wordNode)
    }

    const puzzle = new Puzzle(charNodes, onCompleted)
    return puzzle
  }

  private onNewInputValue(charNode: HTMLInputElement) {
    const clue = getClue(charNode)
    const newGuess = charNode.value.trim().toLowerCase()[0]
    if (newGuess) {
      for (const node of this.clueToNodes.get(clue)) {
        node.value = newGuess
        node.classList.remove("char-wrong")
        node.classList.add("char-filled")
      }
      selectCharNode(this.findNextFillableNode(charNode))
      this.checkCompletion()
    } else {
      // Backspace is handled directly, but text can be erased in other ways.
      // So in this case we don't move backwards
      this.eraseClue(clue)
    }
    this.markRepeatedGuesses()
  }

  private checkCompletion() {
    if (this.charNodes.every(node => node.value !== "")) {
      const guesses: [string, string][] = this.charNodes.map(node => [getClue(node), node.value] as const)
      this.onCompleted(guesses)
    }
  }

  private onKeyPressed(node: HTMLInputElement, e: KeyboardEvent) {
    switch (e.key) {
      case "Backspace":
        // Handling Backspace manually is needed to move the selection backwards
        // even if there's nothing in the cell.
        this.eraseClue(getClue(node))
        selectCharNode(this.findPrevNode(node))
        this.markRepeatedGuesses()

        // Prevent the previous node from being erased as well:
        e.stopPropagation()
        e.preventDefault()
        break

      case "ArrowRight":
        if (e.ctrlKey)
          selectCharNode(isWordEnd(node) ? this.findNextNode(node) : this.findNextWordEnd(node))
        else if (e.shiftKey)
          selectCharNode(this.findNextFillableNode(node) || this.charNodes[this.charNodes.length - 1]!)
        else
          selectCharNode(this.findNextNode(node))
        break

      case "ArrowLeft":
        if (e.ctrlKey)
          selectCharNode(isWordStart(node) ? this.findPrevNode(node) : this.findPrevWordStart(node))
        else if (e.shiftKey)
          selectCharNode(this.findPrevFillableNode(node) || this.charNodes[0]!)
        else
          selectCharNode(this.findPrevNode(node))
        break

      case "Home":
        this.charNodes[0]!.select()
        break

      case "End":
        this.charNodes[this.charNodes.length - 1]!.select()
        break
    }
  }

  private eraseClue(clue: string) {
    for (const node of this.clueToNodes.get(clue)) {
      node.value = ""
      node.classList.remove("char-filled")
      node.classList.remove("char-wrong")
    }
  }

  private findNextWordEnd(node: HTMLInputElement): HTMLInputElement | null {
    return searchNextNode(node, this.charNodes, isWordEnd)
  }

  private findPrevWordStart(node: HTMLInputElement): HTMLInputElement | null {
    return searchNextNode(node, reverse(this.charNodes), isWordStart)
  }

  private findNextNode(node: HTMLInputElement): HTMLInputElement | null {
    const clue = getClue(node)
    return searchNextNode(node, this.charNodes, n => getClue(n) !== clue)
  }

  private findPrevNode(node: HTMLInputElement): HTMLInputElement | null {
    const clue = getClue(node)
    return searchNextNode(node, reverse(this.charNodes), n => getClue(n) !== clue)
  }

  private static isFillable =
    (clue: string) => (n: HTMLInputElement) =>
      getClue(n) !== clue && (n.value === "" || n.classList.contains("char-wrong"))

  private findNextFillableNode(node: HTMLInputElement): HTMLInputElement | null {
    return searchNextNode(node, this.charNodes, Puzzle.isFillable(getClue(node)))
  }

  private findPrevFillableNode(node: HTMLInputElement): HTMLInputElement | null {
    return searchNextNode(node, reverse(this.charNodes), Puzzle.isFillable(getClue(node)))
  }

  private markRepeatedGuesses() {
    const guessToFirstClue = new Map<string, string>()
    const cluesWithMistakes = new Set<string>()

    for (const node of this.charNodes) {
      node.classList.remove("char-wrong")

      if (!node.value)
        continue

      const clue = getClue(node)
      let prevClue = guessToFirstClue.get(node.value)
      if (prevClue && prevClue !== clue) {
        cluesWithMistakes.add(prevClue)
        cluesWithMistakes.add(clue)
      } else {
        guessToFirstClue.set(node.value, clue)
      }
    }

    for (const clue of cluesWithMistakes)
      for (const node of this.clueToNodes.get(clue))
        node.classList.add("char-wrong")
  }
}

function selectCharNode(node: HTMLInputElement | null) {
  node?.focus({ preventScroll: true })
}

function searchNextNode(
  node: HTMLInputElement,
  nodes: Iterable<HTMLInputElement>,
  predicate: (node: HTMLInputElement) => boolean,
): HTMLInputElement | null {
  let foundMe = false
  for (const n of nodes)
    if (foundMe) {
      if (predicate(n))
        return n
    } else if (n === node) {
      foundMe = true
    }
  return null
}

function getClue(node: HTMLInputElement): string {
  const { clue } = node.dataset
  if (!clue)
    throw new Error("Node has no `clue` data attribute")
  return clue
}

function setClue(node: HTMLInputElement, clue: string) {
  node.dataset.clue = clue
}

function isWordStart(node: HTMLInputElement): boolean {
  const prev = node.previousSibling as HTMLElement | null
  return !prev || prev.classList.contains("char-punctuation")
}

function isWordEnd(node: HTMLInputElement): boolean {
  const next = node.nextSibling as HTMLElement | null
  return !next || next.classList.contains("char-punctuation")
}

function preventSelection(this: HTMLInputElement) {
  if (this.selectionStart !== null || this.selectionEnd !== null)
    this.setSelectionRange(null, null)
}

/**
 * We need this behaviour: if any e.g. letter K is hovered (or focused),
 * apply a style to _all_ letters K. CSS doesn't seem to have anything
 * for this, so we'll generate a bit of CSS with a bunch of selectors of
 * this sort:
 *
 * ```css
 * *:where(.container:has([data-clue="a"]:hover)) [data-clue="a"],
 * *:where(.container:has([data-clue="b"]:hover)) [data-clue="b"],
 * ...
 * *:where(.container:has([data-clue="z"]:hover)) [data-clue="z"] { ...properties... }
 * ```
 */
function generateStyles() {
  // TODO: this is cursed and doesn't scale to other languages.
  // Hopefully there's a better way.

  const styleNode = document.createElement("style")

  // Both should have a specificity of 0,1,0
  const hoverSelectors =
    ALL_LETTERS
      .map(char => `*:where(.cryptogram-words:has([data-clue="${char}"]:hover)) [data-clue="${char}"]`)
      .join(",\n")

  const focusSelectors =
    ALL_LETTERS
      .map(char => `*:where(.cryptogram-words:has([data-clue="${char}"]:focus)) [data-clue="${char}"]`)
      .join(",\n")

  styleNode.textContent = `
    ${hoverSelectors} {
      filter: brightness(0.9);
      z-index: 1;
    }

    ${focusSelectors} {
      background: rgb(197, 221, 228);
      color: rgb(120, 137, 151);
      &::placeholder {
        color: rgb(120, 137, 151);
      }
      z-index: 2;
    }
  `
  document.head.appendChild(styleNode)
}

// Utility functions

function shuffle<T>(items: Iterable<T>): T[] {
  const rv = [...items]
  for (let i = rv.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rv[i], rv[j]] = [rv[j]!, rv[i]!];
  }
  return rv
}

function* reverse<T>(items: readonly T[]) {
  for (let i = items.length - 1; i >= 0; i--)
    yield items[i] as T
}

function defaultMap<V>(init: () => V) {
  const map = new Map<string, V>()
  return {
    get: (key: string): V => {
      if (map.has(key)) {
        return map.get(key) as V
      } else {
        const v = init()
        map.set(key, v)
        return v
      }
    },
    set: (key: string, value: V) => {
      map.set(key, value)
    },
  }
}
