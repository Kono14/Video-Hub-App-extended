// Step 2 of naming the performers of a hub with AI: put the names the agents found into the hub as tags of the
// videos. Only while Video Hub App is closed -- it would overwrite the hub with what it holds in memory.
//
// usage: node bin/performer-names/merge.js <hub.vha2> <work folder> [--dry-run]
//
// Reads `index.json` and every `result_NN.txt` (`id|Name One;Name Two`) of the work folder written by `export.js`
// and the agents. Keeps a copy of the hub as `<hub>.before-names-<date>` first. Tags a video already has stay;
// a name it has already (in any upper or lower case) is not added twice.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [hubFile, workDir, flag] = process.argv.slice(2);
const dryRun = flag === '--dry-run';
if (!hubFile || !workDir) {
  console.error('usage: node bin/performer-names/merge.js <hub.vha2> <work folder> [--dry-run]');
  process.exit(1);
}

if (!dryRun && process.platform === 'win32') {
  const running = execSync('tasklist /FI "IMAGENAME eq Video Hub App 3.exe" /NH').toString();
  if (running.includes('Video Hub App 3.exe')) {
    console.error('Video Hub App is running -- close it first, it would overwrite the hub when it saves');
    process.exit(1);
  }
}

const rows = JSON.parse(fs.readFileSync(path.join(workDir, 'index.json'), 'utf8'));
const byId = new Map(rows.map((r) => [r.id, r]));

const names = new Map(); // id -> names
let lines = 0, badLines = 0;
for (const file of fs.readdirSync(workDir).filter((f) => /^result_\d+\.txt$/.test(f)).sort()) {
  for (const line of fs.readFileSync(path.join(workDir, file), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) { continue; }
    lines++;
    const m = /^(\d+)\|(.+)$/.exec(line.trim());
    if (!m || !byId.has(parseInt(m[1], 10))) { badLines++; continue; }
    const list = m[2].split(';').map((n) => n.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (list.length) { names.set(parseInt(m[1], 10), list); }
  }
}

const hub = JSON.parse(fs.readFileSync(hubFile, 'utf8'));
const key = (source, partialPath, fileName) => source + '|' + partialPath + '|' + fileName;
const videos = new Map(hub.images.map((e) => [key(e.inputSource, e.partialPath, e.fileName), e]));

let tagged = 0, tagsAdded = 0, notFound = 0;
const distinct = new Set();
for (const [id, list] of names) {
  const r = byId.get(id);
  const video = videos.get(key(r.inputSource, r.partialPath, r.fileName));
  if (!video) { notFound++; continue; }
  const have = new Set((video.tags || []).map((t) => t.toLowerCase()));
  const add = list.filter((n) => !have.has(n.toLowerCase()) && have.add(n.toLowerCase()));
  if (add.length) {
    video.tags = [...(video.tags || []), ...add];
    tagged++;
    tagsAdded += add.length;
  }
  list.forEach((n) => distinct.add(n.toLowerCase()));
}

console.log(JSON.stringify({ resultLines: lines, unreadableLines: badLines, videosWithNames: names.size,
  videosTagged: tagged, tagsAdded, distinctNames: distinct.size, videosNoLongerInHub: notFound, dryRun }));

if (!dryRun) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const backup = hubFile + '.before-names-' + stamp;
  fs.copyFileSync(hubFile, backup);
  fs.writeFileSync(hubFile + '.tmp', JSON.stringify(hub));
  fs.renameSync(hubFile + '.tmp', hubFile);
  console.log('hub written; the hub as it was is kept as ' + backup);
}
