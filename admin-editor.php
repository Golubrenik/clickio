<?php
/**
 * Admin Editor - Landing Page Version
 * Редактор config.json для лендинга с поддержкой языков
 * 
 * @version 3.0
 */

session_start();

// ============= КОНФИГУРАЦИЯ =============
define('ADMIN_PASSWORD', '123'); // Рекомендуется изменить!
define('CONFIG_FILE', __DIR__ . '/config.json');
define('IMAGES_ROOT', __DIR__ . '/images');
define('ALLOWED_EXT', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB

// ============= CSRF ЗАЩИТА =============
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// ============= БЕЗОПАСНОСТЬ =============
function sanitizePath($path) {
    // Удаляем попытки выхода за пределы директории
    $path = str_replace(['../', '..\\'], '', $path);
    // Разрешаем только безопасные символы (включая точку для расширений)
    return preg_replace('/[^a-zA-Z0-9\/_\-\.]/', '', $path);
}

function sanitizeImagePath($path) {
    // Специальная функция для путей изображений
    // Убираем префикс img_ если есть
    $path = str_replace('img_', '', $path);
    // Удаляем попытки выхода за пределы директории
    $path = str_replace(['../', '..\\'], '', $path);
    // Декодируем URL-кодированные символы
    $path = urldecode($path);
    return $path;
}

// ============= ВЫХОД =============
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ' . basename(__FILE__));
    exit;
}

// ============= АВТОРИЗАЦИЯ =============
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    if (($_POST['password'] ?? '') === ADMIN_PASSWORD) {
        $_SESSION['auth'] = true;
        $_SESSION['login_time'] = time();
    } else {
        $loginError = 'Неверный пароль!';
    }
}

if (!isset($_SESSION['auth'])) {
    showLogin($loginError ?? null);
    exit;
}

// ============= ПРОВЕРКА ФАЙЛОВ =============
if (!file_exists(CONFIG_FILE)) {
    die('config.json не найден! Создайте файл config.json в директории со скриптом.');
}

$config = json_decode(file_get_contents(CONFIG_FILE), true);
if (!is_array($config)) {
    die('Ошибка чтения config.json!');
}

// Определяем структуру конфига
$configStructure = detectConfigStructure($config);
$availableLangs = $configStructure['langs'];
$currentLang = $_GET['lang'] ?? $availableLangs[0] ?? 'CONFIG_EN';

if (!in_array($currentLang, $availableLangs)) {
    $currentLang = $availableLangs[0];
}

// Получаем данные текущего языка
$langConfig = getLanguageConfig($config, $currentLang, $configStructure);

// ============= ОБРАБОТКА ДЕЙСТВИЙ =============
$message = null;
$messageType = 'success';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['csrf_token'])) {
    if (!verifyCSRFToken($_POST['csrf_token'])) {
        $message = 'Ошибка безопасности. Обновите страницу.';
        $messageType = 'error';
    } else {
        // === СОХРАНЕНИЕ КОНФИГУРАЦИИ ===
        if (isset($_POST['save_config'])) {
            try {
                $lang = $_POST['lang'] ?? $currentLang;
                
                // Получаем текущие данные языка
                $updatedLangData = getLanguageConfig($config, $lang, $configStructure);
                
                // Обновление полей
                foreach ($_POST['field'] ?? [] as $key => $value) {
                    // Проверяем что ключ существует или создаем его
                    $updatedLangData[$key] = trim($value);
                }
                
                // Сохраняем обратно в конфиг
                setLanguageConfig($config, $lang, $updatedLangData, $configStructure);
                
                // Сохранение с красивым форматированием
                $jsonData = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('Ошибка кодирования JSON: ' . json_last_error_msg());
                }
                
                if (file_put_contents(CONFIG_FILE, $jsonData) === false) {
                    throw new Exception('Не удалось сохранить файл config.json');
                }
                
                // Перезагружаем конфиг
                $config = json_decode($jsonData, true);
                $configStructure = detectConfigStructure($config);
                $langConfig = getLanguageConfig($config, $lang, $configStructure);
                
                $message = '✓ Конфигурация успешно сохранена!';
            } catch (Exception $e) {
                $message = '✗ Ошибка: ' . $e->getMessage();
                $messageType = 'error';
            }
        }
        
        // === ЗАГРУЗКА ИЗОБРАЖЕНИЙ ===
        if (isset($_POST['upload_images'])) {
            $uploadCount = 0;
            $errors = [];
            
            // Новая логика: ищем пары image_file_* и image_path_*
            foreach ($_FILES as $inputName => $file) {
                // Проверяем что это файл изображения (начинается с image_file_)
                if (strpos($inputName, 'image_file_') !== 0) {
                    continue;
                }
                
                if ($file['error'] === UPLOAD_ERR_OK && $file['size'] > 0) {
                    // Получаем hash из имени
                    $hash = str_replace('image_file_', '', $inputName);
                    
                    // Получаем путь из скрытого поля
                    $pathFieldName = 'image_path_' . $hash;
                    if (!isset($_POST[$pathFieldName])) {
                        $errors[] = 'Путь не найден для ' . basename($file['name']);
                        continue;
                    }
                    
                    $relPath = $_POST[$pathFieldName];
                    
                    // Проверка размера
                    if ($file['size'] > MAX_FILE_SIZE) {
                        $errors[] = basename($file['name']) . ' - слишком большой файл';
                        continue;
                    }
                    
                    // Безопасная обработка пути
                    $relPath = str_replace(['../', '..\\'], '', $relPath);
                    $fullPath = __DIR__ . '/' . $relPath;
                    $dir = dirname($fullPath);
                    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                    
                    // Валидация расширения
                    if (!in_array($ext, ALLOWED_EXT)) {
                        $errors[] = basename($file['name']) . ' - недопустимый формат';
                        continue;
                    }
                    
                    // Проверка что это действительно изображение
                    $imageInfo = @getimagesize($file['tmp_name']);
                    if ($imageInfo === false) {
                        $errors[] = basename($file['name']) . ' - не является изображением';
                        continue;
                    }
                    
                    // Создание директории если нужно
                    if (!is_dir($dir)) {
                        mkdir($dir, 0755, true);
                    }
                    
                    // Загрузка файла
                    if (move_uploaded_file($file['tmp_name'], $fullPath)) {
                        $uploadCount++;
                    } else {
                        $errors[] = basename($file['name']) . ' - ошибка загрузки';
                    }
                }
            }
            
            if ($uploadCount > 0) {
                $message = "✓ Загружено изображений: $uploadCount";
                if (count($errors) > 0) {
                    $message .= "<br>⚠ Ошибки: " . implode(', ', $errors);
                }
            } else if (count($errors) > 0) {
                $message = "✗ Ошибки: " . implode(', ', $errors);
                $messageType = 'error';
            }
        }
        
        // === УДАЛЕНИЕ ИЗОБРАЖЕНИЯ ===
        if (isset($_POST['delete_image'])) {
            $imagePath = sanitizePath($_POST['image_path']);
            $fullPath = __DIR__ . '/' . $imagePath;
            
            if (file_exists($fullPath) && is_file($fullPath)) {
                if (unlink($fullPath)) {
                    $message = '✓ Изображение удалено';
                } else {
                    $message = '✗ Ошибка при удалении';
                    $messageType = 'error';
                }
            }
        }
    }
}

// ============= СКАНИРОВАНИЕ ИЗОБРАЖЕНИЙ =============
function scanImages($dir, $base = 'images', $allowedExt = ALLOWED_EXT, $excludeFolders = ['flags']) {
    $results = [];
    if (!is_dir($dir)) return $results;
    
    $items = @scandir($dir);
    if ($items === false) return $results;
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        // Пропускаем исключенные папки
        if (is_dir($dir . '/' . $item) && in_array($item, $excludeFolders)) {
            continue;
        }
        
        $path = $dir . '/' . $item;
        $relPath = $base . '/' . $item;
        
        if (is_dir($path)) {
            $results = array_merge($results, scanImages($path, $relPath, $allowedExt, $excludeFolders));
        } elseif (is_file($path)) {
            $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            if (in_array($ext, $allowedExt)) {
                $results[] = [
                    'path' => $relPath,
                    'name' => $item,
                    'folder' => dirname($relPath),
                    'size' => filesize($path),
                    'modified' => filemtime($path)
                ];
            }
        }
    }
    return $results;
}

$allImages = scanImages(IMAGES_ROOT, 'images', ALLOWED_EXT);

usort($allImages, function($a, $b) {
    $folderCmp = strcmp($a['folder'], $b['folder']);
    return $folderCmp !== 0 ? $folderCmp : strcmp($a['name'], $b['name']);
});

function formatFileSize($bytes) {
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1048576) return round($bytes / 1024, 2) . ' KB';
    return round($bytes / 1048576, 2) . ' MB';
}

// ============= ОПРЕДЕЛЕНИЕ СТРУКТУРЫ КОНФИГА =============
function detectConfigStructure($config) {
    $structure = [
        'type' => 'flat', // flat или nested
        'langs' => [],
        'paths' => []
    ];
    
    // Проверяем наличие CONFIG_EN и LOCALES
    if (isset($config['CONFIG_EN']) && isset($config['LOCALES'])) {
        $structure['type'] = 'nested';
        $structure['langs'][] = 'CONFIG_EN';
        $structure['paths']['CONFIG_EN'] = ['CONFIG_EN'];
        
        // Добавляем языки из LOCALES
        foreach ($config['LOCALES'] as $locale => $data) {
            $structure['langs'][] = 'LOCALES/' . $locale;
            $structure['paths']['LOCALES/' . $locale] = ['LOCALES', $locale];
        }
    } else {
        // Простая плоская структура
        $structure['type'] = 'flat';
        $structure['langs'] = array_keys($config);
        foreach ($structure['langs'] as $lang) {
            $structure['paths'][$lang] = [$lang];
        }
    }
    
    return $structure;
}

function getLanguageConfig($config, $langKey, $structure) {
    $path = $structure['paths'][$langKey] ?? [];
    
    $current = $config;
    foreach ($path as $key) {
        if (isset($current[$key])) {
            $current = $current[$key];
        } else {
            return [];
        }
    }
    
    return is_array($current) ? $current : [];
}

function setLanguageConfig(&$config, $langKey, $newData, $structure) {
    $path = $structure['paths'][$langKey] ?? [];
    
    if (empty($path)) {
        return false;
    }
    
    // Навигация к нужному месту
    $current = &$config;
    foreach ($path as $key) {
        if (!isset($current[$key])) {
            $current[$key] = [];
        }
        $current = &$current[$key];
    }
    
    // Обновляем данные
    foreach ($newData as $key => $value) {
        $current[$key] = $value;
    }
    
    return true;
}

$csrfToken = generateCSRFToken();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 Admin Panel - Редактор лендинга</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #8b5cf6;
            --success: #10b981;
            --error: #ef4444;
            --bg-main: #f8fafc;
            --bg-card: #ffffff;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --border: #e2e8f0;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: var(--text-primary);
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: var(--bg-card);
            border-radius: 20px;
            box-shadow: var(--shadow-lg);
            overflow: hidden;
            animation: slideIn 0.5s ease-out;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            padding: 30px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .header h1 {
            font-size: 1.8em;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .header-info {
            display: flex;
            gap: 20px;
            align-items: center;
            font-size: 0.9em;
            flex-wrap: wrap;
        }
        
        .header-info .stat {
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        
        .lang-selector {
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        .lang-selector select {
            background: transparent;
            border: none;
            color: white;
            font-weight: 600;
            cursor: pointer;
            font-size: 1em;
            outline: none;
        }
        
        .lang-selector select option {
            background: var(--primary);
            color: white;
        }
        
        .logout-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 10px 24px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        
        .logout-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        
        .content {
            padding: 40px;
        }
        
        .notification {
            padding: 16px 24px;
            border-radius: 12px;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 500;
            animation: slideDown 0.3s ease-out;
        }
        
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .notification.success {
            background: #d1fae5;
            color: #065f46;
            border-left: 4px solid var(--success);
        }
        
        .notification.error {
            background: #fee2e2;
            color: #991b1b;
            border-left: 4px solid var(--error);
        }
        
        .notification i { font-size: 1.2em; }
        
        .section {
            margin-bottom: 50px;
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid var(--border);
        }
        
        .section-header h2 {
            font-size: 1.5em;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .section-header .badge {
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
        }
        
        .search-box {
            position: relative;
            margin-bottom: 20px;
        }
        
        .search-box input {
            width: 100%;
            padding: 14px 20px 14px 50px;
            border: 2px solid var(--border);
            border-radius: 12px;
            font-size: 1em;
            transition: all 0.3s;
            background: var(--bg-main);
        }
        
        .search-box input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        
        .search-box i {
            position: absolute;
            left: 18px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-secondary);
            font-size: 1.1em;
        }
        
        .text-block {
            background: var(--bg-main);
            border-radius: 12px;
            padding: 20px;
            max-height: 600px;
            overflow-y: auto;
        }
        
        .text-block::-webkit-scrollbar { width: 10px; }
        .text-block::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .text-block::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; }
        
        .text-item {
            background: white;
            padding: 16px;
            margin-bottom: 12px;
            border-radius: 10px;
            border: 2px solid var(--border);
            transition: all 0.3s;
        }
        
        .text-item:hover {
            border-color: var(--primary);
            box-shadow: var(--shadow);
        }
        
        .text-item label {
            display: block;
            font-weight: 600;
            font-size: 0.85em;
            color: var(--text-secondary);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .text-item input, .text-item textarea {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-size: 0.95em;
            transition: all 0.3s;
            font-family: inherit;
        }
        
        .text-item textarea {
            min-height: 80px;
            resize: vertical;
        }
        
        .text-item input:focus, .text-item textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        
        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
        }
        
        .img-card {
            background: white;
            border: 2px solid var(--border);
            border-radius: 16px;
            padding: 16px;
            transition: all 0.3s;
        }
        
        .img-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-lg);
            border-color: var(--primary);
        }
        
        .img-preview {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .img-preview:hover {
            transform: scale(1.05);
        }
        
        .img-card strong {
            display: block;
            margin-bottom: 8px;
            font-size: 0.9em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .img-info {
            display: flex;
            justify-content: space-between;
            font-size: 0.75em;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }
        
        .img-actions {
            display: flex;
            gap: 8px;
        }
        
        .file-input-wrapper {
            position: relative;
            overflow: hidden;
            flex: 1;
        }
        
        .file-input-wrapper input[type="file"] {
            position: absolute;
            left: -9999px;
        }
        
        .file-label {
            display: block;
            background: var(--primary);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            font-size: 0.8em;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .file-label:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
        }
        
        .delete-btn {
            background: var(--error);
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8em;
            font-weight: 600;
            transition: all 0.3s;
        }
        
        .delete-btn:hover {
            background: #dc2626;
            transform: translateY(-2px);
        }
        
        .folder-badge {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-weight: 600;
            margin: 25px 0 15px;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            box-shadow: var(--shadow);
        }
        
        .btn {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 14px 32px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            box-shadow: var(--shadow);
        }
        
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: var(--shadow-lg);
        }
        
        .btn-group {
            display: flex;
            gap: 15px;
            margin-top: 30px;
            flex-wrap: wrap;
        }
        
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        
        .modal.active { display: flex; }
        
        .modal-content {
            background: white;
            padding: 0;
            border-radius: 16px;
            max-width: 90%;
            max-height: 90%;
            overflow: hidden;
            box-shadow: var(--shadow-lg);
        }
        
        .modal-content img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .modal-close {
            position: absolute;
            top: 20px;
            right: 30px;
            color: white;
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            background: rgba(0, 0, 0, 0.5);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-close:hover {
            background: rgba(0, 0, 0, 0.8);
            transform: rotate(90deg);
        }
        
        @media (max-width: 768px) {
            .content { padding: 20px; }
            .header { flex-direction: column; text-align: center; }
            .images-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <h1>
            <i class="fas fa-palette"></i>
            Редактор лендинга
        </h1>
        <div class="header-info">
            <div class="lang-selector">
                <i class="fas fa-language"></i>
                <select onchange="window.location.href='?lang='+encodeURIComponent(this.value)">
                    <?php foreach ($availableLangs as $lang): ?>
                        <option value="<?= htmlspecialchars($lang) ?>" <?= $lang === $currentLang ? 'selected' : '' ?>>
                            <?= htmlspecialchars(str_replace('LOCALES/', '', $lang)) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="stat">
                <i class="fas fa-images"></i> <?= count($allImages) ?> изображений
            </div>
            <div class="stat">
                <i class="fas fa-file-alt"></i> <?= count($langConfig) ?> полей (<?= count(array_filter($langConfig, 'is_string')) ?> редактируемых)
            </div>
            <a href="?logout=1" class="logout-btn">
                <i class="fas fa-sign-out-alt"></i> Выйти
            </a>
        </div>
    </div>

    <div class="content">
        
        <?php if ($message): ?>
            <div class="notification <?= $messageType ?>">
                <i class="fas fa-<?= $messageType === 'success' ? 'check-circle' : 'exclamation-circle' ?>"></i>
                <span><?= $message ?></span>
            </div>
        <?php endif; ?>

        <form method="post" enctype="multipart/form-data" id="mainForm">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
            <input type="hidden" name="lang" value="<?= htmlspecialchars($currentLang) ?>">

            <!-- ТЕКСТОВЫЕ ПОЛЯ -->
            <div class="section">
                <div class="section-header">
                    <h2>
                        <i class="fas fa-keyboard"></i>
                        Тексты (<?= htmlspecialchars($currentLang) ?>)
                        <span class="badge"><?= count($langConfig) ?></span>
                    </h2>
                </div>

                <div class="search-box">
                    <i class="fas fa-search"></i>
                    <input type="text" id="textSearch" placeholder="🔍 Поиск..." autocomplete="off">
                </div>

                <div class="text-block" id="textList">
                    <?php foreach ($langConfig as $key => $value): ?>
                        <?php 
                        // Пропускаем массивы и объекты (questions.items и т.д.)
                        if (is_array($value)) {
                            // Сериализуем в JSON для отображения, но только для чтения
                            $jsonValue = json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                        ?>
                            <div class="text-item complex-field" data-key="<?= htmlspecialchars($key) ?>" data-value="[complex]">
                                <label>
                                    <i class="fas fa-code"></i> <?= htmlspecialchars($key) ?> <span style="color: #f59e0b;">(массив - только просмотр)</span>
                                </label>
                                <textarea name="field_readonly[<?= htmlspecialchars($key) ?>]" readonly style="background: #f8fafc; cursor: not-allowed;"><?= htmlspecialchars($jsonValue) ?></textarea>
                            </div>
                        <?php else: 
                            $strValue = is_string($value) ? $value : (string)$value;
                        ?>
                            <div class="text-item" data-key="<?= htmlspecialchars($key) ?>" data-value="<?= htmlspecialchars($strValue) ?>">
                                <label>
                                    <i class="fas fa-tag"></i> <?= htmlspecialchars($key) ?>
                                </label>
                                <?php if (strlen($strValue) > 100): ?>
                                    <textarea name="field[<?= htmlspecialchars($key) ?>]"><?= htmlspecialchars($strValue) ?></textarea>
                                <?php else: ?>
                                    <input type="text" name="field[<?= htmlspecialchars($key) ?>]" value="<?= htmlspecialchars($strValue) ?>">
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>

                <div class="btn-group">
                    <button type="submit" name="save_config" class="btn">
                        <i class="fas fa-save"></i>
                        <span>Сохранить конфигурацию</span>
                    </button>
                </div>
            </div>

            <!-- ИЗОБРАЖЕНИЯ -->
            <div class="section">
                <div class="section-header">
                    <h2>
                        <i class="fas fa-images"></i>
                        Изображения
                        <span class="badge"><?= count($allImages) ?></span>
                    </h2>
                </div>

                <?php if (empty($allImages)): ?>
                    <div class="notification error">
                        <i class="fas fa-info-circle"></i>
                        <span>Изображения не найдены в папке /images/</span>
                    </div>
                <?php else: ?>
                    <?php
                    $currentFolder = '';
                    foreach ($allImages as $img):
                        $folder = $img['folder'];
                        if ($folder !== $currentFolder):
                            if ($currentFolder !== '') echo '</div>';
                            echo '<div class="folder-badge"><i class="fas fa-folder"></i> ' . htmlspecialchars($folder) . '/</div>';
                            echo '<div class="images-grid">';
                            $currentFolder = $folder;
                        endif;
                    ?>
                        <div class="img-card">
                            <img 
                                src="<?= htmlspecialchars($img['path']) ?>?t=<?= time() ?>" 
                                alt="<?= htmlspecialchars($img['name']) ?>"
                                class="img-preview"
                                id="preview_<?= md5($img['path']) ?>"
                                onclick="openModal('<?= htmlspecialchars($img['path']) ?>')"
                            >
                            <strong title="<?= htmlspecialchars($img['name']) ?>">
                                <?= htmlspecialchars($img['name']) ?>
                            </strong>
                            <div class="img-info">
                                <span><i class="fas fa-hdd"></i> <?= formatFileSize($img['size']) ?></span>
                                <span><i class="fas fa-clock"></i> <?= date('d.m.y', $img['modified']) ?></span>
                            </div>
                            <div class="img-actions">
                                <div class="file-input-wrapper">
                                    <input 
                                        type="file" 
                                        name="image_file_<?= md5($img['path']) ?>" 
                                        id="file_<?= md5($img['path']) ?>"
                                        accept="image/*"
                                        onchange="previewImage(this, '<?= md5($img['path']) ?>')"
                                        data-image-path="<?= htmlspecialchars($img['path']) ?>"
                                    >
                                    <input type="hidden" name="image_path_<?= md5($img['path']) ?>" value="<?= htmlspecialchars($img['path']) ?>">
                                    <label for="file_<?= md5($img['path']) ?>" class="file-label">
                                        <i class="fas fa-upload"></i> Заменить
                                    </label>
                                </div>
                                <button 
                                    type="button" 
                                    class="delete-btn"
                                    onclick="confirmDelete('<?= htmlspecialchars($img['path']) ?>', '<?= htmlspecialchars($img['name']) ?>')"
                                >
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    <?php
                    endforeach;
                    if ($currentFolder !== '') echo '</div>';
                    ?>

                    <div class="btn-group">
                        <button type="submit" name="upload_images" class="btn">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <span>Загрузить изменения</span>
                        </button>
                    </div>
                <?php endif; ?>
            </div>
        </form>
    </div>
</div>

<div id="imageModal" class="modal" onclick="closeModal()">
    <span class="modal-close" onclick="closeModal()">&times;</span>
    <div class="modal-content" onclick="event.stopPropagation()">
        <img id="modalImage" src="" alt="">
    </div>
</div>

<form id="deleteForm" method="post" style="display: none;">
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
    <input type="hidden" name="delete_image" value="1">
    <input type="hidden" name="image_path" id="deleteImagePath">
</form>

<script>
document.getElementById('textSearch').addEventListener('input', function() {
    const query = this.value.toLowerCase();
    document.querySelectorAll('.text-item').forEach(item => {
        const key = item.getAttribute('data-key').toLowerCase();
        const value = item.getAttribute('data-value').toLowerCase();
        item.style.display = (key.includes(query) || value.includes(query)) ? 'block' : 'none';
    });
});

function previewImage(input, imgId) {
    if (input.files && input.files[0]) {
        if (input.files[0].size > <?= MAX_FILE_SIZE ?>) {
            alert('⚠ Файл слишком большой! Максимум <?= round(MAX_FILE_SIZE / 1048576, 1) ?> MB');
            input.value = '';
            return;
        }
        
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(input.files[0].type)) {
            alert('⚠ Недопустимый формат!');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('preview_' + imgId);
            img.src = e.target.result;
            img.style.border = '3px solid #10b981';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function openModal(imagePath) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.classList.add('active');
    modalImg.src = imagePath + '?t=' + new Date().getTime();
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
});

function confirmDelete(imagePath, imageName) {
    if (confirm('🗑 Удалить "' + imageName + '"?')) {
        document.getElementById('deleteImagePath').value = imagePath;
        document.getElementById('deleteForm').submit();
    }
}

setTimeout(() => {
    document.querySelectorAll('.notification').forEach(notif => {
        notif.style.transition = 'opacity 0.5s';
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    });
}, 5000);

let formChanged = false;
document.getElementById('mainForm').addEventListener('change', () => formChanged = true);
window.addEventListener('beforeunload', function(e) {
    if (formChanged) {
        e.preventDefault();
        e.returnValue = '';
    }
});
document.getElementById('mainForm').addEventListener('submit', () => formChanged = false);
</script>

</body>
</html>

<?php
function showLogin($error = null) {
    $csrfToken = generateCSRFToken();
    ?>
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🔐 Вход</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .login-container {
                background: white;
                padding: 50px;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                width: 100%;
                max-width: 420px;
            }
            .login-header {
                text-align: center;
                margin-bottom: 40px;
            }
            .login-header i {
                font-size: 4em;
                color: #6366f1;
                margin-bottom: 20px;
            }
            .login-header h2 {
                color: #1e293b;
                font-size: 1.8em;
                margin-bottom: 10px;
            }
            .form-group {
                margin-bottom: 25px;
            }
            .form-group label {
                display: block;
                margin-bottom: 8px;
                color: #475569;
                font-weight: 600;
            }
            .input-wrapper {
                position: relative;
            }
            .input-wrapper i {
                position: absolute;
                left: 16px;
                top: 50%;
                transform: translateY(-50%);
                color: #94a3b8;
            }
            .form-group input {
                width: 100%;
                padding: 14px 20px 14px 45px;
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                font-size: 1em;
                transition: all 0.3s;
            }
            .form-group input:focus {
                outline: none;
                border-color: #6366f1;
                box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
            }
            .error-message {
                background: #fee2e2;
                color: #991b1b;
                padding: 12px;
                border-radius: 10px;
                margin-bottom: 20px;
                text-align: center;
            }
            .btn-login {
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.1em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }
            .btn-login:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="login-header">
                <i class="fas fa-lock"></i>
                <h2>Вход</h2>
            </div>
            
            <?php if ($error): ?>
                <div class="error-message"><?= htmlspecialchars($error) ?></div>
            <?php endif; ?>
            
            <form method="post">
                <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken) ?>">
                <div class="form-group">
                    <label><i class="fas fa-key"></i> Пароль</label>
                    <div class="input-wrapper">
                        <i class="fas fa-lock"></i>
                        <input type="password" name="password" placeholder="Введите пароль..." required autofocus>
                    </div>
                </div>
                <button type="submit" name="login" class="btn-login">
                    <i class="fas fa-sign-in-alt"></i> Войти
                </button>
            </form>
        </div>
    </body>
    </html>
    <?php
    exit;
}
?>
