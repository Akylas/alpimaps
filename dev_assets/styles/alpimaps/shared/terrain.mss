#hillshade['nuti::contours'>0]{
	[zoom<=18] {
		[class=shadow] {
			polygon-fill: #000;
			polygon-opacity: 0.05;
			[level=89] {
				polygon-opacity: 0.02;
			}
			[level=78] {
				polygon-opacity: 0.04;
			}
			[level=67] {
				polygon-opacity: 0.06;
			}
			[level=56] {
				polygon-opacity: 0.08;
			}
		}
		[class=highlight] { 
			polygon-fill: #fff;
			polygon-opacity: 0.1; 
		}
	}
}


#contour['nuti::contours'>0] {
	[zoom>=12][ele>300],
	[zoom>=14][ele>200],
	[zoom>=16][ele>0] {
		[zoom>=12][zoom<13][index!=2],
		[zoom>=13][index!=2],
		[zoom>=16] {
			line-width: 0.68;
			line-color: @contour;
			// line-comp-op: minus;
			line-opacity: 0.2;
			[index=5][zoom>=16],
			[index=10] {
				line-opacity: 0.3;
				line-width: 0.96;
			}
		}
		[index=5][zoom>=16],
		[index=10] {
			text-face-name: @mont;
			text-name: [ele]+' m';
			text-face-name: @mont;
			text-fill: @contour;
			// text-comp-op: minus;
			text-min-distance: 30;
			text-avoid-edges: true;
			text-placement: line;
			text-dy:-1;
			text-size: linear([view::zoom], (12, 6), (20, 10)) + 0.00001 * [ele];
		}
	}
}