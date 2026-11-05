/** The route page's rows, flat for its one collectionview. Pure: nothing here may import NativeScript. */
import type { LensFact, RouteCtx, RoutePageRow, RoutePageSection } from '~/routeFeatures/registry';

export type PageRow =
    | { type: 'tiles'; key: 'tiles' }
    | { type: 'profile'; key: 'profile' }
    | { type: 'section'; key: string; section: RoutePageSection; open: boolean; summary?: string; facts?: LensFact[] }
    | { type: 'body'; key: string; section: string; row: RoutePageRow; /** The card's last row, which rounds its bottom. */ last: boolean }
    | { type: 'footer'; key: 'footer' };

/** Section id to open, as the user left it on this visit; a section missing here is closed. */
export type StoredSections = Record<string, boolean>;

/** What the user chose; closed until then, so the page opens on its tiles and profile. */
export function isSectionOpen(section: Pick<RoutePageSection, 'id'>, stored: StoredSections): boolean {
    return stored[section.id] ?? false;
}

/** A section's body as list rows, its last one rounding the card. */
export function bodyRows(sectionId: string, body: RoutePageRow[]): PageRow[] {
    return body.map((row, index) => ({ type: 'body', key: `${sectionId}:${row.key}`, section: sectionId, row, last: index === body.length - 1 }));
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
        rows.push({ type: 'section', key: 'section:' + section.id, section, open, summary: section.summary?.(ctx), facts: section.facts?.(ctx) });
        if (open) {
            rows.push(...bodyRows(section.id, body));
        }
    });
    rows.push({ type: 'footer', key: 'footer' });
    return rows;
}

/** What the page's list holds: the page rows and the page's own, around them. */
export type ListRow = PageRow | { type: 'hero' | 'passed' | 'when'; key: string };
