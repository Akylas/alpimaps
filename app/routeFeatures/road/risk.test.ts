import { describe, expect, it } from 'vitest';
import type { RiskRun } from '~/utils/routeAnalysis/types';
import { type RiskEdge, classifyRisk, riskCandidates } from './risk';

/** An edge `metres` long, shape indexes continuing from `begin`. */
function edge(metres: number, begin: number, attributes: Partial<RiskEdge> = {}): RiskEdge {
    return { length: metres / 1000, begin_shape_index: begin, end_shape_index: begin + 1, ...attributes };
}

function run(startDist: number, length: number, attributes: Partial<RiskRun> = {}): RiskRun {
    return { start: 0, end: 1, startDist, length, speed: 80, infra: 0, ...attributes };
}

const options = { threshold: 70, minLength: 30 };

describe('riskCandidates', () => {
    it('keeps a fast motor edge without a separated lane, with its distance and shape range', () => {
        const { candidates, unknown } = riskCandidates([edge(500, 0, { speed_limit: 30, use: 'road' }), edge(400, 1, { speed_limit: 80, cycle_lane: 'none', use: 'road' })]);
        expect(candidates).toEqual([{ start: 1, end: 2, startDist: 500, length: 400, speed: 80, infra: 0 }]);
        expect(unknown).toBe(0);
    });

    it('treats an edge without a use as a motor road', () => {
        expect(riskCandidates([edge(100, 0, { speed_limit: 90 })]).candidates).toHaveLength(1);
    });

    it('ignores what a car does not drive on', () => {
        const edges = ['cycleway', 'path', 'footway', 'steps'].map((use, index) => edge(100, index, { speed_limit: 90, use }));
        expect(riskCandidates(edges)).toEqual({ candidates: [], unknown: 0 });
    });

    it('reads a limit under the slider floor as fine, and says nothing of it', () => {
        expect(riskCandidates([edge(300, 0, { speed_limit: 30, use: 'road' })])).toEqual({ candidates: [], unknown: 0 });
    });

    it('counts a motor road with no tagged limit as not evaluated, never as a candidate', () => {
        const { candidates, unknown } = riskCandidates([edge(300, 0, { use: 'road' }), edge(200, 1, { speed_limit: 80, use: 'road' })]);
        expect(unknown).toBe(300);
        expect(candidates).toHaveLength(1);
    });

    it('takes an unlimited road for 130 km/h', () => {
        expect(riskCandidates([edge(100, 0, { speed_limit: 'unlimited' })]).candidates[0].speed).toBe(130);
    });

    it('drops a road with a separated lane', () => {
        expect(riskCandidates([edge(100, 0, { speed_limit: 90, cycle_lane: 'separated' })]).candidates).toEqual([]);
    });

    it('maps the lane to an infra level', () => {
        const infras = (['none', 'shared', 'dedicated'] as const).map((cycle_lane, index) => riskCandidates([edge(100, index, { speed_limit: 90, cycle_lane })]).candidates[0].infra);
        expect(infras).toEqual([0, 1, 2]);
    });

    it('flags a shoulder', () => {
        expect(riskCandidates([edge(100, 0, { speed_limit: 90, shoulder: true })]).candidates[0].shoulder).toBe(true);
    });

    it('merges the edges valhalla cut at every junction', () => {
        const { candidates } = riskCandidates([edge(100, 0, { speed_limit: 80 }), edge(150, 1, { speed_limit: 80 })]);
        expect(candidates).toEqual([{ start: 0, end: 2, startDist: 0, length: 250, speed: 80, infra: 0 }]);
    });

    it('keeps apart edges that differ, or that a safe edge parts', () => {
        expect(riskCandidates([edge(100, 0, { speed_limit: 80 }), edge(100, 1, { speed_limit: 90 })]).candidates).toHaveLength(2);
        expect(riskCandidates([edge(100, 0, { speed_limit: 80 }), edge(100, 1, { speed_limit: 80, cycle_lane: 'dedicated' })]).candidates).toHaveLength(2);
        expect(riskCandidates([edge(100, 0, { speed_limit: 80 }), edge(100, 1, { speed_limit: 30 }), edge(100, 2, { speed_limit: 80 })]).candidates).toHaveLength(2);
    });
});

describe('classifyRisk', () => {
    it('keeps the runs from the threshold up', () => {
        const sections = classifyRisk([run(0, 100, { speed: 60 }), run(500, 100, { speed: 70 }), run(900, 100, { speed: 90 })], options);
        expect(sections.map((section) => section.speed)).toEqual([70, 90]);
    });

    it('follows the threshold it is given, without a new fetch', () => {
        const candidates = [run(0, 100, { speed: 60 })];
        expect(classifyRisk(candidates, { ...options, threshold: 50 })).toHaveLength(1);
        expect(classifyRisk(candidates, { ...options, threshold: 70 })).toHaveLength(0);
    });

    it('is high with no lane or a shared one, medium with a painted lane or a shoulder alone', () => {
        const levels = classifyRisk(
            [run(0, 100), run(200, 100, { infra: 1 }), run(400, 100, { infra: 2 }), run(600, 100, { shoulder: true }), run(800, 100, { infra: 1, shoulder: true })],
            options
        ).map((section) => section.level);
        expect(levels).toEqual([3, 3, 2, 2, 3]);
    });

    it('keeps a short section, only dropping what is under the minimum length', () => {
        expect(classifyRisk([run(0, 35)], options)).toHaveLength(1);
        expect(classifyRisk([run(0, 30)], options)).toHaveLength(1);
        expect(classifyRisk([run(0, 25)], options)).toHaveLength(0);
        expect(classifyRisk([run(0, 5)], { ...options, minLength: 0 })).toHaveLength(1);
    });

    it('bridges a small gap into one section with the higher level and speed', () => {
        const [section, ...rest] = classifyRisk([run(0, 100, { speed: 80, infra: 2 }), run(130, 100, { speed: 90, infra: 0 })], options);
        expect(rest).toEqual([]);
        expect(section).toMatchObject({ startDist: 0, length: 230, speed: 90, level: 3, start: 0, end: 1 });
    });

    it('does not bridge a gap of the bridge length or more', () => {
        expect(classifyRisk([run(0, 100), run(150, 100)], options)).toHaveLength(2);
    });

    it('bridges before it drops, so two short runs close together pass the minimum', () => {
        expect(classifyRisk([run(0, 20), run(30, 20)], options)).toHaveLength(1);
    });
});
