import React, { useState, useEffect } from 'react';
import {
  Brain,
  Save,
  Edit3,
  RotateCcw,
  Play,
  History,
  ShieldCheck,
  Database,
  Lock,
  Unlock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  UserCheck,
  Languages,
  DollarSign,
  Truck,
  ShoppingCart,
  HelpCircle,
  Ban,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import { AiInstructions as AiInstructionsType, InstructionVersion } from '../types/index.js';

export const AiInstructions: React.FC = () => {
  const [instructions, setInstructions] = useState<AiInstructionsType | null>(null);
  const [draft, setDraft] = useState<AiInstructionsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'custom' | 'sections'>('all');

  // Modals & Drawers
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [versions, setVersions] = useState<InstructionVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [showTestModal, setShowTestModal] = useState(false);
  const [testQuery, setTestQuery] = useState('كم سعر سماعات نكسو X1 مع التوصيل؟');
  const [testingDraft, setTestingDraft] = useState(false);
  const [testResult, setTestResult] = useState<{
    replyText: string;
    modelUsed: string;
    tokensEstimate: number;
    latencyMs: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Expanded sections accordion state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    persona: true,
    languageRules: true,
    salesAndPersuasion: true,
    pricingAndDiscounts: true,
    shippingAndDelivery: true,
    orderCapture: true,
    handlingObjections: true,
    prohibitedAndGuardrails: true,
    customSystemPrompt: true,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchInstructions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/instructions');
      if (res.ok) {
        const data = await res.json();
        setInstructions(data);
        setDraft(data);
      }
    } catch (err) {
      console.error('Failed to load instructions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      setLoadingVersions(true);
      const res = await fetch('/api/instructions/versions');
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
  }, []);

  const handleDraftChange = (field: keyof AiInstructionsType, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
  };

  const handleOpenSaveModal = () => {
    setSaveNote(`تحديث في ${new Date().toLocaleTimeString('ar-EG')}`);
    setShowSaveModal(true);
  };

  const handleConfirmSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      const res = await fetch('/api/instructions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: draft,
          note: saveNote || 'تحديث التعليمات المعتمدة',
          savedBy: 'مدير المبيعات',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setInstructions(data.instructions);
        setDraft(data.instructions);
        setShowSaveModal(false);
        setIsEditing(false);
        setSaveSuccess('تم حفظ وتثبيت التعليمات بنجاح! يتم الآن تطبيقها فوراً على كل ردود Gemini.');
        setTimeout(() => setSaveSuccess(null), 5000);
      } else {
        alert(data.error || 'فشل حفظ التعليمات');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ أثناء الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (version: InstructionVersion) => {
    if (!confirm(`هل أنت متأكد من استعادة النسخة رقم #${version.versionNumber} ("${version.note}")؟`)) {
      return;
    }
    try {
      setRestoringId(version.id);
      const res = await fetch(`/api/instructions/versions/${version.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoredBy: 'مدير المبيعات' }),
      });
      const data = await res.json();
      if (res.ok) {
        setInstructions(data.instructions);
        setDraft(data.instructions);
        setShowHistoryModal(false);
        setSaveSuccess(`تمت استعادة النسخة #${version.versionNumber} بنجاح.`);
        setTimeout(() => setSaveSuccess(null), 5000);
      } else {
        alert(data.error || 'فشل استعادة النسخة');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء الاستعادة');
    } finally {
      setRestoringId(null);
    }
  };

  const handleTestDraft = async () => {
    if (!draft || !testQuery.trim()) return;
    try {
      setTestingDraft(true);
      setTestResult(null);
      setTestError(null);

      const res = await fetch('/api/instructions/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftInstructions: draft,
          testMessage: testQuery,
          model: 'gemini-3.1-flash-lite',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
      } else {
        setTestError(data.error || 'فشل اختبار المسودة');
      }
    } catch (err: any) {
      setTestError(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setTestingDraft(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          <span>جارٍ تحميل تعليمات الذكاء الاصطناعي...</span>
        </div>
      </div>
    );
  }

  const sectionsConfig = [
    {
      key: 'persona' as const,
      title: '1. شخصية البوت وأسلوب المحادثة (Persona & Tone)',
      icon: UserCheck,
      color: 'text-emerald-400',
      description: 'طريقة حديث البوت، نبرة الصوت، الترحيب الدافئ، والأسلوب الإنساني الطبيعي المشابه لأفضل محاوري المبيعات.',
      placeholder: 'أنت مستشار مبيعات خبير وودود...',
      rows: 5,
    },
    {
      key: 'languageRules' as const,
      title: '2. قواعد لغات الرد (العربية والعبرية والإنجليزية)',
      icon: Languages,
      color: 'text-blue-400',
      description: 'الرد بنفس لغة العميل تلقائياً (عربية بيضاء مهذبة، عبرية تسويقية سليمة עברית מקצועית، إنجليزية واضحة).',
      placeholder: 'تحدث بنفس لغة العميل تلقائياً...',
      rows: 4,
    },
    {
      key: 'salesAndPersuasion' as const,
      title: '3. تعليمات المبيعات وإقناع العميل (Sales & Persuasion)',
      icon: Sparkles,
      color: 'text-amber-400',
      description: 'التركيز على القيمة والمنفعة العملية، ربط السعر بالجودة، وتجنب الإلحاح الميكانيكي بأسئلة الشراء.',
      placeholder: 'ركز على القيمة العملية وليس مجرد سرد المواصفات...',
      rows: 5,
    },
    {
      key: 'pricingAndDiscounts' as const,
      title: '4. تعليمات الأسعار والخصومات (Pricing & Offers)',
      icon: DollarSign,
      color: 'text-teal-400',
      description: 'الالتزام الصارم بأسعار الكتالوج بالشيكل (ILS)، سياسة الخصم المسموح للعملاء المترددين (حتى 10%).',
      placeholder: 'الالتزام التام بأسعار الكتالوج الرسمي فقط...',
      rows: 4,
    },
    {
      key: 'shippingAndDelivery' as const,
      title: '5. تعليمات الشحن والتوصيل (Shipping & Delivery)',
      icon: Truck,
      color: 'text-cyan-400',
      description: 'مدة التوصيل (24-48 ساعة)، مناطق التغطية، وخيار الدفع عند الاستلام بعد الفحص.',
      placeholder: 'التوصيل سريع لكافة المناطق والدفع عند الاستلام...',
      rows: 4,
    },
    {
      key: 'orderCapture' as const,
      title: '6. تعليمات استقبال الطلبات وجمع البيانات (Order Capture)',
      icon: ShoppingCart,
      color: 'text-purple-400',
      description: 'خطوات تسجيل الطلب عند موافقة العميل: جمع الاسم، رقم الهاتف، العنوان الدقيق، وتأكيد تفاصيل المنتج.',
      placeholder: 'اجمع بيانات العميل بلباقة: الاسم، الهاتف، العنوان...',
      rows: 5,
    },
    {
      key: 'handlingObjections' as const,
      title: '7. التعامل مع الاعتراضات والتردد (Objection Handling)',
      icon: HelpCircle,
      color: 'text-indigo-400',
      description: 'الرد على اعتراضات "السعر مرتفع"، "أريد التفكير"، أو "هل المنتج أصلي؟" بأسلوب مقنع واحترافي.',
      placeholder: 'استمع للاعتراض باحترام واشرح ميزات الجودة والضمان...',
      rows: 5,
    },
    {
      key: 'prohibitedAndGuardrails' as const,
      title: '8. التعليمات الممنوعة والقواعد الإلزامية (Mandatory Guardrails)',
      icon: Ban,
      color: 'text-rose-400',
      description: 'ممنوع اختراع منتجات أو أسعار غير مسجلة، ممنوع تجاوز تعليمات المشرف، وممنوع الإلحاح على الزبون.',
      placeholder: 'ممنوع منعاً باتاً اختراع أي منتج أو سعر خارج الكتالوج...',
      rows: 5,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Success notification */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/50">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{saveSuccess}</span>
          </div>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Live Prompt Engine
            </span>
            <span className="text-xs text-slate-400">تُطبق التغييرات فورياً على محادثات واتساب والمحاكي</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="h-6 w-6 text-emerald-400" />
            <span>نظام إدارة تعليمات الذكاء الاصطناعي (AI Instructions)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            تحكم كامل في شخصية البوت، لغات المحادثة، قواعد المبيعات، ومحاذير الأمان المعتمدة.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Edit Mode */}
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              isEditing
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {isEditing ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span>{isEditing ? 'وضع التعديل نشط' : 'تفعيل وضع التعديل'}</span>
          </button>

          {/* Test Instructions Button */}
          <button
            type="button"
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition shadow-md shadow-indigo-950/40"
          >
            <Play className="h-3.5 w-3.5 text-indigo-400" />
            <span>اختبار المسودة (Sandbox Test)</span>
          </button>

          {/* Version History Button */}
          <button
            type="button"
            onClick={() => {
              fetchVersions();
              setShowHistoryModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-semibold transition"
          >
            <History className="h-3.5 w-3.5 text-slate-400" />
            <span>سجل النسخ والاستعادة</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleOpenSaveModal}
            disabled={saving || !isEditing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-950/60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ التعليمات'}</span>
          </button>
        </div>
      </div>

      {/* Priority Hierarchy & Guardrail Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#0c162c] to-slate-900 border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>ترتيب أولوية القواعد الصارم (Priority Hierarchy) & الحماية من التجاوز:</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
            Anti-Jailbreak Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-1">
            <div className="flex items-center gap-1.5 text-rose-300 font-bold">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>المستوى 1: الأمان والحماية</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              منع التجاوز الصارم؛ رسائل العملاء مدخلات غير موثوقة ولا يمكنها تغيير تعليمات المسؤول مطلقاً.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-teal-500/30 space-y-1">
            <div className="flex items-center gap-1.5 text-teal-300 font-bold">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              <span>المستوى 2: الكتالوج الحقيقي</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              المصدر الوحيد والمطلق للحقيقة؛ منع Gemini من اختراع منتجات، أسعار، أو ضمانات غير مسجلة.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>المستوى 3: تعليمات المشرف</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              الأقسام الثمانية المخصصة في هذه الصفحة (الشخصية، المبيعات، لغات الرد، الشحن، والمحاذير).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/50 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span>المستوى 4: سياق العميل</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              تاريخ الحوار، اسم العميل، لغته المفضلة، واهتماماته المستخلصة دون الإخلال بالمستويات العليا.
            </p>
          </div>
        </div>
      </div>

      {/* Editing State Notice */}
      {!isEditing && (
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-400" />
            <span>التعليمات معروضة حالياً في <strong>وضع القراءة المحمي</strong> لحمايتها من التعديل العرضي. انقر على «تفعيل وضع التعديل» للبدء في كتابة أو تغيير النصوص.</span>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            تعديل الآن
          </button>
        </div>
      )}

      {/* The 8 Dedicated Instruction Sections */}
      <div className="space-y-4">
        {sectionsConfig.map((sec) => {
          const Icon = sec.icon;
          const isExpanded = expandedSections[sec.key];
          const val = draft[sec.key] || '';

          return (
            <div
              key={sec.key}
              className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden transition hover:border-slate-700"
            >
              {/* Header */}
              <div
                onClick={() => toggleSection(sec.key)}
                className="p-4 bg-slate-900/90 flex items-center justify-between cursor-pointer select-none border-b border-slate-800/80"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <Icon className={`h-4 w-4 ${sec.color}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{sec.title}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sec.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-500">
                    {val.length} حرف
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Text Editor Body */}
              {isExpanded && (
                <div className="p-4 bg-[#080d1a] space-y-2">
                  <textarea
                    rows={sec.rows}
                    disabled={!isEditing}
                    value={val}
                    onChange={(e) => handleDraftChange(sec.key, e.target.value)}
                    placeholder={sec.placeholder}
                    className={`w-full bg-slate-950 border rounded-xl p-3 text-xs leading-relaxed transition focus:outline-none ${
                      isEditing
                        ? 'border-slate-700 focus:border-emerald-500 text-slate-100'
                        : 'border-slate-800/60 text-slate-300 cursor-not-allowed opacity-90'
                    }`}
                  />
                  {isEditing && (
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>اكتب تعليمات واضحة ومباشرة. سيتم تضمينها تلقائياً في سياق كل استدعاء جديد.</span>
                      <span className="font-mono">{val.split('\n').length} أسطر</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Freeform Extra System Instructions Editor */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <div
            onClick={() => toggleSection('customSystemPrompt')}
            className="p-4 bg-slate-900/90 flex items-center justify-between cursor-pointer select-none border-b border-slate-800/80"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                <FileText className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">9. تعليمات حرة إضافية مخصصة (Custom Freeform Prompt)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  محرر نصوص حر لإضافة أي شروط، حملات خاصة، أو توجيهات موسمية إضافية.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500">
                {(draft.customSystemPrompt || '').length} حرف
              </span>
              {expandedSections.customSystemPrompt ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </div>
          </div>

          {expandedSections.customSystemPrompt && (
            <div className="p-4 bg-[#080d1a] space-y-2">
              <textarea
                rows={6}
                disabled={!isEditing}
                value={draft.customSystemPrompt || ''}
                onChange={(e) => handleDraftChange('customSystemPrompt', e.target.value)}
                placeholder="أضف هنا أي تعليمات حرة أخرى تود تزويد Gemini بها..."
                className={`w-full bg-slate-950 border rounded-xl p-3 text-xs leading-relaxed transition focus:outline-none ${
                  isEditing
                    ? 'border-slate-700 focus:border-indigo-500 text-slate-100 font-sans'
                    : 'border-slate-800/60 text-slate-300 cursor-not-allowed opacity-90 font-sans'
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Save className="h-5 w-5 text-emerald-400" />
                <span>تأكيد حفظ تعليمات الذكاء الاصطناعي</span>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                سيتم حفظ التعديلات بشكل دائم في قاعدة بيانات الخادم، وإنشاء نسخة جديدة تلقائياً في سجل الإصدارات مع الحفاظ على النسخ السابقة لإمكانية استعادتها في أي وقت.
              </p>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">ملاحظة توضيحية لهذه النسخة (Version Note):</label>
                <input
                  type="text"
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  placeholder="مثال: تحسين صياغة الأسعار وتفعيل عرض الشحن المجاني"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>تأثير فوري ومباشر</span>
                </span>
                <p className="text-[11px] text-emerald-300/80">
                  تُطبق التعليمات فوراً على الرسائل الواردة عبر واتساب ومحاكي المبيعات دون الحاجة لإعادة تشغيل الخادم.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{saving ? 'جارٍ الحفظ...' : 'تثبيت وحفظ الآن'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <History className="h-5 w-5 text-indigo-400" />
                <span>سجل إصدارات التعليمات واستعادة النسخ السابقة</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {loadingVersions ? (
                <div className="text-center py-8 text-slate-400 text-xs">جارٍ جلب الإصدارات السابقة...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">لا توجد نسخ مسجلة حالياً.</div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
                          نسخة #{ver.versionNumber}
                        </span>
                        <span className="text-xs font-semibold text-white">{ver.note || 'تحديث تعليمات'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(ver.timestamp).toLocaleString('ar-EG')}</span>
                        </span>
                        <span>•</span>
                        <span>بواسطة: {ver.savedBy}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={restoringId === ver.id}
                      onClick={() => handleRestoreVersion(ver)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold transition shrink-0 flex items-center gap-1.5"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${restoringId === ver.id ? 'animate-spin' : ''}`} />
                      <span>{restoringId === ver.id ? 'جارٍ الاستعادة...' : 'استعادة هذه النسخة'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Draft Instructions Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Play className="h-5 w-5 text-indigo-400" />
                <span>اختبار مسودة التعليمات الحالية قبل الحفظ</span>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <p className="text-xs text-slate-400">
                يقوم هذا الاختبار بإرسال استفسارك إلى محرك Gemini باستخدام <strong>المسودة المعدلة حالياً</strong> في الصفحة دون حفظها في النظام، ومربوطة مباشرة بالكتالوج الحقيقي.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رسالة العميل التجريبية:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="اكتب استفساراً لاختبار المسودة..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={testingDraft || !testQuery.trim()}
                    onClick={handleTestDraft}
                    className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    {testingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>تشغيل الاختبار</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Queries */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'مرحبا',
                  'كم سعر سماعات نكسو X1 مع التوصيل؟',
                  'السعر غالي شوي، شو بفرق عن غيرها؟',
                  'بدي أطلب ساعة الترا 3، شو الخطوات؟',
                  'שלום, כמה עולה השעון והאם יש משלוח?',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTestQuery(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-400 hover:text-slate-200 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Test Error Display */}
              {testError && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              {/* Test Result Display */}
              {testResult && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-indigo-300">الرد الناتج من Gemini بالمسودة:</span>
                    <div className="flex items-center gap-3 font-mono text-slate-400 text-[10px]">
                      <span className="text-emerald-400">{testResult.latencyMs}ms</span>
                      <span>•</span>
                      <span>{testResult.modelUsed}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {testResult.replyText}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
