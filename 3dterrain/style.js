const MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
console.log('userAgent ' +  navigator.userAgent + " " + MOBILE);
const mapboxStyle = {
    "id": "topo",
    "name": "Topo",
    "zoom": 1,
    "pitch": 0,
    "center": [
        0,
        0
    ],
    "glyphs": "fonts/{fontstack}/{range}.pbf",
    "layers": [
        {
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "rgba(232, 230, 223, 1)"
            },
            "layout": {
                "visibility": "visible"
            },
            "minzoom": 0
        },
        {
            "id": "landcover_grass",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(222, 226, 191, 1)",
                "fill-opacity": 0.6,
                "fill-antialias": false
            },
            "filter": [
                "any",
                [
                    "==",
                    "subclass",
                    "park"
                ],
                [
                    "==",
                    "subclass",
                    "village_green"
                ],
                [
                    "==",
                    "class",
                    "grass"
                ],
                [
                    "==",
                    "class",
                    "farmland"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 22,
            "minzoom": 9,
            "metadata": {},
            "source-layer": "landcover"
        },
        {
            "id": "landcover_wood",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(191, 202, 155, 1)",
                "fill-opacity": 1,
                "fill-antialias": true,
                "fill-translate": [
                    1,
                    1
                ],
                "fill-outline-color": "rgba(191, 202, 155, 1)"
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "wood"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 22,
            "minzoom": 9,
            "metadata": {},
            "source-layer": "landcover"
        },
        {
            "id": "landcover_ice",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(255, 255, 255, 1)",
                "fill-opacity": 1,
                "fill-antialias": false
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "ice"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 22,
            "minzoom": 9,
            "metadata": {},
            "source-layer": "landcover"
        },
        {
            "id": "landcover_sand",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(232, 214, 38, 1)",
                "fill-opacity": 0.3,
                "fill-antialias": false
            },
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "sand"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "landcover"
        },
        {
            "id": "globallandcover_grass",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(222, 226, 191, 1)",
                "fill-opacity": {
                    "stops": [
                        [
                            8,
                            0.6
                        ],
                        [
                            9,
                            0.2
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "grass"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 9,
            "minzoom": 0,
            "source-layer": "globallandcover"
        },
        {
            "id": "globallandcover_scrub",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(202, 214, 166, 1)",
                "fill-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "scrub"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 9,
            "minzoom": 0,
            "source-layer": "globallandcover"
        },
        {
            "id": "globallandcover_tree",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(191, 202, 155, 1)",
                "fill-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "tree"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 9,
            "minzoom": 0,
            "source-layer": "globallandcover"
        },
        {
            "id": "globallandcover_forest",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(191, 202, 155, 1)",
                "fill-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "forest"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 9,
            "minzoom": 0,
            "source-layer": "globallandcover"
        },
        {
            "id": "globallandcover_ice",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(255, 255, 255, 1)",
                "fill-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "snow"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 9,
            "minzoom": 0,
            "source-layer": "globallandcover"
        },
        {
            "id": "landuse-residential",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(191, 186, 171, 1)",
                "fill-opacity": {
                    "stops": [
                        [
                            8,
                            0.4
                        ],
                        [
                            9,
                            0.1
                        ],
                        [
                            9.1,
                            0.4
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Polygon"
                ],
                [
                    "in",
                    "class",
                    "residential",
                    "suburb",
                    "neighbourhood"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 16,
            "source-layer": "landuse"
        },
        {
            "id": "landuse_industrial_school",
            "type": "fill",
            "paint": {
                "fill-color": {
                    "stops": [
                        [
                            12,
                            "rgba(179, 179, 179, 1)"
                        ],
                        [
                            16,
                            "rgba(232, 230, 223, 1)"
                        ]
                    ]
                },
                "fill-opacity": 0.5
            },
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "industrial",
                    "commercial",
                    "retail",
                    "stadium",
                    "college",
                    "university",
                    "school",
                    "garages",
                    "dam"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 22,
            "minzoom": 10,
            "metadata": {},
            "source-layer": "landuse"
        },
        {
            "id": "landuse_cemetery",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(175, 169, 157, 1)",
                "fill-opacity": 0.5
            },
            "filter": [
                "==",
                "class",
                "cemetery"
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 22,
            "minzoom": 10,
            "metadata": {},
            "source-layer": "landuse"
        },
        {
            "id": "landuse_hospital",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(236, 224, 231, 1)",
                "fill-opacity": 0.5
            },
            "filter": [
                "==",
                "class",
                "hospital"
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 22,
            "minzoom": 10,
            "metadata": {},
            "source-layer": "landuse"
        },
        {
            "id": "hillshades",
            "type": "hillshade",
            "paint": {
                "hillshade-accent-color": "#5a5a5a",
                "hillshade-exaggeration": 0.5,
                "hillshade-highlight-color": "#FFFFFF",
                "hillshade-illumination-anchor": "viewport",
                "hillshade-illumination-direction": 335,
                "hillshade-shadow-color": "#5a5a5a"
            },
            "layout": {
                "visibility": "visible"
            },
            "source": "hillshades"
        },
        {
            "id": "contour_index",
            "type": "line",
            "paint": {
                "line-color": "rgba(181, 129, 100, 1)",
                "line-width": 1.3,
                "line-opacity": {
                    "stops": [
                        [
                            7,
                            0.2
                        ],
                        [
                            10,
                            0.6
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    ">",
                    "ele",
                    0
                ],
                [
                    "in",
                    "div",
                    10,
                    5
                ]
            ],
            "layout": {
                "visibility": "none"
            },
            "source": "contours",
            "source-layer": "contour"
        },
        {
            "id": "contour",
            "type": "line",
            "paint": {
                "line-color": "rgba(181, 129, 100, 1)",
                "line-width": 0.8,
                "line-opacity": 0.5
            },
            "filter": [
                "all",
                [
                    "!in",
                    "div",
                    10,
                    5
                ],
                [
                    ">",
                    "ele",
                    0
                ]
            ],
            "layout": {
                "visibility": "none"
            },
            "source": "contours",
            "source-layer": "contour"
        },
        {
            "id": "contour_label",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(181, 129, 100, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(232, 230, 223, 1)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "in",
                    "div",
                    10,
                    5
                ],
                [
                    ">",
                    "ele",
                    0
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            15,
                            9.5
                        ],
                        [
                            20,
                            12
                        ]
                    ]
                },
                "text-field": "{ele}",
                "visibility": "none",
                "text-padding": 10,
                "symbol-placement": "line",
                "symbol-avoid-edges": true,
                "text-allow-overlap": false,
                "text-ignore-placement": false,
                "text-rotation-alignment": "map"
            },
            "source": "contours",
            "metadata": {},
            "source-layer": "contour"
        },
        {
            "id": "waterway_tunnel",
            "type": "line",
            "paint": {
                "line-color": "rgba(103, 166, 196, 1)",
                "line-width": {
                    "base": 1.3,
                    "stops": [
                        [
                            13,
                            0.5
                        ],
                        [
                            20,
                            6
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    4
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-cap": "round"
            },
            "source": "openmaptiles",
            "minzoom": 14,
            "source-layer": "waterway"
        },
        {
            "id": "waterway_river",
            "type": "line",
            "paint": {
                "line-color": {
                    "stops": [
                        [
                            6,
                            "rgba(103, 166, 196, 1)"
                        ],
                        [
                            8,
                            "rgba(196, 229, 236, 1)"
                        ],
                        [
                            9,
                            "rgba(103, 166, 196, 1)"
                        ]
                    ]
                },
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            11,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "river"
                ],
                [
                    "!=",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "!=",
                    "intermittent",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "waterway"
        },
        {
            "id": "waterway_river_intermittent",
            "type": "line",
            "paint": {
                "line-color": {
                    "stops": [
                        [
                            6,
                            "rgba(103, 166, 196, 1)"
                        ],
                        [
                            8,
                            "rgba(196, 229, 236, 1)"
                        ],
                        [
                            9,
                            "rgba(103, 166, 196, 1)"
                        ]
                    ]
                },
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            11,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    1.6
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "river"
                ],
                [
                    "!=",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "==",
                    "intermittent",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "waterway"
        },
        {
            "id": "waterway_other",
            "type": "line",
            "paint": {
                "line-color": "rgba(103, 166, 196, 1)",
                "line-width": {
                    "base": 1.3,
                    "stops": [
                        [
                            13,
                            0.5
                        ],
                        [
                            20,
                            12
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!=",
                    "class",
                    "river"
                ],
                [
                    "!=",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "!=",
                    "intermittent",
                    1
                ]
            ],
            "layout": {
                "line-cap": "butt",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "waterway"
        },
        {
            "id": "waterway_other_intermittent",
            "type": "line",
            "paint": {
                "line-color": "rgba(103, 166, 196, 1)",
                "line-width": {
                    "base": 1.3,
                    "stops": [
                        [
                            13,
                            0.5
                        ],
                        [
                            20,
                            12
                        ]
                    ]
                },
                "line-dasharray": [
                    4,
                    3
                ]
            },
            "filter": [
                "all",
                [
                    "!=",
                    "class",
                    "river"
                ],
                [
                    "!=",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "==",
                    "intermittent",
                    1
                ]
            ],
            "layout": {
                "line-cap": "butt",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "waterway"
        },
        {
            "id": "water",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(103, 166, 196, 1)"
            },
            "filter": [
                "all",
                [
                    "!=",
                    "intermittent",
                    1
                ],
                [
                    "!=",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "water"
        },
        {
            "id": "water_intermittent",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(163, 201, 220, 1)",
                "fill-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "intermittent",
                    1
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "water"
        },
        {
            "id": "aeroway_fill",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(229, 228, 224, 1)",
                "fill-opacity": 0.7
            },
            "filter": [
                "==",
                "$type",
                "Polygon"
            ],
            "source": "openmaptiles",
            "minzoom": 11,
            "metadata": {},
            "source-layer": "aeroway"
        },
        {
            "id": "aeroway_runway",
            "type": "line",
            "paint": {
                "line-color": "#f0ede9",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            11,
                            3
                        ],
                        [
                            20,
                            16
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "==",
                    "class",
                    "runway"
                ]
            ],
            "source": "openmaptiles",
            "minzoom": 11,
            "metadata": {},
            "source-layer": "aeroway"
        },
        {
            "id": "aeroway_taxiway",
            "type": "line",
            "paint": {
                "line-color": "#f0ede9",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            11,
                            0.5
                        ],
                        [
                            20,
                            6
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "==",
                    "class",
                    "taxiway"
                ]
            ],
            "source": "openmaptiles",
            "minzoom": 11,
            "metadata": {},
            "source-layer": "aeroway"
        },
        {
            "id": "ferry",
            "type": "line",
            "paint": {
                "line-color": "rgba(47, 136, 183, 1)",
                "line-width": 1.1,
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "ferry"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_motorway_link_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            1
                        ],
                        [
                            13,
                            3
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                },
                "line-opacity": 1,
                "line-dasharray": [
                    0.5,
                    0.25
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "ramp",
                    1
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_service_track_casing",
            "type": "line",
            "paint": {
                "line-color": "#cfcdca",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15,
                            1
                        ],
                        [
                            16,
                            4
                        ],
                        [
                            20,
                            11
                        ]
                    ]
                },
                "line-dasharray": [
                    0.5,
                    0.25
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "service",
                    "track"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_link_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            1
                        ],
                        [
                            13,
                            3
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "ramp",
                    "1"
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_street_casing",
            "type": "line",
            "paint": {
                "line-color": "#cfcdca",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            0.5
                        ],
                        [
                            13,
                            1
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                },
                "line-opacity": {
                    "stops": [
                        [
                            12,
                            0
                        ],
                        [
                            12.5,
                            1
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "street",
                    "street_limited"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_secondary_tertiary_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            8,
                            1.5
                        ],
                        [
                            20,
                            21
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "secondary",
                    "tertiary"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_trunk_primary_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.7
                        ],
                        [
                            7,
                            1.75
                        ],
                        [
                            20,
                            22
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "primary",
                    "trunk"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_motorway_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.7
                        ],
                        [
                            7,
                            1.75
                        ],
                        [
                            20,
                            22
                        ]
                    ]
                },
                "line-dasharray": [
                    0.5,
                    0.25
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_path_pedestrian",
            "type": "line",
            "paint": {
                "line-color": "hsl(0, 0%, 100%)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            14,
                            0.5
                        ],
                        [
                            20,
                            10
                        ]
                    ]
                },
                "line-dasharray": [
                    1,
                    0.75
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "path",
                    "pedestrian"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_motorway_link",
            "type": "line",
            "paint": {
                "line-color": "#fc8",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12.5,
                            0
                        ],
                        [
                            13,
                            1.5
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway_link"
                ],
                [
                    "==",
                    "ramp",
                    1
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_service_track",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15.5,
                            0
                        ],
                        [
                            16,
                            2
                        ],
                        [
                            20,
                            7.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "service",
                    "track"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_service_track_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15.5,
                            0
                        ],
                        [
                            16,
                            2
                        ],
                        [
                            20,
                            7.5
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "service_construction",
                    "track_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_link",
            "type": "line",
            "paint": {
                "line-color": "#fff4c6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12.5,
                            0
                        ],
                        [
                            13,
                            1.5
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "ramp",
                    "1"
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_minor",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            13.5,
                            0
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "minor"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_minor_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            13.5,
                            0
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                },
                "line-opacity": 1,
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "minor_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_secondary_tertiary",
            "type": "line",
            "paint": {
                "line-color": "#fff4c6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            7,
                            0.5
                        ],
                        [
                            20,
                            12
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "secondary",
                    "tertiary"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_secondary_tertiary_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            8,
                            0.5
                        ],
                        [
                            20,
                            13
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "secondary_construction",
                    "tertiary_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_trunk_primary",
            "type": "line",
            "paint": {
                "line-color": "#fff4c6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "primary",
                    "trunk"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_trunk_primary_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff4c6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "primary_construction",
                    "trunk_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_motorway",
            "type": "line",
            "paint": {
                "line-color": "#ffdaa6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_motorway_construction",
            "type": "line",
            "paint": {
                "line-color": "#ffdaa6",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway_construction"
                ],
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_major_rail",
            "type": "line",
            "paint": {
                "line-color": "#bbb",
                "line-width": {
                    "base": 1.4,
                    "stops": [
                        [
                            14,
                            0.4
                        ],
                        [
                            15,
                            0.75
                        ],
                        [
                            20,
                            2
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "rail"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "tunnel_major_rail_hatching",
            "type": "line",
            "paint": {
                "line-color": "#bbb",
                "line-width": {
                    "base": 1.4,
                    "stops": [
                        [
                            14.5,
                            0
                        ],
                        [
                            15,
                            3
                        ],
                        [
                            20,
                            8
                        ]
                    ]
                },
                "line-dasharray": [
                    0.2,
                    8
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "rail"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_area_bridge",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(246, 241, 229, 0.6)",
                "fill-antialias": true
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Polygon"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_area_pier",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(232, 230, 223, 1)",
                "fill-antialias": true
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Polygon"
                ],
                [
                    "==",
                    "class",
                    "pier"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_pier",
            "type": "line",
            "paint": {
                "line-color": "rgba(232, 230, 223, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15,
                            1
                        ],
                        [
                            17,
                            4
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "in",
                    "class",
                    "pier"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_area_pattern",
            "type": "fill",
            "paint": {
                "fill-pattern": "pedestrian_polygon"
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Polygon"
                ],
                [
                    "!=",
                    "brunnel",
                    "bridge"
                ],
                [
                    "!in",
                    "class",
                    "bridge",
                    "pier"
                ]
            ],
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_motorway_link_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            1
                        ],
                        [
                            13,
                            3
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "ramp",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 12,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_service_track_casing-1",
            "type": "line",
            "paint": {
                "line-color": "rgba(165, 165, 165, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15,
                            1.3
                        ],
                        [
                            16,
                            4
                        ],
                        [
                            20,
                            11
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "track"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 13,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_service_track_casing",
            "type": "line",
            "paint": {
                "line-color": "rgba(181, 178, 175, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15,
                            1
                        ],
                        [
                            16,
                            4
                        ],
                        [
                            20,
                            11
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "service"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_link_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            1
                        ],
                        [
                            13,
                            3
                        ],
                        [
                            14,
                            6
                        ],
                        [
                            20,
                            23
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "ramp",
                    1
                ],
                [
                    "!in",
                    "class",
                    "pedestrian",
                    "path",
                    "track",
                    "service"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 13,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_minor_casing",
            "type": "line",
            "paint": {
                "line-color": "rgba(181, 178, 175, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            0.5
                        ],
                        [
                            13,
                            1
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            20
                        ]
                    ]
                },
                "line-opacity": {
                    "stops": [
                        [
                            12,
                            0
                        ],
                        [
                            12.5,
                            1
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "minor"
                ],
                [
                    "!=",
                    "ramp",
                    "1"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_secondary_tertiary_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            8,
                            1.5
                        ],
                        [
                            20,
                            21
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "secondary",
                    "tertiary"
                ],
                [
                    "!=",
                    "ramp",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_path_pedestrian",
            "type": "line",
            "paint": {
                "line-color": "rgba(169, 169, 169, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            14,
                            1
                        ],
                        [
                            20,
                            6
                        ]
                    ]
                },
                "line-dasharray": [
                    3,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "path",
                    "pedestrian"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 13,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_trunk_primary_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.7
                        ],
                        [
                            7,
                            1.75
                        ],
                        [
                            20,
                            23
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "primary",
                    "trunk"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_motorway_casing",
            "type": "line",
            "paint": {
                "line-color": "rgba(230, 144, 81, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.7
                        ],
                        [
                            7,
                            1.75
                        ],
                        [
                            20,
                            22
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "!=",
                    "ramp",
                    "1"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 5,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_minor",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            13.5,
                            0
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "all",
                    [
                        "!in",
                        "brunnel",
                        "bridge",
                        "tunnel"
                    ],
                    [
                        "in",
                        "class",
                        "minor"
                    ]
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_minor_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            13.5,
                            0
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-opacity": 1,
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "all",
                    [
                        "!in",
                        "brunnel",
                        "bridge",
                        "tunnel"
                    ],
                    [
                        "in",
                        "class",
                        "minor_construction"
                    ]
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_service_track",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15.5,
                            0
                        ],
                        [
                            16,
                            2
                        ],
                        [
                            20,
                            7.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "service",
                    "track"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_service_track_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15.5,
                            0
                        ],
                        [
                            16,
                            2
                        ],
                        [
                            20,
                            7.5
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "service_construction",
                    "track_construction"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_link",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12.5,
                            0
                        ],
                        [
                            13,
                            1.5
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "ramp",
                    1
                ],
                [
                    "!in",
                    "class",
                    "pedestrian",
                    "path",
                    "track",
                    "service"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 13,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_motorway_link",
            "type": "line",
            "paint": {
                "line-color": "#fc8",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12.5,
                            0
                        ],
                        [
                            13,
                            1.5
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            19
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "ramp",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 12,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_secondary_tertiary",
            "type": "line",
            "paint": {
                "line-color": "rgba(255, 238, 170, 1)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            8,
                            0.5
                        ],
                        [
                            20,
                            17
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "secondary",
                    "tertiary"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_secondary_tertiary_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            8,
                            0.5
                        ],
                        [
                            20,
                            13
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "secondary_construction",
                    "tertiary_construction"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_trunk_primary",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            19
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "in",
                    "class",
                    "primary",
                    "trunk"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_trunk_primary_construction",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "!=",
                    "ramp",
                    1
                ],
                [
                    "in",
                    "class",
                    "primary_construction",
                    "trunk_construction"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_motorway",
            "type": "line",
            "paint": {
                "line-color": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            "rgba(251, 183, 100, 1)"
                        ],
                        [
                            6,
                            "rgba(255, 204, 136, 1)"
                        ]
                    ]
                },
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "!=",
                    "ramp",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 5,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_motorway_construction",
            "type": "line",
            "paint": {
                "line-color": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            "hsl(26, 87%, 62%)"
                        ],
                        [
                            6,
                            "#fc8"
                        ]
                    ]
                },
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "motorway_construction"
                ],
                [
                    "!=",
                    "ramp",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 5,
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_major_rail",
            "type": "line",
            "paint": {
                "line-color": "#bbb",
                "line-width": {
                    "base": 1.4,
                    "stops": [
                        [
                            14,
                            0.4
                        ],
                        [
                            15,
                            0.75
                        ],
                        [
                            20,
                            2
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "rail"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "road_major_rail_hatching",
            "type": "line",
            "paint": {
                "line-color": "#bbb",
                "line-width": {
                    "base": 1.4,
                    "stops": [
                        [
                            14.5,
                            0
                        ],
                        [
                            15,
                            3
                        ],
                        [
                            20,
                            8
                        ]
                    ]
                },
                "line-dasharray": [
                    0.2,
                    8
                ]
            },
            "filter": [
                "all",
                [
                    "!in",
                    "brunnel",
                    "bridge",
                    "tunnel"
                ],
                [
                    "==",
                    "class",
                    "rail"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "building",
            "type": "fill",
            "paint": {
                "fill-color": "rgba(202, 197, 189, 1)",
                "fill-antialias": true,
                "fill-outline-color": "rgba(190, 185, 176, 1)"
            },
            "layout": {
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 24,
            "minzoom": 12,
            "source-layer": "building"
        },
        {
            "id": "building-3d",
            "type": "fill-extrusion",
            "paint": {
                "fill-extrusion-color": "rgba(171, 165, 156, 1)",
                "fill-extrusion-height": [
                    "interpolate",
                    [
                        "linear"
                    ],
                    [
                        "zoom"
                    ],
                    15,
                    0,
                    15.05,
                    [
                        "get",
                        "render_height"
                    ]
                ],
                "fill-extrusion-base": [
                    "interpolate",
                    [
                        "linear"
                    ],
                    [
                        "zoom"
                    ],
                    15,
                    0,
                    15.05,
                    [
                        "get",
                        "render_min_height"
                    ]
                ],
                "fill-extrusion-opacity": 0.6
            },
            "layout": {
                "visibility": "none"
            },
            "source": "openmaptiles",
            "minzoom": 14,
            "metadata": {},
            "source-layer": "building"
        },
        {
            "id": "bridge_motorway_link_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            1
                        ],
                        [
                            13,
                            3
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway_link"
                ],
                [
                    "==",
                    "ramp",
                    1
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_service_track_casing",
            "type": "line",
            "paint": {
                "line-color": "#cfcdca",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15,
                            1
                        ],
                        [
                            16,
                            4
                        ],
                        [
                            20,
                            11
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "service",
                    "track"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_link_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            1
                        ],
                        [
                            13,
                            3
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            15
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "link"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_street_casing",
            "type": "line",
            "paint": {
                "line-color": "hsl(36, 6%, 74%)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            0.5
                        ],
                        [
                            13,
                            1
                        ],
                        [
                            14,
                            4
                        ],
                        [
                            20,
                            25
                        ]
                    ]
                },
                "line-opacity": {
                    "stops": [
                        [
                            12,
                            0
                        ],
                        [
                            12.5,
                            1
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "street",
                    "street_limited"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_path_pedestrian_casing",
            "type": "line",
            "paint": {
                "line-color": "hsl(35, 6%, 80%)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            14,
                            1.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    1,
                    0
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "path",
                    "pedestrian"
                ]
            ],
            "layout": {
                "line-join": "miter",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_secondary_tertiary_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            8,
                            1.5
                        ],
                        [
                            20,
                            21
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "secondary",
                    "tertiary"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_trunk_primary_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.7
                        ],
                        [
                            7,
                            1.75
                        ],
                        [
                            20,
                            22
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "primary",
                    "trunk"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_motorway_casing",
            "type": "line",
            "paint": {
                "line-color": "#e9ac77",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0.4
                        ],
                        [
                            6,
                            0.7
                        ],
                        [
                            7,
                            1.75
                        ],
                        [
                            20,
                            22
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_path_pedestrian",
            "type": "line",
            "paint": {
                "line-color": "hsl(0, 0%, 100%)",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            14,
                            0.5
                        ],
                        [
                            20,
                            10
                        ]
                    ]
                },
                "line-dasharray": [
                    1,
                    0.3
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "path",
                    "pedestrian"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_motorway_link",
            "type": "line",
            "paint": {
                "line-color": "#fc8",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12.5,
                            0
                        ],
                        [
                            13,
                            1.5
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway_link"
                ],
                [
                    "==",
                    "ramp",
                    1
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_service_track",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15.5,
                            0
                        ],
                        [
                            16,
                            2
                        ],
                        [
                            20,
                            7.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "service",
                    "track"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_service_track_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            15.5,
                            0
                        ],
                        [
                            16,
                            2
                        ],
                        [
                            20,
                            7.5
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "service_construction",
                    "track_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_link",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            12.5,
                            0
                        ],
                        [
                            13,
                            1.5
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            11.5
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "link"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_minor",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            13.5,
                            0
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-opacity": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "minor"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_minor_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            13.5,
                            0
                        ],
                        [
                            14,
                            2.5
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-opacity": 1,
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "minor_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_secondary_tertiary",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            7,
                            0.5
                        ],
                        [
                            20,
                            12
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "secondary",
                    "tertiary"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_secondary_tertiary_construction",
            "type": "line",
            "paint": {
                "line-color": "#fff",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            6.5,
                            0
                        ],
                        [
                            8,
                            0.5
                        ],
                        [
                            20,
                            13
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "secondary_construction",
                    "tertiary_construction"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_trunk_primary",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "primary",
                    "trunk"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_trunk_primary_construction",
            "type": "line",
            "paint": {
                "line-color": "#fea",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "in",
                    "class",
                    "primary_construction",
                    "trunk_construction"
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_motorway",
            "type": "line",
            "paint": {
                "line-color": "#fc8",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_motorway_construction",
            "type": "line",
            "paint": {
                "line-color": "#fc8",
                "line-width": {
                    "base": 1.2,
                    "stops": [
                        [
                            5,
                            0
                        ],
                        [
                            7,
                            1
                        ],
                        [
                            20,
                            18
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    2
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "motorway_construction"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ],
                [
                    "!=",
                    "ramp",
                    1
                ]
            ],
            "layout": {
                "line-join": "round"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_major_rail",
            "type": "line",
            "paint": {
                "line-color": "#bbb",
                "line-width": {
                    "base": 1.4,
                    "stops": [
                        [
                            14,
                            0.4
                        ],
                        [
                            15,
                            0.75
                        ],
                        [
                            20,
                            2
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "rail"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "bridge_major_rail_hatching",
            "type": "line",
            "paint": {
                "line-color": "#bbb",
                "line-width": {
                    "base": 1.4,
                    "stops": [
                        [
                            14.5,
                            0
                        ],
                        [
                            15,
                            3
                        ],
                        [
                            20,
                            8
                        ]
                    ]
                },
                "line-dasharray": [
                    0.2,
                    8
                ]
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "rail"
                ],
                [
                    "==",
                    "brunnel",
                    "bridge"
                ]
            ],
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation"
        },
        {
            "id": "cablecar",
            "type": "line",
            "paint": {
                "line-color": "rgba(153, 153, 153, 1)",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            11,
                            1
                        ],
                        [
                            19,
                            2.5
                        ]
                    ]
                }
            },
            "filter": [
                "==",
                "class",
                "aerialway"
            ],
            "layout": {
                "line-cap": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 24,
            "minzoom": 13,
            "source-layer": "transportation"
        },
        {
            "id": "cablecar-dash",
            "type": "line",
            "paint": {
                "line-color": "hsl(0, 0%, 60%)",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            11,
                            3
                        ],
                        [
                            19,
                            5.5
                        ]
                    ]
                },
                "line-dasharray": [
                    2,
                    3
                ]
            },
            "filter": [
                "==",
                "class",
                "aerialway"
            ],
            "layout": {
                "line-cap": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 24,
            "minzoom": 13,
            "source-layer": "transportation"
        },
        {
            "id": "boundary_3",
            "type": "line",
            "paint": {
                "line-color": "#9e9cab",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            4,
                            0.4
                        ],
                        [
                            5,
                            1
                        ],
                        [
                            12,
                            1.8
                        ]
                    ]
                },
                "line-dasharray": [
                    5,
                    1
                ]
            },
            "filter": [
                "all",
                [
                    "in",
                    "admin_level",
                    3,
                    4
                ],
                [
                    "==",
                    "maritime",
                    0
                ]
            ],
            "layout": {
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 2,
            "metadata": {},
            "source-layer": "boundary"
        },
        {
            "id": "boundary_2_maritime",
            "type": "line",
            "paint": {
                "line-color": "rgba(77, 144, 175, 1)",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            5,
                            1.2
                        ],
                        [
                            12,
                            3
                        ]
                    ]
                },
                "line-opacity": {
                    "base": 1,
                    "stops": [
                        [
                            4,
                            0
                        ],
                        [
                            6,
                            1
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "admin_level",
                    2
                ],
                [
                    "==",
                    "maritime",
                    1
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "boundary"
        },
        {
            "id": "boundary_2_z0-4",
            "type": "line",
            "paint": {
                "line-color": "rgba(136, 136, 136, 1)",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.2
                        ],
                        [
                            12,
                            3
                        ]
                    ]
                },
                "line-opacity": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            0.6
                        ],
                        [
                            4,
                            0.9
                        ],
                        [
                            12,
                            0.9
                        ],
                        [
                            18,
                            0.6
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "admin_level",
                    2
                ],
                [
                    "==",
                    "maritime",
                    0
                ],
                [
                    "!has",
                    "claimed_by"
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "maxzoom": 5,
            "metadata": {},
            "source-layer": "boundary"
        },
        {
            "id": "boundary_2_z5-",
            "type": "line",
            "paint": {
                "line-color": "rgba(136, 136, 136, 1)",
                "line-width": {
                    "base": 1,
                    "stops": [
                        [
                            3,
                            1
                        ],
                        [
                            5,
                            1.2
                        ],
                        [
                            12,
                            3
                        ]
                    ]
                },
                "line-opacity": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            0.6
                        ],
                        [
                            4,
                            0.9
                        ],
                        [
                            12,
                            0.9
                        ],
                        [
                            18,
                            0.6
                        ]
                    ]
                }
            },
            "filter": [
                "all",
                [
                    "==",
                    "admin_level",
                    2
                ],
                [
                    "==",
                    "maritime",
                    0
                ]
            ],
            "layout": {
                "line-cap": "round",
                "line-join": "round",
                "visibility": "visible"
            },
            "source": "openmaptiles",
            "minzoom": 5,
            "metadata": {},
            "source-layer": "boundary"
        },
        {
            "id": "water_name_line",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(8, 86, 125, 1)",
                "text-halo-color": "rgba(255, 255, 255, 0.45)",
                "text-halo-width": 1.5
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Regular",
                    "Noto Sans Regular"
                ],
                "text-size": 12,
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 5,
                "symbol-placement": "line"
            },
            "source": "openmaptiles",
            "minzoom": 0,
            "metadata": {},
            "source-layer": "water_name"
        },
        {
            "id": "water_name_point-lake",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(8, 86, 125, 1)",
                "text-halo-color": "rgba(255, 255, 255, 0.45)",
                "text-halo-width": 1.5
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Point"
                ],
                [
                    "in",
                    "class",
                    "lake"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": 12,
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 5
            },
            "source": "openmaptiles",
            "minzoom": 0,
            "metadata": {},
            "source-layer": "water_name"
        },
        {
            "id": "waterway-name",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(8, 86, 125, 1)",
                "text-halo-color": "rgba(255, 255, 255, 0.45)",
                "text-halo-width": 2
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "has",
                    "name"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": 11,
                "text-field": "{name}",
                "visibility": "visible",
                "text-offset": [
                    0,
                    -0.8
                ],
                "symbol-spacing": 350,
                "text-max-width": 5,
                "symbol-placement": "line",
                "text-letter-spacing": 0.1,
                "text-rotation-alignment": "map"
            },
            "source": "openmaptiles",
            "minzoom": 13,
            "source-layer": "waterway"
        },
        {
            "id": "water_name_point",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(8, 86, 125, 1)",
                "text-halo-color": "rgba(255, 255, 255, 0.45)",
                "text-halo-width": 2
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Point"
                ],
                [
                    "!=",
                    "class",
                    "lake"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": 13,
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 5
            },
            "source": "openmaptiles",
            "minzoom": 0,
            "metadata": {},
            "source-layer": "water_name"
        },
        {
            "id": "road_label_track",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(89, 105, 63, 1)",
                "text-halo-blur": 0.5,
                "text-halo-color": "rgba(255,255,255,0.5)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "track"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Regular",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            13,
                            12
                        ],
                        [
                            14,
                            13
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-anchor": "center",
                "text-offset": [
                    0,
                    0.15
                ],
                "symbol-placement": "line"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation_name"
        },
        {
            "id": "road_label",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(99, 94, 84, 1)",
                "text-halo-blur": 0.5,
                "text-halo-color": "rgba(255,255,255,0.5)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "!=",
                    "class",
                    "track"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Regular",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1,
                    "stops": [
                        [
                            13,
                            10
                        ],
                        [
                            14,
                            12
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-anchor": "center",
                "text-offset": [
                    0,
                    0.15
                ],
                "symbol-placement": "line"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "transportation_name"
        },
        {
            "id": "highway-shield",
            "type": "symbol",
            "paint": {},
            "filter": [
                "all",
                [
                    "<=",
                    "ref_length",
                    6
                ],
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "!in",
                    "network",
                    "us-interstate",
                    "us-highway",
                    "us-state"
                ]
            ],
            "layout": {
                "icon-size": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-size": 10,
                "icon-image": "road_{ref_length}",
                "text-field": "{ref}",
                "visibility": "none",
                "symbol-spacing": 200,
                "symbol-placement": {
                    "base": 1,
                    "stops": [
                        [
                            10,
                            "point"
                        ],
                        [
                            11,
                            "line"
                        ]
                    ]
                },
                "icon-rotation-alignment": "viewport",
                "text-rotation-alignment": "viewport"
            },
            "source": "openmaptiles",
            "minzoom": 8,
            "source-layer": "transportation_name"
        },
        {
            "id": "highway-shield-us-interstate",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(0, 0, 0, 1)"
            },
            "filter": [
                "all",
                [
                    "<=",
                    "ref_length",
                    6
                ],
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "in",
                    "network",
                    "us-interstate"
                ]
            ],
            "layout": {
                "icon-size": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-size": 10,
                "icon-image": "{network}_{ref_length}",
                "text-field": "{ref}",
                "visibility": "none",
                "symbol-spacing": 200,
                "symbol-placement": {
                    "base": 1,
                    "stops": [
                        [
                            7,
                            "point"
                        ],
                        [
                            7,
                            "line"
                        ],
                        [
                            8,
                            "line"
                        ]
                    ]
                },
                "icon-rotation-alignment": "viewport",
                "text-rotation-alignment": "viewport"
            },
            "source": "openmaptiles",
            "minzoom": 7,
            "source-layer": "transportation_name"
        },
        {
            "id": "highway-shield-us-other",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(0, 0, 0, 1)"
            },
            "filter": [
                "all",
                [
                    "<=",
                    "ref_length",
                    6
                ],
                [
                    "==",
                    "$type",
                    "LineString"
                ],
                [
                    "in",
                    "network",
                    "us-highway",
                    "us-state"
                ]
            ],
            "layout": {
                "icon-size": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-size": 10,
                "icon-image": "{network}_{ref_length}",
                "text-field": "{ref}",
                "visibility": "none",
                "symbol-spacing": 200,
                "symbol-placement": {
                    "base": 1,
                    "stops": [
                        [
                            10,
                            "point"
                        ],
                        [
                            11,
                            "line"
                        ]
                    ]
                },
                "icon-rotation-alignment": "viewport",
                "text-rotation-alignment": "viewport"
            },
            "source": "openmaptiles",
            "minzoom": 9,
            "source-layer": "transportation_name"
        },
        {
            "id": "place_other",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(47, 49, 60, 1)",
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 1.2
            },
            "filter": [
                "all",
                [
                    "in",
                    "class",
                    "hamlet",
                    "island",
                    "neighbourhood",
                    "suburb"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Medium",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1.2,
                    "stops": [
                        [
                            12,
                            10
                        ],
                        [
                            15,
                            14
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 9,
                "text-transform": "uppercase",
                "text-letter-spacing": 0.1
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "mountain_peak",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(155, 112, 87, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(255,255,255,1)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Point"
                ],
                [
                    "==",
                    "rank",
                    1
                ],
                [
                    "==",
                    "class",
                    "peak"
                ]
            ],
            "layout": {
                "icon-size": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-size": 11,
                "text-field": "{name}\n{ele} m\n▲",
                "visibility": "visible",
                "text-anchor": "bottom",
                "text-offset": [
                    0,
                    0.5
                ],
                "text-max-width": {
                    "stops": [
                        [
                            6,
                            8
                        ],
                        [
                            10,
                            8
                        ]
                    ]
                }
            },
            "source": "openmaptiles",
            "maxzoom": 24,
            "minzoom": 9,
            "source-layer": "mountain_peak"
        },
        {
            "id": "mountain_volcano",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(219, 76, 10, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(255,255,255,1)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "$type",
                    "Point"
                ],
                [
                    "==",
                    "rank",
                    1
                ],
                [
                    "==",
                    "class",
                    "volcano"
                ]
            ],
            "layout": {
                "icon-size": 1,
                "text-font": [
                    "Noto Sans Regular"
                ],
                "text-size": 11,
                "text-field": "{name}\n{ele} m\n▲",
                "visibility": "visible",
                "text-anchor": "bottom",
                "text-offset": [
                    0,
                    0.5
                ],
                "text-max-width": {
                    "stops": [
                        [
                            6,
                            8
                        ],
                        [
                            10,
                            8
                        ]
                    ]
                }
            },
            "source": "openmaptiles",
            "maxzoom": 24,
            "minzoom": 9,
            "source-layer": "mountain_peak"
        },
        {
            "id": "place_village",
            "type": "symbol",
            "paint": {
                "text-color": "#333",
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 1.2
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "village"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Regular",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1.2,
                    "stops": [
                        [
                            10,
                            12
                        ],
                        [
                            15,
                            22
                        ]
                    ]
                },
                "text-field": "{name}",
                "text-max-width": 8
            },
            "source": "openmaptiles",
            "maxzoom": 14,
            "minzoom": 10,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "place_town",
            "type": "symbol",
            "paint": {
                "text-color": "#333",
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 1.2
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "town"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Regular",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1.2,
                    "stops": [
                        [
                            7,
                            8
                        ],
                        [
                            11,
                            20
                        ]
                    ]
                },
                "icon-image": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            "dot_9"
                        ],
                        [
                            10,
                            ""
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-anchor": {
                    "stops": [
                        [
                            6,
                            "bottom"
                        ],
                        [
                            10,
                            "center"
                        ]
                    ]
                },
                "text-offset": [
                    0,
                    0
                ],
                "text-max-width": 8
            },
            "source": "openmaptiles",
            "maxzoom": 14,
            "minzoom": 0,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "place_city",
            "type": "symbol",
            "paint": {
                "text-color": "#333",
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 1.2
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "city"
                ],
                [
                    "<=",
                    "rank",
                    8
                ],
                [
                    "!=",
                    "capital",
                    2
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Medium",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1.2,
                    "stops": [
                        [
                            7,
                            14
                        ],
                        [
                            11,
                            24
                        ]
                    ]
                },
                "icon-image": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            "dot_9"
                        ],
                        [
                            10,
                            ""
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-anchor": {
                    "stops": [
                        [
                            6,
                            "bottom"
                        ],
                        [
                            10,
                            "center"
                        ]
                    ]
                },
                "text-offset": [
                    0,
                    0
                ],
                "icon-optional": false,
                "text-max-width": 8,
                "icon-allow-overlap": false
            },
            "source": "openmaptiles",
            "maxzoom": 12,
            "minzoom": 5,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "place_city_capital",
            "type": "symbol",
            "paint": {
                "text-color": "#333",
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 1.2
            },
            "filter": [
                "all",
                [
                    "==",
                    "capital",
                    2
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Medium",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "base": 1.2,
                    "stops": [
                        [
                            7,
                            18
                        ],
                        [
                            11,
                            28
                        ]
                    ]
                },
                "icon-image": {
                    "base": 1,
                    "stops": [
                        [
                            0,
                            "dot_11"
                        ],
                        [
                            8,
                            ""
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-anchor": {
                    "stops": [
                        [
                            6,
                            "bottom"
                        ],
                        [
                            8,
                            "center"
                        ]
                    ]
                },
                "text-offset": [
                    0,
                    0
                ],
                "icon-optional": false,
                "text-max-width": 8,
                "icon-allow-overlap": false
            },
            "source": "openmaptiles",
            "maxzoom": 12,
            "minzoom": 5,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "place_state",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(94, 95, 101, 1)",
                "text-halo-color": "rgba(255,255,255,0.7)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "state"
                ]
            ],
            "layout": {
                "text-font": [
                    "Roboto Medium",
                    "Noto Sans Regular"
                ],
                "text-size": {
                    "stops": [
                        [
                            4,
                            11
                        ],
                        [
                            6,
                            15
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-transform": "uppercase"
            },
            "source": "openmaptiles",
            "maxzoom": 8,
            "minzoom": 3,
            "source-layer": "place"
        },
        {
            "id": "country_other",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(47, 49, 60, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 0.7
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "country"
                ],
                [
                    "!has",
                    "iso_a2"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": {
                    "stops": [
                        [
                            3,
                            9
                        ],
                        [
                            7,
                            15
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 6.25,
                "text-transform": "none"
            },
            "source": "openmaptiles",
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "country_3",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(47, 49, 60, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 0.7
            },
            "filter": [
                "all",
                [
                    ">=",
                    "rank",
                    3
                ],
                [
                    "==",
                    "class",
                    "country"
                ],
                [
                    "has",
                    "iso_a2"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": {
                    "stops": [
                        [
                            3,
                            11
                        ],
                        [
                            7,
                            17
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 6.25,
                "text-transform": "none"
            },
            "source": "openmaptiles",
            "maxzoom": 8,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "country_2",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(47, 49, 60, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 0.7
            },
            "filter": [
                "all",
                [
                    "==",
                    "rank",
                    2
                ],
                [
                    "==",
                    "class",
                    "country"
                ],
                [
                    "has",
                    "iso_a2"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": {
                    "stops": [
                        [
                            2,
                            11
                        ],
                        [
                            5,
                            17
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 6.25,
                "text-transform": "none"
            },
            "source": "openmaptiles",
            "maxzoom": 8,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "country_1",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(47, 49, 60, 1)",
                "text-halo-blur": 1,
                "text-halo-color": "rgba(255,255,255,0.8)",
                "text-halo-width": 0.7
            },
            "filter": [
                "all",
                [
                    "==",
                    "rank",
                    1
                ],
                [
                    "==",
                    "class",
                    "country"
                ],
                [
                    "has",
                    "iso_a2"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Italic"
                ],
                "text-size": {
                    "stops": [
                        [
                            1,
                            11
                        ],
                        [
                            4,
                            17
                        ]
                    ]
                },
                "text-field": "{name}",
                "visibility": "visible",
                "text-max-width": 6.25,
                "text-transform": "none"
            },
            "source": "openmaptiles",
            "maxzoom": 8,
            "metadata": {},
            "source-layer": "place"
        },
        {
            "id": "continent",
            "type": "symbol",
            "paint": {
                "text-color": "rgba(59, 60, 58, 1)",
                "text-halo-color": "rgba(255,255,255,0.7)",
                "text-halo-width": 1
            },
            "filter": [
                "all",
                [
                    "==",
                    "class",
                    "continent"
                ]
            ],
            "layout": {
                "text-font": [
                    "Noto Sans Bold"
                ],
                "text-size": 13,
                "text-field": "{name}",
                "visibility": "visible",
                "text-justify": "center",
                "text-transform": "uppercase"
            },
            "source": "openmaptiles",
            "maxzoom": 1,
            "metadata": {},
            "source-layer": "place"
        }
    ],
    "sprite": "https://api.maptiler.com/maps/topo/sprite",
    "bearing": 0,
    "sources": {
        openmaptiles: {
            type: 'vector',
            format: 'pbf',
            maxzoom: 14,
            minzoom: 0,
            tiles: [MOBILE ? 'http://127.0.0.1:8080?source=data&x={x}&y={y}&z={z}' : 'http://0.0.0.0:8080/data/full/{z}/{x}/{y}.pbf']
        },
        hillshades: {
            type: 'raster-dem',
            tiles: [MOBILE ? 'http://127.0.0.1:8080?source=height&x={x}&y={y}&z={z}' : 'http://0.0.0.0:8080/data/elevation_25m/{z}/{x}/{y}.webp'],
            tileSize: 256,
            maxzoom: 12,
            minzoom: 5
        },
        terrain: {
            type: 'raster-dem',
            tiles: [MOBILE ? 'http://127.0.0.1:8080?source=height&x={x}&y={y}&z={z}' : 'http://0.0.0.0:8080/data/elevation_25m/{z}/{x}/{y}.webp'],
            tileSize: 256,
            maxzoom: 12,
            minzoom: 5
        },
        'contours': {
            type: 'vector',
            format: 'pbf',
            maxzoom: 14,
            minzoom: 9,
            tiles: [MOBILE ? 'http://127.0.0.1:8080?source=data&x={x}&y={y}&z={z}' : 'http://0.0.0.0:8080/data/contours/{z}/{x}/{y}.pbf']
        }
    },
    "version": 8,
    "metadata": {
        "mapbox:type": "template",
        "openmaptiles:version": "3.x"
    }
}