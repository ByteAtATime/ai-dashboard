import { env } from '$env/dynamic/private';
import pg from 'pg';

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL,
	ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
	query_timeout: 10000
});

let schemaCache: any = null;
let schemaCacheTime = 0;

export async function getSchema() {
	if (schemaCache && Date.now() - schemaCacheTime < 3600000) {
		return schemaCache;
	}

	const client = await pool.connect();
	try {
		const result = await client.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM
        information_schema.columns
      WHERE
        table_schema = 'public'
      ORDER BY
        table_name, ordinal_position
    `);

		const schema: Record<string, any[]> = {};
		for (const row of result.rows) {
			if (!schema[row.table_name]) {
				schema[row.table_name] = [];
			}
			schema[row.table_name].push({
				name: row.column_name,
				type: row.data_type,
				nullable: row.is_nullable === 'YES',
				default: row.column_default
			});
		}

		schemaCache = schema;
		schemaCacheTime = Date.now();
		return schema;
	} finally {
		client.release();
	}
}

export async function sampleRows(table: string, limit = 5) {
	const rowLimit = Math.min(Math.max(1, limit), 10);

	const client = await pool.connect();
	try {
		if (!/^[a-zA-Z0-9_]+$/.test(table)) {
			throw new Error('Invalid table name');
		}

		const countResult = await client.query(`
      SELECT COUNT(*) FROM "${table}"
    `);

		const count = parseInt(countResult.rows[0].count, 10);

		if (count === 0) {
			return [];
		}

		if (count <= rowLimit) {
			return (
				await client.query(`
        SELECT * FROM "${table}"
      `)
			).rows;
		}

		const result = await client.query(
			`
      SELECT * FROM "${table}"
      ORDER BY RANDOM()
      LIMIT $1
    `,
			[rowLimit]
		);

		return result.rows;
	} finally {
		client.release();
	}
}

export async function executeReadOnlyQuery(sql: string, params: any[] = []) {
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

export async function getTableRowCount(table: string) {
	if (!/^[a-zA-Z0-9_]+$/.test(table)) {
		throw new Error('Invalid table name');
	}

	const client = await pool.connect();
	try {
		const result = await client.query(`
      SELECT COUNT(*) as count FROM "${table}"
    `);
		return parseInt(result.rows[0].count, 10);
	} finally {
		client.release();
	}
}

export default pool;
