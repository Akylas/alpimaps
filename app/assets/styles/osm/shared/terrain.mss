// #hillshade['nuti::contours'>0][zoom<=18]{
// 	[class=shadow] {
// 		polygon-fill: #000;
// 		polygon-opacity: 0.05;
// 		[level=89] {
// 			polygon-opacity: 0.02;
// 		}
// 		[level=78] {
// 			polygon-opacity: 0.04;
// 		}
// 		[level=67] {
// 			polygon-opacity: 0.06;
// 		}
// 		[level=56] {
// 			polygon-opacity: 0.08;
// 		}
// 	}
// 	[class=highlight] {
// 		polygon-fill: #fff;
// 		polygon-opacity: 0.1;
// 	}
// }

#contour['nuti::contours'>0][zoom>=12] {
		line-width: 0.68;
		line-color: @contour;
		line-opacity: linear([view::zoom], (12, 0), (12.1, 0.1))
		[zoom<13],
		[zoom>=13][div>=100],
		[zoom>=14][div>=50],
		[zoom>=15][div>=20]{
			line-opacity: linear([view::zoom], (12, 0), (12.1, 0.2), (16, 0.3))
		}
		[div>=100][zoom>=15],
		[div>=200] {
			line-opacity: linear([view::zoom], (12, 0), (12.1, 0.3), (16, 0.4))
			line-width: 0.96;
		}
		[div>=200][zoom>=13],
		[div>=100][zoom>=14] {
			text-face-name: @mont;
			text-name: [ele]+' m';
			text-fill: @contour;
			text-min-distance: 20;
			text-avoid-edges: false;
			text-placement: line;
			text-size: linear([view::zoom], (12, 4), (20, 10)) + 0.00001 * [ele];
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
