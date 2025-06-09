export function defaultMap<V>(init: () => V) {
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

export function* reverse<T>(items: readonly T[]) {
  for (let i = items.length - 1; i >= 0; i--)
    yield items[i] as T
}

