/* ============================================================
   Chapter 01 · CRUD Operations — Luscious Jewels
   Questions follow the deck, one shell action each
   ============================================================ */
const P = () => (S.dbs.LusciousJewels && S.dbs.LusciousJewels.colls.products) || null;
const docs = () => (P() ? P().docs : []);
const byName = n => docs().filter(d=>d.name === n);
const called = (c, m, coll) => c.calls.filter(x=>x.method === m && (coll === undefined || x.coll === coll));
const gate = () => S.cur !== 'LusciousJewels' ? `You're working in <code>${esc(S.cur)}</code>. Switch first: <code>use LusciousJewels</code>.` : null;
const emptyFilter = f => f === undefined || (isObj(f) && !Object.keys(f).length);
const fourItems = [
  ['Silver Ring', 800, 'Ring', 20],
  ['Diamond Ring', 5200, 'Ring', 5],
  ['Pearl Earrings', 1200, 'Earrings', 30],
  ['Test Bangle', 0, 'Bangle', 0]
];
const hasItem = ([n,p,c,s]) => byName(n).some(d=>d.price===p && d.category===c && d.stock===s);

const CH02_TASKS = [
  { group:'Database', title:'Pick a database',
    story:'<b>D. Soni</b> runs Luscious Jewels, a growing jewellery brand. She doesn’t just want to manage jewellery — she wants to manage her data too, and she needs your help.',
    ask:'Switch the shell to a database called <code>LusciousJewels</code>.',
    answer:'use LusciousJewels',
    explain:'<code>use</code> sets your working database to <code>LusciousJewels</code>, but MongoDB doesn’t actually create it until you store data in it.',
    check:c=>{
      if (!c.special || c.special.type !== 'use') return false;
      return S.cur === 'LusciousJewels' || `You switched to <code>${esc(S.cur)}</code>. Database names are case-sensitive — it must be exactly <code>LusciousJewels</code>.`;
    },
    note:'The prompt now ends in <code>LusciousJewels&gt;</code>. Is the database really there yet? Find out next.' },

  { group:'Database', title:'Does it exist yet?',
    story:'She wants to see every database on her Atlas cluster.',
    ask:'List all databases on the cluster. Look for <code>LusciousJewels</code> in the output.',
    answer:'show dbs',
    explain:'<code>show dbs</code> lists only databases that hold data. <code>LusciousJewels</code> is missing because <code>use</code> doesn’t create anything on its own.',
    check:c=> !!(c.special && c.special.type === 'showdbs'),
    note:'<code>LusciousJewels</code> is <strong>not</strong> in the list. MongoDB creates a database only when its first collection or document is stored.' },

  { group:'Create', title:'Create the inventory',
    story:'She’s thinking of one inventory to manage all her products.',
    ask:'Explicitly create a collection named <code>products</code> in the current database.',
    answer:'db.createCollection("products");',
    explain:'<code>db.createCollection()</code> explicitly creates a new, empty collection in the current database. You can also create a collection implicitly by inserting the first document into it.',
    check:c=>{
      const mk = called(c,'createCollection');
      if (!mk.length) return false;
      const g = gate(); if (g) return g;
      if (!P()) return `You created <code>${esc(mk[0].coll)}</code>. The inventory collection must be named <code>products</code>.`;
      return true;
    },
    note:'<code>{ ok: 1 }</code> means the server created it. Next, check that it’s there.' },

  { group:'Create', title:'Now it is created',
    story:'She wants proof that the inventory exists.',
    ask:'List the collections in the current database.',
    answer:'show collections',
    explain:'<code>show collections</code> lists every collection in the current database.',
    check:c=>{
      if (!c.special || c.special.type !== 'showcolls') return false;
      return gate() || (P() ? true : 'No <code>products</code> collection here yet. Go back one question and create it.');
    },
    note:'<code>products</code> is listed. Run <code>show dbs</code> again and <code>LusciousJewels</code> now appears, because it holds a collection.' },

  { group:'Create', title:'Add one product',
    story:'She wants to store the details of her first product.',
    ask:'Insert one document into <code>products</code>:',
    table:[['name','price','category','stock'],['Gold Necklace',2500,'Necklace',15]],
    answer:'db.products.insertOne({\n  name: "Gold Necklace",\n  price: 2500,\n  category: "Necklace",\n  stock: 15\n});',
    explain:'<code>insertOne()</code> stores a single document. Because you gave no <code>_id</code>, MongoDB generated an <code>ObjectId</code>, which you can see in <code>insertedId</code>.',
    check:c=>{
      const ins = called(c,'insertOne').concat(called(c,'insertMany'));
      if (!ins.length) return false;
      const g = gate(); if (g) return g;
      if (ins.every(x=>x.coll !== 'products')) return `You inserted into <code>${esc(ins[0].coll)}</code>. The collection is <code>products</code>.`;
      const gn = byName('Gold Necklace');
      if (!gn.length) return 'No document named <code>"Gold Necklace"</code> found. Check the spelling and capital letters of <code>name</code>.';
      if (gn.some(d=>d.price===2500 && d.category==='Necklace' && d.stock===15)) return true;
      if (gn.some(d=>typeof d.price === 'string' || typeof d.stock === 'string')) return 'The document went in, but <code>price</code> or <code>stock</code> was saved as text. Numbers take no quotes: <code>price: 2500</code>. Click <em>Reset to this question</em> and try again.';
      return 'The document went in, but a value doesn’t match the table. Click <em>Reset to this question</em> and insert it again.';
    },
    note:'One done. Look at the Data panel: the document has an <code>_id</code> that MongoDB added.' },

  { group:'Create', title:'Insert in bulk',
    story:'One is done. Then how does she insert in bulk? These four arrived together (one is a test entry she added by mistake).',
    ask:'Insert all four products into <code>products</code> with <strong>one</strong> command:',
    table:[['name','price','category','stock']].concat(fourItems),
    answer:'db.products.insertMany([\n  { name: "Silver Ring", price: 800, category: "Ring", stock: 20 },\n  { name: "Diamond Ring", price: 5200, category: "Ring", stock: 5 },\n  { name: "Pearl Earrings", price: 1200, category: "Earrings", stock: 30 },\n  { name: "Test Bangle", price: 0, category: "Bangle", stock: 0 }\n]);',
    explain:'<code>insertMany()</code> takes an <strong>array</strong> of documents (<code>[ {…}, {…} ]</code>) and inserts them in one round trip. <code>insertedIds</code> lists one <code>_id</code> per document.',
    check:c=>{
      const ins = called(c,'insertMany');
      if (!ins.length){ return called(c,'insertOne').length ? 'That added one at a time. This question needs one <code>insertMany([ … ])</code> call. Click <em>Reset to this question</em> first.' : false; }
      const g = gate(); if (g) return g;
      const miss = fourItems.filter(x=>!hasItem(x));
      if (!miss.length) return true;
      return `Still missing or different: <code>${miss.map(x=>esc(x[0])).join('</code>, <code>')}</code>. Check spelling, numbers without quotes, and the category. Click <em>Reset to this question</em> to start clean.`;
    },
    note:'Five products in stock. Time to read them back.' },

  { group:'Read', title:'Check all records',
    story:'She wants to see the whole inventory.',
    ask:'Show every document in <code>products</code>.',
    answer:'db.products.find();',
    explain:'<code>find()</code> with no filter (or <code>{}</code>) returns every document in the collection.',
    check:c=>{
      const f = called(c,'find','products');
      if (!f.length) return false;
      return gate() || (emptyFilter(f[0].args[0]) ? true : 'That used a filter. This question wants <strong>all</strong> records — call <code>find()</code> with no filter.');
    },
    note:'All five came back, each with its own <code>_id</code>.' },

  { group:'Read', title:'Filter the records',
    story:'A customer asks: “Which rings do you have?”',
    ask:'Find only the products whose <code>category</code> is <code>"Ring"</code>.',
    answer:'db.products.find({ category: "Ring" });',
    explain:'The filter <code>{ category: "Ring" }</code> keeps only documents whose <code>category</code> equals <code>"Ring"</code>. Matching is case-sensitive.',
    check:c=>{
      const f = called(c,'find','products');
      if (!f.length) return false;
      const g = gate(); if (g) return g;
      const flt = f[0].args[0];
      if (eq(flt, {category:'Ring'})) return true;
      if (isObj(flt) && typeof flt.category === 'string' && flt.category.toLowerCase() === 'ring') return 'Close! Values are case-sensitive: <code>"Ring"</code> with a capital R.';
      return 'Filter on the <code>category</code> field: <code>{ category: "Ring" }</code>.';
    },
    note:'Two rings: Silver and Diamond.' },

  { group:'Update', title:'Update one price',
    story:'Gold prices went up. She needs to change one product.',
    ask:'Set the price of <code>"Gold Necklace"</code> to <code>3000</code>.',
    answer:'db.products.updateOne(\n  { name: "Gold Necklace" },\n  { $set: { price: 3000 } }\n);',
    explain:'<code>updateOne(filter, update)</code> changes the <strong>first</strong> matching document. <code>$set</code> changes only the fields you list and leaves the rest alone.',
    check:c=>{
      const u = called(c,'updateOne','products'), um = called(c,'updateMany','products');
      if (!u.length && !um.length) return false;
      const g = gate(); if (g) return g;
      if (!u.length) return 'That works, but this question practises <code>updateOne</code>.';
      const r = u[0].result;
      if (r.matchedCount === 0) return '<code>matchedCount: 0</code> — the filter found nothing. Filter on <code>{ name: "Gold Necklace" }</code>.';
      if (byName('Gold Necklace').some(d=>d.price === 3000)) return true;
      return 'The filter matched, but the price isn’t <code>3000</code> (a number). Use <code>{ $set: { price: 3000 } }</code>.';
    },
    note:'<code>matchedCount: 1, modifiedCount: 1</code> — one found, one changed.' },

  { group:'Update', title:'Update many prices',
    story:'A ring promotion: every ring now sells at one flat price.',
    ask:'Set <code>price</code> to <code>1500</code> for <strong>every</strong> product in category <code>"Ring"</code>, in one command.',
    answer:'db.products.updateMany(\n  { category: "Ring" },\n  { $set: { price: 1500 } }\n);',
    explain:'<code>updateMany()</code> applies the update to <strong>all</strong> documents that match the filter.',
    check:c=>{
      const um = called(c,'updateMany','products'), u = called(c,'updateOne','products');
      if (!um.length && !u.length) return false;
      const g = gate(); if (g) return g;
      if (!um.length) return '<code>updateOne</code> changes just the first match. Use <code>updateMany</code> to reach every ring.';
      const rings = docs().filter(d=>d.category === 'Ring');
      if (rings.length >= 2 && rings.every(d=>d.price === 1500)) return true;
      return 'Not every ring is at <code>1500</code> yet. Filter <code>{ category: "Ring" }</code>, update <code>{ $set: { price: 1500 } }</code>.';
    },
    note:'<code>matchedCount: 2, modifiedCount: 2</code> — both rings repriced.' },

  { group:'Update', title:'Upsert',
    story:'She isn’t sure the <em>Ruby Ring</em> was ever entered. If it’s there, update it; if not, create it.',
    ask:'For <code>name: "Ruby Ring"</code>, set <code>price: 1800</code>, <code>category: "Ring"</code>, <code>stock: 12</code> — creating the document if it doesn’t exist. One command.',
    answer:'db.products.updateOne(\n  { name: "Ruby Ring" },\n  { $set: { price: 1800, category: "Ring", stock: 12 } },\n  { upsert: true }\n);',
    explain:'<code>{ upsert: true }</code> means “update if found, insert if not”. Nothing matched, so MongoDB built a new document from the filter (<code>name</code>) plus the <code>$set</code> fields.',
    check:c=>{
      const u = called(c,'updateOne','products').concat(called(c,'updateMany','products'));
      if (!u.length) return false;
      const g = gate(); if (g) return g;
      const ups = u.some(x=>x.args[2] && x.args[2].upsert === true);
      if (!ups) return '<code>matchedCount: 0</code> — Ruby Ring doesn’t exist, so nothing changed. Add a third argument: <code>{ upsert: true }</code>.';
      if (byName('Ruby Ring').some(d=>d.price===1800 && d.category==='Ring' && d.stock===12)) return true;
      return 'Ruby Ring exists now, but its values don’t match. Click <em>Reset to this question</em> and set all three fields in <code>$set</code>.';
    },
    note:'<code>upsertedCount: 1</code> and <code>insertedId</code> holds the new document’s <code>_id</code>.' },

  { group:'Delete', title:'Delete one wrong product',
    story:'Time to delete the wrong product: the test entry.',
    ask:'Delete the product named <code>"Test Bangle"</code>.',
    answer:'db.products.deleteOne({ name: "Test Bangle" });',
    explain:'<code>deleteOne(filter)</code> removes the first document that matches the filter.',
    check:c=>{
      const d = called(c,'deleteOne','products'), dm = called(c,'deleteMany','products');
      if (!d.length && !dm.length) return false;
      const g = gate(); if (g) return g;
      if (!d.length) return 'This question practises <code>deleteOne</code>. Click <em>Reset to this question</em> and try again.';
      if (d[0].result.deletedCount === 0) return '<code>deletedCount: 0</code> — nothing matched. Filter on <code>{ name: "Test Bangle" }</code>.';
      if (byName('Test Bangle').length) return 'Something was deleted, but the Test Bangle is still there. Check the filter.';
      if (docs().length < 5) return 'The wrong product was removed. Click <em>Reset to this question</em> and filter on <code>{ name: "Test Bangle" }</code>.';
      return true;
    },
    note:'<code>deletedCount: 1</code>. The test entry is gone.' },

  { group:'Delete', title:'Delete by filter',
    story:'She has discontinued her earrings line.',
    ask:'Delete <strong>every</strong> product in category <code>"Earrings"</code>, and nothing else, in one command.',
    answer:'db.products.deleteMany({ category: "Earrings" });',
    explain:'<code>deleteMany(filter)</code> removes <strong>all</strong> documents that match the filter.',
    check:c=>{
      const dm = called(c,'deleteMany','products'), d = called(c,'deleteOne','products');
      if (!dm.length && !d.length) return false;
      const g = gate(); if (g) return g;
      if (!dm.length) return 'Use <code>deleteMany</code> so every earring goes, even if there were several.';
      if (!docs().length) return 'That emptied the whole collection! <code>{}</code> matches everything. Click <em>Reset to this question</em> and filter by category.';
      if (docs().some(x=>x.category === 'Earrings')) return 'Earrings are still there. Filter <code>{ category: "Earrings" }</code>.';
      if (docs().length < 4) return 'Something besides earrings was removed. Click <em>Reset to this question</em>.';
      return true;
    },
    note:'Only the earrings went. Necklace and rings remain.' },

  { group:'Delete', title:'Delete everything',
    story:'End-of-season stocktake: she wants to clear every product but keep the <code>products</code> collection for new stock.',
    ask:'Delete <strong>all</strong> documents in <code>products</code> — but keep the collection.',
    answer:'db.products.deleteMany({});',
    explain:'The empty filter <code>{}</code> matches every document, so <code>deleteMany({})</code> empties the collection. The collection and its indexes stay.',
    check:c=>{
      const dm = called(c,'deleteMany','products'), dr = called(c,'drop','products');
      if (dr.length && !P()) return '<code>drop()</code> deleted the collection itself. Here the collection must stay. Click <em>Reset to this question</em>.';
      if (!dm.length) return false;
      const g = gate(); if (g) return g;
      return (P() && !docs().length) ? true : 'Some documents remain. Use the empty filter <code>{}</code>.';
    },
    note:'The collection is empty but still exists — check with <code>show collections</code>.' },

  { group:'Drop', title:'Drop a collection',
    story:'She’ll rebuild the inventory from scratch, so the old collection can go completely.',
    ask:'Drop the <code>products</code> collection.',
    answer:'db.products.drop();',
    explain:'<code>db.collectionName.drop()</code> removes the collection with all its documents and indexes. It returns <code>true</code> if the collection existed.',
    check:c=>{
      const dr = called(c,'drop');
      if (!dr.length) return false;
      const g = gate(); if (g) return g;
      if (dr[0].coll !== 'products') return `You dropped <code>${esc(dr[0].coll)}</code>. Drop <code>products</code>.`;
      return !P() ? true : false;
    },
    note:'<code>true</code> — dropped. (The database itself is gone too, because it now has no collections.)' },

  { group:'Capped', title:'Create a capped collection',
    story:'For the new inventory she wants a fixed size: never more than 500 KB or 1,000 products. When it’s full, the oldest documents roll off.',
    ask:'Create a <strong>capped</strong> collection named <code>products</code> with <code>size: 500000</code> and <code>max: 1000</code>.',
    answer:'db.createCollection("products", {\n  capped: true,\n  size: 500000,   // 500 KB\n  max: 1000       // optional: max number of documents\n});',
    explain:'A capped collection has a fixed size and keeps insertion order. <code>size</code> (bytes) is required; <code>max</code> (document count) is optional. When it’s full, new inserts overwrite the oldest documents.',
    check:c=>{
      const mk = called(c,'createCollection');
      if (!mk.length) return false;
      const g = gate(); if (g) return g;
      const p = P();
      if (!p) return `You created <code>${esc(mk[0].coll)}</code>. Name it <code>products</code>.`;
      if (!p.capped) return 'That’s a normal collection. Pass options: <code>{ capped: true, size: 500000, max: 1000 }</code>. Drop it first with <code>db.products.drop()</code>.';
      if (p.size !== 500000 || p.max !== 1000) return 'It’s capped, but use <code>size: 500000</code> and <code>max: 1000</code>. Drop it and create it again.';
      return true;
    },
    note:'Capped <code>products</code> is ready. The Data panel marks it <span style="color:#946F3F;font-weight:bold">capped</span>.' },

  { group:'Capped', title:'Is it capped?',
    story:'She wants the shell to confirm the new collection is capped.',
    ask:'Ask MongoDB whether <code>products</code> is a capped collection.',
    answer:'db.products.isCapped();',
    explain:'<code>isCapped()</code> returns <code>true</code> for a capped collection and <code>false</code> otherwise.',
    check:c=>{
      const ic = called(c,'isCapped');
      if (!ic.length) return false;
      const g = gate(); if (g) return g;
      if (ic[0].coll !== 'products') return 'Call it on <code>db.products</code>.';
      return ic[0].result === true ? true : '<code>false</code> — <code>products</code> isn’t capped. Go back one question.';
    },
    note:'<code>true</code> — confirmed.' },

  { group:'Drop', title:'Drop the database',
    story:'Lab over. Clean up the cluster.',
    ask:'Drop the entire <code>LusciousJewels</code> database.',
    answer:'db.dropDatabase();',
    explain:'<code>db.dropDatabase()</code> deletes the <strong>current</strong> database with all its collections. Check the prompt to make sure you’re in the right one first.',
    check:c=>{
      if (!called(c,'dropDatabase').length) return false;
      if (c.value && c.value.dropped !== 'LusciousJewels') return `That dropped <code>${esc(c.value.dropped)}</code>. Switch with <code>use LusciousJewels</code> and run it again.`;
      return !S.dbs.LusciousJewels;
    },
    note:'<code>{ ok: 1, dropped: \'LusciousJewels\' }</code>. Thank you!' }
];

(window.CHAPTERS = window.CHAPTERS || []).push({
  id: 'ch01', num: '01', title: 'CRUD Operations', href: 'index.html', story: 'Luscious Jewels',
  key: 'lj-atlas-shell-lab-v1',
  host: 'Atlas atlas-lj7k2q-shard-0 [primary]',
  cluster: 'lusciousjewels.lj7k2q.mongodb.net',
  startNote: 'fresh cluster',
  dataset: {
    db: 'LusciousJewels', coll: 'products',
    docs: [{ name:'Gold Necklace', price:2500, category:'Necklace', stock:15 }].concat(fourItems.map(([name,price,category,stock])=>({ name, price, category, stock }))),
    note: 'The Luscious Jewels inventory as it stands after Question 6 (one insertOne plus the insertMany batch). Load it to practise the read, update and delete questions in a real shell.'
  },
  tasks: CH02_TASKS,
  finish: {
    tag: 'Chapter 01 complete', title: 'Thank you!',
    text: `You ran all ${CH02_TASKS.length} CRUD operations for Luscious Jewels on the Atlas shell.`,
    note: 'Create → Read → Update → Delete → Drop → Capped → Upsert.'
  }
});
