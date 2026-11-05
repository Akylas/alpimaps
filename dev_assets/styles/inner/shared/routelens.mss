// The route lenses: slices, the halo of a focused section, the alerts while following a route, their plates.
// What the app sends is in app/routeFeatures/lens/sections.ts: `lens` (`k` its colour in the `lens_pal`
// table, `s` 0-3 how serious, `f` 0 out of focus), `lensfocus`, `navalert` (`kind` fast | steep), `lsym`.
// Planning draws in the items `poi` layer, following a route in `navigation`, under the maneuver arrows.
// A feature is drawn after the ones before it: the app sends the focus halo and the fast casing first.
// E-ink separates by width, ticks and dashes: the variables below, overridden in eink/.

@lens_w: @bicycle_line_width + 3 + @lens_core_extra;
@lens_case_w: linear([view::zoom], (10, 1), (16, 1.5), (18, 2));

// themes override these (eink/style.mss)
@lens_core_extra: 0;
@lens_dim_opacity: 0.35;
@lens_dim_shrink: 0;
@lens_halo_color: [param::main_color];
@lens_halo_opacity: 0.45;
@lens_halo_dash: none;
@lens_alert_dash: none;

#poi['mapnik::geometry_type'=2][class='lensfocus'],
#navigation['mapnik::geometry_type'=2][class='lensfocus'] {
	line-color: @lens_halo_color;
	line-opacity: @lens_halo_opacity;
	line-width: @lens_w + 10;
	line-dasharray: @lens_halo_dash;
	line-cap: round;
	line-join: round;
}

#poi['mapnik::geometry_type'=2][class='lens'],
#navigation['mapnik::geometry_type'=2][class='lens'] {
	line-border-color: [param::lens_case];
	line-border-width: @lens_case_w;
	line-color: get([param::lens_pal], [k], #8D96A3);
	line-width: @lens_w + ([s] = 3 ? 1.5 : 0) - ([f] = 1 ? 0 : @lens_dim_shrink);
	line-opacity: [f] = 1 ? 1 : @lens_dim_opacity;
	// round: slices meeting at a bend leave no wedge
	line-cap: round;
	line-join: round;
}

// followed on the navigation layer the slice is as wide as the route it covers
#navigation['mapnik::geometry_type'=2][class='lens'] {
	line-border-width: @nav_border_width;
	line-width: @directions_line_width;
	// only here: each ghosted rule is another pass, see navigation.mss
	line-occlusion-opacity: @nav_occlusion_opacity;
}

// an outer casing: it comes before the route in the layer, so it shows on both sides of it
#navigation['mapnik::geometry_type'=2][class='navalert'][kind='fast'] {
	line-color: get([param::lens_pal], 'r3', #D7263D);
	line-width: @directions_line_width + 2 * @nav_border_width + 5;
	line-dasharray: @lens_alert_dash;
	line-cap: round;
	line-join: round;
}

// the slice is oriented along the route: the chevrons point the way
#navigation['mapnik::geometry_type'=2][class='navalert'][kind='steep'][zoom>=13]::chev,
#poi['mapnik::geometry_type'=2][class='lens'][lens='climbs'][s>=2][zoom>=13]::chev {
	marker-placement: line;
	marker-type: arrow;
	marker-line-width: 0;
	marker-width: 8;
	marker-height: 7;
	marker-fill: #ffffff;
	marker-allow-overlap: true;
	marker-spacing: [s] = 3 ? 13 : 26;
}

// a speed sign: a white disc in a red ring, bigger once zoomed in
#poi[class='lsym'][sym='speed'][zoom>=12],
#navigation[class='lsym'][sym='speed'][zoom>=12] {
	text-name: [t];
	text-face-name: @mont_bd;
	text-size: 10;
	text-fill: #1b1c1d;
	text-background-fill: #ffffff;
	text-background-width: 22;
	text-background-height: 22;
	text-background-radius: 11;
	text-background-border-fill: get([param::lens_pal], 'sign', #D7263D);
	text-background-border-width: 3;
	text-placement: billboard;
	text-placement-priority: [p];
	text-clip: false;
	[zoom>=16] {
		text-size: 12;
		text-background-width: 28;
		text-background-height: 28;
		text-background-radius: 14;
	}
}

// the grade at the start of a steep run, '11 %'
#navigation[class='lsym'][sym='grade'][zoom>=14] {
	text-name: [t];
	text-face-name: @mont_bd;
	text-size: 10;
	text-fill: #ffffff;
	text-background-fill: get([param::lens_pal], [s] = 3 ? 'g7' : 'g6', #E34A33);
	text-background-radius: 5;
	text-background-padding-x: 4;
	text-dx: 22;
	text-placement: billboard;
	text-placement-priority: [p];
	text-clip: false;
}

// a climb's category on its summit, its name or figure in small under it
#poi[class='lsym'][sym='climb'][zoom>=11],
#navigation[class='lsym'][sym='climb'][zoom>=11] {
	text-name: [t];
	text-secondary-name: [t2];
	text-secondary-scale: 0.8;
	text-face-name: @mont_bd;
	text-size: 10;
	text-fill: get([param::lens_pal], 'plate_text', #ffffff);
	text-background-fill: get([param::lens_pal], 'plate', #2B2F33);
	text-background-radius: 4;
	text-background-padding-x: 5;
	text-background-padding-y: 2;
	text-vertical-alignment: bottom;
	text-dy: -6;
	text-placement: billboard;
	text-placement-priority: [p];
	text-clip: false;
}

// the weather at a point of the route; faded when the forecast is out of date
#poi[class='lsym'][sym='wx'][zoom>=9],
#navigation[class='lsym'][sym='wx'][zoom>=9] {
	shield-icon-name: [icon];
	shield-icon-face-name: [style.mapFontFamily] ?? @osm;
	shield-icon-size: 14;
	shield-icon-fill: get([param::lens_pal], 'w3', #4527A0);
	shield-name: [t];
	shield-face-name: @mont_bd;
	shield-size: 11;
	shield-fill: #1b1c1d;
	shield-background-fill: #ffffff;
	shield-background-radius: 10;
	shield-background-padding-x: 6;
	shield-background-border-fill: [stale] = 1 ? #9aa0a6 : #ffffff;
	shield-background-border-width: 1;
	shield-placement: point;
	shield-placement-priority: [p];
	shield-text-opacity: [stale] = 1 ? 0.55 : 1;
	shield-icon-opacity: [stale] = 1 ? 0.55 : 1;
}

// the wind, an arrow turned relative to the way the route goes
#poi[class='lsym'][sym='wind'][zoom>=11],
#navigation[class='lsym'][sym='wind'][zoom>=11] {
	text-name: '↑';
	text-orientation: [rot];
	text-size: 14;
	text-face-name: @mont_bd;
	text-fill: #1b1c1d;
	text-halo-fill: #ffffff;
	text-halo-radius: 1.5;
	text-dx: 18;
	text-clip: false;
}
