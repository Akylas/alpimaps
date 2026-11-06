/** What the forecast says of a ride leaving at a time, for the When panel's strip. Pure: nothing here may import NativeScript. */
import type { DepartureAssessment } from '~/routeFeatures/registry';
import type { WeatherRead } from '~/routeFeatures/weather/data/read';

/** points for a millimeter of rain on the ride, and for the whole way against the wind */
const RAIN_POINTS_PER_MM = 3;
const HEADWIND_POINTS = 2;

/** mm of rain, share of the way against the wind and cloud cover from which a ride is marked rainy, windy and not sunny */
const RAINY_MM = 0.1;
const WINDY_SHARE = 0.25;
const SUNNY_CLOUD = 40;

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
    const { cloud, headShare, rainTotal } = read.summary;
    return {
        points: { rain: rainTotal * RAIN_POINTS_PER_MM, wind: headShare * HEADWIND_POINTS },
        indicators: [...(rainTotal >= RAINY_MM ? ['rain'] : []), ...(headShare >= WINDY_SHARE ? ['wind'] : []), ...(rainTotal < RAINY_MM && cloud !== undefined && cloud < SUNNY_CLOUD ? ['sun'] : [])],
        covered: true,
        rainMm: rainTotal
    };
}
