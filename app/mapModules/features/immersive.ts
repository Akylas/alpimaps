import { Application } from '@nativescript/core';
import { derived } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { immersive } from '~/stores/mapStore';

/** Hides the system bars, leaving them reachable by swipe. */
function toggleSystemBars(show: boolean) {
    const activity = Application.android.startActivity;
    if (!activity) {
        return;
    }
    const window = activity.getWindow();
    const decorView = window.getDecorView();
    const WindowCompat = androidx.core.view.WindowCompat;
    const WindowInsetsControllerCompat = androidx.core.view.WindowInsetsControllerCompat;
    const WindowInsetsCompat = androidx.core.view.WindowInsetsCompat;

    // let content extend under the system windows either way, so the map does not resize as they go
    WindowCompat.setDecorFitsSystemWindows(window, false);

    const controller = new WindowInsetsControllerCompat(window, decorView);
    if (show) {
        controller.show(WindowInsetsCompat.Type.systemBars());
    } else {
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}

if (__ANDROID__) {
    immersive.subscribe((value) => toggleSystemBars(!value));
}

registerMapFeature({
    id: 'immersive',
    enabled: () => __ANDROID__,
    sideButtons: derived(immersive, ($immersive) => [
        {
            id: 'immersive',
            order: 10,
            text: 'mdi-fullscreen',
            tooltip: lc('immersive_mode'),
            isSelected: $immersive,
            onTap: () => immersive.set(!$immersive)
        }
    ])
});
