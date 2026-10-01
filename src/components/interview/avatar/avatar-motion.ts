export function normalizeSpeechLevel(level: number): number {
  const scaled = (level - 0.012) / 0.09;
  if (scaled <= 0) return 0;
  if (scaled >= 1) return 1;
  return scaled;
}

export function mouthWeights(openness: number): { closed: number; slight: number; medium: number; wide: number } {
  const stops = [
    { key: "closed", at: 0 },
    { key: "slight", at: 0.28 },
    { key: "medium", at: 0.58 },
    { key: "wide", at: 0.92 },
  ] as const;
  const weights = stops.map((stop, index) => {
    const prev = stops[index - 1]?.at ?? stop.at - 0.34;
    const next = stops[index + 1]?.at ?? stop.at + 0.34;
    if (openness <= stop.at) {
      const span = stop.at - prev || 1;
      return Math.max(0, 1 - (stop.at - openness) / span);
    }
    const span = next - stop.at || 1;
    return Math.max(0, 1 - (openness - stop.at) / span);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const [closed, slight, medium, wide] = weights.map((weight) => weight / total);
  return { closed, slight, medium, wide };
}
