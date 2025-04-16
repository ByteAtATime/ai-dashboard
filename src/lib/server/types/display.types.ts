export type TableDisplay = {
	type: 'table';
	sql: string;
	columns: Record<string, string>;
	description?: string;
};

export type StatDisplay = {
	type: 'stat';
	sql: string;
	id: string;
	name: string;
	unit?: string;
	description?: string;
};

export type DisplayConfig = TableDisplay | StatDisplay;

export type QueryContext = {
	query: string;
	display: (DisplayConfig & { results: Record<string, unknown>[] })[];
	explanation?: string;
};
