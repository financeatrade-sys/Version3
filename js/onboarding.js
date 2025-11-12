/**
 * js/onboarding.js - Logic for Profile Completion and Initial Bonus (FINAL)
 * يتضمن التعديلات لحقول قاعدة بياناتك
 * تمت إضافة حقول: fullName، createdAt، balance، points، pointsPendingPool
 */

// مكافأة البداية (تُضاف عند إكمال الملف الشخصي)
const START_BONUS = 100;

// متغير عالمي مؤقت لتخزين بيانات المستخدم الحالي (يتم تعيينه بواسطة app.js)
let currentUser = null; 

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. جلب العناصر الأساسية
    const onboardingForm = document.getElementById('onboarding-form');
    // 🚨 تأكد من وجود حقل fullName في HTML (يحتمل أن يكون null)
    const fullNameInput = document.getElementById('full-name');
    const countrySelect = document.getElementById('country');
    const submitBtn = document.getElementById('onboarding-submit-btn');
    const errorDisplay = document.getElementById('onboarding-error');
    const referralInput = document.getElementById('referralCode');
    const usernameInput = document.getElementById('username');
    
    if (!onboardingForm) return;

    // 2. دوال مساعدة
    function displayError(message) {
        errorDisplay.textContent = message;
        errorDisplay.classList.remove('hidden');
    }

    // دالة مساعدة مفترضة لجلب الدول (يجب أن يكون countryList متاحًا عالميًا)
    function populateCountries() {
        if (typeof countryList !== 'undefined' && countryList.length > 0) {
             const defaultOption = document.createElement('option');
            defaultOption.textContent = "Select Your Country";
            defaultOption.value = "";
            countrySelect.appendChild(defaultOption);
            
            countryList.forEach(country => {
                const option = document.createElement('option');
                option.value = country.name; 
                option.textContent = country.name; 
                countrySelect.appendChild(option);
            });
        } else {
            console.error("countryList is not defined or empty. Check data/countries.js.");
        }
    }

    // 3. التحقق من اسم المستخدم في Firestore
    async function checkUsernameAvailability(username) {
        // إذا كان المستخدم يحاول استخدام نفس اسم المستخدم القديم، لا داعي للتحقق
        if (currentUser && currentUser.username === username) return true;
        
        const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
        // snapshot.empty تعني أن اسم المستخدم فريد
        return snapshot.empty;
    }

    // 4. معالجة إرسال النموذج
    onboardingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 🚨 يجب أن يكون currentUser هو UserCredential من Firebase
        if (!currentUser || !currentUser.uid) {
            displayError("Authentication error. Please sign in again.");
            setTimeout(() => { window.location.href = 'auth.html'; }, 1000);
            return;
        }

        submitBtn.disabled = true;
        errorDisplay.classList.add('hidden');

        // 🎯 التعديل الرئيسي لحل مشكلة TypeError:
        // إذا كان حقل الإدخال موجودًا (ليس null)، خذ قيمته.
        // إذا كان مفقودًا (null)، خذ اسم العرض من بيانات جوجل (currentUser).
        const username = usernameInput ? usernameInput.value.trim() : '';
        const fullName = fullNameInput 
            ? fullNameInput.value.trim() 
            : (currentUser.displayName || ''); // القيمة البديلة من Google Auth
            
        const countryName = countrySelect ? countrySelect.value : '';
        const enteredReferralCode = referralInput ? referralInput.value.trim() : null; // كود تم إدخاله يدوياً

        // 4.1 التحقق من البيانات المطلوبة
        // نغير الشرط الخاص بالاسم الكامل قليلاً ليسمح بالأسماء التي تم جلبها من جوجل
        if (username.length < 3 || fullName.length < 5 || countryName === "") {
             displayError('Please enter a full name (min 5 chars), username (min 3 chars), and select a country.');
             submitBtn.disabled = false;
             return;
        }


        // 4.2 التحقق من توافر اسم المستخدم
        if (!(await checkUsernameAvailability(username))) {
            displayError("This username is already taken. Please choose another one.");
            submitBtn.disabled = false;
            return;
        }
        
        // 4.3 إنشاء كود الإحالة الخاص بالمستخدم
        const userReferralCode = currentUser.uid.substring(0, 8);


        try {
            // 5. تحديث Firestore ببيانات الملف الشخصي والمكافأة
            
            // تهيئة الحقول (للتأكد من أنها موجودة)
            const updateData = {
                // البيانات التي أدخلها المستخدم (أو تم جلبها من جوجل)
                username: username,
                fullName: fullName, 
                country: countryName,
                
                // حالة الاكتمال والمكافأة
                balance: firebase.firestore.FieldValue.increment(START_BONUS), 
                isProfileComplete: true,
                onboardingCompleted: true,
                
                // حقول التهيئة الإضافية (مهمة لـ dashboard.js)
                points: 0,
                pointsPendingPool: 0,
                primeLevel: 0,
                referralCode: userReferralCode, // كود الإحالة الخاص به
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                
                // تحديث اسم العرض الخاص بـ Firebase Auth
                displayName: username,
            };
            
            // 🚨 منطق الإحالة: إذا كان هناك كود مدخل يدوياً، يتم إضافته إلى referredBy
            const userDocCheck = await db.collection('users').doc(currentUser.uid).get();
            if (enteredReferralCode && userDocCheck.exists && !userDocCheck.data().referredBy) {
                 updateData.referredBy = enteredReferralCode;
            }

            // نستخدم set مع merge: true لضمان إنشاء المستند إذا لم يكن موجوداً
			await db.collection('users').doc(currentUser.uid).set(updateData, { merge: true });

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
    const urlParams = new URLSearchParams(window.location.search);
    const urlReferralCode = urlParams.get('ref');

    if (urlReferralCode && urlReferralCode !== 'null') {
         referralInput.value = urlReferralCode;
         referralInput.readOnly = true;
    }
});


// 💥 الوظيفة التي يتم استدعاؤها من app.js بعد المصادقة
if (typeof window.loadOnboardingData !== 'function') {
    window.loadOnboardingData = async (user) => {
        currentUser = user; 
        
        // 1. التحقق من أن المستخدم يجب أن يكون هنا
        const userDoc = await db.collection('users').doc(user.uid).get();
        const data = userDoc.exists ? userDoc.data() : {};

        if (data.onboardingCompleted) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // 2. ملء الحقول المتاحة
        const usernameInput = document.getElementById('username');
        const fullNameInput = document.getElementById('full-name');
        
        // ملء اسم المستخدم إذا كان متاحاً في قاعدة البيانات
        if (data.username && usernameInput) {
            usernameInput.value = data.username;
        }
        
        // ملء الاسم الكامل من Google Auth أو من قاعدة البيانات
        if (fullNameInput) {
            fullNameInput.value = user.displayName || data.fullName || '';
        }
        
        // ملء الإيميل (يفترض أنه للقراءة فقط)
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = user.email || '';
        }
        
        // إذا كان هناك كود إحالة في الرابط، يتم حفظه مؤقتاً في referredBy (إذا لم يكن موجوداً)
        const urlParams = new URLSearchParams(window.location.search);
        const urlReferralCode = urlParams.get('ref');

        if (urlReferralCode && !data.referredBy) {
             await db.collection('users').doc(user.uid).set({
                 referredBy: urlReferralCode,
             }, { merge: true });
             
             // ملء حقل الإحالة
             const referralInput = document.getElementById('referralCode');
             if(referralInput) referralInput.value = urlReferralCode;
        }
    };
}
