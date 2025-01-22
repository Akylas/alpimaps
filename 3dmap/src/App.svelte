<script lang="ts">
    import { type LngLatLike, Map, Marker, type StyleSpecification } from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';
    import { onDestroy } from 'svelte';
    import './global.css';

    function GetURLParameters() {
        // console.log('GetURLParameters ' + window.location.search);
        const sPageURL = decodeURI(window.location.search).substring(1);
        const sURLVariables = sPageURL.split('&');
        return sURLVariables.reduce((acc, val) => {
            const sParameterName = decodeURIComponent(val).split('=');
            acc[sParameterName[0]] = sParameterName.slice(1).join('=');
            return acc;
        }, {});
    }
    const urlParamers = GetURLParameters();
    let map: Map;

    let options = {
        position: urlParamers['position']?.split(',').map(parseFloat).reverse() as LngLatLike,
        bearing: parseFloat(urlParamers['bearing'] || '8'),
        zoom: parseFloat(urlParamers['zoom'] || '8'),
        pitch: parseFloat(urlParamers['pitch'] || '45'),
        hideAttribution: (urlParamers['hideAttribution'] || 'false') === 'true',
        language: urlParamers['lang'] || 'en'
    };
    // console.log(`options ${JSON.stringify(options)}`);
    async function createMap(container) {
        // Initialise the map
        const style: StyleSpecification = (await import(`./style.json`)) as any;
        const map = new Map({
            fadeDuration: 0,
            validateStyle: false,
            attributionControl: options.hideAttribution
                ? false
                : {
                      compact: true,
                      customAttribution: ['<a href="https://maplibre.org/">MapLibre</a>']
                  },
            container,
            style,
            center: options.position,
            zoom: options.zoom,
            pitch: options.pitch,
            bearing: options.bearing,
            maxPitch: 90
        });
        map.on('styledata', () => {
            const languageFieldName = `name:${options.language}`;
            map?.getStyle()
                ?.layers?.filter((layer) => layer.type === 'symbol' && layer.layout?.['text-field'] === '{name}')
                .forEach(function (layer) {
                    const result = ['coalesce', ['get', languageFieldName], ['get', 'name'], ['get', 'name:latin'], ['get', 'name']];
                    map.setLayoutProperty(layer.id, 'text-field', result);
                });
        });

        return map;
    }
    function mapAction(container) {
        createMap(container).then((map) => {
            if (options.position) {
                const el = document.createElement('div');
                el.className = 'marker';
                new Marker({ element: el }).setLngLat(options.position).addTo(map);
            }
        });
    }

    onDestroy(() => {
        map?.remove();
    });

    //@ts-ignore
    window.getZoom = function () {
        return map.getZoom();
    };
    //@ts-ignore
    window.getParameters = function () {
        return {
            zoom: map.getZoom(),
            mapCenter: map.getCenter()
        };
    };

    //@ts-ignore
    window.updateOption = function (key, value) {
        options[key] = value;
        options = options;
        switch (key) {
            default:
                break;
        }
    };
</script>

<div style="height:100%;width:100%;display:flex;justify-content:center  ">
    <div style="height:100%;width:100%;" class="map" use:mapAction />
</div>
