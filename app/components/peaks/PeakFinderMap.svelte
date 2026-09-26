<script lang="ts">
    /**
     * The peak finder's own map view.
     *
     * Mounted by `Map.svelte` while the mode is up and destroyed with it, so the panorama costs
     * nothing at all when it is not on screen — no second GL surface, no second terrain, no second
     * set of tiles. It is a `{#if}`, not a hidden view, for exactly that reason.
     *
     * The component owns the VIEW and nothing else: everything the panorama is made of is built by
     * `setupPanorama` in `mapModules/features/peakFinder.ts`, from the same data sources the live map
     * underneath is drawing.
     *
     * `useTextureView` false: the relief is full-screen and the mode is read by dragging it, so the
     * surface path is the cheap one — and AR needs a SurfaceView it can raise over the camera preview
     * (`MapView.setTranslucent` is `setZOrderMediaOverlay`).
     */
    import * as api from '@nativescript-community/ui-massifmaps/api';
    import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';
    import { onDestroy } from 'svelte';
    import { showError } from '@shared/utils/showError';
    import { PANORAMA_MAP_ID, setupPanorama, teardownPanorama } from '~/mapModules/features/peakFinder';

    function onMapReady(event) {
        try {
            const view = event.object as MassifMapView;
            // its own registry id: two maps in one app must not share the "map" one
            setupPanorama(api.attach(view, { id: PANORAMA_MAP_ID }), view);
        } catch (error) {
            showError(error);
        }
    }

    // Releases the map and every id it built. The sources it borrowed from the live map are handed
    // back here too — see `teardownPanorama`.
    onDestroy(teardownPanorama);
</script>

<massifmap accessibilityLabel="peakFinderMap" useTextureView={false} on:mapReady={onMapReady} {...$$restProps} />
