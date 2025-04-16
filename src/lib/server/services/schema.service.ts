import { injectable, inject } from '@needle-di/core';
import { PostgresRepository } from '../repositories/postgres.repository';
import type { DatabaseSchema } from '../types/db.types';

@injectable()
export class SchemaService {
	constructor(private postgresRepository = inject(PostgresRepository)) {}

	async getFormattedSchemaForAI(): Promise<string> {
		const schema = await this.postgresRepository.getFullSchema();
		return this.formatSchemaForAI(schema);
	}

	private formatSchemaForAI(schema: DatabaseSchema): string {
		let output = '';

		if (schema.enums.length > 0) {
			output += '## Enums (Custom Types)\n';
			for (const enumDef of schema.enums) {
				output += `- ${enumDef.name}: ${enumDef.values.join(', ')}\n`;
			}
			output += '\n';
		}

		output += '## Tables\n';
		for (const table of schema.tables) {
			output += `### ${table.name} (${table.rowCount} rows)\n`;

			output += '#### Columns:\n';
			for (const column of table.columns) {
				output += `- ${column.name}: ${column.type}`;
				if (column.udtName && column.udtName !== column.type) output += ` (${column.udtName})`;
				if (!column.nullable) output += ' NOT NULL';
				if (column.defaultValue) output += ` DEFAULT ${column.defaultValue}`;
				if (column.isPrimaryKey) output += ' [PRIMARY KEY]';
				if (column.isForeignKey)
					output += ` [FOREIGN KEY → ${column.foreignTable}.${column.foreignColumn}]`;
				output += '\n';
			}
			output += '\n';
		}

		return output;
	}
}
