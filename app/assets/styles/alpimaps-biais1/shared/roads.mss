#transportation{
	
	[class=bridge]['mapnik::geometry_type'=3] {
		::fill{
			polygon-fill: rgba(255,255,255,0.4) ;
			line-color: #B0B0A8;
			line-width:0.5;
		}
	}
	[class=motorway]['mapnik::geometry_type'=2][zoom>=4]{
		::case[zoom>=12]{ 
			line-cap: [zoom]<=9 ? butt : round;
			line-join: round;
			line-color: @motorway_case;
			line-width: linear([view::zoom], (12, 0.0),(13, 2.0), (21, 11));
			[brunnel='tunnel'] { line-dasharray: 6, 3; }
		}
		line-color: @motorway;
		line-cap: [zoom]<=9 ? butt : round;
		line-join: round;
		line-opacity: 1;
		line-width: linear([view::zoom], (4.5, 0.0), (21, 8));
	}
 
	[class=trunk]['mapnik::geometry_type'=2][zoom>=4],
	[class=primary]['mapnik::geometry_type'=2][zoom>=4]{
		::case[zoom>=12]{ 
			line-cap: [zoom]<=10 ? butt : round;
			line-join: round;
			line-color: @main_case;
			line-width: linear([view::zoom], (12, 0.0), (13, 2.0),  (21, 12));

			[brunnel='tunnel'] { line-dasharray: 6, 3; }
			[class=primary] {
			}
		}

		line-cap: [zoom]<=10 ? butt : round;
		line-join: [zoom]<=10 ? miter : round;
		line-color: @main;
		line-width: linear([view::zoom], (4.5, 0.0),  (21, 8));
		line-opacity: linear([view::zoom], (6, 0.0), (7, 1.0));
	}

	[class=secondary]['mapnik::geometry_type'=2][zoom>=10],
	[class=tertiary]['mapnik::geometry_type'=2][zoom>=11]{
		::case[zoom>=13]{ 
			line-cap: [zoom]<=13 ? butt : round;
			line-join: [zoom]<=13 ? miter : round;
			line-color: linear([view::zoom], (11, @secondary_case_lowzoom), (12, @secondary_case));
			line-width: linear([view::zoom], (10, 0.0), (11, 2), (21, 9));

			[brunnel='tunnel'] { line-dasharray: 6, 3; }
		}
		line-cap: [zoom]<=13 ? butt : round;
		line-join: round;
		line-color: @secondary;
		line-width: linear([view::zoom], (4.5, 0.0), (8, 0.1), (9, 0.3), (10, 0.7), (21, 8));
	}

	[class=minor]['mapnik::geometry_type'=2][zoom>=11]{
		::case[zoom>=15]{
			line-cap: round;
			line-join: round;
			line-color: @minor_case;
			line-width: linear([view::zoom], (15, 0.0), (16, 2.0), (21, 13));

			[brunnel='tunnel'] { line-dasharray: 6, 3; }
		}
		line-cap: [zoom]<=15 ? butt : round;
		line-join: [zoom]<=15 ? miter : round;
		line-color: @minor;
		line-width: linear([view::zoom], (11, 0.0), (12, 0.1), (13, 0.3), (14, 1), (21, 12));
	}
	[class=path][subclass=pedestrian]['mapnik::geometry_type'=2][zoom>=11]{
		::case[zoom>=15]{
			line-cap: round;
			line-join: round;
			line-color: @pedestrian_dark;
			line-width: linear([view::zoom], (15, 0.0), (16, 2.0), (21, 13));

			[brunnel='tunnel'] { line-dasharray: 6, 3; }
		}
		line-cap: [zoom]<=15 ? butt : round;
		line-join: [zoom]<=15 ? miter : round;
		line-color: @pedestrian;
		line-width: linear([view::zoom], (11, 0.0), (12, 0.1), (13, 0.3), (14, 1), (21, 12));
	}
	[class=path][subclass=platform]['mapnik::geometry_type'=2][zoom>=13]{
		// ::case[zoom>=15]{
		// 	line-cap: round;
		// 	line-join: round;
		// 	line-color: @minor_case;
		// 	line-width: linear([view::zoom], (4.5, 0.0), (11, 0.6), (12, 0.8), (13, 1.2), (21, 13));

		// 	[brunnel='tunnel'] { line-dasharray: 6, 3; }
		// }
		line-cap: [zoom]<=15 ? butt : round;
		line-join: [zoom]<=15 ? miter : round;
		line-color: #BBBBBB;
		line-width: linear([view::zoom], (11, 0.0), (12, 0.1), (13, 0.3), (14, 1), (21, 12));
	}
	
	[class=motorway][ramp=1]['mapnik::geometry_type'=2][zoom>=11],
	[class=trunk][ramp=1]['mapnik::geometry_type'=2][zoom>=11], 
	[class=primary][ramp=1]['mapnik::geometry_type'=2][zoom>=11],
	[class=secondary][ramp=1]['mapnik::geometry_type'=2][zoom>=11],
	[class=tertiary][ramp=1]['mapnik::geometry_type'=2][zoom>=11]{
		::case{
			line-cap: [zoom]<=12 ? butt : round;
			line-join: round;
			line-color: linear([view::zoom], (13, @motorway_ramp_lowzoom), (14, @motorway_case));
			line-width: linear([view::zoom], (11, 0.0), (12, 2), (21, 9));

			[class=primary]{
				line-color: @main_case;
			}
			
			[class=secondary],
			[class=tertiary]{
				line-color: @secondary_case;
			}
			
			[brunnel='tunnel'] { line-dasharray: 6, 3; }
		}

		::fill{
			line-cap: [zoom]<=12 ? butt : round;
			line-join: [zoom]<=12 ? miter : round;
			line-color: @motorway;
			line-width: linear([view::zoom], (4.5, 0.0), (6, 0.1), (7, 0.3), (8, 0.7), (21, 8));
			[class=primary] { line-color: @main; }
			[class=secondary],[class=tertiary] { line-color: @minor_ramp_highzoom; }
		}
	}
 
	[class=service]['mapnik::geometry_type'=2][zoom>=12]{
		::case[zoom>=15]{ 
			line-cap: [zoom]<=15 ? butt : round;
			line-join: round;
			line-color: @minor_case;
			line-width: linear([view::zoom], (15, 0.0), (16, 2), (21, 9));

			[brunnel='tunnel'] { line-dasharray: 6, 3; }
		}
		line-color: @minor;
		line-cap: [zoom]<=15 ? butt : round;
		line-join: [zoom]<=15 ? miter : round;
		line-width: linear([view::zoom], (12, 0.0), (13, 0.1), (14, 0.3), (15, 1), (21, 8));
	}

	[class=track]['mapnik::geometry_type'=2][zoom>=13],
	[class=path][subclass=path]['mapnik::geometry_type'=2][zoom>=12],
	[class=path][subclass=footway]['mapnik::geometry_type'=2][zoom>=14]{
		[brunnel=bridge] {
			::case{
				line-cap: butt;
				line-join: miter;
				line-width: linear([view::zoom], (12, 0.0), (13, 2), (15, 4.0), (17, 6.0), (18, 12.0));
				line-color: @bridge;
			}
		}[brunnel=tunnel] {
			::case{
				line-cap: butt;
				line-join: miter;
				line-width: linear([view::zoom], (12, 0.0), (13, 2), (15, 4.0), (17, 6.0), (18, 12.0));
				line-color: @tunnel;
			}
		}
		::line{
			line-cap: butt;
			line-join: miter;
			line-color: @path ;
			line-width: linear([view::zoom], (12, 0.2), (15, 0.8), (21, 5));
			[class=path] { line-dasharray: 5, 3; }
			[subclass='footway'] { line-color:@footway; }
			[subclass='steps'] { line-color:@footway; line-dasharray: 3, 3;line-width:linear([view::zoom], (12,1), (21, 8));}

			
		}
	}
	
	[class=rail]{
		::case[zoom>=15]{
			line-cap: [zoom]<=17 ? butt : round;
			line-join: [zoom]<=17 ? miter : round;
			line-width: linear([view::zoom], (15, 1), (16, 2), (18, 6.0));
			line-color: @rail_light;
			[brunnel=tunnel] {
				line-color: linear([view::zoom], (12, @rail_tunnel_dark), (15, @rail_tunnel_light));
		 	}
		}
		::dash {
			line-cap: butt;
			line-join: miter;
			line-width: linear([view::zoom], (12, 1), (18, 4.0));
			line-color: linear([view::zoom], (12, @rail_dark), (15, @rail_light), (16, @rail_dash));
			line-dasharray: 6,6;
			[zoom<=13] {
				line-dasharray: 7,3;

			}
			
		}
	}
	
	// [class=motorway],
	// [class=trunk],
	// [class=primary],
	// [class=secondary],
	// [class=tertiary],
	// [class=minor],
	// [class=service]{
	// 	[oneway="1"][zoom>=15] {
	// 		shield-name: 'a';
	// 		shield-size: 9;
	// 		shield-line-spacing: -4;
	// 		shield-file: url(shield/default-[ref_length].svg);
	// 		shield-face-name: @mont;
	// 		shield-fill: rgb(85, 85, 85);
	// 	}
	// }
	[class=cable_car]{
		::fill {
			line-width: linear([view::zoom], (12, 0.0), (18, 2.0));
			line-color: #444;
		}
	}
	[class=transit]{
			line-width: 1;
			line-color: rgba(68, 68, 68, 0.5);
	}
	['mapnik::geometry_type'=3][class!=bridge][class!=pier]{
			polygon-fill: @bridge;
	}

}


