import { HeaderGate } from "@/components/site/header-gate";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <>
      <HeaderGate>
        <SiteHeader />
      </HeaderGate>
      {/* 모달이 열리면 TitleModal 이 이 래퍼에 inert 를 걸어 뒤 화면을 조작·포커스에서 제외한다. */}
      <div data-site-content>{children}</div>
      {modal}
    </>
  );
}
