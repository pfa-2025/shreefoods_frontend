/**
 * A template (unlike a layout) is re-created on every navigation, so each page fades in.
 * Pure CSS: it works before JavaScript loads and is switched off by the reduced-motion rule.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
