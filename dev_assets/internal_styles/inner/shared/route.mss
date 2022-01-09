@hiking_route_fill: #8800ff;
@hiking_route_dasharray: 6,2;
@route_width: linear([view::zoom], (4, 1),  (10, 1),  (12, 2));
@route_casing_width: 2;
@biking_route_fill: #0000ff;
@biking_route_dasharray: 6,2;
@route_text_width :linear([view::zoom], (13, 8.0), (18, 12.0));
@route_text_dy :2;

@route_label_fill: #000;
@route_label_width: linear([view::zoom], (15, 8), (20, 11));
@route_label_halo_radius: 1;
@route_label_halo: #f2f5f8;

@symbolColor: replace([symbol], '(:|_).*', '');

#route{
	[network=4][zoom>=10],
	[network=3][zoom>=9],
	[network=2][zoom>=8],
	[network=1] {
		when ([nuti::selected_osmid] = [osmid])::casing {
			line-opacity:linear([view::zoom], (15, 0.5), (17, 0.1));
			line-color: white;
			line-width: @route_casing_width + @route_width + 2.0;
			line-join: round;
			line-cap: round;
		}

		when ([nuti::selected_osmid] = [osmid])::selected,
			::inner {
			line-join: round;
			line-cap: round;
			line-opacity: [osmid] = [nuti::selected_osmid] ? linear([view::zoom], (14, 1), (15, 0.3), (17, 0.1)):0.5;
			line-width: @route_width + ([osmid] = [nuti::selected_osmid] ? 2 : 0);
			// line-dasharray: [id] = [nuti::selected_id] ? (0,0) :  @biking_route_dasharray;
			[class=hiking],[class=foot] {
				[symbol=null] {
					[network=4] {
						line-color:yellow;
					}
					[network<=3] {
						line-color:red;
					}
				}
				[symbol!=null] {
					line-color:(@symbolColor);
				}
			}
			[class=bicycle] {
				line-color:([symbol] ? @symbolColor : @biking_route_fill);
			}
			[ref!=null][zoom>=13]{
				text-fill: ([symbol] ? @symbolColor : @route_label_fill);
				text-name: [ref];
				[zoom>=15]{
					text-name: [name];
				}
				text-placement: line;
				text-wrap-before: true;
				text-face-name: @mont;
				text-size: @route_text_width;
				text-halo-fill: @route_label_halo;
				text-halo-radius: @route_label_halo_radius;
				text-dy: @route_text_dy;
			}
		}
	}
}