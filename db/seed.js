/**
 * db/seed.js
 * Populates the TerzoCloud Asset Portal database with the 40 users and 42 assets
 * that currently live in user-asset-portal.html.
 *
 * Run:
 *   node db/seed.js
 *   MONGO_URI=mongodb://... node db/seed.js
 *
 * The script is idempotent: it clears both collections before inserting, so it
 * is safe to run multiple times.
 */

require('dotenv').config(); // optional – reads .env if present
const { connect, disconnect, User, Asset } = require('./index');

// ─── 1. USERS ──────────────────────────────────────────────────────────────────
const USERS_RAW = [
  {legacyId:'u1', first:'Ajay Christopher',last:'Hubert',   email:'ajay.christopher.hubert@terzocloud.com',role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u2', first:'Karthi',          last:'',         email:'karthi@terzocloud.com',                 role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u3', first:'Ahamad',          last:'Riyas',    email:'ahamad.riyas@terzocloud.com',           role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u4', first:'Kavipriya',       last:'',         email:'kavipriya@terzocloud.com',              role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u5', first:'Ananya',          last:'',         email:'ananya@terzocloud.com',                 role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u6', first:'Shunmugavel',     last:'',         email:'shunmugavel@terzocloud.com',            role:'Editor',  status:'Active',dept:'Engineering',      location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u7', first:'Prasanna',        last:'Kumar',    email:'prasanna.kumar@terzocloud.com',         role:'Viewer',  status:'Active',dept:'QA',               location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u8', first:'Hariharan',       last:'',         email:'hariharan@terzocloud.com',              role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u9', first:'Paventhan',       last:'',         email:'paventhan@terzocloud.com',              role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u10',first:'Vinotha',         last:'',         email:'vinotha@terzocloud.com',                role:'Editor',  status:'Active',dept:'Engineering',      location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u11',first:'Mythilipriya',    last:'',         email:'mythilipriya@terzocloud.com',           role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u12',first:'Divya',           last:'R',        email:'divya.r@terzocloud.com',                role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u13',first:'Dineshkumar',     last:'V',        email:'dineshkumar.v@terzocloud.com',          role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u14',first:'Dinesh',          last:'B',        email:'dinesh.b@terzocloud.com',               role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u15',first:'Vasanth',         last:'Pandian',  email:'vasanth.pandian@terzocloud.com',        role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u16',first:'Mohanamala',      last:'',         email:'mohanamala@terzocloud.com',             role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u17',first:'Divya',           last:'M',        email:'divya.m@terzocloud.com',                role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u18',first:'Gowtham',         last:'V',        email:'gowtham.v@terzocloud.com',              role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u19',first:'Iyyappan',        last:'',         email:'iyyappan@terzocloud.com',               role:'Editor',  status:'Active',dept:'Engineering',      location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u20',first:'Ragav',           last:'',         email:'ragav@terzocloud.com',                  role:'Editor',  status:'Active',dept:'Engineering',      location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u21',first:'Harshni',         last:'',         email:'harshni@terzocloud.com',                role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u22',first:'Priyadharshini',  last:'',         email:'priyadharshini@terzocloud.com',         role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u23',first:'Aswini',          last:'',         email:'aswini@terzocloud.com',                 role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u24',first:'Dharshini',       last:'',         email:'dharshini@terzocloud.com',              role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u25',first:'Kavimitraa',      last:'',         email:'kavimitraa@terzocloud.com',             role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u26',first:'Nivetha',         last:'',         email:'nivetha@terzocloud.com',                role:'Editor',  status:'Active',dept:'AI-Service',       location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u27',first:'Dhanusha',        last:'',         email:'dhanusha@terzocloud.com',               role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u28',first:'Sowmya',          last:'',         email:'sowmya@terzocloud.com',                 role:'Viewer',  status:'Active',dept:'QA',               location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u29',first:'Harish',          last:'',         email:'harish@terzocloud.com',                 role:'Viewer',  status:'Active',dept:'Customer Support', location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u30',first:'Praveen',         last:'M',        email:'praveen.m@terzocloud.com',              role:'Admin',   status:'Active',dept:'IT',               location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u31',first:'Karthick',        last:'R',        email:'karthick.r@terzocloud.com',             role:'Editor',  status:'Active',dept:'AI-Service',       location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u32',first:'Leo',             last:'Deepak',   email:'leo.deepak@terzocloud.com',             role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u33',first:'Gowtham',         last:'Manohar',  email:'gowtham.manohar@terzocloud.com',        role:'Manager', status:'Active',dept:'HR',               location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u34',first:'Himalaya',        last:'',         email:'himalaya@terzocloud.com',               role:'Manager', status:'Active',dept:'Product',          location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u35',first:'Yogesh',          last:'',         email:'yogesh@terzocloud.com',                 role:'Editor',  status:'Active',dept:'AI-Service',       location:'Coimbatore', phone:'',joined:'2023-01-01'},
  {legacyId:'u36',first:'Mohanraja',       last:'',         email:'mohanraja@terzocloud.com',              role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u37',first:'Urvasi',          last:'',         email:'urvasi@terzocloud.com',                 role:'Viewer',  status:'Active',dept:'Accounts',         location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u38',first:'Pradeep',         last:'',         email:'pradeep@terzocloud.com',                role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u39',first:'Niranjan',        last:'',         email:'niranjan@terzocloud.com',               role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
  {legacyId:'u40',first:'Revathi',         last:'',         email:'revathi@terzocloud.com',                role:'Editor',  status:'Active',dept:'Engineering',      location:'Chennai',    phone:'',joined:'2023-01-01'},
];

// ─── 2. ASSETS (legacyAssignTo references user legacyId) ──────────────────────
const ASSETS_RAW = [
  {csvId:'A-01',name:'Macbook Pro 14',  type:'Laptop',serial:'KP93V707J0',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u1', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-02',name:'Macbook Pro 14',  type:'Laptop',serial:'GF4R65H4DH',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u2', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-03',name:'Macbook Pro 14',  type:'Laptop',serial:'L043T093TR',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u3', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-04',name:'Macbook Pro 14',  type:'Laptop',serial:'RVM9Q97FJD',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u4', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-05',name:'Macbook Pro 14',  type:'Laptop',serial:'G59R0CG61T',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u5', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-06',name:'Macbook Pro 14',  type:'Laptop',serial:'XVGHD2R64D',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u6', location:'Coimbatore', dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-07',name:'Macbook Pro 14',  type:'Laptop',serial:'X4L9414L27',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u7', location:'Chennai',    dept:'QA',               vendor:'Sniper Systems',notes:''},
  {csvId:'A-08',name:'Macbook Pro 14',  type:'Laptop',serial:'P4Y43FNJWR',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u8', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-09',name:'Macbook Pro 14',  type:'Laptop',serial:'FQKJ3X4X13',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u9', location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-10',name:'Macbook Pro 14',  type:'Laptop',serial:'JQRXPG4X5Y',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'Available', legacyAssignTo:'',   location:'Coimbatore', dept:'Engineering',      vendor:'Sniper Systems',notes:'MLB Replaced & Speaker 9/01/2026 (Murali)'},
  {csvId:'A-11',name:'Macbook Pro 14',  type:'Laptop',serial:'GR242J52P1',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u11',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-12',name:'Macbook Pro 14',  type:'Laptop',serial:'LQJ326N9Y5',   brand:'Apple / M2 Pro',  desc:'16GB RAM - 512GB SSD M2-PRO',         status:'In-Use',    legacyAssignTo:'u12',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-13',name:'Macbook Pro 14',  type:'Laptop',serial:'SQ95WC16JDP',  brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u13',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-14',name:'Macbook Pro 14',  type:'Laptop',serial:'SC7XG64K4M0',  brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u14',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-15',name:'Macbook Pro 14',  type:'Laptop',serial:'ST6DP29K320',  brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u15',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-16',name:'Macbook Pro 14',  type:'Laptop',serial:'KG4P92VL2F',   brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u16',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:'Display, battery, speaker replaced 03/10/2023'},
  {csvId:'A-17',name:'Macbook Pro 14',  type:'Laptop',serial:'SPYH4X30W36',  brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u17',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-18',name:'Macbook Pro 14',  type:'Laptop',serial:'X1YJ2WGFTH',   brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u18',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:'MLB Replaced 30/01/2024'},
  {csvId:'A-19',name:'Macbook Pro 14',  type:'Laptop',serial:'WXQG52LV27',   brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u19',location:'Coimbatore', dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-20',name:'Macbook Pro 14',  type:'Laptop',serial:'K06D165GJF',   brand:'Apple / M1 Pro',  desc:'16GB RAM - 512GB SSD M1-PRO',         status:'In-Use',    legacyAssignTo:'u20',location:'Coimbatore', dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-21',name:'Macbook Pro 13',  type:'Laptop',serial:'SFVHFJ132Q05D',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u21',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-22',name:'Macbook Pro 13',  type:'Laptop',serial:'SFVHFJ13MQ05D',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u22',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-23',name:'Macbook Pro 13',  type:'Laptop',serial:'SFVFG3WSPQ05D',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u23',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-24',name:'Macbook Pro 13',  type:'Laptop',serial:'SFVFFHMRQQ05D',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u24',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-25',name:'Macbook Pro 13',  type:'Laptop',serial:'SFVFFJ2YKQ05D',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u25',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-26',name:'Macbook Pro 13',  type:'Laptop',serial:'FVHFJ157Q05D', brand:'Apple / Intel i5',desc:'8GB RAM - 128GB SSD Intel i5',        status:'In-Use',    legacyAssignTo:'u26',location:'Chennai',    dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-27',name:'Macbook Pro 13',  type:'Laptop',serial:'FVFFFL1UQ05D', brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u27',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-28',name:'Macbook Pro 13',  type:'Laptop',serial:'FVFFHMRBQ05D', brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u28',location:'Coimbatore', dept:'QA',               vendor:'Sniper Systems',notes:''},
  {csvId:'A-29',name:'Macbook Air 13',  type:'Laptop',serial:'C02F29NWQ6L7', brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u29',location:'Chennai',    dept:'Customer Support', vendor:'Sniper Systems',notes:''},
  {csvId:'A-30',name:'Macbook Air 13',  type:'Laptop',serial:'SC02G37NBQ6L4',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u30',location:'Chennai',    dept:'IT',               vendor:'Sniper Systems',notes:''},
  {csvId:'A-31',name:'Macbook Air 13',  type:'Laptop',serial:'SFVFJK7D0Q6L4',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u31',location:'Chennai',    dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-32',name:'Macbook Air 13',  type:'Laptop',serial:'SFVFJK743Q6L4',brand:'Apple / M1',      desc:'8GB RAM - 256GB SSD M1',              status:'In-Use',    legacyAssignTo:'u32',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-33',name:'Macbook Air 13',  type:'Laptop',serial:'SDY2VLXJ6MH',  brand:'Apple / M2',      desc:'8GB RAM - 256GB SSD M2',              status:'In-Use',    legacyAssignTo:'u33',location:'Chennai',    dept:'HR',               vendor:'Sniper Systems',notes:''},
  {csvId:'A-34',name:'Macbook Air 13',  type:'Laptop',serial:'SK9242NXCJ3',  brand:'Apple / M2',      desc:'8GB RAM - 256GB SSD M2',              status:'In-Use',    legacyAssignTo:'u34',location:'Chennai',    dept:'Product',          vendor:'Sniper Systems',notes:''},
  {csvId:'A-35',name:'Macbook Air 13',  type:'Laptop',serial:'C0XCLQ1WR1',   brand:'Apple / M2',      desc:'8GB RAM - 256GB SSD M2',              status:'In-Use',    legacyAssignTo:'u35',location:'Coimbatore', dept:'AI-Service',       vendor:'Sniper Systems',notes:''},
  {csvId:'A-36',name:'Macbook Pro 15',  type:'Laptop',serial:'C02XH82KJG5L', brand:'Apple / Intel i9',desc:'16GB RAM - 512GB SSD Intel i9',       status:'In-Use',    legacyAssignTo:'u36',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-37',name:'Lenovo Ideapad',  type:'Laptop',serial:'PG02HQZX',     brand:'Lenovo / AMD R5', desc:'8GB RAM - 512GB SSD AMD R5',          status:'In-Use',    legacyAssignTo:'u30',location:'Chennai',    dept:'IT',               vendor:'—',             notes:''},
  {csvId:'A-38',name:'Lenovo Ideapad',  type:'Laptop',serial:'PF34LNF2',     brand:'Lenovo / AMD R5', desc:'8GB RAM - 512GB SSD AMD R5',          status:'In-Use',    legacyAssignTo:'u37',location:'Chennai',    dept:'Accounts',         vendor:'—',             notes:''},
  {csvId:'A-39',name:'Macbook Air 13',  type:'Laptop',serial:'SCPF9R49RXV',  brand:'Apple / M4',      desc:'24GB RAM - 512GB SSD M4',             status:'In-Use',    legacyAssignTo:'u38',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-40',name:'Macbook Pro 16',  type:'Laptop',serial:'SJYCRWJQ9DW',  brand:'Apple / M4 Pro',  desc:'24GB RAM - 512GB SSD M4 Pro',         status:'In-Use',    legacyAssignTo:'u36',location:'Chennai',    dept:'Engineering',      vendor:'Sniper Systems',notes:''},
  {csvId:'A-41',name:'Macbook Pro 14',  type:'Laptop',serial:'J73DKJ34PP',   brand:'Apple / M4 Pro',  desc:'24GB RAM - 512GB SSD M4 Pro',         status:'In-Use',    legacyAssignTo:'u39',location:'Chennai',    dept:'Engineering',      vendor:'Apple',         notes:''},
  {csvId:'A-42',name:'Macbook Pro 15',  type:'Laptop',serial:'J6R7D6Y6LF',   brand:'Apple / M4 Pro',  desc:'24GB RAM - 512GB SSD M4 Pro',         status:'In-Use',    legacyAssignTo:'u40',location:'Chennai',    dept:'Engineering',      vendor:'—',             notes:''},
];

// ─── 3. MAIN ───────────────────────────────────────────────────────────────────
async function seed() {
  await connect();

  // --- Users ---
  console.log('🗑️   Clearing users…');
  await User.deleteMany({});

  console.log('👤  Inserting 40 users…');
  const insertedUsers = await User.insertMany(
    USERS_RAW.map(u => ({ ...u, joined: new Date(u.joined) }))
  );

  // Build legacyId → ObjectId map for asset assignment
  const userMap = {};
  insertedUsers.forEach(u => { userMap[u.legacyId] = u._id; });

  // --- Assets ---
  console.log('🗑️   Clearing assets…');
  await Asset.deleteMany({});

  console.log('💻  Inserting 42 assets…');
  await Asset.insertMany(
    ASSETS_RAW.map(({ legacyAssignTo, ...a }) => ({
      ...a,
      assignedTo: legacyAssignTo ? (userMap[legacyAssignTo] ?? null) : null,
    }))
  );

  // --- Summary ---
  const totalUsers  = await User.countDocuments();
  const totalAssets = await Asset.countDocuments();
  const inUse       = await Asset.countDocuments({ status: 'In-Use' });
  const available   = await Asset.countDocuments({ status: 'Available' });

  console.log('\n✅  Seed complete');
  console.log(`   Users : ${totalUsers}`);
  console.log(`   Assets: ${totalAssets}  (In-Use: ${inUse}, Available: ${available})`);

  await disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
