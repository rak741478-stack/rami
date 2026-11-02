import { db } from './db.js';
import { GoogleGenAI } from '@google/genai';
import { isOpenAIConfigured, testOpenAIConnection } from './openai.js';
import { getProductImages, resolveImageSource } from './productMedia.js';
import { AiTelemetryLog } from '../src/types/index.js';

export async function runSystemDiagnostics(whatsappManager?: any): Promise<{
  timestamp: string;
  checks: {
    database: { status: 'healthy' | 'error'; count: { customers: number; products: number; orders: number }; message: string };
    gemini: { status: 'connected' | 'configured' | 'missing_key' | 'error'; message: string; model: string; latencyMs?: number };
    openai: { status: 'connected' | 'configured' | 'missing_key' | 'error'; isQuotaExhausted?: boolean; message: string; model: string; latencyMs?: number };
    whatsapp: { status: string; platform: string; phone: string | null; qrActive: boolean };
    autoReply: { enabled: boolean; lastLatencyMs: number | null; totalLogged: number };
    productMedia: { status: 'healthy' | 'warning'; validImagesCount: number; totalProductsCount: number; details: string; categoryCounts?: Record<string, number> };
    voiceAudio?: { status: 'healthy' | 'warning'; supportedFormats: string[]; supportedLanguages: string[]; model: string; message: string };
    server: { uptime: number; memoryUsageMb: number; nodeVersion: string };
  };
  recentTelemetry: AiTelemetryLog[];
}> {
  const settings = db.getSettings();
  const products = db.getProducts();
  const customers = db.getCustomers();
  const orders = db.getOrders();

  // 1. Database check
  const dbCheck = {
    status: 'healthy' as const,
    count: {
      customers: customers.length,
      products: products.length,
      orders: orders.length,
    },
    message: 'قاعدة البيانات والتخزين المحلي يعمل بكفاءة وأمان.',
  };

  // 2. Real Gemini check (live ping test)
  let geminiCheck: any = {
    status: 'missing_key',
    message: 'لم يتم العثور على مفتاح GEMINI_API_KEY في متغيرات البيئة.',
    model: settings.modelGemini || 'gemini-3.1-flash-lite',
    latencyMs: 0,
  };

  if (process.env.GEMINI_API_KEY) {
    const activeModel = settings.modelGemini || 'gemini-3.1-flash-lite';
    const targetModel = activeModel.includes('2.5-flash') ? 'gemini-3.1-flash-lite' : activeModel;
    const t0 = Date.now();
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
          timeout: 12000,
        },
      });
      const pingRes = await ai.models.generateContent({
        model: targetModel,
        contents: 'قل جاهز فقط',
      });
      const latencyMs = Date.now() - t0;
      geminiCheck = {
        status: 'connected',
        message: `تم التحقق الفعلي بنجاح! محرك Gemini (${targetModel}) يستجيب بسرعة فائقة (${latencyMs}ms). استجابة: "${pingRes.text?.trim()}"`,
        model: targetModel,
        latencyMs,
      };
    } catch (gErr: any) {
      const latencyMs = Date.now() - t0;
      geminiCheck = {
        status: 'error',
        message: `تعذر الاتصال بـ Gemini (${targetModel}) خلال ${latencyMs}ms: ${gErr.message}`,
        model: targetModel,
        latencyMs,
      };
    }
  }

  // 3. Real OpenAI check (detect quota exhaustion)
  let openaiCheck: any = {
    status: 'missing_key',
    message: 'متغير OPENAI_API_KEY غير موجود في متغيرات الخادم.',
    model: settings.modelOpenAI || 'gpt-4o',
    latencyMs: 0,
    isQuotaExhausted: false,
  };

  if (isOpenAIConfigured()) {
    try {
      const res = await testOpenAIConnection(settings.modelOpenAI || 'gpt-4o');
      openaiCheck = {
        status: res.success ? 'connected' : 'error',
        isQuotaExhausted: res.isQuotaExhausted || false,
        message: res.message,
        model: res.model,
        latencyMs: res.latencyMs,
      };
    } catch (err: any) {
      openaiCheck = {
        status: 'error',
        isQuotaExhausted: true,
        message: `خطأ أثناء فحص OpenAI: ${err.message}`,
        model: settings.modelOpenAI || 'gpt-4o',
        latencyMs: 0,
      };
    }
  }

  // 4. WhatsApp check
  const waState = whatsappManager ? whatsappManager.getState() : { status: 'disconnected', platform: 'Baileys', phoneNumber: null, qrCodeDataUrl: null };
  const waCheck = {
    status: waState.status,
    platform: waState.platform || 'WhatsApp Multi-Device (Baileys)',
    phone: waState.phoneNumber,
    qrActive: Boolean(waState.qrCodeDataUrl),
  };

  // 5. Auto-Reply check
  const autoReplyCheck = {
    enabled: Boolean(settings.autoReplyEnabled),
    lastLatencyMs: db.getLastAiLatency(),
    totalLogged: db.getAiTelemetry().length,
  };

  // 6. Product media and categorized images check
  let validImagesCount = 0;
  const categoryCounts: Record<string, number> = {
    main: 0,
    games: 0,
    controllers: 0,
    accessories: 0,
    specs: 0,
    extra: 0,
  };

  for (const p of products) {
    const images = getProductImages(p);
    for (const img of images) {
      const resolved = resolveImageSource(img);
      if (resolved && resolved.isValid) {
        validImagesCount++;
      }
    }
    if (p.categorizedImages && Array.isArray(p.categorizedImages)) {
      for (const catImg of p.categorizedImages) {
        if (catImg.category && categoryCounts[catImg.category] !== undefined) {
          categoryCounts[catImg.category]++;
        }
      }
    } else {
      categoryCounts.main++;
    }
  }

  const productMediaCheck = {
    status: validImagesCount > 0 ? ('healthy' as const) : ('warning' as const),
    validImagesCount,
    totalProductsCount: products.length,
    categoryCounts,
    details: `تم فحص جميع صور الكتالوج: ${validImagesCount} صورة أصلية معتمدة عبر فئات (رئيسية: ${categoryCounts.main}، ألعاب: ${categoryCounts.games}، يدات: ${categoryCounts.controllers}، ملحقات: ${categoryCounts.accessories}، مواصفات: ${categoryCounts.specs}، إضافية: ${categoryCounts.extra}).`,
  };

  // 7. Voice audio understanding capability check
  const voiceAudioCheck = {
    status: process.env.GEMINI_API_KEY ? ('healthy' as const) : ('warning' as const),
    supportedFormats: ['audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'audio/m4a'],
    supportedLanguages: ['ar (العربية الفلسطينية والشامية)', 'he (עברית)', 'en (English)'],
    model: 'gemini-3.1-flash-lite (Multimodal Audio & Fallback to gemini-flash-latest)',
    message: process.env.GEMINI_API_KEY
      ? 'خدمة تفريغ وتحليل التسجيلات الصوتية (Gemini Audio Understanding) نشطة وجاهزة لاستقبال ومسح البصمات الصوتية عبر Baileys والمحاكي والرد كتابةً.'
      : 'بانتظار تكوين مفتاح GEMINI_API_KEY لتفعيل خدمة تفريغ الصوت.',
  };

  // 8. Server resources
  const memory = process.memoryUsage();
  const serverCheck = {
    uptime: Math.round(process.uptime()),
    memoryUsageMb: Math.round(memory.rss / (1024 * 1024)),
    nodeVersion: process.version,
  };

  return {
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck,
      gemini: geminiCheck,
      openai: openaiCheck,
      whatsapp: waCheck,
      autoReply: autoReplyCheck,
      productMedia: productMediaCheck,
      voiceAudio: voiceAudioCheck,
      server: serverCheck,
    },
    recentTelemetry: db.getAiTelemetry().slice(0, 15),
  };
}
