import { HTTPTileDataSourceOptions } from '@nativescript-community/ui-carto/datasources/http';
import { RasterTileLayerOptions } from '@nativescript-community/ui-carto/layers/raster';

export interface DataProviderOptions {
    [k: string]: any;
}

export type TOKENS = 'google' | 'carto' | 'here_appid' | 'here_appcode' | 'mapbox' | 'mapquest' | 'maptiler' | 'thunderforest' | 'ign';

export interface ProviderOptions extends DataProviderOptions {
    variantName?: string;
}
export interface Provider {
    tokenKey?: TOKENS | TOKENS[];
    url?: string | string[] | Function;
    urlOptions?: ProviderOptions;
    name?: string;
    id?: string;
    cacheable?: boolean;
    hillshade?: boolean;
    terrarium?: boolean;
    downloadable?: boolean;
    devHidden?: boolean;
    isOverlay?: boolean;
    category?: string;
    attribution?: string;
    legend?: string;
    sourceOptions?: Partial<HTTPTileDataSourceOptions>;
    layerOptions?: Partial<RasterTileLayerOptions>;
    variants?: { [k: string]: Provider | string };
}

export const data: { [k: string]: Provider } = {
    // AkMap: {
    //     sourceOptions: {
    //         maxZoom: 24
    //         // style:'style',
    //         // styleFile:'mapzen.zip'
    //     },
    //     url: ['carto.streets', 'https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2/{zoom}/{x}/{y}.vector.pbf?access_token=' + gVars.MAPBOX_TOKEN]
    // },
    // MapBoxVector: {
    //     // styleFile: "carto_mapbox.zip",
    //     url: 'https://a.tiles.mapbox.com/v4/{variant}/{zoom}/{x}/{y}.vector.pbf?access_token=' + gVars.MAPBOX_TOKEN,
    //     attribution: 'Imagery from <a href="http://mapbox.com/about/maps/">MapBox</a> &mdash; ' + 'Map data {attribution.OpenStreetMap}',
    //     urlOptions: {
    //         variant: 'mapbox.mapbox-streets-v7'
    //     },
    //     variants: {
    //         terrain: {
    //             isOverlay: true,
    //             urlOptions: {
    //                 variant: 'mapbox.mapbox-terrain-v2',
    //                 style: 'terrain'
    //             }
    //         }
    //     }
    // },
    // ESRI_Vector: {
    //     url: "https://basemaps.arcgis.com/v1/arcgis/rest/services/{variant}/VectorTileServer/tile/{z}/{y}/{x}.pbf",
    //     urlOptions: {
    //         attribution: "Tiles &copy; Esri",
    //         maxZoom: 15,
    //         variant: "World_Basemap"
    //     }
    // },
    RefugesInfo: {
        category: 'europe,topo',
        url: 'http://maps.refuges.info/hiking/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="http://www.refuges.info/wiki/licence">Refuges.info</a>, {attribution.OpenStreetMap}',

        sourceOptions: {
            maxZoom: 18
        }
    },
    OpenSkiMap: {
        category: 'ski',
        url: 'https://tiles.skimap.org/openskimap2x/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="http://www.openskimap.org">OpenSkiMap</a>, {attribution.OpenStreetMap}',
        isOverlay: true
    },

    ElevationTiles: {
        url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        hillshade: true,
        terrarium: false,
        isOverlay: true
    },
    // OpenSnowMap: {
    //     category: "ski",
    //     url: "//www.opensnowmap.org/tiles-pistes/{z}/{x}/{y}.png",
    //     urlOptions: {
    //         opacity: 0.99,
    //         attribution: '&copy; <a href="http://www.opensnowmap.org">OpenSnowMap</a>, {attribution.OpenStreetMap}',
    //         forceHTTP: true
    //     }
    // },
    IGN: {
        tokenKey: 'ign',
        category: 'france',
        legend: 'https://www.geoportail.gouv.fr/depot/layers/{variant}/legendes/{variant}-legend.png',
        url: 'http://wxs.ign.fr/{ign}/geoportail/wmts?LAYER={variant}&EXCEPTIONS=text/xml&FORMAT={format}&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE={style}&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
        cacheable: true,
        urlOptions: {
            variant: 'GEOGRAPHICALGRIDSYSTEMS.MAPS',
            format: 'image/jpeg',
            style: 'normal'
        },
        sourceOptions: {
            httpHeaders: {
                'User-Agent': 'AlpiMaps'
            },
            maxZoom: 16
        },
        variants: {
            Plan: {
                urlOptions: {
                    variant: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGN'
                },
                sourceOptions: {
                    minZoom: 6
                }
            },
            Satellite: {
                urlOptions: {
                    variant: 'ORTHOIMAGERY.ORTHOPHOTOS'
                }
            },
            // Buildings: {
            //     urlOptions: {
            //         variant: "BUILDINGS.BUILDINGS",
            //         format: "image/png"
            //     }
            // },
            // Cadastre: {
            //     urlOptions: {
            //         variant: "CADASTRALPARCELS.PARCELS",
            //         format: "image/png"
            //     }
            // },
            ScanExpress: {
                urlOptions: {
                    variant: 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD'
                    // format: 'image/png',
                }
            },
            Scan25: {
                urlOptions: {
                    variant: 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR'
                    // format: 'image/png',
                }
                // sourceOptions:{
                // TMSScheme:true
                // }
            },
            Slopes: {
                urlOptions: {
                    variant: 'GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN',
                    format: 'image/png'
                }
            },
            HillShading: {
                isOverlay: true,
                urlOptions: {
                    variant: 'ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW',
                    style: 'estompage_grayscale',
                    format: 'image/png'
                }
            },
            ELEVATION: {
                urlOptions: {
                    variant: 'ELEVATION.SLOPES'
                    // format: 'image/png',
                }
            }
        }
    },
    Avalanches: {
        url: 'http://vmapfishbda.grenoble.cemagref.fr/cgi-bin/mapserv?map=/var/www/prod/test.map&LAYERS=zont%2Clint&TRANSPARENT=true&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&STYLES=&EXCEPTIONS=application%2Fvnd.ogc.se_inimage&FORMAT=image%2Fpng&SRS=EPSG%3A27572&BBOX={bbox}&WIDTH=300&HEIGHT=300'
    },
    OpenStreetMap: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        legend: 'https://www.openstreetmap.org/key.html',
        sourceOptions: {
            minZoom: 2,
            maxZoom: 19,
            httpHeaders: {
                'User-Agent': 'AlpiMaps'
            },
        },
        urlOptions: {
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        },
        variants: {
            BlackAndWhite: {
                url: 'http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
                sourceOptions: {
                    maxZoom: 18
                }
            },
            DE: {
                url: 'http://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png',
                sourceOptions: {
                    maxZoom: 18
                }
            },
            France: {
                url: 'http://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
                attribution: '&copy; Openstreetmap France | {attribution.OpenStreetMap}',
                sourceOptions: {
                    maxZoom: 18
                }
            },
            HOT: {
                url: 'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
                attribution: '{attribution.OpenStreetMap}, Tiles courtesy of <a href="http://hot.openstreetmap.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'
            },
            Route500: {
                url: 'http://{s}.tile.openstreetmap.fr/route500/{z}/{x}/{y}.png',
                isOverlay: true,
                attribution: '&copy; Openstreetmap France | {attribution.OpenStreetMap}',
                sourceOptions: {
                    maxZoom: 15
                }
            }
        }
    },
    OpenSeaMap: {
        category: 'sea',
        url: 'http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        isOverlay: true,
        attribution: 'Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
    },
    OpenTopoMap: {
        category: 'topo,europe',
        url: 'http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution:
            'Map data: {attribution.OpenStreetMap}, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
        sourceOptions: {
            maxZoom: 15
        }
    },
    Lonvia: {
        category: 'topo',
        url: 'http://tile.waymarkedtrails.org/{variant}/{z}/{x}/{y}.png',
        isOverlay: true,
        attribution: 'Map data: {attribution.OpenStreetMap}, <Overlay from hiking.waymarkedtrails.org, <a href="https://hiking.waymarkedtrails.org/help/acknowledgements"> Terms of Use</a> )',
        sourceOptions: {
            maxZoom: 15
        },
        variants: {
            HikingRoutes: {
                urlOptions: {
                    variant: 'hiking'
                    //     gridSource:'https://hiking.waymarkedtrails.org/api/tiles/{z}/{x}/{y}.json',
                    //     gridMinZoom:12,
                    //     gridMaxZoom:12
                }
            },
            CycleRoutes: {
                urlOptions: {
                    variant: 'cycling'
                    // gridSource:'https://cycling.waymarkedtrails.org/api/tiles/{z}/{x}/{y}.json',
                    // gridMinZoom:12,
                    // gridMaxZoom:12
                }
            },
            hillshading: {
                isOverlay: true,
                urlOptions: {
                    variant: 'hillshading'
                }
            }
        }
    },
    OpenCycleMap: {
        tokenKey: 'thunderforest',
        url: 'https://{s}.tile.thunderforest.com/{variant}/{z}/{x}/{y}@2x.png?apikey={thunderforest}',
        attribution: '&copy; <a href="http://www.opencyclemap.org">OpenCycleMap</a>, {attribution.OpenStreetMap}',
        sourceOptions: {
            maxZoom: 18
        },
        layerOptions: {
            zoomLevelBias: 1
        },
        urlOptions: {
            variant: 'cycle'
        },
        variants: {
            Transport: {
                sourceOptions: {
                    maxZoom: 19
                },
                urlOptions: {
                    variant: 'transport'
                }
            },
            Landscape: 'landscape',
            Outdoors: 'outdoors',
            'Spinal Map': 'spinal-map',
            Pioneer: 'pioneer',
            'Mobile Atlas': 'mobile-atlas',
            Neighbourhood: 'neighbourhood'
        }
    },
    OpenMapSurfer: {
        url: 'http://korona.geog.uni-heidelberg.de/tiles/{variant}/x={x}&y={y}&z={z}',
        attribution: 'Imagery from <a href="http://giscience.uni-hd.de/">GIScience Research Group @ University of Heidelberg</a> &mdash; Map data {attribution.OpenStreetMap}',
        urlOptions: {
            variant: 'roads'
        },
        variants: {
            AdminBounds: {
                isOverlay: true,
                sourceOptions: {
                    maxZoom: 18
                },
                urlOptions: {
                    variant: 'adminb'
                }
            },
            Grayscale: {
                sourceOptions: {
                    maxZoom: 18
                },
                urlOptions: {
                    variant: 'roadsg'
                }
            },
            Contours: {
                isOverlay: true,
                sourceOptions: {
                    minZoom: 13,
                    maxZoom: 17
                },
                urlOptions: {
                    variant: 'asterc'
                }
            }
        }
    },
    Hydda: {
        url: 'http://{s}.tile.openstreetmap.se/hydda/{variant}/{z}/{x}/{y}.png',
        attribution: 'Tiles courtesy of <a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data {attribution.OpenStreetMap}',
        sourceOptions: {
            maxZoom: 18
        },
        layerOptions: {
            zoomLevelBias: 0
        },
        urlOptions: {
            variant: 'full'
        },
        variants: {
            Base: 'base',
            RoadsAndLabels: 'roads_and_labels'
        }
    },
    MapQuestOpen: {
        /* Mapquest does support https, but with a different subdomain:
         * https://otile{s}-s.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.{ext}
         * which makes implementing protocol relativity impossible.
         */
        url: 'http://otile{s}.mqcdn.com/tiles/1.0.0/{type}/{z}/{x}/{y}.{ext}',
        attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/">MapQuest</a> &mdash; ' + 'Map data {attribution.OpenStreetMap}',
        sourceOptions: {
            subdomains: '1234'
        },
        urlOptions: {
            type: 'map',
            ext: 'jpg'
        },
        variants: {
            OSM: {},
            Aerial: {
                sourceOptions: {
                    maxZoom: 18
                },
                attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/">MapQuest</a> &mdash; ' + 'Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency',
                urlOptions: {
                    type: 'sat'
                }
            },
            HybridOverlay: {
                isOverlay: true,
                urlOptions: {
                    type: 'hyb',
                    ext: 'png'
                }
            }
        }
    },
    MapBox: {
        tokenKey: 'mapbox',
        url: 'https://{s}.tiles.mapbox.com/v4/{variant}/{z}/{x}/{y}{2x}.png?access_token={mapbox}',
        attribution: 'Imagery from <a href="http://mapbox.com/about/maps/">MapBox</a> &mdash; ' + 'Map data {attribution.OpenStreetMap}',
        layerOptions: {
            zoomLevelBias: 0
        },
        sourceOptions: {
            subdomains: 'abcd'
        },
        urlOptions: {
            variant: 'mapbox.streets'
        },
        variants: {
            Light: 'mapbox.light',
            Dark: 'mapbox.dark',
            Satellite: 'mapbox.satellite',
            Hybrid: 'mapbox.streets-satellite',
            Basic: 'mapbox.streets-basic',
            Comic: 'mapbox.comic',
            Outdoors: 'mapbox.outdoors',
            RunBikeHike: 'mapbox.run-bike-hike',
            Pencil: 'mapbox.pencil',
            Pirates: 'mapbox.pirates',
            Emerald: 'mapbox.emerald',
            HighContrast: 'mapbox.high-contrast',
            WheatPaste: 'mapbox.wheatpaste'
        }
    },
    Stamen: {
        url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/{variant}/{z}/{x}/{y}.png',
        attribution:
            'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ' + '<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; ' + 'Map data {attribution.OpenStreetMap}',
        sourceOptions: {
            subdomains: 'abcd',
            minZoom: 0,
            maxZoom: 20
        },
        urlOptions: {
            variant: 'toner',
            ext: 'png'
        },
        variants: {
            TonerBackground: 'toner-background',
            TonerHybrid: 'toner-hybrid',
            TonerLines: 'toner-lines',
            TonerLabels: {
                isOverlay: true,
                urlOptions: {
                    variant: 'toner-labels'
                }
            },
            TonerLite: 'toner-lite',
            Watercolor: {
                sourceOptions: {
                    minZoom: 1,
                    maxZoom: 16
                },
                urlOptions: {
                    variant: 'watercolor'
                }
            },
            Terrain: {
                sourceOptions: {
                    minZoom: 4,
                    maxZoom: 18
                    // bounds: [[22, -132], [70, -56]]
                },
                urlOptions: {
                    variant: 'terrain'
                }
            },
            TerrainBackground: {
                sourceOptions: {
                    minZoom: 4,
                    maxZoom: 18
                    // bounds: [[22, -132], [70, -56]]
                },
                urlOptions: {
                    variant: 'terrain-background'
                }
            }
            // TopOSMRelief: {
            //     urlOptions: {
            //         variant: 'toposm-color-relief',
            //         ext: 'jpg',
            //         bounds: [
            //             [22, -132],
            //             [51, -56]
            //         ]
            //     }
            // },
            // TopOSMFeatures: {
            //     urlOptions: {
            //         variant: 'toposm-features',
            //         bounds: [
            //             [22, -132],
            //             [51, -56]
            //         ],
            //         opacity: 0.9
            //     }
            // }
        }
    },
    Esri: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/{variant}/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        urlOptions: {
            variant: 'World_Street_Map'
        },
        variants: {
            WorldStreetMap: {
                attribution: '{attribution.Esri} &mdash; ' + 'Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
            },
            DeLorme: {
                sourceOptions: {
                    minZoom: 1,
                    maxZoom: 11
                },

                attribution: '{attribution.Esri} &mdash; Copyright: &copy;2012 DeLorme',
                urlOptions: {
                    variant: 'Specialty/DeLorme_World_Base_Map'
                }
            },
            WorldTopoMap: {
                attribution:
                    '{attribution.Esri} &mdash; ' +
                    'Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
                urlOptions: {
                    variant: 'World_Topo_Map'
                }
            },
            WorldImagery: {
                sourceOptions: {
                    maxZoom: 18
                },
                attribution: '{attribution.Esri} &mdash; ' + 'Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                urlOptions: {
                    variant: 'World_Imagery'
                }
            },
            WorldTerrain: {
                sourceOptions: {
                    maxZoom: 13
                },
                attribution: '{attribution.Esri} &mdash; ' + 'Source: USGS, Esri, TANA, DeLorme, and NPS',
                urlOptions: {
                    variant: 'World_Terrain_Base'
                }
            },
            WorldShadedRelief: {
                sourceOptions: {
                    maxZoom: 13
                },
                attribution: '{attribution.Esri} &mdash; Source: Esri',
                urlOptions: {
                    variant: 'World_Shaded_Relief'
                }
            },
            WorldPhysical: {
                sourceOptions: {
                    maxZoom: 8
                },
                attribution: '{attribution.Esri} &mdash; Source: US National Park Service',
                urlOptions: {
                    variant: 'World_Physical_Map'
                }
            },
            OceanBasemap: {
                sourceOptions: {
                    maxZoom: 13
                },
                attribution: '{attribution.Esri} &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
                urlOptions: {
                    variant: 'Ocean_Basemap'
                }
            },
            NatGeoWorldMap: {
                sourceOptions: {
                    maxZoom: 16
                },
                attribution: '{attribution.Esri} &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
                urlOptions: {
                    variant: 'NatGeo_World_Map'
                }
            },
            WorldGrayCanvas: {
                sourceOptions: {
                    maxZoom: 16
                },
                attribution: '{attribution.Esri} &mdash; Esri, DeLorme, NAVTEQ',
                urlOptions: {
                    variant: 'Canvas/World_Light_Gray_Base'
                }
            }
        }
    },
    OpenWeatherMap: {
        category: 'weather',
        url: 'http://{s}.tile.openweathermap.org/map/{variant}/{z}/{x}/{y}.png',
        sourceOptions: {
            maxZoom: 19
        },
        isOverlay: true,
        attribution: 'Map data &copy; <a href="http://openweathermap.org">OpenWeatherMap</a>',
        cacheable: false,
        variants: {
            Clouds: 'clouds',
            CloudsClassic: 'clouds_cls',
            Precipitation: 'precipitation',
            PrecipitationClassic: 'precipitation_cls',
            Rain: 'rain',
            RainClassic: 'rain_cls',
            Pressure: 'pressure',
            PressureContour: 'pressure_cntr',
            Wind: 'wind',
            Temperature: 'temp',
            Snow: 'snow'
        }
    },
    HERE: {
        /*
         * HERE maps, formerly Nokia maps.
         * These basemaps are free, but you need an API key. Please sign up at
         * http://developer.here.com/getting-started
         *
         * Note that the base urls contain '.cit' whichs is HERE's
         * 'Customer Integration Testing' environment. Please remove for production
         * envirionments.
         */
        tokenKey: ['here_appcode', 'here_appid'],

        url: 'https://{s}.{base}.maps.cit.api.here.com/maptile/2.1/' + 'maptile/{mapID}/{variant}/{z}/{x}/{y}/256/png8?' + 'app_id={here_appid}&app_code={here_appcode}',
        attribution: 'Map &copy; 1987-2014 <a href="http://developer.here.com">HERE</a>',
        urlOptions: {
            mapID: 'newest',
            base: 'base',
            variant: 'normal.day'
        },
        sourceOptions: {
            subdomains: '1234',

            maxZoom: 20
        },
        variants: {
            normalDayCustom: 'normal.day.custom',
            normalDayGrey: 'normal.day.grey',
            normalDayMobile: 'normal.day.mobile',
            normalDayGreyMobile: 'normal.day.grey.mobile',
            normalDayTransit: 'normal.day.transit',
            normalDayTransitMobile: 'normal.day.transit.mobile',
            normalNight: 'normal.night',
            normalNightMobile: 'normal.night.mobile',
            normalNightGrey: 'normal.night.grey',
            normalNightGreyMobile: 'normal.night.grey.mobile',
            carnavDayGrey: 'carnav.day.grey',
            hybridDay: {
                urlOptions: {
                    base: 'aerial',
                    variant: 'hybrid.day'
                }
            },
            hybridDayMobile: {
                urlOptions: {
                    base: 'aerial',
                    variant: 'hybrid.day.mobile'
                }
            },
            pedestrianDay: 'pedestrian.day',
            pedestrianNight: 'pedestrian.night',
            satelliteDay: {
                urlOptions: {
                    base: 'aerial',
                    variant: 'satellite.day'
                }
            },
            terrainDay: {
                urlOptions: {
                    base: 'aerial',
                    variant: 'terrain.day'
                }
            },
            terrainDayMobile: {
                urlOptions: {
                    base: 'aerial',
                    variant: 'terrain.day.mobile'
                }
            }
        }
    },
    // Acetate: {
    //     url: "http://a{s}.acetate.geoiq.com/tiles/{variant}/{z}/{x}/{y}.png",
    //     urlOptions: {
    //         attribution: "&copy;2012 Esri & Stamen, Data from OSM and Natural Earth",
    //         subdomains: "0123",
    //         minZoom: 2,
    //         maxZoom: 17,
    //         variant: "acetate-base"
    //     },
    //     variants: {
    //         terrain: "terrain",
    //         all: "acetate-hillshading",
    //         foreground: "acetate-fg",
    //         roads: "acetate-roads",
    //         labels: "acetate-labels",
    //         hillshading: "hillshading"
    //     }
    // },
    FreeMapSK: {
        category: 'slovenia',
        url: 'http://{s}.freemap.sk/T/{z}/{x}/{y}.jpeg',
        attribution: '{attribution.OpenStreetMap}, vizualization CC-By-SA 2.0 <a href="http://freemap.sk">Freemap.sk</a>',
        sourceOptions: {
            minZoom: 8,
            maxZoom: 16,
            subdomains: ['t1', 't2', 't3', 't4'] as any
        }
    },
    MtbMap: {
        category: 'europe',
        url: 'http://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap} &amp; USGS',
        sourceOptions: {
            maxZoom: 18
        }
    },
    CartoDB: {
        url: 'http://{s}.basemaps.cartocdn.com/{variant}/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        sourceOptions: {
            subdomains: 'abcd',
            maxZoom: 18
        },
        urlOptions: {
            variant: 'light_all'
        },
        variants: {
            PositronNoLabels: 'light_nolabels',
            DarkMatter: 'dark_all',
            DarkMatterNoLabels: 'dark_nolabels'
        }
    },
    HikeBike: {
        category: 'topo',
        url: 'http://{s}.tiles.wmflabs.org/{variant}/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap}',
        sourceOptions: {
            maxZoom: 14
        },
        urlOptions: {
            variant: 'hikebike'
        },
        variants: {
            HillShading: {
                category: 'relief',
                isOverlay: true,
                sourceOptions: {
                    maxZoom: 15
                },
                urlOptions: {
                    variant: 'hillshading'
                }
            }
        }
    },
    NASAGIBS: {
        category: 'other',
        url: 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/{variant}/default/{time}/{tilematrixset}{maxZoom}/{z}/{y}/{x}.{format}',
        attribution:
            'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System ' +
            '(<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.',
        sourceOptions: {
            // bounds: [[-85.0511287776, -179.999999975], [85.0511287776, 179.999999975]],
            minZoom: 1,
            maxZoom: 8
        },
        urlOptions: {
            format: 'jpg',
            // time: '',
            variant: 'VIIRS_CityLights_2012',
            tilematrixset: 'GoogleMapsCompatible_Level'
        },
        variants: {
            ModisTerraLSTDay: {
                isOverlay: true,
                sourceOptions: {
                    maxZoom: 7
                },
                urlOptions: {
                    variant: 'MODIS_Terra_Land_Surface_Temp_Day',
                    format: 'png'
                }
            },
            // ModisTerraSnowCover: {
            //     urlOptions: {
            //         variant: 'MODIS_Terra_Snow_Cover',
            //         format: 'png',
            //         maxZoom: 8,
            //         opacity: 0.75
            //     }
            // },
            ModisTerraAOD: {
                isOverlay: true,
                sourceOptions: {
                    maxZoom: 6
                },
                urlOptions: {
                    variant: 'MODIS_Terra_Aerosol',
                    format: 'png'
                }
            }
            // ModisTerraChlorophyll: {
            //     urlOptions: {
            //         variant: 'MODIS_Terra_Chlorophyll_A',
            //         format: 'png',
            //         maxZoom: 7,
            //         opacity: 0.75
            //     }
            // }
        }
    },
    map1eu: {
        category: 'europe',
        url: 'http://beta.map1.eu/tiles/{z}/{x}/{y}.jpg',
        attribution: '&copy; <a href="http://beta.map1.eu/">map1.eu</a>, {attribution.OpenStreetMap}',
        sourceOptions: {
            maxZoom: 15
        }
    },
    Geofabrik: {
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://www.geofabrik.de/maps/tiles.html">Geofabrik</a>',
        sourceOptions: {
            subdomains: 'abcd',
            maxZoom: 16
        },
        variants: {
            Streets: {
                url: 'http://{s}.tile.geofabrik.de/549e80f319af070f8ea8d0f149a149c2/{z}/{x}/{y}.png'
            },
            Topo: {
                category: 'topo',
                url: 'http://{s}.tile.geofabrik.de/15173cf79060ee4a66573954f6017ab0/{z}/{x}/{y}.png'
            }
        }
    },
    'Ride with GPS': {
        url: 'http://{s}.tile.ridewithgps.com/rwgps/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://ridewithgps.com/">Ride with GPS</a>',
        sourceOptions: {
            subdomains: 'abcd',
            maxZoom: 16
        }
    },
    Waze: {
        url: 'https://worldtiles{s}.waze.com/tiles/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://waze.com">Waze</a>',
        sourceOptions: {
            subdomains: '1234',
            maxZoom: 19
        }
    },
    Alltrails: {
        category: 'topo',
        url: 'http://alltrails.com/tiles/alltrailsOutdoors/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://alltrails.com">Alltrails</a>',
        sourceOptions: {
            maxZoom: 19
        }
    },
    '4umaps': {
        category: 'europe,topo',
        url: 'http://4umaps.eu/{z}/{x}/{y}.png',
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://4umaps.eu">4umaps</a>',
        sourceOptions: {
            minZoom: 1,
            maxZoom: 15
        }
    },
    'slopes > 30%': {
        category: 'europe',
        url: 'http://www.skitrack.fr/cgi-bin/mapserv.fcgi?map=/srv/d_vttrack/vttrack/skitrack/mapserver/WMS-{variant}.map&SERVICE=WMS&VERSION=1.1.1&LAYERS=slope&FORMAT={format}&TRANSPARENT=true&REQUEST=GetMap&STYLES=&SRS=EPSG%3A900913&BBOX={bbox}&WIDTH=512&HEIGHT=512',
        isOverlay: true,
        attribution: '{attribution.OpenStreetMap} &copy; <a href="http://maptoolkit.net/">Maptoolkit</a>',
        layerOptions: {
            zoomLevelBias: 0
        },
        devHidden: true,
        sourceOptions: {
            maxZoom: 15
        },
        urlOptions: {
            format: 'image/png'
        },
        variants: {
            IGN: {
                urlOptions: {
                    variant: 'slopeIGN75'
                }
            },
            aster: {
                urlOptions: {
                    variant: 'slope-aster'
                }
            }
        }
        // },
        // 'piemonte': {
        //     category: 'italie',
        //     url: '//www.webgis.csi.it/cataloghiradex_f/cataloghi_TMS/sfondi/sfondo_europa_piemonte/{z}/{x}/{y}.png',
        //     urlOptions: {
        //         attribution: 'http://www.regione.piemonte.it/sentgis/jsp/cartografia/mappa.do',
        //         forceHTTP: true,
        //         maxZoom: 18
        //     }
    },
    USGS: {
        url: 'http://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/WMTS/tile/1.0.0/USGSTopo/default/GoogleMapsCompatible/{zoom}/{y}/{x}',
        attribution:
            'USGS The National Map. The National Boundaries Dataset, National Elevation Dataset, Geographic Names Information System, National Hydrography Dataset, National Land Cover Database, National Structures Dataset, and National Transportation Dataset; U.S. Census Bureau - TIGER/Line; HERE Road Data. USGS MapServer'
    }
};
