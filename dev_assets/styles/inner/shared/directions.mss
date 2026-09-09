@id:[id];
// while navigating, the followed route is drawn by the navigation layer on top: this one drops back
// to the plain look rather than competing with it
@is_selected: [param::navigating]=1 ? false : [param::selected_id]=[id];
#directions {
	['mapnik::geometry_type'=2] {
		[class='waypointline'] {
			line-color: #00000077;
			line-join: round;
			line-cap: round;
			line-width: 3;
			text-name: [text];
			text-placement: line;
			text-wrap-before: true;
			text-face-name: @mont;
			text-size: 10;
			text-allow-overlap: true;
			text-halo-fill: @route_label_halo;
			text-halo-radius: @route_label_halo_radius;
			text-dy: @route_text_dy;
		}

		[class !='waypointline'] {
			when ([param::selected_id]=[id])::selected,
			{
				// The casing is this line's own border, not a second line under it: the renderer runs
				// the border pass for the whole batch before the fill pass, so it still sits under
				// every route while sharing the fill's geometry, joins and caps.
				// line-border-width is the casing on EACH side, hence the halved difference.
				line-border-color: @is_selected ? [param::main_darker_color]: @directions_casing_color;
				line-border-width: (@directions_casing_width - @directions_line_width) / 2;
				line-color: @is_selected ? [param::main_color]: ([style.color]? [style.color]:@directions_line_color);
				line-width: @directions_line_width;
				// the border takes the line's opacity - a border cannot carry its own - so above z15
				// the casing now fades with the route instead of staying opaque under it
				line-opacity: @directions_line_opacity;
				line-join: round;
				line-cap: round;
				marker-placement: line;
				marker-type: arrow;
				marker-line-width: 0;
				marker-opacity: 0.9;
				marker-width: @directions_arrow_size;
				marker-height: @directions_arrow_size;
				marker-fill:  @is_selected ? @directions_selected_arrow_color: @directions_arrow_color;
			}
		}
	}

	['mapnik::geometry_type'=1] {
		text-placement: billboard;
		text-fill: [isStart] ? 'green': ([isStop] ? 'red' : 'blue');
		text-allow-overlap: true;
		text-clip: false;
		text-name:[isStop]? '' : '';
		text-face-name: @osm;
		text-size: [isStop]?26:30;
		text-halo-fill: @standard-halo-fill;
		text-halo-radius: @standard-halo-radius;
		text-horizontal-alignment : middle;
		text-vertical-alignment: bottom;
		text-dx:[isStop]?11	:-3;
	}

}