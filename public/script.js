const PIN_CODE = '159753';
let allOrders = [];
let filteredOrders = [];

// Управление состоянием авторизации
function checkAuth() {
    const isAuthenticated = localStorage.getItem('authenticated') === 'true';
    if (!isAuthenticated && !window.location.pathname.endsWith('login.html')) {
        window.location.href = '/';
    }
}

// Выход из системы
function logout() {
    localStorage.removeItem('authenticated');
    window.location.href = '/';
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const pin = document.getElementById('pin').value;
            
            if (pin === PIN_CODE) {
                localStorage.setItem('authenticated', 'true');
                window.location.href = '/funnel';
            } else {
                document.getElementById('errorMessage').textContent = 'Неверный пин-код';
                document.getElementById('errorMessage').style.display = 'block';
            }
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    if (document.getElementById('addOrderForm')) {
        initFunnel();
    }
});

// Функционал воронки заказов
function initFunnel() {
    loadOrders();
    
    document.getElementById('addOrderForm').addEventListener('submit', addOrder);
    
    // Обработчики кнопок "+"
    document.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', function() {
            const field = this.getAttribute('data-field');
            const input = document.querySelector(`[name="${field}"]`) || document.getElementById(field);
            const currentValue = parseFloat(input.value) || 0;
            input.value = (currentValue + 1).toFixed(2);
        });
    });
    
    // Иные расходы
    document.getElementById('addExpenseBtn').addEventListener('click', addExpense);
    document.getElementById('editAddExpenseBtn').addEventListener('click', addEditExpense);
    
    // Фильтры
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sourceFilter').addEventListener('change', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    initModal();
}

// Управление иными расходами
function addExpense() {
    const container = document.getElementById('otherExpensesContainer');
    const expenseId = Date.now().toString();
    const expenseHtml = `
        <div class="expense-item" data-id="${expenseId}">
            <input type="text" placeholder="Описание расхода" class="expense-description">
            <input type="number" step="0.01" placeholder="Сумма" class="expense-amount">
            <button type="button" class="btn btn-danger" onclick="removeExpense('${expenseId}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', expenseHtml);
}

function addEditExpense() {
    const container = document.getElementById('editOtherExpensesContainer');
    const expenseId = Date.now().toString();
    const expenseHtml = `
        <div class="expense-item" data-id="${expenseId}">
            <input type="text" placeholder="Описание расхода" class="expense-description">
            <input type="number" step="0.01" placeholder="Сумма" class="expense-amount">
            <button type="button" class="btn btn-danger" onclick="removeEditExpense('${expenseId}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', expenseHtml);
}

function removeExpense(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) element.remove();
}

function removeEditExpense(id) {
    const element = document.querySelector(`#editOtherExpensesContainer [data-id="${id}"]`);
    if (element) element.remove();
}

// Получение данных иных расходов
function getOtherExpenses(containerId) {
    const container = document.getElementById(containerId);
    const expenses = [];
    container.querySelectorAll('.expense-item').forEach(item => {
        const description = item.querySelector('.expense-description').value;
        const amount = parseFloat(item.querySelector('.expense-amount').value) || 0;
        if (description && amount > 0) {
            expenses.push({ description, amount });
        }
    });
    return expenses;
}

// Загрузка заказов
async function loadOrders() {
    try {
        console.log('Loading orders...');
        const response = await fetch('/api/orders');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allOrders = await response.json();
        console.log('Loaded orders:', allOrders);
        applyFilters();
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        showNotification('Ошибка загрузки заказов', 'error');
    }
}

// Применение фильтров
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const sourceFilter = document.getElementById('sourceFilter').value;
    
    filteredOrders = allOrders.filter(order => {
        const statusMatch = !statusFilter || order.status === statusFilter;
        const sourceMatch = !sourceFilter || order.source === sourceFilter;
        return statusMatch && sourceMatch;
    });
    
    console.log('Filtered orders:', filteredOrders);
    displayOrders(filteredOrders);
    updateStatistics(filteredOrders);
}

// Сброс фильтров
function resetFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('sourceFilter').value = '';
    applyFilters();
}

// Отображение заказов
function displayOrders(orders) {
    const container = document.getElementById('ordersContainer');
    console.log('Displaying orders:', orders);
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="no-orders">
                <i class="fas fa-inbox"></i>
                <p>Заказов не найдено</p>
                <small>Добавьте первый заказ используя форму выше</small>
            </div>
        `;
        return;
    }
    
    // Сортируем заказы по дате создания (новые сверху)
    const sortedOrders = orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    container.innerHTML = sortedOrders.map(order => {
        // Проверяем наличие всех необходимых полей
        const customerInfo = order.customerInfo || { fullName: '', phone: '', address: '' };
        const totalExpenses = calculateTotalExpenses(order);
        const profit = (order.orderCost || 0) - totalExpenses;
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        const statusClass = getStatusClass(order.status);
        
        return `
            <div class="order-card" data-order-id="${order.id}">
                <!-- Customer Information -->
                <div class="customer-card">
                    <div class="customer-details">
                        <div class="customer-detail">
                            <i class="fas fa-user"></i>
                            <span>${customerInfo.fullName || 'Не указано'}</span>
                        </div>
                        <div class="customer-detail">
                            <i class="fas fa-phone"></i>
                            <span>${customerInfo.phone || 'Не указан'}</span>
                        </div>
                        <div class="customer-detail">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${customerInfo.address || 'Не указан'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="order-card-header">
                    <div>
                        <div class="order-id">Заказ #${order.id ? order.id.slice(-6) : '000000'}</div>
                        <div class="order-date">${order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : 'Дата не указана'}</div>
                    </div>
                    <div class="order-meta">
                        <span class="status-badge ${statusClass}">${order.status || 'Согласование'}</span>
                        <span class="source-badge">${order.source || 'Не указан'}</span>
                    </div>
                </div>
                
                <div class="order-costs">
                    <div class="cost-line">
                        <span>Доход:</span>
                        <span>${formatCurrency(order.orderCost || 0)}</span>
                    </div>
                    <div class="cost-line">
                        <span>Материалы:</span>
                        <span>-${formatCurrency(order.materialCost || 0)}</span>
                    </div>
                    <div class="cost-line">
                        <span>Фурнитура:</span>
                        <span>-${formatCurrency(order.furnitureCost || 0)}</span>
                    </div>
                    <div class="cost-line">
                        <span>Такси:</span>
                        <span>-${formatCurrency(order.taxiCost || 0)}</span>
                    </div>
                    <div class="cost-line">
                        <span>Доставка:</span>
                        <span>-${formatCurrency(order.deliveryCost || 0)}</span>
                    </div>
                    ${order.otherExpenses && order.otherExpenses.length > 0 ? order.otherExpenses.map(expense => `
                        <div class="cost-line">
                            <span>${expense.description || 'Расход'}:</span>
                            <span>-${formatCurrency(expense.amount || 0)}</span>
                        </div>
                    `).join('') : ''}
                    <div class="total-cost ${profitClass}">
                        <span>Прибыль:</span>
                        <span>${formatCurrency(profit)}</span>
                    </div>
                </div>
                
                ${order.files && order.files.length > 0 ? `
                    <div class="order-files">
                        <strong><i class="fas fa-paperclip"></i> Файлы:</strong>
                        <div class="file-list">
                            ${order.files.map(file => `
                                <div class="file-item">
                                    <a href="/uploads/${file.filename}" target="_blank" class="file-link">
                                        <i class="fas fa-file"></i> ${file.originalname}
                                    </a>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="order-actions">
                    <button class="btn btn-success" onclick="editOrder('${order.id}')">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-danger" onclick="deleteOrder('${order.id}')">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Получение класса для статуса
function getStatusClass(status) {
    const statusClasses = {
        'Согласование': 'status-agreement',
        'В работе': 'status-in-progress',
        'Выполнено': 'status-completed',
        'Отказано': 'status-rejected'
    };
    return statusClasses[status] || 'status-agreement';
}

// Обновление статистики
function updateStatistics(orders) {
    if (!orders || orders.length === 0) {
        document.getElementById('totalOrders').textContent = '0';
        document.getElementById('totalRevenue').textContent = '0 ₽';
        document.getElementById('totalExpenses').textContent = '0 ₽';
        document.getElementById('totalProfit').textContent = '0 ₽';
        return;
    }

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.orderCost || 0), 0);
    const totalExpenses = orders.reduce((sum, order) => sum + calculateTotalExpenses(order), 0);
    const totalProfit = totalRevenue - totalExpenses;
    
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    
    // Добавляем класс для цвета прибыли
    const profitElement = document.getElementById('totalProfit');
    profitElement.className = totalProfit >= 0 ? 'stat-value profit' : 'stat-value profit-negative';
}

// Расчет общих расходов
function calculateTotalExpenses(order) {
    if (!order) return 0;
    
    const basicExpenses = (order.materialCost || 0) + (order.furnitureCost || 0) + (order.taxiCost || 0) + (order.deliveryCost || 0);
    const otherExpenses = order.otherExpenses ? order.otherExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0) : 0;
    return basicExpenses + otherExpenses;
}

// Добавление заказа
async function addOrder(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Добавляем иные расходы
    const otherExpenses = getOtherExpenses('otherExpensesContainer');
    formData.append('otherExpenses', JSON.stringify(otherExpenses));
    
    try {
        console.log('Adding order...');
        const response = await fetch('/api/orders?pin=159753', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const newOrder = await response.json();
            console.log('Order added:', newOrder);
            form.reset();
            document.getElementById('otherExpensesContainer').innerHTML = '';
            loadOrders();
            showNotification('Заказ успешно добавлен', 'success');
        } else {
            const errorText = await response.text();
            throw new Error(`Ошибка при добавлении заказа: ${errorText}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при добавлении заказа: ' + error.message, 'error');
    }
}

// Удаление заказа
async function deleteOrder(orderId) {
    if (!confirm('Вы уверены, что хотите удалить этот заказ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/orders/${orderId}?pin=159753`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadOrders();
            showNotification('Заказ успешно удален', 'success');
        } else {
            throw new Error('Ошибка при удалении заказа');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при удалении заказа', 'error');
    }
}

// Редактирование заказа
async function editOrder(orderId) {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        const order = orders.find(o => o.id === orderId);
        
        if (!order) {
            throw new Error('Заказ не найден');
        }
        
        // Заполняем форму редактирования
        document.getElementById('editOrderId').value = order.id;
        document.getElementById('editFullName').value = order.customerInfo?.fullName || '';
        document.getElementById('editPhone').value = order.customerInfo?.phone || '';
        document.getElementById('editAddress').value = order.customerInfo?.address || '';
        document.getElementById('editSource').value = order.source || '';
        document.getElementById('editStatus').value = order.status || 'Согласование';
        document.getElementById('editOrderCost').value = order.orderCost || 0;
        document.getElementById('editMaterialCost').value = order.materialCost || 0;
        document.getElementById('editFurnitureCost').value = order.furnitureCost || 0;
        document.getElementById('editTaxiCost').value = order.taxiCost || 0;
        document.getElementById('editDeliveryCost').value = order.deliveryCost || 0;
        
        // Заполняем иные расходы
        const expensesContainer = document.getElementById('editOtherExpensesContainer');
        expensesContainer.innerHTML = '';
        if (order.otherExpenses) {
            order.otherExpenses.forEach(expense => {
                const expenseId = Date.now().toString();
                expensesContainer.innerHTML += `
                    <div class="expense-item" data-id="${expenseId}">
                        <input type="text" class="expense-description" value="${expense.description || ''}">
                        <input type="number" step="0.01" class="expense-amount" value="${expense.amount || 0}">
                        <button type="button" class="btn btn-danger" onclick="removeEditExpense('${expenseId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            });
        }
        
        // Отображаем существующие файлы
        const existingFilesContainer = document.getElementById('existingFiles');
        if (order.files && order.files.length > 0) {
            existingFilesContainer.innerHTML = `
                <div class="order-files">
                    <strong><i class="fas fa-paperclip"></i> Существующие файлы:</strong>
                    <div class="file-list">
                        ${order.files.map(file => `
                            <div class="file-item">
                                <a href="/uploads/${file.filename}" target="_blank" class="file-link">
                                    <i class="fas fa-file"></i> ${file.originalname}
                                </a>
                                <span class="file-delete" onclick="deleteFile('${order.id}', '${file.filename}')">
                                    <i class="fas fa-times"></i>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            existingFilesContainer.innerHTML = '';
        }
        
        document.getElementById('editModal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при загрузке заказа', 'error');
    }
}

// Сохранение изменений заказа
async function saveOrderChanges(e) {
    e.preventDefault();
    
    const orderId = document.getElementById('editOrderId').value;
    const formData = new FormData(document.getElementById('editOrderForm'));
    
    // Добавляем иные расходы
    const otherExpenses = getOtherExpenses('editOtherExpensesContainer');
    formData.append('otherExpenses', JSON.stringify(otherExpenses));
    
    try {
        const response = await fetch(`/api/orders/${orderId}?pin=159753`, {
            method: 'PUT',
            body: formData
        });
        
        if (response.ok) {
            document.getElementById('editModal').style.display = 'none';
            loadOrders();
            showNotification('Заказ успешно обновлен', 'success');
        } else {
            throw new Error('Ошибка при обновлении заказа');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при обновлении заказа', 'error');
    }
}

// Удаление файла
async function deleteFile(orderId, filename) {
    if (!confirm('Вы уверены, что хотите удалить этот файл?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/orders/${orderId}/files/${filename}?pin=159753`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            editOrder(orderId); // Перезагружаем форму редактирования
            showNotification('Файл успешно удален', 'success');
        } else {
            throw new Error('Ошибка при удалении файла');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при удалении файла', 'error');
    }
}

// Инициализация модального окна
function initModal() {
    const modal = document.getElementById('editModal');
    const closeBtn = document.querySelector('.close');
    const editForm = document.getElementById('editOrderForm');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    editForm.addEventListener('submit', saveOrderChanges);
    
    document.querySelectorAll('#editModal .btn-plus').forEach(btn => {
        btn.addEventListener('click', function() {
            const field = this.getAttribute('data-field');
            const input = document.getElementById(field);
            const currentValue = parseFloat(input.value) || 0;
            input.value = (currentValue + 1).toFixed(2);
        });
    });
}

// Вспомогательные функции
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2
    }).format(amount);
}

function showNotification(message, type) {
    // Удаляем существующие уведомления
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        background: ${type === 'success' ? 'linear-gradient(135deg, #28a745, #20c997)' : 'linear-gradient(135deg, #dc3545, #e91e63)'};
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Добавляем CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .no-orders {
        text-align: center;
        padding: 60px 20px;
        color: #6c757d;
        background: white;
        border-radius: 15px;
        border: 2px dashed #dee2e6;
    }
    
    .no-orders i {
        font-size: 4rem;
        margin-bottom: 20px;
        opacity: 0.5;
    }
    
    .no-orders p {
        font-size: 1.2rem;
        margin: 0 0 10px 0;
    }
    
    .no-orders small {
        font-size: 0.9rem;
        opacity: 0.7;
    }
`;
document.head.appendChild(style);