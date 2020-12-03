#contour['nuti::contours'>0][zoom>=12][ele>0] {
	[div< 100] {

		[div>=50][zoom>=14] {

			line-color: @contour;
			line-width: 0.8;
			line-opacity: 0.3;
		}
		[div>=20][zoom>=15]{
			
			line-color: @contour;
			line-width: 0.6;
			line-opacity: 0.3;
		}
		[zoom>=16] {
			line-color: @contour;
			line-width: 0.4;
			line-opacity: 0.3;
		}
	}
	[div>=10][zoom>=14],
	[div>=20][zoom>=14]{
		line-color: @contour;
		line-width: 0.6;
		line-opacity: 0.3;
	}
	[div>=50][zoom>=13] {
		line-color: @contour;
		line-width: step([view::zoom], (12, 0.6), (14, 1.3)) ;
		line-opacity:step([view::zoom], (12, 0.3), (16, 0.5)) ;
	}
	[div>=100][zoom>=12] {
		line-color: @contour;
		line-width: step([view::zoom], (12, 0.6), (14, 1.3)) ;
		line-opacity:step([view::zoom], (12, 0.3), (15, 0.5)) ;
	}
	[div>=200][zoom>=12] {
		line-color: @contour;
		line-width: step([view::zoom], (12, 0.6), (13, 1.3)) ;
		line-opacity:step([view::zoom], (12, 0.3), (15, 0.5)) ;
	}
	[div>=500] [zoom>=12] {
		line-color: @contour;
		line-width: 1.3;
		line-opacity:step([view::zoom], (12, 0.3), (13, 0.5)) ;
	}
	
	[div>=500][zoom>=12],
	[div>=200][zoom>=13],
	[div>=100][zoom>=14] {
		text-face-name: @mont;
		text-name: [ele]+' m';
		text-fill: darken(@contour_label, 20%);
		text-avoid-edges: false;
		text-placement: line;
		text-size: linear([view::zoom], (12, 6), (20, 11)) + 0.00001 * [ele];
		// text-halo-fill: @contour_halo;
		// text-halo-rasterizer: fast;
		// text-halo-radius: 1;
	}
}

// #contour['nuti::contours'>0] {
// 	[zoom>=12][ele>300],
// 	[zoom>=14][ele>200],
// 	[zoom>=16][ele>0] {
// 		// [zoom>=12][zoom<13][index!=2],
// 		// [zoom>=13][index!=2],
// 		// [zoom>=16] {
// 			line-width: 0.68;
// 			line-color: @contour;
// 			// line-comp-op: multiply;
// 			line-opacity: linear([view::zoom], (12, 0), (12.1, 0.2), (16, 0.3))
// 			[index=5][zoom>=16],
// 			[index=10] {
// 				line-opacity: linear([view::zoom], (12, 0), (12.1, 0.3), (16, 0.4))
// 				line-width: 0.96;
// 			}
// 		// }
// 		[index=5][zoom>=14],
// 		[index=10][zoom>=13] {
// 			text-face-name: @mont;
// 			text-name: [ele]+' m';
// 			text-fill: @contour;
			
// 			text-min-distance: 20;
// 			text-avoid-edges: false;
// 			text-placement: line;
// 			text-size: linear([view::zoom], (12, 4), (20, 10)) + 0.00001 * [ele];
// 		}
// 	}
// }
