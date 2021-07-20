import { SQLiteDatabase, openOrCreate } from '@akylas/nativescript-sqlite';

import { setDefaultConfig } from 'gtfs/lib/utils';
let db: TransitDatabase;

export class TransitDatabase {
    db: SQLiteDatabase;

    constructor(sqlitePath) {
        this.db = openOrCreate(sqlitePath, {});
    }

    async close() {
        await this.db.close();
    }
}

export async function openDb(initialConfig) {
    const config = setDefaultConfig(initialConfig);
    if (!db) {
        db = new TransitDatabase(config.sqlitePath);
    }

    return db;
}

export async function closeDb() {
    await db.close();
    db = undefined;
}

export function getDb() {
    if (db) {
        return db;
    }

    throw new Error('No database connection. Call `openDb(config)` before using any methods.');
}
