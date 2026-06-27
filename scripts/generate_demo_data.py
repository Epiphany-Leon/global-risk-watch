"""Generate the bundled demo dataset (``data/demo_countries.csv``).

The figures below are *illustrative* round numbers for ~30 economies, used only
to make the demo map meaningful. They are NOT an authoritative dataset. Risk
scores are intentionally left out so the app demonstrates :mod:`core.risk_model`
deriving them at load time.

Run:  python scripts/generate_demo_data.py
"""
from __future__ import annotations

import csv
import os

# country, iso3, gdp_billion_usd, population_million, inflation%, unemployment%,
# external_debt_gni_pct (blank where not meaningful), latitude, longitude
ROWS = [
    ("United States", "USA", 27360, 334.0, 4.1, 3.6, "", 38.90, -77.04),
    ("China", "CHN", 17790, 1412.0, 0.2, 5.2, 14, 39.90, 116.40),
    ("Japan", "JPN", 4210, 124.5, 3.3, 2.6, "", 35.68, 139.69),
    ("Germany", "DEU", 4460, 84.0, 5.9, 3.0, "", 52.52, 13.40),
    ("India", "IND", 3550, 1428.0, 5.7, 7.1, 19, 28.61, 77.21),
    ("United Kingdom", "GBR", 3340, 67.0, 6.8, 4.0, "", 51.51, -0.13),
    ("France", "FRA", 3030, 68.0, 4.9, 7.3, "", 48.85, 2.35),
    ("Italy", "ITA", 2250, 59.0, 5.6, 7.6, "", 41.90, 12.50),
    ("Brazil", "BRA", 2170, 216.0, 4.6, 8.0, 34, -15.79, -47.88),
    ("Canada", "CAN", 2140, 40.0, 3.9, 5.4, "", 45.42, -75.70),
    ("Russia", "RUS", 2020, 144.0, 5.9, 3.2, 18, 55.75, 37.62),
    ("Mexico", "MEX", 1790, 128.0, 5.5, 2.8, 30, 19.43, -99.13),
    ("South Korea", "KOR", 1710, 51.7, 3.6, 2.7, "", 37.57, 126.98),
    ("Australia", "AUS", 1690, 26.0, 5.6, 3.7, "", -35.28, 149.13),
    ("Spain", "ESP", 1580, 48.0, 3.5, 12.1, "", 40.42, -3.70),
    ("Indonesia", "IDN", 1370, 277.0, 3.7, 5.3, 39, -6.21, 106.85),
    ("Netherlands", "NLD", 1120, 17.8, 4.1, 3.5, "", 52.37, 4.90),
    ("Saudi Arabia", "SAU", 1070, 36.0, 2.5, 5.6, "", 24.63, 46.72),
    ("Switzerland", "CHE", 870, 8.8, 2.1, 2.0, "", 46.95, 7.45),
    ("Poland", "POL", 810, 38.0, 11.4, 2.9, 55, 52.23, 21.01),
    ("Turkey", "TUR", 1110, 85.0, 53.9, 9.4, 50, 39.93, 32.85),
    ("Sweden", "SWE", 590, 10.5, 6.0, 7.5, "", 59.33, 18.07),
    ("Norway", "NOR", 530, 5.5, 5.5, 3.6, "", 59.91, 10.75),
    ("Vietnam", "VNM", 430, 98.0, 3.3, 2.3, 38, 21.03, 105.85),
    ("Egypt", "EGY", 396, 112.0, 33.7, 7.2, 38, 30.04, 31.24),
    ("Nigeria", "NGA", 390, 223.0, 24.7, 4.1, 14, 9.06, 7.49),
    ("Pakistan", "PAK", 340, 240.0, 29.2, 6.3, 35, 33.69, 73.06),
    ("South Africa", "ZAF", 380, 60.0, 5.9, 32.1, 40, -25.75, 28.19),
    ("Argentina", "ARG", 640, 46.0, 133.5, 6.2, 45, -34.60, -58.38),
    ("Greece", "GRC", 240, 10.4, 4.2, 11.1, "", 37.98, 23.73),
    ("Sri Lanka", "LKA", 84, 22.0, 17.4, 5.5, 65, 6.93, 79.85),
    ("Venezuela", "VEN", 100, 28.0, 190.0, 5.5, 160, 10.49, -66.90),
]

HEADER = [
    "iso_code", "country", "gdp_billion_usd", "population_million",
    "inflation_rate", "unemployment_rate", "external_debt_gni_pct",
    "latitude", "longitude",
]


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "demo_countries.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(HEADER)
        for (name, iso, gdp, pop, inf, unemp, debt, lat, lon) in ROWS:
            writer.writerow([iso, name, gdp, pop, inf, unemp, debt, lat, lon])
    print(f"✅ Wrote {len(ROWS)} rows -> {out_path}")


if __name__ == "__main__":
    main()
