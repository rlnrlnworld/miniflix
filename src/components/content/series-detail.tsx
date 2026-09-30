import Image from "next/image";
import Link from "next/link";
import type { SeriesData } from "@/lib/content";
import { formatDuration, formatRenditions } from "@/lib/format";
import { storagePublicUrl } from "@/lib/storage";

function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SeriesDetail({
  data,
  loggedIn,
  titleId,
}: {
  data: SeriesData;
  loggedIn: boolean;
  titleId: string;
}) {
  const { series, episodes, resume } = data;
  const first = episodes[0];
  const resumeHref = resume ? `/watch/${resume.episode.slug}` : null;
  const loginHref = `/login?next=${encodeURIComponent(resumeHref ?? `/title/${series.slug}`)}`;
  const totalSec = episodes.reduce((a, e) => a + e.durationSec, 0);
  const renditions = formatRenditions(episodes.flatMap((e) => e.renditions));

  return (
    <article className="bg-paper-2 text-ink">
      <div className="relative aspect-video w-full">
        {series.posterPath ? (
          <Image
            src={storagePublicUrl(series.posterPath)}
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
          {series.title}
        </h2>
      </div>

      <div className="flex flex-col gap-6 px-6 pt-4 pb-8 sm:px-8">
        <div className="flex flex-wrap gap-3">
          {loggedIn && resume ? (
            <Link href={resumeHref!} className={primaryBtn}>
              <PlayIcon />
              {resume.rewatch
                ? `${resume.episode.episodeNo}화 다시 보기`
                : resume.positionSec > 0
                  ? `${resume.episode.episodeNo}화 ${formatClock(resume.positionSec)}부터 이어보기`
                  : `${resume.episode.episodeNo}화 재생`}
            </Link>
          ) : first ? (
            <>
              <Link href={`/watch/${first.slug}`} className={primaryBtn}>
                <PlayIcon /> 미리보기 재생
              </Link>
              <Link href={loginHref} className={secondaryBtn}>
                로그인하고 전체 보기
              </Link>
            </>
          ) : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          {series.description && (
            <p className="text-ink-2 max-w-prose text-base leading-relaxed break-keep">
              {series.description}
            </p>
          )}
          <dl className="text-muted grid shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm sm:min-w-40">
            <dt>에피소드</dt>
            <dd className="text-ink-2">{episodes.length}개</dd>
            <dt>총 길이</dt>
            <dd className="text-ink-2">{formatDuration(totalSec)}</dd>
            {renditions && (
              <>
                <dt>화질</dt>
                <dd className="text-ink-2">{renditions}</dd>
              </>
            )}
          </dl>
        </div>

        <section aria-labelledby={`${titleId}-episodes`}>
          <h3
            id={`${titleId}-episodes`}
            className="text-ink mb-3 text-lg font-semibold"
          >
            에피소드
          </h3>
          <ol className="divide-y divide-white/10">
            {episodes.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/watch/${e.slug}`}
                  className="group hover:bg-paper-3/60 -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors duration-[var(--dur-base)]"
                >
                  <span className="text-muted w-6 shrink-0 text-center text-lg font-semibold tabular-nums">
                    {e.episodeNo}
                  </span>
                  <div className="bg-paper-3 relative aspect-video w-32 shrink-0 overflow-hidden rounded-md sm:w-40">
                    {e.thumbnailPath && (
                      <Image
                        src={storagePublicUrl(e.thumbnailPath)}
                        alt=""
                        fill
                        sizes="160px"
                        className="object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] group-hover:scale-105"
                      />
                    )}
                    {e.progress > 0 && (
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(e.progress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="시청 진행률"
                        className="absolute inset-x-0 bottom-0 h-1 bg-white/25"
                      >
                        <div
                          className="bg-accent h-full"
                          style={{ width: `${Math.round(e.progress * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-base font-medium">
                      {e.title}
                      {e.completed && (
                        <span className="text-muted ml-2 text-xs font-normal">
                          시청 완료
                        </span>
                      )}
                    </p>
                    <p className="text-muted text-xs">
                      {formatDuration(e.durationSec)}
                    </p>
                    {e.description && (
                      <p className="text-ink-2 mt-1 hidden text-sm leading-snug break-keep sm:line-clamp-2">
                        {e.description}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
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
