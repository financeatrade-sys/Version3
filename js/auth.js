// =================================================================
// js/auth.js - Logic for Login and Registration (FINAL & CORRECTED)
// يضمن تحميل قائمة الدول ويعمل مع هيكل قاعدة البيانات المرسل
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. جلب العناصر الأساسية
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const googleAuthBtn = document.getElementById('google-auth-btn');
    const authError = document.getElementById('auth-error');
    const countrySelect = document.getElementById('country');
    const registerGroups = document.querySelectorAll('.register-group'); 
    const referralInput = document.getElementById('referralCode');

    let currentMode = 'login'; // 'login' or 'register'
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // 2. دوال مساعدة
    function displayError(message) {
        authError.textContent = message;
        authError.classList.remove('hidden');
    }

    function generateReferralCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    function handleFirebaseError(error) {
        let message = "An unknown error occurred.";
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = "This email is already associated with an account.";
                break;
            case 'auth/invalid-email':
                message = "The email address is not valid.";
                break;
            case 'auth/weak-password':
                message = "Password should be at least 6 characters.";
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message = "Invalid email or password.";
                break;
            default:
                console.error("Firebase Auth Error:", error);
                message = "Registration/Login failed. Please check your details.";
        }
        displayError(message);
    }
    
    // 3. قراءة رابط الإحالة
    function readReferralCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            referralInput.value = refCode;
            referralInput.readOnly = true; 
        }
    }
    
    // 4. ملء قائمة الدول المنسدلة (الحل لمشكلة الظهور)
    function populateCountries() {
        // تأكد من أن countryList متاح من data/countries.js
        if (typeof countryList !== 'undefined' && countryList.length > 0) {
            const defaultOption = document.createElement('option');
            defaultOption.textContent = "Select Your Country";
            defaultOption.value = "";
            countrySelect.appendChild(defaultOption);

            countryList.forEach(country => {
                const option = document.createElement('option');
                option.value = country.name; // حفظ الاسم الكامل للدولة
                option.textContent = country.name_ar; 
                countrySelect.appendChild(option);
            });
            countrySelect.setAttribute('required', 'required');
        } else {
             console.error("countryList is not defined or empty. Check data/countries.js.");
        }
    }

    // 5. تحديث واجهة المستخدم لوضع الدخول/التسجيل
    function updateModeUI() {
        const isRegister = currentMode === 'register';

        authTitle.textContent = isRegister ? 'Join Us - Register' : 'Welcome Back - Login';
        authSubmitBtn.textContent = isRegister ? 'Register' : 'Login';
        authSwitchLink.textContent = isRegister ? 'Login Here' : 'Register Here';
        authSwitchLink.closest('p').firstChild.textContent = isRegister ? "Already have an account? " : "Don't have an account? ";
        
        registerGroups.forEach(group => {
            group.style.display = isRegister ? 'block' : 'none';
        });
        
        document.querySelectorAll('#fullName, #username, #country').forEach(input => {
            if (isRegister) {
                input.setAttribute('required', 'required');
            } else {
                input.removeAttribute('required');
            }
        });

        authError.classList.add('hidden'); 
    }
    
    // 6. إنشاء ملف المستخدم في Firestore (التسجيل التقليدي)
    async function createUserProfile(user, data) {
        const uniqueReferralCode = generateReferralCode(); 
        
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            fullName: data.fullName,
            username: data.username,
            country: data.country, 
            
            referralCode: uniqueReferralCode, 
            referredBy: data.referralCode || null, 

            // حقول مالية وافتراضية
            balance: 0,
            points: 0,
            primeLevel: 0,
            stakedAmount: 0,
            reservedForOffers: 0,
            pointsPendingPool: 0,

            role: "user",
            isProfileComplete: true, 
            onboardingCompleted: true, 
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        window.location.href = 'dashboard.html';
    }

    // 7. معالجة إرسال النموذج (Email/Password)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        authSubmitBtn.disabled = true;
        authError.classList.add('hidden');

        try {
            if (currentMode === 'register') {
                const fullName = document.getElementById('fullName').value;
                const username = document.getElementById('username').value;
                const country = countrySelect.value;
                const referralCode = referralInput.value;
                
                // التحقق من توافر اسم المستخدم
                const usernameCheck = await db.collection('users').where('username', '==', username).limit(1).get();
                if (!usernameCheck.empty) {
                    displayError("This username is already taken.");
                    authSubmitBtn.disabled = false;
                    return;
                }

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await createUserProfile(userCredential.user, { fullName, username, country, referralCode });

            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }

        } catch (error) {
            handleFirebaseError(error);
        } finally {
            authSubmitBtn.disabled = false;
        }
    });
    
    // 8. معالجة التسجيل/الدخول عبر جوجل
    googleAuthBtn.addEventListener('click', async () => {
        try {
            const result = await auth.signInWithPopup(googleProvider);
            const user = result.user;
            const isNewUser = result.additionalUserInfo.isNewUser;
            
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (isNewUser || !userDoc.exists) {
                // مستخدم جديد: إنشاء ملف مبدئي وتوجيه إلى Onboarding
                
                const urlParams = new URLSearchParams(window.location.search);
                const refCodeFromURL = urlParams.get('ref') || null;
                const uniqueReferralCode = generateReferralCode(); 

                await db.collection('users').doc(user.uid).set({
                    uid: user.uid,
                    email: user.email,
                    fullName: user.displayName || null, 
                    
                    // بيانات Onboarding المتبقية:
                    username: null, 
                    country: null,
                    isProfileComplete: false, 
                    onboardingCompleted: false, 
                    
                    // حقول الإحالة والمحفظة
                    referralCode: uniqueReferralCode, 
                    referredBy: refCodeFromURL, 
                    balance: 0, points: 0, primeLevel: 0, stakedAmount: 0, 
                    reservedForOffers: 0, pointsPendingPool: 0,
                    role: "user",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

                window.location.href = `onboarding.html`; 
                
            } else {
                // مستخدم قديم
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            handleFirebaseError(error);
        }
    });
    
    // 9. معالجة رابط التبديل
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = currentMode === 'login' ? 'register' : 'login';
        updateModeUI();
    });

    // 10. الإجراءات عند تحميل الصفحة (تأكد من وجود هذه الاستدعاءات)
    readReferralCode();
    populateCountries(); // 👈 هذا هو السطر الذي يحل المشكلة
    updateModeUI();
});