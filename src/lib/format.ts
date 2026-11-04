const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Money is stored as integer cents; format only at the edge. */
export const formatUsd = (cents: number): string => usd.format(cents / 100);

export const formatOrderNumber = (n: number): string => `SF-${String(n).padStart(4, "0")}`;
