import { env } from '$env/dynamic/private';
import { injectable } from '@needle-di/core';
import type { OpenRouterRequest, OpenRouterResponse } from '../types/openrouter.types';
import type { IOpenRouterService } from '../interfaces/openrouter.interface';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

@injectable()
export class OpenRouterService implements IOpenRouterService {
	public readonly model = env.OPENROUTER_MODEL || DEFAULT_MODEL;

	async chatCompletion(request: OpenRouterRequest): Promise<OpenRouterResponse> {
		const model = request.model || this.model;

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'HTTP-Referer': env.APP_HOST || 'http://localhost:5173',
				'X-Title': 'AI SQL Generator'
			},
			body: JSON.stringify({
				...request,
				model
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`OpenRouter API error: ${response.status} ${errorText}`, request);
			throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
		}

		const data = (await response.json()) as OpenRouterResponse;
		if (!data.choices || data.choices.length === 0) {
			console.error('No response choices from OpenRouter API', data);
			throw new Error('No response choices from OpenRouter API');
		}

		return data;
	}
}
