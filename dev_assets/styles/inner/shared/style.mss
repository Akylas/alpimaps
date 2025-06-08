@font_face:'DIN Pro';
@mont: @font_face + ' Regular';
@mont_md: @font_face + ' Medium';
@mont_bd: @font_face + ' Bold';
@mont_it: @font_face + ' Medium Italic';

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

@itemContrastColor: brightness(color([style.color] ? [style.color]:@itemColor)) > 140 ? #33333388 : #f2f5f888;
