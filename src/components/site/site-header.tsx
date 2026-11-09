import { getSite } from "@/lib/data";
import { Header } from "./header";

// Reads the cached site settings so the header can hide the cart in menu-only mode.
export async function SiteHeader() {
  const site = await getSite();
  return <Header cartEnabled={site?.cartEnabled ?? true} />;
}
