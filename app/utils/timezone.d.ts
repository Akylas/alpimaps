/**
 * The offset of a zone at an instant, minutes east of UTC, from the platform's zone database: the runtime has no `Intl`. The zone's name is an
 * IANA one, as the timezone tiles say it.
 * @returns undefined when the platform does not know the zone; never throws.
 */
export function utcOffsetAt(tz: string, at: number): number | undefined;
