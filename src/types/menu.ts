export interface MenuItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  imageAlt: string;
  isAvailable: boolean;
  isFeatured: boolean;
  dietaryLabels: string[];
}

export interface MenuCategory {
  id: string;
  slug: string;
  name: string;
  items: MenuItem[];
}
