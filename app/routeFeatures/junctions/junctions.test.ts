import { describe, expect, it } from 'vitest';
import { type Fix, type Junction, destinationPoint, exitSide, lookAheadDue, parseLookAhead, roadAheadChip, turnOptions } from './junctions';

const junction = (distance: number, exits: Junction['exits'], arrival = 0): Junction => ({ distance, lat: 45, lon: 6, arrival, exits });

describe('exitSide', () => {
    it('puts an exit on the left or right of the way in', () => {
        expect(exitSide(0, 90)).toBe('right');
        expect(exitSide(0, 270)).toBe('left');
        expect(exitSide(0, 45)).toBe('right');
        expect(exitSide(0, 315)).toBe('left');
    });

    it('turns around the compass', () => {
        expect(exitSide(350, 80)).toBe('right');
        expect(exitSide(10, 280)).toBe('left');
        expect(exitSide(270, 0)).toBe('right');
    });

    it('is no side for straight on, a slight bend or the way back', () => {
        expect(exitSide(0, 0)).toBeNull();
        expect(exitSide(0, 10)).toBeNull();
        expect(exitSide(0, 350)).toBeNull();
        expect(exitSide(0, 180)).toBeNull();
        expect(exitSide(0, 170)).toBeNull();
    });
});

describe('turnOptions', () => {
    const rightOnly = junction(80, [
        { heading: 90, enterable: true },
        { heading: 270, enterable: false }
    ]);
    const both = junction(200, [
        { heading: 90, enterable: true },
        { heading: 270, enterable: true }
    ]);

    it('gives the first junction where each side may be entered, with the distance from here', () => {
        expect(turnOptions([rightOnly, both], 30, 500)).toEqual({ left: { distance: 170, lat: 45, lon: 6 }, right: { distance: 50, lat: 45, lon: 6 } });
    });

    it('skips an exit that may not be entered', () => {
        expect(turnOptions([rightOnly], 0, 500)).toEqual({ left: null, right: { distance: 80, lat: 45, lon: 6 } });
    });

    it('ignores junctions behind and beyond the lead', () => {
        expect(turnOptions([rightOnly, both], 100, 500).right?.distance).toBe(100);
        expect(turnOptions([rightOnly, both], 100, 90)).toEqual({ left: null, right: null });
    });

    it('is a junction under the user, not one just passed', () => {
        expect(turnOptions([rightOnly], 80, 500).right?.distance).toBe(0);
        expect(turnOptions([rightOnly], 81, 500).right).toBeNull();
    });

    it('reads each junction against its own way in', () => {
        const east = junction(
            40,
            [
                { heading: 0, enterable: true },
                { heading: 180, enterable: true }
            ],
            90
        );
        expect(turnOptions([east], 0, 500)).toEqual({ left: { distance: 40, lat: 45, lon: 6 }, right: { distance: 40, lat: 45, lon: 6 } });
        expect(turnOptions([junction(40, [{ heading: 90, enterable: true }], 90)], 0, 500)).toEqual({ left: null, right: null });
    });
});

describe('roadAheadChip', () => {
    it('is the distance to a no-entry or an end within the lead', () => {
        expect(roadAheadChip({ kind: 'noEntry', distance: 140 }, 20, 500)).toEqual({ kind: 'noEntry', distance: 120 });
        expect(roadAheadChip({ kind: 'end', distance: 300 }, 0, 500)).toEqual({ kind: 'end', distance: 300 });
    });

    it('is nothing when far, behind or absent', () => {
        expect(roadAheadChip({ kind: 'noEntry', distance: 900 }, 0, 500)).toBeNull();
        expect(roadAheadChip({ kind: 'noEntry', distance: 10 }, 20, 500)).toBeNull();
        expect(roadAheadChip(undefined, 0, 500)).toBeNull();
    });
});

describe('parseLookAhead', () => {
    it('reads the SDK look-ahead JSON', () => {
        const json = JSON.stringify({
            junctions: [
                {
                    distance: 140,
                    lat: 46.1,
                    lon: 6.2,
                    arrival: 92,
                    exits: [
                        { heading: 2, enterable: true },
                        { heading: 182, enterable: false }
                    ]
                }
            ],
            ahead: { kind: 'noEntry', distance: 310 }
        });
        expect(parseLookAhead(json)).toEqual({
            junctions: [
                {
                    distance: 140,
                    lat: 46.1,
                    lon: 6.2,
                    arrival: 92,
                    exits: [
                        { heading: 2, enterable: true },
                        { heading: 182, enterable: false }
                    ]
                }
            ],
            ahead: { kind: 'noEntry', distance: 310 }
        });
    });

    it('is empty for a missing or broken answer', () => {
        expect(parseLookAhead('{}')).toEqual({ junctions: [] });
        expect(parseLookAhead('not json')).toEqual({ junctions: [] });
        expect(parseLookAhead(undefined)).toEqual({ junctions: [] });
    });
});

describe('destinationPoint', () => {
    it('goes north, east and south by the meters asked', () => {
        const north = destinationPoint(45, 6, 0, 111.195);
        expect(north.lat).toBeCloseTo(45.001, 5);
        expect(north.lon).toBeCloseTo(6, 6);
        expect(destinationPoint(0, 6, 90, 111.195).lon).toBeCloseTo(6.001, 5);
        expect(destinationPoint(45, 6, 180, 111.195).lat).toBeCloseTo(44.999, 5);
    });

    it('covers less longitude per meter away from the equator', () => {
        expect(destinationPoint(60, 6, 90, 111.195).lon - 6).toBeCloseTo(0.002, 4);
    });
});

describe('lookAheadDue', () => {
    const fix = (overrides: Partial<Fix> = {}): Fix => ({ lat: 45, lon: 6, bearing: 90, time: 10000, ...overrides });
    const metersNorth = (meters: number) => 45 + meters / 111195;

    it('asks the first time the heading is known, never without one', () => {
        expect(lookAheadDue(null, fix())).toBe(true);
        expect(lookAheadDue(null, fix({ bearing: -1 }))).toBe(false);
        expect(lookAheadDue(fix(), fix({ bearing: -1, time: 20000 }))).toBe(false);
    });

    it('waits for enough movement or a turn', () => {
        expect(lookAheadDue(fix(), fix({ lat: metersNorth(10), time: 20000 }))).toBe(false);
        expect(lookAheadDue(fix(), fix({ lat: metersNorth(25), time: 20000 }))).toBe(true);
        expect(lookAheadDue(fix(), fix({ bearing: 100, time: 20000 }))).toBe(false);
        expect(lookAheadDue(fix(), fix({ bearing: 130, time: 20000 }))).toBe(true);
        expect(lookAheadDue(fix({ bearing: 350 }), fix({ bearing: 20, time: 20000 }))).toBe(true);
    });

    it('is not due again within the interval', () => {
        expect(lookAheadDue(fix(), fix({ lat: metersNorth(60), time: 10500 }))).toBe(false);
        expect(lookAheadDue(fix(), fix({ lat: metersNorth(60), time: 11600 }))).toBe(true);
    });
});
