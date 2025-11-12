/**
 * js/app.js
 * تهيئة التطبيق وإدارة المصادقة وحماية المسارات.
 * يعتمد على ملف firebase-config.js لبيانات التهيئة.
 */


document.addEventListener('DOMContentLoaded', () => {
    
    // الاستماع لحالة المصادقة
    auth.onAuthStateChanged((user) => {
        
        const currentPath = window.location.pathname;
                
        if (user) {
            // المستخدم مسجل الدخول
            
            // التعامل مع الانتقال من صفحة المصادقة
            if (currentPath.includes('auth.html') || currentPath.includes('index.html')) {
                window.location.href = 'dashboard.html';
            } 
            
            // ************ التحديث هنا ************
            else if (currentPath.includes('onboarding.html')) {
                // تمرير بيانات المستخدم إلى صفحة Onboarding لبدء التحديث
                if (typeof window.loadOnboardingData === 'function') {
                    window.loadOnboardingData(user);
                }
            }
            // ************ نهاية التحديث ************
            
            // تحميل بيانات لوحة التحكم
            else if (currentPath.includes('dashboard.html')) {
                if (typeof window.loadDashboardData === 'function') {
                    window.loadDashboardData(user);
                }
            }
            
        } else {
// ...
            // المستخدم غير مسجل الدخول
            
            // حماية الصفحات (لوحة التحكم، المهام، إلخ)
            if (currentPath.includes('dashboard.html') || currentPath.includes('earn.html')) {
                window.location.href = 'auth.html';
            }
        }
    });

});


// دالة عامة لتسجيل الخروج، متاحة لأي زر logout في التطبيق
window.logout = function() {
    auth.signOut()
        .then(() => {
            // التوجيه لصفحة المصادقة
            window.location.href = 'auth.html';
        })
        .catch((error) => {
            alert("Error signing out: " + error.message);
        });
};