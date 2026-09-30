-- private 버킷(HLS 세그먼트) 읽기 정책.
-- 로그인(authenticated) 사용자만 SELECT 가능. anon 은 거부.
-- 플레이어가 세그먼트 요청마다 `Authorization: Bearer <user JWT>` 를 실어 보내고
-- Storage 가 이 정책으로 검증한다. 버킷 이름은 SUPABASE_PRIVATE_BUCKET 과 맞출 것.
--
-- 적용: Supabase 대시보드 → SQL Editor 에서 실행.

create policy "authenticated read hls"
on storage.objects
for select
to authenticated
using (bucket_id = 'miniflix_videos');
