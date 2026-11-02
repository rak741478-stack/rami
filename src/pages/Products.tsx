import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Tag,
  Check,
  X,
  Edit2,
  Trash2,
  Upload,
  Image as ImageIcon,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Eye,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Star,
  Gamepad2,
} from 'lucide-react';
import { Product, CategorizedProductImage, ProductImageCategory } from '../types/index.js';

export const IMAGE_CATEGORY_OPTIONS: Array<{
  id: ProductImageCategory;
  label: string;
  badgeBg: string;
  badgeText: string;
}> = [
  { id: 'main', label: 'صورة المنتج الرئيسية', badgeBg: 'bg-emerald-500/20 border-emerald-500/40', badgeText: 'text-emerald-300' },
  { id: 'games', label: 'صور الألعاب', badgeBg: 'bg-purple-500/20 border-purple-500/40', badgeText: 'text-purple-300' },
  { id: 'controllers', label: 'صور أيدي التحكم', badgeBg: 'bg-blue-500/20 border-blue-500/40', badgeText: 'text-blue-300' },
  { id: 'accessories', label: 'صور الملحقات', badgeBg: 'bg-amber-500/20 border-amber-500/40', badgeText: 'text-amber-300' },
  { id: 'specs', label: 'صور المواصفات والعلبة', badgeBg: 'bg-cyan-500/20 border-cyan-500/40', badgeText: 'text-cyan-300' },
  { id: 'extra', label: 'صور إضافية', badgeBg: 'bg-slate-500/20 border-slate-500/40', badgeText: 'text-slate-300' },
];

interface ProductFormData {
  id?: string;
  name: string;
  arabicName: string;
  hebrewName: string;
  description: string;
  price: number | '';
  originalPrice: number | '';
  currency: string;
  sku: string;
  stock: number | '';
  category: string;
  features: string[];
  imageUrl: string;
  categorizedImages: CategorizedProductImage[];
  inStock: boolean;
}

const DEFAULT_FORM: ProductFormData = {
  name: '',
  arabicName: '',
  hebrewName: '',
  description: '',
  price: '',
  originalPrice: '',
  currency: 'ILS',
  sku: '',
  stock: 10,
  category: 'إلكترونيات',
  features: [],
  imageUrl: '',
  categorizedImages: [],
  inStock: true,
};

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM);
  const [newFeatureInput, setNewFeatureInput] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // New Image URL input state
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageTitle, setNewImageTitle] = useState('');
  const [newImageCategory, setNewImageCategory] = useState<ProductImageCategory>('extra');

  // Delete Confirmation Modal
  const [deleteModalProduct, setDeleteModalProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Success alert
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProducts(data);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    const defaultUrl = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
    setFormData({
      ...DEFAULT_FORM,
      sku: `NX-${Math.floor(1000 + Math.random() * 9000)}`,
      imageUrl: defaultUrl,
      categorizedImages: [
        {
          id: `img-${Date.now()}`,
          url: defaultUrl,
          title: 'صورة المنتج الرئيسية',
          category: 'main',
          order: 0,
        },
      ],
    });
    setNewFeatureInput('');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    
    // Resolve all existing categorized images safely
    const initialCategorized: CategorizedProductImage[] = [];
    const seenUrls = new Set<string>();

    if (Array.isArray(p.categorizedImages) && p.categorizedImages.length > 0) {
      for (const img of p.categorizedImages) {
        if (img && img.url && !seenUrls.has(img.url.trim())) {
          seenUrls.add(img.url.trim());
          initialCategorized.push({ ...img });
        }
      }
    }

    if (p.imageUrl && !seenUrls.has(p.imageUrl.trim())) {
      seenUrls.add(p.imageUrl.trim());
      initialCategorized.unshift({
        id: `img-main-legacy`,
        url: p.imageUrl.trim(),
        title: 'صورة المنتج الرئيسية',
        category: 'main',
        order: 0,
      });
    }

    if (Array.isArray(p.images)) {
      for (let i = 0; i < p.images.length; i++) {
        const u = p.images[i];
        if (u && typeof u === 'string' && u.trim() && !seenUrls.has(u.trim())) {
          seenUrls.add(u.trim());
          initialCategorized.push({
            id: `img-extra-legacy-${i}`,
            url: u.trim(),
            title: 'صورة إضافية',
            category: 'extra',
            order: initialCategorized.length,
          });
        }
      }
    }

    setFormData({
      id: p.id,
      name: p.name,
      arabicName: p.arabicName,
      hebrewName: p.hebrewName || '',
      description: p.description,
      price: p.price,
      originalPrice: p.originalPrice || '',
      currency: p.currency || 'ILS',
      sku: p.sku,
      stock: p.stock,
      category: p.category || 'عام',
      features: [...(p.features || [])],
      imageUrl: p.imageUrl,
      categorizedImages: initialCategorized.sort((a, b) => a.order - b.order),
      inStock: p.inStock,
    });
    setNewFeatureInput('');
    setModalOpen(true);
  };

  // Upload multiple images from computer with safe limits
  const handleMultiImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB safe limit

    setUploadingImage(true);
    let uploadedCount = 0;
    const newImages: CategorizedProductImage[] = [...formData.categorizedImages];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.size > MAX_FILE_SIZE) {
        alert(`الملف "${file.name}" يتجاوز الحد الأقصى الآمن (10 ميجابايت)`);
        continue;
      }

      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch('/api/products/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            filename: file.name,
          }),
        });

        const data = await res.json();
        if (res.ok && data.url) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const hasMain = newImages.some((img) => img.category === 'main');
          newImages.push({
            id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
            url: data.url,
            title: cleanName || 'صورة منتج',
            category: hasMain ? 'extra' : 'main',
            order: newImages.length,
          });
          uploadedCount++;
        }
      } catch (uploadErr) {
        console.error('Error uploading file:', uploadErr);
      }
    }

    setFormData((prev) => {
      const mainImg = newImages.find((img) => img.category === 'main') || newImages[0];
      return {
        ...prev,
        categorizedImages: newImages,
        imageUrl: mainImg?.url || prev.imageUrl,
      };
    });

    setUploadingImage(false);
    if (uploadedCount > 0) {
      showNotification(`تم رفع ${uploadedCount} صورة بنجاح وحفظها بشكل دائم على الخادم!`);
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  const handleAddExternalImageUrl = (url: string, title: string, category: ProductImageCategory) => {
    if (!url.trim()) return;
    const newImages = [...formData.categorizedImages];
    const hasMain = newImages.some((img) => img.category === 'main');
    const finalCategory = category || (hasMain ? 'extra' : 'main');

    newImages.push({
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      url: url.trim(),
      title: title.trim() || 'صورة مخصصة',
      category: finalCategory,
      order: newImages.length,
    });

    const mainImg = newImages.find((img) => img.category === 'main') || newImages[0];
    setFormData((prev) => ({
      ...prev,
      categorizedImages: newImages,
      imageUrl: mainImg?.url || prev.imageUrl,
    }));
  };

  const handleUpdateImage = (index: number, updates: Partial<CategorizedProductImage>) => {
    const updated = [...formData.categorizedImages];
    if (!updated[index]) return;

    if (updates.category === 'main') {
      // Demote any other main image to extra
      updated.forEach((img, idx) => {
        if (idx !== index && img.category === 'main') {
          img.category = 'extra';
        }
      });
    }

    updated[index] = { ...updated[index], ...updates };
    const mainImg = updated.find((img) => img.category === 'main') || updated[0];

    setFormData((prev) => ({
      ...prev,
      categorizedImages: updated,
      imageUrl: mainImg?.url || prev.imageUrl,
    }));
  };

  const handleDeleteImage = (index: number) => {
    const updated = formData.categorizedImages.filter((_, idx) => idx !== index);
    const mainImg = updated.find((img) => img.category === 'main') || updated[0];

    setFormData((prev) => ({
      ...prev,
      categorizedImages: updated.map((img, i) => ({ ...img, order: i })),
      imageUrl: mainImg?.url || '',
    }));
  };

  const handleSetAsMain = (index: number) => {
    handleUpdateImage(index, { category: 'main' });
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= formData.categorizedImages.length) return;

    const list = [...formData.categorizedImages];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    // reindex order
    const reordered = list.map((img, idx) => ({ ...img, order: idx }));
    const mainImg = reordered.find((img) => img.category === 'main') || reordered[0];

    setFormData((prev) => ({
      ...prev,
      categorizedImages: reordered,
      imageUrl: mainImg?.url || prev.imageUrl,
    }));
  };

  const handleAddFeature = () => {
    if (!newFeatureInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      features: [...prev.features, newFeatureInput.trim()],
    }));
    setNewFeatureInput('');
  };

  const handleRemoveFeature = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.arabicName.trim() || formData.price === '') {
      alert('يرجى إدخال اسم المنتج وسعره الرسمي');
      return;
    }

    try {
      setSavingProduct(true);
      const mainImg =
        formData.categorizedImages.find((img) => img.category === 'main') ||
        formData.categorizedImages[0];

      const resolvedImageUrl = mainImg?.url || formData.imageUrl.trim();

      const payload = {
        name: formData.name.trim() || formData.arabicName.trim(),
        arabicName: formData.arabicName.trim(),
        hebrewName: formData.hebrewName.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        originalPrice: formData.originalPrice !== '' ? Number(formData.originalPrice) : undefined,
        currency: formData.currency,
        sku: formData.sku.trim().toUpperCase(),
        stock: Number(formData.stock) || 0,
        category: formData.category.trim() || 'عام',
        features: formData.features,
        imageUrl: resolvedImageUrl,
        categorizedImages: formData.categorizedImages,
        images: formData.categorizedImages.map((img) => img.url),
        inStock: formData.inStock,
      };

      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(
          editingProduct ? 'تم تحديث بيانات المنتج وصوره بنجاح!' : 'تمت إضافة المنتج الجديد للكتالوج بنجاح!'
        );
        setModalOpen(false);
        fetchProducts();
      } else {
        alert(data.error || 'فشل حفظ المنتج');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ المنتج');
    } finally {
      setSavingProduct(false);
    }
  };


  const handleDeleteProduct = async () => {
    if (!deleteModalProduct) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/products/${deleteModalProduct.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showNotification(`تم حذف المنتج "${deleteModalProduct.arabicName}" من الكتالوج بنجاح`);
        setDeleteModalProduct(null);
        fetchProducts();
      } else {
        const data = await res.json();
        alert(data.error || 'فشل حذف المنتج');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حذف المنتج');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetSampleProducts = async () => {
    if (!confirm('هل تود حقاً استعادة المنتجات الافتراضية الأربعة المعتمدة؟ لن يتم حذف أي منتجات حقيقية أخرى.')) {
      return;
    }
    try {
      const res = await fetch('/api/products/reset-samples', { method: 'POST' });
      if (res.ok) {
        showNotification('تمت إعادة ضبط الكتالوج بنجاح!');
        fetchProducts();
      }
    } catch (_) {}
  };

  // Categories list
  const categories = Array.from(new Set(['all', ...products.map((p) => p.category || 'عام')]));

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.arabicName.includes(search) ||
      (p.hebrewName && p.hebrewName.includes(search)) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between shadow-xl shadow-emerald-950/60">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-teal-500/15 text-teal-300 border border-teal-500/30">
              Live Product Grounding
            </span>
            <span className="text-xs text-slate-400">أي تعديل ينعكس فوراً على ردود Gemini وواتساب</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-400" />
            <span>إدارة كتالوج المنتجات والأسعار الرسمية</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            المصدر الحصري للأسعار والمواصفات؛ يمنع الذكاء الاصطناعي منعاً باتاً من اختراع أي منتج غير مسجل هنا.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetSampleProducts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition"
            title="استعادة المنتجات الافتراضية المعتمدة"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>المنتجات الافتراضية</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-950"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            placeholder="البحث بالاسم العربي، العبري، أو رمز SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                categoryFilter === cat
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat === 'all' ? 'جميع الأقسام' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <span>جارٍ تحميل المنتجات...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/30 border border-slate-800 rounded-2xl p-6 space-y-3">
          <Package className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">لا توجد منتجات مطابقة</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            لم يتم العثور على أي منتجات بالبحث المحدد. يمكنك إضافة منتج جديد بالنقر على الزر أعلاه.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            إضافة منتج الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((prod) => (
            <div
              key={prod.id}
              className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden flex flex-col hover:border-slate-700 transition group shadow-md"
            >
              {/* Product Image Header */}
              <div className="h-48 bg-slate-950 relative overflow-hidden">
                <img
                  src={prod.imageUrl}
                  alt={prod.arabicName}
                  onError={(e) => {
                    // fallback image
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute top-3 end-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-slate-700">
                    {prod.sku}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md ${
                      prod.inStock ? 'bg-emerald-500/90 text-slate-950' : 'bg-rose-500/90 text-white'
                    }`}
                  >
                    {prod.inStock ? `متوفر (${prod.stock})` : 'نفد'}
                  </span>
                </div>

                <div className="absolute bottom-2 start-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-950/80 text-[10px] text-emerald-300 font-semibold border border-slate-800">
                    {prod.category}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-950/80 text-[10px] text-slate-300 font-semibold border border-slate-800 flex items-center gap-1">
                    <ImageIcon className="h-2.5 w-2.5 text-emerald-400" />
                    <span>
                      {prod.categorizedImages?.length || (prod.imageUrl ? 1 : 0)} صور
                    </span>
                  </span>
                </div>
              </div>

              {/* Content Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{prod.arabicName}</h3>
                  {prod.hebrewName && (
                    <h4 className="text-xs text-slate-400 font-medium line-clamp-1 mt-0.5">{prod.hebrewName}</h4>
                  )}
                  <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                    {prod.description}
                  </p>
                </div>

                <div>
                  {/* Features Bullets */}
                  <div className="space-y-1 mb-3 pt-2 border-t border-slate-800/80">
                    {(prod.features || []).slice(0, 3).map((feat, i) => (
                      <div key={i} className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Price & Action Buttons */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-base font-bold text-white font-mono">
                        {prod.price} {prod.currency}
                      </span>
                      {prod.originalPrice && (
                        <span className="text-xs text-slate-500 line-through ms-2 font-mono">
                          {prod.originalPrice} {prod.currency}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                        title="تعديل المنتج"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModalProduct(prod)}
                        className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 transition"
                        title="حذف المنتج"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <ShoppingBag className="h-5 w-5 text-emerald-400" />
                <span>{editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للكتالوج'}</span>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* Product Names */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الاسم باللغة العربية (إلزامي):</label>
                  <input
                    type="text"
                    required
                    value={formData.arabicName}
                    onChange={(e) => setFormData({ ...formData, arabicName: e.target.value })}
                    placeholder="مثال: سماعات نكسو برو اللاسلكية..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الاسم باللغة العبرية (إن وجد):</label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.hebrewName}
                    onChange={(e) => setFormData({ ...formData, hebrewName: e.target.value })}
                    placeholder="مثال: אוזניות אלחוטיות NEXO..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">رمز المنتج (SKU):</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="NX-SND-X1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">القسم / التصنيف:</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="إلكترونيات، ساعات، ملحقات..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">العملة الرسمية:</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ILS">ILS (شيكل ₪)</option>
                    <option value="USD">USD ($)</option>
                    <option value="JOD">JOD (دينار)</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="block text-emerald-400 font-bold mb-1">السعر الحالي (ILS):</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="349"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">السعر قبل الخصم (اختياري):</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="449"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">الكمية بالمخزون:</label>
                  <input
                    type="number"
                    min={0}
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="25"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-slate-600"
                  />
                </div>

                <div className="flex flex-col justify-center pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.inStock}
                      onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
                      className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-200">متوفر للطلب</span>
                  </label>
                </div>
              </div>

              {/* Multiple Categorized Images Studio */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold text-sm text-white">استوديو صور المنتج وتصنيفاتها الذكية</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                        {formData.categorizedImages.length} صور
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      ارفع صوراً متعددة بدون حدود، وصنفها (رئيسية، ألعاب، يدات تحكم، ملحقات، مواصفات) ليختار الذكاء الاصطناعي الصورة المطابقة لسؤال العميل ويرسلها بدون أي كتابة تحتها.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      multiple
                      onChange={handleMultiImageFiles}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-md shadow-emerald-950/40"
                    >
                      {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span>{uploadingImage ? 'جارٍ رفع الصور...' : 'رفع صور متعددة'}</span>
                    </button>
                  </div>
                </div>

                {/* Upload limits notice */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
                  <span>💡 الحد الآمن لحجم الصورة 10 ميجابايت، ويتم حفظ الصور بشكل دائم على الخادم.</span>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-emerald-400 font-mono">
                      {formData.categorizedImages.filter((i) => i.category === 'main').length} رئيسية
                    </span>
                    <span>•</span>
                    <span className="text-purple-400 font-mono">
                      {formData.categorizedImages.filter((i) => i.category === 'games').length} ألعاب
                    </span>
                    <span>•</span>
                    <span className="text-blue-400 font-mono">
                      {formData.categorizedImages.filter((i) => i.category === 'controllers').length} يدات
                    </span>
                    <span>•</span>
                    <span className="text-amber-400 font-mono">
                      {formData.categorizedImages.filter((i) => i.category === 'accessories').length} ملحقات
                    </span>
                  </div>
                </div>

                {/* List of Categorized Images */}
                <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                  {formData.categorizedImages.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      لم يتم إضافة صور للمنتج بعد. انقر على «رفع صور متعددة» أو أضف رابط صورة بالأسفل.
                    </div>
                  ) : (
                    formData.categorizedImages.map((img, idx) => {
                      const catOption =
                        IMAGE_CATEGORY_OPTIONS.find((c) => c.id === img.category) ||
                        IMAGE_CATEGORY_OPTIONS[0];

                      return (
                        <div
                          key={img.id || idx}
                          className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-center gap-3 transition ${
                            img.category === 'main'
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-slate-900/70 border-slate-800'
                          }`}
                        >
                          {/* Image Thumbnail with Main Star */}
                          <div className="relative h-16 w-16 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 group">
                            <img
                              src={img.url}
                              alt={img.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80';
                              }}
                            />
                            {img.category === 'main' && (
                              <div
                                title="الصورة الرئيسية للمنتج"
                                className="absolute top-1 start-1 p-0.5 rounded bg-emerald-500 text-slate-950 shadow"
                              >
                                <Star className="h-3 w-3 fill-slate-950" />
                              </div>
                            )}
                          </div>

                          {/* Editable Info: Title and Category Dropdown */}
                          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">اسم الصورة / العنوان المخصص:</label>
                              <input
                                type="text"
                                value={img.title}
                                onChange={(e) => handleUpdateImage(idx, { title: e.target.value })}
                                placeholder="اسم مخصص للصورة (مثل: صورة ألعاب PS5 أو يد تحكم بيضاء)..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">التصنيف الذكي:</label>
                              <select
                                value={img.category}
                                onChange={(e) =>
                                  handleUpdateImage(idx, {
                                    category: e.target.value as ProductImageCategory,
                                  })
                                }
                                className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none ${catOption.badgeText} border-slate-800`}
                              >
                                {IMAGE_CATEGORY_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id} className="bg-slate-950 text-slate-200">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Action Buttons: Main, Reorder, Delete */}
                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                            {img.category !== 'main' && (
                              <button
                                type="button"
                                onClick={() => handleSetAsMain(idx)}
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 border border-slate-700 text-[11px] text-slate-300 font-medium transition flex items-center gap-1"
                                title="تعيين كصورة رئيسية"
                              >
                                <Star className="h-3 w-3" />
                                <span>كرئيسية</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition"
                              title="تحريك لأعلى"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, 'down')}
                              disabled={idx === formData.categorizedImages.length - 1}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition"
                              title="تحريك لأسفل"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteImage(idx)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition"
                              title="حذف هذه الصورة"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Image by URL Bar */}
                <div className="pt-2 border-t border-slate-850">
                  <div className="text-[11px] text-slate-400 font-semibold mb-1">أو إضافة صورة برابط مباشر (URL):</div>
                  <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://... رابط الصورة"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
                    />
                    <input
                      type="text"
                      value={newImageTitle}
                      onChange={(e) => setNewImageTitle(e.target.value)}
                      placeholder="عنوان الصورة (اختياري)"
                      className="w-full sm:w-40 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <select
                      value={newImageCategory}
                      onChange={(e) => setNewImageCategory(e.target.value as ProductImageCategory)}
                      className="w-full sm:w-36 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                    >
                      {IMAGE_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id} className="bg-slate-950">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (newImageUrl.trim()) {
                          handleAddExternalImageUrl(newImageUrl, newImageTitle, newImageCategory);
                          setNewImageUrl('');
                          setNewImageTitle('');
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">وصف المنتج:</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تسويقي للمنتج يبين المزايا والمواصفات..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Features Builder */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">المميزات والمواصفات الرئيسية:</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newFeatureInput}
                    onChange={(e) => setNewFeatureInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddFeature();
                      }
                    }}
                    placeholder="أدخل ميزة (مثال: عزل ضوضاء ANC 40dB) واضغط إضافة..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    إضافة ميزة
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {formData.features.map((feat, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-[11px] flex items-center gap-1.5"
                    >
                      <span>{feat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-950"
                >
                  {savingProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>{savingProduct ? 'جارٍ الحفظ...' : editingProduct ? 'تحديث المنتج' : 'حفظ المنتج الجديد'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400 font-bold text-base">
              <AlertTriangle className="h-5 w-5" />
              <span>تأكيد حذف المنتج</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من حذف المنتج <strong>"{deleteModalProduct.arabicName}"</strong> (رمز {deleteModalProduct.sku}) من الكتالوج؟
              لن يقدمه Gemini للعملاء في المحادثات اللاحقة.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>{deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
