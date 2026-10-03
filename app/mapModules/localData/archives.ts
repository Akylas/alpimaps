// No NativeScript import: what a folder holds and how its archives chain together, kept pure.
import type { Handle, SourceSpec, SpecArg } from '@nativescript-community/ui-massifmaps/api';

export type ArchiveFormat = 'mbtiles' | 'pmtiles';
export type ArchiveRole = 'map' | 'routes' | 'contours' | 'terrain' | 'bathymap';

export interface LocalArchive {
    /** Path relative to the data folder: the key a disabled archive is saved under. */
    id: string;
    name: string;
    path: string;
    format: ArchiveFormat;
    role: ArchiveRole;
    size: number;
}

/** A sub folder: one area's archives, used together. */
export interface LocalRegion {
    id: string;
    name: string;
    archives: LocalArchive[];
}

export interface LocalInventory {
    folder: string;
    /** The archives at the folder's root, used wherever no region has the tile. */
    world: LocalArchive[];
    regions: LocalRegion[];
}

export type SourceInput = Handle | SourceSpec;

const FORMATS: Record<string, ArchiveFormat> = { mbtiles: 'mbtiles', etiles: 'mbtiles', pmtiles: 'pmtiles' };

// First match wins, anything else is a base map. A new kind of archive is one more rule.
const ROLE_RULES: { role: ArchiveRole; matches: (baseName: string, extension: string, raster: boolean) => boolean }[] = [
    { role: 'terrain', matches: (baseName, extension, raster) => extension === 'etiles' || raster || /terrain/i.test(baseName) },
    { role: 'bathymap', matches: (baseName) => /bathymap/i.test(baseName) },
    { role: 'routes', matches: (baseName) => /routes(_\d+)?$/i.test(baseName) },
    { role: 'contours', matches: (baseName) => /contours$/i.test(baseName) }
];

/** `format` is undefined for a file that is not an archive. */
export function splitArchiveName(fileName: string) {
    const dot = fileName.lastIndexOf('.');
    const extension = dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
    return { baseName: dot === -1 ? fileName : fileName.slice(0, dot), extension, format: FORMATS[extension] };
}

/** `raster`: a PMTiles header declaring image tiles, which can only be a DEM here. */
export function archiveRole(baseName: string, extension: string, raster = false): ArchiveRole {
    return ROLE_RULES.find((rule) => rule.matches(baseName, extension, raster))?.role ?? 'map';
}

export function archiveSpec(archive: Pick<LocalArchive, 'format' | 'path'>): SpecArg<'source', ArchiveFormat> {
    return { type: archive.format, path: archive.path };
}

export function archivesWithRole(archives: LocalArchive[], ...roles: ArchiveRole[]) {
    return archives.filter((archive) => roles.includes(archive.role));
}

/** `merged-mbvt` merges two vector sources tile by tile, so several archives are nested pairwise. */
export function mergedSpec(sources: SourceInput[]): SourceInput | null {
    if (!sources.length) {
        return null;
    }
    // nested to the right: the SDK reads a package's tile mask from a direct MBTiles child, and a
    // merge of two merges (4+ files) has none, so the first one, the base, heads every level
    return sources.reduceRight((merged, source) => ({ type: 'merged-mbvt', source, source2: merged }));
}

/** The first source that has a tile wins. */
export function orderedSpec(sources: SourceInput[]): SourceInput | null {
    const present = sources.filter((source) => source !== null && source !== undefined);
    if (!present.length) {
        return null;
    }
    return present.reduce((first, second) => ({ type: 'ordered', source: first, source2: second }));
}

/** A base map first, then routes and contours merged into it. */
export function vectorArchives(archives: LocalArchive[]) {
    return [...archivesWithRole(archives, 'map'), ...archivesWithRole(archives, 'routes', 'contours')];
}

/** What the map uses: disabled ids removed, regions emptied by it dropped. */
export function enabledLocalData(inventory: LocalInventory, disabled: Set<string>): LocalInventory {
    const enabled = (archive: LocalArchive) => !disabled.has(archive.id);
    return {
        folder: inventory.folder,
        world: inventory.world.filter(enabled),
        regions: inventory.regions
            .filter((region) => !disabled.has(region.id))
            .map((region) => ({ ...region, archives: region.archives.filter(enabled) }))
            .filter((region) => region.archives.length > 0)
    };
}

export interface ChainParts {
    /** Every region, behind one `multi` source. */
    regions?: SourceInput;
    /** The opt-in online source, for what no region holds. */
    online?: SourceInput;
    /** The root archives: the last resort, only where nothing else has the tile. */
    world?: SourceInput;
}

/** What vector and terrain chains share: region, else online, else world. */
export function fallbackChain({ online, regions, world }: ChainParts) {
    return orderedSpec([regions, online, world]);
}

/** `bathymap` is merged over whichever source answered, so it must stop before the style stops drawing it. */
export function vectorChain(parts: ChainParts & { bathymap?: SourceInput }) {
    const main = fallbackChain(parts);
    if (!parts.bathymap) {
        return main;
    }
    return main ? ({ type: 'merged-mbvt', source: main, source2: parts.bathymap } as const) : parts.bathymap;
}
