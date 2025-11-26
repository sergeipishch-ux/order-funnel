// Управление сроками заказов
let allInProgressOrders = [];
let filteredOrders = [];

// Инициализация страницы управления сроками
function initSchedulePage() {
    loadInProgressOrders();
    
    // Инициализация Flatpickr для выбора дат
    initDatePickers();
    
    // Обработчики фильтров
    document.getElementById('stageStatusFilter').addEventListener('change', applyFilters);
    document.getElementById('stageFilter').addEventListener('change', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    initScheduleModal();
}

// Загрузка заказов в работе
async function loadInProgressOrders() {
    try {
        console.log('Loading in-progress orders...');
        const response = await fetch('/api/orders/in-progress');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allInProgressOrders = await response.json();
        console.log('Loaded in-progress orders:', allInProgressOrders);
        applyFilters();
        updateScheduleStatistics();
    } catch (error) {
        console.error('Ошибка загрузки заказов в работе:', error);
        showNotification('Ошибка загрузки заказов в работе', 'error');
    }
}

// Инициализация Flatpickr
function initDatePickers() {
    flatpickr.localize(flatpickr.l10ns.ru);
    
    const flatpickrConfig = {
        locale: 'ru',
        dateFormat: 'd.m.Y',
        minDate: 'today',
        allowInput: true,
        clickOpens: true,
        static: true
    };
    
    // Инициализация будет выполнена при открытии модального окна
}

// Применение фильтров
function applyFilters() {
    const stageStatusFilter = document.getElementById('stageStatusFilter').value;
    const stageFilter = document.getElementById('stageFilter').value;
    
    filteredOrders = allInProgressOrders.filter(order => {
        let statusMatch = true;
        let stageMatch = true;
        
        if (stageStatusFilter) {
            statusMatch = checkStageStatus(order, stageStatusFilter);
        }
        
        if (stageFilter) {
            stageMatch = checkStage(order, stageFilter);
        }
        
        return statusMatch && stageMatch;
    });
    
    console.log('Filtered in-progress orders:', filteredOrders);
    displayInProgressOrders(filteredOrders);
}

// Проверка статуса этапа
function checkStageStatus(order, status) {
    const schedule = order.schedule || {};
    const stages = getStagesWithDates(schedule);
    
    switch (status) {
        case 'overdue':
            return stages.some(stage => isStageOverdue(stage));
        case 'today':
            return stages.some(stage => isStageDueToday(stage));
        case 'upcoming':
            return stages.some(stage => isStageUpcoming(stage));
        case 'completed':
            return stages.some(stage => stage.completed);
        default:
            return true;
    }
}

// Проверка конкретного этапа
function checkStage(order, stageKey) {
    const schedule = order.schedule || {};
    const stage = schedule[stageKey];
    return stage && stage.plannedDate;
}

// Сброс фильтров
function resetFilters() {
    document.getElementById('stageStatusFilter').value = '';
    document.getElementById('stageFilter').value = '';
    applyFilters();
}

// Отображение заказов в работе
function displayInProgressOrders(orders) {
    const container = document.getElementById('ordersContainer');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="no-orders">
                <i class="fas fa-tools"></i>
                <p>Заказов в работе не найдено</p>
                <small>Измените фильтры или перейдите в воронку для изменения статусов</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = orders.map(order => {
        const customerInfo = order.customerInfo || { fullName: '', phone: '', address: '' };
        const schedule = order.schedule || {};
        const progress = calculateOrderProgress(schedule);
        const nextStage = getNextStage(schedule);
        const isOverdue = checkOrderOverdue(schedule);
        
        return `
            <div class="schedule-order-card ${isOverdue ? 'overdue' : ''}" data-order-id="${order.id}">
                <div class="order-header-content">
                    <div>
                        <div class="order-id">Заказ #${order.id ? order.id.slice(-6) : '000000'}</div>
                        <div class="customer-name">${customerInfo.fullName || 'Клиент не указан'}</div>
                    </div>
                    <div class="order-meta">
                        <span class="status-badge ${isOverdue ? 'status-rejected' : 'status-in-progress'}">
                            ${isOverdue ? 'Просрочка' : 'В работе'}
                        </span>
                    </div>
                </div>
                
                <div class="customer-info-mini">
                    <div class="customer-detail">
                        <i class="fas fa-phone"></i>
                        <span>${customerInfo.phone || 'Телефон не указан'}</span>
                    </div>
                    <div class="customer-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${customerInfo.address || 'Адрес не указан'}</span>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="progress-header">
                        <span>Прогресс выполнения:</span>
                        <span class="progress-percent">${progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                <div class="stages-overview">
                    ${renderStagesOverview(schedule)}
                </div>
                
                ${nextStage ? `
                    <div class="next-stage">
                        <strong>Следующий этап:</strong> ${getStageName(nextStage.key)}
                        ${nextStage.plannedDate ? `
                            <br><small>Срок: ${formatDisplayDate(nextStage.plannedDate)}</small>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="order-actions">
                    <button class="btn btn-primary" onclick="openScheduleModal('${order.id}')">
                        <i class="fas fa-calendar-edit"></i> Управление сроками
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Рендер обзора этапов
function renderStagesOverview(schedule) {
    const stages = [
        { key: 'materialPurchase', name: 'Закупка материала', icon: 'fas fa-shopping-cart' },
        { key: 'cutting', name: 'Напил', icon: 'fas fa-cut' },
        { key: 'edging', name: 'Кромление', icon: 'fas fa-border-style' },
        { key: 'processing', name: 'Обработка', icon: 'fas fa-cog' },
        { key: 'assembly', name: 'Сборка', icon: 'fas fa-tools' },
        { key: 'delivery', name: 'Доставка', icon: 'fas fa-truck' }
    ];
    
    return stages.map(stage => {
        const stageData = schedule[stage.key] || {};
        const status = getStageStatus(stageData);
        const statusClass = getStageStatusClass(status);
        
        return `
            <div class="stage-item ${statusClass}">
                <i class="${stage.icon}"></i>
                <span class="stage-name">${stage.name}</span>
                ${stageData.plannedDate ? `
                    <span class="stage-date">${formatDisplayDate(stageData.plannedDate)}</span>
                ` : ''}
                ${stageData.completed ? '<i class="fas fa-check completed-badge"></i>' : ''}
            </div>
        `;
    }).join('');
}

// Получение статуса этапа
function getStageStatus(stageData) {
    if (stageData.completed) return 'completed';
    if (!stageData.plannedDate) return 'not-scheduled';
    if (isStageOverdue(stageData)) return 'overdue';
    if (isStageDueToday(stageData)) return 'today';
    return 'scheduled';
}

// Получение класса статуса этапа
function getStageStatusClass(status) {
    const classes = {
        'completed': 'stage-completed',
        'overdue': 'stage-overdue',
        'today': 'stage-today',
        'scheduled': 'stage-scheduled',
        'not-scheduled': 'stage-not-scheduled'
    };
    return classes[status] || '';
}

// Расчет прогресса заказа
function calculateOrderProgress(schedule) {
    const stages = [
        'materialPurchase', 'cutting', 'edging', 
        'processing', 'assembly', 'delivery'
    ];
    
    const completedStages = stages.filter(stage => 
        schedule[stage] && schedule[stage].completed
    ).length;
    
    return Math.round((completedStages / stages.length) * 100);
}

// Получение следующего этапа
function getNextStage(schedule) {
    const stages = [
        'materialPurchase', 'cutting', 'edging', 
        'processing', 'assembly', 'delivery'
    ];
    
    for (let stage of stages) {
        const stageData = schedule[stage];
        if (!stageData || !stageData.completed) {
            return { key: stage, ...stageData };
        }
    }
    return null;
}

// Проверка просрочки заказа
function checkOrderOverdue(schedule) {
    const stages = getStagesWithDates(schedule);
    return stages.some(stage => isStageOverdue(stage));
}

// Получение этапов с датами
function getStagesWithDates(schedule) {
    const stages = [
        'materialPurchase', 'cutting', 'edging', 
        'processing', 'assembly', 'delivery'
    ];
    
    return stages.map(key => ({
        key,
        name: getStageName(key),
        ...(schedule[key] || {})
    })).filter(stage => stage.plannedDate);
}

// Проверка просрочки этапа
function isStageOverdue(stage) {
    if (!stage.plannedDate || stage.completed) return false;
    const plannedDate = parseDate(stage.plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return plannedDate < today;
}

// Проверка этапа на сегодня
function isStageDueToday(stage) {
    if (!stage.plannedDate || stage.completed) return false;
    const plannedDate = parseDate(stage.plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return plannedDate.getTime() === today.getTime();
}

// Проверка предстоящего этапа
function isStageUpcoming(stage) {
    if (!stage.plannedDate || stage.completed) return false;
    const plannedDate = parseDate(stage.plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return plannedDate > today;
}

// Получение названия этапа
function getStageName(key) {
    const names = {
        'materialPurchase': 'Закупка материала',
        'cutting': 'Напил',
        'edging': 'Кромление',
        'processing': 'Обработка',
        'assembly': 'Сборка',
        'delivery': 'Доставка'
    };
    return names[key] || key;
}

// Обновление статистики сроков
function updateScheduleStatistics() {
    const totalInProgress = allInProgressOrders.length;
    let overdueCount = 0;
    let dueTodayCount = 0;
    let onTimeCount = 0;
    
    allInProgressOrders.forEach(order => {
        const schedule = order.schedule || {};
        const stages = getStagesWithDates(schedule);
        
        if (stages.some(stage => isStageOverdue(stage))) {
            overdueCount++;
        }
        
        if (stages.some(stage => isStageDueToday(stage))) {
            dueTodayCount++;
        }
        
        if (!stages.some(stage => isStageOverdue(stage))) {
            onTimeCount++;
        }
    });
    
    document.getElementById('totalInProgress').textContent = totalInProgress;
    document.getElementById('overdueCount').textContent = overdueCount;
    document.getElementById('dueTodayCount').textContent = dueTodayCount;
    document.getElementById('onTimeCount').textContent = onTimeCount;
}

// Открытие модального окна управления сроками
async function openScheduleModal(orderId) {
    try {
        const order = allInProgressOrders.find(o => o.id === orderId);
        if (!order) {
            throw new Error('Заказ не найден');
        }
        
        const customerInfo = order.customerInfo || {};
        
        // Заполняем информацию о заказе
        document.getElementById('modalOrderTitle').textContent = `Заказ #${order.id.slice(-6)}`;
        document.getElementById('modalCustomerName').textContent = customerInfo.fullName || 'Не указано';
        document.getElementById('modalCustomerPhone').textContent = customerInfo.phone || 'Не указан';
        document.getElementById('modalCustomerAddress').textContent = customerInfo.address || 'Не указан';
        document.getElementById('scheduleOrderId').value = orderId;
        
        // Заполняем этапы
        renderScheduleStages(order.schedule || {});
        
        // Обновляем сводку
        updateScheduleSummary(order.schedule || {});
        
        document.getElementById('scheduleModal').style.display = 'block';
        
    } catch (error) {
        console.error('Ошибка открытия модального окна:', error);
        showNotification('Ошибка открытия модального окна', 'error');
    }
}

// Рендер этапов в модальном окне
function renderScheduleStages(schedule) {
    const stagesContainer = document.querySelector('.schedule-stages');
    const stages = [
        { key: 'materialPurchase', name: 'Закупка материала', icon: 'fas fa-shopping-cart', description: 'Закупка необходимых материалов и комплектующих' },
        { key: 'cutting', name: 'Напил', icon: 'fas fa-cut', description: 'Раскрой материалов по размерам' },
        { key: 'edging', name: 'Кромление', icon: 'fas fa-border-style', description: 'Обработка кромок деталей' },
        { key: 'processing', name: 'Обработка', icon: 'fas fa-cog', description: 'Финальная обработка и шлифовка' },
        { key: 'assembly', name: 'Сборка', icon: 'fas fa-tools', description: 'Сборка готового изделия' },
        { key: 'delivery', name: 'Доставка', icon: 'fas fa-truck', description: 'Доставка заказа клиенту' }
    ];
    
    stagesContainer.innerHTML = stages.map(stage => {
        const stageData = schedule[stage.key] || {};
        const status = getStageStatus(stageData);
        
        return `
            <div class="schedule-stage-card ${status === 'completed' ? 'stage-completed' : ''}">
                <div class="stage-header">
                    <div class="stage-title">
                        <i class="${stage.icon}"></i>
                        <h4>${stage.name}</h4>
                    </div>
                    <div class="stage-status">
                        <label class="checkbox-container">
                            <input type="checkbox" 
                                   class="stage-completed-checkbox" 
                                   data-stage="${stage.key}"
                                   ${stageData.completed ? 'checked' : ''}>
                            <span class="checkmark"></span>
                            Выполнено
                        </label>
                    </div>
                </div>
                
                <p class="stage-description">${stage.description}</p>
                
                <div class="stage-dates">
                    <div class="date-input-group">
                        <label>Планируемая дата:</label>
                        <input type="text" 
                               class="date-input planned-date"
                               data-stage="${stage.key}"
                               placeholder="Выберите дату"
                               value="${stageData.plannedDate ? formatDisplayDate(stageData.plannedDate) : ''}">
                    </div>
                    
                    ${stageData.completed ? `
                        <div class="date-input-group">
                            <label>Фактическая дата:</label>
                            <input type="text" 
                                   class="date-input actual-date"
                                   data-stage="${stage.key}"
                                   placeholder="Выберите дату"
                                   value="${stageData.actualDate ? formatDisplayDate(stageData.actualDate) : ''}">
                        </div>
                    ` : ''}
                </div>
                
                <div class="stage-notes">
                    <label>Примечания:</label>
                    <textarea class="stage-notes-input" 
                              data-stage="${stage.key}"
                              placeholder="Дополнительная информация по этапу...">${stageData.notes || ''}</textarea>
                </div>
            </div>
        `;
    }).join('');
    
    // Инициализация Flatpickr для новых полей ввода
    initModalDatePickers();
}

// Инициализация Flatpickr в модальном окне
function initModalDatePickers() {
    const dateInputs = document.querySelectorAll('.date-input');
    
    dateInputs.forEach(input => {
        flatpickr(input, {
            locale: 'ru',
            dateFormat: 'd.m.Y',
            allowInput: true,
            clickOpens: true,
            static: true
        });
    });
}

// Обновление сводки по срокам
function updateScheduleSummary(schedule) {
    const stages = getStagesWithDates(schedule);
    const plannedDates = stages.map(stage => parseDate(stage.plannedDate)).filter(date => date);
    
    if (plannedDates.length === 0) {
        document.getElementById('summaryStartDate').textContent = '-';
        document.getElementById('summaryEndDate').textContent = '-';
        document.getElementById('summaryDuration').textContent = '-';
        document.getElementById('summaryStatus').textContent = 'Не назначены сроки';
        return;
    }
    
    const startDate = new Date(Math.min(...plannedDates));
    const endDate = new Date(Math.max(...plannedDates));
    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    const completedStages = stages.filter(stage => stage.completed).length;
    const status = completedStages === stages.length ? 'Завершен' : 
                  completedStages > 0 ? 'В работе' : 'Запланирован';
    
    document.getElementById('summaryStartDate').textContent = formatDisplayDate(startDate);
    document.getElementById('summaryEndDate').textContent = formatDisplayDate(endDate);
    document.getElementById('summaryDuration').textContent = `${duration} дней`;
    document.getElementById('summaryStatus').textContent = status;
}

// Инициализация модального окна сроков
function initScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    const closeBtn = modal.querySelector('.close');
    const scheduleForm = document.getElementById('scheduleForm');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    scheduleForm.addEventListener('submit', saveSchedule);
}

// Сохранение сроков
async function saveSchedule(e) {
    e.preventDefault();
    
    const orderId = document.getElementById('scheduleOrderId').value;
    const scheduleData = collectScheduleData();
    
    try {
        const response = await fetch(`/api/orders/${orderId}/schedule?pin=159753`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schedule: scheduleData })
        });
        
        if (response.ok) {
            document.getElementById('scheduleModal').style.display = 'none';
            loadInProgressOrders();
            showNotification('Сроки успешно сохранены', 'success');
        } else {
            throw new Error('Ошибка при сохранении сроков');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при сохранении сроков', 'error');
    }
}

// Сбор данных о сроках
function collectScheduleData() {
    const schedule = {};
    const stages = ['materialPurchase', 'cutting', 'edging', 'processing', 'assembly', 'delivery'];
    
    stages.forEach(stage => {
        const completedCheckbox = document.querySelector(`.stage-completed-checkbox[data-stage="${stage}"]`);
        const plannedDateInput = document.querySelector(`.planned-date[data-stage="${stage}"]`);
        const actualDateInput = document.querySelector(`.actual-date[data-stage="${stage}"]`);
        const notesInput = document.querySelector(`.stage-notes-input[data-stage="${stage}"]`);
        
        schedule[stage] = {
            completed: completedCheckbox ? completedCheckbox.checked : false,
            plannedDate: plannedDateInput ? plannedDateInput.value : '',
            actualDate: actualDateInput ? actualDateInput.value : '',
            notes: notesInput ? notesInput.value : ''
        };
    });
    
    return schedule;
}

// Вспомогательные функции для работы с датами
function parseDate(dateString) {
    if (!dateString) return null;
    
    // Поддержка разных форматов дат
    const parts = dateString.split('.');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    
    return new Date(dateString);
}

function formatDisplayDate(date) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? parseDate(date) : date;
    if (!dateObj) return '';
    
    return dateObj.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Инициализация при загрузке страницы
if (window.location.pathname.includes('schedule')) {
    document.addEventListener('DOMContentLoaded', initSchedulePage);
}