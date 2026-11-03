import type { LineString } from 'geojson';
import { describe, expect, it, vi } from 'vitest';
import { createAnalysis } from '~/utils/routeAnalysis/storage';
import type { Layer } from '~/utils/routeAnalysis/types';

vi.mock('@shared/db/NSQLDatabase', () => ({ default: class {} }));

import { GroupRepository, ItemRepository } from './Item';

function repository() {
    const itemRepository = new ItemRepository({} as any, new GroupRepository({} as any));
    const update = vi.spyOn(itemRepository, 'update').mockResolvedValue(undefined as any);
    const create = vi.spyOn(itemRepository, 'create').mockResolvedValue(undefined as any);
    return { itemRepository, update, create };
}

function line(vertexCount: number): LineString {
    return { type: 'LineString', coordinates: Array.from({ length: vertexCount }, (_, index) => [6 + index * 0.001, 45 + Math.sin(index) * 0.001]) };
}

function row(analysis: string | null | undefined, geometry = line(10)) {
    return { id: 1, geometry: JSON.stringify(geometry), properties: '{}', route: 'null', profile: 'null', stats: 'null', instructions: 'null', analysis } as any;
}

const weatherLayer = { prov: { computedAt: 1, inputsHash: 'h', provider: 'test', quality: 'ok' }, data: {} } as Layer<any>;

describe('ItemRepository analysis column', () => {
    it('is added by a named migration, not by the create statement', () => {
        const { itemRepository } = repository();
        expect(Object.keys(itemRepository.migrations)).toEqual(['addAnalysis']);
        expect(
            itemRepository.migrations.addAnalysis.compile(
                () => '?',
                (name) => name
            ).sql
        ).toMatch(/ALTER TABLE Items ADD COLUMN analysis TEXT/);
    });

    describe('reading', () => {
        it('reads a row from before the column as null', () => {
            const { itemRepository } = repository();
            expect(itemRepository.prepareGetItem(row(null)).analysis).toBeNull();
            expect(itemRepository.prepareGetItem(row(undefined)).analysis).toBeNull();
        });
        it('reads an unreadable value as null', () => {
            const { itemRepository } = repository();
            expect(itemRepository.prepareGetItem(row('{nope')).analysis).toBeNull();
        });
        it('parses it once, lazily', () => {
            const { itemRepository } = repository();
            const analysis = createAnalysis(line(10));
            const item = itemRepository.prepareGetItem(row(JSON.stringify(analysis)));
            expect(item.analysis).toEqual(analysis);
            expect(item.analysis).toBe(item.analysis);
        });
        it('keeps a new value over the raw column', () => {
            const { itemRepository } = repository();
            const item = itemRepository.prepareGetItem(row(JSON.stringify(createAnalysis(line(10)))));
            const replacement = createAnalysis(line(10), { kind: 'hike', origin: 'user' });
            item.analysis = replacement;
            expect(item.analysis).toBe(replacement);
            expect(item._analysis).toBeUndefined();
        });
        it('is not part of toJSON', () => {
            const { itemRepository } = repository();
            const item = itemRepository.prepareGetItem(row(JSON.stringify(createAnalysis(line(10)))));
            expect(item.toJSON()).not.toHaveProperty('analysis');
        });
    });

    describe('saving a whole item', () => {
        it('writes the analysis back when the geometry did not change', async () => {
            const { itemRepository, update } = repository();
            const analysis = createAnalysis(line(10));
            analysis.layers.weather = weatherLayer;
            const item = itemRepository.prepareGetItem(row(JSON.stringify(analysis)));
            await itemRepository.updateItem(item as any);
            expect(JSON.parse(String(update.mock.calls[0][1].analysis))).toEqual(analysis);
        });
        it('writes a change made to the parsed analysis, however it was made', async () => {
            const { itemRepository, update } = repository();
            const item = itemRepository.prepareGetItem(row(JSON.stringify(createAnalysis(line(10)))));
            item.analysis.layers.weather = weatherLayer;
            await itemRepository.updateItem(item as any);
            expect(JSON.parse(String(update.mock.calls[0][1].analysis)).layers.weather).toBeDefined();
            // a copy, as the partial update hands back, has no setter to clear the stored string
            const copy = { ...item, analysis: createAnalysis(line(10), { kind: 'hike', origin: 'user' }) };
            await itemRepository.updateItem(copy as any);
            expect(JSON.parse(String(update.mock.calls[1][1].analysis)).inputs.activity).toEqual({ kind: 'hike', origin: 'user' });
        });
        it('leaves a stored value this build cannot read as it is', async () => {
            const { itemRepository, update } = repository();
            const newer = JSON.stringify({ v: 2, anything: true });
            await itemRepository.updateItem(itemRepository.prepareGetItem(row(newer)) as any);
            expect(update.mock.calls[0][1].analysis).toBe(newer);
        });
        it('clears it when it was set to null', async () => {
            const { itemRepository, update } = repository();
            const item = itemRepository.prepareGetItem(row(JSON.stringify(createAnalysis(line(10)))));
            item.analysis = null;
            await itemRepository.updateItem(item as any);
            expect(update.mock.calls[0][1].analysis).toBeNull();
        });
        it('drops the layers of an edited route', async () => {
            const { itemRepository, update } = repository();
            const analysis = createAnalysis(line(10), { kind: 'bike', subtype: 'road', origin: 'user' });
            analysis.layers.weather = weatherLayer;
            // the stored geometry is the edited one
            const item = itemRepository.prepareGetItem(row(JSON.stringify(analysis), line(12)));
            await itemRepository.updateItem(item as any);
            const saved = JSON.parse(String(update.mock.calls[0][1].analysis));
            expect(saved.layers).toEqual({});
            expect(saved.inputs.activity).toEqual({ kind: 'bike', subtype: 'road', origin: 'user' });
            expect(item.analysis.layers).toEqual({});
        });
        it('writes null when there is none', async () => {
            const { itemRepository, update } = repository();
            await itemRepository.updateItem(itemRepository.prepareGetItem(row(null)) as any);
            expect(update.mock.calls[0][1].analysis).toBeNull();
        });
    });

    describe('creating', () => {
        it('writes the analysis it is given, and null otherwise', async () => {
            const { create, itemRepository } = repository();
            const analysis = createAnalysis(line(10));
            await itemRepository.createItem({ id: 1, geometry: line(10), analysis } as any);
            await itemRepository.createItem({ id: 2, geometry: line(10) } as any);
            expect(JSON.parse(String(create.mock.calls[0][0].analysis))).toEqual(analysis);
            expect(create.mock.calls[1][0].analysis).toBeNull();
        });
    });

    it('drops the layers when a partial update changes the geometry', async () => {
        const { itemRepository, update } = repository();
        const analysis = createAnalysis(line(10));
        analysis.layers.weather = weatherLayer;
        const item = itemRepository.prepareGetItem(row(JSON.stringify(analysis)));
        await itemRepository.updateItem(item as any, { geometry: line(12) });
        const saved = update.mock.calls[0][1];
        expect(JSON.parse(String(saved.analysis)).layers).toEqual({});
        expect(JSON.parse(String(saved.geometry))).toEqual(line(12));
        // the same geometry again keeps them
        await itemRepository.updateItem(item as any, { geometry: line(10) });
        expect(update.mock.calls[1][1]).not.toHaveProperty('analysis');
    });

    it('updates a single field without touching the analysis', async () => {
        const { itemRepository, update } = repository();
        const item = itemRepository.prepareGetItem(row(JSON.stringify(createAnalysis(line(10)))));
        await itemRepository.updateItem(item as any, { image_path: 'a.jpg' });
        expect(update.mock.calls[0][1]).toEqual({ image_path: 'a.jpg' });
    });
});
