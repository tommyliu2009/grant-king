var su=u=>/^(javascript|data|vbscript):/i.test(String(u||'').replace(/[\s\x00-\x1f]/g,''))?'#':u;
(function(){
const DATA = window.BZW_DATA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const linkify = s => esc(s).replace(/(https?:\/\/[^\s；;，,）)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const today = (() => { const d = new Date(new Date().toLocaleString('en-US', {timeZone:'Asia/Taipei'})); d.setHours(0,0,0,0); return d; })();
const daysLeft = iso => iso ? Math.round((new Date(iso + 'T00:00:00') - today) / 864e5) : null;

const items0 = DATA.items.map(x => {
  const d = daysLeft(x.deadline);
  let status = x.status;
  if (d !== null && d < 0 && status === '開放中') status = '已截止';
  return {...x, days: d, status, _txt: [x.name, x.org, x.target, x.summary, x.cycle, x.nextOpen, x.region].join(' ').toLowerCase()};
});
let items = items0; const CUR = items0; let HIST = null; let MODE = '現行';
const prep = x => { const d = daysLeft(x.deadline); return {...x, days: d, _txt: [x.name, x.org, x.target, x.summary, x.region, x.year, x.parent].join(' ').toLowerCase()}; };

const RANGES = [['all','不限'],['7','7 天內'],['30','30 天內'],['90','90 天內'],['rolling','隨時受理/待公告']];
const state = {q:'', status:new Set(['開放中','即將開放','常態性/依公告']), level:new Set(), targets:new Set(), range:'all', region:'', org:'', sort:'deadline'};

function counts(key){ const m = {}; items.forEach(x => [].concat(x[key]).forEach(v => m[v] = (m[v]||0)+1)); return m; }
const bound = new Set(); let statusTouched = false;
function buildChips(key, order){
  const box = document.querySelector(`.chips[data-key="${key}"]`); const c = counts(key);
  const vals = order || Object.keys(c).sort((a,b)=>c[b]-c[a]);
  box.innerHTML = vals.filter(v=>c[v]).map(v => `<button class="chip" data-v="${esc(v)}">${esc(v)}<small>${c[v]}</small></button>`).join('');
  if (bound.has(key)) return; bound.add(key);
  box.addEventListener('click', e => { const b = e.target.closest('.chip'); if(!b) return;
    if (key==='status') statusTouched = true; const v = b.dataset.v; state[key].has(v) ? state[key].delete(v) : state[key].add(v); render(); });
}
buildChips('status', ['開放中','即將開放','常態性/依公告','已截止','歷史(已結束)']);
buildChips('level', ['中央','縣市','鄉鎮市','民間/其他']);
buildChips('targets');
const rbox = document.querySelector('.chips[data-key="range"]');
rbox.innerHTML = RANGES.map(([v,l]) => `<button class="chip" data-v="${v}">${l}</button>`).join('');
rbox.addEventListener('click', e => { const b = e.target.closest('.chip'); if(b){ state.range = b.dataset.v; render(); }});

const fillSelect = (sel, key) => { sel.querySelectorAll('option:not([value=""])').forEach(o=>o.remove()); const c = counts(key); Object.keys(c).sort((a,b)=>a.localeCompare(b,'zh-Hant')).forEach(v => sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}（${c[v]}）</option>`)); };
fillSelect($('#region'), 'region'); fillSelect($('#org'), 'org');
$('#region').onchange = e => { state.region = e.target.value; render(); };
$('#org').onchange = e => { state.org = e.target.value; render(); };
$('#sort').onchange = e => { state.sort = e.target.value; render(); };
let t, composing = false; const qEl = $('#q');
const doSearch = () => { clearTimeout(t); const v = qEl.value.trim().toLowerCase(); if (v === state.q) return; state.q = v; render(); if (v) { const l = $('#count'); if (l && window.innerWidth < 820) l.scrollIntoView({behavior:'smooth', block:'start'}); } };
qEl.addEventListener('compositionstart', () => composing = true);
qEl.addEventListener('compositionend', () => { composing = false; clearTimeout(t); t = setTimeout(doSearch, 250); });
qEl.addEventListener('input', () => { if (composing) return; clearTimeout(t); t = setTimeout(doSearch, 250); });
qEl.addEventListener('search', doSearch);
qEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doSearch(); qEl.blur(); } });
const qBtn = $('#qBtn'); if (qBtn) qBtn.addEventListener('click', doSearch);
// 頁面載入前已輸入的字也要算
if (qEl.value.trim()) state.q = qEl.value.trim().toLowerCase();
{ const u = new URLSearchParams(location.search).get('q'); if (u) { qEl.value = u; state.q = u.trim().toLowerCase(); } }
$('#reset').onclick = () => { state.status.clear(); state.level.clear(); state.targets.clear(); state.range='all'; state.region=''; state.org=''; state.q=''; statusTouched=false;
  $('#q').value=''; $('#region').value=''; $('#org').value=''; render(); };
$('#openFilters').onclick = () => $('#filters').classList.add('open');
$('#applyFilters').onclick = () => $('#filters').classList.remove('open');

function badge(x){
  if (x.days === null) return `<span class="badge b-roll">${esc(x.deadlineText || '待公告')}</span>`;
  if (x.days < 0) return `<span class="badge b-done">已截止</span>`;
  if (x.days === 0) return `<span class="badge b-urgent">今天截止</span>`;
  const cls = x.days <= 7 ? 'b-urgent' : x.days <= 30 ? 'b-near' : 'b-ok';
  return `<span class="badge ${cls}">剩 ${x.days} 天</span>`;
}
const fmtDate = x => x.deadline ? x.deadline.replace(/-/g,'/') : (x.deadlineText || '待公告');

function match(x){
  if (state.q && !state.q.split(/\s+/).every(w => x._txt.includes(w.replace(/台/g,'臺')) || x._txt.includes(w))) return false;
  if (state.status.size && !(state.q && !statusTouched) && !state.status.has(x.status)) return false;
  if (state.level.size && !state.level.has(x.level)) return false;
  if (state.targets.size && !x.targets.some(v => state.targets.has(v))) return false;
  if (state.region && x.region !== state.region) return false;
  if (state.org && x.org !== state.org) return false;
  if (state.range === 'rolling') return x.days === null;
  if (state.range !== 'all') return x.days !== null && x.days >= 0 && x.days <= +state.range;
  return true;
}
function sortFn(a,b){
  const big = 1e9, ka = a.days ?? big/2, kb = b.days ?? big/2;
  const rank = x => x.days === null ? (x.status==='常態性/依公告' ? 1.5 : 1) : x.days < 0 ? 2 : 0;   // 未截止 → 不定期 → 已截止
  switch(state.sort){
    case 'deadline': return rank(a)-rank(b) || (rank(a)===2 ? kb-ka : ka-kb);
    case 'deadline_desc': return rank(a)-rank(b) || kb-ka;
    case 'updated': return (b.updated||'').localeCompare(a.updated||'');
    case 'name': return a.name.localeCompare(b.name,'zh-Hant');
  }
}
function card(x){
  return `<article class="card ${x.status==='已截止'?'closed':''}" data-id="${x.id}" tabindex="0">
    <div class="top"><span class="st st-${esc(x.status)}">${esc(x.status)}</span><span class="tag lv-${esc(x.level)}">${esc(x.level)}</span>${x.region!=='全國'?`<span class="tag">📍${esc(x.region)}</span>`:''}</div>
    <h3>${esc(x.name)}</h3>
    <div class="org">🏛 ${esc(x.org)}${x.target?`　👥 ${esc(x.target)}`:''}</div>
    <p class="summary">${esc(x.summary)}</p>
    ${x.cycle||x.nextOpen?`<div class="cycle">🔁 ${esc(x.nextOpen||x.cycle)}</div>`:''}${x.kind==='歷史'?`<div class="cycle">🗂 ${esc(x.year)}年度${x.parent?'　所屬：'+esc(x.parent):''}</div>`:''}
    <div class="bottom"><span class="dl">截止 <b>${esc(fmtDate(x))}</b>${badge(x)}</span>
      ${x.url?`<a class="btn primary" href="${esc(su(x.url))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">原始連結 ↗</a>`:''}</div>
  </article>`;
}
let RES = [], shown = 0; const PAGE = 60;
function more(){
  const next = RES.slice(shown, shown + PAGE);
  $('#list').insertAdjacentHTML('beforeend', next.map(card).join(''));
  shown += next.length;
  let b = document.getElementById('moreBtn');
  if (!b) { b = document.createElement('button'); b.id = 'moreBtn'; b.className = 'btn'; b.style.cssText = 'display:block;margin:16px auto;padding:10px 24px';
    b.onclick = more; $('#list').after(b); }
  b.hidden = shown >= RES.length; b.textContent = `顯示更多（已顯示 ${shown} / ${RES.length}）`;
}
if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting && shown < RES.length) more(); }, {rootMargin:'600px'});
  setTimeout(() => { const b = document.getElementById('moreBtn'); if (b) io.observe(b); }, 0); }
function render(){
  document.querySelectorAll('.chips[data-key]').forEach(box => { const k = box.dataset.key;
    box.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', k==='range' ? state.range===c.dataset.v : state[k].has(c.dataset.v))); });
  const res = items.filter(match).sort(sortFn);
  RES = res; shown = 0; $('#list').innerHTML = ''; more();
  $('#empty').hidden = res.length > 0;
  $('#count').textContent = state.q ? `「${qEl.value.trim()}」找到 ${res.length} 筆補助${statusTouched?'':'（含已截止）'}` : `找到 ${res.length} 筆補助`;
}
$('#list').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) openModal(+c.dataset.id); });
$('#list').addEventListener('keydown', e => { if (e.key==='Enter'){ const c = e.target.closest('.card'); if (c) openModal(+c.dataset.id); }});

function openModal(id){
  const x = items.find(i => i.id === id);
  const row = (k,v,html) => v ? `<dt>${k}</dt><dd>${html ? v : esc(v)}</dd>` : '';
  $('#mBody').innerHTML = `
    <div class="top"><span class="st st-${esc(x.status)}">${esc(x.status)}</span><span class="tag lv-${esc(x.level)}">${esc(x.level)}</span><span class="tag">📍${esc(x.region)}</span></div>
    <h2 id="mTitle">${esc(x.name)}</h2>
    <dl class="kv">
      ${row('主辦單位', x.org)}
      ${row('截止日期', esc(fmtDate(x)) + badge(x), true)}
      ${row('補助對象', x.target)}
      ${row('摘要', x.summary)}
      ${row('年度', x.year)}${row('所屬計畫', x.parent)}${row('週期規律', x.cycle)}
      ${row('預估下次開放', x.nextOpen)}
      ${row('資料來源', x.sourceType)}
      ${row('收錄／更新', [x.firstSeen, x.updated].filter(Boolean).join(' ／ '))}
      ${row('最後核實', [x.verified, x.linkStatus].filter(Boolean).join(' ／ '))}
    </dl>
    ${x.notes ? `<div class="notes"><b>備註／參考連結</b><br>${linkify(x.notes)}</div>` : ''}
    <div class="actions">${x.url?`<a class="btn primary" href="${esc(su(x.url))}" target="_blank" rel="noopener">前往原始公告 ↗</a>`:''}
      <button class="btn" data-close>關閉</button></div>`;
  $('#modal').hidden = false; document.body.style.overflow = 'hidden';
}
const closeModal = () => { $('#modal').hidden = true; document.body.style.overflow = ''; };
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('#filters').classList.remove('open'); }});

const open = items.filter(x => x.status==='開放中').length;
const week = items.filter(x => x.days !== null && x.days >= 0 && x.days <= 14).length;
const upcoming = items.filter(x => x.status==='即將開放').length;
const rolling = items.filter(x => x.status==='常態性/依公告').length;
$('#stats').innerHTML = `<span class="stat"><b>${items.length}</b>筆補助</span><span class="stat"><b>${rolling}</b>常態性/依公告</span><span class="stat"><b>${open}</b>開放中</span><span class="stat"><b>${week}</b>14 天內截止</span><span class="stat"><b>${upcoming}</b>即將開放</span>`;
$('#updated').textContent = DATA.generated; $('#total').textContent = items.length;
render();
function setMode(m){
  MODE = m; document.querySelectorAll('#kindToggle .chip').forEach(b => b.classList.toggle('on', b.dataset.k === m));
  items = m === '歷史' ? HIST : CUR;
  statusTouched = false; state.status = m === '歷史' ? new Set() : new Set(['開放中','即將開放','常態性/依公告']);
  state.level.clear(); state.targets.clear(); state.region=''; state.org=''; state.range='all';
  buildChips('status', ['開放中','即將開放','常態性/依公告','已截止','歷史(已結束)']); buildChips('level', ['中央','縣市','鄉鎮市','民間/其他']); buildChips('targets');
  fillSelect($('#region'), 'region'); fillSelect($('#org'), 'org'); $('#region').value=''; $('#org').value='';
  $('#total').textContent = items.length; render();
}
const HY = DATA.histYears || {}; const YRS = Object.keys(HY).sort().reverse(); let curYear = YRS[0];
const yt = $('#yearToggle');
yt.innerHTML = YRS.map(y => `<button class="chip" data-y="${y}">${y}年<small>${HY[y]}</small></button>`).join('') + `<button class="chip" data-y="all">全部年度<small>${Object.values(HY).reduce((a,b)=>a+b,0)}</small></button>`;
function loadYears(ys, cb){
  const need = ys.filter(y => !(window.BZW_HIST && window.BZW_HIST[y])); let left = need.length; if (!left) return cb();
  $('#count').textContent = '歷史資料載入中…';
  need.forEach(y => { const s = document.createElement('script'); s.src = `data_hist_${y}.js`; s.onload = () => { if (--left === 0) cb(); }; document.body.appendChild(s); });
}
function showYear(y){
  curYear = y; yt.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.dataset.y === y));
  const ys = y === 'all' ? YRS : [y];
  loadYears(ys, () => { HIST = ys.flatMap(k => window.BZW_HIST[k]).map(x => prep({targets:['其他'], status:'歷史(已結束)', ...x})); setMode('歷史'); });
}
yt.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) showYear(b.dataset.y); });
$('#kindToggle').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b || b.dataset.k === MODE) return;
  yt.hidden = b.dataset.k !== '歷史';
  if (b.dataset.k === '歷史') return showYear(curYear);
  setMode('現行'); });
if (location.hash === '#history') document.querySelector('#kindToggle .chip[data-k="歷史"]').click();
})();
