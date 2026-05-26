// Текущая версия
const CURRENT_VERSION = "1.1.8";
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
    <div class="footer">
      Разработано <a href="https://github.com/adjuster2004" target="_blank" style="color: #007bff; text-decoration: none;">@adjuster2004</a><br>
      2026 v ${CURRENT_VERSION} <span id="archive-update-badge" style="display:none;"><br><a href="https://github.com/adjuster2004/archives_plugin" target="_blank" style="color: red; font-weight: bold; text-decoration: none;">🆕 Доступно обновление!</a></span>
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
      if (data.message && data.message.trim() !== "") {
        const msgDiv = document.getElementById('archive-remote-message');
        msgDiv.textContent = data.message;
        msgDiv.style.display = 'block';
      }
      if (data.latest_version && data.latest_version !== CURRENT_VERSION) {
        document.getElementById('archive-update-badge').style.display = 'inline';
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

  const startBtn = document.getElementById('archive-start-btn');
  const countSpan = document.getElementById('archive-count');

  startBtn.addEventListener('click', () => {
    if (isDownloading) {
      stopDownload();
      return;
    }

    isDownloading = true;
    downloadedFiles = 0;
    waitCycles = 0;
    lastImageUrl = "";
    lastFrameStr = "";
    countSpan.textContent = downloadedFiles;
    
    startBtn.textContent = 'Остановить';
    startBtn.classList.add('stop');
    
    processNextPage();
  });

  function stopDownload(message) {
    if (message) alert(message);
    isDownloading = false;
    startBtn.textContent = 'Запустить';
    startBtn.classList.remove('stop');
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

  function getSmartFileName(currentFrameStr) {
    const urlParams = new URLSearchParams(window.location.search);
    const objectId = urlParams.get('objectId') || 'unknown_doc';
    let folderName = `vladimir_doc_${objectId}`;
    
    let baseName = "";

    const elements = document.querySelectorAll('div, span');
    for (let el of elements) {
      if (el.childElementCount === 0) {
        let text = el.textContent.trim();
        if (text.length > 3 && text.length < 60 && /\.(jpg|jpeg|png|tif|tiff)$/i.test(text)) {
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            baseName = text.replace(/[<>:"/\\|?*]/g, '_');
            break;
          }
        }
      }
    }

    if (!baseName) {
      baseName = currentFrameStr ? `${currentFrameStr}.jpg` : `page_${downloadedFiles + 1}.jpg`;
    }

    return `${folderName}/${baseName}`;
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

    // --- ПРЕДОХРАНИТЕЛЬ: ПРОВЕРКА НА ОКОНЧАНИЕ ПОДПИСКИ ---
    const pageText = document.body.innerText || "";
    if (pageText.includes("Срок действия абонемента закончен")) {
        stopDownload("🛑 Внимание: Срок действия абонемента закончен!\nСкачивание принудительно остановлено, чтобы не качать пустые файлы.");
        return;
    }

    const imgSrc = getViewerImage();
    const currentFrameStr = getCurrentFrame();

    if (!imgSrc || imgSrc === lastImageUrl || currentFrameStr === lastFrameStr) {
      waitCycles++;
      if (waitCycles > 30) {
        stopDownload("Таймаут: страница не перелистывается.\nВозможно, достигнут конец дела.");
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
        stopDownload("Внимание: Плагин был обновлен. Нажмите F5 на клавиатуре.");
        return;
      }
    }

    lastImageUrl = imgSrc; 
    lastFrameStr = currentFrameStr;
    downloadedFiles++;
    countSpan.textContent = downloadedFiles;
    waitCycles = 0; 

    turnPageToNext();
    
    setTimeout(processNextPage, 1500); 
  }
}

if (document.body) {
  initPlugin();
} else {
  document.addEventListener('DOMContentLoaded', initPlugin);
}