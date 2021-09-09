@selected_item_id: ([osmid] ? [osmid] : [ref] ? [ref] : [name]) + '';

@hiking_route_fill: #8800ff;
@hiking_route_dasharray: 6,2;
@hiking_route_width: linear([view::zoom], (4, 1),  (10, 1),  (12, 2));
@biking_route_fill: #0000ff;
@biking_route_dasharray: 6,2;
@biking_route_width: linear([view::zoom], (4, 1),  (10, 1),  (12, 2));
@route_text_width :linear([view::zoom], (13, 6.0), (18, 8.0));
@route_text_dy :2;

@route_label_fill: #000;
@route_label_width: linear([view::zoom], (15, 8), (20, 11));
@route_label_halo_radius: 1;
@route_label_halo: #f2f5f8;

#route['nuti::routes'>0]{
	[network=4][zoom>=10],
	[network=3][zoom>=9],
	[network=2][zoom>=8],
	[network=1] {
		[class=hiking],[class=foot] {
			line-opacity:0.5;
			line-dasharray: @selected_item_id = [nuti::selected_id] ? (0,0) :  @hiking_route_dasharray;
			line-color:([color] ? [color] : @hiking_route_fill);
			line-width: @hiking_route_width + (@selected_item_id = [nuti::selected_id] ? 1 : 0);
		}
		[class=bicycle] {
			line-opacity:0.5;
			line-dasharray: @selected_item_id = [nuti::selected_id] ? (0,0) :  @biking_route_dasharray;
			line-color:([color] ? [color] : @biking_route_fill);
			line-width:  @biking_route_width + (@selected_item_id = [nuti::selected_id] ? 1 : 0);
		}
		
	
		// line-cap: round;
		// line-join: round;
		[ref!=null]{
			text-fill: [textcolor] ? replace([textcolor],'-.*', '') : ([color] ? [color] : @route_label_fill);
			text-name: [ref];
			text-placement: line;
			text-wrap-before: true;
			text-face-name: @mont;
			text-size: @route_text_width;
			text-halo-fill: @route_label_halo;
			text-halo-radius: @route_label_halo_radius;
			text-halo-rasterizer: fast;
			text-dy: @route_text_dy;
		}
	}
	
}