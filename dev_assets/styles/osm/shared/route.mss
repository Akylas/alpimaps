@osm_id: [osmid] +'';
@is_selected: [nuti::selected_id]=@osm_id;
#route['nuti::show_routes'>0]['nuti::routes_type'=0],
#route['nuti::show_routes'>0]['nuti::routes_type'=1][class=bicycle],
#route['nuti::show_routes'>0]['nuti::routes_type'=2][class=hiking] {
	[network=1][zoom>=5],
	[network=2][class=bicycle][zoom>=6],
	[network=2][zoom>=8],
	[network=3][zoom>=9],
	[zoom>=10]
	{
		when ([nuti::selected_id]=[osmid]+'')::selected,
		{
			when ([nuti::selected_id]=[osmid]+'') {
				casing/line-color: white;
				casing/line-width: @route_casing_width + @route_width + 2.0;
				casing/line-join: round;
				casing/line-cap: round;
			}

			line-join: round;
			line-cap: round;
			line-width: @route_width +(@is_selected ? 2 : 0);
			line-color: @symbolColor;
			line-dasharray: @hiking_route_dasharray;

			[class=bicycle] {
				line-width: @biking_route_width +(@is_selected ? 2 : 0);
				line-color: @biking_symbolColor;
				[zoom>='nuti::routes_dash_min_zoom'] {
					line-dasharray: @biking_route_dasharray;
				}
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
                shield-line-spacing: @shield-line-spacing;
                shield-placement: line;
                shield-spacing: [nuti::road_shield_spacing];
                shield-min-distance: [nuti::road_shield_min_dist];
                shield-face-name: @mont_bd;
                shield-file: url(shields/route_shield.svg);
                shield-fill: #000000;
            }
        }
			[name !=null][zoom>=15] {
				text-fill:@symbolColor;
				[class=bicycle] {
					text-fill:@biking_symbolColor;
				}
				text-name: [ref];
				[zoom>=15] {
					text-name: @name;
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