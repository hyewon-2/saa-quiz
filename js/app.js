(() => {
  'use strict';

  // ───────── 메타데이터 ─────────
  const CATS = {
    compute:     { name: '컴퓨팅',        icon: '🖥️', desc: 'EC2 · Auto Scaling · ELB · Lambda · ECS' },
    storage:     { name: '스토리지',      icon: '🗄️', desc: 'S3 · EBS · EFS · FSx · Storage Gateway · Snow' },
    database:    { name: '데이터베이스',  icon: '🧮', desc: 'RDS · Aurora · DynamoDB · ElastiCache · Redshift' },
    networking:  { name: '네트워킹',      icon: '🌐', desc: 'VPC · Route 53 · CloudFront · DX · TGW' },
    security:    { name: '보안·자격증명', icon: '🔐', desc: 'IAM · KMS · Secrets Manager · WAF · GuardDuty' },
    integration: { name: '애플리케이션 통합', icon: '🔗', desc: 'SQS · SNS · EventBridge · Kinesis · Step Functions' },
    analytics:   { name: '분석·AI/ML',    icon: '📊', desc: 'Athena · Glue · EMR · Redshift 연계 · Rekognition · Bedrock' },
    management:  { name: '관리·DR·비용',  icon: '🛠️', desc: 'CloudWatch · CloudTrail · Config · Backup · DR 전략' },
  };
  const DOMAINS = {
    secure:      { name: '보안 아키텍처 설계',      weight: 30 },
    resilient:   { name: '복원력 있는 아키텍처',    weight: 26 },
    performance: { name: '고성능 아키텍처',         weight: 24 },
    cost:        { name: '비용 최적화 아키텍처',    weight: 20 },
  };
  const GRADUATE_STREAK = 2;   // 오답노트에서 빠지려면 연속 정답 횟수
  const EXAM_SIZE = 65;
  const EXAM_MINUTES = 130;
  const LETTERS = 'ABCDEFG';

  const QS = (window.QB || []).filter(q => CATS[q.cat]);
  const BY_ID = new Map(QS.map(q => [q.id, q]));

  // ───────── 저장소 ─────────
  const KEY = 'saa-quiz:v1';
  const defaults = () => ({
    stats: {},          // id -> { n, c, w, streak, t }
    marks: {},          // id -> true (북마크)
    history: [],        // 세션 결과 요약
    session: null,      // 진행 중인 세션
    last: null,         // 마지막 결과
    settings: { theme: 'auto', count: 20, instant: false },
  });
  const store = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s) { const d = defaults(); return { ...d, ...s, settings: { ...d.settings, ...s.settings } }; }
    } catch (e) { /* 저장소 사용 불가 */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ } }

  // ───────── 유틸 ─────────
  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = (c, n) => n ? Math.round(c / n * 100) : 0;
  const fmtTime = sec => { sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };
  const fmtDate = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  // ───────── 학습 통계 ─────────
  const stat = id => store.stats[id];
  const inNote = id => { const s = stat(id); return !!s && s.w > 0 && s.streak < GRADUATE_STREAK; };
  const graduated = id => { const s = stat(id); return !!s && s.w > 0 && s.streak >= GRADUATE_STREAK; };
  const mastered = id => { const s = stat(id); return !!s && s.streak >= GRADUATE_STREAK; };
  function record(id, ok) {
    const s = store.stats[id] || (store.stats[id] = { n: 0, c: 0, w: 0, streak: 0, t: 0 });
    s.n++; s.t = Date.now();
    if (ok) { s.c++; s.streak++; } else { s.w++; s.streak = 0; }
  }
  function accBy(field) {
    const out = {};
    for (const q of QS) {
      const s = stat(q.id), k = q[field];
      const o = out[k] || (out[k] = { total: 0, seen: 0, n: 0, c: 0, mastered: 0 });
      o.total++;
      if (s) { o.seen++; o.n += s.n; o.c += s.c; if (mastered(q.id)) o.mastered++; }
    }
    return out;
  }
  function overall() {
    let seen = 0, n = 0, c = 0;
    for (const q of QS) { const s = stat(q.id); if (s) { seen++; n += s.n; c += s.c; } }
    return { seen, n, c, note: QS.filter(q => inNote(q.id)).length, marks: QS.filter(q => store.marks[q.id]).length };
  }

  // ───────── 문제 선정 ─────────
  function weightedPick(ids, weightFn, n) {
    return ids.map(id => ({ id, k: Math.pow(Math.random(), 1 / Math.max(weightFn(id), 0.01)) }))
      .sort((a, b) => b.k - a.k).slice(0, n).map(x => x.id);
  }
  function smartPick(n) {
    const cat = accBy('cat');
    const now = Date.now();
    return weightedPick(QS.map(q => q.id), id => {
      const q = BY_ID.get(id), s = stat(id);
      let w = 1;
      if (!s) w += 3;                                       // 새 문제
      else {
        if (inNote(id)) w += 6;                             // 오답노트
        if (now - s.t > 3 * 864e5) w += 1.5;                // 오래 안 본 문제
        if (s.streak >= 3) w *= 0.25;                       // 이미 확실히 아는 문제
      }
      const a = cat[q.cat];
      if (a && a.n >= 3) w += (1 - a.c / a.n) * 4;          // 약한 분야 가중
      return w;
    }, n);
  }
  function examPick() {
    const picked = [];
    for (const [d, meta] of Object.entries(DOMAINS)) {
      const ids = shuffle(QS.filter(q => q.domain === d).map(q => q.id));
      picked.push(...ids.slice(0, Math.round(EXAM_SIZE * meta.weight / 100)));
    }
    const rest = shuffle(QS.map(q => q.id).filter(id => !picked.includes(id)));
    while (picked.length < EXAM_SIZE && rest.length) picked.push(rest.pop());
    return shuffle(picked.slice(0, EXAM_SIZE));
  }
  function limitN(ids) { const n = store.settings.count; return n ? ids.slice(0, n) : ids; }

  // ───────── 세션 ─────────
  function startSession({ mode = 'practice', title, ids, timeLimit = 0 }) {
    if (!ids.length) { toast('해당하는 문제가 없어요'); return; }
    const order = {};
    for (const id of ids) order[id] = shuffle(BY_ID.get(id).opts.map((_, i) => i));
    store.session = { mode, title, ids, idx: 0, ans: {}, done: {}, flag: {}, order, start: Date.now(), timeLimit };
    save();
    go('#/quiz');
  }
  function startMode(kind, arg) {
    const all = QS.map(q => q.id);
    switch (kind) {
      case 'smart': return startSession({ title: '스마트 학습', ids: smartPick(store.settings.count || QS.length) });
      case 'exam': return startSession({ mode: 'exam', title: '실전 모의고사', ids: examPick(), timeLimit: EXAM_MINUTES * 60 });
      case 'note': return startSession({ title: '오답노트 복습', ids: limitN(shuffle(all.filter(inNote))) });
      case 'marks': return startSession({ title: '북마크 문제', ids: limitN(shuffle(all.filter(id => store.marks[id]))) });
      case 'new': return startSession({ title: '안 푼 문제', ids: limitN(shuffle(all.filter(id => !stat(id)))) });
      case 'random': return startSession({ title: '랜덤', ids: limitN(shuffle(all)) });
      case 'cat': {
        const ids = all.filter(id => BY_ID.get(id).cat === arg);
        // 오답 → 새 문제 → 나머지 순으로 우선
        const rank = id => inNote(id) ? 0 : !stat(id) ? 1 : 2;
        const sorted = shuffle(ids).sort((a, b) => rank(a) - rank(b));
        return startSession({ title: CATS[arg].name, ids: limitN(sorted) });
      }
      case 'domain': return startSession({ title: DOMAINS[arg].name, ids: limitN(shuffle(all.filter(id => BY_ID.get(id).domain === arg))) });
      case 'retry': return startSession({ title: '틀린 문제 다시 풀기', ids: shuffle(store.last ? store.last.wrong : []) });
    }
  }
  function finishSession() {
    const s = store.session; if (!s) return;
    // 모의고사는 안 푼 문제도 오답으로 채점, 연습은 '정답 확인'한 문제만 집계
    const scored = s.mode === 'exam' ? s.ids : s.ids.filter(id => s.done[id]);
    const right = [], wrong = [];
    for (const id of scored) {
      const q = BY_ID.get(id), a = s.ans[id] || [];
      const ok = a.length > 0 && sameSet(a, q.ans);
      if (s.mode === 'exam' && a.length) record(id, ok);   // 연습 모드는 제출 시점에 이미 기록됨
      (ok ? right : wrong).push(id);
    }
    const res = { mode: s.mode, title: s.title, total: scored.length, right, wrong,
      dur: Math.round((Date.now() - s.start) / 1000), t: Date.now() };
    store.last = res;
    store.history.unshift({ title: res.title, mode: res.mode, total: res.total, right: res.right.length, dur: res.dur, t: res.t });
    store.history = store.history.slice(0, 50);
    store.session = null;
    save();
    go('#/result');
  }

  // ───────── 라우팅 ─────────
  let timer = null;
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function route() { return (location.hash.replace(/^#\/?/, '') || '').split('?')[0]; }
  function render() {
    clearInterval(timer); timer = null;
    const r = route();
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === r));
    const view = { '': viewHome, quiz: viewQuiz, result: viewResult, notes: viewNotes, settings: viewSettings }[r] || viewHome;
    view();
    window.scrollTo(0, 0);
  }

  // ───────── 홈 ─────────
  function bar(p, cls = '') { return `<div class="bar ${cls}"><i style="width:${p}%"></i></div>`; }
  function viewHome() {
    const o = overall(), cat = accBy('cat'), dom = accBy('domain'), s = store.session;
    const counts = [10, 20, 30, 0];
    app.innerHTML = `
      ${s ? `<button class="card resume" data-act="resume">
          <div><div class="eyebrow">진행 중인 학습</div><b>${esc(s.title)}</b>
          <span class="muted"> · ${s.mode === 'exam' ? Object.keys(s.ans).length : Object.keys(s.done).length}/${s.ids.length}</span></div>
          <span class="go">이어 풀기 →</span></button>` : ''}

      <section class="stats">
        <div class="stat"><b>${QS.length}</b><span>전체 문제</span></div>
        <div class="stat"><b>${o.seen}</b><span>푼 문제</span></div>
        <div class="stat"><b>${o.n ? pct(o.c, o.n) + '%' : '-'}</b><span>정답률</span></div>
        <a class="stat warn" href="#/notes"><b>${o.note}</b><span>오답노트</span></a>
      </section>

      <section>
        <div class="sec-head"><h2>학습 모드</h2>
          <div class="seg" role="group" aria-label="한 세트 문제 수">${counts.map(n =>
            `<button data-act="count" data-n="${n}" class="${store.settings.count === n ? 'on' : ''}">${n || '전체'}</button>`).join('')}</div>
        </div>
        <div class="modes">
          <button class="mode primary" data-act="start" data-kind="smart"><span class="mi">🎯</span><b>스마트 학습</b><small>오답·약점·새 문제 위주 자동 출제</small></button>
          <button class="mode" data-act="start" data-kind="note" ${o.note ? '' : 'disabled'}><span class="mi">❌</span><b>오답 복습 <em>${o.note}</em></b><small>${GRADUATE_STREAK}번 연속 맞히면 졸업</small></button>
          <button class="mode" data-act="start" data-kind="exam"><span class="mi">📝</span><b>실전 모의고사</b><small>${Math.min(EXAM_SIZE, QS.length)}문제 · ${EXAM_MINUTES}분 · 영역 비율 반영</small></button>
          <button class="mode" data-act="start" data-kind="new" ${QS.length - o.seen ? '' : 'disabled'}><span class="mi">🆕</span><b>안 푼 문제 <em>${QS.length - o.seen}</em></b><small>아직 보지 않은 문제만</small></button>
          <button class="mode" data-act="start" data-kind="marks" ${o.marks ? '' : 'disabled'}><span class="mi">⭐</span><b>북마크 <em>${o.marks}</em></b><small>표시해 둔 문제</small></button>
          <button class="mode" data-act="start" data-kind="random"><span class="mi">🎲</span><b>랜덤</b><small>전체에서 무작위</small></button>
        </div>
      </section>

      <section>
        <div class="sec-head"><h2>서비스 분야별</h2><span class="muted small">숙달 = ${GRADUATE_STREAK}회 연속 정답</span></div>
        <div class="cats">${Object.entries(CATS).map(([k, c]) => {
          const a = cat[k] || { total: 0, seen: 0, n: 0, c: 0, mastered: 0 };
          const note = QS.filter(q => q.cat === k && inNote(q.id)).length;
          return `<button class="cat" data-act="start" data-kind="cat" data-arg="${k}" ${a.total ? '' : 'disabled'}>
            <div class="cat-top"><span class="ci">${c.icon}</span><b>${c.name}</b>${note ? `<span class="pill warn">오답 ${note}</span>` : ''}</div>
            <small class="muted">${c.desc}</small>
            ${bar(pct(a.mastered, a.total))}
            <div class="cat-foot"><span>숙달 ${a.mastered}/${a.total}</span><span>${a.n ? '정답률 ' + pct(a.c, a.n) + '%' : '미학습'}</span></div>
          </button>`;
        }).join('')}</div>
      </section>

      <section>
        <div class="sec-head"><h2>시험 영역별 (SAA-C03)</h2></div>
        <div class="card list">${Object.entries(DOMAINS).map(([k, d]) => {
          const a = dom[k] || { total: 0, n: 0, c: 0, mastered: 0 };
          const p = a.n ? pct(a.c, a.n) : null;
          return `<button class="row" data-act="start" data-kind="domain" data-arg="${k}" ${a.total ? '' : 'disabled'}>
            <div class="row-main"><b>${d.name}</b><span class="muted small">출제 비중 ${d.weight}% · ${a.total}문제</span></div>
            <div class="row-side"><span class="${p === null ? 'muted' : p >= 72 ? 'ok' : 'bad'}">${p === null ? '-' : p + '%'}</span>${bar(p || 0, p !== null && p < 72 ? 'low' : '')}</div>
          </button>`;
        }).join('')}</div>
        <p class="muted small">합격선은 1000점 만점에 720점이에요. 72% 미만인 영역은 빨간색으로 표시돼요.</p>
      </section>

      ${store.history.length ? `<section>
        <div class="sec-head"><h2>최근 기록</h2></div>
        <div class="card list">${store.history.slice(0, 6).map(h => `
          <div class="row static"><div class="row-main"><b>${esc(h.title)}</b><span class="muted small">${fmtDate(h.t)} · ${fmtTime(h.dur)}</span></div>
          <div class="row-side"><span class="${pct(h.right, h.total) >= 72 ? 'ok' : 'bad'}">${h.right}/${h.total}</span></div></div>`).join('')}
        </div></section>` : ''}
    `;
  }

  // ───────── 문제 풀이 ─────────
  function viewQuiz() {
    const s = store.session;
    if (!s) return go('#/');
    const id = s.ids[s.idx], q = BY_ID.get(id);
    if (!q) { s.ids.splice(s.idx, 1); s.idx = Math.min(s.idx, s.ids.length - 1); save(); return s.ids.length ? viewQuiz() : go('#/'); }
    const exam = s.mode === 'exam';
    const sel = s.ans[id] || [];
    const done = !exam && s.done[id];
    const multi = q.ans.length > 1;
    const ok = done && sameSet(sel, q.ans);
    const progress = exam ? Object.keys(s.ans).filter(k => s.ans[k].length).length : Object.keys(s.done).length;
    const last = s.idx === s.ids.length - 1;

    const opts = s.order[id].map((oi, p) => {
      let cls = sel.includes(oi) ? 'sel' : '';
      if (done) cls = q.ans.includes(oi) ? 'right' : sel.includes(oi) ? 'wrong' : 'dim';
      return `<button class="opt ${cls}" data-act="pick" data-oi="${oi}" ${done ? 'disabled' : ''}>
        <span class="letter">${LETTERS[p]}</span><span class="otext">${md(q.opts[oi])}</span></button>`;
    }).join('');

    const st = stat(id);
    app.innerHTML = `
      <div class="quiz">
        <div class="qhead">
          <button class="icon-btn" data-act="quit" aria-label="나가기">✕</button>
          <div class="qprog"><div class="qprog-top"><span>${esc(s.title)}</span><span>${s.idx + 1} / ${s.ids.length}</span></div>${bar(pct(progress, s.ids.length))}</div>
          ${exam ? `<span class="timer" id="timer"></span>` : ''}
          <button class="icon-btn ${store.marks[id] ? 'on' : ''}" data-act="mark" aria-label="북마크">${store.marks[id] ? '★' : '☆'}</button>
        </div>

        <div class="chips">
          <span class="chip">${CATS[q.cat].icon} ${CATS[q.cat].name}</span>
          ${q.svc.map(x => `<span class="chip ghost">${esc(x)}</span>`).join('')}
          ${!exam && st && st.w ? `<span class="chip warn">이전 오답 ${st.w}회</span>` : ''}
          ${exam && s.flag[id] ? `<span class="chip warn">⚑ 검토 표시</span>` : ''}
        </div>

        <article class="question">${md(q.q)}${multi ? `<div class="multi">정답 ${q.ans.length}개를 고르세요</div>` : ''}</article>
        <div class="opts">${opts}</div>

        ${done ? `<div class="explain ${ok ? 'ok' : 'bad'}">
            <div class="verdict">${ok ? '✓ 정답이에요' : '✗ 오답이에요 · 오답노트에 추가했어요'}</div>
            <div class="answer-line">정답: <b>${s.order[id].map((oi, p) => q.ans.includes(oi) ? LETTERS[p] : null).filter(Boolean).join(', ')}</b>
              <span class="muted small">· ${DOMAINS[q.domain].name}</span></div>
            <div class="exp">${md(q.exp)}</div>
            ${q.tip ? `<div class="tip"><b>시험 포인트</b> ${md(q.tip)}</div>` : ''}
          </div>` : ''}

        ${exam ? `<details class="nav-grid"><summary>문제 목록 · 답함 ${progress}/${s.ids.length} · 검토 ${Object.values(s.flag).filter(Boolean).length}</summary>
          <div class="grid">${s.ids.map((x, i) => `<button data-act="jump" data-i="${i}" class="${i === s.idx ? 'cur' : ''} ${(s.ans[x] || []).length ? 'ans' : ''} ${s.flag[x] ? 'flag' : ''}">${i + 1}</button>`).join('')}</div>
          <button class="btn danger full" data-act="finish">채점하기</button></details>` : ''}
      </div>

      <div class="actionbar">
        <button class="btn ghost" data-act="prev" ${s.idx === 0 ? 'disabled' : ''}>← 이전</button>
        ${exam ? `<button class="btn ghost" data-act="flag">${s.flag[id] ? '⚑ 해제' : '⚑ 검토'}</button>
                  ${last ? `<button class="btn primary" data-act="finish">채점하기</button>` : `<button class="btn primary" data-act="next">다음 →</button>`}`
               : done ? `<button class="btn primary" data-act="next">${last ? '결과 보기' : '다음 →'}</button>`
                      : `<button class="btn primary" data-act="submit" ${sel.length === q.ans.length ? '' : 'disabled'}>정답 확인</button>`}
      </div>`;

    if (exam) {
      const tick = () => {
        const left = s.timeLimit - (Date.now() - s.start) / 1000;
        const el = $('#timer'); if (el) { el.textContent = fmtTime(left); el.classList.toggle('low', left < 600); }
        if (left <= 0) { clearInterval(timer); toast('시간이 끝났어요'); finishSession(); }
      };
      tick(); timer = setInterval(tick, 1000);
    }
  }
  function rerenderQuiz(scroll) { const y = window.scrollY; clearInterval(timer); viewQuiz(); window.scrollTo(0, scroll ? 0 : y); }

  function pick(oi) {
    const s = store.session, id = s.ids[s.idx], q = BY_ID.get(id);
    if (s.mode !== 'exam' && s.done[id]) return;
    let a = (s.ans[id] || []).slice();
    if (q.ans.length === 1) a = [oi];
    else if (a.includes(oi)) a = a.filter(x => x !== oi);
    else { a.push(oi); if (a.length > q.ans.length) a.shift(); }
    s.ans[id] = a; save();
    if (s.mode !== 'exam' && store.settings.instant && a.length === q.ans.length) return submit();
    rerenderQuiz(false);
  }
  function submit() {
    const s = store.session, id = s.ids[s.idx], q = BY_ID.get(id);
    const a = s.ans[id] || [];
    if (s.mode === 'exam' || s.done[id] || a.length !== q.ans.length) return;
    s.done[id] = true;
    record(id, sameSet(a, q.ans));
    save(); rerenderQuiz(false);
    const ex = $('.explain'); if (ex) ex.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function move(d) {
    const s = store.session; const n = s.idx + d;
    if (n < 0) return;
    if (n >= s.ids.length) { if (s.mode !== 'exam') finishSession(); return; }
    s.idx = n; save(); rerenderQuiz(true);
  }

  // ───────── 결과 ─────────
  function viewResult() {
    const r = store.last;
    if (!r) return go('#/');
    const p = pct(r.right.length, r.total);
    const byCat = {};
    for (const id of [...r.right, ...r.wrong]) {
      const q = BY_ID.get(id); if (!q) continue;
      const o = byCat[q.cat] || (byCat[q.cat] = { n: 0, c: 0 }); o.n++; if (r.right.includes(id)) o.c++;
    }
    app.innerHTML = `
      <section class="card result">
        <div class="eyebrow">${esc(r.title)}</div>
        <div class="score ${p >= 72 ? 'ok' : 'bad'}">${p}<small>%</small></div>
        <div class="muted">${r.right.length} / ${r.total} 정답 · ${fmtTime(r.dur)} 소요</div>
        ${r.mode === 'exam' ? `<div class="verdict-box ${p >= 72 ? 'ok' : 'bad'}">${p >= 72 ? '합격권이에요 (72% 이상)' : '합격선 72%까지 ' + (72 - p) + '%p 남았어요'}</div>` : ''}
        <div class="btns">
          ${r.wrong.length ? `<button class="btn primary" data-act="start" data-kind="retry">틀린 ${r.wrong.length}문제 다시 풀기</button>` : ''}
          <a class="btn ghost" href="#/">홈으로</a>
        </div>
      </section>
      <section>
        <div class="sec-head"><h2>분야별 결과</h2></div>
        <div class="card list">${Object.entries(byCat).map(([k, o]) => `
          <div class="row static"><div class="row-main"><b>${CATS[k].icon} ${CATS[k].name}</b></div>
          <div class="row-side"><span class="${pct(o.c, o.n) >= 72 ? 'ok' : 'bad'}">${o.c}/${o.n}</span>${bar(pct(o.c, o.n), pct(o.c, o.n) < 72 ? 'low' : '')}</div></div>`).join('')}
        </div>
      </section>
      ${r.wrong.length ? `<section><div class="sec-head"><h2>틀린 문제</h2></div>${r.wrong.map(id => noteItem(BY_ID.get(id))).join('')}</section>` : ''}
    `;
  }

  // ───────── 오답노트 ─────────
  let noteTab = 'note', noteCat = '';
  function noteItem(q) {
    if (!q) return '';
    const s = stat(q.id) || { n: 0, w: 0, streak: 0 };
    const need = Math.max(0, GRADUATE_STREAK - s.streak);
    return `<details class="card note">
      <summary>
        <div class="note-meta"><span class="chip">${CATS[q.cat].icon} ${CATS[q.cat].name}</span>
          ${s.w ? `<span class="chip warn">오답 ${s.w}회</span>` : ''}
          ${inNote(q.id) ? `<span class="chip ghost">졸업까지 ${need}회</span>` : graduated(q.id) ? `<span class="chip ok">졸업</span>` : ''}
          <button class="star ${store.marks[q.id] ? 'on' : ''}" data-act="mark" data-id="${q.id}" aria-label="북마크">${store.marks[q.id] ? '★' : '☆'}</button></div>
        <div class="note-q">${esc(q.q)}</div>
      </summary>
      <ul class="note-opts">${q.opts.map((o, i) => `<li class="${q.ans.includes(i) ? 'right' : ''}">${q.ans.includes(i) ? '✓ ' : ''}${md(o)}</li>`).join('')}</ul>
      <div class="exp">${md(q.exp)}</div>
      ${q.tip ? `<div class="tip"><b>시험 포인트</b> ${md(q.tip)}</div>` : ''}
    </details>`;
  }
  function viewNotes() {
    const lists = {
      note: QS.filter(q => inNote(q.id)),
      grad: QS.filter(q => graduated(q.id)),
      marks: QS.filter(q => store.marks[q.id]),
    };
    const list = lists[noteTab].filter(q => !noteCat || q.cat === noteCat)
      .sort((a, b) => (stat(b.id)?.w || 0) - (stat(a.id)?.w || 0));
    const tabs = [['note', '복습 필요'], ['grad', '졸업'], ['marks', '북마크']];
    app.innerHTML = `
      <div class="sec-head"><h1>오답노트</h1>
        ${noteTab !== 'grad' && list.length ? `<button class="btn primary sm" data-act="start" data-kind="${noteTab === 'note' ? 'note' : 'marks'}">복습 시작</button>` : ''}</div>
      <p class="muted small">틀린 문제는 자동으로 들어오고, ${GRADUATE_STREAK}번 연속으로 맞히면 '졸업'으로 옮겨져요. 졸업한 문제를 다시 틀리면 복습 목록으로 돌아와요.</p>
      <div class="tabs">${tabs.map(([k, n]) => `<button data-act="ntab" data-k="${k}" class="${noteTab === k ? 'on' : ''}">${n} <em>${lists[k].length}</em></button>`).join('')}</div>
      <div class="filter">
        <button data-act="ncat" data-k="" class="${!noteCat ? 'on' : ''}">전체</button>
        ${Object.entries(CATS).map(([k, c]) => {
          const n = lists[noteTab].filter(q => q.cat === k).length;
          return n ? `<button data-act="ncat" data-k="${k}" class="${noteCat === k ? 'on' : ''}">${c.icon} ${c.name} ${n}</button>` : '';
        }).join('')}
      </div>
      ${list.length ? list.map(noteItem).join('') : `<div class="empty">${noteTab === 'note' ? '복습할 오답이 없어요 👏' : '아직 없어요'}</div>`}
    `;
  }

  // ───────── 설정 ─────────
  function viewSettings() {
    const t = store.settings.theme;
    app.innerHTML = `
      <h1>설정</h1>
      <section class="card form">
        <div class="field"><div><b>화면 테마</b></div>
          <div class="seg">${[['auto', '자동'], ['light', '라이트'], ['dark', '다크']].map(([k, n]) =>
            `<button data-act="theme" data-k="${k}" class="${t === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <label class="field"><div><b>선택 즉시 채점</b><div class="muted small">보기를 누르면 확인 버튼 없이 바로 채점해요 (연습 모드)</div></div>
          <input type="checkbox" class="switch" data-act="instant" ${store.settings.instant ? 'checked' : ''}></label>
      </section>

      <h2>기록 백업 · 기기 간 옮기기</h2>
      <section class="card form">
        <p class="muted small">학습 기록은 이 브라우저에만 저장돼요. 휴대폰과 PC 기록을 맞추려면 한쪽에서 백업 코드를 복사해서 다른 쪽에 붙여넣으세요.</p>
        <div class="btns">
          <button class="btn primary" data-act="export">백업 코드 복사</button>
          <button class="btn ghost" data-act="download">파일로 저장</button>
        </div>
        <textarea id="importBox" rows="3" placeholder="여기에 백업 코드를 붙여넣으세요"></textarea>
        <div class="btns">
          <button class="btn ghost" data-act="import" data-merge="1">합치기</button>
          <button class="btn ghost" data-act="import">덮어쓰기</button>
        </div>
      </section>

      <h2>초기화</h2>
      <section class="card form">
        <button class="btn danger" data-act="reset">모든 학습 기록 지우기</button>
      </section>
      <p class="muted small center">문제 ${QS.length}개 · SAA-C03 기준</p>
    `;
  }
  function exportData() { return JSON.stringify({ v: 1, stats: store.stats, marks: store.marks, history: store.history }); }
  function importData(text, merge) {
    let d;
    try { d = JSON.parse(text.trim()); } catch (e) { return toast('코드 형식이 올바르지 않아요'); }
    if (!d || typeof d.stats !== 'object') return toast('학습 기록 데이터가 아니에요');
    if (merge) {
      for (const [id, s] of Object.entries(d.stats)) {
        const m = store.stats[id];
        if (!m) store.stats[id] = s;
        else store.stats[id] = { n: m.n + s.n, c: m.c + s.c, w: m.w + s.w, streak: s.t > m.t ? s.streak : m.streak, t: Math.max(m.t, s.t) };
      }
      Object.assign(store.marks, d.marks || {});
      store.history = [...(d.history || []), ...store.history].sort((a, b) => b.t - a.t).slice(0, 50);
    } else {
      store.stats = d.stats; store.marks = d.marks || {}; store.history = d.history || [];
    }
    save(); toast('기록을 불러왔어요'); go('#/');
  }

  function applyTheme() {
    const t = store.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // ───────── 이벤트 ─────────
  app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const d = b.dataset;
    switch (d.act) {
      case 'start': return startMode(d.kind, d.arg);
      case 'resume': return go('#/quiz');
      case 'count': store.settings.count = +d.n; save(); return viewHome();
      case 'pick': return pick(+d.oi);
      case 'submit': return submit();
      case 'next': return move(1);
      case 'prev': return move(-1);
      case 'jump': store.session.idx = +d.i; save(); return rerenderQuiz(true);
      case 'flag': { const s = store.session, id = s.ids[s.idx]; s.flag[id] = !s.flag[id]; save(); return rerenderQuiz(false); }
      case 'finish': {
        const s = store.session, left = s.ids.filter(id => !(s.ans[id] || []).length).length;
        if (left && !confirm(`안 푼 문제가 ${left}개 있어요. 채점할까요?`)) return;
        return finishSession();
      }
      case 'quit': {
        const s = store.session;
        const answered = s.mode === 'exam' ? Object.keys(s.ans).length : Object.keys(s.done).length;
        if (answered && confirm('지금까지 푼 문제로 결과를 볼까요?\n취소하면 저장해 두고 홈으로 가요 (홈에서 이어 풀기 가능)')) return finishSession();
        return go('#/');
      }
      case 'mark': {
        e.preventDefault(); e.stopPropagation();
        const id = d.id || store.session.ids[store.session.idx];
        if (store.marks[id]) delete store.marks[id]; else store.marks[id] = true;
        save(); toast(store.marks[id] ? '북마크에 추가했어요' : '북마크를 해제했어요');
        if (route() === 'quiz') return rerenderQuiz(false);
        b.classList.toggle('on', !!store.marks[id]); b.textContent = store.marks[id] ? '★' : '☆';
        return;
      }
      case 'ntab': noteTab = d.k; noteCat = ''; return viewNotes();
      case 'ncat': noteCat = d.k; return viewNotes();
      case 'theme': store.settings.theme = d.k; save(); applyTheme(); return viewSettings();
      case 'instant': store.settings.instant = b.checked; return save();
      case 'export': {
        const txt = exportData();
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
          .then(() => toast('백업 코드를 복사했어요'))
          .catch(() => { $('#importBox').value = txt; $('#importBox').select(); toast('아래 칸의 코드를 직접 복사하세요'); });
        return;
      }
      case 'download': {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
        a.download = `saa-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); return;
      }
      case 'import': return importData($('#importBox').value, !!d.merge);
      case 'reset':
        if (confirm('모든 학습 기록, 북마크, 오답노트를 지울까요? 되돌릴 수 없어요.')) {
          const settings = store.settings; Object.assign(store, defaults(), { settings }); save(); toast('초기화했어요'); go('#/');
        }
        return;
    }
  });

  document.addEventListener('keydown', e => {
    if (route() !== 'quiz' || !store.session || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const s = store.session, id = s.ids[s.idx];
    const k = e.key.toLowerCase();
    let p = '12345'.indexOf(k); if (p < 0) p = 'abcde'.indexOf(k);
    if (p >= 0 && p < s.order[id].length) { e.preventDefault(); return pick(s.order[id][p]); }
    if (k === 'enter' || k === ' ') {
      e.preventDefault();
      if (s.mode === 'exam') return s.idx === s.ids.length - 1 ? null : move(1);
      return s.done[id] ? move(1) : submit();
    }
    if (k === 'arrowright') return move(1);
    if (k === 'arrowleft') return move(-1);
    if (k === 'b') return $('[data-act="mark"]')?.click();
  });

  window.addEventListener('hashchange', render);
  applyTheme();
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
