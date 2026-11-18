import { describe, expect, it } from 'vitest';
import type { Activity } from '~/utils/routeAnalysis/types';
import { UNKNOWN_LEVEL, levelLabel, levelName, mtbLevel, sacLevel, scaleForActivity } from './scale';

const activity = (kind: Activity['kind'], subtype?: Activity['subtype']): Activity => ({ kind, subtype, origin: 'route' });

describe('scaleForActivity', () => {
    it('reads a hike on the sac scale, walking or running', () => {
        expect(scaleForActivity(activity('hike', 'walk'))).toBe('sac');
        expect(scaleForActivity(activity('hike', 'run'))).toBe('sac');
        expect(scaleForActivity(activity('hike'))).toBe('sac');
    });

    it('reads any bike on the mtb scale: a road or gravel bike meets the same trails, and the roads it takes are not rated', () => {
        expect(scaleForActivity(activity('bike', 'mountain'))).toBe('mtb');
        expect(scaleForActivity(activity('bike', 'enduro'))).toBe('mtb');
        expect(scaleForActivity(activity('bike', 'road'))).toBe('mtb');
        expect(scaleForActivity(activity('bike', 'gravel'))).toBe('mtb');
        expect(scaleForActivity(activity('bike', 'normal'))).toBe('mtb');
        expect(scaleForActivity(activity('bike'))).toBe('mtb');
    });

    it('has no scale for a motor route or no activity', () => {
        expect(scaleForActivity(activity('motor'))).toBeUndefined();
        expect(scaleForActivity(undefined)).toBeUndefined();
    });
});

describe('sacLevel', () => {
    it('keeps T1 to T6', () => {
        expect([1, 2, 3, 4, 5, 6].map(sacLevel)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('takes an untagged edge (0) or a missing value for unknown, never for easy', () => {
        expect(sacLevel(0)).toBe(UNKNOWN_LEVEL);
        expect(sacLevel(undefined)).toBe(UNKNOWN_LEVEL);
    });

    it('takes a value off the scale for unknown', () => {
        expect(sacLevel(7)).toBe(UNKNOWN_LEVEL);
        expect(sacLevel(-3)).toBe(UNKNOWN_LEVEL);
    });
});

describe('mtbLevel', () => {
    it('keeps S0 to S6, as the tile string or a number', () => {
        expect(['0', '1', '2', '3', '4', '5', '6'].map(mtbLevel)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(mtbLevel(3)).toBe(3);
    });

    it('reads the number of an OSM value with a suffix', () => {
        expect(mtbLevel('2+')).toBe(2);
    });

    it('takes a missing, empty or unreadable value for unknown: S0 is a tagged, easy trail', () => {
        expect(mtbLevel(undefined)).toBe(UNKNOWN_LEVEL);
        expect(mtbLevel('')).toBe(UNKNOWN_LEVEL);
        expect(mtbLevel('hard')).toBe(UNKNOWN_LEVEL);
        expect(mtbLevel('9')).toBe(UNKNOWN_LEVEL);
    });
});

describe('levelLabel', () => {
    it('is T for the sac scale, S for the mtb one', () => {
        expect(levelLabel('sac', 4)).toBe('T4');
        expect(levelLabel('mtb', 0)).toBe('S0');
    });
});

describe('levelName', () => {
    it('puts the label before what the scale calls the level', () => {
        const translate = (key: string) => `<${key}>`;
        expect(levelName('sac', 3, translate)).toBe('T3 · <difficulty_sac_3>');
        expect(levelName('mtb', 0, translate)).toBe('S0 · <difficulty_mtb_0>');
    });

    it('is the word for a stretch that is not rated, whatever the scale', () => {
        expect(levelName('mtb', UNKNOWN_LEVEL, (key) => `<${key}>`)).toBe('<difficulty_unknown>');
    });
});
