
@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
@osm_icon: [nuti::osm-[subclass]] ? [nuti::osm-[subclass]] : [nuti::osm-[class]];
@featureId: [osmid];

#mountain_peak {
	// order is important for icon to take precedence over label and respect rank
	::icon {
		text-face-name: @osm;
		text-size: linear([view::zoom], (7, 7), (13, 8), (18, 12))+ 0.000001 * [ele]; 
		text-placement: [nuti::markers3d];
		text-name: @osm_icon;
		text-fill: @peak_label;
		[class="saddle"] {
			text-fill: @sadle_label;
		}
		text-feature-id: @featureId;
	}
	text-name: @name;
	[zoom>=10] {
		text-name: @name ?  ( [ele] ? [ele] + 'm' + '\n ' + @name : @name): '';
	}
	text-face-name: @mont_md;
	text-size: linear([view::zoom], (7, 6), (13, 8), (18, 11))+ 0.000001 * [ele]; 
	text-line-spacing: -1;
	text-placement: [nuti::texts3d];
	text-fill: @peak_label;
	[class="saddle"] {
		text-fill: @sadle_label;
	}
	text-dy: linear([view::zoom], (7, 6), (13, 8), (18, 11)); 
	text-wrap-width: step([view::zoom], (7, 40), (13, 100), (18, 150));
	text-feature-id: @featureId;
	text-halo-fill: @peak_halo;
	text-halo-rasterizer: fast;
	text-halo-radius: 1;
	
}

#landcover[name!=null],
#landuse[name!=null] {
  [class=industrial][zoom>=15],
  [class=military][zoom>=15],
  [zoom>=16] {
    text-name: @name;
    text-face-name: @mont;
	text-min-distance:50;
    text-fill: @building_label;
    text-size: 10;
    text-wrap-width: 30;
	text-halo-fill: @peak_halo;
	text-halo-rasterizer: fast;
	text-halo-radius: 1;
  }  
}

#water_name[class=ocean][zoom>=3][zoom<=9],
#water_name[class=sea][zoom>=6] {
	text-name: @name;
	text-face-name: @mont_it_md;
	text-wrap-width: 50;
	text-wrap-before: true;
	text-fill: @marine_labels;
	text-halo-fill: @marine_labels_halo;
	text-halo-radius: 1;
	text-line-spacing: -2;
	text-character-spacing: 1.1;
	text-size: linear([view::zoom], (2, 14.0), (5, 20.0));
	
	[class=sea]{
		text-size: 12;
	}
}

#place{
	[class=continent][zoom>=1][zoom<=2]{
		text-name: @name;
		text-fill: @continent_text;
		text-face-name: @mont_md;
		text-transform: uppercase;
		text-halo-fill: @continent_halo;
		text-halo-radius: 1;
		text-character-spacing: 0.5;
		text-size: linear([view::zoom], (1, 10.0), (2, 14.0));
		text-wrap-width: step([view::zoom], (1, 20), (2, 40));
	}
	[class=country]{
		[rank=1][zoom>=3][zoom<=6], 
		[rank=2][zoom>=3][zoom<=7],
		[rank=3][zoom>=4][zoom<=8], 
		[rank=4][zoom>=5][zoom<=9], 
		[rank=5][zoom>=6][zoom<=10], 
		[rank>=6][zoom>=7][zoom<=10]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-size: 0;
			text-halo-fill: @country_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-width: 30;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-min-distance: 2;
			text-transform: uppercase;
			text-character-spacing: 0.5;
			text-fill: linear([view::zoom], (4, @country_text_dark), (5, @country_text_med), (6, @country_text_light));

	
			[rank=1][zoom>=2]{
				text-size: linear([view::zoom], (2, 10.0), (5, 13.0), (6, 15.0)) - 0.000001 * [rank];
				text-wrap-width: step([view::zoom], (2, 60), (3, 80), (4, 100), (5, 120), (6, 140));
			}
			[rank=2][zoom>=3]{
				text-size: linear([view::zoom], (3, 10.0), (6, 13.0)) - 0.000001 * [rank];
				text-wrap-width: step([view::zoom], (3, 60), (4, 70), (5, 80), (6, 100));
			}
			[rank=3][zoom>=4]{
				text-size: linear([view::zoom], (4, 10.0), (8, 14.0)) - 0.000001 * [rank];
				text-wrap-width: step([view::zoom], (4, 30), (5, 60), (8, 120));
			}
			[rank=4][zoom>=5]{
				text-size: linear([view::zoom], (5, 10.0), (9, 14.0)) - 0.000001 * [rank];
				text-wrap-width: step([view::zoom], (5, 30), (6, 60), (7, 90), (8, 120));
			}
			[rank=5][zoom>=5]{
				text-size: linear([view::zoom], (5, 10.0), (9, 14.0)) - 0.000001 * [rank];
				text-wrap-width: step([view::zoom], (6, 30), (7, 60), (8, 90), (9, 120));
			}
			[rank>=6][zoom>=6]{
				text-size: linear([view::zoom], (6, 10.0), (9, 13.0)) - 0.000001 * [rank];
				text-wrap-width: 30;
			}
		}
	}
	[class=state][zoom>=6][zoom<=10]{
		[zoom>=5][rank<=2],
		[zoom>=6][rank<=4],
		[zoom>=7][rank<=99]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @state_text;
			text-halo-fill: @state_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-transform: uppercase;
			// text-allow-overlap: false;
			text-wrap-before: true;
			text-min-distance:5;
			text-size: linear([view::zoom], (5, 11.0), (6, 12.0), (7, 13.0));
			text-wrap-width: step([view::zoom], (5, 60), (6, 80), (7, 100));
		}
	}
	
	[class=city]{
		[zoom>=4][zoom<=7]{
			// [zoom>=4][rank<=2],
			// [zoom>=5][rank<=4],
			// [zoom>=6][rank<=6],
			// [zoom>=7][rank<=7]
			// {
				::icon {
					text-placement: [nuti::markers3d];
					text-name: [nuti::osm-spring];
					text-size: 6;
					text-face-name: @osm;
					text-fill: @place_text;
				}
				::label {
					text-name: @name;
					text-size: 10;
					text-face-name: @mont_md;
					text-placement: [nuti::texts3d];
					text-fill: @place_text;
					text-halo-fill: @place_halo;
					text-halo-radius: 1;
					text-halo-rasterizer: fast;
					text-line-spacing: -2;
					text-dx: -5;
					text-dy: 0;
					text-min-distance: 3;
					text-size: linear([view::zoom], (4, 10.0), (5, 11.0), (6, 12.0), (7, 13.0)) - ([rank] / 3.0);
					text-wrap-width: step([view::zoom], (4, 40), (5, 50), (6, 60));
					[zoom>=5][rank>=0][rank<=2],
					[zoom>=7][rank>=3][rank<=5] { 
						text-transform:uppercase;
					}
				}
			}
			[zoom>=8]
			// [zoom<=14][rank<=11],
			// [zoom>=9][zoom<=14][rank<=12],
			// [zoom>=10][zoom<=14][rank<=15]
			{
				text-name: @name;
				text-face-name: @mont_md;
				text-placement: [nuti::texts3d];
				text-fill: @place_text;
				text-halo-fill: @place_halo;
				text-halo-radius: 1;
				text-halo-rasterizer: fast;
				text-line-spacing: -2;
				text-size: linear([view::zoom], (8, 13.0), (14, 21.0)) - ([rank] / 2.0) - 0.000001 * [rank];
				text-wrap-width: step([view::zoom], (8, 50), (9, 60), (11, 70), (12, 80), (13, 120), (14, 200));

				[zoom=8][rank<=7],
				[zoom=9][rank<=10],
				[zoom>=10] {
					text-transform: uppercase;
				}
			}
		// }

		// [zoom>=8][zoom<=14][rank<=11],
		// [zoom>=9][zoom<=14][rank<=12],
		// [zoom>=10][zoom<=14][rank<=15]{
		// 	text-name: @name;
		// 	text-face-name: @mont_md;
		// 	text-placement: [nuti::texts3d];
		// 	text-fill: @place_text;
		// 	text-halo-fill: @place_halo;
		// 	text-halo-radius: 1;
		// 	text-halo-rasterizer: fast;
		// 	text-line-spacing: -2;
		// 	text-size: linear([view::zoom], (8, 13.0), (14, 21.0)) - ([rank] / 2.0) - 0.000001 * [rank];
		// 	text-wrap-width: step([view::zoom], (8, 50), (9, 60), (11, 70), (12, 80), (13, 120), (14, 200));

		// 	[zoom=8][rank<=7],
		// 	[zoom=9][rank<=10],
		// 	[zoom>=10] {
		// 		text-transform: uppercase;
		// 	}
		// }
	}
	[class=town] {
		// [zoom>=8][zoom<=14][rank<=15],
		// [zoom=15]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (9, 9.0), (13, 13.0), (14, 15.0), (15, 17.0)) - 0.000001 * [rank];
			text-wrap-width: step([view::zoom], (9, 70), (15, 80));
		// }
	}
	[class=village][zoom>=8] {
		[zoom<=9][rank<=14],
		[zoom>=10][rank<=13],
		// // [zoom>=11][rank<=13],
		// // [zoom>=11.5][rank<=20],
		[zoom>=11]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			// text-line-spacing: -2;
			text-wrap-before: true;
			text-size: linear([view::zoom], (8, 7.0), (11, 9.0), (12, 10.0), (13, 11.0), (16, 16.0)) - 0.000001 * [rank];
			// text-wrap-width: step([view::zoom], (5, 60), (6, 80), (7, 100));
			// text-wrap-width: step([view::zoom], (7, 10), (13, 90), (14, 120), (15, 140), (16, 160));
			// text-feature-id: @featureId;
		}
	}
	[class=suburb][zoom>=11]{
		// [zoom>=12][zoom<=14][rank<=11],
		// [zoom>=15][zoom<=16]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (12, 9.0), (13, 10.0), (16, 13.0)) - 0.000001 * [rank];
			text-wrap-width: step([view::zoom], (12, 50), (13, 80), (14, 90), (15, 100), (16, 120));
		// }
	}
	[class=hamlet],
	[class=island],
	[class=islet],
	[class=neighbourhood] {
		[zoom>=13][rank<=12],
		[zoom>=14][rank<=17],
		[zoom>=15]
		// [zoom<=16][rank<=12],
		// [zoom>=16][zoom<=17]
		{
			text-name: @name;
			text-face-name: @mont_it_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (14, 9.0), (16, 13.0), (17, 15.0)) - 0.000001 * [rank];
			text-wrap-width: step([view::zoom], (13, 50), (14, 80), (15, 100), (16, 120), (17, 140));
		}
	}
	[class=isolated_dwelling],
	[class=locality] {
		[zoom>=13][rank<=12],
		[zoom>=14][rank<=17],
		[zoom>=15]
		// [zoom<=16][rank<=12],
		// [zoom>=16][zoom<=17]
		{
			text-name: @name;
			text-face-name: @mont;
			text-allow-overlap: true;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (14, 8.0), (17, 14.0)) - 0.000001 * [rank];
			text-wrap-width: step([view::zoom], (13, 40), (17, 130));
		}
	}
}

#water_name [class=lake][zoom>=9][way_pixels>40],
#water_name [class=lake][zoom>=10][way_pixels>40],
#water_name [class=lake][zoom>=11][way_pixels>20],
#water_name [class=lake][zoom>=12][way_pixels>5],
#water_name [class=lake][zoom>=13],
#landcover[class=ice][subclass=glacier][name!=null][zoom>=13]{
	text-name: @name;
	text-face-name: @mont_it_md;
	text-placement: [nuti::texts3d];
	text-fill: @water_label;
	text-wrap-before: true;
	text-halo-fill: @water_halo;
	text-halo-radius: 2;
	text-halo-rasterizer: fast;
	text-min-distance:30;
	text-size: linear([view::zoom], (12, 8.0), (18, 10.0));
	text-wrap-width: 80;
}

#waterway{
	[class=stream][zoom>=13],
	[class=riverbank][zoom>=13],
	[class=river][zoom>=12],
	[class=stream][zoom>=13],
	[class=canal][zoom>=13],
	[class=dam][zoom>=15],
	[class=weir][zoom>=15],
	[class=lock][zoom>=16],
	[class=ditch][zoom>=15],
	[class=drain][zoom>=15]{

	text-name: @name;
	text-face-name: @mont_it_md;
	text-fill: @water_label;
	text-halo-fill: @water_halo;
	text-halo-radius: 2;
	text-halo-rasterizer: fast;
	// text-avoid-edges: true;
	text-placement: line;
	text-dy:1;
	// text-character-spacing: 1;
	text-wrap-width: step([view::zoom], (13, 80), (15, 150), (17, 250));
	text-size: linear([view::zoom], (10, 6.0), (15, 7.0), (16, 9.0), (17, 10.0));
}
}


#transportation[oneway!=0][zoom>=16] {
	// intentionally omitting highway_platform, highway_construction
	[class=motorway],
	[class=trunk],
	[class=primary],
	[class=secondary],
	[class=tertiary],
	[class=residential],
	[class=minor],
	[class=road],
	[class=service],
	// [class=path][subclass=pedestrian],
	[class=raceway] {
		marker-placement: line;
		marker-type:arrow;
		// marker-allow-overlap: true;
		marker-line-width:0;
		marker-opacity:0.6;
		marker-width: 6;
		marker-height: 5;

		[class=motorway] {
			marker-fill: @motorway-oneway-arrow-color;
		}
		[class=trunk] {
			marker-fill: @trunk-oneway-arrow-color;
		}
		[class=primary] {
			marker-fill: @primary-oneway-arrow-color;
		}
		[class=secondary] {
			marker-fill: @secondary-oneway-arrow-color;
		}
		[class=tertiary] {
			marker-fill: @tertiary-oneway-arrow-color;
		}
		[class=residential],
		[class=unclassified],
		[class=minor],
		[class=road],
		[class=service] {
			marker-fill: @residential-oneway-arrow-color;
		}
		[class=living_street] {
			marker-fill: @living-street-oneway-arrow-color;
		}
		[class=raceway] {
			marker-fill: @raceway-oneway-arrow-color;
		}
	}
}
#transportation_name['mapnik::geometry_type'=2]{
	[class=track][zoom>=13],
	[class=path][subclass=path][zoom>=14],
	[class=path][subclass!=track][subclass!=footway][zoom>=15] {
			text-name: @name;
			text-fill: @road_label;
			text-size:linear([view::zoom], (13, 4), (16, 9), (17, 10));
			text-halo-radius: @standard-halo-radius;
			text-halo-fill: @standard-halo-fill;
			// text-spacing: 100;
			// text-clip: false;
			text-placement: line;
			text-avoid-edges: false;
			
			text-face-name: @mont_md;
			// text-vertical-alignment: middle;
			[subclass!=pedestrian] {
				text-dy:linear([view::zoom], (13, 0), (16, 1), (17, 2));
			}
			
		// [zoom>=16] {
			// text-size: 8;
			// text-dy: 7;
		// }
		// [zoom>=17] {
			// text-size: 10;
			// text-dy: 9;
		// }
	}
	// [class=path][zoom>=15] {
	// 	[subclass=bridleway],
	// 	[subclass=footway],
	// 	[subclass=path],
	// 	[subclass=steps] {
	// 		text-name: @name;
	// 		text-fill: #222;
	// 		text-size: 7;
	// 		text-halo-radius: @standard-halo-radius;
	// 		text-halo-fill: @standard-halo-fill;
	// 		// text-spacing: 300;
	// 		// text-clip: false;
	// 		text-placement: line;
	// 		text-face-name: @mont;
	// 		text-vertical-alignment: middle;
	// 		text-avoid-edges: false;
	// 		text-dy: 7;
	// 		// text-min-distance: @major-highway-text-repeat-distance;
	// 		[subclass=steps] { 
	// 			text-min-distance: @minor-highway-text-repeat-distance;
	// 		 }
	// 		[zoom>=17] {
	// 			text-size: 10;
	// 			text-dy: 9;
	// 		}
	// 	}
	// }
	// [class='motorway'][zoom>=7][zoom<=10][ref_length<=6]
	// // [class='motorway'][zoom>=9][zoom<=10][ref_length<=6],
	// // [zoom>=11][ref_length<=6] 
	// {
	// 	text-name: [ref];
	// 	text-size: 9;
	// 	text-min-distance: 50;
	// text-line-spacing: -4;
	// 	// text-file: url(shield/default-[ref_length].svg);
	// 	text-face-name: @mont;
	// 	text-fill: #333;
	// 	[zoom>=14] {
	// 		text-size: 11;
	// 	}
	// }


	// [class='motorway'][zoom>=7][zoom<=10][ref_length<=6],
	// [class='motorway'][zoom>=9][zoom<=10][ref_length<=6] {
	// 	text-min-distance: 50;
	// 	text-size: 8;
	// 	text-placement: point;
	// 	text-avoid-edges: false;
	// }
	// [zoom>=11][ref_length<=6] {
	// 	text-placement: line;
	// 	text-spacing: 400;
	// 	text-min-distance: 100;
	// 	text-avoid-edges: true;
	// }

	[class=motorway][zoom>=9],
	[class=trunk][zoom>=10],
	[class=primary][zoom>=14],
	[class=tertiary][zoom>=15],
	[class=secondary][zoom>=15],
	[class=minor][zoom>=16],
	[class=service][zoom>=17],
	[class=aerialway][zoom>=15]{
		// text-avoid-edges: false;
		text-name: @name;
		text-placement: line;
		text-wrap-before: true;
		text-face-name: @mont;
		text-fill: @road_text;
		text-halo-fill: @minor_halo;
		text-halo-radius: 1;
		text-halo-rasterizer: fast;
		text-min-distance: 5;
		text-size: linear([view::zoom], (13, 7), (18, 10));
		text-vertical-alignment: middle;
		
		[class=motorway],
		[class=trunk],
		[class=primary]{
			text-halo-fill: @primary_halo;
			text-size: linear([view::zoom], (13, 6.0), (18, 13.0)) + 0.00004;
			[class=motorway], [class=trunk] { text-halo-fill: @motorway_halo; }
		}
		
		[class=secondary],
		[class=tertiary]{
			text-size: linear([view::zoom], (13, 4.0), (18, 12.0)) + 0.00003;
		}
		[class=minor]{
			text-size: linear([view::zoom], (13, 2.0), (18, 10.0)) + 0.00002;
		}
		[class=service]{
			text-size: linear([view::zoom], (13, 6.0), (18, 10.0)) + 0.00001;
		}
	}
}

#poi{
	[class!=null] {
		[class=lodging][subclass='alpine_hut'],
		[class=lodging][subclass='wilderness_hut'],
		[class=spring],
		[class=campsite][rank<=15],
		[zoom>=15][rank<=15][subclass!=hotel][class!='bus'][class!='restaurant'][class!='bar'][class!='school'][class!='college'][subclass!='tram_stop'][subclass!='community_centre'][subclass!='station'],
		[zoom>=16][rank<=35][subclass!='hotel'],
		[zoom>=17][rank<=50],
		[zoom>=18] {

			::icon {
						// text-min-distance: 4;
				text-placement: [nuti::markers3d];
				text-name: @osm_icon;
				// text-name: [nuti::osm-peak];
				text-size: linear([view::zoom], (18, 10), (20, 14.0)) - 0.000001 * [rank];
				text-face-name: @osm;
				text-feature-id: @featureId;
				text-halo-fill: @peak_halo;
				// text-min-distance: 4;
				text-halo-rasterizer: fast;
				text-halo-radius: linear([view::zoom], (14, 1), (18, 0.5));
				text-fill: #495063;
				[class='park'] {
					text-fill: #76BC54;
				}
				[class='national_park'],[class='protected_area'] {
					text-fill: @national_park;
				}
				[class='aboriginal_lands'] {
					text-fill: @aboriginal;
				}
				[class=lodging],[class='campsite'] {
					text-size: linear([view::zoom], (18, 10), (20, 14.0)) - 0.0000011 * [rank];
					text-fill: #854d04;
				}
				[class='hospital'] {
					text-fill: #4AA0E7;
				}
				[class='fountain'],[class='drinking_water'],[class='bassin'],[class='spring'] {
					text-placement: point;
					// text-allow-overlap: true;
					text-fill: #4AA0E7;
				}
				[class='spring'] {
					text-size: linear([view::zoom], (14, 6), (16, 10));
					text-halo-radius: 0;
				}
				[class='bakery'], [class='restaurant'] {
					text-fill: #EF8000; 
				}
			}

			[class!='information'][subclass!='viewpoint'][class!='spring'],
			[class=spring][zoom>=17] {
				// ::label {
					text-name: @name;
					text-face-name: @mont_md;
					text-placement: [nuti::texts3d];
					text-line-spacing: -1;
					text-fill: @poi_dark;
					text-halo-fill: @peak_halo;
					text-halo-rasterizer: fast;
					text-halo-radius: 1;
					text-size: linear([view::zoom], (14, 7), (18, 10)) - 0.000001 * [rank];
					text-wrap-width: step([view::zoom], (14, 40), (15, 50), (16, 60), (18, 70), (19, 100));
					text-feature-id: @featureId;
					text-dy: linear([view::zoom], (14, 9), (18, 12));
					// text-dy: 13;

					[class='bus'][zoom<17],
					[class='railway'][zoom<17] {
						text-opacity:0;
						text-halo-opacity:0;
					}
					
					[class='national_park'],[class='protected_area'], [class='aboriginal_lands'] {
						text-fill: @national_park;
						text-wrap-width: step([view::zoom], (13, 80), (15, 180));
						text-size: 10;
						[class='aboriginal_lands'] {
							text-fill: @aboriginal;
						}
					}
				// }
				
			}
		}
		
	}
}

#building['nuti::buildings'>0][name!=null][zoom>=17]{
	text-name: [name];
	text-face-name: @mont;
	text-fill: @housenumber;
	text-halo-rasterizer: fast;
	text-line-spacing: -1;
	text-wrap-width: 60;
	text-wrap-before: true;
	text-avoid-edges: true;
	// text-transform: uppercase;
	text-size: linear([view::zoom], (16, 6.0), (18, 8.0), (20, 10.0));
	text-min-distance: linear([view::zoom], (16, 100.0), (17, 50), (18, 20.0));
}
// biais
#housenumber[zoom>=18]{
	text-name: [housenumber];
	text-face-name: @mont;
	text-fill: @housename;
	text-size: linear([view::zoom], (17, 9), (18, 11));
	// text-dy:14;
		// text-allow-overlap: true;
		text-avoid-edges: true;
	text-min-distance: linear([view::zoom], (17, 100), (18, 50), (19, 20));

}

#aerodrome_label[zoom>=15] {
	text-name: @name;
	text-face-name: @mont;
	text-fill: @building_label;
	text-size: 9;
	text-wrap-width: 100;
}
// #aeroway[zoom>=15][ref!=null] {
// 	text-name: [ref];
// 	text-face-name: @mont;
// 	text-fill: @building_label;
// 	text-size: 9;
// }


// #transportation[name!=null][class=rail] {
// 	/* Mostly started from z17. */
// 	[subclass=rail],
// 	[subclass=subway],
// 	[subclass=narrow_gauge],
// 	[subclass=light_rail],
// 	[subclass=preserved],
// 	[subclass=funicular],
// 	[subclass=monorail],
// 	[subclass=tram] {
// 		[zoom>=17] {
// 			text-name: @name;
// 			text-fill: #666666;
// 			text-size: 10;
// 			text-dy: 6;
// 			text-spacing: 900;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @standard-halo-fill;
// 			text-min-distance: @railway-text-repeat-distance;
// 		}
// 		[zoom>=19] {
// 			text-size: 11;
// 			text-dy: 7;
// 		}
// 	}
// 	[subclass=rail] {
// 	/* Render highspeed rails from z11,
// 		 other main routes at z14. */
// 		[highspeed=yes] {
// 			[zoom>=11] {
// 			text-name: @name;
// 			text-fill: #666666;
// 			text-size: 10;
// 			text-dy: 3;
// 			text-spacing: 300;
// 			text-clip: false;
// 			text-placement: line;
// 			text-face-name: @book-fonts;
// 			text-halo-radius: @standard-halo-radius;
// 			text-halo-fill: @standard-halo-fill;
// 			text-min-distance: @railway-text-repeat-distance;
// 			}
// 			[zoom>=13] {
// 			text-dy: 6;
// 			}
// 			[zoom>=14] {
// 			text-spacing: 600;
// 			}
// 			[zoom>=17] {
// 			text-size: 11;
// 			text-dy: 7;
// 			}
// 			[zoom>=19] {
// 			text-size: 12;
// 			text-dy: 8;
// 			}
// 		}
// 		[highspeed != yes][usage=main] {
// 			[zoom>=14] {
// 				text-name: @name;
// 				text-fill: #666666;
// 				text-size: 10;
// 				text-dy: 6;
// 				text-spacing: 300;
// 				text-clip: false;
// 				text-placement: line;
// 				text-face-name: @book-fonts;
// 				text-halo-radius: @standard-halo-radius;
// 				text-halo-fill: @standard-halo-fill;
// 				text-min-distance: @railway-text-repeat-distance;
// 			}
// 			[zoom>=17] {
// 				text-spacing: 600;
// 				text-size: 11;
// 				text-dy: 7;
// 			}
// 			[zoom>=19] {
// 				text-size: 12;
// 				text-dy: 8;
// 			}
// 		}
// 	}
// 	/* Other minor railway styles. For service rails, see:
// 	 https://github.com/gravitystorm/openstreetmap-carto/pull/2687 */
// 	[subclass=preserved][zoom>=17] ,
// 	[subclass=miniature][zoom>=17] ,
// 	[subclass=disused][zoom>=17] ,
// 	[subclass=construction][zoom>=17]  {
// 		text-name: @name;
// 		text-fill: #666666;
// 		text-size: 10;
// 		text-dy: 6;
// 		text-spacing: 900;
// 		text-clip: false;
// 		text-placement: line;
// 		text-face-name: @book-fonts;
// 		text-halo-radius: @standard-halo-radius;
// 		text-halo-fill: @standard-halo-fill;
// 		text-min-distance: @railway-text-repeat-distance;
// 		[zoom>=19] {
// 			text-size: 11;
// 			text-dy: 7;
// 		}
// 	}
// }

