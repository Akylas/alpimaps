
//river styling
#water{
	
	[kind=stream][zoom>=13],
	[kind=riverbank][zoom>=13]{
		line-cap: round;
		line-color: @river;
		line-width: linear([view::zoom], (8, 0.5), (15, 1), (16, 2));
		// line-dasharray: 7, 5;
	}
	// [kind=river],
	// [kind=dock],
	// [kind=riverbank],
	// [kind=canal][zoom>=12]{
	// 	polygon-fill: @water;
	// }
	[kind=river],
	[kind=riverbank] {
		line-cap: round;
		line-color: @river;
		line-width: 1;
	}
	[kind=stream][zoom>=13],
	[kind=canal][zoom>=13]{
		line-cap: round;
		line-color: @river;
		line-width: linear([view::zoom], (13, 0.7), (14, 1), (15, 1.6));
	}
	[kind=dam][zoom>=15],
	[kind=weir][zoom>=15]{
		line-cap: round;
		line-color: @bridge_casing;
		line-width: 1;
	}
	[kind=lock][zoom>=16]{
		line-cap: round;
		line-color: @river;
		line-width: 1.5;
	}
	[kind=ditch][zoom>=17],
	[kind=drain][zoom>=17]{
		line-cap: round;
		line-color: @river;
		line-width: 1.8;
		line-dasharray: 0.9, 0.9;
	}
	
	[kind=ocean]{
		::shadow {
			polygon-fill: darken(@water, 0.3);
			polygon-geometry-transform: translate(0,1);
			[zoom>=14] {
				polygon-geometry-transform: translate(0,2);
			}
		}
		::fill {
			polygon-fill: @water;
		}
	}
	
	[kind=lake],
	[kind=pond],
	[kind=water],
	[kind=river][zoom>=8]{
		polygon-fill: @water;
		[kind=river]{
			line-color: @river;
			line-width:1;
		}
	}
}
