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
    name: 'תל אביב- קריסה מבנית כבדה',
    description:
      'קריסה מבנית חמורה של בניין מגורים בן 4 קומות בעקבות פגיעה ישירה. ' +
      'הגג נהרס לחלוטין, קירות חיצוניים סדוקים ללא אפשרות לתיקון, הריסות חוסמות את הרחוב הסמוך. ',
    tags: 'הרס מבני, קריסת גג',
    lat: 32.08320,
    lng: 34.78710,
    address: 'רחוב דיזנגוף, תל אביב',
    city: 'תל אביב',
    imagePath: '/test-images/heavy_01.png',
    expected: {
      aiClassification: 'Heavy',
      damageScore: 7,
      note: 'Dense urban area — expect high GIS multiplier, final score ≈ 8–10',
    },
  },
  {
    id: 'tpl-light-rg',
    name: 'רמת גן- נזק קל למעבר מבנים',
    description:
      'נזק מקומי מאוד הממוקד אך ורק בחלק העליון של גשר החיבור, ללא השפעה על יציבות המבנים עצמם. ' +
      'פגיעה בגגון הקל של המעבר, יחד עם מזגן שנפגע ומספר פנלים שיצאו ממקומם. ',
    tags: 'קל, שטחי',
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
    id: 'tpl-medium-haifa',
    name: 'חיפה- חזית מבנה מגורים משולב מסחר',
    description:
      'סביב אזור הפגיעה המרכזי בקומות העליונות קיימים סימני פיח שחור משמעותיים על גבי הקירות החיצוניים, המעידים על התלקחות או פיצוץ. ' +
      'חלונות ותריסים בקומות שמתחת ובסמוך לאזור הפגיעה התעקמו, נשברו או יצאו ממסילותיהם. יחידות מיזוג אוויר חיצוניות באזור הפגוע נראות תלויות או פגועות.',
    tags: 'חנויות, עסקים',
    lat: 32.82170,
    lng: 34.99118,
    address: 'המושבה הגרמנית, חיפה',
    city: 'חיפה',
    imagePath: '/test-images/medium_01.png',
    expected: {
      aiClassification: 'Medium',
      damageScore: 5,
      note: 'Port/industrial zone — expect moderate-high GIS multiplier',
    },
  },
  {
    id: 'tpl-light-revivim',
    name: 'קיבוץ רביבים- נזק קל מבודד',
    description:
      'ניכר כי הקיר ספג פגיעות נקודתיות (נזקי רסיסים או קילופי טיח) ופיח בחלקו העליון, אך הוא עומד יציב ושלם ללא פגיעה קונסטרוקטיבית או סכנת קריסה. ' +
      'הנזק העיקרי הוא הפיזור של אבק בטון, טיח ופסולת על הרצפה והשולחנות, יחד עם כיסאות שהתהפכו.',
    tags: 'נגב, דרום',
    lat: 31.0000,
    lng: 34.8833,
    address: 'קיבוץ רביבים, נגב',
    city: 'קיבוץ רביבים',
    imagePath: '/test-images/light_02.jpg',
    expected: {
      aiClassification: 'Light',
      damageScore: 3,
      note: 'Remote desert — no nearby hospital/road → strong isolation penalty → low final score despite damage',
    },
  },
  {
    id: 'tpl-light-mitzpe',
    name: 'מצפה רמון- נזק כבד מרוחק',
    description:
      ': החלק המרכזי של החלל חטף פגיעה קשה שהובילה לקריסה מלאה של הגג/התקרה והקיר האחורי. קורות בטון, בלוקים וצלעות מתכת קרסו פנימה.' +
      'בעקבות קריסת הקירות והגג, החלל הפנימי פתוח לגמרי לשמיים ולסביבה החיצונית. ',
    tags: 'מבודד, נגב, דרום,',
    lat: 30.6100,
    lng: 34.8010,
    address: 'מכתש רמון, מצפה רמון',
    city: 'מצפה רמון',
    imagePath: '/test-images/heavy_02.jpg',
    expected: {
      aiClassification: 'Heavy',
      damageScore: 7,
      note: 'Maximum isolation — all GIS distances beyond 15 km → multiplier minimum → lowest possible priority',
    },
  },
  {
    id: 'tpl-medium-tlv',
    name: 'תל אביב- נזק בינוני לבניין',
    description:
      'חלונות מנופצים לאורך חזית הלבנים ונזק מקומי למרפסת תלויה בצד ימין, אלמנטים הניתנים לשיקום ותיקון מבלי להרוס את הבניין כולו.',
    tags: 'נזק קוסמטי, מרכז, ',
    lat: 32.05700,
    lng: 34.75800,
    address: 'שכונת נווה צדק, תל אביב',
    city: 'תל אביב',
    imagePath: '/test-images/medium_02.jpeg',
    expected: {
      aiClassification: 'Medium',
      damageScore: 5,
      note: 'Dense urban Tel Aviv — medium damage with high GIS multiplier → critical-range priority',
    },
  },
  {
    id: 'tpl-heavy-jerusalem',
    name: 'ירושלים- קריסה מבנית חמורה',
    description:
      'קריסה מלאה של הקומות העליונות והתקרות במרכז המבנה, כאשר כל חומרי הבנייה, הלבנים וקורות העץ נפלו פנימה ומטה.' +
      'גג הרעפים ושלד העץ התומך שלו הושמדו לחלוטין ונותרו כערימת קורות שבורות וחשופות.',
    tags: 'נזק מבני, עירוני, מרכזי, קריסה',
    lat: 31.7845,
    lng: 35.2133,
    address: 'שוק מחנה יהודה, ירושלים',
    city: 'ירושלים',
    imagePath: '/test-images/heavy_03.jpg',
    expected: {
      aiClassification: 'Heavy',
      damageScore: 7,
      note: 'Dense urban Jerusalem — high hospital/school proximity → high multiplier → critical priority',
    },
  },
];
