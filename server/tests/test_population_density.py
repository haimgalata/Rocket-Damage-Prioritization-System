import sys
import os

# הגדרת נתיב השורש כדי שפייתון ימצא את המודולים של ה-server
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
sys.path.append(project_root)

from server.src.services.gis.demographics.population_density import get_cbs_population_density


def run_test():
    # בדיקה בבני ברק - צפיפות גבוהה מאוד (אמורה להחזיר סביב 28,000)
    lat, lon = 32.058, 34.781

    print(f"--- Running Density Test for: {lat}, {lon} ---")
    density = get_cbs_population_density(lat, lon)

    if density > 0:
        print(f"✅ SUCCESS! Density found: {density} people/km2")
    elif density == 0:
        print(f"❌ FAILED: Returned 0. Check if JOIN_KEYs match or if point is in map.")
    else:
        print(f"⚠️ ERROR: Service returned -1.")


if __name__ == "__main__":
    run_test()