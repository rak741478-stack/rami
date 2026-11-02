import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Smartphone,
  Sparkles,
  Zap,
  Play,
  Clock,
  ShieldAlert,
  Sliders,
  History,
  Check,
  Mic,
  Image as ImageIcon,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge.js';
import { AiTelemetryLog } from '../types/index.js';

export const Diagnostics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Speed test state
  const [testingSpeed, setTestingSpeed] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState<any>(null);

  // Auto-reply behavior isolation test
  const [testingBehavior, setTestingBehavior] = useState(false);
  const [behaviorTestResult, setBehaviorTestResult] = useState<any>(null);

  const runCheck = () => {
    setLoading(true);
    fetch('/api/diagnostics')
      .then((r) => r.json())
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runCheck();
  }, []);

  // Run direct Gemini "مرحبا" speed test
  const handleRunSpeedTest = async () => {
    setTestingSpeed(true);
    setSpeedTestResult(null);
    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: 'مرحبا',
          provider: 'gemini',
        }),
      });
      const json = await res.json();
      setSpeedTestResult(json);
      // Refresh diagnostics to get updated telemetry
      runCheck();
    } catch (e: any) {
      setSpeedTestResult({ error: e.message });
    } finally {
      setTestingSpeed(false);
    }
  };

  // Run isolated test for auto-reply behavior
  const handleTestAutoReplyBehavior = async () => {
    setTestingBehavior(true);
    setBehaviorTestResult(null);
    try {
      const res = await fetch('/api/ai/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: 'مرحبا، هل تتوفر سماعات نكسو X1؟',
          testAutoReplyBehavior: true,
        }),
      });
      const json = await res.json();
      setBehaviorTestResult(json);
    } catch (e: any) {
      setBehaviorTestResult({ error: e.message });
    } finally {
      setTestingBehavior(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-sky-400" />
            <span>تشخيص وفحص النظام والسرعة المباشرة (Diagnostics & Telemetry)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            قياس زمن الاستجابة الفعلي، فحص محرك Gemini، اكتشاف أخطاء ونفاد رصيد OpenAI، واختبار سلوك الرد التلقائي.
          </p>
        </div>

        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>إعادة الفحص المباشر</span>
        </button>
      </div>

      {/* Main Health Grid */}
      {loading && !data ? (
        <div className="p-12 text-center text-xs text-slate-400">جارٍ إجراء الفحص الشامل للخدمات...</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Gemini Health Card */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <span>محرك Google Gemini (الأساسي)</span>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    data.checks.gemini.status === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {data.checks.gemini.status === 'connected' ? 'متصل ومجرّب' : data.checks.gemini.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{data.checks.gemini.message}</p>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>الموديل الفعلي:</span>
                <span className="text-blue-300 font-semibold">{data.checks.gemini.model}</span>
              </div>
              {data.checks.gemini.latencyMs > 0 && (
                <div className="text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                  <span>زمن الفحص الحي:</span>
                  <span>{data.checks.gemini.latencyMs} ms</span>
                </div>
              )}
            </div>

            {/* OpenAI Health Card with Quota Alert */}
            <div
              className={`rounded-2xl border p-5 space-y-3 ${
                data.checks.openai.isQuotaExhausted
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-teal-400" />
                  <span>محرك OpenAI API</span>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    data.checks.openai.isQuotaExhausted
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : data.checks.openai.status === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {data.checks.openai.isQuotaExhausted ? 'نفاد الرصيد (Credits)' : data.checks.openai.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {data.checks.openai.isQuotaExhausted ? (
                  <span className="text-amber-300">
                    تنبيه: مفتاح OpenAI لا يحتوي على رصيد كافٍ (no credits remaining / insufficient quota). نظام الحماية التلقائي يعمل حالياً عبر تحويل الردود إلى Gemini لمنع توقف المحادثات.
                  </span>
                ) : (
                  data.checks.openai.message
                )}
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>الموديل:</span>
                <span className="text-teal-300 font-semibold">{data.checks.openai.model}</span>
              </div>
            </div>

            {/* Auto-Reply Status Card */}
            <div
              className={`rounded-2xl border p-5 space-y-3 ${
                data.checks.autoReply.enabled
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-400" />
                  <span>حالة الرد التلقائي (Auto-Reply)</span>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                    data.checks.autoReply.enabled
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {data.checks.autoReply.enabled ? 'مشغّل (Active)' : 'متوقف (Paused)'}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {data.checks.autoReply.enabled
                  ? 'الرد التلقائي نشط؛ يتم إرسال ردود Gemini للعملاء عبر WhatsApp Baileys فورياً.'
                  : 'الرد التلقائي متوقف؛ يتم تسجيل وعرض الرسائل في صندوق الوارد دون توليد ردود آلية.'}
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>آخر زمن رد مسجل:</span>
                <span className="text-emerald-300">
                  {data.checks.autoReply.lastLatencyMs ? `${data.checks.autoReply.lastLatencyMs} ms` : 'لم يسجل بعد'}
                </span>
              </div>
            </div>

            {/* WhatsApp Baileys Card */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-sky-400" />
                  <span>عميل واتساب (Baileys)</span>
                </span>
                <StatusBadge status={data.checks.whatsapp.status} size="sm" />
              </div>
              <p className="text-xs text-slate-300">
                {data.checks.whatsapp.status === 'connected'
                  ? `مقترن بنجاح بالرقم: +${data.checks.whatsapp.phone}`
                  : 'العميل بانتظار مسح الرمز أو غير متصل حالياً.'}
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>المنصة:</span>
                <span className="text-sky-300 truncate max-w-xs">{data.checks.whatsapp.platform}</span>
              </div>
            </div>

            {/* Database Health Card */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>قاعدة البيانات والتخزين المحلي</span>
                </span>
                <StatusBadge status={data.checks.database.status} size="sm" />
              </div>
              <p className="text-xs text-slate-300">{data.checks.database.message}</p>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>السجلات المحفوظة:</span>
                <span className="text-emerald-300">
                  {data.checks.database.count.customers} عميل | {data.checks.database.count.products} منتج | {data.checks.database.count.orders} طلب
                </span>
              </div>
            </div>

            {/* Server Resources Card */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Server className="h-4 w-4 text-purple-400" />
                  <span>الخادم والذاكرة</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                  Node {data.checks.server.nodeVersion}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                استهلاك الذاكرة: <span className="font-mono text-purple-300">{data.checks.server.memoryUsageMb} MB</span>
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>وقت التشغيل المتواصل:</span>
                <span className="text-purple-300">{Math.round(data.checks.server.uptime / 60)} دقيقة</span>
              </div>
            </div>

            {/* Product Media & Categorized Images Card */}
            {data.checks.productMedia && (
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-emerald-400" />
                    <span>الصور المصنفة (Categorized Media)</span>
                  </span>
                  <StatusBadge status={data.checks.productMedia.status} size="sm" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{data.checks.productMedia.details}</p>
                {data.checks.productMedia.categoryCounts && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                      رئيسية: {data.checks.productMedia.categoryCounts.main || 0}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">
                      ألعاب: {data.checks.productMedia.categoryCounts.games || 0}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-medium">
                      يدات: {data.checks.productMedia.categoryCounts.controllers || 0}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                      ملحقات: {data.checks.productMedia.categoryCounts.accessories || 0}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-medium">
                      مواصفات: {data.checks.productMedia.categoryCounts.specs || 0}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Voice Audio Understanding Card */}
            {data.checks.voiceAudio && (
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <Mic className="h-4 w-4 text-amber-400" />
                    <span>تحليل الرسائل الصوتية (Gemini Audio)</span>
                  </span>
                  <StatusBadge status={data.checks.voiceAudio.status} size="sm" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{data.checks.voiceAudio.message}</p>
                <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>اللغات المدعومة:</span>
                  <span className="text-amber-300">عربية فلسطينية • עברית • English</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Benchmark & Testing Section */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span>لوحة الاختبار المباشر وقياس أزمنة المراحل (Stage Timing Benchmark)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  اختبر سرعة استجابة Gemini برسالة «مرحبا» أو اختبر سلوك التشغيل والإيقاف في بيئة معزولة بدون إرسال رسائل حقيقية للعملاء.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRunSpeedTest}
                  disabled={testingSpeed}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs transition shadow-md shadow-blue-950"
                >
                  <Play className={`h-3.5 w-3.5 ${testingSpeed ? 'animate-spin' : ''}`} />
                  <span>{testingSpeed ? 'جارٍ قياس السرعة...' : 'اختبار رسالة «مرحبا»'}</span>
                </button>

                <button
                  onClick={handleTestAutoReplyBehavior}
                  disabled={testingBehavior}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs transition"
                >
                  <Sliders className={`h-3.5 w-3.5 ${testingBehavior ? 'animate-spin' : ''}`} />
                  <span>{testingBehavior ? 'جارٍ الفحص...' : 'اختبار سلوك الرد التلقائي المعزول'}</span>
                </button>
              </div>
            </div>

            {/* Speed Test Results Card */}
            {speedTestResult && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-blue-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>نتائج قياس سرعة رسالة «مرحبا» عبر محرك {speedTestResult.modelUsed}:</span>
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                      speedTestResult.latencyMs < 2000
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : speedTestResult.latencyMs < 15000
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    إجمالي الزمن: {speedTestResult.latencyMs} ms
                  </span>
                </div>

                {/* Stage Timing Breakdown */}
                {speedTestResult.stageTiming && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">1. تجهيز السياق والذاكرة:</span>
                      <span className="font-mono text-slate-200 font-bold">
                        {speedTestResult.stageTiming.contextPrepMs} ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">2. استجابة Gemini API:</span>
                      <span className="font-mono text-blue-300 font-bold">
                        {speedTestResult.stageTiming.aiLatencyMs} ms
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">3. الحالة وحد الـ 15 ثانية:</span>
                      <span
                        className={`font-semibold ${
                          speedTestResult.stageTiming.exceeded15s ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {speedTestResult.stageTiming.exceeded15s ? '⚠️ تجاوز 15 ثانية' : '✅ ممتاز (ضمن الحد الآمن)'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-200">
                  <span className="text-slate-400 block mb-1">الرد المولّد من الذكاء الاصطناعي:</span>
                  <p className="leading-relaxed font-sans">{speedTestResult.replyText}</p>
                </div>
              </div>
            )}

            {/* Behavior Isolation Result */}
            {behaviorTestResult && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    <span>نتيجة اختبار سلوك الرد التلقائي في بيئة معزولة:</span>
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${
                      behaviorTestResult.autoReplyEnabled
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    حالة الخادم: {behaviorTestResult.autoReplyEnabled ? 'تشغيل' : 'إيقاف'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{behaviorTestResult.replyText}</p>
              </div>
            )}
          </div>

          {/* Telemetry and Test Logs Feed */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="h-4 w-4 text-sky-400" />
                  <span>سجل قياسات أزمنة الردود والأخطاء الفعلية (AI Telemetry Log)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تسجيل دقيق لكل رسالة واردة مع تفصيل زمن التجهيز، زمن طلب API، زمن إرسال واتساب، وأي تحويلات تلقائية.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {data.recentTelemetry?.length || 0} عملية مسجلة
              </span>
            </div>

            {data.recentTelemetry && data.recentTelemetry.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="pb-2 font-medium">الوقت</th>
                      <th className="pb-2 font-medium">العميل / النص</th>
                      <th className="pb-2 font-medium">المحرك / الموديل</th>
                      <th className="pb-2 font-medium text-center">زمن السياق</th>
                      <th className="pb-2 font-medium text-center">زمن الذكاء</th>
                      <th className="pb-2 font-medium text-center">إرسال واتساب</th>
                      <th className="pb-2 font-medium text-center">الإجمالي</th>
                      <th className="pb-2 font-medium text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {data.recentTelemetry.map((log: AiTelemetryLog) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(log.timestamp).toLocaleTimeString('ar-EG')}
                        </td>
                        <td className="py-2.5 max-w-xs truncate font-sans text-slate-200">
                          <span className="font-semibold block text-[11px] text-slate-300">
                            {log.customerName || log.customerId}
                          </span>
                          <span className="text-slate-400 truncate block text-[11px]">{log.incomingText}</span>
                        </td>
                        <td className="py-2.5 text-slate-300 whitespace-nowrap text-[11px]">
                          <span className="text-blue-300">{log.modelUsed}</span>
                        </td>
                        <td className="py-2.5 text-center text-slate-400 text-[11px]">
                          {log.stageTiming.contextPrepMs}ms
                        </td>
                        <td className="py-2.5 text-center text-blue-300 text-[11px]">
                          {log.stageTiming.aiLatencyMs}ms
                        </td>
                        <td className="py-2.5 text-center text-sky-300 text-[11px]">
                          {log.stageTiming.whatsappSendMs ? `${log.stageTiming.whatsappSendMs}ms` : '-'}
                        </td>
                        <td className="py-2.5 text-center font-bold text-[11px]">
                          <span
                            className={
                              log.stageTiming.totalMs > 15000
                                ? 'text-rose-400 font-bold'
                                : log.stageTiming.totalMs > 3000
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                            }
                          >
                            {log.stageTiming.totalMs}ms
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          {log.status === 'success' && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold font-sans">
                              ناجح
                            </span>
                          )}
                          {log.status === 'warning_slow' && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 font-bold font-sans">
                              تجاوز 15ث
                            </span>
                          )}
                          {log.status === 'fallback_gemini' && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 font-bold font-sans">
                              تحويل لـ Gemini
                            </span>
                          )}
                          {log.status === 'auto_reply_disabled' && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-sans">
                              الرد التلقائي متوقف
                            </span>
                          )}
                          {log.status === 'error' && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 font-sans">
                              خطأ
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">لا توجد سجلات قياس بعد. قم بإجراء اختبار أو استقبال رسائل جديدة.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
