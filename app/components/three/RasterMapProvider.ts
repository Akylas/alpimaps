import RasterMapProvider from '../../../geo-three/source/providers/RasterMapProvider';

export default class ImageMapProvider extends RasterMapProvider {
    public buildURL(zoom: number, x: number, y: number): string {
        return `http://127.0.0.1:8080?source=raster&x=${x}&y=${y}&z=${zoom}`;
    }
}
