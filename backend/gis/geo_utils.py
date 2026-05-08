"""
GIS utility functions: GeoJSON helpers, CRS reprojection, shapefile parsing.

All geometries are stored and served in EPSG:4326 (WGS 84).
Shapefiles uploaded by users may use any CRS — this module
reprojects them to 4326 before saving.

Dependencies (installed in backend Docker image):
  fiona, shapely, pyproj  — for shapefile parsing + reprojection
"""
import json
import os
import tempfile
import zipfile

from django.contrib.gis.geos import GEOSGeometry


def geojson_feature(geom, props: dict) -> dict:
    """Wrap a GEOS geometry + properties dict into a GeoJSON Feature."""
    return {
        'type': 'Feature',
        'geometry': json.loads(geom.geojson) if geom else None,
        'properties': props,
    }


def geojson_collection(features: list) -> dict:
    """Wrap a list of Feature dicts into a FeatureCollection."""
    return {
        'type': 'FeatureCollection',
        'features': features,
    }


def reproject_geojson(geojson_str: str, source_epsg: int, target_epsg: int = 4326) -> str:
    """
    Reproject GeoJSON geometry string from source_epsg to target_epsg.
    Returns a GeoJSON geometry string in the target CRS.
    """
    try:
        from pyproj import Transformer
        import json

        transformer = Transformer.from_crs(
            f'EPSG:{source_epsg}', f'EPSG:{target_epsg}', always_xy=True
        )
        geom_dict = json.loads(geojson_str)

        def transform_coords(coords):
            if isinstance(coords[0], (int, float)):
                x, y = transformer.transform(coords[0], coords[1])
                return [x, y]
            return [transform_coords(c) for c in coords]

        geom_dict['coordinates'] = transform_coords(geom_dict['coordinates'])
        return json.dumps(geom_dict)
    except ImportError:
        raise ImportError('pyproj is required for CRS reprojection.')


def parse_shapefile_zip(zip_path: str) -> list:
    """
    Parse a shapefile ZIP archive and return a list of dicts:
    [{'geometry': <GEOSGeometry in EPSG:4326>, 'properties': {...}}, ...]

    The ZIP must contain at least .shp, .shx, .dbf files.
    If the shapefile uses a CRS other than EPSG:4326, coordinates are
    reprojected via pyproj.
    """
    try:
        import fiona
        from shapely.geometry import shape, mapping
        from shapely.ops import transform as shapely_transform
        from pyproj import Transformer
    except ImportError as e:
        raise ImportError(
            f'fiona, shapely, and pyproj are required for shapefile parsing: {e}'
        )

    features = []

    with tempfile.TemporaryDirectory() as tmpdir:
        # Extract ZIP
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(tmpdir)

        # Find the .shp file
        shp_file = None
        for root, _dirs, files in os.walk(tmpdir):
            for fname in files:
                if fname.lower().endswith('.shp'):
                    shp_file = os.path.join(root, fname)
                    break
            if shp_file:
                break

        if not shp_file:
            raise ValueError('No .shp file found in the ZIP archive.')

        with fiona.open(shp_file) as src:
            src_crs   = src.crs
            epsg_code = None

            # Try to extract EPSG code
            if src_crs:
                try:
                    from pyproj import CRS as ProjCRS
                    crs_obj   = ProjCRS.from_dict(src_crs)
                    epsg_code = crs_obj.to_epsg()
                except Exception:
                    pass

            need_reproject = epsg_code is not None and epsg_code != 4326

            if need_reproject:
                transformer = Transformer.from_crs(
                    f'EPSG:{epsg_code}', 'EPSG:4326', always_xy=True
                )

            for feature in src:
                geom_shape = shape(feature['geometry'])

                if need_reproject:
                    geom_shape = shapely_transform(
                        transformer.transform, geom_shape
                    )

                geojson_str = json.dumps(mapping(geom_shape))
                geos_geom   = GEOSGeometry(geojson_str, srid=4326)
                features.append({
                    'geometry':   geos_geom,
                    'properties': dict(feature['properties']),
                })

    return features
