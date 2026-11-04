import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/site/section";
import { MenuList } from "@/features/menu/menu-list";
import { getPage, seoMetadata } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPage("menu");
  return seoMetadata(seo, { title: "Menu", description: "Appetizers, main courses, drinks and sweets from our Maharashtrian and Gujarati kitchen." });
}

async function Header() {
  return <PageHeader title="Menu" intro={(await getPage("menu")).content.intro} />;
}

export default function MenuPage() {
  return (
    <>
      <Suspense fallback={<PageHeader title="Menu" />}>
        <Header />
      </Suspense>
      <div className="mx-auto max-w-6xl px-6 pb-8 pt-8">
        <Suspense fallback={<div className="h-96 skeleton rounded-md" aria-hidden />}>
          <MenuList />
        </Suspense>
      </div>
    </>
  );
}
