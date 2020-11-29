import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
import DatabaseInterface from 'kiss-orm/dist/Databases/DatabaseInterface';
import { SQLiteDatabase, openOrCreate } from '@akylas/nativescript-sqlite';
const sql = SqlQuery.createFromTemplateString;

export default class NSQLDatabase implements DatabaseInterface {
    db: SQLiteDatabase;
    constructor(
        filePath: string,
        options?: {
            threading?: boolean;
            flags?: number;
        }
    ) {
        this.db = openOrCreate(filePath, options);
    }
    indexToPlaceholder(i: number): string {
        return '?';
    }
    formatIdentifier(i: string): string {
        return i;
    }
    async disconnect() {
        await this.db.close();
    }
    async query(query: SqlQuery): Promise<any[]> {
        const compiledQuery = query.compile(this.indexToPlaceholder, this.formatIdentifier);
        const sqlQuery = compiledQuery.sql.trim();
        const isInsertQuery = sqlQuery.startsWith('INSERT INTO') || sqlQuery.startsWith('UPDATE');
        let result = isInsertQuery // when isInsertQuery == true, result is the id
            ? await this.db.execute(sqlQuery, compiledQuery.params)
            : await this.db.select(sqlQuery, compiledQuery.params);
        if (isInsertQuery && !result) {
            // create await an array result.
            result = [];
        }
        return result as any[];
    }

    sequence<T>(sequence: (query: (query: SqlQuery) => Promise<any[]>) => Promise<T>) {
        return this.db.transaction<T>(() => sequence((query: SqlQuery) => this.query(query) as any) as any) as any;
    }

    async migrate(migrations: { [key: string]: SqlQuery }) {
        await this.query(sql`
			CREATE TABLE IF NOT EXISTS "Migrations" (
				"name" TEXT PRIMARY KEY NOT NULL
			);
		`);
        const migrationsDone = await this.query(sql`SELECT * FROM "Migrations";`);

        for (const [migrationName, migrationQuery] of Object.entries(migrations)) {
            if (migrationsDone.some((migrationDone) => migrationDone.name === migrationName)) {
                continue;
            }

            await this.sequence(async (query) => {
                await query(sql`BEGIN;`);
                try {
                    await query(migrationQuery);
                    await query(sql`INSERT INTO "Migrations" VALUES (${migrationName});`);
                } catch (error) {
                    await query(sql`ROLLBACK;`);
                    throw error;
                }
                await query(sql`COMMIT;`);
            });
        }
    }
}
