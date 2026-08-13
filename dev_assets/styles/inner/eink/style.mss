@biking_route_dasharray: 6, 6;
@hiking_route_dasharray: 3, 3;

@standard-halo-radius: 2;
@standard-halo-fill: #ffffff;
@itemContrastColor: #ffffff;
@itemColor: #000;
@lineColor: #000;

// the default direction greys are indistinguishable from the map on a black and white screen
@directions_casing_color: #ffffff;
@directions_line_color: #000000;
@directions_arrow_color: #ffffff;
@directions_selected_arrow_color: #ffffff;
// no translucency on eink: a black and white screen dithers it into noise instead of showing the
// road underneath, so contrast is what has to carry the route
@directions_casing_opacity: 1;
@directions_line_opacity: 1;
@directions_casing_width: [class=auto] ? linear([view::zoom], (10, 9), (16, 18), (18, 24)) : linear([view::zoom], (10, 7), (16, 15), (18, 20));
@directions_line_width: [class=auto] ? linear([view::zoom], (10, 5), (16, 11), (18, 15)) : linear([view::zoom], (10, 4), (16, 9), (18, 12));

// nothing here can be told apart by colour, so the navigation layer separates its lines by dash and
// width alone: solid black is what is followed, dashed is a detour, dotted only points the way
@nav_casing_color: #ffffff;
@nav_line_color: #000000;
@nav_arrow_color: #ffffff;
@nav_detour_color: #000000;
@nav_detour_dash: 20, 12;
@nav_connector_color: #000000;
@nav_connector_width: linear([view::zoom], (10, 3), (16, 5));
@nav_connector_dash: 3, 9;
@nav_original_color: #000000;
@nav_original_width: linear([view::zoom], (10, 2), (16, 3));
@nav_original_dash: 8, 8;

