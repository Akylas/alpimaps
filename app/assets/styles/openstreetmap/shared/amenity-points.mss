@marina-text: #576ddf; // also swimming_pool
@wetland-text: darken(#4aa5fa, 25%); /* Also for marsh and mud */
@shop-icon: #ac39ac;
@shop-text: #939;
@transportation-icon: #0092da;
@transportation-text: #0066ff;
@accommodation-icon: @transportation-icon;
@accommodation-text: @transportation-text;
@airtransport: #8461C4; //also ferry_terminal
@health-color: #BF0000;
@amenity-brown: #734a08;
@gastronomy-icon: #C77400;
@gastronomy-text: darken(@gastronomy-icon, 5%);
@memorials: @amenity-brown;
@culture: @amenity-brown;
@public-service: @amenity-brown;
@office: #4863A0;
@man-made-icon: #666666;
@advertising-grey: @man-made-icon;
@barrier-icon: #3f3f3f;
@landform-color: #d08f55;
@leisure-green: darken(@park, 60%);
@aboriginal: #82643a;
@religious-icon: #000000;

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

@standard-font-size: 10;
@standard-wrap-width: 30; // 3 em
@standard-line-spacing-size: -1.5; // -0.15 em
@standard-font: @book-fonts;

#pois {
  [kind = 'alpine_hut'][zoom >= 13],
  [kind = 'wilderness_hut'][zoom >= 13],
  [kind = 'shelter'][zoom >= 16] {
    marker-file: url('symbols/amenity/shelter.svg');
    [kind = 'wilderness_hut'] {
      marker-file: url('symbols/tourism/wilderness_hut.svg');
    }
    [kind = 'alpine_hut'] {
      marker-file: url('symbols/tourism/alpinehut.svg');
    }
    [kind = 'shelter'] {
      marker-fill: @man-made-icon;
    }
    marker-fill: @accommodation-icon;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'atm'][zoom >= 19] {
    marker-file: url('symbols/amenity/atm.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bureau_de_change'][zoom >= 17] {
    marker-file: url('symbols/amenity/bureau_de_change.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bank'][zoom >= 17] {
    marker-file: url('symbols/amenity/bank.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bar'][zoom >= 17],
  [kind = 'biergarten'][zoom >= 17],
  [kind = 'cafe'][zoom >= 17],
  [kind = 'fast_food'][zoom >= 17],
  [kind = 'food_court'][zoom >= 17],
  [kind = 'ice_cream'][zoom >= 17],
  [kind = 'pub'][zoom >= 17],
  [kind = 'restaurant'][zoom >= 17] {
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @gastronomy-icon;
    [kind != 'food_court'][zoom = 17] {
      marker-width: 4;
      marker-line-width: 0;
    }
    [kind = 'bar'][zoom >= 18] {
      marker-file: url('symbols/amenity/bar.svg');
    }
    [kind = 'biergarten'][zoom >= 18] {
      marker-file: url('symbols/amenity/biergarten.svg');
    }
    [kind = 'cafe'][zoom >= 18] {
      marker-file: url('symbols/amenity/cafe.svg');
    }
    [kind = 'fast_food'][zoom >= 18] {
      marker-file: url('symbols/amenity/fast_food.svg');
    }
    [kind = 'food_court'][zoom >= 17],
    [kind = 'restaurant'][zoom >= 18] {
      marker-file: url('symbols/amenity/restaurant.svg');
    }
    [kind = 'ice_cream'][zoom >= 18] {
      marker-file: url('symbols/shop/ice_cream.svg');
    }
    [kind = 'pub'][zoom >= 18] {
      marker-file: url('symbols/amenity/pub.svg');
    }
  }

  [kind = 'internet_cafe'][zoom >= 17] {
    marker-file: url('symbols/amenity/internet_cafe.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bbq'][zoom >= 17] {
    marker-file: url('symbols/amenity/bbq.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'public_bookcase'][zoom >= 19] {
    marker-file: url('symbols/amenity/public_bookcase.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bicycle_rental'][zoom >= 17] {
    marker-file: url('symbols/amenity/rental_bicycle.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bus_stop'] {
    [zoom >= 16] {
      marker-file: url('symbols/square.svg');
      marker-fill: @transportation-icon;
      marker-placement: interior;
      marker-width: 6;
      marker-clip: false;
    }
    [zoom >= 17] {
      marker-file: url('symbols/highway/bus_stop.12.svg');
      marker-width: 12;
    }
  }

  [kind = 'elevator'][zoom >= 18] {
    [access = null],
    [access = 'yes'] {
      marker-file: url('symbols/highway/elevator.12.svg');
      marker-fill: @transportation-icon;
      marker-placement: interior;
    }
  }

  [kind = 'bus_station'][zoom >= 16] {
    marker-file: url('symbols/amenity/bus_station.svg');
    // use colors from SVG to allow for white background
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'taxi'][zoom >= 17] {
    marker-file: url('symbols/amenity/taxi.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'vending_machine'][zoom >= 19] {
    [vending = 'excrement_bags'] {
      marker-file: url('symbols/amenity/excrement_bags.svg');
    }
    [vending = 'parking_tickets'] {
      marker-file: url('symbols/amenity/parking_tickets.svg');
    }
    [vending = 'public_transport_tickets'] {
      marker-file: url('symbols/amenity/public_transport_tickets.svg');
    }
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'traffic_signals'][zoom >= 17] {
    marker-file: url('symbols/highway/traffic_light.13.svg');
    marker-fill: #545454;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_toll_booth'][zoom >= 16] {
    marker-file: url('symbols/barrier/toll_booth.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'artwork'][zoom >= 17] {
    [artwork_type != 'statue'] {
      marker-file: url('symbols/tourism/artwork.svg');
    }
    [artwork_type = 'statue'] {
      marker-file: url('symbols/historic/statue.svg');
    }
    [artwork_type = 'bust'] {
      marker-file: url('symbols/historic/bust.svg');
    }
    marker-fill: @memorials;
    marker-placement: interior;
  }

  [kind = 'camp_site'][zoom >= 16] {
    marker-file: url('symbols/tourism/camping.svg');
    marker-fill: @accommodation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  // Ford tagging on points - ford on lines is defined later
  [kind = 'ford'][zoom >= 16] {
    marker-file: url('symbols/highway/ford.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'caravan_site'][zoom >= 16] {
    marker-file: url('symbols/tourism/caravan_park.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @accommodation-icon;
  }

  [kind = 'car_rental'][zoom >= 17] {
    marker-file: url('symbols/amenity/rental_car.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'car_wash'][zoom >= 17] {
    marker-file: url('symbols/amenity/car_wash.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'chalet'][zoom >= 17] {
    marker-file: url('symbols/tourism/chalet.svg');
    marker-fill: @accommodation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'cinema'][zoom >= 16] {
    marker-file: url('symbols/amenity/cinema.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'public_bath'][zoom >= 17] {
    marker-file: url('symbols/amenity/public_bath.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'nightclub'][zoom >= 17] {
    marker-file: url('symbols/amenity/nightclub.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'fire_station'][zoom >= 16] {
    marker-file: url('symbols/amenity/firestation.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'fountain'] {
    ::basin {
      [zoom = 17] {
        marker-fill: @water-color;
        marker-allow-overlap: true;
        marker-line-width: 0;
        marker-width: 10;
        marker-height: 10;
        marker-ignore-placement: true;
      }
    }
    ::nozzle {
      [zoom = 17] {
        nozzle/marker-fill: @marina-text;
        nozzle/marker-line-width: 0;
        nozzle/marker-width: 3;
        nozzle/marker-height: 3;
      }
      [zoom >= 18] {
        nozzle/marker-file: url('symbols/amenity/fountain.svg');
        nozzle/marker-fill: @marina-text;
        nozzle/marker-placement: interior;
        nozzle/marker-clip: false;
      }
    }
  }

  [kind = 'charging_station'][zoom >= 17] {
    marker-file: url('symbols/amenity/charging_station.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'fuel'][zoom >= 17] {
    marker-file: url('symbols/amenity/fuel.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'guest_house'][zoom >= 17] {
    marker-file: url('symbols/tourism/guest_house.svg');
    marker-fill: @accommodation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'apartment'][zoom >= 18] {
    marker-file: url('symbols/tourism/apartment.svg');
    marker-fill: @accommodation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'bicycle_repair_station'][zoom >= 19] {
    marker-file: url('symbols/amenity/bicycle_repair_station.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'casino'][zoom >= 17] {
    marker-file: url('symbols/amenity/casino.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'gallery'][zoom >= 17] {
    marker-file: url('symbols/shop/art.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @amenity-brown;
  }

  [kind = 'hostel'][zoom >= 17] {
    marker-file: url('symbols/tourism/hostel.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @accommodation-icon;
  }

  [kind = 'hotel'][zoom >= 17] {
    marker-file: url('symbols/tourism/hotel.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @accommodation-icon;
  }

  [kind = 'motel'][zoom >= 17] {
    marker-file: url('symbols/tourism/motel.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @accommodation-icon;
  }

  [kind = 'information'][zoom >= 19],
  [kind = 'information']["information"='office'][zoom >= 17] {
    marker-file: url('symbols/tourism/information.svg');
    [information = 'audioguide'] {
      marker-file: url('symbols/tourism/audioguide.svg');
    }
    [information = 'board'] {
      marker-file: url('symbols/tourism/board.svg');
    }
    [information = 'guidepost'] {
      marker-file: url('symbols/tourism/guidepost.svg');
    }
    [information = 'office'] {
      marker-file: url('symbols/tourism/office.svg');
      marker-fill: @amenity-brown;
    }
    [information = 'map'],
    [information = 'tactile_map'],
    [information = 'tactile_model'] {
      marker-file: url('symbols/tourism/map.svg');
    }
    [information = 'terminal'] {
      marker-file: url('symbols/tourism/terminal.svg');
    }
      marker-placement: interior;
      marker-fill: @man-made-icon;
      marker-clip: false;
  }

  [kind = 'embassy'][zoom >= 17] {
    marker-file: url('symbols/amenity/embassy.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'library'][zoom >= 16] {
    marker-file: url('symbols/amenity/library.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'courthouse'][zoom >= 16] {
    marker-file: url('symbols/amenity/courthouse.svg');
    marker-placement: interior;
    marker-fill: @public-service;
    marker-clip: false;
  }

  [kind = 'community_centre'][zoom >= 17] {
    marker-file: url('symbols/amenity/community_centre.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'shower'][zoom >= 18] {
    marker-file: url('symbols/amenity/shower.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'social_facility'][zoom >= 17] {
    marker-file: url('symbols/amenity/social_facility.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'townhall'][zoom >= 16] {
    marker-file: url('symbols/amenity/town_hall.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'mast']["tower:type" != 'lighting'],
  [kind = 'mast']["tower:type" = 'lighting'][zoom >= 18]   {
    [zoom >= 14][height >= 160],
    [zoom >= 15][height >= 80],
    [zoom >= 16][height >= 40],
    [zoom >= 17][height >= 20],
    [zoom >= 18] {
      marker-file: url('symbols/man_made/mast.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
      marker-clip: false;
      ["tower:type" = 'lighting'] {
        marker-file: url('symbols/man_made/mast_lighting.svg');
      }
      ["tower:type" = 'communication'] {
        marker-file: url('symbols/man_made/mast_communications.svg');
      }
    }
  }

  [kind = 'tower']["tower:type" = 'cooling'][zoom >= 15],
  [kind = 'tower']["tower:type" = 'lighting'][zoom >= 18],
  [kind = 'tower']["tower:type" = 'bell_tower'][zoom >= 18],
  [kind = 'tower']["tower:type" = 'watchtower'][zoom >= 18],
  [kind = 'tower']["tower:type" != 'cooling']["tower:type" != 'lighting']["tower:type" != 'bell_tower']["tower:type" != 'watchtower'] {
    [zoom >= 14][height >= 160],
    [zoom >= 15][height >= 80],
    [zoom >= 16][height >= 40],
    [zoom >= 17] {
      marker-file: url('symbols/man_made/tower_generic.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
      marker-clip: false;
      ["tower:type" = 'defensive'] {
        marker-file: url('symbols/man_made/tower_defensive.svg');
      }
      ["tower:type" = 'observation'],
      ["tower:type" = 'watchtower'] {
        marker-file: url('symbols/man_made/tower_observation.svg');
      }
      ["tower:type" = 'bell_tower'] {
        marker-file: url('symbols/man_made/bell_tower.svg');
      }
      ["tower:type" = 'cooling'] {
        marker-file: url('symbols/man_made/tower_cooling.svg');
      }
      ["tower:construction" = 'lattice'] {
        marker-file: url('symbols/man_made/tower_lattice.svg');
      }
      ["tower:construction" = 'dish'] {
        marker-file: url('symbols/man_made/tower_dish.svg');
      }
      ["tower:construction" = 'dome'] {
        marker-file: url('symbols/man_made/tower_dome.svg');
      }
      ["tower:type" = 'communication'] {
        marker-file: url('symbols/man_made/tower_cantilever_communication.svg');
        ["tower:construction" = 'lattice'] {
          marker-file: url('symbols/man_made/tower_lattice_communication.svg');
        }
        ["tower:construction" = 'dish'] {
          marker-file: url('symbols/man_made/tower_dish.svg');
        }
        ["tower:construction" = 'dome'] {
          marker-file: url('symbols/man_made/tower_dome.svg');
        }
      }
      ["tower:type" = 'lighting'] {
        marker-file: url('symbols/man_made/tower_lighting.svg');
        ["tower:construction" = 'lattice'] {
          marker-file: url('symbols/man_made/tower_lattice_lighting.svg');
        }
      }
    }
  }

  [kind = 'communications_tower'][zoom >= 14] {
    marker-file: url('symbols/man_made/communications_tower.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'chimney'] {
    [zoom >= 16][height > 50],
    [zoom >= 17][height > 30],
    [zoom >= 18] {
      marker-file: url('symbols/man_made/chimney.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
      marker-clip: false;
    }
  }

  [kind = 'crane'] {
    [zoom >= 16][height > 50],
    [zoom >= 17] {
      marker-file: url('symbols/man_made/crane.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
      marker-clip: false;
    }
  }

  [kind = 'telescope']["telescope:type" != 'optical']["telescope:type" != null] {
    [zoom >= 14]["telescope:diameter" >= 60],
    [zoom >= 15]["telescope:diameter" >= 30],
    [zoom >= 16] {
      marker-file: url('symbols/man_made/telescope_dish.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
      marker-clip: false;
    }
  }

  [kind = 'telescope']["telescope:type" = 'optical'],
  [kind = 'telescope']["telescope:type" = null], {
    [zoom >= 14]["telescope:diameter" >= 8],
    [zoom >= 15]["telescope:diameter" >= 4],
    [zoom >= 16]["telescope:diameter" >= 2],
    [zoom >= 17] {
      marker-file: url('symbols/man_made/telescope_dome.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
      marker-clip: false;
    }
  }

  [kind = 'historic_city_gate'][zoom >= 17] {
    marker-file: url('symbols/historic/city_gate.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'museum'][zoom >= 16] {
    marker-file: url('symbols/tourism/museum.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'parking'][way_pixels > 900][zoom >= 14],
  [kind = 'bicycle_parking'][way_pixels > 900][zoom >= 14],
  [kind = 'motorcycle_parking'][way_pixels > 900][zoom >= 14],
  [kind = 'parking_entrance'][zoom >= 18] {
    [kind = 'parking'] {
      marker-file: url('symbols/amenity/parking.svg');
    }
    [kind = 'bicycle_parking'] {
      marker-file: url('symbols/amenity/bicycle_parking.svg');
    }
    [kind = 'motorcycle_parking'] {
      marker-file: url('symbols/amenity/motorcycle_parking.svg');
    }
    [kind = 'parking_entrance'] {
      marker-file: url('symbols/amenity/parking_entrance.svg');
    }
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @transportation-icon;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'clinic'][zoom >= 17],
  [kind = 'doctors'][zoom >= 17] {
    marker-file: url('symbols/amenity/doctors.svg');
    marker-fill: @health-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'dentist'][zoom >= 17] {
    [zoom >= 17][zoom < 18] {
      marker-width: 4;
      marker-line-width: 0;
    }
    [zoom >= 18] {
      marker-file: url('symbols/amenity/dentist.svg');
    }
    marker-fill: @health-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'hospital'][zoom >= 15] {
    marker-file: url('symbols/amenity/hospital.svg');
    marker-fill: @health-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'pharmacy'][zoom >= 17] {
    marker-file: url('symbols/amenity/pharmacy.svg');
    marker-fill: @health-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'veterinary'][zoom >= 17] {
    marker-file: url('symbols/amenity/veterinary.svg');
    marker-fill: @health-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'place_of_worship'][zoom >= 16] {
    marker-file: url('symbols/amenity/place_of_worship.svg');
    marker-fill: @religious-icon;
    marker-placement: interior;
    marker-clip: false;
    [religion = 'christian'] {
      marker-file: url('symbols/religion/christian.svg');
      [denomination = 'jehovahs_witness']{
        marker-file: url('symbols/amenity/place_of_worship.svg');
      }
    }
    [religion = 'muslim'] {
      marker-file: url('symbols/religion/muslim.svg');
    }
    [religion = 'sikh'] {
      marker-file: url('symbols/religion/sikhist.svg');
    }
    [religion = 'jewish'] {
      marker-file: url('symbols/religion/jewish.svg');
    }
    [religion = 'hindu'] {
      marker-file: url('symbols/religion/hinduist.svg');
    }
    [religion = 'buddhist'] {
      marker-file: url('symbols/religion/buddhist.svg');
    }
    [religion = 'shinto'] {
      marker-file: url('symbols/religion/shintoist.svg');
    }
    [religion = 'taoist'] {
      marker-file: url('symbols/religion/taoist.svg');
    }
  }

  [kind = 'cross'][zoom >= 17],
  [kind = 'historic_wayside_cross'][zoom >= 17] {
    marker-file: url('symbols/man_made/cross.svg');
    marker-fill: @religious-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'storage_tank'][zoom >= 18],
  [kind = 'silo'][zoom >= 18] {
    marker-file: url('symbols/man_made/storage_tank.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'historic_wayside_shrine'][zoom >= 17] {
    marker-file: url('symbols/historic/shrine.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'police'][zoom >= 16] {
    marker-file: url('symbols/amenity/police.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'vehicle_inspection'][zoom >= 17] {
    marker-file: url('symbols/amenity/vehicle_inspection.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'post_box'][zoom >= 19] {
    marker-file: url('symbols/amenity/post_box.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'post_office'][zoom >= 17] {
    marker-file: url('symbols/amenity/post_office.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'recycling'][recycling_type = 'centre'][zoom >= 17],
  [kind = 'recycling'][zoom >= 19] {
    marker-file: url('symbols/amenity/recycling.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'telephone'][zoom >= 17] {
    marker-file: url('symbols/amenity/telephone.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'emergency_phone'][zoom >= 19] {
    marker-file: url('symbols/amenity/emergency_phone.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'theatre'][zoom >= 16] {
    marker-file: url('symbols/amenity/theatre.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'arts_centre'][zoom >= 17] {
    marker-file: url('symbols/amenity/arts_centre.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'toilets'] {
    [access = 'yes'][zoom >= 18],
    [zoom >= 19] {
      marker-file: url('symbols/amenity/toilets.svg');
      marker-fill: @amenity-brown;
      marker-placement: interior;
      marker-clip: false;
      [access != ''][access != 'permissive'][access != 'yes'] {
        marker-opacity: 0.33;
      }
    }
  }

  [kind = 'drinking_water'][zoom >= 17] {
    marker-file: url('symbols/amenity/drinking_water.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'prison'][zoom >= 17] {
    marker-file: url('symbols/amenity/prison.svg');
    marker-fill: @public-service;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'nursing_home'],
  [kind = 'childcare'] {
    [zoom >= 17] {
      marker-width: 4;
      [zoom >= 18] {
        marker-width: 6;
      }
      marker-line-width: 0;
      marker-placement: interior;
      marker-clip: false;
      marker-fill: darken(@societal_amenities, 80%);
    }
  }

  [kind = 'driving_school'][zoom >= 17] {
    marker-width: 4;
    [zoom >= 18] {
      marker-width: 6;
    }
    marker-line-width: 0;
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @shop-icon;
  }

  [kind = 'viewpoint'][zoom >= 16] {
    marker-file: url('symbols/tourism/viewpoint.svg');
    marker-placement: interior;
    marker-fill: @amenity-brown;
    marker-clip: false;
  }

  [kind = 'water_tower'][zoom >= 17] {
    marker-file: url('symbols/man_made/water_tower.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'historic_memorial'][memorial = null][zoom >= 17],
  [kind = 'historic_memorial'][memorial != null][memorial != 'blue_plaque'][memorial != 'bust'][memorial != 'plaque'][memorial != 'stele'][memorial != 'stone'][zoom >= 17],
  [kind = 'historic_memorial'][memorial = 'statue'][zoom >= 17],
  [kind = 'historic_memorial'][memorial = 'bust'][zoom >= 18],
  [kind = 'historic_memorial'][memorial = 'stele'][zoom >= 18],
  [kind = 'historic_memorial'][memorial = 'stone'][zoom >= 18],
  [kind = 'historic_memorial'][memorial = 'blue_plaque'][zoom >= 19],
  [kind = 'historic_memorial'][memorial = 'plaque'][zoom >= 19] {
    marker-file: url('symbols/historic/memorial.svg');
    [memorial = 'bust']{
      marker-file: url('symbols/historic/bust.svg');
    }
    [memorial = 'blue_plaque'],
    [memorial = 'plaque'] {
      marker-file: url('symbols/historic/plaque.svg');
    }
    [memorial = 'statue'] {
      marker-file: url('symbols/historic/statue.svg');
    }
    [memorial = 'stone'] {
      marker-file: url('symbols/historic/stone.svg');
    }
    marker-fill: @memorials;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'obelisk'][zoom >= 17] {
    marker-file: url('symbols/historic/obelisk.svg');
    marker-fill: @memorials;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'historic_monument'][zoom >= 16] {
    marker-file: url('symbols/historic/monument.svg');
    marker-fill: @memorials;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'historic_fort'][zoom >= 16] {
    marker-file: url('symbols/historic/fort.svg');
    marker-fill: @memorials;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'historic_castle'][castle_type != 'stately'][castle_type != 'manor'][zoom >= 15],
  [kind = 'historic_castle'][castle_type = 'stately'][zoom >= 16],
  [kind = 'historic_castle'][castle_type = 'manor'][zoom >= 16],
  [kind = 'historic_manor'][zoom >= 16] {
    marker-file: url('symbols/historic/castle.svg');
    marker-fill: @memorials;
    marker-placement: interior;
    marker-clip: false;
    [castle_type = 'palace'],
    [castle_type = 'stately'] {
      marker-file: url('symbols/historic/palace.svg');
    }
    [castle_type = 'manor'],
    [kind = 'historic_manor'] {
      marker-file: url('symbols/historic/manor.svg');
    }
    [castle_type = 'fortress'],
    [castle_type = 'defensive'],
    [castle_type = 'castrum'],
    [castle_type = 'shiro'],
    [castle_type = 'kremlin'] {
      marker-file: url('symbols/historic/fortress.svg');
    }
  }

  [kind = 'historic_archaeological_site'][zoom >= 16] {
    marker-file: url('symbols/historic/archaeological_site.svg');
    marker-fill: @culture;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'marketplace'][zoom >= 16][way_pixels > 3000],
  [kind = 'marketplace'][zoom >= 17] {
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @shop-icon;
    marker-file: url('symbols/shop/marketplace.svg');
  }

  [kind = 'shop'] {
    [shop != 'mall'][shop != 'massage'][zoom >= 17],
    [shop = 'supermarket'][zoom >= 16],
    [shop = 'department_store'][zoom >= 16] {
      marker-placement: interior;
      marker-clip: false;
      marker-fill: @shop-icon;
    }

    [zoom >= 17][zoom < 18][shop != 'supermarket'][shop != 'department_store'][shop != 'mall'][shop != 'massage'] {
      marker-width: 4;
      marker-line-width: 0;
    }

    [shop = 'other'][zoom >= 18] {
      marker-width: 6;
      marker-line-width: 0;
    }

    [shop = 'supermarket'][zoom >= 16] {
      marker-file: url('symbols/shop/supermarket.svg');
    }

    [shop = 'art'][zoom >= 18] {
      marker-file: url('symbols/shop/art.svg');
    }

    [shop = 'bag'][zoom >= 18] {
      marker-file: url('symbols/shop/bag.svg');
    }

    [shop = 'bakery'][zoom >= 18] {
      marker-file: url('symbols/shop/bakery.svg');
    }

    [shop = 'beauty'][zoom >= 18] {
      marker-file: url('symbols/shop/beauty.svg');
    }

    [shop = 'bed'][zoom >= 18] {
      marker-file: url('symbols/shop/bed.svg');
    }

    [shop = 'beverages'][zoom >= 18] {
      marker-file: url('symbols/shop/beverages.svg');
    }

    [shop = 'bookmaker'][zoom >= 18] {
      marker-file: url('symbols/shop/bookmaker.svg');
    }

    [shop = 'books'][zoom >= 18] {
      marker-file: url('symbols/amenity/library.svg');
    }

    [shop = 'butcher'][zoom >= 18] {
      marker-file: url('symbols/shop/butcher.svg');
    }

    [shop = 'carpet'][zoom >= 18] {
      marker-file: url('symbols/shop/carpet.svg');
    }

    [shop = 'charity'][zoom >= 18] {
      marker-file: url('symbols/shop/charity.svg');
    }

    [shop = 'chemist'][zoom >= 18] {
      marker-file: url('symbols/shop/chemist.svg');
    }

    [shop = 'clothes'],
    [shop = 'fashion'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/clothes.svg');
      }
    }

    [shop = 'coffee'][zoom >= 18] {
      marker-file: url('symbols/shop/coffee.svg');
    }

    [shop = 'computer'][zoom >= 18] {
      marker-file: url('symbols/shop/computer.svg');
    }

    [shop = 'convenience'][zoom >= 18] {
      marker-file: url('symbols/shop/convenience.svg');
    }

    [shop = 'chocolate'][zoom >= 18],
    [shop = 'confectionery'][zoom >= 18],
    [shop = 'pastry'][zoom >= 18] {
      marker-file: url('symbols/shop/confectionery.svg');
    }

    [shop = 'copyshop'][zoom >= 18] {
      marker-file: url('symbols/shop/copyshop.svg');
    }

    [shop = 'cosmetics'],
    [shop = 'perfumery'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/perfumery.svg');
      }
    }

    [shop = 'deli'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/deli.svg');
      }
    }

    [shop = 'department_store'][zoom >= 16] {
      marker-file: url('symbols/shop/department_store.svg');
    }

    [shop = 'doityourself'],
    [shop = 'hardware'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/diy.svg');
      }
    }

    [shop = 'dry_cleaning'],
    [shop = 'laundry'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/laundry.svg');
      }
    }

    [shop = 'fabric'][zoom >= 18] {
      marker-file: url('symbols/shop/fabric.svg');
    }

    [shop = 'fishmonger'],
    [shop = 'seafood'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/seafood.svg');
      }
    }

    [shop = 'florist'][zoom >= 18] {
      marker-file: url('symbols/shop/florist.svg');
    }

    [shop = 'garden_centre'][zoom >= 18] {
      marker-file: url('symbols/shop/garden_centre.svg');
    }

    [shop = 'greengrocer'],
    [shop = 'farm'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/greengrocer.svg');
      }
    }

    [shop = 'hairdresser'][zoom >= 18] {
      marker-file: url('symbols/shop/hairdresser.svg');
    }

    [shop = 'hifi'][zoom >= 18] {
      marker-file: url('symbols/shop/hifi.svg');
    }

    [shop = 'houseware'][zoom >= 18] {
      marker-file: url('symbols/shop/houseware.svg');
    }

    [shop = 'ice_cream'][zoom >= 18] {
      marker-file: url('symbols/shop/ice_cream.svg');
    }

    [shop = 'car'][zoom >= 18] {
      marker-file: url('symbols/shop/car.svg');
    }

    [shop = 'car_parts'][zoom >= 18] {
      marker-file: url('symbols/shop/car_parts.svg');
    }

    [shop = 'car_repair'][zoom >= 18] {
      marker-file: url('symbols/shop/car_repair.svg');
      marker-fill: @amenity-brown;
    }

    [shop = 'dairy'][zoom >= 18] {
      marker-file: url('symbols/shop/dairy.svg');
    }

    [shop = 'bicycle'][zoom >= 18] {
      marker-file: url('symbols/shop/bicycle.svg');
    }

    [shop = 'pet'][zoom >= 18] {
      marker-file: url('symbols/shop/pet.svg');
    }

    [shop = 'photo'],
    [shop = 'photo_studio'],
    [shop = 'photography'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/photo.svg');
      }
    }

    [shop = 'paint'][zoom >= 18] {
      marker-file: url('symbols/shop/paint.svg');
    }

    [shop = 'shoes'][zoom >= 18] {
      marker-file: url('symbols/shop/shoes.svg');
    }

    [shop = 'gift'][zoom >= 18] {
      marker-file: url('symbols/shop/gift.svg');
    }

    [shop = 'electronics'][zoom >= 18] {
      marker-file: url('symbols/shop/electronics.svg');
    }

    [shop = 'alcohol'],
    [shop = 'wine'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/alcohol.svg');
      }
    }

    [shop = 'optician'][zoom >= 18] {
      marker-file: url('symbols/shop/optician.svg');
    }

    [shop = 'outdoor'][zoom >= 18] {
      marker-file: url('symbols/shop/outdoor.svg');
    }

    [shop = 'furniture'][zoom >= 18] {
      marker-file: url('symbols/shop/furniture.svg');
    }

    [shop = 'interior_decoration'][zoom >= 18] {
      marker-file: url('symbols/shop/interior_decoration.svg');
    }

    [shop = 'massage'][zoom >= 18] {
      marker-file: url('symbols/shop/massage.svg');
      marker-fill: @leisure-green;
    }

    [shop = 'medical_supply'][zoom >= 18]{
      marker-file: url('symbols/shop/medical_supply.svg');
    }

    [shop = 'mobile_phone'][zoom >= 18] {
      marker-file: url('symbols/shop/mobile_phone.svg');
    }

    [shop = 'motorcycle'][zoom >= 18] {
      marker-file: url('symbols/motorcycle.svg');
    }

    [shop = 'music'][zoom >= 18] {
      marker-file: url('symbols/shop/music.svg');
    }

    [shop = 'musical_instrument'][zoom >= 18] {
      marker-file: url('symbols/shop/musical_instrument.svg');
    }

    [shop = 'kiosk'],
    [shop = 'newsagent'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/newsagent.svg');
      }
    }

    [shop = 'jewelry'],
    [shop = 'jewellery'] {
      [zoom >= 18] {
        marker-file: url('symbols/shop/jewelry.svg');
      }
    }

    [shop = 'toys'][zoom >= 18] {
      marker-file: url('symbols/shop/toys.svg');
    }

    [shop = 'travel_agency'][zoom >= 18] {
      marker-file: url('symbols/shop/travel_agency.svg');
    }

    [shop = 'second_hand'][zoom >= 18] {
      marker-file: url('symbols/shop/second_hand.svg');
    }

    [shop = 'sports'][zoom >= 18] {
      marker-file: url('symbols/shop/sports.svg');
    }

    [shop = 'stationery'][zoom >= 18] {
      marker-file: url('symbols/shop/stationery.svg');
    }

    [shop = 'tobacco'][zoom >= 18] {
      marker-file: url('symbols/shop/tobacco.svg');
    }

    [shop = 'tea'][zoom >= 18] {
      marker-file: url('symbols/shop/tea.svg');
    }

    [shop = 'ticket'][zoom >= 18] {
      marker-file: url('symbols/shop/ticket.svg');
    }

    [shop = 'trade'][zoom >= 18] {
      marker-file: url('symbols/shop/trade.svg');
    }

    [shop = 'wholesale'][zoom >= 18] {
      marker-file: url('symbols/shop/trade.svg');
    }

    [shop = 'tyres'][zoom >= 18] {
      marker-file: url('symbols/shop/tyres.svg');
    }

    [shop = 'variety_store'][zoom >= 18] {
      marker-file: url('symbols/shop/variety_store.svg');
    }

    [shop = 'video'][zoom >= 18] {
      marker-file: url('symbols/shop/video.svg');
    }

    [shop = 'video_games'][zoom >= 18] {
      marker-file: url('symbols/shop/video_games.svg');
    }
  }

  [kind = 'advertising_column'][zoom >= 19]{
      marker-file: url('symbols/advertising_column.svg');
      marker-fill: @advertising-grey;
      marker-placement: interior;
      marker-clip: false;
  }

  // office points
  [kind = 'office'][zoom >= 17] {
    marker-width: 4;
    [zoom >= 18] {
      marker-width: 6;
    }
    marker-line-width: 0;
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @office;
  }

  [kind = 'water_park'][zoom >= 17],
  [kind = 'sports_centre'][sport = 'swimming'][zoom >= 17],
  [kind = 'swimming_area'][zoom >= 17] {
    marker-file: url('symbols/leisure/water_park.svg');
    marker-placement: interior;
    marker-fill: @leisure-green;
    marker-clip: false;
  }

  [kind = 'fitness_centre'][zoom >= 17],
  [kind = 'fitness_station'][zoom >= 17] {
    marker-file: url('symbols/leisure/fitness.svg');
    marker-placement: interior;
    marker-fill: @leisure-green;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'dog_park'][zoom >= 17] {
    marker-file: url('symbols/shop/pet.svg');
    marker-placement: interior;
    marker-fill: @leisure-green;
    marker-clip: false;
  }

  [kind = 'playground'][zoom >= 17] {
    marker-file: url('symbols/leisure/playground.svg');
    marker-fill: @leisure-green;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'miniature_golf'][zoom >= 17] {
    marker-file: url('symbols/leisure/miniature_golf.svg');
    marker-fill: @leisure-green;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'golf_course'][zoom >= 15] {
    marker-file: url('symbols/leisure/golf.svg');
    marker-fill: @leisure-green;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'picnic_site'][zoom >= 16] {
    marker-file: url('symbols/tourism/picnic.svg');
    marker-fill: @leisure-green;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'picnic_table'][zoom >= 17] {
    marker-file: url('symbols/tourism/picnic.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'firepit'][zoom >= 17] {
    marker-file: url('symbols/leisure/firepit.svg');
    marker-fill: @amenity-brown;
    marker-placement: interior;
    marker-clip: false;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'sauna'][zoom >= 17] {
     marker-file: url('symbols/leisure/sauna.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
   }

  [kind = 'beach_resort'][zoom >= 16] {
     marker-file: url('symbols/leisure/beach_resort.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
   }

  [kind = 'bowling_alley'][zoom >= 17] {
     marker-file: url('symbols/leisure/bowling_alley.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
   }

  [kind = 'outdoor_seating'][zoom >= 19] {
     marker-file: url('symbols/leisure/outdoor_seating.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
   }

  [kind = 'bird_hide'][zoom >= 17] {
     marker-file: url('symbols/leisure/bird_hide.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
   }

  [kind = 'amusement_arcade'][zoom >= 17] {
     marker-file: url('symbols/leisure/amusement_arcade.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
   }

  [kind = 'fishing'][zoom >= 17] {
     marker-file: url('symbols/leisure/fishing.svg');
     marker-fill: @leisure-green;
     marker-placement: interior;
     marker-clip: false;
  }

  // Slipway tagging on points - slipway on lines is defined later
  [kind = 'slipway'][zoom >= 17] {
    marker-file: url('symbols/leisure/slipway.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'boat_rental'][zoom >= 17] {
    marker-file: url('symbols/amenity/boat_rental.svg');
    marker-fill: @transportation-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'aeroway_helipad'][zoom >= 16] {
    marker-file: url('symbols/helipad.16.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @airtransport;
  }

  [kind = 'aeroway_aerodrome']['access' != 'private']['icao' != null]['iata' != null][zoom >= 10][zoom < 14],
  [kind = 'aeroway_aerodrome'][zoom >= 11][zoom < 14] {
    marker-file: url('symbols/aerodrome.12.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @airtransport;
  }

  [kind = 'ferry_terminal'][zoom >= 15] {
    marker-file: url('symbols/amenity/ferry.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @airtransport;
  }

  [kind = 'lighthouse'][zoom >= 15] {
    marker-file: url('symbols/man_made/lighthouse.svg');
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @man-made-icon;
  }

  [kind = 'peak'][zoom >= 11] {
    marker-file: url('symbols/natural/peak.svg');
    marker-fill: @landform-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'volcano'][zoom >= 11] {
    marker-file: url('symbols/natural/peak.svg');
    marker-fill: #d40000;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'saddle'][zoom >= 15] {
    marker-file: url('symbols/natural/saddle.svg');
    marker-fill: @landform-color;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'cave_entrance'][zoom >= 15] {
    marker-file: url('symbols/natural/cave.svg');
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'waterway_waterfall'] {
    [zoom >= 13][height > 20],
    [zoom >= 14][height > 10],
    [zoom >= 15][name != null],
    [zoom >= 16] {
      marker-file: url('symbols/waterfall.svg');
      marker-placement: interior;
      marker-clip: false;
      marker-fill: @water-text;
    }
  }

  [kind = 'military_bunker'][zoom >= 17] {
    marker-file: url('symbols/bunker.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'power_generator']['generator:source' = 'wind'] {
    [zoom >= 15][location != 'rooftop'][location != 'roof'],
    [zoom >= 15][location = null],
    [zoom >= 19] {
      marker-file: url('symbols/generator_wind.svg');
      marker-placement: interior;
      marker-fill: @man-made-icon;
      marker-clip: false;
    }
  }

  [kind = 'windmill'][zoom >= 16] {
    marker-file: url('symbols/man_made/windmill.svg');
    marker-placement: interior;
    marker-fill: @man-made-icon;
    marker-clip: false;
  }

  [kind = 'hunting_stand'][zoom >= 16] {
    marker-file: url('symbols/amenity/hunting_stand.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  // waste_disposal tagging on ways - tagging on nodes is defined later
  [kind = 'waste_disposal'][zoom >= 19] {
    [access = null],
    [access = 'permissive'],
    [access = 'yes'] {
      marker-file: url('symbols/amenity/waste_disposal.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
    }
  }
}

.amenity-low-priority {
  [kind = 'cross'][zoom >= 16],
  [kind = 'historic_wayside_cross'][zoom >= 16] {
    marker-file: url('symbols/man_made/cross.svg');
    marker-fill: @religious-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'parking'][zoom >= 17],
  [kind = 'bicycle_parking'][zoom >= 18],
  [kind = 'motorcycle_parking'][zoom >= 18] {
    [kind = 'parking'] {
      marker-file: url('symbols/amenity/parking.svg');
    }
    [kind = 'bicycle_parking'] {
      marker-file: url('symbols/amenity/bicycle_parking.svg');
    }
    [kind = 'motorcycle_parking'] {
      marker-file: url('symbols/amenity/motorcycle_parking.svg');
    }
    marker-placement: interior;
    marker-clip: false;
    marker-fill: @transportation-icon;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'railway_level_crossing'][zoom >= 14]::railway,
  [kind = 'railway_crossing'][zoom >= 15]::railway{
    marker-file: url('symbols/level_crossing.svg');
    marker-placement: interior;
    [zoom >= 16] {
      marker-file: url('symbols/level_crossing2.svg');
    }
  }

  [kind = 'mini_roundabout'][zoom >= 17]::highway {
    marker-file: url('symbols/highway/mini_roundabout.svg');
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_gate']::barrier {
    [zoom >= 17] {
      marker-file: url('symbols/barrier/gate.svg');
      marker-placement: interior;
      marker-clip: false;
    }
  }

  [kind = 'barrier_lift_gate'][zoom >= 17]::barrier,
  [kind = 'barrier_swing_gate'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/lift_gate.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_cattle_grid'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/cattle_grid.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_stile'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/stile.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_motorcycle_barrier'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/motorcycle_barrier.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_cycle_barrier'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/cycle_barrier.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_full-height_turnstile'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/full-height_turnstile.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_kissing_gate'][zoom >= 17]::barrier {
    marker-file: url('symbols/barrier/kissing_gate.svg');
    marker-fill: @barrier-icon;
    marker-placement: interior;
    marker-clip: false;
  }

  [kind = 'barrier_bollard'],
  [kind = 'barrier_block'],
  [kind = 'barrier_log'],
  [kind = 'barrier_turnstile'] {
    [zoom >= 17] {
      marker-width: 3;
      marker-line-width: 0;
      marker-fill: #7d7c7c;
      marker-placement: interior;

      [zoom >= 18] {
        marker-width: 4;
      }
    }
  }

  [kind = 'bench'][zoom >= 19]::amenity {
    marker-file: url('symbols/amenity/bench.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  [kind = 'waste_basket'][zoom >= 19]::amenity {
    marker-file: url('symbols/amenity/waste_basket.svg');
    marker-fill: @man-made-icon;
    marker-placement: interior;
    [access != ''][access != 'permissive'][access != 'yes'] {
      marker-opacity: 0.33;
    }
  }

  // waste_disposal tagging on nodes - tagging on ways is defined earlier
  [kind = 'waste_disposal'][zoom >= 19]::amenity {
    [access = null],
    [access = 'permissive'],
    [access = 'yes'] {
      marker-file: url('symbols/amenity/waste_disposal.svg');
      marker-fill: @man-made-icon;
      marker-placement: interior;
    }
  }
}

/* Note that these layers are also used in water.mss */
#pois[zoom >= 17] {
  // [kind = 'place_island'][zoom >= 4][way_pixels > 3000][way_pixels <= 768000],
  // [kind = 'place_island'][zoom >= 16][way_pixels <= 768000],
  // [kind = 'place_islet'][zoom >= 11][way_pixels > 3000][way_pixels <= 768000],
  // [kind = 'place_islet'][zoom >= 17][way_pixels <= 768000] {
  //   text-name: "[name]";
  //   text-fill: #000;
  //   text-size: @landcover-font-size;
  //   text-wrap-width: @landcover-wrap-width-size;
  //   text-line-spacing: @landcover-line-spacing-size;
  //   [way_pixels > 12000] {
  //     text-size: @landcover-font-size-big;
  //     text-wrap-width: @landcover-wrap-width-size-big;
  //     text-line-spacing: @landcover-line-spacing-size-big;
  //   }
  //   [way_pixels > 48000] {
  //     text-size: @landcover-font-size-bigger;
  //     text-wrap-width: @landcover-wrap-width-size-bigger;
  //     text-line-spacing: @landcover-line-spacing-size-bigger;
  //   }
  //   text-face-name: @oblique-fonts;
  //   text-halo-radius: @standard-halo-radius;
  //   text-halo-fill: @standard-halo-fill;
  //   text-placement: interior;
  // }

  [kind = 'pub'][zoom >= 18],
  [kind = 'restaurant'][zoom >= 18],
  [kind = 'food_court'][zoom >= 17],
  [kind = 'cafe'][zoom >= 18],
  [kind = 'fast_food'][zoom >= 18],
  [kind = 'biergarten'][zoom >= 18],
  [kind = 'bar'][zoom >= 18],
  [kind = 'ice_cream'][zoom >= 18] {
    text-name: "[name]";
    text-fill: @gastronomy-text;
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 11;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    [kind = 'bar'] {
      text-dy: 13;
    }
  }

  [kind = 'library'],
  [kind = 'museum'],
  [kind = 'theatre'],
  [kind = 'cinema'],
  [kind = 'arts_centre'],
  [kind = 'community_centre'],
  [kind = 'historic_archaeological_site'],
  [kind = 'nightclub'] {
    [zoom >= 17] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-fill: @culture;
      text-dy: 11;
      [kind = 'community_centre'] { text-dy: 10; }
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      [kind = 'nightclub']{
        text-dy: 12;
      }
    }
  }

  [kind = 'public_bath'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @amenity-brown;
    text-dy: 11;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'sauna'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @leisure-green;
    text-dy: 11;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'car_rental'][zoom >= 17],
  [kind = 'bicycle_rental'][zoom >= 17],
  [kind = 'boat_rental'][zoom >= 17],
  [kind = 'barrier_toll_booth'][zoom >= 17],
  [kind = 'slipway'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @transportation-text;
    [kind = 'car_rental']     { text-dy: 10; }
    [kind = 'bicycle_rental'] { text-dy: 10; }
    [kind = 'boat_rental']    { text-dy: 13; }
    [kind = 'barrier_toll_booth']     { text-dy: 13; }
    [kind = 'slipway']        { text-dy: 13; }
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'parking'][zoom >= 10][way_pixels > 900],
  [kind = 'bicycle_parking'][zoom >= 10][way_pixels > 900],
  [kind = 'motorcycle_parking'][zoom >= 10][way_pixels > 900],
  [kind = 'parking_entrance'][zoom >= 18] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @transportation-text;
    text-dy: 9;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    [access != ''][access != 'permissive'][access != 'yes'] {
      text-opacity: 0.33;
      text-halo-radius: 0;
    }
    [kind = 'bicycle_parking'],
    [kind = 'motorcycle_parking'] {
      text-dy: 12;
    }
  }

  [kind = 'courthouse'][zoom >= 17],
  [kind = 'townhall'][zoom >= 17],
  [kind = 'police'][zoom >= 17],
  [kind = 'social_facility'][zoom >= 17],
  [kind = 'fire_station'][zoom >= 17],
  [kind = 'post_office'][zoom >= 17],
  [kind = 'prison'][zoom >= 17],
  [kind = 'embassy'][zoom >= 17],
  [kind = 'bank'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @public-service;
    text-dy: 11;
    [kind = 'courthouse'] { text-dy: 13; }
    [kind = 'townhall'] { text-dy: 13; }
    [kind = 'prison'] { text-dy: 12; }
    [kind = 'embassy'] { text-dy: 10; }
    [kind = 'bank'] { text-dy: 9; }
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'vehicle_inspection'][zoom >= 17],
  [kind = 'car_wash'][zoom >= 17],
  [kind = 'internet_cafe'][zoom >= 17],
  [kind = 'bowling_alley'][zoom >= 17],
  [kind = 'beach_resort'][zoom >= 17],
  [kind = 'bird_hide'][zoom >= 17],
  [kind = 'amusement_arcade'][zoom >= 17],
  [kind = 'outdoor_seating'][zoom >= 19],
  [kind = 'fishing'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @amenity-brown;
    [kind = 'outdoor_seating'],
    [kind = 'fishing'],
    [kind = 'bowling_alley'],
    [kind = 'bird_hide'],
    [kind = 'amusement_arcade'],
    [kind = 'beach_resort'] {
      text-fill: @leisure-green;
    }
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'bbq'][zoom >= 17],
  [kind = 'bicycle_repair_station'][zoom >= 19],
  [kind = 'drinking_water'][zoom >= 17],
  [kind = 'shower'][zoom >= 18],
  [kind = 'picnic_site'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @amenity-brown;
    [kind = 'picnic_site'] {
      text-fill: @leisure-green;
    }
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    [access != ''][access != 'permissive'][access != 'yes'] {
      text-opacity: 0.33;
      text-halo-radius: 0;
    }
  }

  [kind = 'place_of_worship'][zoom >= 16][way_pixels > 3000],
  [kind = 'place_of_worship'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: #000033;
    text-dy: 12;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'marketplace'][zoom >= 16][way_pixels > 3000],
  [kind = 'marketplace'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 12;
    text-fill: @shop-text;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: rgba(255, 255, 255, 0.6);
    text-placement: interior;
  }

  [kind = 'peak'][zoom >= 13],
  [kind = 'volcano'][zoom >= 13],
  [kind = 'saddle'][zoom >= 15],
  [kind = 'viewpoint'][zoom >= 16] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: darken(@landform-color, 30%);
    [kind = 'volcano'] { text-fill: #d40000; }
    text-dy: 7;
    [kind = 'viewpoint'] { text-dy: 11; }
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'cape'][zoom >= 14] {
    text-name: "[name]";
    text-fill: #000;
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'information'][zoom >= 19],
  [kind = 'information']["information"='office'][zoom >= 17] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-fill: darken(black, 30%);
      [information = 'office'] { text-fill: @amenity-brown; }
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      text-dy: 11;
  }

  [kind = 'waterway_waterfall'] {
    [zoom >= 13][height > 20],
    [zoom >= 14][height > 10],
    [zoom >= 15][name != null],
    [zoom >= 16] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-fill: @water-text;
      text-dy: 10;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'cross'][zoom >= 17],
  [kind = 'power_generator'][location != 'rooftop'][location != 'roof'][zoom >= 17],
  [kind = 'power_generator'][location = null][zoom >= 17],
  [kind = 'power_generator'][zoom >= 19],
  [kind = 'historic_wayside_cross'][zoom >= 17],
  [kind = 'historic_wayside_shrine'][zoom >= 17],
  [kind = 'historic_city_gate'][zoom >= 17],
  [kind = 'cave_entrance'][zoom >= 15],
  [kind = 'mast'][zoom >= 18],
  [kind = 'tower'][zoom >= 17],
  [kind = 'storage_tank'][zoom >= 18],
  [kind = 'silo'][zoom >= 18],
  [kind = 'communications_tower'][zoom >= 17],
  [kind = 'telescope']["telescope:type" != 'optical']["telescope:type" != null][zoom >= 16],
  [kind = 'telescope'][zoom >= 17],
  [kind = 'water_tower'][zoom >= 17],
  [kind = 'chimney'][zoom >= 17],
  [kind = 'crane'][zoom >= 17],
  [kind = 'waste_water_plant'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: darken(@man-made-icon, 20%);
    [kind = 'cross'],
    [kind = 'historic_wayside_cross'] {
      text-dy: 6;
    }
    [kind = 'power_generator'],
    [kind = 'historic_city_gate'],
    [kind = 'mast'],
    [kind = 'tower'],
    [kind = 'communications_tower'],
    [kind = 'telescope'],
    [kind = 'water_tower'],
    [kind = 'storage_tank'],
    [kind = 'silo'],
    [kind = 'chimney'],
    [kind = 'crane'] {
      text-dy: 10;
    }
    [kind = 'cave_entrance'] {
      text-dy: 11;
    }
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'artwork'][zoom >= 17],
  [kind = 'historic_memorial'][memorial = null][zoom >= 17],
  [kind = 'historic_memorial'][memorial != null][memorial != 'blue_plaque'][memorial != 'bust'][memorial != 'plaque'][memorial != 'stele'][memorial != 'stone'][zoom >= 17],
  [kind = 'historic_memorial'][memorial = 'statue'][zoom >= 17],
  [kind = 'historic_memorial'][memorial = 'bust'][zoom >= 18],
  [kind = 'historic_memorial'][memorial = 'stele'][zoom >= 18],
  [kind = 'historic_memorial'][memorial = 'stone'][zoom >= 18],
  [kind = 'historic_memorial'][memorial = 'blue_plaque'][zoom >= 19],
  [kind = 'historic_memorial'][memorial = 'plaque'][zoom >= 19],
  [kind = 'obelisk'][zoom >= 17],
  [kind = 'historic_monument'][zoom >= 16],
  [kind = 'historic_fort'][zoom >= 16],
  [kind = 'historic_castle'][zoom >= 16],
  [kind = 'historic_manor'][zoom >= 16] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @memorials;
    text-dy: 11;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'military_bunker'][zoom >= 17],
  [kind = 'historic_wayside_shrine'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: darken(@man-made-icon, 20%);
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'miniature_golf'][zoom >= 17],
  [kind = 'golf_course'][zoom >= 15] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @leisure-green;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    text-dy: 13;
  }

  [kind = 'water_park'],
  [kind = 'sports_centre'][sport = 'swimming'],
  [kind = 'swimming_area'] {
    [way_area >= 150000][zoom >= 14],
    [way_area >= 80000][zoom >= 15],
    [way_area >= 20000][zoom >= 16],
    [zoom >= 17] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-fill: @leisure-green;
      text-dy: 11;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'swimming_pool'][is_building = 'no'] {
    [zoom >= 14][way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: @marina-text;
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'playground'],
  [kind = 'dog_park'],
  [kind = 'fitness_centre'],
  [kind = 'fitness_station'] {
    [way_area >= 150000][zoom >= 14],
    [way_area >= 80000][zoom >= 15],
    [way_area >= 20000][zoom >= 16],
    [zoom >= 17] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-dy: 13;
      text-fill: @leisure-green;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      [access != ''][access != 'permissive'][access != 'yes'] {
        text-fill: darken(@park, 50%);
      }
    }
  }

  [kind = 'landuse_military'],
  [kind = 'wood'],
  [kind = 'landuse_forest'],
  [kind = 'national_park'],
  [kind = 'nature_reserve'],
  [kind = 'aboriginal_lands'],
  [kind = 'protected_area'] {
    [zoom >= 8][way_pixels > 3000][way_pixels <= 768000][is_building = 'no'],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      [kind = 'landuse_military'] {
        text-fill: darken(@military, 40%);
      }
      [kind = 'aboriginal_lands'] {
        text-fill: @aboriginal;
      }
      [kind = 'wood'],
      [kind = 'landuse_forest'] {
        text-fill: @forest-text;
      }
      [kind = 'national_park'],
      [kind = 'nature_reserve'],
      [kind = 'protected_area'] {
        text-fill: darken(@park, 70%);
      }
    }
  }

  [kind = 'military_danger_area'][is_building = 'no'] {
    [zoom >= 9][way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: darken(@military, 20%);
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'landuse_garages'][is_building = 'no'] {
    [zoom >= 13][way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: darken(@garages, 50%);
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'wetland'],
  [kind = 'marsh'],
  [kind = 'mud'],
  [kind = 'park'],
  [kind = 'recreation_ground'],
  [kind = 'landuse_recreation_ground'],
  [kind = 'landuse_village_green'],
  [kind = 'garden'],
  [kind = 'landuse_quarry'],
  [kind = 'landuse_vineyard'],
  [kind = 'landuse_orchard'],
  [kind = 'landuse_plant_nursery'],
  [kind = 'landuse_cemetery'],
  [kind = 'grave_yard'],
  [kind = 'landuse_residential'],
  [kind = 'landuse_meadow'],
  [kind = 'grassland'],
  [kind = 'landuse_grass'],
  [kind = 'landuse_allotments'],
  [kind = 'landuse_farmyard'],
  [kind = 'landuse_farmland'],
  [kind = 'landuse_greenhouse_horticulture'],
  [kind = 'shop'][shop = 'mall'],
  [kind = 'landuse_retail'],
  [kind = 'landuse_industrial'],
  [kind = 'landuse_railway'],
  [kind = 'works'],
  [kind = 'water_works'],
  [kind = 'wastewater_plant'],
  [kind = 'landuse_commercial'],
  [kind = 'landuse_brownfield'],
  [kind = 'landuse_landfill'],
  [kind = 'landuse_construction'],
  [kind = 'theme_park'],
  [kind = 'zoo'],
  [kind = 'kindergarten'],
  [kind = 'school'],
  [kind = 'college'],
  [kind = 'university'],
  [kind = 'landuse_religious'],
  [kind = 'heath'],
  [kind = 'scrub'],
  [kind = 'beach'],
  [kind = 'shoal'],
  [kind = 'reef'],
  [kind = 'fitness_centre'],
  [kind = 'fitness_station'],
  [kind = 'sports_centre'],
  [kind = 'stadium'],
  [kind = 'track'],
  [kind = 'dog_park'],
  [kind = 'ice_rink'],
  [kind = 'pitch'] {
    [zoom >= 10][way_pixels > 3000][way_pixels <= 768000][is_building = 'no'],
    [zoom >= 17][way_pixels <= 768000][is_building = 'no'],
    [zoom >= 10][way_pixels > 3000][way_pixels <= 768000][shop = 'mall'],
    [zoom >= 17][way_pixels <= 768000][shop = 'mall'] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      [kind = 'reef'],
      [kind = 'wetland'],
      [kind = 'marsh'],
      [kind = 'mud'] {
        text-fill: @wetland-text;
      }
      [kind = 'park'],
      [kind = 'recreation_ground'],
      [kind = 'landuse_recreation_ground'],
      [kind = 'landuse_village_green'],
      [kind = 'garden'] {
        text-fill: @leisure-green;
      }
      [kind = 'landuse_quarry'] {
        text-fill: darken(@quarry, 60%);
      }
      [kind = 'landuse_vineyard'],
      [kind = 'landuse_orchard'],
      [kind = 'landuse_plant_nursery'] {
        text-fill: darken(@orchard, 50%);
      }
      [kind = 'landuse_cemetery'],
      [kind = 'grave_yard'] {
        text-fill: darken(@cemetery, 50%);
        text-halo-radius: @standard-halo-radius * 1.5; /* extra halo needed to overpower the cemetery polygon pattern */
      }
      [kind = 'landuse_residential'] {
        text-fill: darken(@residential, 50%);
      }
      [kind = 'landuse_meadow'],
      [kind = 'grassland'],
      [kind = 'landuse_grass'] {
        text-fill: darken(@grass, 50%);
      }
      [kind = 'landuse_allotments'] {
        text-fill: darken(@allotments, 50%);
      }
      [kind = 'landuse_farmyard'] {
        text-fill: darken(@farmyard, 50%);
      }
      [kind = 'landuse_farm'],
      [kind = 'landuse_farmland'],
      [kind = 'landuse_greenhouse_horticulture'] {
        text-fill: darken(@farmland, 50%);
      }
      [kind = 'shop'][shop = 'mall'],
      [kind = 'landuse_retail'] {
        text-fill: darken(@retail, 50%);
      }
      [kind = 'landuse_industrial'],
      [kind = 'landuse_railway'],
      [kind = 'wastewater_plant'],
      [kind = 'water_works'],
      [kind = 'works'] {
        text-fill: darken(@industrial, 60%);
      }
      [kind = 'landuse_commercial'] {
        text-fill: darken(@commercial, 60%);
      }
      [kind = 'landuse_brownfield'],
      [kind = 'landuse_landfill'],
      [kind = 'landuse_construction'] {
        text-fill: darken(@construction, 50%);
      }
      [kind = 'caravan_site'] {
        text-fill: darken(@campsite, 50%);
        text-dy: 15;
      }
      [kind = 'theme_park'],
      [kind = 'zoo'] {
        text-fill: @tourism;
        text-face-name: @bold-fonts; /*rendered bold to improve visibility since theme parks tend to have crowded backgrounds*/
      }
      [kind = 'kindergarten'],
      [kind = 'school'],
      [kind = 'college'],
      [kind = 'university'] {
        text-fill: darken(@societal_amenities, 80%);
      }
      [kind = 'landuse_religious'] {
        text-fill: darken(@place_of_worship, 50%);
      }
      [kind = 'heath'] {
        text-fill: darken(@heath, 40%);
      }
      [kind = 'scrub'] {
        text-fill: darken(@scrub, 60%);
      }
      [kind = 'beach'],
      [kind = 'shoal'] {
        text-fill: darken(@beach, 60%);
      }
      [kind = 'sports_centre'],
      [kind = 'stadium'] {
        text-fill: darken(@stadium, 70%);
      }
      [kind = 'fitness_centre'],
      [kind = 'fitness_station'] {
        text-fill: @leisure-green;
        [access != ''][access != 'permissive'][access != 'yes'] {
          text-opacity: 0.33;
          text-halo-radius: 0;
        }
      }
      [kind = 'dog_park'] {
        text-fill: @leisure-green;
        text-halo-radius: @standard-halo-radius * 1.5; /* Extra halo needed to stand out from paw pattern. */
        text-halo-fill: @standard-halo-fill;
      }
      [kind = 'track'] {
        text-fill: darken(@track, 40%);
      }
      [kind = 'ice_rink'],
      [kind = 'pitch'] {
        text-fill: darken(@pitch, 40%);
      }
    }
  }

  [kind = 'bay'][zoom >= 14],
  [kind = 'spring'][zoom >= 16] {
    text-name: "[name]";
    text-size: 10;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @water-text;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    [kind = 'spring'] {
      text-dy: 6;
    }
  }

  [kind = 'atm'][zoom >= 19],
  [kind = 'vending_machine'][zoom >= 19] {
    text-name: "[operator]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 10;
    text-fill: @amenity-brown;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    text-face-name: @standard-font;
  }

  [kind = 'bureau_de_change'][zoom >= 17],
  [kind = 'public_bookcase'][zoom >= 19],
  [kind = 'gallery'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 10;
    text-fill: @amenity-brown;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    text-face-name: @standard-font;
  }

  [kind = 'alpine_hut'][zoom >= 14],
  [kind = 'shelter'][zoom >= 17],
  [kind = 'picnic_table'][zoom >= 17],
  [kind = 'hotel'][zoom >= 17],
  [kind = 'motel'][zoom >= 17],
  [kind = 'hostel'][zoom >= 17],
  [kind = 'chalet'][zoom >= 17],
  [kind = 'guest_house'][zoom >= 17],
  [kind = 'apartment'][zoom >= 18],
  [kind = 'wilderness_hut'][zoom >= 14],
  [kind = 'camp_site'][zoom >= 17],
  [kind = 'caravan_site'][zoom >= 17], {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @accommodation-text;
    text-dy: 11;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    [kind = 'motel'] {
      text-dy: 13;
    }
    [kind = 'camp_site'],
    [kind = 'caravan_site'] {
      text-dy: 15;
    }
    [kind = 'picnic_table'][zoom >= 17],
    [kind = 'shelter'] {
      text-fill: @man-made-icon;
    }
    [kind = 'alpine_hut'],
    [kind = 'wilderness_hut'],
    [kind = 'shelter'] {
      [access != ''][access != 'permissive'][access != 'yes'] {
        text-opacity: 0.33;
        text-halo-radius: 0;
      }
    }
  }

  [kind = 'taxi'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @transportation-text;
    text-dy: 11;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'bus_stop'],
  [kind = 'charging_station'],
  [kind = 'fuel'],
  [kind = 'bus_station'] {
    [zoom >= 17] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-fill: @transportation-text;
      text-dy: 11;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      [kind = 'bus_stop'] {
        text-dy: 9;
      }
      [access != ''][access != 'permissive'][access != 'yes'] {
        text-opacity: 0.33;
        text-halo-radius: 0;
      }
    }
  }

  [kind = 'marina'][zoom >= 15] {
    [zoom >= 10][way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: @marina-text;
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'fountain'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @marina-text;
    text-dy: 4;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    [zoom >= 18] {
      text-dy: 10;
    }
  }

  [kind = 'lighthouse'][zoom >= 15],
  [kind = 'windmill'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: darken(@man-made-icon, 20%);
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'recycling'][recycling_type = 'centre'][zoom >= 17],
  [kind = 'recycling'][zoom >= 19] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @amenity-brown;
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'hospital'][zoom >= 16],
  [kind = 'hospital'][zoom >= 16] {
    text-name: "[name]";
    text-fill: @health-color;
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }


  [kind = 'clinic'],
  [kind = 'pharmacy'],
  [kind = 'doctors'],
  [kind = 'dentist'],
  [kind = 'veterinary'],
  [kind = 'alternative'],
  [kind = 'audiologist'],
  [kind = 'birthing_center'],
  [kind = 'blood_bank'],
  [kind = 'blood_donation'],
  [kind = 'centre'],
  [kind = 'clinic'],
  [kind = 'dentist'],
  [kind = 'dialysis'],
  [kind = 'doctor'],
  [kind = 'laboratory'],
  [kind = 'midwife'],
  [kind = 'occupational_therapist'],
  [kind = 'optometrist'],
  [kind = 'physiotherapist'],
  [kind = 'podiatrist'],
  [kind = 'psychotherapist'],
  [kind = 'rehabilitation'],
  [kind = 'speech_therapist'],
  [kind = 'yes'] {
    [zoom >= 17] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-dy: 12;
      text-fill: @health-color;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'nursing_home'],
  [kind = 'childcare'] {
    [zoom >= 18] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      text-dy: 8;
      text-fill: darken(@societal_amenities, 80%);
    }
  }

  [kind = 'driving_school'] {
    [zoom >= 18] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-dy: 8;
      text-fill: @shop-text;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: rgba(255, 255, 255, 0.6);
      text-placement: interior;
    }
  }

  [kind = 'shop'][shop != 'mall'] {
    [way_pixels > 3000][zoom >= 17],
    [zoom >= 18] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-dy: 12;
      text-fill: @shop-text;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: rgba(255, 255, 255, 0.6);
      text-placement: interior;
      [shop = 'car_repair'] {
        text-fill: @amenity-brown;
      }
      [shop = 'massage'] {
        text-fill: @leisure-green;
      }
    }
  }

  [kind = 'office'] {
    // potentially larger offices
    [zoom >= 17] {
      [office = 'administrative'],
      [office = 'adoption_agency'],
      [office = 'educational_institution'],
      [office = 'employment_agency'],
      [office = 'energy_supplier'],
      [office = 'financial'],
      [office = 'government'],
      [office = 'newspaper'],
      [office = 'ngo'],
      [office = 'political_party'],
      [office = 'quango'],
      [office = 'religion'],
      [office = 'research'],
      [office = 'tax'],
      [office = 'telecommunication'],
      [office = 'water_utility'],
      {
        text-name: "[name]";
        text-size: @standard-font-size;
        text-wrap-width: @standard-wrap-width;
        text-line-spacing: @standard-line-spacing-size;
        text-dy: 8;
        text-fill: @office;
        text-face-name: @standard-font;
        text-halo-radius: @standard-halo-radius;
        text-halo-fill: rgba(255, 255, 255, 0.6);
        text-placement: interior;
      }
    }

    // other documented office types
    [zoom >= 18] {
      [office = 'accountant'],
      [office = 'advertising_agency'],
      [office = 'architect'],
      [office = 'association'],
      [office = 'charity'],
      [office = 'company'],
      [office = 'estate_agent'],
      [office = 'forestry'],
      [office = 'foundation'],
      [office = 'guide'],
      [office = 'insurance'],
      [office = 'it'],
      [office = 'lawyer'],
      [office = 'logistics'],
      [office = 'moving_company'],
      [office = 'notary'],
      [office = 'physician'],
      [office = 'private_investigator'],
      [office = 'property_management'],
      [office = 'surveyor'],
      [office = 'tax_advisor'],
      [office = 'therapist'],
      [office = 'travel_agent'] {
        text-name: "[name]";
        text-size: @standard-font-size;
        text-wrap-width: @standard-wrap-width;
        text-line-spacing: @standard-line-spacing-size;
        text-dy: 8;
        text-fill: @office;
        text-face-name: @standard-font;
        text-halo-radius: @standard-halo-radius;
        text-halo-fill: rgba(255, 255, 255, 0.6);
        text-placement: interior;
      }
    }

    // all other offices
    [zoom >= 19] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-dy: 8;
      text-fill: @office;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: rgba(255, 255, 255, 0.6);
      text-placement: interior;
    }
  }

  [kind = 'shop_supermarket'],
  [kind = 'shop_department_store'] {
    [zoom >= 16] {
      text-name: "[name]";
      text-size: @standard-font-size;
      text-wrap-width: @standard-wrap-width;
      text-line-spacing: @standard-line-spacing-size;
      text-dy: 12;
      text-fill: @shop-text;
      text-face-name: @standard-font;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: rgba(255, 255, 255, 0.6);
      text-placement: interior;
    }
  }

  [kind = 'aeroway_gate'][zoom >= 17] {
    text-name: "[ref]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: black;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'power_plant'][is_building = 'no'][zoom >= 10],
  [kind = 'power_station'][is_building = 'no'][zoom >= 10],
  [kind = 'power_generator'][is_building = 'no']["generator:source" != 'wind'][zoom >= 10],
  [kind = 'power_sub_station'][is_building = 'no'][zoom >= 13],
  [kind = 'power_substation'][is_building = 'no'][zoom >= 13]{
    [way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: darken(@power, 40%);
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'scree'][zoom >= 9],
  [kind = 'shingle'][zoom >= 9],
  [kind = 'bare_rock'],
  [kind = 'sand'] {
    [zoom >= 8][way_pixels > 3000][way_pixels <= 768000][is_building = 'no'],
    [zoom >= 17][way_pixels <= 768000][is_building = 'no'] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
      [kind = 'scree'],
      [kind = 'shingle'],
      [kind = 'bare_rock'] {
        text-fill: darken(@bare_ground, 50%);
      }
      [kind = 'sand'] {
        text-fill: darken(@sand, 50%);
      }
    }
  }

  [kind = 'aeroway_apron'][is_building = 'no'] {
    [zoom >= 10][way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: darken(@apron, 60%);
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'services'][is_building = 'no'],
  [kind = 'rest_area'][is_building = 'no'] {
    [zoom >= 10][way_pixels > 3000][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: darken(@rest_area, 40%);
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'glacier'][is_building = 'no'] {
    [zoom >= 8][way_pixels > 10000][way_pixels <= 768000],
    [zoom >= 10][way_pixels > 750][way_pixels <= 768000],
    [zoom >= 17][way_pixels <= 768000] {
      text-name: "[name]";
      text-size: @landcover-font-size;
      text-wrap-width: @landcover-wrap-width-size;
      text-line-spacing: @landcover-line-spacing-size;
      [way_pixels > 12000] {
        text-size: @landcover-font-size-big;
        text-wrap-width: @landcover-wrap-width-size-big;
        text-line-spacing: @landcover-line-spacing-size-big;
      }
      [way_pixels > 48000] {
        text-size: @landcover-font-size-bigger;
        text-wrap-width: @landcover-wrap-width-size-bigger;
        text-line-spacing: @landcover-line-spacing-size-bigger;
      }
      text-fill: mix(darken(@glacier, 40%), darken(@glacier-line, 30%), 50%);
      text-face-name: @landcover-face-name;
      text-halo-radius: @standard-halo-radius;
      text-halo-fill: @standard-halo-fill;
      text-placement: interior;
    }
  }

  [kind = 'aeroway_helipad'][zoom >= 16] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @airtransport;
    text-dy: -10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'aeroway_aerodrome']['access' != 'private']['icao' != null]['iata' != null][zoom >= 10][zoom < 14],
  [kind = 'aeroway_aerodrome'][zoom >= 11][zoom < 14],
  [kind = 'ferry_terminal'][zoom >= 15] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: darken(@airtransport, 15%);
    text-dy: 10;
    text-face-name: @oblique-fonts;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'hunting_stand'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 10;
    text-fill: darken(@man-made-icon, 20%);
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'tree'][zoom >= 17] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: green;
    text-dy: 7;
    [zoom >= 18] { text-dy: 8; }
    [zoom >= 19] { text-dy: 11; }
    [zoom >= 20] { text-dy: 18; }
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'casino'][zoom >= 17] {
    text-name: "[name]";
    text-fill: @amenity-brown;
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-dy: 10;
    text-face-name: @standard-font;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
  }

  [kind = 'attraction'][zoom >= 17][is_building = 'no'] {
    text-name: "[name]";
    text-size: @standard-font-size;
    text-wrap-width: @standard-wrap-width;
    text-line-spacing: @standard-line-spacing-size;
    text-fill: @tourism;
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
    text-placement: interior;
    text-face-name: @standard-font;
  }
}

#amenity-line {
  // Ford tagging on ways
  [kind = 'ford'][zoom >= 16] {
    marker-file: url('symbols/highway/ford.svg');
    marker-fill: @transportation-icon;
  }
  // Slipway tagging on ways
  [kind = 'slipway'][zoom >= 17] {
    marker-file: url('symbols/leisure/slipway.svg');
    marker-fill: @transportation-icon;
  }

  [kind = 'track'] {
    [zoom >= 16] {
      [zoom >= 17] {
        bridgecasing/line-color: saturate(darken(@pitch, 30%), 20%);
        bridgecasing/line-join: round;
        bridgecasing/line-width: 1.25;
        [zoom >= 18] { bridgecasing/line-width: 2.5; }
        [zoom >= 19] { bridgecasing/line-width: 5; }
      }
      line-color: @pitch;
      line-join: round;
      line-cap: round;
      line-width: 1;
      [zoom >= 18] { line-width: 2; }
      [zoom >= 19] { line-width: 4; }

      [zoom >= 19] {
        text-name: "[name]";
        text-size: 10;
        text-face-name: @oblique-fonts;
        text-fill: darken(@pitch, 40%);
        text-halo-radius: @standard-halo-radius;
        text-halo-fill: @standard-halo-fill;
        text-placement: line;
        text-vertical-alignment: middle;
        text-repeat-distance: @waterway-text-repeat-distance;
        text-dy: 8;
      }
    }
  }

  [kind = 'attraction_water_slide'] {
    [zoom >= 16] {
      [zoom >= 17] {
        bridgecasing/line-color: black;
        bridgecasing/line-join: round;
        bridgecasing/line-width: 1.25;
        [zoom >= 18] { bridgecasing/line-width: 2.5; }
        [zoom >= 19] { bridgecasing/line-width: 5; }
      }
      line-color: @pitch;
      line-join: round;
      line-cap: round;
      line-width: 1;
      [zoom >= 18] { line-width: 2; }
      [zoom >= 19] { line-width: 4; }

      [zoom >= 19] {
        text-name: "[name]";
        text-size: 10;
        text-face-name: @oblique-fonts;
        text-fill: darken(@pitch, 40%);
        text-halo-radius: @standard-halo-radius;
        text-halo-fill: @standard-halo-fill;
        text-placement: line;
        text-vertical-alignment: middle;
        text-repeat-distance: @waterway-text-repeat-distance;
        text-dy: 8;
      }
    }
  }
}

#pois [zoom >= 16] {
  ::canopy {
    opacity: 0.3;
    [natural = 'tree_row'] {
      line-color: green;
      line-cap: round;
      line-width: 2.5;
      [zoom >= 17] {
        line-width: 5;
      }
      [zoom >= 18] {
        line-width: 10;
      }
      [zoom >= 19] {
        line-width: 15;
      }
      [zoom >= 20] {
        line-width: 30;
      }
    }
    [natural = 'tree'] {
      [zoom >= 18] {
        marker-fill: green;
        marker-allow-overlap: true;
        marker-line-width: 0;
        marker-ignore-placement: true;
        marker-width: 10;
        marker-height: 10;
      }
      [zoom >= 19] {
        marker-width: 15;
        marker-height: 15;
      }
      [zoom >= 20] {
        marker-width: 30;
        marker-height: 30;
      }
    }
  }
  [natural = 'tree']::trunk {
    [zoom >= 18] {
      trunk/marker-fill: #b27f36;
      trunk/marker-allow-overlap: true;
      trunk/marker-line-width: 0;
      trunk/marker-width: 2;
      trunk/marker-height: 2;
      trunk/marker-ignore-placement: true;
    }
    [zoom >= 19] {
      trunk/marker-width: 3;
      trunk/marker-height: 3;
    }
    [zoom >= 20] {
      trunk/marker-width: 6;
      trunk/marker-height: 6;
    }
  }
}
