// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)의 firebaseConfig 값을 붙여 넣으면 Google 로그인과 기록 동기화가 켜진다.
// 이 값은 비밀번호가 아니라 공개되어도 되는 식별자다. 데이터 보호는 Firestore 보안 규칙(README 참고)이 담당한다.
// null이면 로그인 없이 기기에만 기록을 저장한다.
window.FIREBASE_CONFIG = null;
