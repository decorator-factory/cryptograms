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
  const words = seed.toLowerCase().split(" ")

  const clueToNodes = new Map<string, HTMLInputElement[]>(ALL_LETTERS.map(char => [char, []]))

  const allCharNodes: [string, HTMLInputElement][] = []
  const wordStarts: HTMLInputElement[] = []
  const wordEnds: HTMLInputElement[] = []

  function onNewInputValue(char: string, node: HTMLInputElement) {
    const newGuess = node.value.toLowerCase()[0]
    if (newGuess) {
      for (const node of clueToNodes.get(char) || []) {
        node.value = newGuess
        node.classList.remove("char-wrong")
        node.classList.add("char-filled")
      }
      selectCharNode(findNextFreeNode(char, node))
    } else {
      // Backspace is handled directly, but text can be erased
      // in other ways (like Delete and Ctrl+X)
      eraseCell(char)
      selectCharNode(findPrevNode(char, node))
    }
    markRepeatedGuesses()
  }

  function eraseCell(char: string) {
    for (const node of clueToNodes.get(char) || []) {
      node.value = ""
      node.classList.remove("char-filled")
      node.classList.remove("char-wrong")
    }
  }

  function markRepeatedGuesses() {
    const guessToClue = new Map<string, string>()
    const cluesWithMistakes = new Set<string>()

    for (const [clue, node] of allCharNodes) {
      node.classList.remove("char-wrong")

      if (!node.value)
        continue

      let prevClue = guessToClue.get(node.value)
      if (prevClue && prevClue !== clue) {
        cluesWithMistakes.add(prevClue)
        cluesWithMistakes.add(clue)
      } else {
        guessToClue.set(node.value, clue)
      }
    }

    for (const clue of cluesWithMistakes)
      for (const node of clueToNodes.get(clue)!)
        node.classList.add("char-wrong")
  }

  function _searchNode(
    node: HTMLInputElement,
    nodes: Iterable<[string, HTMLInputElement]>,
    predicate: (char: string, node: HTMLInputElement) => boolean,
  ): HTMLInputElement | null {
    let foundOurPosition = false
    for (const [ch, n] of nodes) {
      if (n === node)
        foundOurPosition = true
      else if (foundOurPosition && predicate(ch, n))
        return n
    }
    return null
  }

  const findNextWordEnd = (node: HTMLInputElement) =>
    _searchNode(node, allCharNodes, (ch, n) => wordEnds.includes(n))

  const findPrevWordStart = (node: HTMLInputElement) =>
    _searchNode(node, reverse(allCharNodes), (ch, n) => wordStarts.includes(n))

  const findNextNode = (char: string, node: HTMLInputElement) =>
    _searchNode(node, allCharNodes, (ch) => ch !== char)

  const findPrevNode = (char: string, node: HTMLInputElement) =>
    _searchNode(node, reverse(allCharNodes), (ch) => ch !== char)

  const findNextFreeNode = (char: string, node: HTMLInputElement) =>
    _searchNode(node, allCharNodes, (ch, n) => ch !== char && n.value === "")

  const findPrevFreeNode = (char: string, node: HTMLInputElement) =>
    _searchNode(node, reverse(allCharNodes), (ch, n) => ch !== char && n.value === "")

  for (const word of words) {
    const wordNode = document.createElement("div")
    wordNode.classList.add("word")

    for (const clue of word) {
      if (ALL_LETTERS.includes(clue)) {
        const charNode = document.createElement("input")
        charNode.classList.add("char", `letter--${clue}`)
        charNode.placeholder = clue
        wordNode.appendChild(charNode)

        charNode.addEventListener("input", () => { onNewInputValue(clue, charNode) })
        charNode.addEventListener("focus", () => { charNode.select() })
        charNode.addEventListener("selectionchange", (e) => {
          // Force selection to only be one of:
          // - 0..0 if the input is empty
          // - 0..0 if the input is filled -- that's fine, since
          //   onNewInputValue takes the first charatcer
          // - 0..1 to select the first character

          // this will avoid strange surprises, especially on mobile, and especially since
          // "native" selection styles are hidden

          const [start, end] = [charNode.selectionStart, charNode.selectionEnd]

          if (start !== 0 || (end !== 0 && end !== 1)) {
            charNode.setSelectionRange(0, 1)
          }
        })

        charNode.addEventListener("keydown", (e) => {
          switch (e.key) {
            case "Backspace":
              eraseCell(clue)
              selectCharNode(findPrevNode(clue, charNode))
              e.stopPropagation()
              e.preventDefault()
              break

            case "ArrowRight":
              if (e.ctrlKey) {
                selectCharNode(
                  wordEnds.includes(charNode)
                    ? findNextNode(clue, charNode)
                    : findNextWordEnd(charNode)
                )
              } else if (e.shiftKey) {
                selectCharNode(findNextFreeNode(clue, charNode))
              } else {
                selectCharNode(findNextNode(clue, charNode))
              }
              break

            case "ArrowLeft":
              if (e.ctrlKey) {
                selectCharNode(
                  wordStarts.includes(charNode)
                    ? findPrevNode(clue, charNode)
                    : findPrevWordStart(charNode)
                )
              } else if (e.shiftKey) {
                selectCharNode(findPrevFreeNode(clue, charNode))
              } else {
                selectCharNode(findPrevNode(clue, charNode))
              }
              break

            case "Home":
              allCharNodes[0]![1].select()
              break

            case "End":
              allCharNodes[allCharNodes.length - 1]![1].select()
              break
          }
        })

        clueToNodes.get(clue)!.push(charNode)
        allCharNodes.push([clue, charNode])
      } else {
        const charNode = document.createElement("div")
        charNode.classList.add("char")
        charNode.classList.add("char-punctuation")
        charNode.innerText = clue
        wordNode.appendChild(charNode)
      }
    }

    wordStarts.push(wordNode.firstChild as HTMLInputElement)
    wordEnds.push(wordNode.lastChild as HTMLInputElement)
    root.appendChild(wordNode)
  }
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
  for (let i = items.length - 1; i >= 0; i--) {
    yield items[i] as T
  }
}
