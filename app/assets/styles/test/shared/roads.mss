#transportation {
    [brunnel='bridge'][zoom>='13'] {
        line-color: '#ff0000';
    }
    [class='motorway'][brunnel='tunnel'][zoom>='11'],
    [class='trunk'][brunnel='tunnel'][zoom>='13'],
    [class='primary'][brunnel='tunnel'][zoom>='14'],
    [class='secondary'][brunnel='tunnel'][zoom>='16'],
    [class='tertiary'][brunnel='tunnel'][zoom>='16'],
    [class='minor'][brunnel='tunnel'][zoom>='16'],
    [class='sevice'][brunnel='tunnel'][zoom>='16'] {
        line-color: '#00ff00';
        [class='motorway']{
            line-color: '#0ff0f0';

        }

    }

    [class='motorway'][zoom>='4'],
    [class='motorway'][ramp='1'][zoom>='7'],
    [class='trunk'][zoom>='7'],
    [class='trunk'][ramp='1'][zoom>='13'] {
        line-color: '#ffff00';
    }

    [subclass='bridleway'][zoom>='14'] {
        line-color: '#00ffff';
    }

    [subclass='funicular'][zoom>='12'] {
        line-color: '#ffffff';
        ::case {
            [brunnel=tunnel][zoom>=14] {
            // casing 1
                line-color: '#0f0f00';
            }
        }
    }
}
