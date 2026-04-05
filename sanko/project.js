(() => {
  // 从 URL 获取项目 ID
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id') ? parseInt(params.get('id'), 10) : null;

  // 获取项目数据
  const project = projectId !== null 
    ? projectsData.find(p => p.id === projectId) 
    : null;

  // 如果没有找到项目，显示错误信息
  if (!project) {
    document.getElementById('page-title').textContent = 'Project Not Found';
    document.getElementById('project-title').textContent = 'Project Not Found';
    document.querySelector('.main-image-container').innerHTML = '<p style="text-align:center;padding:50px;">项目不存在 / Project not found</p>';
    document.querySelector('.thumbnail-strip').style.display = 'none';
    throw new Error('Project not found');
  }

  function getProjectAssetBase(projectData) {
    return projectData.assetBase || 'programs';
  }

  function encodePathSegments(...parts) {
    return parts
      .flatMap((part) => String(part).split('/'))
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  function getProjectMetaSuffix(projectData, lang) {
    const isFieldTrip = Array.isArray(projectData.categories) && projectData.categories.includes('field-trip');
    if (isFieldTrip) {
      return lang === 'zh' ? '（习作）' : ' (Field Trip)';
    }
    const client = lang === 'zh' ? projectData.designer : projectData.designerEn;
    if (!client) return '';
    return lang === 'zh' ? `（委托方：${client}）` : `（Client: ${client}）`;
  }

  // 构建图片路径数组（对路径进行 URL 编码以支持中文和空格）
  const images = project.images.map((img) =>
    `./${encodePathSegments('img', getProjectAssetBase(project), project.folder, img)}`
  );
  const thumbnailImages = project.images.map((img) =>
    `./${encodePathSegments(
      'img',
      `${getProjectAssetBase(project)}-thumbs`,
      project.folder,
      img.replace(/\.[^.]+$/, '.webp')
    )}`
  );

  // ========== 语言切换功能 ==========
  // 从 localStorage 读取保存的语言偏好
  let currentLang = localStorage.getItem('preferredLanguage') || 'en';
  
  // 初始化语言状态
  function initLanguage() {
    // 根据保存的语言设置 body 类
    if (currentLang === 'zh') {
      document.body.classList.add('lang-zh');
      document.body.classList.remove('lang-en');
    } else {
      document.body.classList.add('lang-en');
      document.body.classList.remove('lang-zh');
    }
  }
  
  initLanguage();

  // 设置项目标题
  function updateProjectTitle() {
    const title = currentLang === 'zh' ? project.title : project.titleEn;
    const designerInfo = getProjectMetaSuffix(project, currentLang);

    document.getElementById('page-title').textContent = title;
    document.getElementById('project-title').textContent = title + designerInfo;
  }
  
  updateProjectTitle();

  // ========== 图片浏览功能 ==========
  let currentIndex = 0;
  const mainImage = document.getElementById('main-image');
  if (mainImage) {
    mainImage.loading = 'eager';
    mainImage.decoding = 'async';
    mainImage.fetchPriority = 'high';
  }
  const mainImageContainer = document.querySelector('.main-image-container');
  const carouselTrack = document.getElementById('carousel-track');
  const panelPrev = document.getElementById('panel-prev');
  const panelCurr = document.getElementById('panel-curr');
  const panelNext = document.getElementById('panel-next');
  const panelPrevImage = panelPrev ? panelPrev.querySelector('img') : null;
  const panelCurrImage = panelCurr ? panelCurr.querySelector('img') : null;
  const panelNextImage = panelNext ? panelNext.querySelector('img') : null;
  const panelPrevStatus = panelPrev ? panelPrev.querySelector('.image-status') : null;
  const panelCurrStatus = panelCurr ? panelCurr.querySelector('.image-status') : null;
  const panelNextStatus = panelNext ? panelNext.querySelector('.image-status') : null;
  if (panelPrevImage) {
    panelPrevImage.decoding = 'async';
    panelPrevImage.loading = 'eager';
    panelPrevImage.fetchPriority = 'low';
  }
  if (panelCurrImage) {
    panelCurrImage.decoding = 'async';
    panelCurrImage.loading = 'eager';
    panelCurrImage.fetchPriority = 'high';
  }
  if (panelNextImage) {
    panelNextImage.decoding = 'async';
    panelNextImage.loading = 'eager';
    panelNextImage.fetchPriority = 'low';
  }
  const thumbnailContainer = document.getElementById('thumbnail-container');
  const thumbnailElements = [];
  let isAnimating = false;
  let queuedNavigation = null;
  let activeAnimationFinish = null;
  function getImageLoadingText() {
    return currentLang === 'zh' ? '图片加载中' : 'Loading image...';
  }

  function getImageErrorText() {
    return currentLang === 'zh' ? '图片加载失败' : 'Image unavailable';
  }

  function setPanelState(panel, statusElement, state, message = '') {
    if (!panel) return;
    panel.classList.remove('is-loading', 'is-ready', 'is-error');
    if (state) {
      panel.classList.add(state);
    }
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  function loadThumbnailImage(img, index) {
    if (!img) return;
    const thumbnailSrc = thumbnailImages[index];
    const fallbackSrc = images[index];
    img.onerror = () => {
      if (img.src !== fallbackSrc) {
        img.src = fallbackSrc;
      }
    };
    img.src = thumbnailSrc;
  }

  function queueNavigation(action) {
    queuedNavigation = action;
    if (isAnimating && typeof activeAnimationFinish === 'function') {
      activeAnimationFinish();
    }
  }

  function flushQueuedNavigation() {
    if (!queuedNavigation) return;
    const action = queuedNavigation;
    queuedNavigation = null;

    window.requestAnimationFrame(() => {
      if (action.type === 'step') {
        animateStep(action.direction);
      } else if (action.type === 'jump') {
        switchImage(action.index);
      }
    });
  }

  // 生成缩略图（懒加载优化）
  images.forEach((src, index) => {
    const img = document.createElement('img');
    img.alt = `Image ${index + 1}`;
    img.className = 'thumbnail';
    img.decoding = 'async';
    img.loading = 'lazy';

    // 首屏只加载前 10 张缩略图，其余使用懒加载，减少首屏压力
    if (index < 4) {
      loadThumbnailImage(img, index);
    } else {
      img.dataset.src = thumbnailImages[index];
      img.dataset.fallbackSrc = images[index];
    }
    if (index === 0) {
      img.classList.add('active');
    }
    thumbnailElements.push(img);

    // 点击缩略图切换主图
    img.addEventListener('click', () => {
      if (index === currentIndex) return;

      if (isAnimating) {
        if (index === currentIndex + 1) {
          queueNavigation({ type: 'step', direction: 1 });
        } else if (index === currentIndex - 1) {
          queueNavigation({ type: 'step', direction: -1 });
        } else {
          queueNavigation({ type: 'jump', index });
        }
        return;
      }

      if (index === currentIndex + 1) {
        animateStep(1);
      } else if (index === currentIndex - 1) {
        animateStep(-1);
      } else {
        switchImage(index);
      }
    });

    thumbnailContainer.appendChild(img);
  });

  // 使用 IntersectionObserver 懒加载后面的缩略图
  if ('IntersectionObserver' in window) {
    const lazyObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset && img.dataset.src) {
            const thumbnailSrc = img.dataset.src;
            const fallbackSrc = img.dataset.fallbackSrc;
            img.onerror = () => {
              if (fallbackSrc && img.src !== fallbackSrc) {
                img.src = fallbackSrc;
              }
            };
            img.src = thumbnailSrc;
            delete img.dataset.src;
            delete img.dataset.fallbackSrc;
          }
          observer.unobserve(img);
        }
      });
    }, {
      root: document.querySelector('.thumbnail-strip'),
      rootMargin: '50px',
      threshold: 0.1
    });

    document.querySelectorAll('.thumbnail[data-src]').forEach(img => {
      lazyObserver.observe(img);
    });
  } else {
    document.querySelectorAll('.thumbnail').forEach((img, index) => {
      if (!img.src) {
        loadThumbnailImage(img, index);
      }
    });
  }

  // 图片预加载缓存
  const preloadedImages = new Map();
  let idlePreloadHandle = null;

  function getNearbyImageSources(index) {
    const nearbyIndexes = [index - 2, index - 1, index + 1, index + 2];
    return new Set(
      nearbyIndexes
        .filter((targetIndex) => targetIndex >= 0 && targetIndex < images.length)
        .map((targetIndex) => images[targetIndex])
    );
  }

  function prunePreloadedImages(index) {
    const keepSources = getNearbyImageSources(index);
    for (const src of preloadedImages.keys()) {
      if (!keepSources.has(src)) {
        preloadedImages.delete(src);
      }
    }
  }
  
  // 预加载图片函数
  function preloadImage(src) {
    if (!src) return Promise.resolve(null);
    const cached = preloadedImages.get(src);
    if (cached) return cached;

    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.fetchPriority = 'low';

    const ready = new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        resolve(img);
      };

      img.onload = finish;
      img.onerror = () => resolve(img);
      img.src = src;

      if (img.complete) {
        finish();
      }
    });

    preloadedImages.set(src, ready);
    return ready;
  }
  
  function runIdle(task) {
    if ('requestIdleCallback' in window) {
      return window.requestIdleCallback(task, { timeout: 300 });
    }
    return window.setTimeout(task, 60);
  }

  function cancelIdle(handle) {
    if (!handle) return;
    if ('cancelIdleCallback' in window) {
      window.cancelIdleCallback(handle);
      return;
    }
    window.clearTimeout(handle);
  }

  // 只预热下一跳之外的两张，避免一次性解码太多 3000px 原图
  function preloadNearbyImages(index) {
    cancelIdle(idlePreloadHandle);
    prunePreloadedImages(index);
    idlePreloadHandle = runIdle(() => {
      const targets = [index - 2, index - 1, index + 1, index + 2];
      targets.forEach((targetIndex) => {
        if (targetIndex >= 0 && targetIndex < images.length) {
          preloadImage(images[targetIndex]);
        }
      });
    });
  }

  function setPanelImage(panel, panelImage, statusElement, src) {
    if (!panelImage) return;
    if (!src) {
      panelImage.removeAttribute('src');
      panelImage.style.visibility = 'hidden';
      setPanelState(panel, statusElement, null, '');
      return;
    }

    const showLoaded = () => {
      panelImage.style.visibility = 'visible';
      setPanelState(panel, statusElement, 'is-ready', '');
    };

    panelImage.onload = showLoaded;
    panelImage.onerror = () => {
      panelImage.style.visibility = 'hidden';
      setPanelState(panel, statusElement, 'is-error', getImageErrorText());
    };

    if (panelImage.getAttribute('src') !== src) {
      panelImage.style.visibility = 'hidden';
      setPanelState(panel, statusElement, 'is-loading', getImageLoadingText());
      panelImage.src = src;
      if (panelImage.complete) {
        if (panelImage.naturalWidth > 0) {
          showLoaded();
        } else {
          panelImage.onerror();
        }
      }
      return;
    }

    if (panelImage.complete && panelImage.naturalWidth > 0) {
      showLoaded();
    } else {
      panelImage.style.visibility = 'hidden';
      setPanelState(panel, statusElement, 'is-loading', getImageLoadingText());
    }
  }

  function syncActiveThumbnail(index) {
    thumbnailElements.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });

    const activeThumbnail = thumbnailElements[index];
    if (activeThumbnail) {
      activeThumbnail.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
    }
  }

  // 根据当前索引刷新三面板图片
  function updateCarouselImages() {
    if (!panelCurrImage) return;

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : null;
    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : null;

    setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, images[currentIndex]);
    setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, prevIndex !== null ? images[prevIndex] : null);
    setPanelImage(panelNext, panelNextImage, panelNextStatus, nextIndex !== null ? images[nextIndex] : null);
    
    // 预加载相邻图片
    preloadNearbyImages(currentIndex);
  }

  // 初始化一次主图三面板
  updateCarouselImages();
  
  // 初始时只预热第一跳之外的图片，避免首屏一次吃太多原图
  preloadNearbyImages(0);

  // 切换图片函数
  function switchImage(index) {
    if (index === currentIndex || index < 0 || index >= images.length) return;
    if (isAnimating) {
      queueNavigation({ type: 'jump', index });
      return;
    }
    currentIndex = index;

    updateCarouselImages();
    syncActiveThumbnail(index);
  }

  // 键盘导航
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      if (currentIndex > 0) {
        animateStep(-1);
      }
    } else if (e.key === 'ArrowRight') {
      if (currentIndex < images.length - 1) {
        animateStep(1);
      }
    }
  });

  // 滚轮导航
  if (mainImageContainer) {
    let wheelDelta = 0;
    let wheelTimeout = null;
    const wheelThreshold = 50;
    const wheelCooldown = 100;

    mainImageContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      wheelDelta += e.deltaY;
      
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }
      
      if (Math.abs(wheelDelta) >= wheelThreshold) {
        const direction = wheelDelta > 0 ? 1 : -1;
        
        if (direction > 0 && currentIndex < images.length - 1) {
          animateStep(1);
        } else if (direction < 0 && currentIndex > 0) {
          animateStep(-1);
        }
        
        wheelDelta = 0;
      }
      
      wheelTimeout = setTimeout(() => {
        wheelDelta = 0;
        wheelTimeout = null;
      }, wheelCooldown);
    }, { passive: false });
  }

  // 缩略图栏滚轮横向滚动
  const thumbnailStrip = document.querySelector('.thumbnail-strip');
  if (thumbnailStrip) {
    thumbnailStrip.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        thumbnailStrip.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // ========== 滑动翻页功能 ==========
  const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;

  function getSlideWidth() {
    if (!mainImageContainer) return 0;
    const rect = mainImageContainer.getBoundingClientRect();
    const style = window.getComputedStyle(mainImageContainer);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    return Math.max(rect.width - paddingLeft - paddingRight, 0);
  }

  const SWIPE_THRESHOLD_RATIO = 0.08;
  const SLIDE_TRANSITION = 'transform 0.56s cubic-bezier(0.16, 0.84, 0.24, 1)';
  const RESET_TRANSITION = 'transform 0.34s cubic-bezier(0.2, 0.82, 0.36, 1)';

  function commitSlide(direction) {
    currentIndex += direction;
    if (direction > 0) {
      setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, panelCurrImage ? panelCurrImage.getAttribute('src') : null);
      setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, panelNextImage ? panelNextImage.getAttribute('src') : null);
      setPanelImage(panelNext, panelNextImage, panelNextStatus, currentIndex < images.length - 1 ? images[currentIndex + 1] : null);
    } else {
      setPanelImage(panelNext, panelNextImage, panelNextStatus, panelCurrImage ? panelCurrImage.getAttribute('src') : null);
      setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, panelPrevImage ? panelPrevImage.getAttribute('src') : null);
      setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, currentIndex > 0 ? images[currentIndex - 1] : null);
    }
    preloadNearbyImages(currentIndex);
  }

  function resetTrackPosition() {
    if (!carouselTrack) return;
    carouselTrack.style.transition = 'none';
    carouselTrack.style.transform = 'translateX(0px)';
  }

  function animateTrackTo(targetOffset, transition, onComplete) {
    if (!carouselTrack) return;

    let finished = false;
    let timeoutId = null;

    const cleanup = () => {
      carouselTrack.removeEventListener('transitionend', handleTransitionEnd);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (activeAnimationFinish === finish) {
        activeAnimationFinish = null;
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
      onComplete();
    };

    const handleTransitionEnd = (event) => {
      if (event.target !== carouselTrack || event.propertyName !== 'transform') return;
      finish();
    };

    carouselTrack.addEventListener('transitionend', handleTransitionEnd);
    activeAnimationFinish = finish;
    timeoutId = window.setTimeout(finish, 700);
    carouselTrack.style.transition = transition;
    carouselTrack.style.transform = `translateX(${targetOffset}px)`;
  }

  function finishSwipe(delta) {
    if (!carouselTrack || !mainImageContainer || isAnimating) return;

    const slideWidth = getSlideWidth();
    const threshold = slideWidth * SWIPE_THRESHOLD_RATIO;

    let targetOffset = 0;
    let direction = 0;

    if (delta < -threshold && currentIndex < images.length - 1) {
      targetOffset = -slideWidth;
      direction = 1;
    } else if (delta > threshold && currentIndex > 0) {
      targetOffset = slideWidth;
      direction = -1;
    }

    if (direction !== 0) {
      syncActiveThumbnail(currentIndex + direction);
      isAnimating = true;
    }

    animateTrackTo(targetOffset, direction !== 0 ? SLIDE_TRANSITION : RESET_TRANSITION, () => {
      if (direction !== 0) {
        commitSlide(direction);
      }
      resetTrackPosition();
      isAnimating = false;
      flushQueuedNavigation();
    });
  }

  function animateStep(direction) {
    if (!carouselTrack || !mainImageContainer) return;
    if (isAnimating) {
      queueNavigation({ type: 'step', direction });
      return;
    }
    const slideWidth = getSlideWidth();
    if (!slideWidth) {
      const targetIndex = currentIndex + direction;
      switchImage(targetIndex);
      return;
    }
    
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= images.length) return;
    isAnimating = true;
    syncActiveThumbnail(newIndex);
    
    const targetOffset = direction > 0 ? -slideWidth : slideWidth;

    animateTrackTo(targetOffset, SLIDE_TRANSITION, () => {
      currentIndex = newIndex;
      if (direction > 0) {
        setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, panelCurrImage ? panelCurrImage.getAttribute('src') : null);
        setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, panelNextImage ? panelNextImage.getAttribute('src') : null);
        setPanelImage(panelNext, panelNextImage, panelNextStatus, currentIndex < images.length - 1 ? images[currentIndex + 1] : null);
      } else {
        setPanelImage(panelNext, panelNextImage, panelNextStatus, panelCurrImage ? panelCurrImage.getAttribute('src') : null);
        setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, panelPrevImage ? panelPrevImage.getAttribute('src') : null);
        setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, currentIndex > 0 ? images[currentIndex - 1] : null);
      }
      preloadNearbyImages(currentIndex);
      resetTrackPosition();
      isAnimating = false;
      flushQueuedNavigation();
    });
  }
  
  // 手机端触摸滑动
  if (isMobileViewport && mainImageContainer && carouselTrack) {
    let touchStartX = 0;
    let touchStartY = 0;
    let currentTouchX = 0;
    let isDragging = false;
    let isSwiping = false;

    mainImageContainer.addEventListener('touchstart', (e) => {
      if (isAnimating) return;
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      currentTouchX = touchStartX;
      isDragging = false;
      isSwiping = false;
      carouselTrack.style.transition = 'none';
    }, { passive: true });

    mainImageContainer.addEventListener('touchmove', (e) => {
      if (isAnimating) return;
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (!isSwiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwiping = true;
      }

      if (!isSwiping) return;

      e.preventDefault();
      isDragging = true;
      currentTouchX = touch.clientX;

      let effectiveDelta = deltaX;
      if ((currentIndex === 0 && deltaX > 0) ||
          (currentIndex === images.length - 1 && deltaX < 0)) {
        effectiveDelta = deltaX * 0.3;
      }

      carouselTrack.style.transform = `translateX(${effectiveDelta}px)`;
    }, { passive: false });

    function endTouch() {
      if (isAnimating) {
        isDragging = false;
        isSwiping = false;
        return;
      }
      if (!isDragging) {
        animateTrackTo(0, RESET_TRANSITION, resetTrackPosition);
        isSwiping = false;
        return;
      }

      const delta = currentTouchX - touchStartX;
      const slideWidth = getSlideWidth();
      const threshold = slideWidth * SWIPE_THRESHOLD_RATIO;

      let direction = 0;
      if (delta < -threshold && currentIndex < images.length - 1) {
        direction = 1;
      } else if (delta > threshold && currentIndex > 0) {
        direction = -1;
      }

      if (direction !== 0) {
        const newIndex = currentIndex + direction;
        isAnimating = true;
        syncActiveThumbnail(newIndex);

        const targetOffset = direction > 0 ? -slideWidth : slideWidth;
        animateTrackTo(targetOffset, SLIDE_TRANSITION, () => {
          currentIndex = newIndex;
          if (direction > 0) {
            setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, panelCurrImage ? panelCurrImage.getAttribute('src') : null);
            setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, panelNextImage ? panelNextImage.getAttribute('src') : null);
            setPanelImage(panelNext, panelNextImage, panelNextStatus, currentIndex < images.length - 1 ? images[currentIndex + 1] : null);
          } else {
            setPanelImage(panelNext, panelNextImage, panelNextStatus, panelCurrImage ? panelCurrImage.getAttribute('src') : null);
            setPanelImage(panelCurr, panelCurrImage, panelCurrStatus, panelPrevImage ? panelPrevImage.getAttribute('src') : null);
            setPanelImage(panelPrev, panelPrevImage, panelPrevStatus, currentIndex > 0 ? images[currentIndex - 1] : null);
          }
          preloadNearbyImages(currentIndex);
          resetTrackPosition();
          isAnimating = false;
          flushQueuedNavigation();
        });
      } else {
        animateTrackTo(0, RESET_TRANSITION, resetTrackPosition);
      }

      isDragging = false;
      isSwiping = false;
    }

    mainImageContainer.addEventListener('touchend', endTouch, { passive: true });
    mainImageContainer.addEventListener('touchcancel', endTouch, { passive: true });
  }

  // 桌面端鼠标拖动
  if (!isMobileViewport && mainImageContainer && carouselTrack) {
    let mouseStartX = 0;
    let currentMouseX = 0;
    let isMouseDown = false;
    let isMouseDragging = false;

    mainImageContainer.addEventListener('mousedown', (e) => {
      if (isAnimating) return;
      if (e.button !== 0) return;
      isMouseDown = true;
      isMouseDragging = false;
      mouseStartX = e.clientX;
      currentMouseX = mouseStartX;
      carouselTrack.style.transition = 'none';
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (isAnimating) return;
      if (!isMouseDown) return;

      const deltaX = e.clientX - mouseStartX;

      if (!isMouseDragging && Math.abs(deltaX) > 5) {
        isMouseDragging = true;
      }

      if (!isMouseDragging) return;

      currentMouseX = e.clientX;

      let effectiveDelta = deltaX;
      if ((currentIndex === 0 && deltaX > 0) ||
          (currentIndex === images.length - 1 && deltaX < 0)) {
        effectiveDelta = deltaX * 0.3;
      }

      carouselTrack.style.transform = `translateX(${effectiveDelta}px)`;
    });

    function endMouseDrag() {
      if (isAnimating) {
        isMouseDown = false;
        isMouseDragging = false;
        document.body.style.cursor = '';
        return;
      }
      if (!isMouseDown) return;

      document.body.style.cursor = '';

      if (!isMouseDragging) {
        animateTrackTo(0, RESET_TRANSITION, resetTrackPosition);
        isMouseDown = false;
        return;
      }

      const delta = currentMouseX - mouseStartX;
      finishSwipe(delta);

      isMouseDown = false;
      isMouseDragging = false;
    }

    window.addEventListener('mouseup', endMouseDrag);
    window.addEventListener('mouseleave', endMouseDrag);
  }

  // 左右箭头点击
  const arrowPrev = document.getElementById('arrow-prev');
  const arrowNext = document.getElementById('arrow-next');

  if (arrowPrev) {
    arrowPrev.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    arrowPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      animateStep(-1);
    });
  }

  if (arrowNext) {
    arrowNext.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    arrowNext.addEventListener('click', (e) => {
      e.stopPropagation();
      animateStep(1);
    });
  }

  // 缩略图栏滑动切换（手机端）
  if (isMobileViewport && thumbnailContainer) {
    let thumbTouchStartX = 0;
    let thumbTouchStartY = 0;
    let thumbScrollLeft = 0;
    let isThumbSwiping = false;

    thumbnailContainer.addEventListener('touchstart', (e) => {
      thumbTouchStartX = e.touches[0].clientX;
      thumbTouchStartY = e.touches[0].clientY;
      thumbScrollLeft = thumbnailStrip.scrollLeft;
      isThumbSwiping = false;
    }, { passive: true });

    thumbnailContainer.addEventListener('touchmove', (e) => {
      const deltaX = e.touches[0].clientX - thumbTouchStartX;
      const deltaY = Math.abs(e.touches[0].clientY - thumbTouchStartY);
      
      if (Math.abs(deltaX) > deltaY) {
        isThumbSwiping = true;
        thumbnailStrip.scrollLeft = thumbScrollLeft - deltaX;
      }
    }, { passive: true });

    thumbnailContainer.addEventListener('touchend', (e) => {
      isThumbSwiping = false;
    }, { passive: true });
  }
})();
