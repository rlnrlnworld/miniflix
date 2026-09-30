import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storageAuthenticatedUrl, storageBuckets } from "@/lib/storage";

// 네이티브 HLS(iOS Safari) 전용 서명 URL 수명. 플레이어가 403 시 플레이리스트를
// 다시 받으므로 짧게 잡아도 재생은 끊기지 않는다.
const NATIVE_SIGN_TTL_SEC = 10 * 60;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEGMENT_RE = /^[\w.-]+\.(ts|m4s|mp4)$/;
const VARIANT_RE = /^[\w.-]+\/index\.m3u8$/;
// #EXT-X-MAP:URI="init.mp4" (fMP4 초기화 세그먼트) — 미디어 세그먼트와 같이 서명/인증 URL 로 치환.
const MAP_RE = /^(#EXT-X-MAP:.*URI=")([\w.-]+\.(?:mp4|m4s))(".*)$/;
// #EXT-X-MEDIA:TYPE=AUDIO,...,URI="audio/index.m3u8" (분리 오디오 렌디션) — 상대경로라 이 라우트로 돌아온다.
const MEDIA_RE = /^(#EXT-X-MEDIA:.*URI=")([\w.-]+\/index\.m3u8)(".*)$/;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("missing env: SUPABASE_SECRET_KEY");
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

function isEntry(line: string) {
  return line.length > 0 && !line.startsWith("#");
}

/**
 * 인증된 사용자에게 HLS 플레이리스트를 재작성해 준다.
 *
 * - 기본(hls.js): 세그먼트를 Storage의 `object/authenticated` URL로 치환.
 *   플레이어가 매 요청에 사용자 JWT를 실어 보내고 Storage RLS가 검증한다.
 *   URL이 유출돼도 로그인 세션 없이는 403.
 * - `?native=1`(iOS Safari 네이티브 HLS): 요청 헤더를 붙일 수 없으므로
 *   짧은 수명의 서명 URL로 치환. 이 경우 URL 자체가 수명 동안 열쇠가 된다.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/stream/[slug]/[...path]">,
) {
  const { slug, path } = await ctx.params;
  if (!SLUG_RE.test(slug) || path.some((p) => p === ".." || p.includes("/"))) {
    return new NextResponse("bad request", { status: 400 });
  }
  const file = path.at(-1);
  if (file !== "master.m3u8" && file !== "index.m3u8") {
    return new NextResponse("not found", { status: 404 });
  }
  const native = request.nextUrl.searchParams.get("native") === "1";

  const user = await getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const content = await prisma.content.findUnique({
    where: { slug },
    select: { masterPath: true },
  });
  if (!content) return new NextResponse("not found", { status: 404 });

  const { privateBucket } = storageBuckets();
  const sb = admin();
  const root = content.masterPath.replace(/\/master\.m3u8$/, "");
  const dir = path.length > 1 ? `${root}/${path.slice(0, -1).join("/")}` : root;
  const objectPath = `${dir}/${file}`;

  const { data, error } = await sb.storage
    .from(privateBucket)
    .download(objectPath);
  if (error || !data) return new NextResponse("not found", { status: 404 });
  const lines = (await data.text()).split("\n");

  let body: string;
  if (file === "master.m3u8") {
    // 변형 플레이리스트 경로는 상대경로라 다시 이 라우트로 온다.
    // 네이티브 모드 플래그만 이어 붙인다.
    const variants = lines.filter(isEntry).map((l) => l.trim());
    if (variants.some((v) => !VARIANT_RE.test(v))) {
      return new NextResponse("bad playlist", { status: 502 });
    }
    body = lines
      .map((l) => {
        if (!native) return l;
        if (isEntry(l)) return `${l.trim()}?native=1`;
        const m = MEDIA_RE.exec(l);
        return m ? `${m[1]}${m[2]}?native=1${m[3]}` : l;
      })
      .join("\n");
  } else {
    const segments = lines.filter(isEntry).map((l) => l.trim());
    for (const l of lines) {
      const m = MAP_RE.exec(l);
      if (m) segments.push(m[2]);
    }
    if (segments.some((s) => !SEGMENT_RE.test(s))) {
      return new NextResponse("bad playlist", { status: 502 });
    }
    let map: Map<string, string>;
    if (native) {
      const { data: signed, error: signErr } = await sb.storage
        .from(privateBucket)
        .createSignedUrls(
          segments.map((s) => `${dir}/${s}`),
          NATIVE_SIGN_TTL_SEC,
        );
      if (signErr || !signed)
        return new NextResponse("sign failed", { status: 502 });
      if (signed.some((s) => !s.signedUrl))
        return new NextResponse("sign failed", { status: 502 });
      map = new Map(signed.map((s, i) => [segments[i], s.signedUrl!]));
    } else {
      map = new Map(
        segments.map((s) => [s, storageAuthenticatedUrl(`${dir}/${s}`)]),
      );
    }
    body = lines
      .map((l) => {
        if (isEntry(l)) return map.get(l.trim()) ?? l;
        const m = MAP_RE.exec(l);
        return m ? `${m[1]}${map.get(m[2]) ?? m[2]}${m[3]}` : l;
      })
      .join("\n");
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "private, max-age=300",
    },
  });
}
