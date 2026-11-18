// a navigation that recorded its track ends as a ride: saved as a route of its own, whose recording gives the times
import { showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import { showError } from '@shared/utils/showError';
import { getBoundsAndDistance } from '~/helpers/geolib';
import { lc } from '~/helpers/locale';
import { getMapContext } from '~/mapModules/MapModule';
import type { IItem, Item } from '~/models/Item';
import { rideTrack } from '~/routeFeatures/ride/track';
import { type FinishedRide, navigationFinishedRide } from '~/stores/navigationStore';
import { activityFromRoute } from '~/utils/routeAnalysis/activity';
import { withRecording } from '~/utils/routeAnalysis/storage';

/** Named after the route that was navigated, else just a ride; the day is the page's subtitle. */
function rideName(route?: IItem) {
    const name = route?.properties?.name;
    return name ? lc('ride_name', name) : lc('ride_default_name');
}

function rideFeature(track: NonNullable<ReturnType<typeof rideTrack>>, route?: IItem) {
    const geometry = { type: 'LineString' as const, coordinates: track.coordinates };
    const data = getBoundsAndDistance(track.coordinates);
    const navigated = route?.properties?.route;
    // a track that was navigated is what it was routed for; one that was not has no activity until the user says
    const activity = activityFromRoute(navigated);
    const type = (activity && navigated?.type) || 'pedestrian';
    return {
        type: 'Feature',
        analysis: withRecording(null, geometry, track.recorded),
        properties: {
            name: rideName(route),
            class: type,
            ...(activity ? {} : { imported: true }),
            zoomBounds: data.bounds,
            route: { type, ...(activity && navigated?.subtype ? { subtype: navigated.subtype } : {}) }
        },
        route: { totalDistance: data.distance },
        geometry
    } as IItem;
}

async function saveRide({ route, session }: FinishedRide) {
    const track = rideTrack(session.locs, Date.now());
    if (!track) {
        return;
    }
    const item = await getMapContext().mapModule('items').saveRecordedRide(rideFeature(track, route));
    const RideSavedSheet = (await import('~/routeFeatures/ride/RideSavedSheet.svelte')).default;
    await showBottomSheet({
        parent: getMapContext().getMainPage(),
        detents: [160],
        view: RideSavedSheet,
        props: { item, distance: track.distance, elapsed: track.recorded.t[track.recorded.t.length - 1] }
    });
}

navigationFinishedRide.subscribe((finished) => {
    if (finished) {
        navigationFinishedRide.set(null);
        saveRide(finished).catch(showError);
    }
});
