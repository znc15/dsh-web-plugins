/**
 * v2 skin layout invariants (issue #506): skin-center stays the only real
 * bundle package under packages/skins/, and the package ships ZERO bundled
 * skins — v2 skins are pure asset directories installed by the user (or the
 * market) into $DSH_HOME/skins/<id>/. The whale-song (鲸吟) skin lives in
 * its own independent repository (znc15/dsh-skin-whale-song).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const skinsRoot = join(repoRoot, 'packages', 'skins')
const assetRoot = join(skinsRoot, 'skin-center', 'skins')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

test('skin-center stays a real bundle; the package carries no skin asset directories', () => {
  const center = readJson(join(skinsRoot, 'skin-center', 'package.json'))
  assert.equal(center.dsh?.bundle?.patch, './cordis.patch.yml')

  const entries = existsSync(assetRoot)
    ? readdirSync(assetRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : []
  assert.deepEqual(entries.map((entry) => entry.name), [], 'no bundled skin directories expected')
})

test('the published package ships no bundled skins (skins live in the independent skin repository)', () => {
  // Independent-skin design: the skin-center npm package ships zero skins.
  // whale-song (鲸吟) is distributed from its own repository
  // (znc15/dsh-skin-whale-song) and is installed by the user into
  // $DSH_HOME/skins/whale-song, where the same skin center manages it.
  const center = readJson(join(skinsRoot, 'skin-center', 'package.json'))
  const files = center.files
  assert.ok(Array.isArray(files), 'files whitelist must exist')
  const packagedSkins = files.filter((entry) => typeof entry === 'string' && entry.startsWith('skins/'))
  assert.deepEqual(packagedSkins, [], 'no skin may ship inside the skin-center package')
  const bundledDirs = existsSync(assetRoot)
    ? readdirSync(assetRoot).filter((name) => !name.startsWith('.')).length
    : 0
  assert.equal(bundledDirs, 0, 'the skin-center package must not bundle any skin asset directory')
})