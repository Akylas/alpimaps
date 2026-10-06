/* POI rankings over Massif's rank ladder (%poi, one ::poi attachment), picked by the `ranking`
   style parameter: a switch re-decodes, no reload. `default` is Massif's own ladder.
   Here only WHEN a class shows: promoted ones come in early, demoted ones wait for z17. Which wins a
   collision is the app's `poi-boost.<class>` entries (app/utils/massif.ts), set with the ranking. */

/* activities: what a hike or a trip outdoors needs */
#poi['param::ranking' = 'activities'][zoom >= 13][subclass = 'alpine_hut']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'wilderness_hut']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'shelter'][shelter_type = 'basic_hut']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'shelter'][shelter_type = 'lean_to']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'shelter'][shelter_type = 'rock_shelter']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'shelter'][shelter_type = 'weather_shelter']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'shelter'][shelter_type = 'wilderness_hut']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'waterfall']::poi,
#poi['param::ranking' = 'activities'][zoom >= 13][class = 'cave_entrance']::poi {
  @extend %poi;
}
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'picnic_site']::poi,
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'ranger_station']::poi,
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'lodging']::poi,
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'bicycle']::poi,
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'bicycle_rental']::poi,
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'shop'][subclass = 'sports']::poi,
#poi['param::ranking' = 'activities'][zoom >= 14][class = 'shop'][subclass = 'outdoor']::poi,
#poi['param::ranking' = 'activities'][zoom >= 15][class = 'toilets']::poi,
#poi['param::ranking' = 'activities'][zoom >= 15][class = 'parking']::poi {
  @extend %poi;
}

/* sports: where to ski, climb, swim or play, and the huts on the way */
#poi['param::ranking' = 'sports'][zoom >= 13][class = 'skiing']::poi,
#poi['param::ranking' = 'sports'][zoom >= 13][subclass = 'alpine_hut']::poi,
#poi['param::ranking' = 'sports'][zoom >= 13][class = 'wilderness_hut']::poi {
  @extend %poi;
}
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'bicycle']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'bicycle_rental']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shop'][subclass = 'sports']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shop'][subclass = 'outdoor']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'stadium']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'swimming']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'golf']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'pitch']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shelter'][shelter_type = 'basic_hut']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shelter'][shelter_type = 'lean_to']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shelter'][shelter_type = 'rock_shelter']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shelter'][shelter_type = 'weather_shelter']::poi,
#poi['param::ranking' = 'sports'][zoom >= 14][class = 'shelter'][shelter_type = 'wilderness_hut']::poi,
#poi['param::ranking' = 'sports'][zoom >= 15][class = 'tennis']::poi,
#poi['param::ranking' = 'sports'][zoom >= 15][class = 'soccer']::poi,
#poi['param::ranking' = 'sports'][zoom >= 15][class = 'basketball']::poi,
#poi['param::ranking' = 'sports'][zoom >= 15][class = 'playground']::poi {
  @extend %poi;
}

/* both: errands and services make way, but a sports or outdoor shop */
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'clothing_store']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'shop'][subclass != 'sports'][subclass != 'outdoor']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'furniture']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'gift']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'florist']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'hairdresser']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'laundry']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'bank']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'car']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'dentist']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'doctors']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'pharmacy']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'veterinary']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'embassy']::poi,
#poi['param::ranking' != 'default']['param::ranking' != 'alpimaps'][zoom < 17][class = 'post']::poi {
  display: none;
}

/* alpimaps: what a cycle tourer needs, in the class order Alpimaps' planetiler fork bakes into `rank`
   (Poi.java CLASS_RANKS), rebuilt here for tiles ranked by upstream OpenMapTiles (OpenFreeMap): food
   stores with the bakeries, bike and sports shops, care, transport and history early; who wins a
   collision is app/utils/massif.ts. */
#poi['param::ranking' = 'alpimaps'][zoom >= 14][subclass = 'national_park']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'bakery']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'grocery']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'butcher']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'pharmacy']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'bicycle']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'bicycle_rental']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'shop'][subclass = 'sports']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'shop'][subclass = 'outdoor']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'museum']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'castle']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'fort']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'archaeological_site']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'monument']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 14][class = 'attraction'][subclass != 'viewpoint']::poi {
  @extend %poi;
}
#poi['param::ranking' = 'alpimaps'][zoom >= 15][class = 'restaurant']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 15][class = 'fast_food']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 15][class = 'cafe']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 15][class = 'doctors']::poi {
  @extend %poi;
}
#poi['param::ranking' = 'alpimaps'][zoom >= 16][class = 'pitch']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 16][class = 'bank']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 16][class = 'beer']::poi,
#poi['param::ranking' = 'alpimaps'][zoom >= 16][class = 'bar']::poi {
  @extend %poi;
}
/* the fork moves libraries behind shops; a community centre (town_hall to OpenMapTiles) crowds a town */
#poi['param::ranking' = 'alpimaps'][zoom < 16][class = 'library']::poi,
#poi['param::ranking' = 'alpimaps'][zoom < 16][subclass = 'community_centre']::poi {
  display: none;
}
