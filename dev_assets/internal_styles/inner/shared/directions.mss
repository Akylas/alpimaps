@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;

#directions {

	['mapnik::geometry_type'=2]{
		[class='waypointline'] {
			line-color: #00000077;
			line-join: round;
			line-cap: round;
			line-width: 3;
		}
		[class!='waypointline'] {
			::casing {
				line-color: white;
				line-width: 6.5;
				line-join: round;
				line-cap: round;
			}
			when ([nuti::selected_id] = [id])::selected, 
			::inner {
				line-color: [nuti::selected_id] = [id] ? #60A5F4: #ACB0AE;
				line-width: 5;
				line-join: round;
				line-cap: round;
				marker-placement: line;
				marker-type:arrow;
				marker-line-width:0;
				marker-opacity:0.6;
				marker-width: 4;
				marker-height: 4;
				marker-fill: [nuti::selected_id] = [id] ? #B3CEFF : #ACB0AE;
			}
		}
		
    }
	['mapnik::geometry_type'=1]{

		// ::icon {
			marker-placement: [nuti::markers3d];
			marker-file: url('symbols/pin.svg');
			marker-color: [isStart] ? 'green' : ([isStop] ? 'red' : 'blue');
			marker-width: 24;
			marker-height: 24;
            marker-transform: translate (0,-12);
			marker-allow-overlap: true;
			marker-clip: false;
		// }
		
		// ::label {
		// 	text-name: @name;
		// 	text-face-name: @mont;
		// 	text-placement: [nuti::markers3d];
		// 	text-line-spacing: -1;
		// 	text-wrap-before: true;
		// 	text-avoid-edges: true;
		// 	text-fill: #000000;
		// 	text-size: 12;
		// 	text-wrap-width: step([zoom], (15, 80), (16, 90), (18, 100));
		// 	text-feature-id: [name];
		// 	text-dy: 3; 
		// 	text-halo-fill: #ffffff;
		// 	text-halo-rasterizer: fast;
		// 	text-halo-radius: 1;
		// }
	}
	
}
