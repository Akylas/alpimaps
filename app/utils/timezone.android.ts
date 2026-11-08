const MINUTE = 60000;

export function utcOffsetAt(tz: string, at: number): number | undefined {
    try {
        const zone = java.util.TimeZone.getTimeZone(tz);
        // an unknown name gives GMT, not an error
        if (zone.getID() !== tz && tz !== 'GMT') {
            return undefined;
        }
        return zone.getOffset(at) / MINUTE;
    } catch {
        return undefined;
    }
}
