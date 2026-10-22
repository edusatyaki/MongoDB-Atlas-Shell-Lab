/* ============================================================
   UI
   ============================================================ */
const $ = id => document.getElementById(id);
const out = $('out'), cmd = $('cmd');
const CH = CHAPTER, TASKS = CH.tasks;
HOST = CH.host;
let idx = 0, done = new Set(), revealed = false, status = null, history = [], hPos = 0, finished = false;
let dataColl = CH.coll || null;
const KEY = CH.key;
function save(){ try { localStorage.setItem(KEY, JSON.stringify({ idx, done:[...done], finished })); } catch(_){} }
function load(){ try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s){ idx = Math.min(Math.max(0, s.idx|0), TASKS.length-1); done = new Set(s.done || []); finished = !!s.finished; } } catch(_){} }

function setPrompt(){ $('prompt').textContent = `${HOST} ${S.cur}>`; }
function line(html, cls){ const d = document.createElement('div'); d.className = 'l' + (cls ? ' '+cls : ''); d.innerHTML = html; out.appendChild(d); out.scrollTop = out.scrollHeight; }
function banner(){
  line('Current Mongosh Log ID:\t' + oidHex(), 'dim');
  line('Connecting to:\t\tmongodb+srv://&lt;credentials&gt;@' + CH.cluster + '/', 'dim');
  line('Using MongoDB:\t\t8.0.4\nUsing Mongosh:\t\t2.3.8', 'dim');
  line('\nType the answer to the question on the left. Enter runs it, Shift+Enter adds a line.\nType <span class="pr">help</span> for commands, <span class="pr">cls</span> to clear.\n', 'dim');
}
function replayTo(i){
  S = CH.init ? CH.init() : freshState();
  for (let j=0;j<i;j++) execute(TASKS[j].answer);
  flashIds.clear();
}

function renderDots(){
  const groups = [];
  TASKS.forEach((t,i)=>{ const last = groups[groups.length-1]; if (last && last.name === t.group) last.items.push(i); else groups.push({ name:t.group, items:[i] }); });
  $('dots').innerHTML = groups.map(g=>`<div class="grp"><small>${g.name}</small><div>${g.items.map(i=>`<button type="button" class="dot${done.has(i)?' done':''}${i===idx&&!finished?' cur':''}" data-i="${i}" title="Q${i+1}: ${esc(TASKS[i].title)}">${i+1}</button>`).join('')}</div></div>`).join('');
}
function renderQ(){
  const q = $('q');
  if (finished){
    q.innerHTML = `<div class="fin"><div class="tag" style="display:inline-block">${CH.finish.tag}</div><h1>${CH.finish.title}</h1><p class="ask">${CH.finish.text}</p><p class="note">${CH.finish.note}</p><div class="btnrow" style="justify-content:center;margin-top:18px"><button class="btn primary" id="restart" type="button">Start again</button></div></div>`;
    $('restart').onclick = ()=>{ done.clear(); finished = false; goTo(0, true); };
    return;
  }
  const t = TASKS[idx];
  const tbl = t.table ? `<table class="need"><tr>${t.table[0].map(h=>`<th>${h}</th>`).join('')}</tr>${t.table.slice(1).map(r=>`<tr>${r.map(v=>`<td>${typeof v==='string'?esc(v):`<b>${v}</b>`}</td>`).join('')}</tr>`).join('')}</table>` : '';
  let st;
  if (done.has(idx) && (!status || status.kind === 'ok' || status.kind === 'wait')) st = `<div class="status ok"><strong>✓ Correct.</strong> ${t.note}</div>`;
  else if (status) st = `<div class="status ${status.kind}">${status.html}</div>`;
  else st = `<div class="status wait">Type your answer in the shell and press Enter.</div>`;
  q.innerHTML = `
    <div class="qhead"><span class="tag">${t.group}</span><span class="qn">Question ${idx+1} of ${TASKS.length}</span></div>
    <h1>${t.title}</h1>
    ${t.story ? `<p class="story">${t.story}</p>` : ''}
    <p class="ask">${t.ask}</p>
    ${tbl}
    ${st}
    <div class="btnrow">
      <button class="btn${done.has(idx)?'':' primary'}" id="rev" type="button">${revealed ? 'Hide answer' : 'Show answer'}</button>
      ${idx>0 ? '<button class="btn" id="rst" type="button" title="Rebuild the data as if every earlier question was answered correctly">↺ Reset to this question</button>' : ''}
    </div>
    ${revealed ? `<div class="reveal"><pre>${esc(t.answer)}</pre><p>${t.explain}</p>${t.sql ? `<div class="sql"><span>SQL equivalent</span><pre>${esc(t.sql)}</pre></div>` : ''}</div>` : ''}`;
  $('rev').onclick = ()=>{ revealed = !revealed; renderQ(); };
  if ($('rst')) $('rst').onclick = ()=>{ goTo(idx, true); };
}
function renderNav(){
  $('prev').disabled = idx === 0 && !finished;
  const nx = $('next');
  nx.textContent = idx === TASKS.length-1 ? 'Finish ✓' : 'Next →';
  nx.disabled = finished;
  nx.classList.toggle('go', done.has(idx) && !finished);
  $('crumb').textContent = finished ? 'Complete' : `Q${idx+1} / ${TASKS.length} · ${TASKS[idx].group}`;
}
function renderData(){
  const d = S.dbs[S.cur];
  const names = d ? Object.keys(d.colls).sort() : [];
  if (!names.includes(dataColl)) dataColl = names[0] || null;
  $('dcrumb').textContent = S.cur + (dataColl ? ' › ' + dataColl : '');
  $('dchips').innerHTML = names.map(n=>`<button type="button" class="chip${n===dataColl?' on':''}" data-c="${esc(n)}">${esc(n)} · ${d.colls[n].docs.length}${d.colls[n].capped?' <span class="cap">capped</span>':''}</button>`).join('');
  const body = $('dbody');
  if (!d){ body.innerHTML = `<div class="empty">Database <b>${esc(S.cur)}</b> holds no collections, so it doesn’t exist on the server yet.</div>`; return; }
  const c = d.colls[dataColl];
  if (!c.docs.length){ body.innerHTML = `<div class="empty">Collection <b>${esc(dataColl)}</b> exists and is empty.</div>`; return; }
  const cols = ['_id'].concat(CH.colOrder || []); c.docs.forEach(x=>Object.keys(x).forEach(k=>{ if (!cols.includes(k)) cols.push(k); }));
  for (let i=cols.length-1;i>=0;i--) if (!c.docs.some(x=>cols[i] in x)) cols.splice(i,1);
  const cell = v => v === undefined ? '' : (v instanceof ObjectId ? '…' + v.h.slice(-6) : esc(typeof v === 'object' ? R(v,0,false)[0] : typeof v === 'string' ? (/^\s*-?\d+(\.\d+)?\s*$/.test(v) ? `"${v}"` : v) : typeof v === 'number' && Math.abs(v) >= 1e15 ? v.toExponential().replace('e+','e') : String(v)));
  body.innerHTML = `<table><tr>${cols.map(k=>`<th>${esc(k)}</th>`).join('')}</tr>${c.docs.map(x=>`<tr class="${flashIds.has(canon(x._id))?'flash':''}">${cols.map(k=>`<td class="${k==='_id'?'id':''}">${cell(x[k])}</td>`).join('')}</tr>`).join('')}</table>`;
}
function renderAll(){ renderDots(); renderQ(); renderNav(); renderData(); setPrompt(); }

function goTo(i, rebuild){
  const advancing = i === idx + 1 && done.has(idx) && !rebuild;
  idx = i; finished = false; revealed = false; status = null;
  if (!advancing){
    replayTo(i);
    out.innerHTML = '';
    banner();
    line(i ? `── Question ${i+1}: data rebuilt as if Q1–Q${i} were answered correctly ──` : `── Question 1: ${CH.startNote} ──`, 'sep');
  } else {
    line(`── Question ${i+1} ──`, 'sep');
  }
  flashIds.clear();
  save(); renderAll(); cmd.focus();
}

function run(src){
  const code = src.trim();
  line(`<span class="pr">${esc(HOST+' '+S.cur+'>')}</span> ${esc(src.replace(/\n/g,'\n'))}`);
  if (!code) return;
  history.push(src); hPos = history.length;
  if (/^(cls|clear)\s*;?$/.test(code)){ out.innerHTML = ''; return; }
  flashIds.clear();
  const before = cloneState(S);
  const r = execute(src);
  if (r.html) line(r.html);
  if (!finished && !done.has(idx)){
    let verdict = false;
    try { verdict = TASKS[idx].check ? TASKS[idx].check(r) : autoCheck(TASKS[idx], r, before); } catch(e){ console.error(e); verdict = false; }
    if (verdict === true){ done.add(idx); status = { kind:'ok' }; save(); }
    else if (typeof verdict === 'string') status = { kind:'hint', html:verdict };
    else if (r.err){
      let h = 'The shell returned an error. Read the red message, fix the command and run it again.';
      if (/is not a function/.test(r.err.message)) h = 'Method names are case-sensitive: <code>insertOne</code>, <code>find</code>, <code>updateMany</code>… Check the spelling.';
      else if (/is not defined/.test(r.err.message)) h = 'Something isn’t defined — check spelling. Every command starts with <code>db.</code>';
      else if (r.err.name === 'SyntaxError') h = 'Syntax error: check that brackets <code>( ) { } [ ]</code> are balanced and strings are in quotes.';
      status = { kind:'err', html:h };
    }
  }
  renderAll();
}

/* automatic checking: run the model answer on the same "before" data and compare */
const cloneState = st => ({ cur: st.cur, dbs: Object.fromEntries(Object.entries(st.dbs).map(([k,d])=>[k, { colls: Object.fromEntries(Object.entries(d.colls).map(([n,c])=>[n, Object.assign({}, c, { docs: c.docs.map(clone) })])) }])) });
function expectedFrom(before, answer){
  const keep = [S, calls, printed, flashIds];
  S = cloneState(before); flashIds = new Set();
  const r = execute(answer); const st = S;
  [S, calls, printed, flashIds] = keep;
  return { r, st };
}
const opTok = t => t.startsWith('re:') ? t : JSON.stringify(t);
function missingOps(args, ops){
  if (!ops) return null;
  const s = (args||[]).map(a=>canon(a)).join(' ');
  const miss = ops.filter(o => !(Array.isArray(o) ? o : [o]).some(t=>s.includes(opTok(t))));
  if (!miss.length) return null;
  return miss.map(o=>`<code>${esc((Array.isArray(o) ? o[0] : o))}</code>`).join(' and ');
}
const collDocs = st => { const d = st.dbs[CH.db]; const c = d && d.colls[CH.coll]; return c ? c.docs : null; };
const names = a => a.map(d=>d.name === undefined ? '…'+d._id.h.slice(-6) : d.name);
function autoCheck(t, r, before){
  const mine = r.calls.filter(x=>x.coll === CH.coll);
  if (S.cur !== CH.db && r.calls.length) return `You’re in <code>${esc(S.cur)}</code>. Switch back with <code>use ${CH.db}</code>.`;
  if (t.kind === 'find'){
    const f = mine.filter(x=>x.method === 'find');
    if (!f.length) return r.calls.some(x=>x.method === 'find') ? `Query the <code>${CH.coll}</code> collection.` : false;
    const call = f[f.length-1];
    const exp = expectedFrom(before, t.answer).r.calls.find(x=>x.method === 'find').result;
    const ids = a => a.map(d=>canon(d._id)).sort().join('|');
    if (ids(call.result) === ids(exp)){
      const miss = missingOps(call.args, t.ops);
      return miss ? `Right documents! Now write it the way this question practises — use ${miss}.` : true;
    }
    const g = new Set(names(call.result)), e = new Set(names(exp));
    const lack = [...e].filter(x=>!g.has(x)), extra = [...g].filter(x=>!e.has(x));
    return `Your query returned <b>${call.result.length}</b> document${call.result.length === 1 ? '' : 's'}; the answer returns <b>${exp.length}</b>.`
      + (lack.length ? ` Missing: <code>${lack.map(esc).join('</code>, <code>')}</code>.` : '')
      + (extra.length ? ` Shouldn’t be there: <code>${extra.map(esc).join('</code>, <code>')}</code>.` : '');
  }
  // update / replace
  const w = mine.filter(x=>/^(update|replace)/.test(x.method));
  if (!w.length) return r.calls.some(x=>/^(insert|delete|drop|update|replace)/.test(x.method)) ? `That changed different data. Click <em>Reset to this question</em>, then use <code>${t.method}</code> on <code>${CH.coll}</code>.` : false;
  const last = w[w.length-1];
  const ex = expectedFrom(before, t.answer);
  if (canon(collDocs(S), true) === canon(collDocs(ex.st), true)){
    if (last.method !== t.method) return `The data is right, but this question practises <code>${t.method}</code>. Click <em>Reset to this question</em> and try it that way.`;
    const miss = missingOps(last.args, t.ops);
    return miss ? `The data is right, but use ${miss} as the question asks. Click <em>Reset to this question</em> and try again.` : true;
  }
  if (last.result.matchedCount === 0) return '<code>matchedCount: 0</code> — the filter found no document. Check the name: spelling and capital letters matter.';
  if (last.result.modifiedCount === 0) return '<code>modifiedCount: 0</code> — the document was found but nothing changed. Check the operator and the field name.' + (t.zeroHint ? ' ' + t.zeroHint : '');
  return 'The document changed, but not the way the question asks. Compare it in the Data panel, then click <em>Reset to this question</em> and try again.';
}

/* input handling */
function balance(s){
  let n = 0, q = null;
  for (let i=0;i<s.length;i++){
    const ch = s[i];
    if (q){ if (ch === '\\'){ i++; continue; } if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`'){ q = ch; continue; }
    if ('({['.includes(ch)) n++; else if (')}]'.includes(ch)) n--;
  }
  return n;
}
function grow(){ cmd.style.height = 'auto'; cmd.style.height = cmd.scrollHeight + 'px'; }
cmd.addEventListener('input', grow);
cmd.addEventListener('keydown', e=>{
  if (e.key === 'Enter' && !e.shiftKey){
    if (balance(cmd.value) > 0) return;      // unfinished bracket: keep typing on a new line
    e.preventDefault();
    const v = cmd.value; cmd.value = ''; grow(); run(v);
  } else if (e.key === 'Tab'){
    e.preventDefault(); cmd.setRangeText('  ', cmd.selectionStart, cmd.selectionEnd, 'end');
  } else if (e.key === 'ArrowUp' && !cmd.value.slice(0, cmd.selectionStart).includes('\n')){
    if (hPos > 0){ e.preventDefault(); hPos--; cmd.value = history[hPos]; grow(); }
  } else if (e.key === 'ArrowDown' && !cmd.value.slice(cmd.selectionEnd).includes('\n')){
    if (hPos < history.length){ e.preventDefault(); hPos++; cmd.value = history[hPos] || ''; grow(); }
  } else if (e.key === 'l' && e.ctrlKey){ e.preventDefault(); out.innerHTML = ''; }
});
$('shell').addEventListener('click', e=>{ if (!window.getSelection().toString() && e.target.tagName !== 'BUTTON') cmd.focus(); });
$('clr').onclick = ()=>{ out.innerHTML = ''; cmd.focus(); };
$('dots').addEventListener('click', e=>{ const b = e.target.closest('.dot'); if (b) goTo(+b.dataset.i, true); });
$('dchips').addEventListener('click', e=>{ const b = e.target.closest('.chip'); if (b){ dataColl = b.dataset.c; renderData(); } });
$('dtog').onclick = ()=>{ const d = $('data'); d.classList.toggle('min'); $('dtog').textContent = d.classList.contains('min') ? 'Show' : 'Hide'; };
$('prev').onclick = ()=>{ if (finished){ finished = false; goTo(TASKS.length-1, true); } else if (idx > 0) goTo(idx-1, true); };
$('next').onclick = ()=>{
  if (idx === TASKS.length-1){ finished = true; save(); renderAll(); return; }
  goTo(idx+1, !done.has(idx));
};

/* full screen */
const root = document.documentElement;
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function fsToggle(){
  if (fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else { const r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (r && r.catch) r.catch(()=>{}); }
}
if (!(root.requestFullscreen || root.webkitRequestFullscreen) || document.fullscreenEnabled === false) $('fs').style.display = 'none';
$('fs').onclick = fsToggle;
const fsSync = () => { $('fs').textContent = fsOn() ? '⛶ Exit full screen' : '⛶ Full screen'; };
document.addEventListener('fullscreenchange', fsSync);
document.addEventListener('webkitfullscreenchange', fsSync);
document.addEventListener('keydown', e=>{ if ((e.key === 'f' || e.key === 'F') && document.activeElement !== cmd && !e.metaKey && !e.ctrlKey) fsToggle(); });

/* boot */
load();
const startAt = idx;
idx = -1;
goTo(startAt, true);
