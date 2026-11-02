import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';
import { db } from './db.js';
import { processCustomerMessageWithGemini, transcribeAndUnderstandAudio } from './gemini.js';
import { processCustomerMessageWithOpenAI } from './openai.js';
import { resolveImageSource, isImageOnlyRequest } from './productMedia.js';
import { WhatsAppSessionState, ChatMessage, Order, Customer, ChatStageTiming, AiTelemetryLog } from '../src/types/index.js';

let makeWASocket: any = null;
let DisconnectReason: any = null;
let useMultiFileAuthState: any = null;
let downloadMediaMessage: any = null;
let downloadContentFromMessage: any = null;

try {
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default || baileys.makeWASocket;
  DisconnectReason = baileys.DisconnectReason;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  downloadMediaMessage = baileys.downloadMediaMessage;
  downloadContentFromMessage = baileys.downloadContentFromMessage;
} catch (e) {
  console.warn('Baileys package dynamic import notice:', e);
}

const AUTH_DIR = path.resolve(process.cwd(), 'data/baileys_auth_info');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export class WhatsAppManager {
  private socket: any = null;
  private state: WhatsAppSessionState = {
    status: 'disconnected',
    qrCodeDataUrl: null,
    phoneNumber: null,
    pushName: null,
    platform: 'WhatsApp Business Web Multi-Device (Baileys)',
    lastConnectedAt: null,
    errorMessage: null,
    isLiveBaileys: true,
    reconnectAttempts: 0,
  };

  private broadcastCallback: ((event: string, data: any) => void) | null = null;
  private processedMessageIds = new Set<string>();
  private conversationLocks = new Map<string, boolean>();
  private reconnectTimeout: any = null;
  private isExplicitLogout = false;

  constructor() {
    // If credentials already exist from a previous session, attempt restore safely
    if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
      this.state.status = 'connecting';
      setTimeout(() => this.startConnection(false), 1000);
    }
  }

  public setBroadcast(cb: (event: string, data: any) => void) {
    this.broadcastCallback = cb;
  }

  private broadcast(event: string, data: any) {
    if (this.broadcastCallback) {
      try {
        this.broadcastCallback(event, data);
      } catch (e) {
        console.error('Error broadcasting event:', e);
      }
    }
  }

  public getState(): WhatsAppSessionState {
    return { ...this.state };
  }

  public async startConnection(forceFresh = false): Promise<void> {
    if (forceFresh) {
      this.clearAuthStorage();
    }

    // Clean up existing socket cleanly before reconnecting
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.end();
      } catch (_) {}
      this.socket = null;
    }

    if (!makeWASocket || !useMultiFileAuthState) {
      this.state.status = 'error';
      this.state.errorMessage = 'مكتبة Baileys غير متوفرة في بيئة التشغيل';
      this.broadcast('whatsapp_status', this.state);
      return;
    }

    this.isExplicitLogout = false;
    this.state.status = 'connecting';
    this.state.errorMessage = null;
    this.state.qrCodeDataUrl = null;
    this.broadcast('whatsapp_status', this.state);
    db.addAuditLog('WHATSAPP_CONNECT_REQUESTED', 'بدء جلسة Baileys وطلب رمز QR', 'admin');

    try {
      const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const logger = pino({ level: 'silent' });

      this.socket = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        logger,
        syncFullHistory: false,
        connectTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
      });

      this.state.isLiveBaileys = true;

      // Listen for creds updates
      this.socket.ev.on('creds.update', saveCreds);

      // Listen for connection updates
      this.socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            console.log('Baileys QR code received! Encoding data URL...');
            const qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 320,
              color: {
                dark: '#030712',
                light: '#ffffff',
              },
            });
            this.state.status = 'qr_ready';
            this.state.qrCodeDataUrl = qrDataUrl;
            this.state.errorMessage = null;
            this.broadcast('whatsapp_status', this.state);
            this.broadcast('whatsapp_qr', { qrDataUrl });
          } catch (qrErr) {
            console.error('Failed to generate QR data URL:', qrErr);
            this.state.errorMessage = 'فشل في توليد صورة رمز الـ QR';
            this.broadcast('whatsapp_status', this.state);
          }
        }

        if (connection === 'connecting') {
          if (this.state.status !== 'qr_ready') {
            this.state.status = 'connecting';
            this.broadcast('whatsapp_status', this.state);
          }
        }

        if (connection === 'open') {
          console.log('Baileys WhatsApp connection OPENED successfully!');
          this.state.status = 'connected';
          this.state.qrCodeDataUrl = null;
          this.state.reconnectAttempts = 0;
          this.state.lastConnectedAt = new Date().toISOString();
          this.state.errorMessage = null;

          const userJid = this.socket?.user?.id || '';
          this.state.phoneNumber = userJid.split(':')[0] || userJid.split('@')[0] || 'Unknown';
          this.state.pushName = this.socket?.user?.name || 'WhatsApp Business';
          this.broadcast('whatsapp_status', this.state);
          db.addAuditLog(
            'WHATSAPP_CONNECTED',
            `تم اقتران واتساب بنجاح للرقم: ${this.state.phoneNumber}`,
            'system'
          );
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          console.log('Baileys connection closed, status code:', statusCode);

          const shouldReconnect =
            !this.isExplicitLogout &&
            statusCode !== DisconnectReason?.loggedOut &&
            statusCode !== 401;

          this.state.status = shouldReconnect ? 'reconnecting' : 'disconnected';
          this.state.qrCodeDataUrl = null;

          if (statusCode === DisconnectReason?.loggedOut || statusCode === 401) {
            this.state.errorMessage = 'تم إنهاء الجلسة أو تسجيل الخروج من الهاتف. يرجى مسح الرمز من جديد.';
            this.clearAuthStorage();
          } else {
            this.state.errorMessage =
              lastDisconnect?.error?.message || 'تم قطع الاتصال المؤقت بجهاز WhatsApp.';
          }

          this.broadcast('whatsapp_status', this.state);

          if (shouldReconnect && this.state.reconnectAttempts < 5) {
            this.state.reconnectAttempts += 1;
            const backoffMs = Math.min(3000 * Math.pow(1.5, this.state.reconnectAttempts), 25000);
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              console.log(`Attempting reconnect #${this.state.reconnectAttempts}...`);
              this.startConnection(false);
            }, backoffMs);
          }
        }
      });

      // Handle incoming messages
      this.socket.ev.on('messages.upsert', async (m: any) => {
        // Only process live notifications, ignore background synchronization dumps
        if (!m.messages || m.messages.length === 0) return;
        if (m.type && m.type !== 'notify') {
          return;
        }

        const nowMs = Date.now();

        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const messageId = msg.key.id;
          if (!messageId) continue;

          // Prevent duplicate events
          if (this.processedMessageIds.has(messageId)) continue;
          this.processedMessageIds.add(messageId);
          if (this.processedMessageIds.size > 5000) {
            const firstKey = this.processedMessageIds.values().next().value;
            if (firstKey) this.processedMessageIds.delete(firstKey);
          }

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid) continue;
          // Ignore groups, status broadcasts, and newsletters
          if (remoteJid.includes('@g.us') || remoteJid.includes('@broadcast') || remoteJid.includes('@newsletter')) {
            continue;
          }

          // Filter out stale messages older than 3 minutes to avoid replying to sync history
          const msgTimestampSec = Number(msg.messageTimestamp || 0);
          if (msgTimestampSec > 0 && nowMs - msgTimestampSec * 1000 > 180000) {
            continue;
          }

          const senderPhone = remoteJid.replace(/[^0-9]/g, '');
          if (!senderPhone) continue;

          const audioMsg = msg.message?.audioMessage || msg.message?.pttMessage;
          const isAudio = Boolean(audioMsg);

          let text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

          let audioMediaUrl: string | undefined;
          let isAudioTranscription = false;
          let isAudioUnclear = false;

          if (isAudio) {
            console.log(`[WhatsApp Audio] Received voice note from ${senderPhone}, downloading media buffer...`);
            let audioBuffer: Buffer | null = null;
            try {
              if (downloadMediaMessage) {
                audioBuffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  {
                    logger: pino({ level: 'silent' }),
                    reuploadRequest: this.socket?.updateMediaMessage,
                  }
                );
              }
            } catch (dlErr: any) {
              console.warn(`[WhatsApp Audio] downloadMediaMessage failed: ${dlErr.message}`);
            }

            if (!audioBuffer && downloadContentFromMessage && audioMsg) {
              try {
                const stream = await downloadContentFromMessage(audioMsg, 'audio');
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                  chunks.push(chunk);
                }
                audioBuffer = Buffer.concat(chunks);
              } catch (streamErr: any) {
                console.error(`[WhatsApp Audio] downloadContentFromMessage stream failed: ${streamErr.message}`);
              }
            }

            if (audioBuffer && audioBuffer.length > 0) {
              try {
                const ext = audioMsg?.mimetype?.includes('mp4') ? '.mp4' : '.ogg';
                const audioFilename = `voice-${Date.now()}-${senderPhone}${ext}`;
                const audioFilePath = path.join(process.cwd(), 'data/uploads', audioFilename);
                fs.writeFileSync(audioFilePath, audioBuffer);
                audioMediaUrl = `/uploads/${audioFilename}`;
                console.log(`[WhatsApp Audio] Voice note saved at ${audioMediaUrl} (${audioBuffer.length} bytes)`);

                // Transcribe and understand audio using Gemini Audio Understanding
                const audioResult = await transcribeAndUnderstandAudio({
                  audioBuffer,
                  mimeType: audioMsg?.mimetype || 'audio/ogg',
                });

                if (audioResult.isClear && audioResult.text) {
                  text = audioResult.text;
                  isAudioTranscription = true;
                  console.log(`[WhatsApp Audio] Voice note successfully transcribed from ${senderPhone}: "${text}" [lang: ${audioResult.language}]`);
                } else {
                  isAudioUnclear = true;
                  text = '';
                  console.warn(`[WhatsApp Audio] Voice note from ${senderPhone} was unclear, silent, or inaudible`);
                }
              } catch (audioErr: any) {
                console.error('[WhatsApp Audio] Error processing audio with Gemini:', audioErr);
                isAudioUnclear = true;
                text = '';
              }
            } else {
              isAudioUnclear = true;
              text = '';
              console.warn(`[WhatsApp Audio] Audio buffer empty or failed to download for ${senderPhone}`);
            }
          }

          console.log(`[WhatsApp] Received message from ${senderPhone}: "${text || (isAudio ? '[تسجيل صوتي]' : '[وسائط]')}"`);

          // Find or create customer
          let customer = db.getCustomerByPhone(senderPhone);
          if (!customer) {
            const customerId = `cust-${senderPhone}`;
            customer = {
              id: customerId,
              phoneNumber: senderPhone,
              name: msg.pushName || `عميل ${senderPhone.slice(-4)}`,
              tags: ['جديد'],
              notes: 'عميل جديد تواصل عبر واتساب',
              stage: 'lead',
              language: /[\u0590-\u05FF]/.test(text) ? 'he' : 'ar',
              unreadCount: 1,
              lastMessageAt: new Date().toISOString(),
              totalSpent: 0,
              ordersCount: 0,
              memory: {
                interests: [],
                objections: [],
                budget: null,
                preferredLanguage: /[\u0590-\u05FF]/.test(text) ? 'he' : 'ar',
                notes: '',
                keyFacts: [],
              },
            };
            db.saveCustomer(customer);
          }

          // Record incoming message in database
          const incomingMsgText = isAudio
            ? isAudioUnclear
              ? '🎙️ [تسجيل صوتي غير واضح]'
              : `🎙️ [تسجيل صوتي]: "${text}"`
            : text || '[ملف وسائط]';

          const incomingMsg: ChatMessage = {
            id: `msg-${messageId}`,
            customerId: customer.id,
            sender: 'customer',
            text: incomingMsgText,
            timestamp: new Date().toISOString(),
            mediaUrl: audioMediaUrl,
            mediaType: isAudio ? 'audio' : undefined,
            status: 'read',
            meta: isAudio
              ? {
                  isAudioTranscription,
                  transcriptionText: text,
                }
              : undefined,
          };
          db.addMessage(customer.id, incomingMsg);
          this.broadcast('chat_message', { customerId: customer.id, message: incomingMsg });

          // If voice recording was inaudible or failed to download, respond politely in writing
          if (isAudio && isAudioUnclear) {
            const settings = db.getSettings();
            if (settings.autoReplyEnabled) {
              const unclearReply =
                customer.language === 'he'
                  ? 'שלום! ההקלטה הקולית אינה ברורה. אנא הקלט שוב או כתוב את שאלתך ונשמח לענות מיד!'
                  : 'أهلاً بك! التسجيل الصوتي غير واضح تماماً، يرجى التفضل بإعادة التسجيل أو كتابة استفسارك وسأجيبك فوراً بكل سرور.';

              if (this.socket && this.state.status === 'connected') {
                try {
                  await this.socket.sendMessage(remoteJid, { text: unclearReply });
                } catch (sendErr) {
                  console.error('[WhatsApp Audio] Failed to send unclear audio reply:', sendErr);
                }
              }

              const aiUnclearMsg: ChatMessage = {
                id: `ai-${Date.now()}`,
                customerId: customer.id,
                sender: 'ai',
                text: unclearReply,
                timestamp: new Date().toISOString(),
                status: 'sent',
                aiProvider: 'gemini',
              };
              db.addMessage(customer.id, aiUnclearMsg);
              this.broadcast('chat_message', { customerId: customer.id, message: aiUnclearMsg });
            }
            continue;
          }

          // Check if auto-reply is enabled in persistent settings
          const settings = db.getSettings();
          const autoReplyEnabled = Boolean(settings.autoReplyEnabled);

          if (!autoReplyEnabled) {
            console.log(`[Auto-Reply] Auto-reply is OFF. Incoming message displayed in inbox, but no AI reply generated.`);
            // Record telemetry for visibility in diagnostic logs
            db.recordAiTelemetry({
              id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              customerId: customer.id,
              customerName: customer.name,
              incomingText: text,
              provider: settings.provider,
              modelUsed: settings.modelGemini || 'gemini-3.1-flash-lite',
              stageTiming: {
                receivedAt: incomingMsg.timestamp,
                contextPrepMs: 0,
                aiLatencyMs: 0,
                totalMs: 0,
                exceeded15s: false,
              },
              autoReplyWasEnabled: false,
              status: 'auto_reply_disabled',
            });
            continue;
          }

          // Prevent duplicate concurrent requests for the same customer
          if (this.conversationLocks.get(customer.id)) {
            console.log(`[Auto-Reply] Lock active for customer ${customer.id}, avoiding concurrent collision.`);
            continue;
          }

          this.conversationLocks.set(customer.id, true);
          const lockTimeout = setTimeout(() => this.conversationLocks.delete(customer.id), 25000);

          try {
            let aiResult: any;
            let providerUsed = settings.provider;
            let fallbackUsed = false;
            let fallbackReason: string | undefined;

            if (settings.provider === 'openai') {
              try {
                console.log(`[Auto-Reply] Dispatching message to OpenAI (${settings.modelOpenAI})...`);
                aiResult = await processCustomerMessageWithOpenAI({
                  customer,
                  incomingText: text,
                });
              } catch (openAiErr: any) {
                console.warn(`[Auto-Reply] OpenAI call failed: ${openAiErr.message}. Falling back instantly to Gemini.`);
                fallbackUsed = true;
                fallbackReason = openAiErr.message;
                db.addAuditLog(
                  'OPENAI_QUOTA_EXHAUSTED_FALLBACK_TO_GEMINI',
                  `فشل أو نفاد رصيد محرك OpenAI (${openAiErr.message}) - تم التحويل التلقائي لمحرك Gemini لضمان عدم تأخير الرد على العميل.`,
                  'system'
                );

                // Seamless fallback to Gemini
                aiResult = await processCustomerMessageWithGemini({
                  customer,
                  incomingText: text,
                });
                providerUsed = 'gemini';
              }
            } else {
              console.log(`[Auto-Reply] Dispatching message to Gemini (${settings.modelGemini || 'gemini-3.1-flash-lite'})...`);
              aiResult = await processCustomerMessageWithGemini({
                customer,
                incomingText: text,
              });
            }

            // Check if product images were requested
            const hasImages = Boolean(aiResult.imageActions && aiResult.imageActions.length > 0);
            const isImageOnly = isImageOnlyRequest(text);
            const shouldSendTextMessage =
              !hasImages ||
              (!isImageOnly && Boolean(aiResult.replyText && aiResult.replyText.trim().length > 0));

            const tWaStart = Date.now();
            let imagesSentCount = 0;

            // 1. Send real product images without any caption when requested
            if (hasImages) {
              console.log(
                `[WhatsApp Media] Dispatching original product images (${isImageOnly ? 'image only' : 'with details'}) for ${aiResult.imageActions.length} actions...`
              );
              for (const action of aiResult.imageActions) {
                for (let i = 0; i < action.imageUrls.length; i++) {
                  const imgUrl = action.imageUrls[i];
                  const resolved = resolveImageSource(imgUrl);
                  if (!resolved || !resolved.isValid) {
                    console.warn(`[WhatsApp Media] Skipping unresolvable or missing image source: ${imgUrl}`);
                    continue;
                  }

                  const mediaPayload =
                    resolved.type === 'local_file' && resolved.buffer
                      ? resolved.buffer
                      : { url: resolved.url || imgUrl };

                  let imgSent = false;
                  if (this.socket && this.state.status === 'connected') {
                    try {
                      // Original product image sent completely alone, no caption field
                      await this.socket.sendMessage(remoteJid, {
                        image: mediaPayload,
                      });
                      imgSent = true;
                      imagesSentCount++;
                      console.log(
                        `[WhatsApp Media] Original image message successfully sent for ${action.sku} to ${remoteJid}`
                      );
                    } catch (imgErr) {
                      console.error(`[WhatsApp Media] Failed to send image media via Baileys socket:`, imgErr);
                    }
                  }

                  // Record media message in database so it appears cleanly in CRM Inbox without any caption
                  const mediaMsg: ChatMessage = {
                    id: `ai-img-${Date.now()}-${i}`,
                    customerId: customer.id,
                    sender: 'ai',
                    text: '',
                    timestamp: new Date().toISOString(),
                    mediaUrl: imgUrl,
                    mediaType: 'image',
                    status: imgSent ? 'sent' : 'delivered',
                    aiProvider: providerUsed,
                    meta: {
                      modelUsed: aiResult.modelUsed,
                    },
                  };
                  db.addMessage(customer.id, mediaMsg);
                  this.broadcast('chat_message', { customerId: customer.id, message: mediaMsg });

                  // Stagger multiple image messages slightly to preserve order
                  if (i < action.imageUrls.length - 1) {
                    await new Promise((r) => setTimeout(r, 400));
                  }
                }

                db.addAuditLog(
                  'PRODUCT_IMAGE_SENT',
                  `تم إرسال صورة المنتج الأصلية للعميل ${customer.name}: ${action.productName} (${action.sku}) بدون أي كتابة تحتها`,
                  'system'
                );
              }
            }

            // 2. Send text message only when required (normal inquiries, or image with specific details)
            let waSentSuccessfully = false;
            if (shouldSendTextMessage) {
              if (this.socket && this.state.status === 'connected') {
                try {
                  await this.socket.sendMessage(remoteJid, { text: aiResult.replyText });
                  waSentSuccessfully = true;
                } catch (sendErr: any) {
                  console.error('[WhatsApp] Failed to send message via socket:', sendErr);
                }
              }

              const replyMsg: ChatMessage = {
                id: `ai-${Date.now()}`,
                customerId: customer.id,
                sender: 'ai',
                text: aiResult.replyText,
                timestamp: new Date().toISOString(),
                status: waSentSuccessfully ? 'sent' : 'delivered',
                aiProvider: providerUsed,
                meta: {
                  modelUsed: aiResult.modelUsed,
                  tokens: aiResult.tokensEstimate,
                  latencyMs: (aiResult.stageTiming?.totalMs || 0) + (Date.now() - tWaStart),
                  stageTiming: {
                    receivedAt: aiResult.stageTiming?.receivedAt || incomingMsg.timestamp,
                    contextPrepMs: aiResult.stageTiming?.contextPrepMs || 0,
                    aiLatencyMs: aiResult.stageTiming?.aiLatencyMs || 0,
                    whatsappSendMs: Date.now() - tWaStart,
                    totalMs: (aiResult.stageTiming?.totalMs || 0) + (Date.now() - tWaStart),
                    exceeded15s: (aiResult.stageTiming?.totalMs || 0) + (Date.now() - tWaStart) > 15000,
                  },
                  warningSlow: (aiResult.stageTiming?.totalMs || 0) + (Date.now() - tWaStart) > 15000,
                  fallbackUsed,
                  imageActions: aiResult.imageActions,
                },
              };

              db.addMessage(customer.id, replyMsg);
              this.broadcast('chat_message', { customerId: customer.id, message: replyMsg });
            }

            const whatsappSendMs = Date.now() - tWaStart;
            const totalMs = (aiResult.stageTiming?.totalMs || 0) + whatsappSendMs;
            const exceeded15s = totalMs > 15000;

            const stageTiming: ChatStageTiming = {
              receivedAt: aiResult.stageTiming?.receivedAt || incomingMsg.timestamp,
              contextPrepMs: aiResult.stageTiming?.contextPrepMs || 0,
              aiLatencyMs: aiResult.stageTiming?.aiLatencyMs || 0,
              whatsappSendMs,
              totalMs,
              exceeded15s,
            };

            // Record full telemetry log for monitoring
            db.recordAiTelemetry({
              id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              customerId: customer.id,
              customerName: customer.name,
              incomingText: text,
              provider: providerUsed,
              modelUsed: aiResult.modelUsed,
              stageTiming,
              autoReplyWasEnabled: true,
              status: exceeded15s ? 'warning_slow' : fallbackUsed ? 'fallback_gemini' : 'success',
              fallbackReason,
            });

            // Asynchronously apply customer memory updates in the background
            if (aiResult.memoryUpdates) {
              setTimeout(() => {
                db.updateCustomerMemory(customer.id, aiResult.memoryUpdates);
              }, 50);
            }
          } catch (replyErr: any) {
            console.error('[Auto-Reply] Failed to generate or send AI reply:', replyErr);
            db.addAuditLog('AI_REPLY_FAILED', `فشل توليد رد ${settings.provider}: ${replyErr.message}`, 'system');
            db.recordAiTelemetry({
              id: `tel-${Date.now()}`,
              timestamp: new Date().toISOString(),
              customerId: customer.id,
              customerName: customer.name,
              incomingText: text,
              provider: settings.provider,
              modelUsed: settings.modelGemini,
              stageTiming: {
                receivedAt: incomingMsg.timestamp,
                contextPrepMs: 0,
                aiLatencyMs: 0,
                totalMs: 0,
                exceeded15s: false,
              },
              autoReplyWasEnabled: true,
              status: 'error',
              error: replyErr.message,
            });
          } finally {
            clearTimeout(lockTimeout);
            this.conversationLocks.delete(customer.id);
          }
        }
      });
    } catch (err: any) {
      console.error('Fatal Baileys socket error:', err);
      this.state.status = 'error';
      this.state.errorMessage = err.message || 'حدث خطأ أثناء تشغيل عميل WhatsApp Baileys';
      this.broadcast('whatsapp_status', this.state);
    }
  }

  public async disconnect(): Promise<void> {
    this.isExplicitLogout = true;
    clearTimeout(this.reconnectTimeout);
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (_) {}
      try {
        this.socket.end();
      } catch (_) {}
      this.socket = null;
    }
    this.clearAuthStorage();
    this.state = {
      status: 'disconnected',
      qrCodeDataUrl: null,
      phoneNumber: null,
      pushName: null,
      platform: 'WhatsApp Business Web Multi-Device (Baileys)',
      lastConnectedAt: null,
      errorMessage: null,
      isLiveBaileys: true,
      reconnectAttempts: 0,
    };
    this.broadcast('whatsapp_status', this.state);
    db.addAuditLog('WHATSAPP_DISCONNECTED', 'تم قطع اتصال واتساب ومسح بيانات الجلسة الحالية', 'admin');
  }

  public async sendMessage(remoteJid: string, text: string): Promise<boolean> {
    if (!this.socket || this.state.status !== 'connected') {
      return false;
    }
    try {
      const fullJid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
      await this.socket.sendMessage(fullJid, { text });
      return true;
    } catch (e) {
      console.error('Failed to send WhatsApp manual message:', e);
      return false;
    }
  }

  public async sendImageMessage(
    remoteJid: string,
    imageSource: Buffer | { url: string },
    caption?: string
  ): Promise<boolean> {
    if (!this.socket || this.state.status !== 'connected') {
      return false;
    }
    try {
      const fullJid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
      const messageContent: any = { image: imageSource };
      if (caption && typeof caption === 'string' && caption.trim().length > 0) {
        messageContent.caption = caption.trim();
      }
      await this.socket.sendMessage(fullJid, messageContent);
      return true;
    } catch (e) {
      console.error('Failed to send WhatsApp image message:', e);
      return false;
    }
  }

  public async sendProductPhotos(
    remoteJid: string,
    images: string[],
    caption?: string
  ): Promise<{ sentCount: number; errors: string[] }> {
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i];
      const resolved = resolveImageSource(imgUrl);
      if (!resolved || !resolved.isValid) {
        errors.push(`الصورة غير صالحة أو غير متوفرة: ${imgUrl}`);
        continue;
      }

      const imgCaption =
        caption && typeof caption === 'string' && caption.trim().length > 0 ? caption.trim() : undefined;
      const mediaPayload =
        resolved.type === 'local_file' && resolved.buffer
          ? resolved.buffer
          : { url: resolved.url || imgUrl };

      const sent = await this.sendImageMessage(remoteJid, mediaPayload, imgCaption);
      if (sent) {
        sentCount++;
        if (i < images.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      } else {
        errors.push(`فشل إرسال صورة عبر مقبس واتساب: ${imgUrl}`);
      }
    }

    return { sentCount, errors };
  }

  private clearAuthStorage(): void {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(AUTH_DIR, file));
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Error clearing Baileys auth storage:', e);
    }
  }
}

export const whatsappManager = new WhatsAppManager();
