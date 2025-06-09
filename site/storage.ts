type Stats = {
  version: string,
  timestamp: number,
  solvedCryptograms: string[],
}

export function getStats(): Stats {
  const rawStats = localStorage.getItem("cryptogram-stats")
  if (!rawStats)
    return resetStats()

  const stats = JSON.parse(rawStats)

  if (stats.version !== "0.0.1") {
    console.warn("Stats for an unknown version found:", rawStats)
    return resetStats()
  }

  return stats
}

export function resetStats(): Stats {
  const stats: Stats = {
    version: "0.0.1",
    timestamp: new Date().getTime(),
    solvedCryptograms: [],
  }
  writeStats(stats)
  return stats
}

export function writeStats(stats: Stats): void {
  localStorage.setItem("cryptogram-stats", JSON.stringify(stats))
}
