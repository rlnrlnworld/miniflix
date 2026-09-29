import { SiteHeader } from "@/components/site/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-paper text-ink min-h-dvh pt-16">
        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8">
          <h1 className="text-2xl font-bold tracking-tight">홈</h1>
        </section>
      </main>
    </>
  );
}
