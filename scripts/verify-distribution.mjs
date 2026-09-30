import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PACKAGES = join(ROOT, 'packages')
const VERSION = '0.1.0'
const PUBLIC_PACKAGES = new Set(['@orven/core', '@orven/plugin-dsh'])

function fail(message) {
  throw new Error('distribution: ' + message)
}

function run(command, args, cwd = ROOT) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
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
      if (code === 0) {
        resolvePromise({ stdout, stderr })
        return
      }
      rejectPromise(new Error(
        command + ' ' + args.join(' ') + ' exited ' + String(code)
          + '\nstdout:\n' + stdout + '\nstderr:\n' + stderr,
      ))
    })
  })
}

async function readManifest(directory) {
  const path = join(PACKAGES, directory, 'package.json')
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

function runtimeDependencies(manifest) {
  return {
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    optionalDependencies: manifest.optionalDependencies,
  }
}

function isDevelopmentFile(file) {
  return file.includes('/src/')
    || file.includes('/tests/')
    || file.endsWith('/tsconfig.json')
    || file.includes('.tsbuildinfo')
    || file.includes('.test.')
    || file.includes('.spec.')
}

const directories = (await readdir(PACKAGES, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

const packages = []
for (const directory of directories) {
  const manifest = await readManifest(directory)
  if (manifest === undefined || !manifest.name?.startsWith('@orven/')) continue

  if (PUBLIC_PACKAGES.has(manifest.name)) {
    if (manifest.private === true) fail(manifest.name + ' must be public')
    if (manifest.version !== VERSION) {
      fail(manifest.name + ' must use public version ' + VERSION)
    }
  } else {
    if (manifest.private !== true) fail(manifest.name + ' must stay private')
    if (!manifest.name.startsWith('@orven/internal-')) {
      fail('private package must use @orven/internal-* naming: ' + manifest.name)
    }
  }

  packages.push({ directory, manifest })
}

const publicPackages = packages.filter(item => PUBLIC_PACKAGES.has(item.manifest.name))
if (publicPackages.length !== 2) {
  fail('expected exactly two public packages, found ' + String(publicPackages.length))
}

const temp = await mkdtemp(join(tmpdir(), 'orven-dist-'))
const tarballs = new Map()

try {
  for (const { directory, manifest } of publicPackages) {
    const before = new Set(await readdir(temp))
    await run('pnpm', ['pack', '--pack-destination', temp], join(PACKAGES, directory))

    const tarballName = (await readdir(temp))
      .find(name => name.endsWith('.tgz') && !before.has(name))
    if (tarballName === undefined) fail('no tarball produced for ' + manifest.name)

    const tarball = join(temp, tarballName)
    tarballs.set(manifest.name, tarball)

    const packedManifest = JSON.parse(
      (await run('tar', ['-xOzf', tarball, 'package/package.json'])).stdout,
    )
    const packedText = JSON.stringify(packedManifest)
    const runtimeText = JSON.stringify(runtimeDependencies(packedManifest))

    if (packedText.includes('workspace:')) {
      fail(packedManifest.name + ' leaked workspace protocol')
    }
    if (packedText.includes('@dsh-factory/')) {
      fail(packedManifest.name + ' leaked legacy @dsh-factory scope')
    }
    if (runtimeText.includes('@orven/internal-')) {
      fail(packedManifest.name + ' depends on private Orven packages')
    }

    const files = (await run('tar', ['-tzf', tarball])).stdout
      .split('\n')
      .map(file => file.trim())
      .filter(Boolean)

    const leaked = files.filter(isDevelopmentFile)
    if (leaked.length > 0) {
      fail(packedManifest.name + ' leaked development files: ' + leaked.join(', '))
    }

    for (const required of ['package/dist/index.js', 'package/dist/index.d.ts']) {
      if (!files.includes(required)) {
        fail(packedManifest.name + ' is missing ' + required)
      }
    }

    if (packedManifest.name === '@orven/core') {
      if (runtimeText.includes('@deepseek-ai/')
        || runtimeText.toLowerCase().includes('cordis')) {
        fail('@orven/core leaked Harness dependencies')
      }

      const inspectable = files.filter(file =>
        file.endsWith('.js') || file.endsWith('.d.ts'))
      for (const file of inspectable) {
        const body = (await run('tar', ['-xOzf', tarball, file])).stdout
        if (body.includes('@orven/internal-')) {
          fail('@orven/core artifact leaked private import in ' + file)
        }
        if (body.includes('@dsh-factory/')) {
          fail('@orven/core artifact leaked legacy scope in ' + file)
        }
        if (body.includes('@deepseek-ai/') || body.includes('cordis')) {
          fail('@orven/core artifact leaked Harness import in ' + file)
        }
      }
    } else {
      if (packedManifest.dependencies?.['@orven/core'] === undefined) {
        fail('@orven/plugin-dsh must depend on @orven/core')
      }
      if (!files.includes('package/cordis.patch.yml')) {
        fail('@orven/plugin-dsh is missing cordis.patch.yml')
      }
      if (packedText.includes('@orven/internal-')) {
        fail('@orven/plugin-dsh manifest leaked private Orven package')
      }
    }
  }

  const coreTarball = tarballs.get('@orven/core')
  const dshTarball = tarballs.get('@orven/plugin-dsh')
  if (coreTarball === undefined || dshTarball === undefined) {
    fail('public tarball set is incomplete')
  }

  const consumer = join(temp, 'consumer')
  await mkdir(consumer)
  await writeFile(join(consumer, 'package.json'), JSON.stringify({
    name: 'orven-clean-consumer',
    private: true,
    type: 'module',
    dependencies: {
      '@orven/core': 'file:' + coreTarball,
      '@orven/plugin-dsh': 'file:' + dshTarball,
    },
  }, null, 2) + '\n')

  await run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], consumer)
  await run(process.execPath, [
    '--input-type=module',
    '-e',
    [
      "await import('@orven/core')",
      "await import('@orven/core/events')",
      "await import('@orven/core/context')",
      "await import('@orven/core/execution')",
      "await import('@orven/plugin-dsh')",
    ].join('; '),
  ], consumer)
} finally {
  await rm(temp, { recursive: true, force: true })
}

process.stdout.write(
  'distribution: verified @orven/core and @orven/plugin-dsh ' + VERSION + '\n',
)
