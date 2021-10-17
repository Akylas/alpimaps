@lineColor: [route_color]? [route_color] :'rgb(' + [COULEUR] + ')';

#lines['mapnik::geometry_type'=2] {
    line-width: linear([view::zoom], (12,2), (13,2.5), (19, 4.5));
    line-color: @lineColor;
    line-join: round;
    ::text {
        text-name: [route_short_name]? [route_short_name]:[NUMERO];
        text-fill: gray;
        // text-allow-overlap: true;
		// text-spacing: 400;
        // text-fill: @lineColor;
        text-size:linear([view::zoom], (13, 7), (16, 12));
        text-halo-radius: 0.4;
        text-halo-fill: @lineColor;
        text-placement: line;
        text-avoid-edges: false;
        text-face-name: @mont_bd;
        text-dy:linear([view::zoom], (13, 2), (16, 3), (17, 4));
    }
}
#lines['mapnik::geometry_type'=1] {
    // ::icon {
        marker-placement: [nuti::markers3d];
        marker-type: ellipse;
        marker-line-color: [color];
        marker-fill: #fff;
        marker-width:  linear([view::zoom], (12,4), (13,5.5), (19, 8.5));
        marker-height:  linear([view::zoom], (12,4), (13,5.5), (19, 8.5));
        marker-allow-overlap: true;
        marker-clip: false;
    // }
    
    // ::label {
    //     text-name:  [name];
    //     text-face-name: @mont;
    //     text-placement: [nuti::markers3d];
    //     text-line-spacing: -1;
    //     text-wrap-before: true;
    //     text-avoid-edges: true;
    //     text-fill: #000000;
    //     text-size: 12;
    //     text-wrap-width: step([zoom], (15, 80), (16, 90), (18, 100));
    //     text-feature-id: [name];
    //     text-dy: 15; 
    //     text-halo-fill: #ffffff;
    //     text-halo-rasterizer: fast;
    //     text-halo-radius: 1;
    // }
}