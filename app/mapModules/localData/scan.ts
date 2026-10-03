import { File } from '@nativescript/core';
import { derived } from 'svelte/store';
import { settingsStore } from '~/stores/settingsStore';
import { listFolder } from '~/utils/utils';
import { type LocalArchive, type LocalInventory, type LocalRegion, archiveRole, splitArchiveName } from './archives';
import { readPMTilesTileType } from './pmtilesHeader';

const PMTILES_VECTOR = 1;

/** Off by default: the local map stays offline unless asked. */
export const localMapOnlineFallback = settingsStore('local_map_online_fallback', false);
export const localTerrainOnlineFallback = settingsStore('local_terrain_online_fallback', false);

/** Region and root archive ids left out of the map. */
const disabledLocalDataJson = settingsStore('local_data_disabled', '[]');
export const disabledLocalData = derived(disabledLocalDataJson, (json) => new Set<string>(JSON.parse(json)));

export function setLocalDataEnabled(id: string, enabled: boolean) {
    disabledLocalDataJson.update((json) => {
        const ids = new Set<string>(JSON.parse(json));
        if (enabled) {
            ids.delete(id);
        } else {
            ids.add(id);
        }
        return JSON.stringify([...ids]);
    });
}

function toArchive(entity: { name?: string; path?: string }, parentId?: string): LocalArchive | null {
    const { baseName, extension, format } = splitArchiveName(entity.name);
    if (!format) {
        return null;
    }
    const tileType = format === 'pmtiles' ? readPMTilesTileType(entity.path) : null;
    return {
        id: parentId ? `${parentId}/${entity.name}` : entity.name,
        name: entity.name,
        path: entity.path,
        format,
        role: archiveRole(baseName, extension, tileType !== null && tileType !== PMTILES_VECTOR),
        size: File.fromPath(entity.path).size
    };
}

/** One level deep: archives at the root are the world, each sub folder is a region. */
export function scanLocalData(folder: string): LocalInventory {
    const entities = listFolder(folder);
    const world = entities
        .filter((entity) => !entity.isFolder)
        .map((entity) => toArchive(entity))
        .filter(Boolean);
    const regions: LocalRegion[] = entities
        .filter((entity) => entity.isFolder)
        // kept from the scan before: reverse name order, the order `multi` tries them in
        .sort((first, second) => second.name.localeCompare(first.name))
        .map((entity) => ({
            id: entity.name,
            name: entity.name.replace(/_/g, ' '),
            archives: listFolder(entity.path)
                .filter((child) => !child.isFolder)
                .map((child) => toArchive(child, entity.name))
                .filter(Boolean)
        }))
        .filter((region) => region.archives.length > 0);
    return { folder, world, regions };
}
