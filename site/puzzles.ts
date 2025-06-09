import { defaultMap, reverse } from "./utils"

const ALPHABET: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"]

export type PuzzleEvents = {
  onClueFilled: (event: { clue: string, guess: string }) => void,
  onCompleted: (guesses: { clue: string, guess: string }[]) => void,
}

export class Puzzle {
  private clueToNodes
  private charNodes
  private eventHandlers

  private constructor(
    charNodes: HTMLInputElement[],
    eventHandlers: PuzzleEvents,
  ) {
    this.charNodes = charNodes
    this.clueToNodes = defaultMap<HTMLInputElement[]>(() => [])
    for (const node of charNodes)
      this.clueToNodes.get(getClue(node)).push(node)
    this.eventHandlers = eventHandlers
  }

  public static createAt(
    root: HTMLElement,
    seed: string,
    hintClues: Map<string, string>,
    eventHandlers: PuzzleEvents,
  ): Puzzle {
    const charNodes: HTMLInputElement[] = []

    for (const word of seed.toLowerCase().split(" ")) {
      const wordNode = document.createElement("div")
      wordNode.classList.add("word")

      for (const clue of word) {
        if (hintClues.has(clue)) {
          const charNode = document.createElement("div")
          charNode.classList.add("char", "char-hint")
          charNode.innerText = hintClues.get(clue)!
          wordNode.appendChild(charNode)

        } else if (ALPHABET.includes(clue)) {
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
          charNode.classList.add("char", "char-hint")
          charNode.innerText = clue
          wordNode.appendChild(charNode)
        }
      }

      root.appendChild(wordNode)
    }

    const puzzle = new Puzzle(charNodes, eventHandlers)
    return puzzle
  }

  public applyProgress(cluesToGuesses: Map<string, string>) {
    for (const [clue, guess] of cluesToGuesses.entries()) {
      if (guess.length !== 1)
        continue

      for (const node of this.clueToNodes.get(clue)) {
        node.classList.add("char-filled")
        node.value = guess
      }
    }

    this.markRepeatedGuesses()
  }

  public isCompleted(): boolean {
    return this.charNodes.every(node => node.value !== "")
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
      this.eventHandlers.onClueFilled({ clue, guess: newGuess })
      this.checkCompletion()
    } else {
      // Backspace is handled directly, but text can be erased in other ways.
      // So in this case we don't move backwards
      this.eraseClue(clue)
    }
    this.markRepeatedGuesses()
  }

  private checkCompletion() {
    if (this.isCompleted()) {
      const guesses = this.charNodes.map(node => ({ clue: getClue(node), guess: node.value }))
      this.eventHandlers.onCompleted(guesses)
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
    this.eventHandlers.onClueFilled({ clue, guess: "" })
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
  return !prev || prev.classList.contains("char-hint")
}

function isWordEnd(node: HTMLInputElement): boolean {
  const next = node.nextSibling as HTMLElement | null
  return !next || next.classList.contains("char-hint")
}

function preventSelection(this: HTMLInputElement) {
  if (this.selectionStart !== 1 || this.selectionEnd !== 1)
    this.setSelectionRange(1, 1)
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
export function generateStyles() {
  // TODO: this is cursed and doesn't scale to other languages.
  // Hopefully there's a better way.

  const styleNode = document.createElement("style")

  // Both should have a specificity of 0,1,0
  const hoverSelectors =
    ALPHABET
      .map(char => `*:where(.cryptogram-words:has([data-clue="${char}"]:hover)) [data-clue="${char}"]`)
      .join(",\n")

  const focusSelectors =
    ALPHABET
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


