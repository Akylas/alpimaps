@font_face:'DIN Pro';
@mont: @font_face + ' Regular';
@mont_md: @font_face + ' Medium';
@mont_bd: @font_face + ' Bold';
@mont_it: @font_face + ' Medium Italic';

@osm: 'osm';

@standard-halo-radius: 2;
@standard-halo-fill: #f2f5f888;
@wrap_characters: '-_';

@name: [name:[nuti::lang]] || [name_int] || [name:en] || [name] || [ref];

@hiking_route_fill:[network] = 4 ? yellow:   [network] <= 3 ? red:   #8800ff;
@hiking_route_dasharray: none;
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

@shield-size: 8;
@shield-line-spacing: -1.50; // -0.15 em
//@shield-spacing: 160;
@shield-repeat-distance: 100;
//@shield-margin: 40;
@shield-clip: false;

@pedestrian_line_width: linear([view::zoom], (16, 2), (18, 2));
@bicycle_line_width: linear([view::zoom], (16, 2), (18, 2));
@default_icon_size: [style.iconSize] = 'osm' ? 16 : 20;

@default_icon_dx : [style.iconDx] = 'osm' ? 0 : -2;

@itemColor: [color] ? [color] : [nuti::main_color];
@lineColor: [color] ? [color] : [nuti::main_darker_color];
@editing_dash: 12, 8;
@non_editing_dash: none;

@itemContrastColor: brightness(color([style.color] ? [style.color]:@itemColor)) > 160 ? #33333388 : #f2f5f888;

@itemLineOpacity: linear([view::zoom], (16, 1), (18, 0.3)) *([nuti::editing_id]=[id] ? 0.5 :1);
@itemBackLineOpacity: linear([view::zoom], (16, 1), (18, 0.3));
// a selected route is the one you are following: it must stay readable at navigation zooms,
// where the generic item fade would drop it to 0.3
@itemSelectedLineOpacity: linear([view::zoom], (13, 1), (18, 0.9));
@itemSelectedBackLineOpacity: linear([view::zoom], (13, 1), (18, 0.9));

// directions are the computed navigation route. Kept as variables so the eink theme can raise
// their contrast, and barely faded at high zoom for the same reason as the selected item above
@directions_casing_color: #787E7B;
@directions_line_color: #ACB0AE;
@directions_arrow_color: #ACB0AE;
@directions_selected_arrow_color: #B3CEFF;
// the casing stays solid so the route always reads as a distinct band, while the fill turns
// translucent when zoomed in so the road and its type stay visible underneath it
@directions_casing_opacity: 1;
@directions_line_opacity: linear([view::zoom], (15, 1), (18, 0.55));
// wide enough to follow at a glance while moving, and growing with zoom like a real navigation line
@directions_casing_width: [class=auto] ? linear([view::zoom], (10, 8), (16, 16), (18, 22)) : linear([view::zoom], (10, 6), (16, 13), (18, 18));
@directions_line_width: [class=auto] ? linear([view::zoom], (10, 5), (16, 11), (18, 15)) : linear([view::zoom], (10, 4), (16, 9), (18, 12));
@directions_arrow_size: linear([view::zoom], (14, 5), (18, 9));

// the navigation layer, ie the route actually being followed. Same widths as a computed route, so
// entering navigation does not resize the line under the user, but its own colours and dashes
@nav_casing_color: @directions_casing_color;
@nav_line_color: [nuti::main_color];
@nav_arrow_color: @directions_selected_arrow_color;
@nav_detour_color: [nuti::main_darker_color];
@nav_detour_dash: 18, 10;
@nav_connector_color: [nuti::main_darker_color];
@nav_connector_width: linear([view::zoom], (10, 2), (16, 4));
@nav_connector_dash: 2, 8;
@nav_original_color: #787E7B;
@nav_original_width: linear([view::zoom], (10, 2), (16, 3));
@nav_original_dash: 8, 6;
