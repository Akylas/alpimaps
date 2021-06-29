import { MapProvider } from '../geo-three/source/providers/MapProvider';
import { CancelablePromise } from '../geo-three/source/utils/CancelablePromise';
import { XHRUtils } from '../geo-three/source/utils/XHRUtils';

export class LocalHeightProvider extends MapProvider {
    public constructor() {
        super();
        this.name = 'local';
        this.minZoom = 5;
        this.maxZoom = 11;
    }

    public async fetchTile(zoom, x, y): Promise<HTMLImageElement> {
        const result = await Promise.all([
            new CancelablePromise<HTMLImageElement>((resolve, reject) => {
                const image = document.createElement('img');
                image.onload = () => resolve(image);
                image.onerror = () => resolve(null);
                image.crossOrigin = 'Anonymous';
                image.src = `http://127.0.0.1:8080?source=height&x=${x}&y=${y}&z=${zoom}`;
            })
        ]);
        return result[0];
    }

    public async fetchPeaks(zoom, x, y): Promise<any[]> {
        return new CancelablePromise((resolve, reject) => {
            const url = `http://127.0.0.1:8080?source=peaks&x=${x}&y=${y}&z=${zoom}`;
            try {
                XHRUtils.get(url, async (data) => {
                    let result = JSON.parse(data).features;
                    result = result.filter((f) => f.properties.name && f.properties.class === 'peak');
                    resolve(result);
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}
