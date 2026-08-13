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

