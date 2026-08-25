/**
 * Standalone tsdown config for the session-delete plugin.
 *
 * Uses the repo's shared client-bundle preset (shared/tsdown.client.ts):
 * node-half lib/ (host route + deletion core) plus the browser bundle
 * lib/client.js (closure-factory artifact for the GUI's __ModuleLoader__,
 * CSS Modules inlined with auto-injected <style data-plugin>).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@linxin666/dsh-client-ui-session-delete', ['src/index.ts'], {
  libExternal: [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-host-webserver',
  ],
})
