/* ============================================================
   Chapter 03 · Embedding & Referencing — Ancient Egypt
   Built from the deck's examples: embedded pharaohs and tombs,
   referenced battles, pyramids with architects, and the
   many-to-many gods ↔ temples. Referenced documents use readable
   string _ids ("P1001", "B2001") so the dataset runs as-is in a
   real shell; the deck's ObjectId("P1001") is shorthand.
   ============================================================ */
const EGYPT = {
  countries: [
    { country:'Egypt', capital:'Cairo',
      pharaohs:[ { name:'Tutankhamun', period:'1332-1323 BC' }, { name:'Ramesses II', period:'1279-1213 BC' } ],
      cities:['Cairo','Giza','Luxor','Aswan'] },
    { country:'Sudan', capital:'Khartoum',
      pharaohs:[ { name:'Taharqa', period:'690-664 BC' } ],
      cities:['Khartoum','Karima','Meroe'] }
  ],
  pharaohs: [
    { _id:'P1001', name:'Ramesses II', reign:'1279-1213 BC', dynasty:19, burial_tomb:{ name:'KV7', location:'Valley of the Kings' }, battle_ids:['B2001','B2002','B2003'] },
    { _id:'P1002', name:'Tutankhamun', reign:'1332-1323 BC', dynasty:18, battle_ids:[] },
    { _id:'P1003', name:'Seti I', reign:'1290-1279 BC', dynasty:19, burial_tomb:{ name:'KV17', location:'Valley of the Kings' }, battle_ids:['B2004'] },
    { _id:'P1004', name:'Thutmose III', reign:'1479-1425 BC', dynasty:18, burial_tomb:{ name:'KV34', location:'Valley of the Kings' }, battle_ids:['B2005'] },
    { _id:'P1005', name:'Khufu', reign:'2589-2566 BC', dynasty:4, burial_tomb:{ name:"King's Chamber", location:'Great Pyramid of Giza' }, battle_ids:[] }
  ],
  battles: [
    { _id:'B2001', name:'Battle of Kadesh', year:'1274 BC', location:'Syria', enemies:['Hittites'] },
    { _id:'B2002', name:'Battle of Dapur', year:'1269 BC', location:'Lebanon', enemies:['Syrians'] },
    { _id:'B2003', name:'Battle of the Delta', year:'1278 BC', location:'Nile Delta', enemies:['Sherden'] },
    { _id:'B2004', name:'Capture of Kadesh', year:'1306 BC', location:'Syria', enemies:['Hittites'] },
    { _id:'B2005', name:'Battle of Megiddo', year:'1457 BC', location:'Canaan', enemies:['Canaanites','Mitanni'] }
  ],
  pyramids: [
    { name:'Pyramid of Djoser', completed_in:'2650 BC', location:'Saqqara', architects:[ { name:'Imhotep', role:'Chief Architect' } ] },
    { name:'Bent Pyramid', completed_in:'2600 BC', location:'Dahshur', architects:[] }
  ],
  gods: [
    { _id:'G1', name:'Ra', temples:['T1','T2'] },
    { _id:'G2', name:'Amun', temples:['T1','T3'] },
    { _id:'G3', name:'Hathor', temples:['T3'] }
  ],
  temples: [
    { _id:'T1', name:'Karnak Temple', location:'Luxor', gods:['G1','G2'] },
    { _id:'T2', name:'Luxor Temple', location:'Luxor', gods:['G1'] },
    { _id:'T3', name:'Dendera Temple', location:'Qena', gods:['G2','G3'] }
  ]
};

const CH03_TASKS = [
  /* ---------- Embedding ---------- */
  { group:'Embedding', kind:'find', coll:'countries', title:'Open the embedded document',
    story:'<b>The expedition</b> has catalogued Ancient Egypt in the <code>AncientEgypt</code> database: 6 collections, linked in two different ways. <b>Embedding</b> means storing related data <em>inside the same document</em>.',
    ask:'Find the country <code>"Egypt"</code> in <code>countries</code> and look at how its pharaohs are stored.',
    answer:'db.countries.find({ country: "Egypt" })',
    explain:'The pharaohs live <em>inside</em> the Egypt document as an array of sub-documents. One read returns everything. MongoDB allows nesting up to 100 levels, and a whole document must stay under 16 MB.',
    note:'One document, with <code>pharaohs</code> and <code>cities</code> embedded in it.' },
  { group:'Embedding', kind:'find', coll:'countries', ops:['pharaohs.name'], title:'Query inside an embedded array',
    ask:'Find the country that has a pharaoh named <code>"Ramesses II"</code>. Reach into the embedded array with dot notation: <code>"pharaohs.name"</code>.',
    answer:'db.countries.find({ "pharaohs.name": "Ramesses II" })',
    explain:'Dot notation (<code>"pharaohs.name"</code>) reaches into every sub-document of the array. A path with a dot must be in quotes.',
    note:'Egypt. Sudan’s only pharaoh is Taharqa.' },
  { group:'Embedding', kind:'update', coll:'countries', method:'updateOne', ops:['$push'], title:'Embed one more pharaoh',
    ask:'Add the pharaoh <code>{ name: "Khufu", period: "2589-2566 BC" }</code> to Egypt’s embedded <code>pharaohs</code> array.',
    answer:'db.countries.updateOne(\n  { country: "Egypt" },\n  { $push: { pharaohs: { name: "Khufu", period: "2589-2566 BC" } } }\n)',
    diffHint:'Type the values exactly: <code>"2589-2566 BC"</code> uses a plain hyphen <code>-</code>.',
    explain:'<code>$push</code> appends a whole sub-document to the embedded array. Embedding suits data that is always read together and stays small.',
    note:'Egypt now embeds three pharaohs.' },

  /* ---------- 1 → 1 ---------- */
  { group:'1 → 1', kind:'update', coll:'pharaohs', method:'updateOne', ops:['$set'], title:'Embed a burial tomb',
    story:'Which to use? <b>Easy to remember</b> — and every relationship type gets its own questions below.',
    table:[['Relationship','Embed?','Reference?','Why?'],
           ['1 → 1','Yes','Optional','Data always used together'],
           ['1 → Few','Yes','Optional','Small, tightly coupled'],
           ['1 → Many (small)','Maybe','Better','If it may grow → reference'],
           ['1 → Many (large)','No','Yes','Large, grows independently'],
           ['Many ↔ Many','No','Yes','Both sides unlimited']],
    ask:'One pharaoh has one tomb. Give <code>"Tutankhamun"</code> (in <code>pharaohs</code>) an embedded <code>burial_tomb</code>: <code>{ name: "KV62", location: "Valley of the Kings" }</code>.',
    answer:'db.pharaohs.updateOne(\n  { name: "Tutankhamun" },\n  { $set: { burial_tomb: { name: "KV62", location: "Valley of the Kings" } } }\n)',
    explain:'<strong>1 → 1 (embed).</strong> The tomb belongs to exactly one pharaoh and is read with it, so it lives inside the pharaoh document. <code>$set</code> with an object value embeds it.',
    note:'Tutankhamun now has <code>burial_tomb: { name: \'KV62\', … }</code>.' },
  { group:'1 → 1', kind:'find', coll:'pharaohs', ops:['burial_tomb.location'], title:'Query an embedded field',
    ask:'Find every pharaoh whose <code>burial_tomb.location</code> is <code>"Valley of the Kings"</code>.',
    answer:'db.pharaohs.find({ "burial_tomb.location": "Valley of the Kings" })',
    explain:'Dot notation works on embedded documents too: <code>"burial_tomb.location"</code>.',
    note:'Four pharaohs — Khufu lies in the Great Pyramid instead.' },

  /* ---------- 1 → Few ---------- */
  { group:'1 → Few', kind:'update', coll:'pyramids', method:'insertOne', title:'Pyramid with its architects',
    ask:'Insert the Great Pyramid into <code>pyramids</code> with its few architects embedded:',
    table:[['field','value'],['name','Great Pyramid of Giza'],['completed_in','2560 BC'],['location','Giza'],['architects','[ { name: "Hemiunu", role: "Chief Architect" }, { name: "Ankhhaf", role: "Designer" } ]']],
    answer:'db.pyramids.insertOne({\n  name: "Great Pyramid of Giza",\n  completed_in: "2560 BC",\n  location: "Giza",\n  architects: [\n    { name: "Hemiunu", role: "Chief Architect" },\n    { name: "Ankhhaf", role: "Designer" }\n  ]\n})',
    explain:'<strong>1 → Few (embed).</strong> A pyramid has only a few architects and the list rarely grows, so an embedded array is ideal.',
    note:'Three pyramids now.' },
  { group:'1 → Few', kind:'find', coll:'pyramids', ops:['architects.role'], title:'Find by an embedded role',
    ask:'Find the pyramids that had an architect with the role <code>"Chief Architect"</code>.',
    answer:'db.pyramids.find({ "architects.role": "Chief Architect" })',
    explain:'<code>"architects.role"</code> matches if <em>any</em> embedded architect has that role.',
    note:'Djoser (Imhotep) and the Great Pyramid (Hemiunu).' },

  /* ---------- 1 → Many (small) ---------- */
  { group:'1 → Many (small)', kind:'update', coll:'countries', method:'updateOne', ops:['$addToSet'], title:'Grow the city list',
    ask:'Egypt’s <code>cities</code> list is small but can grow. Add <code>"Alexandria"</code> — only if it isn’t there yet.',
    answer:'db.countries.updateOne(\n  { country: "Egypt" },\n  { $addToSet: { cities: "Alexandria" } }\n)',
    explain:'<strong>1 → Many (small): embed or reference.</strong> A short list can stay embedded, but if it may keep growing, referencing is safer.',
    note:'Five cities embedded in Egypt.' },
  { group:'1 → Many (small)', kind:'find', coll:'countries', title:'Find by a city',
    ask:'Find the country whose <code>cities</code> include <code>"Luxor"</code>.',
    answer:'db.countries.find({ cities: "Luxor" })',
    explain:'For an array of plain values, <code>{ cities: "Luxor" }</code> matches when any element equals <code>"Luxor"</code>.',
    note:'Egypt.' },

  /* ---------- Referencing (1 → Many large) ---------- */
  { group:'Referencing', kind:'find', coll:'pharaohs', title:'See the references',
    story:'<b>Referencing</b> means storing related data in <em>separate documents</em> and connecting them by IDs. A pharaoh may have hundreds of battles, so <b>1 → Many (large)</b> is reference-only.',
    ask:'Find <code>"Ramesses II"</code> in <code>pharaohs</code>. Look at <code>battle_ids</code>.',
    answer:'db.pharaohs.find({ name: "Ramesses II" })',
    explain:'The pharaoh stores only the <code>_id</code>s of his battles. The battle details live in the <code>battles</code> collection. (Slides write these as <code>ObjectId("B2001")</code>; a real ObjectId is 24 hex characters, so this dataset uses readable string ids.)',
    note:'<code>battle_ids: [ \'B2001\', \'B2002\', \'B2003\' ]</code>.' },
  { group:'Referencing', kind:'find', coll:'battles', ops:['$in'], title:'Follow the references',
    ask:'Fetch Ramesses II’s battles from <code>battles</code>: the documents whose <code>_id</code> is <code>$in</code> his <code>battle_ids</code>.',
    answer:'db.battles.find({ _id: { $in: ["B2001", "B2002", "B2003"] } })',
    explain:'Resolving references is a second query. In one line: <code>db.battles.find({ _id: { $in: db.pharaohs.findOne({ name: "Ramesses II" }).battle_ids } })</code>.',
    note:'Kadesh, Dapur and the Delta.' },
  { group:'Referencing', kind:'find', coll:'pharaohs', title:'Who fought this battle?',
    ask:'Go the other way: find the pharaoh whose <code>battle_ids</code> contain <code>"B2002"</code> (Battle of Dapur).',
    answer:'db.pharaohs.find({ battle_ids: "B2002" })',
    explain:'Querying an array of ids works like any array: <code>{ battle_ids: "B2002" }</code> matches if the array contains it.',
    note:'Ramesses II.' },
  { group:'Referencing', kind:'update', coll:'battles', method:'insertOne', title:'Store a new battle',
    ask:'A new record for Thutmose III. Insert it into <code>battles</code>: <code>{ _id: "B2006", name: "Battle near Aleppo", year: "1446 BC", location: "Syria", enemies: ["Mitanni"] }</code>.',
    answer:'db.battles.insertOne({\n  _id: "B2006",\n  name: "Battle near Aleppo",\n  year: "1446 BC",\n  location: "Syria",\n  enemies: ["Mitanni"]\n})',
    explain:'Each battle is an independent document, so the collection can grow without making any pharaoh document bigger.',
    note:'Six battles. But no pharaoh points to <code>B2006</code> yet…' },
  { group:'Referencing', kind:'update', coll:'pharaohs', method:'updateOne', ops:[['$push','$addToSet']], title:'Link the reference',
    ask:'Connect it: add <code>"B2006"</code> to the <code>battle_ids</code> of <code>"Thutmose III"</code>.',
    answer:'db.pharaohs.updateOne(\n  { name: "Thutmose III" },\n  { $push: { battle_ids: "B2006" } }\n)',
    explain:'With referencing, saving related data is two writes: the battle document, then the id in the parent. <code>$addToSet</code> works too and avoids duplicates.',
    note:'Thutmose III: <code>[ \'B2005\', \'B2006\' ]</code>.' },

  /* ---------- Many ↔ Many ---------- */
  { group:'Many ↔ Many', kind:'find', coll:'temples', title:'Temples of Ra',
    story:'<b>Many ↔ Many (reference only).</b> Many gods are worshipped in many temples. Each god lists its temple ids, and each temple lists its god ids.',
    ask:'Find the temples where Ra (<code>_id: "G1"</code>) is worshipped, using the <code>gods</code> array in <code>temples</code>.',
    answer:'db.temples.find({ gods: "G1" })',
    explain:'Both sides hold references, so you can ask either way: temples for a god, or gods for a temple.',
    note:'Karnak and Luxor.' },
  { group:'Many ↔ Many', kind:'update', coll:'temples', method:'updateOne', ops:['$addToSet'], title:'Link both ways (1/2)',
    ask:'Amun (<code>"G2"</code>) is also worshipped at Luxor Temple (<code>"T2"</code>). First add <code>"G2"</code> to that temple’s <code>gods</code> — without duplicates.',
    answer:'db.temples.updateOne(\n  { _id: "T2" },\n  { $addToSet: { gods: "G2" } }\n)',
    explain:'Two-way references must be kept in sync by you: one side now, the other side next.',
    note:'Luxor Temple: <code>gods: [ \'G1\', \'G2\' ]</code>. Now the other side.' },
  { group:'Many ↔ Many', kind:'update', coll:'gods', method:'updateOne', ops:['$addToSet'], title:'Link both ways (2/2)',
    ask:'Now add <code>"T2"</code> to Amun’s (<code>"G2"</code>) <code>temples</code> in <code>gods</code>.',
    answer:'db.gods.updateOne(\n  { _id: "G2" },\n  { $addToSet: { temples: "T2" } }\n)',
    explain:'If you update only one side, the two collections disagree. Many ↔ Many references always need both writes.',
    note:'Amun: <code>temples: [ \'T1\', \'T3\', \'T2\' ]</code> — both sides agree.' },

  /* ---------- Joining references ---------- */
  { group:'Joining ($lookup)', kind:'agg', coll:'pharaohs', ops:['$lookup'], title:'Join battles into a pharaoh',
    story:'Instead of two queries, <code>$lookup</code> joins referenced documents in one <code>aggregate</code> pipeline — MongoDB’s LEFT OUTER JOIN.',
    ask:'For <code>"Ramesses II"</code> only, join his battles: <code>$match</code> the pharaoh, then <code>$lookup</code> from <code>battles</code> with <code>localField: "battle_ids"</code>, <code>foreignField: "_id"</code>, <code>as: "battles"</code>.',
    answer:'db.pharaohs.aggregate([\n  { $match: { name: "Ramesses II" } },\n  { $lookup: {\n      from: "battles",\n      localField: "battle_ids",\n      foreignField: "_id",\n      as: "battles"\n  } }\n])',
    explain:'<code>$lookup</code> finds every battle whose <code>_id</code> is in <code>battle_ids</code> and embeds the matches as the new array <code>battles</code> — in the result only; the stored data doesn’t change.',
    note:'Ramesses II with his three battle documents attached.' },
  { group:'Joining ($lookup)', kind:'agg', coll:'gods', ops:['$lookup'], title:'Join temples into every god',
    ask:'For <strong>every</strong> god, join the temple documents: <code>$lookup</code> from <code>temples</code>, <code>localField: "temples"</code>, <code>foreignField: "_id"</code>, <code>as: "temple_docs"</code>.',
    answer:'db.gods.aggregate([\n  { $lookup: {\n      from: "temples",\n      localField: "temples",\n      foreignField: "_id",\n      as: "temple_docs"\n  } }\n])',
    explain:'With no <code>$match</code>, the join runs for every god. Each god gets <code>temple_docs</code>: the full temple documents its ids point to.',
    note:'Ra, Amun and Hathor, each with their temples attached. Expedition complete!' }
];

(window.CHAPTERS = window.CHAPTERS || []).push({
  id: 'ch03', num: '03', title: 'Embedding & Referencing', href: 'chapter03.html', story: 'Ancient Egypt',
  key: 'ancient-egypt-ch03-v1',
  host: 'Atlas atlas-eg5p2r-shard-0 [primary]',
  cluster: 'ancientegypt.eg5p2r.mongodb.net',
  db: 'AncientEgypt',
  coll: 'pharaohs',
  startNote: 'AncientEgypt loaded — 6 collections',
  dataset: {
    db: 'AncientEgypt', collections: EGYPT,
    note: 'Six collections: countries and pyramids show embedding; pharaohs → battles and gods ↔ temples show referencing by _id. The questions change the data as they go, so reload it to start again.'
  },
  init(){
    let n = 0;
    const colls = {};
    Object.keys(EGYPT).forEach(c=>{
      colls[c] = { capped:false, docs: EGYPT[c].map(d=>prepDoc(d._id !== undefined ? d : Object.assign({ _id: new ObjectId('6650e9d0' + (++n).toString(16).padStart(16,'0')) }, d))) };
    });
    return { cur:'AncientEgypt', dbs:{ AncientEgypt:{ colls } } };
  },
  tasks: CH03_TASKS,
  finish: {
    tag: 'Chapter 03 complete', title: 'Expedition complete',
    text: `You worked through all ${CH03_TASKS.length} embedding and referencing tasks in Ancient Egypt.`,
    note: 'Embed: 1 → 1, 1 → Few, small 1 → Many. Reference: large 1 → Many, Many ↔ Many — and join them with $lookup.'
  }
});
