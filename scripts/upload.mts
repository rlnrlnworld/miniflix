// 사용: pnpm upload <slug> [subdir] [--public]
// 기본은 private 버킷(HLS). --public 이면 public 버킷(포스터·자막·트레일러)
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONCURRENCY = 8;

const MIME: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

const CACHE: Record<string, string> = {
  ".m3u8": "3600",
  ".vtt": "3600",
};
const DEFAULT_CACHE = "31536000";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && !e.name.startsWith(".")) files.push(full);
  }
  return files;
}

async function main() {
  const isPublic = process.argv.includes("--public");
  const [slug, subdir] = process.argv
    .slice(2)
    .filter((a) => !a.startsWith("--"));
  if (!slug || !SLUG_RE.test(slug) || (subdir && !SLUG_RE.test(subdir))) {
    console.error(
      "usage: pnpm upload <slug> [subdir]  (lowercase alnum + hyphen)",
    );
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secret = requireEnv("SUPABASE_SECRET_KEY");
  const bucket = requireEnv(
    isPublic ? "SUPABASE_PUBLIC_BUCKET" : "SUPABASE_PRIVATE_BUCKET",
  );

  const root = path.resolve(process.cwd(), "media", "hls");
  const localDir = path.resolve(root, slug, subdir ?? "");
  if (!localDir.startsWith(root + path.sep)) {
    console.error("invalid slug path");
    process.exit(1);
  }
  try {
    if (!(await stat(localDir)).isDirectory()) throw new Error();
  } catch {
    console.error(`not a directory: ${localDir}`);
    process.exit(1);
  }

  const files = await walk(localDir);
  const unknown = files.filter((f) => !MIME[path.extname(f)]);
  if (unknown.length) {
    console.error(
      "unsupported extension:",
      unknown.map((f) => path.relative(localDir, f)),
    );
    process.exit(1);
  }
  if (
    !subdir &&
    !isPublic &&
    !files.some((f) => path.basename(f) === "master.m3u8")
  ) {
    console.error("master.m3u8 not found. run encode first.");
    process.exit(1);
  }

  const sb = createClient(url, secret, { auth: { persistSession: false } });
  const total = files.length;
  let done = 0;
  const failed: string[] = [];

  const queue = [...files];
  async function worker() {
    for (;;) {
      const file = queue.shift();
      if (!file) return;
      const rel = path.relative(localDir, file).split(path.sep).join("/");
      const key = subdir ? `${slug}/${subdir}/${rel}` : `${slug}/${rel}`;
      const ext = path.extname(file);
      const body = await readFile(file);
      const { error } = await sb.storage.from(bucket).upload(key, body, {
        contentType: MIME[ext],
        cacheControl: CACHE[ext] ?? DEFAULT_CACHE,
        upsert: true,
      });
      done += 1;
      if (error) {
        failed.push(key);
        console.error(`[${done}/${total}] FAIL ${key}: ${error.message}`);
      } else {
        console.log(`[${done}/${total}] ${key}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (failed.length) {
    console.error(`\n${failed.length} failed. re-run to retry (upsert).`);
    process.exit(1);
  }

  console.log(`\nuploaded ${total} files`);
  console.log(`bucket: ${bucket}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
