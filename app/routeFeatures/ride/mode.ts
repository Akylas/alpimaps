/** What a navigation does about recording the ride. Pure: nothing here may import NativeScript. */
export type RideRecordMode = 'off' | 'record' | 'ask';

export const RIDE_RECORD_MODES: RideRecordMode[] = ['off', 'record', 'ask'];

export function parseRecordMode(stored: string | undefined, fallback: RideRecordMode = 'record'): RideRecordMode {
    return RIDE_RECORD_MODES.find((mode) => mode === stored) ?? fallback;
}

/** The mode a stored on / off switch (the setting before there were modes) stands for, none when it was never stored. */
export function migrateRecordMode(legacy: boolean | undefined): RideRecordMode | undefined {
    return legacy === undefined ? undefined : legacy ? 'record' : 'off';
}

export interface StartPlan {
    /** record this ride, unless `prompt` says to ask first */
    record: boolean;
    /** ask whether to record before starting */
    prompt: boolean;
    /** say that the ride is recorded though the setting would not have */
    toast: boolean;
}

/** What starting a navigation does, from the mode and whether the start button was long pressed. */
export function startPlan(mode: RideRecordMode, longPress: boolean): StartPlan {
    if (longPress) {
        return { record: true, prompt: false, toast: mode !== 'record' };
    }
    return { record: mode === 'record', prompt: mode === 'ask', toast: false };
}

export type RecordChoice = 'record' | 'always' | 'never';

/** The answer of the prompt: whether to record this ride, and the mode to switch to when it says so. */
export function answerRecordChoice(choice: RecordChoice): { record: boolean; mode?: RideRecordMode } {
    switch (choice) {
        case 'always':
            return { record: true, mode: 'record' };
        case 'never':
            return { record: false, mode: 'off' };
        default:
            return { record: true };
    }
}
