@lineColor: 'rgb(' + [COULEUR] + ')';

#lines {
    line-width: linear([view::zoom], (12,2), (13,2.5), (19, 4.5));
    line-color: @lineColor;
    line-join: round;
    ::text {
        text-name: [NUMERO];
        text-fill: gray;
        // text-allow-overlap: true;
		// text-spacing: 400;
        // text-fill: @lineColor;
        text-size:linear([view::zoom], (13, 7), (16, 12), (17, 12));
        text-halo-radius: 0.4;
        text-halo-fill: @lineColor;
        text-placement: line;
        text-avoid-edges: false;
        text-face-name: @mont_bd;
        text-dy:linear([view::zoom], (13, 2), (16, 3), (17, 4));
    }
    
}