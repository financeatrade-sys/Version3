// ========================================================
// data/countries.js - قائمة الدول الكاملة
// ملاحظة: هذا مجرد مقتطف يمثل الهيكل، سيحتوي الكود الفعلي على قائمة كاملة.
// ========================================================

const countryList = [
    { code: "AE", name: "United Arab Emirates", name_ar: "الإمارات العربية المتحدة" },
    { code: "SA", name: "Saudi Arabia", name_ar: "المملكة العربية السعودية" },
    { code: "EG", name: "Egypt", name_ar: "مصر" },
    { code: "US", name: "United States", name_ar: "الولايات المتحدة" },
    { code: "UK", name: "United Kingdom", name_ar: "المملكة المتحدة" },
    { code: "TR", name: "Turkey", name_ar: "تركيا" },
    // ... (هنا ستستمر القائمة الكاملة)
    { code: "QA", name: "Qatar", name_ar: "قطر" },
];

// تصدير القائمة للاستخدام في ملفات JS الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = countryList;
}