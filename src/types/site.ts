export interface OpeningHours {
  day: string;
  hours: string;
}
export interface SocialLink {
  label: string;
  url: string;
}
export interface SiteInfo {
  restaurantName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingHours: OpeningHours[];
  socialLinks: SocialLink[];
  ordersOpen: boolean;
  fulfillment: { pickup: boolean; dineIn: boolean; delivery: boolean };
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  imageAlt: string;
  linkUrl: string | null;
}
