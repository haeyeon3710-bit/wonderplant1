# 카드형 블로그

- 목록: `/blog/`
- 교체 시기와 수명: `/blog/임플란트-교체-시기와-수명`
- 잇몸 출혈: `/blog/임플란트-잇몸-출혈`

기존 도메인은 유지하며, 홈페이지와 게시판 목록은 기존 썸네일 카드형입니다. 각 글은 본문이 포함된 독립 HTML 페이지이며 JavaScript 없이 읽을 수 있습니다. 글별 canonical과 구조화 데이터, 사이트맵을 새 주소로 설정했습니다. 주소를 복사하면 한글 부분이 퍼센트 인코딩으로 보일 수 있지만 동일한 주소입니다.

기존 영문 글 주소는 새 주소로 301 이동합니다. 이전 `/implant#1`, `/implant/#2` 같은 해시 주소는 호환 페이지에서 새 글 주소로 이동합니다.

배포 규칙은 [Netlify 리디렉션 문법](https://docs.netlify.com/manage/routing/redirects/overview/)에 맞춰 한글 경로를 인코딩하며, 원본 파일이 남아 있는 주소에는 강제 리디렉션을 적용합니다.

Netlify는 마지막 `/` 유무를 동일한 경로로 매칭하므로 이를 붙이거나 제거하는 리디렉션은 만들지 않습니다. `/blog`와 `/blog/`, 각 글 주소의 두 형태 모두 같은 내부 rewrite를 사용합니다. 관련 [공식 설명](https://docs.netlify.com/manage/routing/redirects/redirect-options/#trailing-slash). 검사 스크립트와 로컬 미리보기에도 이 매칭 방식을 반영했습니다.

Netlify 배포 시 `blog` 폴더, `blog.html`, `_redirects` 등 변경 파일을 포함하세요. GitHub 연동 시 `netlify.toml`의 빌드 설정을 사용하며, 실제 배포 완료 여부는 Netlify의 Deploys에서 확인합니다.

본문 원본은 `implant-lifespan.html`, `implant-gum-bleeding.html`입니다. 수정 후 프로젝트 루트에서 `node scripts/build-board.cjs`를 실행해 새 페이지를 생성합니다.

검사: `node scripts/check-board.cjs`

로컬 미리보기: `node scripts/preview.cjs` 실행 후 `http://127.0.0.1:4173/blog/` 접속.

서버 저장, 글쓰기 관리자, 댓글 기능은 포함하지 않은 정적 블로그입니다.
