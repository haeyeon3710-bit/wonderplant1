# Supabase CMS 단계별 진행 기록

## 1단계 — 구조 분석과 연결 확인 (2026-10-14)

### 확인한 기존 구조

- 프레임워크 없는 HTML/CSS/JavaScript 정적 사이트. `scripts/build-board.cjs`가 목록·글·사이트맵·`_redirects`·체험 데이터를 생성합니다.
- Netlify는 GitHub `main`의 변경을 받아 빌드하며 저장소 루트를 배포합니다. 기존 `/login`, `/adm`, `/adm/new`, `/adm/edit`, 한글 `/blog/{slug}`는 `_redirects`로 연결됩니다.
- 초안과 글 사본은 localStorage의 `wonderful-admin-demo-v1`에 배열 JSON으로 저장됩니다. IndexedDB는 사용하지 않습니다. 이미지 파일은 체험 상태에서 base64 Data URL로 들어갑니다.
- 체험 로그인은 sessionStorage의 `wonderful-admin-demo-session`이며 실제 Supabase Auth 세션은 아닙니다.
- 폼 → `readForm()` → `repository.save()` → localStorage가 현재 저장 흐름입니다. 미리보기는 현재 폼과 블록을 DOM으로 렌더링하며, JSON 내보내기는 현재 폼 데이터를 다운로드합니다. DB/API 호출이 없어서 공개 사이트 발행은 이루어지지 않습니다.
- 공개 두 글은 루트 원본 HTML, 카드 설명은 `content/card-descriptions.json`, 글별 분류는 `content/post-categories.json`, 공통 카테고리는 `categories.js`입니다. 게시글당 카테고리 한 개입니다.
- 카테고리: 임플란트 / 고난도 임플란트 / 전체 임플란트 / 의식하진정법 / 치아교정. 교체 시기 글은 임플란트, 출혈 글은 고난도 임플란트입니다.

### 실제 연결 확인

- 사용자 확인을 받은 Supabase 프로젝트: `haeyeon3710-bit's Project`, ref `zdzalwcbppegddidnlvn`.
- 프로젝트 ACTIVE_HEALTHY, PostgreSQL 17.11, 조직 Free 플랜.
- 적용된 마이그레이션 0개, public 테이블 0개, Auth 사용자 0명. 기존 DB 테이블과 충돌하지 않는 새 구성입니다.
- Netlify 프로젝트: `wonderple1`. 기존 환경변수는 없었으며 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CMS_ENVIRONMENT`, `SITE_URL`을 등록했습니다. Builds/Functions/Runtime 적용을 확인했습니다. 실제 값은 이 문서에 저장하지 않습니다.
- `CMS_ENVIRONMENT=preview`. 기본 Netlify 도메인을 개발용으로 사용 중입니다. 운영 시작 전 환경별 데이터 분리와 설정을 재확인합니다.
- 공개 키로 Auth와 Data API가 응답하는 것을 확인했습니다. 테이블 생성 전이므로 `schemaReady=false`는 정상입니다. Supabase SQL 연결도 확인했습니다.

### 수정 파일·검사

- `lib/supabase.cjs`: 환경변수 기반 서버 클라이언트, 공개 키 검사, 연결 상태 확인.
- `.env.example`: 실제 키를 포함하지 않는 설정 예시. 로컬 `.env`는 gitignore 대상입니다.
- `scripts/check-supabase.cjs`: 값을 출력하지 않는 API 연결 검사.
- `netlify/functions/cms-health.cjs`, `netlify.toml`, 생성 스크립트: 호스팅 환경에서 확인할 `/api/health` 준비. 실제 배포 후 응답 확인은 프리뷰 테스트 단계에서 기록합니다.
- 기존 블로그·관리자·카테고리 검사 통과. 현재 초안과 원본 파일을 삭제하거나 덮어쓰지 않았습니다.

### 이후 단계의 보존 원칙

기존 localStorage 키는 삭제·초기화하지 않습니다. 원본 데이터 내보내기와 DB로의 명시적 가져오기를 제공하고, 가져오기는 새 초안으로 생성하며 기존 DB 글을 자동 덮어쓰지 않습니다. 기존 공개 글은 원본 HTML을 보관해 레이아웃을 유지하는 방향으로 이전합니다. 이미지 한도는 Supabase Storage 기준 파일당 **20MB(20 × 1024 × 1024 바이트)**로 적용합니다.

Netlify AI Agent·Agent Runners·유료 업그레이드·결제는 사용하지 않습니다.

## 2단계 — DB·RLS 생성 및 적용 완료

- `supabase/migrations/202610140001_cms_schema.sql`을 실제 DB에 적용했습니다. categories, posts, admin_users, post_views와 필요한 인덱스를 생성했습니다.
- 카테고리는 기존 문자열 ID와 이름을 보존하며 게시글당 한 개의 필수 FK입니다. posts는 UUID ID와 별도의 legacy_id로 기존 사본 ID를 연결할 수 있습니다.
- 상태 draft/published/private, created_at/published_at/updated_at 분리, 첫 발행 시각을 서버 트리거로 설정·보존합니다. view_count는 클라이언트가 직접 갱신할 권한을 주지 않았습니다.
- preview/production 환경 열과 환경별 slug 고유 제약을 적용했습니다. 서버 설정으로 대상 환경을 고정하고 통계에도 같은 환경을 사용합니다.
- `cms-images`는 비공개 버킷이며 이미지 파일당 20MB, PNG/JPEG/WebP/GIF만 허용합니다. 초안 이미지의 익명 읽기는 금지하고 발행 글에 연결된 파일만 공개 읽기를 허용합니다.
- `supabase/tests/cms_rls.sql`을 실제 DB에서 실행해 익명·일반 사용자의 초안 읽기, 쓰기, 자기 관리자 승격, 클라이언트 조회수 변경·조회 기록 삽입이 거절되는 것을 검증했습니다. 관리자 글 수정과 최초 발행일 보존도 검사했습니다.
- 테스트는 트랜잭션 롤백으로 끝났습니다. 테스트 후 Auth 사용자·게시글은 0개, 실제 카테고리 5개와 저장소 한도 20971520바이트를 확인했습니다. Supabase 보안 Advisor 경고 0개.

## 3단계 — 관리자 인증 구현 및 검증 완료

- 사용자가 Supabase에서 직접 생성한 Auth 사용자를 `yammo0516` 관리자와 연결했습니다. 비밀번호는 코드·Git·환경변수에 넣지 않았습니다.
- 아이디→Auth 계정 조회는 service_role 전용 RPC와 Supabase `cms-login` Edge Function에 한정합니다. 일반 사용자는 이메일 매핑을 조회할 수 없습니다. 비밀키는 Edge Function의 서버 기본 환경에서만 사용합니다.
- `lib/auth.cjs`, `lib/http.cjs`, Netlify `cms-auth`·`cms-admin-page`, `admin/auth.js`와 기존 `admin/app.js`·로그인 UI에 인증을 연결했습니다. JavaScript가 읽을 수 없는 Secure/HttpOnly 쿠키, 토큰 갱신, Auth 서버의 사용자 확인, DB 관리자 역할 재검증, 같은 출처 POST 검사를 적용합니다.
- `/adm`과 관련 직접 HTML 경로는 서버 검사를 거치며 비로그인은 로그인 이동, 일반 계정은 403입니다. 사용자 정보만 브라우저에 돌려주고 토큰은 반환하지 않습니다.
- 기존 관리자 UI에 현재 비밀번호 확인 후 본인이 바꾸는 비밀번호 변경 창을 추가했습니다.
- `scripts/build-site.cjs`와 Netlify 설정은 공개 파일만 dist에 배포하고 관리자 템플릿·DB SQL·서버 코드·.env를 제외합니다.
- 서버 인증 검사: 비로그인/비관리자 거부, 역할 확인, 갱신 쿠키, 아이디 인증, 만료된 세션, 서버 장애, CSRF·메서드 검사 통과.
- 사용자가 Deploy Preview에서 실제 아이디 로그인, 새로고침 후 유지, 로그아웃 후 접근 차단을 모두 확인했습니다. 실제 Auth 로그인 시각과 세션 생성도 DB에서 확인했습니다.
- 별도의 비로그인 브라우저에서 `/adm`, 작성·수정 및 직접 HTML 주소가 로그인으로 이동하는 것을 확인했습니다.
- Deploy Preview는 Netlify 팀 로그인으로 보호되어 있습니다. 외부 익명 CLI에서 받은 HTML 401은 CMS API 결과가 아닙니다. 보호 설정은 유지합니다.

## 4단계 — DB 작성·수정·상태 변경과 기존 글 이전

- `lib/posts.cjs`, `cms-posts`, `admin/database.js`: 관리자 JWT와 RLS로 DB 저장·수정·삭제·사본·발행·비공개 작업. 저장 시 카테고리를 함께 처리하고 버전 조건으로 동시 수정 충돌을 거절합니다.
- `admin/app.js`, 기존 관리자 템플릿: DB 저장 버튼과 상태 선택·발행, 사본, 초안/JSON 가져오기, 원본과 DB JSON 백업. 기존 localStorage 키는 읽기만 하고 변경하지 않습니다. 작성 중 복구본은 사용자별 별도 키에 저장합니다.
- `cms-upload`, `cms-media`: 비공개 Storage, 파일당 20MB. 브라우저가 서명된 URL로 직접 업로드하여 Netlify 함수의 파일 크기 제한을 피합니다. 읽기는 RLS로 검사 후 60초 URL로 연결합니다. 글 삭제 시 이미지 파일은 보존합니다.
- 기존 두 글은 원래 주소·분류·2026-10-08 발행일·본문 HTML·구조화 데이터를 보존해 preview DB로 이전했습니다. 원본 파일과 `content/legacy-posts.backup.json` 백업을 유지합니다. 같은 legacy_id의 재실행은 덮어쓰지 않습니다.
- 본문을 편집하지 않은 메타데이터 수정은 기존 HTML을 유지합니다. 빌더 내용 변경 시 새 블록 형식으로 렌더링합니다. HTML 렌더링은 정화 라이브러리를 사용하고 보안 수정 버전 2.18.0에 고정했습니다. Node 22 이상으로 빌드/함수 런타임을 지정했습니다.
- `supabase/tests/cms_crud.sql` 실제 DB 검사 통과: 초안과 발행일, 카테고리 변경, 동시 수정 거절, 사본, 비공개 후 첫 발행일 보존, 삭제. 롤백 후 기존 두 글만 남고 테스트 계정/게시글은 0개입니다.
- `scripts/check-posts.cjs`: 입력·발행 검증, 안전한 HTML/이미지, 보호된 날짜/조회수/환경, 원본 HTML 유지, 본문 수정, 버전 충돌 검사 통과. 기존 블로그/초안/카테고리/인증/연결 검사도 통과했습니다.
- 프리뷰 UI에서 DB 저장과 파일 업로드 검증을 진행 중입니다. 아직 일반 블로그 화면의 DB 전환은 5단계 전입니다.

## 5~8단계

4단계 검증을 마친 뒤 공개 화면 DB 로딩, 조회 집계, 관리자 통계와 전체 프리뷰 테스트를 순서대로 진행합니다.
