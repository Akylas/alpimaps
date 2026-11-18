import { derived } from 'svelte/store';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { IItem } from '~/models/Item';
import { analysisChanged, computeLayers, layerStatuses, routeAnalysisChanges, saveAnalysis } from '~/routeFeatures/analysisRunner';
import { difficultyLegend, difficultyProfileLegend } from '~/routeFeatures/difficulty/legend';
import { difficultyColor, difficultyKey, difficultyPalette, difficultyShade } from '~/routeFeatures/difficulty/palette';
import { type DifficultyRead, legendLevels, readDifficulty } from '~/routeFeatures/difficulty/read';
import { type DifficultyScale, UNKNOWN_LEVEL, levelLabel, levelName, scaleForActivity } from '~/routeFeatures/difficulty/scale';
import { comfortStore, difficultySettingRows, difficultySettingsKey, routeFeatureDifficulty } from '~/routeFeatures/difficulty/settings';
import { difficultyStage } from '~/routeFeatures/difficulty/stage';
import { type LensChip, type LensHeadline, type LensProfile, type LensSection, type LensSlice, type RouteLens, registerRouteFeature } from '~/routeFeatures/registry';
import { activityOf } from '~/utils/routeAnalysis/activity';
import { withActivity } from '~/utils/routeAnalysis/storage';
import { showAlertOptionSelect } from '~/utils/ui';
import type { LayerStatus } from '~/utils/routeAnalysis/freshness';
import type { Activity, DifficultyRun } from '~/utils/routeAnalysis/types';

/** How many levels the line under the profile has room for. */
const PROFILE_LEGEND_LEVELS = 4;

/** More than this share of the route not rated: it is worth a chip of its own. */
const MAJORITY = 0.5;

const percent = (share: number) => Math.round(share * 100) + ' %';

/** The scale the route is read on, from its activity: none for a road bike, gravel or a motor route. */
const scaleOf = (item: IItem) => scaleForActivity(activityOf(item, item.analysis));

/** An imported or recorded track has no routing profile to tell what it is: the user says, so the lens can ask when it is not a hike or a bike ride. */
const asksActivity = (item: IItem) => !!item?.properties?.imported && !scaleOf(item);

const statusOf = (item: IItem) => layerStatuses(item).difficulty;

/** The user says what the route was ridden or walked as, then it is read. */
async function pickActivity(item: IItem) {
    const choices: { name: string; data: Omit<Activity, 'origin'> }[] = [
        { name: lc('climbs_preset_hiking'), data: { kind: 'hike', subtype: 'walk' } },
        { name: lc('bicycle'), data: { kind: 'bike', subtype: 'normal' } }
    ];
    const result = await showAlertOptionSelect(
        { height: choices.length * 56, rowHeight: 56, options: choices.map((choice) => ({ ...choice, boxType: 'circle', type: 'checkbox', value: false })) },
        { title: lc('difficulty_pick_title') }
    );
    if (result?.data) {
        item.analysis = withActivity(item.analysis, item.geometry, { ...result.data, origin: 'user' });
        saveAnalysis(item, item.analysis);
        analysisChanged();
        await computeLayers(item, ['difficulty']);
    }
}

const comfort: Record<DifficultyScale, number> = { sac: 0, mtb: 0 };
comfortStore('sac').subscribe((level) => (comfort.sac = level));
comfortStore('mtb').subscribe((level) => (comfort.mtb = level));

// the layer is replaced, never edited, so it keys what was read off it, with the profile it was laid on and the comfort level
const reads = new WeakMap<object, { key: string; data: unknown; read: DifficultyRead }>();

/** The route as the user's comfort level reads it, `null` until the layer is there, or while it is of another scale than the activity's. */
function readOf(item: IItem): DifficultyRead | null {
    const layer = item?.analysis?.layers.difficulty;
    const data = item?.profile?.data;
    const scale = scaleOf(item);
    if (!layer || !scale || layer.data.scale !== scale || !data?.length) {
        return null;
    }
    const key = String(comfort[scale]);
    const cached = reads.get(layer);
    if (cached?.key === key && cached.data === data) {
        return cached.read;
    }
    const read = readDifficulty(layer.data, data, comfort[scale]);
    reads.set(layer, { key, data, read });
    return read;
}

/** The layer is there but not for what the route is now (a bike ride was a hike): it is read as missing. */
function stateOf(read: DifficultyRead | null, status: LayerStatus): LensChip['state'] {
    if (status.state === 'queued' || status.state === 'running') {
        return 'running';
    }
    if (!read) {
        return 'missing';
    }
    return status.state === 'inputs-changed' ? 'outdated' : undefined;
}

const compute = (item: IItem) => () => computeLayers(item, ['difficulty']);

function missingHeadline(item: IItem, status: LayerStatus): LensHeadline {
    if (!scaleOf(item)) {
        return { facts: [{ icon: 'mdi-terrain', text: lc('difficulty_pick_activity') }], action: { label: lc('difficulty_pick'), run: () => pickActivity(item) } };
    }
    switch (status.state) {
        case 'queued':
        case 'running':
            return { facts: [{ icon: 'mdi-terrain', text: lc('difficulty_computing') }] };
        case 'failed':
            return { facts: [{ icon: 'mdi-alert-circle-outline', text: lc('difficulty_failed'), alert: true }], action: { label: lc('difficulty_retry'), run: compute(item) } };
        default:
            return { facts: [{ icon: 'mdi-terrain', text: lc('difficulty_not_computed') }], action: { label: lc('difficulty_compute'), run: compute(item) } };
    }
}

// built once per read: the chart redraws for a new one
const profiles = new WeakMap<DifficultyRead, LensProfile>();

function profileOf(read: DifficultyRead, runs: DifficultyRun[]): LensProfile {
    if (!profiles.has(read)) {
        profiles.set(read, {
            fill: runs.map(({ level, start }) => ({ d: start, color: difficultyColor(level), shade: difficultyShade(level) })).sort((first, second) => first.d - second.d),
            legend: difficultyProfileLegend(legendLevels(read.byLevel, PROFILE_LEGEND_LEVELS), read.scale, lc, formatDistance)
        });
    }
    return profiles.get(read);
}

const NO_SLICES: LensSlice[] = [];
const slices = new WeakMap<DifficultyRead, LensSlice[]>();
const sections = new WeakMap<DifficultyRead, LensSection[]>();

const difficultyLens: RouteLens = {
    id: 'difficulty',
    icon: 'mdi-terrain',
    label: () => lc('lens_difficulty'),
    available: ({ item }) => !!item?.route && (!!scaleOf(item) || asksActivity(item)),
    chip: ({ item }) => {
        const read = readOf(item);
        const chip: LensChip = { state: stateOf(read, statusOf(item)) };
        if (read?.hardest) {
            chip.value = levelLabel(read.scale, read.hardest.level);
            chip.alert = read.hardest.level > comfort[read.scale];
        }
        return chip;
    },
    headline: ({ item }) => {
        const status = statusOf(item);
        const read = readOf(item);
        if (!read) {
            return missingHeadline(item, status);
        }
        if (!read.hardest) {
            return { facts: [{ icon: 'mdi-help-circle-outline', text: lc('difficulty_none_rated') }] };
        }
        const { hardest, scale } = read;
        // only what is worth a chip: the rest is in the line under the profile
        const facts: LensHeadline['facts'] = [{ icon: 'mdi-circle', iconColor: difficultyColor(hardest.level), text: `${levelLabel(scale, hardest.level)} · ${formatDistance(hardest.length)}` }];
        if (read.above > 0) {
            facts.push({ icon: 'mdi-alert-outline', text: lc('difficulty_above', percent(read.aboveShare), levelLabel(scale, comfort[scale])), alert: true });
        }
        // what is not rated is not easy: said here when it is most of the route
        if (read.unknownShare > MAJORITY) {
            facts.push({ icon: 'mdi-help-circle-outline', iconColor: difficultyColor(UNKNOWN_LEVEL), text: percent(read.unknownShare) });
        }
        return { facts, action: status.state === 'failed' ? { label: lc('difficulty_retry'), run: compute(item) } : undefined };
    },
    readout: ({ index, item }) => {
        const layer = item.analysis?.layers.difficulty;
        const run = readOf(item) && layer?.data.runs.find(({ end, start }) => index >= start && index <= end);
        return run && levelName(layer.data.scale, run.level, lc);
    },
    profile: ({ item }) => {
        const read = readOf(item);
        return read ? profileOf(read, item.analysis.layers.difficulty.data.runs) : {};
    },
    sections: ({ item }) => {
        const read = readOf(item);
        if (!read) {
            return [];
        }
        if (!sections.has(read)) {
            sections.set(
                read,
                read.harder.map(({ length, run }, index) => ({ id: index, i0: run.start, i1: run.end, title: `${levelLabel(read.scale, run.level)} · ${formatDistance(length)}` }))
            );
        }
        return sections.get(read);
    },
    slices: ({ item }) => {
        const read = readOf(item);
        if (!read) {
            return NO_SLICES;
        }
        if (!slices.has(read)) {
            slices.set(
                read,
                item.analysis.layers.difficulty.data.runs.map(({ end, level, start }) => ({ i0: start, i1: end, k: difficultyKey(level), s: 0 }))
            );
        }
        return slices.get(read);
    },
    refresh: ({ item }) => computeLayers(item, ['difficulty']),
    legend: ({ item, palette, translate, variant }) => {
        const layer = item.analysis?.layers.difficulty;
        return layer && layer.data.scale === scaleOf(item) ? difficultyLegend({ levels: layer.data.runs.map(({ level }) => level), palette, scale: layer.data.scale, translate, variant }) : null;
    }
};

registerRouteFeature({
    id: 'difficulty',
    order: 25,
    setting: { title: () => lc('lens_difficulty'), store: routeFeatureDifficulty },
    settings: difficultySettingRows,
    // a layer finishing or failing, and the comfort level: what the lens says of the same layer
    changes: derived([routeAnalysisChanges, difficultySettingsKey], (values) => values.join()),
    lensPalette: difficultyPalette,
    lenses: [difficultyLens],
    compute: difficultyStage
});
