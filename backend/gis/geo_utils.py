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


def parse_kml_bytes(kml_bytes: bytes) -> list:
    """
    Parse KML XML and return [{'geometry': GEOSGeometry, 'properties': {...}}].

    Supports Placemark elements containing Point, LineString, Polygon (with
    optional inner rings), MultiGeometry, and gx:Track. Each placemark's
    <name> + <description> + <ExtendedData> simple key/value pairs are
    captured as properties. Coordinates are KML's "lng,lat[,alt] lng,lat ..."
    format, already in EPSG:4326.
    """
    import xml.etree.ElementTree as ET
    from django.contrib.gis.geos import GEOSGeometry
    import json as _json

    root = ET.fromstring(kml_bytes)

    # KML uses a default namespace — strip it for simpler queries
    def _strip_ns(elem):
        for el in elem.iter():
            if '}' in el.tag:
                el.tag = el.tag.split('}', 1)[1]
        return elem
    _strip_ns(root)

    def _parse_coords(text: str):
        out = []
        for tok in (text or '').split():
            parts = tok.split(',')
            if len(parts) < 2:
                continue
            try:
                out.append([float(parts[0]), float(parts[1])])
            except ValueError:
                continue
        return out

    def _geom_to_dict(node):
        tag = node.tag
        if tag == 'Point':
            coords = _parse_coords((node.findtext('coordinates') or '').strip())
            if coords:
                return {'type': 'Point', 'coordinates': coords[0]}
        elif tag == 'LineString':
            coords = _parse_coords((node.findtext('coordinates') or '').strip())
            if coords:
                return {'type': 'LineString', 'coordinates': coords}
        elif tag == 'LinearRing':
            coords = _parse_coords((node.findtext('coordinates') or '').strip())
            if coords:
                # Ensure ring closes
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                return {'type': 'Polygon', 'coordinates': [coords]}
        elif tag == 'Polygon':
            outer = node.find('.//outerBoundaryIs/LinearRing')
            outer_coords = _parse_coords((outer.findtext('coordinates') if outer is not None else '') or '')
            if not outer_coords:
                return None
            if outer_coords[0] != outer_coords[-1]:
                outer_coords.append(outer_coords[0])
            inners = []
            for inner_ring in node.findall('.//innerBoundaryIs/LinearRing'):
                ring = _parse_coords((inner_ring.findtext('coordinates') or ''))
                if ring:
                    if ring[0] != ring[-1]: ring.append(ring[0])
                    inners.append(ring)
            return {'type': 'Polygon', 'coordinates': [outer_coords, *inners]}
        elif tag == 'MultiGeometry':
            members = []
            for child in node:
                m = _geom_to_dict(child)
                if m: members.append(m)
            if not members:
                return None
            # Promote to the right multi-type when homogeneous
            types = {m['type'] for m in members}
            if types == {'Point'}:
                return {'type': 'MultiPoint', 'coordinates': [m['coordinates'] for m in members]}
            if types == {'LineString'}:
                return {'type': 'MultiLineString', 'coordinates': [m['coordinates'] for m in members]}
            if types == {'Polygon'}:
                return {'type': 'MultiPolygon', 'coordinates': [m['coordinates'] for m in members]}
            return {'type': 'GeometryCollection', 'geometries': members}
        return None

    def _properties_for(pm):
        props = {}
        name = pm.findtext('name')
        if name: props['name'] = name.strip()
        desc = pm.findtext('description')
        if desc: props['description'] = desc.strip()
        for data in pm.findall('.//ExtendedData/Data'):
            key = data.get('name')
            val = data.findtext('value')
            if key:
                props[key] = (val or '').strip()
        for data in pm.findall('.//ExtendedData/SimpleData'):
            key = data.get('name')
            if key:
                props[key] = (data.text or '').strip()
        return props

    features = []
    for placemark in root.iter('Placemark'):
        # The geometry is the first non-metadata child that we recognise
        for child in placemark:
            geom = _geom_to_dict(child)
            if geom:
                geos_geom = GEOSGeometry(_json.dumps(geom), srid=4326)
                features.append({
                    'geometry': geos_geom,
                    'properties': _properties_for(placemark),
                })
                break
    return features


def parse_kmz_file(kmz_path: str) -> list:
    """Open a KMZ (zipped KML), find the first .kml inside, parse it."""
    with zipfile.ZipFile(kmz_path, 'r') as zf:
        kml_name = next(
            (n for n in zf.namelist() if n.lower().endswith('.kml')),
            None,
        )
        if not kml_name:
            raise ValueError('KMZ archive contains no .kml file.')
        return parse_kml_bytes(zf.read(kml_name))


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
