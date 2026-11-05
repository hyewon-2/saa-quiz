// 보기 길이 편향 점검·수정 도구
//   node tools/option-tools.js audit             정답이 가장 긴 보기인 비율 출력
//   node tools/option-tools.js dump <from> <n>   아직 편향된 문제를 작업용으로 출력
//   node tools/option-tools.js apply <fix.js>    { id: { 보기인덱스: '새 문구' } } 를 data/*.js 원본에 반영
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), dataDir = path.join(root, 'data');
const files = fs.readdirSync(dataDir).filter(f => f !== 'concepts.js');

function loadAll() {
  const qs = [];
  global.window = { QB: { push: (...a) => qs.push(...a) } };
  global.QB = window.QB;
  for (const f of files) new Function(fs.readFileSync(path.join(dataDir, f), 'utf8'))();
  return qs;
}
const wrongLens = q => q.opts.filter((_, i) => !q.ans.includes(i)).map(o => o.length);
const rightMax = q => Math.max(...q.ans.map(i => q.opts[i].length));
const isLongest = q => rightMax(q) > Math.max(...wrongLens(q));
const ratio = q => { const w = wrongLens(q); return rightMax(q) / (w.reduce((a, b) => a + b, 0) / w.length); };
// 보기가 모두 짧은 서비스 이름뿐인 문제는 길이가 단서가 되지 않으므로 제외
const flagged = q => isLongest(q) && rightMax(q) > 28;

function audit(qs) {
  const longest = qs.filter(isLongest).length, avg = qs.reduce((s, q) => s + ratio(q), 0) / qs.length;
  console.log(`문제 ${qs.length} · 정답이 최장 ${longest} (${(longest / qs.length * 100).toFixed(1)}%) · 정답/오답 길이비 평균 ${avg.toFixed(2)} · 수정 대상 ${qs.filter(flagged).length}`);
  return { longest, avg };
}
const BS = String.fromCharCode(92);   // 역슬래시
const literal = s => "'" + s.split(BS).join(BS + BS).split("'").join(BS + "'").split('\n').join(BS + 'n') + "'";
function apply(fix) {
  let done = 0; const qs = loadAll(), byId = new Map(qs.map(q => [q.id, q]));
  for (const f of files) {
    const p = path.join(dataDir, f); let src = fs.readFileSync(p, 'utf8'), changed = false;
    for (const [id, edits] of Object.entries(fix)) {
      const start = src.indexOf(`id: '${id}'`); if (start < 0) continue;
      const q = byId.get(id), at = src.indexOf('opts:', start), end = src.indexOf('ans:', at);
      let block = src.slice(at, end);
      for (const [i, text] of Object.entries(edits)) {
        const old = literal(q.opts[i]);
        if (!block.includes(old)) throw new Error(`원문을 찾지 못함: ${id}[${i}]`);
        block = block.replace(old, () => literal(text)); done++;
      }
      src = src.slice(0, at) + block + src.slice(end); changed = true;
    }
    if (changed) fs.writeFileSync(p, src);
  }
  console.log('수정한 보기', done);
}
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'audit') { const r = audit(loadAll()); if (a === '--check' && r.longest / loadAll().length > 0.4) process.exit(1); }
if (cmd === 'dump') {
  loadAll().filter(flagged).slice(+a || 0, (+a || 0) + (+b || 100)).forEach(q => {
    console.log(`#${q.id} ${q.q.replace(/\s+/g, ' ').slice(0, 46)}`);
    q.opts.forEach((o, i) => console.log(`${i}${q.ans.includes(i) ? '*' : ' '} ${o}`));
  });
}
if (cmd === 'apply') { apply(require(path.resolve(a))); audit(loadAll()); }
module.exports = { loadAll, audit };
