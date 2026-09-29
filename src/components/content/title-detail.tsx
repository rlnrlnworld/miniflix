import Image from "next/image";
import Link from "next/link";
import type { TitleData } from "@/lib/content";
import { formatDuration } from "@/lib/format";
import { storagePublicUrl } from "@/lib/storage";

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TitleDetail({
  data,
  loggedIn,
  titleId,
}: {
  data: TitleData;
  loggedIn: boolean;
  titleId: string;
}) {
  const { content, resumeAt, completed } = data;
  const watchHref = `/watch/${content.slug}`;
  const loginHref = `/login?next=${encodeURIComponent(watchHref)}`;
  const progress = resumeAt ? resumeAt / content.durationSec : 0;

  return (
    <article className="bg-paper-2 text-ink">
      <div className="relative aspect-video w-full">
        {content.posterPath ? (
          <Image
            src={storagePublicUrl(content.posterPath)}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="bg-paper-3 h-full w-full" />
        )}
        <div
          aria-hidden="true"
          className="from-paper-2 absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t to-transparent"
        />
        <h2
          id={titleId}
          className="text-ink absolute bottom-5 left-6 max-w-[80%] text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:bottom-8 sm:left-8 sm:text-5xl"
        >
          {content.title}
        </h2>
      </div>

      <div className="flex flex-col gap-6 px-6 pt-4 pb-8 sm:px-8">
        <div className="flex flex-wrap gap-3">
          {loggedIn ? (
            resumeAt ? (
              <>
                <Link href={watchHref} className={primaryBtn}>
                  <PlayIcon /> {formatClock(resumeAt)}부터 이어보기
                </Link>
                <Link href={`${watchHref}?restart=1`} className={secondaryBtn}>
                  처음부터
                </Link>
              </>
            ) : (
              <Link href={watchHref} className={primaryBtn}>
                <PlayIcon /> {completed ? "다시 보기" : "재생"}
              </Link>
            )
          ) : (
            <>
              <Link href={watchHref} className={primaryBtn}>
                <PlayIcon /> 미리보기 재생
              </Link>
              <Link href={loginHref} className={secondaryBtn}>
                로그인하고 전체 보기
              </Link>
            </>
          )}
        </div>

        {resumeAt && (
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="시청 진행률"
            className="h-1 w-full overflow-hidden rounded-full bg-white/15"
          >
            <div
              className="bg-accent h-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          {content.description && (
            <p className="text-ink-2 max-w-prose text-base leading-relaxed break-keep">
              {content.description}
            </p>
          )}
          <dl className="text-muted grid shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm sm:min-w-40">
            <dt>길이</dt>
            <dd className="text-ink-2">
              {formatDuration(content.durationSec)}
            </dd>
            <dt>화질</dt>
            <dd className="text-ink-2">1080p · 720p · 480p</dd>
            <dt>자막</dt>
            <dd className="text-ink-2">
              {content.subtitles.length
                ? content.subtitles.map((s) => s.label).join(", ")
                : "없음"}
            </dd>
          </dl>
        </div>
      </div>
    </article>
  );
}

const primaryBtn =
  "bg-ink text-paper hover:bg-ink-2 active:translate-y-px inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-[var(--dur-base)]";
const secondaryBtn =
  "text-ink hover:bg-paper-3 inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-base font-medium transition-colors duration-[var(--dur-base)]";

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}
