#search {
	['mapnik::geometry_type'=1] {
		text-placement: point;
		text-name: ;
		text-face-name: @osm;
		text-fill: [style.color] ? [style.color] : red;
		text-horizontal-alignment:middle;
		text-vertical-alignment:middle;
        // text-dx: 0.1;
        // text-dy: 4;
		text-size:  linear([view::zoom], (10, 5), (16, 5), (18, 10))+ ([style.iconSize] ? [style.iconSize]: 10);
		text-allow-overlap: true;
		text-clip: false;
		[zoom>=18] {
			text-face-name: [style.mapFontFamily] ? [style.mapFontFamily] : 'osm';
			text-name: [style.icon] ? [style.icon] : '';
			text-size:  linear([view::zoom], (18, 26))+ ([style.iconSize] ? [style.iconSize]: 10);
		}
	}

}