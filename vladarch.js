// Текущая версия
const CURRENT_VERSION = "1.1.17";
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
    <button id="archive-start-btn">Запустить</button>
    <div id="archive-counter-display">Загружено: <span id="archive-count">0</span></div>
    <div id="archive-plugin-footer" style="margin-top: 15px; font-size: 11px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 10px; line-height: 1.4; display: block !important; visibility: visible !important;">
      Разработано <a href="https://github.com/adjuster2004" target="_blank" style="color: #007bff !important; display: inline !important; visibility: visible !important; text-decoration: none !important;">@adjuster2004</a><br>
      2026 v ${CURRENT_VERSION} 
      <span id="archive-update-badge" style="display: none !important; margin-top: 5px;">
        <br>
        <a href="https://github.com/adjuster2004/archives_plugin" target="_blank" style="color: red !important; font-weight: bold !important; display: inline !important; visibility: visible !important; text-decoration: none !important;">Доступно обновление!</a>
      </span>
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
      // Пока загрузка не идет, показываем сообщение из GitHub (если оно есть)
      const msgDiv = document.getElementById('archive-remote-message');
      if (msgDiv && !msgDiv.getAttribute('data-downloading') && data.message && data.message.trim() !== "") {
        msgDiv.innerHTML = data.message;
        msgDiv.style.display = 'block';
      }
      if (data.latest_version && data.latest_version !== CURRENT_VERSION) {
        const badge = document.getElementById('archive-update-badge');
        if (badge) badge.style.setProperty('display', 'inline', 'important');
      }
    })
    .catch(error => console.log('Archive Plugin: Не удалось проверить обновления', error));
}

function setupVladimirLogic() {
  let isDownloading = false;
  let downloadedFiles = 0;
  let lastImageUrl = ""; 
  let lastFrameStr = "";
  let waitCycles = 0;

  let isPaused = false;
  let pauseTimer = null;
  let pauseTimeLeft = 0;
  let lastPausedAt = 0;

  const startBtn = document.getElementById('archive-start-btn');
  const countSpan = document.getElementById('archive-count');
  const msgDiv = document.getElementById('archive-remote-message');

  startBtn.addEventListener('click', () => {
    if (isDownloading) {
      if (isPaused) {
        clearInterval(pauseTimer);
        isPaused = false;
        startBtn.textContent = 'Остановить';
        startBtn.style.backgroundColor = '';
        startBtn.style.color = '';
        
        // При ручном возобновлении возвращаем плашке статус активной загрузки
        if (msgDiv) {
          msgDiv.innerHTML = "⚠️ <b>Не закрывайте страницу, пока все листы не будут загружены!</b><br>Загрузка продолжается...";
        }
        
        turnPageToNext(); 
        setTimeout(processNextPage, 1500);
      } else {
        stopDownload();
      }
      return;
    }

    // НОВЫЙ СТАРТ СИСТЕМЫ
    isDownloading = true;
    isPaused = false;
    lastPausedAt = 0;
    downloadedFiles = parseInt(countSpan.textContent) || 0; 
    waitCycles = 0;
    lastImageUrl = "";
    lastFrameStr = "";
    countSpan.textContent = downloadedFiles;
    
    startBtn.textContent = 'Остановить';
    startBtn.classList.add('stop');
    
    // --- ДОБАВЛЕНО ТРЕБУЕМОЕ ПРЕДОХРАНИТЕЛЬНОЕ ПРЕДУПРЕЖДЕНИЕ ---
    if (msgDiv) {
      msgDiv.setAttribute('data-downloading', 'true');
      msgDiv.innerHTML = "⚠️ <b>Не закрывайте страницу, пока все листы не будут загружены!</b><br>Загрузка скоро начнется.";
      msgDiv.style.display = 'block';
    }
    
    processNextPage();
  });

  function stopDownload(message) {
    if (message) alert(message);
    isDownloading = false;
    isPaused = false;
    if (pauseTimer) clearInterval(pauseTimer);
    
    startBtn.textContent = 'Запустить';
    startBtn.classList.remove('stop');
    startBtn.style.backgroundColor = '';
    startBtn.style.color = '';
    
    // Прячем или очищаем плашку предупреждения при полной остановке
    if (msgDiv) {
      msgDiv.removeAttribute('data-downloading');
      msgDiv.style.display = 'none';
    }
  }

  function getViewerImage() {
    const img = document.querySelector('img[src*="imageViewer/image"]');
    if (img && img.src) return img.src;

    let largestSrc = null;
    let maxArea = 0;
    document.querySelectorAll('img').forEach(el => {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return;
      const area = el.clientWidth * el.clientHeight;
      if (area > maxArea && area > 20000) {
        maxArea = area;
        largestSrc = el.src;
      }
    });
    return largestSrc;
  }

  function getArchivePageInput() {
    const inputs = document.querySelectorAll('input[type="text"]');
    let targetInput = null;
    for (let input of inputs) {
      if (!isNaN(input.value) && input.value.trim() !== '') {
         let parentStr = input.parentNode ? input.parentNode.textContent : "";
         if (parentStr.includes('Масштаб') || parentStr.includes('%')) continue; 
         targetInput = input;
      }
    }
    return targetInput;
  }

  function getCurrentFrame() {
    const input = getArchivePageInput();
    if (input && input.value) return input.value.trim();
    return null;
  }

  function getTotalFrames() {
    const input = getArchivePageInput();
    if (input) {
       const container = input.closest('span') || input.parentElement.parentElement;
       if (container) {
           const text = container.textContent || "";
           const match = text.match(/из\s*(\d+)/i);
           if (match && match[1]) {
               return match[1];
           }
       }
    }
    return null;
  }

  function getBaseNameFromDOM() {
    const elements = document.querySelectorAll('div, span');
    for (let el of elements) {
      if (el.childElementCount === 0) {
        let text = el.textContent.trim();
        if (text.length > 3 && text.length < 60 && /\.(jpg|jpeg|png|tif|tiff)$/i.test(text)) {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            return text.replace(/[<>:"/\\|?*]/g, '_');
          }
        }
      }
    }
    return null;
  }

  function getSmartFileName(currentFrameStr) {
    const urlParams = new URLSearchParams(window.location.search);
    const objectId = urlParams.get('objectId') || 'unknown_doc';
    let folderName = `vladimir_doc_${objectId}`;
    
    let frameNumber = currentFrameStr ? String(currentFrameStr).padStart(4, '0') : String(downloadedFiles + 1).padStart(4, '0');
    let finalBaseName = getBaseNameFromDOM() || `page.jpg`;
    
    return `${folderName}/${frameNumber}_${finalBaseName}`;
  }

  function simulateRealClick(element) {
      if (!element) return;
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
          element.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
      });
  }

  function turnPageToNext() {
      const selectors = [
          '[title="Следующее"]', '[title*="Вперед"]', '[title*="След"]',
          '.ui-icon-seek-next', '.p-paginator-next', '.next-button'
      ];
      for (let s of selectors) {
          let el = document.querySelector(s);
          if (el && el.offsetWidth > 0) {
              simulateRealClick(el);
              return true;
          }
      }

      const btns = Array.from(document.querySelectorAll('a, button, .ui-button, .btn'))
          .filter(b => b.offsetWidth > 15 && b.offsetWidth < 60 && b.offsetHeight > 15);
      
      let rows = {};
      for(let b of btns) {
          let y = Math.round(b.getBoundingClientRect().top / 5) * 5; 
          if (!rows[y]) rows[y] = [];
          if (!rows[y].includes(b)) rows[y].push(b); 
      }

      for (let y in rows) {
          let rowBtns = rows[y];
          if (rowBtns.length >= 4) {
              rowBtns.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
              
              for (let i = 0; i <= rowBtns.length - 4; i++) {
                  let rects = [
                      rowBtns[i].getBoundingClientRect(),
                      rowBtns[i+1].getBoundingClientRect(),
                      rowBtns[i+2].getBoundingClientRect(),
                      rowBtns[i+3].getBoundingClientRect()
                  ];
                  
                  let gap1 = rects[1].left - rects[0].right;
                  let gap2 = rects[2].left - rects[1].right;
                  let gap3 = rects[3].left - rects[2].right;
                  
                  if (gap1 >= 0 && gap1 < 15 && gap2 >= 0 && gap2 < 15 && gap3 >= 0 && gap3 < 15) {
                      simulateRealClick(rowBtns[i+2]);
                      return true;
                  }
              }
          }
      }

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', keyCode: 39, bubbles: true }));
      
      return false;
  }

  function processNextPage() {
    if (!isDownloading) return;

    const pageHTML = document.body.innerHTML || "";
    if (pageHTML.includes("Срок действия абонемента закончен") || pageHTML.includes("продлите абонемент")) {
        stopDownload("🛑 Внимание: Срок действия абонемента закончен!\nСкачивание принудительно остановлено.");
        return; 
    }

    const imgSrc = getViewerImage();
    const currentFrameStr = getCurrentFrame();
    const totalFramesStr = getTotalFrames();

    if (!imgSrc || imgSrc === lastImageUrl || currentFrameStr === lastFrameStr) {
      waitCycles++;
      if (waitCycles > 30) {
        stopDownload("🤔 Таймаут: страница не перелистывается.\nВозможно, достигнут конец дела или завис интернет.");
        return;
      }
      setTimeout(processNextPage, 500);
      return;
    }

    const fullPath = getSmartFileName(currentFrameStr);
    
    try {
      chrome.runtime.sendMessage({
        action: 'download',
        url: imgSrc,
        filename: fullPath
      });
    } catch (error) {
      if (error.message.includes("Extension context invalidated")) {
        stopDownload("🤔 Внимание: Плагин был обновлен. Нажмите F5 на клавиатуре.");
        return;
      }
    }

    lastImageUrl = imgSrc; 
    lastFrameStr = currentFrameStr;
    downloadedFiles++;
    countSpan.textContent = downloadedFiles;
    waitCycles = 0; 

    if (currentFrameStr && totalFramesStr && parseInt(currentFrameStr, 10) >= parseInt(totalFramesStr, 10)) {
        stopDownload(`✅ Загрузка успешно завершена!\nСкачана последняя страница (${currentFrameStr} из ${totalFramesStr}).\nВсего файлов: ${downloadedFiles}`);
        return; 
    }

    // БЛОК ОХЛАЖДЕНИЯ (ПАУЗА КАЖДЫЕ 500 ЛИСТОВ)
    if (downloadedFiles > 0 && downloadedFiles % 500 === 0 && lastPausedAt !== downloadedFiles) {
        lastPausedAt = downloadedFiles;
        isPaused = true;
        pauseTimeLeft = 120; 
        
        startBtn.textContent = `Пауза: ${pauseTimeLeft}с (▶ Пуск)`;
        startBtn.style.backgroundColor = '#ffc107'; 
        startBtn.style.color = '#000';

        // Во время паузы обновляем плашку, напоминая о важности не закрывать вкладку
        if (msgDiv) {
          msgDiv.innerHTML = "⏳ <b>Техническая пауза на 2 минуты для разгрузки Chrome.</b><br>Пожалуйста, не закрывайте вкладку!";
        }

        pauseTimer = setInterval(() => {
            if (!isDownloading) {
                clearInterval(pauseTimer);
                return;
            }
            
            pauseTimeLeft--;
            
            if (pauseTimeLeft <= 0) {
                clearInterval(pauseTimer);
                isPaused = false;
                startBtn.textContent = 'Остановить';
                startBtn.style.backgroundColor = '';
                startBtn.style.color = '';
                
                if (msgDiv) {
                  msgDiv.innerHTML = "⚠️ <b>Не закрывайте страницу, пока все листы не будут загружены!</b><br>Загрузка продолжается...";
                }
                
                turnPageToNext();
                setTimeout(processNextPage, 1500);
            } else {
                startBtn.textContent = `Пауза: ${pauseTimeLeft}с (▶ Пуск)`;
            }
        }, 1000);

        return; 
    }

    turnPageToNext();
    setTimeout(processNextPage, 1500); 
  }
}

if (document.body) {
  initPlugin();
} else {
  document.addEventListener('DOMContentLoaded', initPlugin);
}