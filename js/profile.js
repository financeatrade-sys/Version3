/**
 * js/profile.js
 * إدارة منطق تبويب الملف الشخصي (عرض وتعديل البيانات).
 * يعتمد على المتغيرات العامة: db, currentUserId, و currentUserData
 */

// دالة لملء وعرض البيانات الشخصية
function populateProfileTab(data) {
    const container = document.getElementById('profile-details-container');
    if (!container) return;

    // بناء حقول النموذج
    container.innerHTML = `
        <div class="form-group">
            <label>Full Name:</label>
            <input type="text" value="${data.fullName || 'N/A'}" readonly>
        </div>
        <div class="form-group">
            <label for="profile-username">Username:</label>
            <input type="text" id="profile-username" value="${data.username || ''}" required>
            <small class="form-hint">Your unique username (can be updated).</small>
        </div>
        <div class="form-group">
            <label>Email:</label>
            <input type="email" value="${data.email || 'N/A'}" readonly>
            <small class="form-hint sensitive">Email cannot be changed.</small>
        </div>
        <div class="form-group">
            <label>Country:</label>
            <input type="text" value="${data.country || 'N/A'}" readonly>
        </div>
        <div class="form-group">
            <label>Joined Since:</label>
            <input type="text" value="${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}" readonly>
        </div>
    `;
    document.getElementById('update-profile-btn').disabled = false;
}

// دالة لمعالجة تحديث الملف الشخصي
document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!currentUserId) return displayWalletMessage('profile-status', 'Authentication error.', true);

            const newUsername = document.getElementById('profile-username').value.trim();
            const submitBtn = document.getElementById('update-profile-btn');
            
            submitBtn.disabled = true;
            displayWalletMessage('profile-status', '', false); 

            // تحقق بسيط من أن اسم المستخدم الجديد مختلف وغير فارغ
            if (newUsername === currentUserData.username) {
                 displayWalletMessage('profile-status', 'Username is the same. No changes saved.', true);
                 submitBtn.disabled = false;
                 return;
            }
            if (newUsername.length < 3) {
                 displayWalletMessage('profile-status', 'Username must be at least 3 characters.', true);
                 submitBtn.disabled = false;
                 return;
            }

            try {
                // 1. التحقق من توافر اسم المستخدم الجديد
                const usernameExists = await db.collection('users').where('username', '==', newUsername).limit(1).get();
                if (!usernameExists.empty) {
                     displayWalletMessage('profile-status', `Username "${newUsername}" is already taken.`, true);
                     submitBtn.disabled = false;
                     return;
                }

                // 2. تحديث البيانات في Firestore
                await db.collection('users').doc(currentUserId).update({
                    username: newUsername
                });
                
                // 3. تحديث البيانات محلياً (ضروري لتحديث شريط الترحيب)
                currentUserData.username = newUsername; 
                
                // 4. استدعاء وظيفة عامة لتحديث الـ Dashboard Header (سيتم تعريفها في dashboard.js)
                if (typeof window.refreshDashboardHeader === 'function') {
                    window.refreshDashboardHeader();
                }

                displayWalletMessage('profile-status', 'Profile updated successfully!', false);

            } catch (error) {
                console.error("Profile update failed:", error);
                displayWalletMessage('profile-status', 'Failed to update profile. Please try again.', true);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
});

// ربط الدالة بنافذة المتصفح لاستدعائها من dashboard.js
if (typeof window.populateProfileTab !== 'function') {
    window.populateProfileTab = populateProfileTab;
}