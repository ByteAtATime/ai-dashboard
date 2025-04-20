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

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

export type ChartDisplay = {
	type: 'chart';
	chartType: ChartType;
	sql: string;
	title: string;
	xAxis: {
		column: string;
		label: string;
	};
	yAxis: {
		column: string;
		label: string;
	};
	category?: {
		column: string;
		label: string;
	};
	description?: string;
};

export type DisplayConfig = TableDisplay | StatDisplay | ChartDisplay;

export type QueryContext = {
	query: string;
	display: (DisplayConfig & { results: Record<string, unknown>[] })[];
	explanation?: string;
};
