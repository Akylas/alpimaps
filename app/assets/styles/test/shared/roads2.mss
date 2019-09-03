
#transportation{
    
	[class=motorway][brunnel=tunnel][zoom>=1]{
		
		line-color: '#ff00ff';
		
	}
    [class=motorway][zoom>=4]{
        line-color: '#ff00ff';
		
	}
	
	[subclass=funicular][zoom>=12] {
		
			line-color:'#ff00ff';
			line-width:linear([view::zoom], (12, 1.4), (13, 2), (15, 3));

	}
}
