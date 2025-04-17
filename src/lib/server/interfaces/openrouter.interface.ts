import type { OpenRouterRequest, OpenRouterResponse } from '../types/openrouter.types';

export interface IOpenRouterService {
	readonly model: string;
	chatCompletion(request: OpenRouterRequest): Promise<OpenRouterResponse>;
}
