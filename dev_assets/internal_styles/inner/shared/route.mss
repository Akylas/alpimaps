@selected_item_id: ([osmid] ? [osmid] : [ref] ? [ref] : [name]) + '';

@hiking_route_fill: #8800ff;
@hiking_route_dasharray: 6,2;
@route_width: linear([view::zoom], (4, 1),  (10, 1),  (12, 2));
@route_casing_width: 2;
@biking_route_fill: #0000ff;
@biking_route_dasharray: 6,2;
@route_text_width :linear([view::zoom], (13, 6.0), (18, 8.0));
@route_text_dy :2;

@route_label_fill: #000;
@route_label_width: linear([view::zoom], (15, 8), (20, 11));
@route_label_halo_radius: 1;
@route_label_halo: #f2f5f8;

#route{

	when ([nuti::selected_id] = ([osmid] ? [osmid] : [ref] ? [ref] : [name]))::casing {
		line-opacity:0.5;
		line-color: white;
		line-width: @route_casing_width + @route_width + 2.0;
		line-join: round;
		line-cap: round;
	}

	when ([nuti::selected_id] = ([osmid] ? [osmid] : [ref] ? [ref] : [name]))::selected, ::inner {
		line-join: round;
		line-cap: round;
		[class=hiking],[class=foot] {
			line-opacity: @selected_item_id = [nuti::selected_id] ? 0.3:0.5;
			line-dasharray: @selected_item_id = [nuti::selected_id] ? (0,0) :  @hiking_route_dasharray;
			line-color:([color] ? [color] : @hiking_route_fill);
			line-width: @route_width + (@selected_item_id = [nuti::selected_id] ? 2 : 0);
		}
		[class=bicycle] {
			line-opacity: @selected_item_id = [nuti::selected_id] ? 0.3:0.5;
			line-dasharray: @selected_item_id = [nuti::selected_id] ? (0,0) :  @biking_route_dasharray;
			line-color:([color] ? [color] : @biking_route_fill);
			line-width:  @route_width + (@selected_item_id = [nuti::selected_id] ? 2 : 0);
		}// line-cap: round;
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
			text-dy: @route_text_dy;
		}
	}
	
	

	
	
}