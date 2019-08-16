#hillshade {
	[zoom<=20] {
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
	[zoom>=14][ele>300],
	[zoom>=16][ele>200],
	[zoom>=18][ele>0] {
		line-cap: butt;
		line-join: miter;
		line-width: 0.68;
		line-color: @contour;
		line-comp-op: minus;
		line-opacity: 0.2;
		[index=5][zoom>=14],
		[index=10] {
			line-opacity: 0.3;
			line-width: 0.96;
		}
	}
}
