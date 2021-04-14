<script lang="ts">
    import { Deck, log, MapController } from '@deck.gl/core';
    import { log as lumalog } from '@luma.gl/core';
    import { FirstPersonView, MapView } from '@deck.gl/core';
    import { ScatterplotLayer } from '@deck.gl/layers';
    import { BitmapLayer } from '@deck.gl/layers';
    import TerrainLayer from '~/deckgl/TerrainLayer';
    import { TileLayer } from '@deck.gl/geo-layers';
    import { parse } from '@loaders.gl/core';
    import { showError } from '~/utils/error';
    import { ImageAsset, WebGL2RenderingContext, WebGLRenderingContext } from '@nativescript/canvas';
    import * as https from '@nativescript-community/https';
    let page;
    export let position;
    if (global.isAndroid) {
        java.lang.System.loadLibrary('canvasnative');
    }
    function onNavigatingTo(e) {
        // console.log('onNavigatingTo', page && page.nativeView, e.object);
    }

    function onNavigatingFrom(e) {
        console.log('onNavigatingFrom', !!deckgl);
        if (deckgl) {
            deckgl.finalize();
            deckgl = null;
        }
        // console.log('onNavigatingTo', page && page.nativeView, e.object);
    }

    let canvas, deckgl: Deck;
    async function canvasReady(args) {
        canvas = args.object;
        // console.log('canvasReady', canvas);
        // WebGL2RenderingContext.isDebug = true;
        // WebGL2RenderingContext.filter = 'both';
        // WebGLRenderingContext.isDebug = true;
        // WebGLRenderingContext.filter = 'both';
        // context.isDebug = true;
        try {
            const context = canvas.getContext('webgl2');
            const INITIAL_VIEW_STATE = {
                latitude: 45.171547,
                longitude: 5.722387,
                zoom: 13.5,
                maxZoom: 20,
                pitch: 0,
                position: [0, 0, 600],
                maxPitch: 90,
                bearing: 0
            };

            const terrainLayer = new TerrainLayer({
                id: 'terrain',
                refinementStrategy: 'never',
                meshMaxError: 10,
                minZoom: 5,
                maxZoom: 15,
                _subLayerProps: {
                    tiles: {
                        shadowEnabled: false
                    },
                    mesh: {
                        shadowEnabled: true
                    }
                },
                elevationDecoder: {
                    rScaler: 256,
                    gScaler: 1,
                    bScaler: 1 / 256,
                    offset: -32768
                },
                // Digital elevation model from https://www.usgs.gov/
                elevationData: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
                bounds: [-122.5233, 37.6493, -122.3566, 37.8159]
            });
            // const terrainLayer = new TerrainLayer({
            //     id: 'terrain',
            //     minZoom: 0,
            //     maxZoom: 23,
            //     strategy: 'no-overlap',
            //     elevationDecoder: ELEVATION_DECODER,
            //     workerUrl: '~/@loaders.gl/terrain/dist/es6/terrain-loader.worker',
            //     elevationData: TERRAIN_IMAGE,
            //     // texture: SURFACE_IMAGE,
            //     wireframe: false,
            //     color: [255, 255, 255]
            // });
            const pixelRatio = 0.5;
            const tileLayer = new TileLayer({
                // https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Tile_servers
                data: ['http://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', 'http://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', 'http://c.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'],

                // Since these OSM tiles support HTTP/2, we can make many concurrent requests
                // and we aren't limited by the browser to a certain number per domain.
                maxRequests: 20,
                // throttleRequests:false,
                // pickable: true,
                // highlightColor: [60, 60, 60, 40],
                // https://wiki.openstreetmap.org/wiki/Zoom_levels
                minZoom: 0,
                maxZoom: 19,
                tileSize: 512 / pixelRatio,
                getTileData: async function (tile: { x: number; y: number; z: number; url: string; bbox: any }) {
                    const res = await https.request({
                        method: 'GET',
                        url: tile.url,
                        useLegacy: true
                    });
                    const data = await (res.content as https.HttpsResponseLegacy).toArrayBufferAsync();
                    const image = new ImageAsset();
                    await image.loadFromBytesAsync(new Uint8Array(data));
                    const result = await createImageBitmap(image as any);
                    return result;
                },
                renderSubLayers: (props) => {
                    const {
                        tileSize,
                        bbox: { west, south, east, north }
                    } = props.tile;
                    //
                    return [
                        new BitmapLayer(props, {
                            data: null,
                            image: props.data,
                            bounds: [west, south, east, north]
                        })
                    ];
                }
            });
            const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
            console.log('canvasReady', canvas, width, height);

            class MyMapController extends MapController {
                handleEvent(event) {
                    // console.log('handleEvent', event);
                    // if (event.type === 'pan') {
                    //     // do something
                    //     return true;
                    // } else {
                    return super.handleEvent(event);
                    // }
                }
            }
            const mainView = new FirstPersonView({
                id: 'mainView',
                near: 10,
                far: 60000,
                focalDistance: 1000
            });
            deckgl = new Deck({
                gl: context,
                // canvas: { context },
                views: [mainView],
                // width: "100%",
                // height: "100%",
                // debug: true,
                width: width,
                height: height,
                useDevicePixels: 0.5,
                initialViewState: INITIAL_VIEW_STATE,
                // controller:true,
                controller: true,
                layers: [
                    tileLayer,
                    terrainLayer,
                    new ScatterplotLayer({
                        data: [
                            { position: [-122.45, 37.75], color: [255, 255, 0], radius: 80 },
                            { position: [-122.45, 37.8], color: [255, 0, 0], radius: 100 }
                        ],
                        getColor: (d: any) => d.color,
                        getRadius: (d: any) => d.radius
                    })
                ]
            } as any);
            // deckgl.redraw(true);
            // log.enable();
            // log.level = 1;
            // lumalog.enable();
            // lumalog.level = 1;
        } catch (err) {
            console.error(err, err.stack);
        }
    }
</script>

<frame backgroundColor="transparent" on:closingModally={onNavigatingFrom}>
    <page bind:this={page} actionBarHidden="true" on:navigatingTo={onNavigatingTo}>
        <gridLayout backgroundColor="white">
            <ncanvas id="canvas" on:ready={canvasReady} />
        </gridLayout>
    </page>
</frame>
