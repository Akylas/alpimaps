/** The route page's rows, flat for its one collectionview. Pure: nothing here may import NativeScript. */
import type { RouteCtx, RoutePageRow, RoutePageSection } from '~/routeFeatures/registry';

export type PageRow =
    | { type: 'tiles'; key: 'tiles' }
    | { type: 'profile'; key: 'profile' }
    | { type: 'section'; key: string; section: RoutePageSection; open: boolean; summary?: string }
    | { type: 'body'; key: string; section: string; row: RoutePageRow; /** The card's last row, which rounds its bottom. */ last: boolean }
    | { type: 'footer'; key: 'footer' };

/** Section id to open, as the user left it on this visit; a section missing here is closed. */
export type StoredSections = Record<string, boolean>;

/** What the user chose; closed until then, so the page opens on its tiles and profile. */
export function isSectionOpen(section: Pick<RoutePageSection, 'id'>, stored: StoredSections): boolean {
    return stored[section.id] ?? false;
}

/** The stored choices once the user taps the section's header. */
export function toggledSections(stored: StoredSections, section: Pick<RoutePageSection, 'id'>): StoredSections {
    return { ...stored, [section.id]: !isSectionOpen(section, stored) };
}

export function pageRows({ ctx, hasProfile, sections, stored }: { sections: RoutePageSection[]; ctx: RouteCtx; stored: StoredSections; hasProfile: boolean }): PageRow[] {
    const rows: PageRow[] = [{ type: 'tiles', key: 'tiles' }];
    if (hasProfile) {
        rows.push({ type: 'profile', key: 'profile' });
    }
    sections.forEach((section) => {
        const body = section.rows(ctx);
        if (!body.length) {
            return;
        }
        const open = isSectionOpen(section, stored);
        rows.push({ type: 'section', key: 'section:' + section.id, section, open, summary: section.summary?.(ctx) });
        if (open) {
            body.forEach((row, index) => rows.push({ type: 'body', key: `${section.id}:${row.key}`, section: section.id, row, last: index === body.length - 1 }));
        }
    });
    rows.push({ type: 'footer', key: 'footer' });
    return rows;
}
