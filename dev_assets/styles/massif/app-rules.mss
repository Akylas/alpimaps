/* Rules of the app, listed by every Massif project it ships (massif.json and alpimaps.json, after style.mss), so they
   reach every variant with one copy. Params: `app_fast_roads` (0/1, off) and `app_fast_speed` (km/h, one of 50..100):
   roads tagged at that speed or over, motorways apart, get a red casing just outside their own (near black on e-ink). The gap is the road's width (`@road_width_<class>`, Massif) plus twice its
   casing, which Massif grows in over z13-14 and to 2 at z22 (e-ink outlines earlier: close, not exact there).
   One selector per class and speed: the decoder prunes all but the ones the params name. */
#transportation[zoom >= 12][class = 'trunk'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 50]['param::app_fast_speed' = 50]['param::app_fast_roads' = 1]::app_fast_road_trunk,
#transportation[zoom >= 12][class = 'trunk'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 60]['param::app_fast_speed' = 60]['param::app_fast_roads' = 1]::app_fast_road_trunk,
#transportation[zoom >= 12][class = 'trunk'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 70]['param::app_fast_speed' = 70]['param::app_fast_roads' = 1]::app_fast_road_trunk,
#transportation[zoom >= 12][class = 'trunk'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 80]['param::app_fast_speed' = 80]['param::app_fast_roads' = 1]::app_fast_road_trunk,
#transportation[zoom >= 12][class = 'trunk'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 90]['param::app_fast_speed' = 90]['param::app_fast_roads' = 1]::app_fast_road_trunk,
#transportation[zoom >= 12][class = 'trunk'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 100]['param::app_fast_speed' = 100]['param::app_fast_roads' = 1]::app_fast_road_trunk {
  line-cap: 'round';
  line-color: (([param::variant] = 'eink') ? #1a1a1a : hsl(0, 75%, 50%));
  line-width: 1.5;
  line-gap-width: (@road_width_trunk + 2 * exponential(1.5, [view::zoom], (13, 0), (14, 1), (22, 2)));
  line-emissive-strength: (([param::lighting] = 0) ? 1 : 0);
}
#transportation[zoom >= 12][class = 'primary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 50]['param::app_fast_speed' = 50]['param::app_fast_roads' = 1]::app_fast_road_primary,
#transportation[zoom >= 12][class = 'primary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 60]['param::app_fast_speed' = 60]['param::app_fast_roads' = 1]::app_fast_road_primary,
#transportation[zoom >= 12][class = 'primary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 70]['param::app_fast_speed' = 70]['param::app_fast_roads' = 1]::app_fast_road_primary,
#transportation[zoom >= 12][class = 'primary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 80]['param::app_fast_speed' = 80]['param::app_fast_roads' = 1]::app_fast_road_primary,
#transportation[zoom >= 12][class = 'primary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 90]['param::app_fast_speed' = 90]['param::app_fast_roads' = 1]::app_fast_road_primary,
#transportation[zoom >= 12][class = 'primary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 100]['param::app_fast_speed' = 100]['param::app_fast_roads' = 1]::app_fast_road_primary {
  line-cap: 'round';
  line-color: (([param::variant] = 'eink') ? #1a1a1a : hsl(0, 75%, 50%));
  line-width: 1.5;
  line-gap-width: (@road_width_primary + 2 * exponential(1.5, [view::zoom], (13, 0), (14, 1), (22, 2)));
  line-emissive-strength: (([param::lighting] = 0) ? 1 : 0);
}
#transportation[zoom >= 12][class = 'secondary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 50]['param::app_fast_speed' = 50]['param::app_fast_roads' = 1]::app_fast_road_secondary,
#transportation[zoom >= 12][class = 'secondary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 60]['param::app_fast_speed' = 60]['param::app_fast_roads' = 1]::app_fast_road_secondary,
#transportation[zoom >= 12][class = 'secondary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 70]['param::app_fast_speed' = 70]['param::app_fast_roads' = 1]::app_fast_road_secondary,
#transportation[zoom >= 12][class = 'secondary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 80]['param::app_fast_speed' = 80]['param::app_fast_roads' = 1]::app_fast_road_secondary,
#transportation[zoom >= 12][class = 'secondary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 90]['param::app_fast_speed' = 90]['param::app_fast_roads' = 1]::app_fast_road_secondary,
#transportation[zoom >= 12][class = 'secondary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 100]['param::app_fast_speed' = 100]['param::app_fast_roads' = 1]::app_fast_road_secondary {
  line-cap: 'round';
  line-color: (([param::variant] = 'eink') ? #1a1a1a : hsl(0, 75%, 50%));
  line-width: 1.5;
  line-gap-width: (@road_width_secondary + 2 * exponential(1.5, [view::zoom], (13, 0), (14, 1), (22, 2)));
  line-emissive-strength: (([param::lighting] = 0) ? 1 : 0);
}
#transportation[zoom >= 12][class = 'tertiary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 50]['param::app_fast_speed' = 50]['param::app_fast_roads' = 1]::app_fast_road_tertiary,
#transportation[zoom >= 12][class = 'tertiary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 60]['param::app_fast_speed' = 60]['param::app_fast_roads' = 1]::app_fast_road_tertiary,
#transportation[zoom >= 12][class = 'tertiary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 70]['param::app_fast_speed' = 70]['param::app_fast_roads' = 1]::app_fast_road_tertiary,
#transportation[zoom >= 12][class = 'tertiary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 80]['param::app_fast_speed' = 80]['param::app_fast_roads' = 1]::app_fast_road_tertiary,
#transportation[zoom >= 12][class = 'tertiary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 90]['param::app_fast_speed' = 90]['param::app_fast_roads' = 1]::app_fast_road_tertiary,
#transportation[zoom >= 12][class = 'tertiary'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 100]['param::app_fast_speed' = 100]['param::app_fast_roads' = 1]::app_fast_road_tertiary {
  line-cap: 'round';
  line-color: (([param::variant] = 'eink') ? #1a1a1a : hsl(0, 75%, 50%));
  line-width: 1.5;
  line-gap-width: (@road_width_tertiary + 2 * exponential(1.5, [view::zoom], (13, 0), (14, 1), (22, 2)));
  line-emissive-strength: (([param::lighting] = 0) ? 1 : 0);
}
#transportation[zoom >= 12][class = 'minor'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 50]['param::app_fast_speed' = 50]['param::app_fast_roads' = 1]::app_fast_road_minor,
#transportation[zoom >= 12][class = 'minor'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 60]['param::app_fast_speed' = 60]['param::app_fast_roads' = 1]::app_fast_road_minor,
#transportation[zoom >= 12][class = 'minor'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 70]['param::app_fast_speed' = 70]['param::app_fast_roads' = 1]::app_fast_road_minor,
#transportation[zoom >= 12][class = 'minor'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 80]['param::app_fast_speed' = 80]['param::app_fast_roads' = 1]::app_fast_road_minor,
#transportation[zoom >= 12][class = 'minor'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 90]['param::app_fast_speed' = 90]['param::app_fast_roads' = 1]::app_fast_road_minor,
#transportation[zoom >= 12][class = 'minor'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 100]['param::app_fast_speed' = 100]['param::app_fast_roads' = 1]::app_fast_road_minor {
  line-cap: 'round';
  line-color: (([param::variant] = 'eink') ? #1a1a1a : hsl(0, 75%, 50%));
  line-width: 1.5;
  line-gap-width: (@road_width_minor + 2 * exponential(1.5, [view::zoom], (13, 0), (14, 1), (22, 2)));
  line-emissive-strength: (([param::lighting] = 0) ? 1 : 0);
}
#transportation[zoom >= 12][class = 'service'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 50]['param::app_fast_speed' = 50]['param::app_fast_roads' = 1]::app_fast_road_service,
#transportation[zoom >= 12][class = 'service'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 60]['param::app_fast_speed' = 60]['param::app_fast_roads' = 1]::app_fast_road_service,
#transportation[zoom >= 12][class = 'service'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 70]['param::app_fast_speed' = 70]['param::app_fast_roads' = 1]::app_fast_road_service,
#transportation[zoom >= 12][class = 'service'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 80]['param::app_fast_speed' = 80]['param::app_fast_roads' = 1]::app_fast_road_service,
#transportation[zoom >= 12][class = 'service'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 90]['param::app_fast_speed' = 90]['param::app_fast_roads' = 1]::app_fast_road_service,
#transportation[zoom >= 12][class = 'service'][brunnel != 'tunnel'][ramp != 1][maxspeed >= 100]['param::app_fast_speed' = 100]['param::app_fast_roads' = 1]::app_fast_road_service {
  line-cap: 'round';
  line-color: (([param::variant] = 'eink') ? #1a1a1a : hsl(0, 75%, 50%));
  line-width: 1.5;
  line-gap-width: (@road_width_service + 2 * exponential(1.5, [view::zoom], (13, 0), (14, 1), (22, 2)));
  line-emissive-strength: (([param::lighting] = 0) ? 1 : 0);
}
