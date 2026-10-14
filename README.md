# 원더플치과 건강정보 사이트

Netlify에 배포하는 정적 블로그와 관리자 화면 시안입니다.

- `/`: 홈페이지와 카드형 목록
- `/blog/`: 글 목록
- `/blog/임플란트-교체-시기와-수명`, `/blog/임플란트-잇몸-출혈`: 독립 글 페이지
- `/login`: 관리자 체험 로그인
- `/adm`: 관리자 시안 목록
- `/adm/new`, `/adm/edit?id=1`: 체험용 편집 화면

## 빌드와 확인

Node.js 18 이상에서 실행하며 별도 패키지 설치는 필요하지 않습니다.

```sh
node scripts/build-board.cjs
node scripts/check-board.cjs
node scripts/check-admin.cjs
node scripts/check-categories.cjs
node scripts/preview.cjs
```

미리보기 주소는 `http://127.0.0.1:4173/`입니다.

Netlify는 `netlify.toml`에 지정한 빌드 명령을 사용하고 저장소 루트를 배포합니다. 저장소의 배포 브랜치와 자동 배포 설정은 Netlify에서 확인하세요.

## 콘텐츠와 관리 기능

기존 글의 본문 원본은 루트의 `implant-lifespan.html`, `implant-gum-bleeding.html`이며, 카드 설명글은 `content/card-descriptions.json`에 있습니다. 빌드는 공개 글·목록·사이트맵·주소 규칙·관리자 체험 데이터를 생성합니다.

카테고리는 `categories.js`에 정의하며 공개 글별 배정은 `content/post-categories.json`에 있습니다. 메인·게시판 목록에서 전체보기와 5개 카테고리로 필터링할 수 있고, 관리자 시안에서도 카테고리별 조회와 글 분류를 선택할 수 있습니다.

**관리 화면은 체험용입니다. 실제 관리자 인증, 서버 접근 차단, 공개 글 발행 API는 아직 연결되지 않았습니다.** 브라우저에 저장하는 체험 초안은 GitHub나 공개 사이트를 변경하지 않습니다. 실제 운영 연동은 [ADMIN.md](ADMIN.md), 블로그 구조는 [BOARD.md](BOARD.md)를 참고하세요.
