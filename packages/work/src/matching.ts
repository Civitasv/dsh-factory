import type { CapabilityId, WorkItem, WorkerDescriptor } from './types.js'

function compareText(left: string, right: string): number {
  return left.localeCompare(right)
}

function validateWorker(worker: WorkerDescriptor): void {
  if (worker.id.trim() === '') throw new Error('Worker id must be non-empty')
  if (!Number.isSafeInteger(worker.maxParallel) || worker.maxParallel <= 0) {
    throw new Error(`Worker ${worker.id} maxParallel must be a positive safe integer`)
  }
  const capabilities = worker.capabilities.map(String)
  if (capabilities.some(value => value.trim() === '')) {
    throw new Error(`Worker ${worker.id} has an empty capability`)
  }
}

export function workerCanExecute(
  work: WorkItem,
  worker: WorkerDescriptor,
): boolean {
  validateWorker(worker)
  const available = new Set<CapabilityId>(worker.capabilities)
  return work.requiredCapabilities.every(capability => available.has(capability))
}

export function eligibleWorkers(
  work: WorkItem,
  workers: readonly WorkerDescriptor[],
): readonly WorkerDescriptor[] {
  const ids = new Set<string>()
  for (const worker of workers) {
    validateWorker(worker)
    if (ids.has(worker.id)) throw new Error(`Duplicate Worker id ${worker.id}`)
    ids.add(worker.id)
  }

  return workers
    .filter(worker => workerCanExecute(work, worker))
    .sort((left, right) => compareText(left.id, right.id))
}
