// --- Parks, woods, other green things ---

@grass: #cdebb0;        // Lch(90,32,128) also grassland, meadow, village_green, garden, allotments
@scrub: #c8d7ab;        // Lch(84,24,122)
@forest: #add19e;       // Lch(80,30,135)
@forest-text: #46673b;  // Lch(40,30,135)
@park: #c8facc;         // Lch(94,30,145)
@allotments: #c9e1bf;   // Lch(87,20,135)
@orchard: #aedfa3; // also vineyard, plant_nursery
@rock: #DCD7D1;

// --- "Base" landuses ---

@built-up-lowzoom: #aaaaaa;
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
@garages: #dfddce;
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
@heath: #d6d99f;
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
@beach: #fff1ba;
@wastewater_plant: @industrial;
@wastewater_plant-line: @industrial-line;
@water_works: @industrial;
@water_works-line: @industrial-line;

// --- Sports ---

@pitch: #aae0cb;           // Lch(85,22,168) also track
@track: @pitch;
@stadium: @leisure; // also sports_centre
@golf_course: #b5e3b5;

#landuse['mapnik::geometry_type'=3] {

  [class = 'residential'][zoom >= 8]{
    polygon-fill: @built-up-lowzoom;
    [zoom >= 11] { polygon-fill: @built-up-z11; }
    [zoom >= 12] { polygon-fill: @built-up-z12; }
    [zoom >= 13] { polygon-fill: @residential; }
    [zoom >= 16] {
      line-width: .5;
      line-color: @residential-line;
      [name != ''] {
        line-width: 0.7;
      }
    }
    // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  }
  // ::low-zoom[zoom < 10]                   { image-filters: scale-hsla(0,1,0,1,0.6,0.95,0,1); }
  // ::lower-mid-zoom[zoom >= 10][zoom < 11] { image-filters: scale-hsla(0,1,0,1,0.6,0.95,0,1); }
  // ::mid-zoom[zoom >= 11][zoom < 12]       { image-filters: scale-hsla(0,1,0,1,0.5,0.96,0,1); }
  // ::upper-mid-zoom[zoom >= 12][zoom < 13] { image-filters: scale-hsla(0,1,0,1,0.4,0.97,0,1); }
  // ::high-zoom[zoom >= 13]                 { image-filters: scale-hsla(0,1,0,1,0,  1,   0,1); }

  // ::low-zoom[zoom < 10],
  // ::lower-mid-zoom[zoom >= 10][zoom < 11],
  // ::mid-zoom[zoom >= 11][zoom < 12],
  // ::upper-mid-zoom[zoom >= 12][zoom < 13],
  // ::high-zoom[zoom >= 13] {

  
    ::top_of_residential {
    [class = 'recreation_ground'][zoom >= 10],
    [class = 'playground'][zoom >= 13],
    [class = 'fitness_station'][zoom >= 13] {
      polygon-fill: @leisure;
      [zoom >= 15] {
        line-color: darken(@leisure, 60%);
        line-width: 0.3;
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'camp_site'],
    [class = 'caravan_site'],
    [class = 'picnic_site'] {
      [zoom >= 10] {
        polygon-fill: @campsite;
        [zoom >= 13] {
          line-color: saturate(darken(@campsite, 60%), 30%);
          line-width: 0.3;
        }
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }


    [class = 'plant_nursery'] {
      [zoom >= 10] {
        polygon-fill: @orchard;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
      [zoom >= 13] {
        polygon-pattern-file: url('symbols/plant_nursery.png');
      //   polygon-pattern-alignment: global;
        // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
      }
    }

    [class = 'cemetery']{
      [zoom >= 10] {
        polygon-fill: @cemetery;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
      // [zoom >= 13] {
      //   [religion = 'jewish'] { polygon-pattern-file: url('symbols/grave_yard_jewish.svg'); }
      //   [religion = 'christian'] { polygon-pattern-file: url('symbols/grave_yard_christian.svg'); }
      //   [religion = 'muslim'] { polygon-pattern-file: url('symbols/grave_yard_muslim.svg'); }
      //   [religion = 'INT-generic'] { polygon-pattern-file: url('symbols/grave_yard_generic.svg'); }
      //   [religion = 'jewish'],
      //   [religion = 'christian'],
      //   [religion = 'muslim'],
      //   [religion = 'INT-generic'] {
      //     [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
      //     [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
      //   }
      // }
    }

    // [class = 'place_of_worship'][zoom >= 13],
    // [class = 'religious'][zoom >= 13] {
    //   polygon-fill: @place_of_worship;
    //   //polygon-clip: false;
    //   [zoom >= 15] {
    //     line-color: @place_of_worship_outline;
    //     line-width: 0.3;
    //     //line-clip: false;
    //   }
    // }

    // [class = 'prison'][zoom >= 10][way_pixels > 75] {
    //   polygon-pattern-file: url('symbols/grey_vertical_hatch.png');
    //   polygon-pattern-alignment: global;
    //   line-color: #888;
    //   line-width: 3;
    //   line-opacity: 0.329;
    // }


    [class = 'garages'][zoom >= 13] {
      polygon-fill: @garages;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'ice_rink'][is_building = 'no'] {
      [zoom >= 10] {
        polygon-fill: @glacier;
        line-width: 0.5;
        line-color: saturate(darken(@pitch, 30%), 20%);
      //   [way_pixels >= 4]  { polygon-gamma: 0.75; }
      //   [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }

    [class = 'dog_park'] {
      [zoom >= 10] {
        polygon-fill: @leisure;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
      [zoom >= 16] {
        polygon-pattern-file: url('symbols/dog_park.png');
      //   polygon-pattern-alignment: global;
        // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
      }
    }

    [class = 'golf_course'][zoom >= 10],
    [class = 'miniature_golf'][zoom >= 15] {
      polygon-fill: @golf_course;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }


    [class = 'retail'],
    [class = 'marketplace'] {
      [zoom >= 8] {
        polygon-fill: @built-up-lowzoom;
        [zoom >= 11] { polygon-fill: @built-up-z11; }
        [zoom >= 12] { polygon-fill: @built-up-z12; }
        [zoom >= 13] { polygon-fill: @retail; }
        [zoom >= 16] {
          line-width: 0.5;
          line-color: @retail-line;
          [name != ''] {
            line-width: 0.7;
          }
          // [way_pixels >= 4]  { polygon-gamma: 0.75; }
          // [way_pixels >= 64] { polygon-gamma: 0.3;  }
        }
      }
    }

    [class = 'industrial'][zoom >= 8] {
      polygon-fill: @built-up-lowzoom;
      [zoom >= 11] { polygon-fill: @built-up-z11; }
      [zoom >= 12] { polygon-fill: @built-up-z12; }
      [zoom >= 13] { polygon-fill: @industrial; }
      [zoom >= 16] {
        line-width: .5;
        line-color: @industrial-line;
        [name != ''] {
          line-width: 0.7;
        }
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'man_made_works'][zoom >= 16] {
      line-width: .5;
      line-color: @industrial-line;
      [name != ''] {
        line-width: 0.7;
      }
    }

    [class = 'man_made_wastewater_plant'] {
      polygon-fill: @industrial;
      [zoom >= 15] {
        polygon-fill: @wastewater_plant;
      }
      [zoom >= 16] {
        line-width: 0.5;
        line-color: @wastewater_plant-line;
        [name != ''] {
          line-width: 0.7;
        }
      }
    }

    [class = 'man_made_water_works'] {
      polygon-fill: @industrial;
      [zoom >= 15] {
        polygon-fill: @water_works;
      }
      [zoom >= 16] {
        line-width: 0.5;
        line-color: @water_works-line;
        [name != ''] {
          line-width: 0.7;
        }
      }
    }

    [class = 'railway'][zoom >= 10] {
      polygon-fill: @railway;
      [zoom >= 16][name != ''] {
        line-width: 0.7;
        line-color: @railway-line;
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'power_station'][zoom >= 10],
    [class = 'power_generator'][zoom >= 10],
    [class = 'power_sub_station'][zoom >= 13],
    [class = 'power_substation'][zoom >= 13] {
      polygon-fill: @industrial;
      [zoom >= 15] {
        polygon-fill: @power;
      }
      [zoom >= 16] {
        line-width: 0.5;
        line-color: @power-line;
        [name != ''] {
          line-width: 0.7;
        }
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'commercial'][zoom >= 8] {
      polygon-fill: @built-up-lowzoom;
      [zoom >= 11] { polygon-fill: @built-up-z11; }
      [zoom >= 12] { polygon-fill: @built-up-z12; }
      [zoom >= 13] { polygon-fill: @commercial; }
      [zoom >= 16] {
        line-width: 0.5;
        line-color: @commercial-line;
        [name != ''] {
          line-width: 0.7;
        }
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'brownfield'],
    [class = 'construction'] {
      [zoom >= 10] {
        polygon-fill: @construction;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }

    

    [class = 'hospital'],
    [class = 'clinic'],
    [class = 'university'],
    [class = 'college'],
    [class = 'school'],
    [class = 'classergarten'],
    [class = 'community_centre'],
    [class = 'social_facility'],
    [class = 'arts_centre'] {
      [zoom >= 10] {
        polygon-fill: @built-up-lowzoom;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
      [zoom >= 11] {
        polygon-fill: @built-up-z11;
      }
      [zoom >= 12] {
        polygon-fill: @built-up-z12;
      }
      [zoom >= 13] {
        polygon-fill: @societal_amenities;
        line-width: 0.3;
        line-color: darken(@societal_amenities, 35%);
      }
    }

    [class = 'fire_station'][zoom >= 8][way_pixels > 900],
    [class = 'police'][zoom >= 8][way_pixels > 900],
    [class = 'fire_station'][zoom >= 13],
    [class = 'police'][zoom >= 13] {
      polygon-fill: #F3E3DD;
      line-color: @military;
      line-opacity: 0.24;
      line-width: 1.0;
      //line-offset: -0.5;
      [zoom >= 15] {
        line-width: 2;
        //line-offset: -1.0;
      }
    }

    [class = 'parking'],
    [class = 'bicycle_parking'],
    [class = 'motorcycle_parking'],
    [class = 'taxi'] {
      [zoom >= 14] {
        polygon-fill: @parking;
        [zoom >= 15] {
          line-width: 0.3;
          line-color: @parking-outline;
        }
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }

    [class = 'parking_space'][zoom >= 18] {
      line-width: 0.3;
      line-color: mix(@parking-outline, @parking, 50%);
    }

    [class = 'apron'][zoom >= 10] {
      polygon-fill: @apron;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'aerodrome'][zoom >= 10],
    [class = 'ferry_terminal'][zoom >= 15],
    [class = 'bus_station'][zoom >= 15] {
      polygon-fill: @transportation-area;
      line-width: 0.2;
      line-color: saturate(darken(@transportation-area, 40%), 20%);
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'beach'][zoom >= 10],
    [class = 'shoal'][zoom >= 10] {
      polygon-fill: @beach;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'highway_services'],
    [class = 'highway_rest_area'] {
      [zoom >= 10] {
        polygon-fill: @rest_area;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }

    [class = 'railway_station'][zoom >= 10] {
      polygon-fill: @railway;
    }

    [class = 'sports_centre'],
    [class = 'stadium'] {
      [zoom >= 10] {
        polygon-fill: @stadium;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
        [zoom >= 13] {
          line-width: 0.3;
          line-color: darken(@stadium, 35%);
        }
      }
    }

    [class = 'track'][zoom >= 10] {
      polygon-fill: @track;
      [zoom >= 15] {
        line-width: 0.5;
        line-color: desaturate(darken(@track, 20%), 10%);
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    [class = 'pitch'][zoom >= 10] {
      polygon-fill: @pitch;
      [zoom >= 15] {
        line-width: 0.5;
        line-color: desaturate(darken(@pitch, 20%), 10%);
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  }
// }
}

/* man_made=cutline */
// #landcover-line {
//   [zoom >= 14] {
//     line-width: 3;
//     line-join: round;
//     line-cap: square;
//     line-color: @grass;
//     [zoom >= 16] {
//       line-width: 6;
//       [zoom >= 18] {
//         line-width: 12;
//       }
//     }
//   }
// }

#landcover['mapnik::geometry_type'=3] {

  ::first {
    // [natural = 'mud'],
    [class = 'tidalflat'] {
      [zoom >= 9] {
        polygon-fill: @mud;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }
  }

  [class = 'sand'][zoom >= 5] {
    polygon-pattern-file: url('symbols/beach.png');
    // polygon-pattern-alignment: global;
  }
  [int_wetland != null][zoom >= 5] {
    polygon-pattern-file: url('symbols/wetland.png');
    // polygon-pattern-alignment: global;
  }
  [class = 'reef'][zoom >= 10] {
    polygon-pattern-file: url('symbols/reef.png');
    // polygon-pattern-alignment: global;
  }
  [zoom >= 13] {
    [class = 'marsh'],
    [class = 'saltmarsh'],
    [class = 'wet_meadow'] {
      polygon-pattern-file: url('symbols/marsh.png');
      // polygon-pattern-alignment: global;
    }
    [class = 'reedbed'] {
      polygon-pattern-file: url('symbols/reed.png');
      // polygon-pattern-alignment: global;
    }
    [class = 'mangrove'] {
      polygon-pattern-file: url('symbols/mangrove.png');
      // polygon-pattern-alignment: global;
    }
    [class = 'swamp'] {
      polygon-pattern-file: url('symbols/swamp.png');
      // polygon-pattern-alignment: global;
    }
    [class = 'bog'],
    [class = 'fen'],
    [class = 'string_bog'] {
      polygon-pattern-file: url('symbols/bog.png');
      // polygon-pattern-alignment: global;
    }
    [class = 'beach'],
    [class = 'shoal'] {
      [surface = 'sand'] {
        polygon-pattern-file: url('symbols/beach.png');
        // polygon-pattern-alignment: global;
      }
      [surface = 'gravel'],
      [surface = 'fine_gravel'],
      [surface = 'pebbles'],
      [surface = 'pebblestone'],
      [surface = 'shingle'],
      [surface = 'stones'],
      [surface = 'shells'] {
        polygon-pattern-file: url('symbols/beach_coarse.png');
        // polygon-pattern-alignment: global;
      }
    }
    [natural = 'scrub'] {
      polygon-pattern-file: url('symbols/scrub.png');
      // polygon-pattern-alignment: global;
    }
  }

  [class = 'forest']::wood,
  [class=wood]::wood {
    [zoom >= 5] {
      polygon-fill: darken(@forest, 0);
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  }
  //Also landuse = forest, converted in the SQL
//   [class = 'wood'][zoom >= 13]::wood {
    // polygon-pattern-file: url('symbols/leaftype_unknown.svg'); // Lch(55,30,135)
    // [leaf_type = "broadleaved"] { polygon-pattern-file: url('symbols/leaftype_broadleaved.svg'); }
    // [leaf_type = "needleleaved"] { polygon-pattern-file: url('symbols/leaftype_needleleaved.svg'); }
    // [leaf_type = "mixed"] { polygon-pattern-file: url('symbols/leaftype_mixed.svg'); }
    // [leaf_type = "leafless"] { polygon-pattern-file: url('symbols/leaftype_leafless.svg'); }
    // polygon-pattern-alignment: global;
//     opacity: 0.4; // The entire layer has opacity to handle overlapping forests
//   }


  [class = 'quarry'][zoom >= 10] {
    polygon-fill: @quarry;
    polygon-pattern-file: url('symbols/quarry.svg');
    [zoom >= 13] {
      line-width: 0.5;
      line-color: #808080;
    }
    // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
  }

  [class=wood][subclass = 'vineyard'] {
    [zoom >= 5] {
      polygon-fill: @orchard;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
    [zoom >= 13] {
      polygon-pattern-file: url('symbols/vineyard.png');
    //   polygon-pattern-alignment: global;
      // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    }
  }

  [class=wood][subclass = 'orchard'] {
    [zoom >= 5] {
      polygon-fill: @orchard;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
    [zoom >= 13] {
      polygon-pattern-file: url('symbols/orchard.png');
    //   polygon-pattern-alignment: global;
    //   [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
    //   [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    }
  }

  [class=grass][class = 'garden'] {
    [zoom >= 10] {
      polygon-fill: @grass;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
    [zoom >= 13] {
      polygon-pattern-file: url('symbols/plant_nursery.png');
      polygon-pattern-opacity: 0.6;
    //   polygon-pattern-alignment: global;
      // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    }
  }

  [class = 'landfill'] {
    [zoom >= 10] {
      polygon-fill: #b6b592;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  }

  [class = 'rock'][zoom >= 5],
  [class = 'bare_rock'][zoom >= 5] {
    polygon-fill: @rock;
    // polygon-pattern-file: url('symbols/rock_overlay.png');
    // [way_pixels >= 4] {
    //   polygon-gamma: 0.75;
    //   polygon-pattern-gamma: 0.75;
    // }
    // [way_pixels >= 64] {
    //   polygon-gamma: 0.3;
    //   polygon-pattern-gamma: 0.3;
    // }
  }

  [class = 'park'] ,
  [class = 'grass'][subclass = 'park']{
    [zoom >= 10] {
      ::grass {
        polygon-fill: @park;
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  }

  [class = 'grass'][subclass = 'allotments']::grass {
    [zoom >= 10] {
      polygon-fill: @allotments;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
    [zoom >= 13] {
      polygon-pattern-file: url('symbols/allotments.png');
    //   polygon-pattern-alignment: global;
      // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    }
    [zoom >= 16] {
      line-width: 0.5;
      line-color: desaturate(darken(@allotments, 10%), 10%);
      [name != null] {
        line-width: 0.7;
      }
    }
  }

  

  [class = 'farmyard'][zoom >= 10] {
    polygon-fill: @farmyard;
      [zoom >= 16] {
        line-width: 0.5;
        line-color: @farmyard-line;
        [name != ''] {
          line-width: 0.7;
        }
      }
    // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  }

  [class = 'farmland'],
  [class = 'greenhouse_horticulture'] {
    [zoom >= 5] {
      polygon-fill: @farmland;
      [zoom >= 16] {
        line-width: .5;
        line-color: @farmland-line;
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  }

  [class = 'grass'][subclass = 'grassland'],
  [class = 'grass'][subclass = 'meadow'][zoom >= 5],
  [class = 'grass'][subclass = 'grass'][zoom >= 5],
  [class = 'grass'][subclass = 'village_green'][zoom >= 5] {
    ::grass {
        polygon-fill: @grass;
    }

    // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  }
  // [class = 'scree'],
  // [class = 'shingle'] {
  //   [zoom >= 5] {
  //     polygon-fill: @bare_ground;
  //     [way_pixels >= 4]  { polygon-gamma: 0.75; }
  //     [way_pixels >= 64] { polygon-gamma: 0.3;  }
  //     [zoom >= 13] {
  //       polygon-pattern-file: url('symbols/scree_overlay.png');
  //       [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
  //       [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
  //     }
  //   }
  // }

  [class = 'sand'][zoom >= 5] {
    polygon-fill: @sand;
    // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  }

  [class = 'heath'][zoom >= 5] {
    polygon-fill: @heath;
    // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  }

  [class = 'scrub'][zoom >= 5] {
    polygon-fill: @scrub;
    // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  }

  [class=wetland] {
    [class = 'swamp'][zoom >= 5] {
      polygon-fill: @forest;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  
    [class = 'bog'],
    [class = 'string_bog'] {
      [zoom >= 5] {
        polygon-fill: @heath;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }
  
    [class = 'wet_meadow'],
    [class = 'fen'],
    [class = 'marsh'] {
      [zoom >= 5] {
        polygon-fill: @grass;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      }
    }
  }
}

#landuse['mapnik::geometry_type'=3] {
  [class = 'military'][zoom >= 8][way_pixels > 900],
  [class = 'military'][zoom >= 13],
  [class = 'danger_area'][zoom >= 9] {
    polygon-pattern-file: url('symbols/military_red_hatch.png');
    // polygon-pattern-alignment: global;
    line-color: @military;
    line-opacity: 0.24;
    line-width: 1.0;
    //line-offset: -0.5;
    [zoom >= 15] {
      [military = 'danger_area'][zoom >= 9] {
        polygon-pattern-file: url('symbols/danger_red_hatch.png');
        line-opacity: 0.2;
      }
      line-width: 2;
      //line-offset: -1.0;
    }
  }
  [class = 'embankment'][zoom >= 15]::man_made {
    line-pattern-file: url('symbols/embankment.svg');
  }
  [class = 'zoo'][zoom >= 10][way_pixels >= 750],
  [class = 'zoo'][zoom >= 17],
  [class = 'theme_park'][zoom >= 10][way_pixels >= 750],
  [class = 'theme_park'][zoom >= 17] {
    a/line-width: 1;
    // a/line-offset: -0.5;
    a/line-color: @tourism;
    a/line-opacity: 0.5;
    a/line-join: round;
    a/line-cap: round;
    [zoom >= 17],
    [way_pixels >= 60] {
      b/line-width: 4;
    //   b/line-offset: -2;
      b/line-color: @tourism;
      b/line-opacity: 0.3;
      b/line-join: round;
      b/line-cap: round;
    }
    [zoom >= 17] {
      a/line-width: 2;
    //   a/line-offset: -1;
      b/line-width: 6;
    //   b/line-offset: -3;
    }
  }
}

// #earth {
//   [class = 'cliff'][zoom >= 13] {
//     line-color: #ff0000;
//     line-pattern-file: url('symbols/cliff.svg');
//     [zoom >= 15] {
//       line-pattern-file: url('symbols/cliff2.svg');
//     }
//   }
// }

// #area-barriers {
//   [zoom >= 16] {
//     line-color: #444;
//     line-width: 0.4;
//     [feature = 'barrier_hedge'] {
//       polygon-fill: #aed1a0;
//     }
//   }
// }

// .barriers {
//   [zoom >= 16] {
//     line-width: 0.4;
//     line-color: #444;
//   }
//   [feature = 'barrier_embankment'][zoom >= 14] {
//     line-width: 0.4;
//     line-color: #444;
//   }
//   [feature = 'barrier_hedge'][zoom >= 16] {
//     line-width: 3;
//     line-color: #aed1a0;
//   }
//   [feature = 'historic_citywalls'],
//   [feature = 'barrier_city_wall'] {
//     [zoom >= 15] {
//       line-width: 1.5;
//       line-color: lighten(#444, 30%);
//     }

//     [zoom >= 17] {
//       line-width: 3;
//       barrier/line-width: 0.4;
//       barrier/line-color: #444;
//     }
//   }
// }


#landuse ['mapnik::geometry_type'=3] [class = 'cliff'][zoom >= 15],
#landuse ['mapnik::geometry_type'=3] [class = 'embankment'][zoom >= 15]{
    text-name: [name];
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-fill: #999;
    text-size: 10;
    text-face-name: @book-fonts;
    text-placement: line;
    text-dy: 8;
    text-vertical-alignment: middle;
    text-spacing: 400;
}

// #building [zoom>=14]['nuti::buildings'>0]{
// 	::3d['nuti::buildings'>1][zoom>=17]{
// 	  building-height: [render_height] ? [render_height] : 10;
// 	  building-min-height: [render_min_height];
// 	  building-fill: @building;
// 	  building-fill-opacity: 0.45;
// 	} 
  
// 	// ::shadow['nuti::buildings'=1][zoom>=18]{
// 	//   polygon-fill: @building_dark_border;
// 	//   polygon-opacity: linear([view::zoom], (18, 0), (19, 1));
// 	//   [zoom>=18] { polygon-geometry-transform: translate(0,1); }
// 	//   [zoom>=19] { polygon-geometry-transform: translate(0,2); }
// 	//   [zoom>=20] { polygon-geometry-transform: translate(0,3); }
// 	//   [zoom>=21] { polygon-geometry-transform: translate(0,5); } 
		
// 	// }
  
// 	['nuti::buildings'=1],
// 	['nuti::buildings'>1][zoom<17]{
// 		::fill{
// 			polygon-fill: @building;
// 			polygon-opacity: linear([view::zoom], (14, 0.5), (15, 0.6), (16, 0.8), (17, 0.9), (18, 1));
// 		}
		
// 	}
// 	::case[zoom>=16]{
// 		line-width: linear([view::zoom], (16, 0.2), (19, 1));
// 		line-opacity: linear([view::zoom], (16, 0.8), (17, 0.9), (18, 1));
// 		line-color: linear([view::zoom], (16, @building_border), (17, @building_dark_border));
// 	}
	  
//   }

@building-fill: #d9d0c9;  // Lch(84, 5, 68)
@building-line: darken(@building-fill, 15%);  // Lch(70, 9, 66)
@building-low-zoom: darken(@building-fill, 4%);

@building-major-fill: darken(@building-fill, 10%);  // Lch(75, 8, 67)
@building-major-line: darken(@building-major-fill, 15%);  // Lch(61, 13, 65)
@building-major-z15: darken(@building-major-fill, 5%);  // Lch(70, 9, 66)
@building-major-z14: darken(@building-major-fill, 10%);  // Lch(66, 11, 65)

@entrance-permissive: darken(@building-line, 15%);
@entrance-normal: @building-line;

#building['nuti::buildings'>0] [zoom >= 14] {
    polygon-fill: @building-low-zoom;
    //polygon-clip: false;
    ::3d['nuti::buildings'>1][zoom>=17]{
        building-height: [render_height] ? [render_height] : 10;
        building-min-height: [render_min_height];
        building-fill: @building-fill;
        building-fill-opacity: 0.45;
    } 
    
    [zoom >= 15] {
      polygon-fill: @building-fill;
      line-color: @building-line;
      line-width: .75;
      //line-clip: false;
    }
    [amenity = 'place_of_worship'],
    [aeroway = 'terminal'],
    [aerialway = 'station'],
    [building = 'train_station'],
    [public_transport = 'station'] {
      polygon-fill: @building-major-z14;
      [zoom >= 15] {
        polygon-fill: @building-major-z15;
        line-color: @building-major-line;
        [zoom >= 16] {
          polygon-fill: @building-major-fill;
        }
      }
    }
}