'use strict';
/* ============ My Day — front-end (Vanilla JS SPA, 한국어/日本語) ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };

/* ---------- i18n : L('한국어','日本語') ---------- */
let LANG = store.get('myday.lang') || ((navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'ko');
document.documentElement.lang = LANG;
const L = (ko, ja) => (LANG === 'ja' ? ja : ko);
const dow = () => (LANG === 'ja' ? ['日', '月', '火', '水', '木', '金', '土'] : ['일', '월', '화', '수', '목', '금', '토']);
const dowMon = () => (LANG === 'ja' ? ['月', '火', '水', '木', '金', '土', '日'] : ['월', '화', '수', '목', '금', '토', '일']);
const MOODS = ['😞', '😕', '😐', '🙂', '🤩'];
const moodTxt = i => (LANG === 'ja' ? ['いまいち', 'ちょっとつらい', 'ふつう', 'いい感じ', '最高！'] : ['별로예요', '조금 힘들어요', '보통이에요', '좋아요', '최고예요'])[i];
const TODS = ['dawn', 'day', 'dusk', 'night'];
const todTxt = t => ({ dawn: L('새벽', '朝焼け'), day: L('낮', '昼'), dusk: L('노을', '夕焼け'), night: L('밤', '夜') }[t]);
const NAMES = ['today', 'tasks', 'habits', 'journal', 'insights', 'settings'];
const S = { user: null, view: null, tk: 0, tasks: [], tdate: '', jdate: '', onTasks: null, onKey: null, todOv: null, calYm: '', cal: {} };

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = s => { const d = new Date(s + 'T00:00:00'), w = dow()[d.getDay()]; return L(`${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`, `${d.getMonth() + 1}月${d.getDate()}日(${w})`); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todOf = h => (h >= 5 && h < 9 ? 'dawn' : h >= 9 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night');
const greet = h => (h < 5 ? L('고요한 밤이에요', '静かな夜ですね') : h < 11 ? L('좋은 아침이에요', 'おはようございます') : h < 14 ? L('활기찬 낮이에요', '元気な昼ですね') : h < 18 ? L('좋은 오후예요', '穏やかな午後ですね') : h < 22 ? L('편안한 저녁이에요', 'こんばんは') : L('고요한 밤이에요', '静かな夜ですね'));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- api ---------- */
async function api(path, o = {}) {
  const r = await fetch('/api' + path, {
    method: o.method || 'GET', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Lang': LANG },
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  let d = {};
  try { d = await r.json(); } catch (e) { /* empty body */ }
  if (!r.ok) {
    if (r.status === 401 && !o.noauth) { S.user = null; location.hash = '#/login'; }
    throw Object.assign(new Error(d.message || L('문제가 생겼어요. 잠시 후 다시 시도해 주세요.', '問題が発生しました。しばらくしてからもう一度お試しください。')), { status: r.status });
  }
  return d;
}

/* ---------- fx: toast / confetti / count-up / typing ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<i></i><span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, type === 'info' ? 5200 : 3200);
}
const fx = $('#fx'), ctx = fx.getContext('2d'), DPR = Math.min(window.devicePixelRatio || 1, 2);
let parts = [], raf = 0;
function sizeFx() { fx.width = innerWidth * DPR; fx.height = innerHeight * DPR; }
addEventListener('resize', debounce(sizeFx, 200)); sizeFx();
function confetti(x, y, n = 50) {
  if (REDUCED) return;
  const cols = ['#ffd08a', '#ff8f70', '#8ee0b0', '#9db4ff', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 8;
    parts.push({ x: x * DPR, y: y * DPR, vx: Math.cos(a) * v * DPR, vy: (Math.sin(a) * v - 6) * DPR, s: (4 + Math.random() * 5) * DPR, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[i % cols.length], life: 1 });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}
function loop() {
  ctx.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.life > 0 && p.y < fx.height + 40);
  for (const p of parts) {
    p.vy += .35 * DPR; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.r += p.vr; p.life -= .014;
    ctx.save(); ctx.globalAlpha = Math.max(p.life, 0); ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6); ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : 0;
  if (!parts.length) ctx.clearRect(0, 0, fx.width, fx.height);
}
function countUp(el) {
  const to = +el.dataset.to, suf = el.dataset.suf || '', dec = el.dataset.dec ? 1 : 0, t0 = performance.now();
  (function step(t) {
    const p = Math.min((t - t0) / 800, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (to * e).toFixed(dec) + suf;
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
const runCounts = r => $$('[data-to]', r).forEach(countUp);
function typeText(el, text) {
  if (REDUCED) { el.textContent = text; el.classList.add('end'); return; }
  let i = 0;
  (function step() { el.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, 18); else el.classList.add('end'); })();
}
let AC;
function beepPrime() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { /* ignore */ } }
function beep() {
  try {
    if (!AC) return;
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.frequency.value = 880; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.2, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(t + 1);
  } catch (e) { /* ignore */ }
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- sky (time of day) ---------- */
function applyTod(t) { document.body.dataset.tod = t; }
function tickTod() { if (!S.todOv) applyTod(todOf(new Date().getHours())); }
tickTod(); setInterval(tickTod, 60000);

/* ---------- view transitions ---------- */
async function swap(fn, dir = 'fwd') {
  if (!document.startViewTransition || REDUCED) { await fn(); return; }
  document.documentElement.dataset.dir = dir;
  const t = document.startViewTransition(fn);
  try { await t.updateCallbackDone; } catch (e) { /* skipped */ }
}
async function swapList(fn, dir) {
  const v = $('#view'), l = $('#tlist');
  if (!document.startViewTransition || REDUCED || !l) { await fn(); return; }
  v.style.viewTransitionName = 'none'; l.style.viewTransitionName = 'list';
  document.documentElement.dataset.dir = dir > 0 ? 'fwd' : 'back';
  const t = document.startViewTransition(fn);
  try { await t.finished; } catch (e) { /* skipped */ }
  v.style.viewTransitionName = ''; l.style.viewTransitionName = '';
}

/* ---------- language ---------- */
const langSw = () => `<div class="langsw" role="group" aria-label="Language"><button data-lang="ko" class="${LANG === 'ko' ? 'on' : ''}">한국어</button><button data-lang="ja" class="${LANG === 'ja' ? 'on' : ''}">日本語</button></div>`;
function setLang(l) {
  if (l === LANG) return;
  LANG = l; store.set('myday.lang', l); document.documentElement.lang = l;
  if (S.user) {
    api('/me', { method: 'PUT', body: { lang: l } }).catch(() => { /* ignore */ });
    $('#root').innerHTML = ''; route();
  } else {
    const cur = $('.pane.on') && $('.pane.on').dataset.p;
    renderAuth(); if (['login', 'signup', 'forgot'].includes(cur)) pane(cur);
  }
}

/* ============ AUTH ============ */
const AUTH = { email: '' };
const letters = (txt, off) => [...txt].map((c, i) => `<span style="--d:${i + off}">${c}</span>`).join('');
const otpHTML = () => `<div class="otp">${[0, 1, 2, 3, 4, 5].map(i => `<input inputmode="numeric" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="${i + 1}">`).join('')}</div>`;
const otpVal = r => $$('.otp input', r).map(x => x.value).join('');
const mailPh = 'you@example.com';

function renderAuth() {
  S.view = null;
  $('#root').innerHTML = `<div class="auth"><div class="authlang">${langSw()}</div>
  <section class="brandpane">
    <p class="eyebrow">daily journal · checklist · habits · insight</p>
    <h1 style="margin-top:18px">${letters('My', 0)}<span style="--d:2">&nbsp;</span><em>${letters('Day', 3)}</em></h1>
    <p class="tag">${L('하루를 기록하고, 돌아보고, 다음 하루를 추천받는 나만의 공간.', '一日を記録して、振り返って、次の一日をおすすめしてもらう、あなただけの場所。')}</p>
    <div class="chips"><span class="chip">✓ ${L('체크리스트', 'タスク')}</span><span class="chip">🔁 ${L('습관', '習慣')}</span><span class="chip">📝 ${L('하루 기록', '一日の記録')}</span><span class="chip">⏱️ ${L('집중 타이머', '集中タイマー')}</span><span class="chip">📈 ${L('인사이트', 'インサイト')}</span><span class="chip">✉️ ${L('이메일 리포트', 'メールレポート')}</span></div>
  </section>
  <section class="authcard glass">
    <div class="pane on" data-p="login">
      <h2>${L('다시 만나서 반가워요', 'おかえりなさい')}</h2><p class="lead">${L('오늘의 하루를 이어서 기록해 볼까요?', '今日の一日を続けて記録しましょう。')}</p>
      <form data-f="login" novalidate>
        <div class="field"><label>${L('이메일', 'メールアドレス')}</label><input class="in" name="email" type="email" autocomplete="email" placeholder="${mailPh}"></div>
        <div class="field"><label>${L('비밀번호', 'パスワード')}</label><input class="in" name="password" type="password" autocomplete="current-password"></div>
        <button class="btn wide">${L('로그인', 'ログイン')}</button>
      </form>
      <div class="spread" style="margin-top:16px"><button class="link" data-go="forgot">${L('비밀번호를 잊었어요', 'パスワードを忘れた')}</button><button class="link" data-go="signup">${L('회원가입', '新規登録')}</button></div>
      <div class="or">${L('또는', 'または')}</div>
      <button class="btn ghost wide" data-demo>✨ ${L('체험 계정으로 둘러보기', 'デモアカウントで見てみる')}</button>
    </div>
    <div class="pane" data-p="signup">
      <h2>${L('새로운 하루의 시작', '新しい一日のはじまり')}</h2><p class="lead">${L('이메일 인증 후 바로 시작할 수 있어요.', 'メール認証後すぐに始められます。')}</p>
      <form data-f="signup" novalidate>
        <div class="field"><label>${L('닉네임', 'ニックネーム')}</label><input class="in" name="nickname" maxlength="20" autocomplete="nickname"></div>
        <div class="field"><label>${L('이메일', 'メールアドレス')}</label><input class="in" name="email" type="email" autocomplete="email" placeholder="${mailPh}"></div>
        <div class="field"><label>${L('비밀번호', 'パスワード')} <span class="muted">(${L('8자 이상, 영문+숫자', '8文字以上・英字+数字')})</span></label><input class="in" name="password" type="password" autocomplete="new-password" data-meter><div class="meter"><i></i></div></div>
        <div class="field"><label>${L('비밀번호 확인', 'パスワード（確認）')}</label><input class="in" name="password2" type="password" autocomplete="new-password"></div>
        <button class="btn wide">${L('인증 코드 받기', '認証コードを受け取る')}</button>
      </form>
      <div class="spread" style="margin-top:16px"><span class="muted">${L('이미 계정이 있나요?', 'アカウントをお持ちですか？')}</span><button class="link" data-go="login">${L('로그인', 'ログイン')}</button></div>
    </div>
    <div class="pane" data-p="verify">
      <h2>${L('메일함을 확인해 주세요', 'メールをご確認ください')}</h2><p class="lead"><b data-email></b> ${L('로 보낸 6자리 코드를 입력해 주세요.', 'に送った6桁のコードを入力してください。')}</p>
      <form data-f="verify" novalidate>${otpHTML()}<button type="button" class="dev" data-fill hidden></button><button class="btn wide">${L('인증하고 시작하기', '認証して始める')}</button></form>
      <div class="spread" style="margin-top:16px"><button class="link" data-resend="verify">${L('코드 다시 받기', 'コードを再送')}</button><button class="link" data-go="login">${L('처음으로', '最初に戻る')}</button></div>
    </div>
    <div class="pane" data-p="forgot">
      <h2>${L('비밀번호 찾기', 'パスワードの再設定')}</h2><p class="lead">${L('가입한 이메일로 재설정 코드를 보내 드려요.', '登録したメールアドレスに再設定コードを送ります。')}</p>
      <form data-f="forgot" novalidate>
        <div class="field"><label>${L('이메일', 'メールアドレス')}</label><input class="in" name="email" type="email" autocomplete="email" placeholder="${mailPh}"></div>
        <button class="btn wide">${L('코드 보내기', 'コードを送る')}</button>
      </form>
      <div style="margin-top:16px"><button class="link" data-go="login">← ${L('로그인으로', 'ログインへ')}</button></div>
    </div>
    <div class="pane" data-p="reset">
      <h2>${L('새 비밀번호 설정', '新しいパスワード')}</h2><p class="lead"><b data-email></b> ${L('로 보낸 코드와 새 비밀번호를 입력해 주세요.', 'に送ったコードと新しいパスワードを入力してください。')}</p>
      <form data-f="reset" novalidate>${otpHTML()}<button type="button" class="dev" data-fill hidden></button>
        <div class="field"><label>${L('새 비밀번호', '新しいパスワード')}</label><input class="in" name="password" type="password" autocomplete="new-password" data-meter><div class="meter"><i></i></div></div>
        <button class="btn wide">${L('비밀번호 바꾸기', 'パスワードを変更')}</button>
      </form>
      <div class="spread" style="margin-top:16px"><button class="link" data-resend="reset">${L('코드 다시 받기', 'コードを再送')}</button><button class="link" data-go="login">${L('처음으로', '最初に戻る')}</button></div>
    </div>
  </section></div>`;

  const card = $('.authcard');
  $$('.pane', card).forEach(p => bindOtp(p));
  card.addEventListener('click', async e => {
    const go = e.target.closest('[data-go]'); if (go) { pane(go.dataset.go); return; }
    const fill = e.target.closest('[data-fill]'); if (fill && fill.dataset.code) { fillOtp(fill.closest('.pane'), fill.dataset.code); return; }
    const rs = e.target.closest('[data-resend]');
    if (rs) {
      const p = rs.dataset.resend;
      try {
        const r = await api(p === 'verify' ? '/auth/resend' : '/auth/forgot', { method: 'POST', body: { email: AUTH.email }, noauth: true });
        showDev(p, r.devCode); cooldown(p); toast(L('새 코드를 보냈어요', '新しいコードを送りました'));
      } catch (err) { toast(err.message, 'err'); }
      return;
    }
    const demo = e.target.closest('[data-demo]');
    if (demo) {
      try { await busy(demo, () => ACT.login({ email: 'demo@myday.app', password: 'Demo1234!' })); }
      catch (err) { toast(err.message, 'err'); }
    }
  });
  card.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, btn = e.submitter || $('.btn', f);
    try { await busy(btn, () => ACT[f.dataset.f](Object.fromEntries(new FormData(f)), f)); }
    catch (err) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); toast(err.message, 'err'); }
  });
  card.addEventListener('input', e => {
    if (!e.target.matches('[data-meter]')) return;
    const v = e.target.value; let sc = 0;
    if (v.length >= 8) sc++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) sc++; if (/\d/.test(v)) sc++; if (/[^A-Za-z0-9]/.test(v)) sc++;
    const bar = $('.meter i', e.target.parentElement);
    bar.style.width = (v ? Math.max(sc, 1) * 25 : 0) + '%';
    bar.style.background = ['#ff8f8f', '#ff8f8f', '#ffd08a', '#8ee0b0', '#8ee0b0'][sc];
  });
}
function pane(n) {
  $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.p === n));
  const f = $('.pane.on input'); if (f) setTimeout(() => f.focus(), 200);
}
function bindOtp(root) {
  const ins = $$('.otp input', root); if (!ins.length) return;
  const form = root.querySelector('form');
  ins.forEach((el, i) => {
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '');
      if (el.value && ins[i + 1]) ins[i + 1].focus();
      if (ins.every(x => x.value) && form.dataset.f === 'verify') form.requestSubmit();
    });
    el.addEventListener('keydown', e => { if (e.key === 'Backspace' && !el.value && ins[i - 1]) ins[i - 1].focus(); });
    el.addEventListener('paste', e => {
      const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!t) return;
      e.preventDefault(); fillOtp(root, t);
    });
  });
}
function fillOtp(root, code) {
  const ins = $$('.otp input', root);
  [...code].forEach((c, k) => { if (ins[k]) ins[k].value = c; });
  ins[Math.min(code.length, 5)].focus();
  if (code.length === 6 && root.dataset.p === 'verify') root.querySelector('form').requestSubmit();
}
function showDev(p, code) {
  const el = $(`[data-p=${p}] .dev`); if (!el) return;
  if (!code) { el.hidden = true; return; }
  el.hidden = false; el.dataset.code = code;
  el.innerHTML = `${L('개발 모드 · 메일 서버가 설정되지 않아 코드를 여기에 표시해요', '開発モード・メールサーバー未設定のため、コードをここに表示します')}<br>${L('인증 코드', '認証コード')} <b>${code}</b> (${L('눌러서 자동 입력', 'タップで自動入力')})`;
}
let cdT;
function cooldown(p) {
  const b = $(`[data-resend=${p}]`); if (!b) return;
  clearInterval(cdT); let n = 30;
  const tick = () => { b.disabled = n > 0; b.textContent = (n > 0 ? L(`코드 다시 받기 (${n}s)`, `コードを再送 (${n}s)`) : L('코드 다시 받기', 'コードを再送')); if (--n < 0) clearInterval(cdT); };
  tick(); cdT = setInterval(tick, 1000);
}
async function busy(btn, fn) { btn.classList.add('busy'); try { return await fn(); } finally { btn.classList.remove('busy'); } }
function toVerify(r) {
  AUTH.email = r.email; $('[data-p=verify] [data-email]').textContent = r.email;
  showDev('verify', r.devCode); pane('verify'); cooldown('verify');
  toast(r.devCode ? L('개발 모드: 인증 코드가 화면에 표시돼요', '開発モード：認証コードが画面に表示されます') : L('인증 코드를 메일로 보냈어요', '認証コードをメールで送りました'), 'info');
}
function enter(user) {
  S.user = user;
  if (user.lang && user.lang !== LANG && !store.get('myday.lang')) { LANG = user.lang; document.documentElement.lang = LANG; }
  if (location.hash === '#/today') route(); else location.hash = '#/today';
}
const ACT = {
  async login(v) {
    const r = await api('/auth/login', { method: 'POST', body: v, noauth: true });
    if (r.needVerify) return toVerify(r);
    enter(r.user);
  },
  async signup(v) {
    if (v.password !== v.password2) throw new Error(L('비밀번호 확인이 일치하지 않아요.', 'パスワード（確認）が一致しません。'));
    toVerify(await api('/auth/signup', { method: 'POST', body: { nickname: v.nickname, email: v.email, password: v.password }, noauth: true }));
  },
  async verify(v, f) {
    const code = otpVal(f); if (code.length < 6) throw new Error(L('6자리 코드를 모두 입력해 주세요.', '6桁のコードをすべて入力してください。'));
    const r = await api('/auth/verify', { method: 'POST', body: { email: AUTH.email, code }, noauth: true });
    toast(L('이메일 인증이 완료됐어요 🎉', 'メール認証が完了しました 🎉')); enter(r.user);
  },
  async forgot(v) {
    AUTH.email = String(v.email || '').trim().toLowerCase();
    const r = await api('/auth/forgot', { method: 'POST', body: { email: AUTH.email }, noauth: true });
    $('[data-p=reset] [data-email]').textContent = AUTH.email;
    showDev('reset', r.devCode); pane('reset'); cooldown('reset');
    toast(L('재설정 코드를 보냈어요 (가입된 이메일인 경우)', '再設定コードを送りました（登録済みの場合）'));
  },
  async reset(v, f) {
    const code = otpVal(f); if (code.length < 6) throw new Error(L('6자리 코드를 모두 입력해 주세요.', '6桁のコードをすべて入力してください。'));
    await api('/auth/reset', { method: 'POST', body: { email: AUTH.email, code, password: v.password }, noauth: true });
    toast(L('비밀번호를 바꿨어요. 다시 로그인해 주세요 ✨', 'パスワードを変更しました。もう一度ログインしてください ✨')); pane('login');
  }
};

/* ============ SHELL + ROUTER ============ */
const NAV = [
  ['today', () => L('오늘', '今日'), '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  ['tasks', () => L('할 일', 'タスク'), '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'],
  ['habits', () => L('습관', '習慣'), '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>'],
  ['journal', () => L('기록', '記録'), '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h5"/>'],
  ['insights', () => L('인사이트', '分析'), '<path d="M3 20h18"/><path d="M6 16v-5M11 16V6M16 16v-8M21 16v-3"/>'],
  ['settings', () => L('설정', '設定'), '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>']
];
function renderShell() {
  $('#root').innerHTML = `<div class="app"><aside class="side glass">
    <div class="brand"><span class="logo" id="logo" title="${L('클릭해서 시간대를 바꿔 보세요', 'クリックで時間帯を切り替え')}"></span><span>My <em>Day</em></span></div>
    <nav class="nav" id="nav"><i class="pill"></i>${NAV.map(([k, l, ic], i) => `<a href="#/${k}" data-k="${k}" data-i="${i}"><svg viewBox="0 0 24 24">${ic}</svg><span>${l()}</span></a>`).join('')}</nav>
    <div class="sidefoot">${langSw()}<div class="me"><div class="av" id="av">${esc((S.user.nickname || '?')[0])}</div><div><b id="mename">${esc(S.user.nickname)}</b><small>${esc(S.user.email)}</small></div></div></div>
  </aside><main id="view"></main></div>`;
}
function setNav(name) {
  $('#nav').style.setProperty('--idx', NAMES.indexOf(name));
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === name));
}
async function route() {
  const name = location.hash.replace(/^#\/?/, '') || 'today';
  if (!S.user) { try { S.user = await api('/me', { noauth: true }); } catch (e) { S.user = null; } }
  if (!S.user) { if (!$('.auth')) await swap(renderAuth, 'back'); return; }
  if (!VIEWS[name]) { location.hash = '#/today'; return; }
  const tk = ++S.tk, first = !$('.app'), dir = NAMES.indexOf(name) < NAMES.indexOf(S.view) ? 'back' : 'fwd';
  const go = async () => {
    try {
      const out = await VIEWS[name]();
      if (tk !== S.tk) return;
      if (first) renderShell();
      setNav(name); S.view = name; S.onTasks = null; S.onKey = null;
      const v = $('#view'); v.innerHTML = out.html; window.scrollTo(0, 0);
      out.after && out.after(v); runCounts(v);
    } catch (err) { if (tk === S.tk) toast(err.message, 'err'); }
  };
  await swap(go, first ? 'fwd' : dir);
}
addEventListener('hashchange', route);

/* ============ SHARED UI ============ */
const taskRow = (t, i = 0) => `<li class="task p${t.priority} ${t.done ? 'done' : ''}" data-id="${t.id}" style="--i:${i}">
  <button class="chk" data-toggle aria-label="${L('완료 표시', '完了')}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
  <span class="t">${esc(t.title)}</span><span class="pr"></span><button class="ed" data-edit aria-label="${L('수정', '編集')}">✎</button><button class="x" data-del aria-label="${L('삭제', '削除')}">×</button></li>`;
async function addTask(title, date, priority = 2) {
  const t = await api('/tasks', { method: 'POST', body: { title, date, priority } });
  S.tasks.push(t); return t;
}
function editTask(li) {
  const sp = li.querySelector('.t'), t = S.tasks.find(x => x.id === +li.dataset.id); if (!sp || !t) return;
  const inp = document.createElement('input'); inp.className = 'in edit'; inp.value = t.title; inp.maxLength = 200;
  sp.replaceWith(inp); inp.focus(); inp.select();
  let fin = false;
  const end = async save => {
    if (fin) return; fin = true;
    const v = inp.value.trim(), span = document.createElement('span'); span.className = 't';
    if (save && v && v !== t.title) {
      try { await api('/tasks/' + t.id, { method: 'PATCH', body: { title: v } }); t.title = v; } catch (err) { toast(err.message, 'err'); }
    }
    span.textContent = t.title; inp.replaceWith(span);
  };
  inp.addEventListener('blur', () => end(true));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); });
}
const stat = () => { const t = S.tasks.length, d = S.tasks.filter(x => x.done).length; return { t, d, pct: t ? Math.round(d / t * 100) : 0 }; };
const segBind = (el, cb) => el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); cb(b); });
const dateNav = () => `<div class="datenav"><button class="iconbtn" data-n="-1" aria-label="prev">‹</button><span class="lab" id="dlab"></span><button class="iconbtn" data-n="1" aria-label="next">›</button><button class="btn ghost sm" data-n="0">${L('오늘', '今日')}</button></div>`;
const dateLabel = d => fmtDate(d) + (d === todayStr() ? L(' · 오늘', ' · 今日') : '');
const wdOf = s => dow()[new Date(s + 'T00:00:00').getDay()];

document.addEventListener('click', async e => {
  const lg = e.target.closest('[data-lang]'); if (lg) { setLang(lg.dataset.lang); return; }
  if (e.target.closest('#logo')) {
    S.todOv = TODS[(TODS.indexOf(document.body.dataset.tod) + 1) % 4]; applyTod(S.todOv);
    toast(L(`시간대 미리보기 · ${todTxt(S.todOv)} (새로고침하면 원래대로)`, `時間帯プレビュー・${todTxt(S.todOv)}（再読み込みで元に戻ります）`), 'info'); return;
  }
  const ed = e.target.closest('[data-edit]'); if (ed) { editTask(ed.closest('.task')); return; }
  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    const li = tg.closest('.task'), t = S.tasks.find(x => x.id === +li.dataset.id); if (!t) return;
    const done = !t.done; t.done = done; li.classList.toggle('done', done); S.onTasks && S.onTasks();
    try { await api('/tasks/' + t.id, { method: 'PATCH', body: { done } }); }
    catch (err) { t.done = !done; li.classList.toggle('done', !done); S.onTasks && S.onTasks(); toast(err.message, 'err'); return; }
    if (done) {
      const r = tg.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 18);
      if (S.tasks.every(x => x.done)) { setTimeout(() => confetti(innerWidth / 2, innerHeight / 3, 110), 200); toast(L('할 일을 모두 끝냈어요! 🎉', 'すべてのタスクを終えました！🎉')); }
    }
    return;
  }
  const dl = e.target.closest('[data-del]');
  if (dl) {
    const li = dl.closest('.task'), id = +li.dataset.id;
    li.classList.add('out');
    try { await api('/tasks/' + id, { method: 'DELETE' }); } catch (err) { li.classList.remove('out'); toast(err.message, 'err'); return; }
    setTimeout(() => { S.tasks = S.tasks.filter(x => x.id !== id); li.remove(); S.onTasks && S.onTasks(); }, 260);
  }
});
document.addEventListener('dblclick', e => { const sp = e.target.closest('.task .t'); if (sp) editTask(sp.closest('.task')); });
document.addEventListener('keydown', e => {
  if (S.onKey) S.onKey(e);
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !S.user || e.target.closest('input,textarea,select')) return;
  const i = '123456'.indexOf(e.key);
  if (i > -1) { location.hash = '#/' + NAMES[i]; return; }
  if (e.key === 'n') { const el = $('#qin') || $('#tin'); if (el) { e.preventDefault(); el.focus(); } }
});

/* ---------- focus timer (전역: 화면을 옮겨도 계속 동작) ---------- */
const FOCUS = { total: 1500, left: 1500, state: 'idle', endAt: 0, iv: 0, label: '' };
const fmtT = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
function focusPaint() {
  if ($('#ftime')) {
    $('#ftime').textContent = fmtT(FOCUS.left);
    $('#fring').style.strokeDashoffset = 100 - (1 - FOCUS.left / FOCUS.total) * 100;
    $('#fgo').textContent = FOCUS.state === 'run' ? L('일시정지', '一時停止') : FOCUS.state === 'pause' ? L('계속', '再開') : L('시작', '開始');
    $('#fsub').textContent = FOCUS.state === 'run' ? L('집중 중', '集中中') : L('집중 타이머', '集中タイマー');
    $$('#fpre button').forEach(b => b.classList.toggle('on', +b.dataset.m * 60 === FOCUS.total));
  }
  document.title = FOCUS.state === 'run' ? `${fmtT(FOCUS.left)} · My Day` : 'My Day';
}
function focusTick() {
  if (FOCUS.state !== 'run') return;
  FOCUS.left = Math.max(0, Math.ceil((FOCUS.endAt - Date.now()) / 1000)); focusPaint();
  if (FOCUS.left <= 0) focusDone();
}
function focusToggle() {
  if (FOCUS.state === 'run') { FOCUS.state = 'pause'; clearInterval(FOCUS.iv); }
  else { FOCUS.state = 'run'; FOCUS.endAt = Date.now() + FOCUS.left * 1000; clearInterval(FOCUS.iv); FOCUS.iv = setInterval(focusTick, 500); beepPrime(); }
  focusPaint();
}
function focusReset() { clearInterval(FOCUS.iv); FOCUS.state = 'idle'; FOCUS.left = FOCUS.total; focusPaint(); }
async function focusDone() {
  clearInterval(FOCUS.iv); const min = Math.round(FOCUS.total / 60);
  FOCUS.state = 'idle'; FOCUS.left = FOCUS.total; focusPaint(); beep(); confetti(innerWidth / 2, innerHeight / 3, 80);
  toast(L(`${min}분 집중 완료! 🎯`, `${min}分の集中を完了！🎯`));
  try { await api('/focus', { method: 'POST', body: { minutes: min, label: FOCUS.label, date: todayStr() } }); refreshFocusSum(); } catch (err) { toast(err.message, 'err'); }
}
async function refreshFocusSum() {
  const el = $('#fsum'); if (!el) return;
  try { const f = await api('/focus/summary?date=' + todayStr()); el.textContent = L(`오늘 ${f.today}분 · 이번 주 ${f.week}분`, `今日 ${f.today}分・今週 ${f.week}分`); } catch (e) { /* ignore */ }
}

/* ============ VIEWS ============ */
const VIEWS = { today: viewToday, tasks: viewTasks, habits: viewHabits, journal: viewJournal, insights: viewInsights, settings: viewSettings };
const habitRows = (hs, d) => hs.map(h => `<button class="hrow ${h.done ? 'done' : ''}" data-h="${h.id}"><span class="he">${esc(h.emoji)}</span><span class="hn">${esc(h.name)}</span>${h.streak > 1 ? `<span class="fire">🔥${h.streak}</span>` : ''}<span class="chk"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>`).join('');

async function viewToday() {
  const d = todayStr(), now = new Date(), h = now.getHours();
  const [tasks, ins, en, habits0, stats, fs] = await Promise.all([
    api('/tasks?date=' + d), api(`/insights?date=${d}&hour=${h}&lang=${LANG}`), api('/entries/' + d),
    api('/habits?date=' + d), api('/stats/' + d), api('/focus/summary?date=' + d)]);
  S.tasks = tasks; S.tdate = d;
  let habits = habits0;
  const e = en.entry || {}, cur = { mood: e.mood || 0, energy: e.energy || 0 };
  const vit = { sleep: stats.sleep, water: stats.water, exercise: stats.exercise };
  const p = (h * 60 + now.getMinutes()) / 1440, pct = Math.round(p * 100);
  const line = ins.today.total ? L(` 오늘 할 일 ${ins.today.done}/${ins.today.total} 완료.`, ` 今日のタスク ${ins.today.done}/${ins.today.total} 完了。`) : '';
  const pend = tasks.filter(t => !t.done);
  const html = `
  <header class="hero"><div class="rise"><p class="eyebrow">${fmtDate(d)}</p>
    <h1 style="margin-top:12px">${greet(h)},<br><em>${esc(S.user.nickname)}</em>${L('님', 'さん')}</h1>
    <p class="sub">${ins.streak > 0 ? L(`🔥 ${ins.streak}일 연속으로 하루를 챙기고 있어요.`, `🔥 ${ins.streak}日連続で一日を大切にしています。`) : L('오늘의 첫 기록을 남겨 볼까요?', '今日の最初の記録を残しましょう。')}${line}</p></div>
    <div class="arc glass rise" style="--i:2"><svg viewBox="0 0 200 110"><path class="bg" d="M10 100 A90 90 0 0 1 190 100"/><path class="fg" pathLength="1" d="M10 100 A90 90 0 0 1 190 100"/><circle class="dot" cx="10" cy="100" r="7"/></svg>
    <p>${L('하루의', '一日の')} <b data-to="${pct}" data-suf="%">0%</b>${L('가 지났어요', 'が過ぎました')}</p></div></header>
  <section class="grid">
    <article class="glass center rise s4" style="--i:1"><h2>${L('오늘의 진행률', '今日の進捗')}</h2>
      <div class="ring"><svg viewBox="0 0 120 120"><circle class="rbg" cx="60" cy="60" r="52"/><circle class="rfg" cx="60" cy="60" r="52" pathLength="100"/></svg>
      <div class="mid"><b id="rcount">0/0</b><span id="rpct">0%</span></div></div><p class="muted" id="rmsg"></p></article>
    <article class="glass rise s4" style="--i:2"><h2>${L('지금 기분은 어때요?', '今の気分は？')}</h2>
      <div class="moods">${MOODS.map((m, i) => `<button class="mood ${cur.mood === i + 1 ? 'on' : ''}" data-m="${i + 1}" title="${moodTxt(i)}">${m}</button>`).join('')}</div>
      <div class="lbl"><span>${L('에너지', 'エネルギー')}</span><span id="elab"></span></div>
      <div class="pips">${[1, 2, 3, 4, 5].map(i => `<button class="pip ${cur.energy >= i ? 'on' : ''}" data-e="${i}" aria-label="${i}"></button>`).join('')}</div>
      <p class="muted" id="mmsg" style="margin-top:14px">${cur.mood ? L(`오늘은 “${moodTxt(cur.mood - 1)}” 로 기록돼 있어요.`, `今日は「${moodTxt(cur.mood - 1)}」と記録されています。`) : L('기분을 고르면 오늘의 기록에 저장돼요.', '気分を選ぶと今日の記録に保存されます。')}</p></article>
    <article class="glass rise s4" style="--i:3"><h2>${L('지금 추천해요', 'いまのおすすめ')}</h2><ul class="recs">${ins.recs.map((r, i) => `<li style="--i:${i}"><span class="ic">${r.icon}</span><div><b>${esc(r.title)}</b><p>${esc(r.desc)}</p></div></li>`).join('')}</ul></article>
    <article class="glass rise s4" style="--i:4" id="vitals"><h2>${L('오늘의 몸 상태', '今日のコンディション')}</h2><div class="vit">
      <div class="vrow"><span class="vi">😴</span><div class="vl"><small>${L('수면', '睡眠')}</small><b id="vsleep"></b></div><div class="step"><button data-v="sleep" data-d="-0.5" aria-label="-">−</button><button data-v="sleep" data-d="0.5" aria-label="+">+</button></div></div>
      <div><div class="vrow"><span class="vi">💧</span><div class="vl"><small>${L('물', '水')}</small><b id="vwater"></b></div><div class="step"><button data-v="water" data-d="-1" aria-label="-">−</button><button data-v="water" data-d="1" aria-label="+">+</button></div></div>
        <div class="cups" id="cups">${Array.from({ length: 8 }, (_, i) => `<i class="cup" data-c="${i + 1}"></i>`).join('')}</div></div>
      <div class="vrow"><span class="vi">🏃</span><div class="vl"><small>${L('운동', '運動')}</small><b id="vex"></b></div><div class="step"><button data-v="exercise" data-d="-10" aria-label="-">−</button><button data-v="exercise" data-d="10" aria-label="+">+</button></div></div></div></article>
    <article class="glass rise s4" style="--i:5"><div class="spread" style="margin-bottom:10px"><h2 style="margin:0">${L('오늘의 습관', '今日の習慣')}</h2><a class="link" href="#/habits">${L('관리', '管理')} →</a></div><div id="hm"></div></article>
    <article class="glass center focus rise s4" style="--i:6"><h2 id="fsub">${L('집중 타이머', '集中タイマー')}</h2>
      <div class="ring sm"><svg viewBox="0 0 120 120"><circle class="rbg" cx="60" cy="60" r="52"/><circle class="rfg lin" id="fring" cx="60" cy="60" r="52" pathLength="100"/></svg><div class="mid"><b id="ftime">25:00</b></div></div>
      <div class="seg" id="fpre">${[15, 25, 50].map(m => `<button data-m="${m}">${m}${L('분', '分')}</button>`).join('')}</div>
      <select class="in" id="flabel"><option value="">${L('자유 집중', '自由集中')}</option>${pend.map(t => `<option value="${esc(t.title)}" ${FOCUS.label === t.title ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
      <div class="row" style="justify-content:center"><button class="btn" id="fgo">${L('시작', '開始')}</button><button class="btn ghost" id="frs">${L('리셋', 'リセット')}</button></div>
      <p class="muted" id="fsum" style="margin-top:12px">${L(`오늘 ${fs.today}분 · 이번 주 ${fs.week}분`, `今日 ${fs.today}分・今週 ${fs.week}分`)}</p></article>
    <article class="glass rise s7" style="--i:7"><div class="spread" style="margin-bottom:14px"><h2 style="margin:0">${L('오늘의 체크리스트', '今日のタスク')}</h2><a class="link" href="#/tasks">${L('전체 보기', 'すべて見る')} →</a></div>
      <form class="addrow" id="qadd"><input class="in" id="qin" maxlength="200" placeholder="${L('할 일을 입력하고 Enter', 'タスクを入力してEnter')}"><button class="btn">${L('추가', '追加')}</button></form>
      <ul class="list" id="qlist" data-empty="${L('아직 할 일이 없어요. 하나 추가해 볼까요?', 'まだタスクがありません。追加してみましょう。')}">${tasks.slice(0, 8).map((t, i) => taskRow(t, i)).join('')}</ul></article>
    <article class="glass qcard rise s5" style="--i:8"><p class="eyebrow">${L('오늘의 질문', '今日の質問')}</p><blockquote>${esc(ins.question)}</blockquote><a class="btn" href="#/journal">${L('기록하러 가기', '記録しに行く')} →</a></article>
  </section>`;
  const after = v => {
    const upd = () => {
      const { t, d: dn, pct: pc } = stat();
      $('#rcount').textContent = `${dn}/${t}`; $('#rpct').textContent = pc + '%';
      $('.rfg', v).style.strokeDashoffset = 100 - pc;
      $('#rmsg').textContent = !t ? L('첫 할 일을 추가해 보세요', '最初のタスクを追加しましょう') : pc === 100 ? L('모두 끝냈어요! 🎉', 'すべて終わりました！🎉') : L(`${t - dn}개 남았어요`, `残り${t - dn}件`);
    };
    S.onTasks = upd; requestAnimationFrame(() => setTimeout(upd, 100));
    requestAnimationFrame(() => { $('.arc .fg').style.strokeDashoffset = 1 - p; });
    const dot = $('.arc .dot'), t0 = performance.now();
    (function step(t) {
      const k = Math.min((t - t0) / 1200, 1), ea = 1 - Math.pow(1 - k, 3), a = Math.PI * (1 - p * ea);
      dot.setAttribute('cx', 100 + 90 * Math.cos(a)); dot.setAttribute('cy', 100 - 90 * Math.sin(a));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
    // mood / energy
    const paintE = () => { $$('.pip', v).forEach(x => x.classList.toggle('on', +x.dataset.e <= cur.energy)); $('#elab').textContent = cur.energy ? `${cur.energy}/5` : ''; };
    paintE();
    const saveMood = async () => {
      if (!cur.mood) cur.mood = 3; if (!cur.energy) cur.energy = 3;
      $$('.mood', v).forEach(x => x.classList.toggle('on', +x.dataset.m === cur.mood)); paintE();
      try {
        await api('/entries/' + d, { method: 'PUT', body: { mood: cur.mood, energy: cur.energy, content: e.content || '', highlight: e.highlight || '', gratitude: e.gratitude || '' } });
        $('#mmsg').textContent = L(`“${moodTxt(cur.mood - 1)}” 로 기록했어요 ✨`, `「${moodTxt(cur.mood - 1)}」と記録しました ✨`);
      } catch (err) { toast(err.message, 'err'); }
    };
    $('.moods', v).addEventListener('click', ev => { const b = ev.target.closest('.mood'); if (b) { cur.mood = +b.dataset.m; saveMood(); } });
    $('.pips', v).addEventListener('click', ev => { const b = ev.target.closest('.pip'); if (b) { cur.energy = +b.dataset.e; saveMood(); } });
    // vitals
    const paintV = () => {
      $('#vsleep').textContent = vit.sleep + L('시간', '時間'); $('#vwater').textContent = vit.water + L('잔', '杯'); $('#vex').textContent = vit.exercise + L('분', '分');
      $$('.cup', v).forEach(c => c.classList.toggle('on', +c.dataset.c <= vit.water));
    };
    paintV();
    const saveV = debounce(() => api('/stats/' + d, { method: 'PUT', body: vit }).catch(err => toast(err.message, 'err')), 450);
    const lim = { sleep: [0, 24], water: [0, 30], exercise: [0, 600] };
    $('#vitals').addEventListener('click', ev => {
      const b = ev.target.closest('[data-v]');
      if (b) { const k = b.dataset.v; vit[k] = Math.min(lim[k][1], Math.max(lim[k][0], Math.round((vit[k] + +b.dataset.d) * 10) / 10)); paintV(); saveV(); return; }
      const c = ev.target.closest('.cup');
      if (c) { const n = +c.dataset.c; vit.water = vit.water === n ? n - 1 : n; paintV(); saveV(); }
    });
    // habits
    const paintH = () => {
      $('#hm').innerHTML = habits.length ? habitRows(habits, d) : `<p class="muted">${L('아직 습관이 없어요.', 'まだ習慣がありません。')} <a class="link" href="#/habits">${L('만들어 보기', '作ってみる')}</a></p>`;
    };
    paintH();
    $('#hm').addEventListener('click', async ev => {
      const b = ev.target.closest('[data-h]'); if (!b) return;
      b.classList.toggle('done');
      try { await api(`/habits/${b.dataset.h}/toggle`, { method: 'POST', body: { date: d } }); habits = await api('/habits?date=' + d); paintH(); if (habits.every(x => x.done)) { confetti(innerWidth / 2, innerHeight / 3, 60); toast(L('오늘의 습관을 모두 지켰어요! 🔥', '今日の習慣をすべて達成！🔥')); } }
      catch (err) { b.classList.toggle('done'); toast(err.message, 'err'); }
    });
    // focus
    focusPaint();
    segBind($('#fpre'), b => { if (FOCUS.state !== 'idle') { toast(L('타이머를 리셋한 뒤에 바꿀 수 있어요', 'タイマーをリセットしてから変更できます'), 'info'); focusPaint(); return; } FOCUS.total = FOCUS.left = +b.dataset.m * 60; focusPaint(); });
    $('#flabel').addEventListener('change', ev => { FOCUS.label = ev.target.value; });
    $('#fgo').addEventListener('click', focusToggle);
    $('#frs').addEventListener('click', focusReset);
    // quick add
    $('#qadd').addEventListener('submit', async ev => {
      ev.preventDefault(); const inp = $('#qin'), val = inp.value.trim(); if (!val) return;
      try { const t = await addTask(val, d, 2); $('#qlist').insertAdjacentHTML('beforeend', taskRow(t, 0)); inp.value = ''; upd(); }
      catch (err) { toast(err.message, 'err'); }
    });
  };
  return { html, after };
}

async function viewTasks() {
  S.tdate = todayStr(); S.tasks = await api('/tasks?date=' + S.tdate);
  const html = `<header class="vhead rise"><div><p class="eyebrow">Checklist</p><h1 style="margin-top:10px">${L('해야 할 <em>일</em>', 'やる<em>こと</em>')}</h1></div>${dateNav()}</header>
  <section class="glass rise" style="--i:1">
    <div class="spread" style="margin-bottom:12px"><span class="muted" id="tcount"></span><b id="tpct" style="font:500 22px var(--serif)">0%</b></div>
    <div class="bar" style="margin-bottom:22px"><i id="tbar"></i></div>
    <form class="addrow" id="tadd"><input class="in" id="tin" maxlength="200" placeholder="${L('할 일을 입력하고 Enter', 'タスクを入力してEnter')}">
      <div class="seg" id="tpri"><button type="button" data-p="1">${L('높음', '高')}</button><button type="button" data-p="2" class="on">${L('보통', '中')}</button><button type="button" data-p="3">${L('낮음', '低')}</button></div>
      <button class="btn">${L('추가', '追加')}</button></form>
    <div class="spread" style="margin-bottom:14px"><div class="seg" id="tflt"><button data-f="all" class="on">${L('전체', 'すべて')}</button><button data-f="active">${L('진행 중', '未完了')}</button><button data-f="done">${L('완료', '完了')}</button></div>
      <div class="row"><button class="btn ghost sm" id="tclear">${L('완료 항목 정리', '完了を削除')}</button><button class="btn ghost sm" id="tcarry">${L('미완료 → 다음 날로', '未完了→翌日へ')}</button></div></div>
    <ul class="list" id="tlist" data-f="all" data-empty="${L('아직 할 일이 없어요. 하나 추가해 볼까요?', 'まだタスクがありません。追加してみましょう。')}"></ul>
    <p class="edit-hint" style="margin-top:14px">${L('✎ 버튼이나 더블클릭으로 수정 · N 키로 입력창 이동', '✎ボタンまたはダブルクリックで編集 ・ Nキーで入力欄へ')}</p></section>`;
  const after = v => {
    let pri = 2;
    const upd = () => {
      const { t, d, pct } = stat();
      $('#tcount').textContent = t ? L(`${t}개 중 ${d}개 완료`, `${t}件中${d}件完了`) : L('할 일이 없는 날이에요', 'タスクのない日です');
      $('#tpct').textContent = pct + '%'; $('#tbar').style.width = pct + '%';
    };
    const paint = () => { $('#tlist').innerHTML = S.tasks.map((t, i) => taskRow(t, i)).join(''); $('#dlab').textContent = dateLabel(S.tdate); upd(); };
    S.onTasks = upd; paint();
    const load = async nd => { const dir = nd > S.tdate ? 1 : -1; await swapList(async () => { S.tdate = nd; S.tasks = await api('/tasks?date=' + nd); paint(); }, dir); };
    $$('[data-n]', v).forEach(b => b.addEventListener('click', () => load(+b.dataset.n === 0 ? todayStr() : addDays(S.tdate, +b.dataset.n)).catch(err => toast(err.message, 'err'))));
    segBind($('#tpri'), b => { pri = +b.dataset.p; });
    segBind($('#tflt'), b => { $('#tlist').dataset.f = b.dataset.f; });
    $('#tadd').addEventListener('submit', async ev => {
      ev.preventDefault(); const inp = $('#tin'), val = inp.value.trim(); if (!val) return;
      try { const t = await addTask(val, S.tdate, pri); $('#tlist').insertAdjacentHTML('beforeend', taskRow(t, 0)); inp.value = ''; upd(); }
      catch (err) { toast(err.message, 'err'); }
    });
    $('#tclear').addEventListener('click', async () => {
      try { const r = await api('/tasks/completed?date=' + S.tdate, { method: 'DELETE' }); toast(r.deleted ? L(`완료한 ${r.deleted}개를 정리했어요`, `完了した${r.deleted}件を削除しました`) : L('정리할 완료 항목이 없어요', '削除する完了タスクがありません'), r.deleted ? 'ok' : 'info'); if (r.deleted) await load(S.tdate); }
      catch (err) { toast(err.message, 'err'); }
    });
    $('#tcarry').addEventListener('click', async () => {
      const to = addDays(S.tdate, 1);
      try {
        const r = await api('/tasks/carry', { method: 'POST', body: { from: S.tdate, to } });
        toast(r.moved ? L(`${r.moved}개를 ${fmtDate(to)}로 넘겼어요`, `${r.moved}件を${fmtDate(to)}へ移しました`) : L('넘길 미완료 항목이 없어요', '移す未完了タスクがありません'), r.moved ? 'ok' : 'info');
        if (r.moved) await load(S.tdate);
      } catch (err) { toast(err.message, 'err'); }
    });
  };
  return { html, after };
}

async function viewHabits() {
  const d = todayStr(); let habits = await api('/habits?date=' + d), emoji = '✅';
  const EM = ['✅', '💧', '🏃', '📚', '🧘', '💊', '🌙', '☀️', '✍️', '🎧', '🍎', '🦷'];
  const html = `<header class="vhead rise"><div><p class="eyebrow">Habits</p><h1 style="margin-top:10px">${L('작은 <em>습관</em>', '小さな<em>習慣</em>')}</h1></div></header>
  <section class="tiles t3">
    <div class="glass tile rise" style="--i:1"><small>${L('오늘 달성', '今日の達成')}</small><b id="ht1">0</b></div>
    <div class="glass tile rise" style="--i:2"><small>${L('최고 연속', '最長連続')}</small><b id="ht2">0</b></div>
    <div class="glass tile rise" style="--i:3"><small>${L('최근 7일 달성률', '直近7日の達成率')}</small><b id="ht3">0</b></div></section>
  <section class="glass rise" style="--i:4;margin-bottom:16px"><h2>${L('새 습관 만들기', '新しい習慣を作る')}</h2>
    <div class="emojis" id="hem" style="margin-bottom:12px">${EM.map(x => `<button type="button" data-e="${x}" class="${x === emoji ? 'on' : ''}">${x}</button>`).join('')}</div>
    <form class="addrow" id="hadd" style="margin:0"><input class="in" id="hin" maxlength="100" placeholder="${L('예) 물 8잔 마시기', '例）水を8杯飲む')}"><button class="btn">${L('추가', '追加')}</button></form></section>
  <div id="hlist" style="display:flex;flex-direction:column;gap:12px"></div>`;
  const after = v => {
    const card = (h, i, anim) => `<div class="glass hcard ${anim ? 'rise' : ''}" style="--i:${i}"><span class="he">${esc(h.emoji)}</span>
      <div class="hm"><b>${esc(h.name)}</b><span class="muted">${h.streak > 0 ? `🔥 ${L(h.streak + '일 연속', h.streak + '日連続')} · ` : ''}${L('누적', '累計')} ${h.total}${L('일', '日')}</span></div>
      <div class="hdots">${h.days.map(x => `<div class="hday"><button class="hd ${x.done ? 'on' : ''}" data-h="${h.id}" data-date="${x.date}" aria-label="${x.date}"></button><span>${wdOf(x.date)}</span></div>`).join('')}</div>
      <button class="x" style="opacity:.6" data-hdel="${h.id}" aria-label="${L('삭제', '削除')}">×</button></div>`;
    const paint = anim => {
      $('#hlist').innerHTML = habits.length ? habits.map((h, i) => card(h, i, anim)).join('') : `<p class="muted center" style="padding:24px">${L('아직 습관이 없어요. 위에서 하나 만들어 보세요 ✨', 'まだ習慣がありません。上から作ってみましょう ✨')}</p>`;
      const done = habits.filter(h => h.done).length, best = Math.max(0, ...habits.map(h => h.streak));
      const tot = habits.length * 7, got = habits.reduce((s, h) => s + h.days.filter(x => x.done).length, 0);
      $('#ht1').innerHTML = `${done}<u>/${habits.length}</u>`; $('#ht2').innerHTML = `${best}<u>${L('일', '日')}</u>`; $('#ht3').innerHTML = `${tot ? Math.round(got / tot * 100) : 0}<u>%</u>`;
    };
    paint(true);
    const reload = async () => { habits = await api('/habits?date=' + d); paint(false); };
    segBind($('#hem'), b => { emoji = b.dataset.e; });
    $('#hadd').addEventListener('submit', async ev => {
      ev.preventDefault(); const inp = $('#hin'), val = inp.value.trim(); if (!val) return;
      try { await api('/habits', { method: 'POST', body: { name: val, emoji } }); inp.value = ''; await reload(); toast(L('새 습관을 만들었어요 🔁', '新しい習慣を作りました 🔁')); }
      catch (err) { toast(err.message, 'err'); }
    });
    $('#hlist').addEventListener('click', async ev => {
      const dotb = ev.target.closest('.hd'), del = ev.target.closest('[data-hdel]');
      try {
        if (dotb) { dotb.classList.toggle('on'); await api(`/habits/${dotb.dataset.h}/toggle`, { method: 'POST', body: { date: dotb.dataset.date } }); await reload(); }
        else if (del && confirm(L('이 습관과 기록을 삭제할까요?', 'この習慣と記録を削除しますか？'))) { await api('/habits/' + del.dataset.hdel, { method: 'DELETE' }); await reload(); }
      } catch (err) { toast(err.message, 'err'); }
    });
  };
  return { html, after };
}

async function viewJournal() {
  S.jdate = todayStr(); S.calYm = S.jdate.slice(0, 7); S.cal = {};
  const [en, list, ins] = await Promise.all([api('/entries/' + S.jdate), api('/entries?limit=14'), api(`/insights?date=${S.jdate}&hour=12&lang=${LANG}`)]);
  let entry = en.entry, recent = list, st = { mood: 0, energy: 0 }, tab = 'tl';
  const html = `<header class="vhead rise"><div><p class="eyebrow">Journal</p><h1 style="margin-top:10px">${L('오늘을 <em>기록</em>해요', '今日を<em>記録</em>しよう')}</h1></div>${dateNav()}</header>
  <section class="grid"><div class="glass s7 rise" style="--i:1" id="jed"></div>
  <div class="glass s5 rise" style="--i:2"><div style="margin-bottom:14px"><div class="seg" id="jtabs"><button data-t="tl" class="on">${L('타임라인', 'タイムライン')}</button><button data-t="cal">${L('달력', 'カレンダー')}</button><button data-t="q">${L('검색', '検索')}</button></div></div><div id="jpanel"></div></div></section>`;
  const after = v => {
    const item = r => `<button class="tli ${r.date === S.jdate ? 'on' : ''}" data-d="${r.date}"><span class="e">${MOODS[r.mood - 1]}</span><div><b>${fmtDate(r.date)}</b><p>${esc(r.highlight || r.snippet || L('기록 없음', '記録なし'))}</p></div></button>`;
    const getCal = async ym => (S.cal[ym] = S.cal[ym] || await api('/calendar?month=' + ym));
    const paintPanel = async () => {
      const el = $('#jpanel');
      if (tab === 'tl') { el.innerHTML = `<div class="tl">${recent.length ? recent.map(item).join('') : `<p class="muted">${L('아직 기록이 없어요. 오늘 첫 기록을 남겨 보세요 ✨', 'まだ記録がありません。今日の最初の記録を残しましょう ✨')}</p>`}</div>`; }
      else if (tab === 'cal') {
        const [y, m] = S.calYm.split('-').map(Number), days = await getCal(S.calYm), map = {};
        days.forEach(x => { map[x.date] = x; });
        const first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate();
        let cells = dow().map(w => `<div class="cw">${w}</div>`).join('') + '<div class="cd blank"></div>'.repeat(first);
        for (let n = 1; n <= last; n++) {
          const ds = `${y}-${pad(m)}-${pad(n)}`, x = map[ds] || {};
          cells += `<button class="cd ${ds === todayStr() ? 'today' : ''} ${ds === S.jdate ? 'sel' : ''}" data-d="${ds}" style="--mt:${x.mood ? x.mood / 5 : 0}"><span>${n}</span>${x.mood ? `<span class="em">${MOODS[x.mood - 1]}</span>` : ''}${x.total ? `<i><b style="width:${x.done / x.total * 100}%"></b></i>` : ''}</button>`;
        }
        el.innerHTML = `<div class="spread" style="margin-bottom:12px"><button class="iconbtn" data-cm="-1" aria-label="prev">‹</button><b>${L(`${y}년 ${m}월`, `${y}年${m}月`)}</b><button class="iconbtn" data-cm="1" aria-label="next">›</button></div><div class="cal">${cells}</div>`;
      } else {
        el.innerHTML = `<input class="in" id="jq" placeholder="${L('일기, 하이라이트, 감사한 일 검색', '日記・ハイライト・感謝を検索')}" style="margin-bottom:12px"><div class="tl" id="jres"><p class="muted">${L('검색어를 입력해 보세요.', 'キーワードを入力してください。')}</p></div>`;
        $('#jq').addEventListener('input', debounce(async ev => {
          const q = ev.target.value.trim(); const box = $('#jres'); if (!box) return;
          if (!q) { box.innerHTML = `<p class="muted">${L('검색어를 입력해 보세요.', 'キーワードを入力してください。')}</p>`; return; }
          try { const r = await api('/entries/search?q=' + encodeURIComponent(q)); box.innerHTML = r.length ? r.map(item).join('') : `<p class="muted">${L('검색 결과가 없어요.', '見つかりませんでした。')}</p>`; } catch (err) { toast(err.message, 'err'); }
        }, 350));
      }
    };
    const paintEd = () => {
      st = { mood: entry ? entry.mood : 0, energy: entry ? entry.energy : 0 };
      const el = $('#jed');
      el.innerHTML = `<div class="spread"><h2 style="margin:0">${fmtDate(S.jdate)}</h2><span class="muted" id="jstat">${entry ? L('저장된 기록', '保存済み') : L('새 기록', '新規')}</span></div>
      <div class="field" style="margin-top:20px"><label>${L('오늘의 기분', '今日の気分')}</label><div class="bigmoods">${MOODS.map((m, i) => `<button class="mood ${st.mood === i + 1 ? 'on' : ''}" data-m="${i + 1}" title="${moodTxt(i)}">${m}</button>`).join('')}</div><p class="muted" id="jml">${st.mood ? moodTxt(st.mood - 1) : ''}</p></div>
      <div class="field"><label>${L('에너지', 'エネルギー')}</label><div class="pips" id="jpips">${[1, 2, 3, 4, 5].map(i => `<button class="pip ${st.energy >= i ? 'on' : ''}" data-e="${i}" aria-label="${i}"></button>`).join('')}</div></div>
      <div class="field"><label>${L('오늘의 하이라이트', '今日のハイライト')}</label><input class="in" id="jh" maxlength="200" placeholder="${L('오늘 가장 좋았던 순간', '今日いちばん良かった瞬間')}" value="${esc(entry && entry.highlight)}"></div>
      <div class="field"><label>${L('감사한 일', '感謝したこと')}</label><input class="in" id="jg" maxlength="200" placeholder="${L('고마웠던 사람이나 일', 'ありがたかった人やできごと')}" value="${esc(entry && entry.gratitude)}"></div>
      <div class="field"><label>${L('자유롭게 기록하기', '自由に書く')} <span id="jcnt" class="muted"></span></label><textarea class="in" id="jt" maxlength="5000" placeholder="${esc(ins.question)}">${esc(entry && entry.content)}</textarea></div>
      <div class="row"><button class="btn" id="jsave">${L('저장하기', '保存')}</button>${entry ? `<button class="btn danger sm" id="jdel">${L('삭제', '削除')}</button>` : ''}<span class="muted">⌘/Ctrl + S</span></div>`;
      const cnt = () => { $('#jcnt').textContent = `${$('#jt').value.length}/5000`; }; cnt(); $('#jt').addEventListener('input', cnt);
      $('.bigmoods', el).addEventListener('click', ev => { const b = ev.target.closest('.mood'); if (!b) return; st.mood = +b.dataset.m; $$('.mood', el).forEach(x => x.classList.toggle('on', x === b)); $('#jml').textContent = moodTxt(st.mood - 1); });
      $('#jpips').addEventListener('click', ev => { const b = ev.target.closest('.pip'); if (!b) return; st.energy = +b.dataset.e; $$('.pip', el).forEach(x => x.classList.toggle('on', +x.dataset.e <= st.energy)); });
      $('#jsave').addEventListener('click', save);
      const del = $('#jdel');
      if (del) del.addEventListener('click', async () => {
        if (!confirm(L('이 날의 기록을 삭제할까요?', 'この日の記録を削除しますか？'))) return;
        try { await api('/entries/' + S.jdate, { method: 'DELETE' }); entry = null; S.cal = {}; recent = await api('/entries?limit=14'); paintEd(); paintPanel(); toast(L('기록을 삭제했어요', '記録を削除しました')); } catch (err) { toast(err.message, 'err'); }
      });
    };
    const save = async () => {
      if (!st.mood) { toast(L('먼저 오늘의 기분을 골라 주세요', 'まず今日の気分を選んでください'), 'info'); return; }
      if (!st.energy) st.energy = 3;
      try {
        await busy($('#jsave'), () => api('/entries/' + S.jdate, { method: 'PUT', body: { mood: st.mood, energy: st.energy, content: $('#jt').value, highlight: $('#jh').value, gratitude: $('#jg').value } }));
        entry = (await api('/entries/' + S.jdate)).entry; recent = await api('/entries?limit=14'); S.cal = {};
        if (tab !== 'q') paintPanel();
        $('#jstat').textContent = L('방금 저장됨', '保存しました'); toast(L('기록을 저장했어요 ✨', '記録を保存しました ✨'));
      } catch (err) { toast(err.message, 'err'); }
    };
    const loadDate = async dt => {
      S.jdate = dt; S.calYm = dt.slice(0, 7); entry = (await api('/entries/' + dt)).entry; $('#dlab').textContent = dateLabel(dt); paintEd();
      if (tab !== 'q') paintPanel();
    };
    $('#dlab').textContent = dateLabel(S.jdate); paintEd(); paintPanel();
    $$('[data-n]', v).forEach(b => b.addEventListener('click', () => loadDate(+b.dataset.n === 0 ? todayStr() : addDays(S.jdate, +b.dataset.n)).catch(err => toast(err.message, 'err'))));
    segBind($('#jtabs'), b => { tab = b.dataset.t; paintPanel().catch(err => toast(err.message, 'err')); });
    $('#jpanel').addEventListener('click', ev => {
      const cm = ev.target.closest('[data-cm]');
      if (cm) { const [y, m] = S.calYm.split('-').map(Number), dt = new Date(y, m - 1 + +cm.dataset.cm, 1); S.calYm = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`; paintPanel().catch(err => toast(err.message, 'err')); return; }
      const b = ev.target.closest('[data-d]'); if (b) loadDate(b.dataset.d).catch(err => toast(err.message, 'err'));
    });
    S.onKey = ev => { if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's' && S.view === 'journal') { ev.preventDefault(); save(); } };
  };
  return { html, after };
}

function lineSvg(days) {
  const W = 560, H = 210, Lm = 34, R = 14, T = 14, B = 30;
  const x = i => Lm + i * (W - Lm - R) / (days.length - 1), y = v => T + (5 - v) * (H - T - B) / 4;
  let g = '';
  for (let v = 1; v <= 5; v++) g += `<line class="gl" x1="${Lm}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${Lm - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  g += days.map((d, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" ${i === days.length - 1 ? 'style="fill:var(--accent)"' : ''}>${d.label}</text>`).join('');
  const series = (key, color, delay) => {
    let path = '', pen = false, dots = '';
    days.forEach((d, i) => {
      if (d[key] == null) { pen = false; return; }
      path += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)} `; pen = true;
      dots += `<circle class="dotp" style="animation-delay:${delay + i * .1}s" cx="${x(i).toFixed(1)}" cy="${y(d[key]).toFixed(1)}" r="4.5" fill="${color}"/>`;
    });
    return `<path class="draw" pathLength="1" d="${path}" style="stroke:${color};animation-delay:${delay}s"/>${dots}`;
  };
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${g}${series('energy', '#8ec5ff', .4)}${series('mood', 'var(--accent)', .2)}</svg>`;
}

async function viewInsights() {
  const d = todayStr(), ins = await api(`/insights?date=${d}&hour=${new Date().getHours()}&lang=${LANG}`);
  const empty = ins.days.every(x => x.mood == null), max = Math.max(1, ...ins.days.map(x => x.total));
  const tile = (i, label, val, unit, dec) => `<div class="glass tile rise" style="--i:${i}"><small>${label}</small><b><span data-to="${val}" ${dec ? 'data-dec="1"' : ''}>0</span><u>${unit}</u></b></div>`;
  const wmax = Math.max(...ins.weekday), names = dowMon();
  const BADGES = [
    ['🌱', L('첫 기록', 'はじめの記録'), ins.entryCount, 1], ['📖', L('기록 10개', '記録10件'), ins.entryCount, 10], ['🏆', L('기록 30개', '記録30件'), ins.entryCount, 30],
    ['🔥', L('3일 연속', '3日連続'), ins.streak, 3], ['⚡', L('7일 연속', '7日連続'), ins.streak, 7], ['👑', L('30일 연속', '30日連続'), ins.streak, 30],
    ['✅', L('할 일 10개', 'タスク10件'), ins.doneAll, 10], ['💪', L('할 일 100개', 'タスク100件'), ins.doneAll, 100],
    ['⏱️', L('집중 60분', '集中60分'), ins.focusAll, 60], ['🧠', L('집중 300분', '集中300分'), ins.focusAll, 300], ['🌈', L('습관 3개', '習慣3つ'), ins.habitsTotal, 3]];
  const html = `<header class="vhead rise"><div><p class="eyebrow">Weekly insight</p><h1 style="margin-top:10px">${L('나의 <em>한 주</em>', '私の<em>一週間</em>')}</h1></div></header>
  <section class="glass rise" style="--i:1;margin-bottom:16px"><p class="eyebrow" style="margin-bottom:14px">${L('이번 주 요약', '今週のまとめ')}</p><p class="typed" id="sum"></p></section>
  <section class="tiles">${tile(2, L('연속 기록', '連続記録'), ins.streak, L('일', '日'))}${tile(3, L('평균 기분', '平均気分'), ins.avgMood, '/5', 1)}${tile(4, L('주간 완료율', '週の完了率'), ins.rate, '%')}${tile(5, L('누적 기록', '累計記録'), ins.entryCount, L('개', '件'))}</section>
  <section class="tiles">${tile(6, L('이번 주 집중', '今週の集中'), ins.focusWeek, L('분', '分'))}${tile(7, L('오늘 습관', '今日の習慣'), ins.habitsDone, `/${ins.habitsTotal}`)}${tile(8, L('완료한 할 일', '完了タスク'), ins.doneAll, L('개', '件'))}${tile(9, L('집중 누적', '集中の累計'), ins.focusAll, L('분', '分'))}</section>
  <section class="grid">
    <article class="glass chart rise s7" style="--i:10"><h2>${L('기분 · 에너지 흐름', '気分・エネルギーの推移')}</h2>
      <div class="legend"><span><i style="background:var(--accent)"></i>${L('기분', '気分')}</span><span><i style="background:#8ec5ff"></i>${L('에너지', 'エネルギー')}</span></div>
      ${empty ? `<p class="muted" style="padding:30px 0;text-align:center">${L('기분을 기록하면 이곳에 흐름이 그려져요 ✨', '気分を記録するとここに推移が描かれます ✨')}</p>` : lineSvg(ins.days)}</article>
    <article class="glass rise s5" style="--i:11"><h2>${L('할 일 완료', 'タスク完了')}</h2><div class="bars">${ins.days.map(x => `<div class="bc"><div class="col" data-h="${x.total ? Math.max(14, x.total / max * 100) : 4}"><i style="height:${x.total ? x.done / x.total * 100 : 0}%"></i></div><span>${x.label}</span></div>`).join('')}</div>
      <p class="muted" style="margin-top:14px">${ins.best ? L(`가장 기분 좋았던 날 · ${ins.best.label}요일 ${MOODS[ins.best.mood - 1]}`, `いちばん気分が良かった日・${ins.best.label}曜日 ${MOODS[ins.best.mood - 1]}`) : L('아직 비교할 기록이 없어요', 'まだ比較できる記録がありません')}</p></article>
    <article class="glass rise s5" style="--i:12"><h2>${L('요일별 평균 기분 (최근 90일)', '曜日別の平均気分（直近90日）')}</h2><div class="bars">${ins.weekday.map((v, i) => `<div class="bc ${v > 0 && v === wmax ? 'best' : ''}"><div class="col" data-h="${v ? v / 5 * 100 : 4}"><i style="height:100%"></i></div><span>${names[i]}</span></div>`).join('')}</div></article>
    <article class="glass rise s7" style="--i:13"><h2>${L('배지', 'バッジ')} <span class="muted">${BADGES.filter(b => b[2] >= b[3]).length}/${BADGES.length}</span></h2><div class="badges">${BADGES.map(b => `<div class="bd ${b[2] >= b[3] ? 'on' : ''}"><div class="e">${b[0]}</div><b>${b[1]}</b><div class="bar sm"><i style="width:${Math.min(100, b[2] / b[3] * 100)}%"></i></div></div>`).join('')}</div></article>
  </section>`;
  const after = v => {
    typeText($('#sum'), ins.summary);
    requestAnimationFrame(() => setTimeout(() => $$('.col', v).forEach(c => { c.style.height = c.dataset.h + '%'; }), 60));
  };
  return { html, after };
}

const EVT = {
  LOGIN_SUCCESS: ['로그인', 'ログイン'], LOGIN_FAIL: ['로그인 실패', 'ログイン失敗'], LOGIN_UNVERIFIED: ['미인증 로그인', '未認証ログイン'],
  SIGNUP: ['가입', '新規登録'], SIGNUP_FAIL: ['가입 실패', '登録失敗'], VERIFY_OK: ['이메일 인증', 'メール認証'], VERIFY_FAIL: ['인증 실패', '認証失敗'],
  CODE_RESEND: ['코드 재전송', 'コード再送'], LOGOUT: ['로그아웃', 'ログアウト'], PASSWORD_CHANGE: ['비밀번호 변경', 'パスワード変更'],
  PASSWORD_CHANGE_FAIL: ['비밀번호 변경 실패', 'パスワード変更失敗'], PASSWORD_RESET_REQUEST: ['재설정 요청', '再設定リクエスト'],
  PASSWORD_RESET: ['비밀번호 재설정', 'パスワード再設定'], RESET_FAIL: ['재설정 실패', '再設定失敗'], ACCOUNT_DELETE_FAIL: ['계정 삭제 실패', 'アカウント削除失敗']
};
async function viewSettings() {
  const u = S.user = await api('/me'), rich = document.documentElement.classList.contains('rich');
  const logs = await api('/me/logins').catch(() => []);
  const row = (t, p, ctl) => `<div class="setrow"><div><b style="font-weight:500">${t}</b>${p ? `<p class="muted">${p}</p>` : ''}</div>${ctl}</div>`;
  const html = `<header class="vhead rise"><div><p class="eyebrow">Settings</p><h1 style="margin-top:10px"><em>${L('설정', '設定')}</em></h1></div></header>
  <section class="grid">
    <article class="glass s6 rise" style="--i:1"><h2>${L('프로필', 'プロフィール')}</h2>
      <div class="field"><label>${L('이메일', 'メールアドレス')}</label><input class="in" value="${esc(u.email)}" disabled></div>
      <div class="field"><label>${L('닉네임', 'ニックネーム')}</label><input class="in" id="snick" maxlength="20" value="${esc(u.nickname)}"></div>
      <button class="btn" id="snsave">${L('저장', '保存')}</button></article>
    <article class="glass s6 rise" style="--i:2"><h2>${L('화면 · 언어', '表示・言語')}</h2>
      ${row(L('언어', '言語'), '', langSw())}
      ${row(L('화려한 효과', 'リッチエフェクト'), L('블러·배경 애니메이션을 켜요. 끊기면 꺼 두세요.', 'ぼかしや背景アニメを有効にします。重いときはオフに。'), `<button class="switch ${rich ? 'on' : ''}" id="srich" role="switch" aria-checked="${rich}" aria-label="rich"></button>`)}
      ${row(L('이메일 리포트', 'メールレポート'), L('매일 저녁 9시(일본 시간)에 받아요', '毎晩21時（日本時間）に受け取る'), `<button class="switch ${u.dailyMail ? 'on' : ''}" id="smail" role="switch" aria-checked="${u.dailyMail}" aria-label="mail"></button>`)}
      <button class="btn ghost sm" id="stest" style="margin-top:6px">${L('지금 리포트 메일 보내 보기', '今すぐレポートメールを送る')}</button></article>
    <article class="glass s6 rise" style="--i:3"><h2>${L('비밀번호 변경', 'パスワード変更')}</h2>
      <div class="field"><label>${L('현재 비밀번호', '現在のパスワード')}</label><input class="in" id="spw0" type="password" autocomplete="current-password"></div>
      <div class="field"><label>${L('새 비밀번호', '新しいパスワード')} <span class="muted">(${L('8자 이상, 영문+숫자', '8文字以上・英字+数字')})</span></label><input class="in" id="spw1" type="password" autocomplete="new-password"></div>
      <button class="btn" id="spwsave">${L('변경하기', '変更する')}</button></article>
    <article class="glass s6 rise" style="--i:4"><h2>${L('내 데이터', 'マイデータ')}</h2><p class="muted" style="margin-bottom:16px">${L('기록·할 일·습관·집중 기록을 파일로 내려받아요.', '記録・タスク・習慣・集中ログをファイルでダウンロードします。')}</p>
      <div class="row"><button class="btn ghost sm" id="sjson">JSON</button><button class="btn ghost sm" id="scsv">CSV (${L('기록', '記録')})</button></div></article>
    <article class="glass s6 rise" style="--i:5"><h2>${L('아이폰 홈 화면에 추가', 'iPhoneのホーム画面に追加')}</h2>
      <ol class="steps"><li>${L('Safari로 이 페이지를 엽니다', 'Safariでこのページを開く')}</li><li>${L('공유 버튼(□↑)을 누릅니다', '共有ボタン（□↑）をタップ')}</li><li>${L('“홈 화면에 추가”를 누르면 앱처럼 쓸 수 있어요', '「ホーム画面に追加」でアプリのように使えます')}</li></ol></article>
    <article class="glass s6 rise" style="--i:6"><h2>${L('단축키', 'ショートカット')}</h2>
      <p class="muted" style="line-height:2"><kbd>1</kbd>–<kbd>6</kbd> ${L('화면 이동', '画面移動')} · <kbd>N</kbd> ${L('할 일 입력', 'タスク入力')} · <kbd>⌘/Ctrl</kbd>+<kbd>S</kbd> ${L('기록 저장', '記録を保存')}</p></article>
    <article class="glass s12 rise" style="--i:7"><h2>${L('최근 로그인 기록', '最近のログイン履歴')}</h2>
      <div style="max-height:320px;overflow:auto">${logs.length ? logs.map(r => `<div class="setrow"><div><b style="font-weight:500;${/FAIL/.test(r.event) ? 'color:#ffb3b3' : ''}">${esc(EVT[r.event] ? L(EVT[r.event][0], EVT[r.event][1]) : r.event)}</b><p class="muted">${esc(r.device)} · ${esc(r.ip)}</p></div><span class="muted">${esc(r.at)}</span></div>`).join('') : `<p class="muted">${L('기록이 없어요.', '記録がありません。')}</p>`}</div>
      <p class="muted" style="margin-top:12px">${L('모르는 기기나 실패 기록이 보이면 비밀번호를 바꿔 주세요.', '見覚えのない端末や失敗の記録があれば、パスワードを変更してください。')}</p></article>
    <article class="glass s12 rise" style="--i:8"><h2>${L('계정', 'アカウント')}</h2><div class="row"><button class="btn danger" id="slogout">${L('로그아웃', 'ログアウト')}</button><button class="btn ghost sm" id="sdel" style="color:#ffb3b3">${L('계정 삭제', 'アカウント削除')}</button></div></article>
  </section>`;
  const after = () => {
    $('#snsave').addEventListener('click', async ev => {
      try {
        const r = await busy(ev.currentTarget, () => api('/me', { method: 'PUT', body: { nickname: $('#snick').value } }));
        S.user = r; $('#mename').textContent = r.nickname; $('#av').textContent = r.nickname[0]; toast(L('닉네임을 저장했어요', 'ニックネームを保存しました'));
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#srich').addEventListener('click', ev => {
      const on = !document.documentElement.classList.contains('rich');
      document.documentElement.classList.toggle('rich', on); store.set('myday.rich', on ? '1' : '0');
      ev.currentTarget.classList.toggle('on', on); ev.currentTarget.setAttribute('aria-checked', on);
    });
    $('#smail').addEventListener('click', async ev => {
      const b = ev.currentTarget, on = !b.classList.contains('on');
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
      try { await api('/me', { method: 'PUT', body: { dailyMail: on } }); toast(on ? L('매일 저녁 9시에 리포트를 보내 드릴게요', '毎晩21時にレポートをお送りします') : L('리포트 메일을 껐어요', 'レポートメールをオフにしました')); }
      catch (err) { b.classList.toggle('on', !on); toast(err.message, 'err'); }
    });
    $('#stest').addEventListener('click', async ev => {
      try {
        const r = await busy(ev.currentTarget, () => api('/me/test-mail', { method: 'POST' }));
        toast(r.dev ? L('개발 모드: 메일 내용을 서버 콘솔에 출력했어요 (SMTP 설정 시 실제 발송)', '開発モード：メール内容をサーバーのコンソールに出力しました（SMTP設定で実送信）') : L('리포트 메일을 보냈어요. 메일함을 확인해 주세요 ✉️', 'レポートメールを送りました。受信箱をご確認ください ✉️'), r.dev ? 'info' : 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#spwsave').addEventListener('click', async ev => {
      try {
        await busy(ev.currentTarget, () => api('/me/password', { method: 'POST', body: { current: $('#spw0').value, password: $('#spw1').value } }));
        $('#spw0').value = $('#spw1').value = ''; toast(L('비밀번호를 변경했어요 🔒', 'パスワードを変更しました 🔒'));
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#sjson').addEventListener('click', async () => { try { const x = await api('/export'); download(`myday-${todayStr()}.json`, JSON.stringify(x, null, 2), 'application/json'); } catch (err) { toast(err.message, 'err'); } });
    $('#scsv').addEventListener('click', async () => {
      try {
        const x = await api('/export'), q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
        const rows = [['date', 'mood', 'energy', 'highlight', 'gratitude', 'content'].join(',')].concat(x.entries.map(r => [r.date, r.mood, r.energy, q(r.highlight), q(r.gratitude), q(r.content)].join(',')));
        download(`myday-entries-${todayStr()}.csv`, '\ufeff' + rows.join('\n'), 'text/csv');
      } catch (err) { toast(err.message, 'err'); }
    });
    $('#slogout').addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST', noauth: true }); } catch (e) { /* ignore */ }
      S.user = null; location.hash = '#/login';
    });
    $('#sdel').addEventListener('click', async () => {
      const pw = prompt(L('비밀번호를 입력하면 계정과 모든 기록이 삭제돼요. (되돌릴 수 없어요)', 'パスワードを入力するとアカウントと全記録が削除されます。（元に戻せません）'));
      if (!pw) return;
      try { await api('/me', { method: 'DELETE', body: { password: pw } }); S.user = null; toast(L('계정을 삭제했어요', 'アカウントを削除しました')); location.hash = '#/login'; }
      catch (err) { toast(err.message, 'err'); }
    });
  };
  return { html, after };
}

/* ---------- boot ---------- */
route();
setTimeout(() => { const s = $('#splash'); s.classList.add('hide'); setTimeout(() => s.remove(), 700); }, 900);
