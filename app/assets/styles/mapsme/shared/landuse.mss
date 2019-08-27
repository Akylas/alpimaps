@buildingHeight: [render_height] ? [render_height] : 10;


#landuse {
	::backlayer {
		[class=residential][zoom<=12]{
			polygon-fill: @residential_area;
			line-width: 0.5;
			line-color: darken(@residential, 0.2);
		}
		[class=theme_park],
		[class=zoo]{
				polygon-fill: linear([view::zoom], (13, fadeout(@playground, 0.6)), (14, fadeout(@playground, 0.9)));
		}
		[class=military][zoom>=13] {
				polygon-fill: linear([view::zoom], (13, fadeout(@military, 0.6)), (14, fadeout(@military, 0.9)));
				// line-color: rgb(207, 211, 195)
		}
		[class=hospital],
		[class=doctors]{
			[zoom>=14] {
				polygon-fill: linear([view::zoom], (13, fadeout(@hospital, 0.6)), (14, fadeout(@hospital, 0.9)));
			}
		}

		/* 7.3 University & Sport */
		[class=college],
		[class=university],
		[class=school]{
			[zoom>=12] {
					polygon-fill:linear([view::zoom], (12, fadeout(@university, 0.6)), (14, fadeout(@university, 1)));
				line-color: @university
				line-width: linear([view::zoom], (12, 0), (16, 1));
			}
		}
		/* 7.1 Industrial */
		[class=industrial],
		[class=commercial],
		[class=construction],
		[class=landfill],
		[class=railway],
		[class=quarry]{
			[zoom>=13] {
				polygon-fill: fadeout(@industrial, 0.8);
			}
		}
	}
}

#landcover {
	::frontlayer {
		[class=rock],
		[class=bare_rock],
		[class=cliff]{
			polygon-fill: fadeout(@rock, 0.8);
		}

		[class=beach][zoom>=10] {
			polygon-fill: @beach;
		}
		[class=sand] {
			polygon-fill: fadeout(@beach, 0.3);
		}
		[class=ice],
		[subclass='glacier'] {
			polygon-fill: @glacier;
			// line-width:0.5;
			// line-color: darken(@glacier, 0.1);
		}
		[class=wetland][zoom>=11] {
				polygon-fill: @wetland;
				// [zoom>=12] {
				// 	polygon-pattern-file: url('symbols/wetland.png');
				// }
		}


		[class=heath],
		[class=grass][subclass!=park] ,
		[class=grassland],
		[subclass='recreation_ground'],
		[class='meadow'],
		[class='orchard'],
		[class='vineyard'],
		[class='farland'],
		[subclass='field'],
		[subclass=village_green]{
				// polygon-fill: linear([view::zoom], (12, @green1), (14, @green1));
				polygon-fill: @green1;
				// line-color: @park_outline;
				// line-width:0.5;
			
		}

		
		[class=tree],
		[subclass=park] {
			polygon-fill: linear([view::zoom], (10, @green1), (15, @green5));
		}
		
		[subclass=forest],
		[class=wood] {
			polygon-fill: linear([view::zoom], (10, @green1), (16, @forest));
		}
		
		
		[subclass='recreation_ground'][zoom>=9]{
			polygon-fill: linear([view::zoom], (2, rgba(130, 191, 90, 0)), (11, rgba(130, 191, 90, 0.6)), (15, rgba(130, 191, 90, 0.7)));
		}
	}
}

#landuse {
	::frontlayer2 {
		// [class=residential]{
	// 	polygon-fill: fadeout(@residential, 0.5);
	// 	line-width: 0.5;
	// 	line-color: darken(@residential, 0.2);
	// }
		[class=playground]{
				polygon-fill: fadeout(@playground, 0.5);
				// line-color: rgb(207, 211, 195)
		}

		// [class=military][zoom>=13] {
		// 		polygon-fill: fadeout(@military, 0.7);
		// 		// line-color: rgb(207, 211, 195)
		// }
		
		
		
		/* 7.2 Hostital */
		// [class=hospital],
		// [class=doctors]{
		// 	[zoom>=14] {
		// 		polygon-fill: fadeout(@hospital, 0);
		// 	}
		// }

		
		[class=stadium],
		[class=pitch]{
			polygon-fill: @sport;
			line-color:darken(@sport, 0.1);
			line-width:0.3;
		}


		/* 7.4 Cemetry */
		[class=cemetery],
		[class=grave_yard]{
			polygon-fill: linear([view::zoom], (14, fadeout(@rock, 0.85)), (16, fadeout(@rock, 0.55)));
		}


		
		[class=salt_pond],
		[class=basin],
		[class=reservoir],
		[subclass=swimming_pool],
		[subclass=fountain][zoom>=12]{
			polygon-fill: @river;
		}
	}
	
}
#transportation ['mapnik::geometry_type'=3]{
	/* 7.5 Pedestrian areas */
	[subclass=pedestrian],
	[subclass=footway],
	[subclass=living_street],
	[subclass=platform] {
		polygon-fill:linear([view::zoom], (14, fadeout(@pedestrian_area, 0.7)), (16, fadeout(@pedestrian_area_light, 0.7)));
	}

	
}

#aeroway {
	/* 7.6 Airports */
	// line-color: @aeroways;
	// line-width: 0.5;
	[class=airport],
	[class=aerodrome] {
		['mapnik::geometry_type'=3][zoom>=10][zoom<=19] {
			polygon-fill:linear([view::zoom], (10, @aerodrome0), (11, @aerodrome1), (12, @aerodrome2), (13, @aerodrome3), (14, @aerodrome4), (15, @aerodrome5));
		}
	}
}

#park[zoom>=6]{
	polygon-fill:fadeout(@park, 0.8);
	line-color: @park;
	line-width: 0.5;
}

#building [zoom>=14]['nuti::buildings'>0]{
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

// 	[class=runway]{
// 		line-width: linear([view::zoom], (10, 0), (11, 0.5), (12, 1), (13, 2), (14, 4), (15, 6), (16, 8));
// 	}

// 	[class=taxiway]{
// 		line-width: linear([view::zoom], (12, 0), (13, 0.5), (14, 1), (15, 2), (16, 4));
// 	}
// }
