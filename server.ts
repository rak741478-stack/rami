import express, { Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { db } from './server/db.js';
import { whatsappManager } from './server/whatsapp.js';
import { processCustomerMessageWithGemini, transcribeAndUnderstandAudio } from './server/gemini.js';
import {
  isOpenAIConfigured,
  testOpenAIConnection,
  processCustomerMessageWithOpenAI,
} from './server/openai.js';
import { runSystemDiagnostics } from './server/tests.js';
import { verifyAdminCredentials } from './server/auth.js';
import { resolveImageSource } from './server/productMedia.js';
import { Customer, ChatMessage, Product } from './src/types/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Serve uploaded images permanently from data/uploads
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// WebSocket clients tracking
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);

  // Send current state on connection
  ws.send(JSON.stringify({ event: 'whatsapp_status', data: whatsappManager.getState() }));

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(event: string, data: any) {
  const payload = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (e) {
        console.error('WebSocket send error:', e);
      }
    }
  }
}

whatsappManager.setBroadcast(broadcast);

// --- REST API ENDPOINTS ---

// 1. Auth routes
app.get('/api/auth/me', (req: Request, res: Response) => {
  const token = req.cookies['nexo_session'];
  if (token === 'authorized' || !process.env.REQUIRE_LOGIN) {
    return res.json({ user: db.getAdmin() });
  }
  return res.status(401).json({ error: 'Unauthenticated' });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (verifyAdminCredentials(password)) {
    res.cookie('nexo_session', 'authorized', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600 * 1000,
    });
    db.addAuditLog('LOGIN_SUCCESS', 'تسجيل دخول ناجح للوحة الإدارة', 'admin');
    return res.json({ success: true, user: db.getAdmin() });
  }
  db.addAuditLog('LOGIN_FAILED', 'محاولة فاشلة لتسجيل الدخول بكلمة مرور خاطئة', 'anonymous');
  return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('nexo_session');
  return res.json({ success: true });
});

// 2. WhatsApp controls
app.get('/api/whatsapp/status', (req: Request, res: Response) => {
  res.json(whatsappManager.getState());
});

app.post('/api/whatsapp/connect', async (req: Request, res: Response) => {
  try {
    const forceFresh = Boolean(req.body.forceFresh);
    await whatsappManager.startConnection(forceFresh);
    res.json({ success: true, message: 'بدء جلسة الاتصال بـ Baileys' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/disconnect', async (req: Request, res: Response) => {
  try {
    await whatsappManager.disconnect();
    res.json({ success: true, message: 'تم قطع الاتصال بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
  const { phone, text } = req.body;
  if (!phone || !text) {
    return res.status(400).json({ error: 'Phone and text are required' });
  }
  const sent = await whatsappManager.sendMessage(phone, text);
  return res.json({ success: sent });
});

app.post('/api/whatsapp/send-image', async (req: Request, res: Response) => {
  const { phone, imageUrl, caption } = req.body;
  if (!phone || !imageUrl) {
    return res.status(400).json({ error: 'Phone and imageUrl are required' });
  }
  const resolved = resolveImageSource(imageUrl);
  if (!resolved || !resolved.isValid) {
    return res.status(400).json({ error: 'Image source is invalid or file does not exist on server' });
  }
  const mediaPayload =
    resolved.type === 'local_file' && resolved.buffer
      ? resolved.buffer
      : { url: resolved.url || imageUrl };

  const sent = await whatsappManager.sendImageMessage(phone, mediaPayload, caption);
  return res.json({ success: sent });
});

// 3. Customers
app.get('/api/customers', (req: Request, res: Response) => {
  res.json(db.getCustomers());
});

app.get('/api/customers/:id', (req: Request, res: Response) => {
  const customer = db.getCustomerById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

app.put('/api/customers/:id', (req: Request, res: Response) => {
  const existing = db.getCustomerById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  const updated: Customer = { ...existing, ...req.body };
  db.saveCustomer(updated);
  broadcast('customer_updated', updated);
  res.json(updated);
});

app.put('/api/customers/:id/memory', (req: Request, res: Response) => {
  db.updateCustomerMemory(req.params.id, req.body);
  const updated = db.getCustomerById(req.params.id);
  broadcast('customer_updated', updated);
  res.json(updated);
});

app.post('/api/customers/:id/read', (req: Request, res: Response) => {
  db.markCustomerMessagesRead(req.params.id);
  res.json({ success: true });
});

// 4. Messages
app.get('/api/customers/:id/messages', (req: Request, res: Response) => {
  res.json(db.getMessages(req.params.id));
});

app.post('/api/customers/:id/messages', async (req: Request, res: Response) => {
  const { text, sender = 'agent' } = req.body;
  const customer = db.getCustomerById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const msg: ChatMessage = {
    id: `msg-${Date.now()}`,
    customerId: customer.id,
    sender,
    text,
    timestamp: new Date().toISOString(),
    status: 'sent',
  };

  db.addMessage(customer.id, msg);
  broadcast('chat_message', { customerId: customer.id, message: msg });

  // If live WhatsApp is connected and sender is agent, send via WhatsApp
  if (sender === 'agent' && whatsappManager.getState().status === 'connected') {
    whatsappManager.sendMessage(customer.phoneNumber, text).catch(console.error);
  }

  res.json(msg);
});

// 5. Products catalog - Full CRUD & Image Upload
app.get('/api/products', (req: Request, res: Response) => {
  res.json(db.getProducts());
});

app.post('/api/products', (req: Request, res: Response) => {
  const p = req.body;
  const categorizedImages = Array.isArray(p.categorizedImages) ? p.categorizedImages : undefined;
  
  // Resolve primary image from categorizedImages or fallback
  let primaryImageUrl = p.imageUrl?.trim();
  if (categorizedImages && categorizedImages.length > 0) {
    const mainImg = categorizedImages.find((img: any) => img.category === 'main') || categorizedImages[0];
    if (mainImg?.url) primaryImageUrl = mainImg.url;
  }
  if (!primaryImageUrl) {
    primaryImageUrl = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
  }

  const newProduct: Product = {
    id: p.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: p.name?.trim() || 'منتج جديد',
    arabicName: p.arabicName?.trim() || p.name?.trim() || 'منتج جديد',
    hebrewName: p.hebrewName?.trim() || '',
    description: p.description?.trim() || '',
    price: Number(p.price) || 0,
    originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
    currency: p.currency || 'ILS',
    sku: (p.sku?.trim() || `NX-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase(),
    stock: Number(p.stock) || 0,
    category: p.category?.trim() || 'عام',
    features: Array.isArray(p.features) ? p.features.filter(Boolean) : [],
    imageUrl: primaryImageUrl,
    images: categorizedImages ? categorizedImages.map((img: any) => img.url) : (Array.isArray(p.images) ? p.images : []),
    categorizedImages,
    inStock: typeof p.inStock === 'boolean' ? p.inStock : (Number(p.stock) > 0),
    createdAt: new Date().toISOString(),
  };

  db.saveProduct(newProduct);
  broadcast('products_updated', db.getProducts());
  db.addAuditLog('PRODUCT_CREATED', `إضافة منتج جديد للكتالوج: ${newProduct.arabicName} (${newProduct.sku}) بسعر ${newProduct.price} ${newProduct.currency}`, 'admin');
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const existing = db.getProductById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  const updates: Partial<Product> = { ...req.body };
  if (updates.price !== undefined) updates.price = Number(updates.price);
  if (updates.originalPrice !== undefined) {
    updates.originalPrice = updates.originalPrice ? Number(updates.originalPrice) : undefined;
  }
  if (updates.stock !== undefined) {
    updates.stock = Number(updates.stock);
    if (updates.inStock === undefined) {
      updates.inStock = updates.stock > 0;
    }
  }

  // If categorizedImages updated, keep imageUrl and images in sync
  if (Array.isArray(updates.categorizedImages)) {
    if (updates.categorizedImages.length > 0) {
      const mainImg = updates.categorizedImages.find((img: any) => img.category === 'main') || updates.categorizedImages[0];
      if (mainImg?.url) updates.imageUrl = mainImg.url;
      updates.images = updates.categorizedImages.map((img: any) => img.url);
    }
  }

  const updated = db.updateProduct(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'فشل تحديث المنتج' });

  broadcast('products_updated', db.getProducts());
  db.addAuditLog('PRODUCT_UPDATED', `تعديل بيانات المنتج: ${updated.arabicName} (${updated.sku})`, 'admin');
  res.json(updated);
});

app.delete('/api/products/:id', (req: Request, res: Response) => {
  const existing = db.getProductById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  const success = db.deleteProduct(req.params.id);
  if (success) {
    broadcast('products_updated', db.getProducts());
    db.addAuditLog('PRODUCT_DELETED', `حذف المنتج: ${existing.arabicName} (${existing.sku})`, 'admin');
    return res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  }
  return res.status(500).json({ error: 'تعذر حذف المنتج' });
});

// Restore sample products
app.post('/api/products/reset-samples', (req: Request, res: Response) => {
  const resetProducts = db.resetSampleProducts();
  broadcast('products_updated', resetProducts);
  db.addAuditLog('PRODUCTS_RESET', 'إعادة ضبط الكتالوج إلى المنتجات الافتراضية المعتمدة', 'admin');
  res.json({ success: true, products: resetProducts });
});

// Upload image from computer and save permanently in data/uploads
app.post('/api/products/upload-image', (req: Request, res: Response) => {
  try {
    const { imageBase64, filename = 'product.jpg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'بيانات الصورة مفقودة' });
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Extract extension
    let ext = '.jpg';
    if (imageBase64.includes('data:image/png')) ext = '.png';
    else if (imageBase64.includes('data:image/webp')) ext = '.webp';
    else if (imageBase64.includes('data:image/gif')) ext = '.gif';
    else if (filename.includes('.')) ext = path.extname(filename);

    const safeFileName = `prod-img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;
    const targetPath = path.join(UPLOADS_DIR, safeFileName);

    fs.writeFileSync(targetPath, buffer);
    const imageUrl = `/uploads/${safeFileName}`;

    db.addAuditLog('IMAGE_UPLOADED', `تم رفع صورة جديدة للمنتجات: ${safeFileName}`, 'admin');
    res.json({ success: true, url: imageUrl, filename: safeFileName });
  } catch (err: any) {
    console.error('Image upload failed:', err);
    res.status(500).json({ error: err.message || 'فشل حفظ الصورة' });
  }
});

// 5.5 AI Instructions Management Endpoints
app.get('/api/instructions', (req: Request, res: Response) => {
  res.json(db.getInstructions());
});

app.put('/api/instructions', (req: Request, res: Response) => {
  const { instructions, note = 'تحديث تعليمات الذكاء الاصطناعي', savedBy = 'admin' } = req.body;
  if (!instructions || typeof instructions !== 'object') {
    return res.status(400).json({ error: 'بيانات التعليمات غير صالحة' });
  }

  const result = db.saveInstructions(instructions, note, savedBy);
  broadcast('instructions_updated', result.instructions);
  res.json({
    success: true,
    message: 'تم حفظ التعليمات وتطبيقها بنجاح على ردود Gemini',
    ...result,
  });
});

app.get('/api/instructions/versions', (req: Request, res: Response) => {
  res.json(db.getInstructionVersions());
});

app.post('/api/instructions/versions/:id/restore', (req: Request, res: Response) => {
  const { restoredBy = 'admin' } = req.body;
  const restored = db.restoreInstructionVersion(req.params.id, restoredBy);
  if (!restored) {
    return res.status(404).json({ error: 'النسخة المطلوبة غير موجودة' });
  }
  broadcast('instructions_updated', restored);
  res.json({
    success: true,
    message: 'تمت استعادة نسخة التعليمات بنجاح',
    instructions: restored,
  });
});

// Test draft instructions before saving without altering live config
app.post('/api/instructions/test', async (req: Request, res: Response) => {
  try {
    const { draftInstructions, testMessage = 'مرحبا', customerId, model } = req.body;
    let customer = customerId ? db.getCustomerById(customerId) : null;
    if (!customer) {
      customer = {
        id: 'cust-draft-test',
        phoneNumber: '972509999999',
        name: 'عميل اختبار التعليمات',
        tags: ['اختبار'],
        notes: 'فحص مسودة التعليمات الجديدة قبل الحفظ',
        stage: 'lead',
        language: 'ar',
        unreadCount: 0,
        lastMessageAt: new Date().toISOString(),
        totalSpent: 0,
        ordersCount: 0,
        memory: {
          interests: [],
          objections: [],
          budget: null,
          preferredLanguage: 'ar',
          notes: '',
          keyFacts: [],
        },
      };
    }

    const result = await processCustomerMessageWithGemini({
      customer,
      incomingText: testMessage,
      preferredModel: model || 'gemini-3.1-flash-lite',
      overrideInstructions: draftInstructions,
    });

    res.json({
      success: true,
      replyText: result.replyText,
      modelUsed: result.modelUsed,
      tokensEstimate: result.tokensEstimate,
      latencyMs: result.stageTiming.totalMs,
      stageTiming: result.stageTiming,
    });
  } catch (err: any) {
    console.error('Instruction test error:', err);
    res.status(500).json({ error: err.message || 'فشل اختبار التعليمات' });
  }
});

// 6. Orders
app.get('/api/orders', (req: Request, res: Response) => {
  res.json(db.getOrders());
});

app.post('/api/orders', (req: Request, res: Response) => {
  const order = req.body;
  if (!order.id) {
    order.id = `ord-${Date.now()}`;
    order.orderNumber = `NX-${Math.floor(10000 + Math.random() * 90000)}`;
    order.createdAt = new Date().toISOString();
  }
  db.saveOrder(order);
  broadcast('order_created', order);
  db.addAuditLog('ORDER_CREATED', `إنشاء طلب جديد رقم ${order.orderNumber} بقيمة ${order.totalAmount} ${order.currency}`, 'admin');
  res.json(order);
});

// 7. Playbook
app.get('/api/playbook', (req: Request, res: Response) => {
  res.json(db.getPlaybook());
});

app.post('/api/playbook', (req: Request, res: Response) => {
  const rule = req.body;
  if (!rule.id) rule.id = `rule-${Date.now()}`;
  db.savePlaybookRule(rule);
  broadcast('playbook_updated', db.getPlaybook());
  res.json(rule);
});

// 8. Follow-ups
app.get('/api/follow-ups', (req: Request, res: Response) => {
  res.json(db.getFollowUps());
});

app.post('/api/follow-ups', (req: Request, res: Response) => {
  const task = req.body;
  if (!task.id) task.id = `tsk-${Date.now()}`;
  db.saveFollowUp(task);
  res.json(task);
});

// 9. Settings
app.get('/api/settings', (req: Request, res: Response) => {
  const current = db.getSettings();
  res.json({
    ...current,
    openaiConfigured: isOpenAIConfigured(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    lastLatencyMs: db.getLastAiLatency(),
  });
});

app.put('/api/settings', (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  db.addAuditLog('SETTINGS_UPDATED', `تحديث إعدادات الذكاء الاصطناعي (المزود: ${updated.provider})`, 'admin');
  broadcast('settings_updated', updated);
  res.json({
    ...updated,
    openaiConfigured: isOpenAIConfigured(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    lastLatencyMs: db.getLastAiLatency(),
  });
});

app.post('/api/settings/toggle-autoreply', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const current = db.getSettings();
  const nextState = typeof enabled === 'boolean' ? enabled : !current.autoReplyEnabled;
  const updated = db.updateSettings({ autoReplyEnabled: nextState });
  db.addAuditLog(
    nextState ? 'AUTOREPLY_ENABLED' : 'AUTOREPLY_DISABLED',
    nextState
      ? 'تم تفعيل الرد التلقائي على محادثات واتساب بنجاح'
      : 'تم إيقاف الرد التلقائي، سيتم استقبال الرسائل وعرضها في الصندوق دون ردود آلية',
    'admin'
  );
  broadcast('settings_updated', updated);
  res.json({
    success: true,
    autoReplyEnabled: updated.autoReplyEnabled,
    settings: updated,
  });
});

// 10. Audit logs & Telemetry
app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});

app.get('/api/ai/telemetry', (req: Request, res: Response) => {
  res.json(db.getAiTelemetry());
});

// 11. Diagnostics
app.get('/api/diagnostics', async (req: Request, res: Response) => {
  try {
    const report = await runSystemDiagnostics(whatsappManager);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. OpenAI Connection Test Endpoint
app.post('/api/ai/test-openai', async (req: Request, res: Response) => {
  try {
    const model = req.body.model || db.getSettings().modelOpenAI || 'gpt-4o';
    const result = await testOpenAIConnection(model);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'فشل الاتصال بـ OpenAI',
    });
  }
});

// 12.5 Audio Transcription Test Endpoint
app.post('/api/ai/test-audio', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/ogg' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'بيانات الصوت مفقودة' });
    }
    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    const result = await transcribeAndUnderstandAudio({
      audioBuffer,
      mimeType,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل تحليل الصوت' });
  }
});

// 13. Simulator: Sandbox conversation test with stage timings and isolated auto-reply verification
app.post('/api/ai/simulate', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      messageText,
      audioBase64,
      audioMimeType = 'audio/ogg',
      provider = 'gemini',
      model,
      imageBase64,
      imageMimeType,
      adReferral,
      customMemory,
      testAutoReplyBehavior = false,
    } = req.body;

    const currentSettings = db.getSettings();

    // Isolated test of Auto-Reply setting behavior if requested
    if (testAutoReplyBehavior && !currentSettings.autoReplyEnabled) {
      return res.json({
        simulatedAutoReply: false,
        autoReplyEnabled: false,
        replyText: 'الرد التلقائي متوقف حالياً. تم استلام الرسالة في صندوق الوارد وتحديث السجلات دون توليد أو إرسال أي رد آلي.',
        modelUsed: 'none',
        tokensEstimate: 0,
        latencyMs: 5,
        provider: 'system',
        stageTiming: {
          receivedAt: new Date().toISOString(),
          contextPrepMs: 5,
          aiLatencyMs: 0,
          totalMs: 5,
          exceeded15s: false,
        },
      });
    }

    let customer = customerId ? db.getCustomerById(customerId) : null;
    if (!customer) {
      customer = {
        id: 'cust-sim-01',
        phoneNumber: '972500000000',
        name: 'عميل تجريبي في المحاكي',
        tags: ['تجريبي'],
        notes: 'محادثة اختبارية داخل المحاكي',
        stage: 'lead',
        language: 'ar',
        unreadCount: 0,
        lastMessageAt: new Date().toISOString(),
        totalSpent: 0,
        ordersCount: 0,
        memory: customMemory || {
          interests: [],
          objections: [],
          budget: null,
          preferredLanguage: 'ar',
          notes: '',
          keyFacts: [],
        },
      };
    } else if (customMemory) {
      customer.memory = { ...customer.memory, ...customMemory };
    }

    // If audio is provided in simulation, transcribe it first
    let activeMessageText = messageText || '';
    let voiceTranscription: any = null;

    if (audioBase64) {
      const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
      const audioBuffer = Buffer.from(cleanBase64, 'base64');
      voiceTranscription = await transcribeAndUnderstandAudio({
        audioBuffer,
        mimeType: audioMimeType,
        preferredModel: model,
      });

      if (!voiceTranscription.isClear || !voiceTranscription.text) {
        const unclearReply =
          customer.language === 'he' || voiceTranscription.language === 'he'
            ? 'שלום! ההקלטה הקולית אינה ברורה. אנא הקלט שוב או כתוב את שאלתך ונשמח לענות מיד!'
            : 'أهلاً بك! التسجيل الصوتي غير واضح تماماً، يرجى التفضل بإعادة التسجيل أو كتابة استفسارك وسأجيبك فوراً بكل سرور.';

        return res.json({
          replyText: unclearReply,
          modelUsed: model || 'gemini-3.1-flash-lite',
          tokensEstimate: Math.round(unclearReply.length / 4),
          latencyMs: 300,
          provider: 'gemini',
          voiceTranscription,
          isAudioUnclear: true,
          stageTiming: {
            receivedAt: new Date().toISOString(),
            contextPrepMs: 5,
            aiLatencyMs: 295,
            totalMs: 300,
            exceeded15s: false,
          },
        });
      }

      activeMessageText = voiceTranscription.text;
      customer.language = voiceTranscription.language;
    }

    const startTime = Date.now();
    let result: any;
    let providerUsed = provider;
    let fallbackUsed = false;
    let fallbackReason: string | undefined;

    if (provider === 'openai') {
      try {
        result = await processCustomerMessageWithOpenAI({
          customer,
          incomingText: activeMessageText,
          imageBase64,
          imageMimeType,
          adReferral,
        });
      } catch (openAiErr: any) {
        console.warn(`Simulation OpenAI call failed: ${openAiErr.message}. Falling back automatically to Gemini.`);
        fallbackUsed = true;
        fallbackReason = openAiErr.message;
        providerUsed = 'gemini';
        result = await processCustomerMessageWithGemini({
          customer,
          incomingText: activeMessageText,
          imageBase64,
          imageMimeType,
          adReferral,
          preferredModel: model,
        });
      }
    } else {
      result = await processCustomerMessageWithGemini({
        customer,
        incomingText: activeMessageText,
        imageBase64,
        imageMimeType,
        adReferral,
        preferredModel: model,
      });
    }

    const latencyMs = result.stageTiming?.totalMs || Date.now() - startTime;

    res.json({
      replyText: result.replyText,
      modelUsed: result.modelUsed,
      tokensEstimate: result.tokensEstimate,
      latencyMs,
      provider: providerUsed,
      memoryUpdates: result.memoryUpdates,
      stageTiming: result.stageTiming,
      fallbackUsed,
      fallbackReason,
      imageActions: result.imageActions,
      voiceTranscription,
      autoReplyEnabled: currentSettings.autoReplyEnabled,
    });
  } catch (err: any) {
    console.error('Simulation error:', err);
    res.status(500).json({
      error: err.message || 'حدث خطأ أثناء المحاكاة',
    });
  }
});

// Vite middleware in dev or static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 NEXO AI Sales CRM Server running on port ${PORT}`);
  console.log(`📱 WhatsApp Baileys initialized.`);
  console.log(`✨ Gemini AI: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing Key'}`);
  console.log(`🧠 OpenAI AI: ${isOpenAIConfigured() ? 'Configured' : 'Ready (Awaiting Key in Secrets)'}\n`);
});
