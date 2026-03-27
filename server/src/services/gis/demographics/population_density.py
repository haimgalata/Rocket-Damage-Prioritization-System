import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
import os
import logging

logger = logging.getLogger(__name__)

_gdf = None
_df_pop = None
_pop_col = None


def _get_data_path() -> tuple[str, str]:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "..", "..", "..", ".."))
    data_path = os.path.join(project_root, "data", "cbs_data")
    return (
        os.path.join(data_path, "statistical_areas_2022.shp"),
        os.path.join(data_path, "population_info_2023.xlsx"),
    )


def preload_population_data() -> None:
    """Load CBS shapefile and population Excel into memory once at startup."""
    global _gdf, _df_pop, _pop_col

    shapefile_path, excel_path = _get_data_path()
    if not os.path.exists(shapefile_path) or not os.path.exists(excel_path):
        logger.warning("[CBS] Data files not found — population density will return 0.0")
        return

    try:
        logger.info("[CBS] Loading shapefile...")
        _gdf = gpd.read_file(shapefile_path)

        def to_8_digit(val):
            try:
                if pd.isna(val) or str(val).strip() == "":
                    return None
                return str(int(float(str(val).replace('"', '').strip()))).zfill(8)
            except Exception:
                return None

        _gdf['JOIN_KEY'] = _gdf['YISHUV_STA'].apply(to_8_digit)

        logger.info("[CBS] Loading population Excel...")
        xls = pd.ExcelFile(excel_path)
        sheet = xls.sheet_names[1] if len(xls.sheet_names) > 1 else xls.sheet_names[0]
        _df_pop = xls.parse(sheet, skiprows=6)
        _df_pop.columns = [str(c).strip().upper() for c in _df_pop.columns]

        _pop_col = next(
            (c for c in _df_pop.columns if 'POPULATION' in c or 'אוכלוסייה' in c),
            None,
        )

        def create_excel_neighborhood_key(row):
            try:
                yishuv = str(int(float(row['CODE']))).zfill(4)
                se_val = str(row.get('SE', '')).strip().replace('"', '')
                if any(x in se_val for x in ["סה", "SA", "nan", ""]) or se_val == "0":
                    se_code = "0000"
                else:
                    se_code = str(int(float(se_val))).zfill(4)
                return yishuv + se_code
            except Exception:
                return None

        _df_pop['JOIN_KEY'] = _df_pop.apply(create_excel_neighborhood_key, axis=1)
        logger.info("[CBS] Population data preloaded successfully.")
    except Exception as exc:
        logger.error(f"[CBS] Preload failed: {exc}")
        _gdf = None
        _df_pop = None
        _pop_col = None


def get_cbs_population_density(lat: float, lon: float) -> float:
    """Return population density (persons/km²) at the given coordinate."""
    global _gdf, _df_pop, _pop_col

    if _gdf is None:
        preload_population_data()

    if _gdf is None or _df_pop is None or _pop_col is None:
        return 0.0

    try:
        point_wgs = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326")
        point_local = point_wgs.to_crs(_gdf.crs).iloc[0]
        match = _gdf[_gdf.contains(point_local)]

        if not match.empty:
            neighborhood_row = match.iloc[0]
            target_key = neighborhood_row['JOIN_KEY']

            pop_match = _df_pop[_df_pop['JOIN_KEY'] == target_key]
            if not pop_match.empty and pd.notna(pop_match[_pop_col].iloc[0]):
                pop = float(pop_match[_pop_col].iloc[0])
                area_km2 = neighborhood_row['SHAPE_Area'] / 1_000_000
                return round(pop / area_km2, 2)

            yishuv_code = target_key[:4]
            city_pop_row = _df_pop[_df_pop['JOIN_KEY'] == yishuv_code + "0000"]
            if not city_pop_row.empty:
                city_pop = float(city_pop_row[_pop_col].iloc[0])
                city_area_m2 = _gdf[_gdf['JOIN_KEY'].str.startswith(yishuv_code)]['SHAPE_Area'].sum()
                if city_area_m2 > 0:
                    return round(city_pop / (city_area_m2 / 1_000_000), 2)

        return 0.0
    except Exception as exc:
        logger.error(f"[CBS] Density lookup failed: {exc}")
        return 0.0
