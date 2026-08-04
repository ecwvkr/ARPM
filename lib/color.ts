// Picks a legible foreground for a user-chosen accent color (YIQ perceived-brightness heuristic).
export function pickForeground(hex: string): "#ffffff" | "#0a0a0a" {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#0a0a0a" : "#ffffff";
}
