import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { storagePublicUrl } from "@/lib/storage";

export type ContentCardData = {
  slug: string;
  title: string;
  durationSec: number;
  thumbnailPath: string | null;
  posterPath: string | null;
  progress?: number;
  /** 기본 링크(/title 또는 /watch) 대신 쓸 경로. 시리즈 카드용. */
  href?: string;
  /** 길이 대신 보여줄 보조 텍스트. 예: "2화 · 2분", "에피소드 2개". */
  meta?: string;
};

/** 에피소드면 "시리즈명 N화 · 길이", 아니면 undefined(기본 길이 표시). */
export function episodeMeta(c: {
  durationSec: number;
  episodeNo: number | null;
  series: { title: string } | null;
}): string | undefined {
  if (!c.series || c.episodeNo === null) return undefined;
  return `${c.series.title} ${c.episodeNo}화 · ${formatDuration(c.durationSec)}`;
}

export function ContentCard({ content }: { content: ContentCardData }) {
  const image = content.thumbnailPath ?? content.posterPath;
  const continuing = content.progress !== undefined;
  return (
    <Link
      href={
        content.href ??
        (continuing ? `/watch/${content.slug}` : `/title/${content.slug}`)
      }
      scroll={false}
      className="group block w-56 shrink-0 snap-start sm:w-auto"
      aria-label={
        continuing ? `${content.title} 이어보기` : `${content.title} 상세 정보`
      }
    >
      <div className="bg-paper-2 relative aspect-video overflow-hidden rounded-lg">
        {image ? (
          <Image
            src={storagePublicUrl(image)}
            alt=""
            fill
            sizes="(min-width: 640px) 25vw, 224px"
            className="object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] group-hover:scale-105"
          />
        ) : (
          <div className="text-muted flex h-full items-center justify-center text-sm">
            이미지 없음
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-[var(--dur-base)] group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="text-ink inline-flex size-12 items-center justify-center rounded-full bg-black/60">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 4.5v15l12-7.5z" />
            </svg>
          </span>
        </div>
        {content.progress !== undefined && (
          <div
            role="progressbar"
            aria-valuenow={Math.round(content.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="시청 진행률"
            className="absolute inset-x-0 bottom-0 h-1 bg-white/25"
          >
            <div
              className="bg-accent h-full"
              style={{ width: `${Math.round(content.progress * 100)}%` }}
            />
          </div>
        )}
      </div>
      <p className="text-ink mt-2 truncate text-sm font-medium">
        {content.title}
      </p>
      <p className="text-muted text-xs">
        {content.meta ?? formatDuration(content.durationSec)}
      </p>
    </Link>
  );
}
