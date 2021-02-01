
//river styling
#waterway{
	
	[class=stream][zoom>=13]{
		line-cap: [view::zoom]<=12 ? butt : round;
		line-color: @rivers_stroke;
		line-width: linear([view::zoom], (8, 0.5), (15, 1.0), (16, 2.0));
		line-dasharray: 7, 5;
	}
	[class=river],
	[class=canal][zoom>=12]{
		line-cap: [view::zoom]<=12 ? butt : round;
		polygon-fill: @water;
		line-color: @rivers_stroke;
		line-width:1;
	}
	
}
#water {
	[class=ocean]{
		// ::shadow {
		// 	polygon-fill: @water_shadow;
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
		[class=river]{
			line-color: @rivers_stroke;
			line-width:1;
		}
	}
}
