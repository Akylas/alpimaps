#boundary[admin_level=2][maritime=0]{
	line-color: @admin1_low;
	line-opacity: linear([view::zoom], (0, 0.6), (4, 0.9), (12, 0.9), (18, 0.6));
	line-width: linear([view::zoom], (0, 1), (3, 1), (6, 1.2), (13, 3));

	[disputed=1]{
		line-dasharray: 3,3;
		[zoom>=7] { line-dasharray: 4,4; }
	}
}

//state and province boundaries
#boundary[admin_level>2][admin_level<=6][zoom>=5][maritime=0]{
	// eraser/	// eraser/line-color: @landmass_fill;
	// eraser/line-width: linear([view::zoom], (4, 0.0), (7, 1.0), (9, 1.2));
	line-color: linear([view::zoom], (4, @admin1_low), (6, @admin1_high));
	line-width: linear([view::zoom], (4, 0), (7, 1), (9, 1.2));
	[zoom>=7]{
		line-dasharray: 2,2;
	}
}
