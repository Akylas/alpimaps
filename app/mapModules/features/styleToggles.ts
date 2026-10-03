import { derived, get } from 'svelte/store';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { type MapSideButton, registerMapFeature } from '~/mapModules/mapFeatures';
import { layerProps, nutiProps, styleHasParameter, styleParameterKeys } from '~/stores/mapStore';

// icon, title and long-press come from the property definitions in mapStore
const slopeProps = layerProps.getProps('showSlopePercentages');
const routesProps = nutiProps.getProps('show_routes');
const buildingsProps = nutiProps.getProps('buildings');

registerMapFeature({
    id: 'styleToggles',
    sideButtons: derived(
        [slopeProps.store, routesProps.store, buildingsProps.store, mapCapabilities, styleParameterKeys],
        ([$showSlopes, $showRoutes, $buildings, $capabilities, $styleParameterKeys]): MapSideButton[] => [
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
                visible: !!routesProps.visible($capabilities) && styleHasParameter($styleParameterKeys, 'show_routes'),
                onTap: () => routesProps.store.set(!get(routesProps.store)),
                onLongPress: routesProps.onLongPress
            },
            {
                id: 'buildings',
                order: 40,
                text: buildingsProps.icon,
                tooltip: buildingsProps.title,
                isSelected: !!$buildings,
                visible: styleHasParameter($styleParameterKeys, 'buildings'),
                onTap: () => buildingsProps.store.set(!get(buildingsProps.store))
            }
        ]
    )
});
