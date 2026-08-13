import { derived, get } from 'svelte/store';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { type MapSideButton, registerMapFeature } from '~/mapModules/mapFeatures';
import { layerProps, nutiProps } from '~/stores/mapStore';

/**
 * The two style toggles that sit in the side bar: slope shading and hiking/cycling routes.
 *
 * Both are ordinary style properties, so everything about them — icon, title, what long-press opens —
 * already lives with the property definition in mapStore. This only places them in the bar.
 */
const slopeProps = layerProps.getProps('showSlopePercentages');
const routesProps = nutiProps.getProps('show_routes');

registerMapFeature({
    id: 'styleToggles',
    // the props come off an untyped proxy, hence the explicit annotation and the boolean coercions
    sideButtons: derived([slopeProps.store, routesProps.store, mapCapabilities], ([$showSlopes, $showRoutes, $capabilities]): MapSideButton[] => [
        {
            id: 'slopes',
            order: 20,
            text: slopeProps.icon,
            tooltip: slopeProps.title,
            isSelected: !!$showSlopes,
            visible: !!slopeProps.visible($capabilities),
            onTap: () => slopeProps.store.set(!get(slopeProps.store)),
            onLongPress: slopeProps.onLongPress
        },
        {
            id: 'routes',
            order: 30,
            text: routesProps.icon,
            tooltip: routesProps.title,
            isSelected: !!$showRoutes,
            visible: !!routesProps.visible($capabilities),
            onTap: () => routesProps.store.set(!get(routesProps.store)),
            onLongPress: routesProps.onLongPress
        }
    ])
});
