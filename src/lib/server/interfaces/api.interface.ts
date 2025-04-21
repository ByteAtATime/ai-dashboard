import type { Hono } from 'hono';
import type { AppEnv } from '../api';

export interface IApi {
	routes(): Hono<AppEnv>;
}
