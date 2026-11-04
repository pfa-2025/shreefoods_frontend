export type FulfillmentStatus = "PENDING_ACCEPTANCE" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "AWAITING_VERIFICATION" | "PAID" | "FAILED" | "REFUNDED";

import type { OwnReview } from "./review";

/** What the public, link-based order API returns. It never includes customer details. */
export interface PublicOrder {
  orderNumber: number;
  createdAt: string;
  restaurantName: string;
  fulfillmentType: "PICKUP" | "DINE_IN" | "DELIVERY";
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  cancelReason: string | null;
  items: { name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
  subtotalCents: number;
  taxCents: number;
  feeCents: number;
  totalCents: number;
  /** True once the order is ready and hasn't been reviewed yet. */
  canReview: boolean;
  review: OwnReview | null;
  /** True when real emails are being sent; false in development (log-only mode). */
  emailsEnabled: boolean;
  payment: { qrUrl: string | null; qrAlt: string; handle: string | null; instructions: string } | null;
}
