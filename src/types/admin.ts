import type { FulfillmentStatus, PaymentStatus } from "./order";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "STAFF";
}

export interface AdminOrder {
  id: string;
  orderNumber: number;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  fulfillmentType: "PICKUP" | "DINE_IN" | "DELIVERY";
  notes: string | null;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  paymentReportedAt: string | null;
  cancelReason: string | null;
  updatedAt: string;
  acknowledgedAt: string | null;
  /** Id of the latest "customer reported payment" event: the hooter de-duplicates on this. */
  alertSeq: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  items: { name: string; quantity: number; lineTotalCents: number }[];
}

export interface OrdersPage {
  orders: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Dashboard {
  queue: { pendingAcceptance: number; accepted: number; preparing: number; ready: number; awaitingPaymentVerification: number; reviewsToModerate: number };
  range: { orders: number; completed: number; revenueCents: number | null; paidOrders: number | null };
  recentActivity: { id: string; type: string; createdAt: string; orderNumber: number }[];
}

export interface LiveSnapshot {
  orders: AdminOrder[];
  latestSeq: string;
  serverTime: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  altText: string;
  bytes: number | null;
  mimeType: string | null;
  createdAt: string;
  usage?: { menuItems: number; announcements: number; paymentQr: number };
}

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageId: string | null;
  imageUrl: string | null;
  imageAlt: string;
  isAvailable: boolean;
  isArchived: boolean;
  isFeatured: boolean;
  dietaryLabels: string[];
  sortOrder: number;
}
export interface AdminMenuCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isArchived: boolean;
  items: AdminMenuItem[];
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  imageId: string | null;
  imageUrl: string | null;
  imageAlt: string;
  linkUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishAt: string | null;
  sortOrder: number;
}

export interface AdminReview {
  id: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  rating: number;
  comment: string | null;
  displayName: string;
  status: "PENDING" | "PUBLISHED" | "HIDDEN";
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}
export interface AdminReviewsPage {
  total: number;
  page: number;
  pageSize: number;
  counts: { pending: number; published: number; hidden: number };
  reviews: AdminReview[];
}
