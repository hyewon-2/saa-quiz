# SAA Quiz

AWS Certified Solutions Architect – Associate (SAA-C03) 대비 연습 문제 사이트입니다.
서버 없이 GitHub Pages에서 동작하고, 휴대폰과 PC 모두에서 쓸 수 있으며, 한 번 열어 두면 오프라인에서도 동작합니다.

## 기능

- **서비스 분야별 학습**: 컴퓨팅, 스토리지, 데이터베이스, 네트워킹, 보안, 통합, 분석, 관리·DR·비용
- **시험 영역별 정답률**: 보안 30%, 복원력 26%, 고성능 24%, 비용 20%의 출제 비중과 72% 합격선 기준 표시
- **오답노트**: 틀린 문제는 자동으로 등록되고, 2번 연속 맞히면 '졸업'합니다. 졸업한 문제를 다시 틀리면 복습 목록으로 돌아옵니다
- **스마트 학습**: 오답, 약한 분야, 새 문제, 오래 안 본 문제를 가중치로 골라 출제합니다
- **실전 모의고사**: 65문제, 130분, 영역 비율을 반영하며 검토 표시와 문제 목록 이동을 지원합니다
- 보기 순서를 섞고, 문제마다 해설과 **시험 포인트(키워드)**를 보여 줍니다
- 북마크, 이어 풀기, 다크 모드, 키보드 단축키(1~5 / A~E 선택, Enter 확인·다음, ← → 이동, B 북마크)
- 학습 기록 백업·복원 (휴대폰 ↔ PC 기록 합치기)

## 배포 (GitHub Pages)

```bash
git remote add origin https://github.com/<아이디>/saa-quiz.git
git push -u origin main
```

GitHub 저장소에서 **Settings → Pages → Build and deployment**로 가서 Source를 `Deploy from a branch`로, Branch를 `main` / `/ (root)`로 지정하고 저장합니다.
1~2분 뒤 `https://<아이디>.github.io/saa-quiz/`에서 열립니다.

> 무료 계정에서 GitHub Pages를 쓰려면 저장소가 **공개(Public)**여야 합니다.

휴대폰에서는 사이트를 연 뒤 브라우저 메뉴에서 **홈 화면에 추가**를 누르면 앱처럼 쓸 수 있습니다.

## Google 로그인 · 기록 동기화 (선택)

Firebase(무료 Spark 플랜)를 연결하면 사용자마다 기록이 따로 저장되고, 휴대폰과 PC 기록이 자동으로 이어집니다.
연결하지 않으면 지금처럼 기기 안에만 기록을 저장합니다.

1. https://console.firebase.google.com 에서 **프로젝트 추가** (Google 애널리틱스는 꺼도 됩니다)
2. **Authentication → 시작하기 → Sign-in method → Google → 사용 설정**
3. **Authentication → 설정 → 승인된 도메인**에 `hyewon-2.github.io` 추가
4. **Firestore Database → 데이터베이스 만들기** (위치: `asia-northeast3` 서울, 프로덕션 모드)에서 **규칙** 탭에 아래 규칙을 붙여넣고 **게시**합니다

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

5. **프로젝트 설정(톱니바퀴) → 내 앱 → 웹(`</>`) 앱 등록**에서 나오는 `firebaseConfig` 값을 `js/firebase-config.js`에 넣습니다

   ```js
   window.FIREBASE_CONFIG = { apiKey: '...', authDomain: '...', projectId: '...', appId: '...' };
   ```

`firebaseConfig` 값은 비밀번호가 아니라 공개되어도 되는 식별자입니다. 다른 사람의 기록에 접근할 수 없게 막는 것은 4번의 보안 규칙입니다.

## 로컬에서 보기

`index.html`을 브라우저로 바로 열어도 동작합니다. 오프라인 캐시(서비스 워커)는 https에서만 켜집니다.

## 문제 추가하기

`data/*.js` 파일에 아래 형식으로 객체를 추가합니다.

```js
{
  id: 'sto-15',                 // 고유 ID (접두사-번호)
  cat: 'storage',               // compute | storage | database | networking | security | integration | analytics | management
  domain: 'cost',               // secure | resilient | performance | cost
  svc: ['S3'],                  // 서비스 태그
  q: '문제 본문',
  opts: ['보기1', '보기2', '보기3', '보기4'],
  ans: [0],                     // 정답 인덱스(0부터). 복수 정답이면 [0, 2]. 이때 본문에 "(2개 선택)"을 적는다
  exp: '해설. **굵게**, `코드` 사용 가능',
  tip: '시험 포인트 (선택)',
},
```

- 보기는 화면에서 섞여서 나오므로, 해설에서 "A는…"처럼 **보기 기호로 가리키지 말고** 보기 내용으로 설명하세요.
- 새 데이터 파일을 만들었다면 `index.html`의 `<script>` 태그와 `sw.js`의 `ASSETS` 목록에 추가하세요.
- 파일을 고쳐서 배포할 때는 `sw.js`의 `CACHE` 버전(`saa-quiz-v1` → `v2`)을 올리면 사용자 기기의 캐시가 확실하게 갱신됩니다.

## 저작권 안내

이 저장소의 문제는 모두 직접 작성한 오리지널 문제입니다. 실제 시험 문제(덤프)나 다른 문제집의 문제를 옮겨 오지 마세요. 실제 시험 문제를 쓰는 것은 AWS 자격증 프로그램 약관 위반이며, 자격이 취소될 수 있습니다.
