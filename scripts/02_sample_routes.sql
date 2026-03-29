-- ============================================================
-- Sample Routes for All Tenants
-- Run after the migration
-- ============================================================

DO $$
DECLARE
  t RECORD;
  lahore_routes TEXT[][] := ARRAY[
    ARRAY['Canal Road Route', '#00d4e8', 'LINESTRING(74.3285 31.5204, 74.3450 31.5310, 74.3620 31.5410, 74.3780 31.5520, 74.3950 31.5630)'],
    ARRAY['GT Road Express', '#22c55e', 'LINESTRING(74.2985 31.5604, 74.3150 31.5550, 74.3350 31.5490, 74.3580 31.5420, 74.3850 31.5360)'],
    ARRAY['DHA Circuit', '#f59e0b', 'LINESTRING(74.3920 31.4820, 74.4050 31.4780, 74.4200 31.4850, 74.4150 31.4950, 74.4000 31.4980, 74.3870 31.4910)'],
    ARRAY['Gulberg Shuttle', '#a78bfa', 'LINESTRING(74.3380 31.5070, 74.3450 31.5120, 74.3530 31.5160, 74.3610 31.5140, 74.3680 31.5090)'],
    ARRAY['Airport Connector', '#ef4444', 'LINESTRING(74.3310 31.5210, 74.3500 31.5340, 74.3700 31.5460, 74.3900 31.5560, 74.4100 31.5640, 74.4240 31.5200)'],
    ARRAY['Township Loop', '#fb923c', 'LINESTRING(74.2950 31.5000, 74.3100 31.5050, 74.3200 31.5100, 74.3150 31.5180, 74.3000 31.5150, 74.2920 31.5080)']
  ];
  riyadh_routes TEXT[][] := ARRAY[
    ARRAY['King Fahad Highway', '#00d4e8', 'LINESTRING(46.6753 24.7136, 46.6920 24.7250, 46.7100 24.7380, 46.7280 24.7490, 46.7450 24.7600)'],
    ARRAY['Olaya Street Route', '#22c55e', 'LINESTRING(46.6580 24.6900, 46.6700 24.7000, 46.6800 24.7100, 46.6900 24.7200, 46.7000 24.7300)'],
    ARRAY['Airport Road Express', '#f59e0b', 'LINESTRING(46.7200 24.7500, 46.7350 24.7620, 46.7500 24.7740, 46.7650 24.7860, 46.7800 24.7970)'],
    ARRAY['Diplomatic Quarter Loop', '#a78bfa', 'LINESTRING(46.5900 24.6800, 46.6000 24.6900, 46.6100 24.6850, 46.6050 24.6750, 46.5950 24.6700)'],
    ARRAY['Industrial Area Route', '#ef4444', 'LINESTRING(46.7500 24.6500, 46.7650 24.6600, 46.7800 24.6700, 46.7950 24.6800)'],
    ARRAY['Ring Road Circuit', '#fb923c', 'LINESTRING(46.6200 24.6300, 46.6500 24.6200, 46.6800 24.6300, 46.6900 24.6500, 46.6700 24.6700, 46.6400 24.6600)']
  ];
  dubai_routes TEXT[][] := ARRAY[
    ARRAY['Sheikh Zayed Road', '#00d4e8', 'LINESTRING(55.1344 25.0760, 55.1500 25.0900, 55.1700 25.1050, 55.1900 25.1200, 55.2100 25.1350)'],
    ARRAY['Downtown Loop', '#22c55e', 'LINESTRING(55.2700 25.1972, 55.2780 25.2040, 55.2850 25.2100, 55.2800 25.2180, 55.2720 25.2150, 55.2650 25.2080)'],
    ARRAY['Jumeirah Beach Road', '#f59e0b', 'LINESTRING(55.1800 25.1300, 55.1950 25.1450, 55.2100 25.1600, 55.2250 25.1750, 55.2400 25.1900)'],
    ARRAY['Dubai Marina Route', '#a78bfa', 'LINESTRING(55.1400 25.0800, 55.1480 25.0880, 55.1560 25.0950, 55.1480 25.1020, 55.1400 25.0960)'],
    ARRAY['Deira Express', '#ef4444', 'LINESTRING(55.3000 25.2700, 55.3150 25.2800, 55.3300 25.2870, 55.3450 25.2940)'],
    ARRAY['Al Quoz Industrial', '#fb923c', 'LINESTRING(55.2100 25.1400, 55.2200 25.1320, 55.2300 25.1250, 55.2400 25.1350)']
  ];
  route_set TEXT[][];
  route_row TEXT[];
  i INTEGER;
BEGIN
  FOR t IN SELECT id, city FROM tenants WHERE is_active = true LOOP
    -- Select routes based on tenant city
    IF t.city ILIKE '%riyadh%' OR t.city ILIKE '%saudi%' THEN
      route_set := riyadh_routes;
    ELSIF t.city ILIKE '%dubai%' OR t.city ILIKE '%uae%' THEN
      route_set := dubai_routes;
    ELSE
      route_set := lahore_routes; -- default
    END IF;

    FOR i IN 1..array_length(route_set, 1) LOOP
      route_row := route_set[i];
      INSERT INTO routes (tenant_id, name, color, path, is_active)
      VALUES (
        t.id,
        route_row[1],
        route_row[2],
        ST_SetSRID(ST_GeomFromText(route_row[3]), 4326),
        true
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
