export interface CartLine {
  menuItemId: string;
  quantity: number;
}

export interface QuoteLine {
  menuItemId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface QuoteIssue {
  menuItemId: string;
  code: "NOT_FOUND" | "UNAVAILABLE";
  name?: string;
}

/** Authoritative totals from the server. The browser never computes money. */
export interface Quote {
  lines: QuoteLine[];
  issues: QuoteIssue[];
  subtotalCents: number;
  taxCents: number;
  feeCents: number;
  totalCents: number;
  taxRateBps: number;
  ordersOpen: boolean;
  canCheckout: boolean;
}
