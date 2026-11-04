import { convertElevation, formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { categoryLabel, readClimbs } from '~/routeFeatures/climbs/data';
import { type LensFact, type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';

const climbsLens: RouteLens = {
    id: 'climbs',
    icon: 'mdi-slope-uphill',
    label: () => lc('lens_climbs'),
    available: ({ item }) => !!item?.route && !!readClimbs(item),
    chip: ({ item }) => {
        const read = readClimbs(item);
        // a very steep way up turns the icon red; the profile marks where
        return read ? { value: String(read.climbs.length), alert: read.marks.length > 0 } : {};
    },
    headline: ({ item }) => {
        const read = readClimbs(item);
        if (!read?.climbs.length) {
            return { facts: [{ text: lc('climbs_none') }] };
        }
        const { best } = read;
        const facts: LensFact[] = [{ icon: 'mdi-slope-uphill', text: lc('climbs_count', read.climbs.length) }];
        if (best.category) {
            facts.push({ icon: 'mdi-triangle-outline', text: lc('climb_summit_at', categoryLabel(best.category), formatDistance(best.endDistance)) });
        }
        const ascent = item.profile?.dplus;
        if (ascent > 0) {
            facts.push({ icon: 'mdi-arrow-top-right', text: convertElevation(ascent) });
        }
        return { facts };
    },
    profile: ({ item }) => ({ brackets: readClimbs(item)?.brackets }),
    sections: ({ item }) => readClimbs(item)?.sections ?? [],
    slices: ({ item }) => readClimbs(item)?.slices ?? []
};

registerRouteFeature({ id: 'climbs', order: 12, lenses: [climbsLens], attention: ({ item }) => readClimbs(item)?.marks ?? [] });
