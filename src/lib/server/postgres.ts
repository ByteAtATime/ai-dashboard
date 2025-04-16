import { env } from '$env/dynamic/private';
import pg from 'pg';
import type { Pool, PoolClient, QueryResult } from 'pg';

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

const pool: Pool = new pg.Pool({
	connectionString: env.DATA_DB_URL,
	ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
	query_timeout: 10000
});

let schemaCache: DatabaseSchema | null = null;
const CACHE_TTL_MS = 3600000;

export async function getFullSchema(): Promise<DatabaseSchema> {
	if (schemaCache && Date.now() - schemaCache.lastUpdated < CACHE_TTL_MS) {
		return schemaCache;
	}

	const client = await pool.connect();
	try {
		const [tablesResult, enumsResult] = await Promise.all([
			fetchTablesWithMetadata(client),
			fetchEnums(client)
		]);

		schemaCache = {
			tables: tablesResult,
			enums: enumsResult,
			lastUpdated: Date.now()
		};

		return schemaCache;
	} finally {
		client.release();
	}
}

async function fetchTablesWithMetadata(
	client: PoolClient
): Promise<Omit<DatabaseTable, 'sampleRows'>[]> {
	const query = `
    WITH primary_keys AS (
      SELECT
        pg_attribute.attname AS column_name,
        pg_class.relname AS table_name
      FROM pg_index
      JOIN pg_class ON pg_class.oid = pg_index.indrelid
      JOIN pg_attribute ON pg_attribute.attrelid = pg_class.oid AND pg_attribute.attnum = ANY(pg_index.indkey)
      WHERE pg_index.indisprimary
    ),
    table_counts AS (
      SELECT
        table_schema,
        table_name,
        (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
      FROM (
        SELECT
          table_name,
          table_schema,
          query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') AS xml_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
      ) t
    )
    SELECT
      columns.table_name AS name,
      columns.column_name AS column_name,
      columns.data_type AS data_type,
      columns.udt_name AS udt_name,
      columns.is_nullable = 'YES' AS nullable,
      columns.column_default AS default_value,
      columns.character_maximum_length AS max_length,
      columns.numeric_precision AS numeric_precision,
      columns.numeric_scale AS numeric_scale,
      COALESCE(pk.column_name IS NOT NULL, false) AS is_primary_key,
      COALESCE(fk.constraint_type = 'FOREIGN KEY', false) AS is_foreign_key,
      fk.foreign_table_name AS foreign_table,
      fk.foreign_column_name AS foreign_column,
      tc.row_count AS row_count
    FROM information_schema.columns
    LEFT JOIN primary_keys pk ON 
      pk.table_name = columns.table_name AND 
      pk.column_name = columns.column_name
    LEFT JOIN (
      SELECT
        kcu.table_name,
        kcu.column_name,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc ON
        tc.constraint_name = kcu.constraint_name AND
        tc.constraint_type = 'FOREIGN KEY'
      JOIN information_schema.constraint_column_usage ccu ON
        ccu.constraint_name = kcu.constraint_name
    ) fk ON
      fk.table_name = columns.table_name AND
      fk.column_name = columns.column_name
    LEFT JOIN table_counts tc ON
      tc.table_name = columns.table_name
    WHERE columns.table_schema = 'public'
    ORDER BY columns.table_name, columns.ordinal_position
  `;

	const result = await client.query(query);
	const tablesMap = new Map<string, Omit<DatabaseTable, 'sampleRows'>>();

	for (const row of result.rows) {
		if (!tablesMap.has(row.name)) {
			tablesMap.set(row.name, {
				name: row.name,
				columns: [],
				rowCount: row.row_count
			});
		}

		const table = tablesMap.get(row.name)!;
		table.columns.push({
			name: row.column_name,
			type: row.data_type,
			udtName: row.udt_name,
			nullable: row.nullable,
			defaultValue: row.default_value,
			maxLength: row.max_length,
			numericPrecision: row.numeric_precision,
			numericScale: row.numeric_scale,
			isPrimaryKey: row.is_primary_key,
			isForeignKey: row.is_foreign_key,
			foreignTable: row.foreign_table,
			foreignColumn: row.foreign_column
		});
	}

	return Array.from(tablesMap.values());
}

async function fetchEnums(client: PoolClient): Promise<DatabaseEnum[]> {
	const query = `
    SELECT
      pg_type.typname AS enum_name,
      pg_enum.enumlabel AS enum_value
    FROM pg_type
    JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
    ORDER BY pg_type.typname, pg_enum.enumsortorder
  `;

	const result = await client.query(query);
	const enumsMap = new Map<string, string[]>();

	for (const row of result.rows) {
		if (!enumsMap.has(row.enum_name)) {
			enumsMap.set(row.enum_name, []);
		}
		enumsMap.get(row.enum_name)!.push(row.enum_value);
	}

	return Array.from(enumsMap.entries()).map(([name, values]) => ({
		name,
		values
	}));
}

async function fetchSampleRows(
	client: PoolClient,
	tableName: string,
	limit: number = 5
): Promise<Record<string, unknown>[]> {
	validateTableName(tableName);
	const safeLimit = Math.min(Math.max(1, limit), 10);

	const countResult = await client.query(`SELECT COUNT(*)::int FROM "${tableName}"`);
	const count = countResult.rows[0].count;

	if (count === 0) {
		return [];
	}

	if (count <= safeLimit) {
		const result = await client.query(`SELECT * FROM "${tableName}"`);
		return result.rows;
	}

	const result = await client.query(`SELECT * FROM "${tableName}" ORDER BY RANDOM() LIMIT $1`, [
		safeLimit
	]);
	return result.rows;
}

async function fetchTableRowCount(client: PoolClient, tableName: string): Promise<number> {
	validateTableName(tableName);
	const result = await client.query(`SELECT COUNT(*)::int FROM "${tableName}"`);
	return result.rows[0].count;
}

export async function executeReadOnlyQuery(
	sql: string,
	params: unknown[] = []
): Promise<Record<string, unknown>[]> {
	const client = await pool.connect();
	try {
		await client.query('SET TRANSACTION READ ONLY');
		await client.query('SET statement_timeout = 5000');
		const result = await client.query(sql, params);
		return result.rows;
	} finally {
		client.release();
	}
}

function validateTableName(tableName: string): void {
	if (!/^[a-zA_Z_][a-zA-Z0-9_]*$/.test(tableName)) {
		throw new Error(`Invalid table name: ${tableName}`);
	}
}

export default pool;
