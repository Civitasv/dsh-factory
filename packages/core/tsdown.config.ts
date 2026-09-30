import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
  "index": "src/index.ts",
  "domain": "src/domain.ts",
  "events": "src/events.ts",
  "evidence": "src/evidence.ts",
  "context": "src/context.ts",
  "policy": "src/policy.ts",
  "work": "src/work.ts",
  "execution": "src/execution.ts",
  "persistence": "src/persistence.ts",
  "integration-github": "src/integration-github.ts",
  "integration-ci": "src/integration-ci.ts",
  "release": "src/release.ts",
  "observation": "src/observation.ts",
  "graph-ui": "src/graph-ui.ts",
  "application": "src/application.ts"
},
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'es2023',
  sourcemap: true,
  dts: true,
  fixedExtension: false,
  clean: true,
  deps: { alwaysBundle: [/^@orven\/internal-/] },
})
