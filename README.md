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
src/app/api/stream         세션 확인 후 서명 URL로 재작성한 HLS 플레이리스트
src/app/api/watch          시청 위치 저장
src/components/player      hls.js 플레이어
```

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
