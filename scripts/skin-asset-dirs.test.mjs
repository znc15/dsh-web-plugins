/**
 * v2 skin layout invariants (issue #506): skin-center stays the only real
 * bundle package under packages/skins/, and every built-in skin is a pure
 * asset directory — a v2 skin.json, no package.json, no build files. A
 * package.json inside a skin directory would turn the asset back into a
 * workspace package and revive the retired per-skin npm package shape.
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

test('skin-center stays a real bundle; skin asset directories stay package-free', () => {
  const center = readJson(join(skinsRoot, 'skin-center', 'package.json'))
  assert.equal(center.dsh?.bundle?.patch, './cordis.patch.yml')

  const skins = readdirSync(assetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  assert.ok(skins.length > 0)
  for (const name of skins) {
    const dir = join(assetRoot, name)
    assert.equal(existsSync(join(dir, 'package.json')), false, name)
    const skin = readJson(join(dir, 'skin.json'))
    assert.equal(skin.skinManifestVersion, 2, name)
    assert.equal(skin.id, name, name)
  }
})

test('the published package ships exactly the one skin in the collection', () => {
  // Single-skin collection: whale-song (鲸吟) is the only skin under the
  // repo's skin-center source AND the only skin bundled in the npm package.
  // The repository skins/ directory remains the single source for
  // market-build, the gallery and the preview tooling; users may still drop
  // their own skins into $DSH_HOME/skins, where the same skin center manages
  // them.
  const center = readJson(join(skinsRoot, 'skin-center', 'package.json'))
  const files = center.files
  assert.ok(Array.isArray(files), 'files whitelist must exist')
  const packagedSkins = files.filter((entry) => typeof entry === 'string' && entry.startsWith('skins/'))
  assert.deepEqual(packagedSkins, ['skins/whale-song'], 'whale-song is the only skin that may ship in the package')
  const skins = readdirSync(assetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  assert.deepEqual(skins, ['whale-song'], 'the repo skin collection contains exactly whale-song')
  assert.ok(readJson(join(assetRoot, 'whale-song', 'skin.json')).id === 'whale-song')
})
