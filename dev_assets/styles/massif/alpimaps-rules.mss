/* Listed AFTER style.mss: new attachments draw with their source layer's topmost entry.

   Massif's tracks are moved out of reach (osm.json sets track_min_zoom 24) and drawn again here as
   Alpimaps' OSM style does: a brown line (@track) under a white one dashed by tracktype.
   tracktype is the grade's name in OpenMapTiles, its index in OSM's list on Alpimaps tiles. */
#transportation[zoom >= 12][class = 'track']::osm_track_casing {
  line-color: @track;
  line-width: exponential(1.5, [view::zoom], (12, 1.4), (15, 3.2), (18, 6.5), (22, 20));
  [brunnel = 'tunnel'] { line-opacity: 0.5; }
}
#transportation[zoom >= 14][class = 'track'][tracktype != 'grade1'][tracktype != 0]::osm_track {
  line-color: #ffffff;
  line-width: exponential(1.5, [view::zoom], (14, 1.2), (15, 1.8), (18, 4), (22, 14));
  line-dasharray: 6, 3, 6;
  [tracktype = 'grade2'], [tracktype = 1] { line-dasharray: 7, 1; }
  [tracktype = 'grade3'], [tracktype = 2] { line-dasharray: 5, 2, 5; }
}

/* Alpimaps' textures over the flat colours, from the zoom each says something, tinted as it tints
   them. Massif's own pattern sprites are e-ink's grey; the tint puts the colour back. */
#landcover[zoom >= 13][class = 'wood']::osm_wood_pattern {
  polygon-pattern-file: url('icons/pattern-wood.png');
  polygon-pattern-fill: #6f9a5c;
  polygon-pattern-opacity: linear([view::zoom], (13, 0), (14, 0.5), (16, 0.2));
}
#landcover[zoom >= 12][subclass = 'scrub']::osm_scrub_pattern {
  polygon-pattern-file: url('icons/pattern-scrub.png');
  polygon-pattern-fill: #7f9a5c;
  polygon-pattern-opacity: 0.5;
}
#landcover[zoom >= 12][class = 'wetland']::osm_wetland_pattern {
  polygon-pattern-file: url('icons/pattern-wetland.png');
  polygon-pattern-fill: #4d80b3;
  polygon-pattern-opacity: 0.6;
}
#landcover[zoom >= 12][class = 'rock']::osm_rock_pattern {
  polygon-pattern-file: url('icons/pattern-rock.png');
  polygon-pattern-opacity: 0.5;
}

/* POIs as an OSM map wants them, over Massif's rank ladder (%poi, one ::poi attachment):
   bakeries from z15 whatever their rank, winning their collisions; pharmacies held back to z17. */
#poi[zoom >= 15][class = 'bakery']::poi {
  @extend %poi;
  shield-placement-priority: 30000000;
}
#poi[zoom < 17][class = 'pharmacy']::poi {
  display: none;
}
