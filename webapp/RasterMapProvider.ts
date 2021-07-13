import { OpenStreetMapsProvider } from '../geo-three/source/providers/OpenStreetMapsProvider';
export default class RasterMapProvider extends OpenStreetMapsProvider {
    public constructor() {
        super();
    }
    public fetchImage(zoom: number, x: number, y: number) {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const image = document.createElement('img');
            image.onload = function () {
                resolve(image);
            };
            image.onerror = function () {
                reject();
            };
            image.crossOrigin = 'Anonymous';
            image.src = `http://127.0.0.1:8080?source=raster&x=${x}&y=${y}&z=${zoom}`;
        });
    }
}
