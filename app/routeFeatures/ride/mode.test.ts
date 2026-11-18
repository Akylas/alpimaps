import { describe, expect, it } from 'vitest';
import { answerRecordChoice, migrateRecordMode, parseRecordMode, startPlan } from '~/routeFeatures/ride/mode';

describe('migrateRecordMode', () => {
    it('keeps what the boolean setting said', () => {
        expect(migrateRecordMode(true)).toBe('record');
        expect(migrateRecordMode(false)).toBe('off');
    });
    it('has nothing to say when the old setting was never stored', () => {
        expect(migrateRecordMode(undefined)).toBeUndefined();
    });
});

describe('parseRecordMode', () => {
    it('reads a stored mode', () => {
        expect(parseRecordMode('ask')).toBe('ask');
        expect(parseRecordMode('off')).toBe('off');
        expect(parseRecordMode('record')).toBe('record');
    });
    it('falls back on a value that is no mode', () => {
        expect(parseRecordMode('always', 'record')).toBe('record');
        expect(parseRecordMode(undefined, 'ask')).toBe('ask');
    });
});

describe('startPlan', () => {
    it('does not record, and does not ask, in off mode', () => {
        expect(startPlan('off', false)).toEqual({ record: false, prompt: false, toast: false });
    });
    it('records in record mode', () => {
        expect(startPlan('record', false)).toEqual({ record: true, prompt: false, toast: false });
    });
    it('asks in ask mode, recording nothing until answered', () => {
        expect(startPlan('ask', false)).toEqual({ record: false, prompt: true, toast: false });
    });
    it('a long press records whatever the mode, and says so where the mode would not have', () => {
        expect(startPlan('off', true)).toEqual({ record: true, prompt: false, toast: true });
        expect(startPlan('ask', true)).toEqual({ record: true, prompt: false, toast: true });
        expect(startPlan('record', true)).toEqual({ record: true, prompt: false, toast: false });
    });
});

describe('answerRecordChoice', () => {
    it('Record is for this ride only', () => {
        expect(answerRecordChoice('record')).toEqual({ record: true });
    });
    it('Always and Never record or not, and switch the setting', () => {
        expect(answerRecordChoice('always')).toEqual({ record: true, mode: 'record' });
        expect(answerRecordChoice('never')).toEqual({ record: false, mode: 'off' });
    });
});
