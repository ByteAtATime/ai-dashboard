import { injectable, inject } from '@needle-di/core';
import { PostgresRepository } from '../repositories/postgres.repository';
import type { DatabaseSchema } from '../types/db.types';

@injectable()
export class SchemaService {
	constructor(private postgresRepository = inject(PostgresRepository)) {}

	async getFormattedSchemaForAI(connectionString: string): Promise<string> {
		const schema = await this.postgresRepository.getFullSchema(connectionString);
		return this.formatSchemaForAI(schema);
	}

	private formatSchemaForAI(schema: DatabaseSchema): string {
		let output = '';

		if (schema.enums.length > 0) {
			output += '## Enums\n';
			for (const enumDef of schema.enums) {
				output += `- ${enumDef.name}: ${enumDef.values.join(', ')}\n`;
			}
			output += '\n';
		}

		output += '## Tables\n';
		for (const table of schema.tables) {
			output += `### ${table.name} (${table.rowCount} rows)\n`;

			output += 'Columns:\n';
			for (const column of table.columns) {
				let columnInfo = `- ${column.name}: ${column.type}`;
				if (!column.nullable) columnInfo += ' NOT NULL';
				if (column.isPrimaryKey) columnInfo += ' [PK]';
				if (column.isForeignKey) {
					columnInfo += ` [FK -> ${column.foreignTable}.${column.foreignColumn}]`;
				}
				output += columnInfo + '\n';
			}
			output += '\n';
		}

		return output.trim();
	}
}
