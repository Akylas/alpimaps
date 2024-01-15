<script context="module" lang="ts">
    require('@nativescript/canvas-polyfill');
    if (global.isAndroid) {
        java.lang.System.loadLibrary('canvasnative');
    }
    import { AdditiveTweening } from 'additween';
    import CameraControls from 'camera-controls';
    import { MapView } from 'geo-three/source/MapView';
    import { LODFrustum } from 'geo-three/source/lod/LODFrustum';
    import { MapNode, clearCacheRecursive, getNode } from 'geo-three/source/nodes/MapNode';
    import { DebugProvider } from 'geo-three/source/providers/DebugProvider';
    import { UnitsUtils } from 'geo-three/source/utils/UnitsUtils';
    import { EmptyProvider } from 'geo-three/webapp/EmptyProvider';
    import { LocalHeightProvider } from 'geo-three/webapp/LocalHeightProvider';
    import { MaterialHeightShader, customDepthMaterial, featuresByColor, getImageData, getPixel, sharedMaterial, sharedPointMaterial } from 'geo-three/webapp/MaterialHeightShader';
    import { SunLight } from 'geo-three/webapp/SunLight';
    import RasterMapProvider from 'geo-three/webapp/TestMapProvider';
    import { BlendFunction, Effect, EffectAttribute, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
    import {
        AmbientLight,
        Box3,
        Clock,
        Color,
        DirectionalLightHelper,
        Euler,
        MOUSE,
        MathUtils,
        Matrix4,
        NearestFilter,
        PCFSoftShadowMap,
        PerspectiveCamera,
        Quaternion,
        Raycaster,
        Scene,
        Sphere,
        Spherical,
        Texture,
        Uniform,
        Vector2,
        Vector3,
        Vector4,
        WebGLRenderTarget,
        WebGLRenderer
    } from 'three';
    import { Sky } from 'three/examples/jsm/objects/Sky';
    // import RenderTargetHelper from 'three-rt-helper';
    import { pointToTileFraction, tileToBBOX } from '@mapbox/tilebelt';
    import { MultiTileDataSource, TileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { MBTilesTileDataSource } from '@nativescript-community/ui-carto/datasources/mbtiles';
    import { debounce, throttle } from '@nativescript/core/utils';
    import { isMobile, settings } from 'geo-three/webapp/settings';
    import { showError } from '~/utils/error';
</script>

<script lang="ts">
    export let terrarium: boolean = false;
    // export let dataSource: TileDataSource<any, any>;
    // export let vectorDataSource: MBTilesTileDataSource | MultiTileDataSource<any, any>;
    // export let rasterDataSource: TileDataSource<any, any>;
    export let position;
    export let bearing;
    let page;
    let canvas;
    function onNavigatingTo(e) {
        // console.log('onNavigatingTo', page && page.nativeView, e.object);
    }

    const TO_RAD = Math.PI / 180;
    const PI_DIV4 = Math.PI / 4;
    const PI_X2 = Math.PI * 2;
    const TO_DEG = 180 / Math.PI;

    const queryParams = new URLSearchParams(window.location.search);
    queryParams.forEach((value, k) => {
        try {
            settings[k] = JSON.parse(value);
        } catch (err) {
            settings[k] = value;
        }
    });

    function updateShadowMapEnabled() {
        renderer.shadowMap.enabled = sharedMaterial.uniforms.drawShadows.value = settings.shadows && settings.dayNightCycle;
    }
    export function toggleSetting(key): void {
        setSettings(key, !settings[key]);
    }

    let settingsChangedListener;
    export function setOnSettingsChangedListener(value) {
        settingsChangedListener = value;
    }

    export function setSettings(key, value, shouldRender = true, param2 = true): void {
        try {
            // console.log('setSettings', key, value, settings.hasOwnProperty(key), window, this);
            if (!settings.hasOwnProperty(key)) {
                const func = this[key];
                if (typeof func === 'function') {
                    func(value, shouldRender, param2);
                }
            }
            const oldValue = settings[key];
            if (key === 'elevation') {
                if (typeof value === 'string') {
                    value = parseFloat(value);
                }
                if (currentGroundElevation !== undefined && value < currentGroundElevation) {
                    value = currentGroundElevation;
                }
            }

            if (canCreateMap && oldValue === value) {
                return;
            }
            settings[key] = value;

            let labelValue = value;
            switch (key) {
                case 'terrarium':
                    if (value) {
                        settings.elevationDecoder = [256 * 255, 1 * 255, (1 / 256) * 255, -32768];
                    } else {
                        settings.elevationDecoder = [6553.6 * 255, 25.6 * 255, 0.1 * 255, -10000];
                    }
                    // if (map)
                    // {
                    sharedMaterial.uniforms.elevationDecoder.value = settings.elevationDecoder;
                    customDepthMaterial.uniforms.elevationDecoder.value = settings.elevationDecoder;
                    break;

                case 'dayNightCycle': {
                    if (!sky) {
                        sky = createSky();
                        sunLight = new SunLight(new Vector2(45.05, 5.47), new Vector3(0.0, 0.0, -1.0), new Vector3(1.0, 0.0, 0.0), new Vector3(0.0, -1.0, 0.0), 2.0);
                        // Adjust the directional light's shadow camera dimensions
                        sunLight.shadow.bias = -0.0002;
                        sunLight.shadow.mapSize.width = 8192;
                        sunLight.shadow.mapSize.height = 8192;
                        sunLight.shadow.camera.left = -1;
                        sunLight.shadow.camera.right = 1;
                        sunLight.shadow.camera.top = 0.1;
                        sunLight.shadow.camera.bottom = -0.5;
                        sunLight.shadow.camera.near = 0.1;
                        sunLight.shadow.camera.far = 5;
                        scene.add(sky);
                        scene.add(sunLight as any);
                        scene.add(sunLight.target);
                        // directionalLightHelper = new DirectionalLightHelper(sunLight, 0.02, 0xff0000);
                        // scene.add(directionalLightHelper);
                        controls.getPosition(tempVector);
                        sunLight.setWorldPosition(tempVector);
                        // const helper = new CameraHelper( sunLight.shadow.camera );
                        // scene.add( helper );

                        const date = new Date();
                        const hours = Math.floor(settings.secondsInDay / 3600);
                        const minutes = Math.floor((settings.secondsInDay - hours * 3600) / 60);
                        const seconds = settings.secondsInDay - hours * 3600 - minutes * 60;
                        date.setHours(hours);
                        date.setMinutes(minutes);
                        date.setSeconds(seconds);
                        sunLight.setDate(date);
                    }
                    updateSky();
                    updateSkyPosition();
                    sharedMaterial.uniforms.computeNormals.value = shouldComputeNormals();
                    updateShadowMapEnabled();
                    break;
                }
                case 'shadows': {
                    updateShadowMapEnabled();
                    break;
                }
                case 'drawTexture': {
                    sharedMaterial.uniforms.drawTexture.value = shouldDrawTextures();
                    break;
                }

                case 'elevation': {
                    controls.getPosition(tempVector);
                    const scale = MaterialHeightShader.scaleRatio;
                    controls.moveTo(tempVector.x, value * settings.exageration * scale, tempVector.z);
                    if (shouldRender) {
                        updateControls();
                        shouldRender = false;
                    }
                    break;
                }
                case 'secondsInDay': {
                    const date = new Date();
                    const hours = Math.floor(value / 3600);
                    const minutes = Math.floor((value - hours * 3600) / 60);
                    const seconds = value - hours * 3600 - minutes * 60;
                    date.setHours(hours);
                    date.setMinutes(minutes);
                    date.setSeconds(seconds);
                    if (sunLight) {
                        sunLight.setDate(date);
                        // controls.getPosition(tempVector);
                        // sunLight.setWorldPosition(tempVector);
                        // sunLight.target.position.set(tempVector.x, 0, tempVector.z);
                        updateAmbientLight();
                    }
                    labelValue = date.toLocaleString();

                    updateSkyPosition();
                    break;
                }
                case 'dark': {
                    document.body.style.backgroundColor = settings.dark ? 'black' : 'white';
                    outlineEffect.uniforms.get('outlineColor').value.set(settings.dark ? 0xffffff : 0x000000);
                    // cameraButton.style.backgroundColor = compass.style.backgroundColor = !settings.dark ? 'white' : 'black';
                    break;
                }
                case 'outline': {
                    outlinePass.enabled = !withoutOutline();
                    mainPass.renderToScreen = !outlinePass.enabled;
                    break;
                }
                case 'near': {
                    camera.near = settings.near * worldScale;
                    break;
                }
                case 'far': {
                    const scale = MaterialHeightShader.scaleRatio;
                    camera.far = settings.far * scale;
                    camera.updateProjectionMatrix();
                    updateCurrentViewingDistance();

                    sharedPointMaterial.uniforms.cameraNear.value = camera.near;
                    sharedPointMaterial.uniforms.cameraFar.value = camera.far;
                    break;
                }
                case 'readFeatures': {
                    // featuresDrawingCanvas.style.visibility = settings.readFeatures ? 'visible' : 'hidden';
                    break;
                }
                case 'exageration': {
                    sharedMaterial.uniforms.displacementScale.value = settings.exageration;
                    sharedMaterial.uniforms.normalLength.value = 30.0 / settings.exageration;
                    customDepthMaterial.uniforms.displacementScale.value = settings.exageration;
                    sharedPointMaterial.uniforms.exageration.value = settings.exageration;
                    break;
                }
                case 'depthBiais':
                case 'outlineStroke':
                case 'depthMultiplier':
                case 'depthPostMultiplier': {
                    outlineEffect.uniforms.get('multiplierParameters').value.set(settings.depthBiais, settings.depthMultiplier, settings.depthPostMultiplier, settings.outlineStroke);
                    break;
                }
                case 'wireframe': {
                    sharedMaterial.wireframe = settings.wireframe;
                    break;
                }
                case 'debugFeaturePoints': {
                    if (map) {
                        applyOnNodes((node) => {
                            node.objectsHolder.visible = settings.debugFeaturePoints && (node.isVisible() || (node.level === map.maxZoomForPeaks && node.parentNode.subdivided));
                        });
                    }
                    break;
                }
                case 'computeNormals': {
                    updateSky();
                    sharedMaterial.uniforms.computeNormals.value = shouldComputeNormals();
                    break;
                }
                case 'drawNormals': {
                    sharedMaterial.uniforms.computeNormals.value = shouldComputeNormals();
                    sharedMaterial.uniforms.drawNormals.value = settings.drawNormals;
                    sharedMaterial.uniforms.drawTexture.value = shouldDrawTextures();
                    break;
                }
                case 'rasterProviderZoomDelta':
                case 'flipRasterImages':
                case 'mapMap': {
                    outlinePass.enabled = !withoutOutline();
                    mainPass.renderToScreen = !outlinePass.enabled;
                    updateSky();
                    updateAmbientLight();
                    sharedMaterial.uniforms.computeNormals.value = shouldComputeNormals();
                    sharedMaterial.uniforms.drawTexture.value = shouldDrawTextures();
                    if (map) {
                        map.provider = createProvider();
                        if (value) {
                            updateVisibleNodesImage('map');
                        }
                        if (shouldRender) {
                            onControlUpdate();
                        }
                    }
                    break;
                }
                case 'geometrySize': {
                    if (map && shouldRender) {
                        createMap();
                        updateLODThrottle();
                        requestRenderIfNotRequested(true);
                        shouldRender = false;
                    }
                    break;
                }
                case 'maxZoomForPeaks': {
                    if (map && shouldRender) {
                        createMap();
                        updateLODThrottle();
                        requestRenderIfNotRequested(true);
                        shouldRender = false;
                    }
                    break;
                }
                case 'generateColor': {
                    sharedMaterial.uniforms.computeNormals.value = shouldComputeNormals();
                    sharedMaterial.uniforms.generateColor.value = settings.generateColor;
                    sharedMaterial.uniforms.drawTexture.value = (settings.debug || settings.mapMap || settings.generateColor) && settings.drawTexture;
                    updateAmbientLight();
                    break;
                }
                case 'fovFactor': {
                    camera.fov = cameraFOV = getCameraFOV();
                    camera.updateProjectionMatrix();
                    break;
                }
                case 'debug': {
                    outlinePass.enabled = !withoutOutline();
                    mainPass.renderToScreen = !outlinePass.enabled;
                    updateSky();

                    sharedMaterial.uniforms.computeNormals.value = shouldComputeNormals();
                    sharedMaterial.uniforms.drawTexture.value = (settings.debug || settings.mapMap || settings.generateColor) && settings.drawTexture;
                    if (map) {
                        map.provider = createProvider();
                        if (value) {
                            updateVisibleNodesImage('debug');
                        }
                        if (shouldRender) {
                            onControlUpdate();
                        }
                    }
                    break;
                }
            }
            if (shouldRender) {
                requestRenderIfNotRequested();
            }
            if (settingsChangedListener) {
                settingsChangedListener(key, value);
            }
            // console.log('setSeettings done', key);
        } catch (err) {
            console.error(err.toString() + ' ' + err.stack);
        }
    }

    export function stopEventPropagation(event) {
        if (event.stopPropagation) {
            event.stopPropagation();
        } else if (window.event) {
            window.event.cancelBubble = true;
        }
    }

    function getURLParameter(name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
    }
    class CameraControlsWithOrientation extends CameraControls {
        screenOrientation: number = 0;

        deviceOrientation: DeviceOrientationEvent = {} as any;

        deviceOrientationEnabled = false;

        orientationAzimuth = 0;

        orientationPolar = 0;

        alphaOffsetAngle = 0;

        betaOffsetAngle = 0;

        gammaOffsetAngle = 0;

        onDeviceOrientationChangeEventBound;

        updateDeviceOrientationQuaternion() {
            const alpha = this.deviceOrientation.alpha ? this.deviceOrientation.alpha * TO_RAD + this.alphaOffsetAngle : 0; // Z
            const beta = this.deviceOrientation.beta ? this.deviceOrientation.beta * TO_RAD + this.betaOffsetAngle : 0; // X'
            const gamma = this.deviceOrientation.gamma ? this.deviceOrientation.gamma * TO_RAD + this.gammaOffsetAngle : 0; // Y''
            const orient = this.screenOrientation ? this.screenOrientation * TO_RAD : 0; // O

            // if (this.screenOrientation % 180 === 0)
            // {
            // 	if (Math.abs(this.deviceOrientation.beta) < 10 && Math.abs(this.deviceOrientation.gamma) > 80)
            // 	{
            // 		wrongOrientation = true;
            // 	}
            // 	else
            // 	{
            // 		wrongOrientation = false;
            // 	}
            // }

            this.setObjectQuaternion(this._camera.quaternion, alpha, beta, gamma, orient);
            this._camera.getWorldDirection(this.wordVec);
            this.orientationAzimuth = Math.atan2(this.wordVec.x, this.wordVec.z) + Math.PI;
            this.orientationPolar = Math.atan2(this.wordVec.z, this.wordVec.y) + Math.PI;
        }

        onDeviceOrientationChangeEvent(event) {
            this.deviceOrientation = event;
            this.updateDeviceOrientationQuaternion();
            this.dispatchEvent({
                type: 'update',
                originalEvent: event
            });
        }

        onScreenOrientationChangeEventBound;

        onCompassNeedsCalibrationEventBound;

        onCompassNeedsCalibrationEvent() {
            DEV_LOG && console.log('onCompassNeedsCalibrationEvent');
        }

        onScreenOrientationChangeEvent(event) {
            this.screenOrientation = (window.orientation as any) || 0;
            this.dispatchEvent({
                type: 'control',
                originalEvent: event
            });
        }

        startDeviceOrientation() {
            if (this.deviceOrientationEnabled) {
                return;
            }
            this.deviceOrientationEnabled = true;
            this.screenOrientation = (window.orientation as any) || 0;
            this.onDeviceOrientationChangeEventBound = this.onDeviceOrientationChangeEvent.bind(this);
            this.onScreenOrientationChangeEventBound = this.onScreenOrientationChangeEvent.bind(this);
            this.onCompassNeedsCalibrationEventBound = this.onCompassNeedsCalibrationEvent.bind(this);

            window.addEventListener('orientationchange', this.onScreenOrientationChangeEventBound, false);
            if ('ondeviceorientationabsolute' in window) {
                window.addEventListener('deviceorientationabsolute', this.onDeviceOrientationChangeEventBound, false);
            } else {
                window.addEventListener('deviceorientation', this.onDeviceOrientationChangeEventBound, false);
            }
            window.addEventListener('compassneedscalibration', this.onCompassNeedsCalibrationEventBound, false);
        }

        stopDeviceOrientation() {
            if (!this.deviceOrientationEnabled) {
                return;
            }
            this.deviceOrientationEnabled = false;
            this.rotateTo(this.orientationAzimuth, this.orientationPolar);
            window.removeEventListener('orientationchange', this.onScreenOrientationChangeEventBound, false);
            if ('ondeviceorientationabsolute' in window) {
                window.removeEventListener('deviceorientationabsolute', this.onDeviceOrientationChangeEventBound, false);
            } else {
                window.removeEventListener('deviceorientation', this.onDeviceOrientationChangeEventBound, false);
            }
            window.addEventListener('compassneedscalibration', this.onCompassNeedsCalibrationEventBound, false);
        }

        zee = new Vector3(0, 0, 1);

        euler = new Euler();

        q0 = new Quaternion();

        q1 = new Quaternion();

        wordVec = new Vector3();

        setObjectQuaternion(quaternion, alpha, beta, gamma, orient) {
            this.q0.identity();
            this.q1.set(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis
            this.euler.set(beta, alpha, -gamma, 'YXZ'); // 'ZXY' for the device, but 'YXZ' for us
            quaternion.setFromEuler(this.euler); // orient the device
            quaternion.multiply(this.q1); // camera looks out the back of the device, not the top
            quaternion.multiply(this.q0.setFromAxisAngle(this.zee, -orient)); // adjust for screen orientation
        }

        rotate(azimuthAngle: number, polarAngle: number, enableTransition?: boolean) {
            if (this.deviceOrientationEnabled) {
                this.updateAlphaOffsetAngle(this.alphaOffsetAngle + azimuthAngle);
                this.updateBetaOffsetAngle(this.betaOffsetAngle + polarAngle);
            } else {
                return super.rotate(azimuthAngle, polarAngle, enableTransition);
            }
        }

        trucking = false;

        truck(x: number, y: number, enableTransition?: boolean) {
            this.trucking = true;
            return super.truck(x, y, enableTransition);
        }

        zooming = false;

        zoom(zoomStep: number, enableTransition?: boolean) {
            this.zooming = true;
            return super.zoom(zoomStep, enableTransition);
        }

        zoomTo(zoom: number, enableTransition?: boolean) {
            this.zooming = true;
            return super.zoomTo(zoom, enableTransition);
        }

        ignoreUpdateDispatch = false;

        dispatchEvent(event) {
            if (this.ignoreUpdateDispatch && event.type === 'update') {
                return;
            }
            super.dispatchEvent(event);
            if (event.type === 'update') {
                this.trucking = false;
                this.zooming = false;
            }
        }

        update(delta: number) {
            if (this.deviceOrientationEnabled) {
                this.ignoreUpdateDispatch = true;
                super.update(delta);
                this.updateDeviceOrientationQuaternion();
                this.ignoreUpdateDispatch = false;
                this.dispatchEvent({
                    type: 'update',
                    originalEvent: null
                });
                return true;
            } else {
                return super.update(delta);
            }
        }

        updateAlphaOffsetAngle(angle) {
            this.alphaOffsetAngle = angle;
        }

        updateBetaOffsetAngle(angle) {
            this.betaOffsetAngle = angle;
        }

        updateGammaOffsetAngle(angle) {
            this.gammaOffsetAngle = angle;
        }

        dispose() {
            this.stopDeviceOrientation();
            super.dispose();
        }
    }

    class CustomOutlineEffect extends Effect {
        public declare uniforms: Map<string, any>;

        constructor() {
            super(
                'CustomOutlineEffect',
                `
uniform vec3 weights;
uniform vec3 outlineColor;
uniform vec4 multiplierParameters;

float readZDepth(vec2 uv) {
	return viewZToOrthographicDepth( getViewZ(readDepth(uv)), cameraNear, cameraFar );
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
	float zdepth = viewZToOrthographicDepth( getViewZ(depth), cameraNear, cameraFar );
	vec3 offset = vec3( texelSize * multiplierParameters.w, 0.0 );
	float depthDiff = abs(zdepth - readZDepth(uv + offset.xz))
					+ abs(zdepth - readZDepth(uv - offset.xz))
					+ abs(zdepth - readZDepth(uv + offset.zy))
					+ abs(zdepth - readZDepth(uv - offset.zy));
	depthDiff = depthDiff * multiplierParameters.y;
	depthDiff = pow(depthDiff, multiplierParameters.x);
	// depthDiff = depthDiff * multiplierParameters.z;
	vec4 outlineColor = vec4(outlineColor, depthDiff);
	outputColor = vec4(mix(inputColor, outlineColor, depthDiff));
}
`,
                {
                    attributes: EffectAttribute.DEPTH,
                    blendFunction: BlendFunction.AVERAGE,
                    uniforms: new Map([
                        ['outlineColor', new Uniform(new Color(settings.dark ? 0xffffff : 0x000000))],
                        ['multiplierParameters', new Uniform(new Vector4(settings.depthBiais, settings.depthMultiplier, settings.depthPostMultiplier, settings.outlineStroke))]
                    ] as any)
                }
            );
        }
    }

    CameraControls.install({
        THREE: {
            MOUSE,
            Vector2,
            Vector3,
            Vector4,
            Quaternion,
            Matrix4,
            Spherical,
            Box3,
            Sphere,
            Raycaster,
            MathUtils: {
                DEG2RAD: MathUtils.DEG2RAD,
                clamp: MathUtils.clamp
            }
        }
    });
    // console.log('isMobile', isMobile, navigator.userAgent);
    const devicePixelRatio = window.devicePixelRatio;
    // console.log('isMobile ' + isMobile + ' ' + devicePixelRatio + ' ' + navigator.userAgent);
    let featuresToShow = [];
    const tempVector = new Vector3(0, 0, 0);
    export let currentViewingDistance = 0;

    let currentPositionAltitude = -1;
    let currentPosition: { lat: number; lon: number; altitude?: number };
    let needsCurrentPositionElevation = false;
    let currentGroundElevation;
    const clock = new Clock();
    let selectedItem = null;
    let map: MapView;
    const EPS = 1e-5;
    let pixelsBuffer;
    const TEXT_HEIGHT = 170;

    const showingCamera = false;
    // let showMagnify = false;
    let mousePosition = null;

    let animating = false;
    // Setup the animation loop.
    let viewWidth = window.innerWidth;
    let viewHeight = window.innerHeight;
    let offWidth = window.innerWidth;
    let offHeight = window.innerHeight;
    let rendererScaleRatio = 1;
    let renderRequested = false;
    let renderForceComputeFeatures = false;
    let sized = false;
    let canCreateMap = true;

    const renderer = new WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
        // depth: false,
        stencil: false
    });
    renderer['physicallyCorrectLights'] = true;
    // renderer.debug.checkShaderErrors = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.shadowMap.enabled = false;
    // const magnify3d = new Magnify3d();
    // const magnify3dTarget = new WebGLRenderTarget(0, 0);

    renderer.setClearColor(0x000000, 0);

    // const rendererMagnify = new WebGLRenderer({
    // 	canvas: document.getElementById('canvas5') as HTMLCanvasElement,
    // 	// logarithmicDepthBuffer: true,
    // 	antialias: AA,
    // 	alpha: true,
    // 	powerPreference: 'high-performance',
    // 	stencil: false,
    // 	depth: false
    // 	// precision: isMobile ? 'mediump' : 'highp'
    // });

    const pointBufferTarget = new WebGLRenderTarget(100, 100, {
        generateMipmaps: false,
        stencilBuffer: false,
        depthBuffer: false,
        minFilter: NearestFilter,
        magFilter: NearestFilter
    });
    let renderTargetHelper;
    const composer = new EffectComposer(renderer, {});

    export function shouldComputeNormals() {
        return settings.computeNormals || settings.drawNormals || settings.generateColor || ((settings.debug || settings.mapMap || settings.shadows) && settings.dayNightCycle);
    }
    export function shouldDrawTextures() {
        return (settings.debug || settings.mapMap || settings.generateColor) && settings.drawTexture;
    }

    export function shouldRenderSky() {
        return settings.dayNightCycle;
    }

    function createSky() {
        if (sky) {
            return;
        }
        // Add Sky
        sky = new Sky();
        sky.scale.setScalar(1e8);

        // GUI
        const effectController = {
            turbidity: 0,
            rayleigh: 0.5,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.7,
            inclination: 0.48,
            azimuth: 0.25,
            exposure: renderer.toneMappingExposure
        };

        const uniforms = sky.material.uniforms;
        uniforms['turbidity'].value = effectController.turbidity;
        uniforms['rayleigh'].value = effectController.rayleigh;
        uniforms['mieCoefficient'].value = effectController.mieCoefficient;
        uniforms['mieDirectionalG'].value = effectController.mieDirectionalG;

        const theta = Math.PI * (effectController.inclination - 0.5);
        const phi = 2 * Math.PI * (effectController.azimuth - 0.5);

        const sun = new Vector3();
        sun.x = Math.cos(phi);
        sun.y = Math.sin(phi) * Math.sin(theta);
        sun.z = Math.sin(phi) * Math.cos(theta);
        uniforms['sunPosition'].value.copy(sun);

        return sky;
    }

    const scene = new Scene();

    export function toggleDeviceSensors() {
        // if (EXTERNAL_APP)
        // {
        // 	emitNSEvent('sensors', !controls.deviceOrientationEnabled);
        // }
        // if (controls.deviceOrientationEnabled)
        // {
        // 	controls.stopDeviceOrientation();
        // 	// setElevation(elevation, true);
        // 	controls.polarAngle = Math.PI / 2;
        // }
        // else
        // {
        // 	controls.startDeviceOrientation();
        // }
    }
    export function startCam() {
        // if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        // {
        // 	const constraints = {video: {width: 1280, height: 720, facingMode: 'environment'}};
        // 	navigator.mediaDevices
        // 		.getUserMedia(constraints)
        // 		.then(function(stream)
        // 		{
        // 			// apply the stream to the video element used in the texture
        // 			showingCamera = true;
        // 			video.style.visibility = 'visible';
        // 			video.srcObject = stream;
        // 			video.onloadedmetadata = function(e)
        // 			{
        // 				video.play();
        // 			};
        // 			toggleDeviceSensors();
        // 		})
        // 		.catch(function(error)
        // 		{
        // 			console.error('Unable to access the camera/webcam.', error);
        // 		});
        // }
        // else
        // {
        // 	console.error('MediaDevices interface not available.');
        // }
    }

    let lastMode;
    function updateVisibleNodesImage(mode) {
        const hasChanged = lastMode !== mode;
        lastMode = mode;
        applyOnNodes((node: MapNode) => {
            const userData = MaterialHeightShader.useSharedShader ? node.userData : node.material['userData'];
            if (node.isVisible() && (hasChanged || !(userData.map && userData.map.value))) {
                userData.map.value = null;
                node.isTextureReady = false;
                node.initialize();
            }
        });
    }

    function updateSky() {
        updateAmbientLight();
        if (!sky) {
            return;
        }
        sunLight.visible = shouldRenderSky();
        sky.visible = shouldRenderSky();
    }
    let directionalLightHelper: DirectionalLightHelper;

    export function toggleCamera() {
        // if (showingCamera)
        // {
        // 	video.pause();
        // 	// @ts-ignore
        // 	video.srcObject.getTracks().forEach(function(track)
        // 	{
        // 		track.stop();
        // 	});
        // 	showingCamera = false;
        // 	video.style.visibility = 'hidden';
        // 	toggleDeviceSensors();
        // }
        // else
        // {
        // 	startCam();
        // }
    }
    // export function setMousPosition(x, y)
    // {
    // 	mousePosition = new Vector2(x, y);
    // 	render(true);
    // }

    // let datelabel, viewingDistanceLabel, selectedPeakLabel, selectedPeakDiv, dateSlider, cameraCheckbox;

    // const compass = document.getElementById('compass') as HTMLDivElement;
    // const compassSlice = document.getElementById('compass_slice') as HTMLDivElement;
    // const compassLabel = document.getElementById('compass_label') as HTMLLabelElement;
    // const cameraButton = document.getElementById('camera_button');
    // if (cameraButton)
    // {
    // 	cameraButton.style.visibility = FORCE_MOBILE || isMobile?'visible':'hidden';
    // }

    // if (!EXTERNAL_APP)
    // {
    // 	Object.keys(settings).forEach((key) =>
    // 	{
    // 		const element = document.getElementById(key);
    // 		if (!element)
    // 		{
    // 			return;
    // 		}
    // 		if ( element['type'] === 'checkbox')
    // 		{
    // 			checkBoxes[key] = element as HTMLInputElement;
    // 			checkBoxes[key].onchange = (event: any) => { return setSettings(key, event.target.checked); };
    // 			checkBoxes[key].checked = settings[key] as any;
    // 		}
    // 		else if ( element['type'] === 'range')
    // 		{
    // 			sliders[key] = element as HTMLInputElement;
    // 			sliders[key].oninput = (event: any) => { return setSettings(key, event.target.value); };
    // 			sliders[key].value = settings[key] as any;

    // 			let labelElement = document.getElementById(key+'Label');
    // 			if (labelElement)
    // 			{
    // 				labels[key] = labelElement as HTMLLabelElement;
    // 			}
    // 		}
    // 	});

    // 	// cameraCheckbox = document.getElementById('camera') as HTMLInputElement;
    // 	// cameraCheckbox.onchange = (event: any) => { return toggleCamera(); };
    // 	// cameraCheckbox.value = showingCamera as any;

    // 	selectedPeakLabel = document.getElementById('selectedPeakLabel') as HTMLLabelElement;
    // 	selectedPeakDiv = document.getElementById('selectedPeak') as HTMLDivElement;
    // }

    // const hammertime = new Hammer(canvas);
    // hammertime.on('tap', function(event)
    // {
    // 	mousePosition = new Vector2(event.center.x, event.center.y);
    // 	requestRenderIfNotRequested(true);
    // });
    export let heightProvider: LocalHeightProvider;
    // const heightProvider = new LocalHeightTerrainProvider(devLocal);

    const updateLODThrottle = debounce(function (force = false) {
        if (!sized || !map || !currentPosition) {
            return;
        }
        map.lod.updateLOD(map, camera, renderer, scene, force);
    }, 200);

    function updateCompass() {
        // if (compass)
        // {
        // 	let angle;
        // 	if (controls.deviceOrientationEnabled)
        // 	{
        // 		angle = controls.orientationAzimuth * TO_DEG % 360;
        // 	}
        // 	else
        // 	{
        // 		angle = controls.azimuthAngle * TO_DEG % 360;
        // 	}
        // 	if (compassLabel)
        // 	{
        // 		compassLabel.innerText = angle.toFixed() + '°';
        // 	}
        // 	const hFOV = cameraFOV * viewWidth / viewHeight;
        // 	compassSlice.style.backgroundImage = `conic-gradient(transparent 0deg,transparent ${180 - hFOV / 2}deg, #15BFCC ${180 - hFOV / 2}deg, #15BFCC ${180 + hFOV / 2}deg, transparent ${180 + hFOV / 2}deg)`;
        // 	compassSlice.style.transform = `rotateZ(${-angle - 180}deg)`;
        // }
    }
    function onControlUpdate(forceLOD = false) {
        controls.getPosition(tempVector);
        updateLODThrottle(forceLOD);
        updateCompass();
        requestRenderIfNotRequested();
    }
    function setupLOD() {
        const scale = MaterialHeightShader.scaleRatio;
        heightProvider.maxOverZoom = 0;

        lod.subdivideDistance = 60 * scale;
        lod.simplifyDistance = 160 * scale;
    }
    const lod = new LODFrustum();
    function createProvider() {
        let provider;
        if (settings.mapMap) {
            provider = new RasterMapProvider(settings.local);
            provider.zoomDelta = settings.rasterProviderZoomDelta;
        } else if (settings.debug) {
            provider = new DebugProvider();
        } else {
            provider = new EmptyProvider();
        }
        provider.minZoom = 5;
        provider.maxZoom = heightProvider.maxZoom + heightProvider.maxOverZoom;
        provider.minLevelForZoomDelta = 11;
        return provider;
    }

    function onNodeReady(node: MaterialHeightShader) {
        requestRenderIfNotRequested();
        if (currentPosition && needsCurrentPositionElevation && node.level > heightProvider.maxZoom - 3) {
            const tileBox = tileToBBOX([node.x, node.y, node.level]);
            // console.log('onNodeReady', node.level, node.x, node.y, tileBox, currentPosition, map.provider['buildURL'](node.level, node.x, node.y) );
            if (currentPosition.lat >= tileBox[1] && currentPosition.lat <= tileBox[3] && currentPosition.lon >= tileBox[0] && currentPosition.lon <= tileBox[2]) {
                updateCurrentMinElevation(currentPosition, node);
            }
            // lon 	bbox[0] + (bbox[2] - bbox[0])/2
        }
    }
    function createMap() {
        if (!canCreateMap) {
            return;
        }
        if (map !== undefined) {
            scene.remove(map);
            clearCacheRecursive(map.root);
        }
        heightProvider = new LocalHeightProvider(settings.local);
        setSettings('terrarium', heightProvider.terrarium, false);
        setupLOD();
        const provider = createProvider();
        map = new MapView(null, provider, heightProvider, false, onNodeReady);
        // map.lowMemoryUsage = isMobile;
        map.lowMemoryUsage = true;
        map.maxZoomForPeaks = settings.maxZoomForPeaks;
        map.setRoot(new MaterialHeightShader(null, map, MapNode.root, 0, 0, 0));
        map.lod = lod;
        map.updateMatrixWorld(true);
        scene.add(map);
    }

    let orientation = (screen.orientation || {}).type;

    function getCameraFOV() {
        const scale = viewWidth > viewHeight ? viewHeight / viewWidth : viewWidth / viewHeight;
        return (/landscape/.test(orientation) ? scale : 1) * settings.fovFactor;
    }

    let cameraFOV = getCameraFOV();
    const worldScale = MaterialHeightShader.scaleRatio;
    const camera = new PerspectiveCamera(cameraFOV, viewWidth / viewHeight, settings.near * worldScale, settings.far * worldScale);
    window.addEventListener(
        'orientationchange',
        function (event: any) {
            orientation = event.target.screen.orientation.type;
            camera.fov = cameraFOV = getCameraFOV();
            // const hFOV = cameraFOV * viewWidth / viewHeight;
            camera.updateProjectionMatrix();
            controls.azimuthRotateSpeed = controls.polarRotateSpeed = cameraSpeedFactor() / zoom; // negative value to invert rotation direction
            updateCompass();
        },
        false
    );
    camera.position.set(0, 0, EPS);

    const controls = new CameraControlsWithOrientation(camera, canvas);

    function updateControls() {
        controls.update(1);
    }
    function cameraSpeedFactor() {
        const scale = viewWidth > viewHeight ? viewHeight / viewWidth : viewWidth / viewHeight;
        return (/landscape/.test(orientation) ? scale : 1) * -0.12;
    }
    controls.azimuthRotateSpeed = cameraSpeedFactor(); // negative value to invert rotation direction
    controls.polarRotateSpeed = cameraSpeedFactor(); // negative value to invert rotation direction
    controls.minZoom = 1;
    controls.maxZoom = 20;
    controls.truckSpeed = (1 / EPS) * 100000 * worldScale;
    controls.mouseButtons.wheel = CameraControls.ACTION.ZOOM;
    controls.touches.two = CameraControls.ACTION.TOUCH_ZOOM_TRUCK;
    controls.verticalDragToForward = true;
    controls.saveState();
    // let keyboardMoveSpeed = 5;
    // let keyboardRotateSpeed = 0.05;

    // export function setKeyboardRotateSpeed(value) {
    //     keyboardRotateSpeed = value;
    // }
    // export function setKeyboardMoveSpeed(value) {
    //     keyboardMoveSpeed = value;
    // }
    let sunLight: SunLight;
    let sky: Sky;
    // Add an ambient light
    const ambientLight = new AmbientLight(0xffffff);
    ambientLight.castShadow = false;
    scene.add(ambientLight);

    // const hemiLight = new HemisphereLight( '#1f467f', '#7f643f', 1 );
    // hemiLight.position.set( 0, 200* worldScale, 0 );
    // scene.add(hemiLight);

    // const axesHelper = new AxesHelper(1);
    // scene.add( axesHelper );

    function updateAmbientLight() {
        if ((settings.mapMap || settings.debug) && settings.dayNightCycle) {
            ambientLight.intensity = 1;
        } else if (settings.generateColor) {
            ambientLight.intensity = settings.dayNightCycle ? 2 : 3;
        } else {
            ambientLight.intensity = 3;
        }
    }
    function updateSkyPosition() {
        if (!sky) {
            return;
        }
        const phi = Math.PI / 2 - sunLight.elevation;
        const theta = Math.PI - sunLight.azimuth;
        const sun = new Vector3();
        sun.setFromSphericalCoords(1, phi, theta);

        sky.material.uniforms['sunPosition'].value.copy(sun);
    }

    function updateCurrentViewingDistance() {
        currentViewingDistance = getViewingDistance();
        // if (EXTERNAL_APP)
        // {
        // 	emitNSEvent('viewingDistance', currentViewingDistance);
        // }
        // if (viewingDistanceLabel)
        // {
        // 	viewingDistanceLabel.innerText = Math.round(currentViewingDistance / 1000) + 'km';
        // }
    }

    function getRhumbLineBearing(originLL, destLL) {
        // difference of longitude coords
        let diffLon = destLL.lon * TO_RAD - originLL.lon * TO_RAD;

        // difference latitude coords phi
        const diffPhi = Math.log(Math.tan((destLL.lat * TO_RAD) / 2 + PI_DIV4) / Math.tan((originLL.lat * TO_RAD) / 2 + PI_DIV4));

        // recalculate diffLon if it is greater than pi
        if (Math.abs(diffLon) > Math.PI) {
            if (diffLon > 0) {
                diffLon = (PI_X2 - diffLon) * -1;
            } else {
                diffLon = PI_X2 + diffLon;
            }
        }

        // return the angle, normalized
        return (Math.atan2(diffLon, diffPhi) * TO_DEG + 360) % 360;
    }
    export function setPosition(coords: { lat; lon; altitude? }, animated = false, updateCtrls = true) {
        if (coords === currentPosition) {
            return;
        }
        controls.getPosition(tempVector);
        const scale = MaterialHeightShader.scaleRatio;
        const currentCoords = UnitsUtils.sphericalToDatums(tempVector.x / scale, -tempVector.z / scale);

        setSelectedItem(null);

        const newPosition = UnitsUtils.datumsToSpherical(coords.lat, coords.lon, null, scale);
        if (animated) {
            const distance = getDistance(currentCoords, coords);
            const startElevation = settings.elevation;
            let endElevation = startElevation;
            if (coords.altitude) {
                currentPositionAltitude = coords.altitude + 100;
                endElevation = currentPositionAltitude;
            }
            // always move to be "over" the peak
            const topElevation = distance > 100000 ? 11000 * settings.exageration : endElevation;
            startAnimation({
                from: { ...{ x: tempVector.x, y: -tempVector.z }, progress: 0 },
                to: { ...newPosition, progress: 1 },
                duration: Math.min(distance / 20, 3000),
                preventComputeFeatures: true,
                onUpdate: (value) => {
                    const { progress, ...newPos } = value;
                    // currentPosition = newPos;
                    if (progress <= 0.2) {
                        const cProgress = 5 * progress;
                        // controls.azimuthAngle = (startAimingAngle + cProgress * (endAimingAngle - startAimingAngle)) * TO_RAD;
                    }
                    if (progress <= 0.5) {
                        const cProgress = 2 * progress;
                        controls.moveTo(newPos.x, (startElevation + cProgress * (topElevation - startElevation)) * settings.exageration * scale, -newPos.y, false);
                    } else {
                        const cProgress = (progress - 0.5) * 2;
                        controls.moveTo(newPos.x, (topElevation + cProgress * (endElevation - topElevation)) * settings.exageration * scale, -newPos.y, false);
                    }
                    updateControls();
                },
                onEnd: () => {
                    currentPosition = coords;
                    setSettings('elevation', endElevation, false);
                    updateCurrentViewingDistance();
                    updateExternalPosition();
                }
            });
        } else {
            if (coords.altitude) {
                setSettings('elevation', coords.altitude, false);
            }
            controls.moveTo(newPosition.x, settings.elevation * settings.exageration * scale, -newPosition.y, false);
            updateCurrentViewingDistance();
            if (updateCtrls) {
                updateControls();
            }
            // axesHelper.position.set(newPosition.x, 2000 * worldScale, -newPosition.y);
            if (sky) {
                sunLight.setPosition(coords.lat, coords.lon);
                controls.getPosition(tempVector);
                sunLight.setWorldPosition(tempVector);
                updateAmbientLight();
                updateSkyPosition();
            }
        }
    }
    window['setPosition'] = setPosition;

    function updateCurrentMinElevation(pos = currentPosition, node?, diff = 60) {
        needsCurrentPositionElevation = false;
        if (pos) {
            const groundElevation = getElevation(pos, node);
            if (groundElevation === -100000 || isNaN(groundElevation)) {
                needsCurrentPositionElevation = true;
            } else {
                const oldGroundElevation = currentGroundElevation || groundElevation;
                const currentDiff = settings.elevation - oldGroundElevation;
                currentGroundElevation = groundElevation;
                if (currentDiff > 0 && currentDiff < 500) {
                    setSettings('elevation', currentGroundElevation + Math.max(currentDiff, diff));
                }
            }
        } else {
            currentGroundElevation = undefined;
        }
    }

    export function getElevation(coord: { lat; lon }, node?: MaterialHeightShader): number {
        const maxZoom = map.heightProvider.maxZoom;
        let zoom = maxZoom;
        let fractionTile;
        while (!node && zoom > maxZoom - 3) {
            fractionTile = pointToTileFraction(coord.lon, coord.lat, zoom);
            node = getNode(fractionTile[2], Math.floor(fractionTile[0]), Math.floor(fractionTile[1])) as MaterialHeightShader;
            zoom -= 1;
        }
        if (node && node.heightLoaded && node.userData.displacementMap.value) {
            const texture = node.userData.displacementMap.value as Texture;
            const displacementMapLocation = node.userData.displacementMapLocation.value;
            const pixel = getPixel(getImageData(texture.image as ImageBitmap), displacementMapLocation, coord, node.level);
            const elevationDecoder = settings.elevationDecoder;
            const elevation = (pixel[0] / 255) * elevationDecoder[0] + (pixel[1] / 255) * elevationDecoder[1] + (pixel[2] / 255) * elevationDecoder[2] + elevationDecoder[3];

            return elevation;
        } else {
            return -100000;
        }
    }

    let updateExternalPosition;
    let updatePositionListener;
    export function setUpdateExternalPositionListener(value) {
        updatePositionListener = value;
    }
    export function setUpdateExternalPositionThrottleTime(value) {
        updateExternalPosition = throttle(function () {
            const newPos = { ...currentPosition, altitude: settings.elevation };
            // if (EXTERNAL_APP)
            // {
            // 	if (window['electron'])
            // 	{
            // 		const ipcRenderer = window['electron'].ipcRenderer;
            // 		ipcRenderer.send('message', newPos);
            // 	}

            // 	emitNSEvent('position', newPos);
            // }
            if (updatePositionListener) {
                updatePositionListener(newPos);
            }
            if (settingsChangedListener) {
                settingsChangedListener('setPosition', newPos);
            }
        }, value);
    }
    setUpdateExternalPositionThrottleTime(100);

    function updateCurrentPosition() {
        controls.getPosition(tempVector);
        const scale = MaterialHeightShader.scaleRatio;
        const point = UnitsUtils.sphericalToDatums(tempVector.x / scale, -tempVector.z / scale);
        // console.log('point', tempVector, point);

        if (!currentPosition || currentPosition.lat !== point.lat || currentPosition.lon !== point.lon) {
            if (sunLight) {
                sunLight.setWorldPosition(tempVector);
            }
            currentPosition = point;
            if (settings.stickToGround) {
                updateCurrentMinElevation();
            }
            updateExternalPosition();
        }
    }

    controls.addEventListener('update', () => {
        if (!animating) {
            updateCurrentPosition();
        }
        onControlUpdate();
    });
    controls.addEventListener('controlend', () => {
        updateLODThrottle();
        controls.getPosition(tempVector);
        const scale = MaterialHeightShader.scaleRatio;
        const point = UnitsUtils.sphericalToDatums(tempVector.x / scale, -tempVector.z / scale);
        if (!currentPosition || currentPosition.lat !== point.lat || currentPosition.lon !== point.lon || currentPosition.altitude !== settings.elevation) {
            currentPosition = { ...point, altitude: settings.elevation };
            updateCurrentViewingDistance();
        }

        if (settingsChangedListener) {
            settingsChangedListener('setAzimuth', (controls.azimuthAngle * TO_DEG) % 360);
        }
        // force a render at the end of the movement to make sure we show the correct peaks
        requestRenderIfNotRequested(true);
    });

    let zoom = camera.zoom;
    controls.addEventListener('control', (event) => {
        const zooming = controls.zooming;
        const trucking = controls.trucking;
        // if (event.originalEvent && event.originalEvent.buttons)
        // {
        // 	shouldClearSelectedOnClick = false;
        // }
        if (zoom !== camera.zoom) {
            zoom = camera.zoom;
            controls.azimuthRotateSpeed = controls.polarRotateSpeed = cameraSpeedFactor() / zoom; // negative value to invert rotation direction
        }
        updateControls();
        if (selectedItem && trucking) {
            // sendSelectedToNS();
        }
        // if (EXTERNAL_APP && zooming)
        // {
        // 	emitNSEvent('zoom', camera.zoom);
        // }
    });

    // function emitNSEvent(name, value) {
    //     if (window['nsWebViewBridge']) {
    //         // console.log('emitNSEvent ', name, value);
    //         window['nsWebViewBridge'].emit(name, typeof value === 'function' ? value() : value);
    //     }
    // }

    class OutlinePass extends EffectPass {
        constructor(camera, outlineEffect) {
            super(camera, outlineEffect);
        }

        render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) {
            map.visible = false;
            super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
            map.visible = true;
        }
    }
    const mainPass = new RenderPass(scene, camera);
    composer.addPass(mainPass);
    const outlineEffect = new CustomOutlineEffect();
    const outlinePass = new OutlinePass(camera, outlineEffect);
    composer.addPass(outlinePass);
    // function crop(x, y, w, h) {
    // renderer.setViewport(x, y, w, h);
    // renderer.setScissor(x, y, w, h);
    // renderer.setScissorTest(true);
    // }
    let minYPx = 0;
    function actualComputeFeatures() {
        let oldSyVisible;
        let oldSunLightVisible;
        const oldAmbientLightVisible = ambientLight.visible;
        ambientLight.visible = false;
        if (sky) {
            oldSyVisible = sky.visible;
            oldSunLightVisible = sunLight.visible;
            sky.visible = false;
            sunLight.visible = false;
        }
        sharedPointMaterial.uniforms.depthTexture.value = composer['depthTexture'];
        applyOnNodes((node) => {
            const visible = node.isVisible();
            if (visible) {
                node.wasVisible = visible;
                node.hide();
            }
            node.objectsHolder.visible = visible || (node.level === map.maxZoomForPeaks && node.parentNode.subdivided);
            // if (node.pointsMesh)
            // {
            // 	node.pointsMesh.userData.depthTexture.value = depthTexture;
            // }
        });
        if (settings.debugFeaturePoints) {
            renderer.render(scene, camera);
        }
        renderer.setRenderTarget(pointBufferTarget);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        readShownFeatures();

        sharedPointMaterial.uniforms.depthTexture.value = null;
        applyOnNodes((node) => {
            if (node.wasVisible) {
                delete node.wasVisible;
                node.show();
            }
            node.objectsHolder.visible = (node.isVisible() && settings.debugFeaturePoints) || (node.level === map.maxZoomForPeaks && node.parentNode.subdivided);
            // if (node.pointsMesh)
            // {
            // 	node.pointsMesh.userData.depthTexture.value = null;
            // }
        });
        if (sky) {
            sky.visible = oldSyVisible;
            sunLight.visible = oldSunLightVisible;
        }
        ambientLight.visible = oldAmbientLightVisible;
    }
    const computeFeatures = throttle(actualComputeFeatures, 300);
    function onresize() {
        sized = true;
        viewWidth = window.innerWidth;
        viewHeight = window.innerHeight;
        const scale = viewWidth / viewHeight;
        if (scale > 1) {
            offWidth = 800;
            offHeight = Math.round(offWidth / scale);
        } else {
            offHeight = 800;
            offWidth = Math.round(offHeight * scale);
        }

        minYPx = (TEXT_HEIGHT / viewHeight) * offHeight;

        // featuresDrawingCanvas.width = Math.floor(viewWidth * devicePixelRatio);
        // featuresDrawingCanvas.height = Math.floor(viewHeight * devicePixelRatio);
        rendererScaleRatio = 1 + (devicePixelRatio - 1) / 2;

        renderer.setSize(viewWidth, viewHeight);
        renderer.setPixelRatio(rendererScaleRatio);

        pixelsBuffer = new Uint8Array(offWidth * offHeight * 4);
        pointBufferTarget.setSize(offWidth, offHeight);

        composer.setSize(viewWidth, viewHeight);
        camera.aspect = scale;
        camera.updateProjectionMatrix();

        // rendererMagnify.setSize(width, height);
        // rendererMagnify.setPixelRatio(rendererScaleRatio);
        // magnify3dTarget.setSize(width *devicePixelRatio, height *devicePixelRatio);

        // screenQuad.setScreenSize( viewWidth, viewHeight );

        if (!map && currentPosition) {
            createMap();
        }
        updateLODThrottle();
        requestRenderIfNotRequested(true);
    }
    onresize();
    updateControls();

    function toScreenXY(pos3D) {
        const pos = pos3D.clone();
        pos.project(camera);
        const widthHalf = viewWidth / 2,
            heightHalf = viewHeight / 2;

        pos.x = pos.x * widthHalf + widthHalf;
        pos.y = -(pos.y * heightHalf) + heightHalf;
        pos.z = camera.position.distanceTo(pos3D);
        return pos;
    }

    function applyOnNode(node, cb) {
        cb(node);
        node.children.forEach((n) => {
            if (n instanceof MapNode) {
                applyOnNode(n, cb);
            }
        });
        if (node.childrenCache) {
            node.childrenCache.forEach((n) => {
                if (n instanceof MapNode) {
                    applyOnNode(n, cb);
                }
            });
        }
    }
    function applyOnNodes(cb) {
        if (map) {
            applyOnNode(map.children[0], cb);
        }
    }

    function wrapText(context, text, x, y, maxWidth, lineHeight, measureOnly = false) {
        const words = text.split(' ');
        let line = '';
        let nbLines = 1;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + (n > 0 ? ' ' : '') + words[n];
            const testWidth = context.measureText(testLine).width;
            if (testWidth > maxWidth && n > 0) {
                if (!measureOnly) {
                    context.fillText(line, x, y);
                }
                line = words[n];
                y += lineHeight;
                nbLines++;
            } else {
                line = testLine;
            }
        }
        if (!measureOnly) {
            context.fillText(line, x, y);
        }
        if (measureOnly) {
            return { x: x + context.measureText(line).width, y, nbLines };
        }
    }
    function roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) {
            r = w / 2;
        }
        if (h < 2 * r) {
            r = h / 2;
        }
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function truncate(str, maxlength) {
        return str.length > maxlength ? str.slice(0, maxlength - 1) + '…' : str;
    }
    function updateSelectedPeakLabel() {
        const point2 = { lat: selectedItem.geometry.coordinates[1], lon: selectedItem.geometry.coordinates[0], altitude: selectedItem.properties.ele };
        const distance = getDistance(currentPosition, point2);
        // selectedPeakLabel.innerText = selectedItem.properties.name + ' ' + selectedItem.properties.ele + 'm(' + Math.round(distance / 100) / 10 + 'km)';
    }

    // function sendSelectedToNS() {
    //     emitNSEvent('selected', () => {
    //         let distance = 0;
    //         if (selectedItem) {
    //             controls.getPosition(tempVector);
    //             const scale = MaterialHeightShader.scaleRatio;
    //             const point1 = UnitsUtils.sphericalToDatums(tempVector.x / scale, -tempVector.z / scale);
    //             const point2 = { lat: selectedItem.geometry.coordinates[1], lon: selectedItem.geometry.coordinates[0], altitude: selectedItem.properties.ele };
    //             distance = getDistance(point1, point2);
    //             return { ...selectedItem, distance };
    //         }
    //         return null;
    //     });
    // }
    function setSelectedItem(f) {
        mousePosition = null;
        if (f === selectedItem) {
            return;
        }
        selectedItem = f;
        // if (EXTERNAL_APP)
        // {
        // 	sendSelectedToNS();
        // }
        // if (selectedPeakLabel)
        // {
        // 	if (selectedItem)
        // 	{
        // 		updateSelectedPeakLabel();
        // 	}
        // 	else
        // 	{
        // 		selectedPeakLabel.innerText = null;
        // 	}
        // 	selectedPeakDiv.style.visibility = selectedItem ? 'visible' : 'hidden';
        // }
    }
    export function goToSelectedItem() {
        if (selectedItem) {
            // ensure we dont end up in the mesh
            const point2 = { lat: selectedItem.geometry.coordinates[1], lon: selectedItem.geometry.coordinates[0], altitude: selectedItem.properties.ele + 100 };
            setPosition(point2, true);
        }
    }
    export function focusSelectedItem() {
        if (selectedItem) {
            controls.getPosition(tempVector);
            const scale = MaterialHeightShader.scaleRatio;
            const point1 = UnitsUtils.sphericalToDatums(tempVector.x / scale, -tempVector.z / scale);
            const point2 = { lat: selectedItem.geometry.coordinates[1], lon: selectedItem.geometry.coordinates[0] };
            const angle = 360 - getRhumbLineBearing(point1, point2);
            setAzimuth(angle);
        }
    }

    function isSelectedFeature(f) {
        if (settings.local) {
            return selectedItem && f.properties.osmid === selectedItem.properties.osmid;
        }
        return selectedItem && f.properties.name === selectedItem.properties.name && f.properties.ele === selectedItem.properties.ele;
    }

    function getDistanceToMouse(f) {
        return Math.sqrt(Math.pow(mousePosition.x - f.x, 2) + Math.pow(mousePosition.y - f.y, 2));
    }
    const minDistance = isMobile ? 26 : 36;
    const windowSize = minDistance;
    function drawFeatures() {
        if (!settings.readFeatures || animating) {
            return;
        }

        const featuresGroupedX = new Array(viewWidth);
        const lastX = 0;
        let maxEle = -10000;
        let maxEleX;
        const featuresToDraw = [];
        const scale = MaterialHeightShader.scaleRatio;
        featuresToShow.forEach((f) => {
            const coords = UnitsUtils.datumsToSpherical(f.geometry.coordinates[1], f.geometry.coordinates[0], null, scale);
            const ele = f.properties.ele || 0;
            tempVector.set(coords.x, ele * settings.exageration * scale, -coords.y);
            const vector = toScreenXY(tempVector);
            const x = Math.floor(vector.x);
            const y = vector.y;
            const z = vector.z;
            // if (y < TEXT_HEIGHT- 20 || z > settings.far * scale + 1000 || z / ele > settings.far * scale / 3000)
            if (y < TEXT_HEIGHT - 20) {
                // if (f.properties.name.endsWith('Monte Bianco'))
                // {
                // 	console.log('ignoring', f.properties.name, z, z / ele > FAR / 3000, z > FAR + 1000 );

                // }
                return;
            }

            // lastX = Math.max(lastX, x);
            // if (f.properties.name.endsWith('Monte Bianco'))
            // {
            // 	console.log('test', x );

            // }
            if (ele > maxEle) {
                maxEleX = x;
                maxEle = ele;
            }
            const array = (featuresGroupedX[x] = featuresGroupedX[x] || []);
            array.push({ ...f, x, y, z });
        });
        let windowStartX = maxEleX;
        // console.log('featuresGroupedX', featuresGroupedX);
        function handleWindowSize(startX, endX, distance) {
            const array = featuresGroupedX
                .slice(startX, endX)
                .filter((s) => Boolean(s))
                .flat();
            // console.log('handleWindowSize', windowStartX, array);
            if (array.length === 0) {
                windowStartX += distance;
                return true;
            }
            // const indexTet = array.findIndex((f) => {return f.properties.name.endsWith('Monte Bianco');});
            // if (indexTet !== -1)
            // {
            // 	console.log('found Monte Bianco!');
            // }
            let nextFeature;
            if (mousePosition && mousePosition.x >= startX && mousePosition.x <= endX) {
                // console.log('mouse', windowStartX, array);
                const mouseObj = array.reduce((p, c) => (!isSelectedFeature(p) && (getDistanceToMouse(p) < getDistanceToMouse(c) || isSelectedFeature(c)) ? p : c));
                if (getDistanceToMouse(mouseObj) < 20) {
                    nextFeature = mouseObj;
                    setSelectedItem(nextFeature);
                }
            }
            if (!nextFeature && selectedItem) {
                const index = array.findIndex((f) => isSelectedFeature(f));
                if (index !== -1) {
                    nextFeature = array[index];
                }
            }
            if (!nextFeature) {
                nextFeature = array.reduce((p, c) => (Math.pow(p.properties.ele, 2) > Math.pow(c.properties.ele, 2) ? p : c));
            }
            windowStartX = nextFeature.x + distance;
            featuresToDraw.push(nextFeature);
        }
        // console.log('maxEleX', maxEleX, maxEle);
        windowStartX = maxEleX - minDistance / 2;
        while (windowStartX < viewWidth) {
            if (handleWindowSize(windowStartX, windowStartX + minDistance, minDistance)) {
                continue;
            }
        }
        windowStartX = maxEleX - minDistance;
        while (windowStartX >= 0) {
            if (handleWindowSize(windowStartX - minDistance, windowStartX, -minDistance)) {
                continue;
            }
        }

        // console.log('featuresToDraw', featuresToDraw );
        drawFeaturesLabels(featuresToDraw);
    }

    const labelFontSize = 15;
    const textRotation = -Math.PI / 4;
    const textMaxWidth = Math.round(TEXT_HEIGHT / Math.cos(textRotation) - 20);
    const rectTop = -16;
    const rectBottom = 21;
    const canWrap = false;
    function drawFeaturesLabels(featuresToDraw: any[]) {
        // const screenRatio = devicePixelRatio;
        // const toShow = featuresToDraw.length;
        // ctx2d.save();
        // ctx2d.clearRect(0, 0, featuresDrawingCanvas.width, featuresDrawingCanvas.height);
        // ctx2d.scale(screenRatio, screenRatio);
        // const textColor = settings.dark ? 'white' : 'black';
        // const color = settings.dark ? '#000000' : '#ffffff';
        // let f, y, isSelected, text, realTextWidth, textWidth, textWidth2, transform, point, test;
        // for (let index = 0; index < toShow; index++)
        // {
        // 	f = featuresToDraw[index];
        // 	y = f.y;
        // 	isSelected = selectedItem && isSelectedFeature(f);
        // 	if (settings.drawLines && y>TEXT_HEIGHT)
        // 	{
        // 		ctx2d.beginPath();
        // 		ctx2d.strokeStyle = textColor;
        // 		ctx2d.lineWidth = isSelected?3:1;
        // 		ctx2d.moveTo(f.x, TEXT_HEIGHT);
        // 		ctx2d.lineTo(f.x, y);
        // 		ctx2d.closePath();
        // 		ctx2d.stroke();
        // 	}
        // 	ctx2d.save();
        // 	ctx2d.translate(f.x, TEXT_HEIGHT);
        // 	ctx2d.rotate(textRotation);
        // 	if (isSelected)
        // 	{
        // 		ctx2d.font = `bold ${labelFontSize}px Noto Sans`;
        // 	}
        // 	else
        // 	{
        // 		ctx2d.font = `${labelFontSize}px Noto Sans`;
        // 	}
        // 	text = canWrap? f.properties.name: truncate(f.properties.name, 30);
        // 	realTextWidth = ctx2d.measureText(text).width;
        // 	textWidth = Math.min(realTextWidth, textMaxWidth);
        // 	let wrapValues = {y: canWrap && settings.drawElevations?labelFontSize:0, x: canWrap? 0 :textWidth};
        // 	if (canWrap && realTextWidth !== textWidth)
        // 	{
        // 		wrapValues = wrapText(ctx2d, text, 5, 0, textWidth, labelFontSize, true);
        // 	}
        // 	let totalWidth = textWidth + 10;
        // 	let text2;
        // 	if (settings.drawElevations)
        // 	{
        // 		text2 = f.properties.ele + 'm';
        // 		textWidth2 = ctx2d.measureText(text2).width;
        // 		totalWidth += textWidth2 - 5;
        // 	}
        // 	if (mousePosition)
        // 	{
        // 		transform = ctx2d.getTransform().inverse();
        // 		point = new DOMPoint(mousePosition.x * screenRatio, mousePosition.y * screenRatio);
        // 		test = point.matrixTransform(transform);
        // 		if (test.x >= 0 && test.x < totalWidth &&
        // 			test.y < -rectTop && test.y >= -(rectBottom + wrapValues.y))
        // 		{
        // 			let changed = selectedItem !== f;
        // 			setSelectedItem(f);
        // 			if (changed)
        // 			{
        // 				// we need to redraw again as the previously selected text
        // 				// might already be drawn bold
        // 				ctx2d.restore();
        // 				ctx2d.restore();
        // 				return drawFeaturesLabels(featuresToDraw);
        // 			}
        // 		}
        // 	}
        // 	ctx2d.fillStyle = color + 'cc';
        // 	roundRect(ctx2d, 0, rectTop, totalWidth, rectBottom + wrapValues.y, 8);
        // 	ctx2d.fill();
        // 	ctx2d.fillStyle = textColor;
        // 	if (wrapValues.y !== 0)
        // 	{
        // 		wrapText(ctx2d, text, 5, 0, textWidth, labelFontSize);
        // 	}
        // 	else
        // 	{
        // 		ctx2d.fillText(text, 5, 0);
        // 	}
        // 	if (settings.drawElevations)
        // 	{
        // 		ctx2d.font = 'normal 11px Courier';
        // 		ctx2d.fillText(text2, wrapValues.x + 10, wrapValues.y);
        // 	}
        // 	ctx2d.restore();
        // }
        // ctx2d.restore();
        // if (mousePosition && selectedItem)
        // {
        // 	setSelectedItem(null);
        // 	drawFeaturesLabels(featuresToDraw);
        // }
    }

    function readShownFeatures() {
        const width = offWidth;
        renderer.readRenderTargetPixels(pointBufferTarget, 0, 0, offWidth, offHeight, pixelsBuffer);
        const readColors = [];
        const rFeatures = [];
        let needsToClearSelectedItem = Boolean(selectedItem);
        let lastColor;
        function handleLastColor(pixelIndex) {
            const colorIndex = readColors.indexOf(lastColor);
            if (colorIndex === -1) {
                const feature = featuresByColor[lastColor];
                if (feature) {
                    readColors.push(lastColor);
                    const result = { ...feature };
                    rFeatures.push(result);
                    if (needsToClearSelectedItem && isSelectedFeature(feature)) {
                        needsToClearSelectedItem = false;
                    }
                    return result;
                }
            } else {
                const result = rFeatures[colorIndex];
                return result;
            }
        }

        const endIndex = pixelsBuffer.length - minYPx * 4 * width;
        for (let index = 0; index < endIndex; index += 4) {
            if (pixelsBuffer[index + 3] !== 0 && (pixelsBuffer[index] !== 0 || pixelsBuffer[index + 1] !== 0 || pixelsBuffer[index + 2] !== 0)) {
                const color = (pixelsBuffer[index] << 16) + (pixelsBuffer[index + 1] << 8) + pixelsBuffer[index + 2];

                if (lastColor !== color) {
                    if (lastColor) {
                        const feature = handleLastColor(index - 4);
                    }
                    lastColor = color;
                }
            } else {
                if (lastColor) {
                    handleLastColor(index - 4);
                    lastColor = null;
                }
            }
        }
        if (lastColor) {
            handleLastColor(endIndex - 4);
            lastColor = null;
        }
        if (needsToClearSelectedItem) {
            setSelectedItem(null);
        }
        featuresToShow = rFeatures;
    }

    function withoutOutline() {
        return (settings.debug || settings.mapMap || settings.generateColor) && !settings.outline;
    }
    function actualRender(forceComputeFeatures) {
        composer.render(clock.getDelta());
        if (!animating && settings.readFeatures && pixelsBuffer) {
            if (forceComputeFeatures) {
                actualComputeFeatures();
            } else {
                computeFeatures();
            }
        }
        drawFeatures();
    }
    export function requestRenderIfNotRequested(forceComputeFeatures = false) {
        if (!sized) {
            return;
        }
        if (!renderForceComputeFeatures && forceComputeFeatures) {
            renderForceComputeFeatures = forceComputeFeatures;
        }
        if (!renderRequested) {
            renderRequested = true;
            requestAnimationFrame(render);
        }
    }
    export function render() {
        renderRequested = false;
        if (!renderer || !composer || !map) {
            return;
        }
        // csm.update(camera.matrix);
        if (directionalLightHelper) {
            directionalLightHelper.position.setFromMatrixPosition(directionalLightHelper.light.matrixWorld);
            directionalLightHelper.updateMatrix();
            directionalLightHelper.update();
        }
        // if (showMagnify)
        // {
        // 	const toComposer = withoutComposer();
        // 	if (!toComposer )
        // 	{
        // 		renderer.setRenderTarget(magnify3dTarget);
        // 	}
        // 	else
        // 	{
        // 		pass.renderToScreen = false;
        // 	}
        // 	actualRender(forceComputeFeatures);
        // 	// renderer.setRenderTarget(null);
        // 	magnify3d.render({
        // 		renderer: renderer,
        // 		rendererOut: rendererMagnify,
        // 		pos: mousePosition,
        // 		inputBuffer: magnify3dTarget,
        // 		renderSceneCB: (target) =>
        // 		{
        // 			// rendering in the zoom lens
        // 			renderer.setRenderTarget(target);
        // 			renderer.render(scene, camera);
        // 		}

        // 	});
        // }
        // else
        // {
        actualRender(renderForceComputeFeatures);
        renderForceComputeFeatures = false;

        if (renderTargetHelper) {
            renderTargetHelper.update();
        }
        if (stats) {
            stats.update();
        }
        // }
    }

    // if (!EXTERNAL_APP)
    // {
    // 	document.addEventListener('DOMContentLoaded', function()
    // 	{
    // 		const params = Object.assign({}, settings, {'setPosition': {'lat': 45.1811, 'lon': 5.8141, 'altitude': 2144}, 'setAzimuth': 0});
    // 		callMethods(params);
    // 	});
    // }

    function startAnimation({ from, to, duration, onUpdate, onEnd, preventComputeFeatures }: { from; to; duration; onUpdate?; onEnd?; preventComputeFeatures? }) {
        animating = preventComputeFeatures;
        if (animating) {
            // ctx2d.clearRect(0, 0, featuresDrawingCanvas.width, featuresDrawingCanvas.height);
        }

        const anim = new AdditiveTweening({
            onRender: onUpdate,
            onFinish: () => {
                if (onEnd) {
                    onEnd();
                }
                animating = false;
                requestRenderIfNotRequested(true);
            }
        });
        anim.tween(from, to, duration);
    }

    export function setAzimuth(value: number, animated = true, updateCtrls = true) {
        const current = (controls.azimuthAngle * TO_DEG) % 360;
        if (current === value) {
            return;
        }

        if (Math.abs(value - 360 - current) < Math.abs(value - current)) {
            value = value - 360;
        }
        if (animated) {
            startAnimation({
                from: { progress: current },
                to: { progress: value },
                duration: 200,
                onUpdate(values) {
                    controls.azimuthAngle = values.progress * TO_RAD;
                    updateControls();
                }
            });
        } else {
            controls.azimuthAngle = value * TO_RAD;
            if (updateCtrls) {
                updateControls();
            }
        }
    }
    window['setAzimuth'] = setAzimuth;

    export function callMethods(json) {
        try {
            canCreateMap = false;
            Object.keys(json)
                .sort()
                .forEach((key) => {
                    const newValue = json[key];
                    // if (window['webapp'])
                    // {
                    // 	window['webapp'].setSettings(key, newValue, false, false);

                    // }
                    // else
                    // {
                    setSettings(key, newValue, false, false);

                    // }
                });
            canCreateMap = true;
            if (!map) {
                createMap();
            }
            updateControls();
            requestRenderIfNotRequested(true);
        } catch (err) {
            console.error(err, err.stack);
        }
    }

    function getDistance(start, end) {
        const slat = (start.latitude || start.lat) * TO_RAD;
        const slon = (start.longitude || start.lon) * TO_RAD;
        const elat = (end.latitude || end.lat) * TO_RAD;
        const elon = (end.longitude || end.lon) * TO_RAD;
        return Math.round(Math.acos(Math.sin(elat) * Math.sin(slat) + Math.cos(elat) * Math.cos(slat) * Math.cos(slon - elon)) * UnitsUtils.EARTH_RADIUS);
    }
    function getViewingDistance() {
        if (!currentPosition) {
            return 0;
        }
        const farPoint = new Vector3(0, 0, -camera.far);
        farPoint.applyMatrix4(camera.matrixWorld);
        const scale = MaterialHeightShader.scaleRatio;
        const point2 = UnitsUtils.sphericalToDatums(farPoint.x / scale, -farPoint.z / scale);
        return getDistance(currentPosition, point2);
    }

    async function canvasReady(args) {
        canvas = args.object;
        const context = canvas.getContext('webgl2');
        try {
            const { drawingBufferWidth: width, drawingBufferHeight: height } = context;
            renderer = new WebGLRenderer({
                context,
                antialias: false,
                alpha: true,
                powerPreference: 'high-performance',
                // depth: false,
                stencil: false
            });
            renderer['physicallyCorrectLights'] = true;
            renderer.shadowMap.type = PCFSoftShadowMap;
            renderer.shadowMap.enabled = false;
            renderer.setClearColor(0x000000, 0);

            pointBufferTarget = new WebGLRenderTarget(100, 100, {
                generateMipmaps: false,
                stencilBuffer: false,
                depthBuffer: false,
                minFilter: NearestFilter,
                magFilter: NearestFilter
            });
            composer = new EffectComposer(renderer, {});
            onresize();
            updateControls();
            callMethods({ terrarium, setPosition: { ...position }, setAzimuth: bearing });
        } catch (err) {
            showError(err);
        }
    }
</script>

<frame backgroundColor="transparent">
    <page bind:this={page} actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
        <ncanvas id="canvas" backgroundColor="black" on:ready={canvasReady} />
    </page>
</frame>
