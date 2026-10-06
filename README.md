# 🎬 miniflix

> OTT 스트리밍의 핵심 구조를 **직접 구현**해 보는 소형 Netflix 형태의 개인 프로젝트입니다.
> 영상 인코딩부터 재생, 접근 제어, 시청 기록까지 한 흐름으로 다룹니다.

🔗 **배포:** https://miniflix-chi.vercel.app
🗓 **기간:** 2026.09.28 – 09.30
👤 **역할:** 1인 개발 (기획 · 인코딩 파이프라인 · 프론트 · 백엔드 · 배포)

---

## 🧭 한눈에 보기

| 구분 | 내용 |
| --- | --- |
| **무엇을** | MP4 원본을 HLS로 인코딩해 올리고, 브라우저에서 화질 자동 전환·자막·시크 썸네일·이어보기가 되는 스트리밍 서비스 |
| **왜** | "영상 플레이어를 붙이는 것"이 아니라 **스트리밍이 실제로 어떻게 동작하는지**를 파이프라인 끝에서 끝까지 손으로 확인하기 위해 |
| **핵심 난점** | 로그인한 사용자에게만 풀버전을 보여주되, 플레이리스트·세그먼트 URL이 유출돼도 재생이 안 되게 막는 것 |

---

## ✨ 주요 기능

**▶️ 재생**
- hls.js 기반 플레이어 · 1080p / 720p / 480p **ABR 자동 화질 전환** + 수동 선택
- WebVTT 자막, 음량 슬라이더(기억됨), 음소거 해제 안내, 재생 속도, 전체화면
- **시크 썸네일**: 진행바 위에 마우스를 올리면 해당 시점 프리뷰 (webp 스프라이트 + VTT)
- 네트워크·미디어 에러 분기 처리 및 복구 시도

**📺 콘텐츠**
- 시리즈(회차) 구조 · 크레딧 시작 시점에 **다음 화 자동재생 프롬프트** · 종료 후 포스트플레이 화면
- 카드 hover 트레일러 미리보기 · 상세 모달 (URL 직접 접근 시엔 페이지로 열림)
- 제목·설명 검색

**👤 사용자**
- 이메일/비밀번호 + Google OAuth 로그인 (Supabase Auth)
- **시청 기록 저장 & 이어보기**: 주기 저장 + 탭 전환/닫힘 시 `sendBeacon`으로 마지막 위치 보존, 일정 비율 이상 보면 "시청 완료"
- 랜덤 닉네임 자동 생성, 설정에서 변경

**🔍 SEO / 메타**
- OG · Twitter 이미지 동적 생성, sitemap, robots, manifest

---

## 🔐 접근 제어

비로그인 사용자는 **트레일러만**, 로그인 사용자는 **풀버전**을 봅니다. 풀버전 HLS는 private 버킷에 두고 두 겹으로 막습니다.

1. `/api/stream`이 플레이리스트를 내려주기 전에 **세션을 확인**합니다.
2. 플레이리스트 안의 세그먼트 경로를 Storage의 `object/authenticated` URL로 **재작성**합니다. hls.js가 요청마다 사용자 JWT를 `Authorization` 헤더에 실어 보내고, **Storage RLS**(`supabase/storage-policy.sql`)가 검증합니다. → 플레이리스트나 세그먼트 URL이 유출돼도 로그인 세션 없이는 403.
3. iOS Safari 네이티브 HLS는 요청 헤더를 붙일 수 없으므로 `?native=1`로 **10분짜리 서명 URL**을 발급합니다. 이 경우 URL 자체가 수명 동안의 열쇠입니다.

> 💡 **의도적으로 안 한 것** — AES-128 콘텐츠 암호화나 DRM은 적용하지 않았습니다. 콘텐츠가 CC 라이선스라 보호할 대상이 없고, AES-128은 키가 클라이언트에 노출돼 로그인 사용자의 다운로드는 어차피 못 막습니다. 그 이상은 Widevine/FairPlay(CDM) 영역이라 범위 밖으로 선을 그었습니다.

---

## 🧩 기술적 결정

| 결정 | 이유 |
| --- | --- |
| 세그먼트 보호를 **서명 URL이 아니라 JWT 헤더 + Storage RLS**로 | 서명 URL은 URL 자체가 열쇠라 공유되면 수명 동안 열림. `object/authenticated` 경로는 요청마다 세션 JWT를 검증하므로 URL 유출이 무의미해짐. 헤더를 못 붙이는 iOS 네이티브 HLS만 10분 서명 URL로 폴백 |
| **플레이리스트만 서버를 거치고 세그먼트는 Storage 직결** | `.m3u8`만 `/api/stream`에서 재작성(`Cache-Control: private, max-age=300`). 바이트가 큰 세그먼트는 서버를 타지 않아 Vercel 함수 트래픽·지연 최소화. `#EXT-X-MAP`(fMP4 init)·`#EXT-X-MEDIA`(분리 오디오) URI까지 치환, slug/경로는 정규식으로 검증 |
| **fMP4(CMAF) + 오디오 렌디션 분리** 인코딩 추가 | TS muxed는 렌디션마다 오디오가 중복 저장됨. 오디오를 1벌로 빼서 용량 절감. 구형·단편 소스용 `--ladder 720` 옵션 |
| 플레이어 에러를 **원인별로 분기** | 401/403 → 세션 만료로 간주, 현재 위치 기억 후 플레이리스트 재로드 · 그 외 네트워크 에러 → `startLoad` 재시도 · 미디어 에러 → `recoverMediaError` · 그래도 실패하면 사용자 메시지 |
| 시청 위치 저장을 **10초 주기 + 이탈 시 `sendBeacon`** | 3초 미만 변화는 스킵해 쓰기 줄임. 탭 숨김·페이지 닫힘(`visibilitychange`/`pagehide`)엔 beacon으로 마지막 위치 보존. 90% 이상 보면 완료 처리 |
| 재생 페이지를 **`(site)` 라우트 그룹 안으로** | 상세 모달(Intercepting Route)이 다른 레이아웃에 있어 열릴 때 플레이어가 언마운트되던 문제. 같은 레이아웃을 공유하게 옮겨 해결 |
| Supabase 세션 갱신을 **proxy(미들웨어)에서** | 정적 에셋 제외한 모든 요청에서 토큰 리프레시 → Server Component·Route Handler가 항상 유효한 세션을 봄 |

---

## 🛠 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프론트 | Next.js 16 (App Router, Parallel/Intercepting Routes) · React 19 · TypeScript · Tailwind v4 |
| 재생 | hls.js · HLS (TS / fMP4-CMAF) · WebVTT |
| 백엔드 | Next.js Route Handlers / Server Actions · Prisma 7 · PostgreSQL |
| 인증 / 스토리지 | Supabase Auth · Supabase Storage (RLS) |
| 미디어 파이프라인 | FFmpeg · cwebp |
| 배포 | Vercel (서울 리전) |

---

## 🔄 파이프라인

```
MP4 원본
  └─ FFmpeg ─▶ HLS 1080p / 720p / 480p (+ 트레일러 720p)
                └─ thumbs.sh ─▶ 시크 썸네일 스프라이트(webp) + thumbs.vtt
                      └─ upload.mts ─▶ Supabase Storage (풀버전: private, 자막·트레일러·썸네일: public)
                            └─ prisma seed ─▶ Content · Series · Subtitle
                                  └─ /api/stream ─▶ 세션 확인 + 세그먼트 URL 재작성
                                        └─ hls.js ─▶ ABR 재생 · 자막 · 시청 위치 저장
```

---

## 📂 구조

```
scripts/encode.sh            MP4 → 3렌디션 HLS (TS, 오디오 muxed)
scripts/encode-fmp4.sh       MP4 → fMP4(CMAF) HLS, 비디오/오디오 렌디션 분리 (--ladder 1080|720)
scripts/encode-trailer.sh    트레일러 → 720p 단일 렌디션
scripts/thumbs.sh            480p HLS → 시크 썸네일 스프라이트 + thumbs.vtt
scripts/upload.mts           media/hls/<slug> → Supabase Storage (--public 옵션)
prisma/schema.prisma         Content · Series · Subtitle · Profile · WatchHistory
prisma/seed.mts              콘텐츠 시드
supabase/storage-policy.sql  private 버킷 RLS (로그인 사용자만 읽기)
src/app/(site)/watch/[slug]  재생 페이지 (로그인: 풀버전, 비로그인: 트레일러)
src/app/(site)/@modal        상세 모달 (Intercepting Route)
src/app/api/stream           세션 확인 후 세그먼트 URL을 재작성한 HLS 플레이리스트
src/app/api/watch            시청 위치 저장
src/components/player        hls.js 플레이어 · 시크 프리뷰 · 트레일러 프리뷰 · 시청 기록 훅
```

---

## 🚀 실행

```bash
cp .env.example .env.local   # Supabase 키 · DB URL 채우기
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev                     # http://localhost:3000
```

## 🎛 인코딩 방식

- **코덱** H.264 (libx264, main profile) + AAC 128k 스테레오. FFmpeg 한 번 실행으로 원본을 `split` 해 3렌디션 동시 생성
- **비트레이트 래더** 1080p 3000k · 720p 1500k · 480p 800k (`maxrate`/`bufsize` 제한으로 ABR 전환 시 버퍼 안정)
- **GOP 2초 고정** `sc_threshold 0`으로 장면 전환 키프레임을 끄고 모든 렌디션의 키프레임 위치를 맞춤 → 세그먼트 경계가 일치해야 화질 전환이 끊김 없이 됨
- **세그먼트** 6초 · `independent_segments` · VOD 플레이리스트. TS(오디오 muxed) 또는 fMP4/CMAF(오디오 렌디션 1벌 분리) 선택
- **시크 썸네일** 480p 렌디션에서 5초 간격으로 프레임 추출 → 160×90 타일 10×10 스프라이트(webp q70) + 좌표를 담은 `thumbs.vtt`
- 풀버전은 private 버킷, 자막·트레일러·썸네일은 public 버킷에 업로드 후 `prisma/seed.mts`로 메타데이터 등록

---

## 🎞 콘텐츠 출처

모두 Creative Commons 라이선스 작품입니다.

- **Big Buck Bunny** — Blender Foundation, CC BY 3.0 · 캡션: demuxed/big-buck-captions (CC BY 3.0)
- **Spring** — Blender Animation Studio, CC BY 4.0 · 캡션: Wikimedia Commons TimedText (CC BY 4.0)
- **Caminandes 2: Gran Dillama · 3: Llamigos** — Blender Foundation, CC BY 3.0 · 트레일러는 Caminandes 1: Llama Drama

---

## 📄 라이선스

코드는 [MIT](./LICENSE). 영상 콘텐츠는 위 출처의 CC BY 라이선스를 따릅니다.
