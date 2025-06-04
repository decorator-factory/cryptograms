type MainOptions = {
  cryptogramWordsNode: HTMLElement,
}

type State = "filled" | "unfilled" | "punctuation"
type Char = { value: string, state: State }
type Phrase = { words: Char[][] }

export function main(opts: MainOptions): void {
  generateHoverStyles()

  console.log("Hello from TypeScript")
  console.log(opts)
  const phrase = parsePhrase(
    "all you need in this life is ignorance and confidence, and then success is sure",
    ["u", "k", "o"],
  )
  console.log({ phrase })

  const root = opts.cryptogramWordsNode
  for (const word of phrase.words) {
    const wordNode = document.createElement("div")
    wordNode.classList.add("word")

    for (const char of word) {
      const charNode = document.createElement("div")
      charNode.classList.add("char")

      if (char.state === "punctuation") {
        charNode.classList.add("char-punctuation")
      } else {
        charNode.classList.add(`letter--${char.value.toLowerCase()}`)

        if (char.state === "filled")
          charNode.classList.add("char-filled")
      }

      charNode.innerText =
        char.state === "unfilled"
          ? dummyTransform(char.value)
          : char.value.toUpperCase()
      wordNode.appendChild(charNode)
    }

    root.appendChild(wordNode)
  }
}

const ALL_LETTERS = "abcdefghijklmnopqrstuvwxyz"

function parsePhrase(raw: string, guessed: string[]): Phrase {
  return {
    words: raw.split(" ").map(word =>
      [...word].map(char => ({
        value: char,
        state:
          "!.:?,;—".includes(char)
            ? "punctuation"
            : guessed.includes(char)
              ? "filled"
              : "unfilled"
      }))
    )
  }
}

const DUMMY_MAPPING = (() => {
  const greek = "αшэдεнлικгмνπρστυвьшωзюϛяи"
  const rv: string[] = []
  for (const g of greek) {
    if (Math.random() < 0.5)
      rv.push(g)
    else
      rv.unshift(g)
  }
  return rv.join("")
})()

function dummyTransform(letter: string): string {
  let index = ALL_LETTERS.indexOf(letter)
  return DUMMY_MAPPING[(index + 1) % DUMMY_MAPPING.length]!
}

function generateHoverStyles() {
  // TODO: this extremely cursed and doesn't scale to other language.
  // Surely there's a better way.

  const styleNode = document.createElement("style")
  let text = ""
  for (const char of ALL_LETTERS) {
    text += (
      `.cryptogram-words:has(.char.letter--${char}:hover) .letter--${char}:not(.char-filled) {`
      + "background: #f0f0f0;"
      + "outline: 1px solid #bbb;"
      + "color: #888;"
      + "}\n"
    )
  }
  styleNode.innerHTML = text
  document.body.appendChild(styleNode)
}