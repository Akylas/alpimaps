Map {
	background-color: @background;
  south-pole-color: @background;
  north-pole-color: @water;
	font-directory: url(fonts/);
}
//CARTO Fonts
@mont: "Montserrat Regular", "Noto Sans Regular";
@mont_md: "Montserrat Medium", "Noto Sans Regular";
@mont_bd: "Montserrat SemiBold", "Noto Sans Regular";
@mont_it: "Montserrat Italic", "Noto Sans Regular";
@mont_it_md: "Montserrat Italic", "Noto Sans Regular";
@maki: "maki";
@osm: "osm";
@book-fonts:@mont;
@test:"🠖";

/* ~~~~ CONTENT OF COLORS-DAY ~~~~~

1.BASEMAP
2.BOUNDARY
3.NATURAL
	3.1 Main natural
	3.2 Vegetation
4.LANDUSE
	4.1 Main landuse
	4.2 Aerodrome
  4.3 Barriers
  4.4 Buildings
5.ROADS
  5.1 All roads
	5.2 Bridges
  5.3 Tunnels
  5.4 Piste
  5.5 Transport
 6.LABELS COLORS
  6.1 Main labels
  6.2 Natural labels
  6.3 Place labels
  6.4 Road labels
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

/* 1.BASEMAP */

@white: #ffffff;
@background: #f2efe9;

/* 2.BOUNDARY */

@border_country: #63635C;
@border_region: #73726B;

/* 3.NATURAL */
/* 3.1 Main natural */

@glacier: rgba(236, 252, 251, 0.8);
@water: #8BD3E0;
@river: #36B0BF;
// @wetland: #c9ddd6;
// @beach: #FCEC7E;

/*3.2 Vegeration*/

// @forest: #93AE5E;
// @green0: #CFD5A8;
// @green1: #C6CF93;
// @green2: #BCC87E;
// @green3: #B3C471;
// @green4: #AEC26B;
// @green5: #B0C270;
// @green6: #9EB360;

// @park: #82bf5a;

// @rock: #707070;


/* 4.LANDUSE */
/*4.1 Main landuse*/

// @residential_area: rgb(207, 206, 197);
// @pedestrian_area: #b6b3ab;
// @pedestrian_area_light: #dbd9cb;
// @university: #F8E4BA;
// @hospital: #F8D9D9;
// @industrial: #E4E2EB;
// @sport: #D1CDA7;
// @parking: #F2F2CE;
// @military: #E53935;
// @playground: rgb(229, 147, 53);

/*4.2 Aerodrome*/

// @aerodrome0: #D4BFF2;
// @aerodrome1: #D4BFF2;
// @aerodrome2: #D1C0EB;
// @aerodrome3: #CFC1E8;
// @aerodrome4: #CDC0E3;
// @aerodrome5: #C8BCDE;

/* 4.3 Barriers */
@fence: #999999;

/* 4.4 Buildings */

@building-fill: rgb(219, 217, 203);
// @building_dark: #C2C0B3;
// @building_border: #A1A096;
// @building_dark_border: #9B9A8F;

/* 5.ROADS */
/* 5.1 All roads */

// @trunk: #f9b29c;
// @motorway: #f9b29c;
// @motorway_light: #f5977a;
// @trunk: #f9b29c;
// @trunk_light: #f5977a;
// @primary:  #fcd6a4;
// @primary_light: #f3c380;
// @secondary: #f7fabf;
// @tertiary: #ffffff;
// @minor: #ffffff;
// @residential: #ffffff;
// @service: #ffffff;
// @unclassified: #F8F8F8;
// @pedestrian: #F8F8F8;
// @footway: #fa8072;
// @cycleway: #0000ff;
// @construction: #BBBBAA;
// @track: #996600;
// @path: #635730;
// @steps: #bbbbbb;
// @bridleway: #008000;
// @raceway: #bbc;
// @aeroway: #ffc0cb;
// @helipad: @aeroway;
// @taxiway: @aeroway;
// @runway: @aeroway;

/* 5.2 Bridges */

// @bridge_background: #EDEBDB;
@bridge_casing: black;

/* 5.3 Tunnels */

// @trunk_tunnel_orange: #FCA462;
// @trunk_tunnel_casing: #808080;
// @primary_tunnel_orange: #FCA462;
// @primary_tunnel_casing: #808080;
// @secondary_tunnel: #FFFFFF;
// @secondary_tunnel_casing:  #808080;
// @tertiary_tunnel: #FFFFFF;
// @tertiary_tunnel_casing:  #808080;
// @unclassified_tunnel: #FFFFFF;
// @unclassified_tunnel_casing: #808080;

/* 5.4 Piste */

@piste: #C47AFF;
@piste_novice:#5feb2e;
@piste_easy: #0b27fb;
@piste_intermadiate: #fc0e1b;
@piste_expert: #220625;
@piste_advanced: #0a0a0d;

/* 5.5 Transport */

// @railway_light: #B2B1A2;
// @railway: #969586;
// @railway_dash: #EEEEEE;
// @railway_tunnel: #808080;
// @aerialway: #444444;
// @tram: #7A7A7A;
@ferry: #4499Bb;
@cable_car: #444;

/* 6.LABELS COLORS */
/* 6.1 Main labels */
@label_dark: #222222;
@label_medium: #333333;
@road_label_halo: #444444;
@label_halo_medium: #EDEBDB;
@label_halo_light: #FFFFFF;

/* 6.2 Natural labels */

@water_label: #4499Bb;
@park_label: #3A7921;
@halo_park_label: #FFFFFF;

@peak_label: #9b7057;


/* 6.3 Place labels */

@city_label: #666666;
@country_label: #8C8C8C;
@state_label: #8C8C8C;
@district_label: #7F7F7F;
@housename: #65655E;
@building_label: #61615A;
@poi_label: #444444;
@subway_label: #333333;

/* 6.4 Road labels */

@road_label_halo: #FFFFFF;
@shield_text: #000000;
@shield_text_halo: #000000;
@shield: #FFFFFF;
@shield_outline: #000000;
/* blue - #2E89B0; #687E94; #598DBE; */


@contour: #888888;








@standard-halo-radius: 1;
@standard-halo-fill: rgba(255,255,255,0.6);

@tertiary-fill: #ffffff;
@residential-fill: #ffffff;
@service-fill: @residential-fill;
@living-street-fill: #ededed;
@pedestrian-fill: #dddde8;
@raceway-fill: pink;
@road-fill: #ddd;
// @footway-fill: salmon;
@path: #BB9A79;
@footway-fill: #ffffff;
@footway-fill-noaccess: #bbbbbb;
@steps-fill: @footway-fill;
@steps-fill-noaccess: #bbbbbb;
@cycleway-fill: blue;
@cycleway-fill-noaccess: #9999ff;
@bridleway-fill: green;
@bridleway-fill-noaccess: #aaddaa;
@track-fill: #744e04;
@track-fill-noaccess: #e2c5bb;
@aeroway-fill: #bbc;
@runway-fill: @aeroway-fill;
@taxiway-fill: @aeroway-fill;
@helipad-fill: @aeroway-fill;
@access-marking: #eaeaea;
@access-marking-living-street: #cccccc;

@default-casing: white;
@tertiary-casing: #bdbdbd;
@residential-casing: #bbb;
@road-casing: @residential-casing;
@service-casing: @residential-casing;
@living-street-casing: @residential-casing;
@pedestrian-casing: #999;
@path-casing: @default-casing;
@footway-casing: @default-casing;
@steps-casing: @default-casing;
@cycleway-casing: @default-casing;
@bridleway-casing: @default-casing;
@track-casing: @default-casing;

@tertiary-shield: #3b3b3b;

@unimportant-road: @residential-casing;

@minor-construction: #aaa;
@service-construction: #aaa;

@destination-marking: #c2e0ff;
@private-marking: #efa9a9;
@private-marking-for-red: #C26363;

@tunnel-casing: #808080;
@bridge-casing: #000000;

@motorway-tunnel-fill: lighten(@motorway-fill, 10%);
@trunk-tunnel-fill: lighten(@trunk-fill, 10%);
@primary-tunnel-fill: lighten(@primary-fill, 10%);
@secondary-tunnel-fill: lighten(@secondary-fill, 5%);
@tertiary-tunnel-fill: lighten(@tertiary-fill, 5%);
@residential-tunnel-fill: darken(@residential-fill, 5%);
@living-street-tunnel-fill: lighten(@living-street-fill, 3%);

@motorway-width-z6:               0.4;
@trunk-width-z6:                  0.4;

@motorway-width-z7:               0.8;
@trunk-width-z7:                  0.6;

@motorway-width-z8:               1;
@trunk-width-z8:                  1;
@primary-width-z8:                1;

@motorway-width-z9:               1.4;
@trunk-width-z9:                  1.4;
@primary-width-z9:                1.4;
@secondary-width-z9:              1;

@motorway-width-z10:              1.9;
@trunk-width-z10:                 1.9;
@primary-width-z10:               1.8;
@secondary-width-z10:             1.1;
@tertiary-width-z10:              0.7;

@motorway-width-z11:              2.0;
@trunk-width-z11:                 1.9;
@primary-width-z11:               1.8;
@secondary-width-z11:             1.1;
@tertiary-width-z11:              0.7;

@motorway-width-z12:              3.5;
@motorway-link-width-z12:         1.5;
@trunk-width-z12:                 3.5;
@trunk-link-width-z12:            1.5;
@primary-width-z12:               3.5;
@primary-link-width-z12:          1.5;
@secondary-width-z12:             3.5;
@secondary-link-width-z12:        1.5;
@tertiary-width-z12:              2.5;
@tertiary-link-width-z12:         1.5;
@residential-width-z12:           0.5;
@unclassified-width-z12:          0.8;
@track-width-z12:                 0.5;

@motorway-width-z13:              3.5;//6
@motorway-link-width-z13:         1.5;//4
@trunk-width-z13:                 3.5;//6
@trunk-link-width-z13:             1.5;//4
@primary-width-z13:               3.5;//5
@primary-link-width-z13:          1.5;//4
@secondary-width-z13:             3.5; //5 
@secondary-link-width-z13:        1.5; //4
@tertiary-width-z13:              2.5; //4
@tertiary-link-width-z13:         1.5;//3
@residential-width-z13:           2.5;//2.5
@living-street-width-z13:         2;
@bridleway-width-z13:             0.3;
@footway-width-z14:               1; // 0.7
@cycleway-width-z13:              1; // 0.7
@track-width-z13:                 1; // 0.5
@track-grade1-width-z13:          1; // 0.5
@track-grade2-width-z13:          1; // 0.5
@steps-width-z13:                 1.5;// 0.7

@secondary-width-z14:             3.5; //5
@tertiary-width-z14:              2.5; //5
@residential-width-z14:           3;//3
@living-street-width-z14:         3;
@pedestrian-width-z14:            3;//3
@road-width-z14:                  2;
@service-width-z14:               2;

@motorway-width-z15:             6;//10
@motorway-link-width-z15:         4;//7.8
@trunk-width-z15:                6;//10
@trunk-link-width-z15:          4;//7.8
@primary-width-z15:              5;//10
@primary-link-width-z15:        4;//7.8
@secondary-width-z15:             5; //9
@secondary-link-width-z15:        4;//7
@tertiary-width-z15:              4;//9
@tertiary-link-width-z15:         3;//7
@residential-width-z15:           4;//5
@living-street-width-z15:         5;
@pedestrian-width-z15:            4;//5
@bridleway-width-z15:             1.2;
@footway-width-z15:               1.5;  //1
@cycleway-width-z15:              0.9;
@track-width-z15:                 1.5; // 1.5
@track-grade1-width-z15:          1.5;
@track-grade2-width-z15:          1.5;
@steps-width-z15:                 3;

@secondary-width-z16:            9; //10
@tertiary-width-z16:             9; //10
@residential-width-z16:           5;//6
@living-street-width-z16:         6;
@pedestrian-width-z16:            5;//6
@road-width-z16:                  3.5;
@service-width-z16:               3.5;
@minor-service-width-z16:         2;
@footway-width-z16:               1.6;
@cycleway-width-z16:              0.9;

@motorway-width-z17:             10;//18
@motorway-link-width-z17:        7.8;//12
@trunk-width-z17:                10;//18
@trunk-link-width-z17:           7.8;//12
@primary-width-z17:              10;//18
@primary-link-width-z17:         7.8;//12
@secondary-width-z17:            9;//18
@secondary-link-width-z17:       7;//12
@tertiary-width-z17:             9;//18
@tertiary-link-width-z17:        7;//12
@residential-width-z17:          6;//12
@living-street-width-z17:        12;
@pedestrian-width-z17:           6;//12
@road-width-z17:                  7;
@service-width-z17:               7;
@minor-service-width-z17:         3.5;

@motorway-width-z18:             18;//21
@motorway-link-width-z18:        12;//13
@trunk-width-z18:                18;//21
@trunk-link-width-z18:           12;//13
@primary-width-z18:              18;//21
@primary-link-width-z18:         12;//13
@secondary-width-z18:            18;//21
@secondary-link-width-z18:       12;//13
@tertiary-width-z18:             18;//21
@tertiary-link-width-z18:        12;//13
@residential-width-z18:          12;//13
@living-street-width-z18:        13;
@pedestrian-width-z18:           10;//13
@road-width-z18:                  8.5;
@service-width-z18:               8.5;
@minor-service-width-z18:         4.75;

@motorway-width-z19:             21;//27
@motorway-link-width-z19:        13;//16
@trunk-width-z19:                21;//27
@trunk-link-width-z19:           13;//16
@primary-width-z19:              21;//27
@primary-link-width-z19:         13;//16
@secondary-width-z19:            21; //27
@secondary-link-width-z19:       13;//16
@tertiary-width-z19:             21;//27
@tertiary-link-width-z19:        13;//16
@residential-width-z19:          17;
@living-street-width-z19:        17;
@pedestrian-width-z19:           13;//17
@road-width-z19:                 11;
@service-width-z19:              11;
@minor-service-width-z19:         5.5;

@footway-width-z18:               2; // 1.6
@cycleway-width-z18:              1;

@footway-width-z19:               2;
@cycleway-width-z19:              1.3;


@major-casing-width-z11:          0.3;

@casing-width-z12:                0.1;
@secondary-casing-width-z12:      0.3;
@major-casing-width-z12:          0.5;

@casing-width-z13:                0.3;
@residential-casing-width-z13:    0.5;
@secondary-casing-width-z13:      0.35;
@major-casing-width-z13:          0.5;

@casing-width-z14:                0.15;
@secondary-casing-width-z14:      0.35;
@major-casing-width-z14:          0.6;

@casing-width-z15:                0.5;
@secondary-casing-width-z15:      0.7;
@major-casing-width-z15:          0.7;

@casing-width-z16:                0.6;
@secondary-casing-width-z16:      0.7;
@major-casing-width-z16:          0.7;

@casing-width-z17:                0.7;
@secondary-casing-width-z17:      1;
@major-casing-width-z17:          1;

@casing-width-z18:                0.8;
@secondary-casing-width-z18:      1;
@major-casing-width-z18:          1;

@casing-width-z19:                0.8;
@secondary-casing-width-z19:      1;
@major-casing-width-z19:          1;

@bridge-casing-width-z12:         0.1;
@major-bridge-casing-width-z12:   0.5;
@bridge-casing-width-z13:         0.2;
@major-bridge-casing-width-z13:   0.5;
@bridge-casing-width-z14:         0.2;
@major-bridge-casing-width-z14:   0.6;
@bridge-casing-width-z15:         0.4;
@major-bridge-casing-width-z15:   0.75;
@bridge-casing-width-z16:         0.4;
@major-bridge-casing-width-z16:   0.75;
@bridge-casing-width-z17:         0.6;
@major-bridge-casing-width-z17:   1;
@bridge-casing-width-z18:         0.6;
@major-bridge-casing-width-z18:   1;
@bridge-casing-width-z19:         0.6;
@major-bridge-casing-width-z19:   1;

@paths-background-width:          1;
@paths-bridge-casing-width:       0.2;
@paths-tunnel-casing-width:       1;

@junction-text-color:             #960000;
@halo-color-for-minor-road:       #ffffff;
@lowzoom-halo-color:              #ffffff;
@lowzoom-halo-width:              1;

@motorway-oneway-arrow-color:     darken(@motorway-casing, 25%);
@trunk-oneway-arrow-color:        darken(@trunk-casing, 25%);
@primary-oneway-arrow-color:      darken(@primary-casing, 15%);
@secondary-oneway-arrow-color:    darken(@secondary-casing, 10%);
@tertiary-oneway-arrow-color:     darken(@tertiary-casing, 30%);
@residential-oneway-arrow-color:  darken(@residential-casing, 40%);
@living-street-oneway-arrow-color: darken(@residential-casing, 30%);
@pedestrian-oneway-arrow-color:   darken(@pedestrian-casing, 25%);
@raceway-oneway-arrow-color:      darken(@raceway-fill, 50%);
@footway-oneway-arrow-color:      darken(@footway-fill, 35%);
@steps-oneway-arrow-color:        darken(@steps-fill, 35%);
@cycleway-oneway-arrow-color:     darken(@cycleway-fill, 25%);
@track-oneway-arrow-color:        darken(@track-fill, 10%);
@bridleway-oneway-arrow-color:    darken(@bridleway-fill, 15%);

// Shield’s line wrap is based on OpenStreetMap data and not on line-wrap-width,
// but lines are typically rather short, so we use narrow line spacing.
@shield-size: 10;
@shield-line-spacing: -1.50; // -0.15 em
@shield-size-z16: 11;
@shield-line-spacing-z16: -1.65; // -0.15 em
@shield-size-z18: 12;
@shield-line-spacing-z18: -1.80; // -0.15 em
@shield-spacing: 760;
@shield-repeat-distance: 400;
@shield-margin: 40;
@shield-font: @book-fonts;
@shield-clip: false;

@major-highway-text-repeat-distance: 50;
@minor-highway-text-repeat-distance: 10;

@railway-text-repeat-distance: 200;

@motorway-low-zoom-casing: #c24e6b;
@trunk-low-zoom-casing: #cf6649;
@primary-low-zoom-casing: #c38a27;
@secondary-low-zoom-casing: #9eae23;
@motorway-casing: #dc2a67;
@trunk-casing: #c84e2f;
@primary-casing: #a06b00;
@secondary-casing: #707d05;
@motorway-shield: #620728;
@trunk-shield: #5d1b0b;
@primary-shield: #4c2e00;
@secondary-shield: #323b00;
@motorway-low-zoom: #e66e89;
@trunk-low-zoom: #f5977a;
@primary-low-zoom: #f3c380;
@secondary-low-zoom: #e8eda0;
@motorway-fill: #e892a2;
@trunk-fill: #f9b29c;
@primary-fill: #fcd6a4;
@secondary-fill: #f7fabf;


@aboriginal: #82643a;
@national_park: rgb(99, 150, 65);

@protected-area: #008000;
@aboriginal: #82643a;

// --- Parks, woods, other green things ---
// @grass: #CDEBB0;
@grass: #D3EAB6;        // Lch(90,32,128) also grassland, meadow, village_green, garden, allotments
@scrub: #c8d7ab;        // Lch(84,24,122)
// @forest: #add19e;       // Lch(80,30,135)
@forest: #B3D0A1;       // Lch(80,30,135)
@heath: #d6d99f;
// @forest-text: #46673b;  // Lch(40,30,135)
@park: #c8facc;         // Lch(94,30,145)
@allotments: #c9e1bf;   // Lch(87,20,135)
@orchard: #aedfa3; // also vineyard, plant_nursery
@rock: #DCD7D1;
@fell: #F2EFE9;

// --- "Base" landuses ---

// @built-up-lowzoom: #aaaaaa;
@built-up-z11: #c0c0c0;
@built-up-z12: #d0d0d0;
@residential: #e0dfdf;      // Lch(89,0,0)
@residential-line: #b9b9b9; // Lch(75,0,0)
@retail: #ffd6d1;           // Lch(89,16,30)
@retail-line: #d99c95;      // Lch(70,25,30)
@commercial: #f2dad9;       // Lch(89,8.5,25)
@commercial-line: #d1b2b0;  // Lch(75,12,25)
@industrial: #ebdbe8;       // Lch(89,9,330) (Also used for railway, wastewater_plant)
@industrial-line: #c6b3c3;  // Lch(75,11,330) (Also used for railway-line, wastewater_plant-line)
@farmland: #eef0d5;         // Lch(94,14,112)
@farmland-line: #c7c9ae;    // Lch(80,14,112)
@farmyard: #f5dcba;         // Lch(89,20,80)
@farmyard-line: #d1b48c;    // Lch(75,25,80)

// --- Transport ----

@transportation-area: #e9e7e2;
@apron: #dadae0;
// @garages: #dfddce;
@parking: #eeeeee;
@parking-outline: saturate(darken(@parking, 40%), 20%);
@railway: @industrial;
@railway-line: @industrial-line;
@rest_area: #efc8c8; // also services

// --- Other ----

@bare_ground: #eee5dc;
@campsite: #def6c0; // also caravan_site, picnic_site
@cemetery: #aacbaf; // also grave_yard
@construction: #c7c7b4; // also brownfield
@mud: rgba(203,177,154,0.3); // produces #e6dcd1 over @land
@place_of_worship: #d0d0d0; // also religious
@place_of_worship_outline: darken(@place_of_worship, 30%);
@leisure: lighten(@park, 5%);
@power: darken(@industrial, 5%);
@power-line: darken(@industrial-line, 5%);
@sand: #f5e9c6;
@societal_amenities: #ffffe5;   // Lch(99,13,109)
@tourism: #660033;
@quarry: #c5c3c3;
@military: #f55;
// @beach: #fff1ba;
@beach: #FDF1C0;
@wastewater_plant: @industrial;
@wastewater_plant-line: @industrial-line;
@water_works: @industrial;
@water_works-line: @industrial-line;

// --- Sports ---

@pitch: #aae0cb;           // Lch(85,22,168) also track
@track: @pitch;
@stadium: @leisure; // also sports_centre
@golf_course: #b5e3b5;

@marine_labels:       #fff;
@marine_labels_halo:  #98c2ca;

@road_text_light:     #87919e;
@road_text_med:       rgb(89, 105, 63);
@road_text:           #000;
@motorway_halo:       #fff0c4;
@primary_halo:        #fefde1;
@minor_halo:          #fff;
@tunnel_halo:         #faf9f7;
@peak_halo: rgba(255,255,255,1);
@poi_light:           #666;
@poi_dark:            #000;
@poi_halo:            rgba(255,255,255,0.15); 

@housenumber:         rgb(77, 76, 76);
@place_text:         #333;
@place_halo:         #f2f5f8;


@country_text_dark:  #6b7d91;
@country_text_med:   #8894a3;
@country_text_light: #a3abb5;
@country_halo:       #fbf8f3;

@state_text:         #7c8a9b;
@state_text_light:   #959eaa;
@state_halo:         #fbf8f3;

@route:            #0000ff; 
@continent_text:     #405c78; 
@continent_halo:     #fbf8f3;

@motorway-oneway-arrow-color:     darken(@motorway-casing, 25%);
@trunk-oneway-arrow-color:        darken(@trunk-casing, 25%);
@primary-oneway-arrow-color:      darken(@primary-casing, 15%);
@secondary-oneway-arrow-color:    darken(@secondary-casing, 10%);
@tertiary-oneway-arrow-color:     darken(@tertiary-casing, 30%);
@residential-oneway-arrow-color:  darken(@residential-casing, 40%);
@living-street-oneway-arrow-color: darken(@residential-casing, 30%);
@pedestrian-oneway-arrow-color:   darken(@pedestrian-casing, 25%);
@raceway-oneway-arrow-color:      darken(@raceway-fill, 50%);
@footway-oneway-arrow-color:      darken(@footway-fill, 35%);
@steps-oneway-arrow-color:        darken(@steps-fill, 35%);
@cycleway-oneway-arrow-color:     darken(@cycleway-fill, 25%);
@track-oneway-arrow-color:        darken(@track-fill, 10%);
@bridleway-oneway-arrow-color:    darken(@bridleway-fill, 15%);



@landcover-font-size: 10;
@landcover-wrap-width-size: 30; // 3 em
@landcover-line-spacing-size: -1.5; // -0.15 em
@landcover-font-size-big: 12;
@landcover-wrap-width-size-big: 36; // 3 em
@landcover-line-spacing-size-big: -1.8; // -0.15 em
@landcover-font-size-bigger: 15;
@landcover-wrap-width-size-bigger: 45; // 3 em
@landcover-line-spacing-size-bigger: -2.25; // -0.15 em
@landcover-face-name: @oblique-fonts;