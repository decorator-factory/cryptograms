type MainOptions = {
  cryptogramWordsNode: HTMLElement,
}

export function main(opts: MainOptions): void {
  generateStyles()
  const puzzle = Puzzle.createAt(
    opts.cryptogramWordsNode,
    "svv wgr zqqo lz hila vltq la lkzgusznq szo ngztloqznq, szo hiqz arnnqaa la aruq.",
  )
}


const ALL_LETTERS: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"]

class Puzzle {
  private clueToNodes
  private charNodes

  private constructor(charNodes: HTMLInputElement[]) {
    this.charNodes = charNodes
    this.clueToNodes = defaultMap<HTMLInputElement[]>(() => [])
    for (const node of charNodes)
      this.clueToNodes.get(getClue(node)).push(node)
  }

  static createAt(root: HTMLElement, seed: string): Puzzle {
    const charNodes: HTMLInputElement[] = []

    for (const word of seed.toLowerCase().split(" ")) {
      const wordNode = document.createElement("div")
      wordNode.classList.add("word")

      for (const clue of word) {
        if (ALL_LETTERS.includes(clue)) {
          const charNode = document.createElement("input")
          charNode.classList.add("char", `letter--${clue}`)
          charNode.placeholder = clue
          wordNode.appendChild(charNode)

          charNode.addEventListener("input", () => puzzle.onNewInputValue(charNode))
          charNode.addEventListener("focus", function () { this.select() })
          charNode.addEventListener("selectionchange", fixSelection)
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

    const puzzle = new Puzzle(charNodes)
    return puzzle
  }

  private onNewInputValue(charNode: HTMLInputElement) {
    const clue = getClue(charNode)
    const newGuess = charNode.value.toLowerCase()[0]
    if (newGuess) {
      for (const node of this.clueToNodes.get(clue)) {
        node.value = newGuess
        node.classList.remove("char-wrong")
        node.classList.add("char-filled")
      }
      selectCharNode(this.findNextFreeNode(charNode))
    } else {
      // Backspace is handled directly, but text can be erased
      // in other ways (like Delete and Ctrl+X)
      this.eraseClue(clue)
      selectCharNode(this.findPrevNode(charNode))
    }
    this.markRepeatedGuesses()
  }

  private onKeyPressed(node: HTMLInputElement, e: KeyboardEvent) {
    switch (e.key) {
      case "Backspace":
        // This is needed to move
        this.eraseClue(getClue(node))
        selectCharNode(this.findPrevNode(node))

        // Prevent the previous node from being erased as well:
        e.stopPropagation()
        e.preventDefault()
        break

      case "ArrowRight":
        if (e.ctrlKey)
          selectCharNode(isWordEnd(node) ? this.findNextNode(node) : this.findNextWordEnd(node))
        else if (e.shiftKey)
          selectCharNode(this.findNextFreeNode(node))
        else
          selectCharNode(this.findNextNode(node))
        break

      case "ArrowLeft":
        if (e.ctrlKey)
          selectCharNode(isWordStart(node) ? this.findPrevNode(node) : this.findPrevWordStart(node))
        else if (e.shiftKey)
          selectCharNode(this.findPrevFreeNode(node))
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

  private findNextFreeNode(node: HTMLInputElement): HTMLInputElement | null {
    const clue = getClue(node)
    return searchNextNode(node, this.charNodes, n => getClue(n) !== clue && n.value === "")
  }

  private findPrevFreeNode(node: HTMLInputElement): HTMLInputElement | null {
    const clue = getClue(node)
    return searchNextNode(node, reverse(this.charNodes), n => getClue(n) !== clue && n.value === "")
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

function fixSelection(this: HTMLInputElement) {
  // Force selection to only be one of:
  // - 0..0 if the input is empty
  // - 0..0 if the input is filled -- that's fine, since
  //   onNewInputValue takes the first charatcer
  // - 0..1 to select the first character
  const { selectionStart: start, selectionEnd: end } = this
  if (start !== 0 || (end !== 0 && end !== 1))
    this.setSelectionRange(0, 1)
}

/**
 * We need this behaviour: if any e.g. letter K is hovered (or focused),
 * apply a style to _all_ letters K. CSS doesn't seem to have anything
 * for this, so we'll generate a bit of CSS with a bunch of selectors of
 * this sort:
 *
 * ```css
 * .container:has(.letter--a:hover)  .letter-a,
 * .container:has(.letter--b:hover)  .letter-b,
 * ...
 * .container:has(.letter--z:hover)  .letter-z { ...properties... }
 * ```
 */
function generateStyles() {
  // TODO: this is cursed and doesn't scale to other languages.
  // Hopefully there's a better way.

  const styleNode = document.createElement("style")

  const hoverSelectors =
    ALL_LETTERS
      .map(char => `.cryptogram-words:has(.char.letter--${char}:hover) .letter--${char}`)
      .join(",")

  const focusSelectors =
    ALL_LETTERS
      .map(char => `.cryptogram-words:has(.char.letter--${char}:focus) .letter--${char}`)
      .join(",")

  styleNode.textContent = `
    ${hoverSelectors} {
      background: var(--hover-bg);
      outline: 1px solid var(--hover-outline);
      color: var(--hover-color);
    }

    ${focusSelectors} {
      background: var(--focus-bg);
      &::placeholder{
        color: var(--focus-color);
      }
    }
  `
  document.head.appendChild(styleNode)
}

// Utility functions

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