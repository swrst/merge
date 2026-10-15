/* Bumps the one version the whole project uses (version.json):
     npm run version:bump            0.73.0 → 0.73.1, code +1
     npm run version:bump -- 1.0.0   set the name, code +1
   Android reads it in android/app/build.gradle (versionName / versionCode),
   the game shows it in Settings. Every upload to Google Play needs a higher code. */
import { readFileSync, writeFileSync } from 'node:fs';
const v = JSON.parse(readFileSync('version.json', 'utf8'));
const want = process.argv[2];
const next = want || v.name.replace(/(\d+)$/, n => String(+n + 1));
if (!/^\d+\.\d+\.\d+$/.test(next)) { console.error('version must look like 1.2.3'); process.exit(1); }
const out = { name: next, code: v.code + 1 };
writeFileSync('version.json', JSON.stringify(out, null, 2) + '\n');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')); pkg.version = next;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`version ${v.name} (${v.code}) → ${out.name} (${out.code})`);
