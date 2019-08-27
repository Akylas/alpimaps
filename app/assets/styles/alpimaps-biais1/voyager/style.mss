
Map {
  background-color: @landmass_fill;
  font-directory: url(fonts/);
}

//CARTO Fonts
@mont: "Montserrat Regular", "Noto Sans Regular";
@mont_md: "Montserrat Medium", "Noto Sans Regular";
@mont_bd: "Montserrat SemiBold", "Noto Sans Regular";
@mont_it: "Montserrat Italic", "Noto Sans Regular";
@mont_it_md: "Montserrat Italic", "Noto Sans Regular";
@maki: "maki";

//Base Colors
@landmass_fill:  #E3E1D3;

// LABELS //

//the colors below are used to make variations of place label colors
@dark_text:          #4b5357;
@med_text:           #405c78;
@light_text:         #959eaa;

@continent_text:     #405c78; 
@continent_halo:     #fbf8f3;

@country_text_dark:  #6b7d91;
@country_text_med:   #8894a3;
@country_text_light: #a3abb5;
@country_halo:       #fbf8f3;

@state_text:         #7c8a9b;
@state_text_light:   #959eaa;
@state_halo:         #fbf8f3;

@place_text:         #333;
@place_halo:         #f2f5f8;


//ocean/sea label colors
@marine_labels:       #fff;
@marine_labels_halo:  #98c2ca;


//Moutain peaks
@peak: rgb(155, 112, 87);
@peak_label:@peak;
@peak_label_dark:darken(@peak, 0.3);
@peak_halo: rgba(255,255,255,1);


@natural_parks_label: rgba(11, 57, 13, 1);
@natural_parks_halo: 	rgb(247, 248, 244);

//Road labels
@road_text_light:     #87919e;
@road_text_med:       rgb(89, 105, 63);
@road_text:           #000;
@motorway_halo:       #fff0c4;
@primary_halo:        #fefde1;
@minor_halo:          #fff;
@tunnel_halo:         #faf9f7;
@text_transform:      none;

//poi
@poi_light:           #666;
@poi_dark:            #000;
@poi_halo:            rgba(255,255,255,0.15); 

@housenumber:         rgb(77, 76, 76);


// STYLING VARIABLES //

//country boundaries
@admin0_3:           #ead5d7; 

//state and province boundaries
@admin1_low:         #9e9cab;
@admin1_high:        #9e9cab;
//@state:              @country_low;

//water
@water:              #8ED3DF;
@rivers_stroke:      rgb(65, 161, 179);
@water_shadow:       #bfdae9;
@ocean_line:         #a9ccd3;
//Lake and River Labels
@water_label:         darken(@rivers_stroke, 15%);
@water_halo:          lighten(@rivers_stroke, 30%);

//urban areas
@urbanareas:         rgba(221, 221, 212, 1);

@beach:               #fff1ba;
@ice:                 rgba(217, 249, 249, 0.3);
@ice_outline:         rgba(113, 177, 216, 0.3);
@forest:              rgba(72, 161, 79, 0.6);
@orchard: #aedfa3; // also vineyard, plant_nursery

@wetland: rgba(162, 221, 211, 0.589);
@grass: rgba(180, 187, 137, 0.8);
@grass_outline: #92b685;
@wood: #AABE6A;

@park: rgba(130, 191, 90, 0.8);
@park_outline: rgb(99, 150, 65);

//buildings
@buildings3d:       #f3eadc;
@buildings:           rgb(204, 203, 192);
@building_shadow:     #e4dcd0; //mix(@buildings,#777,88);
@building_outline:    #e9d8be; //darken(@urbanareas,8);

//aeroways
@aeroways:            #e8e8e8;

//Road colors
@motorway:                #ffcc88;
@motorway_case:           #e69051;
@motorway_case_lowzoom:   #fbdb98;

@main:                    #fea;
@main_case:               #e9ac77;

@secondary:               #ffeeaa;
@secondary_case_lowzoom:  #e9ac77;
@secondary_case:          #e9ac77;

@street:                  #fff;
@pedestrian:                  rgb(182, 182, 196);
@pedestrian_dark:          rgb(180, 180, 187);
@minor_case:              rgb(43, 42, 41);
@minor:                  rgb(248, 244, 244);

@path:                    rgb(95, 93, 53);
@track:                   #b37700;
@tunnel:                  rgba(255, 255, 255, 0.7);
@bridge: rgba(242, 238, 218, 0.7);
@footway: rgb(255, 255, 255);

@contour: #52644d;

@rail_light:                    rgb(180, 180, 180);
@rail_dark:                    rgb(90, 90, 90);
@rail_dash:               #fff;
@rail_tunnel_dark:               #b37700;
@rail_tunnel_light:               #ceb88d;

//we need these for positron and dark matter
@motorway_ramp_lowzoom:   #FFE9A5;
@minor_ramp_highzoom:     #fff;
