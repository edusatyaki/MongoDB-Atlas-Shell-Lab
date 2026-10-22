/* ============================================================
   Mini mongosh engine — the subset of the shell the chapters use
   ============================================================ */
let HOST = 'Atlas atlas-lj7k2q-shard-0 [primary]';

class ObjectId { constructor(h){ this.h = (typeof h === 'string' && /^[0-9a-f]{24}$/i.test(h)) ? h.toLowerCase() : oidHex(); } toString(){ return this.h; } toHexString(){ return this.h; } }
class Timestamp { constructor(t, i){ this.t = t; this.i = i; } }
let oidCounter = Math.floor(Math.random()*0xffffff);
function oidHex(){
  const t = Math.floor(Date.now()/1000).toString(16).padStart(8,'0');
  let r = ''; for (let i=0;i<10;i++) r += (Math.random()*16|0).toString(16);
  oidCounter = (oidCounter+1) & 0xffffff;
  return t + r + oidCounter.toString(16).padStart(6,'0');
}
const OID = function(h){ return new ObjectId(h); };
const ISODate = function(s){ return s === undefined ? new Date() : new Date(s); };

class ShellErr extends Error { constructor(name, msg){ super(msg); this.name = name; } }

let S;          // { cur, dbs: { name: { colls: { name: {docs, capped, size, max} } } } }
let calls = []; // collection/db calls made by the last command
let printed = [];
let flashIds = new Set();
const freshState = () => ({ cur:'test', dbs:{} });

function getColl(name, create){
  let d = S.dbs[S.cur];
  if (!d){ if (!create) return null; d = S.dbs[S.cur] = { colls:{} }; }
  let c = d.colls[name];
  if (!c && create) c = d.colls[name] = { docs:[], capped:false };
  return c || null;
}
function cleanup(){ for (const k in S.dbs) if (!Object.keys(S.dbs[k].colls).length) delete S.dbs[k]; }

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof ObjectId) && !(v instanceof Date) && !(v instanceof RegExp) && !(v instanceof Timestamp);
function clone(v){
  if (v instanceof ObjectId) return new ObjectId(v.h);
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof Timestamp) return new Timestamp(v.t, v.i);
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);
  if (Array.isArray(v)) return v.map(clone);
  if (isObj(v)){ const o = {}; for (const k in v) o[k] = clone(v[k]); return o; }
  return v;
}
// loose: dates and timestamps compare by type only (their value is "now")
function canon(v, loose){
  if (v instanceof ObjectId) return 'oid:'+v.h;
  if (v instanceof Date) return loose ? 'date' : 'date:'+v.getTime();
  if (v instanceof Timestamp) return loose ? 'ts' : 'ts:'+v.t+':'+v.i;
  if (v instanceof RegExp) return 're:'+String(v);
  if (Array.isArray(v)) return '['+v.map(x=>canon(x,loose)).join(',')+']';
  if (isObj(v)) return '{'+Object.keys(v).map(k=>JSON.stringify(k)+':'+canon(v[k],loose)).join(',')+'}';
  return typeof v + ':' + String(v);
}
const eq = (a,b) => canon(a) === canon(b);
const reHit = (re, dv) => Array.isArray(dv) ? dv.some(x=>typeof x === 'string' && re.test(x)) : (typeof dv === 'string' && re.test(dv));
const eqOrHas = (dv,v) => v instanceof RegExp ? reHit(v,dv) : (Array.isArray(dv) && !Array.isArray(v)) ? dv.some(x=>eq(x,v)) : eq(dv,v);
const getPath = (o,p) => p.split('.').reduce((a,k)=> a==null ? undefined : a[k], o);
function setPath(o,p,val){ const ks = p.split('.'); let a = o; for (let i=0;i<ks.length-1;i++){ if (a[ks[i]] === null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length-1]] = val; }
function unsetPath(o,p){ const ks = p.split('.'); let a = o; for (let i=0;i<ks.length-1;i++){ a = a && a[ks[i]]; } if (a) delete a[ks[ks.length-1]]; }
const isOpObj = v => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every(k=>k[0]==='$');
const cmp = (a,b,f) => {
  if (Array.isArray(a)) return a.some(x=>cmp(x,b,f));
  return a !== undefined && a !== null && b !== null && typeof a === typeof b && f(a,b);
};
const opsPass = (spec, dv) => Object.keys(spec).every(op=>applyOp(op, dv, spec[op], spec));

function applyOp(op, dv, x, spec){
  switch(op){
    case '$eq': return eqOrHas(dv,x);
    case '$ne': return !eqOrHas(dv,x);
    case '$gt': return cmp(dv,x,(a,b)=>a>b);
    case '$gte': return cmp(dv,x,(a,b)=>a>=b);
    case '$lt': return cmp(dv,x,(a,b)=>a<b);
    case '$lte': return cmp(dv,x,(a,b)=>a<=b);
    case '$in': if (!Array.isArray(x)) throw new ShellErr('MongoServerError','$in needs an array'); return x.some(y=>eqOrHas(dv,y));
    case '$nin': if (!Array.isArray(x)) throw new ShellErr('MongoServerError','$nin needs an array'); return !x.some(y=>eqOrHas(dv,y));
    case '$exists': return (dv !== undefined) === !!x;
    case '$all': if (!Array.isArray(x)) throw new ShellErr('MongoServerError','$all needs an array'); return Array.isArray(dv) && x.length > 0 && x.every(y=>dv.some(e=>eq(e,y)));
    case '$size': return Array.isArray(dv) && dv.length === x;
    case '$elemMatch':
      if (!isObj(x)) throw new ShellErr('MongoServerError','$elemMatch needs an Object');
      return Array.isArray(dv) && dv.some(e => isOpObj(x) ? opsPass(x,e) : (isObj(e) && match(e,x)));
    case '$not':
      if (x instanceof RegExp) return !reHit(x,dv);
      if (!isOpObj(x)) throw new ShellErr('MongoServerError','$not needs a regex or a document');
      return !opsPass(x,dv);
    case '$regex': {
      let re;
      try { re = x instanceof RegExp ? new RegExp(x.source, (spec && spec.$options) || x.flags) : new RegExp(String(x), (spec && spec.$options) || ''); }
      catch(e){ throw new ShellErr('MongoServerError', `Regular expression is invalid: ${e.message}`); }
      return reHit(re, dv);
    }
    case '$options': if (!spec || !('$regex' in spec)) throw new ShellErr('MongoServerError','$options needs a $regex'); return true;
    default: throw new ShellErr('MongoServerError', `unknown operator: ${op}`);
  }
}
function match(doc, f){
  if (f === undefined || f === null) return true;
  if (!isObj(f)) throw new ShellErr('MongoInvalidArgumentError','Query filter must be a plain object or ObjectId');
  for (const k in f){
    const v = f[k];
    if (k === '$and' || k === '$or' || k === '$nor'){
      if (!Array.isArray(v) || !v.length) throw new ShellErr('MongoServerError', `${k} argument must be a non-empty array`);
      if (k === '$and' && !v.every(s=>match(doc,s))) return false;
      if (k === '$or' && !v.some(s=>match(doc,s))) return false;
      if (k === '$nor' && v.some(s=>match(doc,s))) return false;
      continue;
    }
    if (k[0] === '$') throw new ShellErr('MongoServerError', `unknown top level operator: ${k}`);
    const dv = getPath(doc,k);
    if (isOpObj(v)){ if (!opsPass(v,dv)) return false; }
    else if (!eqOrHas(dv,v)) return false;
  }
  return true;
}
function sortVals(arr, s){
  const dir = isObj(s) ? null : s;
  return arr.sort((a,b)=>{
    if (dir !== null){ return a < b ? -dir : a > b ? dir : 0; }
    for (const k in s){ const x = getPath(a,k), y = getPath(b,k); if (x < y) return -s[k]; if (x > y) return s[k]; }
    return 0;
  });
}
// the positional "$" stands for the index of the first array element the query matched
function positionalIndex(d, field, f){
  for (const k in (f||{})){
    if (k === field){ const arr = getPath(d,field), v = f[k]; if (!Array.isArray(arr)) continue; const i = arr.findIndex(e => isOpObj(v) ? opsPass(v,e) : eqOrHas(e,v)); if (i >= 0) return i; }
    else if (k.startsWith(field + '.')){
      const rest = k.slice(field.length+1);
      if (/^\d+$/.test(rest.split('.')[0])) return +rest.split('.')[0];
      const arr = getPath(d,field); if (!Array.isArray(arr)) continue;
      const i = arr.findIndex(e => isObj(e) && match(e, { [rest]: f[k] })); if (i >= 0) return i;
    }
  }
  return -1;
}
function resolvePositional(d, u, f){
  const out = {};
  for (const op in u){
    if (!isObj(u[op])){ out[op] = u[op]; continue; }
    out[op] = {};
    for (const p in u[op]){
      let q = p;
      const at = p.indexOf('.$');
      if (at > 0 && (p.length === at+2 || p[at+2] === '.')){
        const i = positionalIndex(d, p.slice(0,at), f);
        if (i < 0) throw new ShellErr('MongoServerError', 'The positional operator did not find the match needed from the query.');
        q = p.slice(0,at) + '.' + i + p.slice(at+2);
      }
      out[op][q] = u[op][p];
    }
  }
  return out;
}
function applyUpdate(d, u, inserting){
  for (const op in u){
    const spec = u[op];
    if (!isObj(spec)) throw new ShellErr('MongoServerError', `Modifiers operate on fields but we found type ${Array.isArray(spec)?'array':typeof spec} instead.`);
    for (const p in spec){
      if (p === '_id' && op !== '$setOnInsert' && !inserting) throw new ShellErr('MongoServerError', "Performing an update on the path '_id' would modify the immutable field '_id'");
      const val = spec[p];
      const cur = getPath(d,p);
      const needArr = () => { if (cur !== undefined && !Array.isArray(cur)) throw new ShellErr('MongoServerError', `Cannot apply ${op} to a non-array field. Field named '${p}' has a non-array type ${typeof cur}`); return Array.isArray(cur) ? cur : []; };
      const needNum = () => { if (typeof val !== 'number') throw new ShellErr('MongoServerError', `Cannot ${op === '$inc' ? 'increment' : 'multiply'} with non-numeric argument: {${p}: ${R(val,0,false)[0]}}`); if (cur !== undefined && typeof cur !== 'number') throw new ShellErr('MongoServerError', `Cannot apply ${op} to a value of non-numeric type. Field '${p}' has non-numeric type ${typeof cur}`); };
      switch(op){
        case '$set': setPath(d,p,clone(val)); break;
        case '$setOnInsert': if (inserting) setPath(d,p,clone(val)); break;
        case '$unset': unsetPath(d,p); break;
        case '$inc': needNum(); setPath(d,p,(cur||0)+val); break;
        case '$mul': needNum(); setPath(d,p,(cur||0)*val); break;
        case '$min': if (cur === undefined || val < cur) setPath(d,p,clone(val)); break;
        case '$max': if (cur === undefined || val > cur) setPath(d,p,clone(val)); break;
        case '$rename':
          if (typeof val !== 'string') throw new ShellErr('MongoServerError', `The 'to' field for $rename must be a string: ${p}: ${R(val,0,false)[0]}`);
          if (cur !== undefined){ unsetPath(d,p); setPath(d,val,cur); }
          break;
        case '$currentDate': {
          const ty = isObj(val) ? val.$type : (val === true ? 'date' : null);
          if (ty !== 'date' && ty !== 'timestamp') throw new ShellErr('MongoServerError', `${p} is not valid type for $currentDate. Please use a boolean ('true') or a $type expression ({$type: 'timestamp/date'}).`);
          setPath(d, p, ty === 'date' ? new Date() : new Timestamp(Math.floor(Date.now()/1000), 1));
          break;
        }
        case '$push': {
          let arr = needArr().slice();
          if (isObj(val) && '$each' in val){
            if (!Array.isArray(val.$each)) throw new ShellErr('MongoServerError', 'The argument to $each in $push must be an array');
            const pos = typeof val.$position === 'number' ? val.$position : arr.length;
            arr.splice(pos, 0, ...val.$each.map(clone));
            if (val.$sort !== undefined) sortVals(arr, val.$sort);
            if (typeof val.$slice === 'number') arr = val.$slice >= 0 ? arr.slice(0, val.$slice) : arr.slice(val.$slice);
          } else arr.push(clone(val));
          setPath(d,p,arr); break;
        }
        case '$addToSet': {
          const arr = needArr().slice();
          const items = isObj(val) && '$each' in val ? val.$each : [val];
          items.forEach(x=>{ if (!arr.some(e=>eq(e,x))) arr.push(clone(x)); });
          setPath(d,p,arr); break;
        }
        case '$pop': {
          if (cur === undefined) break;
          const arr = needArr().slice();
          if (val === 1) arr.pop(); else if (val === -1) arr.shift(); else throw new ShellErr('MongoServerError', '$pop expects 1 or -1');
          setPath(d,p,arr); break;
        }
        case '$pull': {
          if (cur === undefined) break;
          const arr = needArr().filter(e => !(isOpObj(val) ? opsPass(val,e) : (isObj(val) && isObj(e)) ? match(e,val) : eqOrHas(e,val)));
          setPath(d,p,arr); break;
        }
        case '$pullAll': {
          if (!Array.isArray(val)) throw new ShellErr('MongoServerError', '$pullAll requires an array argument');
          if (cur === undefined) break;
          setPath(d,p,needArr().filter(e=>!val.some(x=>eq(x,e)))); break;
        }
        default: throw new ShellErr('MongoServerError', `Unknown modifier: ${op}. Expected a valid update modifier or pipeline-style update specified as an array`);
      }
    }
  }
}
function prepDoc(x){
  const d = { _id: x._id !== undefined ? clone(x._id) : new ObjectId() };
  for (const k in x) if (k !== '_id') d[k] = clone(x[k]);
  return d;
}
function pushDoc(c, d, collName){
  if (c.docs.some(e=>eq(e._id,d._id))) throw new ShellErr('MongoBulkWriteError', `E11000 duplicate key error collection: ${S.cur}.${collName} index: _id_ dup key: { _id: ${canon(d._id).replace(/^\w+:/,'')} }`);
  c.docs.push(d);
  if (c.capped && c.max && c.docs.length > c.max) c.docs.shift();
  flashIds.add(canon(d._id));
}
const need = (v, pos, m) => { if (v === undefined) throw new ShellErr('MongoshInvalidInputError', `[COMMON-10001] Missing required argument at position ${pos} (${m})`); };

class Cursor {
  constructor(d){ this.d = d; }
  sort(s){ const ks = Object.keys(s||{}); this.d.sort((a,b)=>{ for (const k of ks){ const x=getPath(a,k), y=getPath(b,k); if (x<y) return -s[k]; if (x>y) return s[k]; } return 0; }); return this; }
  limit(n){ if (n) this.d = this.d.slice(0,n); return this; }
  skip(n){ this.d = this.d.slice(n||0); return this; }
  pretty(){ return this; }
  toArray(){ return this.d; }
  count(){ return this.d.length; }
  size(){ return this.d.length; }
  itcount(){ return this.d.length; }
  forEach(fn){ this.d.forEach(fn); }
  map(fn){ return this.d.map(fn); }
}
function project(d, p){
  if (!isObj(p) || !Object.keys(p).length) return d;
  const inc = Object.keys(p).filter(k=>k!=='_id' && p[k]);
  let o;
  if (inc.length){ o = {}; if (p._id !== 0 && p._id !== false) o._id = d._id; inc.forEach(k=>{ const v=getPath(d,k); if (v!==undefined) setPath(o,k,v); }); }
  else { o = clone(d); Object.keys(p).forEach(k=>{ if (!p[k]) unsetPath(o,k); }); }
  return o;
}

const COLL = Symbol('coll');
function collApi(name){
  const rec = (method, args, result) => { calls.push({ coll:name, method, args, result }); return result; };
  const del = (f, many) => {
    need(f, 0, many ? 'Collection.deleteMany' : 'Collection.deleteOne');
    const c = getColl(name,false); let n = 0;
    if (c) c.docs = c.docs.filter(d=>{ if ((many || n===0) && match(d,f)){ n++; return false; } return true; });
    return { acknowledged:true, deletedCount:n };
  };
  const upd = (f, u, o, many) => {
    const m = many ? 'Collection.updateMany' : 'Collection.updateOne';
    need(f,0,m); need(u,1,m);
    if (!isObj(u) || !Object.keys(u).length || !Object.keys(u).every(k=>k[0]==='$')) throw new ShellErr('MongoInvalidArgumentError','Update document requires atomic operators');
    const c = getColl(name,false);
    const hits = c ? c.docs.filter(d=>match(d,f)) : [];
    const targets = many ? hits : hits.slice(0,1);
    let mod = 0;
    targets.forEach(d=>{
      const nd = clone(d); applyUpdate(nd, resolvePositional(d,u,f), false);   // all-or-nothing per document
      if (canon(nd) !== canon(d)){ mod++; c.docs[c.docs.indexOf(d)] = nd; flashIds.add(canon(d._id)); }
    });
    let up = null;
    if (!targets.length && o && o.upsert){
      const nd = {};
      for (const k in (f||{})) if (k[0] !== '$' && !isOpObj(f[k])) setPath(nd,k,clone(f[k]));
      applyUpdate(nd,u,true);
      const d = prepDoc(nd); pushDoc(getColl(name,true), d, name); up = d._id;
    }
    return { acknowledged:true, insertedId:up, matchedCount:targets.length, modifiedCount:mod, upsertedCount: up ? 1 : 0 };
  };
  return {
    [COLL]: name,
    insertOne(doc){
      need(doc,0,'Collection.insertOne');
      if (!isObj(doc)) throw new ShellErr('MongoInvalidArgumentError','Argument "doc" must be an object');
      const d = prepDoc(doc); pushDoc(getColl(name,true), d, name);
      return rec('insertOne',[doc],{ acknowledged:true, insertedId:d._id });
    },
    insertMany(docs){
      need(docs,0,'Collection.insertMany');
      if (!Array.isArray(docs)) throw new ShellErr('MongoInvalidArgumentError','Argument "docs" must be an array of documents');
      if (!docs.length) throw new ShellErr('MongoInvalidArgumentError','Invalid BulkOperation, Batch cannot be empty');
      const ids = {}; const c = getColl(name,true);
      docs.forEach((x,i)=>{ if (!isObj(x)) throw new ShellErr('MongoInvalidArgumentError','Argument "docs" must be an array of documents'); const d = prepDoc(x); pushDoc(c,d,name); ids[i] = d._id; });
      return rec('insertMany',[docs],{ acknowledged:true, insertedIds:ids });
    },
    find(f, p){ const c = getColl(name,false); const r = c ? c.docs.filter(d=>match(d,f)) : []; rec('find',[f,p],r); return new Cursor(r.map(d=>project(clone(d),p))); },
    findOne(f, p){ const c = getColl(name,false); const r = c ? c.docs.find(d=>match(d,f)) : null; rec('findOne',[f,p],r); return r ? project(clone(r),p) : null; },
    countDocuments(f){ const c = getColl(name,false); return rec('countDocuments',[f], c ? c.docs.filter(d=>match(d,f)).length : 0); },
    count(f){ return this.countDocuments(f); },
    updateOne(f,u,o){ return rec('updateOne',[f,u,o], upd(f,u,o,false)); },
    updateMany(f,u,o){ return rec('updateMany',[f,u,o], upd(f,u,o,true)); },
    replaceOne(f, doc, o){
      need(f,0,'Collection.replaceOne'); need(doc,1,'Collection.replaceOne');
      if (!isObj(doc)) throw new ShellErr('MongoInvalidArgumentError','Replacement document must be an object');
      if (Object.keys(doc).some(k=>k[0]==='$')) throw new ShellErr('MongoInvalidArgumentError','Replacement document must not contain atomic operators');
      const c = getColl(name,false);
      const d = c ? c.docs.find(x=>match(x,f)) : null;
      let mod = 0, up = null;
      if (d){
        if (doc._id !== undefined && !eq(doc._id, d._id)) throw new ShellErr('MongoServerError', "After applying the update, the (immutable) field '_id' was found to have been altered");
        const nd = prepDoc(Object.assign({}, doc, { _id: d._id }));
        if (canon(nd) !== canon(d)){ mod = 1; c.docs[c.docs.indexOf(d)] = nd; flashIds.add(canon(d._id)); }
      } else if (o && o.upsert){ const nd = prepDoc(doc); pushDoc(getColl(name,true), nd, name); up = nd._id; }
      return rec('replaceOne',[f,doc,o],{ acknowledged:true, insertedId:up, matchedCount: d ? 1 : 0, modifiedCount:mod, upsertedCount: up ? 1 : 0 });
    },
    deleteOne(f){ return rec('deleteOne',[f], del(f,false)); },
    deleteMany(f){ return rec('deleteMany',[f], del(f,true)); },
    drop(){ const d = S.dbs[S.cur]; const had = !!(d && d.colls[name]); if (had) delete d.colls[name]; return rec('drop',[],had); },
    isCapped(){ const c = getColl(name,false); return rec('isCapped',[], !!(c && c.capped)); },
    getName(){ return name; },
    toString(){ return `${S.cur}.${name}`; }
  };
}
const dbApi = {
  getName(){ return S.cur; },
  getCollectionNames(){ const d = S.dbs[S.cur]; return d ? Object.keys(d.colls).sort() : []; },
  getCollection(n){ return collApi(String(n)); },
  createCollection(n, opts){
    if (typeof n !== 'string' || !n) throw new ShellErr('MongoshInvalidInputError','[COMMON-10001] Missing required argument at position 0 (Database.createCollection)');
    opts = opts || {};
    const d = S.dbs[S.cur];
    if (d && d.colls[n]) throw new ShellErr('MongoServerError', `Collection ${S.cur}.${n} already exists.`);
    if (opts.capped && !opts.size) throw new ShellErr('MongoServerError', "the 'size' field is required when 'capped' is true");
    const c = getColl(n,true);
    if (opts.capped){ c.capped = true; c.size = opts.size; c.max = opts.max || 0; }
    calls.push({ coll:n, method:'createCollection', args:[n,opts], result:{ok:1} });
    return { ok:1 };
  },
  dropDatabase(){ const name = S.cur; delete S.dbs[name]; calls.push({ coll:null, method:'dropDatabase', args:[], result:{ok:1} }); return { ok:1, dropped:name }; },
  toString(){ return S.cur; }
};
const db = new Proxy({}, { get(t,p){
  if (typeof p === 'symbol') return undefined;
  if (Object.prototype.hasOwnProperty.call(dbApi,p)) return dbApi[p];
  return collApi(p);
}});

/* ---------- printing (mongosh style) ---------- */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function R(v, ind, top){
  const sp = n => ' '.repeat(n);
  if (v === null) return ['null','<span class="k">null</span>'];
  if (v === undefined) return ['undefined','<span class="k">undefined</span>'];
  if (v instanceof ObjectId) return [`ObjectId('${v.h}')`, `<span class="o">ObjectId(</span><span class="s">'${v.h}'</span><span class="o">)</span>`];
  if (v instanceof RegExp) return [String(v), `<span class="s">${esc(String(v))}</span>`];
  if (v instanceof Timestamp) return [`Timestamp({ t: ${v.t}, i: ${v.i} })`, `<span class="o">Timestamp({ t: </span><span class="n">${v.t}</span><span class="o">, i: </span><span class="n">${v.i}</span><span class="o"> })</span>`];
  if (v instanceof Date) return [`ISODate('${v.toISOString()}')`, `<span class="o">ISODate(</span><span class="s">'${v.toISOString()}'</span><span class="o">)</span>`];
  if (v === db) return [S.cur, esc(S.cur)];
  if (v && v[COLL]) return [`${S.cur}.${v[COLL]}`, esc(`${S.cur}.${v[COLL]}`)];
  if (v instanceof Cursor) v = v.d;
  switch (typeof v){
    case 'string': { if (top) return [v, esc(v)]; const q = "'" + v.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'"; return [q, `<span class="s">${esc(q)}</span>`]; }
    case 'number': case 'bigint': return [String(v), `<span class="n">${v}</span>`];
    case 'boolean': return [String(v), `<span class="k">${v}</span>`];
    case 'function': { const t = `[Function: ${v.name||'anonymous'}]`; return [t, `<span class="o">${esc(t)}</span>`]; }
  }
  const arr = Array.isArray(v);
  const ents = arr ? v.map(x=>[null,x]) : Object.keys(v).map(k=>[k,v[k]]);
  if (!ents.length) return arr ? ['[]','[]'] : ['{}','{}'];
  const keyT = k => /^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`;
  const parts = ents.map(([k,x])=>{ const [pt,ph] = R(x, ind+2, false); return [(k===null?'':keyT(k)+': ')+pt, (k===null?'':`<span class="key">${esc(keyT(k))}</span>: `)+ph]; });
  const [o,c] = arr ? ['[',']'] : ['{','}'];
  const inline = o+' '+parts.map(p=>p[0]).join(', ')+' '+c;
  const forceBreak = arr && ents.some(e=>isObj(e[1]));
  if (!forceBreak && !inline.includes('\n') && inline.length + ind <= 72) return [inline, o+' '+parts.map(p=>p[1]).join(', ')+' '+c];
  return [o+'\n'+parts.map(p=>sp(ind+2)+p[0]).join(',\n')+'\n'+sp(ind)+c,
          o+'\n'+parts.map(p=>sp(ind+2)+p[1]).join(',\n')+'\n'+sp(ind)+c];
}

/* ---------- command execution ---------- */
function evalJs(code){
  const body = code.replace(/;\s*$/,'');
  const args = ['db','ObjectId','ISODate','print','printjson'];
  const pr = (...a) => printed.push(a.map(x=>R(x,0,true)[1]).join(' '));
  let fn;
  try { fn = new Function(...args, `"use strict";\nreturn (\n${body}\n);`); }
  catch(_){ fn = new Function(...args, `"use strict";\n${code}`); }
  return fn(db, OID, ISODate, pr, pr);
}
function execute(src){
  calls = []; printed = [];
  const code = src.trim();
  const res = { code, html:null, err:null, special:null, value:undefined };
  let m;
  try {
    if ((m = code.match(/^use\s+([^\s;]+)\s*;?$/))){
      const was = S.cur; S.cur = m[1]; res.special = { type:'use', db:m[1] };
      res.html = esc(was === m[1] ? `already on db ${m[1]}` : `switched to db ${m[1]}`);
    } else if ((m = code.match(/^show\s+(dbs|databases|collections|tables)\s*;?$/i))){
      const w = m[1].toLowerCase();
      if (w === 'dbs' || w === 'databases'){
        res.special = { type:'showdbs' };
        const rows = [['admin','332.00 KiB'],['local','1.42 GiB']];
        for (const k in S.dbs){ const n = Object.values(S.dbs[k].colls).reduce((a,c)=>a+c.docs.length,0); rows.push([k, (8*Object.keys(S.dbs[k].colls).length + 4*Math.ceil(n/2) + 32).toFixed(2)+' KiB']); }
        rows.sort((a,b)=>a[0].toLowerCase()<b[0].toLowerCase()?-1:1);
        const wdt = Math.max(...rows.map(r=>r[0].length)) + 3;
        res.html = rows.map(r=>esc(r[0].padEnd(wdt)) + `<span class="n">${r[1]}</span>`).join('\n');
      } else {
        res.special = { type:'showcolls' };
        res.html = esc(dbApi.getCollectionNames().join('\n'));
      }
    } else if (/^help\s*;?$/.test(code)){
      res.html = esc(['  Shell commands available in this lab:', '    use <db>            switch the current database', '    show dbs            list databases', '    show collections    list collections in the current db', '    db                  print the current database', '    cls                 clear the screen', '', '  Collection methods: insertOne, insertMany, find, findOne, countDocuments,', '    updateOne, updateMany, replaceOne, deleteOne, deleteMany, drop, isCapped', '  Database methods: createCollection, dropDatabase, getCollectionNames'].join('\n'));
    } else {
      res.value = evalJs(code);
      const v = res.value;
      const empty = v === undefined || (v instanceof Cursor && !v.d.length);
      const pre = printed.join('\n');
      res.html = [pre, empty ? '' : R(v,0,true)[1]].filter(Boolean).join('\n');
    }
  } catch(e){
    res.err = e;
    const name = e.name || 'Error';
    res.html = `<span class="er">${esc(name)}: ${esc(e.message)}</span>`;
  }
  cleanup();
  res.calls = calls;
  return res;
}

