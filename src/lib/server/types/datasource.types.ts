export interface DataSource {
	id: string;
	userId: string;
	name: string;
	connectionString: string;
	isDefault: boolean | null;
	createdAt: Date;
	updatedAt: Date;
}
