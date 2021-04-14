<script lang="ts">
    import { MapControls, OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
    require('@nativescript/canvas-three');
    if (global.isAndroid) {
        java.lang.System.loadLibrary('canvasnative');
    }
    import * as THREE from 'three/build/three.module';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
    import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
    import { CustomOutlinePass } from '~/three/CustomOutlinePass';

    import SphericalMercator from '~/three/SphericalMercator';
    import { deslash, getBaseLog, resolveSeams, slashify } from '~/three/utils';
    import { packageService } from '~/services/PackageService';
    import UpdateTilesWorker from '~/workers/UpdateTilesWorker';
    import { createParserWorker } from '~/workers';
    // import type IParseElevationWorker from '~/workers/ParseElevationWorker';
    import { showError } from '~/utils/error';
    import { ImageSource } from '@nativescript/core/image-source';
    import { GC } from '@nativescript/core/utils';
    import { Application } from '@nativescript/core';
    import { HTTPTileDataSource } from '@nativescript-community/ui-carto/datasources/http';

    // const UpdateTileWorker = require('nativescript-worker-loader!~/workers/UpdateTileWorker');
    // calculates which tiles are in view to download
    const updateTileWorker = new UpdateTilesWorker();
    // updateTileWorker.onMessage = () => {};

    let page;
    var basePlaneDimension = 65024;
    var mercator = new SphericalMercator({ size: basePlaneDimension });

    function onNavigatingTo(e) {
        // console.log('onNavigatingTo', page && page.nativeView, e.object);
    }

    let canvas,
        camera: THREE.Camera,
        controls: OrbitControls,
        scene: THREE.Scene,
        walls,
        axis,
        renderer: THREE.WebGLRenderer,
        composer: EffectComposer;

    const meshMaterial = new THREE.MeshNormalMaterial({
        flatShading: false
    });
    let needsUpdate, lastMove;
    var tilesToGet = 0;
    var zoom;
    // const meshMaterial = new THREE.MeshBasicMaterial({
    //     color: 0x000000
    // });
    function render() {
        // if (tilesToGet !== 0) {
        // requestAnimationFrame(render);
        // }
            renderer.render(scene, camera);
        // composer.render();
    }
    function updateCompass(reset, azimuth, pitch) {
        var styling;

        if (reset === true) {
            var currentPos = controls.target;
            camera.position.x = currentPos.x;
            camera.position.z = currentPos.z;
            // controls.setAzimuthalAngle(azimuth * Math.PI / 180);
            // controls.setPolarAngle(pitch * Math.PI / 180);
            controls.autoRotate = false;
            styling = '';
        } else {
            // var angle = (controls.getAzimuthalAngle() * 180) / Math.PI;
            // var pitch = (controls.getPolarAngle() * 180) / Math.PI;
            // styling =
            // "rotateX(" + pitch + "deg) rotateZ(" + angle + "deg)";
        }
        // compass.style["-webkit-transform"] = styling;
        // pivot.style["-webkit-transform"] = styling;
        // pivot.style["display"] = "block";
    }
    function handleControlUpdate() {
        // light1.position.set( camera.position.x, camera.position.y , camera.position.z );
        lastMove = Date.now();
        if (!needsUpdate) {
            needsUpdate = setInterval(function (time) {
                if (Date.now() - lastMove < 150) return;
                else {
                    updateTiles();
                    clearInterval(needsUpdate);
                    needsUpdate = false;
                }
            });
        }
        render();
    }
    function updateTileVisibility() {
        var zoom = Math.floor(getZoom());
        //update tile visibility based on zoom
        for (var s = 0; s < scene.children.length; s++) {
            var child = scene.children[s];
            if (child.zoom === zoom || child.zoom === undefined) child.visible = true;
            else child.visible = false;
        }
    }
    function updateTiles() {
        zoom = Math.floor(getZoom());
        const { imageTiles, elevationTiles } = updateTileWorker.updateTiles({
            zoom: zoom,
            position: { x: controls.object.position.x, y: controls.object.position.z },
            distance: 50,
            fov: camera.getEffectiveFOV() * camera.aspect,
            azimuth: controls.getAzimuthalAngle()
        });
        // console.log('updateTiles done ', imageTiles, elevationTiles);
        var queue = imageTiles.length;

        if (queue > 0) {
            getTiles({ imageTiles, elevationTiles });
            updateTileVisibility();
        }
    }
    const meshCache = {};
    const loadingTile = {};
    // given a list of elevation and imagery tiles, download
    function getTiles({
        imageTiles,
        elevationTiles
    }: {
        imageTiles: [number, number, number][];
        elevationTiles: [number, number, number][];
    }) {
        let tiles = imageTiles.map(function (tile) {
            return slashify(tile);
        }) as string[];

        const current = Object.keys(meshCache);
        current.forEach((k) => {
            if (tiles.indexOf(k) === -1) {
                scene.remove(meshCache[k]);
                delete meshCache[k];
            }
        });
        tiles = tiles.filter((k) => !meshCache[k] && !loadingTile[k]);
        tiles.forEach((k) => (loadingTile[k] = true));

        if (tiles.length === 0) {
            return;
        }
        tilesToGet += tiles.length;
        // render();
        // updaterRequests += imageTiles.length;
        const dataSource = new HTTPTileDataSource({
            url: `http://192.168.1.45:8080/data/BDALTIV2_75M_rvb/{z}/{x}/{y}.png`,
            minZoom: 5,
            maxZoom: 11
        }).getNative();
        // const dataSource = packageService.hillshadeLayer.dataSource.getNative();
        elevationTiles.forEach(function (coords) {
            const k = slashify(coords);

            try {
                const parserIndex = 2 * (coords[1] % 2) + (coords[2] % 2);
                akylas.alpi.maps.Three.getElevationMeshesAsync(
                    Application.android.context,
                    dataSource,
                    JSON.stringify({ coords, tiles, parserIndex }),
                    new akylas.alpi.maps.Three.GetElevationMeshesCallback({
                        onResult: (err, s) => {
                            const data = JSON.parse(s);

                            try {
                                Object.keys(data).forEach((k) => {
                                    makeMesh(data[k], deslash(k));
                                });
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    })
                );
            } catch (err) {
                console.error(err);
            }
            // current.forEach((k) => {
            //     scene.remove(meshCache[k]);
            //     delete meshCache[k];
            // });
            GC();
        });
    }
    function project(lnglat) {
        var px = mercator.px(lnglat, 0);
        return {
            x: px[0] - basePlaneDimension / 2,
            y: 0,
            z: px[1] - basePlaneDimension / 2
        };
    }

    function moveTo(coords, currentHeight) {
        controls.target.copy(coords);
        controls.object.position.copy({
            x: coords.x,
            y: currentHeight,
            z: coords.z
        });
        controls.update();
        // setTimeout(function () {
            // updateTiles();
            // render();
        // }, 10);
    }
    function setCenter(lnglat) {
        var pxCoords = project(lnglat);
        camera.position.x = pxCoords.x;
        camera.position.z = pxCoords.z;
        camera.position.y = 10.629295137280347;

        moveTo(pxCoords, camera.position.y);
        // setTimeout(function () {
            // updateTiles();
        // }, 100);
        // updateCompass(true, 0, 70);
    }
    function getZoom() {
        var pt = controls.target.distanceTo(controls.object.position);
        return Math.min(Math.max(getBaseLog(0.5, pt / 12000) + 4, 0), 13);
    }
    function makeMesh(data: number[], [z, x, y]) {
        const key = slashify([z, x, y]);
        delete loadingTile[key];
        if (meshCache[key]) {
            return;
        }
        // meshes++;
        console.log('makeMesh', data.length, key, [z, x, y], tilesToGet);
        var tileSize = basePlaneDimension / Math.pow(2, z);
        var vertices = 128;
        var segments = vertices - 1;

        tilesToGet--;

        if (tilesToGet === 0) {
            console.log('STABLE');
            updateTileVisibility();
        }
        // }
        // );
        data = resolveSeams(scene, data, [z, x, y]);

        var geometry = new THREE.PlaneBufferGeometry(tileSize, tileSize, segments, segments);
        geometry.attributes.position.array = new Float32Array(data);

        // after only mergeVertices my textrues were turning black so this fixed normals issues
        geometry.computeVertexNormals();

        var plane = new THREE.Mesh(geometry, meshMaterial);
        plane.coords = key;
        meshCache[key] = plane;
        plane.zoom = z;
        scene.add(plane);
        render();
    }
    async function canvasReady(args) {
        canvas = args.object;

        const context = canvas.getContext('webgl2');
        try {
            const { drawingBufferWidth: width, drawingBufferHeight: height } = context;

            //set up scene
            scene = new THREE.Scene();
            // walls = new THREE.LineSegments(
            //     new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(1, 1, 1)),
            //     new THREE.LineBasicMaterial({ color: 0xcccccc })
            // );
            // walls.position.set(0, 0, 0);
            // scene.add(walls);
            // axis = new THREE.AxesHelper(1);
            // scene.add(axis);
            // renderer.shadowMap.enabled = true;
            // renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
            // renderer.setPixelRatio( window.devicePixelRatio );

            //set up camera

            camera = new THREE.PerspectiveCamera(75, width / height, 1 / 99, 100000000000000);
            camera.position.y = 1200;

            // THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);
        // camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        // camera.position.set(0, 3, 1.5);
        // camera.up.set(0, 0, 1); // The up vector is along +z for this app
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
            scene.add(ambientLight);

            // const light1 = new THREE.PointLight( 0xffffff, 1, 0 );
            // scene.add( light1 );

            controls = new MapControls(camera, canvas);
            controls.minPolarAngle = Math.PI * 0.395;
            controls.maxPolarAngle = Math.PI * 0.395;
            controls.addEventListener('change', handleControlUpdate); // use if there is no animation loop
            controls.enableZoom = false;

            // postprocessing
            const depthTexture = new THREE.DepthTexture();
            const renderTarget = new THREE.WebGLRenderTarget(width, height, {
                depthTexture: depthTexture,
                depthBuffer: true
            });
            const composer = new EffectComposer(renderer, renderTarget);
            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            const customOutline = new CustomOutlinePass(new THREE.Vector2(width, height), scene, camera);
            composer.addPass(customOutline);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            //set up renderer
            renderer = new THREE.WebGLRenderer({ context });
            renderer.setSize(width, height);
            // renderer.setPixelRatio(0.5);
            composer.setSize(width, height);

            zoom = getZoom();

            var basePlane = new THREE.PlaneBufferGeometry(basePlaneDimension * 100, basePlaneDimension * 100, 1, 1);

            var mat = new THREE.MeshBasicMaterial({
                wireframe: true,
                opacity: 0
                //transparent: true
            });

            var plane = new THREE.Mesh(basePlane, mat);
            plane.rotation.x = -0.5 * Math.PI;
            plane.opacity = 0;
            scene.add(plane);

            //initial tile load
            // window.setTimeout(function () {
            //     updateCompass(true, 0, 90);
            // }, 500);

            // lngLat to scene coordinates (as intersecting with plane)

            // function onWindowResize() {
            //     camera.aspect = width / height;
            //     camera.updateProjectionMatrix();
            //     renderer.setSize(width, height);
            //     composer.setSize(width, height);
            //     updateTiles();
            // }

            setCenter([5.722387, 45.171547]);
        } catch (err) {
            showError(err);
        }
    }
</script>

<frame backgroundColor="transparent">
    <page bind:this={page} actionBarHidden="true" on:navigatingTo={onNavigatingTo}>
        <ncanvas id="canvas" on:ready={canvasReady} backgroundColor="black"/>
    </page>
</frame>
