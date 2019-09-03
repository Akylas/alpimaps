#transportation['mapnik::geometry_type'=2] {
    /* 2.WORLD LAVEL ROAD 4-9 ZOOM */
    // [class=motorway][zoom>=4]{
    // line-width: linear([view::zoom], (4, 0.5),(9, 0.8));
    // line-color: @trunk_light;
    // }
	[brunnel=bridge][zoom>=13] {
		::case_black {
			
			line-color:@bridge_casing;
			line-width: linear([view::zoom], (13, 4.1), (14, 5.2), (15, 5.2), (16, 10.8), (17, 17));
		}
		// ::case_white {
		// 	
		// 	line-color:@bridge_background;
		// 	line-width: linear([view::zoom], (13, 3.1), (14, 4.2), (15, 4.2), (16, 9.8), (17, 16));
		// }
	}
	[class=motorway][zoom>=11], 
	[class=trunk][zoom>=13], 
	[class=primary][zoom>=14], 
	[class=secondary][zoom>=16], 
	[class=tertiary][zoom>=16], 
	[class=minor][zoom>=16], 
	[class=sevice][zoom>=16]{
		[brunnel=tunnel]{
				::case {
				
				line-color:@unclassified_tunnel_casing;
				line-width: linear([view::zoom], (16, 6), (17, 8), (18, 11), (19, 14));
				line-dasharray: 5,5;
				[class=tertiary] {
					line-color:@tertiary_tunnel_casing;
				}
				[class=secondary] {
					line-color:@secondary_tunnel_casing;
				}
				[class=primary] {
					line-width: linear([view::zoom], (14, 3.8), (15, 4.8), (16, 7), (17, 10), (18, 13), (19, 16));
					line-color:@trunk_tunnel_casing;
					line-dasharray: 4,4;
				}
				[class=trunk],
				[class=motorway] {
					line-color:@primary_tunnel_casing;
					line-width: linear([view::zoom], (13, 3.1), (14, 3.8), (15, 4.8), (16, 7), (17, 10), (18, 13), (19, 16));
					line-dasharray:2,2;
				}
			}
			line-color: @unclassified_tunnel;
			[class=tertiary] {
				line-color:@tertiary_tunnel;
			}
			[class=secondary] {
				line-color:@secondary_tunnel;
			}
			[class=trunk],
			[class=motorway] {
				line-color: @trunk_tunnel;
	
			}
		}
	}
	
	
    [class=primary][ramp=1][zoom>=11],
    [class=primary][zoom>=8] {
		line-color:linear([view::zoom], (8, @primary), (11, @primary_medium), (15, @primary_light));
		line-width: linear([view::zoom], (8, 0.9), (9, 0.8), (10, 1.2), (11, 1.5), (12, 1.7), (13, 2.1), (14, 2.2), (15, 3.2), (16, 4.8), (17, 7), (18, 10), (19, 13));
	}

    [class=motorway][zoom>=4],
    [class=motorway][ramp=1][zoom>=7] {
        line-color: linear([view::zoom], (4, @motorway_light), (10,@motorway));
		line-width: linear([view::zoom], (4, 0.2), (7, 0.9), (8, 1.1), (9, 1.2), (10, 1.5), (11, 1.7), (12, 1.9), (13, 2.1), (14, 2.8), (15, 3.8), (16, 6), (17, 9), (18, 12), (19, 15));
		[ramp=1] {
			line-width: linear([view::zoom], (13, 1.4), (14, 1.8), (15, 2.4), (16, 3), (17, 4.5), (18, 6), (19, 7.5));
		}
	}
	[class=trunk][zoom>=7],
	[class=trunk][ramp=1][zoom>=13] {
        line-color: linear([view::zoom], (4, @trunk_light), (10,@trunk));
		line-width: linear([view::zoom], (4, 0.2), (7, 0.9), (8, 1.1), (9, 1.2), (10, 1.5), (11, 1.7), (12, 1.9), (13, 2.1), (14, 2.8), (15, 3.8), (16, 6), (17, 9), (18, 12), (19, 15));
		[ramp=1] {
			line-width: linear([view::zoom], (13, 1.4), (14, 1.8), (15, 2.4), (16, 3), (17, 4.5), (18, 6), (19, 7.5));
		}
	}
	
		
	[class=path][subclass!=steps][subclass!=footway][subclass!=pedestrian][subclass!=platform][subclass!=cycleway][zoom>=13] {
		line-width: linear([view::zoom], (13, 0.5),  (14, 0.5), (15, 1.1), (16, 1.8), (17, 2), (18, 3), (19, 4));
		line-color:@path;
		[surface=unpaved] {
		//line-dasharray: linear([view::zoom], (14, (2.52,1.35)), (15, (2.7,1.26)), (16, (3.6,1.8)), (17, (4.5,1.8)), (18, (7.2,2.7)), (19, (9,3.6)));
			line-dasharray:2.52,1.35;
		}
	}
    [class=service][zoom>=15] {
		line-color: @service;
		line-width: linear([view::zoom], (12, 1), (13, 1), (14, 1.4), (15, 1.6), (16, 2), (17, 3), (18, 4.5), (19, 6));
	}
    [class=minor][zoom>=12]{
		line-color: @minor;
		line-width: linear([view::zoom], (12, 1.2), (13, 1), (14, 1.8), (15, 2.2), (16, 4), (17, 6), (18, 9), (19, 12));
    }
    [class=tertiary][zoom>=11] {
		line-color:@tertiary;
		line-width: linear([view::zoom],  (11, 0.8), (12, 1.2), (13, 1.2), (14, 1.8), (15, 2.2), (16, 4.4), (17, 6), (18, 9), (19, 12));
	}
    [class=secondary][zoom>=10] {
		line-color:@secondary;
		line-width: linear([view::zoom],  (10, 1), (11, 1.3), (12, 1.6), (13, 2), (14, 2.1), (15, 3), (16, 4.8), (17, 7), (18, 10), (19, 13));
    }
	
	

	
	
	[class=path] {
		[brunnel='ford'],
		[subclass=pedestrian][zoom>=13] {
			line-color:@pedestrian;
			//line-dasharray: linear([view::zoom], (13, (2,1)), (14, (3.6,1.6)), (15, (5,2.2)), (16, (5.4,2.7)), (17, (5,2)), (18, (7,3)), (19, (16.2,8.1)));
			[zoom>=16] {
				line-dasharray:2,1;
			}
			line-width: linear([view::zoom], (12, 1.2), (13, 1), (14, 1.8), (15, 2.2), (16, 3), (17, 5), (18, 6), (19, 9));

			// line-width: linear([view::zoom], (13, 1), (14, 1.6), (15, 2), (16, 2.4), (17, 3), (18, 4), (19, 5));
		}
		[subclass=platform][zoom>=17] {
			line-color:@unclassified_tunnel_casing;
			line-opacity:0.3;
			line-width: linear([view::zoom], (14, 3), (21, 12));
		}
		[subclass=construction][zoom>=13], 
		[subclass=proposed][zoom>=13] {
			line-color:@construction;
		}
		[subclass=steps][zoom>=14] {
			line-color:@footway;
			[zoom>=16] {
				line-dasharray:1.5,1.5;
			}
			// line-dasharray: step([view::zoom], (16, 1.5,1.5), (17, (2.3,2.3)), (18, (3.2,3.2)), (19, (4,4)));
			
			line-width: linear([view::zoom], (14, 2), (16, 2), (17, 2), (18, 4));
		}
		[subclass=footway][zoom>=14] {
			line-color:@footway;
			//line-dasharray: linear([view::zoom], (14, (2.7,1.26)), (15, (2.7,1.26)), (16, (3.6,1.8)), (17, (4.5,1.8)), (18, (7.2,2.7)), (19, (9,3.6)));
			[zoom>=16] {
				line-dasharray:2.7,1.26;
			}
			line-width: linear([view::zoom],(14, 1), (15, 1.7), (16, 2), (17, 2.4), (18, 3.4), (19, 4));
		}
		[subclass=cycleway][zoom>=13] {
			line-color:@cycleway;
			line-width: linear([view::zoom], (13, 1),  (14, 1.2), (15, 1.4), (16, 1.6), (17, 1.8), (18, 2), (19, 2.2));
		}
		[subclass=bridleway][zoom>=14] {
			line-width: linear([view::zoom], (14, 0.9), (15, 1.4), (16, 1.8), (17, 2), (18, 3), (19, 4));
			line-color:@bridleway;
			[surface=unpaved] {
			//line-dasharray: linear([view::zoom], (14, (2.7,1.26)), (15, (2.7,1.26)), (16, (3.6,1.8)), (17, (4.5,1.8)), (18, (7.2,2.7)), (19, (9,3.6)));
				line-dasharray:2.7,1.26;
			}
		}
	}
	
	[class=track][zoom>=13],
	[class=raceway][zoom>=13] {
		line-width: linear([view::zoom], (13, 0.8),  (14, 1), (15, 1.5), (16, 2.4), (17, 3), (18, 4), (19, 5));

		line-color:@track;
		[surface=unpaved] {
		//line-dasharray: linear([view::zoom], (14, (2.52,1.35)), (15, (2.7,1.26)), (16, (3.6,1.8)), (17, (4.5,1.8)), (18, (7.2,2.7)), (19, (9,3.6)));
		line-dasharray:2.52,1.35;

		}
	}
	[class=rail] {
		[subclass=rail][zoom>=4],
		[subclass=light_rail][zoom>=13],
		[subclass=funicular][zoom>=12],
		[subclass=monorail][zoom>=14],
		[subclass=tram][zoom>=13],
		[subclass=preserved][zoom>=16] {
			line-color:linear([view::zoom], (11, @railway_light), (14, @railway));
			line-width:linear([view::zoom], (11, 0.6), (13, 0.8), (14, 1), (15, 1.2), (16, 2.6), (17, 3));
			[subclass=tram]
			{
				line-color:@tram;
				line-width:linear([view::zoom], (13, 0.6), (15, 0.7), (16, 0.8), (17, 1));
				line-opacity:linear([view::zoom], (13, 0.6), (15, 0.7), (16, 0.9));
			}
			[subclass=funicular]
			{
				line-color:@tram;
				line-width:linear([view::zoom], (12, 1.4), (13, 2), (15, 3));
			}
	
			[subclass=rail],
			[subclass=light_rail] {
				::dash[zoom>=16] {
					line-color:@railway_dash;
					line-width:linear([view::zoom], (16, 1.3), (17, 2));
					//line-dasharray: linear([view::zoom], (16, (4.5,4.5)), (17, (6.3,6.3)), (18, (8.1,8.1)));
					line-dasharray:4.5,4.5;
				}
			}
	
			[subclass=preserved]{
				line-width:1;
				line-dasharray: 1.8,5.4;
			}
			
			[subclass=monorail]{
				line-width:linear([view::zoom], (14, 1), (16, 1.2), (17, 2));
				line-color:@railway_light;
			}
	
			::case {
				[brunnel=tunnel][zoom>=14] {
				// casing 1
					
					line-color: @railway_tunnel;
					line-width:linear([view::zoom], (14, 3), (15, 4.2), (16, 5.6), (17, 6));
					line-dasharray: 5,5;
				}
			}
		}
	}
	
	[class=cable_car]{
		::cable_car {
			line-width: linear([view::zoom], (12, 0), (18, 2));
			line-color: @cable_car;
		}
	}
	[class=transit][zoom>=15]{
			line-width: linear([view::zoom], (15, 0), (16, 1));
			line-color: rgba(68, 68, 68, 0.5);
	}

	::direction {
		[zoom>=16][oneway!=0] {
			text-avoid-edges: false;
			text-name: 'a';
			text-placement: line;
			text-wrap-before: true;
			text-face-name: @mont;
			text-min-distance: 5;
			text-vertical-alignment: middle;
		}
	}
	
}
#aeroway['mapnik::geometry_type'=2] {
	[class=runway][zoom>=12] {
		line-width: linear([view::zoom], (12, 1),  (13, 1.5), (14, 2.4), (16, 4));
		line-color:@unclassified;
		line-opacity: linear([view::zoom], (12, 0.5),  (13, 0.8));
	}
	[class=taxiway][zoom>=14] {
		line-width: linear([view::zoom], (14, 0.6), (15, 1.2));
		line-color:@unclassified;
		line-opacity: 0.6;
	}
}