/** Each admin page fades in (CSS only, off for reduced-motion). */
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
