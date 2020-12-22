

#boundary{
	/* 3.1 Country */
	[admin_level=2] {
		line-color: @border_country;
		line-opacity: linear([view::zoom], (2, 0.7), (3, 0.8), (10, 0.8), (14, 0.4));
		line-width: linear([view::zoom], (3, 0.5), (4, 0.6), (5, 0.8), (6, 0.85), (7, 1), (8, 1.1), (9, 1.4));
	}
	/* 3.2 Region */
	[admin_level=3][zoom>=4][zoom<7]{
		line-color: @border_region;
		line-width: 0.8;
		line-dasharray: 0.9,0.36;

	}
	[admin_level=4][zoom>=5][zoom<=14]{
		line-color: @border_region;
		line-width: linear([view::zoom], (5, 0.7), (6, 0.8), (7, 0.9), (8, 0.9), (9, 1), (10, 1.2));
		line-opacity: linear([view::zoom], (5, 0.8), (6, 0.9));
		line-dasharray: 1.35,0.9;

	}
}

 #park['mapnik::geometry_type'=1]{
	
	  [zoom >= 8][zoom < 14][way_pixels > 3000] {
		text-name: [name];
		text-size: @landcover-font-size;
		text-wrap-width: @landcover-wrap-width-size;
		text-line-spacing: @landcover-line-spacing-size;
		text-vertical-alignment: middle;
		// [way_pixels > 12000] {
		//   text-size: @landcover-font-size-big;
		//   text-wrap-width: @landcover-wrap-width-size-big;
		//   text-line-spacing: @landcover-line-spacing-size-big;
		// }
		// [way_pixels > 48000] {
		//   text-size: @landcover-font-size-bigger;
		//   text-wrap-width: @landcover-wrap-width-size-bigger;
		//   text-line-spacing: @landcover-line-spacing-size-bigger;
		// }
		text-face-name: @mont;
		text-halo-radius: @standard-halo-radius;
		text-halo-fill: @standard-halo-fill;
		text-halo-opacity:0.5;
		[class = 'aboriginal_lands'] {
		  text-fill: @aboriginal;
		}
		  text-fill: @protected-area;
	  }
		// [class=national_park][zoom>=6],
		// [zoom>=8]
		// // [class=aboriginal_lands][zoom>=12],
		// // [class=protected_area][zoom>=12]
		// {
		// 	text-name: [name];
		// 	text-face-name: @mont_md;
	    //     text-fill: @national_park;
	    //     [class='aboriginal_lands']{
	    //         text-fill: @aboriginal;
	    //     }
		// 	text-halo-fill: @peak_halo;
		// 	text-halo-rasterizer: fast; 
		// 	text-halo-radius: 1
	    //     // text-largest-bbox-only: false;
	    //     text-wrap-width: 150;
	    //     text-wrap-before: true;
		// 	text-size: linear([view::zoom], (12, 9), (15, 12.0));
	    //     // text-placement: line;
	    //     text-min-distance: 150;
		// }
		}
#park['mapnik::geometry_type'=3]{
	[zoom >= 14][way_pixels > 10000] {
		text-name: [name];
		text-face-name: @mont;
		text-fill: @protected-area;
		[boundary='aboriginal_lands'] {
		  text-fill: @aboriginal;
		}
		// text-allow-overlap: true;
		text-halo-radius: @standard-halo-radius;
		text-halo-opacity:0.5;
		text-halo-fill: @standard-halo-fill;
		// text-largest-bbox-only: false;
		text-placement: line;
		// text-spacing: 100;
		// text-avoid-edges: false;
		// text-repeat-distance: 250;
		// text-margin: 10;
		// text-clip: true;
		// text-vertical-alignment: middle;
		text-dy: -3;
	  }
	  
		[way_pixels > 750] {
		  [zoom >= 8][zoom < 10] {
			opacity: 0.25;
			line-width: 1.2;
			line-width:linear([view::zoom], (8, 1.2),(9, 1.5));
				line-color: @protected-area;
			[class='aboriginal_lands'] {
			  line-color: @aboriginal;
			}
			// [zoom >= 9] {
			//   line-width: 1.5;
			// }
		  }
		  [zoom >= 10] {
			// inner line
			// ::wideline {
				wideline/line-opacity: 0.75;
				wideline/line-width:linear([view::zoom], (10, 3.6),(12, 4),(14, 6));
				// wideline/line-width: 3.6;
			  // Unlike planet_osm_line, planet_osm_polygon does not preserves the
			  // original direction of the OSM way: Following OGS at
			  // https://www.opengeospatial.org/standards/sfa always at the left
			  // is the interior and at the right the exterior of the polygon.(This
			  // also applies to inner rings of multipolygons.) So a negative
			  // line-offset is always an offset to the inner side of the polygon.
			//   line-offset: -0.9;
			wideline/line-color: @protected-area;
			  [class='aboriginal_lands'] {
				wideline/line-color: @aboriginal;
			  }
			//   line-join: round;
			//   line-cap: round;
			// [zoom >=12] {
                // line-width: 4;
                // line-offset: -1;
				// wideline/line-geometry-transform: translate(-1,-1);
            // [zoom >=14] {
                // line-width: 6;
                // line-offset: -2;
				// wideline/line-geometry-transform: scale(1.02,0.98);
			// }
			// }
			// outer line
			// ::narrowline {
				narrowline/line-opacity: 0.85;
				narrowline/line-width: linear([view::zoom], (10,1.8), (12, 2));
				narrowline/line-color: @protected-area;
			  [class='aboriginal_lands'] {
				narrowline/line-color: @aboriginal;
			  }
			//   narrowline/line-join: round;
			//   narrowline/line-cap: round;
			//   [zoom >= 12] {
			// 	narrowline/line-width: 2;
			//   }
			// }
		  }
		}
	  }

// #park['mapnik::geometry_type'=3][zoom<=16]{
// 	[class=national_park][zoom>=6],
// 	[zoom>=8] {
    
//             line-color: fadeout(@national_park, 0.45);
//             [class='aboriginal_lands']{
//                 line-color: fadeout(@aboriginal, 0.45);
//             }
//             line-width: 2;

//     }
// }