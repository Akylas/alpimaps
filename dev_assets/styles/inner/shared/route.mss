
@osmid: [osmid] + '';
#route['nuti::show_routes'>0]['nuti::routes_type'=0],
#route['nuti::show_routes'>0]['nuti::routes_type'=1][class=bicycle],
#route['nuti::show_routes'>0]['nuti::routes_type'=2][class=hiking] {
	[network=1][zoom>=5],
	[network=2][class=bicycle][zoom>=6],
	[network=2][zoom>=8],
	[network=3][zoom>=9],
	[zoom>=10]
	{
		when ([nuti::selected_osmid]=@osmid)::selected,
		{
			when ([nuti::selected_osmid]=@osmid) {
				casing/line-color: white;
				casing/line-width: @route_casing_width + @route_width + 2.0;
				casing/line-join: round;
				casing/line-cap: round;
			}

			line-join: round;
			line-cap: round;
			line-width: @route_width +(@osmid=[nuti::selected_osmid] ? 2 : 0);

			[class=bicycle] {
				line-width: @biking_route_width +(@osmid=[nuti::selected_osmid] ? 2 : 0);
				line-color: @biking_symbolColor;
				[zoom>='nuti::routes_dash_min_zoom'] {
					line-dasharray: @biking_route_dasharray;
				}
			}
            ['nuti::route_shields'>0][zoom<15][ref != null]::label{
              [network=1][zoom>=6],
              [network=2][class=bicycle][zoom>=8],
              [network=2][zoom>=10],
              [network=3][zoom>=11]{
                shield-name: [ref];
                shield-placement-priority: 20 - [network];
                shield-size: @shield-size;
            //    shield-line-spacing: @shield-line-spacing;
                shield-placement: line;
            //    shield-spacing: @shield-spacing;
            //    shield-repeat-distance: @shield-repeat-distance;
            //    shield-min-distance: @shield-margin;
                shield-face-name: @mont_bd;
            //    shield-clip: @shield-clip;
                shield-file: url(shields/route_shield.svg);
                shield-fill: #000000;
              }
            }
			[ref !=null][zoom>=14],
			[name !=null][zoom>=15] {
				text-fill:@symbolColor;
				[class=bicycle] {
					text-fill:@biking_symbolColor;
				}
				text-name: [ref];
				[zoom>=15] {
					text-name: [name];
				}
				text-placement: line;
				text-wrap-before: true;
				text-face-name: @mont_bd;
				text-size: @route_text_width;
				text-halo-fill: @route_label_halo;
				text-halo-radius: @route_label_halo_radius;
				text-dy: @route_text_dy;
			}
		}
	}
}