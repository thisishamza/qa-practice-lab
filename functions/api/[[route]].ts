import { handle } from 'hono/cloudflare-pages'
import { app } from '../../src/server/app'

// Cloudflare Pages Functions catch-all for /api and /api/*.
// `handle` bridges the Pages EventContext to Hono's fetch handler.
export const onRequest = handle(app)
