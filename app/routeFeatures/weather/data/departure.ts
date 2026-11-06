/** What the forecast says of a ride leaving at a time, for the When panel's strip. Pure: nothing here may import NativeScript. */
import type { DepartureAssessment } from '~/routeFeatures/registry';
import type { WeatherRead } from '~/routeFeatures/weather/data/read';
import { skyMark } from '~/routeFeatures/weather/ui/pageRows';

/** points for a millimeter of rain on the ride, and for the whole way against the wind */
const RAIN_POINTS_PER_MM = 3;
const HEADWIND_POINTS = 2;

/** share of the way against the wind from which a ride is marked windy: the sky says the rest */
const WINDY_SHARE = 0.25;

/**
 * The ride read for a departure as the forecast has it. Covered when the hours fetched include the whole ride: a ride they do not
 * reach scores nothing and is marked by nothing.
 */
export function weatherAssessment(read: Pick<WeatherRead, 'ride' | 'summary'> | null): DepartureAssessment | undefined {
    if (!read) {
        return undefined;
    }
    if (!read.ride.every((entry) => !!entry.reading)) {
        return { points: {}, indicators: [], covered: false };
    }
    const { headShare, rainTotal } = read.summary;
    return {
        points: { rain: rainTotal * RAIN_POINTS_PER_MM, wind: headShare * HEADWIND_POINTS },
        indicators: headShare >= WINDY_SHARE ? ['wind'] : [],
        covered: true,
        rainMm: rainTotal,
        sky: skyMark(read.summary)
    };
}

/** A forecast was fetched, and the ride read for this departure is not in the hours it holds: it has to be fetched again. Not before one was asked for. */
export function weatherNeedsFetch(read: Pick<WeatherRead, 'ride'> | null): boolean {
    return !!read && !read.ride.every((entry) => !!entry.reading);
}
