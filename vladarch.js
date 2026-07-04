// Текущая версия плагина: 2.6.0 (Добавлен парсинг метаданных и генерация TXT файла)
const CURRENT_VERSION = "2.6.0"; 
const INFO_URL = "https://raw.githubusercontent.com/adjuster2004/archives_plugin/main/info.json";

function initPlugin() {
  if (document.getElementById('archive-toggle-btn')) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'archive-toggle-btn';
  toggleBtn.innerHTML = '📥'; 
  toggleBtn.title = 'Меню скачивания';
  document.body.appendChild(toggleBtn);

  const panel = document.createElement('div');
  panel.id = 'archive-panel';
  panel.innerHTML = `
    <h3>Владимирский архив</h3>
    <div id="archive-remote-message" style="display:none; color: #856404; background-color: #fff3cd; padding: 8px; margin-bottom: 10px; border-radius: 4px; font-size: 11px; line-height: 1.3; border: 1px solid #ffeeba;"></div>
    
    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
      <div style="flex: 1;">
        <label for="archive-start-serial" style="font-size: 11px; display: block; margin-bottom: 4px; font-weight: bold; color: #333;">Начать с листа:</label>
        <input type="number" id="archive-start-serial" value="1" min="1" style="width: 100%; padding: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
      </div>
      <div style="flex: 1;">
        <label for="archive-image-size" title="Чем больше размер, тем больше разрешение картинок, но и тяжелее файлы. Оптимально: 10" style="font-size: 11px; display: block; margin-bottom: 4px; font-weight: bold; color: #333; cursor: help; border-bottom: 1px dotted #ccc; width: max-content;">Размер <span style="color: #007bff; font-weight: normal;">(?)</span>:</label>
        <input type="number" id="archive-image-size" value="10" min="5" max="20" style="width: 100%; padding: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;">
      </div>
    </div>

    <button id="archive-start-btn">Запустить</button>
    <div id="archive-counter-display">Загружено: <span id="archive-count">0</span></div>
    
    <div id="archive-absolute-display" style="text-align: center; font-size: 13px; color: #555; margin-top: 5px;">Текущий лист: <span id="archive-absolute-count" style="font-weight: bold;">-</span></div>

    <div id="archive-plugin-footer" style="margin-top: 15px; font-size: 11px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 10px; line-height: 1.4; display: block !important; visibility: visible !important;">
      Разработано <a href="https://github.com/adjuster2004" target="_blank" style="color: #007bff !important; display: inline !important; visibility: visible !important; text-decoration: none !important;">@adjuster2004</a><br>
      2026 v ${CURRENT_VERSION} 
    </div>
  `;
  document.body.appendChild(panel);

  toggleBtn.addEventListener('click', () => {
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
  });

  fetchUpdateInfo();
  setupVladimirLogic();
}

function fetchUpdateInfo() {
  fetch(INFO_URL + '?t=' + new Date().getTime())
    .then(response => response.json())
    .then(data => {
      const msgDiv = document.getElementById('archive-remote-message');
      if (msgDiv && data.message && data.message.trim() !== "") {
        msgDiv.innerHTML = data.message;
        msgDiv.style.display = 'block';
      }
    })
    .catch(error => console.log('Archive Plugin: Не удалось проверить обновления', error));
}

function setupVladimirLogic() {
  let isDownloading = false;
  let downloadedCount = 0;

  const startBtn = document.getElementById('archive-start-btn');
  const countSpan = document.getElementById('archive-count');
  const absoluteSpan = document.getElementById('archive-absolute-count'); 
  const msgDiv = document.getElementById('archive-remote-message');
  const startSerialInput = document.getElementById('archive-start-serial');
  const sizeInput = document.getElementById('archive-image-size');

  // Функция для парсинга таблицы и сбора метаданных дела
  function extractMetadata() {
    let meta = { fond: "", opis: "", delo: "", pages: "", dates: "" };
    const rows = document.querySelectorAll('table.table-bordered tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
            const label = cells[0].textContent.trim();
            const value = cells[1].textContent.trim();
            
            if (label === 'Номер фонда') meta.fond = value;
            else if (label === 'Номер описи') meta.opis = value;
            else if (label === 'Номер дела') meta.delo = value;
            else if (label === 'Количество листов') meta.pages = value;
            else if (label === 'Хронологические рамки') meta.dates = value;
        }
    });
    
    // Функция для очистки строк от спецсимволов, которые запрещены в именах файлов
    const safe = (str) => str.replace(/[<>:"/\\|?*\n\r]/g, '_').trim();
    
    return {
        fond: safe(meta.fond) || "Неизвестно",
        opis: safe(meta.opis) || "Неизвестно",
        delo: safe(meta.delo) || "Неизвестно",
        pages: safe(meta.pages) || "Неизвестно",
        dates: safe(meta.dates) || "Неизвестно"
    };
  }

  function stopDownload(message) {
    if (message) alert(message);
    isDownloading = false;
    startBtn.textContent = 'Запустить';
    startBtn.classList.remove('stop');
    startBtn.style.backgroundColor = '';
    
    if (startSerialInput) startSerialInput.disabled = false;
    if (sizeInput) sizeInput.disabled = false;
    
    if (msgDiv) {
      msgDiv.style.display = 'none';
    }
  }

  async function downloadLoop(objId, attrId, startSerial, imgSize) {
    let serial = startSerial; 
    let folderName = `vladimir_doc_${objId}`;

    while (isDownloading) {
      if (downloadedCount > 0 && downloadedCount % 500 === 0) {
        console.log(`Скачано ${downloadedCount} файлов. Уходим на паузу 60 секунд...`);
        if (msgDiv) {
          msgDiv.innerHTML = `☕ <b>Перерыв!</b><br>Скачано ${downloadedCount} листов. Ждем 60 секунд перед продолжением...`;
          msgDiv.style.backgroundColor = '#d1ecf1'; 
          msgDiv.style.borderColor = '#bee5eb';
          msgDiv.style.color = '#0c5460';
        }
        
        await new Promise(r => setTimeout(r, 60000)); 
        
        if (!isDownloading) break; 
        
        if (msgDiv) {
          msgDiv.innerHTML = `⚡ <b>Прямая загрузка продолжается!</b><br>Скачиваем дело <b>${objId}</b>.`;
          msgDiv.style.backgroundColor = '#fff3cd';
          msgDiv.style.borderColor = '#ffeeba';
          msgDiv.style.color = '#856404';
        }
      }

      let url = `https://vladimir.kaisa.ru/getImage?objectId=${objId}&attributeId=${attrId}&serial=${serial}&size=${imgSize}&refresh=true&ext=jpg`;
      let fileName = `${folderName}/${objId}_${String(serial).padStart(4, '0')}.jpg`;

      try {
        let response = await fetch(url, { credentials: 'include' });

        let contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("image")) {
          console.log(`Загрузка завершена. Сервер вернул не картинку на serial=${serial}`);
          stopDownload(`✅ Загрузка успешно завершена!\nВсего скачано за сессию: ${downloadedCount}`);
          
          if (window.lastObjectUrl) {
              URL.revokeObjectURL(window.lastObjectUrl);
          }
          break;
        }

        let blob = await response.blob();
        let objectUrl = URL.createObjectURL(blob);

        chrome.runtime.sendMessage({
          action: 'download',
          url: objectUrl,
          filename: fileName
        });

        if (window.lastObjectUrl) {
            URL.revokeObjectURL(window.lastObjectUrl);
        }
        window.lastObjectUrl = objectUrl;

        downloadedCount++;
        countSpan.textContent = downloadedCount;
        
        if (absoluteSpan) {
          absoluteSpan.textContent = serial; 
        }
        
        serial++; 

        let delay = Math.floor(Math.random() * 20) + 100;
        await new Promise(r => setTimeout(r, delay));

      } catch (err) {
        console.error("Сбой сети при загрузке:", err);
        if (msgDiv) {
          msgDiv.innerHTML = "⏳ <b>Произошел сбой сети.</b> Ждем 10 секунд перед повторной попыткой...";
          msgDiv.style.backgroundColor = '#f8d7da'; 
          msgDiv.style.borderColor = '#f5c6cb';
          msgDiv.style.color = '#721c24';
          msgDiv.style.display = 'block';
        }
        await new Promise(r => setTimeout(r, 10000));
        
        if (isDownloading) {
          if (msgDiv) {
             msgDiv.style.backgroundColor = '#fff3cd';
             msgDiv.style.borderColor = '#ffeeba';
             msgDiv.style.color = '#856404';
             msgDiv.innerHTML = `⚡ <b>Прямая загрузка продолжается!</b><br>Скачиваем дело <b>${objId}</b>.`;
          }
          continue; 
        }
        break;
      }
    }
  }

  startBtn.addEventListener('click', () => {
    if (isDownloading) {
      stopDownload("Загрузка остановлена пользователем.");
      return;
    }

    const firstLink = document.querySelector('a[href*="objectId="][href*="attributeId="]');
    
    if (!firstLink) {
      alert("🤔 Не удалось найти таблицу с документами. Убедитесь, что открыта вкладка 'Отсканированные документы'.");
      return;
    }

    try {
      const href = firstLink.getAttribute('href');
      const urlParams = new URLSearchParams(href.split('?')[1]);
      
      const objId = urlParams.get('objectId');
      const attrId = urlParams.get('attributeId');

      if (!objId || !attrId) {
        alert("Ошибка: Не удалось извлечь идентификаторы из таблицы превью.");
        return;
      }

      let startSerial = parseInt(startSerialInput.value, 10);
      if (isNaN(startSerial) || startSerial < 1) {
        startSerial = 1;
        startSerialInput.value = 1;
      }

      let imgSize = parseInt(sizeInput.value, 10);
      if (isNaN(imgSize) || imgSize < 5) {
        imgSize = 5;
      } else if (imgSize > 20) {
        imgSize = 20;
      }
      sizeInput.value = imgSize; 

      // === ФОРМИРУЕМ И СКАЧИВАЕМ TXT ФАЙЛ С ИНФОРМАЦИЕЙ ===
      let folderName = `vladimir_doc_${objId}`;
      const meta = extractMetadata();
      
      const txtContent = `Ссылка на дело: ${window.location.href}`;
      const txtBlob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const txtUrl = URL.createObjectURL(txtBlob);
      
      const txtFileName = `${folderName}/${meta.fond} - ${meta.opis} - ${meta.delo} - ${meta.pages} - ${meta.dates}.txt`;

      chrome.runtime.sendMessage({
        action: 'download',
        url: txtUrl,
        filename: txtFileName
      });
      // ====================================================

      isDownloading = true;
      startSerialInput.disabled = true;
      sizeInput.disabled = true;
      downloadedCount = 0;
      countSpan.textContent = downloadedCount;
      if (absoluteSpan) absoluteSpan.textContent = '-'; 
      startBtn.textContent = 'Остановить';
      startBtn.classList.add('stop');

      if (msgDiv) {
        msgDiv.innerHTML = `⚡ <b>Прямая загрузка активирована!</b><br>Скачиваем дело <b>${objId}</b> начиная с листа <b>${startSerial}</b> (Качество: <b>${imgSize}</b>).`;
        msgDiv.style.backgroundColor = '#fff3cd'; 
        msgDiv.style.borderColor = '#ffeeba';
        msgDiv.style.color = '#856404';
        msgDiv.style.display = 'block';
      }

      downloadLoop(objId, attrId, startSerial, imgSize);

    } catch (e) {
      console.error("Ошибка при парсинге параметров старта:", e);
      alert("Произошла ошибка при инициализации парсера.");
    }
  });
}

if (document.body) {
  initPlugin();
} else {
  document.addEventListener('DOMContentLoaded', initPlugin);
}