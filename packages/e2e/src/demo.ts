/**
 * bd-10 — runnable offline ALPHA demo (`npm run demo`, after `npm run build`).
 *
 * Re-runs the scripted walkthrough (the same flow the Vitest gate asserts)
 * against a temp dataDir with the fixed clock/id sequence, prints a human
 * summary of the alpha loop, and (re)writes the committed example artifacts
 * `examples/draft-pack.json` + `examples/reviewed-pack.json`.
 *
 * Deterministic: same inputs ⇒ byte-identical artifacts, so re-running it leaves
 * the committed files unchanged. Fully offline on the mock adapter — no network,
 * no API key. Exits non-zero if any step deviates from the alpha contract.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWalkthrough } from './walkthrough.js'

function examplesDir(): string {
  // dist/demo.js -> package root is one level up; examples/ lives there.
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'examples')
}

/** Write a pack as pretty JSON with a trailing newline (stable on re-run). */
function writePack(name: string, pack: unknown): string {
  const path = join(examplesDir(), name)
  writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`, 'utf8')
  return path
}

async function main(): Promise<void> {
  const dataDir = mkdtempSync(join(tmpdir(), 'sam-demo-'))
  try {
    const r = await runWalkthrough(dataDir)

    const draftPath = writePack('draft-pack.json', r.draftPack)
    const reviewedPath = writePack('reviewed-pack.json', r.reviewedPack)

    const lines = [
      'Systems & Models — alpha walkthrough (offline, mock adapter)',
      '------------------------------------------------------------',
      `1. source ingested      : ${r.sourceId} (${r.anchorCount} anchors)`,
      `2. draft pack generated : ${r.packId} (atoms=${r.draftPack.atoms.length}, validation.ok=${r.draftValidationOk})`,
      `3. reviewed             : model atom ${r.modelAtomId} accepted (supports); others rejected`,
      `4. reviewed snapshot    : saved_at=${r.reviewedSavedAt} (validates)`,
      `5. tutor in-scope       : "${r.inScopeQuestion}"`,
      r.inScope.kind === 'answer'
        ? `   -> ANSWER citing ${r.inScope.citations.length} reviewed anchor(s): ${r.inScope.citations
            .map((c) => c.anchor_id)
            .join(', ')}`
        : `   -> ${r.inScope.kind}`,
      `6. tutor out-of-scope   : "${r.outOfScopeQuestion}"`,
      `   -> ${r.outOfScope.kind}`,
      '',
      `wrote ${draftPath}`,
      `wrote ${reviewedPath}`,
    ]
    console.log(lines.join('\n'))
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
}

main().catch((e: unknown) => {
  console.error('demo failed:', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
