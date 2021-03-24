<script lang="ts">
    import { PanGestureEventData, TouchGestureEventData } from '@nativescript/core';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
    require('@nativescript/canvas-three');
    if (global.isAndroid) {
        java.lang.System.loadLibrary('canvasnative');
    }
    const ThreeGeo = require('three-geo/dist/three-geo.esm').default;
    // import TNSTHREE from '@nativescript/canvas-three';
    // import ThreeGeo from 'three-geo/dist/three-geo.esm.compat';
    import * as THREE from 'three';
import { GeoLocation } from '~/handlers/GeoHandler';

    let page;

    function onNavigatingTo(e) {
        // console.log('onNavigatingTo', page && page.nativeView, e.object);
    }
    let canvas;
    let camera, scene, renderer, controls;
    let walls, wireframeMat, axis;
    let terrain, tgeo;

    function render() {
        renderer.render(scene, camera);
    }
    async function canvasReady(args) {
        canvas = args.object;
        const context = canvas.getContext('webgl2');

        const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
        THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);

        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 3, 1.5);
        // camera.up.set(0, 0, 1); // The up vector is along +z for this app
        controls = new OrbitControls(camera, canvas);
        // controls.maxPolarAngle = Math.PI * 0.495;
        // controls.target.set(0, 10, 0);
        // controls.minDistance = 40.0;
        // controls.maxDistance = 200.0;
        controls.update();
        controls.addEventListener('change', render); // use if there is no animation loop
        controls.enableZoom = false;
        // controls.enablePan = true;
        // controls.target.set(0, 0, -0.2);
        controls.update();
        scene = new THREE.Scene();
        walls = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({ color: 0xcccccc })
        );
        walls.position.set(0, 0, 0);
        wireframeMat = new THREE.MeshBasicMaterial({
            wireframe: true,
            color: 0x999999,
        });
        scene.add(walls);
        axis = new THREE.AxesHelper(1);
        scene.add(axis);
        renderer = new THREE.WebGLRenderer({ context });
        renderer.setSize(width, height);
        render();
        updateGeo();
        // animate();
    }

    export let position: GeoLocation;
    async function updateGeo() {
        try {
            tgeo = new ThreeGeo({
                tokenMapbox: gVars.MAPBOX_TOKEN, // <---- set your Mapbox API token here
                useNodePixels: true
            });
            terrain = await tgeo.getTerrainVector(
                [position.lat, position.lon], // [lat, lng]
                2.0, // radius of bounding circle (km)
                12
            ); // zoom resolution
            // terrain.rotation.x = - Math.PI/2;
            // terrain.children.forEach(mesh => {
            //     mesh.material = wireframeMat;
            // });
            scene.add(terrain);

            render();
        } catch (err) {
            console.error('updateGeo', err);
        }
    }
</script>

<frame backgroundColor="transparent">
    <page bind:this={page} actionBarHidden="true" on:navigatingTo={onNavigatingTo}>
        <ncanvas id="canvas" on:ready={canvasReady} />
    </page>
</frame>
