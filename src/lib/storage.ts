export function storageBuckets() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicBucket = process.env.SUPABASE_PUBLIC_BUCKET;
  const privateBucket = process.env.SUPABASE_PRIVATE_BUCKET;
  if (!base || !publicBucket || !privateBucket) {
    throw new Error(
      "missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_PUBLIC_BUCKET / SUPABASE_PRIVATE_BUCKET",
    );
  }
  return { base, publicBucket, privateBucket };
}

export function storagePublicUrl(path: string): string {
  const { base, publicBucket } = storageBuckets();
  return `${base}/storage/v1/object/public/${publicBucket}/${path}`;
}

export function streamUrl(slug: string): string {
  return `/api/stream/${slug}/master.m3u8`;
}
