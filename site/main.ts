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

  const clueToNodes = new Map<string, HTMLInputElement[]>(
    [...ALL_LETTERS].map(char => [char, []]))

  const allCharNodes: [string, HTMLInputElement][] = []
  const wordStarts: HTMLInputElement[] = []
  const wordEnds: HTMLInputElement[] = []

  const onNewInputValue = (char: string, node: HTMLInputElement) => {
    const newGuess = node.value.toLowerCase()[0]
    if (newGuess) {
      if (ALL_LETTERS.includes(newGuess)) {
        for (const node of clueToNodes.get(char) || []) {
          node.value = newGuess
          node.classList.remove("char-wrong")
          node.classList.add("char-filled")
        }
        selectCharNode(nextFreeNode(char, node))
      }
    } else {
      eraseCell(char, node)
      selectCharNode(anyPrevNode(char, node))
    }
    markRepeatedGuesses()
  }

  const eraseCell = (char: string, node: HTMLInputElement) => {
    for (const node of clueToNodes.get(char) || []) {
      node.value = ""
      node.classList.remove("char-filled")
      node.classList.remove("char-wrong")
    }
  }

  const markRepeatedGuesses = () => {
    const guessToClues = new Map<string, Set<string>>()

    for (const [clue, node] of allCharNodes) {
      node.classList.remove("char-wrong")

      if (!node.value)
        continue

      let clues = guessToClues.get(node.value)
      if (clues)
        clues.add(clue)
      else
        guessToClues.set(node.value, new Set([clue]))
    }

    const cluesWithMistakes =
      [...guessToClues.entries()]
        .filter(([_, clues]) => clues.size > 1)
        .flatMap(([_, clues]) => [...clues])

    for (const clue of cluesWithMistakes)
      for (const node of clueToNodes.get(clue)!)
        node.classList.add("char-wrong")


  }

  const findNextNode = (
    char: string,
    node: HTMLInputElement,
    nodes: [string, HTMLInputElement][],
    predicate: (char: string, node: HTMLInputElement) => boolean,
  ): HTMLInputElement | null => {
    let foundOurPosition = false;
    for (const [ch, n] of nodes) {
      if (n === node)
        foundOurPosition = true
      else if (foundOurPosition && ch !== char && predicate(ch, n))
        return n
    }
    return null
  }

  const nextWordEnd = (char: string, node: HTMLInputElement) =>
    findNextNode(char, node, allCharNodes, (ch, n) => wordEnds.includes(n))

  const prevWordStart = (char: string, node: HTMLInputElement) =>
    findNextNode(char, node, [...allCharNodes].reverse(), (ch, n) => wordStarts.includes(n))

  const anyNextNode = (char: string, node: HTMLInputElement) =>
    findNextNode(char, node, allCharNodes, () => true)

  const anyPrevNode = (char: string, node: HTMLInputElement) =>
    findNextNode(char, node, [...allCharNodes].reverse(), () => true)

  const nextFreeNode = (char: string, node: HTMLInputElement) =>
    findNextNode(char, node, allCharNodes, (ch, n) => n.value === "")

  const prevFreeNode = (prevChar: string, prevNode: HTMLInputElement) =>
    findNextNode(prevChar, prevNode, [...allCharNodes].reverse(), (ch, n) => n.value === "")

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
          if (e.key === "Backspace") {
            eraseCell(clue, charNode)
            selectCharNode(anyPrevNode(clue, charNode))
            e.stopPropagation()
            e.preventDefault()
          } else if (e.key === "ArrowRight") {
            if (e.ctrlKey) {
              if (wordEnds.includes(charNode))
                selectCharNode(anyNextNode(clue, charNode))
              else
                selectCharNode(nextWordEnd(clue, charNode))
            } else if (e.shiftKey) {
              selectCharNode(nextFreeNode(clue, charNode))
            } else {
              selectCharNode(anyNextNode(clue, charNode))
            }
          } else if (e.key === "ArrowLeft") {
            if (e.ctrlKey) {
              if (wordStarts.includes(charNode))
                selectCharNode(anyPrevNode(clue, charNode))
              else
                selectCharNode(prevWordStart(clue, charNode))
            } else if (e.shiftKey) {
              selectCharNode(prevFreeNode(clue, charNode))
            } else {
              selectCharNode(anyPrevNode(clue, charNode))
            }
          } else if (e.key === "Home") {
            allCharNodes[0]![1].select()
          } else if (e.key === "End") {
            allCharNodes[allCharNodes.length - 1]![1].select()
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


const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz"

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
  // TODO: this extremely cursed and doesn't scale to other languages. Hopefully there's a better way.

  const styleNode = document.createElement("style")
  let text = ""

  text +=
    [...ALL_LETTERS]
      .map(char => `.cryptogram-words:has(.char.letter--${char}:hover) .letter--${char}`)
      .join(",\n")
  text += ` {
    background: var(--hover-bg);
    outline: 1px solid var(--hover-outline);
    color: var(--hover-color);
  }\n`

  text +=
    [...ALL_LETTERS]
      .map(char => `.cryptogram-words:has(.char.letter--${char}:focus) .letter--${char}`)
      .join(",\n")

  text += ` {
    background: var(--focus-bg);
    &::placeholder { color: var(--focus-color); }
  }\n`


  styleNode.innerHTML = text
  document.body.appendChild(styleNode)
}
