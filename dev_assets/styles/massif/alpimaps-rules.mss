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

/* Unnamed tree dots keep their distance: the converter makes every circle overlap-free, so the dots
   are made to collide, each with an invisible bigger spacer. Same-feature pairs don't collide, so a
   dot never loses to its own spacer. */
#poi[zoom >= 16][zoom < 18][class = 'tree'][name = null]['param::models_3d' = 0]['param::variant' != 'hybrid']::poi_tree_dot {
  marker-allow-overlap: false;
  marker-allow-overlap-same-feature-id: true;
  marker-placement-priority: -1;
}
#poi[zoom >= 16][zoom < 18][class = 'tree'][name = null]['param::models_3d' = 0]['param::variant' != 'hybrid']::poi_tree_spacer {
  marker-width: (2 * linear([view::zoom], (16, 5), (18, 7)));
  marker-fill-opacity: 0;
  marker-line-width: 0;
  marker-allow-overlap: false;
  marker-allow-overlap-same-feature-id: true;
  marker-placement-priority: -1;
}
