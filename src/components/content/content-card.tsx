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
};

export function ContentCard({ content }: { content: ContentCardData }) {
  const image = content.thumbnailPath ?? content.posterPath;
  return (
    <Link
      href={`/watch/${content.slug}`}
      className="group block w-56 shrink-0 snap-start sm:w-auto"
      aria-label={`${content.title} 재생`}
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
        {formatDuration(content.durationSec)}
      </p>
    </Link>
  );
}
