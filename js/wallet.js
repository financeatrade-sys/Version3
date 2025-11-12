/**
 * js/wallet.js
 * إدارة منطق المحفظة (Deposit, Withdraw, Transfer, Add to Pool) وتاريخ العمليات.
 * يعتمد على المتغيرات العالمية: db, currentUserId, و currentUserData (من dashboard.js)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ===============================================
    // دوال مساعدة (Helper Functions)
    // ===============================================

    function displayWalletMessage(elementId, message, isError = false) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            el.classList.remove('hidden');
            el.className = isError ? 'alert-danger' : 'alert-success';
        }
    }
    
    // دالة لتحديث عرض الأرصدة في تبويب المحفظة بعد أي عملية
    function updateWalletBalancesDisplay() {
        const usdBalanceEl = document.getElementById('wallet-usd-balance');
        const pointsBalanceEl = document.getElementById('wallet-points-balance');

        if (usdBalanceEl) {
             const usdBalance = parseFloat(currentUserData.balance || 0).toFixed(2);
             usdBalanceEl.textContent = `$${usdBalance}`;
        }
        if (pointsBalanceEl) {
             const pointsBalance = parseInt(currentUserData.points || 0).toLocaleString();
             pointsBalanceEl.textContent = pointsBalance;
        }
        
        // *************************************************************
        // 🚨 ملاحظة: يجب أن يتضمن هذا الكود تحديث بطاقات Overview أيضاً 
        // ولكننا سنعتمد على دالة تحديث عامة في dashboard.js في النهاية.
        // في الوقت الحالي، نعتمد على تحديث تبويب المحفظة فقط.
        // *************************************************************
    }

    // ===============================================
    // 1. منطق الإيداع (Deposit Logic)
    // ===============================================

    const depositForm = document.getElementById('deposit-form');
    const depositCoinSelect = document.getElementById('deposit-coin');
    const walletAddressDisplay = document.getElementById('wallet-address-display');
    
    const ADMIN_WALLETS = {
        'USDT': 'YOUR_USDT_WALLET_ADDRESS_HERE_FOR_TRC20', 
        'USDC': 'YOUR_USDC_WALLET_ADDRESS_HERE_FOR_ERC20' 
    };

    depositCoinSelect.addEventListener('change', () => {
        const coin = depositCoinSelect.value;
        const address = ADMIN_WALLETS[coin];
        
        if (address) {
            walletAddressDisplay.innerHTML = `Send **${coin}** to: <code>${address}</code>`;
            walletAddressDisplay.classList.remove('hidden');
            walletAddressDisplay.className = 'alert-info';
        } else {
            walletAddressDisplay.classList.add('hidden');
        }
    });
    
    if(depositCoinSelect) depositCoinSelect.dispatchEvent(new Event('change'));

    depositForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUserId || !currentUserData) return displayWalletMessage('deposit-message', 'Authentication error.', true);

        const amount = parseFloat(document.getElementById('deposit-amount').value);
        const coin = depositCoinSelect.value;
        const txHash = document.getElementById('tx-hash').value.trim();
        const submitBtn = depositForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        displayWalletMessage('deposit-message', '', false); 

        try {
            await db.collection('depositRequests').add({
                userId: currentUserId,
                username: currentUserData.username, 
                amount: amount,
                coin: coin,
                txHash: txHash,
                status: 'Pending', 
                requestedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            displayWalletMessage('deposit-message', 'Deposit request submitted successfully. It will be credited after manual verification.', false);
            // لا حاجة لتحديث الرصيد أو السجل لأنها عملية تنتظر المراجعة

        } catch (error) {
            console.error("Deposit request failed:", error);
            displayWalletMessage('deposit-message', 'Failed to submit request. Please try again.', true);
        } finally {
            submitBtn.disabled = false;
            depositForm.reset();
            depositCoinSelect.dispatchEvent(new Event('change'));
        }
    });

    // ===============================================
    // 2. منطق السحب (Withdraw Logic)
    // ===============================================

    const withdrawForm = document.getElementById('withdraw-form');

    withdrawForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUserId || !currentUserData) return displayWalletMessage('withdraw-message', 'Authentication error.', true);

        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const address = document.getElementById('withdraw-address').value.trim();
        const coin = document.getElementById('withdraw-coin').value;
        const submitBtn = withdrawForm.querySelector('button[type="submit"]');
        const currentBalance = currentUserData.balance || 0;
        const MIN_WITHDRAW = 10; 
        
        submitBtn.disabled = true;
        displayWalletMessage('withdraw-message', '', false); 

        if (amount < MIN_WITHDRAW) {
            displayWalletMessage('withdraw-message', `Minimum withdrawal amount is $${MIN_WITHDRAW}.`, true);
            submitBtn.disabled = false;
            return;
        }

        if (amount > currentBalance) {
            displayWalletMessage('withdraw-message', 'Insufficient USD balance for this withdrawal.', true);
            submitBtn.disabled = false;
            return;
        }

        try {
            await db.runTransaction(async (transaction) => {
                const userDocRef = db.collection('users').doc(currentUserId);
                const userDoc = await transaction.get(userDocRef);

                const latestBalance = userDoc.data().balance || 0;
                if (latestBalance < amount) {
                    throw new Error("Insufficient funds (race condition). Please try again.");
                }

                transaction.update(userDocRef, {
                    balance: firebase.firestore.FieldValue.increment(-amount)
                });

                const withdrawRef = db.collection('withdrawRequests').doc();
                transaction.set(withdrawRef, {
                    userId: currentUserId,
                    username: currentUserData.username,
                    amount: amount,
                    coin: coin,
                    address: address,
                    status: 'Pending',
                    requestedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const transactionRef = db.collection('transactions').doc();
                transaction.set(transactionRef, {
                    userId: currentUserId,
                    type: 'Withdrawal_Request',
                    currency: 'USD',
                    amount: -amount,
                    status: 'Pending',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            // تحديث البيانات محلياً وعرض الأرصدة
            currentUserData.balance -= amount;
            updateWalletBalancesDisplay(); 
            fetchAndDisplayTransactionHistory(); // تحديث السجل

            displayWalletMessage('withdraw-message', 'Withdrawal request submitted. Funds deducted and processing manually.', false);

        } catch (error) {
            console.error("Withdrawal failed:", error);
            const msg = error.message.includes('Insufficient funds') ? error.message : 'Withdrawal failed. Check balance and try again.';
            displayWalletMessage('withdraw-message', msg, true);
        } finally {
            submitBtn.disabled = false;
            withdrawForm.reset();
        }
    });

    // ===============================================
    // 3. منطق التحويل بين الأعضاء (Transfer Logic)
    // ===============================================

    const transferForm = document.getElementById('transfer-form');

    transferForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUserId || !currentUserData) return displayWalletMessage('transfer-message', 'Authentication error.', true);

        const recipientUsername = document.getElementById('transfer-username').value.trim();
        const amount = parseFloat(document.getElementById('transfer-amount').value);
        const submitBtn = transferForm.querySelector('button[type="submit"]');
        const currentBalance = currentUserData.balance || 0;
        const MIN_TRANSFER = 0.01;

        submitBtn.disabled = true;
        displayWalletMessage('transfer-message', '', false); 

        if (amount < MIN_TRANSFER) {
            displayWalletMessage('transfer-message', `Minimum transfer amount is $${MIN_TRANSFER}.`, true);
            submitBtn.disabled = false;
            return;
        }

        if (amount > currentBalance) {
            displayWalletMessage('transfer-message', 'Insufficient USD balance for this transfer.', true);
            submitBtn.disabled = false;
            return;
        }
        
        if (recipientUsername === currentUserData.username) {
            displayWalletMessage('transfer-message', 'Cannot transfer funds to yourself.', true);
            submitBtn.disabled = false;
            return;
        }

        try {
            const recipientSnapshot = await db.collection('users').where('username', '==', recipientUsername).limit(1).get();
            if (recipientSnapshot.empty) {
                displayWalletMessage('transfer-message', `Username "${recipientUsername}" not found.`, true);
                submitBtn.disabled = false;
                return;
            }

            const recipientDoc = recipientSnapshot.docs[0];
            const recipientUid = recipientDoc.id;

            await db.runTransaction(async (transaction) => {
                const senderRef = db.collection('users').doc(currentUserId);
                const recipientRef = db.collection('users').doc(recipientUid);
                
                const senderDoc = await transaction.get(senderRef);
                const latestBalance = senderDoc.data().balance || 0;

                if (latestBalance < amount) {
                    throw new Error("Insufficient funds (race condition). Please try again.");
                }

                transaction.update(senderRef, {
                    balance: firebase.firestore.FieldValue.increment(-amount)
                });
                transaction.update(recipientRef, {
                    balance: firebase.firestore.FieldValue.increment(amount)
                });

                transaction.set(db.collection('transactions').doc(), {
                    userId: currentUserId,
                    type: 'Transfer_Sent',
                    currency: 'USD',
                    amount: -amount,
					status: 'completed',
                    recipient: recipientUsername,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                transaction.set(db.collection('transactions').doc(), {
                    userId: recipientUid,
                    type: 'Transfer_Received',
                    currency: 'USD',
                    amount: amount,
					status: 'completed',
                    sender: currentUserData.username,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            // تحديث البيانات محلياً وعرض الأرصدة
            currentUserData.balance -= amount;
            updateWalletBalancesDisplay(); 
            fetchAndDisplayTransactionHistory(); // تحديث السجل

            displayWalletMessage('transfer-message', `Successfully transferred $${amount.toFixed(2)} to ${recipientUsername}.`, false);
            
        } catch (error) {
            console.error("Transfer failed:", error);
            const msg = error.message.includes('Insufficient funds') ? error.message : 'Transfer failed. Please check the username and try again.';
            displayWalletMessage('transfer-message', msg, true);
        } finally {
            submitBtn.disabled = false;
            transferForm.reset();
        }
    });


    // ===============================================
    // 4. منطق إضافة النقاط للمجمع (Add to Pool Logic)
    // ===============================================
    
    const addToPoolForm = document.getElementById('add-to-pool-form');

    addToPoolForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUserId || !currentUserData) return displayWalletMessage('pool-message', 'Authentication error.', true);

        const amount = parseInt(document.getElementById('pool-amount').value);
        const submitBtn = addToPoolForm.querySelector('button[type="submit"]');
        const currentPoints = currentUserData.points || 0;
        const MIN_POINTS = 1;

        submitBtn.disabled = true;
        displayWalletMessage('pool-message', '', false); 

        if (amount < MIN_POINTS) {
            displayWalletMessage('pool-message', `Minimum points to add is ${MIN_POINTS}.`, true);
            submitBtn.disabled = false;
            return;
        }

        if (amount > currentPoints) {
            displayWalletMessage('pool-message', 'Insufficient points balance.', true);
            submitBtn.disabled = false;
            return;
        }
        
        try {
            await db.runTransaction(async (transaction) => {
                const userDocRef = db.collection('users').doc(currentUserId);
                const userDoc = await transaction.get(userDocRef);

                const latestPoints = userDoc.data().points || 0;
                if (latestPoints < amount) {
                    throw new Error("Insufficient points (race condition). Please try again.");
                }

                transaction.update(userDocRef, {
                    points: firebase.firestore.FieldValue.increment(-amount),
                    pointsPendingPool: firebase.firestore.FieldValue.increment(amount) 
                });
                
                transaction.set(db.collection('transactions').doc(), {
                    userId: currentUserId,
                    type: 'Points_Added_To_Pool',
                    currency: 'Point',
                    amount: -amount,
                    status: 'Active',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            // تحديث البيانات محلياً وعرض الأرصدة
            currentUserData.points -= amount;
            currentUserData.pointsPendingPool += amount;
            updateWalletBalancesDisplay();
            fetchAndDisplayTransactionHistory(); // تحديث السجل

            displayWalletMessage('pool-message', `Successfully added ${amount.toLocaleString()} points to the weekly distribution pool!`, false);
            
        } catch (error) {
            console.error("Add to Pool failed:", error);
            const msg = error.message.includes('Insufficient points') ? error.message : 'Failed to add points to the pool. Try again.';
            displayWalletMessage('pool-message', msg, true);
        } finally {
            submitBtn.disabled = false;
            addToPoolForm.reset();
        }
    });
    
    // ===============================================
    // 5. منطق عرض تاريخ العمليات (History Logic)
    // ===============================================

    async function fetchAndDisplayTransactionHistory() {
        if (!currentUserId) return;

        const container = document.getElementById('transaction-history-container');
        if (!container) return;

        container.innerHTML = `<p class="loading-text"><i class="fas fa-spinner fa-spin"></i> Loading transaction history...</p>`;

        try {
            // جلب آخر 20 عملية للمستخدم الحالي
            const snapshot = await db.collection('transactions')
                .where('userId', '==', currentUserId)
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();

            let tableHTML = `
                <table class="transaction-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Currency</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (snapshot.empty) {
                 tableHTML += `<tr><td colspan="6" class="no-records">No transaction records found.</td></tr>`;
            } else {
                snapshot.forEach(doc => {
                    const tx = doc.data();
                    const date = tx.timestamp ? new Date(tx.timestamp.seconds * 1000).toLocaleString() : 'N/A';
                    const amountClass = tx.amount < 0 ? 'debit' : 'credit';
                    const statusClass = tx.status === 'Pending' ? 'status-pending' : (tx.status === 'Completed' ? 'status-completed' : 'status-active');
                    
                    let details = '';
                    if (tx.recipient) {
                        details = `To: ${tx.recipient}`;
                    } else if (tx.sender) {
                        details = `From: ${tx.sender}`;
                    } else if (tx.address) {
                        details = `Address: ${tx.address.substring(0, 10)}...`;
                    }

                    tableHTML += `
                        <tr>
                            <td>${tx.type.replace(/_/g, ' ')}</td>
                            <td class="${amountClass}">${tx.amount.toFixed(2)}</td>
                            <td>${tx.currency}</td>
                            <td>${date}</td>
                            <td><span class="${statusClass}">${tx.status}</span></td>
                            <td>${details}</td>
                        </tr>
                    `;
                });
            }

            tableHTML += `
                    </tbody>
                </table>
            `;
            
            container.innerHTML = tableHTML;

        } catch (error) {
            console.error("Error fetching transaction history:", error);
            container.innerHTML = `<p class="alert-danger">Failed to load transaction history. Please check your connection.</p>`;
        }
    }
    
    // --------------------------------------------------------------------------
    // ربط الدالة بـ dashboard.js لضمان عملها بعد تحميل بيانات المستخدم
    // --------------------------------------------------------------------------
    
    // إضافة دالة عامة لتبويب المحفظة يمكن استدعاؤها من dashboard.js بعد تحميل البيانات
    if (typeof window.loadWalletData !== 'function') {
        window.loadWalletData = () => {
             updateWalletBalancesDisplay();
             fetchAndDisplayTransactionHistory();
        };
    }
    
    // استدعاء أولي لتحديث عرض العنوان والعمليات
    if (document.querySelector('#deposit-coin')) {
        document.querySelector('#deposit-coin').dispatchEvent(new Event('change'));
    }
    
    // ملاحظة: سيتم استدعاء loadWalletData() من dashboard.js بعد إتمام المصادقة
});
