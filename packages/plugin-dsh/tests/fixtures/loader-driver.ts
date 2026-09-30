import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { OrvenService } from '../../src/service.ts'
import type { ActorRef } from '@orven/core'
import type { WorkItem, CapabilityId } from '@orven/core/work'

const configPath = process.argv[2]
if (configPath === undefined) {
  throw new Error('Orven Loader smoke requires a cordis.yml path')
}

const ctx = new Context()
ctx.baseUrl = pathToFileURL(dirname(configPath) + '/').href

try {
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  await ctx.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await ctx.loader.await()

  const orven = ctx.get('orven') as OrvenService | undefined
  if (orven === undefined) {
    throw new Error('Orven Loader smoke did not publish ctx.orven')
  }

  const toolNames = ctx.tools.schemas().map(schema => schema.name).sort()
  for (const required of ['orven_begin_change', 'orven_execute', 'orven_status']) {
    if (!toolNames.includes(required)) {
      throw new Error(`Orven Loader smoke missing tool ${required}`)
    }
  }

  const actor: ActorRef = { kind: 'system', id: 'loader-smoke' }
  const changeId = 'CHG-LOADER' as never
  await orven.append({
    changeId,
    expectedSequence: 0,
    actor,
    events: [
      {
        eventId: 'EVT-LOADER-1' as never,
        occurredAt: '2026-09-30T00:00:00Z',
        event: {
          type: 'change.created',
          change: {
            id: changeId,
            kind: 'feature',
            title: 'Loader composition',
            createdAt: '2026-09-30T00:00:00Z',
            createdBy: actor,
          },
        },
      },
    ],
  })

  const capability = 'code.read' as CapabilityId
  const work: WorkItem = {
    id: 'work:loader-smoke' as never,
    changeId,
    graphRevision: orven.currentRevision(),
    objective: 'Prove Orven executes inside DSH',
    requiredCapabilities: [capability],
    priority: 'normal',
    source: {
      kind: 'node',
      node: { kind: 'change', id: changeId },
    },
    context: {
      query: {
        direction: 'both',
        relationKinds: [],
        maxDepth: 0,
        includeSubjectEvidence: false,
      },
      budget: {
        maxNodes: 1,
        maxRelations: 0,
        maxCriterionRevisions: 0,
      },
    },
  }

  const result = await orven.executeWork({
    work,
    worker: {
      id: 'loader-worker',
      capabilities: [capability],
      maxParallel: 1,
    },
    attempt: 1,
    collector: {
      collect: async (agent) => {
        const observed = (
          agent as unknown as { readonly __orvenLoaderLog?: readonly string[] }
        ).__orvenLoaderLog
        if (observed?.join(',') !== 'inject,followup,idle') {
          throw new Error(
            'Orven Loader smoke observed wrong DSH lifecycle: '
              + JSON.stringify(observed),
          )
        }
        return {
          status: 'succeeded',
          artifacts: [],
          evidence: [],
          findings: [],
          decisions: [],
        }
      },
    },
  })

  process.stdout.write(JSON.stringify({
    service: true,
    graphId: String(orven.graphId),
    revision: Number(orven.currentRevision()),
    nodes: orven.snapshot().nodes.length,
    executionState: result.state,
    tools: toolNames.filter(name => name.startsWith('orven_')),
  }) + '\n')
} finally {
  await ctx.fiber.dispose()
}
