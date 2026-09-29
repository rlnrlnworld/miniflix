export function storagePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!base || !bucket)
    throw new Error(
      "missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_STORAGE_BUCKET",
    );
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
