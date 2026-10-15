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
    import { installMacMouse } from '~/components/map/macMouse';
    import { PANORAMA_MAP_ID, setupPanorama, teardownPanorama } from '~/mapModules/features/peakFinder';

    let uninstallMacMouse: () => void;

    function onMapReady(event) {
        try {
            const view = event.object as MassifMapView;
            // its own registry id: two maps in one app must not share the "map" one
            setupPanorama(api.attach(view, { id: PANORAMA_MAP_ID }), view);
            if (__CATALYST__) {
                // the panorama is always first person
                uninstallMacMouse = installMacMouse(view, undefined, () => 'fps');
            }
        } catch (error) {
            showError(error);
        }
    }

    onDestroy(() => {
        uninstallMacMouse?.();
        teardownPanorama();
    });
</script>

<massifmap accessibilityLabel="peakFinderMap" useTextureView={false} on:mapReady={onMapReady} {...$$restProps} />
