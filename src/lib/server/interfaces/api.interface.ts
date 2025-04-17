import type { Hono } from 'hono';

export interface IApi {
	routes(): Hono;
}
