import fs from 'fs';
import path from 'path';
import { Product, ProductImageCategory, CategorizedProductImage } from '../src/types/index.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');

export const PRODUCT_IMAGE_CATEGORIES: Array<{
  id: ProductImageCategory;
  ar: string;
  he: string;
  en: string;
}> = [
  { id: 'main', ar: 'صورة المنتج الرئيسية', he: 'תמונה ראשית של המוצר', en: 'Main Product Photo' },
  { id: 'games', ar: 'صور الألعاب', he: 'תמונות משחקים', en: 'Games Photos' },
  { id: 'controllers', ar: 'صور أيدي التحكم', he: 'תמונות שלטים ובקרים', en: 'Controllers Photos' },
  { id: 'accessories', ar: 'صور الملحقات', he: 'תמונות אביזרים ונלווים', en: 'Accessories Photos' },
  { id: 'specs', ar: 'صور المواصفات', he: 'תמונות מפרט ואריזה', en: 'Specs & Box Photos' },
  { id: 'extra', ar: 'صور إضافية', he: 'תמונות נוספות', en: 'Extra Photos' },
];

export function getCategoryLabel(category: ProductImageCategory, lang: 'ar' | 'he' | 'en' = 'ar'): string {
  const match = PRODUCT_IMAGE_CATEGORIES.find((c) => c.id === category);
  if (!match) return category;
  return match[lang] || match.ar;
}

/**
 * Normalizes text for lenient fuzzy keyword matching
 */
function normalizeSearchText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ي]/g, 'ى')
    .replace(/[\u0591-\u05C7]/g, '') // strip Hebrew cantillation/nikud
    .trim();
}

/**
 * Returns all categorized images for a product with 100% backward compatibility
 */
export function getAllCategorizedImages(product: Product): CategorizedProductImage[] {
  if (!product) return [];
  const list: CategorizedProductImage[] = [];
  const seenUrls = new Set<string>();

  // 1. If explicit categorizedImages array exists, use its entries
  if (Array.isArray(product.categorizedImages) && product.categorizedImages.length > 0) {
    for (const item of product.categorizedImages) {
      if (item && item.url && !seenUrls.has(item.url.trim())) {
        seenUrls.add(item.url.trim());
        list.push({
          id: item.id || `img-${Date.now()}-${list.length}`,
          url: item.url.trim(),
          title: item.title?.trim() || getCategoryLabel(item.category || 'extra'),
          category: item.category || 'extra',
          order: typeof item.order === 'number' ? item.order : list.length,
        });
      }
    }
  }

  // 2. Ensure primary imageUrl from product is included as main if not already present
  if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    const mainUrl = product.imageUrl.trim();
    if (!seenUrls.has(mainUrl)) {
      seenUrls.add(mainUrl);
      list.unshift({
        id: 'img-main-legacy',
        url: mainUrl,
        title: 'صورة المنتج الرئيسية',
        category: 'main',
        order: 0,
      });
    }
  }

  // 3. Ensure legacy images array entries are preserved
  if (Array.isArray(product.images)) {
    for (let i = 0; i < product.images.length; i++) {
      const u = product.images[i];
      if (u && typeof u === 'string' && u.trim() && !seenUrls.has(u.trim())) {
        seenUrls.add(u.trim());
        list.push({
          id: `img-extra-legacy-${i}`,
          url: u.trim(),
          title: 'صورة إضافية',
          category: 'extra',
          order: list.length,
        });
      }
    }
  }

  return list.sort((a, b) => a.order - b.order);
}

/**
 * Filter product images by requested category or all
 */
export function filterProductImagesByCategory(
  product: Product,
  category: ProductImageCategory | 'all' | 'any'
): CategorizedProductImage[] {
  if (!product) return [];
  const allImages = getAllCategorizedImages(product);
  if (allImages.length === 0) return [];

  if (category === 'all') {
    // Respect WhatsApp delivery burst limits (max 10)
    return allImages.slice(0, 10);
  }

  if (category === 'any') {
    const main = allImages.find((img) => img.category === 'main');
    return main ? [main] : [allImages[0]];
  }

  // Filter specific category
  const filtered = allImages.filter((img) => img.category === category);
  return filtered;
}

export interface DetectedImageIntent {
  isRequest: boolean;
  category: ProductImageCategory | 'all' | 'any';
  categoryLabelAr: string;
  categoryLabelHe: string;
  isSpecificCategory: boolean;
}

/**
 * Detects if the incoming message is asking to see photos/images of a product
 * in either Arabic, Hebrew, or English.
 */
export function detectImageRequestIntent(text: string): boolean {
  if (!text) return false;
  const t = text.trim();

  // Arabic triggers
  const arabicRegex = /(صورة|صوره|صور|صورتها|صورته|صورهم|صورها|صورتهن|ورجيني|فرجيني|ابعثلي صورة|ابعث صورة|ارسل صورة|ارسل لي صورة|ممكن صورة|ممكن صورتها|بدي اشوف|ممكن اشوف|كيف شكله|كيف شكلها|عرض الصور|صور المنتج|صورة المنتج|صور حقيقية|الصور|يدات|العاب|ألعاب)/i;
  
  // Hebrew triggers
  const hebrewRegex = /(תמונה|תמונות|תמונה של|תמונות של|תמונה שלו|תמונה שלה|תמונה של זה|אפשר תמונה|אפשר לראות|אפשר תמונות|איך זה נראה|איך הוא נראה|איך היא נראית|שלח תמונה|שלחי תמונה|שלח תמונות|שלחי תמונות|תמונות מקוריות|יש תמונה|משחקים|שלטים|בקרים)/i;

  // English triggers
  const englishRegex = /(photo|photos|picture|pictures|image|images|pic|pics|show me|can i see|send photo|send picture|how does it look|games|controllers)/i;

  return arabicRegex.test(t) || hebrewRegex.test(t) || englishRegex.test(t);
}

/**
 * Deep intent classification for requested image category in colloquial Arabic, Hebrew, and English
 */
export function detectRequestedImageCategory(text: string): DetectedImageIntent {
  if (!text) {
    return {
      isRequest: false,
      category: 'any',
      categoryLabelAr: 'صورة المنتج',
      categoryLabelHe: 'תמונת מוצר',
      isSpecificCategory: false,
    };
  }

  const isRequest = detectImageRequestIntent(text);
  const clean = normalizeSearchText(text);

  // 1. Games (ألعاب)
  // Arabic: ألعاب, العاب, صور الألعاب, العابها, ورجيني الالعاب
  // Hebrew: משחקים, משחק, תמונות משחקים
  // English: games, game photos
  const gamesRegex = /(العاب|ألعاب|الالعاب|الألعاب|اللعبه|اللعبة|العابها|ألعابها|مشחקים|משחק|games|game)/i;
  if (gamesRegex.test(clean) && isRequest) {
    return {
      isRequest: true,
      category: 'games',
      categoryLabelAr: 'صور الألعاب',
      categoryLabelHe: 'תמונות משחקים',
      isSpecificCategory: true,
    };
  }

  // 2. Controllers (أيدي التحكم / اليدات)
  // Arabic: يدات, يدات تحكم, يد تحكم, ايادي تحكم, ايادي التحكم, كنترولر, كنترولرات, كونترولر, جويستيك, جيم باد, اليد
  // Hebrew: שלטים, שלט, בקרים, בקר, ג'ויסטיק
  // English: controller, controllers, gamepad, joystick
  const controllersRegex = /(يدات|يدات تحكم|يد تحكم|ايدي تحكم|ايادي تحكم|ايدي التحكم|ايادي التحكم|كنترولر|كنترولرات|كونترولر|جويستيك|جيم باد|שלטים|שלט|בקרים|בקר|ג'ויסטיק|controller|controllers|gamepad|joystick)/i;
  if (controllersRegex.test(clean) && isRequest) {
    return {
      isRequest: true,
      category: 'controllers',
      categoryLabelAr: 'صور أيدي التحكم',
      categoryLabelHe: 'תמונות שלטים ובקרים',
      isSpecificCategory: true,
    };
  }

  // 3. Accessories (الملحقات / الإكسسوارات)
  // Arabic: ملحقات, الملحقات, اكسسوارات, إكسسوارات, كوابل, قواعد, شواحن ملحقة
  // Hebrew: אביזרים, נלווים, תוספות
  // English: accessories, cables, attachments
  const accessoriesRegex = /(ملحقات|الملحقات|اكسسوارات|إكسسوارات|الاكسسوارات|كوابل|وصلات|אביזרים|נלווים|accessories|cables)/i;
  if (accessoriesRegex.test(clean) && isRequest) {
    return {
      isRequest: true,
      category: 'accessories',
      categoryLabelAr: 'صور الملحقات',
      categoryLabelHe: 'תמונות אביזרים',
      isSpecificCategory: true,
    };
  }

  // 4. Specs / Packaging (المواصفات / العلبة)
  // Arabic: مواصفات, المواصفات, كرتونة, كرتونه, علبة, علبه, باكيت, جدول المواصفات
  // Hebrew: מפרט, קופסה, אריזה
  // English: specs, specifications, box, packaging
  const specsRegex = /(مواصفات|المواصفات|كرتونة|كرتونه|علبة|علبه|باكيت|جدول المواصفات|מפרט|קופסה|אריזה|specs|specifications|box)/i;
  if (specsRegex.test(clean) && isRequest) {
    return {
      isRequest: true,
      category: 'specs',
      categoryLabelAr: 'صور المواصفات والعلبة',
      categoryLabelHe: 'תמונות מפרט ואריזה',
      isSpecificCategory: true,
    };
  }

  // 5. All Photos (كل الصور)
  // Arabic: كل الصور, جميع الصور, كل صوره, كل صورها, كل الصور المتوفرة, كل الصور المتاحة, الصور كلها, ابعثهم كلهم
  // Hebrew: כל התמונות, כל התמונה, תמונות כולן, את כולן, את כולם
  // English: all photos, all pictures, all images, send all, show all
  const allRegex = /(كل الصور|جميع الصور|كل صوره|كل صورها|كل الصور المتوفرة|كل الصور المتاحة|الصور كلها|ابعثهم كلهم|ارسلهم كلهم|كلهم|כל התמונות|את כולן|את כולם|כל התמונה|all photos|all pictures|all images|send all|show all)/i;
  if (allRegex.test(clean) && isRequest) {
    return {
      isRequest: true,
      category: 'all',
      categoryLabelAr: 'جميع صور المنتج',
      categoryLabelHe: 'כל תמונות המוצר',
      isSpecificCategory: true,
    };
  }

  // 6. Main Product Photo (صورة المنتج الرئيسية) or general photo inquiry
  const mainRegex = /(صورة المنتج|صورة الجهاز|الصورة الرئيسية|الرئيسية|صورتها|صورته|كيف شكله|كيف شكلها|ورجيني اياه|ورجيني اياها|بدي اشوفه|بدي اشوفها|תמונה של המוצר|תמונה ראשית|תמונה שלו|תמונה שלה|איך זה נראה|main photo|product photo|how it looks)/i;
  if (mainRegex.test(clean) || isRequest) {
    return {
      isRequest: isRequest,
      category: 'main',
      categoryLabelAr: 'صورة المنتج الرئيسية',
      categoryLabelHe: 'תמונה ראשית של המוצר',
      isSpecificCategory: false,
    };
  }

  return {
    isRequest: false,
    category: 'any',
    categoryLabelAr: 'صورة المنتج',
    categoryLabelHe: 'תמונת מוצר',
    isSpecificCategory: false,
  };
}

/**
 * Finds a product in the catalog by ID, SKU, or name
 */
export function findProductByRef(products: Product[], ref: string): Product | null {
  if (!ref || !products || products.length === 0) return null;
  const cleanRef = normalizeSearchText(ref);

  // 1. Direct match on ID or SKU
  for (const p of products) {
    if (p.id.toLowerCase() === ref.toLowerCase() || p.sku.toLowerCase() === ref.toLowerCase()) {
      return p;
    }
  }

  // 2. Exact match on Arabic, Hebrew, or English name
  for (const p of products) {
    if (
      normalizeSearchText(p.name) === cleanRef ||
      normalizeSearchText(p.arabicName) === cleanRef ||
      normalizeSearchText(p.hebrewName) === cleanRef
    ) {
      return p;
    }
  }

  // 3. Substring match
  for (const p of products) {
    const skuNorm = normalizeSearchText(p.sku);
    const arNorm = normalizeSearchText(p.arabicName);
    const heNorm = normalizeSearchText(p.hebrewName);
    const enNorm = normalizeSearchText(p.name);

    if (
      cleanRef.includes(skuNorm) ||
      cleanRef.includes(arNorm) ||
      (heNorm && cleanRef.includes(heNorm)) ||
      cleanRef.includes(enNorm)
    ) {
      return p;
    }
  }

  // 4. Characteristic keyword heuristics (e.g. "سماعات", "x1", "ساعة", "شاعة", "ألترا", "ultra watch", "purifier", "منقي", "charger", "ماغ")
  for (const p of products) {
    const pKeywords: string[] = [];
    if (p.sku.includes('SND') || p.name.includes('Sound') || p.arabicName.includes('سماعات') || p.hebrewName.includes('אוזניות')) {
      pKeywords.push('سماعة', 'سماعات', 'sound', 'x1', 'אוזניות');
    }
    if (p.sku.includes('WCH') || p.name.includes('Watch') || p.arabicName.includes('ساعة') || p.hebrewName.includes('שעון')) {
      pKeywords.push('ساعة', 'ساعه', 'watch', 'ultra', 'الترا', 'שעון');
    }
    if (p.sku.includes('AIR') || p.name.includes('Air') || p.arabicName.includes('تنقية') || p.arabicName.includes('منقي') || p.hebrewName.includes('מטהר')) {
      pKeywords.push('تنقية', 'منقي', 'هواء', 'air', 'purifier', 'מטהר');
    }
    if (p.sku.includes('CHG') || p.name.includes('Charger') || p.arabicName.includes('شاحن') || p.arabicName.includes('شحن') || p.hebrewName.includes('מטען')) {
      pKeywords.push('شاحن', 'شحن', 'charger', 'mag', 'טורבו', 'מטען');
    }

    if (pKeywords.some((kw) => cleanRef.includes(normalizeSearchText(kw)))) {
      return p;
    }
  }

  return null;
}

/**
 * Identifies target product using context: current text -> history (backwards) -> customer memory
 */
export function resolveTargetProductFromContext(params: {
  incomingText: string;
  history: Array<{ sender: string; text: string }>;
  customerInterests?: string[];
  products: Product[];
}): Product | null {
  const { incomingText, history, customerInterests, products } = params;

  // Step 1: Check if the current message explicitly names a product
  const directMatch = findProductByRef(products, incomingText);
  if (directMatch) return directMatch;

  // Step 2: Traverse history in reverse (most recent message first)
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg.text) continue;
    const historyMatch = findProductByRef(products, msg.text);
    if (historyMatch) return historyMatch;
  }

  // Step 3: Check customer memory interests
  if (customerInterests && customerInterests.length > 0) {
    for (const interest of customerInterests) {
      const interestMatch = findProductByRef(products, interest);
      if (interestMatch) return interestMatch;
    }
  }

  // Fallback: If there's only 1 product in the catalog, default to it
  if (products.length === 1) {
    return products[0];
  }

  return null;
}

/**
 * Returns a deduplicated array of all valid images for a product
 */
/**
 * Returns a deduplicated array of all valid images for a product
 */
export function getProductImages(product: Product): string[] {
  if (!product) return [];
  const categorized = getAllCategorizedImages(product);
  const urls: string[] = categorized.map((img) => img.url);

  if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    urls.unshift(product.imageUrl.trim());
  }

  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (img && typeof img === 'string' && img.trim()) {
        urls.push(img.trim());
      }
    }
  }

  // Deduplicate preserving order
  return Array.from(new Set(urls.filter(Boolean)));
}

export interface ResolvedMediaSource {
  type: 'local_file' | 'remote_url';
  originalUrl: string;
  filePath?: string;
  buffer?: Buffer;
  url?: string;
  isValid: boolean;
}

/**
 * Resolves an image URL into a local file buffer or valid remote URL
 */
export function resolveImageSource(imageUrl: string): ResolvedMediaSource | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const clean = imageUrl.trim();

  // Local uploads
  if (clean.startsWith('/uploads/') || clean.startsWith('uploads/')) {
    const filename = path.basename(clean);
    const filePath = path.join(UPLOADS_DIR, filename);
    const exists = fs.existsSync(filePath);
    let buffer: Buffer | undefined;

    if (exists) {
      try {
        buffer = fs.readFileSync(filePath);
      } catch (err) {
        console.error(`Failed to read local media image at ${filePath}:`, err);
      }
    }

    return {
      type: 'local_file',
      originalUrl: clean,
      filePath,
      buffer,
      isValid: exists && Boolean(buffer && buffer.length > 0),
    };
  }

  // Remote URL
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return {
      type: 'remote_url',
      originalUrl: clean,
      url: clean,
      isValid: true,
    };
  }

  return null;
}

/**
 * Detects if the message asks specifically for details beyond just the photo
 * (e.g. price, specs, warranty, delivery, order).
 */
export function hasSpecificDetailRequest(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const detailTriggers = [
    // Price / cost
    'سعر', 'سعره', 'سعرها', 'اسعار', 'أسعار', 'بكم', 'بكام', 'كم حقه', 'كم حقها', 'تكلفة', 'تكلفته', 'شيكل', 'دينار', 'دولار',
    'מחיר', 'כמה עולה', 'כמה זה', 'עלות', 'ש"ח', 'שקל',
    'price', 'cost', 'how much',
    // Specifications / features / details
    'مواصفات', 'مواصفاته', 'مواصفاتها', 'تفاصيل', 'تفاصيله', 'تفاصيلها', 'شرح', 'معلومات', 'مميزات', 'ميزاته', 'عيوب', 'حجم', 'وزن', 'ابعاد', 'أبعاد',
    'מפרט', 'פרטים', 'מידע', 'תכונות',
    'specs', 'specifications', 'details', 'features',
    // Warranty / Delivery / Purchasing
    'ضمان', 'ضمانه', 'كفالة', 'توصيل', 'شحن', 'طلب', 'اشتري', 'احجز', 'حجز',
    'אחריות', 'משלוח', 'להזמין', 'לקנות',
    'warranty', 'shipping', 'delivery', 'order', 'buy',
  ];

  return detailTriggers.some((trigger) => t.includes(trigger));
}

/**
 * Returns true if customer wants to see the product image only, without requesting additional specific details
 */
export function isImageOnlyRequest(text: string): boolean {
  return detectImageRequestIntent(text) && !hasSpecificDetailRequest(text);
}

/**
 * Builds caption for product image.
 * Returns empty string so the original image is sent completely alone without any caption,
 * without product name, price, specs, discount, warranty, or emojis.
 */
export function buildProductCaption(product?: Product, lang: 'ar' | 'he' | 'en' = 'ar'): string {
  return '';
}
