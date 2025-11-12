// =================================================================
// js/onboarding.js - Logic for Profile Completion and Initial Bonus (FINAL)
// يتضمن التعديلات لحقول قاعدة بياناتك
// =================================================================

// مكافأة البداية (تُضاف عند إكمال الملف الشخصي)
const START_BONUS = 100;

// متغير عالمي مؤقت لتخزين بيانات المستخدم الحالي
let currentUserId = null;

// دالة مساعدة لعرض الرسائل
function displayOnboardingMessage(message, isError = false) {
    const el = document.getElementById('onboarding-status');
    if (el) {
        el.textContent = message;
        el.classList.remove('hidden', 'alert-success', 'alert-danger');
        el.classList.add(isError ? 'alert-danger' : 'alert-success');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    const onboardingForm = document.getElementById('onboarding-form');
    
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 🚨 التحقق من وجود UID هنا
            if (!currentUserId) {
                displayOnboardingMessage("Authentication error. Please sign in again.", true);
                window.location.href = 'auth.html'; // التوجيه لتسجيل الدخول مرة أخرى
                return;
            }

            const username = document.getElementById('username').value.trim();
            const country = document.getElementById('country').value.trim();
            const fullName = document.getElementById('full-name').value.trim();
            
            const submitBtn = onboardingForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            displayOnboardingMessage("", false); 

            try {
                // 1. التحقق من توافر اسم المستخدم
                const usernameExists = await db.collection('users').where('username', '==', username).limit(1).get();
                if (!usernameExists.empty) {
                     displayOnboardingMessage(`Username "${username}" is already taken.`, true);
                     submitBtn.disabled = false;
                     return;
                }
                
                // 2. إنشاء كود الإحالة (بناءً على أول 8 أحرف من الـ UID)
                const referralCode = currentUserId.substring(0, 8);

                // 3. تحديث بيانات المستخدم في Firestore
                await db.collection('users').doc(currentUserId).update({
                    username: username,
                    fullName: fullName,
                    country: country,
                    onboardingCompleted: true, // علامة اكتمال التأهيل
                    referralCode: referralCode, // حفظ كود الإحالة
                    // التأكد من تهيئة الأرصدة إذا لم يتم تهيئتها بعد
                    balance: firebase.firestore.FieldValue.serverTimestamp() || 0,
                    points: firebase.firestore.FieldValue.serverTimestamp() || 0,
                    pointsPendingPool: firebase.firestore.FieldValue.serverTimestamp() || 0
                });

                displayOnboardingMessage('Data saved successfully! Redirecting to dashboard...', false);
                
                // التوجيه إلى لوحة التحكم بعد نجاح الحفظ
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);

            } catch (error) {
                console.error("Onboarding data save failed:", error);
                displayOnboardingMessage('Failed to save data. Try again or contact support.', true);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
});

// **************************************************
// 🚨 الدالة الجديدة التي يستدعيها app.js 
// **************************************************
if (typeof window.loadOnboardingData !== 'function') {
    window.loadOnboardingData = (user) => {
        if (user && user.uid) {
            currentUserId = user.uid; // حفظ الـ UID لاستخدامه عند الضغط على Save
            console.log("Onboarding loaded for UID:", user.uid);
            // قد ترغب هنا في ملء حقول مثل الإيميل إذا لزم الأمر
        } else {
            // توجيه المستخدم إذا لم يكن هناك بيانات
            window.location.href = 'auth.html';
        }
    };
}