// recording a ride without navigating: the session of the geo handler, started and stopped while following the position
import { get } from 'svelte/store';
import { type GeoHandler, SessionChronoEvent, SessionState, SessionStateEvent, SessionUpdatedEvent, recordingState } from '~/handlers/GeoHandler';
import { getBGServiceInstance } from '~/services/BgService';
import { onServiceLoaded } from '~/services/BgService.common';
import { isNavigating, navigationFinishedRide, navigationStats } from '~/stores/navigationStore';

function geoHandler(): GeoHandler | undefined {
    return getBGServiceInstance()?.geoHandler;
}

/** Records the position from now on: the ride is saved when it stops. */
export async function startRecording() {
    const handler = geoHandler();
    // a session restored paused after the app was killed is nobody's: it would swallow the fixes
    handler?.discardRestoredSession();
    if (!handler || handler.isSessionRunning()) {
        return;
    }
    // in the foreground: android 14 refuses to start a location foreground service from the background
    handler.showForegroundNotification();
    await handler.startSession(undefined, { recordTrack: true });
}

/** Stops the recording, the position still followed, and hands what it recorded to be saved. */
export function stopRecording() {
    const handler = geoHandler();
    if (!handler?.isSessionRunning()) {
        return;
    }
    const session = handler.stopSession(true);
    if (session?.locs?.length) {
        navigationFinishedRide.set({ session });
    }
}

export async function pauseRecording() {
    const handler = geoHandler();
    if (!handler?.isSessionRunning() || handler.sessionState === SessionState.PAUSED) {
        return;
    }
    handler.pauseSession();
    // pausing stops the watch: the position keeps following, and moving again is noticed
    await handler.startWatch();
}

export function resumeRecording() {
    const handler = geoHandler();
    if (handler?.isSessionPaused()) {
        handler.resumeSession();
    }
}

// the recording bar reads the same stats the navigation dock does: while a ride is recorded without
// navigating, they are the session's. A navigation publishes its own.
let publishing = false;
function publishStats() {
    if (get(isNavigating)) {
        return;
    }
    const handler = geoHandler();
    const session = handler?.getCurrentSession();
    if (!session || get(recordingState) === null) {
        if (publishing) {
            publishing = false;
            navigationStats.set(null);
        }
        return;
    }
    publishing = true;
    navigationStats.set({
        duration: handler.getCurrentSessionChrono(),
        distance: session.distance,
        currentSpeed: session.currentSpeed,
        averageSpeed: session.averageSpeed,
        altitudeGain: session.altitudeGain,
        altitudeNegative: session.altitudeNegative
    });
}
onServiceLoaded((handler) => {
    handler.on(SessionUpdatedEvent, publishStats);
    handler.on(SessionChronoEvent, publishStats);
    handler.on(SessionStateEvent, publishStats);
});
