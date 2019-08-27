
#boundary{
	/* 3.1 Country */
	[admin_level=2] {
		line-color: @border_country;
		line-opacity: linear([view::zoom], (2, 0.7), (3, 0.8), (22, 0.8));
		line-width: linear([view::zoom], (3, 0.5), (4, 0.6), (5, 0.8), (6, 0.85), (7, 1), (8, 1.1), (9, 1.4));
	}
	/* 3.2 Region */
	[admin_level=3][zoom>=4][zoom<5]{
		line-color: @border_region;
		line-width: 0.8;
		line-dasharray: 0.9,0.36;

	}
	[admin_level=4][zoom>=5]{
		line-color: @border_region;
		line-width: linear([view::zoom], (5, 0.7), (6, 0.8), (7, 0.9), (8, 0.9), (9, 1), (10, 1.2));
		line-opacity: linear([view::zoom], (5, 0.8), (6, 0.9));
		line-dasharray: linear([view::zoom], (5, (1.35,0.9)), (6, (0.9,0.45)), (7, (1.8,0.9)), (8, (1.44,1.44)), (9, (1.8,0.9)));

	}
}

