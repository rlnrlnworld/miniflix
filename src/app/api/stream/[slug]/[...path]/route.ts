import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storageBuckets } from "@/lib/storage";

const SIGN_TTL_SEC = 60 * 60;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEGMENT_RE = /^[\w.-]+\.(ts|m4s|mp4)$/;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("missing env: SUPABASE_SECRET_KEY");
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

export async function GET(
  _request: NextRequest,
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
    body = lines.join("\n");
  } else {
    const segments = lines
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.trim());
    if (segments.some((s) => !SEGMENT_RE.test(s))) {
      return new NextResponse("bad playlist", { status: 502 });
    }
    const { data: signed, error: signErr } = await sb.storage
      .from(privateBucket)
      .createSignedUrls(
        segments.map((s) => `${dir}/${s}`),
        SIGN_TTL_SEC,
      );
    if (signErr || !signed)
      return new NextResponse("sign failed", { status: 502 });
    const map = new Map(signed.map((s, i) => [segments[i], s.signedUrl]));
    body = lines
      .map((l) => (l && !l.startsWith("#") ? (map.get(l.trim()) ?? l) : l))
      .join("\n");
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "private, max-age=300",
    },
  });
}
