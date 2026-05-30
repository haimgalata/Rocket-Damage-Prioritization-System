export interface TestTemplate {
  id: string;
  name: string;
  description: string;
  tags: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  imagePath: string;
  expected: {
    aiClassification: 'Heavy' | 'Medium' | 'Light';
    damageScore: 7 | 5 | 3;
    note: string;
  };
}

export const TEST_TEMPLATES: TestTemplate[] = [
  {
    id: 'tpl-heavy-tlv',
    name: 'תל אביב — קריסה מבנית כבדה',
    description:
      '[TEST] Severe structural collapse of a 4-story residential building following direct impact. ' +
      'Roof completely destroyed, outer walls cracked beyond repair, debris blocking adjacent street. ' +
      '| EXPECTED → AI: Heavy (score 7) | GIS: high hospital/school proximity → multiplier > 1.0 | Final priority > 7.0',
    tags: 'structural, heavy, test',
    lat: 32.08320,
    lng: 34.78710,
    address: 'רחוב דיזנגוף, תל אביב',
    city: 'תל אביב',
    imagePath: '/test-images/heavy_01.jpg',
    expected: {
      aiClassification: 'Heavy',
      damageScore: 7,
      note: 'Dense urban area — expect high GIS multiplier, final score ≈ 8–10',
    },
  },
  {
    id: 'tpl-light-rg',
    name: 'רמת גן — נזק קל לחזית',
    description:
      '[TEST] Minor facade cracking and broken windows on a commercial building. ' +
      'Structural integrity intact, no risk of collapse. Interior operations unaffected. ' +
      '| EXPECTED → AI: Light (score 3) | GIS: suburban proximity → multiplier ≈ 1.0 | Final priority ≈ 3.0–4.5',
    tags: 'facade, light, test',
    lat: 32.08500,
    lng: 34.81200,
    address: 'רחוב ז\'בוטינסקי, רמת גן',
    city: 'רמת גן',
    imagePath: '/test-images/light_01.jpg',
    expected: {
      aiClassification: 'Light',
      damageScore: 3,
      note: 'Suburban area — expect neutral GIS multiplier, final score ≈ 3–4.5',
    },
  },
  {
    id: 'tpl-heavy-haifa',
    name: 'חיפה — נזק תעשייתי כבד',
    description:
      '[TEST] Severe damage to an industrial warehouse — roof partially collapsed, ' +
      'structural beams exposed, hazardous material storage area compromised. ' +
      '| EXPECTED → AI: Heavy (score 7) | GIS: port/industrial zone proximity → multiplier variable | Final priority > 6.0',
    tags: 'industrial, heavy, hazmat, test',
    lat: 32.81948,
    lng: 34.99862,
    address: 'אזור הנמל, חיפה',
    city: 'חיפה',
    imagePath: '/test-images/heavy_02.jpg',
    expected: {
      aiClassification: 'Heavy',
      damageScore: 7,
      note: 'Port/industrial zone — expect moderate-high GIS multiplier',
    },
  },
  {
    id: 'tpl-light-revivim',
    name: 'קיבוץ רביבים — נזק קל מבודד',
    description:
      '[TEST] Minor perimeter fence and irrigation damage at Kibbutz Revivim in the central Negev desert. ' +
      'No structural risk. Small rural community far from hospitals and roads. ' +
      '| EXPECTED → AI: Light (score 3) | GIS: no hospital/road within 15 km → multiplier < 1.0 (isolation penalty) | Final priority ≈ 1.5–2.5',
    tags: 'isolated, light, negev, test',
    lat: 31.0000,
    lng: 34.8833,
    address: 'קיבוץ רביבים, נגב',
    city: 'דרום',
    imagePath: '/test-images/light_01.jpg',
    expected: {
      aiClassification: 'Light',
      damageScore: 3,
      note: 'Remote desert — no nearby hospital/road → strong isolation penalty → low final score despite damage',
    },
  },
  {
    id: 'tpl-light-mitzpe',
    name: 'מצפה רמון — נזק קל מרוחק',
    description:
      '[TEST] Surface cratering in parking area of the Ramon Crater visitor centre. ' +
      'Glass facade cracked; no structural damage. Location is 25 km from nearest hospital, ' +
      'population density near zero. ' +
      '| EXPECTED → AI: Light (score 3) | GIS: all features >15 km → maximum isolation penalty | Final priority ≈ 1.0–2.0',
    tags: 'isolated, remote, tourism, test',
    lat: 30.6100,
    lng: 34.8010,
    address: 'מכתש רמון, מצפה רמון',
    city: 'דרום',
    imagePath: '/test-images/light_01.jpg',
    expected: {
      aiClassification: 'Light',
      damageScore: 3,
      note: 'Maximum isolation — all GIS distances beyond 15 km → multiplier minimum → lowest possible priority',
    },
  },
  {
    id: 'tpl-medium-tlv',
    name: 'תל אביב — נזק בינוני לבניין',
    description:
      '[TEST] Moderate structural damage to a 4-story mixed-use building in Neve Tzedek. ' +
      'Two internal load-bearing walls cracked, upper floors evacuated for assessment. ' +
      'No full collapse but building uninhabitable pending structural review. ' +
      '| EXPECTED → AI: Medium (score 5) | GIS: dense urban → multiplier ~1.7 | Final priority ≈ 7.5–9.0',
    tags: 'structural, medium, test',
    lat: 32.05700,
    lng: 34.75800,
    address: 'שכונת נווה צדק, תל אביב',
    city: 'תל אביב',
    imagePath: '/test-images/medium_01.jpg',
    expected: {
      aiClassification: 'Medium',
      damageScore: 5,
      note: 'Dense urban Tel Aviv — medium damage with high GIS multiplier → critical-range priority',
    },
  },
  {
    id: 'tpl-heavy-jerusalem',
    name: 'ירושלים — קריסת גג בשוק',
    description:
      '[TEST] Roof collapse over 40 stalls in Mahane Yehuda market. ' +
      'Two support columns fractured, dense pedestrian zone, hospital within 4 km. ' +
      '| EXPECTED → AI: Heavy (score 7) | GIS: dense urban, hospital close → multiplier > 1.0 | Final priority ≈ 8–10',
    tags: 'structural, heavy, urban, test',
    lat: 31.7845,
    lng: 35.2133,
    address: 'שוק מחנה יהודה, ירושלים',
    city: 'ירושלים',
    imagePath: '/test-images/heavy_01.jpg',
    expected: {
      aiClassification: 'Heavy',
      damageScore: 7,
      note: 'Dense urban Jerusalem — high hospital/school proximity → high multiplier → critical priority',
    },
  },
];
