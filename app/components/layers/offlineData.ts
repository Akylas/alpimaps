import type { ArchiveRole, LocalArchive } from '~/mapModules/localData/archives';
import { formatSize } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';

// the order roles are listed in
const ARCHIVE_ROLES: ArchiveRole[] = ['map', 'routes', 'contours', 'terrain', 'bathymap'];

// literal names: the icon font build scans the sources for them
export const ARCHIVE_ROLE_ICONS: Record<ArchiveRole, string> = {
    map: 'mdi-map-outline',
    routes: 'mdi-map-marker-path',
    contours: 'mdi-chart-line-variant',
    terrain: 'mdi-terrain',
    bathymap: 'mdi-waves'
};
const ARCHIVE_ROLE_LABELS: Record<ArchiveRole, string> = {
    map: 'map',
    routes: 'routes',
    contours: 'contours',
    terrain: 'terrain',
    bathymap: 'bathymetry'
};

export function archiveRoleLabel(role: ArchiveRole) {
    return lc(ARCHIVE_ROLE_LABELS[role]);
}

/** "map · terrain · 410 MB": what a set of archives brings, then its weight. */
export function archivesSummary(archives: LocalArchive[]) {
    const roles = ARCHIVE_ROLES.filter((role) => archives.some((archive) => archive.role === role)).map(archiveRoleLabel);
    return [...roles, formatSize(archives.reduce((total, archive) => total + archive.size, 0))].join(' · ');
}
