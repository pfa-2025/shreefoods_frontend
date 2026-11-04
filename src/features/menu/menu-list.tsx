import { EmptyState, ErrorState } from "@/components/site/section";
import { getMenu, getSite } from "@/lib/data";
import { MenuBrowser } from "./menu-browser";

export async function MenuList() {
  const [categories, site] = await Promise.all([getMenu(), getSite()]);

  if (!categories) return <ErrorState>The menu couldn’t be loaded. Please try again shortly.</ErrorState>;
  if (categories.length === 0) {
    return <EmptyState title="Menu coming soon">We’re updating our menu. Please check back shortly.</EmptyState>;
  }
  // If site settings fail to load, browsing still works; the server re-checks everything at checkout.
  return <MenuBrowser categories={categories} ordersOpen={site?.ordersOpen ?? true} />;
}
