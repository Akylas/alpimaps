
@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
@maki_icon: [nuti::maki-[subclass]] ? [nuti::maki-[subclass]] : [nuti::maki-[class]];
// @id_test: (([osm_id]) = [nuti::selected_id]) ? #f00 : #fff;
// @name_test: (([name]) = [nuti::selected_name]) ? #0f0 : #fff;

#water_name[class=ocean][zoom>=3][zoom<=9],
#water_name[class=sea][zoom>=6]{
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

#park[rank=1][zoom<=16]{
	[class=nature_reserve][zoom>=6],
	[class=national_park][zoom>=6],
	[class=protected_area][zoom>=11]{
		text-name: @name;
		text-face-name: @mont_it_md;
		text-wrap-width: 50;
		text-wrap-before: true;
		text-fill: @natural_parks_label;
		text-halo-fill: @natural_parks_halo;
		text-halo-radius: 1;
		text-character-spacing: 1.1;
		text-size: linear([view::zoom], (5, 7.0), (13, 8.0), (16, 14.0));
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
		text-wrap-width: step([zoom], (1, 20), (2, 40));
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
		
			[name_en='Nagorno-Karabakh Republic'],
			[name_en='South Ossetia'],
			[name_en='Abkhazia'] {
				text-name: '';
				text-face-name: @mont_md;
				text-fill: transparent;
			}
	
			[rank=1][zoom>=2]{
				text-size: linear([view::zoom], (2, 10.0), (5, 13.0), (6, 15.0));
				text-wrap-width: step([zoom], (2, 60), (3, 80), (4, 100), (5, 120), (6, 140));
			}
			[rank=2][zoom>=3]{
				text-size: linear([view::zoom], (3, 10.0), (6, 13.0));
				text-wrap-width: step([zoom], (3, 60), (4, 70), (5, 80), (6, 100));
			}
			[rank=3][zoom>=4]{
				text-size: linear([view::zoom], (4, 10.0), (8, 14.0));
				text-wrap-width: step([zoom], (4, 30), (5, 60), (8, 120));
			}
			[rank=4][zoom>=5]{
				text-size: linear([view::zoom], (5, 10.0), (9, 14.0));
				text-wrap-width: step([zoom], (5, 30), (6, 60), (7, 90), (8, 120));
			}
			[rank=5][zoom>=5]{
				text-size: linear([view::zoom], (5, 10.0), (9, 14.0));
				text-wrap-width: step([zoom], (6, 30), (7, 60), (8, 90), (9, 120));
			}
			[rank>=6][zoom>=6]{
				text-size: linear([view::zoom], (6, 10.0), (9, 13.0));
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
			text-allow-overlap: false;
			text-wrap-before: true;
			text-min-distance:5;
			text-size: linear([view::zoom], (5, 11.0), (6, 12.0), (7, 13.0));
			text-wrap-width: step([zoom], (5, 60), (6, 80), (7, 100));
		}
	}
	
	[class=city]{
		[zoom>=4][zoom<=7]{
			[zoom>=4][rank<=2],
			[zoom>=5][rank<=4],
			[zoom>=6][rank<=6],
			[zoom>=7][rank<=7]{
				::icon {
					text-placement: [nuti::markers3d];
					text-name: [nuti::maki-circle];
					text-size: 6;
					text-face-name: @maki;
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
					text-wrap-width: step([zoom], (4, 40), (5, 50), (6, 60));
					[zoom>=5][rank>=0][rank<=2],
					[zoom>=7][rank>=3][rank<=5] { 
						text-transform:uppercase;
					}
				}
			}
			[zoom>=8][zoom<=14][rank<=11],
			[zoom>=9][zoom<=14][rank<=12],
			[zoom>=10][zoom<=14][rank<=15]{
				text-name: @name;
				text-face-name: @mont_md;
				text-placement: [nuti::texts3d];
				text-fill: @place_text;
				text-halo-fill: @place_halo;
				text-halo-radius: 1;
				text-halo-rasterizer: fast;
				text-line-spacing: -2;
				text-size: linear([view::zoom], (8, 13.0), (14, 21.0)) - ([rank] / 2.0);
				text-wrap-width: step([zoom], (8, 50), (9, 60), (10, 60), (11, 70), (12, 80), (13, 120), (14, 200));

				[zoom=8][rank<=7],
				[zoom=9][rank<=10],
				[zoom>=10] {
					text-transform: uppercase;
				}
			}
		}

		[zoom>=8][zoom<=14][rank<=11],
		[zoom>=9][zoom<=14][rank<=12],
		[zoom>=10][zoom<=14][rank<=15]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (8, 13.0), (14, 21.0)) - ([rank] / 2.0);
			text-wrap-width: step([zoom], (8, 50), (9, 60), (10, 60), (11, 70), (12, 80), (13, 120), (14, 200));

			[zoom=8][rank<=7],
			[zoom=9][rank<=10],
			[zoom>=10] {
				text-transform: uppercase;
			}
		}
	}
	[class=town] {
		[zoom>=9][zoom<=14][rank<=12],
		[zoom=15]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (9, 9.0), (10, 10.0), (11, 11.0), (12, 12.0), (13, 13.0), (14, 15.0), (15, 17.0));
			text-wrap-width: step([zoom], (9, 70), (10, 80), (11, 90), (12, 100), (13, 110), (14, 130), (15, 140));
		}
	}
	[class=village] {
		[zoom>=10][zoom<=12][rank<=11],
		[zoom>=13]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (11, 9.0), (12, 10.0), (13, 11.0), (16, 16.0));
			text-wrap-width: step([zoom], (12, 80), (13, 90), (14, 120), (15, 140), (16, 160));
		}
	}
	[class=suburb]{
		[zoom>=12][zoom<=14][rank<=11],
		[zoom>=15][zoom<=16]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-size: linear([view::zoom], (12, 9.0), (13, 10.0), (16, 13.0));
			text-wrap-width: step([zoom], (12, 60), (13, 80), (14, 90), (15, 100), (16, 120));
		}
	}
	[class=hamlet],
	[class=island],
	[class=islet],
	[class=neighbourhood] {
		[zoom>=12][zoom<=16][rank<=12],
		[zoom>=16][zoom<=17]{
			text-name: @name;
			text-face-name: @mont_md;
			text-placement: [nuti::texts3d];
			text-fill: @place_text;
			text-halo-fill: @place_halo;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-wrap-before: true;
			text-line-spacing: -2;
			text-transform: uppercase;
			text-size: linear([view::zoom], (14, 9.0), (16, 13.0), (17, 15.0));
			text-wrap-width: step([zoom], (13, 50), (14, 80), (15, 100), (16, 120), (17, 140));
		}
	}
}

#water_name [class=lake][zoom>=7]{
	text-name: @name;
	text-face-name: @mont_it;
	text-placement: [nuti::texts3d];
	text-fill: @water_label;
	text-wrap-before: true;
	text-min-distance:30;
	text-size: linear([view::zoom], (12, 8.0), (16, 9.0), (17, 10.0), (18, 12.0));
	text-wrap-width: step([zoom], (16, 80), (17, 100));
}

#waterway{
	[class=river][zoom>=10],
	[class=stream][zoom>=12]
	[zoom>=13]{
		// text-allow-overlap: true;
	// text-spacing: 100;
	text-name: @name;
	text-face-name: @mont;
	text-fill: @water_label;
	text-avoid-edges: false;
	// text-halo-rasterizer: fast;
	text-placement: line;
	text-dy:-1;
	text-wrap-before: true;
	// text-character-spacing: 1;
	// text-wrap-width: step([zoom], (13, 80), (17, 150));
	text-size: linear([view::zoom], (10, 7.0), (15, 8.0), (16, 10.0), (17, 10.0));
	[class=stream] {
		text-size: linear([view::zoom], (10, 6.0), (15, 7.0), (17, 9.0));
	}
}
}

#transportation_name['mapnik::geometry_type'=2]{
	
	[class='motorway'][zoom>=7][zoom<=10][ref_length<=6],
	[class='motorway'][zoom>=9][zoom<=10][ref_length<=6],
	[zoom>=11][ref_length<=6] {
		text-name: [ref];
		text-size: 9;
		text-line-spacing: -4;
		// text-file: url(shield/default-[ref_length].svg);
		text-face-name: @mont;
		text-fill: #333;
		[zoom>=14] {
			text-size: 11;
		}
	}
	[class='motorway'][zoom>=7][zoom<=10][ref_length<=6],
	[class='motorway'][zoom>=9][zoom<=10][ref_length<=6] {
		text-min-distance: 50;
		text-size: 8;
		text-placement: point;
		text-avoid-edges: false;
	}
	[zoom>=11][ref_length<=6] {
		text-placement: line;
		text-spacing: 400;
		text-min-distance: 100;
		text-avoid-edges: true;
	}

	[class=motorway][zoom>=9],
	[class=trunk][zoom>=10],
	[class=primary][zoom>=14],
	[class=track][zoom>=15],
	[class=tertiary][zoom>=15],
	[class=secondary][zoom>=15],
	[class=minor][zoom>=16],
	[class=service][zoom>=17],
	[class=path][zoom>=17]{
		text-avoid-edges: false;
		text-name: @name;
		text-placement: line;
		text-wrap-before: true;
		text-face-name: @mont;
		text-fill: @road_text;
		text-halo-fill: @minor_halo;
		text-halo-radius: 1;
		text-halo-rasterizer: fast;
		text-min-distance: 5;
		text-size: linear([view::zoom], (13, 6.0), (18, 8.0));
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
			text-size: linear([view::zoom], (13, 6.0), (18, 12.0)) + 0.00003;
		}
		[class=minor]{
			text-size: linear([view::zoom], (13, 6.0), (18, 10.0)) + 0.00002;
		}
		[class=service]{
			text-size: linear([view::zoom], (13, 6.0), (18, 10.0)) + 0.00001;
		}
	}
}

#housenumber[zoom>=16]['nuti::buildings'>0]{
	text-name: [housenumber];
	text-face-name: @mont;
	text-fill: @housenumber;
	text-halo-rasterizer: fast;
	text-line-spacing: -1;
	text-wrap-width: 60;
	text-wrap-before: true;
	text-avoid-edges: true;
	text-transform: uppercase;
	text-min-distance: linear([view::zoom], (16, 100.0), (17, 50), (18, 20.0));
}

#poi {
	// [osm_id = 'nuti::selected_id'],
	// [name = 'nuti::selected_name'],
	[class=campsite][rank<=10],
	[subclass='alpine_hut'][rank<=10],
	// [class=school],
	[zoom=14][rank<=1][class!='information'][class!='toilets'][class!='bus'][subclass!='tram_stop'][subclass!='station'][class!='picnic_site'],
	[zoom=15][rank<=2][class!='toilets'][class!='information'][class!='bus'][subclass!='tram_stop'][subclass!='station'],
	[zoom=16][rank<=3],
	[zoom=17][rank<=4],
	[zoom>=15][class=park][rank<=10],
	[zoom>=16][class=park][rank<=20],
	[zoom>=17][class=park][rank<=30],
	[zoom>=18] {

		[class='information']['nuti::poi_information'=1],[class!='information']{
			::icon[class!=null]{
					text-placement: [nuti::markers3d];
					text-name: @maki_icon;
					text-size: 14 - 0.000001 * [rank];
					text-face-name: @maki;
					// text-opacity:0.8;
					text-feature-id: [name];
		
					text-halo-fill: @peak_halo;
					text-halo-rasterizer: fast;
					text-halo-radius: 1;
					text-fill: #495063;
					[class='park'] {
						text-fill: #76BC54;
					}
					[subclass='alpine_hut'],[class='campsite'] {
						text-fill: #854d04;
					}
					[class='hospital'] {
						text-fill: #4AA0E7;
					}
					[class='information'] {
						text-fill: #F3C600;
					}
					[class='bakery'], [class='restaurant'] {
						text-fill: #EF8000;
					}
			}
			::label[name!=null] {
				text-name: @name;
				text-face-name: @mont;
				text-placement: [nuti::markers3d];
				text-line-spacing: -1;
				text-wrap-before: true;
				text-avoid-edges: true;
				text-fill: @poi_dark;
				text-size: 9 - 0.000001 * [rank];
				text-wrap-width: step([zoom], (15, 80), (16, 90), (18, 100));
				text-feature-id: [name];
				[class!=null] { text-dy: 10; }
				text-halo-fill: @peak_halo;
				text-halo-rasterizer: fast;
				text-halo-radius: 1;

				// text-fill: #495063;
				// [class='park'] {
				// 	text-fill: #76BC54;
				// }
				// [class='lodging'] {
				// 	text-fill: #854d04;
				// }
				// [class='hospital'] {
				// 	text-fill: #4AA0E7;
				// }
				// [class='information'] {
				// 	text-fill: #F3C600;
				// }
				// [class='bakery'], [class='restaurant'] {
				// 	text-fill: #EF8000;
				// }
			}
		}
	}
}

#contour['nuti::contours'>0] {
	[zoom>=12][ele>300],
	[zoom>=14][ele>200],
	[zoom>=16][ele>0] {
		[index=5][zoom>=16],
		[index=10] {
			text-name: [ele]+' m';
			text-face-name: @mont;
			text-fill: @contour;
			text-comp-op: minus;
			text-min-distance: 30;
			// text-halo-fill: rgba(136, 96, 74, 0.5);
			// text-halo-radius: 0.1;
			text-avoid-edges: true;
			text-placement: line;
			text-dy:-1;
			text-size: linear([view::zoom], (12, 6), (20, 10.0)) + 0.00001 * [ele];
		}
	}
}
#mountain_peak {
	// [osm_id = 'nuti::selected_id'],
	// [name = 'nuti::selected_name'],
	[zoom>=4][comment =~'.*Highest.*'],
	[zoom>=4][comment =~'.*highest.*'],
	[zoom>=7][ele>=4000],
	[zoom>=8][ele>=3000],
	[zoom>=9][ele>=2000],
	[zoom>=10][ele>=1500],
	[zoom>=11] {
		::icon {
			text-placement: [nuti::markers3d];
			text-name: [nuti::maki-mountain];
			text-size: 14 + [ele] * 0.00001;
			text-face-name: @maki;
			text-fill: @peak_label;
			text-halo-fill: @peak_halo;
			text-feature-id: [name];
			text-halo-rasterizer: fast;
			text-halo-radius: 1;
		}
	}
	[zoom>=4][comment =~'.*Highest.*'],
	[zoom>=4][comment =~'.*highest.*'],
	[zoom>=7][ele>=4500],
	[zoom>=8][ele>=3500],
	[zoom>=9][ele>=2500],
	[zoom>=10][ele>=2000],
	[zoom>=11] {
		::label {
		text-name: @name ?  (@name + ' '  + [ele] + 'm'): '';
		text-face-name: @mont_md;
		text-size: linear([view::zoom], (6, 7.0), (14, 9)) + [ele] * 0.00001;
		text-fill: @peak_label_dark;
		text-placement: [nuti::markers3d];
		text-halo-fill: @peak_halo;
		text-halo-radius: 0.75;
		text-halo-rasterizer: fast;
		text-feature-id: [name];
		// text-allow-overlap: true;
		text-wrap-before: true;
		text-wrap-width: step([zoom], (15, 70), (16, 90), (18, 100));
		text-line-spacing:	-2;
		text-dy: 10;
		text-min-distance: 300;
		}
		
	}
}