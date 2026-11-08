const MINUTE = 60;

export function utcOffsetAt(tz: string, at: number): number | undefined {
    try {
        const zone = NSTimeZone.alloc().initWithName(tz);
        return zone ? zone.secondsFromGMTForDate(new Date(at)) / MINUTE : undefined;
    } catch {
        return undefined;
    }
}
