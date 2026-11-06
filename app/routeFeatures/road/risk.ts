/** Risky road runs of a bike route, read off the route's Valhalla edges. Pure: nothing here may import NativeScript. */
import type { RiskRun } from '~/utils/routeAnalysis/types';

/** What the stats call returns per edge, `trace_attributes` shaped. */
export interface RiskEdge {
    /** km */
    length: number;
    begin_shape_index?: number;
    end_shape_index?: number;
    /** the tagged `maxspeed` in km/h, absent when untagged, `unlimited` for `maxspeed=none` */
    speed_limit?: number | 'unlimited';
    cycle_lane?: 'none' | 'shared' | 'dedicated' | 'separated';
    shoulder?: boolean;
    use?: string;
}

/** The edge attributes the risk needs, asked of the stats call. */
export const RISK_EDGE_ATTRIBUTES = ['edge.speed_limit', 'edge.cycle_lane', 'edge.shoulder', 'edge.use', 'edge.length', 'edge.begin_shape_index', 'edge.end_shape_index'];

/** The slider's floor: a candidate below it can never be flagged. */
export const MIN_CANDIDATE_SPEED = 50;
/** km/h an unlimited road counts as. */
export const UNLIMITED_SPEED = 130;
export const DEFAULT_RISK_THRESHOLD = 70;
/** meters, shorter runs are one vertex of noise: a short section still counts */
export const DEFAULT_RISK_MIN_LENGTH = 30;
/** meters of safe road between two risky runs that is not worth leaving the warning for */
export const RISK_BRIDGE = 50;

/** 3: no lane or a shared one, 2: a painted lane or a shoulder only. */
export type RiskLevel = 2 | 3;

export interface RiskSection {
    level: RiskLevel;
    /** route shape indexes */
    start: number;
    end: number;
    /** meters from the start */
    startDist: number;
    /** meters */
    length: number;
    /** km/h, the fastest of the section */
    speed: number;
}

export interface RiskOptions {
    /** km/h */
    threshold: number;
    /** meters, 0 keeps everything */
    minLength: number;
    bridge?: number;
}

// what a car drives on: an edge with no `use` is one too
const MOTOR_USES = ['road', 'ramp', 'turn_channel', 'null'];

const INFRA: Record<NonNullable<RiskEdge['cycle_lane']>, RiskRun['infra'] | undefined> = { none: 0, shared: 1, dedicated: 2, separated: undefined };

function speedOf(edge: RiskEdge): number | undefined {
    if (edge.speed_limit === 'unlimited') {
        return UNLIMITED_SPEED;
    }
    return edge.speed_limit > 0 ? edge.speed_limit : undefined;
}

/**
 * The stretches of motor road a bike rides that are fast enough to ever be flagged and have no separated lane. They are
 * kept whatever the user's threshold is, so changing it classifies again without a new fetch. `unknown`: meters of motor
 * road with no tagged limit, which are never flagged.
 */
export function riskCandidates(edges: RiskEdge[]): { candidates: RiskRun[]; unknown: number } {
    const candidates: RiskRun[] = [];
    let unknown = 0;
    let distance = 0;
    // the edge the last candidate ended at: a safe edge between two of them keeps them apart
    let lastCandidateEnd = -1;
    edges.forEach((edge, index) => {
        const length = edge.length * 1000;
        const startDist = distance;
        distance += length;
        if (edge.use && !MOTOR_USES.includes(edge.use)) {
            return;
        }
        const speed = speedOf(edge);
        if (speed === undefined) {
            unknown += length;
            return;
        }
        const infra = INFRA[edge.cycle_lane ?? 'none'];
        if (speed < MIN_CANDIDATE_SPEED || infra === undefined) {
            return;
        }
        const shoulder = edge.shoulder ? true : undefined;
        const previous = candidates[candidates.length - 1];
        if (previous && lastCandidateEnd === index - 1 && previous.speed === speed && previous.infra === infra && previous.shoulder === shoulder) {
            previous.end = edge.end_shape_index;
            previous.length += length;
        } else {
            candidates.push({ start: edge.begin_shape_index, end: edge.end_shape_index, startDist, length, speed, infra, ...(shoulder && { shoulder }) });
        }
        lastCandidateEnd = index;
    });
    return { candidates, unknown };
}

/** A painted lane or a shoulder alone is a margin, not a separation: medium. Nothing, or a shared lane, is high. */
function levelOf(run: RiskRun): RiskLevel {
    return run.infra === 2 || (run.infra === 0 && run.shoulder) ? 2 : 3;
}

/**
 * The sections the user is warned of: candidates at or over the threshold, a short stretch of safe road between two of them
 * bridged, then the ones under the minimum length dropped.
 */
export function classifyRisk(candidates: RiskRun[], { bridge = RISK_BRIDGE, minLength, threshold }: RiskOptions): RiskSection[] {
    const sections: RiskSection[] = [];
    candidates
        .filter((run) => run.speed >= threshold)
        .forEach((run) => {
            const previous = sections[sections.length - 1];
            const level = levelOf(run);
            if (previous && run.startDist - (previous.startDist + previous.length) < bridge) {
                previous.end = run.end;
                previous.length = run.startDist + run.length - previous.startDist;
                previous.speed = Math.max(previous.speed, run.speed);
                previous.level = Math.max(previous.level, level) as RiskLevel;
            } else {
                sections.push({ level, start: run.start, end: run.end, startDist: run.startDist, length: run.length, speed: run.speed });
            }
        });
    return sections.filter((section) => section.length >= minLength);
}
