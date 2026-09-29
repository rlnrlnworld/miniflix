"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type Hls from "hls.js";

export type SubtitleTrack = {
  lang: string;
  label: string;
  src: string;
  isDefault: boolean;
};

type Props = {
  title: string;
  description?: string | null;
  mode?: "full" | "trailer";
  loginHref?: string;
  src: string;
  poster?: string;
  subtitles: SubtitleTrack[];
  startAt?: number;
};

type Level = { index: number; height: number; bitrate: number };
type Status = "loading" | "ready" | "error";
type Engine = "hls.js" | "native" | "unsupported";
type Menu = "quality" | "subtitle" | "rate" | null;

const AUTO = -1;
const HIDE_DELAY = 2500;
const INFO_DELAY = 100;
const RELOAD_COOLDOWN_MS = 30_000;
const SUBTITLE_PRIORITY = ["ko", "en"];

function defaultSubtitle(subtitles: SubtitleTrack[]): string {
  const explicit = subtitles.find((s) => s.isDefault);
  if (explicit) return explicit.lang;
  for (const lang of SUBTITLE_PRIORITY) {
    if (subtitles.some((s) => s.lang === lang)) return lang;
  }
  return "off";
}

async function autoplay(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    video.muted = true;
    video.play().catch(() => {});
  }
}
const SEEK_STEP = 10;
const CUE_LINE_CHROME = 78;
const CUE_LINE_PLAIN = 92;
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export function HlsPlayer({
  title,
  description,
  src,
  poster,
  subtitles,
  startAt,
  mode = "full",
  loginHref = "/login",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const menuId = useId();

  const [engine, setEngine] = useState<Engine>("hls.js");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selected, setSelected] = useState<number>(AUTO);
  const [playing, setPlaying] = useState<Level | null>(null);
  const [subtitle, setSubtitle] = useState<string>(() =>
    defaultSubtitle(subtitles),
  );
  const [menu, setMenu] = useState<Menu>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);

  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [rate, setRate] = useState(1);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;

    async function attach() {
      const { default: Hls } = await import("hls.js");
      if (disposed || !video) return;

      if (Hls.isSupported()) {
        const hls = new Hls({ startPosition: startAt ?? -1 });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setLevels(
            data.levels.map((l, i) => ({
              index: i,
              height: l.height,
              bitrate: l.bitrate,
            })),
          );
          setStatus("ready");
          autoplay(video);
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          const l = hls.levels[data.level];
          if (l)
            setPlaying({
              index: data.level,
              height: l.height,
              bitrate: l.bitrate,
            });
        });
        let lastReload = 0;
        const reloadSigned = () => {
          const now = Date.now();
          if (now - lastReload < RELOAD_COOLDOWN_MS) return false;
          lastReload = now;
          const t = video.currentTime;
          const wasPaused = video.paused;
          hls.once(Hls.Events.MANIFEST_PARSED, () => {
            video.currentTime = t;
            if (!wasPaused) video.play().catch(() => {});
          });
          hls.loadSource(src);
          return true;
        };
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const code = data.response?.code;
            if ((code === 400 || code === 403) && reloadSigned()) return;
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          setErrorMsg(
            "재생할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
          );
          setStatus("error");
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        setEngine("native");
        video.src = src;
        if (startAt) video.currentTime = startAt;
        setStatus("ready");
        autoplay(video);
        return;
      }

      setEngine("unsupported");
      setErrorMsg("이 브라우저는 HLS 재생을 지원하지 않습니다.");
      setStatus("error");
    }

    attach();
    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, startAt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(video.duration);
    const onProgress = () => {
      const b = video.buffered;
      if (b.length) setBuffered(b.end(b.length - 1));
    };
    const onPlay = () => {
      setPaused(false);
      setInfoVisible(false);
    };
    const onPause = () => setPaused(true);
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onVolume = () => setMuted(video.muted);
    const onRate = () => setRate(video.playbackRate);
    const onEnded = () => {
      setEnded(true);
      setInfoVisible(false);
    };
    const onSeeking = () => setEnded(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ratechange", onRate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeking", onSeeking);
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ratechange", onRate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeking", onSeeking);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of Array.from(video.textTracks)) {
      track.mode = track.language === subtitle ? "showing" : "hidden";
    }
  }, [subtitle, status]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const line = chromeVisible ? CUE_LINE_CHROME : CUE_LINE_PLAIN;
    const apply = () => {
      for (const track of Array.from(video.textTracks)) {
        for (const cue of Array.from(track.cues ?? [])) {
          const c = cue as VTTCue;
          c.snapToLines = false;
          c.line = line;
        }
      }
    };
    apply();
    const tracks = Array.from(video.querySelectorAll("track"));
    tracks.forEach((t) => t.addEventListener("load", apply));
    return () => tracks.forEach((t) => t.removeEventListener("load", apply));
  }, [chromeVisible, subtitle, status]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(
      Math.max(0, video.currentTime + delta),
      video.duration || 0,
    );
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }, []);

  const selectRate = useCallback((r: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = r;
    setMenu(null);
  }, []);

  const selectLevel = useCallback((index: number) => {
    setSelected(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setMenu(null);
  }, []);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    setInfoVisible(false);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!menu) setChromeVisible(false);
    }, HIDE_DELAY);
  }, [menu]);

  useEffect(() => {
    hideTimer.current = window.setTimeout(() => {
      if (!menu) setChromeVisible(false);
    }, HIDE_DELAY);
    return () => window.clearTimeout(hideTimer.current);
  }, [menu]);

  useEffect(() => {
    if (!paused || ended || chromeVisible || status !== "ready") return;
    const t = window.setTimeout(() => setInfoVisible(true), INFO_DELAY);
    return () => window.clearTimeout(t);
  }, [paused, ended, chromeVisible, status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          seekBy(-SEEK_STEP);
          break;
        case "ArrowRight":
          seekBy(SEEK_STEP);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "Escape":
          setMenu(null);
          break;
        default:
          return;
      }
      showChrome();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleMute, toggleFullscreen, showChrome]);

  const levelsDesc = [...levels].sort((a, b) => b.height - a.height);
  const trailerEnded = mode === "trailer" && ended;
  const chromeClass =
    chromeVisible && !trailerEnded
      ? "opacity-100"
      : "pointer-events-none opacity-0";
  const chromeTransition =
    "transition-opacity duration-[var(--dur-slow)] ease-[var(--ease-out)]";
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={rootRef}
      className={`relative flex h-dvh w-full flex-col bg-black ${chromeVisible || trailerEnded ? "" : "cursor-none"}`}
      onMouseMove={showChrome}
      onTouchStart={showChrome}
      onPointerDown={(e) => {
        if (menu && !(e.target as HTMLElement).closest("[data-menu]"))
          setMenu(null);
      }}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={poster}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onClick={togglePlay}
      >
        {subtitles.map((s) => (
          <track
            key={s.lang}
            kind="subtitles"
            srcLang={s.lang}
            label={s.label}
            src={s.src}
            default={s.lang === subtitle}
          />
        ))}
      </video>

      <header
        className={`absolute inset-x-0 top-0 flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent px-4 pt-3 pb-10 ${chromeTransition} ${chromeClass}`}
      >
        <Link
          href="/"
          aria-label="홈으로"
          className="text-ink hover:bg-paper-3 active:bg-paper-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-base)]"
        >
          <Icon name="back" />
        </Link>
        <h1 className="text-ink min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
          {title}
        </h1>
        {mode === "trailer" && (
          <Link
            href={loginHref}
            className="bg-accent inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-white transition-[filter] duration-[var(--dur-base)] hover:brightness-110 active:translate-y-px"
          >
            로그인하여 전체 보기
          </Link>
        )}
      </header>

      {(status === "loading" || waiting) && status !== "error" && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="border-ink/30 border-t-ink size-10 animate-spin rounded-full border-2" />
          <span className="sr-only">불러오는 중</span>
        </div>
      )}

      <div
        aria-hidden={!infoVisible}
        className={`pointer-events-none absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/90 via-black/60 to-black/30 px-6 pb-24 sm:justify-center sm:px-16 sm:pb-0 ${chromeTransition} ${infoVisible ? "opacity-100" : "opacity-0"}`}
      >
        <p className="text-ink-2 mb-3 text-sm font-medium tracking-wide sm:text-base">
          지금 시청 중
        </p>
        <h2 className="text-ink max-w-3xl text-4xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-6xl">
          {title}
        </h2>
        {description && (
          <p className="text-ink-2 mt-4 max-w-xl text-base leading-relaxed break-keep sm:text-lg">
            {description}
          </p>
        )}
        <p className="text-muted mt-6 text-sm">일시정지됨</p>
        {mode === "trailer" && (
          <Link
            href={loginHref}
            className={`bg-accent mt-6 inline-flex h-12 w-fit items-center self-start rounded-full px-6 text-base font-semibold text-white transition-[filter] duration-[var(--dur-base)] hover:brightness-110 active:translate-y-px ${infoVisible ? "pointer-events-auto" : ""}`}
          >
            로그인하여 전체 보기
          </Link>
        )}
      </div>

      {status === "ready" &&
        paused &&
        !waiting &&
        !infoVisible &&
        !trailerEnded && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="재생"
            className="text-ink hover:bg-paper-3/90 absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 backdrop-blur transition-[background-color,transform] duration-[var(--dur-base)] active:scale-95"
          >
            <Icon name="play" size={36} />
          </button>
        )}

      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-linear-to-t from-black/85 to-transparent px-4 pt-12 pb-4 ${chromeTransition} ${chromeClass}`}
      >
        <div className="group relative h-6 w-full">
          <div className="bg-ink/20 absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full">
            <div
              className="bg-ink/35 absolute inset-y-0 left-0"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="bg-accent absolute inset-y-0 left-0"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            aria-label="재생 위치"
            aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
            onChange={(e) => {
              const video = videoRef.current;
              if (video) video.currentTime = Number(e.target.value);
            }}
            disabled={status !== "ready"}
            className="seek absolute inset-0 w-full cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label={paused ? "재생" : "일시정지"}
            onClick={togglePlay}
            disabled={status !== "ready"}
          >
            <Icon name={paused ? "play" : "pause"} />
          </IconButton>
          <IconButton
            label="10초 뒤로"
            onClick={() => seekBy(-SEEK_STEP)}
            disabled={status !== "ready"}
          >
            <Icon name="rewind" />
          </IconButton>
          <IconButton
            label="10초 앞으로"
            onClick={() => seekBy(SEEK_STEP)}
            disabled={status !== "ready"}
          >
            <Icon name="forward" />
          </IconButton>
          <IconButton
            label={muted ? "음소거 해제" : "음소거"}
            onClick={toggleMute}
          >
            <Icon name={muted ? "muted" : "volume"} />
          </IconButton>
          <span className="text-ink-2 ml-2 text-sm tabular-nums">
            {formatTime(currentTime)}
            <span className="text-muted"> / {formatTime(duration)}</span>
          </span>

          <div className="flex-1" />

          {engine === "hls.js" && levels.length > 1 && (
            <MenuButton
              id={`${menuId}-q`}
              label={
                selected === AUTO
                  ? `자동${playing ? ` · ${playing.height}p` : ""}`
                  : `${levels[selected]?.height}p`
              }
              open={menu === "quality"}
              onToggle={() =>
                setMenu((m) => (m === "quality" ? null : "quality"))
              }
            >
              <MenuItem
                active={selected === AUTO}
                onSelect={() => selectLevel(AUTO)}
              >
                자동
                {playing && (
                  <span className="text-muted ml-2 text-xs">
                    {playing.height}p ·{" "}
                    {(playing.bitrate / 1_000_000).toFixed(1)} Mbps
                  </span>
                )}
              </MenuItem>
              {levelsDesc.map((l) => (
                <MenuItem
                  key={l.index}
                  active={selected === l.index}
                  onSelect={() => selectLevel(l.index)}
                >
                  {l.height}p
                  <span className="text-muted ml-2 text-xs">
                    {(l.bitrate / 1_000_000).toFixed(1)} Mbps
                  </span>
                </MenuItem>
              ))}
            </MenuButton>
          )}

          <MenuButton
            id={`${menuId}-r`}
            label={`${rate}x`}
            open={menu === "rate"}
            onToggle={() => setMenu((m) => (m === "rate" ? null : "rate"))}
          >
            {RATES.map((r) => (
              <MenuItem
                key={r}
                active={rate === r}
                onSelect={() => selectRate(r)}
              >
                {r === 1 ? "기본" : `${r}x`}
              </MenuItem>
            ))}
          </MenuButton>

          <MenuButton
            id={`${menuId}-s`}
            label={
              subtitle === "off"
                ? "자막"
                : (subtitles.find((s) => s.lang === subtitle)?.label ?? "자막")
            }
            open={menu === "subtitle"}
            onToggle={() =>
              setMenu((m) => (m === "subtitle" ? null : "subtitle"))
            }
          >
            {subtitles.length === 0 ? (
              <li role="none" className="text-muted px-4 py-3 text-sm">
                제공되는 자막이 없습니다
              </li>
            ) : (
              <>
                <MenuItem
                  active={subtitle === "off"}
                  onSelect={() => {
                    setSubtitle("off");
                    setMenu(null);
                  }}
                >
                  끔
                </MenuItem>
                {subtitles.map((s) => (
                  <MenuItem
                    key={s.lang}
                    active={subtitle === s.lang}
                    onSelect={() => {
                      setSubtitle(s.lang);
                      setMenu(null);
                    }}
                  >
                    {s.label}
                  </MenuItem>
                ))}
              </>
            )}
          </MenuButton>

          <IconButton
            label={fullscreen ? "전체화면 종료" : "전체화면"}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? "shrink" : "expand"} />
          </IconButton>
        </div>
      </div>

      {mode === "trailer" && ended && (
        <div
          role="dialog"
          aria-labelledby="trailer-end-title"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center"
        >
          <h2
            id="trailer-end-title"
            className="text-ink max-w-lg text-2xl font-bold break-keep sm:text-3xl"
          >
            로그인하고 {title} 전체를 감상하세요
          </h2>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href={loginHref}
              className="bg-accent inline-flex h-12 items-center rounded-full px-6 text-base font-semibold text-white transition-[filter] duration-[var(--dur-base)] hover:brightness-110 active:translate-y-px"
            >
              로그인하고 전체 보기
            </Link>
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.currentTime = 0;
                v.play();
              }}
              className="text-ink hover:bg-paper-3 inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-base font-medium transition-colors duration-[var(--dur-base)]"
            >
              다시 보기
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center"
        >
          <p className="text-ink text-base">{errorMsg}</p>
          {engine !== "unsupported" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-ink text-paper hover:bg-ink-2 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-[var(--dur-base)] active:translate-y-px"
            >
              다시 시도
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="text-ink hover:bg-paper-3 active:bg-paper-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-base)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuButton({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0" data-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="text-ink hover:bg-paper-3 active:bg-paper-2 aria-expanded:bg-paper-3 inline-flex h-11 items-center rounded-full px-3 text-sm font-medium transition-colors duration-[var(--dur-base)]"
      >
        {label}
      </button>
      {open && (
        <ul
          id={id}
          role="menu"
          className="bg-paper-2 border-rule absolute right-0 bottom-full z-10 mb-2 min-w-44 overflow-hidden rounded-xl border py-1 shadow-xl"
        >
          {children}
        </ul>
      )}
    </div>
  );
}

function MenuItem({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={onSelect}
        className="text-ink hover:bg-paper-3 active:bg-paper aria-checked:text-accent flex h-11 w-full items-center px-4 text-left text-sm transition-colors duration-[var(--dur-fast)]"
      >
        {children}
      </button>
    </li>
  );
}

const ICONS = {
  back: <path d="M15 5l-7 7 7 7" />,
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <path
      d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"
      fill="currentColor"
      stroke="none"
    />
  ),
  rewind: (
    <>
      <path
        d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
        fill="currentColor"
        stroke="none"
      />
      <text
        x="12"
        y="15.8"
        fontSize="6.5"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </>
  ),
  forward: (
    <>
      <path
        d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"
        fill="currentColor"
        stroke="none"
      />
      <text
        x="12"
        y="15.8"
        fontSize="6.5"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </>
  ),
  volume: (
    <path d="M4 10v4h3l4 4V6l-4 4zM15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11" />
  ),
  muted: <path d="M4 10v4h3l4 4V6l-4 4zM15 9l5 6M20 9l-5 6" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
} as const;

function Icon({
  name,
  size = 22,
}: {
  name: keyof typeof ICONS;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
