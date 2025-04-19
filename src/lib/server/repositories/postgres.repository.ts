import { env } from '$env/dynamic/private';
import pg from 'pg';
import type { Pool, PoolClient } from 'pg';
import { injectable } from '@needle-di/core';
import type { DatabaseSchema, DatabaseTable, DatabaseEnum } from '../types/db.types';
import { type IRepository } from '../interfaces/repository.interface';

@injectable()
export class PostgresRepository implements IRepository {
	private schemaCache: DatabaseSchema | null = null;
	private readonly CACHE_TTL_MS = 3600000; // 1 hour
	private pools: Map<string, Pool> = new Map();

	private getPool(connectionString: string): Pool {
		if (this.pools.has(connectionString)) {
			return this.pools.get(connectionString)!;
		}

		const newPool = new pg.Pool({
			connectionString,
			ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
			query_timeout: 10000
		});

		this.pools.set(connectionString, newPool);
		return newPool;
	}

	async getFullSchema(connectionString: string): Promise<DatabaseSchema> {
		if (
			this.schemaCache &&
			Date.now() - this.schemaCache.lastUpdated < this.CACHE_TTL_MS &&
			!connectionString
		) {
			return this.schemaCache;
		}

		// Get the appropriate connection pool
		const pool = this.getPool(connectionString);
		const client = await pool.connect();
		try {
			const [tablesResult, enumsResult] = await Promise.all([
				this.fetchTablesWithMetadata(client),
				this.fetchEnums(client)
			]);

			const schema = {
				tables: tablesResult,
				enums: enumsResult,
				lastUpdated: Date.now()
			};

			// Only cache if using the default connection
			if (!connectionString) {
				this.schemaCache = schema;
			}

			return schema;
		} finally {
			client.release();
		}
	}

	async executeReadOnlyQuery(
		sql: string,
		connectionString: string,
		params: unknown[] = []
	): Promise<Record<string, unknown>[]> {
		// Get the appropriate connection pool
		const pool = this.getPool(connectionString);
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

	async sampleTable(
		tableName: string,
		numRows: number,
		connectionString: string
	): Promise<Record<string, unknown>[]> {
		console.log(`🔍 Sampling table: ${tableName}, ${numRows} rows`);
		// Get the appropriate connection pool
		const pool = this.getPool(connectionString);
		const client = await pool.connect();
		try {
			this.validateTableName(tableName);
			const safeLimit = Math.min(Math.max(1, numRows), 10);

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
		} finally {
			client.release();
		}
	}

	private async fetchTablesWithMetadata(
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

	private async fetchEnums(client: PoolClient): Promise<DatabaseEnum[]> {
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

	private validateTableName(tableName: string): void {
		if (!/^[a-zA_Z_][a-zA_Z0-9_]*$/.test(tableName)) {
			throw new Error(`Invalid table name: ${tableName}`);
		}
	}
}
