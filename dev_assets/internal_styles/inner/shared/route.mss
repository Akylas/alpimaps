@hiking_route_fill:[network] = 4 ? yellow:   [network] <= 3 ? red:   #8800ff;
@hiking_route_dasharray: 6, 2;
@route_width: linear([view::zoom], (4, 0.3), (14, 1.1), (15, 1.2), (18, 3));
@route_casing_width: linear([view::zoom], (4, 1), (18, 3));
@biking_route_fill: [network] = 1 ? #c70000:  #6000eb;
@biking_route_dasharray: 10, 6;
@biking_route_width: linear([view::zoom], (4, 1), (14, 1.5), (15, 1.5), (18, 3));
@route_text_width :linear([view::zoom], (13, 8.0), (18, 12.0));
@route_text_dy :2;

@route_label_fill: #000;
@route_label_width: linear([view::zoom], (15, 8), (20, 11));
@route_label_halo_radius: 0.5;
@route_label_halo: #f2f5f8;

@symbolColorPrep: replace([symbol], '(:|_).*', '');
@symbolColor: @symbolColorPrep = 'white' ? @hiking_route_fill : @symbolColorPrep = '' ? @hiking_route_fill : @symbolColorPrep;
@biking_symbolColor: @symbolColorPrep = 'white' ? @biking_route_fill : @symbolColorPrep = '' ? @biking_route_fill : @symbolColorPrep;
@routeOffset: [network] > 2 ? 2- [network] : [network];

#route['nuti::routes_type'=0],
#route['nuti::routes_type'=1][class=bicycle] ,
#route['nuti::routes_type'=2][class=hiking] {
	[network=1][zoom>=5],
	[network=2][class=bicycle][zoom>=6],
	[network=2][zoom>=8],
	[network=3][zoom>=9],
	[zoom>=10]
	{
		when ([nuti::selected_osmid]=[osmid])::selected,
		{
			when ([nuti::selected_osmid]=[osmid]) {
				// line-opacity:linear([view::zoom], (16, 1), (18, 0.4));
				casing/line-color: white;
				casing/line-width: @route_casing_width + @route_width + 2.0;
				casing/line-join: round;
				casing/line-cap: round;

				//[class=hiking][zoom>=18] {
					// casing/line-geometry-transform: translate(0, @routeOffset*4);
				// }
			}
			// [class=hiking][zoom>=18] {
			// 	line-geometry-transform: translate(0, @routeOffset*4);
			// }

			line-join: round;
			line-cap: round;
			// line-opacity:linear([view::zoom], (16, 1), (18, 0.4));
			// line-opacity: [osmid] = [nuti::selected_osmid] ? linear([view::zoom], (14, 1), (15, 0.3), (17, 0.1)):0.5;
			line-width: @route_width +([osmid]=[nuti::selected_osmid] ? 1 : 0);
			// line-offset: @routeOffset * linear([view::zoom], (15, 0),  (16, 1), (18, 4));


			// line-dasharray: [id] = [nuti::selected_id] ? (0,0) :  @biking_route_dasharray;
			// [class=hiking],
			// [class=foot] {
				line-color: @symbolColor;
			// }

			[class=bicycle] {
				line-width: @biking_route_width +([osmid]=[nuti::selected_osmid] ? 1 : 0);
				line-color: @biking_symbolColor;
				[zoom>=14] {
					line-dasharray: @biking_route_dasharray;
				}
			}
			[ref !=null][zoom>=13],
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