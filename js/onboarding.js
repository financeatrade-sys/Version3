// =================================================================
// js/onboarding.js - Logic for Profile Completion and Initial Bonus (FINAL)
// يتضمن التعديلات لحقول قاعدة بياناتك
// =================================================================

// مكافأة البداية (تُضاف عند إكمال الملف الشخصي)
const START_BONUS = 100;

// متغير عالمي مؤقت لتخزين بيانات المستخدم الحالي
let currentUser = null; 

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. جلب العناصر الأساسية داخل نطاق DOMContentLoaded لضمان وجودها
    const onboardingForm = document.getElementById('onboarding-form');
    const countrySelect = document.getElementById('country');
    const submitBtn = document.getElementById('onboarding-submit-btn');
    const errorDisplay = document.getElementById('onboarding-error');
    const referralInput = document.getElementById('referralCode');
    
    // تأكد من وجود النموذج قبل المتابعة
    if (!onboardingForm) return;

    // 2. دوال مساعدة
    function displayError(message) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    function populateCountries() {
        // countryList مفترض أنها متاحة من data/countries.js
        if (typeof countryList !== 'undefined' && countryList.length > 0) {
             const defaultOption = document.createElement('option');
            defaultOption.textContent = "Select Your Country";
            defaultOption.value = "";
            countrySelect.appendChild(defaultOption);
            
            countryList.forEach(country => {
                const option = document.createElement('option');
                option.value = country.name; // 💥 حفظ الاسم الكامل للدولة
                option.textContent = country.name_ar; // العرض باللغة العربية
                countrySelect.appendChild(option);
            });
        } else {
            console.error("countryList is not defined or empty. Check data/countries.js.");
        }
    }

    // 3. التحقق من اسم المستخدم في Firestore
    async function checkUsernameAvailability(username) {
        // التحقق من أن اسم المستخدم فريد (لا يملكه أي مستخدم آخر)
        const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
        return snapshot.empty;
    }

    // 4. معالجة إرسال النموذج
    onboardingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) {
            displayError("Authentication error. Please sign in again.");
            return;
        }

        submitBtn.disabled = true;
        errorDisplay.classList.add('hidden');

        const username = document.getElementById('username').value.trim();
        const countryName = countrySelect.value;
        const referralCode = referralInput.value.trim() || null; // إذا كان فارغاً يكون null

        // 4.1 التحقق من توافر اسم المستخدم
        if (!(await checkUsernameAvailability(username))) {
            displayError("This username is already taken. Please choose another one.");
            submitBtn.disabled = false;
            return;
        }

        try {
            // 5. تحديث Firestore ببيانات الملف الشخصي والمكافأة
            await db.collection('users').doc(currentUser.uid).update({ 
                // البيانات التي أدخلها المستخدم (المتبقية)
                username: username,
                country: countryName,
                
                // تحديث المكافأة وحالة الاكتمال
                balance: firebase.firestore.FieldValue.increment(START_BONUS), // إضافة المكافأة إلى الرصيد
                isProfileComplete: true,
                onboardingCompleted: true,
                
                // تحديث اسم العرض الخاص بـ Firebase Auth
                displayName: username, 
                
                // إضافة كود الإحالة يدوياً إذا لم يكن موجوداً من قبل (لكننا اعتمدنا على حفظه في auth.js)
                // إذا تم إدخال كود يدوياً، يمكن تحديث حقل referredBy هنا إذا كان null، ولكن يفضل تركه كما حفظه auth.js.

            });

            // 6. التوجيه النهائي
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error("Onboarding submission failed:", error);
            displayError("Error saving profile: " + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // 7. تهيئة الصفحة عند التحميل
    populateCountries();
    
    // قراءة كود الإحالة من الرابط (إذا كان المستخدم قد جاء من رابط إحالة)
    // لا نحتاج لهذه الوظيفة هنا حيث تم حفظها في حقل referredBy في auth.js عند التسجيل بجوجل.
    // لكننا سنتركها لتمكين المستخدم من إدخال كود جديد يدوياً في حال كانت خانة referredBy فارغة في قاعدة البيانات.
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ref') && urlParams.get('ref') !== 'null') {
         referralInput.value = urlParams.get('ref');
         referralInput.readOnly = true;
    }
});


// 💥 الوظيفة التي يتم استدعاؤها من app.js بعد المصادقة
if (typeof window.loadOnboardingData !== 'function') {
    window.loadOnboardingData = async (user) => {
        currentUser = user; 
        
        // التحقق من أن المستخدم يجب أن يكون هنا (لم يكمل التأهيل بعد)
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (userDoc.exists && userDoc.data().onboardingCompleted) {
            // التوجيه التلقائي للمستخدمين الذين أكملوا التأهيل
            window.location.href = 'dashboard.html';
            return;
        }
        
        // إذا كان اسم المستخدم متاحاً من قبل (نادر)، يتم ملء الحقل به
        const usernameInput = document.getElementById('username');
        if (userDoc.exists && userDoc.data().username && usernameInput) {
            usernameInput.value = userDoc.data().username;
        }
    };
}