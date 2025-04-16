export type DatabaseColumn = {
	name: string;
	type: string;
	udtName: string;
	nullable: boolean;
	defaultValue: string | null;
	maxLength: number | null;
	numericPrecision: number | null;
	numericScale: number | null;
	isPrimaryKey: boolean;
	isForeignKey: boolean;
	foreignTable: string | null;
	foreignColumn: string | null;
};

export type DatabaseTable = {
	name: string;
	columns: DatabaseColumn[];
	rowCount: number;
};

export type DatabaseEnum = {
	name: string;
	values: string[];
};

export type DatabaseSchema = {
	tables: DatabaseTable[];
	enums: DatabaseEnum[];
	lastUpdated: number;
};
