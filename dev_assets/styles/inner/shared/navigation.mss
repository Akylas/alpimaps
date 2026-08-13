// The route navigation is actually following, drawn from its own layer.
//
// It is a layer of its own because navigation must not run on the item the user selected: a reroute
// would rewrite their own route. So the planned route keeps drawing as a plain item underneath
// (de-emphasised through [nuti::navigating]), and what is being followed is drawn here on top.
//
//   route      the line being followed
//   detour     the leg taking the user back onto the route
//   connector  the straight hint from the user to the point they are heading back to
//   original   the route a full reroute replaced, kept visible so the change is readable

#navigation['mapnik::geometry_type'=2] {
	[class='route'] {
		casing/line-color: @nav_casing_color;
		casing/line-width: @directions_casing_width;
		casing/line-join: round;
		casing/line-cap: round;
		casing/line-opacity: @directions_casing_opacity;
		line-color: @nav_line_color;
		line-width: @directions_line_width;
		line-opacity: @directions_line_opacity;
		line-join: round;
		line-cap: round;

		[zoom>=13] {
			marker-placement: line;
			marker-type: arrow;
			marker-line-width: 0;
			marker-opacity: 0.9;
			marker-width: @directions_arrow_size;
			marker-height: @directions_arrow_size;
			marker-fill: @nav_arrow_color;
		}
	}

	// same width as the route it replaces, dashed so which part of the line is a detour is obvious
	// without relying on colour, which a black and white screen cannot show
	[class='detour'] {
		casing/line-color: @nav_casing_color;
		casing/line-width: @directions_casing_width;
		casing/line-join: round;
		casing/line-cap: round;
		casing/line-opacity: @directions_casing_opacity;
		line-color: @nav_detour_color;
		line-width: @directions_line_width;
		line-dasharray: @nav_detour_dash;
		line-join: round;
		line-cap: butt;
	}

	[class='original'] {
		line-color: @nav_original_color;
		line-width: @nav_original_width;
		line-dasharray: @nav_original_dash;
		line-join: round;
		line-cap: round;
	}
}

// its own layer because it is redrawn on every position while the rest of the navigation layer is
// not: a straight line from the user to the point they are being sent back to. There is no road
// under it and it is not a way to go, so it is thin and dotted rather than drawn like a route
#navigation_hint['mapnik::geometry_type'=2][class='connector'] {
	line-color: @nav_connector_color;
	line-width: @nav_connector_width;
	line-dasharray: @nav_connector_dash;
	line-cap: round;
}
