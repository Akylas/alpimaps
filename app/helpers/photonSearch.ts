import { PhotonFeature } from '~/components/search/Features';
import type { Photon } from '~/photon';
import { networkService } from '~/services/NetworkService';
import { type MapBounds, type MapPos, computeDistanceBetween } from '~/utils/geo';
import { arraySortOn } from '~/utils/utils';

const PHOTON_SUPPORTED_LANGUAGES = ['en', 'de', 'fr'];
// what Photon returns that nobody searches for: area outlines, land use, building parts, rail points and bus shelters.
// Station and stop results stay, they have their own tags (railway=station, highway=bus_stop…)
const PHOTON_EXCLUDED_TAGS = ['!boundary', '!landuse', '!building', '!railway:stop', '!railway:platform', '!highway:platform', '!information', '!amenity:shelter', '!amenity:bench'];

/** The places Photon finds, nearest first. `onlyTags`: ask for these alone instead of everything but the excluded ones. */
export async function photonSearch(options: { query: string; language?: string; location?: MapPos; locationRadius?: number; bounds?: MapBounds }, onlyTags?: string[]) {
    let actualLang = (options.language || 'en').split('-')[0];
    if (PHOTON_SUPPORTED_LANGUAGES.indexOf(actualLang) === -1) {
        actualLang = 'en';
    }
    const results = await networkService.request<Photon>({
        url: `https://photon.komoot.io/api?${(onlyTags ?? PHOTON_EXCLUDED_TAGS).map((tag) => 'osm_tag=' + encodeURIComponent(tag)).join('&')}`,
        tag: onlyTags ? 'photon-only' : 'photon',
        method: 'GET',
        queryParams: {
            q: options.query,
            lat: options.location && options.location.lat,
            lon: options.location && options.location.lon,
            lang: actualLang,
            limit: onlyTags ? 10 : 40
            // bbox: options.bounds ? regionToOSMString(options.bounds) : undefined
        }
    });
    return arraySortOn(
        results.features
            // relations are routes and outlines, except the main result for a city: Paris, Grenoble, Lyon are relations
            .filter((r) => r.properties.osm_type !== 'R' || r.properties.osm_key === 'place')
            .map((f) => {
                const r = new PhotonFeature(f);
                if (options.location) {
                    r['distance'] = computeDistanceBetween(options.location, {
                        lat: r.geometry.coordinates[1],
                        lon: r.geometry.coordinates[0]
                    });
                }
                return r;
            }),
        'distance'
    );
}
