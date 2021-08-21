// @name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @markerOverlap: [nuti::selected_id] = [id] ? false : true;

// #lokavaluto {
// 	['mapnik::geometry_type'=3] {
// 		polygon-fill: rgb(95, 51, 122);
// 		polygon-opacity: linear([view::zoom], (12, 0.3), (12.5, 0));
// 		line-color: rgb(95, 51, 122);
// 		line-width:1;
// 	}
// 	['mapnik::geometry_type'=1]{

// 		::icon {
// 			marker-placement: [nuti::markers3d];
// 			marker-type: ellipse;
// 			marker-line-color: #fff;
// 			marker-fill: #8DA378;
// 			marker-width: 24;
// 			marker-height: 24;
// 			marker-allow-overlap: true;
// 			marker-clip: false;
// 		}
		
// 		::label {
// 			text-name: @name;
// 			text-face-name: @mont;
// 			text-placement: [nuti::markers3d];
// 			text-line-spacing: -1;
// 			text-wrap-before: true;
// 			text-avoid-edges: true;
// 			text-fill: #000000;
// 			text-size: 12;
// 			text-wrap-width: step([zoom], (15, 80), (16, 90), (18, 100));
// 			text-feature-id: [name];
// 			text-dy: 15; 
// 			text-halo-fill: #ffffff;
// 			text-halo-rasterizer: fast;
// 			text-halo-radius: 1;
// 		}
// 	}
	
// }
