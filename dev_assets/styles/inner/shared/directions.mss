@id:[id];
@is_selected: [nuti::selected_id]=[id];
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
			when ([nuti::selected_id]=[id])::selected,
			{
				casing/line-color:  @is_selected ? [nuti::main_darker_color]: @directions_casing_color;
				casing/line-width: @directions_casing_width;
				casing/line-join: round;
				casing/line-cap: round;
				casing/line-opacity: @directions_line_opacity;
				line-color: @is_selected ? [nuti::main_color]: ([style.color]? [style.color]:@directions_line_color);
				line-width: @directions_line_width;
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
		text-placement: nutibillboard;
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