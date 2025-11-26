// Определяем порт для production
const PORT = process.env.PORT || 3000;
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Настройка Multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Файл для хранения заказов
const ORDERS_FILE = 'orders.json';

// Инициализация файла заказов
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
}

// Чтение заказов
function readOrders() {
  try {
    const data = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading orders:', error);
    return [];
  }
}

// Запись заказов
function writeOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Error writing orders:', error);
  }
}

// Middleware для проверки пин-кода
function checkPin(req, res, next) {
  const pin = req.body.pin || req.query.pin;
  
  if (pin === '159753') {
    next();
  } else {
    res.status(401).json({ error: 'Неверный пин-код' });
  }
}

// Маршруты

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Страница воронки заказов
app.get('/funnel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API для работы с заказами

// Получить все заказы
app.get('/api/orders', (req, res) => {
  try {
    const orders = readOrders();
    console.log('Returning orders:', orders.length);
    res.json(orders);
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: 'Ошибка при получении заказов' });
  }
});

// Создать новый заказ
app.post('/api/orders', checkPin, upload.array('files'), (req, res) => {
  try {
    const orders = readOrders();
    const newOrder = {
      id: Date.now().toString(),
      customerInfo: {
        fullName: req.body.fullName || '',
        phone: req.body.phone || '',
        address: req.body.address || ''
      },
      orderCost: parseFloat(req.body.orderCost) || 0,
      materialCost: parseFloat(req.body.materialCost) || 0,
      furnitureCost: parseFloat(req.body.furnitureCost) || 0,
      taxiCost: parseFloat(req.body.taxiCost) || 0,
      deliveryCost: parseFloat(req.body.deliveryCost) || 0,
      otherExpenses: req.body.otherExpenses ? JSON.parse(req.body.otherExpenses) : [],
      status: req.body.status || 'Согласование',
      source: req.body.source || '',
      files: req.files ? req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path
      })) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Creating new order:', newOrder);
    
    orders.push(newOrder);
    writeOrders(orders);
    res.json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Ошибка при создании заказа' });
  }
});

// Обновить заказ
app.put('/api/orders/:id', checkPin, upload.array('files'), (req, res) => {
  try {
    const orders = readOrders();
    const orderId = req.params.id;
    const orderIndex = orders.findIndex(order => order.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const updatedOrder = {
      ...orders[orderIndex],
      customerInfo: {
        fullName: req.body.fullName || orders[orderIndex].customerInfo.fullName,
        phone: req.body.phone || orders[orderIndex].customerInfo.phone,
        address: req.body.address || orders[orderIndex].customerInfo.address
      },
      orderCost: parseFloat(req.body.orderCost) || orders[orderIndex].orderCost,
      materialCost: parseFloat(req.body.materialCost) || orders[orderIndex].materialCost,
      furnitureCost: parseFloat(req.body.furnitureCost) || orders[orderIndex].furnitureCost,
      taxiCost: parseFloat(req.body.taxiCost) || orders[orderIndex].taxiCost,
      deliveryCost: parseFloat(req.body.deliveryCost) || orders[orderIndex].deliveryCost,
      otherExpenses: req.body.otherExpenses ? JSON.parse(req.body.otherExpenses) : orders[orderIndex].otherExpenses,
      status: req.body.status || orders[orderIndex].status,
      source: req.body.source || orders[orderIndex].source,
      updatedAt: new Date().toISOString()
    };

    // Добавляем новые файлы
    if (req.files && req.files.length > 0) {
      const newFiles = req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path
      }));
      updatedOrder.files = [...(orders[orderIndex].files || []), ...newFiles];
    }

    orders[orderIndex] = updatedOrder;
    writeOrders(orders);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Ошибка при обновлении заказа' });
  }
});

// Удалить заказ
app.delete('/api/orders/:id', checkPin, (req, res) => {
  try {
    const orders = readOrders();
    const orderId = req.params.id;
    const orderIndex = orders.findIndex(order => order.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    // Удаляем файлы заказа
    const order = orders[orderIndex];
    if (order.files) {
      order.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    orders.splice(orderIndex, 1);
    writeOrders(orders);
    res.json({ message: 'Заказ удален' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Ошибка при удалении заказа' });
  }
});

// Удалить файл из заказа
app.delete('/api/orders/:id/files/:filename', checkPin, (req, res) => {
  try {
    const orders = readOrders();
    const orderId = req.params.id;
    const filename = req.params.filename;
    const orderIndex = orders.findIndex(order => order.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const order = orders[orderIndex];
    if (!order.files) {
      return res.status(404).json({ error: 'Файлы не найдены' });
    }

    const fileIndex = order.files.findIndex(file => file.filename === filename);

    if (fileIndex === -1) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    // Удаляем файл с диска
    const file = order.files[fileIndex];
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    order.files.splice(fileIndex, 1);
    writeOrders(orders);
    res.json({ message: 'Файл удален' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Ошибка при удалении файла' });
  }
});

// Страница управления сроками
app.get('/schedule', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

// Обновить сроки заказа
app.put('/api/orders/:id/schedule', checkPin, (req, res) => {
  try {
    const orders = readOrders();
    const orderId = req.params.id;
    const orderIndex = orders.findIndex(order => order.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }

    const updatedOrder = {
      ...orders[orderIndex],
      schedule: req.body.schedule || {},
      updatedAt: new Date().toISOString()
    };

    orders[orderIndex] = updatedOrder;
    writeOrders(orders);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Ошибка при обновлении сроков' });
  }
});

// Получить заказы в работе
app.get('/api/orders/in-progress', (req, res) => {
  try {
    const orders = readOrders();
    const inProgressOrders = orders.filter(order => order.status === 'В работе');
    res.json(inProgressOrders);
  } catch (error) {
    console.error('Error getting in-progress orders:', error);
    res.status(500).json({ error: 'Ошибка при получении заказов в работе' });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Папка заказов: ${__dirname}`);
});