function initPlugin() {
  if (document.getElementById('anro-toggle-btn')) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'anro-toggle-btn';
  toggleBtn.innerHTML = '📥'; 
  toggleBtn.title = 'Меню скачивания';
  document.body.appendChild(toggleBtn);

  const panel = document.createElement('div');
  panel.id = 'anro-panel';
  panel.innerHTML = `
    <h3>Скачивание картинок</h3>
    <button id="anro-start-btn">Запустить</button>
    <div id="anro-counter-display">Загружено: <span id="anro-count">0</span></div>
    <div class="footer">
      Разработано <a href="https://github.com/adjuster2004" target="_blank" style="color: #007bff; text-decoration: none;">@adjuster2004</a><br>
      2026 v 1.0.9
    </div>
  `;
  document.body.appendChild(panel);

  toggleBtn.addEventListener('click', () => {
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
  });

  setupLogic();
}

function setupLogic() {
  let isDownloading = false;
  let downloadedFiles = 0;
  let lastDownloadedPath = ""; 
  let waitCycles = 0;

  const startBtn = document.getElementById('anro-start-btn');
  const countSpan = document.getElementById('anro-count');

  startBtn.addEventListener('click', () => {
    if (isDownloading) {
      isDownloading = false;
      startBtn.textContent = 'Запустить';
      startBtn.classList.remove('stop');
      return;
    }

    isDownloading = true;
    downloadedFiles = 0;
    waitCycles = 0;
    lastDownloadedPath = "";
    countSpan.textContent = downloadedFiles;
    
    startBtn.textContent = 'Остановить';
    startBtn.classList.add('stop');
    
    processNextPage();
  });

  // Ищем окно "Подождите" снизу вверх
  function isLoading() {
    const dialogs = Array.from(document.querySelectorAll('.ui-dialog, .ui-blockui-content')).reverse();
    for (let dialog of dialogs) {
      const style = window.getComputedStyle(dialog);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        if (dialog.innerText && dialog.innerText.toLowerCase().includes('подождите')) {
          return true;
        }
      }
    }
    return false;
  }

  // Ищем лейбл с названием файла СНИЗУ ВВЕРХ (чтобы брать из активного окна)
  function getDocumentLabelText() {
    const labels = Array.from(document.querySelectorAll('label.ui-outputlabel.ui-widget')).reverse();
    for (let label of labels) {
      // Проверяем, что лейбл физически виден на экране
      if (label.offsetWidth > 0 || label.offsetHeight > 0) {
        const text = label.textContent.trim();
        if (/\.(jpg|jpeg|png|tif|tiff|pdf)\s*$/i.test(text)) {
          return text;
        }
      }
    }
    return null;
  }

  // Ищем активную кнопку перелистывания СНИЗУ ВВЕРХ
  function getNextButton() {
    const btns = Array.from(document.querySelectorAll('a.btn-watermark.btn-right')).reverse();
    for (let btn of btns) {
      // Проверяем, что кнопка видима и не заблокирована
      if (btn.offsetWidth > 0 || btn.offsetHeight > 0) {
        if (btn.style.display !== 'none' && !btn.classList.contains('ui-state-disabled')) {
          return btn;
        }
      }
    }
    return null;
  }

  function getLargestBase64Image() {
    let largestImage = null;
    let maxLength = 0;

    const allElements = document.querySelectorAll('*');
    for (let el of allElements) {
      for (let attr of el.attributes) {
        if (attr.value && attr.value.trim().startsWith('data:image')) {
          if (attr.value.length > maxLength) {
            maxLength = attr.value.length;
            largestImage = attr.value.trim();
          }
        }
      }
      
      const bgImage = window.getComputedStyle(el).backgroundImage;
      if (bgImage && bgImage !== 'none' && bgImage.includes('data:image')) {
        const match = bgImage.match(/url\(['"]?(data:image[^'"\)]+)['"]?\)/);
        if (match && match[1] && match[1].length > maxLength) {
          maxLength = match[1].length;
          largestImage = match[1];
        }
      }
    }

    return largestImage;
  }

  function finishDownload(message) {
    alert(message || `Скачивание завершено! Всего скачано файлов: ${downloadedFiles}`);
    isDownloading = false;
    startBtn.textContent = 'Запустить';
    startBtn.classList.remove('stop');
  }

  function processNextPage() {
    if (!isDownloading) return;

    if (isLoading()) {
      setTimeout(processNextPage, 500);
      return;
    }

    let fullText = getDocumentLabelText();
    let folderName = "anro_downloads"; 
    let fileName = `page_${downloadedFiles + 1}.png`;

    if (fullText) {
      const match = fullText.match(/(.*)\s+([^\s]+)$/);
      if (match) {
        folderName = match[1].trim().replace(/[<>:"/\\|?*]/g, ''); 
        fileName = match[2].trim().replace(/[<>:"/\\|?*]/g, '');
      } else {
        fileName = fullText.trim().replace(/[<>:"/\\|?*]/g, '');
      }
    }

    const fullPath = `${folderName}/${fileName}`;

    if (fullPath === lastDownloadedPath && lastDownloadedPath !== "") {
      waitCycles++;
      if (waitCycles > 20) { 
        finishDownload("Таймаут: страница не перелистывается. Завершаем работу.");
        return;
      }
      setTimeout(processNextPage, 500);
      return;
    }

    const imgSrc = getLargestBase64Image();

    if (imgSrc && imgSrc.length > 5000) {
      chrome.runtime.sendMessage({
        action: 'download',
        url: imgSrc,
        filename: fullPath
      });

      lastDownloadedPath = fullPath; 
      downloadedFiles++;
      countSpan.textContent = downloadedFiles;
      waitCycles = 0; 
    } else {
      waitCycles++;
      if (waitCycles > 20) {
        finishDownload("Таймаут: большая картинка не найдена в коде страницы.");
        return;
      }
      setTimeout(processNextPage, 500);
      return;
    }

    // Используем нашу новую функцию поиска кнопки
    const nextBtn = getNextButton();

    if (nextBtn) {
      nextBtn.click();
      setTimeout(processNextPage, 1000); 
    } else {
      finishDownload();
    }
  }
}

if (document.body) {
  initPlugin();
} else {
  document.addEventListener('DOMContentLoaded', initPlugin);

}
