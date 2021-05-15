import * as THREE from 'three';
//@ts-ignore
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass';

export default class CustomOutlinePass extends Pass {
    resolution: THREE.Vector2;
    normalOverrideMaterial: THREE.MeshNormalMaterial;
    fsQuad: FullScreenQuad;
    constructor(resolution, private renderScene: THREE.Scene, private renderCamera: THREE.PerspectiveCamera) {
        super();

        this.resolution = new THREE.Vector2(resolution.x, resolution.y);

        this.fsQuad = new FullScreenQuad(null);
        this.fsQuad.material = this.createOutlinePostProcessMaterial();
    }

    get fsquadMaterial() {
        return this.fsQuad.material as THREE.ShaderMaterial;
    }

    dispose() {
        this.fsQuad.dispose();
    }

    setSize(width, height) {
        this.resolution.set(width, height);
        this.fsquadMaterial.uniforms.screenSize.value.set(this.resolution.x, this.resolution.y, 1 / this.resolution.x, 1 / this.resolution.y);
    }

    render(renderer, writeBuffer, readBuffer) {
        // renderer.render(this.renderScene, this.renderCamera);

        this.fsquadMaterial.uniforms.sceneColorBuffer.value = readBuffer.texture;
        this.fsquadMaterial.uniforms.depthBuffer.value = readBuffer.depthTexture;

        renderer.setRenderTarget(null);
        this.fsQuad.render(renderer);
    }

    get vertexShader() {
        return `
                                 	varying vec2 vUv;
                                 	void main() {
                                 		vUv = uv;
                                 		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                 	}
                                 	`;
    }

    get fragmentShader() {
        return `
        #include <packing>
        // The above include imports "perspectiveDepthToViewZ"
        // and other GLSL functions from ThreeJS we need for reading depth.
        uniform sampler2D sceneColorBuffer;
            uniform sampler2D depthBuffer;
            uniform float cameraNear;
        uniform float cameraFar;
        uniform vec4 screenSize;
        uniform vec3 outlineColor;
        uniform vec3 sceneColor;
        uniform vec2 multiplierParameters;
        uniform float depthStep;
        varying vec2 vUv;
        vec3 getPixelNormal(float x, float y) {
            return texture2D(sceneColorBuffer, vUv + screenSize.zw * vec2(x, y)).rgb;
        }
            // Helper functions for reading from depth buffer.
        float readDepth (sampler2D depthSampler, vec2 coord) {
            float fragCoordZ = texture2D(depthSampler, coord).x;
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
            return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }
            float getPixelDepth(float x, float y) {
            // screenSize.zw is pixel size 
            // vUv is current position
            return readDepth(depthBuffer, vUv + screenSize.zw * vec2(x, y));
        }
        float saturate(float num) {
            return clamp(num, 0.0, 1.0);
        }
        void main() {
            vec4 sceneColor = vec4(sceneColor,1.0);
            // vec4 sceneColor = texture2D(sceneColorBuffer, vUv);
            float depthDiff = 0.0;
            float depth = getPixelDepth(0.0, 0.0);
            depthDiff += abs(depth - getPixelDepth(depthStep, 0.0));
            depthDiff += abs(depth - getPixelDepth(-depthStep, 0.0));
            depthDiff += abs(depth - getPixelDepth(0.0, depthStep));
            depthDiff += abs(depth - getPixelDepth(0.0, -depthStep));
            // depthDiff += abs(depth - getPixelDepth(depthStep, depthStep));
            // depthDiff += abs(depth - getPixelDepth(depthStep, -depthStep));
            // depthDiff += abs(depth - getPixelDepth(-depthStep, -depthStep));
            // depthDiff += abs(depth - getPixelDepth(-depthStep, depthStep));
            depthDiff = depthDiff /depth;

            // Apply multiplier & bias to each
            depthDiff = depthDiff * multiplierParameters.y;
            depthDiff = saturate(depthDiff);
            if (depthDiff < 0.04) {
                depthDiff = pow(depthDiff, multiplierParameters.x);
            }
            // Combine outline with scene color.
            vec4 outlineColor = vec4(outlineColor, 1.0);
            gl_FragColor = vec4(mix(sceneColor, outlineColor, depthDiff));
            //  gl_FragColor = vec4(vec3(depth), 1.0);

        }
`;
    }

    createOutlinePostProcessMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                sceneColorBuffer: { value: null },
                depthBuffer: { value: null },
                sceneColor: { value: new THREE.Color(0xffffff) },
                depthStep: { value: 1 },
                outlineColor: { value: new THREE.Color(0x000000) },
                // 4 scalar values packed in one uniform: depth multiplier, depth bias, and same for normals.
                multiplierParameters: { value: new THREE.Vector2(2, 4) },
                cameraNear: { value: this.renderCamera.near },
                cameraFar: { value: this.renderCamera.far },
                screenSize: {
                    value: new THREE.Vector4(this.resolution.x, this.resolution.y, 1 / this.resolution.x, 1 / this.resolution.y)
                }
            },
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader
        });
    }
}
