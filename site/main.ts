type MainOptions = {
  cryptogramWordsNode: HTMLElement,
}

export function main(opts: MainOptions): void {
  generateStyles()
  createPuzzle(
    opts.cryptogramWordsNode,
    "svv wgr zqqo lz hila vltq la lkzgusznq szo ngztloqznq, szo hiqz arnnqaa la aruq.",
  )
}

function selectCharNode(node: HTMLInputElement | null) {
  if (!node) return
  document.getSelection()?.empty()
  node.focus({ preventScroll: true })
}

function createPuzzle(root: HTMLElement, seed: string) {
  const clueToNodes = defaultMap<HTMLInputElement[]>(() => [])
  const allCharNodes: HTMLInputElement[] = []

  function onNewInputValue(this: HTMLInputElement) {
    const clue = getClue(this)
    const newGuess = this.value.toLowerCase()[0]
    if (newGuess) {
      for (const node of clueToNodes.get(clue)) {
        node.value = newGuess
        node.classList.remove("char-wrong")
        node.classList.add("char-filled")
      }
      selectCharNode(findNextFreeNode(this))
    } else {
      // Backspace is handled directly, but text can be erased
      // in other ways (like Delete and Ctrl+X)
      eraseClue(clue)
      selectCharNode(findPrevNode(this))
    }
    markRepeatedGuesses()
  }

  function onKeyPressed(this: HTMLInputElement, e: KeyboardEvent) {
    switch (e.key) {
      case "Backspace":
        // This is needed to move
        eraseClue(getClue(this))
        selectCharNode(findPrevNode(this))

        // Prevent the previous node from being erased as well:
        e.stopPropagation()
        e.preventDefault()
        break

      case "ArrowRight":
        if (e.ctrlKey)
          selectCharNode(isWordEnd(this) ? findNextNode(this) : findNextWordEnd(this))
        else if (e.shiftKey)
          selectCharNode(findNextFreeNode(this))
        else
          selectCharNode(findNextNode(this))
        break

      case "ArrowLeft":
        if (e.ctrlKey)
          selectCharNode(isWordStart(this) ? findPrevNode(this) : findPrevWordStart(this))
        else if (e.shiftKey)
          selectCharNode(findPrevFreeNode(this))
        else
          selectCharNode(findPrevNode(this))
        break

      case "Home":
        allCharNodes[0]!.select()
        break

      case "End":
        allCharNodes[allCharNodes.length - 1]!.select()
        break
    }
  }

  function eraseClue(clue: string) {
    for (const node of clueToNodes.get(clue)) {
      node.value = ""
      node.classList.remove("char-filled")
      node.classList.remove("char-wrong")
    }
  }

  function markRepeatedGuesses() {
    const guessToFirstClue = new Map<string, string>()
    const cluesWithMistakes = new Set<string>()

    for (const node of allCharNodes) {
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
      for (const node of clueToNodes.get(clue))
        node.classList.add("char-wrong")
  }

  function _searchNextNode(
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

  const findNextWordEnd = (node: HTMLInputElement) =>
    _searchNextNode(node, allCharNodes, isWordEnd)

  const findPrevWordStart = (node: HTMLInputElement) =>
    _searchNextNode(node, reverse(allCharNodes), isWordStart)

  const findNextNode = (node: HTMLInputElement) => {
    const clue = getClue(node)
    return _searchNextNode(node, allCharNodes, n => getClue(n) !== clue)
  }

  const findPrevNode = (node: HTMLInputElement) => {
    const clue = getClue(node)
    return _searchNextNode(node, reverse(allCharNodes), n => getClue(n) !== clue)
  }

  const findNextFreeNode = (node: HTMLInputElement) => {
    const clue = getClue(node)
    return _searchNextNode(node, allCharNodes, n => getClue(n) !== clue && n.value === "")
  }

  const findPrevFreeNode = (node: HTMLInputElement) => {
    const clue = getClue(node)
    return _searchNextNode(node, reverse(allCharNodes), n => getClue(n) !== clue && n.value === "")
  }

  for (const word of seed.toLowerCase().split(" ")) {
    const wordNode = document.createElement("div")
    wordNode.classList.add("word")

    for (const clue of word) {
      if (ALL_LETTERS.includes(clue)) {
        const charNode = document.createElement("input")
        charNode.classList.add("char", `letter--${clue}`)
        charNode.placeholder = clue
        wordNode.appendChild(charNode)

        charNode.addEventListener("input", onNewInputValue)
        charNode.addEventListener("focus", function () { this.select })
        charNode.addEventListener("selectionchange", fixSelection)
        charNode.addEventListener("keydown", onKeyPressed)

        setClue(charNode, clue)
        clueToNodes.get(clue).push(charNode)
        allCharNodes.push(charNode)
      } else {
        const charNode = document.createElement("div")
        charNode.classList.add("char", "char-punctuation")
        charNode.innerText = clue
        wordNode.appendChild(charNode)
      }
    }

    root.appendChild(wordNode)
  }
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
  return node.parentNode?.firstChild === node
}

function isWordEnd(node: HTMLInputElement): boolean {
  return node.parentNode?.lastChild === node
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


const ALL_LETTERS: readonly string[] = [..."abcdefghijklmnopqrstuvwxyz"]

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