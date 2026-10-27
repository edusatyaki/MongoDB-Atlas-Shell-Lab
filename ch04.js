/* ============================================================
   Chapter 04 · Aggregation Pipeline — Data Factory
   Built from Lecture 04: the pipeline idea (output of one stage
   feeds the next), $lookup to join users ↔ orders, $group as SQL's
   GROUP BY (count, sum, average, min/max), $sort, and the deck's
   combined join → group → sort example.
   ============================================================ */
const FACTORY = {
  users: [
    { _id:1, name:'Amit', city:'Delhi' },
    { _id:2, name:'Priya', city:'Mumbai' },
    { _id:3, name:'Rahul', city:'Bengaluru' },
    { _id:4, name:'Sneha', city:'Pune' },
    { _id:5, name:'Arjun', city:'Delhi' },
    { _id:6, name:'Kavya', city:'Hyderabad' }
  ],
  orders: [
    { orderId:101, userId:1, product:'Laptop', category:'Electronics', price:50000, status:'delivered' },
    { orderId:102, userId:2, product:'Mobile', category:'Electronics', price:20000, status:'delivered' },
    { orderId:103, userId:3, product:'Laptop', category:'Electronics', price:55000, status:'delivered' },
    { orderId:104, userId:1, product:'Headphones', category:'Accessories', price:3000, status:'delivered' },
    { orderId:105, userId:2, product:'Laptop', category:'Electronics', price:52000, status:'delivered' },
    { orderId:106, userId:4, product:'Mobile', category:'Electronics', price:18000, status:'delivered' },
    { orderId:107, userId:3, product:'Keyboard', category:'Accessories', price:2500, status:'delivered' },
    { orderId:108, userId:5, product:'Mobile', category:'Electronics', price:22000, status:'cancelled' },
    { orderId:109, userId:4, product:'Headphones', category:'Accessories', price:3500, status:'delivered' },
    { orderId:110, userId:1, product:'Mobile', category:'Electronics', price:21000, status:'delivered' },
    { orderId:111, userId:5, product:'Keyboard', category:'Accessories', price:2000, status:'cancelled' },
    { orderId:112, userId:3, product:'Headphones', category:'Accessories', price:4000, status:'delivered' }
  ],
  products: [
    { product:'Laptop', category:'Electronics', price:55000, stock:8 },
    { product:'Mobile', category:'Electronics', price:20000, stock:25 },
    { product:'Tablet', category:'Electronics', price:30000, stock:12 },
    { product:'Monitor', category:'Electronics', price:15000, stock:10 },
    { product:'Headphones', category:'Accessories', price:3500, stock:40 },
    { product:'Keyboard', category:'Accessories', price:2500, stock:30 }
  ]
};

const CH04_TASKS = [
  /* ---------- Pipeline basics ---------- */
  { group:'Pipeline basics', kind:'agg', coll:'orders', ops:['$match'], title:'A one-stage pipeline',
    story:'<b>Data Factory</b> runs the campus store: <code>users</code>, <code>orders</code> and <code>products</code> in the <code>DataFactory</code> database. An <b>aggregation pipeline</b> pushes documents through stages — the output of one stage is the input of the next, like Admission → First Year → … → Farewell.',
    ask:'Write a pipeline with a single <code>$match</code> stage that keeps only the <code>orders</code> for the product <code>"Laptop"</code>.',
    answer:'db.orders.aggregate([\n  { $match: { product: "Laptop" } }\n])',
    sql:"SELECT *\nFROM orders\nWHERE product = 'Laptop';",
    explain:'<code>aggregate()</code> takes an <strong>array of stages</strong>. <code>$match</code> filters exactly like <code>find()</code> — put it early so later stages handle fewer documents.',
    note:'Three laptop orders: 101, 103 and 105.' },
  { group:'Pipeline basics', kind:'agg', coll:'orders', ops:['$match','$count'], title:'Two stages, one flow',
    ask:'Count the delivered orders: <code>$match</code> <code>status: "delivered"</code>, then a <code>$count</code> stage that names the result <code>"delivered"</code>.',
    answer:'db.orders.aggregate([\n  { $match: { status: "delivered" } },\n  { $count: "delivered" }\n])',
    sql:"SELECT COUNT(*) AS delivered\nFROM orders\nWHERE status = 'delivered';",
    explain:'Stage 1 passes only delivered orders to stage 2, which replaces them with a single document holding the count.',
    note:'<code>{ delivered: 10 }</code> — two of the twelve orders were cancelled.' },

  /* ---------- $sort ---------- */
  { group:'$sort', kind:'agg', coll:'products', ops:['$sort'], ordered:true, title:'Price, high to low',
    story:'<b>$sort</b> orders documents: <code>1</code> → ascending, <code>-1</code> → descending.',
    ask:'Sort <code>products</code> by <code>price</code> from high to low.',
    answer:'db.products.aggregate([\n  { $sort: { price: -1 } }\n])',
    sql:'SELECT *\nFROM products\nORDER BY price DESC;',
    explain:'<code>{ price: -1 }</code> sorts descending. Use <code>1</code> for low to high.',
    note:'Laptop (55000) first, Keyboard (2500) last.' },
  { group:'$sort', kind:'agg', coll:'orders', ops:['$sort','$limit'], ordered:true, title:'Top 3 orders',
    ask:'Find the 3 most expensive <code>orders</code>: <code>$sort</code> by <code>price</code> descending, then <code>$limit</code> to 3.',
    answer:'db.orders.aggregate([\n  { $sort: { price: -1 } },\n  { $limit: 3 }\n])',
    sql:'SELECT *\nFROM orders\nORDER BY price DESC\nLIMIT 3;',
    explain:'Order matters: sort first, then keep the first 3. Limiting before sorting would keep 3 arbitrary orders.',
    note:'Orders 103 (55000), 105 (52000) and 101 (50000) — all laptops.' },

  /* ---------- $group ---------- */
  { group:'$group', kind:'agg', coll:'orders', ops:['$group','$sum'], title:'Total sales per product',
    story:'<b>$group</b> is SQL’s GROUP BY. <code>_id</code> is the grouping key (a field path like <code>"$product"</code>), and every other field is an accumulator: <code>$sum</code>, <code>$avg</code>, <code>$min</code>, <code>$max</code>…',
    ask:'Total sales per product: group <code>orders</code> by <code>"$product"</code> with <code>totalSales: { $sum: "$price" }</code>.',
    answer:'db.orders.aggregate([\n  { $group: {\n      _id: "$product",\n      totalSales: { $sum: "$price" }\n  } }\n])',
    sql:'SELECT product AS _id, SUM(price) AS \"totalSales\"\nFROM orders\nGROUP BY product;',
    explain:'The <code>$</code> in <code>"$product"</code> means “the value of the field”. Each distinct product becomes one output document.',
    note:'Laptop 157000, Mobile 81000, Headphones 10500, Keyboard 4500.' },
  { group:'$group', kind:'agg', coll:'orders', ops:['$group',['$sum','$count']], title:'Count per product',
    ask:'Count the orders per product: group by <code>"$product"</code> with <code>orders: { $sum: 1 }</code>.',
    answer:'db.orders.aggregate([\n  { $group: {\n      _id: "$product",\n      orders: { $sum: 1 }\n  } }\n])',
    sql:'SELECT product AS _id, COUNT(*) AS orders\nFROM orders\nGROUP BY product;',
    explain:'<code>{ $sum: 1 }</code> adds 1 for every document in the group — that’s a count. (<code>{ $count: {} }</code> does the same.)',
    note:'Mobile 4, Laptop 3, Headphones 3, Keyboard 2.' },
  { group:'$group', kind:'agg', coll:'orders', ops:['$group','$avg'], title:'Average price per category',
    ask:'Average order price per category: group by <code>"$category"</code> with <code>avgPrice: { $avg: "$price" }</code>.',
    answer:'db.orders.aggregate([\n  { $group: {\n      _id: "$category",\n      avgPrice: { $avg: "$price" }\n  } }\n])',
    sql:'SELECT category AS _id, AVG(price) AS \"avgPrice\"\nFROM orders\nGROUP BY category;',
    explain:'<code>$avg</code> averages the numeric values in each group.',
    note:'Electronics 34000, Accessories 3000.' },
  { group:'$group', kind:'agg', coll:'orders', ops:['$group','$min','$max'], title:'Cheapest and dearest',
    ask:'Per product, find the lowest and highest order price: group by <code>"$product"</code> with <code>cheapest: { $min: "$price" }</code> and <code>priciest: { $max: "$price" }</code>.',
    answer:'db.orders.aggregate([\n  { $group: {\n      _id: "$product",\n      cheapest: { $min: "$price" },\n      priciest: { $max: "$price" }\n  } }\n])',
    sql:'SELECT product AS _id, MIN(price) AS cheapest, MAX(price) AS priciest\nFROM orders\nGROUP BY product;',
    explain:'A single <code>$group</code> can compute several accumulators at once.',
    note:'Laptop 50000–55000, Mobile 18000–22000, Headphones 3000–4000, Keyboard 2000–2500.' },
  { group:'$group', kind:'agg', coll:'orders', ops:['$group','$sum'], title:'One grand total',
    ask:'Total revenue and order count across <strong>all</strong> orders: group with <code>_id: null</code>, <code>revenue: { $sum: "$price" }</code> and <code>orders: { $sum: 1 }</code>.',
    answer:'db.orders.aggregate([\n  { $group: {\n      _id: null,\n      revenue: { $sum: "$price" },\n      orders: { $sum: 1 }\n  } }\n])',
    sql:'SELECT SUM(price) AS revenue, COUNT(*) AS orders\nFROM orders;',
    explain:'<code>_id: null</code> puts every document in one group — a total for the whole collection.',
    note:'<code>{ _id: null, revenue: 253000, orders: 12 }</code>.' },
  { group:'$group', kind:'agg', coll:'orders', ops:['$group','$sort'], ordered:true, title:'Group, then sort',
    ask:'Total sales per product, best seller first: <code>$group</code> by <code>"$product"</code> with <code>totalSales: { $sum: "$price" }</code>, then <code>$sort</code> by <code>totalSales</code> descending.',
    answer:'db.orders.aggregate([\n  { $group: { _id: "$product", totalSales: { $sum: "$price" } } },\n  { $sort: { totalSales: -1 } }\n])',
    sql:'SELECT product AS _id, SUM(price) AS \"totalSales\"\nFROM orders\nGROUP BY product\nORDER BY \"totalSales\" DESC;',
    explain:'<code>$group</code> output has no guaranteed order. The next stage sorts on the field <code>$group</code> just created.',
    note:'Laptop, Mobile, Headphones, Keyboard.' },
  { group:'$group', kind:'agg', coll:'orders', ops:['$match','$group'], title:'Filter, then group',
    ask:'Spending per user on <strong>delivered</strong> orders only: <code>$match</code> <code>status: "delivered"</code>, then <code>$group</code> by <code>"$userId"</code> with <code>spent: { $sum: "$price" }</code>.',
    answer:'db.orders.aggregate([\n  { $match: { status: "delivered" } },\n  { $group: { _id: "$userId", spent: { $sum: "$price" } } }\n])',
    sql:"SELECT userId AS _id, SUM(price) AS spent\nFROM orders\nWHERE status = 'delivered'\nGROUP BY userId;",
    explain:'<code>$match</code> before <code>$group</code> is SQL’s WHERE. (A <code>$match</code> <em>after</em> <code>$group</code> would be HAVING.)',
    note:'Users 1–4. Arjun (5) disappears: both his orders were cancelled.' },

  /* ---------- $lookup ---------- */
  { group:'$lookup', kind:'agg', coll:'users', ops:['$lookup'], title:'Join users with their orders',
    story:'<b>$lookup</b> combines data from two collections — a LEFT OUTER JOIN. Every user keeps their place, with the matching orders embedded as an array.',
    ask:'Join every user with their orders: <code>$lookup</code> from <code>orders</code>, <code>localField: "_id"</code>, <code>foreignField: "userId"</code>, <code>as: "userOrders"</code>.',
    answer:'db.users.aggregate([\n  { $lookup: {\n      from: "orders",\n      localField: "_id",\n      foreignField: "userId",\n      as: "userOrders"\n  } }\n])',
    sql:'SELECT u.*, o.*\nFROM users u\nLEFT JOIN orders o ON o.userId = u._id;',
    explain:'For each user, <code>$lookup</code> finds orders whose <code>userId</code> equals the user’s <code>_id</code> and stores them in <code>userOrders</code>. The SQL join returns one flat row per user–order pair (Amit appears three times, Kavya once with NULLs); <code>$lookup</code> returns one document per user with the orders nested inside.',
    note:'Six users. Amit’s <code>userOrders</code> holds 3 orders; Kavya’s is empty.' },
  { group:'$lookup', kind:'agg', coll:'users', ops:['$match','$lookup'], title:'One user’s orders',
    ask:'Only for <code>"Amit"</code>: <code>$match</code> his user document, then the same <code>$lookup</code> into <code>userOrders</code>.',
    answer:'db.users.aggregate([\n  { $match: { name: "Amit" } },\n  { $lookup: {\n      from: "orders",\n      localField: "_id",\n      foreignField: "userId",\n      as: "userOrders"\n  } }\n])',
    sql:"SELECT u.*, o.*\nFROM users u\nLEFT JOIN orders o ON o.userId = u._id\nWHERE u.name = 'Amit';",
    explain:'Matching first means the join runs for one user instead of all six.',
    note:'Amit with orders 101, 104 and 110.' },
  { group:'$lookup', kind:'agg', coll:'users', ops:['$lookup','$size'], title:'Users who never ordered',
    ask:'Find users with <strong>no</strong> orders: <code>$lookup</code> into <code>userOrders</code> as before, then <code>$match</code> <code>userOrders: { $size: 0 }</code>.',
    answer:'db.users.aggregate([\n  { $lookup: {\n      from: "orders",\n      localField: "_id",\n      foreignField: "userId",\n      as: "userOrders"\n  } },\n  { $match: { userOrders: { $size: 0 } } }\n])',
    sql:'SELECT u.*\nFROM users u\nLEFT JOIN orders o ON o.userId = u._id\nWHERE o.orderId IS NULL;',
    explain:'Because <code>$lookup</code> is a left outer join, users without orders get an empty array — which <code>$size: 0</code> catches.',
    note:'Kavya — the only user who never ordered.' },

  /* ---------- Combined ---------- */
  { group:'All together', kind:'agg', coll:'orders', ops:['$lookup','$group','$sort'], ordered:true, title:'The combined example',
    story:'<b>Real combined example.</b> Join users with orders, calculate total spending per user, and sort users by highest spending — <code>$lookup</code> → <code>$group</code> → <code>$sort</code>.',
    ask:'On <code>orders</code>: <code>$lookup</code> from <code>users</code> (<code>localField: "userId"</code>, <code>foreignField: "_id"</code>, <code>as: "userDetails"</code>), then <code>$group</code> by <code>"$userId"</code> with <code>totalSpent: { $sum: "$price" }</code>, then <code>$sort</code> by <code>totalSpent</code> descending.',
    answer:'db.orders.aggregate([\n  { $lookup: {\n      from: "users",\n      localField: "userId",\n      foreignField: "_id",\n      as: "userDetails"\n  } },\n  { $group: { _id: "$userId", totalSpent: { $sum: "$price" } } },\n  { $sort: { totalSpent: -1 } }\n])',
    sql:'SELECT o.userId AS _id, SUM(o.price) AS \"totalSpent\"\nFROM orders o\nJOIN users u ON u._id = o.userId\nGROUP BY o.userId\nORDER BY \"totalSpent\" DESC;',
    explain:'Three stages, each feeding the next. Note that <code>$group</code> keeps only <code>_id</code> and <code>totalSpent</code> — the joined <code>userDetails</code> is dropped. The next question fixes that.',
    note:'Users 1 (74000), 2 (72000), 3 (61500), 5 (24000), 4 (21500).' },
  { group:'All together', kind:'agg', coll:'orders', ops:['$group','$sort','$limit','$lookup'], ordered:true, title:'Name the top spender',
    ask:'Who spent the most? <code>$group</code> by <code>"$userId"</code> with <code>totalSpent: { $sum: "$price" }</code>, <code>$sort</code> descending, <code>$limit: 1</code>, then <code>$lookup</code> from <code>users</code> (<code>localField: "_id"</code>, <code>foreignField: "_id"</code>, <code>as: "user"</code>).',
    answer:'db.orders.aggregate([\n  { $group: { _id: "$userId", totalSpent: { $sum: "$price" } } },\n  { $sort: { totalSpent: -1 } },\n  { $limit: 1 },\n  { $lookup: {\n      from: "users",\n      localField: "_id",\n      foreignField: "_id",\n      as: "user"\n  } }\n])',
    sql:'SELECT u.name, SUM(o.price) AS \"totalSpent\"\nFROM orders o\nJOIN users u ON u._id = o.userId\nGROUP BY u._id, u.name\nORDER BY \"totalSpent\" DESC\nLIMIT 1;',
    explain:'Joining <em>after</em> grouping and limiting means one lookup instead of twelve — and the user’s details survive to the output.',
    note:'Amit, 74000. That’s a wrap — DBMS Lab: taiyari jeet hai!' }
];

(window.CHAPTERS = window.CHAPTERS || []).push({
  id: 'ch04', num: '04', title: 'Aggregation Pipeline', href: 'chapter04.html', story: 'Data Factory',
  key: 'data-factory-ch04-v1',
  host: 'Atlas atlas-df8q1m-shard-0 [primary]',
  cluster: 'datafactory.df8q1m.mongodb.net',
  db: 'DataFactory',
  coll: 'orders',
  startNote: 'DataFactory loaded — users, orders, products',
  dataset: {
    db: 'DataFactory', collections: FACTORY,
    note: 'Six users, twelve orders and six products. Every question in this chapter only reads, so you can load it once and run all of them.'
  },
  init(){
    let n = 0;
    const colls = {};
    Object.keys(FACTORY).forEach(c=>{
      colls[c] = { capped:false, docs: FACTORY[c].map(d=>prepDoc(d._id !== undefined ? d : Object.assign({ _id: new ObjectId('6650f4c0' + (++n).toString(16).padStart(16,'0')) }, d))) };
    });
    return { cur:'DataFactory', dbs:{ DataFactory:{ colls } } };
  },
  tasks: CH04_TASKS,
  finish: {
    tag: 'Chapter 04 complete', title: 'Taiyari jeet hai!',
    text: `You built all ${CH04_TASKS.length} aggregation pipelines for the Data Factory.`,
    note: '$match filters · $sort orders · $group calculates · $lookup joins — chained into one pipeline.'
  }
});
