export type AiProvider = 'gemini' | 'openai';

export type SalesTone = 'consultative' | 'direct' | 'friendly' | 'premium';

export interface WhatsAppSessionState {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'reconnecting' | 'error';
  qrCodeDataUrl: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  platform: string;
  lastConnectedAt: string | null;
  errorMessage: string | null;
  isLiveBaileys: boolean;
  reconnectAttempts: number;
}

export interface CustomerMemory {
  interests: string[];
  objections: string[];
  budget: string | null;
  preferredLanguage: 'ar' | 'he' | 'en';
  notes: string;
  keyFacts: string[];
  adReferral?: {
    headline?: string;
    body?: string;
    sourceUrl?: string;
    campaign?: string;
  };
}

export interface Customer {
  id: string;
  phoneNumber: string;
  name: string;
  tags: string[];
  notes: string;
  stage: 'lead' | 'contacted' | 'negotiation' | 'converted' | 'lost';
  language: 'ar' | 'he' | 'en';
  unreadCount: number;
  lastMessageAt: string;
  totalSpent: number;
  ordersCount: number;
  memory: CustomerMemory;
  avatarUrl?: string;
}

export interface ChatStageTiming {
  receivedAt: string;
  contextPrepMs: number;
  aiLatencyMs: number;
  whatsappSendMs?: number;
  totalMs: number;
  exceeded15s: boolean;
}

export interface AiTelemetryLog {
  id: string;
  timestamp: string;
  customerId: string;
  customerName?: string;
  incomingText: string;
  provider: AiProvider;
  modelUsed: string;
  stageTiming: ChatStageTiming;
  autoReplyWasEnabled: boolean;
  status: 'success' | 'warning_slow' | 'error' | 'fallback_gemini' | 'auto_reply_disabled';
  error?: string;
  fallbackReason?: string;
}

export type ProductImageCategory =
  | 'main' // صورة المنتج الرئيسية
  | 'games' // صور الألعاب
  | 'controllers' // صور أيدي التحكم
  | 'accessories' // صور الملحقات
  | 'specs' // صور المواصفات
  | 'extra'; // صور إضافية

export interface CategorizedProductImage {
  id: string;
  url: string;
  title: string;
  category: ProductImageCategory;
  order: number;
}

export interface AudioTranscriptionResult {
  text: string;
  language: 'ar' | 'he' | 'en';
  isClear: boolean;
  confidence?: number;
  rawTranscription?: string;
  error?: string;
}

export interface ProductImageAction {
  productId: string;
  sku: string;
  productName: string;
  imageUrls: string[];
  caption: string;
  category?: ProductImageCategory | 'all';
  images?: CategorizedProductImage[];
}

export interface ChatMessage {
  id: string;
  customerId: string;
  sender: 'customer' | 'ai' | 'agent';
  text: string;
  timestamp: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'document' | 'video';
  mediaCaption?: string;
  status?: 'sent' | 'delivered' | 'read' | 'pending';
  aiProvider?: AiProvider;
  meta?: {
    modelUsed?: string;
    tokens?: number;
    latencyMs?: number;
    stageTiming?: ChatStageTiming;
    adReferralDetected?: boolean;
    hasImageAttachment?: boolean;
    isAudioTranscription?: boolean;
    transcriptionText?: string;
    warningSlow?: boolean;
    fallbackUsed?: boolean;
    imageActions?: ProductImageAction[];
  };
}

export interface Product {
  id: string;
  name: string;
  arabicName: string;
  hebrewName: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sku: string;
  stock: number;
  category: string;
  features: string[];
  imageUrl: string;
  images?: string[];
  categorizedImages?: CategorizedProductImage[];
  inStock: boolean;
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: string;
  city?: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

export interface PlaybookRule {
  id: string;
  title: string;
  triggerType: 'greeting' | 'pricing' | 'objection' | 'out_of_stock' | 'ad_referral' | 'closing' | 'custom';
  keywords: string[];
  salesObjective: string;
  guidelines: string;
  discountAllowed: boolean;
  maxDiscountPercentage: number;
  enabled: boolean;
}

export interface AiInstructions {
  // 1. Bot persona & conversation style
  persona: string;
  // 2. Arabic & Hebrew language rules
  languageRules: string;
  // 3. Sales & customer persuasion instructions
  salesAndPersuasion: string;
  // 4. Pricing & discount rules
  pricingAndDiscounts: string;
  // 5. Shipping & delivery instructions
  shippingAndDelivery: string;
  // 6. Order reception & data collection instructions
  orderCapture: string;
  // 7. Handling objections
  handlingObjections: string;
  // 8. Prohibited rules and mandatory guardrails
  prohibitedAndGuardrails: string;
  // Free-form additional custom instructions
  customSystemPrompt?: string;
  // Metadata
  updatedAt: string;
  updatedBy: string;
}

export interface InstructionVersion {
  id: string;
  versionNumber: number;
  timestamp: string;
  savedBy: string;
  note: string;
  instructions: AiInstructions;
}

export interface AiSettings {
  provider: AiProvider;
  autoReplyEnabled: boolean;
  modelGemini: string;
  modelOpenAI: string;
  salesTone: SalesTone;
  responseLength: 'concise' | 'detailed';
  languages: string[];
  systemPrompt: string;
  // Deep AI Sales Instructions
  personaPrompt: string;
  toneAndStylePrompt: string;
  salesAndPersuasionRules: string;
  productSpecificInstructions: string;
  prohibitedResponsesPrompt: string;
  instructions?: AiInstructions;
  temperature: number;
  maxTokens: number;
  openaiReasoningEffort?: 'low' | 'medium' | 'high';
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
}

export interface FollowUpTask {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  dueAt: string;
  reason: string;
  status: 'pending' | 'completed' | 'cancelled';
  suggestedAction: string;
  aiGeneratedMessage?: string;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'supervisor' | 'agent';
}
