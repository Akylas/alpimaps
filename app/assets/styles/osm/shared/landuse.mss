
#landuse['mapnik::geometry_type'=3] {
  [name!=null][zoom>=15] {
    text-name: @name;
    text-face-name: @mont;
    text-fill: @building_label;
    text-size: 9;
	  text-wrap-width: 100;
  }  
  [class = 'residential'][zoom >= 7]{
    // polygon-fill: @built-up-lowzoom;
    // [zoom >= 11] { polygon-fill: @built-up-z11; }
    // [zoom >= 12] { polygon-fill: @built-up-z12; }
    // [zoom >= 11] {
       polygon-fill: @residential; 
      // }
    // [zoom >= 16] {
    //   line-width: .5;
    //   line-color: @residential-line;
    //   [name != ''] {
    //     line-width: 0.7;
    //   }
    // }
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


    // [class = 'plant_nursery'] {
    //   [zoom >= 10] {
    //     polygon-fill: @orchard;
    //     // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    //     // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    //   }
    //   [zoom >= 13] {
    //     polygon-pattern-file: url('symbols/plant_nursery.png');
    //   //   polygon-pattern-alignment: global;
    //     // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
    //     // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    //   }
    // }

    [class = 'cemetery'][zoom >= 10]{
      //  {
        polygon-fill: @cemetery;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      // }
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


    // [class = 'garages'][zoom >= 13] {
    //   polygon-fill: @garages;
    //   // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    //   // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }


    // [class = 'dog_park'] {
    //   [zoom >= 10] {
    //     polygon-fill: @leisure;
    //     // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    //     // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    //   }
    //   [zoom >= 16] {
    //     polygon-pattern-file: url('symbols/dog_park.png');
    //   //   polygon-pattern-alignment: global;
    //     // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
    //     // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    //   }
    // }

    [class = 'golf_course'][zoom >= 10],
    [class = 'miniature_golf'][zoom >= 15] {
      polygon-fill: @golf_course;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }


    [class = 'retail'],
    [class = 'marketplace'] {
      [zoom >= 8] {
        // polygon-fill: @built-up-lowzoom;
        [zoom >= 11] { polygon-fill: @built-up-z11; }
        [zoom >= 12] { polygon-fill: @built-up-z12; }
        [zoom >= 13] { polygon-fill: @retail; }
        [zoom >= 15] {
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
      // polygon-fill: @built-up-lowzoom;
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

    // [class = 'man_made_works'][zoom >= 16] {
    //   line-width: .5;
    //   line-color: @industrial-line;
    //   [name != ''] {
    //     line-width: 0.7;
    //   }
    // }

    // [class = 'man_made_wastewater_plant'] {
    //   polygon-fill: @industrial;
    //   [zoom >= 15] {
    //     polygon-fill: @wastewater_plant;
    //   }
    //   [zoom >= 16] {
    //     line-width: 0.5;
    //     line-color: @wastewater_plant-line;
    //     [name != ''] {
    //       line-width: 0.7;
    //     }
    //   }
    // }

    // [class = 'man_made_water_works'] {
    //   polygon-fill: @industrial;
    //   [zoom >= 15] {
    //     polygon-fill: @water_works;
    //   }
    //   [zoom >= 16] {
    //     line-width: 0.5;
    //     line-color: @water_works-line;
    //     [name != ''] {
    //       line-width: 0.7;
    //     }
    //   }
    // }

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


  [class = 'quarry'][zoom >= 10] {
    polygon-fill: @quarry;
    // polygon-pattern-file: url('symbols/quarry.svg');
    [zoom >= 13] {
      line-width: 0.5;
      line-color: #808080;
    }
    // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
    // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
  }

    [class = 'commercial'][zoom >= 8] {
      // polygon-fill: @built-up-lowzoom;
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
      // [zoom >= 10] {
        // polygon-fill: @built-up-lowzoom;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      // }
      [zoom >= 11] {
        polygon-fill: @built-up-z12;
      }
      [zoom >= 12] {
        polygon-fill: @societal_amenities;
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

  [class = 'military'][zoom >= 13],
  [class = 'danger_area'][zoom >= 9] {
    polygon-pattern-file: url('symbols/military_red_hatch.png');
    
    line-color: @military;
    line-opacity: 0.24;
    line-width: 1.0;
    //line-offset: -0.5;
    [zoom >= 15] {
      [class = 'danger_area'][zoom >= 9] {
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

    [class = 'sand'][subclass = 'beach'][zoom >= 10],
    [class = 'shoal'][zoom >= 10] {
      polygon-fill: @beach;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }

    // [class = 'highway_services'],
    // [class = 'highway_rest_area'] {
    //   [zoom >= 10] {
    //     polygon-fill: @rest_area;
    //     // [way_pixels >= 4]  { polygon-gamma: 0.75; }
    //     // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    //   }
    // }

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

    [class = 'pitch'][zoom >= 12] {
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

#landcover['mapnik::geometry_type'=2] {

  [name!=null][zoom>=15] {
    text-name: @name;
    text-face-name: @mont;
    text-fill: @building_label;
    text-size: 9;
    text-wrap-width: 100;
  }  
  [class=rock][subclass = 'cliff'][zoom >= 12] { 

    line-color: #777;
    line-width: linear([view::zoom], (12, 0.5), (15,1));
    [zoom >= 15] {
      line/line-geometry-transform: translate(0, 2);
      line/line-color: #777; 
      line/line-dasharray: 1,3;
      line/line-width: linear([view::zoom], (15, 0), (16,2));
    }
    // line-pattern-file: url('symbols/cliff.svg');
    // [zoom >= 15] {
    // 	line-pattern-file: url('symbols/cliff2.svg');
    // }
  }
  [class=barrier][zoom >= 15] {
		[subclass = 'citywalls'],
		[subclass = 'city_wall'] {
		  line-width:linear([view::zoom], (15, 1), (17, 2),(20,3));
		  line-color: linear([view::zoom], (15, lighten(#444, 30%)), (17, #444));
    }
		[subclass = 'retaining_wall'] {
      line-width:linear([view::zoom], (16, 0.5), (20,1));
      line-opacity:0.6;
			line-color: linear([view::zoom], (16, lighten(#444, 30%)), (17, #444));
		}
	}
}
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

  // [class = 'sand'][zoom >= 5] {
  //   polygon-pattern-file: url('symbols/beach.png');
  // }
  // [class = 'reef'][zoom >= 10] {
  //   polygon-pattern-file: url('symbols/reef.png');
  // }
    
    // [class = 'sand'][subclass = 'beach'][zoom >= 13],
    // [class = 'shoal'] [zoom >= 13]{
    //     polygon-pattern-file: url('symbols/beach.png');
    // }

  [class = 'forest'][zoom >= 5],
  [class=wood][zoom >= 5] {
      polygon-fill: darken(@forest, 5%);
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
  }
  //Also landuse = forest, converted in the SQL
//   [class = 'wood'][zoom >= 13]::wood {
    // polygon-pattern-file: url('symbols/leaftype_unknown.svg'); // Lch(55,30,135)
    // [leaf_type = "broadleaved"] { polygon-pattern-file: url('symbols/leaftype_broadleaved.svg'); }
    // [leaf_type = "needleleaved"] { polygon-pattern-file: url('symbols/leaftype_needleleaved.svg'); }
    // [leaf_type = "mixed"] { polygon-pattern-file: url('symbols/leaftype_mixed.svg'); }
    // [leaf_type = "leafless"] { polygon-pattern-file: url('symbols/leaftype_leafless.svg'); }
    
//     opacity: 0.4; // The entire layer has opacity to handle overlapping forests
//   }

  [class = 'ice'][zoom >= 8] {
    // [zoom >= 8] {
      polygon-fill: @glacier;
      line-width: 0.5;
      line-color: darken(@glacier, 20%);
    //   [way_pixels >= 4]  { polygon-gamma: 0.75; }
    //   [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
  }


  [class=farmland][subclass = 'vineyard'] [zoom >= 5]{
    // [zoom >= 5] {
      polygon-fill: @orchard;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
    // [zoom >= 13] {
      // polygon-pattern-file: url('symbols/vineyard.png');
    //   polygon-pattern-alignment: global;
      // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    // }
  }

  [class=farmland][subclass = 'orchard'][zoom >= 5] {
    // [zoom >= 5] {
      polygon-fill: @orchard;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
    // [zoom >= 13] {
      // polygon-pattern-file: url('symbols/orchard.png');
    //   polygon-pattern-alignment: global;
    //   [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
    //   [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
    // }
  }


  [class = 'landfill'] [zoom >= 10]{
    // [zoom >= 10] {
      polygon-fill: #b6b592;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
  }

  [class = 'rock'][zoom >= 5]{
    [subclass = 'bare_rock']  {
      polygon-fill: @rock;
    }
    [subclass = 'scree'], [subclass = 'shingle']  {
      polygon-fill: @bare_ground;
    }
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
  [class = 'park'][zoom >= 10] {
    // [zoom >= 10] {
      // ::grass {
        polygon-fill: @park;
      // }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
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

  [class = 'farmland'][zoom >= 5],
  [class = 'greenhouse_horticulture'][zoom >= 5] {
    // [zoom >= 5]  {
      polygon-fill: @farmland;
      [zoom >= 16] {
        line-width: .5;
        line-color: @farmland-line;
      }
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    // }
  }

  [class = 'grass'][zoom >= 5]{
    // ::grass {
      [subclass = 'garden'][zoom >= 10] {
        // [zoom >= 10] {
          polygon-fill: @grass;
          // [way_pixels >= 4]  { polygon-gamma: 0.75; }
          // [way_pixels >= 64] { polygon-gamma: 0.3;  }
        // }
        // [zoom >= 13] {
          // polygon-pattern-file: url('symbols/plant_nursery.png');
          // polygon-pattern-opacity: 0.6;
        //   polygon-pattern-alignment: global;
          // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
          // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
        // }
      }
      [subclass = 'park'][zoom >= 10] {
        // [zoom >= 10] {
          // ::grass {
            polygon-fill: @park;
          // }
          // [way_pixels >= 4]  { polygon-gamma: 0.75; }
          // [way_pixels >= 64] { polygon-gamma: 0.3;  }
        // }
      }
      [subclass = 'grassland'],
      [subclass = 'meadow'],
      [subclass = 'grass'],
      [subclass = 'village_green']{
        polygon-fill: @grass;

      }
      [subclass = 'heath'] {
        polygon-fill: @heath;

      }
      [subclass = 'fell'] {
        polygon-fill: @fell;

      }

      [subclass = 'scrub'] {
        polygon-fill:@scrub;
      }
    // }
    [subclass = 'allotments'][zoom >= 10]/* ::grass */ {
      // [zoom >= 10] {
        polygon-fill: @allotments;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      // }
      // [zoom >= 13] {
        // polygon-pattern-file: url('symbols/allotments.png');
      //   polygon-pattern-alignment: global;
        // [way_pixels >= 4]  { polygon-pattern-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-pattern-gamma: 0.3;  }
      // }
      [zoom >= 16] {
        line-width: 0.5;
        line-color: desaturate(darken(@allotments, 10%), 10%);
        [name != null] {
          line-width: 0.7;
        }
      }
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

  // [class = 'heath'][zoom >= 5] {
  //   polygon-fill: @heath;
  //   // [way_pixels >= 4]  { polygon-gamma: 0.75; }
  //   // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  // }

  // [class = 'scrub'][zoom >= 5] {
  //   polygon-fill: @scrub;
  //   // [way_pixels >= 4]  { polygon-gamma: 0.75; }
  //   // [way_pixels >= 64] { polygon-gamma: 0.3;  }
  // }

  [class=wetland][zoom >= 5] {
    
    [subclass = 'swamp'] {
      polygon-fill: @forest;
      // [way_pixels >= 4]  { polygon-gamma: 0.75; }
      // [way_pixels >= 64] { polygon-gamma: 0.3;  }
    }
  
    [subclass = 'bog'],
    [subclass = 'string_bog'] {
      // [zoom >= 5] {
        polygon-fill: @heath;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      // }
    }
  
    [subclass = 'wet_meadow'],
    [subclass = 'fen'],
    [subclass = 'marsh'] {
      // [zoom >= 5] {
        polygon-fill: @grass;
        // [way_pixels >= 4]  { polygon-gamma: 0.75; }
        // [way_pixels >= 64] { polygon-gamma: 0.3;  }
      // }
    }
    [zoom >= 13] {
      polygon-pattern-file: url('symbols/wetland.png');
      [subclass = 'marsh'],
      [subclass = 'saltmarsh'],
      [subclass = 'wet_meadow'] {
        polygon-pattern-file: url('symbols/marsh.png');
        
      }
      [subclass = 'reedbed'] {
        polygon-pattern-file: url('symbols/reed.png');
        
      }
      [subclass = 'mangrove'] {
        polygon-pattern-file: url('symbols/mangrove.png');
        
      }
      [subclass = 'swamp'] {
        polygon-pattern-file: url('symbols/swamp.png');
        
      }
      [subclass = 'bog'],
      [subclass = 'fen'],
      [subclass = 'string_bog'] {
        polygon-pattern-file: url('symbols/bog.png');
        
      }
    }
    
  }
}


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

@building-line: darken(@building-fill, 15%);  // Lch(70, 9, 66)
@building-low-zoom: darken(@building-fill, 4%);

@building-major-fill: darken(@building-fill, 10%);  // Lch(75, 8, 67)
@building-major-line: darken(@building-major-fill, 15%);  // Lch(61, 13, 65)
@building-major-z15: darken(@building-major-fill, 5%);  // Lch(70, 9, 66)
@building-major-z14: darken(@building-major-fill, 10%);  // Lch(66, 11, 65)

@entrance-permissive: darken(@building-line, 15%);
@entrance-normal: @building-line;

#building['nuti::buildings'>0] [zoom >= 13] {
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
      line-width: linear([view::zoom], (15, 0), (16, .75));
    }
    // [class = 'school'],
    // [class = 'place_of_worship'],
    // [class = 'terminal'],
    // [class = 'station'],
    // [class = 'train_station'],
    // [class = 'station'] {
    //   polygon-fill: @building-major-z14;
    //   [zoom >= 15] {
    //     polygon-fill: @building-major-z15;
    //     line-color: @building-major-line;
    //     [zoom >= 16] {
    //       polygon-fill: @building-major-fill;
    //     }
    //   }
    // }
}