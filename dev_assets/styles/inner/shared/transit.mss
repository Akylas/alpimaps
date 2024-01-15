@transitLineColor: [route_color] ? [route_color] : ([COULEUR] ? 'rgb(' + [COULEUR] + ')' : [nuti::default_transit_color]);
@transitLineContrastColor: [route_text_color] ? [route_text_color] : brightness(color(@transitLineColor)) > 180 ? #000 : #fff;
@transit_route_width: linear([view::zoom], (4, 0.3), (14, 2.1), (15, 3.2), (18, 4));
@transit_route_casing_width: linear([view::zoom], (4, 1), (18, 3));

@transitLineName: [route_short_name] ? [route_short_name] : [NUMERO];

@transit_route_text_width :linear([view::zoom], (13, 8.0), (18, 12.0));
@transit_route_text_dy :2;
@transitShieldeatureId: [route_id]+ @transitLineColor;

@transit_route_label_halo_radius: 2;
@transit_route_label_halo: #f2f5f8;
@transit_line_priority: 100 - length([route_short_name]);

#routes['mapnik::geometry_type'=2][route_type !=2][generated !=true][agency_id !='FLIXBUS-eu'] {

    when ([nuti::selected_id_str]=[route_id])::selected,
    {
        when ([nuti::selected_id_str]=[route_id]) {
            // line-opacity:linear([view::zoom], (16, 1), (18, 0.4));
            casing/line-color: white;
            casing/line-width: @transit_route_casing_width + @transit_route_width + 2.0;
            casing/line-join: round;
            casing/line-cap: round;
            // text-name: [route_short_name];
            // text-fill: @transitLineColor;
            // text-size:linear([view::zoom], (13, 7), (16, 12));
            // text-halo-radius: @standard-halo-radius;
            // text-halo-fill: @standard-halo-fill;
            // text-placement: line;
            // text-face-name: @mont_bd;
            // text-dy:linear([view::zoom], (13, 2), (16, 3), (17, 4));
            //[class=hiking][zoom>=18] {
            // casing/line-geometry-transform: translate(0, @routeOffset*4);
            // }
        }

        line-color: @transitLineColor;

        line-cap: round;
        line-join: round;
        line-width: @transit_route_width +([route_id]=[nuti::selected_id_str] ? 1 : 0);

        [route_short_name !=null][zoom>=13],
        [route_long_name !=null][zoom>=15] {

            ::label0 {
                text-feature-id: @transitShieldeatureId;
                // text-same-feature-id-dependent: true;
                text-fill: @transitLineContrastColor;

                text-name: @transitLineName;
                // [zoom>=15] {
                // 	text-name: [route_long_name];
                // }

                text-placement: nutipoint;
                text-placement-priority: 0 + @transit_line_priority;
                text-wrap-before: true;
                text-face-name: @mont_bd;
                // text-same-feature-id-dependent: true;
                text-size: @transit_route_text_width;
                text-allow-overlap-same-feature-id: true;
                text-same-feature-id-dependent: true;
                // text-halo-fill: @transitLineContrastColor;
                // text-halo-radius: @transit_route_label_halo_radius;
            }

            ::label1 {
                text-placement-priority: 1 + @transit_line_priority;
                text-allow-overlap-same-feature-id: true;
                // text-placement-priority: [nuti::selected_id_str]=[route_id] ? 1000: 0;
                text-placement: nutipoint;
                text-vertical-alignment: middle;
                text-dy: 0.5;
                text-fill: @transitLineColor;
                text-feature-id: @transitShieldeatureId;
                text-size: @transit_route_text_width + 5;
                text-name: '' + ntime('', max(length(@transitLineName) - 2, 0)) + '';
                text-face-name: 'osm';
            }
        }
    }
}

#routes['mapnik::geometry_type'=1] {
    marker-placement: [nuti::markers3d];
    marker-type: ellipse;
    marker-line-color: black;
    marker-fill: #fff;
    marker-width:  linear([view::zoom], (12,4), (13,5.5), (19, 8.5));
    marker-height:  linear([view::zoom], (12,4), (13,5.5), (19, 8.5));
}