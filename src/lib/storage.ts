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

/** private 버킷 오브젝트. `Authorization: Bearer <user JWT>` 가 있어야 Storage RLS 통과. */
export function storageAuthenticatedUrl(path: string): string {
  const { base, privateBucket } = storageBuckets();
  return `${base}/storage/v1/object/authenticated/${privateBucket}/${path}`;
}

/** 클라이언트에서 JWT 를 붙여야 하는 URL 인지 판별할 때 쓰는 prefix. */
export function storageAuthenticatedPrefix(base: string): string {
  return `${base}/storage/v1/object/authenticated/`;
}

export function streamUrl(slug: string): string {
  return `/api/stream/${slug}/master.m3u8`;
}
