/* ============================================================
   UI
   ============================================================ */
const $ = id => document.getElementById(id);
const out = $('out'), cmd = $('cmd');
const CH = CHAPTERS.find(c=>c.id === document.body.dataset.chapter) || CHAPTERS[0], TASKS = CH.tasks;
HOST = CH.host;
let idx = 0, done = new Set(), revealed = false, status = null, cmdHist = [], hPos = 0, finished = false;
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
  line('\nType your answer at the prompt. Enter runs it, Shift+Enter adds a line.\nType <span class="pr">help</span> for commands, <span class="pr">cls</span> to clear.\n', 'dim');
}
function replayTo(i){
  S = CH.init ? CH.init() : freshState();
  for (let j=0;j<i;j++) execute(TASKS[j].answer);
  flashIds.clear();
}

function doneOf(c){
  if (c === CH) return done;
  try { const st = JSON.parse(localStorage.getItem(c.key) || 'null'); return new Set(st && st.done || []); } catch(_){ return new Set(); }
}
function topicsOf(c){
  const groups = [];
  c.tasks.forEach((t,i)=>{ const last = groups[groups.length-1]; if (last && last.name === t.group) last.items.push(i); else groups.push({ name:t.group, items:[i] }); });
  return groups;
}
/* outline collapse state: closed chapter/topic keys + hidden sidebar, remembered per browser */
const OKEY = 'atlas-lab-outline';
let closed = new Set(), sideOff = false;
try { const o = JSON.parse(localStorage.getItem(OKEY) || 'null'); if (o){ closed = new Set(o.closed || []); sideOff = !!o.sideOff; } } catch(_){}
function saveOutline(){ try { localStorage.setItem(OKEY, JSON.stringify({ closed:[...closed], sideOff })); } catch(_){} }
const topicKey = (c,g) => `${c.id}:t${g.items[0]}`;
const CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function openCurrent(){ closed.delete(CH.id); const g = topicsOf(CH).find(g=>g.items.includes(idx)); if (g) closed.delete(topicKey(CH,g)); }
function renderOutline(){
  const html = CHAPTERS.map(c=>{
    const on = c === CH, d = doneOf(c), shut = closed.has(c.id);
    const head = `<span class="chap-num">${c.num}</span><span class="chap-title">${esc(c.title)}<small>${esc(c.story)}</small></span><span class="chap-count">${d.size}/${c.tasks.length}</span>`;
    const topics = topicsOf(c).map(g=>{
      const n = g.items.filter(i=>d.has(i)).length, k = topicKey(c,g), tshut = closed.has(k);
      const items = g.items.map(i=>{
        const cls = `qi${d.has(i)?' done':''}${on && i===idx && !finished?' cur':''}`;
        const inner = `<span class="st">${d.has(i)?'✓':i+1}</span><span>${esc(c.tasks[i].title)}</span>`;
        return on ? `<button type="button" class="${cls}" data-i="${i}"${i===idx&&!finished?' aria-current="step"':''}>${inner}</button>`
                  : `<a class="${cls}" href="${c.href}#q${i+1}">${inner}</a>`;
      }).join('');
      return `<button type="button" class="topic${tshut?' shut':''}" data-tog="${k}" aria-expanded="${!tshut}">${CHEV}<span class="tn">${esc(g.name)}</span><span class="tc">${n}/${g.items.length}</span></button><div class="items"${tshut?' hidden':''}>${items}</div>`;
    }).join('');
    const headHtml = on
      ? `<button type="button" class="chap-head" data-tog="${c.id}" aria-expanded="${!shut}">${head}${CHEV}</button>`
      : `<div class="chap-head"><a class="chap-link" href="${c.href}" title="Open chapter ${c.num}">${head}</a><button type="button" class="chap-tog" data-tog="${c.id}" aria-expanded="${!shut}" aria-label="Show or hide chapter ${c.num} topics">${CHEV}</button></div>`;
    const dsRow = c.dataset ? `<button type="button" class="qi ds" data-ds="${c.id}"><span class="st">{ }</span><span>Dataset · setup code</span></button>` : '';
    return `<section class="chap${on?' on':''}${shut?' shut':''}">${headHtml}<div class="topics"${shut?' hidden':''}>${dsRow}${topics}</div></section>`;
  }).join('');
  $('outline').innerHTML = `<div class="ol-bar"><span class="ol-label">Course outline</span><button type="button" class="ol-act" data-all="open" title="Expand all chapters and topics">Expand</button><button type="button" class="ol-act" data-all="close" title="Collapse all chapters and topics">Collapse</button><button type="button" class="ol-hide" id="olHide" aria-label="Hide course outline" title="Hide outline">«</button></div>${html}`;
  $('progText').textContent = `Chapter ${CH.num} · ${done.size} of ${TASKS.length} complete`;
  $('progBar').style.width = (100*done.size/TASKS.length) + '%';
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
    <div class="qhead"><span class="tag">${esc(t.group)}</span><span class="qn">Chapter ${CH.num} · Question ${idx+1} of ${TASKS.length}</span></div>
    <h1>${t.title}</h1>
    ${t.story ? `<p class="story">${t.story}</p>` : ''}
    <p class="ask">${t.ask}</p>
    ${tbl}
    ${st}
    <div class="btnrow">
      <button class="btn${done.has(idx)?'':' primary'}" id="rev" type="button">${revealed ? 'Hide answer' : 'Show answer'}</button>
      ${idx>0 ? '<button class="btn" id="rst" type="button" title="Rebuild the data as if every earlier question was answered correctly">↺ Reset to this question</button>' : ''}
    </div>
    ${revealed ? `<div class="reveal"><div class="codebox"><pre>${esc(t.answer)}</pre><button type="button" class="copy" data-copy="answer">Copy</button></div><p>${t.explain}</p>${t.sql ? `<div class="sql"><span>SQL equivalent</span><div class="codebox"><pre>${esc(t.sql)}</pre><button type="button" class="copy" data-copy="sql">Copy</button></div></div>` : ''}</div>` : ''}`;
  $('rev').onclick = ()=>{ revealed = !revealed; renderQ(); };
  q.querySelectorAll('.copy').forEach(b=> b.onclick = ()=> copyText(t[b.dataset.copy], b));
  if ($('rst')) $('rst').onclick = ()=>{ goTo(idx, true); };
}
function renderNav(){
  $('prev').disabled = idx === 0 && !finished;
  const nx = $('next');
  nx.textContent = idx === TASKS.length-1 ? 'Finish ✓' : 'Next →';
  nx.disabled = finished;
  nx.classList.toggle('go', done.has(idx) && !finished);
  $('crumb').textContent = finished ? `Chapter ${CH.num} complete` : `${CH.title} › ${TASKS[idx].group} › Q${idx+1}`;
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
  const cell = v => { const t = cellText(v); return t.length > 64 ? `<span title="${esc(t).replace(/"/g,'&quot;')}">${esc(t.slice(0,61))}…</span>` : esc(t); };
  const cellText = v => v === undefined ? '' : v instanceof ObjectId ? '…' + v.h.slice(-6) : typeof v === 'object' ? R(v,0,false)[0] : typeof v === 'string' ? (/^\s*-?\d+(\.\d+)?\s*$/.test(v) ? `"${v}"` : v) : typeof v === 'number' && Math.abs(v) >= 1e15 ? v.toExponential().replace('e+','e') : String(v);
  body.innerHTML = `<table><tr>${cols.map(k=>`<th>${esc(k)}</th>`).join('')}</tr>${c.docs.map(x=>`<tr class="${flashIds.has(canon(x._id))?'flash':''}">${cols.map(k=>`<td class="${k==='_id'?'id':''}">${cell(x[k])}</td>`).join('')}</tr>`).join('')}</table>`;
}
function renderAll(){ renderOutline(); renderQ(); renderNav(); renderData(); setPrompt(); }

function goTo(i, rebuild){
  const advancing = i === idx + 1 && done.has(idx) && !rebuild;
  idx = i; finished = false; revealed = false; status = null;
  openCurrent(); saveOutline();
  if (!advancing){
    replayTo(i);
    out.innerHTML = '';
    banner();
    line(i ? `── Question ${i+1}: data rebuilt as if Q1–Q${i} were answered correctly ──` : `── Question 1: ${CH.startNote} ──`, 'sep');
  } else {
    line(`── Question ${i+1} ──`, 'sep');
  }
  flashIds.clear();
  try { history.replaceState(null, '', '#q' + (i+1)); } catch(_){}
  save(); renderAll(); scrollOutline(); cmd.focus();
}

function run(src){
  const code = src.trim();
  line(`<span class="pr">${esc(HOST+' '+S.cur+'>')}</span> ${esc(src.replace(/\n/g,'\n'))}`);
  if (!code) return;
  cmdHist.push(src); hPos = cmdHist.length;
  if (/^(cls|clear)\s*;?$/.test(code)){ out.innerHTML = ''; return; }
  flashIds.clear();
  const before = cloneState(S);
  const r = execute(src);
  if (r.html) line(r.html);
  const touched = r.calls.filter(x=>x.coll && S.dbs[S.cur] && S.dbs[S.cur].colls[x.coll]).pop();
  if (touched) dataColl = touched.coll;
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

/* ---------- dataset setup code (paste into Atlas / mongosh) ---------- */
function jsLit(v){
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(jsLit).join(', ') + ']';
  if (v && typeof v === 'object') return '{ ' + Object.keys(v).map(k=>`${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${jsLit(v[k])}`).join(', ') + ' }';
  if (typeof v === 'number' && Math.abs(v) >= 1e15) return v.toExponential();
  return String(v);
}
function docLit(d, multi){
  if (!multi) return '  ' + jsLit(d);
  return '  {\n' + Object.keys(d).map(k=>`    ${k}: ${jsLit(d[k])}`).join(',\n') + '\n  }';
}
const dsColls = ds => ds.collections || { [ds.coll]: ds.docs };
const dsCount = ds => Object.values(dsColls(ds)).reduce((n,d)=>n+d.length,0);
function datasetCode(c){
  const ds = c.dataset, cols = dsColls(ds);
  const blocks = Object.keys(cols).map(n=>{
    const docs = cols[n], multi = docs.some(x=>jsLit(x).length > 94);
    return `db.${n}.drop();\ndb.${n}.insertMany([\n${docs.map(d=>docLit(d, multi)).join(',\n')}\n]);`;
  });
  const counts = Object.keys(cols).map(n=>`db.${n}.countDocuments();   // ${cols[n].length}`).join('\n');
  return `// Chapter ${c.num} · ${c.title} — ${c.story}\n// Paste into the Atlas shell or mongosh. Re-running it starts clean.\n\nuse ${ds.db}\n\n${blocks.join('\n\n')}\n\n${counts}`;
}
function openDataset(c){
  let m = $('dsModal');
  if (!m){
    m = document.createElement('div'); m.id = 'dsModal'; m.className = 'modal'; m.hidden = true;
    m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dsTitle"><div class="modal-head"><div><span class="tag" id="dsTag"></span><h2 id="dsTitle"></h2></div><button type="button" class="modal-x" id="dsClose" aria-label="Close">×</button></div><p class="modal-note" id="dsNote"></p><div class="codebox"><pre id="dsCode"></pre><button type="button" class="copy" id="dsCopy">Copy</button></div><p class="modal-foot">Works in MongoDB Atlas (Data Explorer › mongosh), a local <code>mongosh</code>, or Compass’s shell tab.</p></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e=>{ if (e.target === m || e.target.id === 'dsClose') closeDataset(); });
  }
  const code = datasetCode(c);
  $('dsTag').textContent = `Chapter ${c.num} · Dataset`;
  const nc = Object.keys(dsColls(c.dataset)).length;
  $('dsTitle').textContent = nc > 1 ? `${c.dataset.db} — ${nc} collections, ${dsCount(c.dataset)} documents` : `${c.dataset.db}.${Object.keys(dsColls(c.dataset))[0]} — ${dsCount(c.dataset)} documents`;
  $('dsNote').textContent = c.dataset.note;
  $('dsCode').textContent = code;
  $('dsCopy').onclick = ()=> copyText(code, $('dsCopy'));
  m.hidden = false; drawer(false); $('dsCopy').focus();
}
function closeDataset(){ const m = $('dsModal'); if (m && !m.hidden){ m.hidden = true; cmd.focus(); } }

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
const dbState = st => { const d = st.dbs[CH.db]; return d ? Object.keys(d.colls).sort().map(n=>[n, d.colls[n].docs]) : null; };
const label = d => d.name !== undefined ? String(d.name) : d.country !== undefined ? String(d.country) : d._id instanceof ObjectId ? '…' + d._id.h.slice(-6) : String(d._id);
const names = a => a.map(label);
function autoCheck(t, r, before){
  const coll = t.coll || CH.coll;
  const mine = r.calls.filter(x=>x.coll === coll);
  if (S.cur !== CH.db && r.calls.length) return `You’re in <code>${esc(S.cur)}</code>. Switch back with <code>use ${CH.db}</code>.`;
  if (t.kind === 'find' || t.kind === 'agg'){
    const m = t.kind === 'find' ? 'find' : 'aggregate';
    const f = mine.filter(x=>x.method === m);
    if (!f.length){
      if (r.calls.some(x=>x.method === m)) return `Run it on the <code>${coll}</code> collection.`;
      if (t.kind === 'agg' && mine.some(x=>x.method === 'find')) return 'This question practises <code>aggregate([ … ])</code> with a <code>$lookup</code> stage.';
      return false;
    }
    const call = f[f.length-1];
    const exp = expectedFrom(before, t.answer).r.calls.filter(x=>x.method === m && x.coll === coll).pop().result;
    const ids = a => a.map(d=>canon(d._id)).sort().join('|');
    const full = a => a.map(d=>canon(d, true)).sort().join('|');
    if (ids(call.result) === ids(exp)){
      const seq = a => a.map(d=>canon(d, true)).join('|');
      if (t.ordered && seq(call.result) !== seq(exp) && full(call.result) === full(exp)) return 'Right documents, wrong order. Check your <code>$sort</code>: <code>1</code> is ascending, <code>-1</code> descending — and which stage comes first.';
      if (t.kind === 'agg' && full(call.result) !== full(exp)) return t.shapeHint || 'The right documents came back, but their fields or values differ from the answer. Compare the output with the question: field names, accumulators and the <code>$lookup</code> settings.';
      const miss = missingOps(call.args, t.ops);
      return miss ? `Right documents! Now write it the way this question practises — use ${miss}.` : true;
    }
    const lit = t.kind === 'agg' && Array.isArray(call.args[0]) && call.args[0].find(st=>isObj(st) && isObj(st.$group) && typeof st.$group._id === 'string' && st.$group._id[0] !== '$');
    if (lit) return `Grouping key <code>_id: "${esc(lit.$group._id)}"</code> is a plain string, so every document lands in one group. Add a <code>$</code> to mean “the value of the field”: <code>_id: "$${esc(lit.$group._id)}"</code>.`;
    const g = new Set(names(call.result)), e = new Set(names(exp));
    const lack = [...e].filter(x=>!g.has(x)), extra = [...g].filter(x=>!e.has(x));
    return `Your query returned <b>${call.result.length}</b> document${call.result.length === 1 ? '' : 's'}; the answer returns <b>${exp.length}</b>.`
      + (lack.length ? ` Missing: <code>${lack.map(esc).join('</code>, <code>')}</code>.` : '')
      + (extra.length ? ` Shouldn’t be there: <code>${extra.map(esc).join('</code>, <code>')}</code>.` : '');
  }
  // writes: update / replace / insert
  const w = mine.filter(x=>/^(update|replace|insert)/.test(x.method));
  if (!w.length) return r.calls.some(x=>/^(insert|delete|drop|update|replace)/.test(x.method)) ? `That changed different data. Click <em>Reset to this question</em>, then use <code>${t.method}</code> on <code>${coll}</code>.` : false;
  const last = w[w.length-1];
  const ex = expectedFrom(before, t.answer);
  if (canon(dbState(S), true) === canon(dbState(ex.st), true)){
    if (last.method !== t.method) return `The data is right, but this question practises <code>${t.method}</code>. Click <em>Reset to this question</em> and try it that way.`;
    const miss = missingOps(last.args, t.ops);
    return miss ? `The data is right, but use ${miss} as the question asks. Click <em>Reset to this question</em> and try again.` : true;
  }
  if (last.result && last.result.matchedCount === 0 && !last.result.upsertedCount) return '<code>matchedCount: 0</code> — the filter found no document. Check the name: spelling and capital letters matter.';
  if (last.result && last.result.modifiedCount === 0 && !last.result.upsertedCount) return '<code>modifiedCount: 0</code> — the document was found but nothing changed. Check the operator and the field name.' + (t.zeroHint ? ' ' + t.zeroHint : '');
  return /^insert/.test(last.method)
    ? 'A document went in, but it doesn’t match what the question asks. Compare it in the Data panel, then click <em>Reset to this question</em> and try again.' + (t.diffHint ? ' ' + t.diffHint : '')
    : 'The document changed, but not the way the question asks. Compare it in the Data panel, then click <em>Reset to this question</em> and try again.' + (t.diffHint ? ' ' + t.diffHint : '');
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
    if (hPos > 0){ e.preventDefault(); hPos--; cmd.value = cmdHist[hPos]; grow(); }
  } else if (e.key === 'ArrowDown' && !cmd.value.slice(cmd.selectionEnd).includes('\n')){
    if (hPos < cmdHist.length){ e.preventDefault(); hPos++; cmd.value = cmdHist[hPos] || ''; grow(); }
  } else if (e.key === 'l' && e.ctrlKey){ e.preventDefault(); out.innerHTML = ''; }
});
$('shell').addEventListener('click', e=>{ if (!window.getSelection().toString() && e.target.tagName !== 'BUTTON') cmd.focus(); });
$('clr').onclick = ()=>{ out.innerHTML = ''; cmd.focus(); };
function scrollOutline(){ const b = $('outline').querySelector('.qi.cur'); if (b) b.scrollIntoView({ block:'nearest' }); }
function drawer(open){ $('outline').classList.toggle('open', open); $('scrim').classList.toggle('on', open); $('menu').setAttribute('aria-expanded', open); }
const narrow = () => innerWidth <= 1240;
function setSide(off){ sideOff = off; $('app').classList.toggle('side-off', off); $('menu').setAttribute('aria-expanded', !off); saveOutline(); }
$('outline').addEventListener('click', e=>{
  const dsb = e.target.closest('[data-ds]');
  if (dsb){ openDataset(CHAPTERS.find(c=>c.id === dsb.dataset.ds)); return; }
  const q = e.target.closest('button.qi');
  if (q){ drawer(false); goTo(+q.dataset.i, true); return; }
  const tg = e.target.closest('[data-tog]');
  if (tg){ const k = tg.dataset.tog; closed.has(k) ? closed.delete(k) : closed.add(k); saveOutline(); renderOutline(); return; }
  const all = e.target.closest('[data-all]');
  if (all){
    closed.clear();
    if (all.dataset.all === 'close') CHAPTERS.forEach(c=>{ closed.add(c.id); topicsOf(c).forEach(g=>closed.add(topicKey(c,g))); });
    saveOutline(); renderOutline(); return;
  }
  if (e.target.closest('#olHide')) narrow() ? drawer(false) : setSide(true);
});
$('menu').onclick = ()=> narrow() ? drawer(!$('outline').classList.contains('open')) : setSide(!sideOff);
setSide(sideOff);
function copyText(text, btn){
  const done = ok => { btn.textContent = ok ? 'Copied ✓' : 'Press ⌘C'; btn.classList.toggle('ok', ok); setTimeout(()=>{ btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch(_){} ta.remove(); done(ok); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(()=>done(true), fallback); else fallback();
}
$('scrim').onclick = ()=> drawer(false);
document.addEventListener('keydown', e=>{ if (e.key === 'Escape'){ drawer(false); closeDataset(); } });
$('dsBtn').onclick = ()=> openDataset(CH);
window.addEventListener('resize', ()=>{ out.scrollTop = out.scrollHeight; if (innerWidth > 1240) drawer(false); });
$('dchips').addEventListener('click', e=>{ const b = e.target.closest('.chip'); if (b){ dataColl = b.dataset.c; renderData(); } });
$('dtog').onclick = ()=>{ const d = $('data'); d.classList.toggle('min'); $('dtog').textContent = d.classList.contains('min') ? 'Show' : 'Hide'; };
$('prev').onclick = ()=>{ if (finished){ finished = false; goTo(TASKS.length-1, true); } else if (idx > 0) goTo(idx-1, true); };
$('conn').textContent = 'mongodb+srv://' + CH.cluster + ' · Cluster0';
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
const hq = location.hash.match(/^#q(\d+)$/);
const startAt = hq ? Math.min(Math.max(+hq[1]-1, 0), TASKS.length-1) : idx;
idx = -1;
goTo(startAt, true);
