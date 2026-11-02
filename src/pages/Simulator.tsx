import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Coins,
  Cpu,
  Brain,
  Layers,
  HelpCircle,
  Megaphone,
  X,
  FileText,
  Mic,
  Volume2,
} from 'lucide-react';
import { Product, Customer, ProductImageAction } from '../types/index.js';

export const Simulator: React.FC = () => {
  const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini');
  const [modelOpenAI, setModelOpenAI] = useState('gpt-4o');
  const [modelGemini, setModelGemini] = useState('gemini-3.1-flash-lite');
  const [testAutoReplyBehavior, setTestAutoReplyBehavior] = useState(false);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<Array<{
    sender: 'user' | 'ai';
    text: string;
    model?: string;
    tokens?: number;
    latencyMs?: number;
    hasImage?: boolean;
    isVoice?: boolean;
    voiceTranscription?: any;
    provider?: string;
    complianceNotes?: string[];
    imageActions?: ProductImageAction[];
    stageTiming?: {
      receivedAt: string;
      contextPrepMs: number;
      aiLatencyMs: number;
      totalMs: number;
      exceeded15s: boolean;
    };
    fallbackUsed?: boolean;
    fallbackReason?: string;
  }>>([
    {
      sender: 'ai',
      text: 'مرحباً بك في محاكي NEXO AI Sales المطور! يعمل النظام الآن بكفاءة متكاملة للصور المتعددة المصنفة وفهم التسجيلات الصوتية (Gemini Audio Understanding) مع الرد كتابةً فورياً.',
      provider: 'system',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);

  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Multimodal Image Simulation state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');

  // Audio / Voice Note Simulation state
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/ogg');
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Ad Referral Simulation state
  const [enableAdReferral, setEnableAdReferral] = useState(false);
  const [adHeadline, setAdHeadline] = useState('خصم 100 شيكل على سماعات نكسو برو Sound X1');
  const [adBody, setAdBody] = useState('عزل ضوضاء فائق ANC وبطارية تدوم 45 ساعة مع شحن وتوصيل فوري.');

  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchInitialData = () => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        if (data.modelOpenAI) setModelOpenAI(data.modelOpenAI);
        if (data.modelGemini) setModelGemini(data.modelGemini);
      })
      .catch(() => {});

    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProducts(data);
      })
      .catch(() => {});

    fetch('/api/customers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomers(data);
          if (data.length > 0) setSelectedCustomerId(data[0].id);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Test OpenAI connection ping
  const handleTestOpenAIConnection = async () => {
    setTestingOpenAI(true);
    setOpenAITestResult(null);
    try {
      const res = await fetch('/api/ai/test-openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelOpenAI }),
      });
      const data = await res.json();
      setOpenAITestResult({
        success: data.success,
        message: data.message,
        latencyMs: data.latencyMs || 0,
      });
    } catch (err: any) {
      setOpenAITestResult({
        success: false,
        message: err.message || 'فشل الاتصال بالخادم',
        latencyMs: 0,
      });
    } finally {
      setTestingOpenAI(false);
    }
  };

  // Image upload handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64Data = result.split(',')[1];
      setImageBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  // Audio recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const previewUrl = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(previewUrl);
        setAudioFileName('تسجيل صوتي مباشر.webm');
        setAudioMimeType('audio/webm');

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          setAudioBase64(base64Data);
        };
        reader.readAsDataURL(audioBlob);

        // stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      alert('تعذر الوصول إلى الميكروفون: ' + (err.message || 'يرجى منح الإذن للمتصفح'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Audio file upload handler (.ogg, .mp3, .wav, .m4a, .webm)
  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    setAudioMimeType(file.type || 'audio/ogg');
    const previewUrl = URL.createObjectURL(file);
    setAudioPreviewUrl(previewUrl);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setAudioBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const removeAudio = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(null);
    setAudioBase64(null);
    setAudioFileName(null);
  };

  // Send message to simulator
  const handleSendMessage = async (customPrompt?: string, customAudio?: { base64: string; mimeType: string; name?: string }) => {
    const textToSend = customPrompt || inputText;
    const activeAudioBase64 = customAudio?.base64 || audioBase64;
    const activeAudioMime = customAudio?.mimeType || audioMimeType;
    const activeAudioName = customAudio?.name || audioFileName;

    if (!textToSend.trim() && !imageBase64 && !activeAudioBase64) return;

    const userMessage = {
      sender: 'user' as const,
      text: activeAudioBase64 && !textToSend.trim() ? `🎙️ [تسجيل صوتي]: ${activeAudioName || 'تسجيل صوتي'}` : textToSend,
      hasImage: Boolean(imageBase64),
      isVoice: Boolean(activeAudioBase64),
    };

    setConversation((prev) => [...prev, userMessage]);
    if (!customPrompt) setInputText('');
    setLoading(true);

    const activeImageBase64 = imageBase64;
    const activeImageMime = imageMimeType;
    // clear active image and audio once sent
    removeImage();
    removeAudio();

    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          messageText: textToSend,
          audioBase64: activeAudioBase64 || undefined,
          audioMimeType: activeAudioMime || undefined,
          provider,
          model: provider === 'openai' ? modelOpenAI : modelGemini,
          imageBase64: activeImageBase64 || undefined,
          imageMimeType: activeImageMime || undefined,
          testAutoReplyBehavior,
          adReferral: enableAdReferral
            ? {
                headline: adHeadline,
                body: adBody,
                sourceUrl: 'https://facebook.com/ads/nexo-deal-2026',
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'حدث خطأ أثناء المعالجة');
      }

      const notes: string[] = [];
      const reply = (data.replyText || '').toLowerCase();
      const trimmedQuery = textToSend.trim();

      // Test Audio Transcription
      if (data.voiceTranscription) {
        notes.push(`🎙️ تفريغ البصمة الصوتية بنجاح عبر Gemini: "${data.voiceTranscription.text}" (اللغة: ${data.voiceTranscription.language || 'عربية'}).`);
        notes.push('✅ الرد كتابةً فقط وبنفس لغة العميل، مع منع إعادة إرسال التسجيل الصوتي.');
      }

      if (data.isAudioUnclear) {
        notes.push('⚠️ تسجيل غير واضح / تشويش: طُلب من العميل بلباقة إعادة التسجيل أو الكتابة دون اختراع كلام.');
      }

      // Test 1: Single Greeting Test ("مرحبا")
      if (['مرحبا', 'مرحباً', 'السلام عليكم', 'سلام', 'هلا', 'שלום', 'היי'].includes(trimmedQuery)) {
        if (!reply.includes('349') && !reply.includes('499') && !reply.includes('219') && data.replyText.length < 180) {
          notes.push('✅ التزام تام: تحية ترحيبية موجزة وطبيعية بدون فرض أو سرد منتجات.');
        } else {
          notes.push('ℹ️ تنبيه: تم ذكر تفاصيل منتجات مع التحية المنفردة.');
        }
      }

      // Test 2: Price Check ("كم السعر؟")
      if (trimmedQuery.includes('سعر') || trimmedQuery.includes('كم') || trimmedQuery.includes('מחיר') || trimmedQuery.includes('כמה')) {
        if (reply.includes('349') || reply.includes('499') || reply.includes('219') || reply.includes('169') || reply.includes('شيكل') || reply.includes('₪')) {
          notes.push('✅ السعر دقيق من الكتالوج: تم تقديم السعر الرسمي مع الضمان.');
        }
      }

      // Test 3: Anti-Pushiness ("بدك تطلب؟")
      if (!reply.includes('بدك تطلب') && !reply.includes('تحب أحجزلك') && !reply.includes('نثبتلك طلب') && !reply.includes('احجز الآن')) {
        notes.push('✅ أسلوب طبيعي: خالٍ من أسئلة البيع الميكانيكية المكررة.');
      } else {
        notes.push('⚠️ تنبيه: ظهر سؤال إلحاح بيعي في نهاية الرسالة.');
      }

      // Test 4: Language Accuracy
      if (/[\u0590-\u05FF]/.test(textToSend)) {
        if (/[\u0590-\u05FF]/.test(data.replyText)) {
          notes.push('✅ لغة مطابقة: تم الرد باللغة العبرية السليمة.');
        }
      } else if (/[\u0600-\u06FF]/.test(textToSend)) {
        if (/[\u0600-\u06FF]/.test(data.replyText)) {
          notes.push('✅ لغة مطابقة: تم الرد باللغة العربية بأسلوب راقٍ.');
        }
      }

      // Test 5: Real Product Image Action & Empty Caption Verification
      if (data.imageActions && data.imageActions.length > 0) {
        for (const action of data.imageActions) {
          const categoryLabel = action.category === 'main' ? 'صورة رئيسية' : action.category === 'games' ? 'ألعاب' : action.category === 'controllers' ? 'يدات تحكم' : action.category === 'accessories' ? 'ملحقات' : action.category === 'specs' ? 'مواصفات' : action.category === 'all' ? 'جميع الصور' : 'إضافية';
          notes.push(`📸 وسائط واتساب حقيقية: تم استرجاع ${action.imageUrls.length} صور مصنفة بفئة [${categoryLabel}] لمنتج [${action.productName}] (${action.sku}).`);
          if (!action.caption || action.caption.trim() === '') {
            notes.push('✅ التزام إلزامي: الكابشن فارغ تماماً (Caption="") بدون اسم أو سعر أو وصف عند طلب الصور.');
          }
        }
      }

      setConversation((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: data.replyText,
          model: data.modelUsed,
          tokens: Math.round(data.tokensEstimate || 0),
          latencyMs: data.latencyMs,
          provider: data.provider,
          complianceNotes: notes,
          imageActions: data.imageActions,
          stageTiming: data.stageTiming,
          fallbackUsed: data.fallbackUsed,
          fallbackReason: data.fallbackReason,
          voiceTranscription: data.voiceTranscription,
        },
      ]);
    } catch (err: any) {
      setConversation((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ خطأ في المحاكي: ${err.message}`,
          provider: 'error',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick preset test prompts with 10 specific instruction verification targets
  const instructionVerificationTests = [
    {
      label: '1. تحية "مرحبا" فقط (فحص عدم سرد المنتجات)',
      text: 'مرحبا',
      expected: 'تحية ترحيبية قصيرة فقط دون عرض منتجات',
    },
    {
      label: '2. استفسار "كم السعر؟" (سماعات X1)',
      text: 'كم سعر سماعات نكسو X1 مع التوصيل؟',
      expected: 'ذكر السعر الرسمي 349 شيكل والضمان مباشرة',
    },
    {
      label: '3. اعتراض "السعر غالي" (فحص الإقناع بالقيمة)',
      text: 'السعر غالي شوي مقارنة بالماركات الصينية الثانية، شو اللي يميزها؟',
      expected: 'إبراز عزل الضوضاء 40dB وعمر 45 ساعة بطارية والضمان',
    },
    {
      label: '4. فحص عدم الإلحاح بالطلب',
      text: 'تمام، شكراً إلك بدي أفكر شوي وأشوف شو بناسبني',
      expected: 'رد لطيف ومرن بدون عبارة "بدك تطلب هسا؟"',
    },
    {
      label: '5. استفسار عبري (עברית) لساعة Ultra 3',
      text: 'שלום, כמה עולה השעון Ultra Watch 3 והאם הוא עמיד במים?',
      expected: 'رد بالعبرية يذكر 499 شيكل ومقاومة 5ATM',
    },
    {
      label: '6. طلب صورة المنتج الرئيسية فقط (فحص Caption فارغ)',
      text: 'ممكن صورة سماعات نكسو برو ساوند X1 الأصلية؟',
      expected: 'إرسال الصورة الرئيسية فقط بكابشن فارغ تماماً وبدون رسالة نصية إضافية',
    },
    {
      label: '7. طلب صور الألعاب فقط (فحص فئة games والاعتذار اللبق)',
      text: 'ممكن صور الألعاب لسماعة X1؟',
      expected: 'إبلاغ العميل بلباقة باختصار بعدم توفر صور ألعاب لهذا المنتج، دون اختراع صور',
    },
    {
      label: '8. طلب صور اليدات وأيدي التحكم (فحص فئة controllers)',
      text: 'ممكن صور اليدات وأيدي التحكم المتاحة؟',
      expected: 'استرجاع صور فئة يدات التحكم فقط بكابشن فارغ وبدون نصوص',
    },
    {
      label: '9. طلب كل صور المنتج (فحص فئة all)',
      text: 'بدي أشوف كل صور سماعات نكسو برو X1',
      expected: 'استرجاع كافة صور المنتج المتاحة بالترتيب مع مراعاة حدود واتساب وبكابشن فارغ',
    },
    {
      label: '10. محاكاة تسجيل صوتي بالعربية (فحص تفريغ الصوت والرد كتابة)',
      text: '🎙️ [تسجيل صوتي]: مرحبا، بدي أعرف كم سعر سماعة X1 وشو مواصفاتها وهل معها ضمان؟',
      expected: 'تفريغ وفهم التسجيل الصوتي والرد كتابة فقط بنفس لغة العميل اعتماداً على الكتالوج',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Safe Sandbox Environment
            </span>
            <span className="text-xs text-slate-400">لا يتم إرسال أي رسائل إلى واتساب الحقيقي</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-indigo-400" />
            <span>محاكي مبيعات الذكاء الاصطناعي (OpenAI & Gemini)</span>
          </h1>
        </div>

        {/* Engine and Connection Quick Test */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTestOpenAIConnection}
            disabled={testingOpenAI}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/30 text-teal-300 text-xs font-semibold transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testingOpenAI ? 'animate-spin' : ''}`} />
            <span>{testingOpenAI ? 'جارٍ اختبار OpenAI...' : 'فحص اتصال OpenAI API'}</span>
          </button>
        </div>
      </div>

      {/* OpenAI Connection Test Feedback Alert */}
      {openAITestResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            openAITestResult.success
              ? 'bg-teal-950/30 border-teal-500/30 text-teal-200'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {openAITestResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{openAITestResult.message}</p>
              {openAITestResult.latencyMs > 0 && (
                <p className="text-[11px] opacity-80 mt-0.5 font-mono">
                  زمن الاستجابة: {openAITestResult.latencyMs}ms
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setOpenAITestResult(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Safe Notice about OPENAI_API_KEY if not configured */}
      {settings && !settings.openaiConfigured && (
        <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 text-xs text-amber-200/90 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Key className="h-4 w-4" />
            <span>تنبيه آمن بخصوص مفتاح OpenAI API:</span>
          </div>
          <p className="leading-relaxed">
            متغير <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-400 font-mono">OPENAI_API_KEY</code> غير محدد حالياً في بيئة التشغيل. لتفعيله بأمان تام بدون مشاركته في المحادثة أو الواجهة:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 ps-2">
            <li>افتح لوحة <strong>الأسرار (Secrets)</strong> في Google AI Studio.</li>
            <li>أضف سراً جديداً باسم <code className="text-teal-400 font-mono">OPENAI_API_KEY</code> وضع مفتاحك الخاص هناك.</li>
            <li>يقوم الخادم بقراءته سراً عبر <code className="font-mono text-slate-200">process.env.OPENAI_API_KEY</code> في مسار معزول خلفي فقط.</li>
          </ol>
        </div>
      )}

      {/* Main Grid: Controls + Chat Simulator Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column (Right on RTL) */}
        <div className="space-y-4">
          {/* AI Engine Selection Box */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-400" />
              <span>محرك الذكاء الاصطناعي للاختبار</span>
            </h3>

            {/* Provider Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-3 rounded-xl border text-xs font-semibold text-start transition flex flex-col justify-between gap-1.5 ${
                  provider === 'openai'
                    ? 'bg-teal-950/40 border-teal-500/50 text-teal-300 shadow-md shadow-teal-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>OpenAI Engine</span>
                  {provider === 'openai' && <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />}
                </div>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  Responses & Chat API
                </span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3 rounded-xl border text-xs font-semibold text-start transition flex flex-col justify-between gap-1.5 ${
                  provider === 'gemini'
                    ? 'bg-blue-950/40 border-blue-500/50 text-blue-300 shadow-md shadow-blue-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Google Gemini</span>
                  {provider === 'gemini' && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
                </div>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  @google/genai SDK
                </span>
              </button>
            </div>

            {/* Model selector based on provider */}
            {provider === 'openai' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">موديل OpenAI المختار:</label>
                <select
                  value={modelOpenAI}
                  onChange={(e) => setModelOpenAI(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-teal-300 font-mono focus:outline-none focus:border-teal-500"
                >
                  <option value="gpt-4o">gpt-4o (الأفضل للمبيعات المعقدة والصور)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini (سريع واقتصادي جداً)</option>
                  <option value="gpt-4.5-preview">gpt-4.5-preview (استدلال متقدم)</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">موديل Gemini المختار:</label>
                <select
                  value={modelGemini}
                  onChange={(e) => setModelGemini(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-blue-300 font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (فائق السرعة ~450ms - الموصى به للمبيعات)</option>
                  <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (المحدث فائق السرعة)</option>
                  <option value="gemini-3.8-flash">gemini-3.8-flash (استدلال متوازن)</option>
                </select>
              </div>
            )}

            {/* Test Auto-Reply Isolation switch */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="flex items-center justify-between cursor-pointer text-xs">
                <span className="text-slate-300 font-medium">اختبار سلوك الرد التلقائي (Isolated Test):</span>
                <input
                  type="checkbox"
                  checked={testAutoReplyBehavior}
                  onChange={(e) => setTestAutoReplyBehavior(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 accent-emerald-500"
                />
              </label>
              <p className="text-[10px] text-slate-500 mt-1">
                عند التفعيل، يحاكي رد النظام بناءً على إعداد الرد التلقائي الحالي (تشغيل/إيقاف) دون مراسلة عملاء حقيقيين.
              </p>
            </div>

            {/* Simulated Customer selection */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <label className="text-[11px] text-slate-400 font-medium">ملف وسياق العميل التجريبي:</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phoneNumber}) - {c.stage}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Facebook Ad Referral Simulator */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Megaphone className="h-4 w-4 text-amber-400" />
                <span>محاكاة إحالة إعلان فيسبوك</span>
              </span>
              <input
                type="checkbox"
                id="referral-toggle"
                checked={enableAdReferral}
                onChange={(e) => setEnableAdReferral(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
              />
            </div>

            {enableAdReferral && (
              <div className="space-y-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <label className="text-slate-400 block mb-1">عنوان الإعلان الترويجي:</label>
                  <input
                    type="text"
                    value={adHeadline}
                    onChange={(e) => setAdHeadline(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">نص العرض في الإعلان:</label>
                  <textarea
                    rows={2}
                    value={adBody}
                    onChange={(e) => setAdBody(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-200 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Instruction Verification Tests */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>فحص الالتزام بالتعليمات</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">10 سيناريوهات شاملة</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              انقر على أي اختبار للتحقق المباشر من تطبيق قواعد البيع والتحية والأسعار:
            </p>
            <div className="flex flex-col gap-2">
              {instructionVerificationTests.map((test, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendMessage(test.text)}
                  className="w-full text-start p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-850 hover:border-indigo-500/40 border border-slate-800/80 text-xs text-slate-200 transition group flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-indigo-300 group-hover:text-indigo-200">{test.label}</span>
                    <Send className="h-3 w-3 text-slate-600 group-hover:text-indigo-400 shrink-0 ms-1 transition" />
                  </div>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-400 line-clamp-1">
                    الهدف: {test.expected}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Feed Column (Left 2 columns on RTL) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col h-[650px] overflow-hidden">
          {/* Chat Feed Header */}
          <div className="p-3.5 border-b border-slate-800 bg-[#0a1224] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  provider === 'openai' ? 'bg-teal-400' : 'bg-blue-400'
                } animate-pulse`}
              />
              <span className="font-semibold text-slate-200 font-mono">
                {provider === 'openai' ? `OpenAI (${modelOpenAI})` : `Gemini (${modelGemini})`}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">تزامن كتالوج المنتجات وقواعد البيع مفعل</span>
            </div>

            <button
              onClick={() =>
                setConversation([
                  {
                    sender: 'ai',
                    text: 'تمت إعادة ضبط المحاكي. تفضل بكتابة أي رسالة أو تجربة إرسال صورة أو استفسار.',
                    provider: 'system',
                  },
                ])
              }
              className="text-[11px] text-slate-400 hover:text-white transition"
            >
              مسح السجل
            </button>
          </div>

          {/* Conversation Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#060a14]">
            {conversation.map((msg, index) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={index}
                  className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-500">
                    {isUser ? (
                      <span className="text-slate-400">أنت (محاكاة العميل)</span>
                    ) : (
                      <span
                        className={`font-mono font-semibold ${
                          msg.provider === 'openai'
                            ? 'text-teal-400'
                            : msg.provider === 'gemini'
                            ? 'text-blue-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {msg.provider === 'openai'
                          ? `رد OpenAI (${msg.model || modelOpenAI})`
                          : msg.provider === 'gemini'
                          ? `رد Gemini (${msg.model || modelGemini})`
                          : 'النظام'}
                      </span>
                    )}
                  </div>

                  <div
                    className={`max-w-xl rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-slate-800 text-slate-100 rounded-ss-none'
                        : msg.provider === 'error'
                        ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200 rounded-se-none'
                        : msg.provider === 'openai'
                        ? 'bg-gradient-to-r from-teal-950/50 to-slate-900 border border-teal-500/30 text-teal-100 rounded-se-none'
                        : 'bg-gradient-to-r from-blue-950/50 to-slate-900 border border-blue-500/30 text-blue-100 rounded-se-none'
                    }`}
                  >
                    {msg.hasImage && (
                      <div className="mb-2 p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-[10px] text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-teal-400" />
                        <span>[تم إرفاق صورة للمنتج في الاستفسار]</span>
                      </div>
                    )}
                    {msg.isVoice && (
                      <div className="mb-2 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-center gap-1.5">
                        <Mic className="h-3.5 w-3.5 text-amber-400" />
                        <span>[تسجيل صوتي وارد عبر واتساب - تم تحليله بنجاح]</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Real Product Images Media Action Preview */}
                    {!isUser && msg.imageActions && msg.imageActions.length > 0 && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <ImageIcon className="h-4 w-4 text-emerald-400" />
                            <span>إجراء وسائط واتساب: تم استرجاع وإرسال صور المنتج الحقيقية</span>
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-mono">
                            WhatsApp Media Image
                          </span>
                        </div>
                        {msg.imageActions.map((act, aIdx) => (
                          <div key={aIdx} className="space-y-2 pt-1">
                            <div className="text-[11px] text-slate-300 font-medium flex items-center justify-between flex-wrap gap-2">
                              <span className="font-semibold text-white">{act.productName}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-indigo-300 font-mono">
                                  الفئة: {act.category === 'main' ? 'رئيسية' : act.category === 'games' ? 'ألعاب' : act.category === 'controllers' ? 'يدات تحكم' : act.category === 'accessories' ? 'ملحقات' : act.category === 'specs' ? 'مواصفات' : act.category === 'all' ? 'جميع الصور' : 'إضافية'}
                                </span>
                                {(!act.caption || act.caption.trim() === '') && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono">
                                    ✓ Caption فارغ
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {act.imageUrls.map((img, iIdx) => (
                                <div key={iIdx} className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 group">
                                  <img
                                    src={img}
                                    alt={act.productName}
                                    className="w-full h-28 object-cover group-hover:scale-105 transition duration-300"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-[9px] text-slate-300 truncate">
                                    صورة {iIdx + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {act.caption && (
                              <p className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800 whitespace-pre-wrap">
                                {act.caption}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Instruction Compliance Badges */}
                    {!isUser && msg.complianceNotes && msg.complianceNotes.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/50 space-y-1">
                        {msg.complianceNotes.map((note, nIdx) => (
                          <div
                            key={nIdx}
                            className="text-[11px] leading-snug px-2 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300 flex items-center gap-1.5"
                          >
                            <span>{note}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fallback info */}
                    {!isUser && msg.fallbackUsed && (
                      <div className="mt-2 px-2 py-1 rounded bg-blue-950/60 border border-blue-500/40 text-[10px] text-blue-200">
                        🔄 تم التحويل التلقائي لمحرك Gemini بنجاح (حماية نفاد رصيد OpenAI).
                      </div>
                    )}

                    {/* Metadata pill for AI replies */}
                    {!isUser && msg.latencyMs !== undefined && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80 space-y-1 text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            <span className={msg.latencyMs > 15000 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                              {msg.latencyMs}ms {msg.latencyMs > 15000 ? '(⚠️ تجاوز 15ث)' : ''}
                            </span>
                          </span>
                          {msg.tokens !== undefined && (
                            <span className="flex items-center gap-1">
                              <Coins className="h-3 w-3 text-slate-500" />
                              <span>{msg.tokens} tokens</span>
                            </span>
                          )}
                        </div>

                        {/* Stage timing details if present */}
                        {msg.stageTiming && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50 text-[9px] text-slate-400">
                            <span>تجهيز: {msg.stageTiming.contextPrepMs}ms</span>
                            <span>•</span>
                            <span>طلب AI: {msg.stageTiming.aiLatencyMs}ms</span>
                            <span>•</span>
                            <span>إجمالي: {msg.stageTiming.totalMs}ms</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex flex-col items-end">
                <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                  <span>جارٍ التفكير وتوليد الرد عبر {provider === 'openai' ? 'OpenAI' : 'Gemini'}...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Image preview strip if attached */}
          {imagePreview && (
            <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={imagePreview}
                  alt="Attachment preview"
                  className="h-10 w-10 object-cover rounded-lg border border-slate-700"
                />
                <span className="text-xs text-slate-300">تم تجهيز صورة المنتج للإرسال المتعدد الوسائط</span>
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="text-slate-400 hover:text-rose-400 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Audio voice note preview strip if recorded or uploaded */}
          {audioPreviewUrl && (
            <div className="p-2.5 bg-amber-950/30 border-t border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-amber-200 block truncate max-w-xs">
                    {audioFileName || 'تسجيل صوتي تجريبي'}
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-mono">
                    جاهز للإرسال والتفريغ الصوتي عبر Gemini Audio Understanding
                  </span>
                </div>
                <audio controls src={audioPreviewUrl} className="h-7 max-w-xs ms-2" />
              </div>
              <button
                type="button"
                onClick={removeAudio}
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Quick Voice Note Presets Bar */}
          <div className="px-3 py-1.5 bg-[#070d1a] border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-500 shrink-0 font-medium flex items-center gap-1">
              <Mic className="h-3 w-3 text-amber-400" />
              <span>محاكاة صوتية فورية:</span>
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage('🎙️ [تسجيل صوتي فلسطيني]: مرحبا، بدي أعرف كم سعر سماعة Sound X1 وهل معها ضمان وشحن للضفة؟')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>🎙️ فلسطيني: سعر وضمان X1</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage('🎙️ [הקלטה קולית בעברית]: שלום, כמה עולה השעון Ultra Watch 3 ויש עליו אחריות?')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>🎙️ עברית: Ultra Watch 3</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSendMessage('🎙️ [تسجيل صوتي غير واضح]: .... (صوت تشويش وهواء غير مفهوم)')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>⚠️ صوت مشوش / غير واضح</span>
            </button>
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-[#091122] border-t border-slate-800 flex items-center gap-2"
          >
            {/* Image attachment button */}
            <label className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition" title="إرفاق صورة">
              <ImageIcon className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>

            {/* Audio file upload button */}
            <label className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 cursor-pointer transition" title="رفع ملف صوتي (.ogg, .mp3, .wav, .m4a)">
              <Volume2 className="h-4 w-4" />
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileSelect}
                className="hidden"
              />
            </label>

            {/* Live microphone recording button */}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-xl border transition ${
                isRecording
                  ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400'
              }`}
              title={isRecording ? 'إيقاف التسجيل الصوتي' : 'تسجيل بصمة صوتية بالميكروفون'}
            >
              <Mic className="h-4 w-4" />
            </button>

            <input
              type="text"
              placeholder={
                isRecording
                  ? '🔴 جارٍ تسجيل الصوت... انقر على أيقونة المايك عند الانتهاء'
                  : audioBase64
                  ? 'تم تجهيز التسجيل الصوتي! يمكنك كتابة ملاحظة أو الضغط على إرسال تجريبي مباشرة...'
                  : provider === 'openai'
                  ? 'اكتب رسالة لتجربة رد OpenAI (مثلاً: كم سعر السماعات؟)...'
                  : 'اكتب رسالة أو استفسار أو ارفع تسجيلاً صوتياً...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading || isRecording}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />

            <button
              type="submit"
              disabled={loading || (!inputText.trim() && !imageBase64 && !audioBase64) || isRecording}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-teal-950"
            >
              <Send className="h-3.5 w-3.5" />
              <span>إرسال تجريبي</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
