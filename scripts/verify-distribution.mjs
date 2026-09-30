import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PACKAGES = join(ROOT, 'packages')
const EXPECTED_VERSION = '0.1.0'
const HARNESS_ADAPTERS = new Set(['@dsh-factory/plugin-dsh'])

function fail(message) {
  throw new Error('distribution: ' + message)
}

async function exists(path) {
  try {
    await readFile(path)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}

async function run(command, args, options = {}) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', rejectPromise)
    child.on('close', code => {
      if (code !== 0) {
        rejectPromise(new Error(
          command + ' ' + args.join(' ') + ' exited ' + String(code)
            + '\nstdout:\n' + stdout + '\nstderr:\n' + stderr,
        ))
        return
      }
      resolvePromise({ stdout, stderr })
    })
  })
}

function allDependencyEntries(manifest) {
  return [
    ...Object.entries(manifest.dependencies ?? {}),
    ...Object.entries(manifest.optionalDependencies ?? {}),
    ...Object.entries(manifest.peerDependencies ?? {}),
    ...Object.entries(manifest.devDependencies ?? {}),
  ]
}

function runtimeDependencyEntries(manifest) {
  return [
    ...Object.entries(manifest.dependencies ?? {}),
    ...Object.entries(manifest.optionalDependencies ?? {}),
    ...Object.entries(manifest.peerDependencies ?? {}),
  ]
}

function assertMetadata(manifest, directory) {
  if (manifest.private === true) fail(manifest.name + ' must not be private')
  if (manifest.version !== EXPECTED_VERSION) {
    fail(manifest.name + ' must use version ' + EXPECTED_VERSION)
  }
  if (manifest.license !== 'MIT') fail(manifest.name + ' must declare MIT license')
  if (manifest.publishConfig?.access !== 'public') {
    fail(manifest.name + ' must publish with public access')
  }
  if (manifest.main !== './dist/index.js') {
    fail(manifest.name + ' must expose ./dist/index.js as main')
  }
  if (manifest.types !== './dist/index.d.ts') {
    fail(manifest.name + ' must expose ./dist/index.d.ts as types')
  }
  if (manifest.engines?.node !== '^22.19.0 || >=24.0.0') {
    fail(manifest.name + ' has the wrong Node engine contract')
  }
  if (manifest.repository?.directory !== 'packages/' + directory) {
    fail(manifest.name + ' has the wrong repository.directory')
  }
  for (const lifecycle of ['prepare', 'install', 'postinstall']) {
    if (manifest.scripts?.[lifecycle] !== undefined) {
      fail(manifest.name + ' must not require ' + lifecycle + ' to install')
    }
  }
}

function assertHarnessBoundary(manifest) {
  const adapter = HARNESS_ADAPTERS.has(manifest.name)
  for (const [name] of allDependencyEntries(manifest)) {
    const harnessSpecific = name.startsWith('@deepseek-ai/') || name.includes('cordis')
    if (!adapter && harnessSpecific) {
      fail(manifest.name + ' is harness-neutral but references ' + name)
    }
  }

  if (!adapter && manifest.dsh !== undefined) {
    fail(manifest.name + ' is harness-neutral but declares dsh metadata')
  }
  if (adapter && manifest.name === '@dsh-factory/plugin-dsh') {
    if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
      fail('plugin-dsh must declare dsh.bundle.patch')
    }
  }
}

function assertWorkspaceRanges(manifest) {
  for (const [name, range] of runtimeDependencyEntries(manifest)) {
    if (name.startsWith('@dsh-factory/') && range !== 'workspace:^') {
      fail(manifest.name + ' must use workspace:^ for ' + name)
    }
  }
}

function assertPackedManifest(manifest) {
  const text = JSON.stringify(manifest)
  if (text.includes('workspace:')) {
    fail(manifest.name + ' packed manifest still contains workspace: protocol')
  }
}

function assertPackedFiles(name, files) {
  const forbidden = files.filter(file =>
    file.includes('/src/')
    || file.includes('/tests/')
    || file.endsWith('/tsconfig.json')
    || file.includes('.tsbuildinfo')
    || file.includes('.test.')
    || file.includes('.spec.')
  )
  if (forbidden.length > 0) {
    fail(name + ' tarball contains development files: ' + forbidden.join(', '))
  }

  for (const required of ['package/dist/index.js', 'package/dist/index.d.ts']) {
    if (!files.includes(required)) {
      fail(name + ' tarball is missing ' + required)
    }
  }

  if (name === '@dsh-factory/plugin-dsh') {
    if (!files.includes('package/cordis.patch.yml')) {
      fail('plugin-dsh tarball is missing cordis.patch.yml')
    }
    if (!files.includes('package/README.md')) {
      fail('plugin-dsh tarball is missing README.md')
    }
  }
}

const directories = (await readdir(PACKAGES, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

const packages = []
for (const directory of directories) {
  const path = join(PACKAGES, directory, 'package.json')
  if (!(await exists(path))) continue
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  if (!manifest.name?.startsWith('@dsh-factory/')) continue

  assertMetadata(manifest, directory)
  assertHarnessBoundary(manifest)
  assertWorkspaceRanges(manifest)
  packages.push({ directory, manifest })
}

if (!packages.some(item => item.manifest.name === '@dsh-factory/plugin-dsh')) {
  fail('plugin-dsh package is missing')
}

const bundlePatch = await readFile(
  join(PACKAGES, 'plugin-dsh', 'cordis.patch.yml'),
  'utf8',
)
if (!bundlePatch.includes("name: '@dsh-factory/plugin-dsh'")) {
  fail('plugin-dsh bundle patch does not mount @dsh-factory/plugin-dsh')
}

const temporary = await mkdtemp(join(tmpdir(), 'dsh-factory-pack-'))
try {
  for (const item of packages) {
    const before = new Set(await readdir(temporary))
    await run('pnpm', ['pack', '--pack-destination', temporary], {
      cwd: join(PACKAGES, item.directory),
    })
    const after = await readdir(temporary)
    const tarballName = after.find(name => name.endsWith('.tgz') && !before.has(name))
    if (tarballName === undefined) {
      fail(item.manifest.name + ' did not produce a tarball')
    }

    const tarball = join(temporary, tarballName)
    const listing = await run('tar', ['-tzf', tarball])
    const files = listing.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)

    const packedJson = await run('tar', ['-xOzf', tarball, 'package/package.json'])
    const packedManifest = JSON.parse(packedJson.stdout)
    assertPackedManifest(packedManifest)
    assertPackedFiles(item.manifest.name, files)
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}

process.stdout.write(
  'distribution: verified ' + String(packages.length)
    + ' public Factory packages at ' + EXPECTED_VERSION + '\n',
)
