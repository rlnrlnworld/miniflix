import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
      {modal}
    </>
  );
}
