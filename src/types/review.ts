/** A review as the public sees it. No contact details, ever. */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  displayName: string;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
}
export interface ReviewsData {
  summary: { count: number; average: number | null };
  reviews: PublicReview[];
}
/** The customer's own review of their order. "received" = submitted but not (yet) public. */
export interface OwnReview {
  rating: number;
  comment: string | null;
  displayName: string;
  visibility: "public" | "received";
  reply: string | null;
}
