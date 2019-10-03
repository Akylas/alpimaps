
#boundary{
	/* 3.1 Country */
	[admin_level=2] {
		line-color: @border_country;
		line-opacity: linear([view::zoom], (2, 0.7), (3, 0.8), (22, 0.8));
		line-width: linear([view::zoom], (3, 0.5), (4, 0.6), (5, 0.8), (6, 0.85), (7, 1), (8, 1.1), (9, 1.4));
	}
	/* 3.2 Region */
	[admin_level=3][zoom>=4][zoom<5]{
		line-color: @border_region;
		line-width: 0.8;
		line-dasharray: 0.9,0.36;

	}
	[admin_level=4][zoom>=5][zoom<=14]{
		line-color: @border_region;
		line-width: linear([view::zoom], (5, 0.7), (6, 0.8), (7, 0.9), (8, 0.9), (9, 1), (10, 1.2));
		line-opacity: linear([view::zoom], (5, 0.8), (6, 0.9));
		line-dasharray: linear([view::zoom], (5, (1.35,0.9)), (6, (0.9,0.45)), (7, (1.8,0.9)), (8, (1.44,1.44)), (9, (1.8,0.9)));

	}
}

#park[class='aboriginal_lands']['mapnik::geometry_type'=3],
#park[class='protected_area']['mapnik::geometry_type'=3] {
    text-name: [name];
    text-face-name: @book-fonts;
    text-fill: #008000;
    [class='aboriginal_lands'],
    [class='protected_area'][protect_class='24'] {
        text-fill: @aboriginal;
    }
    text-halo-radius: @standard-halo-radius;
    text-halo-fill: @standard-halo-fill;
	// text-largest-bbox-only: false;
	text-wrap-width: 150;
	text-wrap-before: true;
    // text-placement: line;
    text-min-distance: 150;
    // text-repeat-distance: 250;
    // text-margin: 10;
    // text-clip: true;
    // text-vertical-alignment: middle;
    // text-dy: -10;

    // [way_pixels > 750] {
    [zoom < 10] {
        ::fill {
            line-color: fadeout(#008000, 0.95);
            [class='aboriginal_lands'],
            [class='protected_area'][protect_class='24'] {
                polygon-fill: @aboriginal;
            }
        }
        ::outline {
            line-width: 1.2;
            line-color: fadeout(#008000, 0.75);
            [class='aboriginal_lands'],
            [class='protected_area'][protect_class='24'] {
                line-color: @aboriginal;
            }
            [zoom>=9] {
                line-width: 1.5;
            }
        }
    }
    [zoom>=10] {
        ::wideline {
            line-width: 3.6;
            line-geometry-transform: translate(-2, 0);
            line-color: fadeout(#008000, 0.85);
            [class='aboriginal_lands'],
            [class='protected_area'][protect_class='24'] {
                line-color: @aboriginal;
            }
            
            [zoom>=12] {
				line-join: round;
            	line-cap: round;
                line-width: 4;
				line-geometry-transform: translate(-3, 0);
            }
            [zoom>=14] {
                line-width: 6;
				line-geometry-transform: translate(-4, 0);
            }
        }
        ::narrowline {
            line-width: 1.8;
            line-color: fadeout(#008000, 0.75);
            [class='aboriginal_lands'],
            [class='protected_area'][protect_class='24'] {
                line-color: @aboriginal;
            }
            
            [zoom>=12] {
				line-join: round;
            	line-cap: round;
                line-width: 2;
            }
        }
    }
    // }
}