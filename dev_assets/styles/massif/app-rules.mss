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

/* Bike arrows. Params: `travel_mode` (0/1, off), 1 while the rider is on a bike (travelModeStore), and `app_oneway_emphasis` (0-2), the user's
   `oneway_emphasis` (Map.svelte sets both). In bike mode Massif's own arrows are hidden (the app passes it `oneway_emphasis` = 3, which none
   of its layers is gated on) and these draw instead, with a ring on the tail, at Massif's own spacing, size and zoom for each emphasis:
   orange where a bike may only follow the traffic (against the cars would be wrong), one blue double-headed arrow where the tiles carry
   `oneway_bicycle` = no (cairn `transportation_cycleway`): bikes may ride both ways. `oneway_bicycle` is only set on one-way ways.
   Drawings: icons-src/. */
#transportation[zoom >= 16][class = 'trunk'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_e0,
#transportation[zoom >= 16][class = 'primary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_e0,
#transportation[zoom >= 16][class = 'secondary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_e0,
#transportation[zoom >= 16][class = 'tertiary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_e0,
#transportation[zoom >= 16][class = 'minor'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_e0,
#transportation[zoom >= 16][class = 'service'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_e0 {
  marker-file: url('icons/bike-oneway-warn.png');
  marker-placement: 'line';
  marker-spacing: 200;
  marker-width: (linear([view::zoom], (16, 0.6), (18, 1)) * 16);
  marker-opacity: 0.8;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 16][class = 'trunk'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_reverse_e0,
#transportation[zoom >= 16][class = 'primary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_reverse_e0,
#transportation[zoom >= 16][class = 'secondary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_reverse_e0,
#transportation[zoom >= 16][class = 'tertiary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_reverse_e0,
#transportation[zoom >= 16][class = 'minor'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_reverse_e0,
#transportation[zoom >= 16][class = 'service'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_reverse_e0 {
  marker-file: url('icons/bike-oneway-reverse-warn.png');
  marker-placement: 'line';
  marker-spacing: 200;
  marker-width: (linear([view::zoom], (16, 0.6), (18, 1)) * 16);
  marker-opacity: 0.8;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 16][class = 'trunk'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_both_e0,
#transportation[zoom >= 16][class = 'primary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_both_e0,
#transportation[zoom >= 16][class = 'secondary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_both_e0,
#transportation[zoom >= 16][class = 'tertiary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_both_e0,
#transportation[zoom >= 16][class = 'minor'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_both_e0,
#transportation[zoom >= 16][class = 'service'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 0]['param::travel_mode' = 1]::app_bike_oneway_both_e0 {
  marker-file: url('icons/bike-oneway-both-accent.png');
  marker-placement: 'line';
  marker-spacing: 200;
  marker-width: (linear([view::zoom], (16, 0.6), (18, 1)) * 20);
  marker-opacity: 0.8;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 15][class = 'trunk'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_e1,
#transportation[zoom >= 15][class = 'primary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_e1,
#transportation[zoom >= 15][class = 'secondary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_e1,
#transportation[zoom >= 15][class = 'tertiary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_e1,
#transportation[zoom >= 15][class = 'minor'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_e1,
#transportation[zoom >= 15][class = 'service'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_e1 {
  marker-file: url('icons/bike-oneway-warn.png');
  marker-placement: 'line';
  marker-spacing: 160;
  marker-width: (linear([view::zoom], (15, 0.45), (16, 0.6), (18, 1)) * 16);
  marker-opacity: 1;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 15][class = 'trunk'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_reverse_e1,
#transportation[zoom >= 15][class = 'primary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_reverse_e1,
#transportation[zoom >= 15][class = 'secondary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_reverse_e1,
#transportation[zoom >= 15][class = 'tertiary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_reverse_e1,
#transportation[zoom >= 15][class = 'minor'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_reverse_e1,
#transportation[zoom >= 15][class = 'service'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_reverse_e1 {
  marker-file: url('icons/bike-oneway-reverse-warn.png');
  marker-placement: 'line';
  marker-spacing: 160;
  marker-width: (linear([view::zoom], (15, 0.45), (16, 0.6), (18, 1)) * 16);
  marker-opacity: 1;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 15][class = 'trunk'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_both_e1,
#transportation[zoom >= 15][class = 'primary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_both_e1,
#transportation[zoom >= 15][class = 'secondary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_both_e1,
#transportation[zoom >= 15][class = 'tertiary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_both_e1,
#transportation[zoom >= 15][class = 'minor'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_both_e1,
#transportation[zoom >= 15][class = 'service'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 1]['param::travel_mode' = 1]::app_bike_oneway_both_e1 {
  marker-file: url('icons/bike-oneway-both-accent.png');
  marker-placement: 'line';
  marker-spacing: 160;
  marker-width: (linear([view::zoom], (15, 0.45), (16, 0.6), (18, 1)) * 20);
  marker-opacity: 1;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 15][class = 'trunk'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_e2,
#transportation[zoom >= 15][class = 'primary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_e2,
#transportation[zoom >= 15][class = 'secondary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_e2,
#transportation[zoom >= 15][class = 'tertiary'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_e2,
#transportation[zoom >= 15][class = 'minor'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_e2,
#transportation[zoom >= 15][class = 'service'][oneway = 1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_e2 {
  marker-file: url('icons/bike-oneway-warn.png');
  marker-placement: 'line';
  marker-spacing: 145;
  marker-width: (linear([view::zoom], (15, 0.6), (16, 0.8), (18, 1.3)) * 16);
  marker-opacity: 1;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 15][class = 'trunk'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_reverse_e2,
#transportation[zoom >= 15][class = 'primary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_reverse_e2,
#transportation[zoom >= 15][class = 'secondary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_reverse_e2,
#transportation[zoom >= 15][class = 'tertiary'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_reverse_e2,
#transportation[zoom >= 15][class = 'minor'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_reverse_e2,
#transportation[zoom >= 15][class = 'service'][oneway = -1][oneway_bicycle != 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_reverse_e2 {
  marker-file: url('icons/bike-oneway-reverse-warn.png');
  marker-placement: 'line';
  marker-spacing: 145;
  marker-width: (linear([view::zoom], (15, 0.6), (16, 0.8), (18, 1.3)) * 16);
  marker-opacity: 1;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
#transportation[zoom >= 15][class = 'trunk'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_both_e2,
#transportation[zoom >= 15][class = 'primary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_both_e2,
#transportation[zoom >= 15][class = 'secondary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_both_e2,
#transportation[zoom >= 15][class = 'tertiary'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_both_e2,
#transportation[zoom >= 15][class = 'minor'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_both_e2,
#transportation[zoom >= 15][class = 'service'][oneway_bicycle = 'no']['param::app_oneway_emphasis' = 2]['param::travel_mode' = 1]::app_bike_oneway_both_e2 {
  marker-file: url('icons/bike-oneway-both-accent.png');
  marker-placement: 'line';
  marker-spacing: 145;
  marker-width: (linear([view::zoom], (15, 0.6), (16, 0.8), (18, 1.3)) * 20);
  marker-opacity: 1;
  marker-allow-overlap: true;
  marker-clip: false;
  marker-emissive-strength: 1;
}
