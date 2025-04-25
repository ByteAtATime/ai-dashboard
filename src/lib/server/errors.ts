export class ForbiddenError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ForbiddenError';
	}
}

export class NotFoundError extends Error {
	constructor(message: string = 'Resource not found') {
		super(message);
		this.name = 'NotFoundError';
	}
}
