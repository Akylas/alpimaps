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

#contour['nuti::contours'>0] {
	[zoom>=12][ele>300],
	[zoom>=14][ele>200],
	[zoom>=16][ele>0] {
		// [zoom>=12][zoom<13][index!=2],
		// [zoom>=13][index!=2],
		// [zoom>=16] {
			line-width: 0.68;
			line-color: @contour;
			// line-comp-op: multiply;
			line-opacity: linear([view::zoom], (12, 0), (12.1, 0.2), (16, 0.3))
			[index=5][zoom>=16],
			[index=10] {
				line-opacity: linear([view::zoom], (12, 0), (12.1, 0.3), (16, 0.4))
				line-width: 0.96;
			}
		// }
		[index=5][zoom>=14],
		[index=10][zoom>=14] {
			text-face-name: @mont;
			text-name: [ele]+' m';
			text-fill: @contour;
			
			// text-halo-fill: @halo_park_label;
			// text-halo-radius: 1;
			// text-halo-rasterizer: fast;
			// text-comp-op: clear;
			text-min-distance: 20;
			text-avoid-edges: false;
			text-placement: line;
			// text-dy:-1;
			text-size: linear([view::zoom], (12, 6), (20, 10)) + 0.00001 * [ele];
		}
	}
}
