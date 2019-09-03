@buildingHeight: [render_height] ? [render_height] : 10;



#landuse {
	
/* 5.VEGETATION, BEACH & GLACIER */

	[zoom<=16]{
		[kind=nature_reserve][zoom>=6],
		[kind=national_park][zoom>=6],
		[kind=protected_area][zoom>=11]{
			text-name: @name;
			text-face-name: @mont_it_md;
			text-wrap-width: 50;
			text-wrap-before: true;
			text-fill: @park_label;
			text-halo-fill: @halo_park_label;
			text-halo-radius: 1;
			text-character-spacing: 1.1;
			text-size: linear([view::zoom], (5, 7.0), (13, 8.0), (16, 14.0));
		}
	}

	[kind=rock],
	[kind=bare_rock],
	[kind=cliff]{
		polygon-fill: fadeout(@rock, 0.8);
	}

	[kind=beach][zoom>=10] {
		polygon-fill: @beach;
	}
	[kind=sand] {
		polygon-fill: fadeout(@beach, 0.3);
	}
	[kind=glacier] {
		polygon-fill: @glacier;
		// line-width:0.5;
		// line-color: darken(@glacier, 0.1);
	}
	[kind=wetland][zoom>=11] {
			polygon-fill: @wetland;
			// [zoom>=12] {
			// 	polygon-pattern-file: url('symbols/wetland.png');
			// }
	}


	[kind=heath],
	[kind=grassland],
	// [subkind='recreation_ground'],
	[kind='meadow'],
	[kind='orchard'],
	[kind='vineyard'],
	[kind='farland']{
			// polygon-fill: linear([view::zoom], (12, @green1), (14, @green1));
			polygon-fill: @green1;
			// line-color: @park_outline;
			// line-width:0.5;
		
	}

	[kind=grass] {
		polygon-fill: @green1;
		[subkind=park] {
			polygon-fill: linear([view::zoom], (10, @green1), (15, @green5));
		}
		[subkind=wood],
		[subkind=forest] {
			polygon-fill: linear([view::zoom], (10, @green1), (16, @forest));
		}
		[subkind='recreation_ground'][zoom>=9]{
			polygon-fill: linear([view::zoom], (2, rgba(130, 191, 90, 0)), (11, rgba(130, 191, 90, 0.6)), (15, rgba(130, 191, 90, 0.7)));
		}
	}
	
	[kind=tree] {
		polygon-fill: linear([view::zoom], (10, @green1), (15, @green5));
	}
	
	[kind=wood] {
		polygon-fill: linear([view::zoom], (10, @green1), (16, @forest));
	}
	
	
}

#landuse {
	[kind=residential][zoom<=12]{
		polygon-fill: @residential_area;
		line-width: 0.5;
		line-color: darken(@residential, 0.2);
	}
	[kind=theme_park],
	[kind=zoo]{
			polygon-fill: linear([view::zoom], (13, fadeout(@playground, 0.6)), (14, fadeout(@playground, 0.9)));
	}
	[kind=military][zoom>=13] {
			polygon-fill: linear([view::zoom], (13, fadeout(@military, 0.6)), (14, fadeout(@military, 0.9)));
			// line-color: rgb(207, 211, 195)
	}
	[kind=hospital],
	[kind=doctors]{
		[zoom>=14] {
			polygon-fill: linear([view::zoom], (13, fadeout(@hospital, 0.6)), (14, fadeout(@hospital, 0.9)));
		}
	}

	/* 7.3 University & Sport */
	[kind=college],
	[kind=university],
	[kind=school]{
		[zoom>=12] {
				polygon-fill:linear([view::zoom], (12, fadeout(@university, 0.6)), (14, fadeout(@university, 1)));
			line-color: @university
			line-width: linear([view::zoom], (12, 0), (16, 1));
		}
	}
	/* 7.1 Industrial */
	// [kind=industrial],
	// [kind=commercial],
	// [kind=construction],
	// [kind=landfill],
	// [kind=railway],
	// [kind=quarry]{
	// 	[zoom>=10] {
	// 		polygon-fill: fadeout(@industrial, 0.8);
	// 	}
	// }

		// [kind=residential]{
	// 	polygon-fill: fadeout(@residential, 0.5);
	// 	line-width: 0.5;
	// 	line-color: darken(@residential, 0.2);
	// }
		[kind=playground]{
				polygon-fill: fadeout(@playground, 0.5);
				// line-color: rgb(207, 211, 195)
		}

		// [kind=military][zoom>=13] {
		// 		polygon-fill: fadeout(@military, 0.7);
		// 		// line-color: rgb(207, 211, 195)
		// }
		
		
		
		/* 7.2 Hostital */
		// [kind=hospital],
		// [kind=doctors]{
		// 	[zoom>=14] {
		// 		polygon-fill: fadeout(@hospital, 0);
		// 	}
		// }

		
		[kind=stadium],
		[kind=pitch]{
			polygon-fill: @sport;
			line-color:darken(@sport, 0.1);
			line-width:0.3;
		}


		/* 7.4 Cemetry */
		[kind=cemetery],
		[kind=grave_yard]{
			polygon-fill: linear([view::zoom], (14, fadeout(@rock, 0.85)), (16, fadeout(@rock, 0.55)));
		}
		
		[kind=salt_pond],
		[kind=basin],
		[kind=reservoir][zoom>=12]{
			polygon-fill: @river;
		}
}
// #roads ['mapnik::geometry_type'=3]{
// 	/* 7.5 Pedestrian areas */
// 	[kind=path] {
// 		[subkind=pedestrian],
// 		[subkind=footway],
// 		[subkind=living_street],
// 		[subkind=platform] {
// 			polygon-fill:linear([view::zoom], (14, fadeout(@pedestrian_area, 0.7)), (16, fadeout(@pedestrian_area_light, 0.7)));
// 		}
// 	}
	

	
// }

#aeroway['mapnik::geometry_type'=3][zoom>=10][zoom<=19] {
	/* 7.6 Airports */
	// line-color: @aeroways;
	// line-width: 0.5;
	[kind=airport],
	[kind=helipad],
	[kind=aerodrome] {
		polygon-fill:linear([view::zoom], (10, @aerodrome0), (11, @aerodrome1), (12, @aerodrome2), (13, @aerodrome3), (14, @aerodrome4), (15, @aerodrome5));
	}
}

#park[zoom>=6]{
	polygon-fill:fadeout(@park, 0.8);
	line-color: @park;
	line-width: 0.5;
}

#buildings [zoom>=14]['nuti::buildings'>0]{
	::3d['nuti::buildings'>1][zoom>=17]{
	  building-height: [render_height] ? [render_height] : 10;
	  building-min-height: [render_min_height];
	  building-fill: @building;
	  building-fill-opacity: 0.45;
	} 
  
	// ::shadow['nuti::buildings'=1][zoom>=18]{
	//   polygon-fill: @building_dark_border;
	//   polygon-opacity: linear([view::zoom], (18, 0), (19, 1));
	//   [zoom>=18] { polygon-geometry-transform: translate(0,1); }
	//   [zoom>=19] { polygon-geometry-transform: translate(0,2); }
	//   [zoom>=20] { polygon-geometry-transform: translate(0,3); }
	//   [zoom>=21] { polygon-geometry-transform: translate(0,5); } 
		
	// }
  
	['nuti::buildings'=1],
	['nuti::buildings'>1][zoom<17]{
		::fill{
			polygon-fill: @building;
			polygon-opacity: linear([view::zoom], (14, 0.5), (15, 0.6), (16, 0.8), (17, 0.9), (18, 1));
		}
		
	}
	::case[zoom>=16]{
		line-width: linear([view::zoom], (16, 0.2), (19, 1));
		line-opacity: linear([view::zoom], (16, 0.8), (17, 0.9), (18, 1));
		line-color: linear([view::zoom], (16, @building_border), (17, @building_dark_border));
	}
	  
  }

// #aeroway{
// 	line-color: @aeroways;
// 	line-width: 0.5;

// 	[kind=runway]{
// 		line-width: linear([view::zoom], (10, 0), (11, 0.5), (12, 1), (13, 2), (14, 4), (15, 6), (16, 8));
// 	}

// 	[kind=taxiway]{
// 		line-width: linear([view::zoom], (12, 0), (13, 0.5), (14, 1), (15, 2), (16, 4));
// 	}
// }
