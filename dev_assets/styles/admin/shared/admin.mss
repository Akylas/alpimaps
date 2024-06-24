@name: [nuti::lang] ? ([name:[nuti::lang]] ? [name:[nuti::lang]] : ([name:[nuti::fallback_lang]] ? [name:[nuti::fallback_lang]] : [name])) : [name];
@color: [color];

#boundary {
    [admin_level=4][zoom>=4][zoom<7],
    [admin_level>=5][zoom>=7][zoom<=14] {
        line-color: #000;
        polygon-fill: @color;
        polygon-opacity: 0.3;
        line-width: 1;
    }

}
#boundary['mapnik::geometry_type'=1] {
    [admin_level=4][zoom>=4][zoom<7],
    [admin_level>=5][zoom>=7][zoom<=14] {

            text-placement-priority: -10000000;
			text-placement: [nuti::markers3d];
            text-name: @name + '\n' + [ref];
            text-face-name: @mont_md;
            text-wrap-character: @wrap_characters;
            // text-placement: [nuti::texts3d];
            text-fill: #000;
            text-halo-fill: @standard-halo-fill;
            text-halo-radius: @standard-halo-radius;
            text-size: linear([view::zoom], (6, 10.0), (7, 14.0));
            text-wrap-width: step([view::zoom], (5, 40), (7, 70));
    }

}