import type { MassifLayer } from '@nativescript-community/ui-massifmaps/api';
import { showError } from '@shared/utils/showError';
import { derived, get, writable } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { mapCapabilities } from '~/mapModules/CustomLayersModule';
import { createTileDecoder, getMapContext } from '~/mapModules/MapModule';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import { preloading } from '~/stores/mapStore';
import { colors } from '~/variables';

/** Whether the administrative-boundary overlay is on. */
const showAdmins = writable(false);

let adminLayer: MassifLayer<'massif::VectorTileLayer'>;

/**
 * The overlay reuses the base map's datasource with a different decoder, so it can only exist once a
 * map layer does — which is why it is created on first use rather than up front.
 *
 * `child('dataSource')` hands the base layer's source over rather than naming or rebuilding it, and
 * a spec takes that handle straight: the boundaries come out of the tiles already on screen.
 */
function createAdminLayer() {
    const mapContext = getMapContext();
    const baseLayer = mapContext.getLayers('map')[0]?.layer;
    const source = baseLayer?.child('dataSource' as never);
    if (!source) {
        return null;
    }
    // Built, not placed: LayerStack decides where 'admin' sits in the stack.
    const layer = mapContext.getMap().buildLayer('admin', {
        type: 'vector',
        source: source.handle as never,
        style: createTileDecoder('admin').handle as never,
        layerBlendingSpeed: 3,
        labelBlendingSpeed: 3,
        preloading: get(preloading),
        tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE',
        labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST'
    });
    // boundaries are context, not something to select: claim the click so nothing behind acts on it
    layer.onFeatureClick((e) => {
        e.consumed = true;
    });
    return layer;
}

function applyVisibility(visible: boolean) {
    const mapContext = getMapContext();
    try {
        if (visible) {
            if (!adminLayer) {
                adminLayer = createAdminLayer();
                if (!adminLayer) {
                    showAdmins.set(false);
                    return;
                }
                mapContext.addLayer(adminLayer, 'admin');
            } else {
                adminLayer.visible(true);
            }
        } else if (adminLayer) {
            adminLayer.visible(false);
        }
        if (adminLayer) {
            mapContext.mapDecoder?.call('setStyleParameter', 'hide_admins', adminLayer.visible() ? '1' : '0');
        }
    } catch (error) {
        showAdmins.set(false);
        showError(error);
    }
}

showAdmins.subscribe(applyVisibility);

registerMapFeature({
    id: 'admin',
    menuItems: derived([showAdmins, mapCapabilities, colors], ([$showAdmins, $capabilities, $colors]) =>
        // the boundaries live in the offline package, so there is nothing to show without it
        $capabilities.hasLocalData
            ? [
                  {
                      id: 'show_admin_regions',
                      title: lc('show_admin_regions'),
                      icon: 'mdi-vector-polygon',
                      menu: 'overflow' as const,
                      color: $showAdmins ? $colors.colorPrimary : undefined,
                      run: () => showAdmins.set(!get(showAdmins))
                  }
              ]
            : []
    )
});
