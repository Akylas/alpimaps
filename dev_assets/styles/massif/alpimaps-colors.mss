/* OpenStreetMap Carto's colours, as Alpimaps' OSM style has them, over Massif's palette. Listed
   BEFORE variables.mss: the compiler keeps the first declaration of a variable. The widths are
   Massif's; only the colours change, ramped over zoom where Alpimaps ramps them. Alpimaps' sheets are
   LESS, where the LAST declaration of a variable wins, so these are its last values. */
@land: #f2efe9;
@background_2: #f2efe9;
@motorway: linear([view::zoom], (7, #e66e89), (10, #e892a2));
@motorway_case: linear([view::zoom], (10, #c24e6b), (12, #dc2a67));
@trunk: linear([view::zoom], (6, #fdb59e), (11, #f9b29c));
@trunk_case: linear([view::zoom], (11, #a07400), (12, #c84e2f));
@primary: linear([view::zoom], (11, #f3ba5c), (12, #fcd6a4));
@primary_case: #a07400;
@secondary: #f7fabf;
@secondary_case: linear([view::zoom], (11, #9eae23), (12, #707d05));
@secondary_low: #f7fabf;
@tertiary: #ffffff;
@tertiary_case: #d8dbe8;
@road: #ffffff;
@road_low: #ffffff;
@road_case: #b3b7cb;
@path: #bb6868;
@path_z16: #bb6868;
@path_case: rgba(255, 255, 255, 0.6);
@cycleway: #0000ff;
@track: #9b7057;
@water: #7fcae0;
@waterway: #7fcae0;
/* Alpimaps' forest: its colour fades in from a third to full, the leaf pattern (osm-rules.mss)
   carrying it closer in */
@wood: #add19e;
@wood_low: rgba(173, 209, 158, 0.3);
@grass: #cdebb0;
/* a park over a wood lets the wood's darker green through, as OSM draws them */
@park: rgba(200, 250, 204, 0.55);
@pitch: #aae0cb;
@farmland: #d8e0bd;
@residential: rgba(189, 191, 179, 0.2);
@commercial: #e8e6df;
@industrial: rgba(214, 216, 225, 0.47);
@cemetery: #d3dcc1;
@sand: #ededcf;
@rock: #eee5dc;
@glacier: #ddecec;
@building_fill: #d8d0c9;
@building_stroke: #c2b5ab;
@building_3d_fill: #d8d0c9;
@parking: rgba(229, 231, 241, 0.8);
@education: #e5deb8;
@hospital: #ead2da;
