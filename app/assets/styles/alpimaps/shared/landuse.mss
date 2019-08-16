@buildingHeight: [render_height] ? [render_height] : 10;
#landcover {
	[class=rock][zoom>=8] {
		polygon-fill: rgba(112, 112, 112, 0.3);
	}

	[class=sand][zoom>=8],
	[subclass='sand'][zoom>=8] {
		polygon-fill: @beach;
	}
	[class=ice][zoom>=8],
	[subclass='glacier'][zoom>=8] {
		polygon-fill: @ice;
		line-width:0.2;
		line-color: @ice_outline;
	}
	[class=wetland][zoom>=8] {
			polygon-fill: @wetland;
			[zoom>=12] {
				polygon-pattern-file: url('symbols/wetland.png');
			}
	}
	
	[class=grass],
	[class=farmland],
	[subclass=park],
	[subclass=village_green]{
		[zoom<=10] {
			polygon-fill: linear([view::zoom], (7, fadeout(@grass, 0.8)), (10, @grass));
		}
		[zoom>=10][zoom<=23] {
			polygon-fill: @grass;
			line-color: @grass_outline;
			line-width:0.5;
		}
	}

	
	[class=wood],
	[class=tree][zoom<=10],
	[class=wood][zoom>=10] {
		polygon-fill:@wood;
	}
	[class=grassland][zoom>=10] {
		polygon-fill:fadeout(@wood, 0.5);
	}
	[subclass='recreation_ground'][zoom>=9]{
		polygon-fill: linear([view::zoom], (2, rgba(130, 191, 90, 0.0)), (11, rgba(130, 191, 90, 0.6)), (15, rgba(130, 191, 90, 0.7)));
	}
	
}

#park[zoom>=6]{
		polygon-fill: linear([view::zoom], (6, fadeout(@park, 0.4)), (11, fadeout(@park, 0.7)), (15, fadeout(@park, 0.8)));
		line-color: #82bf5a;
		line-width: 1;
}

#landuse {


	[class=industrial],
	[class=retail],
	[class=stadium],
	[class=commercial]{
		[zoom>=10] {
			polygon-fill: linear([view::zoom], (12, rgba(179, 179, 179, 0.5)), (16, rgba(232, 230, 223, 0.5)));
		}
	}
	[class=college],
	[class=university],
	[class=school]{
		[zoom>=10] {
			polygon-fill: rgba(255, 255, 229, 0.5);
		}
	}

	[class=playground],
	[class=theme_park],
	[class=zoo]{
		[zoom>=10][zoom<=22] {
			polygon-fill: #D1CDA7;
			line-color: rgb(207, 211, 195)
		}
	}
	
	[class=residential][zoom<=16]{
		polygon-fill: linear([view::zoom], (9, fadeout(@urbanareas, 0.4)), (12, fadeout(@urbanareas,0.9)));
	}
	[class=track],
	[class=pitch],
	[class=cemetery],
	[class=stadium]{
		line-color: #92D0B7
		polygon-fill: linear([view::zoom], (2, rgba(170, 224, 203, 0.0)), (11, rgba(170, 224, 203, 0.6)), (15, rgba(170, 224, 203, 0.7)));
	}
	[class=vineyard] {
		[zoom >= 5] {
			polygon-fill: @orchard;
		}
		[zoom >= 13] {
			polygon-pattern-file: url('symbols/vineyard.png');
		}
	}
	[class=orchard] {
		[zoom >= 5] {
			polygon-fill: @orchard;
		}
		[zoom >= 13] {
			polygon-pattern-file: url('symbols/orchard.png');
		}
	}
	
}

#building [zoom>=14]['nuti::buildings'>0]{
	::3d['nuti::buildings'>1][zoom>=17]{
	  building-height: [render_height] ? [render_height] : 10;
	  building-min-height: [render_min_height];
	  building-fill: lighten(@buildings3d,10%);
	  building-fill-opacity: linear([view::zoom], (17, 0.0), (18, 0.25));
	} 
  
	::shadow['nuti::buildings'=1][zoom>=17]{
	  polygon-fill: @building_shadow;
	  polygon-opacity: linear([view::zoom], (17, 0.0), (18, 1.0));
	  [zoom>=15] { polygon-geometry-transform: translate(0,1); }
	  [zoom>=16] { polygon-geometry-transform: translate(0,2); }
	  [zoom>=17] { polygon-geometry-transform: translate(0,3); }
	  [zoom>=18] { polygon-geometry-transform: translate(0,5); } 
		
	}
  
		['nuti::buildings'=1],
		['nuti::buildings'>1][zoom<17]{
			::fill{
			polygon-fill: @buildings;
			polygon-opacity: linear([view::zoom], (14, 0.0), (14.2, 0.8), (14.5, 1.0));
			}
			
		}
		::case[zoom>=16]{
			line-cap: butt;
			line-width: linear([view::zoom], (16, 0.0), (17, 0.6));
			line-color: #aaa;
		}
	  
  }
#aeroway{
	line-cap: butt;
	line-join: miter;
	line-color: @aeroways;
	line-width: 0.5;

	[class=runway]{
		line-width: linear([view::zoom], (10, 0.0), (11, 0.5), (12, 1.0), (13, 2.0), (14, 4.0), (15, 6.0), (16, 8.0));
	}

	[class=taxiway]{
		line-width: linear([view::zoom], (12, 0.0), (13, 0.5), (14, 1.0), (15, 2.0), (16, 4.0));
	}
}
