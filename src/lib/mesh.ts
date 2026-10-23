import { createClient } from '@supabase/supabase-js';

/**
 * Go Mesh (Supabase) client for realtime broadcast config.
 *
 * The anon key is public by design (same key shipped in the mobile apps), so it
 * is safe to expose to the browser. Override via NEXT_PUBLIC_MESH_URL /
 * NEXT_PUBLIC_MESH_ANON_KEY if the mesh moves.
 */
const MESH_URL = process.env.NEXT_PUBLIC_MESH_URL || 'https://edge.solofx.net';
const MESH_ANON_KEY =
  process.env.NEXT_PUBLIC_MESH_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MzM2Mjk0LCJleHAiOjE5NDUwMTYyOTR9.' +
    '9YCCl_oRCYHQIR3eAhUeLF-SiBqGIxaT9WqCS-YFtNw';

export const mesh = createClient(MESH_URL, MESH_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 5 } },
});

export const BROADCAST_CONFIG_TABLE = 'broadcast_config';
