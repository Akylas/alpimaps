/** What the difficulty lens says of a route, read off its runs and the profile they are laid on. Pure: nothing here may import NativeScript. */
import { type DifficultyScale, UNKNOWN_LEVEL } from '~/routeFeatures/difficulty/scale';
import type { DifficultyRun } from '~/utils/routeAnalysis/types';

export interface DifficultyRead {
    scale: DifficultyScale;
    /** m, of each run the profile has a place for */
    lengths: number[];
    /** m the runs cover */
    total: number;
    /** m with a level, and m without: neither is read for the other */
    rated: number;
    unknown: number;
    /** m above the comfort level, and its share of the route */
    above: number;
    aboveShare: number;
    unknownShare: number;
    /** The highest level, the longest stretch of it. Never a stretch that is not rated. */
    hardest?: { level: number; length: number; run: DifficultyRun };
    /** m by level, the lowest first and the unknown last. */
    byLevel: { level: number; meters: number }[];
    /** The runs above the comfort level, in route order. */
    harder: { run: DifficultyRun; length: number }[];
}

/** `null` when the route has no profile to measure the runs on. */
export function readDifficulty({ runs, scale }: { scale: DifficultyScale; runs: DifficultyRun[] }, profile: { d: number }[], comfort: number): DifficultyRead | null {
    if (!profile?.length) {
        return null;
    }
    const read: DifficultyRead = { scale, lengths: [], total: 0, rated: 0, unknown: 0, above: 0, aboveShare: 0, unknownShare: 0, byLevel: [], harder: [] };
    const meters = new Map<number, number>();
    for (const run of runs) {
        if (!profile[run.start] || !profile[run.end]) {
            continue;
        }
        const length = profile[run.end].d - profile[run.start].d;
        read.lengths.push(length);
        read.total += length;
        meters.set(run.level, (meters.get(run.level) ?? 0) + length);
        if (run.level === UNKNOWN_LEVEL) {
            read.unknown += length;
            continue;
        }
        read.rated += length;
        if (run.level > comfort) {
            read.above += length;
            read.harder.push({ run, length });
        }
        if (!read.hardest || run.level > read.hardest.level || (run.level === read.hardest.level && length > read.hardest.length)) {
            read.hardest = { level: run.level, length, run };
        }
    }
    if (read.total > 0) {
        read.aboveShare = read.above / read.total;
        read.unknownShare = read.unknown / read.total;
    }
    read.byLevel = [...meters]
        .map(([level, levelMeters]) => ({ level, meters: levelMeters }))
        .sort((first, second) => (first.level === UNKNOWN_LEVEL ? 1 : second.level === UNKNOWN_LEVEL ? -1 : first.level - second.level));
    return read;
}

/** The levels the legend under the profile has room for: the biggest, in the order of the levels. */
export function legendLevels(byLevel: DifficultyRead['byLevel'], max: number): DifficultyRead['byLevel'] {
    const biggest = new Set([...byLevel].sort((first, second) => second.meters - first.meters).slice(0, max));
    return byLevel.filter((entry) => biggest.has(entry));
}
