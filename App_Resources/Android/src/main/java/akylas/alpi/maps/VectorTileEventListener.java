package akylas.alpi.maps;

import android.os.Handler;
import android.util.Log;

import com.carto.ui.VectorTileClickInfo;
import com.carto.core.Variant;
import com.carto.geometry.Geometry;
import com.akylas.carto.additions.AKMapView;
import com.akylas.carto.additions.SynchronousHandler;
import com.akylas.carto.additions.AKVectorTileEventListener;

public class VectorTileEventListener extends AKVectorTileEventListener {
    Handler mainHandler = null;

    public VectorTileEventListener(Listener listener) {
        super(listener);
    }

    @Override
    public boolean onVectorTileClicked(final VectorTileClickInfo clickInfo) {
        final String featureLayerName = clickInfo.getFeatureLayerName();
        com.carto.geometry.VectorTileFeature feature = clickInfo.getFeature();
        final Variant name  = feature.getProperties().getObjectElement("name");
        final Geometry geometry  = feature.getGeometry();
        if (
            // featureLayerName.equals("transportation") ||
            // featureLayerName.equals("transportation_name") ||
            // featureLayerName.equals("waterway") ||
            // featureLayerName.equals("place") ||
            // featureLayerName.equals("contour") ||
            // featureLayerName.equals("hillshade") ||
            (featureLayerName.equals("park") && geometry instanceof com.carto.geometry.PolygonGeometry
) ||
            ((featureLayerName.equals("building") || featureLayerName.equals("landcover" )|| featureLayerName.equals(  "landuse")) && name != null)
        ) {
            return false;
        }
        if (AKMapView.RUN_ON_MAIN_THREAD) {
            final Object[] arr = new Object[1];
            if (mainHandler == null) {
                mainHandler = new Handler(android.os.Looper.getMainLooper());
            }
            SynchronousHandler.postAndWait(mainHandler, new Runnable() {
                @Override
                public void run() {
                    if (listener != null) {
                        arr[0] = new Boolean(listener.onVectorTileClicked(clickInfo));
                    } else {
                        arr[0] = new Boolean(VectorTileEventListener.super.onVectorTileClicked(clickInfo));
                    }
                }
            });
            if (arr[0] != null) {
                return (Boolean) arr[0];
            } else {
                return false;
            }
        } else {
            if (listener != null) {
                Boolean result = new Boolean(listener.onVectorTileClicked(clickInfo));
                // Log.d("JS", "Test" + result);
                return result;
            } else {
                return new Boolean(super.onVectorTileClicked(clickInfo));
            }
        }
    }
}
