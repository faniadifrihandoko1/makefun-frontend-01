// The entrypoint for the make.fun frontend bounty (Node 22, standard
// library only). The app itself is plain static files under app/ — an
// index.html page plus ES modules and CSS, no build step — reading
// make.fun's public API in the browser. This program hands it in: it
// copies app/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there, the summary the judge reads,
// using the kit's vendored library (vendor/makefun-frontend.ts, unchanged).
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally with:  node serve.ts   (http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name) {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  cpSync(from, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('app');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
copyTree('screenshots');

// The scorer's own caps (from the kit's gate): the text cap shapes the
// dossier's bytes; the others refuse an entry the scorer would refuse —
// more than 3 screenshots, one over 256 KiB, or app/ past 993 files and
// directories or 16 MiB in all.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
