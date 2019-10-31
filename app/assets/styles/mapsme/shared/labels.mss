
@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
// @icon: [subclass]? [subclass] : [class];
@maki_icon: [nuti::maki-[subclass]] ? [nuti::maki-[subclass]] : [nuti::maki-[class]];
@osm_icon: [nuti::osm-[subclass]] ? [nuti::osm-[subclass]] : [nuti::osm-[class]];
// @maki_icon_txt: 'icons/' + @icon + '-11.svg';
// @maki_icon_url: url(@maki_icon_txt)
@name_ref: [ref] ? @name + ' (' + [ref] + ')' : @name
@poi_color: [class]=park ? #76A723 : (([subclass]=alpine_hut || [class]=campsite) ? #854d04 : #5D60BE)


/* 3.COUNTRIES & STATES */
#place{
	[class=continent][zoom>=1][zoom<=2]{
		text-name: @name;
		text-transform: uppercase;
		text-face-name: @mont;
		text-fill: @country_label;
		text-size: 10;
		text-halo-radius: 1;
		text-halo-rasterizer: fast;
		text-halo-fill: @label_halo_medium;
	}
	[class=archipelago][zoom>=10],
	[class=island][zoom>=10] {
		text-name: @name;
		text-face-name: @mont;
		text-fill: @district_label;
		text-size: linear([view::zoom], (18, 8), (12, 9), (14, 10), (16, 8));
	}
	[class=cape][zoom>=14]{
		text-name: @name;
		text-face-name: @mont;
		text-fill: @poi_label;
		text-size: 8;
	}
	/* 3.COUNTRIES & STATES */
	[class=country][zoom>=3]{
		text-name: @name;
		text-face-name: @mont;
		text-transform: uppercase;
		text-fill: @country_label;
		text-size: linear([view::zoom], (3, 7), (9, 21));
		text-halo-radius: 1;
		text-halo-rasterizer: fast;
		text-halo-fill: @label_halo_medium;
	}
	[class=state][zoom>=5][zoom<=6][iso_a2=us],
	[class=state][zoom>=6][zoom<=10][iso_a2=us]{
		text-name: @name;
		text-face-name: @mont;
		text-fill: @state_label;
		text-size: linear([view::zoom], (5, 11), (8, 12));
	}
	/* 4.PLACES */
	/* 4.1 Cities */
	[class=city][capital!=2][rank<=2][zoom>=4],
	[class=city][capital!=2][rank<=4][zoom>=5],
	[class=city][capital!=2][rank<=6][zoom>=6],
	[class=city][capital!=2][rank<=7][zoom>=7],
	[class=city][capital!=2][rank<=14][zoom>=9],
	[class=city][capital=2][zoom>=4] {
		// ::icon {
		// 	text-placement: [nuti::markers3d];
		// 	text-name: [nuti::maki-circle_stroked];
		// 	text-face-name: @maki;
		// 	text-size: 6;
		// 	text-fill: step([view::zoom], (4, @label_dark), (12, @label_medium));
		// }
		// ::label {
			text-placement: [nuti::texts3d];
			text-face-name: @mont;
			// text-dx: -5;
			// text-dy: 0;
			text-name: @name;
			text-fill: step([view::zoom], (4, @label_dark), (12, @label_medium));
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-halo-fill: @label_halo_light;
			text-size: linear([view::zoom], (4, 9), (5, 10), (6, 10.6), (7, 10), (8, 10.5), (9, 11), (10, 11), (11, 12), (12, 12), (13, 13));
			[capital=2] {
				text-size: linear([view::zoom], (4, 10), (5, 10.4), (6, 11.6), (7, 11), (8, 10.5), (9, 12), (10, 12), (11, 12), (12, 11));
			}
		// }
	}
	/* 4.2 Town */
	[class=town][rank<=6][zoom>=8],
	[class=town][rank<=12][zoom>=9],
	[class=town][zoom>=10] {
		// ::icon {
		// 	text-placement: [nuti::markers3d];
		// 	text-name: [nuti::maki-circle_stroked];
		// 	text-face-name: @maki;
		// 	text-size:3;
		// 	text-fill: step([view::zoom], (4, @label_dark), (12, @label_medium));
		// }
		// ::label {
			// text-dy: 5;
			text-face-name: @mont;
			text-name: @name;
			text-fill: @city_label;
			text-halo-radius: 1;
			text-halo-rasterizer: fast;
			text-halo-fill: @label_halo_light;
			text-size: linear([view::zoom], (8, 10), (10, 10), (11, 11), (12, 12), (13, 14));
			text-wrap-before: true;
			text-wrap-width: linear([view::zoom], (9, 70), (15, 140));
		// }

	}
	/* 4.3 Village */
	[class=village][zoom>=11],
	[class=hamlet][zoom>=13]{
		text-face-name: @mont;
		text-name: @name;
		text-fill: @city_label;
		text-halo-radius: 1;
		text-halo-rasterizer: fast;
		text-halo-fill: @label_halo_light;
		text-size: linear([view::zoom], (11, 10), (12, 11), (13, 12));
		[class=hamlet]{
			text-size:11;
		}
	}
	/* 4.4 Districts & Small localities */
	[class=suburb][zoom>=10][zoom<=15],
	[class=locality][zoom>=13],
	[class=neighbourhood][zoom>=13],
	[class=farm][zoom>=14],
	[class=isolated_dwelling][zoom>=14] {
		text-face-name: @mont_it;
		text-name: @name;
		text-fill: @district_label;
		text-halo-radius: 1;
		text-halo-rasterizer: fast;
		text-halo-fill: @label_halo_medium;
		text-size: linear([view::zoom], (13, 12), (14, 10));
		[class=suburb] {
			text-size: linear([view::zoom], (10, 8), (13, 10));
		}
	}
}

/* 5.VEGETATION, BEACH & GLACIER */

// #park[zoom<=16]{
// 	[class=nature_reserve][zoom>=6],
// 	[class=national_park][zoom>=6],
// 	[class=protected_area][zoom>=11]{
// 		text-name: @name;
// 		text-face-name: @mont_it_md;
// 		text-wrap-width: 50;
// 		text-wrap-before: true;
// 		text-fill: @park_label;
// 		text-halo-fill: @halo_park_label;
// 		text-halo-radius: 1;
// 		text-character-spacing: 1.1;
// 		text-size: linear([view::zoom], (5, 7.0), (13, 8.0), (16, 14.0));
// 	}
// }

/* 5.1 Vegetation */
#poi {
	[subclass=alpine_hut][rank<=10],
	[class=campsite][rank<=10],
	[zoom=14][rank<=1][class!='information'][class!=toilets][subclass!=bus_stop][subclass!=tram_stop][subclass!=station][class!=picnic_site],
	[zoom=15][rank<=2][class!=toilets][class!='information'][subclass!=bus_stop][subclass!=tram_stop][subclass!=station],
	[zoom=16][class!='information'][subclass!=bus_stop][subclass!=tram_stop][rank<=10],
	[zoom=17][rank<=50],
	[subclass=bus_stop][zoom>=17],
	[subclass=tram_stop][zoom>=17],
	[zoom>=16][class=park][rank<=25],
	[zoom>=18] {
		::label[name!=null] {
			text-face-name: @mont_md;
			text-placement: [nuti::markers3d];
			text-feature-id: [name];
			text-name: @name;
			text-fill: @poi_label;
			text-halo-radius: 0.5;
			text-halo-rasterizer: fast;
			text-halo-fill: @halo_park_label;
			text-line-spacing: -1;
			[class!=null] { 
				text-dy: linear([view::zoom], (16, 11), (21, 17));
			}
			
			// text-min-distance: 100;
			text-wrap-before: true;
			// text-avoid-edges: true;
			text-size: linear([view::zoom], (6, 7), (11, 8), (13, 8), (15, 10)) + (1000 - [rank]) * 0.0000001;
			text-wrap-width: linear([view::zoom], (15, 80), (18, 100));
			
		}
	}
	[subclass=alpine_hut][rank<=10],
	[class=campsite][rank<=10],
	[zoom=14][rank<=1][class!='information'][class!=toilets][subclass!=bus_stop][subclass!=tram_stop][subclass!=station][class!=picnic_site],
	[zoom=14][rank<=2][class!=toilets][class!='information'][subclass!=bus_stop][subclass!=tram_stop][subclass!=station],
	[zoom=15][class!='information'][rank<=10],
	[zoom=16][rank<=50],
	[zoom>=15][class=park][rank<=25],
	[zoom>=18] {
		// shield-file: @maki_icon_url;
		// shield-unlock-image: true;
		// shield-name: @name;
		// shield-size: 10;
		// shield-face-name: @mont_md;
		// shield-placement: [nuti::texts3d];
		// shield-fill: #5D60BE;
		// shield-halo-fill: @halo_park_label;
		// shield-halo-radius: 1;
		// shield-halo-rasterizer: fast;
		// shield-line-spacing: -2;
		// shield-text-dx: -3;
		// shield-text-dy: 0;
		// shield-min-distance: 3;
		// shield-wrap-width: step([view::zoom], (15, 80), (18, 100));
		::icon[class!=null]{
				text-placement: [nuti::markers3d];
				text-name: @osm_icon;
				text-fill: @poi_color;
				text-size: linear([view::zoom], (14, 12), (15, 13), (16, 13), (21, 15)) + (100 - [rank]) * 0.0000001;
				text-face-name: @osm;
				text-feature-id: [name];
				text-halo-radius: 0.7;
				text-halo-rasterizer: fast;
				text-halo-fill: @halo_park_label;
				
			// [class=park] {
			// 	text-fill: #76A723;
			// }
			// [subclass=alpine_hut],
			// [class=campsite] {
			// 	text-fill: #854d04;
			// }
			// [class=hospital] {
			// 	text-fill: #4AA0E7;
			// }
			// [class='information'] {
			// 	text-fill: #F3C600;
			// }
			// [class='school'] {
			// 	text-fill: #725A50;
			// }
			// [class=bakery],[class=restaurant],[class=fast_food] {
			// 	text-fill: #D97200;
			// }
		}
	}
}


// #transportation_name['mapnik::geometry_type'=2] {

// 	::ref {
// 			[zoom>=7][zoom<=11][ref_length<=6] {
// 		// 	// text-placement: [nuti::markers3d];
// 		// 	text-name: [nuti::maki-shield-default-[ref_length]];
// 		// 	text-size: 20; 
// 		// 	text-face-name: @maki;
// 		// 	text-fill: #fff;
// 		// 	text-feature-id: [ref];
// 		// 	text-halo-rasterizer: fast;
// 		// 	text-halo-radius: 1;
// 		// 	// text-allow-overlap: true;
// 		// 	text-min-distance: 100;
// 		// }
// 		// ::label {
// 			text-placement: [nuti::markers3d];
// 			text-feature-id: [ref];
// 			text-name: [ref];
// 			text-size: 9;
// 			text-line-spacing: -4;
// 			text-face-name: @mont;
// 			text-fill: #333;
// 			// text-allow-overlap: true;
// 			// text-min-distance: 100;
// 		// }
// 		}
// 	}
// 	[class=motorway][zoom>=10],
// 	[class=trunk][zoom>=10],
// 	[class=primary][zoom>=10],
// 	[class=tertiary][zoom>=12],
// 	[class=secondary][zoom>=10],
// 	[class=minor][zoom>=12],
// 	[class=service][zoom>=16],
// 	[class=track][zoom>=14],
// 	[class=path][zoom>=14]{
// 		text-avoid-edges: false;
// 		text-name: @name;
// 		text-placement: line;
// 		text-wrap-before: true;
// 		text-face-name: @mont;
// 		text-halo-radius: 1;
// 		text-halo-rasterizer: fast;
// 		text-min-distance: 5;
// 		text-vertical-alignment: middle;
// 		[zoom>=16] {
// 			text-name: @name_ref;
// 		}

// 		[class=motorway],
// 		[class=trunk],
// 		[class=primary]{
// 			text-size: linear([view::zoom], (10, 8), (12, 10), (14, 11), (16, 12)) + 0.00004;
// 			text-fill: step([view::zoom], (10, @label_medium), (14, @label_dark));
// 			text-halo-fill: @label_halo_medium;
// 		}
// 		[class=primary]{
// 			text-size: linear([view::zoom], (10, 8), (12, 8), (14, 11), (16, 12)) + 0.00004;
// 			text-fill: step([view::zoom], (10, @label_medium), (14, @label_dark));
// 			text-halo-fill: @label_halo_medium;
// 		}
		
// 		[class=secondary]{
// 			text-size: linear([view::zoom], (10, 8), (11, 9), (14, 12), (16, 13)) + 0.00004;
// 			text-fill: step([view::zoom], (10, @label_medium), (16, @label_dark));
// 			text-halo-fill: step([view::zoom], (10, @label_halo_medium), (16, @label_halo_light));
// 		}
// 		[class=minor],
// 		[class=tertiary]{
// 			text-size: linear([view::zoom], (11, 8), (14, 10), (15, 11)) + 0.00002;
// 			text-fill: @label_medium;
// 			text-halo-fill: step([view::zoom], (12, @label_halo_medium), (16, @label_halo_light));
// 		}
// 		[class=service]{
// 			text-size: linear([view::zoom], (14, 8), (15, 9), (16, 10)) + 0.00001;
// 			text-fill: @label_medium;
// 			text-halo-fill: step([view::zoom], (12, @label_halo_medium), (16, @label_halo_light));
// 		}
// 		[class=path],
// 		[class=track] {
// 			text-name: @name_ref;
// 			text-size: linear([view::zoom], (14, 8), (18, 10));
// 			text-fill: darken(@pedestrian, 0.4);
// 			text-face-name: @mont_md;
// 			text-halo-radius: 1;
// 			text-halo-fill: @label_halo_medium;
// 		}
// 	}
// }

// /* 6.WATER */
// #water_name {
// 	[class=ocean][zoom>=3],
// 	[class=sea][zoom>=6]{
// 		text-name: @name;
// 		text-face-name: @mont;
// 		text-placement: [nuti::texts3d];
// 		text-fill: @water_label;
// 		text-size: 10;
// 	}
// }
// #waterway{
// 	[class=river][zoom>=11],
// 	[class=riverbank][zoom>=11],
// 	[zoom>=13]{
// 		text-face-name: @mont;
// 		text-name: @name;
// 		text-fill: @water_label;
// 		text-placement: line;
// 		text-size: linear([view::zoom], (11, 10), (14, 10), (15, 11), (17, 11), (18, 12));
// 	}

	
// }


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
			text-name: [nuti::osm-peak];
	// text-size: 14 + [ele] * 0.00001;
			text-size: linear([view::zoom], (7, 6), (15, 8)) + (100 - [rank]) * 0.0000001; 
			text-face-name: @osm;
			text-fill: @peak_label;
			// text-halo-fill: @halo_park_label;
			text-feature-id: [name];
			// text-halo-rasterizer: fast;
			// text-halo-radius: 1;
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
		text-name: @name ?  (@name + '\n '  + [ele] + 'm'): '';
		text-face-name: @mont_md;
		text-size: linear([view::zoom], (6, 7), (11, 8), (14, 9)) + (100 - [rank]) * 0.0000001; 
		text-fill: darken(@peak_label, 0.3);
		text-placement: [nuti::markers3d];
		text-halo-fill: @halo_park_label;
		text-halo-radius: 0.75;
		text-halo-rasterizer: fast;
		text-feature-id: [name];
		// text-allow-overlap: true;
		// text-wrap-before: true;
		text-wrap-width: step([zoom], (15, 70), (16, 90), (18, 100));
		// text-line-spacing:	-2;
		text-dy: 10;
		// text-min-distance: 300;
		}
		
	}
}
 

// biais
#housenumber[zoom>=17]{
	text-name: [housenumber];
	text-face-name: @mont;
	text-fill: @housename;
	text-size: linear([view::zoom], (17, 9), (18, 11));
	text-avoid-edges: true;
	text-min-distance: linear([view::zoom], (17, 100), (18, 50), (19, 20));

}

#aerodrome_label[zoom>=15] {
	text-name: @name;
	text-face-name: @mont;
	text-fill: @building_label;
	text-size: 9;
}
// #aeroway[zoom>=15][ref!=null] {
// 	text-name: [ref];
// 	text-face-name: @mont;
// 	text-fill: @building_label;
// 	text-size: 9;
// }