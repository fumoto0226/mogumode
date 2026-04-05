// 全局：根据视口宽度判断当前是否为手机端视图（窄屏）
const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;

function getProjectSortYear(year) {
  if (typeof year === "number") return year;
  if (typeof year === "string" && year.includes("-")) {
    const parts = year.split("-");
    return parseInt(parts[1], 10) - 0.5;
  }
  return parseInt(year, 10) || 0;
}

function getProjectAssetBase(project) {
  return project.assetBase || "programs";
}

function encodePathSegments(...parts) {
  return parts
    .flatMap((part) => String(part).split("/"))
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildProgramImagePath(project, imageName = project.cover) {
  return `./${encodePathSegments("img", getProjectAssetBase(project), project.folder, imageName)}`;
}

function buildProjectCardImagePath(project, imageName = project.cover) {
  return `./${encodePathSegments(
    "img",
    `${getProjectAssetBase(project)}-cards`,
    project.folder,
    imageName.replace(/\.[^.]+$/, '.webp')
  )}`;
}

const PROJECTS_VIEW_STATE_KEY = "indexProjectsViewState";

function readProjectsViewState() {
  try {
    return JSON.parse(sessionStorage.getItem(PROJECTS_VIEW_STATE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function writeProjectsViewState(partialState) {
  const nextState = { ...readProjectsViewState(), ...partialState };
  sessionStorage.setItem(PROJECTS_VIEW_STATE_KEY, JSON.stringify(nextState));
}

function getProjectMetaText(project, isZh) {
  const isFieldTrip = Array.isArray(project.categories) && project.categories.includes('field-trip');
  if (isFieldTrip) {
    return isZh
      ? `习作。拍摄于${project.year}年。`
      : `Field Trip. Photographed in ${project.year}.`;
  }
  const client = isZh ? project.designer : project.designerEn;
  if (client) {
    return isZh
      ? `委托方：${client}。拍摄于${project.year}年。`
      : `Client: ${client}. Photographed in ${project.year}.`;
  }
  return isZh ? `拍摄于${project.year}年。` : `Photographed in ${project.year}.`;
}

const HORIZONTAL_HOME_HERO_IMAGES = [
  { src: "./img/home/横版/H01.webp", location: "Shanghai International Exchange Plaza", locationZh: "上海金融交易广场", description: "Designed by FGP Atelier + Jahn/", descriptionZh: "委托方：FGP Atelier + Jahn/" },
  { src: "./img/home/横版/H02.webp", location: "Shanghai International Exchange Plaza", locationZh: "上海金融交易广场", description: "Designed by FGP Atelier + Jahn/", descriptionZh: "委托方：FGP Atelier + Jahn/" },
  { src: "./img/home/横版/H03.webp", location: "Shenzhen Gate", locationZh: "深圳汇隆商务中心", description: "Designed by FGP Atelier", descriptionZh: "委托方：FGP Atelier" },
  { src: "./img/home/横版/H04.webp", location: "Peng’s House", locationZh: "启东彭宅", description: "Designed by L&M Design Lab", descriptionZh: "委托方：立木设计" },
  { src: "./img/home/横版/H05.webp", location: "Xuhui District New Archives Center", locationZh: "徐汇区档案馆新馆", description: "Designed by Atelier Archmixing", descriptionZh: "委托方：阿科米星建筑设计事务所" },
  { src: "./img/home/横版/H06.webp", location: "Tian An Clubhouse", locationZh: "常州天安会所", description: "Designed by HATCH Architects", descriptionZh: "委托方：汉齐建筑" },
  { src: "./img/home/横版/H07.webp", location: "Resting Loop with Views", locationZh: "重景环（绿屏石滩驿站）", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/横版/H08.webp", location: "Wave Breaker by the Sea", locationZh: "临港浪花消波块驿站", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/横版/H09.webp", location: "Xi‘an CCBD", locationZh: "西安万象城", description: "Designed by Heatherwick Studio", descriptionZh: "委托方：Heatherwick Studio" },
  { src: "./img/home/横版/H10.webp", location: "Asset Management Company Office", locationZh: "资产管理公司室内", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/横版/H11.webp", location: "Cave Teahouse & Tree tavern", locationZh: "石室茶室 树洞酒馆", description: "Designed by Arc Z + Practice on Earth", descriptionZh: "委托方：Arc Z + 猜一建筑" },
  { src: "./img/home/横版/H12.webp", location: "Twisting Tower", locationZh: "扭转塔", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/横版/H13.webp", location: "Poly C+ International Expo Center", locationZh: "保利C+国际博览中心", description: "Designed by Murphy/Jahn", descriptionZh: "委托方：墨菲扬" },
  { src: "./img/home/横版/H14.webp", location: "Wangchao Center", locationZh: "望朝中心", description: "Designed by SOM", descriptionZh: "委托方：SOM" },
];

const VERTICAL_HOME_HERO_IMAGES = [
  { src: "./img/home/竖版/V01.webp", location: "Cave Teahouse & Tree tavern", locationZh: "石室茶室 树洞酒馆", description: "Designed by Arc Z + Practice on Earth", descriptionZh: "委托方：Arc Z + 猜一建筑" },
  { src: "./img/home/竖版/V02.webp", location: "Science City Center", locationZh: "科学城中心", description: "Designed by HENN", descriptionZh: "委托方：海茵建筑" },
  { src: "./img/home/竖版/V03.webp", location: "Twisted Brick Shell Concept Library", locationZh: "红砖概念图书馆", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/竖版/V04.webp", location: "Tian An Clubhouse", locationZh: "常州天安会所", description: "Designed by HATCH Architects", descriptionZh: "委托方：汉齐建筑" },
  { src: "./img/home/竖版/V05.webp", location: "The Launch", locationZh: "“下水那天”船台装置", description: "Designed by Practice on Earth + Arc Z", descriptionZh: "委托方：猜一建筑 + Arc Z" },
  { src: "./img/home/竖版/V06.webp", location: "Renovation of Shanghai Relay Factory", locationZh: "上海继电器厂改造", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/竖版/V07.webp", location: "Renovation of Shanghai Relay Factory", locationZh: "上海继电器厂改造", description: "Designed by HCCH Studio", descriptionZh: "委托方：合尘建筑" },
  { src: "./img/home/竖版/V08.webp", location: "Marriott Courtyard Shunshan", locationZh: "舜山万怡酒店", description: "Designed by GAD", descriptionZh: "委托方：杰地设计" },
  { src: "./img/home/竖版/V09.webp", location: "Transaction Succeed Office", locationZh: "上海易成办公室", description: "Designed by One House Design", descriptionZh: "委托方：壹舍设计" },
  { src: "./img/home/竖版/V10.webp", location: "Pony Elementary School", locationZh: "宝莉斑马小学", description: "Designed by L&M Design Lab", descriptionZh: "委托方：立木设计" },
];

const homeHeroImages = isMobileViewport ? VERTICAL_HOME_HERO_IMAGES : HORIZONTAL_HOME_HERO_IMAGES;

const filmLibrary = [
  { file: "天安会.mp4", title: "天安会", titleEn: "Tian An Clubhouse" },
  { file: "望朝中心.mp4", title: "望朝中心", titleEn: "Wangchao Center" },
  { file: "极氪研发中心.mp4", title: "极氪研发中心", titleEn: "ZEEKR R&D Center" },
  { file: "梅溪湖国际文化艺术中心.mp4", title: "梅溪湖国际文化艺术中心", titleEn: "Meixihu International Culture & Arts Center" },
  { file: "浦东红窑.mp4", title: "浦东红窑", titleEn: "Pudong Red Kiln" },
  { file: "科学城中心.mp4", title: "科学城中心", titleEn: "Science City Center" },
  { file: "龙湖银泰.mp4", title: "龙湖银泰", titleEn: "Longfor Yintai" },
].map((film) => ({
  ...film,
  src: `./${encodePathSegments("film", film.file)}`,
}));

(() => {
  const body = document.body;
  const isTouchDevice =
    'ontouchstart' in window ||
    (navigator && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0));
  body.classList.add(isMobileViewport ? "is-mobile" : "is-desktop");
  const viewport = document.querySelector(".viewport");
  const startAtProjects = 
    window.location.hash === '#projects-section' || 
    window.location.hash === '#projects-section-list' ||
    window.location.hash === '#projects-section-images';

  // 0 = 全屏铺满；1 = 完全缩进到画框
  let progress = 0;
  let targetProgress = 0;
  let rafId = null;
  let isUnlocked = false; // 是否已解锁页面滚动

  const heroImages = homeHeroImages;

  let currentImageIndex = 0;
  let imageChangeInterval = null;
  let isPhoto1Active = true; // 标记当前显示的是哪一张图片

  // 更新首页图片和文字（双图交叉淡化 - 桌面端；单图切换 - 手机端）
  function updateHeroImage(index) {
    const heroPhoto1 = document.querySelector('.hero-photo-1');
    const heroPhoto2 = document.querySelector('.hero-photo-2');
    const metaBottomLeft = document.querySelector('.meta-bottom-left p');
    const metaBottomCenter = document.querySelector('.meta-bottom-center p');

    const imageData = heroImages[index];
    body.dataset.heroImageIndex = String(index);
    
    if (isMobileViewport) {
      // 手机端：双图交叉淡化（和桌面端一样的效果）
      if (!heroPhoto1 || !heroPhoto2) return;
      
      if (isPhoto1Active) {
        heroPhoto2.src = imageData.src;
        heroPhoto2.style.opacity = '1';
        heroPhoto1.style.opacity = '0';
      } else {
        heroPhoto1.src = imageData.src;
        heroPhoto1.style.opacity = '1';
        heroPhoto2.style.opacity = '0';
      }
      
      isPhoto1Active = !isPhoto1Active;
    } else {
      // 桌面端：双图交叉淡化
      if (!heroPhoto1 || !heroPhoto2) return;
      
      if (isPhoto1Active) {
        // 当前显示图片1，准备切换到图片2
        heroPhoto2.src = imageData.src; // 先加载图片2
        heroPhoto2.style.opacity = '1';  // 图片2淡入
        heroPhoto1.style.opacity = '0';  // 图片1淡出
      } else {
        // 当前显示图片2，准备切换到图片1
        heroPhoto1.src = imageData.src; // 先加载图片1
        heroPhoto1.style.opacity = '1';  // 图片1淡入
        heroPhoto2.style.opacity = '0';  // 图片2淡出
      }
      
      // 切换激活状态
      isPhoto1Active = !isPhoto1Active;
    }
    
    // 更新文字（桌面端才有这些元素）
    if (metaBottomLeft && metaBottomCenter) {
      // 检查当前语言状态
      const isZh = document.body.classList.contains('lang-zh');
      metaBottomLeft.textContent = isZh && imageData.locationZh ? imageData.locationZh : imageData.location;
      metaBottomCenter.textContent = isZh && imageData.descriptionZh ? imageData.descriptionZh : imageData.description;
    }
  }

  // 启动自动切换
  function startImageRotation() {
    // 初始显示第一张
    updateHeroImage(0);
    
    // 每3秒切换一次
    imageChangeInterval = setInterval(() => {
      currentImageIndex = (currentImageIndex + 1) % heroImages.length;
      updateHeroImage(currentImageIndex);
    }, 3000);
  }

  // 停止自动切换
  function stopImageRotation() {
    if (imageChangeInterval) {
      clearInterval(imageChangeInterval);
      imageChangeInterval = null;
    }
  }

  // 页面加载后启动图片轮播（桌面端和手机端都轮播）
  window.addEventListener('load', () => {
    startImageRotation();
  });

  // 如果已经解锁（滚动到下面），可以选择停止轮播
  // 这里我们让它一直轮播，如果你想停止可以取消注释下面的代码
  // window.addEventListener('scroll', () => {
  //   if (window.scrollY > 100 && imageChangeInterval) {
  //     stopImageRotation();
  //   }
  // });

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function getFrameTarget() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      return { top: 64, bottom: 80, left: 16, right: 16 };
    }
    return { top: 70, bottom: 100, left: 32, right: 32 };
  }

  function applyProgress() {
    // 手机端不再使用缩放遮罩动画，直接保持解锁状态
    if (isMobileViewport) {
      if (!isUnlocked) {
        isUnlocked = true;
        body.classList.remove("lock-scroll");
        body.classList.add("unlock-scroll");
      }
      return;
    }

    const target = getFrameTarget();
    const top = target.top * progress;
    const bottom = target.bottom * progress;
    const left = target.left * progress;
    const right = target.right * progress;

    const shell = document.querySelector(".photo-shell");
    if (!shell) return;

    // 通过 clip-path 缩小可视窗口，图片和白字都保持原位置不动，一起被裁切
    const inset = `${top}px ${right}px ${bottom}px ${left}px`;
    shell.style.clipPath = `inset(${inset})`;
    shell.style.webkitClipPath = `inset(${inset})`;

    // 用于切换文字颜色等（接近收缩完成时认为是 framed）
    body.classList.toggle("is-framed", progress > 0.6);

    // 当动画完成（progress >= 1，即完全收起）时，才解锁页面滚动
    if (progress >= 1 && !isUnlocked) {
      isUnlocked = true;
      body.classList.remove("lock-scroll");
      body.classList.add("unlock-scroll");
      // 正常进入首页时，确保在顶部；从作品页带锚点返回时，不再强制滚到顶部，避免闪一下
      if (!startAtProjects) {
        window.scrollTo(0, 0);
        // 解锁后自动平滑滚动到项目区域
        setTimeout(() => {
          const projectsSection = document.getElementById('projects-section');
          if (projectsSection) {
            projectsSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } else if (progress < 0.98 && isUnlocked) {
      // 往回滚到 98% 以下时重新锁定
      isUnlocked = false;
      body.classList.remove("unlock-scroll");
      body.classList.add("lock-scroll");
      window.scrollTo(0, 0);
    }
  }

  function setProgressImmediate(value) {
    progress = clamp01(value);
    applyProgress();
  }

  function tick() {
    const diff = targetProgress - progress;
    if (Math.abs(diff) < 0.001) {
      setProgressImmediate(targetProgress);
      rafId = null;
      return;
    }

    // 朝目标做一点缓动（越接近越慢），系数小一点更顺滑
    setProgressImmediate(progress + diff * 0.12);
    rafId = requestAnimationFrame(tick);
  }

  function setTargetProgress(value) {
    targetProgress = clamp01(value);
    if (rafId == null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  // 初始状态：正常从顶部进入是全屏；如果带 #projects-section 相关锚点，则直接处于缩小完成并解锁滚动
  if (!isMobileViewport) {
    if (startAtProjects) {
      progress = 1;
      targetProgress = 1;
      isUnlocked = true;
      body.classList.remove("lock-scroll");
      body.classList.add("unlock-scroll");
      applyProgress();
      // 注意：移除 start-at-projects 的逻辑已经移到视图切换模块统一处理
    } else {
      // 初始为全屏
      setProgressImmediate(0);
    }
  } else {
    // 手机端：不做缩放动画，直接解锁
    isUnlocked = true;
    body.classList.remove("lock-scroll");
    body.classList.add("unlock-scroll");
  }

  // 点击首页视口区域：桌面端用于切换动画（手机端单独处理）
  viewport.addEventListener("click", (event) => {
    if (isMobileViewport) {
      return;
    }
    // 如果点击的是语言切换按钮或其内部元素，不触发全屏动画
    if (event.target.closest('.language-switch')) {
      return;
    }
    
    // 只在锁定状态下或在页面顶部时响应点击
    if (!isUnlocked || window.scrollY <= 1) {
      const target = targetProgress < 0.5 ? 1 : 0;
      setTargetProgress(target);
    }
  });

  // 手机端：点击画面或箭头 / 上下滑动，自动在首页顶部和下方导航之间"对齐"滚动
  if (isMobileViewport) {
    const tabsSection = document.querySelector('.tabs-only-section');
    const spacerSection = document.querySelector('.spacer-section');
    const mobileFrame = document.querySelector('.mobile-view .frame');
    let lastScrollY = window.scrollY;
    let isAutoScrolling = false;
    window.disableMobileAutoScroll = false; // 全局标记，用于暂时禁用自动对齐

    function scrollToNextSection() {
      if (!tabsSection) return;
      // 滚动到标签栏顶部 (offsetTop)，确保标签栏刚好在视口顶部
      const top = tabsSection.offsetTop;
      isAutoScrolling = true;
      window.scrollTo({ top, behavior: 'smooth' });
      setTimeout(() => {
        isAutoScrolling = false;
      }, 500);
    }

    function scrollToTopSection() {
      // 确保滚动到页面最顶部 (0)
      isAutoScrolling = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        isAutoScrolling = false;
      }, 500);
    }

    if (mobileFrame) {
      mobileFrame.addEventListener('click', (event) => {
        // 如果点击的是语言切换按钮，不触发翻页
        if (event.target.closest('.language-switch')) {
          return;
        }
        scrollToNextSection();
      }, { passive: true });
    }

    if (spacerSection) {
      spacerSection.addEventListener('click', () => {
        scrollToNextSection();
      }, { passive: true });
    }

    window.addEventListener('scroll', () => {
      if (!tabsSection || isAutoScrolling || window.disableMobileAutoScroll) {
        lastScrollY = window.scrollY;
        return;
      }

      // 如果在 About 模式下，不触发自动对齐滚动
      if (document.body.classList.contains('about-mode')) {
        lastScrollY = window.scrollY;
        return;
      }

      const targetTop = tabsSection.offsetTop;
      const y = window.scrollY;
      const delta = y - lastScrollY;

      // 中间区域：仅向下滚动时自动对齐到 tabs 区，向上滚动不自动跳回顶部
      if (y > 10 && y < targetTop - 10) {
        if (delta > 0) {
          // 向下滚动，自动对齐到 tabs 区
          scrollToNextSection();
        }
        // 向上滚动不再自动跳回顶部，让用户自由滚动
      }

      lastScrollY = y;
    });
  }

  // 鼠标滚轮触发（包含触摸板手势）：
  // 向下滚动 -> 收起；向上滚动 -> 还原为全屏
  let scrollToProjectsPending = false;
  
  window.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaY) < 0.1) return;
    
    // 如果 Images 视图正在显示，处理 Images 页面的强制滚动
    if (document.body.classList.contains('images-mode')) {
      // 检查是否在图片网格区域滚动
      const target = event.target;
      const isInImagesGrid = target.closest('.images-grid');
      
      // 如果在图片网格内滚动，完全交给网格自己处理，不触发页面滚动
      if (isInImagesGrid) {
        // 阻止事件冒泡，防止触发页面级滚动
        event.stopPropagation();
        return;
      }
      
      // 在顶部向下滚动时，直接滚到 Images 区域
      if (window.scrollY <= 1 && event.deltaY > 0 && isUnlocked) {
        event.preventDefault();
        const imagesAnchor = document.getElementById('projects-section-images');
        if (imagesAnchor) {
          imagesAnchor.scrollIntoView({ behavior: 'smooth' });
        }
      }
      // 向上滚动不再自动跳回顶部，让用户自由滚动
      return;
    }
    
    // 如果 About 页面正在显示，处理 About 页面的强制滚动
    const aboutSection = document.getElementById('about-section');
    if (aboutSection && aboutSection.style.display !== 'none') {
      // 在顶部向下滚动时，直接滚到 About 区域
      if (window.scrollY <= 1 && event.deltaY > 0 && isUnlocked) {
        event.preventDefault();
        aboutSection.scrollIntoView({ behavior: 'smooth' });
      }
      // 向上滚动不再自动跳回顶部，让用户自由滚动
      return;
    }

    const factor = 0.0009; // 滚动灵敏度

    // 如果还没解锁滚动，拦截滚轮事件用于控制首页动画
    if (!isUnlocked) {
      event.preventDefault();
      const delta = event.deltaY * factor;
      setTargetProgress(targetProgress + delta);
      
      // 当动画接近完成且向下滚动时，标记需要滚动到项目区域
      if (event.deltaY > 0 && targetProgress > 0.95 && !scrollToProjectsPending) {
        scrollToProjectsPending = true;
      }
    }
    // 如果已解锁，在页面顶部时控制动画
    else if (window.scrollY <= 1) {
      // 向上滚动：还原全屏
      if (event.deltaY < 0 && targetProgress > 0) {
        event.preventDefault();
        const delta = event.deltaY * factor;
        setTargetProgress(targetProgress + delta);
      }
      // 向下滚动但动画还没完全收起：继续控制动画
      else if (event.deltaY > 0 && targetProgress < 1) {
        event.preventDefault();
        const delta = event.deltaY * factor;
        setTargetProgress(targetProgress + delta);
      }
      // 已经解锁且在顶部，向下滚动时直接滚到项目区域
      else if (event.deltaY > 0 && targetProgress >= 1) {
        event.preventDefault();
        const projectsSection = document.getElementById('projects-section');
        if (projectsSection) {
          projectsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    // 向上滚动不再自动跳回顶部，让用户自由滚动
  }, { passive: false }); // 改为 passive: false 以便可以 preventDefault

  // 触摸设备：手指滑动也触发
  let touchStartY = null;
  viewport.addEventListener(
    "touchstart",
    (event) => {
      touchStartY = event.touches[0].clientY;
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchmove",
    (event) => {
      if (touchStartY == null) return;
      const dy = event.touches[0].clientY - touchStartY;
      if (Math.abs(dy) < 5) return;

      const factor = 0.0022;
      // 手指向上滑动（dy < 0） -> progress 增大（收起）
      const delta = -dy * factor;
      setTargetProgress(targetProgress + delta);
    },
    { passive: true }
  );
})();

// ========== 项目分类筛选（必须最先初始化，供其他模块使用）==========
(() => {
  let currentCategory = 'all';
  
  // 初始化：根据 URL 中的分类参数恢复状态
  const params = new URLSearchParams(window.location.search);
  const urlCategory = params.get('category') || 'all';
  
  console.log('🔍 分类模块初始化');
  console.log('  当前 URL:', window.location.href);
  console.log('  URL 参数 category:', urlCategory);
  
  const validCategories = [
    'all',
    'architecture',
    'small-scale',
    'interior',
    'commercial',
    'workspace',
    'residential',
    'hospitality',
    'field-trip'
  ];
  
  if (validCategories.includes(urlCategory)) {
    currentCategory = urlCategory;
    console.log('  ✅ 设置当前分类为:', currentCategory);
  } else {
    console.log('  ⚠️ 无效分类，使用默认值 all');
  }
  
  // ⚠️ 关键：先导出函数，确保其他模块能用（即使 DOM 还没准备好）
  window.getCurrentCategory = () => currentCategory;
  window.getFilteredProjects = (projectsList, category) => {
    if (category === 'all') return projectsList;
    return projectsList.filter(p => p.categories && p.categories.includes(category));
  };
  
  // 然后再处理 UI 更新（如果 DOM 元素不存在就跳过 UI 部分）
  const categoryBtn = document.getElementById('category-btn');
  const categoryDropdown = document.getElementById('category-dropdown');
  const categoryMenu = document.getElementById('category-menu');
  const categoryItems = document.querySelectorAll('.category-item');
  
  if (!categoryBtn || !categoryDropdown || !categoryMenu) {
    console.warn('分类 UI 元素未找到，跳过 UI 初始化，但分类功能已可用');
    return; // 只是跳过 UI 部分，函数已经导出了
  }
  
  // 根据当前分类刷新按钮文字和选中状态
  console.log('  🎨 更新 UI，当前分类:', currentCategory);
  categoryItems.forEach(item => {
    const cat = item.dataset.category;
    if (cat === currentCategory) {
      item.classList.add('active');
      // 如果是"全部"分类，显示"筛选"；其他分类显示分类名
      if (cat === 'all') {
        categoryBtn.textContent = document.body.classList.contains('lang-zh') ? '筛选' : 'Filter';
      } else {
        categoryBtn.textContent = item.textContent;
      }
      console.log('    设置按钮文字为:', categoryBtn.textContent);
    } else {
      item.classList.remove('active');
    }
  });
  
  // 点击分类按钮展开/收起菜单
  categoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    categoryDropdown.classList.toggle('open');
  });
  
  // 点击页面其他地方关闭菜单
  document.addEventListener('click', () => {
    categoryDropdown.classList.remove('open');
  });
  
  // 阻止菜单内部点击事件冒泡
  categoryMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // 更新 URL 中的分类参数（不刷新页面）
  function updateCategoryInUrl(category) {
    const url = new URL(window.location.href);
    if (category === 'all') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', category);
    }
    window.history.replaceState({}, '', url.toString());
  }
  
  // 分类项点击事件
  categoryItems.forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;
      
      // 更新选中状态
      categoryItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // 更新按钮文字：如果是"全部"分类，显示"筛选"；其他分类显示分类名
      if (category === 'all') {
        categoryBtn.textContent = document.body.classList.contains('lang-zh') ? '筛选' : 'Filter';
      } else {
        categoryBtn.textContent = item.textContent;
      }
      
      // 关闭菜单
      categoryDropdown.classList.remove('open');
      
      // 应用筛选
      currentCategory = category;
      updateCategoryInUrl(category);
      filterProjects(category);
    });
  });
  
  // 筛选项目函数
  function filterProjects(category) {
    // 触发自定义事件，通知其他模块更新筛选
    const event = new CustomEvent('categoryChanged', { detail: { category } });
    document.dispatchEvent(event);
  }
})();

// ========== 项目展示区域交互 ==========
(() => {
  // 引入项目数据
  // 注意：需要在 script.js 之前引入 projects-data.js
  
  const allProjects = projectsData.map((project) => ({ ...project }));
  const listableProjects = allProjects.filter((project) => !project.mapOnly);

  function getMapProjects(category) {
    const baseProjects = category && window.getFilteredProjects
      ? window.getFilteredProjects(allProjects, category)
      : allProjects;
    return baseProjects;
  }

  function getListableProjects(category) {
    const baseProjects = category && window.getFilteredProjects
      ? window.getFilteredProjects(listableProjects, category)
      : listableProjects;
    return baseProjects;
  }

  function spreadOverlappingCoordinates(projectList) {
    function hashString(value) {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    function createSeededRandom(seedText) {
      let seed = hashString(seedText) || 1;
      return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    }

    const grouped = new Map();
    const adjusted = new Map();

    projectList.forEach((project) => {
      if (!Array.isArray(project.coordinates) || project.coordinates.length !== 2) return;
      const key = project.coordinates.map((value) => Number(value).toFixed(6)).join(",");
      const group = grouped.get(key) || [];
      group.push(project);
      grouped.set(key, group);
    });

    grouped.forEach((group) => {
      if (group.length === 1) {
        adjusted.set(group[0].id, group[0].coordinates);
        return;
      }

      const [baseLng, baseLat] = group[0].coordinates;
      const sortedGroup = [...group].sort((a, b) =>
        `${a.address || ""}-${a.id}`.localeCompare(`${b.address || ""}-${b.id}`, "zh-Hans-CN")
      );
      const usedPoints = [];

      sortedGroup.forEach((project, index) => {
        const random = createSeededRandom(`${project.id}-${project.titleEn}-${project.address || ""}`);
        let chosenPoint = [baseLng, baseLat];

        for (let attempt = 0; attempt < 24; attempt += 1) {
          const spread = 0.002 + Math.floor(index / 6) * 0.0014;
          const angle = random() * Math.PI * 2;
          const distance = (0.00055 + random() * spread) * (1 + attempt * 0.08);
          const lngDistance = distance / Math.max(Math.cos((baseLat * Math.PI) / 180), 0.35);
          const candidate = [
            baseLng + Math.cos(angle) * lngDistance,
            baseLat + Math.sin(angle) * distance,
          ];

          const hasConflict = usedPoints.some(([usedLng, usedLat]) => {
            const dx = (candidate[0] - usedLng) * Math.max(Math.cos((baseLat * Math.PI) / 180), 0.35);
            const dy = candidate[1] - usedLat;
            return Math.hypot(dx, dy) < 0.00075;
          });

          if (!hasConflict || attempt === 23) {
            chosenPoint = candidate;
            usedPoints.push(candidate);
            break;
          }
        }

        adjusted.set(project.id, chosenPoint);
      });
    });

    const scaledDistance = (pointA, pointB, latitudeBase) => {
      const lngScale = Math.max(Math.cos((latitudeBase * Math.PI) / 180), 0.35);
      const dx = (pointA[0] - pointB[0]) * lngScale;
      const dy = pointA[1] - pointB[1];
      return Math.hypot(dx, dy);
    };

    const projectsNeedingJitter = projectList
      .filter((project) => {
        const precision = project.coordinatePrecision || "estimated";
        return precision !== "detailed" && adjusted.has(project.id);
      })
      .sort((a, b) => `${a.location || ""}-${a.address || ""}-${a.id}`.localeCompare(
        `${b.location || ""}-${b.address || ""}-${b.id}`,
        "zh-Hans-CN"
      ));

    projectsNeedingJitter.forEach((project) => {
      const originalPoint = adjusted.get(project.id);
      if (!originalPoint) return;

      const precision = project.coordinatePrecision || "estimated";
      const minDistance = precision === "approximate" ? 0.0016 : 0.00115;
      const random = createSeededRandom(`dense-${project.id}-${project.titleEn}-${project.address || ""}`);

      const otherPoints = projectList
        .filter((candidate) => candidate.id !== project.id)
        .map((candidate) => adjusted.get(candidate.id))
        .filter(Boolean);

      const isTooClose = otherPoints.some((point) => scaledDistance(originalPoint, point, originalPoint[1]) < minDistance);
      if (!isTooClose) return;

      let bestCandidate = originalPoint;
      let bestDistance = -1;

      for (let attempt = 0; attempt < 36; attempt += 1) {
        const radius = 0.0009 + Math.floor(attempt / 6) * 0.00045 + random() * 0.00035;
        const angle = random() * Math.PI * 2 + attempt * 0.35;
        const lngRadius = radius / Math.max(Math.cos((originalPoint[1] * Math.PI) / 180), 0.35);
        const candidate = [
          originalPoint[0] + Math.cos(angle) * lngRadius,
          originalPoint[1] + Math.sin(angle) * radius,
        ];

        let nearestDistance = Infinity;
        for (const point of otherPoints) {
          nearestDistance = Math.min(nearestDistance, scaledDistance(candidate, point, originalPoint[1]));
        }

        if (nearestDistance > bestDistance) {
          bestDistance = nearestDistance;
          bestCandidate = candidate;
        }

        if (nearestDistance >= minDistance) {
          bestCandidate = candidate;
          break;
        }
      }

      adjusted.set(project.id, bestCandidate);
    });

    return adjusted;
  }

  // 获取项目封面图路径（对路径进行 URL 编码以支持中文和空格）
  function getProjectCover(project) {
    return buildProgramImagePath(project);
  }

  const previewImage = document.getElementById("preview-image");
  const previewTitle = document.getElementById("preview-title");
  const previewDescription = document.getElementById("preview-description");

  // 手机端：记录上一次"点亮"的项目 ID，用于实现"第一次点击只显示信息，第二次点击进入作品页"
  let lastTappedProjectIdMobile = null;

  // 全局函数：更新预览区内容（根据当前语言状态）
  // 这个函数会在语言切换时被调用
  window.updateProjectPreviewByLang = function() {
    const project = window.currentProjectData;
    if (!project || !previewTitle) return;

    const isZh = document.body.classList.contains('lang-zh');
    previewTitle.textContent = isZh ? project.title : project.titleEn;
    previewDescription.textContent = getProjectMetaText(project, isZh);
  };

  // 初始化 Mapbox 地图
  mapboxgl.accessToken = [
    'pk.eyJ1IjoiZnVtb3RvIiwiYSI6ImNtYXhqbGZ4',
    'bDBiOWwybHB3a3R5dmk3Z2kifQ.vXgn2UF6HVT0cnnQRmLO1A'
  ].join('');
  
  const initialCenter = isMobileViewport ? [108.5, 32.0] : [115.5, 28.5];
  const initialZoom = isMobileViewport ? 2.75 : 3.8;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11', // 使用白色浅色样式
    center: initialCenter, // 初始中心点（能显示所有项目）
    zoom: initialZoom, // 显示所有项目点
    projection: 'mercator', // 使用墨卡托投影（平面地图），不是 globe（地球）
    attributionControl: false, // 隐藏底部 attribution 控件
    fadeDuration: 0 // 避免缩放时 symbol 碰撞淡入淡出导致数字和圈不同步
  });

  // 禁用地图旋转和倾斜
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();

  // 设置地图语言的函数
  window.setMapLanguage = function(lang) {
    if (!map || !map.isStyleLoaded()) return;
    
    // 获取地图样式
    const style = map.getStyle();
    if (!style || !style.layers) return;
    
    // 遍历所有文字图层，更新语言
    style.layers.forEach(layer => {
      // 跳过聚合数字图层，保持其 text-field 不变
      if (layer.id === 'cluster-count') return;
      
      if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
        // 设置文字字段为对应语言
        // Mapbox 使用 {name_zh} 表示中文，{name_en} 表示英文，{name} 表示本地语言
        const textField = lang === 'zh' 
          ? ['coalesce', ['get', 'name_zh-Hans'], ['get', 'name_zh'], ['get', 'name']]
          : ['coalesce', ['get', 'name_en'], ['get', 'name']];
        
        map.setLayoutProperty(layer.id, 'text-field', textField);
      }
    });
  };

  const markers = [];
  let clusterSourceId = 'projects-cluster';
  let isClusterInitialized = false;

  // 地图加载完成后添加标记
  map.on('load', () => {
    // 尝试恢复保存的地图状态
    const savedState = sessionStorage.getItem('mapState');
    if (savedState) {
      try {
        const mapState = JSON.parse(savedState);
        console.log('📍 恢复地图状态:', mapState);
        map.setCenter([mapState.center.lng, mapState.center.lat]);
        map.setZoom(mapState.zoom);
        // 恢复后清除保存的状态
        sessionStorage.removeItem('mapState');
      } catch (e) {
        console.error('恢复地图状态失败:', e);
      }
    }

    // 归位按钮点击事件
    const mapResetBtn = document.getElementById('map-reset-btn');
    if (mapResetBtn) {
      mapResetBtn.addEventListener('click', () => {
        map.flyTo({
          center: initialCenter,
          zoom: initialZoom,
          duration: 800
        });
      });
    }
    
    // 检查当前语言状态，设置地图语言
    const isZh = document.body.classList.contains('lang-zh');
    if (isZh && typeof window.setMapLanguage === 'function') {
      window.setMapLanguage('zh');
    }
    
    initializeMarkers();
  });
  
  // 初始化地图标记（使用聚合功能）
  function initializeMarkers() {
    // 获取当前筛选的项目
    const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
    console.log('🗺️ 地图初始化，当前分类:', category);
    const filteredProjects = getMapProjects(category);
    const displayCoordinates = spreadOverlappingCoordinates(filteredProjects);
    console.log('  筛选后项目数:', filteredProjects.length);
    
    // 构建 GeoJSON 数据（每个 feature 需要唯一 id 用于悬浮高亮）
    const geojsonData = {
      type: 'FeatureCollection',
      features: filteredProjects.map((project, index) => ({
        type: 'Feature',
        id: project.id,  // 用于 setFeatureState 的唯一 id
        properties: {
          id: project.id,
          title: project.title,
          titleEn: project.titleEn,
          year: project.year,
          index: index
        },
        geometry: {
          type: 'Point',
          coordinates: displayCoordinates.get(project.id) || project.coordinates
        }
      }))
    };
    
    // 如果已经初始化过，更新数据源
    if (isClusterInitialized) {
      const source = map.getSource(clusterSourceId);
      if (source) {
        source.setData(geojsonData);
      }
      // 初始激活第一个项目
      if (filteredProjects.length > 0) {
        const savedState = readProjectsViewState();
        const preferredProject = savedState.previewProjectId
          ? filteredProjects.find((project) => project.id === savedState.previewProjectId)
          : null;
        switchProject((preferredProject || filteredProjects[0]).id);
      }
      return;
    }
    
    // 首次初始化：添加聚合数据源
    map.addSource(clusterSourceId, {
      type: 'geojson',
      data: geojsonData,
      cluster: true,
      clusterMaxZoom: 12, // 超过这个缩放级别不再聚合
      clusterRadius: 16, // 稍微放大聚合半径，减少密集区域互相压住
      promoteId: 'id' // 使用 properties.id 作为 feature id（用于悬浮高亮）
    });
    
    // 添加聚合圆圈图层
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: clusterSourceId,
      layout: {
        'circle-sort-key': ['get', 'point_count']
      },
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2a4cd7',
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          12,  // 默认大小（较小）
          3, 14,  // 3个以上项目
          5, 16   // 5个以上项目
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        // 添加过渡动画
        'circle-radius-transition': { duration: 300, delay: 0 },
        'circle-opacity-transition': { duration: 300, delay: 0 }
      }
    });
    
    // 添加聚合数字图层
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: clusterSourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'symbol-sort-key': ['get', 'point_count'],
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': '#ffffff',
        'text-opacity-transition': { duration: 300, delay: 0 }
      }
    });
    
    // 添加单独项目点图层（支持悬浮高亮）
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: clusterSourceId,
      filter: ['!', ['has', 'point_count']],
      paint: {
        // 根据 hover 状态改变颜色
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#2a4cd7',  // 悬浮时深蓝色
          '#4a6cf7'   // 默认浅蓝色
        ],
        // 根据 hover 状态改变大小
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          10,  // 悬浮时变大
          8    // 默认大小
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        // 根据 hover 状态改变透明度
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          1,    // 悬浮时完全不透明
          0.6   // 默认半透明
        ],
        // 添加过渡动画（分散出现时的缩放效果）
        'circle-radius-transition': { duration: 400, delay: 0 },
        'circle-opacity-transition': { duration: 400, delay: 0 },
        'circle-color-transition': { duration: 200, delay: 0 }
      }
    });

    // Keep single points below numbered cluster layers.
    map.moveLayer('unclustered-point', 'clusters');
    
    // 记录当前悬浮的要素 ID
    let hoveredPointId = null;
    
    // 点击聚合点：放大地图显示该区域的项目
    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      
      map.getSource(clusterSourceId).getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom + 1
        });
      });
    });
    
    // 点击单独项目点
    map.on('click', 'unclustered-point', (e) => {
      const feature = e.features[0];
      const projectId = feature.properties.id;
      const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
      const url = `project.html?id=${projectId}&from=map&category=${encodeURIComponent(category)}`;
      
      if (isMobileViewport) {
        // 手机端：第一次点击切换预览并高亮，第二次进入作品页
        if (lastTappedProjectIdMobile === projectId) {
          const mapState = {
            center: map.getCenter(),
            zoom: map.getZoom()
          };
          sessionStorage.setItem('mapState', JSON.stringify(mapState));
          window.location.href = url;
        } else {
          // 取消之前的高亮
          if (hoveredPointId !== null) {
            map.setFeatureState(
              { source: clusterSourceId, id: hoveredPointId },
              { hover: false }
            );
          }
          
          // 设置新的高亮
          hoveredPointId = feature.id;
          if (hoveredPointId !== undefined) {
            map.setFeatureState(
              { source: clusterSourceId, id: hoveredPointId },
              { hover: true }
            );
          }
          
          lastTappedProjectIdMobile = projectId;
          switchProject(projectId);
        }
      } else {
        // 桌面端：保存状态并跳转
        const mapState = {
          center: map.getCenter(),
          zoom: map.getZoom()
        };
        sessionStorage.setItem('mapState', JSON.stringify(mapState));
        window.location.href = url;
      }
    });
    
    // 鼠标悬浮在单独项目点上：切换预览并高亮
    map.on('mouseenter', 'unclustered-point', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      const projectId = feature.properties.id;
      
      // 取消之前的高亮
      if (hoveredPointId !== null) {
        map.setFeatureState(
          { source: clusterSourceId, id: hoveredPointId },
          { hover: false }
        );
      }
      
      // 设置新的高亮（使用 feature 的 index 作为 id）
      hoveredPointId = feature.id;
      if (hoveredPointId !== undefined) {
        map.setFeatureState(
          { source: clusterSourceId, id: hoveredPointId },
          { hover: true }
        );
      }
      
      switchProject(projectId);
    });
    
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
      
      // 取消高亮
      if (hoveredPointId !== null) {
        map.setFeatureState(
          { source: clusterSourceId, id: hoveredPointId },
          { hover: false }
        );
      }
      hoveredPointId = null;
    });
    
    // 鼠标悬浮在聚合点上：显示手型光标
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
    });
    
    isClusterInitialized = true;
    
    // 初始激活第一个项目
    if (filteredProjects.length > 0) {
      const savedState = readProjectsViewState();
      const preferredProject = savedState.previewProjectId
        ? filteredProjects.find((project) => project.id === savedState.previewProjectId)
        : null;
      switchProject((preferredProject || filteredProjects[0]).id);
    }
  }
  
  // 监听分类变化事件
  document.addEventListener('categoryChanged', () => {
    initializeMarkers();
  });

  // 全局变量：记录当前选中的项目 ID 和项目数据
  window.currentProjectId = null;
  window.currentProjectData = null;

  // 切换项目
  function switchProject(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    // 记录当前选中的项目 ID 和数据
    window.currentProjectId = projectId;
    window.currentProjectData = project;

    // 判断当前语言
    const isZh = document.body.classList.contains('lang-zh');
    const displayTitle = isZh ? project.title : project.titleEn;
    const displayDescription = getProjectMetaText(project, isZh);

    // 先预加载图片，加载完成后再切换，避免闪白
    const img = new Image();
    img.onload = () => {
      if (previewImage) previewImage.src = getProjectCover(project);
      if (previewTitle) previewTitle.textContent = displayTitle;
      if (previewDescription) previewDescription.textContent = displayDescription;
      if (previewViewAllBtn) previewViewAllBtn.dataset.projectId = String(project.id);
    };
    img.src = getProjectCover(project);

    // 更新标记的激活状态
    markers.forEach(({ el, projectId: pid }) => {
      if (pid === projectId) {
        el.classList.add('active');
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.backgroundColor = '#2a4cd7';
        el.style.opacity = '1'; // 选中的点完全不透明
      } else {
        el.classList.remove('active');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.backgroundColor = '#4a6cf7';
        el.style.opacity = '0.4'; // 未选中的点半透明
      }
    });

    // 不移动地图，保持当前视角
  }

  document.addEventListener('forceProjectPreview', (event) => {
    const projectId = event.detail && typeof event.detail.projectId === 'number'
      ? event.detail.projectId
      : null;
    if (projectId !== null) {
      switchProject(projectId);
    }
  });

  // 右侧列表视图与项目预览联动（根据项目数据自动渲染，并按年份排序）
  const mapListBody = document.querySelector('#map-list-container tbody');
  const previewViewAllBtn = document.getElementById('preview-view-all-btn');
  const previewImageWrapper = document.querySelector('.preview-image-wrapper');
  const previewImageElement = document.getElementById('preview-image');

  function navigateToPreviewProject() {
    const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
    const activeView = document.querySelector('.view-tab.active')?.dataset.view || 'map';
    const listContainerElement = document.getElementById('map-list-container');
    const imagesGridElement = document.getElementById('images-grid');
    writeProjectsViewState({
      view: activeView,
      listScrollTop: listContainerElement ? listContainerElement.scrollTop : 0,
      imagesScrollTop: imagesGridElement ? imagesGridElement.scrollTop : 0,
      previewProjectId: window.currentProjectId ?? null,
    });

    let projectId = previewViewAllBtn && previewViewAllBtn.dataset.projectId
      ? Number(previewViewAllBtn.dataset.projectId)
      : (lastTappedProjectIdMobile ?? null);

    if (projectId == null) {
      const currentTitle = previewTitle ? previewTitle.textContent : '';
      const found = allProjects.find(p => p.title === currentTitle || p.titleEn === currentTitle);
      if (found) projectId = found.id;
    }

    if (projectId != null) {
      writeProjectsViewState({ previewProjectId: projectId });
    }

    const url = `project.html?from=indexPreview&category=${encodeURIComponent(category)}` +
      (projectId != null ? `&id=${encodeURIComponent(projectId)}` : '');

    window.location.href = url;
  }
  
  function renderListView() {
    if (!mapListBody) return;
    
    // 判断当前语言
    const isZh = document.body.classList.contains('lang-zh');
    
    // 获取当前筛选的项目
    const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
    console.log('📋 列表渲染，当前分类:', category);
    const filteredProjects = getListableProjects(category);
    console.log('  筛选后项目数:', filteredProjects.length);
    const sorted = [...filteredProjects].sort((a, b) => getProjectSortYear(b.year) - getProjectSortYear(a.year)); // 年份从大到小
    
    mapListBody.innerHTML = '';

    sorted.forEach((project) => {
      const displayTitle = isZh ? project.title : project.titleEn;
      const displayDesigner = isZh ? project.designer : project.designerEn;
      const displayLocation = isZh ? project.location : project.locationEn;
      const tr = document.createElement('tr');
      tr.dataset.projectId = String(project.id);
      tr.innerHTML = `
        <td class="col-year">${project.year}</td>
        <td class="col-title">${displayTitle}</td>
        <td class="col-designer">${displayDesigner}</td>
        <td class="col-location">${displayLocation}</td>
      `;

      // 悬浮时切换左侧缩略图和项目信息（和地图点效果一致）
      tr.addEventListener('mouseenter', () => {
        switchProject(project.id);
      });

      // 点击行：手机端（窄屏）第一次点击只切换预览，第二次点击进入作品页；电脑端（宽屏）直接进入作品页
      tr.addEventListener('click', () => {
        writeProjectsViewState({
          view: 'list',
          listScrollTop: document.getElementById('map-list-container')?.scrollTop || 0,
          previewProjectId: project.id,
        });
        const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
        const url = `project.html?id=${project.id}&from=indexList&category=${encodeURIComponent(category)}`;

        if (isMobileViewport) {
          const pid = project.id;
          if (lastTappedProjectIdMobile === pid) {
            // 第二次点击同一行：进入作品页
            window.location.href = url;
          } else {
            // 第一次点击：只更新预览，不跳转
            lastTappedProjectIdMobile = pid;
            switchProject(pid);
          }
        } else {
          // 桌面端：保持原逻辑
          window.location.href = url;
        }
      });

      mapListBody.appendChild(tr);
    });
    
    // 如果有项目，显示第一个
    if (sorted.length > 0) {
      const savedState = readProjectsViewState();
      const preferredProject = savedState.previewProjectId
        ? sorted.find((project) => project.id === savedState.previewProjectId)
        : null;
      const selectedProject = preferredProject || sorted[0];
      switchProject(selectedProject.id);

      // 默认情况下，“View All” 按钮跳到当前列表中的第一个项目所属作品页
      if (previewViewAllBtn) {
        previewViewAllBtn.dataset.projectId = String(selectedProject.id);
      }
    }
  }
  
  // 初始渲染
  if (mapListBody) {
    renderListView();
  }

  // 预览图右上角 “View All” 按钮：跳转到当前选中项目的作品页
  if (previewViewAllBtn) {
    previewViewAllBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      navigateToPreviewProject();
    });
  }

  if (!isMobileViewport && previewImageWrapper) {
    previewImageWrapper.addEventListener('click', () => {
      navigateToPreviewProject();
    });
  }

  if (previewImageElement) {
    previewImageElement.draggable = false;
  }
  
  // 监听分类变化事件
  document.addEventListener('categoryChanged', () => {
    renderListView();
  });
  
  // 监听语言变化事件
  document.addEventListener('languageChanged', () => {
    renderListView();
  });

  // Images 视图缩略图网格
  const imagesGrid = document.getElementById('images-grid');
  
  function renderImagesView() {
    if (!imagesGrid) return;
    
    // 判断当前语言
    const isZh = document.body.classList.contains('lang-zh');
    
    // 获取当前筛选的项目
    const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
    const filteredProjects = getListableProjects(category);
    const sortedForImages = [...filteredProjects].sort((a, b) => getProjectSortYear(b.year) - getProjectSortYear(a.year));
    
    imagesGrid.innerHTML = '';
    
    sortedForImages.forEach((project) => {
      const displayTitle = isZh ? project.title : project.titleEn;
      // Images 视图卡片上显示格式：大字项目名 + 小字委托方+拍摄年份
      const displayDescription = getProjectMetaText(project, isZh);
      const coverSrc = buildProgramImagePath(project);
      const cardSrc = buildProjectCardImagePath(project);
      const card = document.createElement('div');
      card.className = 'image-card';
      const viewAllText = isZh ? '查看全部' : 'View All';
      card.innerHTML = `
        <img src="${cardSrc}" alt="${displayTitle}" loading="lazy" decoding="async" fetchpriority="low" />
        <button class="image-card-view-all" type="button" data-en="View All" data-zh="查看全部">${viewAllText}</button>
        <div class="image-card-overlay">
          <h3>${displayTitle}</h3>
          <p>${displayDescription}</p>
        </div>
      `;
      const imageElement = card.querySelector('img');
      if (imageElement) {
        imageElement.addEventListener('error', () => {
          if (imageElement.src !== new URL(coverSrc, window.location.href).href) {
            imageElement.src = coverSrc;
          }
        }, { once: true });
      }

      // 手机端和桌面端不同的点击逻辑：
      // - 电脑端（宽屏）：悬浮显示信息，点击直接进入作品页
      // - 手机端（窄屏）：第一次点击显示信息（高亮当前卡片），第二次点击进入作品页
      const viewAllBtn = card.querySelector('.image-card-view-all');

      // 卡片点击：手机端两次点击进入，电脑端一次点击进入
      card.addEventListener('click', (event) => {
        // 如果点击的是右上角 View All 按钮，交给按钮自己的监听处理
        if (event.target && event.target.closest('.image-card-view-all')) {
          return;
        }

        writeProjectsViewState({
          view: 'images',
          imagesScrollTop: imagesGrid ? imagesGrid.scrollTop : 0,
          previewProjectId: project.id,
        });
        const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
        const url = `project.html?id=${project.id}&from=indexImages&category=${encodeURIComponent(category)}`;

        if (isMobileViewport) {
          const pid = project.id;
          // 第二次点击同一项目：进入作品页
          if (lastTappedProjectIdMobile === pid && card.classList.contains('active')) {
            window.location.href = url;
          } else {
            // 第一次点击（或点击另一个项目）：仅高亮当前卡片并记录 ID，不跳转
            lastTappedProjectIdMobile = pid;
            document.querySelectorAll('.image-card').forEach((c) => c.classList.remove('active'));
            card.classList.add('active');
          }
        } else {
          // 桌面端：保持原逻辑，点击直接进入作品页
          window.location.href = url;
        }
      });

      // 右上角 "View All" 按钮：无论手机还是桌面，直接进入对应作品页
      if (viewAllBtn) {
        viewAllBtn.addEventListener('click', (event) => {
          event.stopPropagation(); // 不触发卡片自身的点击逻辑
          writeProjectsViewState({
            view: 'images',
            imagesScrollTop: imagesGrid ? imagesGrid.scrollTop : 0,
            previewProjectId: project.id,
          });
          const category = window.getCurrentCategory ? window.getCurrentCategory() : 'all';
          const url = `project.html?id=${project.id}&from=indexImagesViewAll&category=${encodeURIComponent(category)}`;
          window.location.href = url;
        });
      }

      imagesGrid.appendChild(card);
    });
  }
  
  // 初始渲染
  if (imagesGrid) {
    renderImagesView();
  }
  
  // 监听分类变化事件
  document.addEventListener('categoryChanged', () => {
    renderImagesView();
  });
  
  // 监听语言变化事件
  document.addEventListener('languageChanged', () => {
    renderImagesView();
  });
})();

// ========== 首页右上角 Map / List 右侧视图切换 ==========
(() => {
  const mapTab = document.querySelector('.view-tab[data-view="map"]');
  const listTab = document.getElementById('view-list-tab');
  const imagesTab = document.getElementById('view-images-tab');
  const mapContainer = document.getElementById('map-container');
  const listContainer = document.getElementById('map-list-container');
  const projectsContainer = document.querySelector('.projects-container');
  const imagesGrid = document.getElementById('images-grid');

  if (!mapTab || !listTab || !imagesTab || !mapContainer || !listContainer || !projectsContainer || !imagesGrid) return;

  function restoreSavedScroll(view) {
    const state = readProjectsViewState();
    if (view === 'list') {
      requestAnimationFrame(() => {
        listContainer.scrollTop = state.listScrollTop || 0;
      });
      return;
    }
    if (view === 'images') {
      requestAnimationFrame(() => {
        imagesGrid.scrollTop = state.imagesScrollTop || 0;
      });
    }
  }

  function ensureStandardPreviewProject() {
    if (!window.currentProjectData || !window.currentProjectData.mapOnly) return;

    const fallbackProject = projectsData.find((project) => !project.mapOnly);
    if (fallbackProject && typeof window.currentProjectId !== 'undefined') {
      const event = new CustomEvent('forceProjectPreview', { detail: { projectId: fallbackProject.id } });
      document.dispatchEvent(event);
    }
  }

  // 显示地图视图
  function showMap() {
    writeProjectsViewState({ view: 'map' });
    mapTab.classList.add('active');
    listTab.classList.remove('active');
    imagesTab.classList.remove('active');
    projectsContainer.style.display = 'flex';
    mapContainer.style.display = 'block';
    listContainer.style.display = 'none';
    imagesGrid.style.display = 'none';
    document.body.classList.remove('images-mode');
  }

  // 显示列表视图（仅右侧区域切换，左侧预览保持不变）
  function showList() {
    ensureStandardPreviewProject();
    writeProjectsViewState({ view: 'list' });
    mapTab.classList.remove('active');
    listTab.classList.add('active');
    imagesTab.classList.remove('active');
    projectsContainer.style.display = 'flex';
    mapContainer.style.display = 'none';
    listContainer.style.display = 'block';
    imagesGrid.style.display = 'none';
    document.body.classList.remove('images-mode');
    restoreSavedScroll('list');
  }

  // 显示 Images 视图：隐藏左右两个板块，只显示全宽网格
  function showImages() {
    ensureStandardPreviewProject();
    writeProjectsViewState({ view: 'images' });
    mapTab.classList.remove('active');
    listTab.classList.remove('active');
    imagesTab.classList.add('active');
    projectsContainer.style.display = 'none';
    imagesGrid.style.display = 'grid';
    document.body.classList.add('images-mode');
    restoreSavedScroll('images');
  }

  listContainer.addEventListener('scroll', () => {
    writeProjectsViewState({ listScrollTop: listContainer.scrollTop });
  }, { passive: true });

  imagesGrid.addEventListener('scroll', () => {
    writeProjectsViewState({ imagesScrollTop: imagesGrid.scrollTop });
  }, { passive: true });

  mapTab.addEventListener('click', () => {
    showMap();
    // 切换视图时，暂时关闭手机端的自动对齐滚动，避免误触发滚回首页/首屏
    if (typeof window !== 'undefined') {
      window.disableMobileAutoScroll = true;
      setTimeout(() => {
        window.disableMobileAutoScroll = false;
      }, 800);
    }
    // 仅桌面端更新 hash，用于从作品详情页返回时定位
    if (!isMobileViewport && window.location.hash.startsWith('#projects-section')) {
      window.location.hash = '#projects-section';
    }
  });
  listTab.addEventListener('click', () => {
    showList();
    if (typeof window !== 'undefined') {
      window.disableMobileAutoScroll = true;
      setTimeout(() => {
        window.disableMobileAutoScroll = false;
      }, 800);
    }
    if (!isMobileViewport && window.location.hash.startsWith('#projects-section')) {
      window.location.hash = '#projects-section-list';
    }
  });
  imagesTab.addEventListener('click', () => {
    showImages();
    if (typeof window !== 'undefined') {
      window.disableMobileAutoScroll = true;
      setTimeout(() => {
        window.disableMobileAutoScroll = false;
      }, 800);
    }
    // 手机端不改 hash，避免锚点跳转带来的自动滚动；桌面端仍然保留
    if (!isMobileViewport && window.location.hash.startsWith('#projects-section')) {
      window.location.hash = '#projects-section-images';
    }
  });

  // 初始根据 hash 决定是地图、列表还是 Images 视图
  const hash = window.location.hash;
  const isReturningToProjects = hash === '#projects-section' || hash === '#projects-section-list' || hash === '#projects-section-images';
  
  function initializeView() {
    if (hash === '#projects-section-list') {
      showList();
    } else if (hash === '#projects-section-images') {
      showImages();
    } else if (hash === '#projects-section') {
      showMap();
    } else {
      // 正常进入首页，默认显示 List
      showList();
    }
  }
  
  if (isReturningToProjects) {
    // 带锚点返回时，等 load 后再执行视图切换并移除隐藏
    window.addEventListener('load', () => {
      initializeView();
      // 视图切换完成后立即显示页面
      requestAnimationFrame(() => {
        document.documentElement.classList.remove('start-at-projects');
      });
    });
  } else {
    // 正常进入首页，直接初始化视图
    initializeView();
  }
})();

// ========== 顶部 Work / About 切换 ==========
(() => {
  const filmList = document.getElementById('film-list');
  const filmPlayer = document.getElementById('film-player');
  const filmPlayerFrame = filmPlayer ? filmPlayer.closest('.film-player-frame') : null;
  const filmPlayBtn = document.getElementById('film-play-btn');
  const filmCenterPlay = document.getElementById('film-center-play');
  const filmProgress = document.getElementById('film-progress');
  const filmLoadingIndicator = document.getElementById('film-loading-indicator');
  const filmVolume = document.getElementById('film-volume');
  const filmVolumePanel = document.getElementById('film-volume-panel');
  const filmVolumeSlider = document.getElementById('film-volume-slider');
  const filmMuteBtn = document.getElementById('film-mute-btn');
  const filmFullscreenBtn = document.getElementById('film-fullscreen-btn');

  if (!filmList || !filmPlayer || !filmPlayerFrame || !filmPlayBtn || !filmCenterPlay || !filmProgress || !filmLoadingIndicator || !filmVolume || !filmVolumePanel || !filmVolumeSlider || !filmMuteBtn || !filmFullscreenBtn) return;

  let currentFilmIndex = 0;
  let isSeekingFilm = false;
  let rememberedFilmVolume = 1;
  let shouldResumeFilmOnReturn = false;

  function isFilmSectionActive() {
    return document.body.classList.contains('film-mode');
  }

  filmPlayer.muted = true;
  filmPlayer.volume = 0;
  filmVolumeSlider.value = '0';

  function updateFilmVolumeProgress() {
    const percent = Math.max(0, Math.min(100, Number(filmVolumeSlider.value)));
    filmVolumeSlider.style.setProperty('--film-volume-progress', `${percent}%`);
  }

  function updateFilmLoadingText() {
    const isZh = document.body.classList.contains('lang-zh');
    filmLoadingIndicator.textContent = isZh ? '视频加载中' : 'Loading video...';
  }

  function setFilmLoadingState(isLoading) {
    filmPlayerFrame.dataset.loading = isLoading ? 'true' : 'false';
  }

  function updatePlaybackState() {
    const isZh = document.body.classList.contains('lang-zh');
    const isPaused = filmPlayer.paused;
    filmPlayerFrame.dataset.paused = isPaused ? 'true' : 'false';
    filmPlayBtn.setAttribute('aria-label', isPaused ? (isZh ? '播放视频' : 'Play video') : (isZh ? '暂停视频' : 'Pause video'));
    filmCenterPlay.setAttribute('aria-label', isZh ? '播放视频' : 'Play video');
  }

  function updateFilmProgress(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    filmProgress.style.setProperty('--film-progress', `${clamped}%`);
  }

  function syncFilmProgress() {
    if (!Number.isFinite(filmPlayer.duration) || filmPlayer.duration <= 0 || isSeekingFilm) return;
    const progressValue = (filmPlayer.currentTime / filmPlayer.duration) * 1000;
    filmProgress.value = String(Math.max(0, Math.min(1000, progressValue)));
    updateFilmProgress((progressValue / 1000) * 100);
  }

  function updateMuteState() {
    const isZh = document.body.classList.contains('lang-zh');
    const muted = filmPlayer.muted || filmPlayer.volume === 0;
    filmVolume.dataset.muted = muted ? 'true' : 'false';
    filmMuteBtn.setAttribute('aria-label', muted ? (isZh ? '开启声音' : 'Sound') : (isZh ? '调整音量' : 'Volume'));
  }

  function playFilm() {
    const playAttempt = filmPlayer.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
    updatePlaybackState();
  }

  function pauseFilm() {
    filmPlayer.pause();
    updatePlaybackState();
  }

  function toggleFilmPlayback() {
    if (filmPlayer.paused) {
      playFilm();
    } else {
      pauseFilm();
    }
  }

  function suspendFilmPlaybackForHiddenState() {
    if (!filmPlayer.paused) {
      shouldResumeFilmOnReturn = true;
      pauseFilm();
    } else {
      shouldResumeFilmOnReturn = false;
    }
  }

  function resumeFilmPlaybackAfterHiddenState() {
    if (shouldResumeFilmOnReturn) {
      shouldResumeFilmOnReturn = false;
      playFilm();
    }
  }

  async function requestFilmFullscreen() {
    const target = filmPlayerFrame;
    if (!target) return;

    try {
      if (isMobileViewport && filmPlayer.webkitEnterFullscreen) {
        filmPlayer.webkitEnterFullscreen();
        return;
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }

      if (isMobileViewport && screen.orientation && screen.orientation.lock) {
        try {
          await screen.orientation.lock('landscape');
        } catch (error) {}
      }
    } catch (error) {}
  }

  function renderFilmList() {
    const isZh = document.body.classList.contains('lang-zh');
    filmList.innerHTML = '';

    filmLibrary.forEach((film, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `film-list-item${index === currentFilmIndex ? ' active' : ''}`;
      item.innerHTML = `
        <span class="film-list-item-title">${isZh ? film.title : film.titleEn}</span>
        <span class="film-list-item-status">${isZh ? '• 正在播放' : '• Playing'}</span>
      `;
      item.addEventListener('click', () => {
        switchFilm(index);
      });
      filmList.appendChild(item);
    });
  }

  function switchFilm(index) {
    const nextFilm = filmLibrary[index];
    if (!nextFilm) return;

    currentFilmIndex = index;
    setFilmLoadingState(true);
    filmPlayer.src = nextFilm.src;
    filmPlayer.muted = true;
    filmPlayer.volume = 0;
    rememberedFilmVolume = 1;
    filmVolume.dataset.open = 'false';
    filmVolume.classList.remove('open');
    filmVolumeSlider.value = '0';
    updateFilmVolumeProgress();
    filmProgress.value = '0';
    updateFilmProgress(0);
    updateMuteState();
    filmPlayer.load();
    if (isFilmSectionActive()) {
      playFilm();
    } else {
      shouldResumeFilmOnReturn = true;
      pauseFilm();
    }
    renderFilmList();
  }

  renderFilmList();
  updateFilmLoadingText();
  switchFilm(0);

  filmPlayer.addEventListener('loadedmetadata', () => {
    filmProgress.value = '0';
    updateFilmProgress(0);
    if (!isFilmSectionActive()) {
      pauseFilm();
    }
  });
  filmPlayer.addEventListener('loadstart', () => setFilmLoadingState(true));
  filmPlayer.addEventListener('waiting', () => setFilmLoadingState(true));
  filmPlayer.addEventListener('loadeddata', () => setFilmLoadingState(false));
  filmPlayer.addEventListener('canplay', () => setFilmLoadingState(false));
  filmPlayer.addEventListener('playing', () => setFilmLoadingState(false));
  filmPlayer.addEventListener('error', () => setFilmLoadingState(false));

  filmPlayer.addEventListener('timeupdate', syncFilmProgress);
  filmPlayer.addEventListener('play', updatePlaybackState);
  filmPlayer.addEventListener('pause', updatePlaybackState);

  filmPlayer.addEventListener('volumechange', () => {
    const volumeValue = filmPlayer.muted ? 0 : Math.round(filmPlayer.volume * 100);
    filmVolumeSlider.value = String(volumeValue);
    if (!filmPlayer.muted && filmPlayer.volume > 0) {
      rememberedFilmVolume = filmPlayer.volume;
    }
    updateFilmVolumeProgress();
    updateMuteState();
  });

  filmProgress.addEventListener('input', () => {
    isSeekingFilm = true;
    const percent = (Number(filmProgress.value) / 1000) * 100;
    updateFilmProgress(percent);
  });

  const applyFilmSeek = () => {
    if (Number.isFinite(filmPlayer.duration) && filmPlayer.duration > 0) {
      filmPlayer.currentTime = (Number(filmProgress.value) / 1000) * filmPlayer.duration;
    }
    isSeekingFilm = false;
    syncFilmProgress();
  };

  filmProgress.addEventListener('change', applyFilmSeek);
  filmProgress.addEventListener('pointerup', applyFilmSeek);
  filmProgress.addEventListener('touchend', applyFilmSeek);

  filmPlayBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleFilmPlayback();
  });

  filmCenterPlay.addEventListener('click', (event) => {
    event.stopPropagation();
    playFilm();
  });

  filmPlayer.addEventListener('click', toggleFilmPlayback);

  filmMuteBtn.addEventListener('click', () => {
    const muted = filmPlayer.muted || filmPlayer.volume === 0;
    if (muted) {
      const restoredVolume = rememberedFilmVolume > 0 ? rememberedFilmVolume : 1;
      filmPlayer.muted = false;
      filmPlayer.volume = restoredVolume;
      filmVolumeSlider.value = String(Math.round(restoredVolume * 100));
      filmVolume.classList.add('open');
      filmVolume.dataset.open = 'true';
    } else {
      rememberedFilmVolume = filmPlayer.volume > 0 ? filmPlayer.volume : rememberedFilmVolume;
      filmPlayer.volume = 0;
      filmPlayer.muted = true;
      filmVolume.classList.remove('open');
      filmVolume.dataset.open = 'false';
    }
    updateFilmVolumeProgress();
  });

  filmVolumeSlider.addEventListener('input', () => {
    const volume = Number(filmVolumeSlider.value) / 100;
    filmPlayer.volume = volume;
    filmPlayer.muted = volume === 0;
    if (volume > 0) {
      rememberedFilmVolume = volume;
    }
    updateFilmVolumeProgress();
    updateMuteState();
    const playAttempt = filmPlayer.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  });

  filmFullscreenBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    requestFilmFullscreen();
  });

  document.addEventListener('languageChanged', () => {
    updateFilmLoadingText();
    updatePlaybackState();
    updateMuteState();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!filmVolume.contains(event.target)) {
      filmVolume.classList.remove('open');
      filmVolume.dataset.open = 'false';
    }
  });

  document.addEventListener('languageChanged', () => {
    renderFilmList();
    updateMuteState();
    updatePlaybackState();
    filmFullscreenBtn.setAttribute('aria-label', document.body.classList.contains('lang-zh') ? '全屏观看' : 'Fullscreen video');
  });

  updateFilmVolumeProgress();
  filmFullscreenBtn.setAttribute('aria-label', document.body.classList.contains('lang-zh') ? '全屏观看' : 'Fullscreen video');

  window.pauseFilmForInactiveSection = suspendFilmPlaybackForHiddenState;
  window.resumeFilmForActiveSection = resumeFilmPlaybackAfterHiddenState;
})();

(() => {
  const workTab = document.querySelector('.nav-tab[data-page="work"]');
  const filmTab = document.querySelector('.nav-tab[data-page="film"]');
  const aboutTab = document.querySelector('.nav-tab[data-page="about"]');
  const projectsSection = document.getElementById('projects-section');
  const filmSection = document.getElementById('film-section');
  const aboutSection = document.getElementById('about-section');
  const viewTabs = document.querySelector('.view-tabs');

  if (!workTab || !filmTab || !aboutTab || !projectsSection || !filmSection || !aboutSection || !viewTabs) return;

  function showWork() {
    if (document.body.classList.contains('film-mode') && typeof window.pauseFilmForInactiveSection === 'function') {
      window.pauseFilmForInactiveSection();
    }
    workTab.classList.add('active');
    filmTab.classList.remove('active');
    aboutTab.classList.remove('active');
    projectsSection.style.display = 'block';
    filmSection.style.display = 'none';
    aboutSection.style.display = 'none';
    viewTabs.style.display = 'flex';
    document.body.classList.remove('about-mode');
    document.body.classList.remove('film-mode');
    
    // 暂时禁用手机端自动对齐，避免跳转到顶部
    if (window.disableMobileAutoScroll !== undefined) {
      window.disableMobileAutoScroll = true;
      setTimeout(() => {
        window.disableMobileAutoScroll = false;
      }, 800);
    }
  }

  function showFilm() {
    workTab.classList.remove('active');
    filmTab.classList.add('active');
    aboutTab.classList.remove('active');
    projectsSection.style.display = 'none';
    filmSection.style.display = 'block';
    aboutSection.style.display = 'none';
    viewTabs.style.display = 'none';
    document.body.classList.remove('about-mode');
    document.body.classList.add('film-mode');

    if (typeof window.resumeFilmForActiveSection === 'function') {
      window.resumeFilmForActiveSection();
    }

    if (window.disableMobileAutoScroll !== undefined) {
      window.disableMobileAutoScroll = true;
      setTimeout(() => {
        window.disableMobileAutoScroll = false;
      }, 800);
    }
  }

  function showAbout() {
    if (document.body.classList.contains('film-mode') && typeof window.pauseFilmForInactiveSection === 'function') {
      window.pauseFilmForInactiveSection();
    }
    workTab.classList.remove('active');
    filmTab.classList.remove('active');
    aboutTab.classList.add('active');
    projectsSection.style.display = 'none';
    filmSection.style.display = 'none';
    aboutSection.style.display = 'block';
    viewTabs.style.display = 'none';
    document.body.classList.add('about-mode');
    document.body.classList.remove('film-mode');
    
    // 暂时禁用手机端自动对齐，避免跳转到顶部
    if (window.disableMobileAutoScroll !== undefined) {
      window.disableMobileAutoScroll = true;
      setTimeout(() => {
        window.disableMobileAutoScroll = false;
      }, 800);
    }
  }

  workTab.addEventListener('click', (event) => {
    event.preventDefault();    // 阻止默认跳转行为
    showWork();
  });

  filmTab.addEventListener('click', () => {
    showFilm();
  });

  aboutTab.addEventListener('click', () => {
    showAbout();
  });

  // 默认进入首页显示 Work 视图
  showWork();
})();

// ========== 语言切换功能 ==========
(function initLanguageSwitch() {
  let currentLang = 'en'; // 默认英文

  // 获取所有语言切换按钮
  const langSwitchBtns = document.querySelectorAll('.lang-switch-btn');
  
  // 切换语言函数
  function switchLanguage() {
    currentLang = currentLang === 'en' ? 'zh' : 'en';
    
    // 更新所有带有 data-en 和 data-zh 属性的元素
    const translatableElements = document.querySelectorAll('[data-en][data-zh]');
    translatableElements.forEach(element => {
      const enText = element.getAttribute('data-en');
      const zhText = element.getAttribute('data-zh');
      element.textContent = currentLang === 'en' ? enText : zhText;
    });
    
    // 特殊处理：如果分类按钮当前显示的是"全部"分类，需要显示"筛选"
    const categoryBtn = document.getElementById('category-btn');
    if (categoryBtn) {
      const activeCategory = document.querySelector('.category-item.active');
      if (activeCategory && activeCategory.dataset.category === 'all') {
        categoryBtn.textContent = currentLang === 'en' ? 'Filter' : '筛选';
      }
    }
    
    // 在 body 上添加/移除语言类，用于 CSS 调整
    if (currentLang === 'zh') {
      document.body.classList.add('lang-zh');
      document.body.classList.remove('lang-en');
    } else {
      document.body.classList.add('lang-en');
      document.body.classList.remove('lang-zh');
    }
    
    // 切换 About 页面的语言内容容器
    const langEnContents = document.querySelectorAll('.lang-content.lang-en');
    const langZhContents = document.querySelectorAll('.lang-content.lang-zh');
    
    if (currentLang === 'zh') {
      langEnContents.forEach(el => el.style.display = 'none');
      langZhContents.forEach(el => el.style.display = 'block');
    } else {
      langEnContents.forEach(el => el.style.display = 'block');
      langZhContents.forEach(el => el.style.display = 'none');
    }
    
    // 更新首页图片文字（如果当前在首页）
    updateHomeImageText();
    
    // 切换地图语言（如果地图已加载）
    if (typeof window.setMapLanguage === 'function') {
      window.setMapLanguage(currentLang);
    }
    
    // 更新当前选中项目的预览信息（如果在项目展示区域）
    if (typeof window.updateProjectPreviewByLang === 'function') {
      window.updateProjectPreviewByLang();
    }
    
    // 触发语言变化事件，通知 Images 视图和列表视图重新渲染
    const langEvent = new CustomEvent('languageChanged', { detail: { lang: currentLang } });
    document.dispatchEvent(langEvent);
    
    // 保存语言偏好到 localStorage
    localStorage.setItem('preferredLanguage', currentLang);
  }
  
  // 更新首页图片文字的函数
  function updateHomeImageText() {
    const metaBottomLeft = document.querySelector('.meta-bottom-left p');
    const metaBottomCenter = document.querySelector('.meta-bottom-center p');
    if (!metaBottomLeft || !metaBottomCenter) return;
    
    // 获取当前显示的图片索引（通过检查图片src）
    const heroPhoto1 = document.querySelector('.hero-photo-1');
    const heroPhoto2 = document.querySelector('.hero-photo-2');
    if (!heroPhoto1 || !heroPhoto2) return;
    
    // 确定当前显示的图片（opacity > 0 的那张）
    const currentPhoto = heroPhoto1.style.opacity !== '0' && heroPhoto1.style.opacity !== '' ? heroPhoto1 : heroPhoto2;
    const currentSrc = currentPhoto.src;
    
    // 查找匹配的图片数据（使用完整URL或相对路径匹配）
    const currentIndex = Number(document.body.dataset.heroImageIndex || 0);
    const imageData = homeHeroImages[currentIndex] || homeHeroImages.find(img => 
      currentSrc.includes(img.src) || currentSrc.endsWith(img.src.replace('./', ''))
    );
    
    if (imageData) {
      const isZh = currentLang === 'zh';
      metaBottomLeft.textContent = isZh ? imageData.locationZh : imageData.location;
      metaBottomCenter.textContent = isZh ? imageData.descriptionZh : imageData.description;
    }
  }
  
  // 为所有语言切换按钮绑定点击事件
  langSwitchBtns.forEach(btn => {
    btn.addEventListener('click', switchLanguage);
  });
  
  // 页面加载时，检查是否有保存的语言偏好
  const savedLang = localStorage.getItem('preferredLanguage');
  if (savedLang && savedLang === 'zh') {
    currentLang = 'en'; // 设置为 en，这样调用 switchLanguage 会切换到 zh
    switchLanguage();
  }
})();

// ========== 防止 About 页面内容滚动时触发页面滚动 ==========
(function preventAboutScrollPropagation() {
  const aboutWrapper = document.querySelector('.about-section .about-wrapper');
  
  if (!aboutWrapper) return;

  let startY = 0;

  // 记录起始触点位置
  aboutWrapper.addEventListener('touchstart', function(e) {
    if (!e.touches || e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
  }, { passive: false });
  
  // 在顶部继续下拉 / 在底部继续上推时，阻止把滚动传给 window
  aboutWrapper.addEventListener('touchmove', function(e) {
    if (!e.touches || e.touches.length !== 1) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    const scrollTop = this.scrollTop;
    const scrollHeight = this.scrollHeight;
    const offsetHeight = this.offsetHeight;
    const isAtTop = scrollTop <= 0;
    const isAtBottom = scrollTop + offsetHeight >= scrollHeight - 1;

    // 在顶部向下拉，或在底部向上推时，阻止默认，避免滚动到页面
    if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
      e.preventDefault();
    }

    // 始终阻止事件冒泡，避免触发首页滚动逻辑
    e.stopPropagation();
  }, { passive: false });
})();
