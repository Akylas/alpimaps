
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;
@id:[id];
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
				casing/line-color: [nuti::selected_id]=@id ? [nuti::main_darker_color]: #787E7B;
				casing/line-width: [class=auto] ? 7: 5;
				casing/line-join: round;
				casing/line-cap: round;
				casing/line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
				line-color: [nuti::selected_id]=[id] ? [nuti::main_color]: ([style.color]? [style.color]:#ACB0AE);
				line-width: [class=auto] ? 5: 3;
				line-opacity: linear([view::zoom], (16, 1), (18, 0.3));
				line-join: round;
				line-cap: round;
				marker-placement: line;
				marker-type: arrow;
				marker-line-width: 0;
				marker-opacity: 0.6;
				marker-width: 4;
				marker-height: 4;
				marker-fill: [nuti::selected_id]=[id] ? #B3CEFF: #ACB0AE;
			}
		}
	}

	['mapnik::geometry_type'=1] {
		text-placement: nutibillboard;
		// text-file: url('symbols/pin.svg');
		text-fill: [isStart] ? 'green': ([isStop] ? 'red' : 'blue');
		// text-width: 24;
		text-allow-overlap: true;
		text-clip: false;
		text-name:[isStop]? '' : '';
		text-face-name: 'osm';
		text-size: [isStop]?26:30;
		text-halo-fill: @standard-halo-fill;
		text-halo-radius: @standard-halo-radius;
		text-horizontal-alignment : middle;
		text-vertical-alignment: bottom;
		text-dx:[isStop]?11	:-3;
	}

}