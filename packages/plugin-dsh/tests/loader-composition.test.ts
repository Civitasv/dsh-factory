import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const driver = fileURLToPath(
  new URL('./fixtures/loader-driver.ts', import.meta.url),
)
const config = fileURLToPath(
  new URL('./fixtures/cordis.yml', import.meta.url),
)
async function runLoaderComposition(): Promise<{
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [driver, config],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
  })
}

describe('Orven real DSH Loader composition', () => {
  it('mounts ctx.orven and executes Work through the real AgentRegistry', async () => {
    const result = await runLoaderComposition()

    expect(result.code).toBe(0)
    expect(result.stderr).toBe('')

    const report = JSON.parse(result.stdout.trim()) as {
      readonly service: boolean
      readonly graphId: string
      readonly revision: number
      readonly nodes: number
      readonly executionState: string
      readonly tools: readonly string[]
    }

    expect(report).toEqual({
      service: true,
      graphId: 'orven-loader-smoke',
      revision: 1,
      nodes: 1,
      executionState: 'succeeded',
      tools: ['orven_begin_change', 'orven_execute', 'orven_status'],
    })
  }, 30_000)
})
