# miniflix

OTT 스트리밍의 핵심 구조를 직접 구현해 보는 소형 Netflix 형태의 토이 프로젝트.
MP4 원본 → FFmpeg → HLS(1080p/720p/480p) → hls.js 재생 → ABR 화질 전환 → WebVTT 자막 → 시청 기록 저장까지 한 흐름으로 다룬다.

배포: https://miniflix-chi.vercel.app

## 스택

- Next.js 16 (App Router) · TypeScript · Tailwind v4 · hls.js
- Prisma 7 + PostgreSQL · Supabase Auth / Storage
- FFmpeg · HLS · WebVTT · Vercel

## 구조

```
scripts/encode.sh          MP4 → 3렌디션 HLS
scripts/encode-trailer.sh  트레일러 → 720p 단일 렌디션
scripts/upload.mts         media/hls/<slug> → Supabase Storage (--public 옵션)
prisma/schema.prisma       Content · Subtitle · Profile · WatchHistory
prisma/seed.mts            콘텐츠 시드
src/app/watch/[slug]       재생 페이지 (로그인: 풀버전, 비로그인: 트레일러)
src/app/api/stream         세션 확인 후 세그먼트 URL을 재작성한 HLS 플레이리스트
supabase/storage-policy.sql private 버킷 RLS (로그인 사용자만 읽기)
src/app/api/watch          시청 위치 저장
src/components/player      hls.js 플레이어
```

## 접근 제어

풀버전 HLS는 private 버킷에 있고 두 겹으로 막는다.

1. `/api/stream` 이 플레이리스트를 내려주기 전에 세션을 확인한다.
2. 세그먼트는 Storage의 `object/authenticated` URL로 치환된다. hls.js가 요청마다 사용자 JWT를 `Authorization` 헤더로 실어 보내고, Storage RLS(`supabase/storage-policy.sql`)가 검증한다. 플레이리스트나 세그먼트 URL이 유출돼도 로그인 세션 없이는 403.
3. iOS Safari 네이티브 HLS는 요청 헤더를 못 붙이므로 `?native=1`로 10분짜리 서명 URL을 받는다. 이 경우 URL 자체가 수명 동안 열쇠다.

콘텐츠 암호화(AES-128)나 DRM은 하지 않는다. 콘텐츠가 CC 라이선스라 지킬 것이 없고, AES-128은 키가 클라이언트에 노출돼 로그인 사용자의 다운로드는 못 막는다. 그 이상은 Widevine/FairPlay(CDM) 영역이라 범위 밖.

## 실행

```bash
cp .env.example .env.local   # Supabase 키·DB URL 채우기
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## 콘텐츠 추가

```bash
bash scripts/encode.sh media/source/<name>.mp4 <slug>
pnpm upload <slug>                      # private 버킷
pnpm upload <slug> subs --public        # 자막 vtt
pnpm upload <slug>-trailer --public     # 트레일러
# prisma/seed.mts 에 항목 추가 후
pnpm db:seed
```

## 콘텐츠 출처

- Big Buck Bunny — Blender Foundation, CC BY 3.0. 캡션: demuxed/big-buck-captions (CC BY 3.0)
- Spring — Blender Animation Studio, CC BY 4.0. 캡션: Wikimedia Commons TimedText (CC BY 4.0)
