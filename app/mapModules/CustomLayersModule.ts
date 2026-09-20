import * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifMap, MassifObject, MassifSource, SpecArg } from '@nativescript-community/ui-massifmaps/api';
import { openFilePicker, pickFolder } from '@nativescript-community/ui-document-picker';
import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
import { alert, confirm, login, prompt } from '@nativescript-community/ui-material-dialogs';
import { Application, ApplicationSettings, Color, profile } from '@nativescript/core';
import { ChangeType, ChangedData, ObservableArray } from '@nativescript/core/data/observable-array';
import { File, Folder, path } from '@nativescript/core/file-system';
import { get, writable } from 'svelte/store';
import type { Provider } from '~/data/tilesources';
import { l, lc } from '~/helpers/locale';
import { isEInk } from '~/helpers/theme';
import MapModule, { type MapDecoder, getMapContext } from '~/mapModules/MapModule';
import { getMapModule } from '~/mapModules/registry';
import { fromPosition } from '~/utils/geo';
import { packageService } from '~/services/PackageService';
import { clickHandlerLayerFilter, layerProps, nutiProps, preloading } from '~/stores/mapStore';
import { showError } from '@shared/utils/showError';
import { toDegrees, toRadians } from '~/utils/geo';
import { getDataFolder, getDefaultMBTilesDir, getFileNameThatICanUseInNativeCode, listFolder } from '~/utils/utils';

import { SDK_VERSION } from '@akylas/nativescript/utils';
import { createView, showSnack } from '~/utils/ui';
import { data as TileSourcesData } from '~/data/tilesources';
import { openLink } from '~/utils/ui';
import { Label } from '@nativescript-community/ui-label';
import { colors } from '~/variables';
import { SilentError } from '@akylas/nativescript-app-utils/error';
import { CLog } from '@nativescript-community/sentry';
const mapContext = getMapContext();

export enum RoutesType {
    All = 0,
    Bicycle = 1,
    Hiking = 2
}

/** One mbtiles file, as a source spec. Specs compose, so a merge or an order is just nesting. */
let localSourceId = 0;

/** Only a persistent cache can download an area, and only it declares the download events. */
export type DownloadableSource = MassifSource<'massif::PersistentCacheTileDataSource'>;

const mbTilesSourceSpec = (path: string, minZoom?: number) => ({ type: 'mbtiles' as const, path, ...(minZoom !== undefined ? { minZoom } : {}) });

export const SLOPE_STEPS = [30, 35, 40, 45];
export const SLOPE_COLORS = ['#f0e64e', '#e87639', '#ff0000', '#c18bb7'];

let SLOPE_HILLSHADE_SHADER;
function getSlopeHillshadeShader() {
    if (!SLOPE_HILLSHADE_SHADER) {
        SLOPE_HILLSHADE_SHADER = `uniform vec4 u_shadowColor;
        uniform vec3 u_lightDir;
        vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {
           mediump float slope = acos(dot(normal, surfaceNormal)) *180.0 / 3.14159 * 1.2;
           ${SLOPE_STEPS.slice()
               .reverse()
               .map((step, index) => {
                   const color = new Color(SLOPE_COLORS[SLOPE_STEPS.length - 1 - index]);
                   return `if (slope >= ${step.toFixed(1)}) {return vec4(${color.r / 255}, ${color.g / 255}, ${color.b / 255}, 1.0) * 0.5; }\n`;
               })
               .join('')}
           return vec4(0, 0, 0, 0.0);
        }`;
    }
    return SLOPE_HILLSHADE_SHADER;
}
// export const RELIEF_STEPS = [-850, 50, 150, 250, 450, 925, 1850, 2775, 3700, 8700];
// export const RELIEF_COLORS = ['#22e9df', '#97e697', '#83e183', '#6edc6e', '#59d759', '#45d245', '#F0FAA0', '#E6DCAA', '#DCDCDC', '#FAFAFA', 'white'];

// let RELIEF_HILLSHADE_SHADER;
// function getReliefeHillshadeShader() {
//     if (!RELIEF_HILLSHADE_SHADER) {
//         RELIEF_HILLSHADE_SHADER = `uniform vec4 u_shadowColor;
//         uniform vec3 u_lightDir;
//         vec4 applyLighting(lowp vec4 color, mediump vec3 normal, mediump vec3 surfaceNormal, mediump float intensity) {
//            ${RELIEF_STEPS.slice()
//                .reverse()
//                .map((step, index) => {
//                    const color = new Color(RELIEF_COLORS[RELIEF_STEPS.length - 1 - index]);
//                    return `if (normal.z >= ${step.toFixed(1)}) {return vec4(${color.r / 255}, ${color.g / 255}, ${color.b / 255}, 1.0) * 0.5; }\n`;
//                })
//                .join('')}
//            return vec4(0, 0, 0, 0.0);
//         }`;
//     }
//     return RELIEF_HILLSHADE_SHADER;
// }

function getProviderAttribution(pr) {
    return pr.attribution || (pr.urlOptions && pr.urlOptions.attribution);
}

function templateString(str: string, data) {
    return str.replace(
        /{(\w*)}/g, // or /{(\w*)}/g for "{this} instead of %this%"
        function (m, key) {
            return data.hasOwnProperty(key) ? data[key] : m;
        }
    );
}

/**
 * The style slots the terrain is woven into, and what each is drawn as.
 *
 * The names are LAYER NAMES in the style's `layers` array — `#hillshade` and `#contour` in
 * `dev_assets/styles/osm`. A name the style does not declare is registered and never drawn; the SDK
 * only warns. The numbers are `massif::CompositeSourceType`, which crosses the facade as an int
 * because it has no enum argument kind.
 */
const HILLSHADE_SLOT = 'hillshade';
const CONTOUR_SLOT = 'contour';
const COMPOSITE_SOURCE_TYPE_HILLSHADE = 1;
/**
 * How far past the DEM's own max zoom contours keep being traced.
 *
 * It has to be said: a ContourTileDataSource reports the DEM's zoom range as its own and leaves
 * `maxOverzoomLevel` unset, and the composite copies that onto the child layer - so the lines would
 * stop dead at the DEM's last zoom (16 online, lower for a local .etiles package) while the map
 * goes to 20 and beyond. The hillshade child needs no equivalent: a TileLayer already defaults to
 * six levels of parent search.
 */
const CONTOUR_MAX_OVERZOOM = 8;

/**
 * The knobs the hillshade's layer-options sheet offers.
 *
 * They are properties of the LAYER, not of the style: `#hillshade` declares the slot and nothing
 * else, precisely so a config symbolizer does not overwrite these on the next frame.
 */
const HILLSHADE_OPTIONS = {
    contrast: {
        min: 0,
        max: 1
    },
    heightScale: {
        min: 0,
        max: 2
    },
    zoomLevelBias: {
        min: 0,
        max: 5
    },
    highlightColor: {
        type: 'color'
    },
    accentColor: {
        type: 'color'
    },
    shadowColor: {
        type: 'color'
    },
    illuminationDirection: {
        min: 0,
        max: 359,
        transform: (value) => [Math.sin(toRadians(value)), Math.cos(toRadians(value)), 0],
        transformBack: (value) => toDegrees(((value.x || value[0]) > 0 ? 1 : -1) * Math.acos(value.y || value[1]))
    },
    minVisibleZoom: {
        min: 0,
        max: 24
    },
    maxVisibleZoom: {
        min: 0,
        max: 24
    }
};

/**
 * What the currently loaded offline data supports. Flips asynchronously while mbtiles are scanned, so
 * anything gating UI on it (the slopes and routes buttons, the contour/buildings options) must react
 * to the store rather than read a snapshot.
 */
export const mapCapabilities = writable({ hasLocalData: false, hasTerrain: false, hasRoute: false });

export interface SourceItem {
    downloading?: boolean;
    downloadProgress?: number;
    opacity: number;
    legend?: string;
    name: string;
    id?: string;
    local?: boolean;
    /** A DEM. Only the top-most one is woven into the base map's `#hillshade` slot. */
    terrain?: boolean;
    /**
     * A DEM's OWN hillshade layer, kept whether or not it is the woven one.
     *
     * `layer` is whatever is currently DRAWN for this item, so the layers menu and the options
     * sheet act on the right thing: this layer while the DEM is stacked, and the composite's own
     * child while it holds the slot. This one stays put either way, because it is also what
     * answers elevation queries.
     */
    terrainLayer?: MassifLayer<'massif::HillshadeRasterTileLayer'>;
    layer: MassifLayer;
    /** the persistent tile cache's sqlite file, when the source has one */
    databasePath?: string;
    /** the spec it was built from, so a style change can rebuild it with the new decoder */
    spec?: any;
    provider: Provider;
    index?: number;
    options?: {
        [k: string]: {
            min?: number;
            max?: number;
            value?: number;
            transform?: Function;
            transformBack?: Function;
            type?: string;
        };
    };
}
const TAG = 'CustomLayersModule';
export default class CustomLayersModule extends MapModule {
    public customSources: ObservableArray<SourceItem>;

    constructor() {
        super();

        this.customSources = new ObservableArray([]);
        this.customSources.addEventListener(ObservableArray.changeEvent, this.onCustomSourcesChanged, this);
    }
    onCustomSourcesChanged(event: ChangedData<SourceItem>) {
        if (!this.listenForSourceChanges) {
            return;
        }
        switch (event.action) {
            // case ChangeType.Delete: {
            //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
            //     return;
            // }
            // case ChangeType.Add: {
            //     if (event.addedCount > 0) {
            //         this._listViewAdapter.notifyItemRangeInserted(event.index, event.addedCount);
            //     }
            //     // Reload the items to avoid duplicate Load on Demand indicators:
            //     return;
            // }
            // case ChangeType.Update: {
            //     if (event.addedCount > 0) {
            //         this._listViewAdapter.notifyItemRangeChanged(event.index, event.addedCount);
            //     }
            //     // if (event.removed && event.removed.length > 0) {
            //     //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
            //     // }
            //     return;
            // }
            case ChangeType.Splice: {
                if (event.addedCount > 0) {
                    this.moveSource(this.customSources.getItem(event.index), event.index);
                    // this._listViewAdapter.notifyItemRangeInserted(event.index, event.addedCount);
                }
                // if (event.removed && event.removed.length > 0) {
                //     this._listViewAdapter.notifyItemRangeRemoved(event.index, event.removed.length);
                // }
                return;
            }
        }
    }
    /**
     * Several mbtiles as ONE source, merged pairwise.
     *
     * Specs all the way down: a source is JSON until it is built, so composing them is nesting
     * rather than constructing objects and holding handles. `merged-mbvt` merges two vector-tile
     * sources tile by tile, which is how a region and its routes become one map.
     */
    createMergeDataSource(sources: any[], minZoom?: number) {
        const specs = sources.map((s) => (typeof s === 'string' ? mbTilesSourceSpec(s, minZoom) : s));
        if (specs.length === 1) {
            return specs[0];
        }
        let result;
        for (let index = 0; index < specs.length; index += 2) {
            const merged = index < specs.length - 1 ? { type: 'merged-mbvt' as const, source: specs[index], source2: specs[index + 1] } : specs[index];
            result = result ? { type: 'merged-mbvt' as const, source: result, source2: merged } : merged;
        }
        return result;
    }

    /** The first source that has a tile wins, so a detailed region shadows the world map. */
    createOrderedTileDataSource(sources: any[], minZoom?: number) {
        const specs = sources.filter((s) => !!s).map((s) => (typeof s === 'string' ? mbTilesSourceSpec(s, minZoom) : s));
        if (specs.length === 0) {
            return null;
        }
        if (specs.length === 1) {
            return specs[0];
        }
        return specs.reduce((first, second) => ({ type: 'ordered' as const, source: first, source2: second }));
    }

    /**
     * A DEM's own hillshade layer.
     *
     * It is built for every DEM, whatever becomes of it. Only ONE can be woven into the style -
     * there is a single `#hillshade` slot - and that one's layer is kept OFF the map while the
     * composite draws its own child from the same source; every other DEM is stacked with this
     * layer, which is exactly how they all behaved before the slot existed.
     *
     * It is also the elevation oracle whether or not it is drawn: ElevationManager is reached
     * THROUGH a hillshade layer, and `getElevations` builds one from the layer's data source and
     * decoder alone, so a layer on no map still answers for elevation profiles, the peak finder,
     * the 3D map and the tile server. The elevation decoder is not named here: it comes from the
     * source's own `metaData.dem_encoding`, which is what the terrarium/mapbox choice sets.
     */
    createHillshadeLayer(id: string, name: string, sourceSpec: any) {
        const layer = mapContext.getMap().buildLayer(id, { type: 'hillshade', source: sourceSpec });
        this.applyHillshadeSettings(layer, name);
        return layer;
    }
    /**
     * Slope colouring, on the composite's own hillshade child.
     *
     * Read from the STORE, not from `layerProps['showSlopePercentages']`: the proxy answers null for
     * a value sitting at its default, and this one defaults to `true` - so starting this at false
     * left the button drawn as selected with no shader on the layer, and the first press turned
     * "off" what was already off. The store carries the persisted value, or the default.
     *
     * Held rather than read on every call so the mode survives a re-attach, where the composite
     * builds a brand new child.
     */
    private slopeMode = !!get(layerProps.getStore('showSlopePercentages'));
    toggleHillshadeSlope(value: boolean) {
        this.slopeMode = value;
        this.applySlopeMode(this.terrainAttachedTo);
    }
    /**
     * Puts the slope shader on the layer a composite draws its hillshade slot with.
     *
     * Takes the composite rather than reading the attached one, because a second map showing the
     * same base layer is its own composite with its own child, and it wants the same mode.
     *
     * An EMPTY shader is how the built-in one comes back - the renderer substitutes its default for
     * it - which is why turning slopes off does not hand back a shader of ours.
     *
     * The normal map has to be built at TRUE scale for this, which is what `heightScale` 1 and the
     * exaggeration off mean: the shader reads the slope ANGLE straight off the normal
     * (`acos(dot(normal, surfaceNormal))`) and compares it against degrees. The SDK builds the map
     * as `decoderScale * heightScale * pixelsPerMetre`, so the hillshade's artistic `heightScale`
     * - 0.2 here - damps every slope to a fifth of itself, and a real 40 deg read as ~11 deg:
     * under the lowest step, so the shader painted nothing anywhere. The legacy pre-MapLibre
     * formula carried a x160 that hid this; the true-slope one is the default now.
     */
    private applySlopeMode(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        this.withExternalChild(composite, HILLSHADE_SLOT, (result) => {
            const child = api.wrap(result.handle, 'massif::HillshadeRasterTileLayer');
            // Back to what the sheet persisted when slopes go off - `applyHillshadeSettings` reads
            // the same key, and this is the only other thing that writes it.
            const heightScale = this.slopeMode ? 1 : ApplicationSettings.getNumber(`${this.slotItem?.name}_heightScale`, 0.2);
            // Guarded because BOTH of these rebuild every normal map the layer holds
            // (`updateTiles`), and this runs on every attach. The shader itself only redraws, so it
            // rides along rather than being worth a check of its own.
            if (child.get('exagerateHeightScaleEnabled') !== !this.slopeMode || child.get('heightScale') !== heightScale) {
                child.apply({
                    exagerateHeightScaleEnabled: !this.slopeMode,
                    heightScale,
                    normalMapLightingShader: this.slopeMode ? getSlopeHillshadeShader() : ''
                });
            }
        });
    }
    /**
     * Shows or hides one slot WITHOUT touching the composite's source list.
     *
     * Adding or removing an external source rebuilds the composite's draw items and reloads the
     * whole base map, which is far too much for a visibility toggle. An invisible child costs
     * nothing either: TileLayer::loadData returns before it fetches anything, so hidden contours
     * are never traced.
     */
    private setSlotVisible(slot: string, visible: boolean) {
        this.withExternalChild(this.terrainAttachedTo, slot, (child) => child.set('visible', visible));
    }

    /**
     * The hillshade child, as the terrain source item's layer.
     *
     * The child is what is actually DRAWN, so it is what the layers menu's opacity slider and the
     * options sheet have to write to - the detached elevation layer answers elevation queries and
     * is on no map, so a slider moving it would move nothing on screen. The child belongs to the
     * composite and is built afresh on every attach, so the item's layer is re-pointed here and the
     * persisted settings are put back on it.
     */
    private hillshadeChildResult: MassifObject<'massif::Layer'>;
    private setHillshadeChild(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        // the previous child is gone with the composite that owned it
        this.hillshadeChildResult?.destroy();
        this.hillshadeChildResult = null;
        const item = this.slotItem;
        if (!composite?.valid || !item) {
            return;
        }
        try {
            this.hillshadeChildResult = composite.call('getExternalChildLayer', HILLSHADE_SLOT);
        } catch (error) {
            DEV_LOG && console.log('setHillshadeChild', error);
            return;
        }
        // A LAYER over the same handle, not the call result: `opacity()` and `visible()` are
        // MassifLayer's, and the layers menu calls them on every item. The result object stays
        // alive alongside it - destroying it would unregister the handle underneath.
        const child = api.wrapLayer(this.hillshadeChildResult.handle, 'massif::HillshadeRasterTileLayer');
        this.applyHillshadeSettings(child, item.name);
        item.layer = child;
        item.options = HILLSHADE_OPTIONS;
        const index = this.customSources.indexOf(item);
        if (index !== -1) {
            this.customSources.setItem(index, item);
        }
    }

    /**
     * Puts the settings the sheet persisted back on a freshly built hillshade child.
     *
     * Same keys the sheet writes - `${item.name}_<option>` - so the two stay in step; this is only
     * the other half of them, for a layer the SDK built rather than the app.
     */
    private applyHillshadeSettings(layer: MassifLayer<'massif::HillshadeRasterTileLayer'>, name: string) {
        const illuminationDirection = ApplicationSettings.getNumber(`${name}_illuminationDirection`, 143);
        const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
        const tileFilterModeStr = ApplicationSettings.getString(`${name}_tileFilterMode`, 'bilinear');
        const accentColor = new Color(ApplicationSettings.getString(`${name}_accentColor`, '#000000'));
        const shadowColor = new Color(ApplicationSettings.getString(`${name}_shadowColor`, '#000000'));
        const highlightColor = new Color(ApplicationSettings.getString(`${name}_highlightColor`, '#000000'));
        layer.apply({
            tileFilterMode:
                tileFilterModeStr === 'bicubic' ? 'RASTER_TILE_FILTER_MODE_BICUBIC' : tileFilterModeStr === 'nearest' ? 'RASTER_TILE_FILTER_MODE_NEAREST' : 'RASTER_TILE_FILTER_MODE_BILINEAR',
            visibleZoomRange: [ApplicationSettings.getNumber(`${name}_minVisibleZoom`, 0), ApplicationSettings.getNumber(`${name}_maxVisibleZoom`, 24)],
            contrast: ApplicationSettings.getNumber(`${name}_contrast`, 0.5),
            heightScale: ApplicationSettings.getNumber(`${name}_heightScale`, 0.2),
            tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_ALL',
            illuminationDirection: [Math.sin(toRadians(illuminationDirection)), Math.cos(toRadians(illuminationDirection)), 0],
            highlightColor: highlightColor.argb,
            hillshadeMethod: 'IGOR',
            shadowColor: shadowColor.argb,
            accentColor: accentColor.argb,
            opacity,
            visible: opacity !== 0
        });
    }
    /**
     * Runs `work` against the child layer a slot is drawn by, if there is one.
     *
     * A call RESULT is owned by the caller, so the handle is released again rather than
     * accumulating one registry entry per toggle.
     */
    private withExternalChild(composite: MassifObject<'massif::CompositeVectorTileLayer'>, slot: string, work: (child: MassifObject<'massif::Layer'>) => void) {
        if (!composite?.valid) {
            return;
        }
        let result: MassifObject<'massif::Layer'>;
        try {
            result = composite.call('getExternalChildLayer', slot);
        } catch (error) {
            // nothing in that slot - not an error, there may be no terrain loaded
            DEV_LOG && console.log('withExternalChild', slot, error);
            return;
        }
        try {
            work(result);
        } finally {
            result.destroy();
        }
    }
    mDevMode = ApplicationSettings.getBoolean('devMode', false);

    getTokenKeys() {
        return {
            americanaosm: ApplicationSettings.getString('americanaosmToken', this.devMode ? AMERICANA_OSM_URL : undefined),
            here_appid: ApplicationSettings.getString('here_appidToken', this.devMode ? HER_APP_ID : undefined),
            here_appcode: ApplicationSettings.getString('here_appcodeToken', this.devMode ? HER_APP_CODE : undefined),
            mapbox: ApplicationSettings.getString('mapboxToken', this.devMode ? MAPBOX_TOKEN : undefined),
            mapquest: ApplicationSettings.getString('mapquestToken', this.devMode ? MAPQUEST_TOKEN : undefined),
            maptiler: ApplicationSettings.getString('maptilerToken', this.devMode ? MAPTILER_TOKEN : undefined),
            google: ApplicationSettings.getString('googleToken', this.devMode ? GOOGLE_TOKEN : undefined),
            thunderforest: ApplicationSettings.getString('thunderforestToken', this.devMode ? THUNDERFOREST_TOKEN : undefined),
            ign: ApplicationSettings.getString('ignToken', this.devMode ? IGN_TOKEN : undefined)
        };
    }
    set devMode(value: boolean) {
        this.mDevMode = value;
        ApplicationSettings.setBoolean('devMode', value);
        this.tokenKeys = this.getTokenKeys();
    }
    get devMode() {
        return this.mDevMode;
    }
    tokenKeys = this.getTokenKeys();
    saveToken(key, value) {
        ApplicationSettings.setString(key + 'Token', value);
        this.tokenKeys[key] = value;
    }

    getTestImageAndHeaders(provider: Provider) {
        let url = provider.url;
        if (provider.tokenKey) {
            const tokens = Array.isArray(provider.tokenKey) ? provider.tokenKey : [provider.tokenKey];
            const needsToSet = tokens.map((s) => this.tokenKeys[s]).some((s) => s === undefined);
            if (needsToSet) {
                return null;
            }
            tokens.forEach((tok) => {
                let toReplace = this.tokenKeys[tok];
                if (tok === 'americanaosm' && toReplace.indexOf('{x}') === -1) {
                    toReplace = toReplace + '/planet/{z}/{x}/{y}.mvt';
                }
                url = url.replace(`{${tok}}`, toReplace);
            });
        }
        return { url: templateString(url, { s: 'a', x: '528', y: '367', z: '10', ...provider.urlOptions }), headers: provider.sourceOptions?.httpHeaders };
    }

    async createDataSource(id: string, provider: Provider) {
        const rasterCachePath = Folder.fromPath(path.join(getDataFolder(), 'rastercache'));
        const idForPath = id.replaceAll(/[\\\?\*<":>\+\[\]\s\t\n\.]+/g, '_');
        const databasePath = File.fromPath(path.join(rasterCachePath.path, idForPath)).path;
        let url = provider.url;
        if (provider.tokenKey) {
            const tokens = Array.isArray(provider.tokenKey) ? provider.tokenKey : [provider.tokenKey];
            const needsToSet = tokens.map((s) => this.tokenKeys[s]).some((s) => s === undefined);
            if (needsToSet) {
                if (tokens.length === 2) {
                    const result = await login({
                        title: lc('api_key'),
                        message: lc('api_key_needed', tokens.join(',')),
                        autoFocus: true,
                        userNameHint: tokens[0],
                        passwordHint: tokens[1]
                    });
                    if (result?.result) {
                        this.saveToken(tokens[0], result.userName);
                        this.saveToken(tokens[1], result.password);
                    }
                } else {
                    const result = await prompt({
                        title: lc('api_key'),
                        message: lc('api_key_needed', tokens[0]),
                        autoFocus: true,
                        hintText: tokens[0]
                    });
                    if (result?.result) {
                        this.saveToken(tokens[0], result.text);
                    }
                }
            }
            for (let index = 0; index < tokens.length; index++) {
                const tok = tokens[index];
                if (!this.tokenKeys[tok]) {
                    showSnack({ message: lc('missing_api_token') });
                    return;
                }
                let toReplace = this.tokenKeys[tok];
                if (tok === 'americanaosm' && toReplace.indexOf('{x}') === -1) {
                    toReplace = toReplace + '/planet/{z}/{x}/{y}.mvt';
                }
                // if (Array.isArray(url)) {
                //     url = url.map((u) => u.replace(`{${tok}}`, toReplace));
                // } else {
                url = url.replace(`{${tok}}`, toReplace);
                // }
            }
        }
        const vectorDataSource = url.indexOf('.mvt') >= 0 || url.indexOf('.pbf') >= 0;
        // `httpHeaders` is spelled HTTPHeaders on the SDK's own property, which is what a spec key
        // has to be: the facade resolves against the declared name, not the plugin's old option.
        const { encoding, httpHeaders, subdomains, ...sourceOptions } = (provider.sourceOptions ?? {}) as any;
        const httpSpec = {
            type: 'http' as const,
            url,
            ...sourceOptions,
            ...(httpHeaders ? { HTTPHeaders: httpHeaders } : {}),
            // the tables spell a subdomain set as 'abcd'; the SDK's property is a list
            ...(subdomains ? { subdomains: typeof subdomains === 'string' ? subdomains.split('') : subdomains } : {}),
            // A DEM's encoding is META DATA, not a property: `ElevationDecoder::Resolve` reads
            // `dem_encoding` off the tile, then off its data source. There is no `encoding` property
            // on a TileDataSource, so the key this used to pass was dropped with a warning and every
            // terrarium source was decoded as mapbox - which is what made mapterhorn's relief wrong.
            ...(encoding ? { metaData: { dem_encoding: encoding } } : {})
        };
        const downloadable = provider.downloadable || !PRODUCTION || this.devMode;
        const cacheable = provider.cacheable || !PRODUCTION;
        const cacheSize = ApplicationSettings.getNumber(`${id}_cacheSize`, 300);
        const cached = cacheable !== false || downloadable;
        return {
            sourceSpec: cached
                ? {
                      type: 'persistent-cache' as const,
                      source: httpSpec,
                      databasePath,
                      cacheOnlyMode: ApplicationSettings.getBoolean(`${id}_cacheOnlyMode`, false),
                      capacity: cacheSize * 1024 * 1024
                      // No `dem_encoding` here: `CacheTileDataSource::getMetaDataPtr` answers with
                      // the wrapped source's map when it has none of its own, so the http source
                      // above is the one place it has to be said - and the only place that also
                      // covers a provider served without a cache.
                  }
                : httpSpec,
            // Handed back rather than read off the source later: `databasePath` is a CONSTRUCTOR
            // argument of PersistentCacheTileDataSource and not one of its properties, so there is
            // no path that reads it back - the sheet showing the cache size has to be told.
            databasePath: cached ? databasePath : undefined,
            vectorDataSource
        };
    }
    async createDataSourceAndMapLayer(id: string, provider: Provider) {
        const opacity = ApplicationSettings.getNumber(`${id}_opacity`, 1);

        // Apply zoom level bias to the raster layer.
        // By default, bitmaps are upsampled on high-DPI screens.
        // We will correct this by applying appropriate bias
        const zoomLevelBias = ApplicationSettings.getNumber(`${id}_zoomLevelBias`, (Math.log(mapContext.getMap().get('DPI') / 160.0) / Math.log(2)) * 0.75);
        const options = {
            zoomLevelBias: {
                min: 0,
                max: 5
            }
        };

        const { databasePath, sourceSpec, vectorDataSource } = await this.createDataSource(id, provider);
        const map = mapContext.getMap();
        const layerId = `layer.custom.${id}`;

        let layer: MassifLayer;
        let terrainLayer: MassifLayer<'massif::HillshadeRasterTileLayer'>;
        let spec: any;
        let terrain = false;
        if (provider.hillshade) {
            // Built like any other hillshade. Whether it is stacked or woven into the base map's
            // `#hillshade` slot is decided by updateTerrain, from where it sits in the list.
            terrain = true;
            terrainLayer = this.createHillshadeLayer(layerId, id, sourceSpec);
            layer = terrainLayer;
        } else if (vectorDataSource) {
            // Kept, not inlined: `vectorTileDecoderChanged` rebuilds the layer from this on a style
            // change, and an item without it is silently skipped - which is what made switching
            // style do nothing for every provider-backed base map.
            spec = {
                type: 'composite-vector',
                source: sourceSpec,
                style: mapContext.mapDecoder.id,
                zoomLevelBias: ApplicationSettings.getNumber(`${id}_zoomLevelBias`, 0),
                labelRenderOrder: 1, // VECTOR_TILE_RENDER_ORDER_LAST
                visible: opacity !== 0,
                layerBlendingSpeed: isEInk ? 0 : 3,
                labelBlendingSpeed: isEInk ? 0 : 3,
                opacity,
                clickRadius: layerProps['clickRadius'],
                preloading: get(preloading),
                clickHandlerLayerFilter: get(clickHandlerLayerFilter),
                ...provider.layerOptions
            };
            layer = map.buildLayer(layerId, spec);
            layer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e));
            });
        } else {
            spec = {
                type: 'raster',
                source: sourceSpec,
                preloading: get(preloading),
                tileBlendingSpeed: isEInk ? 0 : 3,
                zoomLevelBias,
                opacity,
                visible: opacity !== 0,
                ...provider.layerOptions
            };
            layer = map.buildLayer(layerId, spec);
        }

        // console.log('createRasterLayer', id, opacity, provider.url, provider.sourceOptions, dataSource, dataSource.maxZoom, dataSource.minZoom);
        return {
            name: id,
            id,
            legend: provider.legend,
            opacity,
            options: terrain ? HILLSHADE_OPTIONS : options,
            layer,
            terrainLayer,
            databasePath,
            spec,
            provider,
            terrain
        };
    }

    sourcesLoaded = false;
    listenForSourceChanges = false;
    baseProviders: { [k: string]: Provider } = {};
    overlayProviders: { [k: string]: Provider } = {};
    isOverlay(providerName, provider: Provider) {
        if (!!provider.isOverlay || (provider.layerOptions && provider.layerOptions.opacity && provider.layerOptions.opacity < 1)) {
            return true;
        }
        return false;
    }
    addProvider(arg, providers: { [k: string]: Provider }) {
        const parts = arg.split('.');
        const id = arg.toLowerCase();

        const providerName = parts[0];
        const variantName = parts[1];
        let name = providerName;
        if (variantName) {
            name += ' ' + variantName;
        }

        const data = providers[providerName];
        if (!data) {
            throw new Error('No such provider (' + providerName + ')');
        }
        const provider: Provider = {
            name,
            id,
            category: data.category,
            url: data.url,
            sourceOptions: {
                minZoom: 0,
                maxZoom: 22,
                ...data.sourceOptions
            },
            attribution: data.attribution,
            tokenKey: data.tokenKey,
            urlOptions: data.urlOptions,
            layerOptions: data.layerOptions,
            downloadable: data.downloadable,
            devHidden: data.devHidden,
            cacheable: data.cacheable
        };

        if (data.legend) {
            provider.legend = templateString(data.legend, provider.urlOptions);
        }
        // if (data.cacheable !== undefined) {
        // provider.cacheable = data.cacheable || !PRODUCTION;
        // } else {
        //     provider.cacheable = !PRODUCTION;
        // }
        if (data.hillshade === true) {
            provider.hillshade = true;
            provider.terrarium = data.terrarium;
        }
        // if (data.downloadable !== undefined) {
        //     provider.downloadable = data.downloadable || !PRODUCTION || this.devMode;
        // } else {
        //     provider.downloadable = !PRODUCTION;
        // }
        // if (data.devHidden !== undefined) {
        //     provider.devHidden = data.devHidden;
        // }

        // overwrite values in provider from variant.
        if (variantName && 'variants' in data) {
            const variant = data.variants[variantName];
            if (!variant) {
                throw new Error('No such variant of ' + providerName + ' (' + variantName + ')');
            }
            if (typeof variant === 'string') {
                provider.urlOptions = {
                    variant,
                    ...provider.urlOptions
                };
            } else {
                provider.url = variant.url || provider.url;
                provider.attribution = variant.attribution || provider.attribution;
                provider.sourceOptions = { ...provider.sourceOptions, ...variant.sourceOptions };
                provider.layerOptions = { ...provider.layerOptions, ...variant.layerOptions };
                provider.urlOptions = { variant: variantName, ...provider.urlOptions, ...variant.urlOptions };
            }
            // } else if (typeof provider.url === 'function') {
            // provider.url = provider.url(parts.splice(1, parts.length - 1).join('.'));
        }
        if (!provider.url) {
            return;
        }
        // const forceHTTP = provider.options.forceHTTP;
        // if ((provider.url as string).indexOf('//') === 0) {
        //     provider.url = (forceHTTP ? 'http:' : 'https:') + provider.url;
        //     // provider.url = forceHTTP ? 'http:' : 'https:' + provider.url;
        // }
        if (provider.urlOptions) {
            provider.url = templateString(provider.url, provider.urlOptions);
            if (provider.url.indexOf('{variant}') >= 0) {
                return;
            }
        } else if (provider.url.indexOf('{variant}') >= 0) {
            return;
        }
        // replace attribution placeholders with their values from toplevel provider attribution,
        // recursively
        const attributionReplacer = function (attr) {
            if (!attr || attr.indexOf('{attribution.') === -1) {
                return attr;
            }
            return attr.replace(/\{attribution.(\w*)\}/, function (match, attributionName) {
                return attributionReplacer(getProviderAttribution(providers[attributionName]));
            });
        };
        provider.attribution = attributionReplacer(getProviderAttribution(provider));
        // Compute final options combining provider options with any user overrides
        if (this.isOverlay(arg, provider)) {
            this.overlayProviders[id] = provider;
        } else {
            this.baseProviders[id] = provider;
        }
    }
    async getSourcesLibrary() {
        if (this.sourcesLoaded) {
            return;
        }
        // const module = import('~/data/tilesources');
        // })
        // const providers = module.data;
        for (const provider in TileSourcesData) {
            this.addProvider(provider, TileSourcesData);
            if (TileSourcesData[provider].variants) {
                for (const variant in TileSourcesData[provider].variants) {
                    this.addProvider(provider + '.' + variant, TileSourcesData);
                }
            }
        }
        this.sourcesLoaded = true;
    }

    /** The SOURCE SPEC of a provider, for anything that wants to compose with it. */
    async createDataSourceFromId(s: string) {
        await this.getSourcesLibrary();
        const provider = this.baseProviders[s] || this.overlayProviders[s];
        if (provider) {
            const { sourceSpec } = await this.createDataSource(s, provider);
            return sourceSpec;
        }
    }

    get defaultOnlineSources() {
        // if (this.tokenKeys.americanaosm) {
        //     return 'americanaosm';
        // } else {
        return ['openfreemap', 'mapterhorn'];
        // }
    }
    // get americanaOSMHTML() {
    //     return lc(
    //         'americanaosm_presentation_detailed',
    //         ...['<a href="https://tile.ourmap.us">AmericanaOSM</a>', `<a href="https://github.com/Akylas/alpimaps/?tab=readme-ov-file#default-vector-americanosm-map">${lc('tutorial')}</a>`]
    //     );
    // }

    onMapReady(map: MassifMap) {
        super.onMapReady(map);
        // `param::contours` already stops the lines DRAWING, but the child keeps tracing its tiles
        // whether or not anything is drawn from them, so it is hidden too. Hiding, not detaching:
        // detaching rebuilds the composite and reloads the whole base map for a visibility change.
        // (The hillshade needs no equivalent - it is an ordinary layer, hidden by its own opacity.)
        nutiProps.on('change', (event: { key: string; value: boolean }) => {
            if (event.key === 'contours') {
                this.setSlotVisible(CONTOUR_SLOT, !!event.value);
            }
        });
        (async () => {
            try {
                if (!this.listenForSourceChanges) {
                    if (!__DISABLE_OFFLINE__ && (!__ANDROID__ || !PLAY_STORE_BUILD || SDK_VERSION < 11)) {
                        const folderPath = await getDefaultMBTilesDir();
                        if (folderPath && Folder.exists(folderPath)) {
                            await this.loadLocalMbtiles(folderPath);
                        }
                        if (this.customSources.length === 0) {
                            const showFirstPresentation = ApplicationSettings.getBoolean('showFirstPresentation', true);
                            if (showFirstPresentation) {
                                const result = await confirm({
                                    title: lc('app.name'),
                                    message: lc('app_generate_date_presentation'),
                                    okButtonText: lc('open_github'),
                                    cancelButtonText: lc('cancel')
                                });
                                if (result) {
                                    openLink(GIT_URL);
                                }
                                ApplicationSettings.setBoolean('showFirstPresentation', false);
                            }
                        }
                    }

                    const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
                    const showOpenFreeMapPresentation = ApplicationSettings.getBoolean('showOpenFreeMapPresentation', true);
                    if (showOpenFreeMapPresentation) {
                        if ((savedSources.indexOf('openstreetmap') !== -1 || savedSources.indexOf('americanaosm') !== -1) && savedSources.indexOf('openfreemap') !== -1) {
                            ApplicationSettings.setBoolean('showOpenFreeMapPresentation', false);
                            await alert({
                                title: lc('app.name'),
                                message: lc('openfreemap_presentation'),
                                okButtonText: lc('ok')
                            });
                        }
                        // const currentIndex = savedSources.indexOf('openfreemap');
                        // DEV_LOG && console.log('savedSources', currentIndex, savedSources);
                        // if (currentIndex !== -1) {
                        //     savedSources.splice(currentIndex, 1);
                        //     ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
                        // }
                        // const { colorOnSurfaceVariant } = get(colors);
                        // const promptResult = await prompt({
                        //     title: lc('app.name'),
                        //     // message: lc('americanaosm_presentation'),
                        //     okButtonText: lc('save'),
                        //     cancelButtonText: lc('cancel'),
                        //     defaultText: this.tokenKeys['americanaosm'],
                        //     textFieldProperties: {
                        //         variant: 'outline',
                        //         hint: lc('americanaosm_url'),
                        //         margin: 10,
                        //         width: { unit: '%', value: 100 }
                        //     },
                        //     view: createView(
                        //         Label,
                        //         {
                        //             padding: '10 20 0 20',
                        //             textWrap: true,
                        //             color: colorOnSurfaceVariant as any,
                        //             html: this.americanaOSMHTML
                        //         },
                        //         {
                        //             linkTap: (e) => openLink(e.link)
                        //         }
                        //     )
                        // });
                        // if (promptResult.result && promptResult?.text.length > 0) {
                        //     this.saveToken('americanaosm', promptResult.text);
                        // }
                    }
                    if (this.customSources.length === 0 && savedSources.length === 0) {
                        const sources = this.defaultOnlineSources;
                        savedSources.push(...sources);
                        ApplicationSettings.setString('added_providers', JSON.stringify(sources));
                    }
                    if (savedSources.length > 0) {
                        await this.getSourcesLibrary();
                        for (let index = 0; index < savedSources.length; index++) {
                            const s = savedSources[index];
                            let provider;
                            if (typeof s === 'string') {
                                provider = this.baseProviders[s] || this.overlayProviders[s];
                            } else {
                                provider = s;
                            }
                            try {
                                if (provider) {
                                    const data = await this.createDataSourceAndMapLayer(provider.id || provider.name, provider);
                                    this.customSources.push(data);
                                    if (!data.terrain) {
                                        mapContext.addLayer(data.layer, 'customLayers');
                                    }
                                    this.updateAttribution(data);
                                }
                            } catch (err) {
                                console.error('createRasterLayer', err);
                            }
                        }
                    }
                    this.listenForSourceChanges = true;
                }
                // Last, once every base map and every DEM this session has is in: the slots go on
                // the top-most composite, and which one that is is only known now.
                this.updateTerrain();

                this.notify({ eventName: 'ready' });
            } catch (err) {
                showError(err);
            }
        })();
    }
    updateClickHandlerLayerFilter() {
        this.updateVectorTileLayerProperty('clickHandlerLayerFilter', get(clickHandlerLayerFilter));
    }
    /**
     * Writes one property on every vector tile layer.
     *
     * `trySet` rather than `set`: the stack holds raster and hillshade layers too, and a property
     * they do not have is not an error here - it is simply not theirs.
     */
    updateVectorTileLayerProperty(key: string, value) {
        mapContext.getLayers().forEach((data) => data.layer?.trySet(key, value));
    }
    /**
     * The decoder was rebuilt, so every layer holding the old one has to be rebuilt too.
     *
     * `tileDecoder` is read-only on the SDK's layer - a decoder is what a layer's tiles were
     * DECODED with, not a setting - so the layer is created again from the spec it was built from,
     * with the new decoder's id.
     */
    vectorTileDecoderChanged(oldDecoder: MapDecoder, newDecoder: MapDecoder) {
        const generation = ++this.decoderGeneration;
        this.customSources.forEach((item) => {
            if (!item.spec || (item.spec.type !== 'vector' && item.spec.type !== 'composite-vector')) {
                return;
            }
            const oldLayer = item.layer;
            // The SOURCE is handed over, not rebuilt from its spec: a provider's spec describes a
            // persistent cache, and building it again opens a SECOND cache on the same file.
            const source = oldLayer.source();
            item.spec = { ...item.spec, ...(source ? { source: source.handle } : {}), style: newDecoder.id };
            // A fresh id per generation, from the layer's own base: appending to the previous id
            // grew a segment on every style switch and kept each one registered.
            const baseId = String(oldLayer.id).replace(/#\d+$/, '');
            const layer = mapContext.getMap().buildLayer(`${baseId}#${generation}`, item.spec);
            layer.onFeatureClick((e) => {
                e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e));
            });
            mapContext.replaceLayer(oldLayer, layer);
            oldLayer.destroy();
            item.layer = layer;
        });
        // Every rebuilt layer is a fresh object with no external sources on it.
        this.updateTerrain();
    }
    private decoderGeneration = 0;
    hillshadeLayer: MassifLayer<'massif::HillshadeRasterTileLayer'>;
    /** The DEM, once one is loaded. Feeds the `#hillshade` slot and the generated contours. */
    private terrainSource: MassifSource;
    /** `terrainSource` traced into contour lines, built on first use because it is not always wanted. */
    private contourSource: MassifSource;
    /** The composite the slots are currently wired to, so they can be moved or taken off again. */
    private terrainAttachedTo: MassifObject<'massif::CompositeVectorTileLayer'>;

    /** The DEM item currently holding the slot, so a reorder can tell whether it changed. */
    private slotItem: SourceItem;

    /**
     * Decides which DEM is woven into the style and which are stacked, then wires the slots.
     *
     * The style declares ONE `#hillshade` slot, so only one DEM can be woven into the layer order.
     * The top-most one wins - the same rule the base map itself follows - and every other DEM is a
     * stacked hillshade layer, exactly as they all were before the slot existed. `customSources`
     * runs bottom-to-top (index 0 is inserted at the bottom of the customLayers band), so the
     * top-most DEM is the LAST one in the list.
     *
     * Called whenever either side can have changed: a source added, removed or reordered, a style
     * change rebuilding every layer, the offline scan finishing.
     */
    updateTerrain() {
        // A PLAIN array, built by hand: ObservableArray.filter answers with another ObservableArray,
        // which holds its items internally and has no index access at all - `items[items.length-1]`
        // on one is always undefined. That is what left the slot unclaimed, so no DEM was ever
        // woven in, every DEM was stacked instead, and `hillshadeLayer` stayed unset - which is
        // also why a click showed no elevation, since hasElevation() only tests that field.
        const terrainItems: SourceItem[] = [];
        this.customSources.forEach((item) => {
            if (item.terrain && item.terrainLayer) {
                terrainItems.push(item);
            }
        });
        // The OFFLINE DEM wins the slot whenever there is one, whatever the order: it draws and
        // traces without a network, and an online DEM in the slot makes the hillshade and the
        // contours depend on one. Order only decides between DEMs of the same kind, and the
        // top-most of those wins - `customSources` runs bottom-to-top, so that is the last.
        const slotItem = terrainItems.find((item) => item.local) ?? terrainItems[terrainItems.length - 1];
        this.hasTerrain = terrainItems.length > 0;

        // Elevation queries go to the same DEM for the same reason - a profile is thousands of
        // samples, and over an online source that is thousands of tile fetches on a worker thread.
        this.hillshadeLayer = packageService.hillshadeLayer = slotItem?.terrainLayer;

        // Keyed on the ITEM, never on the source handle: `layer.source()` registers a NEW handle on
        // every call, so comparing handles reported a change every time - and rebuilding the slots
        // on every call threw the contour child away before it had finished tracing, which is
        // CPU-seconds of work, so the contours never appeared at all.
        if (slotItem !== this.slotItem) {
            this.terrainSource?.destroy();
            this.terrainSource = slotItem ? slotItem.terrainLayer.source() : null;
            // The contours are TRACED from the DEM, so a different DEM means a different trace.
            // Rebuilt rather than reused: the id is registered against its spec, and the same id
            // with a new source would be refused.
            this.contourSource?.destroy();
            this.contourSource = null;
        }

        // Stacked or woven, one or the other. The woven one's own layer comes OFF the map - the
        // composite draws its own child from the same source, and leaving both on would shade twice.
        terrainItems.forEach((item) => {
            const stacked = item !== slotItem;
            const inStack = mapContext.getLayerIndex(item.terrainLayer) !== -1;
            if (stacked && !inStack) {
                mapContext.addLayer(item.terrainLayer, 'customLayers');
            } else if (!stacked && inStack) {
                mapContext.removeLayer(item.terrainLayer, 'customLayers');
            }
            // what the menu and the sheet act on: this layer, until setHillshadeChild re-points the
            // woven one at the child the composite builds
            item.layer = item.terrainLayer;
        });
        this.slotItem = slotItem;
        DEV_LOG &&
            console.log(
                'updateTerrain',
                JSON.stringify({
                    terrainItems: terrainItems.map((item) => ({
                        name: item.name,
                        local: !!item.local,
                        layerValid: !!item.terrainLayer?.valid,
                        stacked: mapContext.getLayerIndex(item.terrainLayer) !== -1
                    })),
                    slot: slotItem?.name,
                    sourceValid: !!this.terrainSource?.valid
                })
            );
        this.updateTerrainAttachment();
        // The 3D mesh reads the same DEM as the hillshade, so it has to follow this: the source it was
        // attached to may just have been replaced. Optional — the feature may not be registered.
        getMapModule('terrain3d')?.onTerrainSourceChanged();
    }

    /**
     * Wires the terrain slots to the TOP-MOST composite base layer, and off every other one.
     *
     * Only one: each attachment builds its own child layer over the same DEM, so leaving the slots
     * on a base map that another one covers pays for a second hillshade nobody sees. The top-most
     * is the one actually on screen.
     *
     * Called whenever either side changes - a base map added, removed or reordered, a style change
     * rebuilding every layer, the terrain finishing its scan.
     */
    updateTerrainAttachment() {
        const composites = mapContext
            .getLayers()
            .map((added) => added.layer)
            .filter((layer) => layer?.is('massif::CompositeVectorTileLayer'));
        // getLayers is bottom-to-top, so the last one is the one drawn over the others
        const target = this.terrainSource ? composites[composites.length - 1] : null;
        // Adding or removing an external source rebuilds the composite's draw items and reloads its
        // tiles, so this runs only when the composite it belongs on, or the DEM in it, actually
        // changed - most calls here are an unrelated overlay being added or moved. Turning a slot
        // off goes through setSlotVisible instead, which costs nothing.
        if (target?.handle === this.terrainAttachedTo?.handle && this.terrainSource === this.attachedSource) {
            // Nothing to re-wire — but the ITEM's layer still has to be re-pointed at the child.
            // `updateTerrain` just set it back to `item.terrainLayer`, which for the woven DEM is the
            // DETACHED elevation layer: it is on no map, so the menu's opacity slider and the options
            // sheet were writing to a layer nothing draws. Every call that lands here is one of those
            // — a source toggled, a layer added, reordered or rebuilt — and after the first of them
            // the hillshade controls silently stopped doing anything until the attachment happened to
            // change. This is the only half that is cheap: no external source is added or removed.
            this.setHillshadeChild(this.terrainAttachedTo);
            return;
        }
        if (this.terrainAttachedTo) {
            this.detachTerrain(this.terrainAttachedTo);
            this.terrainAttachedTo = null;
        }
        this.attachedSource = target ? this.terrainSource : null;
        if (target) {
            this.terrainAttachedTo = this.attachTerrain(target);
        }
    }
    /**
     * The DEM the slots were last wired with, so a reorder that changes it re-wires them.
     *
     * Compared by IDENTITY, not by handle: `layer.source()` registers a new handle every call, so
     * a handle comparison never matches and the slots were rebuilt on every unrelated change.
     * updateTerrain only replaces this object when the DEM holding the slot actually changes.
     */
    private attachedSource: MassifSource;

    /**
     * A style parameter's real value.
     *
     * NOT `nutiProps[key]`: the proxy answers null for anything sitting at its default, which reads
     * as "off" for every one of these and is the opposite of what the default says.
     */
    private mapOption(key: string): boolean {
        return !!get(nutiProps.getStore(key));
    }

    /**
     * Puts the DEM in the style's `#hillshade` slot and the contours it generates in `#contour`.
     *
     * Public because a second map showing the same base layer needs the same slots: a clone is its
     * own composite, with its own children.
     *
     * The contour source WRAPS the DEM rather than being fetched: `ContourTileDataSource` traces
     * the elevation tiles the hillshade already loaded, so the offline packages need no contour
     * data of their own and an online-only map gets contours for the first time. It is shared
     * across maps - one trace, however many views.
     *
     * Both slots go on whatever the toggles say, and a slot the user has turned off is HIDDEN
     * rather than left off: attaching is what rebuilds the composite and reloads the base map, and
     * that is not what a visibility toggle should cost. See setSlotVisible.
     */
    attachTerrain(layer: MassifLayer): MassifObject<'massif::CompositeVectorTileLayer'> | null {
        if (!this.terrainSource || !layer?.is('massif::CompositeVectorTileLayer')) {
            return null;
        }
        // `is` is a runtime check, not a type guard, so the handle is re-typed here rather than
        // cast - which is also what makes the composite's own methods resolve. `wrap` registers
        // nothing, so there is nothing to release afterwards.
        const composite = api.wrap(layer.handle, 'massif::CompositeVectorTileLayer');
        try {
            if (!this.contourSource) {
                this.contourSource = mapContext.getMap().source('source.contour', {
                    type: 'contour',
                    source: this.terrainSource.handle,
                    maxOverzoomLevel: CONTOUR_MAX_OVERZOOM
                });
            }
            composite.call('addExternalDataSource', HILLSHADE_SLOT, this.terrainSource.handle, COMPOSITE_SOURCE_TYPE_HILLSHADE);
            composite.call('addVectorDataSource', CONTOUR_SLOT, this.contourSource.handle);
        } catch (error) {
            showError(error);
            return null;
        }
        // The children are brand new, so what the user last chose has to be put back on them.
        this.setHillshadeChild(composite);
        this.withExternalChild(composite, CONTOUR_SLOT, (child) => child.set('visible', this.mapOption('contours')));
        this.applySlopeMode(composite);
        DEV_LOG && this.logSlotStatus(composite);
        return composite;
    }

    /**
     * Why a slot draws nothing, answered in one line - the SDK demo's `checkCompositeSlots`.
     *
     * A slot is the position of a style layer NAMED after the source. A source registered under a
     * name the style's `layers` array does not carry has nowhere to be drawn, and the SDK only
     * warns about it in the log - so the two lists have to be compared to tell "not attached" from
     * "attached but the style has no such layer". A compiled Mapnik XML style carries these slots
     * as well as a CartoCSS one, so MISSING means the style does not name the layer, not that the
     * format cannot express it.
     */
    private logSlotStatus(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        try {
            const declared = mapContext.mapDecoder?.get('styleLayerNames') ?? [];
            const registered = (composite.call('getExternalDataSourceNames') ?? []) as string[];
            console.log(
                'attachTerrain slots',
                JSON.stringify({
                    slots: registered.map((name) => `${name}: ${declared.includes(name) ? 'OK' : 'MISSING in style'}`),
                    contours: this.mapOption('contours')
                })
            );
        } catch (error) {
            console.log('logSlotStatus', error);
        }
    }

    /** Takes both slots off a composite. A name it never held is simply false, not an error. */
    private detachTerrain(composite: MassifObject<'massif::CompositeVectorTileLayer'>) {
        // The child goes with the slot, so the item must not be left pointing at a dead layer -
        // the next attach re-points it, and until then there is nothing drawn to point at.
        this.hillshadeChildResult?.destroy();
        this.hillshadeChildResult = null;
        if (!composite?.valid) {
            return;
        }
        try {
            composite.call('removeExternalDataSource', HILLSHADE_SLOT);
            composite.call('removeExternalDataSource', CONTOUR_SLOT);
        } catch (error) {
            DEV_LOG && console.log('detachTerrain', error);
        }
    }
    needsAttribution = false;
    addDataSource(item: SourceItem, save = true) {
        const name = this.getSourceItemId(item);
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        const layerIndex = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);

        if (layerIndex === -1) {
            this.customSources.push(item);
            if (!item.terrain) {
                mapContext.addLayer(item.layer, 'customLayers');
            }
            if (save) {
                if (item.provider.type) {
                    savedSources.push(item.provider);
                } else {
                    savedSources.push(name);
                }
                ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
            }
        } else {
            this.customSources.splice(layerIndex, 0, item);
            if (!item.terrain) {
                mapContext.insertLayer(item.layer, 'customLayers', layerIndex);
            }
        }
        this.updateTerrain();
        this.updateAttribution(item);
    }
    /**
     * Backed by a store so anything showing a control for these re-renders when offline data finishes
     * loading. They flip asynchronously, long after the map mounts, and as plain fields they were
     * invisible to svelte — the map had to poke its button list by hand to notice.
     */
    get hasLocalData() {
        return get(mapCapabilities).hasLocalData;
    }
    set hasLocalData(value: boolean) {
        mapCapabilities.update((capabilities) => ({ ...capabilities, hasLocalData: value }));
    }
    get hasTerrain() {
        return get(mapCapabilities).hasTerrain;
    }
    set hasTerrain(value: boolean) {
        mapCapabilities.update((capabilities) => ({ ...capabilities, hasTerrain: value }));
    }
    get hasRoute() {
        return get(mapCapabilities).hasRoute;
    }
    set hasRoute(value: boolean) {
        mapCapabilities.update((capabilities) => ({ ...capabilities, hasRoute: value }));
    }
    async loadLocalMbtiles(directory: string) {
        try {
            const context: android.app.Activity = __ANDROID__ && Application.android.startActivity;
            const entities = listFolder(directory);

            const terrains = [];
            const mbtiles = [];
            let worldMbtilesEntity = entities.find((e) => e.name === 'world.mbtiles');
            const worldRouteMbtilesEntity = entities.find((e) => e.name.endsWith('routes_9.mbtiles') || e.name.endsWith('routes.mbtiles'));
            let worldTerrainMbtilesEntity = entities.find((e) => e.name.endsWith('.etiles'));

            const folders = entities.filter((e) => e.isFolder).sort((a, b) => b.name.localeCompare(a.name));
            // DEV_LOG && console.log('loadLocalMbtiles', JSON.stringify(folders));
            for (let i = 0; i < folders.length; i++) {
                const f = folders[i];
                const subentities = listFolder(f.path);
                if (subentities?.length > 0) {
                    const sources = subentities.filter((s) => s.path.endsWith('.mbtiles'));
                    const routesSourceIndex = sources.findIndex((s) => s.path.endsWith('routes.mbtiles'));
                    this.hasRoute = this.hasRoute || routesSourceIndex >= 0;

                    // DEV_LOG &&
                    //     console.log(
                    //         'sources',
                    //         sources.map((s) => s.path)
                    //     );
                    if (sources.length) {
                        mbtiles.push(
                            this.createMergeDataSource(
                                sources.map((s) => getFileNameThatICanUseInNativeCode(context, s.path)),
                                worldMbtilesEntity ? 5 : undefined
                            )
                        );
                    }

                    const terrain = subentities.find((e) => e.name.endsWith('.etiles'));
                    if (terrain) {
                        terrains.push(mbTilesSourceSpec(getFileNameThatICanUseInNativeCode(context, terrain.path)));
                    }
                }
            }

            if (worldMbtilesEntity && mbtiles.length === 0) {
                mbtiles.push(this.createMergeDataSource([worldMbtilesEntity, worldRouteMbtilesEntity].filter((s) => !!s).map((s) => getFileNameThatICanUseInNativeCode(context, s.path))));
                this.hasRoute = this.hasRoute || !!worldRouteMbtilesEntity;
                worldMbtilesEntity = null;
            }

            if (worldTerrainMbtilesEntity && terrains.length === 0) {
                terrains.push(mbTilesSourceSpec(getFileNameThatICanUseInNativeCode(context, worldTerrainMbtilesEntity.path)));
                worldTerrainMbtilesEntity = null;
            }

            if (mbtiles.length) {
                this.hasLocalData = true;
                const name = 'Local';
                const map = mapContext.getMap();
                // `multi` picks the right package per tile, so a region and its neighbours read as
                // one map. It is filled after construction: the packages are found by scanning.
                const multi = map.source('source.local.multi', { type: 'multi' });
                mbtiles.forEach((spec) => multi.call('add', map.source(`source.local.${++localSourceId}`, spec).handle, ''));
                let sourceSpec: any = multi.handle;
                if (worldMbtilesEntity) {
                    const worldSpec = this.createMergeDataSource([worldMbtilesEntity, worldRouteMbtilesEntity].filter((s) => !!s).map((s) => getFileNameThatICanUseInNativeCode(context, s.path)));
                    // the detailed packages first, the world map behind them
                    sourceSpec = this.createOrderedTileDataSource([worldSpec, multi.handle]);
                }
                const opacity = ApplicationSettings.getNumber(name + '_opacity', 1);
                // SpecArg<'layer', 'composite-vector'> is what gives the literal its typings: every
                // key is checked, enums complete to their constant names, and an unknown one is an
                // error. Composite rather than plain vector so the DEM below can be woven into the
                // style's own layer order rather than stacked over the whole map.
                const spec: SpecArg<'layer', 'composite-vector'> = {
                    type: 'composite-vector',
                    source: sourceSpec,
                    style: mapContext.mapDecoder.id,

                    layerBlendingSpeed: isEInk ? 0 : 3,
                    labelBlendingSpeed: isEInk ? 0 : 3,
                    labelRenderOrder: 1, // VECTOR_TILE_RENDER_ORDER_LAST
                    opacity,
                    preloading: get(preloading),
                    clickRadius: layerProps['clickRadius'],
                    tileCacheCapacity: 30 * 1024 * 1024,
                    clickHandlerLayerFilter: get(clickHandlerLayerFilter),
                    tileSubstitutionPolicy: 'TILE_SUBSTITUTION_POLICY_VISIBLE',
                    visible: opacity !== 0
                };
                const layer = map.buildLayer('layer.local', spec);
                layer.onFeatureClick((e) => {
                    e.consumed = mapContext.vectorTileClicked(mapContext.featureClickData(e));
                });
                if (!packageService.localVectorTileLayer) {
                    packageService.localVectorTileLayer = layer;
                }
                this.customSources.push({
                    layer,
                    spec,
                    name,
                    opacity,
                    options: {
                        zoomLevelBias: {
                            min: 0,
                            max: 5
                        }
                    },
                    legend: 'https://www.openstreetmap.org/key.html',
                    local: true,
                    provider: { name }
                });
                mapContext.addLayer(layer, 'map');
            }
            if (terrains.length) {
                const name = 'Hillshade';
                const opacity = ApplicationSettings.getNumber(`${name}_opacity`, 1);
                const map = mapContext.getMap();
                const multi = map.source('source.terrain.multi', { type: 'multi' });
                terrains.forEach((spec) => multi.call('add', map.source(`source.terrain.${++localSourceId}`, spec).handle, ''));
                let sourceSpec: any = multi.handle;
                if (worldTerrainMbtilesEntity) {
                    sourceSpec = this.createOrderedTileDataSource([multi.handle, mbTilesSourceSpec(getFileNameThatICanUseInNativeCode(context, worldTerrainMbtilesEntity.path))]);
                }

                // No addLayer here: updateTerrain stacks it or weaves it into the base map's
                // `#hillshade` slot, depending on where it ends up in the list.
                const layer = this.createHillshadeLayer('layer.hillshade.local', name, sourceSpec);
                this.customSources.push({
                    name,
                    opacity,
                    layer,
                    terrainLayer: layer,
                    options: HILLSHADE_OPTIONS,
                    local: true,
                    terrain: true,
                    provider: { name }
                });
            }
            this.updateTerrain();
        } catch (err) {
            console.error('loadLocalMbtiles', err);
            showError(err);
            // throw err;
        }
    }
    currentlyDownloadind: { source: DownloadableSource; provider: Provider };

    /** Marks a provider's row as no longer downloading, wherever it is in the list. */
    private clearDownloadingRow(provider: Provider) {
        const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
        if (itemIndex >= 0) {
            const item = this.customSources.getItem(itemIndex);
            delete item.downloading;
            delete item.downloadProgress;
            this.customSources.setItem(itemIndex, item);
        }
    }

    async stopDownloads() {
        if (this.currentlyDownloadind) {
            const { provider, source } = this.currentlyDownloadind;
            source.call('stopAllDownloads');
            source.off('download.started');
            source.off('download.progress');
            source.off('download.completed');
            this.notify({ eventName: 'datasource_download_progress', object: this, data: 0 });
            this.clearDownloadingRow(provider);
            this.currentlyDownloadind = null;
        }
    }

    /**
     * Downloads what is on screen into a provider's persistent cache.
     *
     * The SDK reports progress through events on the source now (`download.started`,
     * `download.progress`, `download.completed`), so there is no listener object to build - which
     * is what made an offline download unreachable from a string API at all.
     */
    async downloadDataSource({ maxZoom, minZoom, provider, source }: { source: DownloadableSource; provider: Provider; minZoom?: number; maxZoom?: number }) {
        try {
            if (this.currentlyDownloadind || !source) {
                return;
            }
            await new Promise<void>((resolve, reject) => {
                try {
                    this.currentlyDownloadind = { source, provider };
                    const zoom = maxZoom ?? provider.sourceOptions.maxZoom - 1;
                    const camera = mapContext.getMap().camera();
                    const bounds = camera.bounds();

                    source.on('download.started', (e) => {
                        DEV_LOG && console.log('onDownloadStarting', e.tileCount);
                        const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                        if (itemIndex >= 0) {
                            const item = this.customSources.getItem(itemIndex);
                            item.downloading = true;
                            item.downloadProgress = 0;
                            this.customSources.setItem(itemIndex, item);
                        }
                        this.notify({ eventName: 'datasource_dowload_started', object: this, data: { provider, source } });
                    });
                    // throttled: the SDK reports per tile, and the list only has to keep up with the eye
                    source.subscribe(
                        'download.progress',
                        (e) => {
                            const progress = e.progress;
                            this.notify({ eventName: 'datasource_download_progress', object: this, data: progress });
                            const itemIndex = this.customSources.findIndex((s) => s.provider === provider);
                            if (itemIndex >= 0) {
                                const item = this.customSources.getItem(itemIndex);
                                item.downloadProgress = progress;
                                this.customSources.setItem(itemIndex, item);
                            }
                        },
                        { throttle: 100 }
                    );
                    source.on('download.completed', () => {
                        DEV_LOG && console.log('onDownloadCompleted');
                        this.currentlyDownloadind = null;
                        this.clearDownloadingRow(provider);
                        this.notify({ eventName: 'datasource_download_progress', object: this, data: 0 });
                        this.notify({ eventName: 'datasource_dowload_finished', object: this, data: { provider, source } });
                        resolve();
                    });

                    DEV_LOG && console.log('startDownloadArea', provider, bounds, minZoom, maxZoom, camera.zoom(), zoom);
                    source.call('startDownloadArea', bounds, Math.round(minZoom ?? camera.zoom()), zoom, 0);
                } catch (error) {
                    reject(error);
                }
            });
        } catch (err) {
            showError(err);
        }
    }

    selectLocalMbtilesFolder() {
        return pickFolder({
            multipleSelection: false
        })
            .then((result) => {
                if (Folder.exists(result.folders[0])) {
                    const localMbtilesSource = result.folders[0];
                    ApplicationSettings.setString('local_mbtiles_directory', localMbtilesSource);
                    this.loadLocalMbtiles(localMbtilesSource);
                } else {
                    return Promise.reject(new Error(l('no_folder_selected')));
                }
            })
            .catch((err) => {
                console.error('selectLocalMbtilesFolder', err);
                setTimeout(() => {
                    throw err;
                }, 0);
            });
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.customSources.splice(0, this.customSources.length);
    }

    async addSource() {
        await this.getSourcesLibrary();
        const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
        const results = await showBottomSheet({
            parent: null,
            view: OptionSelect,
            skipCollapsedState: true,
            props: {
                height: 400,
                title: l('pick_source'),
                showFilter: true,
                rowHeight: 56,
                options: Object.keys(this.baseProviders)
                    .sort()
                    .map((s) => {
                        const p = this.baseProviders[s];
                        const data = this.getTestImageAndHeaders(p);
                        return { type: 'image', title: s, isPick: false, data: this.baseProviders[s], image: data?.url, imageHeaders: data?.headers };
                    })
            }
        });
        const result = Array.isArray(results) ? results[0] : results;
        if (result) {
            const provider = result.data as Provider;
            const name = provider.id || result.name;

            const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
            const layerIndex = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
            if (layerIndex !== -1) {
                throw new SilentError({ message: lc('data_source_already_added', name), showAsSnack: true });
            }
            // if (result.isPick) {
            //     provider.name = File.fromPath(provider.url).name;
            //     provider.id = provider.url;
            //     provider.type = 'orux';
            // }
            const data = await this.createDataSourceAndMapLayer(provider.id || result.name, provider);
            if (data) {
                this.addDataSource(data);
            }
        }
    }

    getSourceItemId(item: SourceItem) {
        return item.id || item.name;
    }

    getAllAtributions() {
        return this.customSources.map((d) => getProviderAttribution(d.provider)).filter((a) => !!a);
    }
    updateAttribution(item: SourceItem, removed: boolean = false) {
        if (getProviderAttribution(item.provider)) {
            if (removed && this.needsAttribution) {
                this.needsAttribution = this.customSources.some((d, i) => !!getProviderAttribution(d.provider));
                this.notify({
                    eventName: 'attribution',
                    needsAttribution: this.needsAttribution
                });
            } else if (!removed && !this.needsAttribution) {
                this.needsAttribution = true;
                this.notify({
                    eventName: 'attribution',
                    needsAttribution: this.needsAttribution
                });
            }
        }
    }
    async deleteSource(item: SourceItem) {
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        if (this.customSources.length === 0 && savedSources.length === 1) {
            showSnack({ message: lc('cant_delete_last_layer') });
            return;
        }
        let index = -1;
        const name = this.getSourceItemId(item);
        this.customSources.some((d, i) => {
            if (d.id === name || d.name === name) {
                index = i;
                return true;
            }
            return false;
        });
        DEV_LOG && console.log('deleteSource', name, index);
        if (index !== -1) {
            const removed = this.customSources.getItem(index);
            // By stack membership, not by kind: a DEM's layer IS in the stack unless it is the one
            // woven into the base map, and the woven one's `layer` is the composite's child, which
            // the composite owns and the stack never held.
            const layer = removed.terrainLayer ?? removed.layer;
            if (mapContext.getLayerIndex(layer) !== -1) {
                mapContext.removeLayer(layer, 'customLayers');
            }
            this.customSources.splice(index, 1);
            this.updateTerrain();
            this.updateAttribution(item, true);
        }
        index = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
        ApplicationSettings.remove(name + '_opacity');
        if (index !== -1) {
            savedSources.splice(index, 1);
            ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
            if (this.customSources.length === 0 && savedSources.length === 0) {
                const sources = this.defaultOnlineSources;
                for (let i = 0; i < sources.length; i++) {
                    const provider = this.baseProviders[sources[i]];
                    const data = await this.createDataSourceAndMapLayer(provider.id, provider);
                    this.addDataSource(data);
                }
            }
        }
    }
    moveSource(item: SourceItem, newIndex: number) {
        let index = -1;
        const name = this.getSourceItemId(item);

        this.customSources.some((d, i) => {
            if (d.id === name || d.name === name) {
                index = i;
                return true;
            }
            return false;
        });
        const layerIndex = mapContext.getLayerTypeFirstIndex('customLayers');
        DEV_LOG && console.log('moveSource', name, index, layerIndex, newIndex);
        if (index !== -1) {
            const moved = this.customSources.getItem(index);
            // Only a layer the stack actually holds can be moved in it. The woven DEM has none
            // there - it is drawn by the base map - so it only changes rank in the list, and
            // updateTerrain below is what turns that into a different DEM holding the slot.
            const layer = moved.terrainLayer ?? moved.layer;
            if (mapContext.getLayerIndex(layer) !== -1) {
                // DEV_LOG && console.log('moveLayer', name, index, layerIndex, newIndex, newIndex + layerIndex);
                mapContext.moveLayer(layer, newIndex + (layerIndex >= 0 ? layerIndex : 0));
            }
            // reordering can change which base map is on top, and which DEM is - the slots follow
            this.updateTerrain();
        }
        const savedSources: (string | Provider)[] = JSON.parse(ApplicationSettings.getString('added_providers', '[]'));
        index = savedSources.findIndex((s) => (typeof s === 'string' ? s : s?.id) === name);
        if (index !== -1) {
            savedSources.splice(index, 1);
            if (item.provider.type) {
                savedSources.splice(newIndex, 0, item.provider);
            } else {
                savedSources.splice(newIndex, 0, name);
            }
            ApplicationSettings.setString('added_providers', JSON.stringify(savedSources));
        }
    }
}
