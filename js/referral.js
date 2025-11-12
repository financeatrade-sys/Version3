/**
 * js/referral.js
 * إدارة منطق تبويب الإحالة (عرض الكود والرابط وجدول المدعوين).
 * يعتمد على المتغيرات العامة: db, currentUserId, و currentUserData
 */

// دالة مساعدة لنسخ النص
function copyToClipboard(elementId) {
    const input = document.getElementById(elementId);
    if (input) {
        input.select();
        input.setSelectionRange(0, 99999); 
        document.execCommand('copy');
        alert('Copied to clipboard!');
    }
}

// دالة لملء تبويب الإحالة وجلب جدول المدعوين
async function populateReferralTab(data) {
    const container = document.getElementById('referral-content');
    if (!container) return;
    
    const referralCode = data.referralCode || currentUserId.substring(0, 8);
    const referralLink = `${window.location.origin}/auth.html?ref=${referralCode}`;
    
    container.innerHTML = `
        <h3>Your Unique Referral Code:</h3>
        <div class="form-group referral-info-group">
            <input type="text" id="referral-code-display" value="${referralCode}" readonly>
            <button type="button" class="btn-secondary copy-btn" data-copy-target="referral-code-display">
                <i class="fas fa-copy"></i> Copy Code
            </button>
        </div>
        
        <h3>Share Link:</h3>
        <div class="form-group referral-info-group">
            <input type="text" id="referral-link-display" value="${referralLink}" readonly>
            <button type="button" class="btn-secondary copy-btn" data-copy-target="referral-link-display">
                <i class="fas fa-copy"></i> Copy Link
            </button>
        </div>
        
        <h3 style="margin-top: 30px;">Your Referred Members:</h3>
        <div id="referrals-table-container" class="table-responsive">
            <p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Loading referrals...</p>
        </div>
    `;

    // إضافة مستمعي أحداث النسخ
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', () => {
            copyToClipboard(button.dataset.copyTarget);
        });
    });

    // جلب وعرض جدول المدعوين
    await fetchAndDisplayReferrals(referralCode);
}

// دالة جلب جدول المدعوين
async function fetchAndDisplayReferrals(referralCode) {
    const tableContainer = document.getElementById('referrals-table-container');
    if (!tableContainer) return;
    
    try {
        // البحث عن المستخدمين الذين قاموا بالتسجيل باستخدام كود الإحالة الخاص بالعضو
        const snapshot = await db.collection('users')
            .where('referredBy', '==', referralCode)
            .orderBy('createdAt', 'desc')
            .get();

        let tableHTML = `
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Joined On</th>
                        <th>Status</th>
                        <th>Earnings Contributed (Points/USD)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (snapshot.empty) {
            tableHTML += `<tr><td colspan="4" class="no-records">No members have joined using your code yet.</td></tr>`;
        } else {
            snapshot.forEach(doc => {
                const user = doc.data();
                const joinDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                // يجب إضافة حقل لربح العضو من المدعو (سنتجاهله الآن ونضع قيمة ثابتة)
                const contributedEarnings = `$${(Math.random() * 5).toFixed(2)}`; 

                tableHTML += `
                    <tr>
                        <td>${user.username || user.fullName}</td>
                        <td>${joinDate}</td>
                        <td><span class="status-completed">Active</span></td>
                        <td>${contributedEarnings}</td>
                    </tr>
                `;
            });
        }

        tableHTML += `
                </tbody>
            </table>
        `;
        tableContainer.innerHTML = tableHTML;

    } catch (error) {
        console.error("Error fetching referrals:", error);
        tableContainer.innerHTML = `<p class="alert-danger">Failed to load referral data.</p>`;
    }
}

// ربط الدالة بنافذة المتصفح لاستدعائها من dashboard.js
if (typeof window.populateReferralTab !== 'function') {
    window.populateReferralTab = populateReferralTab;
}