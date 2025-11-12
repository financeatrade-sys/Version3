/**
 * js/dashboard.js
 * المنسق الرئيسي (Orchestrator) لصفحة لوحة التحكم.
 * يدير: التبديل بين التبويبات، حماية الصفحة، جلب البيانات الأساسية،
 * وربط الدوال الخاصة بتبويبات (Wallet, Profile, Referral).
 */

// متغيرات عامة لحفظ بيانات المستخدم واستخدامها في كل التبويبات المفصولة
let currentUserId = null; 
let currentUserData = {}; 

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. جلب العناصر الأساسية (التهيئة)
    const tabButtons = document.querySelectorAll('.tabs-navigation .tab-button');
    const tabPanes = document.querySelectorAll('.tabs-content .tab-pane');
    const userDisplayNameEl = document.getElementById('user-display-name');
    
    // ===============================================
    // 2. منطق التبديل بين التبويبات (Tab Switching Logic)
    // ===============================================
    
    function switchTab(targetTabId) {
        // 1. إلغاء تفعيل الزر النشط وإخفاء جميع الأقسام
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.add('hidden'));

        // 2. تفعيل الزر الذي تم النقر عليه
        const activeBtn = document.querySelector(`.tab-button[data-tab="${targetTabId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // 3. إظهار القسم المستهدف
        const targetPane = document.getElementById(targetTabId);
        if (targetPane) {
            targetPane.classList.remove('hidden');
        }
    }
    
    // إضافة مستمعي الأحداث لأزرار التبويبات
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });
    
    // تفعيل التبويب الافتراضي عند التحميل الأولي
    switchTab('overview');

    // ===============================================
    // 3. دوال مساعدة عامة للربط بين الملفات
    // ===============================================
    
    // دالة لتحديث رسالة الترحيب في الهيدر (يتم استدعاؤها من profile.js)
    if (typeof window.refreshDashboardHeader !== 'function') {
        window.refreshDashboardHeader = () => {
             const displayName = currentUserData.username || currentUserData.fullName || "User";
             if (userDisplayNameEl) {
                 userDisplayNameEl.textContent = displayName;
             }
        };
    }

    // ===============================================
    // 4. منطق جلب وعرض البيانات (Data Fetching Logic)
    // ===============================================
    
    // دالة لجلب وعرض بيانات المستخدم من Firestore
    async function fetchAndDisplayUserData(user) {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        currentUserId = user.uid;

        try {
            const doc = await db.collection('users').doc(user.uid).get();

            if (doc.exists) {
                const data = doc.data();
                currentUserData = data; // حفظ البيانات عالمياً
                
                // حماية التأهيل
                if (!data.onboardingCompleted) {
                    window.location.href = 'onboarding.html';
                    return;
                }
                
                // 4.1 تحديث رسالة الترحيب
                window.refreshDashboardHeader(); 

                // 4.2 تحديث بطاقات المقاييس (Overview Metrics)
                
                const usdBalance = parseFloat(data.balance || 0).toFixed(2);
                document.getElementById('balance-usd').textContent = `$${usdBalance}`;

                const pointsBalance = parseInt(data.points || 0).toLocaleString();
                document.getElementById('balance-points').textContent = pointsBalance;

                const pendingPoints = parseInt(data.pointsPendingPool || 0).toLocaleString();
                document.getElementById('points-pending-pool').textContent = pendingPoints;
                
                document.getElementById('prime-level').textContent = data.primeLevel || 0;

                // 4.3 ملء تبويبات Wallet, Profile, و Referral (باستدعاء الدوال الخارجية)
                if (typeof window.loadWalletData === 'function') {
                    window.loadWalletData();
                }
                if (typeof window.populateProfileTab === 'function') {
                    window.populateProfileTab(data);
                }
                if (typeof window.populateReferralTab === 'function') {
                    window.populateReferralTab(data);
                }
                
                // التأكد من تفعيل التبويب الافتراضي بعد تحميل البيانات
                switchTab('overview');
                
            } else {
                console.error("User data not found in Firestore.");
                window.location.href = 'onboarding.html';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    // ===============================================
    // 5. وظيفة الـ App.js Callback (للحماية والمزامنة)
    // ===============================================
    
    // وظيفة عامة يستدعيها app.js بعد المصادقة الناجحة
    if (typeof window.loadDashboardData !== 'function') {
        window.loadDashboardData = async (user) => {
            if (user) {
                fetchAndDisplayUserData(user);
            } else {
                // إذا لم يكن المستخدم مسجل الدخول، يتم التوجيه إلى صفحة Auth
                window.location.href = 'auth.html';
            }
        };
    }
});