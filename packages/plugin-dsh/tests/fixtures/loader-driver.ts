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

  const factory = ctx.get('factory') as OrvenService | undefined
  if (factory === undefined) {
    throw new Error('Orven Loader smoke did not publish ctx.factory')
  }

  const actor: ActorRef = { kind: 'system', id: 'loader-smoke' }
  const changeId = 'CHG-LOADER' as never
  await factory.append({
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
    graphRevision: factory.currentRevision(),
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

  const result = await factory.executeWork({
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
    graphId: String(factory.graphId),
    revision: Number(factory.currentRevision()),
    nodes: factory.snapshot().nodes.length,
    executionState: result.state,
  }) + '\n')
} finally {
  await ctx.fiber.dispose()
}
