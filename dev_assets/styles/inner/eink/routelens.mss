// The ticks that say how serious a lens slice is where colour cannot: white marks along the black core,
// sparse on s1, dense on s2, nearly solid on s3. Short on purpose, so they never read as the long dashes
// of the navigation layer (20,12 / 8,8 / 3,9). Not on a section out of focus.
#poi['mapnik::geometry_type'=2][class='lens'][f=1][s>=1]::tick,
#navigation['mapnik::geometry_type'=2][class='lens'][f=1][s>=1]::tick {
	line-color: #ffffff;
	line-width: 1.2;
	line-cap: butt;
	[s=1] {
		line-dasharray: 2, 7;
	}
	[s=2] {
		line-dasharray: 2, 3;
	}
	[s=3] {
		line-dasharray: 6, 2;
	}
}
