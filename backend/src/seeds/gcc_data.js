/**
 * GCC Sample Data Seed — FirstCity AI Fleet Management
 * Tenants: Naqel Express · ENOC Fleet · Q-Logistics · Asyad Group · Agility Logistics · BLZ
 *
 * Run: node src/seeds/gcc_data.js
 * Password for all tenant admin/operator accounts: Fleet@2024
 */
require('dotenv').config();
const { pool } = require('../db');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
const pt = (lng, lat) => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

function poly(rings) {
  const pts = rings.map(([lng, lat]) => `${lng} ${lat}`).join(',');
  return `ST_SetSRID(ST_GeomFromText('POLYGON((${pts}))'), 4326)`;
}

function near([lng, lat], spread = 0.04) {
  return [
    +(lng + (Math.random() - 0.5) * spread).toFixed(5),
    +(lat + (Math.random() - 0.5) * spread).toFixed(5),
  ];
}

function randBetween(a, b) { return +(a + Math.random() * (b - a)).toFixed(2); }
function randInt(a, b)     { return Math.floor(a + Math.random() * (b - a)); }
function ago(mins)         { return `NOW() - INTERVAL '${mins} minutes'`; }
function daysAgo(d)        { return `NOW() - INTERVAL '${d} days'`; }

// ─────────────────────────────────────────────────────────────────────────────
// TENANT DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const TENANTS = [

  // ── 1. Naqel Express — Saudi Arabia ────────────────────────────────────────
  {
    id:           'a0000001-0000-0000-0000-000000000001',
    name:         'Naqel Express',
    slug:         'naqel-express',
    country:      'Saudi Arabia',
    city:         'Riyadh',
    address:      'King Abdullah Road, Riyadh 12382',
    phone:        '+966-11-478-9000',
    email:        'fleet@naqel.com.sa',
    website:      'https://www.naqel.com.sa',
    plan:         'enterprise',
    max_vehicles: 200,
    max_users:    50,
    center:       [46.7132, 24.6877],   // Riyadh
    center2:      [39.1925, 21.4858],   // Jeddah
    prefix:       'SA-NQL',
    phonePrefix:  '+966-5',

    depots: [
      { name: 'Riyadh Central Distribution Hub',   address: 'King Abdullah Road, Riyadh',          coords: [46.7132, 24.6877] },
      { name: 'Jeddah Islamic Port Depot',          address: 'King Fahd Causeway, Jeddah Port',     coords: [39.1107, 21.5433] },
      { name: 'Riyadh Second Industrial City',      address: '2nd Industrial City, Riyadh',         coords: [46.8850, 24.5500] },
    ],

    drivers: [
      { emp:'NQL-001', name:'Mohammed Al-Ghamdi',     phone:'+966-50-1234567', lic:'SA-LIC-NQL-001', score:94 },
      { emp:'NQL-002', name:'Abdullah Al-Qahtani',    phone:'+966-50-2345678', lic:'SA-LIC-NQL-002', score:88 },
      { emp:'NQL-003', name:'Khalid Al-Dosari',       phone:'+966-50-3456789', lic:'SA-LIC-NQL-003', score:72 },
      { emp:'NQL-004', name:'Omar Al-Otaibi',         phone:'+966-50-4567890', lic:'SA-LIC-NQL-004', score:96 },
      { emp:'NQL-005', name:'Saleh Al-Shehri',        phone:'+966-55-5678901', lic:'SA-LIC-NQL-005', score:81 },
      { emp:'NQL-006', name:'Fahad Al-Mutairi',       phone:'+966-55-6789012', lic:'SA-LIC-NQL-006', score:63 },
      { emp:'NQL-007', name:'Turki Al-Zahrani',       phone:'+966-55-7890123', lic:'SA-LIC-NQL-007', score:91 },
      { emp:'NQL-008', name:'Ahmad Al-Harbi',         phone:'+966-55-8901234', lic:'SA-LIC-NQL-008', score:85 },
      { emp:'NQL-009', name:'Abdulrahman Al-Asiri',   phone:'+966-56-9012345', lic:'SA-LIC-NQL-009', score:78 },
      { emp:'NQL-010', name:'Saad Al-Maliki',         phone:'+966-56-0123456', lic:'SA-LIC-NQL-010', score:90 },
      { emp:'NQL-011', name:'Nawaf Al-Subaie',        phone:'+966-56-1234567', lic:'SA-LIC-NQL-011', score:67 },
      { emp:'NQL-012', name:'Faris Al-Enezi',         phone:'+966-56-2345678', lic:'SA-LIC-NQL-012', score:83 },
    ],

    vehicles: [
      { reg:'SA-NQL-001', make:'Isuzu',      model:'NPR 75L',    year:2022, type:'truck',  color:'White',   fuel_cap:90,  max_speed:100, payload:3000 },
      { reg:'SA-NQL-002', make:'Hino',       model:'300 Series', year:2023, type:'truck',  color:'Blue',    fuel_cap:100, max_speed:110, payload:3500 },
      { reg:'SA-NQL-003', make:'Mercedes',   model:'Actros 1845',year:2021, type:'heavy',  color:'White',   fuel_cap:400, max_speed:90,  payload:24000 },
      { reg:'SA-NQL-004', make:'Volvo',      model:'FH 500',     year:2022, type:'heavy',  color:'Gray',    fuel_cap:500, max_speed:90,  payload:25000 },
      { reg:'SA-NQL-005', make:'Toyota',     model:'Hiace',      year:2023, type:'van',    color:'White',   fuel_cap:65,  max_speed:150, payload:1200 },
      { reg:'SA-NQL-006', make:'Ford',       model:'Transit 350',year:2022, type:'van',    color:'White',   fuel_cap:80,  max_speed:140, payload:1500 },
      { reg:'SA-NQL-007', make:'MAN',        model:'TGS 26.440', year:2021, type:'heavy',  color:'Orange',  fuel_cap:450, max_speed:85,  payload:18000 },
      { reg:'SA-NQL-008', make:'Mitsubishi', model:'Canter FE',  year:2023, type:'truck',  color:'White',   fuel_cap:75,  max_speed:105, payload:2500 },
      { reg:'SA-NQL-009', make:'Isuzu',      model:'ELF 250',    year:2022, type:'truck',  color:'Yellow',  fuel_cap:85,  max_speed:100, payload:2800 },
      { reg:'SA-NQL-010', make:'Toyota',     model:'Land Cruiser',year:2023,type:'car',    color:'White',   fuel_cap:93,  max_speed:180, payload:500 },
      { reg:'SA-NQL-011', make:'Hino',       model:'500 FC',     year:2021, type:'heavy',  color:'Red',     fuel_cap:200, max_speed:95,  payload:8000 },
      { reg:'SA-NQL-012', make:'Nissan',     model:'Cabstar 35T',year:2022, type:'truck',  color:'Blue',    fuel_cap:70,  max_speed:100, payload:2200 },
    ],

    geofences: [
      { name:'Riyadh Distribution Zone',    desc:'Central Riyadh delivery area',        color:'#00d4e8', zone_type:'delivery',   coords:[[46.65,24.65],[46.78,24.65],[46.78,24.73],[46.65,24.73],[46.65,24.65]] },
      { name:'Jeddah Port Restricted Area', desc:'Port of Jeddah — vehicles must check in', color:'#ef4444', zone_type:'restricted', coords:[[39.08,21.51],[39.15,21.51],[39.15,21.57],[39.08,21.57],[39.08,21.51]] },
      { name:'Riyadh Industrial City 2',    desc:'2nd Industrial City delivery zone',    color:'#a3e635', zone_type:'warehouse',   coords:[[46.86,24.52],[46.91,24.52],[46.91,24.58],[46.86,24.58],[46.86,24.52]] },
      { name:'King Fahd Road Corridor',     desc:'Main arterial route speed zone',       color:'#f59e0b', zone_type:'speed_zone',  coords:[[46.67,24.67],[46.75,24.67],[46.75,24.72],[46.67,24.72],[46.67,24.67]] },
    ],

    users: [
      { email:'admin@naqel-fleet.com',    name:'Naqel Fleet Admin',    role:'admin' },
      { email:'ops@naqel-fleet.com',      name:'Naqel Operations',     role:'operator' },
      { email:'viewer@naqel-fleet.com',   name:'Naqel Viewer',         role:'viewer' },
    ],
  },

  // ── 2. ENOC Fleet Management — UAE (Dubai) ──────────────────────────────────
  {
    id:           'a0000002-0000-0000-0000-000000000002',
    name:         'ENOC Fleet Management',
    slug:         'enoc-fleet',
    country:      'UAE',
    city:         'Dubai',
    address:      'ENOC House, Sheikh Zayed Road, Dubai',
    phone:        '+971-4-337-0000',
    email:        'fleet@enoc.com',
    website:      'https://www.enoc.com',
    plan:         'enterprise',
    max_vehicles: 150,
    max_users:    40,
    center:       [55.2708, 25.2048],   // Dubai
    center2:      [55.3780, 25.0750],   // Dubai South / Jebel Ali
    prefix:       'DXB-ENO',
    phonePrefix:  '+971-5',

    depots: [
      { name:'Jebel Ali Fuel Depot',          address:'Jebel Ali Free Zone, Dubai',         coords:[55.1282, 24.9857] },
      { name:'Al Quoz Industrial Hub',         address:'Al Quoz Industrial Area 4, Dubai',   coords:[55.2350, 25.1425] },
      { name:'Dubai South Logistics City',     address:'Dubai South, DWC',                   coords:[55.1635, 24.8900] },
    ],

    drivers: [
      { emp:'ENO-001', name:'Mohammed Al-Mansoori',  phone:'+971-50-1234567', lic:'UAE-LIC-ENO-001', score:97 },
      { emp:'ENO-002', name:'Khalid Al-Maktoum',     phone:'+971-50-2345678', lic:'UAE-LIC-ENO-002', score:89 },
      { emp:'ENO-003', name:'Sultan Al-Nuaimi',      phone:'+971-55-3456789', lic:'UAE-LIC-ENO-003', score:75 },
      { emp:'ENO-004', name:'Hamdan Al-Falasi',      phone:'+971-55-4567890', lic:'UAE-LIC-ENO-004', score:93 },
      { emp:'ENO-005', name:'Rashid Al-Shamsi',      phone:'+971-56-5678901', lic:'UAE-LIC-ENO-005', score:82 },
      { emp:'ENO-006', name:'Ahmad Al-Mazrouei',     phone:'+971-56-6789012', lic:'UAE-LIC-ENO-006', score:68 },
      { emp:'ENO-007', name:'Saeed Al-Kaabi',        phone:'+971-52-7890123', lic:'UAE-LIC-ENO-007', score:91 },
      { emp:'ENO-008', name:'Obaid Al-Shamsi',       phone:'+971-52-8901234', lic:'UAE-LIC-ENO-008', score:86 },
      { emp:'ENO-009', name:'Bader Al-Ketbi',        phone:'+971-54-9012345', lic:'UAE-LIC-ENO-009', score:79 },
      { emp:'ENO-010', name:'Marwan Al-Muhairi',     phone:'+971-54-0123456', lic:'UAE-LIC-ENO-010', score:95 },
    ],

    vehicles: [
      { reg:'DXB-ENO-001', make:'Volvo',      model:'FM 460 Tanker',   year:2023, type:'heavy', color:'Red',    fuel_cap:600, max_speed:90,  payload:30000 },
      { reg:'DXB-ENO-002', make:'Mercedes',   model:'Actros 2545',     year:2022, type:'heavy', color:'White',  fuel_cap:500, max_speed:90,  payload:25000 },
      { reg:'DXB-ENO-003', make:'MAN',        model:'TGX 26.500',      year:2023, type:'heavy', color:'Red',    fuel_cap:550, max_speed:90,  payload:26000 },
      { reg:'DXB-ENO-004', make:'Toyota',     model:'Land Cruiser 200',year:2023, type:'car',   color:'White',  fuel_cap:93,  max_speed:180, payload:600 },
      { reg:'DXB-ENO-005', make:'Ford',       model:'F-250 Super Duty',year:2022, type:'truck', color:'White',  fuel_cap:135, max_speed:160, payload:1400 },
      { reg:'DXB-ENO-006', make:'Isuzu',      model:'NPR 75H',         year:2022, type:'truck', color:'White',  fuel_cap:90,  max_speed:100, payload:3200 },
      { reg:'DXB-ENO-007', make:'Hino',       model:'500 FC 1027',     year:2021, type:'heavy', color:'Blue',   fuel_cap:200, max_speed:95,  payload:10000 },
      { reg:'DXB-ENO-008', make:'Nissan',     model:'Patrol Safari',   year:2023, type:'car',   color:'Silver', fuel_cap:95,  max_speed:200, payload:600 },
      { reg:'DXB-ENO-009', make:'Mercedes',   model:'Sprinter 516',    year:2023, type:'van',   color:'White',  fuel_cap:75,  max_speed:140, payload:1600 },
      { reg:'DXB-ENO-010', make:'Volvo',      model:'FH 500 Tanker',   year:2022, type:'heavy', color:'Red',    fuel_cap:600, max_speed:90,  payload:30000 },
    ],

    geofences: [
      { name:'Jebel Ali Port Zone',       desc:'JAFZA — all vehicles must log entry',   color:'#00d4e8', zone_type:'restricted',  coords:[[55.06,24.97],[55.16,24.97],[55.16,25.02],[55.06,25.02],[55.06,24.97]] },
      { name:'Sheikh Zayed Road Corridor',desc:'SZR speed compliance zone',             color:'#f59e0b', zone_type:'speed_zone',   coords:[[55.17,25.09],[55.27,25.09],[55.27,25.18],[55.17,25.18],[55.17,25.09]] },
      { name:'Al Quoz Delivery Zone',     desc:'Industrial delivery area',              color:'#a3e635', zone_type:'delivery',     coords:[[55.22,25.13],[55.25,25.13],[55.25,25.16],[55.22,25.16],[55.22,25.13]] },
      { name:'Dubai South Logistics Hub', desc:'DWC & Dubai South logistics area',      color:'#c084fc', zone_type:'warehouse',    coords:[[55.14,24.87],[55.20,24.87],[55.20,24.92],[55.14,24.92],[55.14,24.87]] },
    ],

    users: [
      { email:'admin@enoc-fleet.com',     name:'ENOC Fleet Admin',     role:'admin' },
      { email:'ops@enoc-fleet.com',       name:'ENOC Operations',      role:'operator' },
      { email:'viewer@enoc-fleet.com',    name:'ENOC Viewer',          role:'viewer' },
    ],
  },

  // ── 3. Q-Logistics (Qatar Logistics) — Qatar ────────────────────────────────
  {
    id:           'a0000003-0000-0000-0000-000000000003',
    name:         'Qatar Logistics (Q-Logistics)',
    slug:         'q-logistics',
    country:      'Qatar',
    city:         'Doha',
    address:      'Salwa Road Industrial Area, Doha, Qatar',
    phone:        '+974-4452-0000',
    email:        'fleet@qlogistics.com.qa',
    website:      'https://www.qlogistics.qa',
    plan:         'pro',
    max_vehicles: 80,
    max_users:    25,
    center:       [51.5310, 25.2854],   // Doha
    center2:      [51.5588, 25.2100],   // Doha Industrial Area
    prefix:       'QAT-QLG',
    phonePrefix:  '+974-5',

    depots: [
      { name:'Doha Industrial Area Hub',     address:'Industrial Area Zone 23, Doha',     coords:[51.5330, 25.2490] },
      { name:'Hamad Port Logistics Centre',  address:'Hamad Port, New Port, Qatar',       coords:[51.5588, 24.9600] },
      { name:'Mesaieed Industrial Depot',    address:'Mesaieed Industrial City, Qatar',   coords:[51.5500, 24.9900] },
    ],

    drivers: [
      { emp:'QLG-001', name:'Abdullah Al-Kuwari',   phone:'+974-55-1234567', lic:'QA-LIC-QLG-001', score:93 },
      { emp:'QLG-002', name:'Mohammed Al-Thani',    phone:'+974-55-2345678', lic:'QA-LIC-QLG-002', score:87 },
      { emp:'QLG-003', name:'Khalid Al-Marri',      phone:'+974-66-3456789', lic:'QA-LIC-QLG-003', score:74 },
      { emp:'QLG-004', name:'Jassim Al-Buainain',   phone:'+974-66-4567890', lic:'QA-LIC-QLG-004', score:91 },
      { emp:'QLG-005', name:'Hamad Al-Dosari',      phone:'+974-50-5678901', lic:'QA-LIC-QLG-005', score:80 },
      { emp:'QLG-006', name:'Ali Al-Sulaiti',       phone:'+974-50-6789012', lic:'QA-LIC-QLG-006', score:65 },
      { emp:'QLG-007', name:'Nasser Al-Kuwari',     phone:'+974-33-7890123', lic:'QA-LIC-QLG-007', score:88 },
      { emp:'QLG-008', name:'Tariq Al-Qahtani',     phone:'+974-33-8901234', lic:'QA-LIC-QLG-008', score:77 },
    ],

    vehicles: [
      { reg:'QAT-QLG-001', make:'Toyota',     model:'Dyna 150',       year:2022, type:'truck', color:'White',  fuel_cap:70,  max_speed:110, payload:2000 },
      { reg:'QAT-QLG-002', make:'Hino',       model:'300 Dutro',      year:2023, type:'truck', color:'Blue',   fuel_cap:80,  max_speed:100, payload:3000 },
      { reg:'QAT-QLG-003', make:'Mercedes',   model:'Actros 1836',    year:2021, type:'heavy', color:'White',  fuel_cap:420, max_speed:90,  payload:20000 },
      { reg:'QAT-QLG-004', make:'Ford',       model:'Transit Custom', year:2023, type:'van',   color:'White',  fuel_cap:60,  max_speed:140, payload:1100 },
      { reg:'QAT-QLG-005', make:'Isuzu',      model:'NPR 71H',        year:2022, type:'truck', color:'White',  fuel_cap:85,  max_speed:100, payload:2800 },
      { reg:'QAT-QLG-006', make:'MAN',        model:'TGM 18.250',     year:2022, type:'heavy', color:'Gray',   fuel_cap:300, max_speed:95,  payload:12000 },
      { reg:'QAT-QLG-007', make:'Toyota',     model:'Land Cruiser 79',year:2023, type:'truck', color:'White',  fuel_cap:93,  max_speed:160, payload:1000 },
      { reg:'QAT-QLG-008', make:'Nissan',     model:'Cabstar 35T',    year:2021, type:'truck', color:'Yellow', fuel_cap:70,  max_speed:95,  payload:2200 },
    ],

    geofences: [
      { name:'Doha Industrial Area',      desc:'Industrial zone speed and access control', color:'#00d4e8', zone_type:'restricted',  coords:[[51.51,25.22],[51.55,25.22],[51.55,25.27],[51.51,25.27],[51.51,25.22]] },
      { name:'Hamad Port Entry Zone',     desc:'Port of Hamad — mandatory check-in',       color:'#ef4444', zone_type:'restricted',  coords:[[51.54,24.94],[51.58,24.94],[51.58,24.98],[51.54,24.98],[51.54,24.94]] },
      { name:'Salwa Road Corridor',       desc:'Main logistics corridor',                  color:'#f59e0b', zone_type:'speed_zone',  coords:[[51.47,25.23],[51.53,25.23],[51.53,25.26],[51.47,25.26],[51.47,25.23]] },
    ],

    users: [
      { email:'admin@qlogistics-fleet.com', name:'Q-Logistics Admin',    role:'admin' },
      { email:'ops@qlogistics-fleet.com',   name:'Q-Logistics Operations',role:'operator' },
    ],
  },

  // ── 4. Asyad Group — Oman (Muscat) ─────────────────────────────────────────
  {
    id:           'a0000004-0000-0000-0000-000000000004',
    name:         'Asyad Group',
    slug:         'asyad-group',
    country:      'Oman',
    city:         'Muscat',
    address:      'Al Khuwair Business District, Muscat, Oman',
    phone:        '+968-2456-0000',
    email:        'fleet@asyad.om',
    website:      'https://www.asyad.om',
    plan:         'enterprise',
    max_vehicles: 120,
    max_users:    35,
    center:       [58.5922, 23.5880],   // Muscat
    center2:      [58.1450, 23.5760],   // Rusayl Industrial
    prefix:       'MCT-ASY',
    phonePrefix:  '+968-9',

    depots: [
      { name:'Port Sultan Qaboos Hub',       address:'Port Sultan Qaboos, Old Muscat',      coords:[58.5642, 23.6100] },
      { name:'Rusayl Industrial Depot',      address:'Rusayl Industrial Estate, Muscat',    coords:[58.1450, 23.5760] },
      { name:'Sohar Port Logistics',         address:'Sohar Port & Freezone, Oman',         coords:[56.6300, 24.3400] },
    ],

    drivers: [
      { emp:'ASY-001', name:'Ahmed Al-Balushi',    phone:'+968-91-1234567', lic:'OM-LIC-ASY-001', score:92 },
      { emp:'ASY-002', name:'Mohammed Al-Hinai',   phone:'+968-91-2345678', lic:'OM-LIC-ASY-002', score:85 },
      { emp:'ASY-003', name:'Khalid Al-Farsi',     phone:'+968-92-3456789', lic:'OM-LIC-ASY-003', score:71 },
      { emp:'ASY-004', name:'Saif Al-Riyami',      phone:'+968-92-4567890', lic:'OM-LIC-ASY-004', score:94 },
      { emp:'ASY-005', name:'Abdullah Al-Maskari', phone:'+968-93-5678901', lic:'OM-LIC-ASY-005', score:83 },
      { emp:'ASY-006', name:'Hassan Al-Nabhani',   phone:'+968-93-6789012', lic:'OM-LIC-ASY-006', score:69 },
      { emp:'ASY-007', name:'Salim Al-Harthi',     phone:'+968-94-7890123', lic:'OM-LIC-ASY-007', score:90 },
      { emp:'ASY-008', name:'Omar Al-Rashdi',      phone:'+968-94-8901234', lic:'OM-LIC-ASY-008', score:78 },
      { emp:'ASY-009', name:'Badr Al-Kindi',       phone:'+968-95-9012345', lic:'OM-LIC-ASY-009', score:87 },
      { emp:'ASY-010', name:'Nasser Al-Wahaibi',   phone:'+968-95-0123456', lic:'OM-LIC-ASY-010', score:73 },
    ],

    vehicles: [
      { reg:'MCT-ASY-001', make:'Volvo',      model:'FH 460',          year:2022, type:'heavy', color:'White',   fuel_cap:500, max_speed:90,  payload:25000 },
      { reg:'MCT-ASY-002', make:'Scania',     model:'R 500',           year:2023, type:'heavy', color:'Blue',    fuel_cap:480, max_speed:90,  payload:24000 },
      { reg:'MCT-ASY-003', make:'Mercedes',   model:'Actros 2553',     year:2021, type:'heavy', color:'White',   fuel_cap:450, max_speed:90,  payload:26000 },
      { reg:'MCT-ASY-004', make:'Toyota',     model:'Land Cruiser 200',year:2023, type:'car',   color:'White',   fuel_cap:93,  max_speed:180, payload:600 },
      { reg:'MCT-ASY-005', make:'Hino',       model:'700 Series',      year:2022, type:'heavy', color:'Orange',  fuel_cap:300, max_speed:90,  payload:20000 },
      { reg:'MCT-ASY-006', make:'Isuzu',      model:'NPS 75L-S',       year:2022, type:'truck', color:'White',   fuel_cap:95,  max_speed:100, payload:3200 },
      { reg:'MCT-ASY-007', make:'Ford',       model:'F-350 Super',     year:2023, type:'truck', color:'Silver',  fuel_cap:135, max_speed:160, payload:1500 },
      { reg:'MCT-ASY-008', make:'Nissan',     model:'UD Quon GW 26',   year:2021, type:'heavy', color:'White',   fuel_cap:350, max_speed:90,  payload:18000 },
      { reg:'MCT-ASY-009', make:'Mitsubishi', model:'Fuso Super Great',year:2022, type:'heavy', color:'Red',     fuel_cap:300, max_speed:90,  payload:22000 },
      { reg:'MCT-ASY-010', make:'Toyota',     model:'Hilux Double Cab',year:2023, type:'truck', color:'White',   fuel_cap:80,  max_speed:165, payload:1000 },
    ],

    geofences: [
      { name:'Port Sultan Qaboos Area',  desc:'Main port — all vehicles require access log', color:'#ef4444', zone_type:'restricted', coords:[[58.54,23.60],[58.59,23.60],[58.59,23.63],[58.54,23.63],[58.54,23.60]] },
      { name:'Rusayl Industrial Zone',   desc:'Industrial estate delivery area',             color:'#00d4e8', zone_type:'warehouse',   coords:[[58.11,23.55],[58.18,23.55],[58.18,23.60],[58.11,23.60],[58.11,23.55]] },
      { name:'Muscat Expressway Route',  desc:'Expressway speed compliance',                 color:'#f59e0b', zone_type:'speed_zone',  coords:[[58.39,23.55],[58.52,23.55],[58.52,23.60],[58.39,23.60],[58.39,23.55]] },
      { name:'Sohar Port Logistics Hub', desc:'Sohar Freezone access zone',                  color:'#a3e635', zone_type:'delivery',    coords:[[56.60,24.31],[56.65,24.31],[56.65,24.37],[56.60,24.37],[56.60,24.31]] },
    ],

    users: [
      { email:'admin@asyad-fleet.om',    name:'Asyad Fleet Admin',    role:'admin' },
      { email:'ops@asyad-fleet.om',      name:'Asyad Operations',     role:'operator' },
    ],
  },

  // ── 5. Agility Logistics — Kuwait ───────────────────────────────────────────
  {
    id:           'a0000005-0000-0000-0000-000000000005',
    name:         'Agility Logistics',
    slug:         'agility-logistics',
    country:      'Kuwait',
    city:         'Kuwait City',
    address:      'Shuwaikh Industrial Area, Kuwait City',
    phone:        '+965-2221-0000',
    email:        'fleet@agility.com.kw',
    website:      'https://www.agility.com',
    plan:         'enterprise',
    max_vehicles: 100,
    max_users:    30,
    center:       [47.9424, 29.3682],   // Shuwaikh
    center2:      [47.9635, 29.3000],   // Kuwait City South
    prefix:       'KWT-AGL',
    phonePrefix:  '+965-5',

    depots: [
      { name:'Shuwaikh Industrial Hub',      address:'Shuwaikh Industrial, Kuwait City',  coords:[47.9424, 29.3682] },
      { name:'Mina Abdullah Port Depot',     address:'Mina Abdullah Port, Kuwait',        coords:[48.1500, 29.0400] },
      { name:'Sulaibiya Logistics Park',     address:'Sulaibiya Industrial Area, Kuwait', coords:[47.8800, 29.3200] },
    ],

    drivers: [
      { emp:'AGL-001', name:'Mohammed Al-Aneezi',  phone:'+965-55-1234567', lic:'KW-LIC-AGL-001', score:91 },
      { emp:'AGL-002', name:'Abdullah Al-Rashidi', phone:'+965-55-2345678', lic:'KW-LIC-AGL-002', score:84 },
      { emp:'AGL-003', name:'Fahad Al-Azemi',      phone:'+965-66-3456789', lic:'KW-LIC-AGL-003', score:70 },
      { emp:'AGL-004', name:'Khaled Al-Mutairi',   phone:'+965-66-4567890', lic:'KW-LIC-AGL-004', score:95 },
      { emp:'AGL-005', name:'Ahmad Al-Ajmi',       phone:'+965-50-5678901', lic:'KW-LIC-AGL-005', score:82 },
      { emp:'AGL-006', name:'Saleh Al-Harbi',      phone:'+965-50-6789012', lic:'KW-LIC-AGL-006', score:66 },
      { emp:'AGL-007', name:'Meshal Al-Sabah',     phone:'+965-51-7890123', lic:'KW-LIC-AGL-007', score:89 },
      { emp:'AGL-008', name:'Bader Al-Shammari',   phone:'+965-51-8901234', lic:'KW-LIC-AGL-008', score:76 },
    ],

    vehicles: [
      { reg:'KWT-AGL-001', make:'Mercedes', model:'Actros 2648',      year:2022, type:'heavy', color:'White',  fuel_cap:450, max_speed:90, payload:24000 },
      { reg:'KWT-AGL-002', make:'Volvo',    model:'FM 420',           year:2023, type:'heavy', color:'Blue',   fuel_cap:480, max_speed:90, payload:22000 },
      { reg:'KWT-AGL-003', make:'Toyota',   model:'Land Cruiser 76',  year:2023, type:'truck', color:'White',  fuel_cap:93,  max_speed:160,payload:1200 },
      { reg:'KWT-AGL-004', make:'Hino',     model:'500 FC 1124',      year:2022, type:'heavy', color:'Orange', fuel_cap:250, max_speed:95, payload:11000 },
      { reg:'KWT-AGL-005', make:'Isuzu',    model:'NPR 75L',          year:2022, type:'truck', color:'White',  fuel_cap:90,  max_speed:100,payload:3000 },
      { reg:'KWT-AGL-006', make:'Ford',     model:'Transit 470 HD',   year:2023, type:'van',   color:'White',  fuel_cap:80,  max_speed:140,payload:1500 },
      { reg:'KWT-AGL-007', make:'MAN',      model:'TGS 26.440',       year:2021, type:'heavy', color:'Gray',   fuel_cap:400, max_speed:85, payload:18000 },
      { reg:'KWT-AGL-008', make:'Nissan',   model:'Patrol PickUp',    year:2023, type:'car',   color:'White',  fuel_cap:95,  max_speed:200,payload:700 },
    ],

    geofences: [
      { name:'Shuwaikh Industrial Zone',  desc:'Main industrial area — 40km/h limit',    color:'#00d4e8', zone_type:'speed_zone',  coords:[[47.90,29.35],[47.97,29.35],[47.97,29.39],[47.90,29.39],[47.90,29.35]] },
      { name:'Mina Abdullah Port',        desc:'Port entry — mandatory pre-clearance',   color:'#ef4444', zone_type:'restricted',  coords:[[48.12,29.02],[48.18,29.02],[48.18,29.07],[48.12,29.07],[48.12,29.02]] },
      { name:'Ring Road Corridor',        desc:'Outer ring road route',                  color:'#f59e0b', zone_type:'speed_zone',  coords:[[47.92,29.32],[47.98,29.32],[47.98,29.36],[47.92,29.36],[47.92,29.32]] },
    ],

    users: [
      { email:'admin@agility-fleet.kw',   name:'Agility Fleet Admin',   role:'admin' },
      { email:'ops@agility-fleet.kw',     name:'Agility Operations',    role:'operator' },
    ],
  },

  // ── 6. Bahrain Logistics Zone Operators — Bahrain ───────────────────────────
  {
    id:           'a0000006-0000-0000-0000-000000000006',
    name:         'Bahrain Logistics Zone',
    slug:         'blz-operators',
    country:      'Bahrain',
    city:         'Manama',
    address:      'Bahrain Logistics Zone, Khalifa Bin Salman Port',
    phone:        '+973-1732-0000',
    email:        'fleet@blz.com.bh',
    website:      'https://www.blz.com.bh',
    plan:         'pro',
    max_vehicles: 60,
    max_users:    20,
    center:       [50.6199, 26.2285],   // Manama Industrial
    center2:      [50.6550, 26.2150],   // Khalifa Port
    prefix:       'BAH-BLZ',
    phonePrefix:  '+973-3',

    depots: [
      { name:'Khalifa Bin Salman Port Hub',  address:'Khalifa Bin Salman Port, Hidd',     coords:[50.6550, 26.2150] },
      { name:'BLZ Logistics Centre',         address:'Bahrain Logistics Zone, Area 4',    coords:[50.6199, 26.2285] },
      { name:'Bahrain International Airport Cargo', address:'BIA Cargo Terminal, Muharraq', coords:[50.6336, 26.2690] },
    ],

    drivers: [
      { emp:'BLZ-001', name:'Mohammed Al-Dosari',    phone:'+973-36-1234567', lic:'BH-LIC-BLZ-001', score:90 },
      { emp:'BLZ-002', name:'Khalid Al-Khalifa',     phone:'+973-36-2345678', lic:'BH-LIC-BLZ-002', score:83 },
      { emp:'BLZ-003', name:'Ahmad Al-Zayani',       phone:'+973-33-3456789', lic:'BH-LIC-BLZ-003', score:73 },
      { emp:'BLZ-004', name:'Abdullah Al-Jaber',     phone:'+973-33-4567890', lic:'BH-LIC-BLZ-004', score:88 },
      { emp:'BLZ-005', name:'Hamad Al-Noaimi',       phone:'+973-32-5678901', lic:'BH-LIC-BLZ-005', score:79 },
      { emp:'BLZ-006', name:'Ali Al-Marzouk',        phone:'+973-32-6789012', lic:'BH-LIC-BLZ-006', score:64 },
      { emp:'BLZ-007', name:'Hassan Al-Hammadi',     phone:'+973-38-7890123', lic:'BH-LIC-BLZ-007', score:86 },
      { emp:'BLZ-008', name:'Yousuf Al-Zayed',       phone:'+973-38-8901234', lic:'BH-LIC-BLZ-008', score:75 },
    ],

    vehicles: [
      { reg:'BAH-BLZ-001', make:'Toyota',   model:'Dyna 200',         year:2022, type:'truck', color:'White',  fuel_cap:70,  max_speed:110, payload:2500 },
      { reg:'BAH-BLZ-002', make:'Hino',     model:'300 Dutro 110',    year:2023, type:'truck', color:'Blue',   fuel_cap:80,  max_speed:100, payload:3000 },
      { reg:'BAH-BLZ-003', make:'Mercedes', model:'Sprinter 519',     year:2023, type:'van',   color:'White',  fuel_cap:75,  max_speed:140, payload:1700 },
      { reg:'BAH-BLZ-004', make:'Ford',     model:'Transit 350 HD',   year:2022, type:'van',   color:'White',  fuel_cap:80,  max_speed:140, payload:1500 },
      { reg:'BAH-BLZ-005', make:'Isuzu',    model:'NPR 65E',          year:2022, type:'truck', color:'White',  fuel_cap:85,  max_speed:100, payload:2800 },
      { reg:'BAH-BLZ-006', make:'Toyota',   model:'Land Cruiser 200', year:2023, type:'car',   color:'Silver', fuel_cap:93,  max_speed:180, payload:600 },
      { reg:'BAH-BLZ-007', make:'Mitsubishi',model:'Canter FE 84',   year:2022, type:'truck', color:'White',  fuel_cap:75,  max_speed:100, payload:2200 },
      { reg:'BAH-BLZ-008', make:'Nissan',   model:'Cabstar 35T',      year:2021, type:'truck', color:'Yellow', fuel_cap:70,  max_speed:95,  payload:2000 },
    ],

    geofences: [
      { name:'Khalifa Port Secured Zone', desc:'Port entry control — badge required',     color:'#ef4444', zone_type:'restricted', coords:[[50.63,26.20],[50.68,26.20],[50.68,26.24],[50.63,26.24],[50.63,26.20]] },
      { name:'BLZ Logistics Area',        desc:'Bahrain Logistics Zone perimeter',        color:'#00d4e8', zone_type:'warehouse',   coords:[[50.60,26.22],[50.64,26.22],[50.64,26.25],[50.60,26.25],[50.60,26.22]] },
      { name:'BIA Cargo Terminal',        desc:'Airport cargo — airside adjacent',        color:'#c084fc', zone_type:'restricted',  coords:[[50.62,26.26],[50.65,26.26],[50.65,26.28],[50.62,26.28],[50.62,26.26]] },
    ],

    users: [
      { email:'admin@blz-fleet.bh',      name:'BLZ Fleet Admin',      role:'admin' },
      { email:'ops@blz-fleet.bh',        name:'BLZ Operations',       role:'operator' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ALERT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
const ALERT_TEMPLATES = [
  { type:'speeding',           severity:'critical', title:'Speed Limit Exceeded',    msg:(v,s)=>`${v} recorded ${s} km/h — speed limit exceeded.` },
  { type:'geofence_exit',      severity:'warning',  title:'Geofence Boundary Breach', msg:(v)=>`${v} exited assigned delivery zone perimeter.` },
  { type:'geofence_enter',     severity:'info',     title:'Geofence Entry Detected',  msg:(v)=>`${v} entered restricted area. Access logged.` },
  { type:'harsh_braking',      severity:'warning',  title:'Harsh Braking Event',      msg:(v)=>`${v} triggered harsh braking detection.` },
  { type:'harsh_acceleration', severity:'warning',  title:'Harsh Acceleration',       msg:(v)=>`${v} — abrupt acceleration recorded.` },
  { type:'idle_timeout',       severity:'info',     title:'Extended Idle Detected',   msg:(v)=>`${v} has been idling for over 20 minutes.` },
  { type:'low_fuel',           severity:'warning',  title:'Low Fuel Warning',         msg:(v)=>`${v} fuel level dropped below 15%.` },
  { type:'maintenance_due',    severity:'warning',  title:'Maintenance Due',          msg:(v)=>`${v} is due for scheduled service — 500 km overdue.` },
  { type:'sos',                severity:'critical', title:'SOS Emergency Alert',      msg:(v)=>`${v} driver triggered SOS emergency button.` },
  { type:'fatigue',            severity:'critical', title:'Driver Fatigue Warning',   msg:(v)=>`${v} continuous driving exceeded 4.5 hours.` },
  { type:'offline',            severity:'info',     title:'Vehicle Went Offline',     msg:(v)=>`${v} GPS signal lost — last known location recorded.` },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SEEDER
// ─────────────────────────────────────────────────────────────────────────────
async function seedGCC() {
  const client = await pool.connect();
  try {
    // ALTER TYPE ADD VALUE must run OUTSIDE a transaction
    const maintVals = ['oil_change','tire_rotation','brake_service','annual_inspection','inspection','general'];
    for (const v of maintVals) {
      try {
        await client.query(`ALTER TYPE maintenance_type ADD VALUE IF NOT EXISTS '${v}'`);
      } catch (_) { /* column is VARCHAR, not enum — skip */ }
    }

    await client.query('BEGIN');
    console.log('\n🌍 Seeding GCC Fleet Data...\n');

    const pwdHash = await bcrypt.hash('Fleet@2024', 10);

    // ── 0. Schema guards (add columns / tables that may not exist yet) ──────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         VARCHAR(255) NOT NULL,
        slug         VARCHAR(100) UNIQUE NOT NULL,
        country      VARCHAR(100),
        city         VARCHAR(100),
        address      TEXT,
        phone        VARCHAR(50),
        email        VARCHAR(255),
        website      VARCHAR(255),
        plan         VARCHAR(50) DEFAULT 'pro',
        max_vehicles INTEGER DEFAULT 50,
        max_users    INTEGER DEFAULT 20,
        is_active    BOOLEAN DEFAULT true,
        settings     JSONB DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const addCol = async (tbl, col, def) => {
      await client.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
    };

    await addCol('users',     'tenant_id',           'UUID REFERENCES tenants(id) ON DELETE SET NULL');
    await addCol('users',     'phone',                'VARCHAR(50)');
    await addCol('depots',    'tenant_id',            'UUID REFERENCES tenants(id) ON DELETE CASCADE');
    await addCol('depots',    'city',                 'VARCHAR(100)');
    await addCol('depots',    'manager',              'VARCHAR(255)');
    await addCol('depots',    'phone',                'VARCHAR(50)');
    await addCol('drivers',   'tenant_id',            'UUID REFERENCES tenants(id) ON DELETE CASCADE');
    await addCol('drivers',   'license_class',        'VARCHAR(20)');
    await addCol('drivers',   'emergency_contact',    'VARCHAR(255)');
    await addCol('vehicles',  'tenant_id',            'UUID REFERENCES tenants(id) ON DELETE CASCADE');
    await addCol('vehicles',  'fuel_type',            "VARCHAR(20) DEFAULT 'diesel'");
    await addCol('vehicles',  'seats',                'SMALLINT');
    await addCol('vehicles',  'insurance_expiry',     'DATE');
    await addCol('vehicles',  'registration_expiry',  'DATE');
    await addCol('vehicles',  'purchase_date',        'DATE');
    await addCol('vehicles',  'notes',                'TEXT');
    await addCol('geofences', 'tenant_id',            'UUID REFERENCES tenants(id) ON DELETE CASCADE');
    await addCol('geofences', 'zone_type',            "VARCHAR(50) DEFAULT 'delivery'");
    await addCol('alerts',    'tenant_id',            'UUID REFERENCES tenants(id) ON DELETE CASCADE');
    await addCol('trips',     'tenant_id',            'UUID REFERENCES tenants(id) ON DELETE CASCADE');
    await addCol('maintenance','tenant_id',           'UUID REFERENCES tenants(id) ON DELETE CASCADE');

    // Ensure unique constraints exist (may be missing if DB was partially migrated)
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_license_number_uniq ON drivers(license_number)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_employee_id_uniq    ON drivers(employee_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_registration_uniq  ON vehicles(registration)`);

    console.log('  ✓ Schema guards applied');

    // ── 1. Superadmin (if not exists) ───────────────────────────────────────
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, is_active)
      VALUES ('superadmin@cloudnext.com', $1, 'FirstCity AI Super Admin', 'superadmin', true)
      ON CONFLICT (email) DO NOTHING
    `, [pwdHash]);
    console.log('  ✓ Superadmin (superadmin@cloudnext.com / Fleet@2024)');

    // ── 2. Per-tenant loop ──────────────────────────────────────────────────
    for (const T of TENANTS) {
      console.log(`\n  📦 ${T.name} (${T.country})`);

      // Tenant record
      await client.query(`
        INSERT INTO tenants (id, name, slug, country, city, address, phone, email, website, plan, max_vehicles, max_users)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, updated_at=NOW()
      `, [T.id, T.name, T.slug, T.country, T.city, T.address, T.phone, T.email, T.website, T.plan, T.max_vehicles, T.max_users]);

      // ── Users ─────────────────────────────────────────────────────────────
      for (const u of T.users) {
        await client.query(`
          INSERT INTO users (email, password_hash, full_name, role, tenant_id, is_active)
          VALUES ($1,$2,$3,$4,$5,true)
          ON CONFLICT (email) DO NOTHING
        `, [u.email, pwdHash, u.name, u.role, T.id]);
      }
      console.log(`    ✓ ${T.users.length} users`);

      // ── Depots ────────────────────────────────────────────────────────────
      const depotIds = [];
      for (const d of T.depots) {
        const r = await client.query(`
          INSERT INTO depots (tenant_id, name, address, city, location, capacity)
          VALUES ($1,$2,$3,$4,${pt(d.coords[0], d.coords[1])},100)
          ON CONFLICT DO NOTHING RETURNING id
        `, [T.id, d.name, d.address, T.city]);
        if (r.rows[0]) depotIds.push(r.rows[0].id);
      }
      if (depotIds.length === 0) {
        const r = await client.query(`SELECT id FROM depots WHERE tenant_id=$1 ORDER BY created_at`, [T.id]);
        r.rows.forEach(row => depotIds.push(row.id));
      }
      console.log(`    ✓ ${depotIds.length} depots`);

      // ── Drivers ───────────────────────────────────────────────────────────
      const driverIds = [];
      for (let i = 0; i < T.drivers.length; i++) {
        const d = T.drivers[i];
        const depotId = depotIds[i % depotIds.length];
        const r = await client.query(`
          INSERT INTO drivers (tenant_id, employee_id, full_name, phone, license_number,
                               license_class, license_expiry, safety_score, status, depot_id)
          VALUES ($1,$2,$3,$4,$5,'HTV','2027-06-30',$6,'active',$7)
          ON CONFLICT (license_number) DO UPDATE SET safety_score=EXCLUDED.safety_score
          RETURNING id
        `, [T.id, d.emp, d.name, d.phone, d.lic, d.score, depotId]);
        driverIds.push(r.rows[0].id);
      }
      console.log(`    ✓ ${driverIds.length} drivers`);

      // ── Vehicles ──────────────────────────────────────────────────────────
      const vehicleIds = [];
      const statuses = ['active','active','active','idle','active','idle','active','active','maintenance','active','offline','active'];
      for (let i = 0; i < T.vehicles.length; i++) {
        const v   = T.vehicles[i];
        const pos = near(T.center);
        const st  = statuses[i % statuses.length];
        const fuel = randBetween(20, 95);
        const odo  = randBetween(15000, 180000);
        const drvId = (st !== 'offline' && st !== 'maintenance' && driverIds[i]) ? driverIds[i] : null;
        const depotId = depotIds[i % depotIds.length];

        const r = await client.query(`
          INSERT INTO vehicles (
            tenant_id, registration, make, model, year, type, color,
            status, current_location, current_speed, current_heading,
            current_fuel, current_odometer, engine_on,
            fuel_capacity, max_speed, health_score,
            assigned_driver_id, depot_id,
            fuel_type, insurance_expiry, registration_expiry, purchase_date, last_seen
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,${pt(pos[0], pos[1])},$9,$10,
            $11,$12,$13,
            $14,$15,$16,
            $17,$18,
            'diesel','2026-12-31','2026-06-30',$19,NOW()
          )
          ON CONFLICT (registration) DO UPDATE SET
            status=EXCLUDED.status, current_location=EXCLUDED.current_location,
            last_seen=NOW()
          RETURNING id
        `, [
          T.id, v.reg, v.make, v.model, v.year, v.type, v.color,
          st, st === 'active' ? randInt(30, 110) : 0, randInt(0, 360),
          Math.round(fuel * 10) / 10, Math.round(odo), st === 'active',
          v.fuel_cap, v.max_speed, randBetween(60, 100),
          drvId, depotId,
          new Date(2018 + randInt(0, 5), randInt(0, 11), randInt(1, 28)).toISOString().split('T')[0],
        ]);
        vehicleIds.push(r.rows[0].id);
      }
      console.log(`    ✓ ${vehicleIds.length} vehicles`);

      // ── Geofences ─────────────────────────────────────────────────────────
      const geofenceIds = [];
      for (const g of T.geofences) {
        const r = await client.query(`
          INSERT INTO geofences (tenant_id, name, description, color, zone_type, boundary,
                                  alert_on_enter, alert_on_exit, speed_limit)
          VALUES ($1,$2,$3,$4,$5,${poly(g.coords)},true,true,$6)
          ON CONFLICT DO NOTHING RETURNING id
        `, [T.id, g.name, g.desc, g.color, g.zone_type,
            g.zone_type === 'speed_zone' ? 60 : null]);
        if (r.rows[0]) geofenceIds.push(r.rows[0].id);
      }
      if (geofenceIds.length === 0) {
        const r = await client.query(`SELECT id FROM geofences WHERE tenant_id=$1`, [T.id]);
        r.rows.forEach(row => geofenceIds.push(row.id));
      }
      console.log(`    ✓ ${geofenceIds.length} geofences`);

      // ── Alerts (18 per tenant) ────────────────────────────────────────────
      for (let i = 0; i < 18; i++) {
        const tpl = ALERT_TEMPLATES[i % ALERT_TEMPLATES.length];
        const vid = vehicleIds[i % vehicleIds.length];
        const did = driverIds[i % driverIds.length];
        const gid = tpl.type.includes('geofence') && geofenceIds.length
                    ? geofenceIds[i % geofenceIds.length] : null;
        const pos = near(T.center);
        const spd = tpl.type === 'speeding' ? randInt(110, 145) : null;
        const reg = T.vehicles[i % T.vehicles.length].reg;
        await client.query(`
          INSERT INTO alerts
            (tenant_id, vehicle_id, driver_id, geofence_id, type, severity,
             title, message, location, speed, is_read, occurred_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${pt(pos[0],pos[1])},$9,$10,
                  NOW() - INTERVAL '${randInt(5,480)} minutes')
        `, [T.id, vid, did, gid, tpl.type, tpl.severity,
            tpl.title, tpl.msg(reg, spd), spd, i > 10]);
      }
      console.log(`    ✓ 18 alerts`);

      // ── Trips (8 per tenant) ──────────────────────────────────────────────
      const tripStatuses = ['completed','completed','completed','active','completed','completed','active','cancelled'];
      for (let i = 0; i < 8; i++) {
        const vid    = vehicleIds[i % vehicleIds.length];
        const did    = driverIds[i % driverIds.length];
        const origin = near(T.center, 0.06);
        const dest   = near(T.center2 || T.center, 0.06);
        const st     = tripStatuses[i];
        const distKm = randBetween(15, 180);
        const durMin = Math.round(distKm / randBetween(40, 80) * 60);
        const startedAgo = randInt(30, 600);

        await client.query(`
          INSERT INTO trips
            (tenant_id, vehicle_id, driver_id, status,
             origin, destination, origin_address, dest_address,
             distance_km, duration_mins, avg_speed, fuel_used,
             started_at, completed_at, planned_start)
          VALUES (
            $1,$2,$3,$4,
            ${pt(origin[0],origin[1])},${pt(dest[0],dest[1])},$5,$6,
            $7,$8,$9,$10,
            NOW() - INTERVAL '${startedAgo} minutes',
            ${st === 'completed' ? `NOW() - INTERVAL '${startedAgo - durMin} minutes'` : 'NULL'},
            NOW() - INTERVAL '${startedAgo + 30} minutes'
          )
        `, [T.id, vid, did, st,
            `${T.city} — Origin Zone ${i+1}`, `${T.city} — Destination ${i+1}`,
            distKm, durMin, randBetween(45, 90), +(distKm * 0.08).toFixed(1)]);
      }
      console.log(`    ✓ 8 trips`);

      // ── Telemetry trail (last 45 mins for first 5 active vehicles) ────────
      const activeVids = vehicleIds.slice(0, 5);
      for (const vid of activeVids) {
        const base = near(T.center, 0.02);
        for (let t = 45; t >= 0; t -= 3) {
          const pos = [
            +(base[0] + (Math.random()-0.5)*0.001*(t+1)).toFixed(6),
            +(base[1] + (Math.random()-0.5)*0.001*(t+1)).toFixed(6),
          ];
          await client.query(`
            INSERT INTO telemetry (vehicle_id, recorded_at, location, speed, heading,
                                   fuel_level, odometer, engine_on, satellites)
            VALUES ($1, NOW() - INTERVAL '${t} minutes',
                    ${pt(pos[0],pos[1])}, $2,$3,$4,$5,true,8)
          `, [vid, randInt(25,95), randInt(0,360), randBetween(30,90), randBetween(40000, 120000)]);
        }
      }
      console.log(`    ✓ Telemetry (${activeVids.length * 16} records)`);

      // ── Driver Scores ─────────────────────────────────────────────────────
      for (let i = 0; i < driverIds.length; i++) {
        const base = T.drivers[i].score;
        const jitter = () => Math.min(100, Math.max(0, base + (Math.random()*8 - 4)));
        await client.query(`
          INSERT INTO driver_scores
            (driver_id, period_date, overall_score, speed_score, braking_score,
             cornering_score, fatigue_score, fuel_score, distance_km,
             speeding_events, harsh_braking, harsh_acceleration)
          VALUES ($1, CURRENT_DATE, $2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT DO NOTHING
        `, [driverIds[i],
            base, jitter(), jitter(), jitter(), jitter(), jitter(),
            randBetween(80, 350),
            base < 75 ? randInt(2,8) : 0,
            base < 80 ? randInt(1,5) : 0,
            base < 80 ? randInt(1,4) : 0]);
      }
      console.log(`    ✓ Driver scores`);

      // ── Maintenance Records ───────────────────────────────────────────────
      const maintTypes = [
        { type:'oil_change',       desc:'Engine oil & filter replacement' },
        { type:'tire_rotation',    desc:'Tyre rotation and pressure check' },
        { type:'brake_service',    desc:'Brake pads and discs inspection' },
        { type:'annual_inspection',desc:'Full annual vehicle safety inspection' },
      ];
      for (let i = 0; i < Math.min(vehicleIds.length, 6); i++) {
        const mt = maintTypes[i % maintTypes.length];
        const isDone = i % 3 !== 0;
        await client.query(`
          INSERT INTO maintenance
            (tenant_id, vehicle_id, type, description, status,
             scheduled_date, completed_date, odometer_at, cost, technician)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [T.id, vehicleIds[i], mt.type, mt.desc,
            isDone ? 'completed' : 'scheduled',
            isDone ? new Date(Date.now() - randInt(10,60)*864e5).toISOString().split('T')[0] : new Date(Date.now() + randInt(3,20)*864e5).toISOString().split('T')[0],
            isDone ? new Date(Date.now() - randInt(5,30)*864e5).toISOString().split('T')[0] : null,
            randInt(40000, 120000),
            randBetween(150, 2500),
            `GCC Fleet Service Centre — ${T.city}`]);
      }
      console.log(`    ✓ Maintenance records`);

      console.log(`  ✅ ${T.name} complete`);
    }

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ GCC Fleet Data Seeded Successfully!\n');
    console.log('  Password for all tenant accounts: Fleet@2024');
    console.log('  Superadmin: superadmin@cloudnext.com / Fleet@2024\n');
    console.log('  Tenants created:');
    TENANTS.forEach(t => console.log(`    • ${t.name.padEnd(35)} ${t.users[0].email}`));
    console.log('═══════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedGCC();
