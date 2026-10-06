/* Listed AFTER style.mss: new attachments draw with their source layer's topmost entry. */

/* Alpimaps' textures over the flat colours, from the zoom each says something, tinted as it tints
   them. Massif's own pattern sprites are e-ink's grey; the tint puts the colour back. */
#landcover[zoom >= 12][class = 'wood']::osm_wood_pattern {
  polygon-pattern-file: url('icons/pattern-wood.png');
  polygon-pattern-fill: #6f9a5c;
  polygon-pattern-opacity: linear([view::zoom], (12, 0), (13, 0.5), (15, 0.2));
}
#landcover[zoom >= 11][subclass = 'scrub']::osm_scrub_pattern {
  polygon-pattern-file: url('icons/pattern-scrub.png');
  polygon-pattern-fill: #7f9a5c;
  polygon-pattern-opacity: 0.5;
}
#landcover[zoom >= 11][class = 'wetland']::osm_wetland_pattern {
  polygon-pattern-file: url('icons/pattern-wetland.png');
  polygon-pattern-fill: #4d80b3;
  polygon-pattern-opacity: 0.6;
}
#landcover[zoom >= 11][class = 'rock']::osm_rock_pattern {
  polygon-pattern-file: url('icons/pattern-rock.png');
  polygon-pattern-opacity: 0.5;
}
