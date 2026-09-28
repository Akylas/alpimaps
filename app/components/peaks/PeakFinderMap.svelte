<script lang="ts">
    /**
     * Mounted in an `{#if}` (not hidden) so no second GL surface exists while off screen.
     * `useTextureView` false: AR needs a SurfaceView it can raise over the camera preview
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

    onDestroy(teardownPanorama);
</script>

<massifmap accessibilityLabel="peakFinderMap" useTextureView={false} on:mapReady={onMapReady} {...$$restProps} />
