/**
 * GCC Extended Geofences Seed — FirstCity AI Fleet Management
 * Adds 8–10 realistic geofences per tenant for all 6 GCC companies.
 *
 * Run AFTER gcc_data.js: node src/seeds/gcc_geofences.js
 */
require('dotenv').config();
const { pool } = require('../db');

const poly = (rings) => {
  const pts = rings.map(([lng, lat]) => `${lng} ${lat}`).join(',');
  return `ST_SetSRID(ST_GeomFromText('POLYGON((${pts}))'), 4326)`;
};

// Helper: build a rectangular box geofence polygon [lng, lat] center + half-widths
function box(lng, lat, dLng, dLat) {
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

const TENANTS_GEOFENCES = [

  // ── 1. Naqel Express — Saudi Arabia ─────────────────────────────────────────
  {
    tenantSlug: 'naqel-express',
    geofences: [
      {
        name: 'Riyadh Central Distribution Hub',
        desc: 'Main Naqel sorting and dispatch facility — King Abdullah Road',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 20,
        coords: box(46.7132, 24.6877, 0.012, 0.008),
      },
      {
        name: 'Jeddah Islamic Port Terminal',
        desc: 'Sea cargo intake and customs clearance area',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 15,
        coords: box(39.1107, 21.5433, 0.018, 0.010),
      },
      {
        name: 'Riyadh Second Industrial City Depot',
        desc: 'Secondary warehouse and last-mile hub',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 25,
        coords: box(46.8850, 24.5500, 0.015, 0.010),
      },
      {
        name: 'King Khalid International Airport — Cargo',
        desc: 'Air freight intake zone — restricted airside access',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 30,
        coords: box(46.6983, 24.9578, 0.020, 0.012),
      },
      {
        name: 'KAFD Financial District Delivery Zone',
        desc: 'Last-mile delivery area for King Abdullah Financial District',
        color: '#10b981', zone_type: 'delivery', speed_limit: 40,
        coords: box(46.6200, 24.7670, 0.010, 0.008),
      },
      {
        name: 'Dammam Industrial Port',
        desc: 'Eastern Province cargo terminal — King Fahd Port',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 20,
        coords: box(50.1026, 26.4367, 0.020, 0.015),
      },
      {
        name: 'Al Kharj Highway Checkpoint',
        desc: 'Transit checkpoint on Riyadh–Al Kharj corridor',
        color: '#c084fc', zone_type: 'transit', speed_limit: 80,
        coords: box(47.3200, 24.1500, 0.025, 0.010),
      },
      {
        name: 'Mecca Gate Restricted Zone',
        desc: 'Entry checkpoint for Makkah — non-Muslim vehicle restriction',
        color: '#ef4444', zone_type: 'restricted', speed_limit: null,
        coords: box(39.7200, 21.4200, 0.030, 0.020),
      },
      {
        name: 'Riyadh Ring Road Speed Corridor',
        desc: 'Highway speed monitoring zone — Northern Ring Road',
        color: '#6366f1', zone_type: 'speed_zone', speed_limit: 120,
        coords: box(46.7500, 24.8100, 0.040, 0.008),
      },
      {
        name: 'Medina Distribution Centre',
        desc: 'Last-mile hub serving Al Madinah Al Munawwarah',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(39.6142, 24.5247, 0.015, 0.010),
      },
    ],
  },

  // ── 2. ENOC Fleet Management — UAE ──────────────────────────────────────────
  {
    tenantSlug: 'enoc-fleet',
    geofences: [
      {
        name: 'Jebel Ali Free Zone — Gate 1',
        desc: 'Primary entry/exit for JAFZA logistics operations',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 30,
        coords: box(55.0500, 24.9950, 0.025, 0.015),
      },
      {
        name: 'Dubai Airport Free Zone (DAFZA)',
        desc: 'Air cargo and express logistics hub adjacent to DXB',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 40,
        coords: box(55.3644, 25.2510, 0.018, 0.012),
      },
      {
        name: 'Al Quoz Industrial Area 4',
        desc: 'ENOC bulk fuel storage and tanker dispatch depot',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 25,
        coords: box(55.2250, 25.1490, 0.015, 0.010),
      },
      {
        name: 'Al Maktoum International Airport Cargo',
        desc: 'DWC cargo terminal — largest airport logistics zone in UAE',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 30,
        coords: box(55.1625, 24.8963, 0.030, 0.020),
      },
      {
        name: 'Dubai Silicon Oasis Technology Park',
        desc: 'Tech corridor deliveries and scheduled fuel stops',
        color: '#10b981', zone_type: 'delivery', speed_limit: 40,
        coords: box(55.3791, 25.1181, 0.015, 0.010),
      },
      {
        name: 'Sharjah Industrial Area 1',
        desc: 'Cross-emirate operations hub — Sharjah',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(55.3780, 25.3290, 0.018, 0.012),
      },
      {
        name: 'Dubai Marina / JBR Delivery Zone',
        desc: 'Last-mile residential and hospitality deliveries',
        color: '#10b981', zone_type: 'delivery', speed_limit: 30,
        coords: box(55.1340, 25.0790, 0.010, 0.008),
      },
      {
        name: 'Mina Rashid Port Complex',
        desc: 'Sea cargo handling — Rashid Port and cruise terminal',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 20,
        coords: box(55.2780, 25.2290, 0.020, 0.012),
      },
      {
        name: 'Sheikh Zayed Road Speed Corridor',
        desc: 'SZR highway monitoring — E11 between Interchange 1–5',
        color: '#6366f1', zone_type: 'speed_zone', speed_limit: 120,
        coords: box(55.2000, 25.1700, 0.010, 0.030),
      },
      {
        name: 'Abu Dhabi Industrial City (ICAD)',
        desc: 'ENOC fuel tanker operations in Abu Dhabi sector',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(54.4820, 24.2630, 0.025, 0.015),
      },
    ],
  },

  // ── 3. Q-Logistics — Qatar ───────────────────────────────────────────────────
  {
    tenantSlug: 'q-logistics',
    geofences: [
      {
        name: 'Hamad Port — Container Terminal',
        desc: 'Qatar\'s main deep-water seaport — all freight entry',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 20,
        coords: box(51.5500, 25.1100, 0.025, 0.018),
      },
      {
        name: 'Ras Laffan Industrial City',
        desc: 'LNG and petrochemical logistics zone — restricted access',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 30,
        coords: box(51.5700, 25.8800, 0.040, 0.030),
      },
      {
        name: 'Doha Industrial Area (Salwa Road)',
        desc: 'Central industrial belt — warehousing and distribution',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 40,
        coords: box(51.4600, 25.2400, 0.020, 0.015),
      },
      {
        name: 'Hamad International Airport Cargo',
        desc: 'QR Cargo terminal — airside freight operations',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 30,
        coords: box(51.6069, 25.2732, 0.025, 0.015),
      },
      {
        name: 'Mesaieed Industrial City',
        desc: 'Petrochemical port zone — tanker and bulk cargo',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 25,
        coords: box(51.5600, 24.9700, 0.030, 0.020),
      },
      {
        name: 'Doha West Bay Business District',
        desc: 'Corporate delivery zone — office towers and hotels',
        color: '#10b981', zone_type: 'delivery', speed_limit: 40,
        coords: box(51.5310, 25.3290, 0.012, 0.010),
      },
      {
        name: 'Al Wakrah Distribution Hub',
        desc: 'Southern Qatar last-mile distribution centre',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(51.6040, 25.1680, 0.015, 0.010),
      },
      {
        name: 'Salwa Border Crossing Checkpoint',
        desc: 'Saudi–Qatar land border transit zone',
        color: '#c084fc', zone_type: 'transit', speed_limit: 60,
        coords: box(50.8350, 24.7200, 0.030, 0.015),
      },
      {
        name: 'Doha Expressway Speed Zone',
        desc: 'Al Shamal Road speed monitoring — northern expressway',
        color: '#6366f1', zone_type: 'speed_zone', speed_limit: 100,
        coords: box(51.5200, 25.4000, 0.012, 0.040),
      },
    ],
  },

  // ── 4. Asyad Group — Oman ────────────────────────────────────────────────────
  {
    tenantSlug: 'asyad-group',
    geofences: [
      {
        name: 'Port Sultan Qaboos — Cargo Terminal',
        desc: 'Oman\'s primary port for general cargo and containers',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 20,
        coords: box(58.5800, 23.6300, 0.022, 0.015),
      },
      {
        name: 'Sohar Industrial Port',
        desc: 'Sohar Free Zone and port complex — northern Oman',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 25,
        coords: box(56.7200, 24.3400, 0.030, 0.020),
      },
      {
        name: 'Salalah Multimodal Port',
        desc: 'Southern Oman hub — transshipment and container operations',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 20,
        coords: box(54.0050, 16.9400, 0.025, 0.018),
      },
      {
        name: 'Muscat International Airport Cargo',
        desc: 'Oman Air Cargo terminal — OIFC air freight',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 30,
        coords: box(58.2840, 23.5932, 0.020, 0.012),
      },
      {
        name: 'Rusayl Industrial Estate',
        desc: 'Muscat Industrial Estate — warehousing and manufacturing deliveries',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 40,
        coords: box(58.1750, 23.5600, 0.018, 0.012),
      },
      {
        name: 'Barka Industrial Area',
        desc: 'Al Batinah coast — petrochem and industrial supplies',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(57.8800, 23.6700, 0.020, 0.015),
      },
      {
        name: 'Muscat CBD Delivery Zone',
        desc: 'Last-mile deliveries in Muscat downtown and Ruwi',
        color: '#10b981', zone_type: 'delivery', speed_limit: 40,
        coords: box(58.5930, 23.6140, 0.010, 0.008),
      },
      {
        name: 'Al Batinah Coastal Corridor',
        desc: 'Highway speed monitoring — Muscat to Sohar expressway',
        color: '#6366f1', zone_type: 'speed_zone', speed_limit: 120,
        coords: box(57.5000, 23.9000, 0.010, 0.080),
      },
      {
        name: 'Nizwa Distribution Hub',
        desc: 'Interior Oman regional distribution — Nizwa hub',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(57.5302, 22.9333, 0.018, 0.012),
      },
      {
        name: 'UAE–Oman Border (Hatta/Wajajah)',
        desc: 'Cross-border transit checkpoint — UAE–Oman',
        color: '#c084fc', zone_type: 'transit', speed_limit: 60,
        coords: box(56.1100, 24.0800, 0.030, 0.020),
      },
    ],
  },

  // ── 5. Agility Logistics — Kuwait ────────────────────────────────────────────
  {
    tenantSlug: 'agility-logistics',
    geofences: [
      {
        name: 'Shuwaikh Industrial Port',
        desc: 'Kuwait\'s main general cargo seaport',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 20,
        coords: box(47.9400, 29.3700, 0.020, 0.015),
      },
      {
        name: 'Kuwait International Airport Cargo',
        desc: 'Air cargo terminal — Kuwait Airways Cargo and freight forwarders',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 30,
        coords: box(47.9690, 29.2268, 0.025, 0.015),
      },
      {
        name: 'Mina Al Ahmadi Oil Terminal',
        desc: 'KPC petroleum export terminal — tanker operations zone',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 20,
        coords: box(48.1450, 29.0750, 0.025, 0.018),
      },
      {
        name: 'Fahaheel Industrial Area',
        desc: 'Southern Kuwait industrial deliveries and warehousing',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 40,
        coords: box(48.1300, 29.0800, 0.015, 0.010),
      },
      {
        name: 'Shuwaikh Free Trade Zone',
        desc: 'FTZ warehousing — customs-bonded operations',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 25,
        coords: box(47.9200, 29.3500, 0.018, 0.012),
      },
      {
        name: 'Jahra Distribution Centre',
        desc: 'Northern Kuwait regional hub — Al Jahra Governorate',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(47.6680, 29.3370, 0.020, 0.015),
      },
      {
        name: 'Kuwait City CBD Deliveries',
        desc: 'Central Kuwait City last-mile delivery zone',
        color: '#10b981', zone_type: 'delivery', speed_limit: 40,
        coords: box(47.9783, 29.3697, 0.012, 0.010),
      },
      {
        name: 'Subbiyah Logistics Park',
        desc: 'New logistics and industrial park — Subbiyah area',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(47.7500, 29.5500, 0.025, 0.018),
      },
      {
        name: 'Gulf Road Speed Corridor',
        desc: 'Arabian Gulf Street highway monitoring — coastal expressway',
        color: '#6366f1', zone_type: 'speed_zone', speed_limit: 100,
        coords: box(48.0000, 29.3400, 0.008, 0.050),
      },
    ],
  },

  // ── 6. Bahrain Logistics Zone ────────────────────────────────────────────────
  {
    tenantSlug: 'blz-bahrain',
    geofences: [
      {
        name: 'Khalifa Bin Salman Port — Main Terminal',
        desc: 'BLZ primary seaport — container and ro-ro terminal',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 20,
        coords: box(50.6300, 26.2050, 0.025, 0.018),
      },
      {
        name: 'Bahrain Logistics Zone (BLZ) Core Area',
        desc: 'Free zone warehousing and 3PL operations centre',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(50.6200, 26.2300, 0.020, 0.015),
      },
      {
        name: 'Bahrain International Airport Cargo',
        desc: 'BIA cargo apron — Gulf Air Cargo and express freight',
        color: '#f59e0b', zone_type: 'restricted', speed_limit: 30,
        coords: box(50.6350, 26.2700, 0.022, 0.015),
      },
      {
        name: 'Hidd Industrial Area',
        desc: 'ALBA and BAPCO supply-chain logistics — Hidd zone',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 40,
        coords: box(50.6500, 26.2200, 0.018, 0.012),
      },
      {
        name: 'Bahrain International Investment Park (BIIP)',
        desc: 'BIIP industrial estate — manufacturing and logistics',
        color: '#00d4e8', zone_type: 'warehouse', speed_limit: 30,
        coords: box(50.5400, 26.1700, 0.020, 0.015),
      },
      {
        name: 'Sitra Industrial Zone',
        desc: 'BAPCO oil refinery supply corridor — Sitra Island',
        color: '#ef4444', zone_type: 'restricted', speed_limit: 25,
        coords: box(50.6200, 26.1500, 0.018, 0.012),
      },
      {
        name: 'Manama CBD Delivery Zone',
        desc: 'Central Manama commercial delivery — SEEF and Diplomatic Area',
        color: '#10b981', zone_type: 'delivery', speed_limit: 40,
        coords: box(50.5860, 26.2154, 0.010, 0.008),
      },
      {
        name: 'King Fahd Causeway Border',
        desc: 'Saudi–Bahrain causeway cross-border transit zone',
        color: '#c084fc', zone_type: 'transit', speed_limit: 80,
        coords: box(50.4500, 26.1700, 0.030, 0.015),
      },
      {
        name: 'Riffa / Southern Manama Deliveries',
        desc: 'Last-mile delivery zone — southern Bahrain residential',
        color: '#10b981', zone_type: 'delivery', speed_limit: 50,
        coords: box(50.5550, 26.1300, 0.015, 0.012),
      },
    ],
  },
];

async function seedGeofences() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('\n📍 Seeding extended GCC geofences...\n');

    let totalAdded = 0;

    for (const T of TENANTS_GEOFENCES) {
      // Resolve tenant_id from slug
      const tenantRes = await client.query(
        'SELECT id FROM tenants WHERE slug=$1', [T.tenantSlug]
      );
      if (!tenantRes.rows[0]) {
        console.warn(`  ⚠️  Tenant "${T.tenantSlug}" not found — skipping`);
        continue;
      }
      const tenantId = tenantRes.rows[0].id;

      let added = 0;
      for (const g of T.geofences) {
        // Skip if geofence with same name already exists for this tenant
        const exists = await client.query(
          'SELECT id FROM geofences WHERE tenant_id=$1 AND name=$2',
          [tenantId, g.name]
        );
        if (exists.rows[0]) continue;

        await client.query(`
          INSERT INTO geofences
            (tenant_id, name, description, color, zone_type, boundary,
             alert_on_enter, alert_on_exit, speed_limit, is_active)
          VALUES ($1,$2,$3,$4,$5,${poly(g.coords)},true,true,$6,true)
        `, [tenantId, g.name, g.desc, g.color, g.zone_type, g.speed_limit ?? null]);
        added++;
      }

      console.log(`  ✅ ${T.tenantSlug.padEnd(25)} +${added} geofences`);
      totalAdded += added;
    }

    await client.query('COMMIT');
    console.log(`\n✅ Done — ${totalAdded} geofences added across all tenants\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedGeofences();
