/** Money is integer cents. These convert what a person types, with no floating-point maths. */

/** "12" "12.5" "$12.50" -> cents. Returns null for anything else (negatives, 3 decimals, text). */
export function parseDollars(input: string): number | null {
  const m = /^\$?\s*(\d{1,6})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function formatDollars(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** "8.25" -> 825 basis points. Null if not a percentage with at most 2 decimals. */
export function parsePercentToBps(input: string): number | null {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?\s*%?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export const formatBps = (bps: number): string => formatDollars(bps); // 825 -> "8.25"
