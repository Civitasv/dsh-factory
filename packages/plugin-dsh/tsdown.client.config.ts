import { defineConfig } from 'tsdown'

const CLIENT_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

const external = (specifier: string): boolean =>
  CLIENT_EXTERNALS.has(specifier)

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: '.',
  format: 'cjs',
  platform: 'browser',
  target: 'es2023',
  fixedExtension: false,
  sourcemap: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: external,
    alwaysBundle: (specifier: string) => !external(specifier),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: () =>
      'window.__ModuleLoader__.load({ id: "@orven/plugin-dsh", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
})
