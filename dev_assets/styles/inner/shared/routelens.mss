// The route lenses: slices, the halo of a focused section, the alerts while following a route, their plates.
// What the app sends is in app/routeFeatures/lens/sections.ts: `lens` (`k` its colour in the `lens_pal`
// table, `s` 0-3 how serious, `f` 0 out of focus), `lensfocus`, `navalert` (`kind` fast | steep), `lens_symbol` (`shape` says its drawing: plate, speed_sign, grade_label, climb_label).
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

// every lens but on e-ink is drawn as one line for the whole route (`ramp` 1): its colours are the ramp the app sends, not `k`.
// The source needs lineMetrics, see lensFeatures
#poi['mapnik::geometry_type'=2][class='lens'][ramp=1],
#navigation['mapnik::geometry_type'=2][class='lens'][ramp=1] {
	line-gradient: [gradient];
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
	line-color: get([param::lens_pal], 'alert_fast', #D7263D);
	line-width: @directions_line_width + 2 * @nav_border_width + 5;
	line-dasharray: @lens_alert_dash;
	line-cap: round;
	line-join: round;
}

// the slice is oriented along the route: the chevrons point the way
#navigation['mapnik::geometry_type'=2][class='navalert'][kind='steep'][zoom>=13]::chev,
#poi['mapnik::geometry_type'=2][class='lens'][lens='climbs'][s>=2][zoom>=13]::chev,
#poi['mapnik::geometry_type'=2][class='lens_chev'][lens='climbs'][zoom>=13]::chev {
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
#poi[class='lens_symbol'][shape='speed_sign'][zoom>=12],
#navigation[class='lens_symbol'][shape='speed_sign'][zoom>=12] {
	text-name: [label];
	text-face-name: @mont_bd;
	text-size: 10;
	text-fill: #1b1c1d;
	text-background-fill: #ffffff;
	text-background-width: 22;
	text-background-height: 22;
	text-background-radius: 11;
	text-background-border-fill: get([param::lens_pal], 'speed_sign_rim', #D7263D);
	text-background-border-width: 3;
	text-placement: billboard;
	text-placement-priority: [priority];
	text-clip: false;
	[zoom>=16] {
		text-size: 12;
		text-background-width: 28;
		text-background-height: 28;
		text-background-radius: 14;
	}
}

// the grade at the start of a steep run, '11 %'
#navigation[class='lens_symbol'][shape='grade_label'][zoom>=14] {
	text-name: [label];
	text-face-name: @mont_bd;
	text-size: 10;
	text-fill: #ffffff;
	text-background-fill: get([param::lens_pal], [severity] = 3 ? 'grade_7' : 'grade_6', #E34A33);
	text-background-radius: 5;
	text-background-padding-x: 4;
	text-dx: 22;
	text-placement: billboard;
	text-placement-priority: [priority];
	text-clip: false;
}

// a climb's plate in the middle of it: the category and what it gains, on two lines. Always shown:
// a label of the map next to it must not take its place
#poi[class='lens_symbol'][shape='climb_label'][zoom>=11],
#navigation[class='lens_symbol'][shape='climb_label'][zoom>=11] {
	text-name: [label];
	text-face-name: @mont_bd;
	text-size: 10;
	text-line-spacing: 1;
	text-horizontal-alignment: middle;
	text-fill: get([param::lens_pal], 'plate_text', #ffffff);
	text-background-fill: get([param::lens_pal], 'plate', #2B2F33);
	text-background-radius: 5;
	text-background-padding-x: 6;
	text-background-padding-y: 3;
	text-vertical-alignment: bottom;
	text-dy: -9;
	text-placement: billboard;
	text-placement-priority: [priority];
	text-allow-overlap: true;
	text-clip: false;
}

// the tip of the plate, a down triangle of the icon font under it: a label has no tail of its own
#poi[class='lens_symbol'][shape='climb_label_tip'][zoom>=11],
#navigation[class='lens_symbol'][shape='climb_label_tip'][zoom>=11] {
	// the glyph's triangle is 0.42 em wide and sits mid-box (0.48 em up from the bottom): dy puts its top on the plate
	text-name: [label];
	text-face-name: 'Material Design Icons';
	text-size: 24;
	text-fill: get([param::lens_pal], 'plate', #2B2F33);
	// measured on a device: the glyph sits 3 dp right of the plate's middle
	text-dx: -3;
	text-horizontal-alignment: middle;
	text-vertical-alignment: bottom;
	text-dy: 7.5;
	text-placement: billboard;
	text-placement-priority: [priority];
	text-allow-overlap: true;
	text-clip: false;
}

// a plate: a glyph of the icon font, then, in a smaller type, a label, a sublabel and, on a line of its own, a note, on a white plate. What
// it says is the app's (a feature puts any figures on it): the style only lays it out. The glyph is the main face
// of the list, so it is the one a glyph is looked for in, the text font following for the digits. The rim is the colour of the
// palette key `tint` names, white without one; faded and grey-rimmed when what it says is out of date (`outdated`). The newline of
// `note` is the app's
@plate_rim: [outdated] = 1 ? #9aa0a6 : ([tint] ? get([param::lens_pal], [tint], #ffffff) : #ffffff);
#poi[class='lens_symbol'][shape='plate'][zoom>=9],
#navigation[class='lens_symbol'][shape='plate'][zoom>=9] {
	text-name: [glyph];
	text-face-name: 'Material Design Icons, ' + @mont_bd;
	text-size: 14;
	text-fill: [outdated] = 1 ? #9aa0a6 : #1b1c1d;
	text-secondary-name: ' ' + [label] + ([sublabel] ? (' ' + [sublabel]) : '') + ([note] ? [note] : '');
	text-secondary-scale: 0.6;
	text-secondary-fill: [outdated] = 1 ? #9aa0a6 : #1b1c1d;
	text-background-fill: #ffffff;
	text-background-radius: 7;
	text-background-padding-x: 4;
	text-background-padding-y: 2;
	text-background-border-width: 1;
	text-background-border-fill: @plate_rim;
	text-opacity: [outdated] = 1 ? 0.55 : 1;
	text-secondary-opacity: [outdated] = 1 ? 0.55 : 1;
	text-background-opacity: [outdated] = 1 ? 0.55 : 1;
	text-placement: billboard;
	text-placement-priority: [priority];
	text-clip: false;
}
