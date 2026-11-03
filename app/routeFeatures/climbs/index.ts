import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import { categoryLabel, readClimbs } from '~/routeFeatures/climbs/data';
import { type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';

const climbsLens: RouteLens = {
    id: 'climbs',
    icon: 'mdi-slope-uphill',
    label: () => lc('lens_climbs'),
    available: ({ item }) => !!item?.route && !!readClimbs(item),
    chip: ({ item }) => {
        const read = readClimbs(item);
        // a very steep way up is what the dot is for
        return read ? { value: String(read.climbs.length), alert: read.steep.some((section) => section.direction === 'up' && section.level === 2) } : {};
    },
    headline: ({ item }) => {
        const read = readClimbs(item);
        if (!read?.climbs.length) {
            return { text: lc('climbs_none') };
        }
        const { best } = read;
        return {
            text: [
                lc('climbs_count', read.climbs.length),
                best.category && `${categoryLabel(best.category)} · ${formatDistance(best.endDistance)}`,
                lc('climbs_max_grade', Math.round(read.maxGrade) + ' %')
            ]
                .filter(Boolean)
                .join(' · ')
        };
    },
    profile: ({ item }) => ({ brackets: readClimbs(item)?.brackets })
};

registerRouteFeature({ id: 'climbs', order: 12, lenses: [climbsLens] });
