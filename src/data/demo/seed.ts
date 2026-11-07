import type {
  AdminStaff,
  Animal,
  AnimalGender,
  AuditLogEntry,
  EnvironmentReading,
  Farm,
  FarmMember,
  FeedEntry,
  HealthEvent,
  ISODate,
  ISODateTime,
  Lang,
  MemberRole,
  MilkEntry,
  MilkSession,
  Profile,
  ReproductionCycle,
  Shed,
  Species,
  Vaccination,
} from '../types';
import { FEATURED, seedId } from './featured';
import { addDays, DAY, HOUR, istDate, istInstant, MINUTE, toIso } from './time';

export { FEATURED } from './featured';

export const DEMO_SEED = 20261105;

// ---- tables the contract doesn't expose directly, but the views are computed from ----

/** A Blackbox or a collar. `online` collars keep reporting while the app is open. */
export interface Device {
  id: string;
  farm_id: string;
  kind: 'blackbox' | 'tag';
  animal_id: string | null;
  online: boolean;
  /** Minutes behind the clock an online collar's last reading is. */
  lag_min: number;
  /** When an offline device was last heard from. */
  last_seen: ISODateTime;
  last_temp_c: number | null;
  last_ambient_temp_c: number | null;
  last_battery_pct: number | null;
}
export interface SensorReading {
  id: number;
  farm_id: string;
  animal_id: string;
  ts: ISODateTime;
  body_temp_c: number;
}
export interface ActivityDaily {
  id: string;
  farm_id: string;
  animal_id: string;
  day: ISODate;
  stand_min: number;
  sit_min: number;
  walk_min: number;
  eat_min: number;
  ruminate_min: number;
  drink_min: number;
}

export interface SeedData {
  species: Species[];
  profiles: Profile[];
  farms: Farm[];
  farm_members: FarmMember[];
  sheds: Shed[];
  animals: Animal[];
  milk_entries: MilkEntry[];
  feed_entries: FeedEntry[];
  vaccinations: Vaccination[];
  health_events: HealthEvent[];
  reproduction_cycles: ReproductionCycle[];
  environment_readings: EnvironmentReading[];
  sensor_readings: SensorReading[];
  activity_daily: ActivityDaily[];
  devices: Device[];
  admin_staff: AdminStaff[];
  admin_audit_log: AuditLogEntry[];
}

/** A small, fast, deterministic random number generator: returns numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- placeholder images (no real photos and no external URLs) ----

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function animalPhoto(tag: string, photo = 1): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="32" height="32" fill="#F4F6F5"/><rect width="16" height="32" fill="#F1F3F2"/></pattern></defs><rect width="240" height="240" fill="url(#p)"/><text x="120" y="118" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#6B7280">Photo ${photo}</text><text x="120" y="150" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#6B7280">Tag ${escapeXml(tag)}</text></svg>`,
  );
}
export function slipImage(tube: string): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="#FFFFFF"/><rect x="8" y="8" width="304" height="184" fill="none" stroke="#E3E8E5"/><text x="24" y="60" font-family="sans-serif" font-size="14" fill="#6B7280">Insemination slip</text><text x="24" y="110" font-family="monospace" font-size="24" fill="#0F1B2D">${escapeXml(tube)}</text></svg>`,
  );
}

// ---- fixed reference data ----

export const SPECIES: Species[] = [
  {
    id: 'cattle',
    category: 'large_ruminant',
    hardware_supported: true,
    labels: { en: 'Cattle', hi: 'मवेशी', mr: 'गुरे', ml: 'കന്നുകാലി', gu: 'ઢોર', ta: 'மாடு' },
  },
  {
    id: 'buffalo',
    category: 'large_ruminant',
    hardware_supported: false,
    labels: { en: 'Buffalo', hi: 'भैंस', mr: 'म्हैस', ml: 'എരുമ', gu: 'ભેંસ', ta: 'எருமை' },
  },
  {
    id: 'goat',
    category: 'small_ruminant',
    hardware_supported: false,
    labels: { en: 'Goat', hi: 'बकरी', mr: 'शेळी', ml: 'ആട്', gu: 'બકરી', ta: 'வெள்ளாடு' },
  },
  {
    id: 'sheep',
    category: 'small_ruminant',
    hardware_supported: false,
    labels: {
      en: 'Sheep',
      hi: 'भेड़',
      mr: 'मेंढी',
      ml: 'ചെമ്മരിയാട്',
      gu: 'ઘેટું',
      ta: 'செம்மறியாடு',
    },
  },
  {
    id: 'poultry',
    category: 'poultry',
    hardware_supported: false,
    labels: { en: 'Poultry', hi: 'मुर्गी', mr: 'कोंबडी', ml: 'കോഴി', gu: 'મરઘી', ta: 'கோழி' },
  },
  {
    id: 'pig',
    category: 'swine',
    hardware_supported: false,
    labels: { en: 'Pig', hi: 'सूअर', mr: 'डुक्कर', ml: 'പന്നി', gu: 'ડુક્કર', ta: 'பன்றி' },
  },
  {
    id: 'horse',
    category: 'equine',
    hardware_supported: false,
    labels: { en: 'Horse', hi: 'घोड़ा', mr: 'घोडा', ml: 'കുതിര', gu: 'ઘોડો', ta: 'குதிரை' },
  },
  {
    id: 'other',
    category: 'other',
    hardware_supported: false,
    labels: { en: 'Other', hi: 'अन्य', mr: 'इतर', ml: 'മറ്റുള്ളവ', gu: 'અન્ય', ta: 'மற்றவை' },
  },
];

const STAFF: { name: string; email: string; role: AdminStaff['role'] }[] = [
  { name: 'Anjali Menon', email: 'anjali@brainwired.demo', role: 'super_admin' },
  { name: 'Priya Sharma', email: 'priya@brainwired.demo', role: 'support' },
  { name: 'Rahul Deshmukh', email: 'rahul@brainwired.demo', role: 'support' },
  { name: 'Fatima Shaikh', email: 'fatima@brainwired.demo', role: 'viewer' },
  { name: 'Vikram Nair', email: 'vikram@brainwired.demo', role: 'support' },
];

const NAMES: Record<Lang, { first: string[]; last: string[] }> = {
  hi: {
    first: [
      'Ravi',
      'Manoj',
      'Sunil',
      'Paramjit',
      'Geeta',
      'Rakesh',
      'Sita',
      'Ajay',
      'Meena',
      'Dinesh',
    ],
    last: ['Kumar', 'Yadav', 'Singh', 'Kaur', 'Sharma', 'Chauhan', 'Tomar', 'Malik'],
  },
  mr: {
    first: [
      'Kavita',
      'Ganesh',
      'Suresh',
      'Anita',
      'Sachin',
      'Vaishali',
      'Mahesh',
      'Sunanda',
      'Nitin',
    ],
    last: ['Shinde', 'Pawar', 'Jadhav', 'Kulkarni', 'More', 'Gaikwad', 'Bhosale', 'Kadam'],
  },
  gu: {
    first: ['Bhavesh', 'Hetal', 'Kokila', 'Jignesh', 'Nita', 'Mukesh', 'Daksha'],
    last: ['Chaudhary', 'Patel', 'Ben', 'Solanki', 'Rabari', 'Thakor'],
  },
  ta: {
    first: ['Selvi', 'Arun', 'Kannan', 'Meenakshi', 'Saravanan', 'Valli'],
    last: ['Arumugam', 'Krishnan', 'Pandian', 'Subramani', 'Rajan'],
  },
  ml: {
    first: ['Mariamma', 'Biju', 'Shaji', 'Lissy', 'Anoop', 'Suja'],
    last: ['Thomas', 'Mathew', 'Kurian', 'Pillai', 'Menon'],
  },
  en: {
    first: ['Asha', 'Rohan', 'Nisha', 'Vivek', 'Tara', 'Daniel'],
    last: ['Nair', 'Dsouza', 'Fernandes', 'Rao', 'Iyer'],
  },
};

const PLACES: Record<string, { lat: number; lng: number; districts: string[] }> = {
  Maharashtra: {
    lat: 18.6,
    lng: 74.8,
    districts: ['Kolhapur', 'Satara', 'Sangli', 'Ahilyanagar', 'Pune', 'Nashik'],
  },
  Gujarat: {
    lat: 22.8,
    lng: 72.4,
    districts: ['Anand', 'Banaskantha', 'Mehsana', 'Amreli', 'Kutch', 'Rajkot'],
  },
  'Uttar Pradesh': {
    lat: 27.2,
    lng: 78.8,
    districts: ['Mathura', 'Agra', 'Etawah', 'Meerut', 'Bareilly'],
  },
  'Tamil Nadu': {
    lat: 11.2,
    lng: 78.0,
    districts: ['Erode', 'Namakkal', 'Salem', 'Madurai', 'Coimbatore'],
  },
  Kerala: {
    lat: 10.0,
    lng: 76.5,
    districts: ['Kottayam', 'Idukki', 'Thrissur', 'Palakkad', 'Wayanad'],
  },
  Haryana: { lat: 29.4, lng: 76.4, districts: ['Karnal', 'Ambala', 'Hisar', 'Rohtak'] },
};

const STATES_BY_LANG: Record<Lang, string[]> = {
  hi: ['Uttar Pradesh', 'Haryana'],
  mr: ['Maharashtra'],
  gu: ['Gujarat'],
  ta: ['Tamil Nadu'],
  ml: ['Kerala'],
  en: ['Kerala', 'Maharashtra'],
};

const BREEDS: Record<string, string[]> = {
  cattle: ['Gir', 'HF cross', 'Sahiwal', 'Jersey cross', 'Kangayam', 'Vechur', 'Ongole'],
  buffalo: ['Murrah', 'Mehsana', 'Jaffarabadi', 'Surti'],
  goat: ['Osmanabadi', 'Sirohi', 'Jamunapari', 'Malabari'],
  sheep: ['Deccani', 'Nellore'],
  poultry: ['Kadaknath', 'Giriraja'],
  pig: ['Large White Yorkshire'],
  horse: ['Marwari'],
};
const FEMALE_NAMES = [
  'Sita',
  'Radha',
  'Kali',
  'Rani',
  'Nandi',
  'Bhoori',
  'Kesar',
  'Valli',
  'Pooja',
  'Kunji',
  'Thara',
  'Chandra',
  'Saraswati',
  'Godavari',
  'Yamuna',
  'Tulsi',
  'Parvati',
  'Mangala',
  'Sundari',
  'Gomati',
];
const MALE_NAMES = ['Raja', 'Nandu', 'Shiva', 'Bheema', 'Kannan', 'Veeru'];

const VACCINES = [
  'FMD (foot-and-mouth)',
  'HS (haemorrhagic septicaemia)',
  'Black quarter (BQ)',
  'Brucellosis',
  'Lumpy skin disease',
];
const HEALTH_TITLES = ['Fever', 'Mastitis', 'Lameness', 'Bloat', 'Not eating'];
const HEALTH_NOTES: Record<Lang, string[]> = {
  hi: ['दूध कम हो गया है', 'चारा नहीं खा रही है'],
  mr: ['दूध कमी झाले आहे', 'चारा खात नाही'],
  gu: ['દૂધ ઓછું થયું છે', 'ચારો ખાતી નથી'],
  ta: ['பால் குறைந்துவிட்டது', 'தீவனம் சாப்பிடவில்லை'],
  ml: ['പാൽ കുറഞ്ഞു', 'തീറ്റ തിന്നുന്നില്ല'],
  en: ['Milk has dropped', 'Off her feed since yesterday'],
};
const GESTATION_DAYS: Record<string, number> = { cattle: 283, buffalo: 310, goat: 150, sheep: 150 };

const FEED_KINDS: { type: string; kgPerAnimal: number; costPerKg: number }[] = [
  { type: 'Green fodder', kgPerAnimal: 8, costPerKg: 3 },
  { type: 'Dry fodder', kgPerAnimal: 5, costPerKg: 3 },
  { type: 'Concentrate', kgPerAnimal: 2, costPerKg: 28 },
  { type: 'Silage', kgPerAnimal: 3, costPerKg: 3 },
];

const FIX_NOTES = [
  'Farmer confirmed on a call',
  'Farmer called: typed the wrong number',
  'Logged twice, original kept',
  'Vet visit slip shared on chat',
  'Requested by the owner',
  'Spelling fix',
  'Filled in from the farmer’s address',
  'Vet asked to move it a week',
];

// ---- the plan for each farm, before anything is generated ----

interface NamedAnimal {
  id: string;
  tag: string;
  name: string;
  species: string;
  breed: string;
  status: Animal['status'];
}
interface FarmPlan {
  id: string;
  name: string;
  ownerId: string;
  language: Lang;
  district: string;
  state: string;
  description?: string;
  pin?: { lat: number; lng: number };
  blackbox: boolean;
  /** false: the Blackbox and its collars stopped reporting this morning. */
  online: boolean;
  afternoon: boolean;
  /** Active animals per species (named active animals count towards these). */
  species: Record<string, number>;
  named: NamedAnimal[];
  shedNames: string[];
  /** Name, role of members beyond the owner; a number generates that many. */
  members: { name: string; role: MemberRole }[] | number;
  /** No milk or feed entries for this many days (today included). */
  quietDays: number;
  /** Milk is entered per animal on this many cows; 0 means per farm. */
  milkers: number;
  /** Generated farms lose a few animals to sold and deceased; featured farms stay exact. */
  exact: boolean;
}

const named = (
  key: keyof typeof FEATURED.animals,
  tag: string,
  name: string,
  breed: string,
  status: Animal['status'] = 'active',
): NamedAnimal => ({ id: FEATURED.animals[key], tag, name, species: 'cattle', breed, status });

const FEATURED_OWNERS: { id: string; name: string; language: Lang; phone: string }[] = [
  { id: FEATURED.owners.ramesh, name: 'Ramesh Patil', language: 'mr', phone: '+919822012341' },
  { id: FEATURED.owners.sunita, name: 'Sunita Desai', language: 'gu', phone: '+919725012308' },
  { id: FEATURED.owners.joseph, name: 'Joseph Varghese', language: 'ml', phone: '+919447012319' },
  { id: FEATURED.owners.murugan, name: 'Murugan Selvam', language: 'ta', phone: '+919843012372' },
  { id: FEATURED.owners.rajendra, name: 'Rajendra Yadav', language: 'hi', phone: '+919935012364' },
  { id: FEATURED.owners.deepak, name: 'Deepak Rawat', language: 'hi', phone: '+919812012323' },
  {
    id: FEATURED.owners.lakshmi,
    name: 'Lakshmi Narayanan',
    language: 'ta',
    phone: '+919443012390',
  },
];

const FEATURED_FARMS: FarmPlan[] = [
  {
    id: FEATURED.farms.shreeGanesh,
    name: 'Shree Ganesh Dairy',
    ownerId: FEATURED.owners.ramesh,
    language: 'mr',
    district: 'Kolhapur',
    state: 'Maharashtra',
    description: 'Family dairy with Gir and HF-cross cows, Murrah buffalo and a few goats.',
    pin: { lat: 16.705, lng: 74.2433 },
    blackbox: true,
    online: true,
    afternoon: true,
    species: { cattle: 41, buffalo: 17, goat: 6 },
    named: [
      named('gauri', '01', 'Gauri', 'Gir'),
      named('lakshmi', '02', 'Lakshmi', 'HF cross'),
      named('ganga', '04', 'Ganga', 'Gir'),
      named('kamla', '07', 'Kamla', 'Sahiwal'),
      named('shanti', '11', 'Shanti', 'Gir'),
      named('bhuri', '23', 'Bhuri', 'Gir', 'sold'),
      named('moti', '09', 'Moti', 'Sahiwal', 'deceased'),
    ],
    shedNames: ['Main shed', 'Buffalo shed', 'Calf & goat shed'],
    members: [
      { name: 'Suresh Patil', role: 'manager' },
      { name: 'Ganpat Jadhav', role: 'manager' },
      { name: 'Sunil More', role: 'worker' },
      { name: 'Rekha Kamble', role: 'worker' },
    ],
    quietDays: 0,
    milkers: 24,
    exact: true,
  },
  {
    id: FEATURED.farms.girGauShala,
    name: 'Gir Gau Shala',
    ownerId: FEATURED.owners.sunita,
    language: 'gu',
    district: 'Anand',
    state: 'Gujarat',
    blackbox: true,
    online: true,
    afternoon: false,
    species: { cattle: 29 },
    named: [],
    shedNames: ['Main shed', 'Calf shed'],
    members: 2,
    quietDays: 0,
    milkers: 16,
    exact: true,
  },
  {
    id: FEATURED.farms.periyar,
    name: 'Periyar Cattle Farm',
    ownerId: FEATURED.owners.joseph,
    language: 'ml',
    district: 'Kottayam',
    state: 'Kerala',
    blackbox: false,
    online: true,
    afternoon: false,
    species: { cattle: 6 },
    named: [
      named('ammini', '03', 'Ammini', 'Vechur'),
      named('neeli', '06', 'Neeli', 'Vechur'),
      named('kuttan', '08', 'Kuttan', 'Jersey cross'),
    ],
    shedNames: ['Main shed'],
    members: 1,
    quietDays: 0,
    milkers: 6,
    exact: true,
  },
  {
    id: FEATURED.farms.kaveri,
    name: 'Kaveri Farms',
    ownerId: FEATURED.owners.murugan,
    language: 'ta',
    district: 'Erode',
    state: 'Tamil Nadu',
    blackbox: true,
    online: false,
    afternoon: false,
    species: { cattle: 35, buffalo: 8, goat: 4, poultry: 5 },
    named: [],
    shedNames: ['Main shed', 'Buffalo shed', 'Goat shed', 'Poultry shed'],
    members: 3,
    quietDays: 0,
    milkers: 0,
    exact: true,
  },
  {
    id: FEATURED.farms.yadav,
    name: 'Yadav Dairy',
    ownerId: FEATURED.owners.rajendra,
    language: 'hi',
    district: 'Mathura',
    state: 'Uttar Pradesh',
    blackbox: false,
    online: true,
    afternoon: false,
    species: { cattle: 28, buffalo: 14, goat: 3 },
    named: [named('shyama', '04', 'Shyama', 'Sahiwal')],
    shedNames: ['Main shed', 'Buffalo shed'],
    members: 2,
    quietDays: 0,
    milkers: 0,
    exact: true,
  },
  {
    id: FEATURED.farms.singh,
    name: 'Singh Dairy',
    ownerId: FEATURED.owners.deepak,
    language: 'hi',
    district: 'Karnal',
    state: 'Haryana',
    blackbox: false,
    online: true,
    afternoon: false,
    species: { cattle: 8, buffalo: 6 },
    named: [],
    shedNames: ['Main shed'],
    members: 1,
    quietDays: 5,
    milkers: 0,
    exact: true,
  },
  {
    id: FEATURED.farms.lakshmi,
    name: 'Lakshmi Farm',
    ownerId: FEATURED.owners.lakshmi,
    language: 'ta',
    district: 'Namakkal',
    state: 'Tamil Nadu',
    blackbox: false,
    online: true,
    afternoon: false,
    species: { cattle: 5, goat: 4 },
    named: [],
    shedNames: ['Main shed'],
    members: 0,
    quietDays: 0,
    milkers: 0,
    exact: true,
  },
];

/** Farmers still to generate, per language, on top of the featured owners (60 in all). */
const GENERATED_OWNERS: [Lang, number][] = [
  ['hi', 16],
  ['mr', 14],
  ['gu', 8],
  ['ta', 5],
  ['ml', 5],
  ['en', 5],
];
const SECOND_FARM_COUNT = 6;
const GENERATED_BLACKBOX_FARMS = 6;
const SHED_NAMES = ['Main shed', 'Buffalo shed', 'Calf & goat shed', 'Dry cow shed'];
const FARM_SUFFIXES = ['Dairy', 'Farm', 'Gotha', 'Pashu Farm', 'Pashu Palan', 'Farms'];

/** Species shares for generated farms, so the whole herd comes out near 55/20/15/rest. */
const SPECIES_WEIGHTS: [string, number][] = [
  ['cattle', 0.5],
  ['buffalo', 0.2],
  ['goat', 0.17],
  ['sheep', 0.065],
  ['poultry', 0.037],
  ['pig', 0.022],
  ['horse', 0.006],
];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Generates the demo data. Same seed and same `nowMs` give identical data. Record ids depend on
 * neither the date nor the time of day, so a stored change log still applies on later days.
 */
export function generateSeed(nowMs: number = Date.now(), seed: number = DEMO_SEED): SeedData {
  const anchor = Math.floor(nowMs / HOUR) * HOUR; // stable within the hour
  const today = istDate(anchor);
  const rng = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[int(0, list.length - 1)] as T;
  function shuffled<T>(list: readonly T[]): T[] {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }

  // ---- staff ----
  const admin_staff: AdminStaff[] = STAFF.map((s, i) => ({
    user_id: seedId('staff', i + 1),
    full_name: s.name,
    email: s.email,
    role: s.role,
    status: s.email.startsWith('vikram') ? 'invited' : 'active',
    invited_by: i === 0 ? null : FEATURED.staff.anjali,
    created_at: toIso(anchor - (s.email.startsWith('vikram') ? 3 : 300 - i * 30) * DAY),
    last_active_at: s.email.startsWith('vikram') ? null : toIso(anchor - i * 3 * HOUR),
  }));

  // ---- profiles and farm plans ----
  const profiles: Profile[] = [];
  const phones = new Set<string>();
  let profileSeq = FEATURED_OWNERS.length;
  const newPhone = () => {
    for (;;) {
      const phone = `+91${int(7, 9)}${String(int(0, 999_999_999)).padStart(9, '0')}`;
      if (!phones.has(phone)) {
        phones.add(phone);
        return phone;
      }
    }
  };
  const addProfile = (id: string, fullName: string, language: Lang, phone: string) => {
    phones.add(phone);
    profiles.push({
      id,
      full_name: fullName,
      phone,
      language,
      avatar_url: null,
      created_at: toIso(anchor - int(30, 320) * DAY),
    });
    return id;
  };
  for (const owner of FEATURED_OWNERS) {
    addProfile(owner.id, owner.name, owner.language, owner.phone);
  }

  const usedNames = new Set(FEATURED_OWNERS.map((o) => o.name));
  const personName = (language: Lang) => {
    const pool = NAMES[language];
    for (let tries = 0; ; tries++) {
      const name = `${pick(pool.first)} ${pick(pool.last)}`;
      if (!usedNames.has(name) || tries > 50) {
        usedNames.add(name);
        return name;
      }
    }
  };

  const plans: FarmPlan[] = [...FEATURED_FARMS];
  const usedFarmNames = new Set(plans.map((p) => p.name));
  let farmSeq = plans.length;
  const planFarm = (
    ownerId: string,
    ownerName: string,
    language: Lang,
    state: string,
  ): FarmPlan => {
    const surname = ownerName.split(' ').pop() ?? ownerName;
    let name = `${surname} ${pick(FARM_SUFFIXES)}`;
    for (let tries = 0; usedFarmNames.has(name); tries++) {
      // Same surname as another farm: try another suffix, then the owner's first name.
      const base = tries < 4 ? surname : ownerName.split(' ')[0];
      name = `${base} ${pick(FARM_SUFFIXES)}`;
      if (tries > 20) name = `${ownerName} ${pick(FARM_SUFFIXES)}`;
    }
    usedFarmNames.add(name);
    const place = PLACES[state];
    return {
      id: seedId('farm', ++farmSeq),
      name,
      ownerId,
      language,
      district: pick(place?.districts ?? ['Pune']),
      state,
      blackbox: false,
      online: true,
      afternoon: false,
      species: {},
      named: [],
      shedNames: [],
      members: int(0, 3),
      quietDays: 0,
      milkers: 0,
      exact: false,
    };
  };

  const generatedOwners: { id: string; name: string; language: Lang; state: string }[] = [];
  for (const [language, count] of GENERATED_OWNERS) {
    for (let i = 0; i < count; i++) {
      const name = personName(language);
      const id = addProfile(seedId('profile', ++profileSeq), name, language, newPhone());
      generatedOwners.push({ id, name, language, state: pick(STATES_BY_LANG[language]) });
    }
  }
  const generatedPlans: FarmPlan[] = generatedOwners.map((o) =>
    planFarm(o.id, o.name, o.language, o.state),
  );
  // Six farmers own two farms: Ramesh Patil (as in the prototype) and five others.
  const ramesh = FEATURED_OWNERS[0]!;
  generatedPlans.push(planFarm(ramesh.id, ramesh.name, ramesh.language, 'Maharashtra'));
  for (const o of shuffled(generatedOwners).slice(0, SECOND_FARM_COUNT - 1)) {
    generatedPlans.push(planFarm(o.id, o.name, o.language, o.state));
  }

  // Fill in the generated plans: size, sheds, quiet farms, Blackbox.
  shuffled(generatedPlans).forEach((plan, i) => {
    plan.blackbox = i < GENERATED_BLACKBOX_FARMS;
    plan.afternoon = i >= GENERATED_BLACKBOX_FARMS && i < GENERATED_BLACKBOX_FARMS + 5;
    if (i >= 20 && i < 26) plan.quietDays = int(4, 6);
    else if (i >= 26 && i < 29) plan.quietDays = int(8, 12);
  });
  for (const plan of generatedPlans) {
    const size = plan.blackbox ? int(14, 22) : int(4, 18);
    for (let i = 0; i < size; i++) {
      const cattleBias = plan.blackbox ? 0.35 : 0;
      let roll = rng();
      let chosen = 'cattle';
      if (roll >= cattleBias) {
        roll = (roll - cattleBias) / (1 - cattleBias);
        for (const [species, weight] of SPECIES_WEIGHTS) {
          chosen = species;
          if (roll < weight) break;
          roll -= weight;
        }
      }
      plan.species[chosen] = (plan.species[chosen] ?? 0) + 1;
    }
    const shedCount = int(1, 4);
    plan.shedNames = SHED_NAMES.slice(0, shedCount);
  }
  plans.push(...generatedPlans);

  // ---- farms, sheds, members ----
  const farms: Farm[] = [];
  const farm_members: FarmMember[] = [];
  const sheds: Shed[] = [];
  let shedSeq = 0;
  const shedsByFarm = new Map<string, Shed[]>();
  const memberIdsByFarm = new Map<string, string[]>();
  for (const plan of plans) {
    const place = PLACES[plan.state];
    const created = anchor - int(40, 320) * DAY;
    // An owner can't have joined after their own farm started.
    const owner = profiles.find((profile) => profile.id === plan.ownerId);
    if (owner && Date.parse(owner.created_at) > created) owner.created_at = toIso(created - DAY);
    // Drawn even when a plan sets its own pin, so every later random number stays the same.
    const lat = place ? round1(place.lat + (rng() - 0.5) * 2) : null;
    const lng = place ? round1(place.lng + (rng() - 0.5) * 2) : null;
    farms.push({
      id: plan.id,
      owner_id: plan.ownerId,
      name: plan.name,
      description: plan.description ?? null,
      lat: plan.pin?.lat ?? lat,
      lng: plan.pin?.lng ?? lng,
      settings: { high_temp_c: 39.5, offline_after_min: 15 },
      created_at: toIso(created),
      district: plan.district,
      state: plan.state,
      poultry_count: plan.species.poultry ? plan.species.poultry * int(40, 120) : null,
    });
    const farmSheds = plan.shedNames.map((name, i) => {
      const shed: Shed = {
        id: seedId('shed', ++shedSeq),
        farm_id: plan.id,
        name,
        code: `S${i + 1}`,
        created_at: toIso(created + (i + 1) * HOUR),
      };
      sheds.push(shed);
      return shed;
    });
    shedsByFarm.set(plan.id, farmSheds);

    farm_members.push({ farm_id: plan.id, user_id: plan.ownerId, role: 'owner' });
    const extras =
      typeof plan.members === 'number'
        ? Array.from({ length: plan.members }, () => ({
            name: personName(plan.language),
            role: (rng() < 0.4 ? 'manager' : 'worker') as MemberRole,
          }))
        : plan.members;
    const memberIds = [plan.ownerId];
    for (const extra of extras) {
      const id = addProfile(seedId('profile', ++profileSeq), extra.name, plan.language, newPhone());
      farm_members.push({ farm_id: plan.id, user_id: id, role: extra.role });
      memberIds.push(id);
    }
    memberIdsByFarm.set(plan.id, memberIds);
  }

  // ---- animals ----
  const animals: Animal[] = [];
  let animalSeq = 100; // 1 to 99 are reserved for named animals
  let aadhaarSeq = 0;
  let createdStep = 0;
  const femaleMilkersByFarm = new Map<string, Animal[]>();
  const blackboxByFarm = new Map(plans.map((p) => [p.id, p.blackbox]));
  for (const plan of plans) {
    interface Slot {
      id: string | null;
      species: string;
      name: string | null;
      breed: string | null;
      tag: string | null;
      status: Animal['status'];
      female: boolean;
    }
    const remaining = { ...plan.species };
    const slots: Slot[] = plan.named.map((n) => {
      if (n.status === 'active') remaining[n.species] = (remaining[n.species] ?? 0) - 1;
      return {
        id: n.id,
        species: n.species,
        name: n.name,
        breed: n.breed,
        tag: n.tag,
        status: n.status,
        female: true,
      };
    });
    for (const [species, count] of Object.entries(remaining)) {
      for (let i = 0; i < count; i++) {
        const roll = rng();
        const large = species === 'cattle' || species === 'buffalo';
        const female = plan.exact && large ? rng() > 0.03 : rng() > 0.12;
        const statusRoll = rng();
        let name: string | null = null;
        if (large && roll < 0.75) name = pick(female ? FEMALE_NAMES : MALE_NAMES);
        slots.push({
          id: null,
          species,
          name,
          breed: pick(BREEDS[species] ?? ['']),
          tag: null,
          status:
            plan.exact || statusRoll >= 0.04 ? 'active' : statusRoll < 0.03 ? 'sold' : 'deceased',
          female: plan.id === FEATURED.farms.periyar || female,
        });
      }
    }
    const usedTags = new Set(slots.flatMap((s) => (s.tag ? [s.tag] : [])));
    let nextTag = 1;
    for (const slot of slots) {
      if (slot.tag) continue;
      while (usedTags.has(String(nextTag).padStart(2, '0'))) nextTag++;
      slot.tag = String(nextTag).padStart(2, '0');
      usedTags.add(slot.tag);
    }
    slots.sort((a, b) => (a.tag ?? '').localeCompare(b.tag ?? ''));

    const farmSheds = shedsByFarm.get(plan.id) ?? [];
    let cattleInMainShed = 0;
    for (const slot of slots) {
      const roll = rng();
      const dobDays = int(300, 3000);
      const aadhaarRoll = rng();
      const aadhaarDigits = 482177000000 + aadhaarSeq++ * 137;
      let shed: Shed | undefined;
      if (plan.id === FEATURED.farms.shreeGanesh) {
        // 34 cattle in S1, 7 calves in S3, as on the farm page in the prototype.
        if (slot.species === 'buffalo') shed = farmSheds[1];
        else if (slot.species === 'goat') shed = farmSheds[2];
        else shed = cattleInMainShed++ < 34 ? farmSheds[0] : farmSheds[2];
      } else if (roll >= 0.03) {
        shed = pick(farmSheds);
      }
      const createdAt = toIso(anchor - 30 * DAY - createdStep++ * 3 * HOUR);
      const hasAadhaar =
        (slot.species === 'cattle' || slot.species === 'buffalo') && aadhaarRoll < 0.75;
      const animal: Animal = {
        id: slot.id ?? seedId('animal', ++animalSeq),
        farm_id: plan.id,
        shed_id: shed?.id ?? null,
        species_id: slot.species,
        tag_number: slot.tag ?? '',
        name: slot.name,
        breed: slot.breed,
        gender: (slot.female ? 'female' : 'male') as AnimalGender,
        dob: addDays(today, -dobDays),
        pashu_aadhaar: hasAadhaar ? String(aadhaarDigits) : null,
        status: slot.status,
        // Named animals have a few photos, so the page shows a row of them as in the design.
        photo_urls: [1, 2, 3]
          .slice(0, slot.name ? 3 : 1)
          .map((photo) => animalPhoto(slot.tag ?? '', photo)),
        hardware_tag_id: null,
        created_at: createdAt,
        updated_at: createdAt,
      };
      animals.push(animal);
      if (
        animal.status === 'active' &&
        animal.gender === 'female' &&
        (animal.species_id === 'cattle' || animal.species_id === 'buffalo')
      ) {
        const list = femaleMilkersByFarm.get(plan.id) ?? [];
        list.push(animal);
        femaleMilkersByFarm.set(plan.id, list);
      }
    }
  }
  const animalById = new Map(animals.map((a) => [a.id, a]));
  const activeAnimals = animals.filter((a) => a.status === 'active');
  const planById = new Map(plans.map((p) => [p.id, p]));
  const namedIds = new Set<string>(Object.values(FEATURED.animals));

  // ---- devices, collar readings, activity, environment ----
  const offlineSince = Math.min(istInstant(today, 6, 30), anchor - 2 * HOUR);
  const devices: Device[] = [];
  const sensor_readings: SensorReading[] = [];
  const activity_daily: ActivityDaily[] = [];
  const environment_readings: EnvironmentReading[] = [];
  let deviceSeq = 0;
  let readingSeq = 0;
  let envSeq = 0;
  const elapsedToday = Math.max(0.05, (anchor - istInstant(today, 0)) / DAY);
  const ambientByFarm = new Map<string, number>();

  for (const plan of plans) {
    if (!plan.blackbox) continue;
    const lastSeen = plan.online ? anchor : offlineSince;
    devices.push({
      id: seedId('device', ++deviceSeq),
      farm_id: plan.id,
      kind: 'blackbox',
      animal_id: null,
      online: plan.online,
      lag_min: 1,
      last_seen: toIso(lastSeen),
      last_temp_c: null,
      last_ambient_temp_c: null,
      last_battery_pct: null,
    });
    for (const shed of shedsByFarm.get(plan.id) ?? []) {
      for (let h = 167; h >= 0; h--) {
        const ts = anchor - h * HOUR;
        const wave = Math.sin(((ts / HOUR + 5.5 - 9) / 24) * 2 * Math.PI);
        const temp = Math.min(34, Math.max(22, round1(28 + 5.5 * wave + (rng() - 0.5) * 1.5)));
        const humidity = Math.min(85, Math.max(40, Math.round(62 - 18 * wave + (rng() - 0.5) * 8)));
        if (ts > lastSeen) continue;
        environment_readings.push({
          id: ++envSeq,
          farm_id: plan.id,
          shed_id: shed.id,
          ts: toIso(ts),
          temp_c: temp,
          humidity,
          thi: round1(0.8 * temp + (humidity / 100) * (temp - 14.4) + 46.4),
          source: 'sensor',
        });
        ambientByFarm.set(plan.id, temp);
      }
    }
  }

  const collarCandidates = activeAnimals.filter(
    (a) => a.species_id === 'cattle' && blackboxByFarm.get(a.farm_id),
  );
  // Three fevers, as demo-data.md asks: Lakshmi (40.1 °C in the prototype) and two more.
  const fevers = new Map<string, number>([[FEATURED.animals.lakshmi, 40.1]]);
  const onlineCollared = collarCandidates.filter(
    (a) => planById.get(a.farm_id)?.online && !namedIds.has(a.id),
  );
  onlineCollared.slice(5, 7).forEach((a, i) => fevers.set(a.id, i === 0 ? 39.7 : 39.9));
  // A few collars on working farms have also dropped off.
  const droppedCollars = new Set(onlineCollared.slice(-3).map((a) => a.id));

  for (const animal of collarCandidates) {
    const plan = planById.get(animal.farm_id);
    const deviceId = seedId('device', ++deviceSeq);
    animal.hardware_tag_id = deviceId;
    const base = 38.4 + rng() * 0.5;
    const dropped = droppedCollars.has(animal.id);
    const dropDelay = dropped ? int(2, 5) : 0;
    const lastSeen = plan?.online ? anchor - dropDelay * HOUR : offlineSince;
    let lastTemp = base;
    for (let h = 167; h >= 0; h--) {
      const ts = anchor - h * HOUR;
      const wave = Math.sin(((ts / HOUR + 5.5 - 10) / 24) * 2 * Math.PI);
      const value = Math.min(39.3, Math.max(38, round1(base + 0.25 * wave + (rng() - 0.5) * 0.2)));
      if (ts > lastSeen) continue;
      lastTemp = value;
      sensor_readings.push({
        id: ++readingSeq,
        farm_id: animal.farm_id,
        animal_id: animal.id,
        ts: toIso(ts),
        body_temp_c: value,
      });
    }
    const fever = fevers.get(animal.id);
    if (fever !== undefined) {
      const latest = sensor_readings[sensor_readings.length - 1];
      if (latest) latest.body_temp_c = fever;
      lastTemp = fever;
    }
    const online = Boolean(plan?.online) && !dropped;
    devices.push({
      id: deviceId,
      farm_id: animal.farm_id,
      kind: 'tag',
      animal_id: animal.id,
      online,
      lag_min: int(1, 9),
      last_seen: toIso(lastSeen),
      last_temp_c: lastTemp,
      last_ambient_temp_c: ambientByFarm.get(animal.farm_id) ?? null,
      last_battery_pct: int(35, 100),
    });
    for (let d = 89; d >= 0; d--) {
      const scale = d === 0 ? elapsedToday : 1;
      const jitter = () => 1 + (rng() - 0.5) * 0.16;
      const sit = Math.round(288 * jitter() * scale);
      const walk = Math.round(96 * jitter() * scale);
      const eat = Math.round(272 * jitter() * scale);
      const ruminate = Math.round(424 * jitter() * scale);
      const drink = Math.round(32 * jitter() * scale);
      const day = addDays(today, -d);
      activity_daily.push({
        id: `${animal.id}/${d}`,
        farm_id: animal.farm_id,
        animal_id: animal.id,
        day,
        stand_min: Math.max(0, Math.round(1440 * scale) - sit - walk - eat - ruminate - drink),
        sit_min: sit,
        walk_min: walk,
        eat_min: eat,
        ruminate_min: ruminate,
        drink_min: drink,
      });
    }
  }

  // ---- milk ----
  const milk_entries: MilkEntry[] = [];
  let milkSeq = 1000; // 1 to 999 are reserved for featured entries
  const sessionHour: Record<MilkSession, number> = { morning: 6, afternoon: 13, evening: 18 };
  const addMilk = (
    id: string,
    farmId: string,
    animalId: string | null,
    day: ISODate,
    session: MilkSession,
    litres: number,
    price: number,
    createdBy: string | null,
    minute: number,
  ) => {
    milk_entries.push({
      id,
      farm_id: farmId,
      animal_id: animalId,
      entry_date: day,
      session,
      litres,
      price_per_litre: price,
      created_by: createdBy,
      created_at: toIso(Math.min(anchor, istInstant(day, sessionHour[session], minute))),
    });
  };
  for (const plan of plans) {
    const sessions: [MilkSession, number][] = plan.afternoon
      ? [
          ['morning', 0.45],
          ['afternoon', 0.2],
          ['evening', 0.35],
        ]
      : [
          ['morning', 0.55],
          ['evening', 0.45],
        ];
    const milkers = femaleMilkersByFarm.get(plan.id) ?? [];
    const memberIds = memberIdsByFarm.get(plan.id) ?? [plan.ownerId];
    const price = int(38, 48);
    const perAnimal = milkers.slice(0, plan.milkers);
    for (let d = 89; d >= 0; d--) {
      const day = addDays(today, -d);
      const growth = 1 + 0.001 * (89 - d);
      for (const [session, share] of sessions) {
        // Today's evening session hasn't happened yet, so it's never generated. The sequence and
        // the random draws stay the same either way, which keeps ids stable from day to day.
        const skip = (d === 0 && session === 'evening') || d < plan.quietDays;
        if (perAnimal.length > 0) {
          for (const animal of perAnimal) {
            const noise = rng();
            const minute = int(0, 45);
            const id = seedId('milk', ++milkSeq);
            if (skip) continue;
            let litres = round1(9 * share * growth * (0.8 + noise * 0.4));
            if (d === 0 && animal.id === FEATURED.animals.gauri) {
              litres = session === 'morning' ? 5.5 : 4.0; // as on the animal page
            }
            addMilk(
              id,
              plan.id,
              animal.id,
              day,
              session,
              litres,
              price,
              memberIds[1] ?? plan.ownerId,
              minute,
            );
          }
        } else {
          const noise = rng();
          const minute = int(0, 45);
          const id = seedId('milk', ++milkSeq);
          if (skip) continue;
          const herd = Math.max(1, milkers.length);
          const litres = round1(herd * 7.5 * share * growth * (0.9 + noise * 0.2));
          addMilk(id, plan.id, null, day, session, litres, price, plan.ownerId, minute);
        }
      }
    }
  }
  addMilk(
    FEATURED.milk.yadavWrongEntry,
    FEATURED.farms.yadav,
    FEATURED.animals.shyama,
    addDays(today, -1),
    'evening',
    75.0,
    40,
    FEATURED.owners.rajendra,
    20,
  );

  // ---- feed ----
  const feed_entries: FeedEntry[] = [];
  let feedSeq = 0;
  for (const plan of plans) {
    const silage = rng() < 0.3;
    const herd = Object.values(plan.species).reduce((sum, n) => sum + n, 0);
    const farmSheds = shedsByFarm.get(plan.id) ?? [];
    const kinds = silage ? FEED_KINDS : FEED_KINDS.slice(0, 3);
    for (let d = 89; d >= 0; d--) {
      const day = addDays(today, -d);
      for (const kind of kinds) {
        const noise = rng();
        const shedRoll = rng();
        const minute = int(0, 50);
        const id = seedId('feed', ++feedSeq);
        if (d < plan.quietDays) continue;
        const quantity = Math.round(herd * kind.kgPerAnimal * (0.9 + noise * 0.2));
        feed_entries.push({
          id,
          farm_id: plan.id,
          shed_id: shedRoll < 0.25 ? (pick(farmSheds)?.id ?? null) : null,
          animal_id: null,
          entry_date: day,
          feed_type: kind.type,
          quantity_kg: quantity,
          cost: Math.round(quantity * kind.costPerKg),
          created_by: plan.ownerId,
          created_at: toIso(Math.min(anchor, istInstant(day, 5, minute))),
        });
      }
    }
  }

  // ---- vaccinations ----
  const vaccinations: Vaccination[] = [];
  let vaccinationSeq = 0;
  const addVaccination = (
    animal: Animal,
    name: string,
    due: ISODate,
    done: ISODate | null,
    description: string | null = null,
  ) => {
    vaccinations.push({
      id: seedId('vaccination', ++vaccinationSeq),
      farm_id: animal.farm_id,
      animal_id: animal.id,
      vaccine_name: name,
      description,
      due_date: due,
      done_date: done,
      created_at: toIso(Math.min(anchor, istInstant(addDays(due, -30), 10))),
    });
  };
  const vaccineAnimals = shuffled(
    activeAnimals.filter((a) => GESTATION_DAYS[a.species_id] !== undefined),
  );
  const gauri = animalById.get(FEATURED.animals.gauri);
  const ammini = animalById.get(FEATURED.animals.ammini);
  if (gauri) {
    addVaccination(gauri, VACCINES[0]!, addDays(today, 4), null);
    addVaccination(gauri, VACCINES[2]!, addDays(today, 27), null);
    addVaccination(gauri, VACCINES[1]!, addDays(today, -60), addDays(today, -59));
  }
  if (ammini) addVaccination(ammini, VACCINES[4]!, addDays(today, 7), null);
  const VACCINATION_TARGET = 1500;
  for (let i = vaccinations.length; i < VACCINATION_TARGET; i++) {
    const animal = vaccineAnimals[i % vaccineAnimals.length] as Animal;
    const pass = Math.floor(i / vaccineAnimals.length);
    const name = VACCINES[(i + pass * 2) % VACCINES.length] as string;
    const roll = rng();
    const offset = rng();
    if (roll < 0.1) {
      addVaccination(animal, name, addDays(today, -1 - Math.floor(offset * 30)), null);
    } else if (roll < 0.3) {
      addVaccination(animal, name, addDays(today, Math.floor(offset * 8)), null);
    } else if (roll < 0.6) {
      addVaccination(
        animal,
        name,
        addDays(today, 8 + Math.floor(offset * 40)),
        null,
        offset < 0.2 ? 'Booster dose' : null,
      );
    } else {
      const due = addDays(today, -1 - Math.floor(offset * 85));
      addVaccination(animal, name, due, addDays(due, Math.floor(offset * 100) % 2));
    }
  }

  // ---- health events ----
  const health_events: HealthEvent[] = [];
  let healthSeq = 0;
  const collared = new Set(collarCandidates.map((a) => a.id));
  const addHealth = (
    animal: Animal,
    status: HealthEvent['status'],
    title: string,
    notes: string | null,
    detected: number,
    source: HealthEvent['source'],
  ) => {
    health_events.push({
      id: seedId('health', ++healthSeq),
      farm_id: animal.farm_id,
      animal_id: animal.id,
      status,
      title,
      notes,
      detected_at: toIso(detected),
      resolved_at: status === 'resolved' ? toIso(detected + int(1, 10) * DAY) : null,
      source,
    });
  };
  const lakshmiCow = animalById.get(FEATURED.animals.lakshmi);
  const neeli = animalById.get(FEATURED.animals.neeli);
  if (lakshmiCow)
    addHealth(
      lakshmiCow,
      'detected',
      'Fever',
      'Collar reading above the fever limit',
      anchor - 3 * HOUR,
      'sensor',
    );
  if (neeli) addHealth(neeli, 'sick', 'Fever', 'പാൽ കുറഞ്ഞു', anchor - 2 * DAY, 'manual');
  if (gauri) addHealth(gauri, 'resolved', 'Mastitis', null, anchor - 110 * DAY, 'manual');

  const healthPool = shuffled(activeAnimals.filter((a) => !namedIds.has(a.id)));
  const OPEN_HEALTH = 120;
  const RESOLVED_HEALTH = 300;
  const healthSource = (animal: Animal): HealthEvent['source'] => {
    const roll = rng();
    if (roll < 0.15) return 'gau';
    return roll < 0.45 && collared.has(animal.id) ? 'sensor' : 'manual';
  };
  const healthNote = (animal: Animal) => {
    const roll = rng();
    const language = planById.get(animal.farm_id)?.language ?? 'en';
    return roll < 0.4 ? pick(HEALTH_NOTES[language]) : null;
  };
  for (let i = 0; i < OPEN_HEALTH - 2; i++) {
    const animal = healthPool[i % healthPool.length] as Animal;
    const roll = rng();
    const status = roll < 0.3 ? 'sick' : roll < 0.85 ? 'detected' : 'condition';
    addHealth(
      animal,
      status,
      pick(HEALTH_TITLES),
      healthNote(animal),
      anchor - int(1, 300) * HOUR,
      healthSource(animal),
    );
  }
  const resolvedPool = shuffled(animals);
  for (let i = 0; i < RESOLVED_HEALTH - 1; i++) {
    const animal = resolvedPool[i % resolvedPool.length] as Animal;
    addHealth(
      animal,
      'resolved',
      pick(HEALTH_TITLES),
      healthNote(animal),
      anchor - int(12, 200) * DAY,
      healthSource(animal),
    );
  }

  // ---- reproduction cycles ----
  const reproduction_cycles: ReproductionCycle[] = [];
  let cycleSeq = 0;
  const addCycle = (
    animal: Animal,
    fields: Partial<ReproductionCycle> &
      Pick<ReproductionCycle, 'status' | 'cycle_no' | 'created_at'>,
  ) => {
    reproduction_cycles.push({
      id: seedId('cycle', ++cycleSeq),
      farm_id: animal.farm_id,
      animal_id: animal.id,
      heat_started_at: null,
      golden_start: null,
      golden_end: null,
      heat_confirmed: null,
      inseminated_at: null,
      tube_number: null,
      insemination_verified: false,
      insemination_image_url: null,
      pregnancy_confirmed_at: null,
      expected_delivery: null,
      delivered_at: null,
      source: collared.has(animal.id) ? 'sensor' : 'manual',
      ...fields,
    });
  };
  const tubeNumber = () =>
    `${pick(['GIR', 'SAH', 'KAN', 'VEC', 'MUR'])}-${int(21, 25)}-${String(int(1, 999)).padStart(4, '0')}`;
  /** A heat whose golden period (2 to 12 hours after it started) ends this far from now. */
  const addHeat = (animal: Animal, hoursLeft: number, confirmed: boolean | null) => {
    const started = anchor + (hoursLeft - 12) * HOUR;
    addCycle(animal, {
      status: 'heat',
      cycle_no: 1,
      heat_started_at: toIso(started),
      golden_start: toIso(started + 2 * HOUR),
      golden_end: toIso(started + 12 * HOUR),
      heat_confirmed: confirmed,
      created_at: toIso(started),
    });
  };
  const addPregnant = (
    animal: Animal,
    cycleNo: number,
    daysLeft: number,
    /** Extra detail for an animal whose page is shown off: its heat, and a later confirmation. */
    fullStory = false,
  ) => {
    const gestation = GESTATION_DAYS[animal.species_id] ?? 283;
    const inseminated = istInstant(addDays(today, daysLeft - gestation), 10);
    const tube = tubeNumber();
    addCycle(animal, {
      status: 'pregnant',
      cycle_no: cycleNo,
      inseminated_at: toIso(inseminated),
      heat_confirmed: true,
      tube_number: tube,
      insemination_verified: true,
      insemination_image_url: slipImage(tube),
      pregnancy_confirmed_at: toIso(inseminated + (fullStory ? 69 : 25) * DAY),
      expected_delivery: addDays(today, daysLeft),
      created_at: toIso(inseminated),
      ...(fullStory && {
        heat_started_at: toIso(inseminated - DAY),
        golden_start: toIso(inseminated - 6 * HOUR),
        golden_end: toIso(inseminated + 6 * HOUR),
      }),
    });
  };
  const ganga = animalById.get(FEATURED.animals.ganga);
  const shanti = animalById.get(FEATURED.animals.shanti);
  const kamla = animalById.get(FEATURED.animals.kamla);
  if (gauri) {
    // Second pregnancy, day 209 of 283, after a calf in January, as on the animal page.
    addCycle(gauri, {
      status: 'delivered',
      cycle_no: 1,
      heat_started_at: toIso(anchor - 587 * DAY),
      inseminated_at: toIso(anchor - 586 * DAY),
      pregnancy_confirmed_at: toIso(anchor - 520 * DAY),
      expected_delivery: addDays(today, -303),
      delivered_at: toIso(anchor - 303 * DAY),
      insemination_verified: true,
      created_at: toIso(anchor - 586 * DAY),
    });
    addPregnant(gauri, 2, 74, true);
  }
  if (kamla) addPregnant(kamla, 1, 6);
  if (ganga) addHeat(ganga, 8, true);
  if (shanti) addHeat(shanti, 4, true);

  const breedingPool = shuffled(
    activeAnimals.filter(
      (a) =>
        a.gender === 'female' &&
        !namedIds.has(a.id) &&
        (a.species_id === 'cattle' || a.species_id === 'buffalo'),
    ),
  );
  let next = 0;
  const takeAnimal = () => breedingPool[next++ % breedingPool.length] as Animal;
  for (let i = 0; i < 4; i++) addHeat(takeAnimal(), 1 + i, i % 2 === 0 ? true : null);
  for (let i = 0; i < 19; i++) addHeat(takeAnimal(), 6.5 + rng() * 5, rng() < 0.6 ? true : null);
  for (let i = 0; i < 80; i++) {
    const animal = takeAnimal();
    const when = anchor - int(1, 20) * DAY - int(0, 12) * HOUR;
    const tube = tubeNumber();
    const hasSlip = rng() < 0.85;
    addCycle(animal, {
      status: 'inseminated',
      cycle_no: 1,
      inseminated_at: toIso(when),
      tube_number: tube,
      insemination_verified: i >= 30,
      insemination_image_url: hasSlip ? slipImage(tube) : null,
      heat_confirmed: true,
      created_at: toIso(when),
    });
  }
  for (let i = 0; i < 138; i++) {
    const animal = takeAnimal();
    const gestation = GESTATION_DAYS[animal.species_id] ?? 283;
    const daysLeft = i < 5 ? 1 + i : int(8, gestation - 30);
    const history = rng() < 0.25;
    if (history) {
      const when = anchor - (gestation + 400) * DAY;
      addCycle(animal, {
        status: 'delivered',
        cycle_no: 1,
        inseminated_at: toIso(when),
        expected_delivery: istDate(when + gestation * DAY),
        delivered_at: toIso(when + gestation * DAY),
        insemination_verified: true,
        created_at: toIso(when),
      });
    }
    addPregnant(animal, history ? 2 : 1, daysLeft);
  }

  // ---- activity log: 40 past entries over the last 14 days, by the staff above ----
  const admin_audit_log: AuditLogEntry[] = [];
  const editors = admin_staff.filter((s) => s.role !== 'viewer' && s.status === 'active');
  const farmLevelMilk = milk_entries.filter((m) => m.animal_id === null);
  const doneVaccines = vaccinations.filter((v) => v.done_date !== null);
  const AUDIT_COUNT = 40;
  for (let i = 0; i < AUDIT_COUNT; i++) {
    const at =
      anchor -
      14 * DAY +
      Math.round(((i + 0.5) / AUDIT_COUNT) * (14 * DAY - 2 * HOUR)) +
      int(0, 20) * MINUTE;
    const day = istDate(at);
    const staff = pick(editors) as AdminStaff;
    let record: Pick<
      AuditLogEntry,
      'action' | 'table_name' | 'record_id' | 'farm_id' | 'changes' | 'note'
    >;
    const note = pick(FIX_NOTES);
    const candidates = farmLevelMilk.filter((m) => m.entry_date === day);
    const milk = candidates.length > 0 ? pick(candidates) : (farmLevelMilk[0] as MilkEntry);
    switch (i % 6) {
      case 0:
        record = {
          action: 'update',
          table_name: 'milk_entries',
          record_id: milk.id,
          farm_id: milk.farm_id,
          changes: { litres: { from: round1(milk.litres + 10), to: milk.litres } },
          note,
        };
        break;
      case 1: {
        const vaccine = pick(doneVaccines);
        record = {
          action: 'update',
          table_name: 'vaccinations',
          record_id: vaccine.id,
          farm_id: vaccine.farm_id,
          changes: { done_date: { from: null, to: vaccine.done_date } },
          note: null,
        };
        break;
      }
      case 2: {
        const animal = pick(activeAnimals);
        record = {
          action: 'update',
          table_name: 'animals',
          record_id: animal.id,
          farm_id: animal.farm_id,
          changes: { breed: { from: `${animal.breed ?? ''}i`, to: animal.breed } },
          note: 'Spelling fix',
        };
        break;
      }
      case 3: {
        const feed = pick(feed_entries);
        record = {
          action: 'update',
          table_name: 'feed_entries',
          record_id: feed.id,
          farm_id: feed.farm_id,
          changes: { quantity_kg: { from: feed.quantity_kg * 10, to: feed.quantity_kg } },
          note,
        };
        break;
      }
      case 4: {
        const farm = pick(farms);
        record = {
          action: 'update',
          table_name: 'farms',
          record_id: farm.id,
          farm_id: farm.id,
          changes: { district: { from: null, to: farm.district } },
          note: 'Filled in from the farmer’s address',
        };
        break;
      }
      default: {
        // A duplicate that staff removed: the row is gone, the log keeps it.
        const removedId = seedId('milk', 900 - i);
        record = {
          action: 'delete',
          table_name: 'milk_entries',
          record_id: removedId,
          farm_id: milk.farm_id,
          changes: { ...milk, id: removedId },
          note: 'Logged twice, original kept',
        };
      }
    }
    admin_audit_log.push({
      id: i + 1,
      at: toIso(at),
      staff_id: staff.user_id,
      staff_name: staff.full_name,
      ...record,
    });
  }
  // The stories the prototype tells: replace three rows with the featured records.
  const story = (index: number, fields: Partial<AuditLogEntry>) => {
    const row = admin_audit_log[index];
    if (row) admin_audit_log[index] = { ...row, ...fields };
  };
  const bhuriAnimal = animalById.get(FEATURED.animals.bhuri);
  const motiAnimal = animalById.get(FEATURED.animals.moti);
  const vikram = admin_staff[4] as AdminStaff;
  if (bhuriAnimal) {
    story(38, {
      action: 'update',
      table_name: 'animals',
      record_id: bhuriAnimal.id,
      farm_id: bhuriAnimal.farm_id,
      changes: { status: { from: 'active', to: 'sold' } },
      note: 'Farmer sold her',
    });
  }
  if (motiAnimal) {
    story(30, {
      action: 'update',
      table_name: 'animals',
      record_id: motiAnimal.id,
      farm_id: motiAnimal.farm_id,
      changes: { status: { from: 'active', to: 'deceased' } },
      note: 'Farmer told support on a call',
    });
  }
  story(34, {
    staff_id: FEATURED.staff.anjali,
    staff_name: 'Anjali Menon',
    action: 'insert',
    table_name: 'admin_staff',
    record_id: vikram.user_id,
    farm_id: null,
    changes: { ...vikram },
    note: null,
  });

  return {
    species: SPECIES,
    profiles,
    farms,
    farm_members,
    sheds,
    animals,
    milk_entries,
    feed_entries,
    vaccinations,
    health_events,
    reproduction_cycles,
    environment_readings,
    sensor_readings,
    activity_daily,
    devices,
    admin_staff,
    admin_audit_log,
  };
}
