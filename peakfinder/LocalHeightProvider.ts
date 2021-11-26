import { ImageBitmapLoader, getSharedFetchLoader, getSharedImageBitmapLoader } from '../geo-three/source/utils/FetchLoader';
import RasterMapProvider from '../geo-three/source/providers/RasterMapProvider';

const fetchLoader = getSharedFetchLoader({ fetchOptions: { credentials: 'same-origin' } });
const imageBitmapLoader = getSharedImageBitmapLoader({
    imageOrientation: 'flipY',
    fetchOptions: { credentials: 'same-origin' }
});

export class LocalHeightProvider extends RasterMapProvider {
    public constructor(local = false) {
        super();
        this.name = 'local';
        this.minZoom = 5;
        this.maxZoom = 12;
    }

    public buildURL(zoom, x, y): string {
        return `http://127.0.0.1:8080?source=height&x=${x}&y=${y}&z=${zoom}`;
    }

    protected buildPeaksURL(zoom, x, y): string {
        return `http://127.0.0.1:8080?source=peaks&x=${x}&y=${y}&z=${zoom}`;
    }

    protected getImageBitmapLoader(): ImageBitmapLoader {
        return imageBitmapLoader;
    }

    public async fetchPeaks(zoom, x, y): Promise<any[]> {
        const url = this.buildPeaksURL(zoom, x, y);

        const data = await fetchLoader.load<any>(url, { output: 'json' });
        return data.features.filter((f) => f.properties.name);
    }

    public cancelTile(zoom: number, x: number, y: number): void {
        super.cancelTile(zoom, x, y);
        const peaksurl = this.buildPeaksURL(zoom, x, y);
        fetchLoader.cancel(peaksurl);
    }
}
