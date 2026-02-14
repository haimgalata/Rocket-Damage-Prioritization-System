import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
import os


def get_cbs_population_density(lat, lon):
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

        # פונקציה חסינה ליצירת מפתח (4+4 ספרות)
        def create_key(row):
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