

//river styling
#waterway{
	
	[class=stream][zoom>=13],
	[class=river][zoom>=12],
	[class=riverbank][zoom>=13]{
		line-color: @river;
		line-width: linear([view::zoom], (8, 0.5), (15, 1), (16, 2));
		// line-dasharray: 7, 5;
	}
	// [class=river],
	// [class=dock],
	// [class=riverbank],
	// [class=canal][zoom>=12]{
	// 	polygon-fill: @water;
	// }

	// [class=river],
	// [class=riverbank] {
	// 	line-color: @river;
	// 	line-width: 0;
	// }
	[class=stream][zoom>=12],
	[class=canal][zoom>=12]{
		line-color: @river; 
		line-width: linear([view::zoom], (13, 0.7), (14, 1), (15, 1.6));
	}
	[class=dam][zoom>=15],
	[class=weir][zoom>=15]{
		line-color: @bridge_casing;
		line-width: 1;
	}
	[class=lock][zoom>=16]{
		line-color: @river;
		line-width: 1.5;
	}
	[class=ditch][zoom>=15],
	[class=drain][zoom>=15]{
		line-color: @river;
		line-width: 1.4;
		line-dasharray: 2, 2;
	}
	
}
#water {
	[class=ocean]{
		// ::shadow {
		// 	polygon-fill: darken(@water, 0.3);
		// 	polygon-geometry-transform: translate(0,1);
		// 	[zoom>=14] {
		// 		polygon-geometry-transform: translate(0,2);
		// 	}
		// }
		// ::fill {
			polygon-fill: @water;
		// }
	}
	
	[class=lake],
	[class=fountain],
	[class=pond],
	[class=water],
	[class=river][zoom>=8]{
		polygon-fill: @water;
		// [class=river]{
		// 	line-color: @river; 
		// 	line-width:1;
		// }
	}
}
