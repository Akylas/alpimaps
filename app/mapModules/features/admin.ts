import { TileSubstitutionPolicy } from '@nativescript-community/ui-carto/layers';
import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { TileLayer } from '@nativescript-community/ui-carto/layers';
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

let adminLayer: VectorTileLayer;

/**
 * The overlay reuses the base map's datasource with a different decoder, so it can only exist once a
 * map layer does — which is why it is created on first use rather than up front.
 */
function createAdminLayer() {
    const mapContext = getMapContext();
    const baseLayer = mapContext.getLayers('map')[0]?.layer;
    if (!(baseLayer instanceof TileLayer)) {
        return null;
    }
    const layer = new VectorTileLayer({
        layerBlendingSpeed: 3,
        labelBlendingSpeed: 3,
        preloading: get(preloading),
        tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
        labelRenderOrder: VectorTileRenderOrder.LAST,
        dataSource: baseLayer.dataSource,
        decoder: createTileDecoder('admin')
    });
    // boundaries are context, not something to select: swallow the click without handling it
    layer.setVectorTileEventListener<LatLonKeys>({ onVectorTileClicked: () => false }, mapContext.getProjection());
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
                adminLayer.visible = true;
            }
        } else if (adminLayer) {
            adminLayer.visible = false;
        }
        if (adminLayer) {
            mapContext.mapDecoder?.setStyleParameter('hide_admins', adminLayer.visible ? '1' : '0');
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
                      color: $showAdmins ? $colors.colorPrimary : undefined,
                      run: () => showAdmins.set(!get(showAdmins))
                  }
              ]
            : []
    )
});
