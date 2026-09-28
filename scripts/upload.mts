// media/hls/<slug>/ 를 Supabase Storage 버킷의 <slug>/ 로 미러링 업로드
// 사용: pnpm upload <slug>
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONCURRENCY = 8;

const MIME: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".vtt": "text/vtt",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

// 세그먼트는 불변. 플레이리스트는 재인코딩 시 바뀔 수 있어 짧게.
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
  const slug = process.argv[2];
  if (!slug || !SLUG_RE.test(slug)) {
    console.error("usage: pnpm upload <slug>  (lowercase alnum + hyphen)");
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const secret = requireEnv("SUPABASE_SECRET_KEY");
  const bucket = requireEnv("SUPABASE_STORAGE_BUCKET");

  const root = path.resolve(process.cwd(), "media", "hls");
  const localDir = path.resolve(root, slug);
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
  if (!files.some((f) => path.basename(f) === "master.m3u8")) {
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
      const key = `${slug}/${rel}`;
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

  const { data } = sb.storage.from(bucket).getPublicUrl(`${slug}/master.m3u8`);
  console.log(`\nuploaded ${total} files`);
  console.log(`master: ${data.publicUrl}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
