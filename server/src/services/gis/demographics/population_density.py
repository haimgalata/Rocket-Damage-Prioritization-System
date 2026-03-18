"""
Population density lookup using Israeli CBS (Central Bureau of Statistics) data.

Data sources (relative to the project root ``server/data/cbs_data/``):

- ``statistical_areas_2022.shp``  — CBS 2022 statistical-area polygons,
  originally in ITM (EPSG:2039), reprojected to WGS-84 (EPSG:4326) on load.
- ``population_info_2023.xlsx``   — CBS 2023 population counts per statistical
  area, keyed by an 8-digit composite code: ``YISHUV (4 digits) + SE (4 digits)``.

Join key construction:
    ``JOIN_KEY = str(CODE).zfill(4) + str(SE).zfill(4)``

Fallback logic:
    If the exact statistical-area row has no population figure (``NaN``),
    the city-level aggregate row (``SE = "0000"``) is used instead.
"""

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
import os


def get_cbs_population_density(lat: float, lon: float) -> float:
    """Look up the population density at a geographic point using CBS data.

    Performs a spatial join between the input coordinate and the CBS 2022
    statistical-area polygons, then retrieves the matching 2023 population
    figure from the Excel dataset to compute density (persons / km²).

    Processing steps:

    1. Locate ``statistical_areas_2022.shp`` and ``population_info_2023.xlsx``
       relative to this file's directory.
    2. Parse the Excel file, auto-detecting the header row by searching for
       the string ``"CODE"`` in the first 20 rows.
    3. Construct the 8-digit ``JOIN_KEY`` for every row.
    4. Merge the shapefile GeoDataFrame with the population DataFrame on
       ``JOIN_KEY``.
    5. Reproject the merged GeoDataFrame to WGS-84 (EPSG:4326) if needed.
    6. Perform a point-in-polygon query to find the statistical area that
       contains ``(lat, lon)``.
    7. Compute density as ``population / area_km²``.
    8. If the matched row has no population figure, fall back to the
       city-level aggregate (``SE = "0000"``).

    Args:
        lat (float): Latitude of the query point in decimal degrees
            (WGS-84 / EPSG:4326). Valid range: -90 to 90.
        lon (float): Longitude of the query point in decimal degrees
            (WGS-84 / EPSG:4326). Valid range: -180 to 180.

    Returns:
        float: Population density in persons per km², rounded to 2 decimal
            places.  Returns:

            - ``0.0``  if the data files are not found, the header row cannot
              be detected, the point falls outside all known statistical areas,
              or population/area data is missing.
            - ``-1``   if an unexpected exception occurs during processing
              (logged to stdout via ``print``).

    Note:
        The Excel file may contain Hebrew text in the ``SE`` column
        (e.g. ``'סה"כ'`` for city totals). The ``create_key`` inner function
        handles this by mapping totals to the ``"0000"`` suffix.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "..", "..", "..", ".."))
    data_path = os.path.join(project_root, "data", "cbs_data")

    shapefile_path = os.path.join(data_path, "statistical_areas_2022.shp")
    excel_path = os.path.join(data_path, "population_info_2023.xlsx")

    try:
        if not os.path.exists(shapefile_path) or not os.path.exists(excel_path):
            return 0.0

        # טעינת המפה
        gdf = gpd.read_file(shapefile_path)

        # טעינה חכמה של האקסל (מציאת השורה של CODE)
        xls = pd.ExcelFile(excel_path)
        sheet = xls.sheet_names[1] if len(xls.sheet_names) > 1 else xls.sheet_names[0]
        df_scan = xls.parse(sheet, nrows=20, header=None)

        header_idx = None
        for i, row in df_scan.iterrows():
            if "CODE" in [str(val).strip().upper() for val in row.values if pd.notna(val)]:
                header_idx = i
                break

        if header_idx is None: return 0.0

        df_pop = xls.parse(sheet, skiprows=header_idx)
        df_pop.columns = [str(c).strip().upper() for c in df_pop.columns]

        def create_key(row: pd.Series) -> str | None:
            """Build the 8-digit CBS join key for a single Excel row.

            Constructs the key as ``YISHUV (4 digits) + SE (4 digits)``.
            City-level aggregate rows (where ``SE`` is ``'סה"כ'``, empty, or
            ``NaN``) are mapped to ``"0000"`` for the SE portion so they can
            serve as fallbacks when the exact statistical-area row has no data.

            Args:
                row (pd.Series): A single row from the parsed population
                    DataFrame. Must contain at least the ``'CODE'`` column and
                    optionally the ``'SE'`` column.

            Returns:
                str | None: The 8-character join key (e.g. ``"00710424"``),
                    or ``None`` if the ``CODE`` value cannot be coerced to an
                    integer (malformed row).
            """
            try:
                yishuv = str(int(float(row['CODE']))).zfill(4)
                se_val = str(row.get('SE', '')).strip()
                # אם זה סה"כ או ריק -> 0000
                if "סה\"כ" in se_val or se_val.lower() in ["nan", ""]:
                    se_area = "0000"
                else:
                    se_area = str(int(float(se_val))).zfill(4)
                return yishuv + se_area
            except:
                return None

        df_pop['JOIN_KEY'] = df_pop.apply(create_key, axis=1)
        gdf['JOIN_KEY'] = gdf['YISHUV_STA'].astype(str).str.zfill(8)

        # מיזוג נתונים
        merged = gdf.merge(df_pop[['JOIN_KEY', 'POPULATION']], on='JOIN_KEY', how='left')

        # בדיקה גיאוגרפית
        if merged.crs != "EPSG:4326":
            merged = merged.to_crs(epsg=4326)

        point = Point(lon, lat)
        match = merged[merged.contains(point)]

        if not match.empty:
            row = match.iloc[0]
            pop = row['POPULATION']

            # --- מנגנון הגיבוי (Fallback) ---
            # אם השכונה (למשל 424) לא נמצאה באקסל, ניקח את סה"כ העיר (0000)
            if pd.isna(pop):
                city_key = row['JOIN_KEY'][:4] + "0000"
                city_row = df_pop[df_pop['JOIN_KEY'] == city_key]
                if not city_row.empty:
                    pop = city_row.iloc[0]['POPULATION']

            area_km2 = row['SHAPE_Area'] / 1_000_000
            if pd.isna(pop) or area_km2 == 0: return 0.0

            return round(pop / area_km2, 2)

        return 0.0
    except Exception as e:
        print(f"[ERROR] Logic failed: {e}")
        return -1