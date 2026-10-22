# MongoDB Atlas Shell Lab

A browser simulator of the MongoDB Atlas shell (mongosh) for practising MongoDB, one question at a time. Read the question, type the command at the prompt, and the lab checks what your command actually did. Stuck? **Show answer** reveals the command and its explanation.

**Live:** https://edusatyaki.github.io/MongoDB-Atlas-Shell-Lab/

## Chapters

| Chapter | Story | Questions | Covers |
|---|---|---|---|
| [Ch 02 · CRUD Operations](https://edusatyaki.github.io/MongoDB-Atlas-Shell-Lab/) | Luscious Jewels — D. Soni's jewellery inventory | 18 | `use`, `show dbs`, `createCollection`, `insertOne/Many`, `find`, `updateOne/Many`, upsert, `deleteOne/Many`, `drop`, capped collections, `dropDatabase` |
| [Ch 03 · Update & Query Operators](https://edusatyaki.github.io/MongoDB-Atlas-Shell-Lab/chapter03.html) | Mission Mongo — an `astronomy_data` universe | 33 | comparison, logical, array and regex query operators; field, array, positional and date update operators; `replaceOne` — each with its SQL equivalent |

## How it works

- **Real shell behaviour.** Commands run against an in-browser data store and print mongosh-style output, including `insertedId`, `matchedCount` and red server errors.
- **Checked by effect, not by text.** Your command is compared with the model answer run on the same data, so formatting doesn't matter, but the operator the question teaches does.
- **Targeted hints** for common mistakes: numbers saved as text, `matchedCount: 0`, a missing `{ upsert: true }`, the right result with the wrong operator.
- **Course outline** sidebar lists every chapter, topic and question, always expanded, with progress ticks. Click any question to jump there; links like `chapter03.html#q13` open a question directly.
- **Reset to this question** rebuilds the data as if every earlier question was answered correctly.
- **Data panel** shows the collection live and highlights the rows each command changes.
- Enter runs a command (an open bracket continues on a new line), Shift+Enter adds a line, ↑/↓ recall history, `cls` clears, **F** toggles full screen.

## Run locally

No build step. Serve the folder and open it:

```bash
python3 -m http.server 8136
```

## Files

- `engine.js` — the mini mongosh engine: query matching, update operators, mongosh-style printing
- `lab.js`, `lab.css` — the question/shell/data interface shared by every chapter
- `ch02.js`, `ch03.js` — each chapter's dataset and questions
- `index.html` (Chapter 02), `chapter03.html` (Chapter 03)

---

Innovation in Education — Satyaki Das
