import { hc } from 'hono/client';
import type { ApiRoutes } from './server/api';

export const createClient = (fetch: Window['fetch']) => hc<ApiRoutes>('/api', { fetch });
