@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;

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
			casing/line-color: [nuti::selected_id]=[id] ? #0F70DF: #787E7B;
			casing/line-color: white;
			casing/line-width: [class=auto] ? 7: 5;
			casing/line-join: round;
			casing/line-cap: round;
			line-color: [nuti::selected_id]=[id] ? #60A5F4: #ACB0AE;
			line-width: [class=auto] ? 5: 3;
			line-width: 5;
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
	marker-placement: [nuti::markers3d];
	marker-file: url('symbols/pin.svg');
	marker-color: [isStart] ? 'green': ([isStop] ? 'red' : 'blue');
	marker-width: 24;
	marker-allow-overlap: true;
	marker-clip: false;
}

}