import { derived, get } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { showLegend } from '~/stores/legendStore';

registerMapFeature({
    id: 'legend',
    menuItems: derived(showLegend, ($showLegend) => [
        {
            id: 'legend',
            title: lc($showLegend ? 'hide_legend' : 'show_legend'),
            icon: 'mdi-map-legend',
            order: 5,
            section: 'map' as const,
            run: () => showLegend.set(!get(showLegend))
        }
    ])
});
