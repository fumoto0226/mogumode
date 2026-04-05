/* =========================================
   MoguMode 主应用程序 JavaScript
   从 02061500.html 整理
   
   这个文件包含：
   - Firebase 配置和初始化
   - 用户认证（登录、注册、Google登录）
   - 店铺数据加载和渲染
   - 收藏功能（想吃、好吃、难吃）
   - 添加新店铺功能
   - 随机抽选功能
   ========================================= */

// ==========================================
// Firebase 模块导入
// 这些是 Firebase 提供的功能模块
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithRedirect, updateProfile } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, query, orderBy, setDoc, where, deleteDoc, getDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

/* =========================================
   1. Firebase 配置
   这些是连接 Firebase 后台服务的密钥
   ========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyCB95slhqlbbZKPUeLxyrobMdpGNNOL32s",      // API密钥
    authDomain: "school-0226.firebaseapp.com",               // 认证域名
    projectId: "school-0226",                                // 项目ID
    storageBucket: "school-0226.firebasestorage.app",       // 存储桶
    messagingSenderId: "597216581346",                       // 消息发送者ID
    appId: "1:597216581346:web:e293e1a6420e50fd5a70bb"      // 应用ID
};

const APP_BUILD_VERSION = "v23";
const DEFAULT_AVATAR_URL = "images/avatar-placeholder.svg";

// 初始化 Firebase 服务
const app = initializeApp(firebaseConfig);           // 初始化 Firebase 应用
const auth = getAuth(app);                           // 获取认证服务
const db = getFirestore(app);                        // 获取数据库服务
const storage = getStorage(app);                     // 获取存储服务

// 固定的起点位置（Cocoon Tower - 新宿的一个地标建筑）
const FIXED_ORIGIN = { lat: 35.691638, lng: 139.697005 };
window.mapOrigin = { ...FIXED_ORIGIN };
window.mapOriginType = 'cocoon';

/* =========================================
   2. 全局状态变量
   这些变量在整个应用中共享使用
   ========================================= */
let selectedStoreLocation = null;   // 添加新店时选中的店铺位置
let currentUser = null;             // 当前登录的用户
let localStores = [];               // 本地缓存的所有店铺数据
let currentStoreId = null;          // 当前查看的店铺ID
let myFavIds = [];                  // 我的"想吃"列表（店铺ID数组）
let fetchedPhotoRef = null;         // 从Google获取的照片引用
let localLikes = new Set();         // 我标记为"好吃"的店铺ID集合
let localDislikes = new Set();      // 我标记为"难吃"的店铺ID集合
let currentFavTab = 'want';         // 收藏页当前选中的标签（want/like/dislike）
let myFriends = [];                 // 我的好友ID列表（用户UID数组）
let mySentFriendRequests = [];      // 我已发送的好友申请UID列表（可选字段）
let allUsersCache = [];             // 所有用户缓存（用于好友列表和搜索）
let usersLoadErrorMsg = "";         // 加载用户列表时的错误信息
let incomingFriendRequests = [];
let outgoingPendingFriendUids = new Set();
let friendReqUnsubIncoming = null;
let friendReqUnsubOutgoing = null;
let friendReqUnsubAccepted = null;
let publicUsersUnsub = null;
let viewingFriendUid = "";
let friendProfileFavTab = 'want';
let viewingFriendData = null;
let friendProfileReturnToFriends = false;
let pendingDeleteFriendUid = "";
let pendingDeleteReviewAction = null;
let postSuccessState = null;
let currentRecordDayKey = "";
let currentImageModalDateKey = "";
let currentImageModalSrc = "";
let currentImageModalGallery = [];
let currentImageModalIndex = 0;
let activityImageGallerySeed = 0;
const activityImageGalleryRegistry = new Map();
let recordMainImageByDay = loadRecordMainImageMap();
let recordAutoFocusPending = false;
let currentUserAvatarUrl = "";
let hasLoadedStoresSnapshot = false;
let isRepairingCurrentUserPreferences = false;
let expandableReviewSeed = 0;
let friendsFilterKeyword = "";
let friendProfileOverlayActive = false;
let friendProfileOverlayHideTimer = null;
let friendsPageHideTimer = null;
let recordDayViewHideTimer = null;
let locationLoadingShowTimer = null;
let isFetchingCurrentLocation = false;

window.myFriends = myFriends;

function getCurrentUserAvatarUrl() {
    return currentUserAvatarUrl || currentUser?.photoURL || DEFAULT_AVATAR_URL;
}

window.getCurrentUserAvatarUrl = getCurrentUserAvatarUrl;

function escapeHtml(raw) {
    return String(raw || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getFilledRatingIconCount(score) {
    const val = Math.max(0, Math.min(5, Number(score) || 0));
    return Math.floor(val);
}

window.getFilledRatingIconCount = getFilledRatingIconCount;

function shouldCollapseReviewText(text, maxChars = 110) {
    const normalized = String(text || '').trim();
    if (!normalized) return false;
    if (normalized.length > maxChars) return true;
    return normalized.split(/\r?\n/).length > 3;
}

function renderExpandableReviewText(text, opts = {}) {
    const raw = String(text || '').trim();
    if (!raw) return '';

    const {
        textClassName = '',
        wrapperClassName = '',
        buttonClassName = '',
        lines = 3,
        maxChars = 110
    } = opts;

    const safeText = escapeHtml(raw);
    const shouldCollapse = shouldCollapseReviewText(raw, maxChars);
    const reviewId = `review-${Date.now()}-${expandableReviewSeed++}`;
    const wrapperClasses = ['expandable-review', wrapperClassName].filter(Boolean).join(' ');
    const textClasses = [textClassName, 'expandable-review-text', shouldCollapse ? 'is-collapsed' : ''].filter(Boolean).join(' ');
    const buttonClasses = ['expandable-review-toggle', buttonClassName].filter(Boolean).join(' ');

    return `
        <div class="${wrapperClasses}" data-review-id="${reviewId}">
            <div class="${textClasses}" style="--review-lines:${Math.max(1, Number(lines) || 3)};">${safeText}</div>
            ${shouldCollapse ? `<button class="${buttonClasses}" type="button" onclick="toggleExpandableReview('${reviewId}'); event.stopPropagation();">显示全部</button>` : ''}
        </div>
    `;
}

window.renderExpandableReviewText = renderExpandableReviewText;

window.toggleExpandableReview = (reviewId) => {
    const root = document.querySelector(`.expandable-review[data-review-id="${reviewId}"]`);
    if (!root) return;
    const textEl = root.querySelector('.expandable-review-text');
    const btn = root.querySelector('.expandable-review-toggle');
    if (!textEl || !btn) return;
    const expanded = textEl.classList.toggle('is-expanded');
    textEl.classList.toggle('is-collapsed', !expanded);
    btn.innerText = expanded ? '收起' : '显示全部';
};

function getExistingStoreIdSet() {
    return new Set(
        (Array.isArray(localStores) ? localStores : [])
            .map(store => String(store?.id || ''))
            .filter(Boolean)
    );
}

function sanitizePreferenceIds(ids, validStoreIds) {
    const seen = new Set();
    return (Array.isArray(ids) ? ids : [])
        .map(id => String(id || ''))
        .filter((id) => {
            if (!id || seen.has(id) || !validStoreIds.has(id)) return false;
            seen.add(id);
            return true;
        });
}

function getSanitizedPreferencePayload(data, validStoreIds = getExistingStoreIdSet()) {
    const rawFavorites = Array.isArray(data?.favorites) ? data.favorites : [];
    const rawLikes = Array.isArray(data?.likes) ? data.likes : [];
    const rawDislikes = Array.isArray(data?.dislikes) ? data.dislikes : [];
    const favorites = sanitizePreferenceIds(rawFavorites, validStoreIds);
    const likes = sanitizePreferenceIds(rawLikes, validStoreIds);
    const dislikes = sanitizePreferenceIds(rawDislikes, validStoreIds);
    const changed =
        favorites.length !== rawFavorites.length ||
        likes.length !== rawLikes.length ||
        dislikes.length !== rawDislikes.length;
    const removedIds = [
        ...rawFavorites.filter(id => !favorites.includes(String(id || ''))),
        ...rawLikes.filter(id => !likes.includes(String(id || ''))),
        ...rawDislikes.filter(id => !dislikes.includes(String(id || '')))
    ].map(id => String(id || '')).filter(Boolean);

    return { favorites, likes, dislikes, changed, removedIds };
}

function sanitizeAllUsersCache() {
    if (!hasLoadedStoresSnapshot || !Array.isArray(allUsersCache) || !allUsersCache.length) return;
    const validStoreIds = getExistingStoreIdSet();
    allUsersCache = allUsersCache.map((u) => {
        const sanitized = getSanitizedPreferencePayload(u, validStoreIds);
        return {
            ...u,
            favorites: sanitized.favorites,
            likes: sanitized.likes,
            dislikes: sanitized.dislikes
        };
    });
    window.allUsersCache = allUsersCache;
}

async function repairCurrentUserDanglingPreferences() {
    if (!currentUser?.uid || !hasLoadedStoresSnapshot || isRepairingCurrentUserPreferences) return;
    const validStoreIds = getExistingStoreIdSet();
    const sanitized = getSanitizedPreferencePayload({
        favorites: myFavIds,
        likes: Array.from(localLikes),
        dislikes: Array.from(localDislikes)
    }, validStoreIds);

    if (!sanitized.changed) return;

    myFavIds = sanitized.favorites;
    localLikes = new Set(sanitized.likes);
    localDislikes = new Set(sanitized.dislikes);
    window.myFavIds = myFavIds;
    window.localLikes = localLikes;
    window.localDislikes = localDislikes;

    isRepairingCurrentUserPreferences = true;
    try {
        await Promise.allSettled([
            setDoc(doc(db, "users", currentUser.uid), {
                favorites: sanitized.favorites,
                likes: sanitized.likes,
                dislikes: sanitized.dislikes
            }, { merge: true }),
            setDoc(doc(db, "publicUsers", currentUser.uid), {
                favorites: sanitized.favorites,
                likes: sanitized.likes,
                dislikes: sanitized.dislikes
            }, { merge: true })
        ]);
    } finally {
        isRepairingCurrentUserPreferences = false;
    }
}

function renderBuildVersionTag() {
    const tag = document.getElementById('build-version-tag');
    if (!tag) return;
    tag.innerText = APP_BUILD_VERSION;
}

function isGoogleAccount(user) {
    if (!user) return false;
    return Array.isArray(user.providerData) && user.providerData.some(p => p && p.providerId === 'google.com');
}

async function syncGoogleAvatar(user) {
    if (!user || !isGoogleAccount(user) || !user.photoURL) return;
    try {
        await setDoc(doc(db, "users", user.uid), {
            email: user.email || "",
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : ""),
            avatarUrl: user.photoURL
        }, { merge: true });
        await setDoc(doc(db, "publicUsers", user.uid), {
            email: user.email || "",
            displayName: user.displayName || (user.email ? user.email.split('@')[0] : ""),
            avatarUrl: user.photoURL
        }, { merge: true });
    } catch (err) {
        console.warn("同步Google头像失败:", err);
    }
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.82) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('图片压缩失败'));
        }, type, quality);
    });
}

function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('图片读取失败'));
        };
        img.src = url;
    });
}

function isImageFile(file) {
    return !!(file && String(file.type || '').toLowerCase().startsWith('image/'));
}

async function compressImageForUpload(fileOrBlob, options = {}) {
    const source = fileOrBlob;
    const mime = String(source?.type || '').toLowerCase();
    if (!source || !mime.startsWith('image/')) return source;

    const {
        maxWidth = 1600,
        maxHeight = 1600,
        quality = 0.8,
        minQuality = 0.56,
        maxBytes = 420 * 1024,
        background = '#ffffff'
    } = options;

    const img = await loadImageFromBlob(source);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (!width || !height) return source;

    const ratio = Math.min(1, maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    const renderBlob = async (targetWidth, targetHeight, targetQuality) => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 初始化失败');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        return canvasToBlob(canvas, 'image/jpeg', targetQuality);
    };

    let targetWidth = width;
    let targetHeight = height;
    let targetQuality = quality;
    let compressed = await renderBlob(targetWidth, targetHeight, targetQuality);

    while (compressed.size > maxBytes && targetQuality > minQuality) {
        targetQuality = Math.max(minQuality, targetQuality - 0.08);
        compressed = await renderBlob(targetWidth, targetHeight, targetQuality);
    }

    while (compressed.size > maxBytes && targetWidth > 900 && targetHeight > 900) {
        targetWidth = Math.max(900, Math.round(targetWidth * 0.86));
        targetHeight = Math.max(900, Math.round(targetHeight * 0.86));
        compressed = await renderBlob(targetWidth, targetHeight, targetQuality);
    }

    return compressed.size < source.size ? compressed : source;
}

function normalizeImageAsset(entry) {
    if (!entry) return { full: '', thumb: '' };
    if (typeof entry === 'string') {
        const src = entry.trim();
        return { full: src, thumb: src };
    }
    if (typeof entry === 'object') {
        const full = String(entry.full || entry.url || entry.src || '').trim();
        const thumb = String(entry.thumb || entry.preview || entry.thumbnail || full).trim();
        return { full, thumb: thumb || full };
    }
    return { full: '', thumb: '' };
}

function createImageAssetPayload(fullUrl, thumbUrl = '') {
    const full = String(fullUrl || '').trim();
    const thumb = String(thumbUrl || full).trim();
    if (!full) return '';
    if (!thumb || thumb === full) return full;
    return { full, thumb };
}

function getImageAssetFullUrl(entry) {
    return normalizeImageAsset(entry).full;
}

function getImageAssetThumbUrl(entry) {
    const asset = normalizeImageAsset(entry);
    return asset.thumb || asset.full;
}

function collectImageAssetUrls(entries) {
    return Array.from(new Set((Array.isArray(entries) ? entries : [])
        .flatMap((entry) => {
            const asset = normalizeImageAsset(entry);
            return [asset.full, asset.thumb].filter(Boolean);
        })));
}

async function uploadImageAssetPair(fileOrBlob, basename) {
    const fullBlob = await compressImageForUpload(fileOrBlob, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        minQuality: 0.56,
        maxBytes: 420 * 1024
    });
    const thumbBlob = await compressImageForUpload(fileOrBlob, {
        maxWidth: 360,
        maxHeight: 360,
        quality: 0.68,
        minQuality: 0.48,
        maxBytes: 56 * 1024
    });

    const fullRef = ref(storage, `p/${basename}_full.jpg`);
    const thumbRef = ref(storage, `p/${basename}_thumb.jpg`);
    await Promise.all([
        uploadBytes(fullRef, fullBlob, { contentType: 'image/jpeg' }),
        uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' })
    ]);
    const [fullUrl, thumbUrl] = await Promise.all([
        getDownloadURL(fullRef),
        getDownloadURL(thumbRef)
    ]);
    return createImageAssetPayload(fullUrl, thumbUrl);
}

async function copyGooglePlacePhotoToStorage(photoRef, options = {}) {
    const {
        maxHeightPx = 800,
        maxWidthPx = 800
    } = options;
    if (!photoRef) throw new Error('缺少 Google 图片引用');
    const googleUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxHeightPx=${maxHeightPx}&maxWidthPx=${maxWidthPx}&key=${MAPS_API_KEY}`;
    const response = await fetch(googleUrl);
    if (!response.ok) throw new Error(`Google图片下载失败(${response.status})`);
    const blob = await response.blob();
    const compressedBlob = await compressImageForUpload(blob, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        minQuality: 0.56,
        maxBytes: 420 * 1024
    });
    const thumbBlob = await compressImageForUpload(blob, {
        maxWidth: 360,
        maxHeight: 360,
        quality: 0.68,
        minQuality: 0.48,
        maxBytes: 56 * 1024
    });
    const basename = `google_${Date.now()}`;
    const fullRef = ref(storage, `p/${basename}_full.jpg`);
    const thumbRef = ref(storage, `p/${basename}_thumb.jpg`);
    await Promise.all([
        uploadBytes(fullRef, compressedBlob, { contentType: 'image/jpeg' }),
        uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' })
    ]);
    const [fullUrl, thumbUrl] = await Promise.all([
        getDownloadURL(fullRef),
        getDownloadURL(thumbRef)
    ]);
    return {
        full: fullUrl,
        thumb: thumbUrl
    };
}

// 暴露到全局供 map.js 使用
window.localLikes = localLikes;
window.localDislikes = localDislikes;

/* =========================================
   3. 用户认证逻辑
   处理用户登录状态变化
   ========================================= */

// 监听用户登录状态变化
// 当用户登录或登出时，这个函数会自动被调用
onAuthStateChanged(auth, (u) => {
    currentUser = u;                    // 更新当前用户
    window.currentUser = u;
    currentUserAvatarUrl = u?.photoURL || "";
    if (u) syncGoogleAvatar(u);
    updateUIForAuth(u);                 // 更新页面UI
    if (u) {
        loadFavs();                     // 如果已登录，加载收藏数据
        // 在数据库中创建/更新用户文档
        setDoc(doc(db, "users", u.uid), {
            email: u.email,
            displayName: u.displayName || (u.email ? u.email.split('@')[0] : "")
        }, { merge: true });
        setDoc(doc(db, "publicUsers", u.uid), {
            email: u.email || "",
            displayName: u.displayName || (u.email ? u.email.split('@')[0] : ""),
            avatarUrl: u.photoURL || ""
        }, { merge: true });
    }
});

/**
 * 根据登录状态更新页面UI
 * @param {Object} user - 当前用户对象，如果未登录则为null
 */
function updateUIForAuth(user) {
    // 获取页面上的各个元素
    const els = {
        guest: document.getElementById('guest-info'),           // 游客信息区域（包含登录表单）
        user: document.getElementById('user-info'),             // 用户信息区域
        addMask: document.getElementById('add-auth-mask'),      // 添加页面的登录遮罩
        addForm: document.getElementById('add-form'),           // 添加店铺表单
        headerAvatar: document.getElementById('header-avatar'), // 顶部头像
        addView: document.getElementById('view-add'),
        profileView: document.getElementById('view-profile')
    };

    const syncProfilePanels = (loggedIn) => {
        if (els.profileView) {
            els.profileView.classList.toggle('profile-guest-mode', !loggedIn);
        }
        if (els.user) {
            els.user.classList.toggle('hidden', !loggedIn);
            els.user.style.display = loggedIn ? '' : 'none';
        }
        if (els.guest) {
            els.guest.classList.toggle('hidden', loggedIn);
            els.guest.style.display = loggedIn ? 'none' : '';
        }
    };

    if (user) {
        // 用户已登录：隐藏游客内容，显示用户内容
        syncProfilePanels(true);
        // 显示用户名（取邮箱@前的部分）
        const username = user.displayName || user.email.split('@')[0];
        if (user.photoURL) currentUserAvatarUrl = user.photoURL;
        setProfileIdentity(username, user.photoURL || '');
        els.headerAvatar.innerText = user.email[0].toUpperCase();
        els.headerAvatar.style.background = "#2d3436";
        viewingFriendUid = "";
        viewingFriendData = null;
        updateProfileHeaderMode();
        // 允许添加店铺
        els.addMask.classList.add('hidden');
        els.addForm.classList.remove('hidden');
        if (els.addView) els.addView.classList.remove('add-guest-centered');

        // 加载用户头像
        loadUserAvatar(user.uid);
    } else {
        // 用户未登录：显示游客内容，隐藏用户内容
        syncProfilePanels(false);
        els.addMask.classList.remove('hidden');
        els.addForm.classList.add('hidden');
        if (els.addView) els.addView.classList.add('add-guest-centered');
        els.headerAvatar.innerText = "?";
        els.headerAvatar.style.background = "#b2bec3";

        // 未登录时默认回到「谷歌登录/邮箱登录」入口页
        const authEntry = document.getElementById('auth-entry');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        if (authEntry) authEntry.style.display = 'block';
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'none';

        // 重置好友相关状态并关闭好友页
        myFriends = [];
        window.myFriends = myFriends;
        mySentFriendRequests = [];
        allUsersCache = [];
        window.allUsersCache = allUsersCache;
        stopPublicUsersListener();
        stopFriendRequestListeners();
        viewingFriendUid = "";
        viewingFriendData = null;
        updateProfileHeaderMode();
        const friendsPage = document.getElementById('friends-page');
        if (friendsPage) friendsPage.classList.add('hidden');
        const countEl = document.querySelector('.profile-friends-count');
        if (countEl) countEl.innerText = '0';
    }
}

/**
 * 处理登录
 */
window.handleLogin = async () => {
    const e = document.getElementById('auth-email').value;
    const p = document.getElementById('auth-pass').value;
    if (!e || !p) return alert("请填写邮箱和密码");

    try {
        await signInWithEmailAndPassword(auth, e, p);
        switchView('home');
    } catch (err) {
        alert('登录失败: ' + err.message);
    }
};

/**
 * 处理注册
 */
window.handleRegister = async () => {
    const e = document.getElementById('reg-email').value;
    const p = document.getElementById('reg-pass').value;
    const p2 = document.getElementById('reg-pass-confirm').value;
    if (!e || !p || !p2) return alert("请填写所有字段");
    if (p !== p2) return alert("两次密码输入不一致");
    if (p.length < 6) return alert("密码至少6位");

    try {
        await createUserWithEmailAndPassword(auth, e, p);
        switchView('home');
    } catch (err) {
        alert('注册失败: ' + err.message);
    }
};

/**
 * 显示邮箱登录表单
 */
window.showEmailLogin = () => {
    const authEntry = document.getElementById('auth-entry');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (authEntry) authEntry.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    lucide.createIcons();
};

/**
 * 显示注册表单
 */
window.showRegisterForm = () => {
    const authEntry = document.getElementById('auth-entry');
    if (authEntry) authEntry.style.display = 'none';
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    lucide.createIcons();
};

/**
 * 显示登录表单
 */
window.showLoginForm = () => {
    const authEntry = document.getElementById('auth-entry');
    if (authEntry) authEntry.style.display = 'none';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    lucide.createIcons();
};

/**
 * Google账号登录
 */
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        switchView('home');
    } catch (e) {
        // 弹窗被拦截时，自动降级到 redirect 登录
        if (e && e.code === 'auth/popup-blocked') {
            alert("浏览器拦截了登录弹窗，正在切换到跳转登录...");
            await signInWithRedirect(auth, provider);
            return;
        }
        alert(`Google 登录失败: ${e.message}`);
    }
};

/**
 * 上传头像
 */
window.uploadAvatar = async (input) => {
    if (!input.files || !input.files[0]) return;
    if (!currentUser) return alert("请先登录");

    const file = input.files[0];
    if (!isImageFile(file)) {
        input.value = "";
        return showAppNoticeModal("只能上传图片文件");
    }
    // 限制文件大小 2MB
    if (file.size > 2 * 1024 * 1024) return alert("图片不能超过2MB");

    try {
        // 上传到 Firebase Storage
        const compressedFile = await compressImageForUpload(file, {
            maxWidth: 640,
            maxHeight: 640,
            quality: 0.78,
            minQuality: 0.58,
            maxBytes: 180 * 1024
        });
        const avatarRef = ref(storage, `users/${currentUser.uid}/avatar.jpg`);
        await uploadBytes(avatarRef, compressedFile, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(avatarRef);

        // 保存URL到Firestore
        await updateDoc(doc(db, "users", currentUser.uid), { avatarUrl: url });
        await setDoc(doc(db, "publicUsers", currentUser.uid), {
            email: currentUser.email || "",
            displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : ""),
            avatarUrl: url
        }, { merge: true });
        currentUserAvatarUrl = url;

        // 更新页面显示
        const avatarImg = document.getElementById('profile-avatar-display');
        if (avatarImg) avatarImg.src = url;

        // 更新header头像
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) {
            headerAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        }
    } catch (err) {
        console.error('头像上传失败:', err);
        alert('上传失败: ' + err.message);
    }
};

/**
 * 加载用户头像
 */
async function loadUserAvatar(uid) {
    try {
        const { getDoc: getDocSingle } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
        const userSnap = await getDocSingle(doc(db, "users", uid));
        const firestoreUrl = userSnap.exists() ? userSnap.data().avatarUrl : "";
        const url = firestoreUrl || (currentUser && currentUser.photoURL ? currentUser.photoURL : "");
        if (url) {
            currentUserAvatarUrl = url;
            const avatarImg = document.getElementById('profile-avatar-display');
            if (avatarImg) avatarImg.src = url;

            const headerAvatar = document.getElementById('header-avatar');
            if (headerAvatar) {
                headerAvatar.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            }
        }
    } catch (err) {
        console.log('加载头像失败:', err);
    }
}

/**
 * 退出登录
 */
window.logout = () => signOut(auth);
window.toggleProfileMenu = (event) => {
    event?.stopPropagation?.();
    const menu = document.getElementById('profile-menu');
    if (!menu) return;
    const willOpen = !menu.classList.contains('open');
    if (willOpen) {
        const btn = event?.currentTarget || document.querySelector('.profile-menu-btn');
        const appRoot = document.getElementById('app');
        const rect = btn?.getBoundingClientRect?.();
        const appRect = appRoot?.getBoundingClientRect?.();
        if (rect && appRect) {
            const menuWidth = 132;
            const gap = 8;
            let top = Math.round(rect.top - 2);
            let left = Math.round(rect.right + gap);
            const maxLeft = Math.round(appRect.right - menuWidth - 12);
            const minLeft = Math.round(appRect.left + 12);
            if (left > maxLeft) left = maxLeft;
            if (left < minLeft) left = minLeft;
            if (top < Math.round(appRect.top + 12)) top = Math.round(appRect.top + 12);
            menu.style.top = `${top}px`;
            menu.style.left = `${left}px`;
        }
    }
    menu.classList.toggle('open');
};

window.logoutFromMenu = () => {
    const menu = document.getElementById('profile-menu');
    if (menu) menu.classList.remove('open');
    logout();
};

/* =========================================
   4. 数据加载和监听
   从 Firebase 实时获取店铺数据
   ========================================= */

// 实时监听店铺数据变化
// 当数据库中的店铺数据有任何变化时，这个回调会自动执行
onSnapshot(query(collection(db, "stores"), orderBy("createdAt", "desc")), (snap) => {
    localStores = [];  // 清空本地数据
    // 遍历所有店铺文档
    snap.forEach(d => localStores.push({ id: d.id, ...d.data() }));
    hasLoadedStoresSnapshot = true;
    window.localStores = localStores;  // 暴露到全局，供地图模块使用
    sanitizeAllUsersCache();
    repairCurrentUserDanglingPreferences().catch(err => {
        console.warn("修复当前用户残留收藏失败:", err);
    });
    applyFilters();                    // 渲染店铺列表（包含搜索/筛选/排序）
    // 如果地图模块已加载，也更新地图上的标记
    if (window.renderMarkers) {
        window.renderMarkers();
    }
    const favView = document.getElementById('view-fav');
    if (favView && !favView.classList.contains('hidden')) {
        renderRecordCalendar();
    }
});

/**
 * 更新头像右上角好友数量
 */
function updateFriendsCount() {
    const el = document.querySelector('.profile-friends-count');
    if (el) el.innerText = (myFriends && myFriends.length) ? myFriends.length : 0;
}

function updateFriendRequestDot() {
    const dot = document.getElementById('profile-friends-dot');
    if (!dot) return;
    dot.classList.toggle('hidden', !incomingFriendRequests.length);
    dot.innerText = incomingFriendRequests.length > 9 ? '9+' : String(incomingFriendRequests.length);
}

function getAliasesForUid(targetUid, userData = null) {
    const aliases = new Set();
    if (targetUid) aliases.add(String(targetUid).toLowerCase());
    const data = userData || {};
    if (data.email) {
        aliases.add(String(data.email).toLowerCase());
        if (String(data.email).includes('@')) aliases.add(String(data.email).split('@')[0].toLowerCase());
    }
    if (data.displayName) aliases.add(String(data.displayName).toLowerCase());
    return aliases;
}

function startFriendRequestListeners() {
    if (!currentUser) return;
    if (friendReqUnsubIncoming) friendReqUnsubIncoming();
    if (friendReqUnsubOutgoing) friendReqUnsubOutgoing();
    if (friendReqUnsubAccepted) friendReqUnsubAccepted();

    const incomingQ = query(
        collection(db, "friendRequests"),
        where("toUid", "==", currentUser.uid),
        where("status", "==", "pending")
    );
    friendReqUnsubIncoming = onSnapshot(incomingQ, async (snap) => {
        incomingFriendRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateFriendRequestDot();
        if (isViewingFriendProfile()) updateFriendActionButton();
        if (!allUsersCache.length) await ensureAllUsersLoaded(true);
        if (document.getElementById('friends-page') && !document.getElementById('friends-page').classList.contains('hidden')) {
            renderFriendsList();
        }
    });

    const outgoingQ = query(
        collection(db, "friendRequests"),
        where("fromUid", "==", currentUser.uid),
        where("status", "==", "pending")
    );
    friendReqUnsubOutgoing = onSnapshot(outgoingQ, (snap) => {
        outgoingPendingFriendUids = new Set(snap.docs.map(d => d.data()?.toUid).filter(Boolean));
        mySentFriendRequests = Array.from(outgoingPendingFriendUids);
        if (isViewingFriendProfile()) updateFriendActionButton();
        const searchModal = document.getElementById('friend-search-modal');
        if (searchModal && searchModal.classList.contains('open')) doFriendSearch();
    });

    const acceptedQ = query(
        collection(db, "friendRequests"),
        where("fromUid", "==", currentUser.uid),
        where("status", "==", "accepted")
    );
    friendReqUnsubAccepted = onSnapshot(acceptedQ, async (snap) => {
        const acceptedUids = snap.docs.map(d => d.data()?.toUid).filter(Boolean);
        const toAdd = acceptedUids.filter(uid => !myFriends.includes(uid));
        if (!toAdd.length) return;
        try {
            await updateDoc(doc(db, "users", currentUser.uid), { friends: arrayUnion(...toAdd) });
            myFriends.push(...toAdd.filter(uid => !myFriends.includes(uid)));
            window.myFriends = myFriends;
            updateFriendsCount();
            if (document.getElementById('friends-page') && !document.getElementById('friends-page').classList.contains('hidden')) {
                renderFriendsList();
            }
            if (isViewingFriendProfile()) updateFriendActionButton();
        } catch (err) {
            console.error("同步已通过好友失败:", err);
        }
    });
}

function stopFriendRequestListeners() {
    if (friendReqUnsubIncoming) friendReqUnsubIncoming();
    if (friendReqUnsubOutgoing) friendReqUnsubOutgoing();
    if (friendReqUnsubAccepted) friendReqUnsubAccepted();
    friendReqUnsubIncoming = null;
    friendReqUnsubOutgoing = null;
    friendReqUnsubAccepted = null;
    incomingFriendRequests = [];
    outgoingPendingFriendUids = new Set();
    mySentFriendRequests = [];
    updateFriendRequestDot();
}

function stopPublicUsersListener() {
    if (publicUsersUnsub) publicUsersUnsub();
    publicUsersUnsub = null;
}

/**
 * 加载当前用户的收藏数据
 */
function loadFavs() {
    if (!currentUser) return;
    startFriendRequestListeners();
    ensureAllUsersLoaded().catch(err => {
        console.error("启动用户实时监听失败:", err);
    });
    // 实时监听用户的收藏数据
    onSnapshot(doc(db, "users", currentUser.uid), (d) => {
        if (d.exists()) {
            const data = d.data();
            const sanitized = hasLoadedStoresSnapshot
                ? getSanitizedPreferencePayload(data)
                : {
                    favorites: data.favorites || [],
                    likes: data.likes || [],
                    dislikes: data.dislikes || []
                };
            myFavIds = sanitized.favorites || [];
            currentUserAvatarUrl = data.avatarUrl || currentUser?.photoURL || currentUserAvatarUrl;

            localLikes = new Set(sanitized.likes || []);
            localDislikes = new Set(sanitized.dislikes || []);

            // 更新全局变量供 map.js 使用
            window.myFavIds = myFavIds;
            window.localLikes = localLikes;
            window.localDislikes = localDislikes;

            // 好友列表
            myFriends = data.friends || [];
            window.myFriends = myFriends;
            mySentFriendRequests = Array.from(outgoingPendingFriendUids);
            updateFriendsCount();
            if (isViewingFriendProfile()) updateFriendActionButton();
            setDoc(doc(db, "publicUsers", currentUser.uid), {
                favorites: myFavIds,
                likes: Array.from(localLikes),
                dislikes: Array.from(localDislikes)
            }, { merge: true });
            if (hasLoadedStoresSnapshot && sanitized.changed) {
                repairCurrentUserDanglingPreferences().catch(err => {
                    console.warn("修复当前用户残留收藏失败:", err);
                });
            }

            if (isHomeViewActive()) refreshVisibleStoreCardPreferenceVisuals();
            else applyFilters();                       // 重新渲染以更新收藏状态
            const favView = document.getElementById('view-fav');
            if (favView && !favView.classList.contains('hidden')) {
                renderRecordCalendar();
            }

            // --- 修复：数据加载完强制刷新地图图标 ---
            if (window.renderMarkers) window.renderMarkers();
        } else {
            // 首次登录或文档缺失时，补一份初始文档，避免后续 updateDoc 失败
            setDoc(doc(db, "users", currentUser.uid), {
                email: currentUser.email || "",
                displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : ""),
                favorites: [],
                likes: [],
                dislikes: [],
                friends: []
            }, { merge: true });
            window.myFriends = [];
        }
    });
}

/* =========================================
   5. 店铺列表渲染
   将店铺数据渲染成卡片显示在页面上
   ========================================= */

let currentInfoStoreId = "";

function getStoreById(storeId) {
    return localStores.find(s => s.id === storeId) || null;
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function resolvePeriodDayMode(periods) {
    const dayNums = (Array.isArray(periods) ? periods : [])
        .flatMap(p => [p?.open?.day, p?.close?.day])
        .map(v => Number(v))
        .filter(v => Number.isFinite(v));

    const hasZero = dayNums.includes(0);
    const hasSeven = dayNums.includes(7);
    // 部分数据源会把周一到周日编码为 1..7，这里做兼容
    return (!hasZero && hasSeven) ? 'oneToSevenMonStart' : 'zeroToSixSunStart';
}

function normalizePeriodDay(dayValue, dayMode = 'zeroToSixSunStart') {
    if (typeof dayValue === 'string') {
        const key = dayValue.trim().toUpperCase();
        const map = {
            SUNDAY: 0,
            MONDAY: 1,
            TUESDAY: 2,
            WEDNESDAY: 3,
            THURSDAY: 4,
            FRIDAY: 5,
            SATURDAY: 6
        };
        if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
        return null;
    }

    const n = Number(dayValue);
    if (!Number.isFinite(n)) return null;

    if (dayMode === 'oneToSevenMonStart' && n >= 1 && n <= 7) {
        return n === 7 ? 0 : n;
    }
    if (n >= 0 && n <= 6) return n;
    if (n >= 1 && n <= 7) return n === 7 ? 0 : n;
    return null;
}

function normalizeOpeningPeriods(openingHours) {
    const periods = Array.isArray(openingHours?.periods) ? openingHours.periods : [];
    if (!periods.length) return [];
    const dayMode = resolvePeriodDayMode(periods);

    return periods.map(period => {
        const openDay = normalizePeriodDay(period?.open?.day, dayMode);
        const closeDayRaw = normalizePeriodDay(period?.close?.day, dayMode);
        const openMin = toNumber(period?.open?.hour, 0) * 60 + toNumber(period?.open?.minute, 0);
        const closeMin = period?.close
            ? toNumber(period?.close?.hour, 0) * 60 + toNumber(period?.close?.minute, 0)
            : (24 * 60);

        return {
            openDay,
            closeDay: closeDayRaw ?? openDay,
            openMin,
            closeMin
        };
    }).filter(period => period.openDay !== null);
}

function getTodayDescriptionOpenTime(openingHours) {
    const lines = Array.isArray(openingHours?.weekdayDescriptions)
        ? openingHours.weekdayDescriptions
        : (Array.isArray(openingHours?.weekdayText) ? openingHours.weekdayText : []);
    if (!lines.length) return null;

    // Google weekday 文本通常按周一到周日排列
    const today = new Date().getDay();
    const idx = (today + 6) % 7;
    const line = String(lines[idx] || lines[today] || '').trim();
    if (!line) return null;
    if (/closed|休息|定休日|暂停|歇业/i.test(line)) return "今日休息";

    const m = line.match(/(\d{1,2})[:：](\d{2})/);
    if (!m) return null;
    return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

const WEEKDAY_LABELS_ZH = {
    1: "周一",
    2: "周二",
    3: "周三",
    4: "周四",
    5: "周五",
    6: "周六",
    0: "周日"
};

function formatMinutesAllow24h(totalMinutes) {
    const n = Number(totalMinutes);
    if (!Number.isFinite(n)) return "00:00";
    if (n >= 24 * 60) return "24:00";
    return formatMinutes(n);
}

function mergeDailyIntervals(intervals = []) {
    if (!intervals.length) return [];
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const prev = merged[merged.length - 1];
        const cur = sorted[i];
        if (cur.start <= prev.end) {
            prev.end = Math.max(prev.end, cur.end);
        } else {
            merged.push({ ...cur });
        }
    }
    return merged;
}

function normalizeOpeningValueText(raw) {
    const text = String(raw || '').trim();
    if (!text) return '定休';
    if (/closed|休息|定休|暂停|歇业/i.test(text)) return '定休';
    if (/24\s*hours|24小时|24時間/i.test(text)) return '00:00-24:00';
    return text
        .replace(/(\d{1,2})\s*[时時]\s*(\d{1,2})\s*分?/g, (_, hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
        .replace(/(\d{1,2})\s*[时時]\s*([^\d]|$)/g, (_, hour, suffix) => `${String(hour).padStart(2, '0')}:00${suffix}`)
        .replace(/\s*[\u2013\u2014〜～]\s*/g, '-')
        .replace(/\s*\/\s*/g, '\n')
        .replace(/\s*,\s*/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*/g, '\n')
        .trim();
}

function formatDayRangeLabel(startIdx, endIdx) {
    const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    if (startIdx === endIdx) return labels[startIdx];
    return `${labels[startIdx]}-${labels[endIdx]}`;
}

function formatOpeningSummaryLine(label, value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return label;
    return `${label}\n${normalizedValue}`;
}

function compressWeeklyLines(valuesByDay) {
    const allSame = valuesByDay.every(v => v === valuesByDay[0]);
    if (allSame) return [formatOpeningSummaryLine('每天', valuesByDay[0])];

    const weekdayValue = valuesByDay[0];
    const weekendValue = valuesByDay[5];
    const weekdaySame = valuesByDay.slice(0, 5).every(v => v === weekdayValue);
    const weekendSame = valuesByDay.slice(5).every(v => v === weekendValue);

    if (weekdaySame && weekendSame) {
        return [
            formatOpeningSummaryLine('平日', weekdayValue),
            formatOpeningSummaryLine('周末', weekendValue)
        ];
    }

    const lines = [];
    let start = 0;
    while (start < valuesByDay.length) {
        let end = start;
        while (end + 1 < valuesByDay.length && valuesByDay[end + 1] === valuesByDay[start]) {
            end += 1;
        }
        lines.push(formatOpeningSummaryLine(formatDayRangeLabel(start, end), valuesByDay[start]));
        start = end + 1;
    }
    return lines;
}

function buildWeeklyLinesFromDescriptions(openingHours) {
    const descLines = Array.isArray(openingHours?.weekdayDescriptions)
        ? openingHours.weekdayDescriptions
        : (Array.isArray(openingHours?.weekdayText) ? openingHours.weekdayText : []);
    if (!descLines.length) return [];

    const values = new Array(7).fill('定休'); // index 0..6 => Mon..Sun
    const dayIndexMap = {
        monday: 0, mon: 0, mondays: 0, 月曜日: 0, 周一: 0, 星期一: 0,
        tuesday: 1, tue: 1, tues: 1, 火曜日: 1, 周二: 1, 星期二: 1,
        wednesday: 2, wed: 2, 水曜日: 2, 周三: 2, 星期三: 2,
        thursday: 3, thu: 3, thur: 3, thurs: 3, 木曜日: 3, 周四: 3, 星期四: 3,
        friday: 4, fri: 4, 金曜日: 4, 周五: 4, 星期五: 4,
        saturday: 5, sat: 5, 土曜日: 5, 周六: 5, 星期六: 5,
        sunday: 6, sun: 6, 日曜日: 6, 周日: 6, 星期日: 6, 星期天: 6
    };

    descLines.forEach((line) => {
        const rawLine = String(line || '').trim();
        if (!rawLine) return;
        const parts = rawLine.split(/[:：]/);
        if (parts.length < 2) return;
        const dayKey = String(parts.shift() || '').trim().toLowerCase();
        const valueRaw = parts.join(':').trim();
        const idx = dayIndexMap[dayKey];
        if (idx === undefined) return;
        values[idx] = normalizeOpeningValueText(valueRaw);
    });

    return compressWeeklyLines(values);
}

function buildWeeklyOpeningLines(openingHours) {
    // 优先使用 Google 原始 weekdayDescriptions，避免时区/跨日拆分误差。
    const fromDescriptions = buildWeeklyLinesFromDescriptions(openingHours);
    if (fromDescriptions.length) return fromDescriptions;

    const periods = normalizeOpeningPeriods(openingHours);
    const lines = [];

    if (periods.length) {
        const byDay = new Map([[0, []], [1, []], [2, []], [3, []], [4, []], [5, []], [6, []]]);
        const dayMinutes = 24 * 60;
        const weekMinutes = 7 * dayMinutes;

        periods.forEach((period) => {
            const openDay = Number(period.openDay);
            const closeDay = Number(period.closeDay);
            if (!Number.isFinite(openDay) || !Number.isFinite(closeDay)) return;
            const openMin = Math.max(0, Math.min(dayMinutes, Number(period.openMin) || 0));
            const closeMinRaw = Math.max(0, Math.min(dayMinutes, Number(period.closeMin) || 0));

            let start = openDay * dayMinutes + openMin;
            let end = closeDay * dayMinutes + closeMinRaw;
            if (end <= start) end += weekMinutes;

            let cursor = start;
            while (cursor < end) {
                const absDay = Math.floor(cursor / dayMinutes);
                const day = ((absDay % 7) + 7) % 7;
                const dayEndAbs = (absDay + 1) * dayMinutes;
                const sliceEnd = Math.min(end, dayEndAbs);
                const startMin = cursor % dayMinutes;
                const endMin = sliceEnd === dayEndAbs ? dayMinutes : (sliceEnd % dayMinutes);
                byDay.get(day)?.push({ start: startMin, end: endMin });
                cursor = sliceEnd;
            }
        });

        const valuesMonToSun = [];
        [1, 2, 3, 4, 5, 6, 0].forEach((day) => {
            const intervals = mergeDailyIntervals(byDay.get(day) || []);
            if (!intervals.length) {
                valuesMonToSun.push('定休');
                return;
            }
            const ranges = intervals.map((it) =>
                `${formatMinutesAllow24h(it.start)}-${formatMinutesAllow24h(it.end)}`
            );
            valuesMonToSun.push(ranges.join(" / "));
        });
        return compressWeeklyLines(valuesMonToSun);
    }

    return lines;
}

function getStoreOpenTimeText(store) {
    if (!store) return "暂无";
    if (isStorePermanentlyClosed(store)) return "永久歇业";
    const weeklyLines = buildWeeklyOpeningLines(store.openingHours);
    if (weeklyLines.length) return weeklyLines.join("\n");
    const fallbackTime = getTodayDescriptionOpenTime(store.openingHours);
    if (fallbackTime) return `今日 ${fallbackTime}`;
    if (store.businessStatus === 'CLOSED_TEMPORARILY') return "暂停营业";
    return "暂无";
}

function renderStoreOpenTimeHtml(store) {
    const text = getStoreOpenTimeText(store);
    if (!text || /^(暂无|暂停营业|永久歇业|今日 )/.test(text)) {
        return escapeHtml(text || '暂无');
    }

    const groups = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const parsed = [];
    for (let i = 0; i < groups.length; i++) {
        const line = groups[i];
        if (/^(每天|平日|周末|周[一二三四五六日](?:-周[一二三四五六日])?)$/.test(line)) {
            const times = [];
            let j = i + 1;
            while (j < groups.length && !/^(每天|平日|周末|周[一二三四五六日](?:-周[一二三四五六日])?)$/.test(groups[j])) {
                times.push(groups[j]);
                j += 1;
            }
            parsed.push({ label: line, times });
            i = j - 1;
            continue;
        }
        parsed.push({ label: '', times: [line] });
    }

    if (!parsed.length) return escapeHtml(text);

    return `<div class="hours-list">${parsed.map(group => `
        <div class="hours-item">
            <div class="hours-day">${escapeHtml(group.label)}</div>
            <div class="hours-times">${group.times.map(t => `<div>${escapeHtml(t)}</div>`).join('')}</div>
        </div>
    `.trim()).join('')}</div>`;
}

function isStorePermanentlyClosed(store) {
    if (!store || typeof store !== 'object') return false;
    return !!store.isPermanentlyClosed || String(store.businessStatus || '').toUpperCase() === 'CLOSED_PERMANENTLY';
}

function renderStoreNameWithStatus(store) {
    const baseName = String(store?.name || '').trim() || '未命名店铺';
    if (!isStorePermanentlyClosed(store)) return baseName;
    return `${baseName}<span class="store-closed-mogu" title="永久歇业"><img src="images/mogu.svg" alt="closed"></span>`;
}

window.isStorePermanentlyClosed = isStorePermanentlyClosed;
window.renderStoreNameWithStatus = renderStoreNameWithStatus;
window.getStoreOpenTimeText = getStoreOpenTimeText;

function getStoreAddressText(store) {
    return store?.address || store?.formattedAddress || "地址未收录";
}

function haversineDistanceMeters(from, to) {
    const lat1 = Number(from?.lat);
    const lng1 = Number(from?.lng);
    const lat2 = Number(to?.lat);
    const lng2 = Number(to?.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(6371000 * c);
}

function getCurrentOriginCoords() {
    const origin = window.mapOrigin || FIXED_ORIGIN;
    const lat = Number(origin?.lat);
    const lng = Number(origin?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ...FIXED_ORIGIN };
    return { lat, lng };
}

function getStoreLinearDistanceMeters(store) {
    const lat = Number(store?.lat);
    const lng = Number(store?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const fallback = Number(store?.distance);
        return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback) : null;
    }
    return haversineDistanceMeters(getCurrentOriginCoords(), { lat, lng });
}

function formatStoreDistanceText(store) {
    const meters = getStoreLinearDistanceMeters(store);
    if (!Number.isFinite(meters) || meters < 0) return '--分钟';
    const WALK_METERS_PER_MIN = 70;
    const mins = Math.max(1, Math.round(meters / WALK_METERS_PER_MIN));
    return `${mins}分钟`;
}

window.getStoreLinearDistanceMeters = getStoreLinearDistanceMeters;
window.formatStoreDistanceText = formatStoreDistanceText;

const GENERIC_PLACE_TYPES = new Set([
    'establishment',
    'food',
    'point_of_interest',
    'restaurant',
    'store'
]);

const CUISINE_TYPE_RULES = [
    {
        type: 'chinese_restaurant',
        label: '中餐',
        searchQuery: 'chinese restaurant',
        aliases: [
            '中国', '中国菜', '中国料理', '中华', '中华料理', '中華', '中華料理', '中餐', '中餐厅', '中餐店',
            'china', 'chinese', 'chinesefood', 'chineserestaurant', 'Chinese Restaurant'
        ]
    },
    {
        type: 'japanese_restaurant',
        label: '日料',
        searchQuery: 'japanese restaurant',
        aliases: [
            '日本', '日本菜', '日本料理', '日料', '和食', '和食店', '和食料理店',
            'japan', 'japanese', 'japanesefood', 'japaneserestaurant', 'washoku', 'Japanese Restaurant'
        ]
    },
    {
        type: 'thai_restaurant',
        label: '泰国料理',
        searchQuery: 'thai restaurant',
        aliases: ['泰', '泰料', '泰国', '泰国菜', '泰国料理', 'thai', 'thaifood', 'thaifoods', 'thairestaurant', 'tai', 'タイ', 'タイ料理']
    }
];

function normalizeSearchKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_\-]+/g, '');
}

function formatPlaceTypeLabel(type) {
    return String(type || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getCuisineRuleByType(type) {
    const typeKey = String(type || '').trim().toLowerCase();
    return CUISINE_TYPE_RULES.find(rule => rule.type === typeKey) || null;
}

function inferCuisineRuleFromText(text) {
    const source = normalizeSearchKey(text);
    if (!source) return null;
    return CUISINE_TYPE_RULES.find((rule) => {
        const candidates = [rule.type, rule.label, rule.searchQuery, ...(Array.isArray(rule.aliases) ? rule.aliases : [])];
        return candidates.some((candidate) => {
            const key = normalizeSearchKey(candidate);
            return key && (source === key || source.includes(key) || key.includes(source));
        });
    }) || null;
}

function getStoreCuisineText(store) {
    if (!store) return "";
    const displayName = typeof store?.primaryTypeDisplayName === 'string'
        ? store.primaryTypeDisplayName
        : store?.primaryTypeDisplayName?.text;
    if (store?.cuisineLabel) return String(store.cuisineLabel).trim();
    if (displayName) return String(displayName).trim();

    const directRule = getCuisineRuleByType(store?.primaryType);
    if (directRule) return directRule.label;

    const types = Array.isArray(store?.types) ? store.types : [];
    const typedRule = types.map(getCuisineRuleByType).find(Boolean);
    if (typedRule) return typedRule.label;

    const specificType = types.find(type => type && !GENERIC_PLACE_TYPES.has(String(type).toLowerCase()));
    return specificType ? formatPlaceTypeLabel(specificType) : "";
}

function getStoreCuisineSearchTerms(store) {
    const terms = new Set();
    const cuisineText = getStoreCuisineText(store);
    if (cuisineText) {
        terms.add(cuisineText);
        const inferredRule = inferCuisineRuleFromText(cuisineText);
        if (inferredRule) {
            terms.add(inferredRule.label);
            inferredRule.aliases.forEach(alias => terms.add(alias));
            terms.add(inferredRule.searchQuery);
        }
    }

    const directTypes = [
        store?.primaryType,
        ...(Array.isArray(store?.types) ? store.types : [])
    ].filter(Boolean);

    directTypes.forEach(type => {
        const typeKey = String(type).toLowerCase();
        terms.add(typeKey);
        const rule = getCuisineRuleByType(typeKey);
        if (rule) {
            terms.add(rule.label);
            rule.aliases.forEach(alias => terms.add(alias));
        } else if (!GENERIC_PLACE_TYPES.has(typeKey)) {
            terms.add(formatPlaceTypeLabel(typeKey));
        }
    });

    return Array.from(terms).filter(Boolean);
}

function getStrictCuisineIntentTerms(store) {
    const terms = new Set();
    const cuisineText = getStoreCuisineText(store);
    const inferredRule = inferCuisineRuleFromText(cuisineText);
    const primaryRule = getCuisineRuleByType(store?.primaryType);
    const rule = inferredRule || primaryRule;

    if (cuisineText) terms.add(cuisineText);
    if (rule) {
        terms.add(rule.label);
        terms.add(rule.searchQuery);
        rule.aliases.forEach(alias => terms.add(alias));
    }

    return Array.from(terms).filter(Boolean);
}

function scoreCuisineIntentMatch(query, store) {
    const qKeys = buildStoreSearchKeys(query);
    const tKeys = getStrictCuisineIntentTerms(store).flatMap(term => buildStoreSearchKeys(term));
    let best = 0;

    qKeys.forEach((qKey) => {
        tKeys.forEach((tKey) => {
            if (!qKey || !tKey) return;
            if (qKey === tKey) best = Math.max(best, 120);
            else if (tKey.startsWith(qKey)) best = Math.max(best, 100 - Math.max(0, tKey.length - qKey.length));
            else if (tKey.includes(qKey)) best = Math.max(best, 82 - Math.min(16, tKey.indexOf(qKey)));
        });
    });

    return best;
}

function resolveCuisineSearchIntent(query) {
    const raw = String(query || '').trim();
    if (!raw) return null;
    const queryKey = normalizeSearchKey(raw);
    if (!queryKey) return null;

    for (const rule of CUISINE_TYPE_RULES) {
        const matched = rule.aliases.some(alias => {
            const aliasKey = normalizeSearchKey(alias);
            if (!aliasKey) return false;
            const isAsciiAlias = /^[a-z0-9]+$/.test(aliasKey);
            return queryKey === aliasKey || (!isAsciiAlias && queryKey.includes(aliasKey));
        });
        if (matched) {
            return {
                type: rule.type,
                label: rule.label,
                searchQuery: rule.searchQuery,
                replaceQuery: rule.aliases.some(alias => normalizeSearchKey(alias) === queryKey)
            };
        }
    }
    return null;
}

window.resolveCuisineSearchIntent = resolveCuisineSearchIntent;

function normalizeStoreAdditionalInfoRows(store) {
    const baseRows = [
        {
            id: "base-open",
            category: "营业时间",
            content: getStoreOpenTimeText(store),
            fixed: true
        },
        ...(getStoreCuisineText(store) ? [{
            id: "base-cuisine",
            category: "料理种类",
            content: getStoreCuisineText(store),
            fixed: true
        }] : []),
        {
            id: "base-address",
            category: "位置",
            content: getStoreAddressText(store),
            fixed: true
        }
    ];

    const extraRows = Array.isArray(store?.additionalInfo)
        ? store.additionalInfo
            .map(item => ({
                id: item.id || `${item.category || "custom"}-${item.createdAt || Date.now()}`,
                category: item.category || "自定义",
                content: item.content || "",
                fixed: false
            }))
            .filter(item => item.content)
        : [];

    return [...baseRows, ...extraRows];
}

window.generateInfoCardHtml = (store) => {
    const rows = normalizeStoreAdditionalInfoRows(store);
    const fixedRows = rows.filter(r => r.fixed);
    return `
    <div class="info-group-card">
        ${fixedRows.map((r) => `
            <div class="info-row-item ${r.id === 'base-open' ? 'row-time' : ''}">
                <div class="info-label">${r.category} :</div>
                <div class="info-content ${r.id === 'base-open' && isStorePermanentlyClosed(store) ? 'permanent-closed' : ''}">${r.id === 'base-open' ? renderStoreOpenTimeHtml(store) : r.content}</div>
            </div>
        `).join("")}
        <div class="more-info-btn" onclick="openProvideInfoModal('${store.id}')">提供更多信息</div>
    </div>
    `;
};

function buildProvideInfoRowHtml(storeId, row, store = null) {
    const deleteBtnHtml = row.fixed
        ? ''
        : `<button class="fd-del-btn" onclick="deleteAdditionalInfo('${storeId}', '${row.id}')">
                <img src="images/trash.svg" alt="delete">
            </button>`;
    return `
        <div class="provide-info-row">
            <div class="fd-info-label">${row.category}：</div>
            <div class="fd-info-content ${row.id === 'base-open' && isStorePermanentlyClosed(store) ? 'permanent-closed' : ''}">${row.content}</div>
            ${deleteBtnHtml}
        </div>
    `;
}

window.renderProvideInfoModal = (storeId) => {
    const store = getStoreById(storeId);
    const list = document.getElementById('provide-info-list');
    if (!store || !list) return;
    const rows = normalizeStoreAdditionalInfoRows(store);
    list.innerHTML = rows.map(row => buildProvideInfoRowHtml(storeId, row, store)).join('');
};

window.openProvideInfoModal = (storeId) => {
    const targetStoreId = storeId || currentInfoStoreId;
    if (!targetStoreId) return;
    currentInfoStoreId = targetStoreId;
    const modal = document.getElementById('provide-info-modal');
    if (modal) modal.classList.add('open');
    syncProvideCategoryMode();
    renderProvideInfoModal(targetStoreId);
};

window.closeProvideInfoModal = () => {
    const modal = document.getElementById('provide-info-modal');
    if (modal) modal.classList.remove('open');
};

// 辅助函数：格式化时间对象 {hour: 10, minute: 0} -> "10:00"
function formatTime(t) {
    const h = toNumber(t?.hour, 0).toString().padStart(2, '0');
    const m = toNumber(t?.minute, 0).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function formatMinutes(totalMinutes) {
    const normalized = ((toNumber(totalMinutes, 0) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function loadRecordMainImageMap() {
    try {
        const raw = localStorage.getItem('recordMainImageByDayV1');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
        return {};
    }
}

function saveRecordMainImageMap() {
    try {
        localStorage.setItem('recordMainImageByDayV1', JSON.stringify(recordMainImageByDay || {}));
    } catch (err) {
        console.warn('保存主图配置失败:', err);
    }
}

function getFriendReactionStats(storeId) {
    const stats = {
        dislike: { count: 0, avatars: [] },
        like: { count: 0, avatars: [] }
    };
    if (!storeId) return stats;
    const friendSet = new Set(Array.isArray(myFriends) ? myFriends : []);
    if (!friendSet.size) return stats;

    (Array.isArray(allUsersCache) ? allUsersCache : [])
        .filter(u => friendSet.has(u.id))
        .forEach(u => {
            const avatar = u.avatarUrl || u.photoURL || DEFAULT_AVATAR_URL;
            const likes = Array.isArray(u.likes) ? u.likes : [];
            const dislikes = Array.isArray(u.dislikes) ? u.dislikes : [];
            if (likes.includes(storeId)) {
                stats.like.count += 1;
                stats.like.avatars.push(avatar);
            }
            if (dislikes.includes(storeId)) {
                stats.dislike.count += 1;
                stats.dislike.avatars.push(avatar);
            }
        });
    return stats;
}

function getStoreReactionStats(storeId) {
    const stats = getFriendReactionStats(storeId);
    if (!storeId || !currentUser) return stats;

    const avatar = getCurrentUserAvatarUrl();
    if (localLikes.has(storeId)) {
        stats.like.count += 1;
        stats.like.avatars.unshift(avatar);
    }
    if (localDislikes.has(storeId)) {
        stats.dislike.count += 1;
        stats.dislike.avatars.unshift(avatar);
    }
    return stats;
}

function getStoreAverageRating(store) {
    const revs = Array.isArray(store?.revs) ? store.revs : [];
    const nums = revs.map(r => Number(r?.rating)).filter(n => Number.isFinite(n) && n > 0);
    if (nums.length) {
        const sum = nums.reduce((a, b) => a + b, 0);
        return sum / nums.length;
    }
    const fallback = Number(store?.rating);
    return Number.isFinite(fallback) ? fallback : 0;
}

function getStoreReviewCount(store) {
    return Array.isArray(store?.revs) ? store.revs.length : 0;
}

function getStorePreviewImageEntries(store, maxCount = 12) {
    const coverFull = String(store?.googleCoverImage || '').trim();
    const coverThumb = String(store?.googleCoverImageThumb || coverFull).trim();
    const revs = Array.isArray(store?.revs) ? [...store.revs] : [];
    revs.sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));

    const ordered = [];
    if (coverFull) ordered.push(createImageAssetPayload(coverFull, coverThumb));

    revs.forEach((rev) => {
        const imgs = Array.isArray(rev?.images) ? rev.images : [];
        imgs.forEach((entry) => {
            const full = getImageAssetFullUrl(entry);
            if (full) ordered.push(createImageAssetPayload(full, getImageAssetThumbUrl(entry)));
        });
    });

    const storeImgs = Array.isArray(store?.images) ? store.images : [];
    storeImgs.forEach((entry) => {
        const full = getImageAssetFullUrl(entry);
        if (full) ordered.push(createImageAssetPayload(full, getImageAssetThumbUrl(entry)));
    });

    const deduped = [];
    const seen = new Set();
    ordered.forEach((entry) => {
        const full = getImageAssetFullUrl(entry);
        if (!full || seen.has(full)) return;
        seen.add(full);
        deduped.push(entry);
    });

    return deduped.slice(0, Math.max(1, maxCount));
}

function getStorePreviewImages(store, maxCount = 12) {
    return getStorePreviewImageEntries(store, maxCount).map(getImageAssetFullUrl).filter(Boolean);
}

window.getStoreAverageRating = getStoreAverageRating;
window.getStoreReviewCount = getStoreReviewCount;
window.getStorePreviewImages = getStorePreviewImages;
window.getStorePreviewImageEntries = getStorePreviewImageEntries;
window.getImageAssetFullUrl = getImageAssetFullUrl;
window.getImageAssetThumbUrl = getImageAssetThumbUrl;

function renderReactionAvatars(avatars, count) {
    if (!count || count <= 0) {
        return `<div class="action-social-row" aria-hidden="true"></div>`;
    }
    const avatarList = (Array.isArray(avatars) && avatars.length) ? avatars : [DEFAULT_AVATAR_URL];
    const showAvatarCount = Math.min(count, 4);
    const avatarHtml = Array.from({ length: showAvatarCount }).map((_, idx) => {
        const src = avatarList[idx % avatarList.length];
        return `<img src="${src}" class="action-avatar" alt="friend-${idx + 1}">`;
    }).join('');
    return `
        <div class="action-social-row">
            <div class="action-avatars">${avatarHtml}</div>
            <span class="action-count-top">${count}</span>
        </div>
    `;
}

function renderStoreActionGroup(storeId, isLiked, isDisliked, cardIndex = 0) {
    const stats = getStoreReactionStats(storeId);
    const dislikeCount = Number(stats.dislike.count || 0);
    const likeCount = Number(stats.like.count || 0);
    const dislikeIcon = isDisliked ? "images/dislike-f.svg" : "images/dislike.svg";
    const likeIcon = isLiked ? "images/like-f.svg" : "images/like.svg";
    return `
        <div class="action-group" data-store-id="${storeId}" onclick="event.stopPropagation()">
            <div class="action-item ${isDisliked ? 'active-dislike' : ''}" onclick="toggleLocalAction('${storeId}', 'dislike')">
                ${renderReactionAvatars(stats.dislike.avatars, dislikeCount)}
                <img src="${dislikeIcon}" class="action-icon" alt="dislike">
            </div>
            <div class="action-item ${isLiked ? 'active-like' : ''}" onclick="toggleLocalAction('${storeId}', 'like')">
                ${renderReactionAvatars(stats.like.avatars, likeCount)}
                <img src="${likeIcon}" class="action-icon" alt="like">
            </div>
        </div>
    `;
}

function isHomeViewActive() {
    const homeView = document.getElementById('view-home');
    return !!(homeView && !homeView.classList.contains('hidden'));
}

function getStoreStatusClassById(storeId) {
    if (localDislikes.has(storeId)) return 'status-disliked';
    if (localLikes.has(storeId)) return 'status-liked';
    if (myFavIds.includes(storeId)) return 'status-fav';
    return '';
}

function updateStoreCardPreferenceVisuals(storeId) {
    const sid = String(storeId || '');
    if (!sid) return;
    const isFav = myFavIds.includes(sid);
    const isLiked = localLikes.has(sid);
    const isDisliked = localDislikes.has(sid);
    const nextStatusClass = getStoreStatusClassById(sid);

    document.querySelectorAll('.store-card[data-store-id]').forEach((card) => {
        if (String(card.dataset.storeId || '') !== sid) return;
        card.classList.remove('status-fav', 'status-liked', 'status-disliked');
        if (nextStatusClass) card.classList.add(nextStatusClass);

        const bookmarkIcon = card.querySelector('.bookmark-icon-btn');
        if (bookmarkIcon) {
            bookmarkIcon.setAttribute('src', isFav ? 'images/bookmark-f.svg' : 'images/bookmark.svg');
        }

        const actionGroup = card.querySelector('.action-group');
        if (actionGroup) {
            actionGroup.outerHTML = renderStoreActionGroup(sid, isLiked, isDisliked);
        }
    });
}

function refreshVisibleStoreCardPreferenceVisuals() {
    document.querySelectorAll('.store-card[data-store-id]').forEach((card) => {
        const sid = String(card.dataset.storeId || '');
        if (!sid) return;
        updateStoreCardPreferenceVisuals(sid);
    });
}

/**
 * 渲染店铺列表
 * @param {Array} list - 要渲染的店铺数组
 */
window.renderStores = (list) => {
    const el = document.getElementById('store-list');

    // 如果没有店铺，显示空状态
    if (!list.length) {
        return el.innerHTML = "<div style='text-align:center;margin-top:40px;color:#ccc'>No spots found</div>";
    }

    // 遍历店铺数组，生成HTML
    el.innerHTML = list.map((s, idx) => {
        // 检查当前店铺的收藏状态
        const isFav = myFavIds.includes(s.id);        // 是否在"想吃"列表
        const isLiked = localLikes.has(s.id);         // 是否标记为"好吃"
        const isDisliked = localDislikes.has(s.id);   // 是否标记为"难吃"

        // 根据状态决定卡片边框颜色
        // 优先级：难吃(蓝) > 好吃(红) > 想吃(黄) > 默认
        let statusClass = "";
        if (isDisliked) statusClass = "status-disliked";
        else if (isLiked) statusClass = "status-liked";
        else if (isFav) statusClass = "status-fav";

        const avgRating = getStoreAverageRating(s);
        const reviewCount = getStoreReviewCount(s);
        const rawImgs = getStorePreviewImageEntries(s);
        const displayImgs = rawImgs.length ? rawImgs : ["https://placehold.co/200?text=No+Image"];
        const imagesHtml = displayImgs.map(src =>
            `<img src="${getImageAssetThumbUrl(src)}" class="store-img-item" loading="lazy" decoding="async">`
        ).join('');

        // 返回店铺卡片的HTML
        return `
        <div class="store-card ${statusClass}" id="card-${s.id}" data-store-id="${s.id}" onclick="openDetail('${s.id}')">
            <!-- 卡片头部：店名、收藏按钮、评分、步行时间 -->
            <div class="card-header-row">
                <div class="info-col">
                    <!-- 店名和收藏按钮 -->
                    <div class="store-name-row">
                        <h3 class="store-name">${renderStoreNameWithStatus(s)}</h3>
                        <div onclick="toggleFav('${s.id}'); event.stopPropagation();">
                            <img src="${isFav ? 'images/bookmark-f.svg' : 'images/bookmark.svg'}"
                                 class="bookmark-icon-btn"
                                 alt="want">
                        </div>
                    </div>
                    <!-- 评分和步行时间 -->
                    <div class="store-meta">
                         ${avgRating.toFixed(1)} <span class="rating-star" style="display:inline-flex;align-items:center;"><img src="images/pingfen.svg" style="width:12px;"></span>
                         <span>(${reviewCount})</span>
                         <span style="margin:0 4px">•</span> 
                        <img src="images/walk.svg" style="width:10px; margin-right:3px;">
                         ${formatStoreDistanceText(s)}
                    </div>
                </div>
                
                ${renderStoreActionGroup(s.id, isLiked, isDisliked, idx)}
            </div>
            <!-- 店铺图片横向滚动区域 -->
            <div class="store-img-scroll">${imagesHtml}</div>
        </div>`;
    }).join('') + `
        <div class="store-list-endcap" aria-hidden="true">已经到底了</div>
    `;

    // 重新初始化 Lucide 图标
    lucide.createIcons();
};

/* =========================================
   6. 店铺详情页逻辑
   显示店铺的完整信息
   ========================================= */
let currentDetailId = null;  // 当前详情页显示的店铺ID

/**
 * 打开店铺详情页
 * @param {string} id - 店铺ID
 */
window.openDetail = (id, opts = {}) => {
    const { mode = 'full', fromMap = false } = opts || {};
    currentDetailId = id;
    const s = localStores.find(x => x.id === id);
    if (!s) return;

    // 统一走地图详情弹窗样式
    if (window.renderMapCardFromDB) {
        window.renderMapCardFromDB(s, { mode, fromMap });
        return;
    }

    // 兼容兜底：地图模块未就绪时，仍打开旧详情页
    const detailEl = document.getElementById('full-detail-page');
    if (detailEl) detailEl.classList.add('open');
};

window.handleRouteFromDetail = () => {
    if (!currentDetailId) return;
    if (typeof window.openStoreInGoogleMapsById === 'function') {
        window.openStoreInGoogleMapsById(currentDetailId);
    }
};

/**
 * 渲染追加信息行
 */
function renderAdditionalInfoRow(label, content) {
    const row = document.createElement('div');
    row.className = 'fd-info-row';
    row.innerHTML = `
        <div class="fd-info-label">${label} :</div>
        <div class="fd-info-content">${content}</div>
        <button class="fd-del-btn" onclick="showDeleteInfoModal(this)">
            <i data-lucide="trash-2" width="14"></i>
        </button>
    `;
    // We need to re-run lucide for the new icon, but for performance maybe just innerHTML SVG?
    // Let's use innerHTML SVG for simplicity or call lucide.createIcons() after

    // Using Lucide simple replacement for now since createIcons scans whole doc
    // Actually, createIcons is fine.
    return row;
}

/**
 * 添加追加信息
 */
window.addAdditionalInfo = () => {
    if (!currentUser) {
        alert("请先登录");
        return;
    }
    const catSelect = document.getElementById('provide-new-cat') || document.getElementById('fd-new-cat');
    const catCustom = document.getElementById('provide-new-cat-custom') || document.getElementById('fd-new-cat-custom');
    const valInput = document.getElementById('provide-new-val') || document.getElementById('fd-new-val');
    if (!catSelect || !valInput) return;

    let category = (catSelect.value || "").trim();
    let content = (valInput.value || "").trim();
    if (category === '自定义') {
        category = (catCustom?.value || "").trim();
    } else if (category === '营业时间') {
        const start = (document.getElementById('provide-start-time')?.value || "").trim();
        const end = (document.getElementById('provide-end-time')?.value || "").trim();
        content = start && end ? `开始时间 ${start}；结束时间 ${end}` : "";
    }

    if (!category || !content) {
        alert("请输入完整信息");
        return;
    }

    if (!currentInfoStoreId) currentInfoStoreId = currentDetailId || "";
    if (!currentInfoStoreId) return;

    const row = {
        id: `info-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        category,
        content,
        uid: currentUser.uid,
        createdAt: Date.now()
    };
    const targetStore = getStoreById(currentInfoStoreId);
    if (targetStore) {
        const prev = Array.isArray(targetStore.additionalInfo) ? targetStore.additionalInfo : [];
        targetStore.additionalInfo = [...prev, row];
    }
    updateDoc(doc(db, "stores", currentInfoStoreId), {
        additionalInfo: arrayUnion(row)
    }).then(() => {
        valInput.value = "";
        if (catCustom) catCustom.value = "";
        const startInput = document.getElementById('provide-start-time');
        const endInput = document.getElementById('provide-end-time');
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";
        renderProvideInfoModal(currentInfoStoreId);
    }).catch((err) => {
        console.error("添加附加信息失败:", err);
        alert("添加失败，请重试");
    });
};

window.deleteAdditionalInfo = (storeId, infoId) => {
    pendingDeleteAction = async () => {
        const store = getStoreById(storeId);
        if (!store || !Array.isArray(store.additionalInfo)) return;
        const nextRows = store.additionalInfo.filter(item => item.id !== infoId);
        if (nextRows.length === store.additionalInfo.length) return;
        store.additionalInfo = nextRows;
        try {
            await updateDoc(doc(db, "stores", storeId), { additionalInfo: nextRows });
            renderProvideInfoModal(storeId);
        } catch (err) {
            console.error("删除附加信息失败:", err);
            alert("删除失败，请稍后重试");
        }
    };
    document.getElementById('modal-confirm-delete-info').classList.add('open');
};


// === Modal Logic ===

let pendingDeleteTarget = null; // Store the element to delete
let pendingDeleteAction = null;
let pendingFavConflictResolver = null;

window.showDeleteInfoModal = (btn) => {
    pendingDeleteTarget = btn.closest('.fd-info-row');
    document.getElementById('modal-confirm-delete-info').classList.add('open');
};

window.closeDeleteInfoModal = () => {
    pendingDeleteTarget = null;
    pendingDeleteAction = null;
    document.getElementById('modal-confirm-delete-info').classList.remove('open');
};

window.confirmDeleteInfo = () => {
    const action = pendingDeleteAction;
    if (pendingDeleteTarget) pendingDeleteTarget.remove();
    closeDeleteInfoModal();
    if (action) action();
};

function openFavConflictModal() {
    return new Promise((resolve) => {
        pendingFavConflictResolver = resolve;
        const modal = document.getElementById('modal-fav-conflict');
        if (modal) modal.classList.add('open');
    });
}

window.confirmFavConflictModal = () => {
    const modal = document.getElementById('modal-fav-conflict');
    if (modal) modal.classList.remove('open');
    if (pendingFavConflictResolver) pendingFavConflictResolver(true);
    pendingFavConflictResolver = null;
};

window.cancelFavConflictModal = () => {
    const modal = document.getElementById('modal-fav-conflict');
    if (modal) modal.classList.remove('open');
    if (pendingFavConflictResolver) pendingFavConflictResolver(false);
    pendingFavConflictResolver = null;
};


window.showDeleteStoreModal = () => {
    document.getElementById('modal-confirm-delete-store').classList.add('open');
};

window.closeDeleteStoreModal = () => {
    document.getElementById('modal-confirm-delete-store').classList.remove('open');
};

function isManagedStorageUrl(url) {
    const s = String(url || '');
    if (!s) return false;
    return s.includes(firebaseConfig.storageBucket) || s.includes('firebasestorage.googleapis.com');
}

async function deleteStorageFilesByUrls(urls) {
    const unique = Array.from(new Set((Array.isArray(urls) ? urls : []).filter(Boolean)));
    const tasks = unique.map(async (url) => {
        if (!isManagedStorageUrl(url)) return;
        try {
            await deleteObject(ref(storage, url));
        } catch (err) {
            if (err?.code !== 'storage/object-not-found') {
                console.warn('删除图片失败:', url, err);
            }
        }
    });
    await Promise.allSettled(tasks);
}

function collectStoreAllImageUrls(store) {
    const storeImages = collectImageAssetUrls(Array.isArray(store?.images) ? store.images : []);
    const reviewImages = (Array.isArray(store?.revs) ? store.revs : [])
        .flatMap(r => collectImageAssetUrls(Array.isArray(r?.images) ? r.images : []));
    const coverImage = [store?.googleCoverImage, store?.googleCoverImageThumb].filter(Boolean);
    return Array.from(new Set([...coverImage, ...storeImages, ...reviewImages].filter(Boolean)));
}

function getDeleteStoreTargetId() {
    const mapSheetId = document.getElementById('map-detail-card')?.dataset?.storeId || "";
    if (mapSheetId) return mapSheetId;
    if (currentDetailId) return currentDetailId;
    if (currentStoreId) return currentStoreId;
    return "";
}

function removeStoreIdFromLocalPreferenceState(storeId) {
    const sid = String(storeId || '');
    if (!sid) return;
    myFavIds = (Array.isArray(myFavIds) ? myFavIds : []).filter(id => id !== sid);
    localLikes.delete(sid);
    localDislikes.delete(sid);
    window.myFavIds = myFavIds;
    window.localLikes = localLikes;
    window.localDislikes = localDislikes;

    allUsersCache = (Array.isArray(allUsersCache) ? allUsersCache : []).map((u) => ({
        ...u,
        favorites: (Array.isArray(u?.favorites) ? u.favorites : []).filter(id => id !== sid),
        likes: (Array.isArray(u?.likes) ? u.likes : []).filter(id => id !== sid),
        dislikes: (Array.isArray(u?.dislikes) ? u.dislikes : []).filter(id => id !== sid)
    }));
}

async function cleanupStoreReferencesForCurrentUser(storeId) {
    const sid = String(storeId || '');
    if (!sid || !currentUser?.uid) return false;
    try {
        await Promise.allSettled([
            updateDoc(doc(db, "users", currentUser.uid), {
                favorites: arrayRemove(sid),
                likes: arrayRemove(sid),
                dislikes: arrayRemove(sid)
            }),
            setDoc(doc(db, "publicUsers", currentUser.uid), {
                favorites: myFavIds.filter(id => id !== sid),
                likes: Array.from(localLikes).filter(id => id !== sid),
                dislikes: Array.from(localDislikes).filter(id => id !== sid)
            }, { merge: true })
        ]);
        return true;
    } catch (err) {
        console.warn("清理当前用户偏好失败:", err);
        return false;
    }
}

window.confirmDeleteStore = async (mode = 'delete') => {
    closeDeleteStoreModal();
    if (!currentUser) {
        showAppNoticeModal("请先登录");
        return;
    }
    const storeId = getDeleteStoreTargetId();
    if (!storeId) {
        showAppNoticeModal("未找到店铺");
        return;
    }
    const storeRef = doc(db, "stores", storeId);
    const snap = await getDoc(storeRef);
    if (!snap.exists()) {
        showAppNoticeModal("店铺不存在或已删除");
        return;
    }
    const store = { id: snap.id, ...snap.data() };

    if (mode === 'close') {
        await updateDoc(storeRef, {
            isPermanentlyClosed: true,
            businessStatus: 'CLOSED_PERMANENTLY',
            permanentlyClosedAt: Date.now(),
            permanentlyClosedBy: currentUser.uid,
            closedReports: increment(1),
            closedReportedBy: arrayUnion(currentUser.uid)
        });
        localStores = localStores.map((item) => item.id === storeId
            ? {
                ...item,
                isPermanentlyClosed: true,
                businessStatus: 'CLOSED_PERMANENTLY',
                permanentlyClosedAt: Date.now(),
                permanentlyClosedBy: currentUser.uid
            }
            : item
        );
        window.localStores = localStores;
        if (window.renderMapCardFromDB) {
            const nextStore = localStores.find(item => item.id === storeId);
            if (nextStore) window.renderMapCardFromDB(nextStore, { mode: 'half', fromMap: true });
        }
        applyFilters();
        renderRecordCalendar();
        renderProfileActivity();
        showAppNoticeModal("店铺已标记为永久歇业");
        return;
    }

    // 彻底删除店铺：当前仓库只会清理当前用户；其他用户需要后端任务或 Cloud Function 处理
    const allUrls = collectStoreAllImageUrls(store);
    await cleanupStoreReferencesForCurrentUser(storeId);

    try {
        await deleteDoc(storeRef);
        await deleteStorageFilesByUrls(allUrls);
    } catch (err) {
        console.error("删除店铺失败:", err);
        showAppNoticeModal("删除失败，请稍后重试");
        return;
    }

    removeStoreIdFromLocalPreferenceState(storeId);
    localStores = localStores.filter(item => item.id !== storeId);
    window.localStores = localStores;

    if (window.closeMapCard) window.closeMapCard();
    const detailEl = document.getElementById('full-detail-page');
    if (detailEl) detailEl.classList.remove('open', 'half', 'from-map');
    applyFilters();
    renderRecordCalendar();
    renderProfileActivity();
    showAppNoticeModal("店铺已删除");
};

window.deleteMyStoreReview = async (storeId, reviewIndex) => {
    if (!currentUser) {
        showAppNoticeModal("请先登录");
        return;
    }
    const sid = String(storeId || '');
    const idx = Number(reviewIndex);
    if (!sid || !Number.isInteger(idx) || idx < 0) return;

    const store = localStores.find(s => s.id === sid);
    if (!store) {
        showAppNoticeModal("店铺不存在");
        return;
    }
    const revs = Array.isArray(store.revs) ? store.revs : [];
    if (idx >= revs.length) return;
    const targetRev = revs[idx];
    const aliases = getCurrentUserAliases();
    if (!isReviewMine(targetRev, aliases)) {
        showAppNoticeModal("只能删除自己的评论");
        return;
    }
    pendingDeleteReviewAction = { storeId: sid, reviewIndex: idx };
    openDeleteReviewRecordModal();
};

window.openDeleteReviewRecordModal = () => {
    const modal = document.getElementById('modal-delete-review-record');
    if (modal) modal.classList.add('open');
};

window.closeDeleteReviewRecordModal = () => {
    const modal = document.getElementById('modal-delete-review-record');
    if (modal) modal.classList.remove('open');
    pendingDeleteReviewAction = null;
};

window.showAppNoticeModal = (message, title = '提示') => {
    const modal = document.getElementById('modal-app-notice');
    const titleEl = document.getElementById('app-notice-title');
    const messageEl = document.getElementById('app-notice-message');
    if (titleEl) titleEl.innerText = title;
    if (messageEl) messageEl.innerText = String(message || '');
    if (modal) modal.classList.add('open');
    if (window.lucide?.createIcons) window.lucide.createIcons();
};

window.closeAppNoticeModal = () => {
    const modal = document.getElementById('modal-app-notice');
    if (modal) modal.classList.remove('open');
};

window.showAppFeedbackToast = (message) => {
    const toast = document.getElementById('toast-app-feedback');
    const messageEl = document.getElementById('toast-app-feedback-message');
    if (!toast || !messageEl) return;
    messageEl.innerText = String(message || '');
    toast.style.display = 'flex';
    clearTimeout(showAppFeedbackToast._timer);
    showAppFeedbackToast._timer = setTimeout(() => {
        closeAppFeedbackToast();
    }, 1200);
};

window.closeAppFeedbackToast = () => {
    const toast = document.getElementById('toast-app-feedback');
    clearTimeout(showAppFeedbackToast._timer);
    if (toast) toast.style.display = 'none';
};

function renderPostSuccessRatingIcons(score) {
    const n = getFilledRatingIconCount(score);
    return Array.from({ length: 5 }).map((_, i) =>
        `<img src="images/mogu.svg" alt="rating" style="opacity:${i < n ? 1 : 0.26};">`
    ).join('');
}

window.openPostSuccessModal = (payload = {}) => {
    postSuccessState = {
        rating: Number(payload.rating || 0),
        storeName: String(payload.storeName || ''),
        visitCount: Math.max(1, Number(payload.visitCount) || 1),
        isNewStore: !!payload.isNewStore
    };

    const modal = document.getElementById('modal-post-success');
    const scoreEl = document.getElementById('post-success-score');
    const starsEl = document.getElementById('post-success-stars');
    const storeNameEl = document.getElementById('post-success-store-name');
    const visitCountEl = document.getElementById('post-success-visit-count');
    const badgeEl = document.getElementById('post-success-new-badge');
    if (scoreEl) scoreEl.innerText = postSuccessState.rating.toFixed(1);
    if (starsEl) starsEl.innerHTML = renderPostSuccessRatingIcons(postSuccessState.rating);
    if (storeNameEl) storeNameEl.innerText = postSuccessState.storeName || '店铺';
    if (visitCountEl) visitCountEl.innerText = `（吃过${postSuccessState.visitCount}次）`;
    if (badgeEl) badgeEl.classList.toggle('hidden', !postSuccessState.isNewStore);
    if (modal) modal.classList.add('open');
};

window.closePostSuccessModal = () => {
    const modal = document.getElementById('modal-post-success');
    if (modal) modal.classList.remove('open');
    postSuccessState = null;
};

window.openPostedRecordView = () => {
    closePostSuccessModal();
    switchView('profile');
    if (typeof window.switchProfileTab === 'function') {
        window.switchProfileTab('activity');
    }
};

window.confirmDeleteReviewRecord = async (mode) => {
    const pending = pendingDeleteReviewAction;
    if (!pending) return;

    const sid = String(pending.storeId || '');
    const idx = Number(pending.reviewIndex);
    const store = localStores.find(s => s.id === sid);
    if (!store) {
        closeDeleteReviewRecordModal();
        showAppNoticeModal("店铺不存在");
        return;
    }

    const revs = Array.isArray(store.revs) ? store.revs : [];
    if (!Number.isInteger(idx) || idx < 0 || idx >= revs.length) {
        closeDeleteReviewRecordModal();
        showAppNoticeModal("这条记录不存在或已更新");
        return;
    }

    const targetRev = revs[idx];
    const aliases = getCurrentUserAliases();
    if (!isReviewMine(targetRev, aliases)) {
        closeDeleteReviewRecordModal();
        showAppNoticeModal("只能删除自己的评论");
        return;
    }

    const normalizedMode = mode === 'content-only' ? 'content-only' : 'full';
    const nextRevs = normalizedMode === 'content-only'
        ? revs.map((rev, revIndex) => revIndex === idx ? { ...rev, text: '', images: [] } : rev)
        : revs.filter((_, revIndex) => revIndex !== idx);
    const remainingReviewImageSet = new Set(
        nextRevs.flatMap(r => (Array.isArray(r?.images) ? r.images : []).map(getImageAssetFullUrl)).filter(Boolean)
    );
    const remainingReviewAssetUrlSet = new Set(
        nextRevs.flatMap(r => collectImageAssetUrls(Array.isArray(r?.images) ? r.images : []))
    );
    const targetImages = Array.isArray(targetRev?.images) ? targetRev.images.filter(Boolean) : [];
    const targetImageUrls = collectImageAssetUrls(targetImages);
    const deleteCandidates = targetImageUrls.filter((url) => !remainingReviewAssetUrlSet.has(url));
    const storeImages = Array.isArray(store.images) ? store.images : [];
    const targetFullSet = new Set(targetImages.map(getImageAssetFullUrl).filter(Boolean));
    const nextStoreImages = storeImages.filter((entry) => {
        const full = getImageAssetFullUrl(entry);
        if (!targetFullSet.has(full)) return true;
        return remainingReviewImageSet.has(full);
    });

    try {
        await updateDoc(doc(db, "stores", sid), {
            revs: nextRevs,
            images: nextStoreImages
        });
        await deleteStorageFilesByUrls(deleteCandidates);
    } catch (err) {
        console.error("删除评论记录失败:", err);
        closeDeleteReviewRecordModal();
        showAppNoticeModal("删除失败，请稍后重试");
        return;
    }

    localStores = localStores.map(item => item.id === sid ? { ...item, revs: nextRevs, images: nextStoreImages } : item);
    window.localStores = localStores;

    closeDeleteReviewRecordModal();
    renderRecordCalendar();
    if (currentRecordDayKey) openRecordDayView(currentRecordDayKey);
    const activityContent = document.getElementById('profile-content-activity');
    if (activityContent && activityContent.style.display !== 'none') {
        renderProfileActivity();
    }
    const mapSheet = document.getElementById('map-detail-card');
    const isSameStoreSheetOpen = !!(mapSheet
        && mapSheet.classList.contains('active')
        && String(mapSheet.dataset.storeId || '') === sid);
    if (isSameStoreSheetOpen && window.renderMapCardFromDB) {
        const nextStore = { ...store, revs: nextRevs, images: nextStoreImages };
        const modeName = mapSheet.classList.contains('full') ? 'full' : (mapSheet.classList.contains('peek') ? 'peek' : 'half');
        window.renderMapCardFromDB(nextStore, { mode: modeName });
    }
    showAppFeedbackToast(normalizedMode === 'content-only' ? '已清空照片和评论内容' : '已删除整条记录');
};

// Handle Custom Category Input Toggle
document.addEventListener('change', (e) => {
    if (e.target.id === 'fd-new-cat' || e.target.id === 'provide-new-cat') {
        const customInput = e.target.id === 'provide-new-cat'
            ? document.getElementById('provide-new-cat-custom')
            : document.getElementById('fd-new-cat-custom');
        if (!customInput) return;
        if (e.target.value === '自定义') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
        if (e.target.id === 'provide-new-cat') syncProvideCategoryMode();
    }
});

function syncProvideCategoryMode() {
    const cat = document.getElementById('provide-new-cat');
    const custom = document.getElementById('provide-mode-custom');
    const hours = document.getElementById('provide-mode-hours');
    const customInput = document.getElementById('provide-new-cat-custom');
    if (!cat || !custom || !hours) return;
    const isHours = cat.value === '营业时间';
    const isCustom = cat.value === '自定义';
    custom.classList.toggle('hidden', isHours);
    hours.classList.toggle('hidden', !isHours);
    if (customInput) customInput.style.display = isCustom ? 'block' : 'none';
}

/**
 * 关闭详情页
 */
window.closeFullDetail = () => {
    if (window.closeMapCard) {
        window.closeMapCard();
        return;
    }
    const detailEl = document.getElementById('full-detail-page');
    if (detailEl) detailEl.classList.remove('open', 'half', 'from-map');
};

window.expandFullDetail = () => {
    const sheet = document.getElementById('map-detail-card');
    if (sheet && sheet.classList.contains('active')) {
        sheet.classList.remove('half');
        sheet.classList.add('full');
        return;
    }
    const detailEl = document.getElementById('full-detail-page');
    if (detailEl) detailEl.classList.remove('half');
};

/**
 * 关闭旧版详情弹窗（Legacy）
 */
window.closeDetail = () => document.getElementById('modal-detail').classList.remove('open');

/* =========================================
   7. 收藏功能（想吃/好吃/难吃）
   ========================================= */

/**
 * 切换"想吃"状态
 * @param {string} oid - 店铺ID（可选，默认使用当前店铺）
 */
window.toggleFav = async (oid) => {
    if (!currentUser) return alert("Login first");
    const id = oid || currentStoreId;
    const hadLike = localLikes.has(id);
    const hadDislike = localDislikes.has(id);

    // 更新Firebase数据库
    const ref = doc(db, "users", currentUser.uid);
    try {
        const updates = {};
        // 想吃/好吃/难吃三者互斥，切到“想吃”时自动清除另外两个
        if (hadLike || hadDislike) {
            updates.likes = arrayRemove(id);
            updates.dislikes = arrayRemove(id);
            localLikes.delete(id);
            localDislikes.delete(id);
        }

        if (myFavIds.includes(id)) {
            // 已收藏，取消收藏
            updates.favorites = arrayRemove(id);
            await setDoc(ref, updates, { merge: true });
            myFavIds = myFavIds.filter(fid => fid !== id);
        } else {
            // 未收藏，添加收藏
            updates.favorites = arrayUnion(id);
            await setDoc(ref, updates, { merge: true });
            myFavIds.push(id);
        }
    } catch (err) {
        console.error("收藏写入失败:", err);
        alert("收藏失败: " + err.message);
        return;
    }

    // 刷新页面显示
    if (document.getElementById('view-fav').classList.contains('hidden') === false) {
        renderRecordCalendar();
    } else if (isHomeViewActive()) {
        updateStoreCardPreferenceVisuals(id);
    } else {
        applyFilters();               // 否则刷新首页
    }

    if (window.renderMarkers) window.renderMarkers();
};

/**
 * 切换"好吃"或"难吃"状态
 * @param {string} id - 店铺ID
 * @param {string} type - 'like' 或 'dislike'
 */
window.toggleLocalAction = async (id, type) => {
    if (!currentUser) return alert("请先登录"); // 安全检查

    const userRef = doc(db, "users", currentUser.uid);
    const updates = {}; // 准备要更新到数据库的数据

    // 如果店铺在"想吃"列表中，自动移除
    if (myFavIds.includes(id)) {
        updates.favorites = arrayRemove(id);
        // 本地立即更新UI反应更快
        myFavIds = myFavIds.filter(fid => fid !== id);
    }
    if (type === 'like') {
        if (localLikes.has(id)) {
            // 已是好吃，取消 -> 从数据库移除
            updates.likes = arrayRemove(id);
            localLikes.delete(id);
        } else {
            // 标记为好吃 -> 添加到likes，从dislikes移除
            updates.likes = arrayUnion(id);
            updates.dislikes = arrayRemove(id);
            localLikes.add(id);
            localDislikes.delete(id);
        }
    } else if (type === 'dislike') {
        if (localDislikes.has(id)) {
            // 已是难吃，取消 -> 从数据库移除
            updates.dislikes = arrayRemove(id);
            localDislikes.delete(id);
        } else {
            // 标记为难吃 -> 添加到dislikes，从likes移除
            updates.dislikes = arrayUnion(id);
            updates.likes = arrayRemove(id);
            localDislikes.add(id);
            localLikes.delete(id);
        }
    }

    // 3. 写入数据库
    try {
        await setDoc(userRef, updates, { merge: true });
    } catch (err) {
        console.error("保存评价失败:", err);
        alert("保存评价失败: " + err.message);
        return;
    }

    // 4. 刷新页面显示
    if (document.getElementById('view-fav').classList.contains('hidden') === false) {
        renderRecordCalendar();
    } else if (isHomeViewActive()) {
        updateStoreCardPreferenceVisuals(id);
    } else {
        applyFilters();
    }

    // --- 修复：强制刷新地图图标 ---
    // 这样你在列表点了赞，地图上的图钉也会马上变色
    if (window.renderMarkers) window.renderMarkers();
};

/* =========================================
   8. 添加新店铺功能
   上传图片、保存店铺信息到数据库
   ========================================= */

/**
 * 提交新店铺
 */
window.submitNew = async () => {
    if (!currentUser) return showAppNoticeModal("请先登录");
    if (!document.getElementById('newName').value.trim()) {
        return showAppNoticeModal("请先选择店铺并确认");
    }

    const btn = document.getElementById('post-btn');
    btn.classList.add('loading');  // 显示加载状态

    try {
        let reviewImageUrls = [];  // 用户评论图（不含Google封面）
        const files = document.getElementById('fileInput').files;

        if (files.length) {
            const invalidFile = [...files].find(f => !isImageFile(f));
            if (invalidFile) {
                document.getElementById('fileInput').value = "";
                previewImg(document.getElementById('fileInput'));
                throw new Error("只能上传图片文件");
            }
            // 用户上传了图片，上传到 Firebase Storage
            reviewImageUrls = await Promise.all([...files].map(async (f, index) => {
                const base = `${Date.now()}_${index}_${f.name.replace(/\.[^.]+$/, '')}`;
                return uploadImageAssetPair(f, base);
            }));
        }

        // 保存店铺数据到 Firestore
        // 优先使用搜索阶段选中的本地店铺ID，确保不会重复创建
        let existingStoreId = null;
        let existingStoreData = null;
        if (selectedExistingStoreId) {
            const existing = localStores.find(s => s.id === selectedExistingStoreId);
            if (existing) {
                existingStoreId = existing.id;
                existingStoreData = existing;
            }
        }

        if (!existingStoreId && selectedStorePlaceId) {
            const existing = localStores.find(s => s.googlePlaceId === selectedStorePlaceId);
            if (existing) {
                existingStoreId = existing.id;
                existingStoreData = existing;
            }
        }

        if (!existingStoreId) {
            const typedName = normalizeStoreName(document.getElementById('newName').value);
            const existingByName = localStores.find(s => normalizeStoreName(s.name) === typedName);
            if (existingByName) {
                existingStoreId = existingByName.id;
                existingStoreData = existingByName;
            }
        }

        const budgetVal = document.getElementById('newBudget').value;
        const addRating = Number(document.getElementById('add-rating-slider')?.value || 3.8);
        const reviewText = (document.getElementById('newReview').value || '').trim();
        const newReview = {
            text: reviewText,
            user: currentUser.displayName || currentUser.email.split('@')[0],
            uid: currentUser.uid,
            createdAt: Date.now(),
            rating: addRating,
            images: reviewImageUrls
        };

        let postSuccessPayload = null;

        if (existingStoreId) {
            // === 已存在：合并数据 ===
            const storeRef = doc(db, "stores", existingStoreId);
            const updates = {};

            // 合并评论（即使没有文字，也记录一条“评分动态”）
            updates.revs = arrayUnion({
                ...newReview,
                rating: Number(newReview.rating || existingStoreData?.rating || 3.8)
            });

            // 合并图片
            if (reviewImageUrls.length > 0) {
                updates.images = arrayUnion(...reviewImageUrls);
            }

            // 更新Google数据（如果原来没有）
            if (!existingStoreData.googlePlaceId && selectedStorePlaceId) {
                updates.googlePlaceId = selectedStorePlaceId;
            }
            if (!existingStoreData.openingHours && selectedStoreOpeningHours) {
                updates.openingHours = selectedStoreOpeningHours;
            }
            if (!existingStoreData.distance && selectedStoreDistance) {
                updates.distance = selectedStoreDistance;
            }
            if (!existingStoreData.address && selectedStoreAddress) {
                updates.address = selectedStoreAddress;
            }
            if (!existingStoreData.cuisineLabel && selectedStoreCuisineLabel) {
                updates.cuisineLabel = selectedStoreCuisineLabel;
            }
            if (!existingStoreData.primaryType && selectedStorePrimaryType) {
                updates.primaryType = selectedStorePrimaryType;
            }
            if ((!Array.isArray(existingStoreData.types) || !existingStoreData.types.length) && Array.isArray(selectedStoreTypes) && selectedStoreTypes.length) {
                updates.types = selectedStoreTypes;
            }

            await updateDoc(storeRef, updates);

            const predictedRevs = [
                ...(Array.isArray(existingStoreData?.revs) ? existingStoreData.revs : []),
                {
                    ...newReview,
                    rating: Number(newReview.rating || existingStoreData?.rating || 3.8)
                }
            ];
            const myVisitCount = predictedRevs.filter(rev => isReviewMine(rev, getCurrentUserAliases())).length || 1;
            postSuccessPayload = {
                rating: addRating,
                storeName: existingStoreData?.name || document.getElementById('newName').value,
                visitCount: myVisitCount,
                isNewStore: false
            };
        } else {
            if (!fetchedPhotoRef) {
                throw new Error("新建店铺需要一张Google封面图，请重新搜索并选择带图片的店铺");
            }

            const originalText = btn.innerHTML;
            btn.innerHTML = `<div class="spinner"></div> <span>获取店铺封面中...</span>`;
            let googleCoverAsset = "";
            try {
                googleCoverAsset = await copyGooglePlacePhotoToStorage(fetchedPhotoRef);
            } catch (err) {
                console.error("Google封面转存失败，降级使用Google直链:", err);
                googleCoverAsset = createImageAssetPayload(
                    `https://places.googleapis.com/v1/${fetchedPhotoRef}/media?maxHeightPx=800&maxWidthPx=800&key=${MAPS_API_KEY}`,
                    `https://places.googleapis.com/v1/${fetchedPhotoRef}/media?maxHeightPx=320&maxWidthPx=320&key=${MAPS_API_KEY}`
                );
            } finally {
                btn.innerHTML = originalText;
            }

            // 新店仅记录直线距离（米），不再记录步行分钟
            let createDistance = selectedStoreDistance || null;
            if (!Number.isFinite(Number(createDistance)) && selectedStoreLocation) {
                createDistance = getStoreLinearDistanceMeters(selectedStoreLocation);
            }
            selectedStoreDistance = createDistance;

            // === 新店铺：创建 ===
            const storeAlbumImages = [];
            const pushUniqueImageAsset = (entry) => {
                const full = getImageAssetFullUrl(entry);
                if (!full || storeAlbumImages.some(item => getImageAssetFullUrl(item) === full)) return;
                storeAlbumImages.push(entry);
            };
            pushUniqueImageAsset(googleCoverAsset);
            reviewImageUrls.forEach(pushUniqueImageAsset);
            const createdStore = {
                name: document.getElementById('newName').value,           // 店名
                budget: budgetVal,                                        // 预算
                budgetText: budgetVal ? `¥ ${budgetVal}` : '',            // 预算文字
                rating: String((Number.isFinite(addRating) ? addRating : 3.8).toFixed(1)),
                lat: selectedStoreLocation ? selectedStoreLocation.lat : null,  // 纬度
                lng: selectedStoreLocation ? selectedStoreLocation.lng : null,  // 经度
                googlePlaceId: selectedStorePlaceId || null,              // Google Place ID
                openingHours: selectedStoreOpeningHours || null,          // 营业时间
                distance: createDistance || null,                         // 距离(米)
                address: selectedStoreAddress || null,                    // 地址
                cuisineLabel: selectedStoreCuisineLabel || null,          // 料理种类
                primaryType: selectedStorePrimaryType || null,            // Google 主类型
                types: Array.isArray(selectedStoreTypes) ? selectedStoreTypes : [], // Google 类型
                googleCoverImage: getImageAssetFullUrl(googleCoverAsset),
                googleCoverImageThumb: getImageAssetThumbUrl(googleCoverAsset),
                images: storeAlbumImages,                                 // 相册图（封面图固定第一张）
                createdAt: Date.now(),                                    // 创建时间戳
                revs: [newReview]
            };
            await addDoc(collection(db, "stores"), createdStore);
            postSuccessPayload = {
                rating: addRating,
                storeName: createdStore.name,
                visitCount: 1,
                isNewStore: true
            };
        }
        switchView('home');      // 跳转到首页

        // 清空表单
        document.getElementById('newName').value = "";
        document.getElementById('newBudget').value = "";
        document.getElementById('newTime').value = "";
        document.getElementById('newReview').value = "";
        document.getElementById('fileInput').value = "";
        document.getElementById('preview-list').classList.add('hidden');
        document.getElementById('upload-placeholder').style.display = 'block';
        resetSelectedStoreState();
        resetAddComposerFlow();
        if (postSuccessPayload) {
            openPostSuccessModal(postSuccessPayload);
        }
    } catch (e) {
        showAppNoticeModal(e.message || "发布失败，请稍后重试");
    }
    btn.classList.remove('loading');
};

/**
 * 图片预览
 * 当用户选择图片后，显示预览
 */
window.previewImg = (inp) => {
    const d = document.getElementById('preview-list');
    d.innerHTML = "";
    const ph = document.getElementById('upload-placeholder');
    const files = [...(inp.files || [])];

    if (files.some(f => !isImageFile(f))) {
        inp.value = "";
        ph.style.display = 'block';
        d.classList.add('hidden');
        return showAppNoticeModal("只能上传图片文件");
    }

    if (files.length) {
        ph.style.display = 'none';
        d.classList.remove('hidden');
        files.forEach(f => {
            const i = document.createElement('img');
            i.src = URL.createObjectURL(f);  // 创建本地预览URL
            i.className = "preview-item";
            d.appendChild(i);
        });
    } else {
        ph.style.display = 'block';
        d.classList.add('hidden');
    }
};

/* =========================================
   9. 搜索店铺功能（添加页面用）
   使用Google Places API搜索店铺
   ========================================= */

let selectedStorePlaceId = null;
let selectedStoreOpeningHours = null;
let selectedStoreDistance = null;
let selectedStoreAddress = null;
let selectedStoreCuisineLabel = null;
let selectedStorePrimaryType = null;
let selectedStoreTypes = null;
let selectedExistingStoreId = null;
const searchCache = new Map();
let addSearchDebounceTimer = null;
let locSearchDebounceTimer = null;
let homeSearchDebounceTimer = null;
let lastAddQuery = "";
let lastLocQuery = "";
let addSelectedStoreName = "";
let addSelectedIsLocal = false;
let addPreviewMap = null;
let addPreviewMarker = null;
let addMapRetryTimer = null;
let addRatingDragging = false;
let homeSearchQuery = "";
let addSearchLatestItems = [];
let addSearchLatestQuery = "";
let addSearchMap = null;
let addSearchMapMarkers = [];
let addSelectedSearchItemKey = "";
let addSelectedMarkerScaleFrames = new Map();
let addNearbySearchOrigin = null;
let isAddNearbySearchLoading = false;
let addComposerReturnContext = {
    source: 'pick',
    storeId: '',
    sheetMode: 'half'
};

function normalizeStoreName(name) {
    return (name || "").trim().toLowerCase();
}

function resetAddComposerReturnContext() {
    addComposerReturnContext = {
        source: 'pick',
        storeId: '',
        sheetMode: 'half'
    };
}

function toHiraganaString(str) {
    return String(str || '').replace(/[\u30a1-\u30f6]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
}

const KANA_ROMAJI_MAP = {
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo', 'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho', 'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo', 'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo', 'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo', 'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
    'ゔ': 'vu'
};

function kanaToRomajiString(input) {
    const src = toHiraganaString(input);
    let out = '';
    for (let i = 0; i < src.length; i++) {
        const pair = src.slice(i, i + 2);
        if (pair.length === 2 && KANA_ROMAJI_MAP[pair]) {
            out += KANA_ROMAJI_MAP[pair];
            i += 1;
            continue;
        }
        const ch = src[i];
        if (ch === 'っ') {
            const nextPair = src.slice(i + 1, i + 3);
            const next = KANA_ROMAJI_MAP[nextPair] || KANA_ROMAJI_MAP[src[i + 1]] || '';
            out += next ? next[0] : '';
            continue;
        }
        if (ch === 'ー') {
            const last = out.slice(-1);
            if (/[aeiou]/.test(last)) out += last;
            continue;
        }
        out += KANA_ROMAJI_MAP[ch] || ch;
    }
    return out;
}

function normalizeSearchText(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

function buildStoreSearchKeys(text) {
    const raw = normalizeSearchText(text);
    const hira = normalizeSearchText(toHiraganaString(text));
    const romaji = normalizeSearchText(kanaToRomajiString(text));
    return Array.from(new Set([raw, hira, romaji].filter(Boolean)));
}

function levenshteinDistance(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    if (!s) return t.length;
    if (!t) return s.length;
    const dp = Array.from({ length: t.length + 1 }, (_, i) => i);
    for (let i = 1; i <= s.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= t.length; j++) {
            const temp = dp[j];
            dp[j] = s[i - 1] === t[j - 1]
                ? prev
                : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
            prev = temp;
        }
    }
    return dp[t.length];
}

function scoreTextMatch(query, target) {
    const qKeys = buildStoreSearchKeys(query);
    const tKeys = buildStoreSearchKeys(target);
    let best = 0;

    qKeys.forEach((qKey) => {
        tKeys.forEach((tKey) => {
            if (!qKey || !tKey) return;
            if (qKey === tKey) best = Math.max(best, 120);
            if (tKey.startsWith(qKey)) best = Math.max(best, 104 - Math.max(0, tKey.length - qKey.length));
            if (tKey.includes(qKey)) best = Math.max(best, (qKey.length === 1 ? 50 : 88) - Math.min(18, tKey.indexOf(qKey)));

            for (let len = Math.min(qKey.length, 5); len >= 2; len--) {
                const head = qKey.slice(0, len);
                if (head && tKey.includes(head)) {
                    best = Math.max(best, 62 + len * 6);
                    break;
                }
            }

            if (qKey.length >= 2) {
                const diff = Math.abs(qKey.length - tKey.length);
                if (diff <= 4) {
                    const dist = levenshteinDistance(qKey, tKey);
                    if (dist <= Math.max(1, Math.floor(qKey.length / 3))) {
                        best = Math.max(best, 64 - dist * 10);
                    }
                }
            }
        });
    });

    return best;
}

function scoreStoreSearch(query, store) {
    const nameScore = scoreTextMatch(query, store?.name || '');
    const cuisineIntent = resolveCuisineSearchIntent(query);
    if (cuisineIntent) {
        const cuisineScore = Math.floor(scoreCuisineIntentMatch(query, store) * 0.92);
        return Math.max(nameScore, cuisineScore);
    }
    const cuisineScore = Math.floor(scoreTextMatch(query, getStoreCuisineSearchTerms(store).join(' ')) * 0.92);
    const addressScore = Math.floor(scoreTextMatch(query, store?.address || store?.formattedAddress || '') * 0.35);
    return Math.max(nameScore, addressScore, cuisineScore);
}

window.scoreStoreSearch = scoreStoreSearch;

function getSearchMatchFlags(query, target) {
    const qKeys = buildStoreSearchKeys(query);
    const tKeys = buildStoreSearchKeys(target);
    let prefix = false;
    let contains = false;

    qKeys.forEach((qKey) => {
        if (!qKey) return;
        tKeys.forEach((tKey) => {
            if (!tKey) return;
            if (tKey.startsWith(qKey)) prefix = true;
            if (tKey.includes(qKey)) contains = true;
        });
    });

    return { prefix, contains };
}

function scoreLocalAddSearch(query, store) {
    const qNorm = normalizeSearchText(query);
    const name = String(store?.name || '');
    const nameScore = scoreTextMatch(query, name);
    const nameFlags = getSearchMatchFlags(query, name);
    const isAsciiQuery = !!qNorm && /^[a-z0-9]+$/i.test(qNorm);

    // 添加店铺联想里，英文字母查询优先走“店名前缀”命中，避免无关本地店铺被蘑菇标记顶上来。
    if (isAsciiQuery && qNorm.length >= 2) {
        const allowContains = qNorm.length >= 3;
        if (!nameFlags.prefix && !(allowContains && nameFlags.contains)) return 0;
        return nameScore + (nameFlags.prefix ? 26 : 0);
    }

    const addressScore = Math.floor(scoreTextMatch(query, store?.address || store?.formattedAddress || '') * 0.22);
    const cuisineScore = Math.floor(scoreTextMatch(query, getStoreCuisineSearchTerms(store).join(' ')) * 0.35);
    return Math.max(nameScore + (nameFlags.prefix ? 14 : 0), addressScore, cuisineScore);
}

function resetSelectedStoreState() {
    selectedStoreLocation = null;
    selectedStorePlaceId = null;
    selectedStoreOpeningHours = null;
    selectedStoreDistance = null;
    selectedStoreAddress = null;
    selectedStoreCuisineLabel = null;
    selectedStorePrimaryType = null;
    selectedStoreTypes = null;
    selectedExistingStoreId = null;
    fetchedPhotoRef = null;
    addSelectedSearchItemKey = "";
}

function clampAddRating(value) {
    const num = Number(value) || 0;
    return Math.max(0, Math.min(5, Math.round(num * 10) / 10));
}

function renderAddPickedMapPreview(retry = 0) {
    const mapWrap = document.getElementById('add-picked-map');
    if (!mapWrap) return;

    if (!selectedStoreLocation || !selectedStoreLocation.lat || !selectedStoreLocation.lng) {
        mapWrap.innerHTML = `<div class="add-picked-map-empty">选择店铺后显示地图预览</div>`;
        addPreviewMap = null;
        addPreviewMarker = null;
        return;
    }

    const lat = Number(selectedStoreLocation.lat);
    const lng = Number(selectedStoreLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        mapWrap.innerHTML = `<div class="add-picked-map-empty">暂无地图预览</div>`;
        return;
    }

    if (window.google?.maps) {
        if (addMapRetryTimer) {
            clearTimeout(addMapRetryTimer);
            addMapRetryTimer = null;
        }

        if (!addPreviewMap) {
            mapWrap.innerHTML = "";
            addPreviewMap = new google.maps.Map(mapWrap, {
                center: { lat, lng },
                zoom: 16,
                disableDefaultUI: true,
                gestureHandling: 'none',
                clickableIcons: false
            });
            addPreviewMarker = new google.maps.Marker({
                map: addPreviewMap,
                position: { lat, lng },
                optimized: false
            });
        } else {
            addPreviewMap.setCenter({ lat, lng });
            addPreviewMap.setZoom(16);
            if (!addPreviewMarker) {
                addPreviewMarker = new google.maps.Marker({ map: addPreviewMap, position: { lat, lng }, optimized: false });
            } else {
                addPreviewMarker.setPosition({ lat, lng });
            }
        }
        return;
    }

    mapWrap.innerHTML = `<div class="add-picked-map-empty">地图加载中...</div>`;
    if (retry < 8) {
        if (addMapRetryTimer) clearTimeout(addMapRetryTimer);
        addMapRetryTimer = setTimeout(() => renderAddPickedMapPreview(retry + 1), 280);
    }
}
window.refreshAddMapPreview = () => {
    renderAddPickedMapPreview();
};

function buildAddRatingMushrooms() {
    const mushrooms = document.getElementById('add-rating-mushrooms');
    if (!mushrooms || mushrooms.dataset.ready === '1') return;
    mushrooms.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const item = document.createElement('div');
        item.className = 'add-rating-mushroom';
        item.dataset.idx = String(i);
        item.innerHTML = `
            <img src="images/mogu.svg" class="base" alt="">
            <img src="images/mogu.svg" class="fill" alt="">
        `;
        mushrooms.appendChild(item);
    }
    mushrooms.dataset.ready = '1';
}

function setAddRatingValue(value) {
    const slider = document.getElementById('add-rating-slider');
    if (!slider) return;
    slider.value = String(clampAddRating(value));
    refreshAddRatingMushrooms();
}

function calcAddRatingByPointer(clientX, container) {
    const rect = container.getBoundingClientRect();
    if (!rect.width) return 0;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (x / rect.width) * 5;
}

function bindAddRatingGesture() {
    const mushrooms = document.getElementById('add-rating-mushrooms');
    if (!mushrooms || mushrooms.dataset.bound === '1') return;
    mushrooms.dataset.bound = '1';

    const handleMove = (e) => {
        if (!addRatingDragging) return;
        setAddRatingValue(calcAddRatingByPointer(e.clientX, mushrooms));
    };
    const stopDrag = () => {
        addRatingDragging = false;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', stopDrag);
        window.removeEventListener('pointercancel', stopDrag);
    };

    mushrooms.addEventListener('pointerdown', (e) => {
        addRatingDragging = true;
        setAddRatingValue(calcAddRatingByPointer(e.clientX, mushrooms));
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', stopDrag);
        window.addEventListener('pointercancel', stopDrag);
    });
}

function refreshAddWalkTimeDisplay() {
    const walkEl = document.getElementById('add-walk-time-display');
    if (!walkEl) return;
    if (Number.isFinite(selectedStoreDistance) && selectedStoreDistance >= 0) {
        const mins = Math.max(1, Math.round(selectedStoreDistance / 70));
        walkEl.innerText = `${mins}分钟`;
        return;
    }
    walkEl.innerText = selectedStoreLocation ? formatStoreDistanceText(selectedStoreLocation) : '--分钟';
}

function refreshAddRatingMushrooms() {
    const slider = document.getElementById('add-rating-slider');
    const mushrooms = document.getElementById('add-rating-mushrooms');
    const scoreEl = document.getElementById('add-rating-number');
    if (!slider || !mushrooms || !scoreEl) return;
    buildAddRatingMushrooms();
    bindAddRatingGesture();
    const val = clampAddRating(slider.value);
    slider.value = String(val);
    scoreEl.innerText = val.toFixed(1);
    mushrooms.querySelectorAll('.add-rating-mushroom').forEach((node, idx) => {
        const width = Math.max(0, Math.min(1, val - idx)) * 100;
        const fill = node.querySelector('.fill');
        if (fill) fill.style.clipPath = `inset(0 ${100 - width}% 0 0)`;
    });
}

function updateAddPickConfirmButton() {
    const btn = document.getElementById('add-step-pick-confirm-btn');
    if (!btn) return;
    btn.disabled = !addSelectedStoreName;
}

function updateAddSelectedStoreActions() {
    const moguInline = document.getElementById('add-selected-mogu-inline');
    const viewBtn = document.getElementById('add-view-store-btn');
    const showLocalTools = !!(addSelectedIsLocal && selectedExistingStoreId);
    if (moguInline) moguInline.classList.toggle('hidden', !showLocalTools);
    if (viewBtn) viewBtn.classList.toggle('hidden', !showLocalTools);
    updateAddSearchClearButton();
}

function setAddNearbySearchButtonLoading(loading) {
    const btn = document.getElementById('add-nearby-search-btn');
    if (!btn) return;
    btn.disabled = !!loading;
    btn.classList.toggle('is-loading', !!loading);
    btn.innerText = loading ? '读取附近店铺中...' : '搜索附近店铺';
}

function updateAddSearchClearButton() {
    const input = document.getElementById('add-search-input');
    const btn = document.getElementById('add-search-clear-btn');
    if (!input || !btn) return;
    btn.classList.toggle('hidden', !(String(input.value || '').trim()));
}

window.clearAddSearchInput = () => {
    const input = document.getElementById('add-search-input');
    const list = document.getElementById('add-search-results');
    const toggleLink = document.getElementById('add-map-toggle-link');
    if (input) input.value = "";
    if (list) {
        list.classList.remove('active');
        list.innerHTML = "";
    }
    if (toggleLink) {
        toggleLink.classList.add('hidden');
        toggleLink.innerText = '在地图上查看';
    }
    addSearchLatestItems = [];
    addSearchLatestQuery = "";
    addNearbySearchOrigin = null;
    addSelectedStoreName = "";
    addSelectedIsLocal = false;
    addSelectedSearchItemKey = "";
    lastAddQuery = "";
    resetSelectedStoreState();
    hideAddSearchMap();
    updateAddPickConfirmButton();
    updateAddSelectedStoreActions();
    syncAddSearchSelectionUI();
    updateAddSearchClearButton();
}

function onAddStorePicked(name, isLocal) {
    addSelectedStoreName = name || "";
    addSelectedIsLocal = !!isLocal;
    updateAddPickConfirmButton();
    updateAddSelectedStoreActions();
    refreshAddWalkTimeDisplay();
}

function resetAddComposerFlow() {
    const pick = document.getElementById('add-step-pick');
    const form = document.getElementById('add-step-form');
    const list = document.getElementById('add-search-results');
    if (pick) pick.classList.remove('hidden');
    if (form) form.classList.add('hidden');
    if (list) {
        list.classList.remove('active');
        list.innerHTML = "";
    }
    const mapToggleLink = document.getElementById('add-map-toggle-link');
    if (mapToggleLink) {
        mapToggleLink.classList.add('hidden');
        mapToggleLink.innerText = '在地图上查看';
    }
    const hiddenName = document.getElementById('newName');
    const budget = document.getElementById('newBudget');
    const review = document.getElementById('newReview');
    const file = document.getElementById('fileInput');
    const previewList = document.getElementById('preview-list');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    if (hiddenName) hiddenName.value = "";
    if (budget) budget.value = "";
    if (review) review.value = "";
    if (file) file.value = "";
    const searchInput = document.getElementById('add-search-input');
    if (searchInput) searchInput.value = "";
    const slider = document.getElementById('add-rating-slider');
    if (slider) slider.value = "3.8";
    if (previewList) previewList.classList.add('hidden');
    if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
    const addClearBtn = document.getElementById('add-search-clear-btn');
    if (addClearBtn && addClearBtn.dataset.bound !== '1') {
        addClearBtn.dataset.bound = '1';
        addClearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.clearAddSearchInput();
        });
    }
    resetSelectedStoreState();
    addSelectedStoreName = "";
    addSelectedIsLocal = false;
    addSearchLatestItems = [];
    addSearchLatestQuery = "";
    addNearbySearchOrigin = null;
    hideAddSearchMap();
    clearAddSearchMapMarkers();
    updateAddPickConfirmButton();
    updateAddSelectedStoreActions();
    refreshAddWalkTimeDisplay();
    refreshAddRatingMushrooms();
    updateAddSearchClearButton();
}

function showAddComposerPickStep() {
    const pick = document.getElementById('add-step-pick');
    const form = document.getElementById('add-step-form');
    if (pick) pick.classList.remove('hidden');
    if (form) form.classList.add('hidden');
}

function openAddComposerForStore(storeId) {
    const store = localStores.find(s => s.id === storeId);
    if (!store) return false;

    resetAddComposerFlow();

    resetSelectedStoreState();
    addSelectedSearchItemKey = `local:${store.id}`;
    selectedExistingStoreId = store.id;
    selectedStorePlaceId = store.googlePlaceId || null;
    selectedStoreOpeningHours = store.openingHours || null;
    selectedStoreDistance = getStoreLinearDistanceMeters(store);
    selectedStoreAddress = store.address || store.formattedAddress || null;
    selectedStoreCuisineLabel = getStoreCuisineText(store) || null;
    selectedStorePrimaryType = store.primaryType || null;
    selectedStoreTypes = Array.isArray(store.types) ? [...store.types] : null;
    if (store.lat && store.lng) {
        selectedStoreLocation = { lat: Number(store.lat), lng: Number(store.lng) };
    }

    addSelectedStoreName = store.name || "";
    addSelectedIsLocal = true;

    const addInput = document.getElementById('add-search-input');
    if (addInput) addInput.value = store.name || "";

    const hiddenName = document.getElementById('newName');
    if (hiddenName) hiddenName.value = store.name || "";


    const pick = document.getElementById('add-step-pick');
    const form = document.getElementById('add-step-form');
    if (pick) pick.classList.add('hidden');
    if (form) form.classList.remove('hidden');

    const topName = document.getElementById('add-form-store-name');
    const topMogu = document.getElementById('add-form-mogu');
    if (topName) topName.innerText = store.name || "";
    if (topMogu) topMogu.classList.remove('hidden');

    setAddRatingValue(Number(store?.rating || 3.8));
    updateAddSelectedStoreActions();
    refreshAddWalkTimeDisplay();
    updateAddSearchClearButton();
    renderAddPickedMapPreview();
    return true;
}

window.openAddComposerForStore = (storeId) => {
    if (!storeId) return;
    const sheet = document.getElementById('map-detail-card');
    const currentMode = sheet?.classList.contains('full') ? 'full' : (sheet?.classList.contains('peek') ? 'peek' : 'half');
    if (window.closeMapCard) {
        window.closeMapCard({ preserveMapView: true });
    }
    switchView('add');
    addComposerReturnContext = {
        source: 'map',
        storeId,
        sheetMode: currentMode
    };
    requestAnimationFrame(() => {
        if (!openAddComposerForStore(storeId)) return;
        const addView = document.getElementById('view-add');
        if (addView) addView.scrollTo({ top: 0, behavior: 'auto' });
    });
};

window.confirmAddStoreSelection = () => {
    if (!addSelectedStoreName) return;
    const pick = document.getElementById('add-step-pick');
    const form = document.getElementById('add-step-form');
    if (pick) pick.classList.add('hidden');
    if (form) form.classList.remove('hidden');

    const topName = document.getElementById('add-form-store-name');
    const topMogu = document.getElementById('add-form-mogu');
    if (topName) topName.innerText = addSelectedStoreName;
    if (topMogu) topMogu.classList.toggle('hidden', !addSelectedIsLocal);

    const matched = selectedExistingStoreId ? localStores.find(s => s.id === selectedExistingStoreId) : null;
    setAddRatingValue(Number(matched?.rating || 3.8));
    refreshAddWalkTimeDisplay();
};

window.handleAddComposerBack = () => {
    if (addComposerReturnContext.source === 'map' && addComposerReturnContext.storeId) {
        const { storeId, sheetMode } = addComposerReturnContext;
        switchView('map');
        requestAnimationFrame(() => {
            if (typeof window.restoreMapSelectionContext === 'function') {
                window.restoreMapSelectionContext({ storeId, mode: sheetMode || 'half' });
            }
        });
        return;
    }
    showAddComposerPickStep();
};

window.editAddStoreSelection = () => {
    if (addComposerReturnContext.source === 'map') {
        window.handleAddComposerBack();
        return;
    }
    showAddComposerPickStep();
};

window.updateAddRatingUI = () => {
    refreshAddRatingMushrooms();
};

function hideAddSearchMap() {
    const mapWrap = document.getElementById('add-search-map-wrap');
    const toggleLink = document.getElementById('add-map-toggle-link');
    const mapEl = document.getElementById('add-search-map');
    if (mapWrap) {
        mapWrap.classList.add('hidden');
        mapWrap.style.height = '';
    }
    if (mapEl) mapEl.style.height = '';
    if (toggleLink && !toggleLink.classList.contains('hidden')) {
        toggleLink.innerText = '在地图上查看';
    }
}

function clearAddSearchMapMarkers() {
    addSearchMapMarkers.forEach(marker => marker.setMap(null));
    addSearchMapMarkers = [];
    addSelectedMarkerScaleFrames.forEach(frameId => cancelAnimationFrame(frameId));
    addSelectedMarkerScaleFrames.clear();
}

function hideAddSearchResultList() {
    const list = document.getElementById('add-search-results');
    if (!list) return;
    list.classList.remove('active');
}

function showAddSearchResultList() {
    const list = document.getElementById('add-search-results');
    if (!list || !addSearchLatestItems.length) return;
    renderAddSearchResultList(addSearchLatestItems, list);
    list.classList.add('active');
}

function syncAddSearchSelectionUI() {
    const list = document.getElementById('add-search-results');
    if (list && list.classList.contains('active')) {
        renderAddSearchResultList(addSearchLatestItems, list);
    }
    const mapWrap = document.getElementById('add-search-map-wrap');
    if (mapWrap && !mapWrap.classList.contains('hidden')) {
        refreshAddSearchMapMarkers(addSearchLatestItems, { preserveView: true });
    }
    updateAddSelectedStoreActions();
}

function ensureAddSearchMap() {
    const mapEl = document.getElementById('add-search-map');
    if (!mapEl || !window.google?.maps) return null;
    if (!addSearchMap) {
        addSearchMap = new google.maps.Map(mapEl, {
            center: { ...FIXED_ORIGIN },
            zoom: 15,
            disableDefaultUI: true,
            clickableIcons: false,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
        });
        addSearchMap.addListener('click', () => {
            hideAddSearchResultList();
        });
    }
    return addSearchMap;
}

function updateAddSearchMapHeight() {
    const mapWrap = document.getElementById('add-search-map-wrap');
    const mapEl = document.getElementById('add-search-map');
    const confirmWrap = document.querySelector('.add-step-pick-confirm-wrap');
    if (!mapWrap || !mapEl || !confirmWrap) return;
    if (mapWrap.classList.contains('hidden')) return;

    const mapTop = mapWrap.getBoundingClientRect().top;
    const confirmTop = confirmWrap.getBoundingClientRect().top;
    const gap = 10;
    let nextHeight = Math.floor(confirmTop - mapTop - gap);
    const minHeight = 180;
    const maxHeight = Math.floor(window.innerHeight * 0.7);
    nextHeight = Math.max(minHeight, Math.min(maxHeight, nextHeight));

    mapWrap.style.height = `${nextHeight}px`;
    mapEl.style.height = `${nextHeight}px`;

    if (addSearchMap && window.google?.maps) {
        google.maps.event.trigger(addSearchMap, 'resize');
    }
}

function meterDistance(aLat, aLng, bLat, bLng) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
    return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function buildAddSearchDisplayPositions(items = []) {
    const valid = items
        .map((item, idx) => ({
            idx,
            key: item.key || `idx:${idx}`,
            lat: Number(item.lat),
            lng: Number(item.lng)
        }))
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    const groups = [];
    const thresholdMeters = 16;
    valid.forEach(p => {
        let group = groups.find(g => meterDistance(g.anchorLat, g.anchorLng, p.lat, p.lng) <= thresholdMeters);
        if (!group) {
            group = { anchorLat: p.lat, anchorLng: p.lng, members: [] };
            groups.push(group);
        }
        group.members.push(p);
    });

    const posMap = new Map();
    groups.forEach(group => {
        const n = group.members.length;
        if (n <= 1) {
            const only = group.members[0];
            posMap.set(only.key, { lat: only.lat, lng: only.lng });
            return;
        }

        group.members.forEach((m, i) => {
            const ring = Math.floor(i / 6);
            const radiusMeters = 8 + ring * 4;
            const angle = (-Math.PI / 2) + ((2 * Math.PI * i) / n);
            const dLat = (radiusMeters * Math.cos(angle)) / 111320;
            const cosLat = Math.max(0.2, Math.cos((group.anchorLat * Math.PI) / 180));
            const dLng = (radiusMeters * Math.sin(angle)) / (111320 * cosLat);
            posMap.set(m.key, {
                lat: group.anchorLat + dLat,
                lng: group.anchorLng + dLng
            });
        });
    });

    return posMap;
}

function refreshAddSearchMapMarkers(items = [], opts = {}) {
    const preserveView = !!opts.preserveView;
    const map = ensureAddSearchMap();
    if (!map) return;
    clearAddSearchMapMarkers();
    const displayPosMap = buildAddSearchDisplayPositions(items);

    const points = [];
    items.forEach((item, idx) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const key = item.key || `idx:${idx}`;
        const display = displayPosMap.get(key) || { lat, lng };
        const position = { lat: Number(display.lat), lng: Number(display.lng) };
        points.push(position);

        let icon = {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#4a73ff',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 7
        };
        if (item.source === 'local') {
            icon = {
                url: 'images/pin-default.svg',
                scaledSize: new google.maps.Size(30, 30)
            };
        }

        const isSelected = item.key && item.key === addSelectedSearchItemKey;
        if (isSelected) {
            const selectedSize = new google.maps.Size(30, 38);
            icon = {
                url: item.source === 'local' ? 'images/dian01.svg' : 'images/dian02.svg',
                scaledSize: selectedSize,
                anchor: new google.maps.Point(selectedSize.width / 2, selectedSize.height)
            };
        }

        const marker = new google.maps.Marker({
            map,
            position,
            icon,
            optimized: false,
            zIndex: item.source === 'local' ? 20 : 10
        });
        if (isSelected) {
            const finalW = 30;
            const finalH = 38;
            const minScale = 0.58;
            const duration = 220;
            const startedAt = performance.now();
            const animate = (now) => {
                const p = Math.min(1, (now - startedAt) / duration);
                const eased = 1 - Math.pow(1 - p, 3);
                const scale = minScale + (1 - minScale) * eased;
                const w = Math.round(finalW * scale);
                const h = Math.round(finalH * scale);
                marker.setIcon({
                    url: item.source === 'local' ? 'images/dian01.svg' : 'images/dian02.svg',
                    scaledSize: new google.maps.Size(w, h),
                    anchor: new google.maps.Point(w / 2, h)
                });
                if (p < 1) {
                    const frameId = requestAnimationFrame(animate);
                    addSelectedMarkerScaleFrames.set(item.key, frameId);
                } else {
                    addSelectedMarkerScaleFrames.delete(item.key);
                }
            };
            const frameId = requestAnimationFrame(animate);
            addSelectedMarkerScaleFrames.set(item.key, frameId);
        }
        marker.addListener('click', () => {
            if (typeof item.onClick === 'function') item.onClick();
        });
        addSearchMapMarkers.push(marker);
    });

    if (!points.length || preserveView) return;
    if (points.length === 1) {
        map.setCenter(points[0]);
        map.setZoom(16);
        return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, 42);
}

function buildLocalAddSearchItem(store, listEl, opts = {}) {
    const distanceMeters = Number(opts.distanceMeters);
    const distanceText = Number.isFinite(distanceMeters) && distanceMeters >= 0
        ? `${Math.round(distanceMeters)}m`
        : "";
    const addressText = opts.addressText || store.address || store.formattedAddress || "";
    return {
        key: `local:${store.id}`,
        source: 'local',
        name: store.name,
        address: addressText,
        secondaryText: distanceText ? `${distanceText} · ${addressText || "地址未收录"}` : (addressText || "地址未收录"),
        lat: Number(store.lat),
        lng: Number(store.lng),
        onClick: () => {
            resetSelectedStoreState();
            addSelectedSearchItemKey = `local:${store.id}`;
            selectedExistingStoreId = store.id;
            selectedStorePlaceId = store.googlePlaceId || null;
            selectedStoreOpeningHours = store.openingHours || null;
            selectedStoreDistance = Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : getStoreLinearDistanceMeters(store);
            selectedStoreAddress = store.address || store.formattedAddress || null;
            selectedStoreCuisineLabel = getStoreCuisineText(store) || null;
            selectedStorePrimaryType = store.primaryType || null;
            selectedStoreTypes = Array.isArray(store.types) ? [...store.types] : null;
            if (store.lat && store.lng) {
                selectedStoreLocation = { lat: Number(store.lat), lng: Number(store.lng) };
            }

            const addInput = document.getElementById('add-search-input');
            if (addInput) addInput.value = store.name || "";
            document.getElementById('newName').value = store.name || "";
            onAddStorePicked(store.name || "", true);
            openAddSearchMap({ preserveView: true });
            syncAddSearchSelectionUI();
            if (listEl) listEl.classList.remove('active');
        }
    };
}

function getPreferredPlaceName(place) {
    if (!place || typeof place !== 'object') return '';
    return String(
        place.preferredName
        || place.localName
        || place.displayName?.text
        || place.englishName
        || ''
    ).trim();
}

function buildGoogleAddSearchItem(place, listEl, opts = {}) {
    const preferredName = getPreferredPlaceName(place);
    const placeKey = `google:${place.id || normalizeStoreName(preferredName)}`;
    const distanceMeters = Number(opts.distanceMeters);
    const distanceText = Number.isFinite(distanceMeters) && distanceMeters >= 0
        ? `${Math.round(distanceMeters)}m`
        : "";
    const addressText = place.formattedAddress || "";
    return {
        key: placeKey,
        source: 'google',
        name: preferredName,
        address: addressText,
        secondaryText: distanceText ? `${distanceText} · ${addressText || "地址未收录"}` : (addressText || "地址未收录"),
        lat: Number(place.location?.latitude),
        lng: Number(place.location?.longitude),
        placeId: place.id || "",
        onClick: async () => {
            resetSelectedStoreState();
            addSelectedSearchItemKey = placeKey;

            const addInput = document.getElementById('add-search-input');
            if (addInput) addInput.value = preferredName;
            document.getElementById('newName').value = preferredName;
            if (place.photos && place.photos.length) fetchedPhotoRef = place.photos[0].name;

            if (place.location) {
                selectedStoreLocation = { lat: place.location.latitude, lng: place.location.longitude };
                selectedStorePlaceId = place.id;
                selectedStoreOpeningHours = place.regularOpeningHours || place.currentOpeningHours || null;
                selectedStoreAddress = place.formattedAddress;
                selectedStoreCuisineLabel = getCuisineRuleByType(place.primaryType)?.label || place.primaryTypeDisplayName?.text || null;
                selectedStorePrimaryType = place.primaryType || null;
                selectedStoreTypes = Array.isArray(place.types) ? [...place.types] : null;
                selectedStoreDistance = Number.isFinite(distanceMeters)
                    ? Math.round(distanceMeters)
                    : getStoreLinearDistanceMeters(selectedStoreLocation);
            }
            onAddStorePicked(preferredName, false);
            openAddSearchMap({ preserveView: true });
            syncAddSearchSelectionUI();
            if (listEl) listEl.classList.remove('active');
        }
    };
}

function findMatchingLocalStoreForPlace(place) {
    const placeId = String(place?.id || '').trim();
    const normalizedGoogleName = normalizeStoreName(getPreferredPlaceName(place));
    return localStores.find(s =>
        (placeId && s.googlePlaceId && s.googlePlaceId === placeId) ||
        (normalizedGoogleName && normalizeStoreName(s.name) === normalizedGoogleName)
    ) || null;
}

function buildAddItemsFromGooglePlaces(places, listEl, origin = null) {
    return (Array.isArray(places) ? places : []).map((place) => {
        const lat = Number(place?.location?.latitude);
        const lng = Number(place?.location?.longitude);
        const distanceMeters = (origin && Number.isFinite(lat) && Number.isFinite(lng))
            ? haversineDistanceMeters(origin, { lat, lng })
            : null;
        const localStore = findMatchingLocalStoreForPlace(place);
        if (localStore) {
            return buildLocalAddSearchItem(localStore, listEl, {
                distanceMeters,
                addressText: place.formattedAddress || localStore.address || localStore.formattedAddress || ""
            });
        }
        return buildGoogleAddSearchItem(place, listEl, { distanceMeters });
    }).filter(Boolean);
}

function applyAddSearchResults(items, listEl, queryText, opts = {}) {
    addSearchLatestItems = items;
    addSearchLatestQuery = (queryText || "").trim();
    renderAddSearchResultList(items, listEl);
    const toggleLink = document.getElementById('add-map-toggle-link');
    if (toggleLink) {
        const shouldShow = addSearchLatestQuery.length >= 2 || !!opts.forceMapToggle;
        toggleLink.classList.toggle('hidden', !shouldShow);
    }

    const mapWrap = document.getElementById('add-search-map-wrap');
    if (mapWrap && !mapWrap.classList.contains('hidden')) {
        refreshAddSearchMapMarkers(items);
    }
}

function openAddSearchMap(opts = {}) {
    const preserveView = !!opts.preserveView;
    const mapWrap = document.getElementById('add-search-map-wrap');
    const toggleLink = document.getElementById('add-map-toggle-link');
    if (!mapWrap || !toggleLink) return;
    const hadMap = !!addSearchMap;
    mapWrap.classList.remove('hidden');
    toggleLink.innerText = '收起地图';
    hideAddSearchResultList();
    refreshAddSearchMapMarkers(addSearchLatestItems, { preserveView: preserveView && hadMap });
    requestAnimationFrame(() => {
        updateAddSearchMapHeight();
        requestAnimationFrame(() => updateAddSearchMapHeight());
    });
}

window.toggleAddSearchMap = () => {
    const mapWrap = document.getElementById('add-search-map-wrap');
    const toggleLink = document.getElementById('add-map-toggle-link');
    if (!mapWrap || !toggleLink) return;
    if (mapWrap.classList.contains('hidden')) {
        openAddSearchMap();
    } else {
        mapWrap.classList.add('hidden');
        toggleLink.innerText = '在地图上查看';
    }
};

window.openAddSelectedStoreCard = () => {
    if (!selectedExistingStoreId) return;
    const store = localStores.find(s => s.id === selectedExistingStoreId);
    if (!store || !window.renderMapCardFromDB) return;
    window.renderMapCardFromDB(store, { mode: 'half', fromMap: true });
};

window.searchAddStoresInMapArea = async () => {
    const map = ensureAddSearchMap();
    if (!map) return;
    const q = (addSearchLatestQuery || document.getElementById('add-search-input')?.value || '').trim();
    const bounds = map.getBounds();
    if (!bounds) return;
    if (q.length < 2) {
        if (!addNearbySearchOrigin) return;
        const list = document.getElementById('add-search-results');
        if (!list) return;
        const center = bounds.getCenter?.();
        const places = center && typeof window.placesSearchNearby === 'function'
            ? await window.placesSearchNearby({ lat: center.lat(), lng: center.lng() }, { radius: 100, maxResultCount: 20 })
            : [];
        const items = buildAddItemsFromGooglePlaces(places, list, center ? { lat: center.lat(), lng: center.lng() } : addNearbySearchOrigin);
        applyAddSearchResults(items, list, "", { forceMapToggle: true });
        return;
    }
    await window.searchStoreForAdd(q, { mapBounds: bounds });
};

window.addEventListener('resize', () => {
    updateAddSearchMapHeight();
});

function renderAddSearchResultList(items, listEl) {
    if (!items.length) {
        listEl.innerHTML = "<div style='padding:10px'>没有结果</div>";
        return;
    }

    listEl.innerHTML = "";
    items.slice(0, 20).forEach(item => {
        const d = document.createElement('div');
        d.className = `result-item ${item.key && item.key === addSelectedSearchItemKey ? 'active' : ''}`;

        const badge = item.source === 'local'
            ? `<img src="images/mogu.svg" class="mogu-search-badge" alt="mogu">`
            : "";

        d.innerHTML = `
            <div class="result-item-name"><b>${item.name}</b>${badge}</div>
            <small>${item.secondaryText || item.address || "地址未收录"}</small>
        `;

        d.onclick = item.onClick;
        listEl.appendChild(d);
    });
}

/**
 * 搜索店铺（用于添加新店铺时）
 */
window.searchStoreForAdd = async (queryText = null, opts = {}) => {
    const q = (queryText ?? document.getElementById('add-search-input').value).trim();
    if (!q) {
        const list = document.getElementById('add-search-results');
        if (list) {
            list.classList.remove('active');
            list.innerHTML = "";
        }
        addSearchLatestItems = [];
        addSearchLatestQuery = "";
        addSelectedSearchItemKey = "";
        hideAddSearchMap();
        return;
    }

    const list = document.getElementById('add-search-results');
    list.innerHTML = "";
    list.classList.add('active');

    const mapBounds = opts?.mapBounds || null;
    // 先从我们库里搜索，按关联度排序
    const localMatches = localStores.map(s => {
        const score = scoreLocalAddSearch(q, s);
        return { store: s, score };
    }).filter(({ store, score }) => {
        if (score <= 0) return false;
        if (!mapBounds) return true;
        const lat = Number(store.lat);
        const lng = Number(store.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !window.google?.maps) return false;
        return mapBounds.contains(new google.maps.LatLng(lat, lng));
    }).sort((a, b) => b.score - a.score).map(({ store }) => store);

    const localItems = localMatches.map(store => buildLocalAddSearchItem(store, list));

    // 店铺名精确命中时直接走本地，不再请求 Google
    const exactLocalMatch = localStores.some(s => scoreLocalAddSearch(q, s) >= 115);
    if ((exactLocalMatch || q.length < 2) && !mapBounds) {
        applyAddSearchResults(localItems, list, q);
        return;
    }

    // 库里没命中时，再调用 Google；地图范围搜索时使用当前视窗
    const googlePlaces = mapBounds
        ? await (window.placesSearchTextByBounds ? window.placesSearchTextByBounds(q, mapBounds, true) : placesSearchTextCached(q, true))
        : await placesSearchTextCached(q, true);

    const googleItems = googlePlaces.filter(p => {
        const placeId = p.id || "";
        const normalizedGoogleName = normalizeStoreName(getPreferredPlaceName(p));
        return !localStores.some(s =>
            (s.googlePlaceId && s.googlePlaceId === placeId) ||
            normalizeStoreName(s.name) === normalizedGoogleName
        );
    }).map(p => buildGoogleAddSearchItem(p, list));

    applyAddSearchResults([...localItems, ...googleItems], list, q);
};

function getCurrentPositionOnce() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("当前浏览器不支持读取定位"));
            return;
        }
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = Number(position?.coords?.latitude);
            const lng = Number(position?.coords?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                reject(new Error("读取定位失败，请重试"));
                return;
            }
            resolve({ lat, lng });
        }, (error) => {
            const code = Number(error?.code);
            if (code === 1) reject(new Error("你拒绝了定位权限，请在浏览器设置里允许定位"));
            else if (code === 2) reject(new Error("暂时无法获取当前位置，请检查定位服务"));
            else if (code === 3) reject(new Error("定位超时，请重试"));
            else reject(new Error("读取定位失败，请重试"));
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

window.searchNearbyAddStores = async () => {
    if (isAddNearbySearchLoading) return;
    const list = document.getElementById('add-search-results');
    const input = document.getElementById('add-search-input');
    if (!list) return;

    isAddNearbySearchLoading = true;
    setAddNearbySearchButtonLoading(true);

    try {
        const origin = await getCurrentPositionOnce();
        addNearbySearchOrigin = origin;
        resetSelectedStoreState();
        const nearbyPlaces = typeof window.placesSearchNearby === 'function'
            ? await window.placesSearchNearby(origin, { radius: 100, maxResultCount: 20 })
            : [];

        if (input) input.value = "";
        lastAddQuery = "";
        addSelectedSearchItemKey = "";
        addSelectedStoreName = "";
        addSelectedIsLocal = false;
        selectedExistingStoreId = null;
        updateAddPickConfirmButton();
        updateAddSelectedStoreActions();
        updateAddSearchClearButton();

        list.classList.add('active');
        if (!nearbyPlaces.length) {
            addSearchLatestItems = [];
            addSearchLatestQuery = "";
            const toggleLink = document.getElementById('add-map-toggle-link');
            if (toggleLink) {
                toggleLink.classList.add('hidden');
                toggleLink.innerText = '在地图上查看';
            }
            list.innerHTML = "<div style='padding:10px'>100米内没有 Google 地图店铺</div>";
            hideAddSearchMap();
            return;
        }

        const items = buildAddItemsFromGooglePlaces(nearbyPlaces, list, origin);
        applyAddSearchResults(items, list, "", { forceMapToggle: true });
    } catch (err) {
        showAppNoticeModal(err?.message || "读取定位失败，请重试");
    } finally {
        isAddNearbySearchLoading = false;
        setAddNearbySearchButtonLoading(false);
    }
};

async function placesSearchTextCached(q, photo = false) {
    const key = `${photo ? 'p' : 'n'}:${q.trim().toLowerCase()}`;
    if (searchCache.has(key)) return searchCache.get(key);
    const result = await window.placesSearchText(q, photo);
    searchCache.set(key, result);
    return result;
}

window.migrateStoreNamesToPreferredLanguage = async (opts = {}) => {
    const {
        dryRun = false,
        limit = 0,
        delayMs = 120
    } = opts || {};

    if (typeof window.fetchPreferredPlaceNameById !== 'function') {
        throw new Error('地图模块未就绪，请先打开一次地图页后重试');
    }

    const targets = (localStores || []).filter((store) => String(store?.googlePlaceId || '').trim());
    if (!targets.length) {
        const result = { checked: 0, updated: 0, skipped: 0, failed: 0, dryRun: !!dryRun };
        console.log('没有可迁移的店铺');
        return result;
    }

    const maxCount = Number(limit) > 0 ? Number(limit) : targets.length;
    let checked = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const store of targets) {
        if (checked >= maxCount) break;
        checked += 1;
        try {
            const nameInfo = await window.fetchPreferredPlaceNameById(store.googlePlaceId);
            const preferredName = String(nameInfo?.preferredName || '').trim();
            if (!preferredName || preferredName === String(store.name || '').trim()) {
                skipped += 1;
                continue;
            }

            if (!dryRun) {
                await updateDoc(doc(db, "stores", store.id), {
                    name: preferredName,
                    nameJa: String(nameInfo?.localName || '').trim() || preferredName,
                    nameEn: String(nameInfo?.englishName || '').trim()
                });
            }

            localStores = localStores.map((item) => item.id === store.id
                ? {
                    ...item,
                    name: preferredName,
                    nameJa: String(nameInfo?.localName || '').trim() || preferredName,
                    nameEn: String(nameInfo?.englishName || '').trim()
                }
                : item
            );
            updated += 1;
            if (delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        } catch (err) {
            failed += 1;
            console.error(`店名迁移失败: ${store.id}`, err);
        }
    }

    window.localStores = localStores;
    if (typeof applyFilters === 'function') applyFilters();
    const favView = document.getElementById('view-fav');
    if (favView && !favView.classList.contains('hidden') && typeof renderRecordCalendar === 'function') {
        renderRecordCalendar();
    }

    const summary = `店名迁移完成：检查${checked}，更新${updated}，跳过${skipped}，失败${failed}${dryRun ? '（dry-run）' : ''}`;
    console.log(summary);
    if (typeof showAppNoticeModal === 'function') showAppNoticeModal(summary, '店名迁移');
    return { checked, updated, skipped, failed, dryRun: !!dryRun };
};

async function searchLocationForConfirm(keyword = null) {
    const inputEl = document.getElementById('fetched-address-input');
    const q = String(keyword ?? (inputEl?.value || '')).trim();
    const list = document.getElementById('loc-search-results');
    if (!list || !inputEl) return;
    if (q.length < 2) {
        list.classList.remove('active');
        list.innerHTML = "";
        return;
    }

    const ps = await placesSearchTextCached(q, false);
    list.innerHTML = "";
    list.classList.add('active');

    if (!ps.length) {
        list.innerHTML = "<div style='padding:10px'>No results</div>";
        return;
    }

    ps.slice(0, 5).forEach(p => {
        const d = document.createElement('div');
        d.className = "result-item";
        const preferredName = getPreferredPlaceName(p);
        d.innerHTML = `<div class="result-item-name"><b>${preferredName}</b></div><small>${p.formattedAddress || ''}</small>`;
        d.onclick = () => {
            document.getElementById('fetched-address-input').value = p.formattedAddress || preferredName;
            if (p.location) {
                tempCoords = { lat: p.location.latitude, lng: p.location.longitude };
            }
            list.classList.remove('active');
        };
        list.appendChild(d);
    });
}

function initAutoSuggestInputs() {
    const addInput = document.getElementById('add-search-input');
    if (addInput) {
        addInput.addEventListener('focus', () => {
            const mapWrap = document.getElementById('add-search-map-wrap');
            if (mapWrap && !mapWrap.classList.contains('hidden')) {
                showAddSearchResultList();
            }
        });
        addInput.addEventListener('click', () => {
            const mapWrap = document.getElementById('add-search-map-wrap');
            if (mapWrap && !mapWrap.classList.contains('hidden')) {
                showAddSearchResultList();
            }
        });
        addInput.addEventListener('input', () => {
            const q = addInput.value.trim();
            updateAddSearchClearButton();
            if (addSelectedStoreName && q !== addSelectedStoreName) {
                addSelectedStoreName = "";
                addSelectedIsLocal = false;
                selectedExistingStoreId = null;
                addSelectedSearchItemKey = "";
                updateAddPickConfirmButton();
                updateAddSelectedStoreActions();
                syncAddSearchSelectionUI();
            }
            clearTimeout(addSearchDebounceTimer);
            if (q.length < 1) {
                const list = document.getElementById('add-search-results');
                if (list) {
                    list.classList.remove('active');
                    list.innerHTML = "";
                }
                const toggleLink = document.getElementById('add-map-toggle-link');
                if (toggleLink) {
                    toggleLink.classList.add('hidden');
                    toggleLink.innerText = '在地图上查看';
                }
                addSearchLatestItems = [];
                addSearchLatestQuery = "";
                hideAddSearchMap();
                lastAddQuery = "";
                updateAddSearchClearButton();
                return;
            }
            addSearchDebounceTimer = setTimeout(async () => {
                if (q === lastAddQuery) return;
                lastAddQuery = q;
                await window.searchStoreForAdd(q);
            }, 350);
        });
    }

    if (!document.body.dataset.addSearchDismissBound) {
        document.body.dataset.addSearchDismissBound = '1';
        document.addEventListener('click', (e) => {
            const target = e.target;
            const list = document.getElementById('add-search-results');
            const input = document.getElementById('add-search-input');
            const mapWrap = document.getElementById('add-search-map-wrap');
            if (!list || !input || !mapWrap) return;
            if (list.contains(target) || input.contains(target)) return;
            hideAddSearchResultList();
        });
    }

    const locInput = document.getElementById('fetched-address-input');
    if (locInput) {
        locInput.addEventListener('input', () => {
            const q = locInput.value.trim();
            clearTimeout(locSearchDebounceTimer);
            if (q.length < 2) {
                const list = document.getElementById('loc-search-results');
                if (list) {
                    list.classList.remove('active');
                    list.innerHTML = "";
                }
                lastLocQuery = "";
                return;
            }
            locSearchDebounceTimer = setTimeout(async () => {
                if (q === lastLocQuery) return;
                lastLocQuery = q;
                await searchLocationForConfirm(q);
            }, 350);
        });
    }
}

function initHomeSearchInput() {
    const homeInput = document.getElementById('home-search');
    if (!homeInput || homeInput.dataset.bound === '1') return;
    homeInput.dataset.bound = '1';
    homeInput.addEventListener('input', () => {
        clearTimeout(homeSearchDebounceTimer);
        homeSearchDebounceTimer = setTimeout(() => {
            homeSearchQuery = (homeInput.value || "").trim().toLowerCase();
            applyFilters();
        }, 180);
    });
}

function initScrollbarAutoFade() {
    const timers = new WeakMap();
    const showScrolling = (target) => {
        if (!target || !target.classList) return;
        target.classList.add('is-scrolling');
        const oldTimer = timers.get(target);
        if (oldTimer) clearTimeout(oldTimer);
        const timer = setTimeout(() => {
            target.classList.remove('is-scrolling');
            timers.delete(target);
        }, 520);
        timers.set(target, timer);
    };

    document.addEventListener('scroll', (e) => {
        const target = (e.target === document || e.target === document.body)
            ? document.scrollingElement
            : e.target;
        showScrolling(target);
    }, true);
}

/* =========================================
   10. 排序菜单逻辑
   点击排序按钮展开/收起排序选项
   ========================================= */

/**
 * 切换排序菜单显示/隐藏
 */
window.toggleSortMenu = () => {
    document.getElementById('sort-menu').classList.toggle('active');
};

/**
 * 选择排序方式
 * @param {string} text - 显示的文字
 * @param {string} sortKey - 排序键
 */
window.selectSortOption = (text, sortKey) => {
    const btnText = document.getElementById('sort-btn-text');
    if (btnText) {
        const labelMap = {
            default: '综合排序',
            price: '价格排序',
            distance: '距离排序',
            rating: '评价排序'
        };
        btnText.innerText = labelMap[sortKey] || (String(text || '').includes('排序') ? text : `${text}排序`);
    }
    document.getElementById('sort-menu').classList.remove('active');

    // 更新选中状态
    document.querySelectorAll('.sort-menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.innerText === text) item.classList.add('active');
    });

    console.log(`Sorting by: ${sortKey}`);

    currentSortKey = sortKey;
    applyFilters(); // Re-apply filters which will also sort
};

// 当前排序键
let currentSortKey = 'default';
let isSortReversed = false;

window.toggleSortDirection = () => {
    isSortReversed = !isSortReversed;
    const btn = document.getElementById('sort-dir-btn');
    if (btn) {
        btn.classList.toggle('active-border', isSortReversed);
        btn.classList.toggle('is-reversed', isSortReversed);
    }
    applyFilters();
};

// 点击页面其他地方时关闭排序菜单
document.addEventListener('click', (e) => {
    const container = document.querySelector('.sort-btn-container');
    const menu = document.getElementById('sort-menu');
    if (container && menu && !container.contains(e.target)) {
        menu.classList.remove('active');
    }

    const profileMenuWrap = document.querySelector('.profile-header-left');
    const profileMenu = document.getElementById('profile-menu');
    if (profileMenu && profileMenu.classList.contains('open')) {
        if (!profileMenuWrap || !profileMenuWrap.contains(e.target)) {
            profileMenu.classList.remove('open');
        }
    }
});

/* =========================================
   11. 筛选面板逻辑
   价格、距离、偏好等筛选条件
   ========================================= */

// 当前筛选条件
let filterState = defaultFilterState();

/**
 * 检查店铺营业状态
 * @param {Object} store - 店铺对象
 * @param {string} status - 要求的状态 ('open' | 'soon')
 * @returns {boolean} 是否符合
 */
function checkOpenStatus(store, status) {
    if (isStorePermanentlyClosed(store)) return false;
    if (!store.openingHours) return false;

    const now = new Date();
    const day = now.getDay(); // 0(Sun) - 6(Sat)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const periods = normalizeOpeningPeriods(store.openingHours);
    if (!periods.length) return false;
    const nowWeekMin = day * 24 * 60 + currentMinutes;

    const normalizedRanges = periods.map(p => {
        const start = p.openDay * 24 * 60 + p.openMin;
        let end = p.closeDay * 24 * 60 + p.closeMin;
        if (end <= start) end += 7 * 24 * 60;
        return { start, end };
    });

    if (status === 'open') {
        // 检查现在是否营业
        return normalizedRanges.some(({ start, end }) => {
            return (nowWeekMin >= start && nowWeekMin < end)
                || (nowWeekMin + 7 * 24 * 60 >= start && nowWeekMin + 7 * 24 * 60 < end);
        });
    } else if (status === 'soon') {
        // 检查是否在30分钟内开门
        return normalizedRanges.some(({ start }) => {
            const diff = ((start - nowWeekMin) + 7 * 24 * 60) % (7 * 24 * 60);
            return diff > 0 && diff <= 30;
        });
    }
    return true;
}

/**
 * 更新评分滑块逻辑
 * 处理双滑块的交互和视觉更新
 */
window.updateRatingSlider = () => {
    const rangeMin = document.getElementById('rating-min');
    const rangeMax = document.getElementById('rating-max');
    const track = document.getElementById('rating-track');
    const valMin = document.getElementById('rating-min-val');
    const valMax = document.getElementById('rating-max-val');

    let min = parseFloat(rangeMin.value);
    let max = parseFloat(rangeMax.value);

    // 限制滑块不交叉
    if (min > max) {
        const tmp = min;
        min = max;
        max = tmp;
        // 交换值但不交换DOM，视觉上更自然
    }

    // 更新显示数值
    valMin.innerText = min.toFixed(1);
    valMax.innerText = max.toFixed(1);

    // 计算百分比位置
    const percentMin = (min / 5) * 100;
    const percentMax = (max / 5) * 100;

    // 更新轨道填充
    track.style.left = percentMin + "%";
    track.style.width = (percentMax - percentMin) + "%";
};

/**
 * 切换筛选面板显示/隐藏
 */
window.toggleFilterPanel = () => {
    const p = document.getElementById('filter-panel');
    const icon = document.querySelector('#filter-master-btn > :last-child'); // Fixed selector

    if (p.classList.contains('active')) {
        p.classList.remove('active');
        p.style.transform = '';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        // 关闭其他菜单
        const sortMenu = document.getElementById('sort-menu');
        if (sortMenu) sortMenu.classList.remove('active');
        const locMenu = document.getElementById('location-menu');
        if (locMenu) locMenu.classList.remove('active');

        // 打开时同步 UI 到当前状态
        applyFilterStateToUI();

        p.classList.add('active');
        adjustFilterPanelViewport();
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
};

function adjustFilterPanelViewport() {
    const p = document.getElementById('filter-panel');
    if (!p) return;
    p.style.transform = '';

    const rect = p.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const gutter = 8;
    let shiftX = 0;

    if (rect.right > viewportW - gutter) {
        shiftX -= (rect.right - (viewportW - gutter));
    }
    if (rect.left + shiftX < gutter) {
        shiftX += (gutter - (rect.left + shiftX));
    }

    if (shiftX !== 0) {
        p.style.transform = `translateX(${Math.round(shiftX)}px)`;
    }
}

function defaultFilterState() {
    return {
        pref: 'none',
        priceMin: '',
        priceMax: '',
        dist: 'infinite',
        distCustom: '',
        ratingMin: 0,
        ratingMax: 5,
        openStatus: 'any'
    };
}

function applyFilterStateToUI() {
    // 输入框
    document.getElementById('price-min').value = filterState.priceMin || "";
    document.getElementById('price-max').value = filterState.priceMax || "";
    document.getElementById('dist-custom-val').value = filterState.distCustom || "";

    // 按钮选中状态
    document.querySelectorAll('.filter-options .pill').forEach(p => p.classList.remove('selected'));
    const markSelected = (type, value) => {
        const selector = `.pill[onclick*="setFilter('${type}', '${value}'"]`;
        const el = document.querySelector(selector);
        if (el) el.classList.add('selected');
    };
    markSelected('pref', filterState.pref);
    markSelected('openStatus', filterState.openStatus);
    markSelected('dist', filterState.dist);

    // 自定义距离输入
    const wrap = document.getElementById('dist-custom-input-wrap');
    if (filterState.dist === 'custom') wrap.classList.add('active');
    else wrap.classList.remove('active');

    // 评分滑块
    document.getElementById('rating-min').value = filterState.ratingMin;
    document.getElementById('rating-max').value = filterState.ratingMax;
    updateRatingSlider();

    // 同步偏好 pill 的图标（是否使用带填充颜色的版本）
    updatePrefPillIcons(filterState.pref);
}

/**
 * 设置筛选条件
 * @param {string} type - 筛选类型
 * @param {string} value - 筛选值
 * @param {Element} el - 被点击的元素
 */
window.setFilter = (type, value, el) => {
    const parent = el.parentElement;
    // 取消同组其他选项的选中状态
    parent.querySelectorAll('.pill[onclick*="setFilter"]').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    filterState[type] = value; // Use filterState

    // 如果选择"自定义"距离，显示输入框
    if (type === 'dist') {
        const wrap = document.getElementById('dist-custom-input-wrap');
        if (value === 'custom') {
            wrap.classList.add('active');
        } else {
            wrap.classList.remove('active');
        }
    }

    // 偏好筛选：切换图标为带填充颜色的版本
    if (type === 'pref') {
        updatePrefPillIcons(value);
    }
};

/**
 * 根据当前选择的偏好，切换「朋友好评 / 差评 / 想吃」三个 pill 的图标
 * 规则：选中的使用 `*-f.svg`，未选中的使用普通 `.svg`
 */
function updatePrefPillIcons(selectedPref) {
    const goodImg = document.querySelector('.pill.pref-good img');
    const badImg = document.querySelector('.pill.pref-bad img');
    const wantImg = document.querySelector('.pill.pref-want img');

    const setFilled = (imgEl, active) => {
        if (!imgEl) return;
        let src = imgEl.getAttribute('src');
        if (!src) return;
        if (active) {
            // 灰色图标以 -g.svg 结尾，选中时换成 -f.svg
            if (src.endsWith('-g.svg')) {
                src = src.replace('-g.svg', '-f.svg');
                imgEl.setAttribute('src', src);
            }
        } else {
            // 取消选中时，把 -f.svg 换回 -g.svg
            if (src.endsWith('-f.svg')) {
                src = src.replace('-f.svg', '-g.svg');
                imgEl.setAttribute('src', src);
            }
        }
    };

    // 选「无」时全部恢复成灰色图标
    if (selectedPref === 'none') {
        setFilled(goodImg, false);
        setFilled(badImg, false);
        setFilled(wantImg, false);
        return;
    }

    setFilled(goodImg, selectedPref === 'good');
    setFilled(badImg, selectedPref === 'bad');
    setFilled(wantImg, selectedPref === 'want');
}

/**
 * 保存筛选
 */
window.saveFilters = () => {
    // 价格
    filterState.priceMin = document.getElementById('price-min').value;
    filterState.priceMax = document.getElementById('price-max').value;

    // 自定义距离
    if (filterState.dist === 'custom') {
        filterState.distCustom = document.getElementById('dist-custom-val').value;
    }

    // 评分 (新逻辑)
    const rMin = parseFloat(document.getElementById('rating-min').value);
    const rMax = parseFloat(document.getElementById('rating-max').value);
    filterState.ratingMin = Math.min(rMin, rMax);
    filterState.ratingMax = Math.max(rMin, rMax);

    // 隐藏面板
    const p = document.getElementById('filter-panel');
    p.classList.remove('active');

    const icon = document.querySelector('#filter-master-btn > :last-child'); // Fixed selector
    if (icon) icon.style.transform = 'rotate(0deg)';

    // 应用筛选
    applyFilters();
};

/**
 * 清空筛选
 */
window.resetFilters = () => {
    filterState = defaultFilterState();
    applyFilterStateToUI();
    applyFilters();
};

// 兼容旧按钮调用
window.clearFilters = window.resetFilters;

/**
 * 应用筛选逻辑
 */
function applyFilters() {
    let source = [...window.localStores]; // Copy array

    // 首页搜索（仅本地已收录店铺）
    if (homeSearchQuery) {
        source = source.filter(s => scoreStoreSearch(homeSearchQuery, s) > 0);
    } else {
        source = source.filter(s => !isStorePermanentlyClosed(s));
    }

    // 1. 偏好筛选
    if (filterState.pref === 'good') {
        source = source.filter(s => window.localLikes.has(s.id));
    } else if (filterState.pref === 'bad') {
        source = source.filter(s => window.localDislikes.has(s.id));
    } else if (filterState.pref === 'want') {
        source = source.filter(s => window.myFavIds.includes(s.id));
    }

    // 4. 评分筛选 (双滑块)
    source = source.filter(s => {
        let match = true;
        const r = getStoreAverageRating(s);
        if (r < filterState.ratingMin || r > filterState.ratingMax) match = false;

        // 距离筛选
        if (filterState.dist !== 'custom' && filterState.dist !== 'infinite') {
            const maxDist = parseInt(filterState.dist);
            const dist = getStoreLinearDistanceMeters(s);
            if (!Number.isFinite(dist) || dist > maxDist) match = false;
        } else if (filterState.dist === 'custom') {
            const maxDist = parseInt(filterState.distCustom);
            const dist = getStoreLinearDistanceMeters(s);
            if (!Number.isFinite(dist) || dist > maxDist) match = false;
        }

        // 营业状态筛选
        if (match && filterState.openStatus && filterState.openStatus !== 'any') {
            if (!checkOpenStatus(s, filterState.openStatus)) match = false;
        }

        return match;
    });

    // 0. 排序（按右侧规则；左侧按钮控制是否反向）
    source.sort((a, b) => {
        let result = 0;
        if (currentSortKey === 'price') {
            result = (parseInt(a.budget) || 0) - (parseInt(b.budget) || 0);  // 默认低价->高价
        } else if (currentSortKey === 'distance') {
            const dA = getStoreLinearDistanceMeters(a) ?? 99999;
            const dB = getStoreLinearDistanceMeters(b) ?? 99999;
            result = dA - dB;  // 默认近->远
        } else if (currentSortKey === 'rating') {
            result = getStoreAverageRating(b) - getStoreAverageRating(a); // 默认高->低
        } else {
            result = (b.createdAt || 0) - (a.createdAt || 0); // 综合默认新->旧
        }
        return isSortReversed ? -result : result;
    });

    // 渲染
    renderStores(source);

    // 生成筛选摘要文字
    let textParts = [];

    // 偏好
    if (filterState.pref !== 'none') {
        if (filterState.pref === 'good') textParts.push('朋友好评');
        else if (filterState.pref === 'bad') textParts.push('朋友差评');
        else if (filterState.pref === 'want') textParts.push('朋友想吃');
    }

    // 价格
    if (filterState.priceMin || filterState.priceMax) {
        const pMin = filterState.priceMin || '0';
        const pMax = filterState.priceMax || '∞';
        textParts.push(`${pMin}-${pMax}日元`);
    }

    // 距离
    if (filterState.dist === 'custom') {
        const customVal = filterState.distCustom || '0';
        textParts.push(`${customVal}m内`);
    } else if (filterState.dist === 'infinite') {
        // textParts.push('距离不限'); // Optional: Don't show text if unlimited
    } else if (filterState.dist !== '200') {
        textParts.push(`${filterState.dist}m内`);
    }

    // 评分
    if (filterState.ratingMin > 0 || filterState.ratingMax < 5) {
        textParts.push(`${filterState.ratingMin}-${filterState.ratingMax}分`);
    }

    // 营业状态
    if (filterState.openStatus && filterState.openStatus !== 'any') {
        textParts.push(filterState.openStatus === 'open' ? '营业中' : '即将营业');
    }


    // 更新按钮状态
    const btnText = document.getElementById('filter-btn-text');
    const masterBtn = document.getElementById('filter-master-btn');

    if (textParts.length > 0) {
        btnText.innerText = "筛选: " + textParts.join(' / ');
        masterBtn.classList.add('active-filter');
    } else {
        btnText.innerText = "筛选";
        masterBtn.classList.remove('active-filter');
    }
}

// 点击页面其他地方时关闭筛选面板
document.addEventListener('click', (e) => {
    const container = document.querySelector('.filter-btn-container');
    if (container && !container.contains(e.target)) {
        document.getElementById('filter-panel').classList.remove('active');
        document.getElementById('filter-panel').style.transform = '';
    }
});

window.addEventListener('resize', () => {
    const p = document.getElementById('filter-panel');
    if (p && p.classList.contains('active')) {
        adjustFilterPanelViewport();
    }
});

/* =========================================
   12. 位置选择逻辑
   选择起点位置（目前默认Cocoon Tower）
   ========================================= */
let tempCoords = null;   // 临时坐标
let geocoder = null;     // 地理编码器
let miniConfirmMap = null;
let miniConfirmMarker = null;

function waitForGoogleMaps(maxWaitMs = 2500) {
    return new Promise((resolve) => {
        if (window.google?.maps) {
            resolve(true);
            return;
        }
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (window.google?.maps) {
                clearInterval(timer);
                resolve(true);
                return;
            }
            if (Date.now() - startedAt >= maxWaitMs) {
                clearInterval(timer);
                resolve(false);
            }
        }, 120);
    });
}

function normalizeFullWidthDigits(text) {
    return String(text || '')
        .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/[−ー－‐]/g, '-');
}

function toJapaneseAddressText(address) {
    let text = normalizeFullWidthDigits(address || '');
    text = text.replace(/^日本、?/, '');
    text = text.replace(/〒\d{3}-\d{4}\s*/g, '');
    text = text.replace(/\s+/g, '');
    // 例: 西新宿1丁目2-3 -> 西新宿1-2-3
    text = text.replace(/(\d+)丁目(\d+)-(\d+)/g, '$1-$2-$3');
    return text || '当前位置';
}

function findLandmarkName(results = []) {
    for (const result of results) {
        const comps = Array.isArray(result?.address_components) ? result.address_components : [];
        const landmarkComp = comps.find(comp => {
            const types = Array.isArray(comp?.types) ? comp.types : [];
            return types.includes('premise')
                || types.includes('subpremise')
                || types.includes('point_of_interest')
                || types.includes('establishment');
        });
        if (landmarkComp?.long_name) return normalizeFullWidthDigits(landmarkComp.long_name);
    }
    return '';
}

function renderMiniConfirmMap(coords) {
    const mapEl = document.getElementById('mini-map-confirm');
    if (!mapEl || !coords) return;
    const center = { lat: Number(coords.lat), lng: Number(coords.lng) };
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

    if (!miniConfirmMap && window.google?.maps) {
        miniConfirmMap = new google.maps.Map(mapEl, {
            center,
            zoom: 16,
            disableDefaultUI: true,
            clickableIcons: false
        });
    }
    if (!miniConfirmMap) return;
    miniConfirmMap.setCenter(center);
    if (!miniConfirmMarker) {
        miniConfirmMarker = new google.maps.Marker({ position: center, map: miniConfirmMap, optimized: false });
    } else {
        miniConfirmMarker.setPosition(center);
    }
}

function reverseGeocodeCurrentCoords(lat, lng) {
    return new Promise(async (resolve) => {
        const mapsReady = await waitForGoogleMaps(2500);
        if (!mapsReady || !window.google?.maps) {
            resolve("当前位置");
            return;
        }
        if (!geocoder) geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
            if (status === 'OK' && Array.isArray(results) && results.length) {
                // 优先展示建筑/地标名，其次展示日式地址（丁目-番-号）
                const landmark = findLandmarkName(results);
                if (landmark) {
                    resolve(landmark);
                    return;
                }
                resolve(toJapaneseAddressText(results[0]?.formatted_address || ''));
                return;
            }
            resolve("当前位置");
        });
    });
}

function syncLocationTriggerIcon() {
    const iconEl = document.getElementById('current-location-icon');
    if (!iconEl) return;
    iconEl.src = window.mapOriginType === 'gps'
        ? 'images/weizhih.svg'
        : 'images/weizhilan.svg';
}

function toggleLocationLoadingModal(visible) {
    const modal = document.getElementById('loc-loading-modal');
    const fabBtn = document.querySelector('.fab-dice-btn');
    if (!modal) return;
    modal.style.display = visible ? 'flex' : 'none';
    if (fabBtn) {
        fabBtn.classList.toggle('loc-modal-hidden', visible || document.getElementById('loc-confirm-modal')?.style.display === 'flex');
    }
}

function toggleLocationConfirmModal(visible) {
    const modal = document.getElementById('loc-confirm-modal');
    const fabBtn = document.querySelector('.fab-dice-btn');
    if (!modal) return;
    modal.style.display = visible ? 'flex' : 'none';
    if (fabBtn) {
        fabBtn.classList.toggle('loc-modal-hidden', visible || document.getElementById('loc-loading-modal')?.style.display === 'flex');
    }
}

/**
 * 切换位置菜单
 */
window.toggleLocationMenu = () => {
    document.getElementById('location-menu').classList.toggle('active');
};

function refreshDistanceDependentViews() {
    if (typeof applyFilters === 'function') applyFilters();
    if (typeof renderProfileFavorites === 'function') renderProfileFavorites();
    if (typeof window.refreshOpenMapCardDistance === 'function') window.refreshOpenMapCardDistance();
}

/**
 * 选择固定位置
 */
window.selectFixedLocation = (name) => {
    document.getElementById('current-location-text').innerText = name;
    document.getElementById('location-menu').classList.remove('active');
    window.mapOrigin = { ...FIXED_ORIGIN };
    window.mapOriginType = 'cocoon';
    syncLocationTriggerIcon();
    if (window.refreshCurrentOriginMarker) window.refreshCurrentOriginMarker();
    refreshDistanceDependentViews();
};

/**
 * 开始获取当前GPS位置
 */
window.startFetchLocation = () => {
    document.getElementById('location-menu').classList.remove('active');
    if (isFetchingCurrentLocation) return;
    if (!navigator.geolocation) {
        showAppNoticeModal("当前浏览器不支持读取定位");
        return;
    }

    isFetchingCurrentLocation = true;
    tempCoords = null;
    toggleLocationConfirmModal(false);

    if (locationLoadingShowTimer) clearTimeout(locationLoadingShowTimer);
    locationLoadingShowTimer = setTimeout(() => {
        toggleLocationLoadingModal(true);
        locationLoadingShowTimer = null;
    }, 180);

    const finalizeFetch = () => {
        isFetchingCurrentLocation = false;
        if (locationLoadingShowTimer) {
            clearTimeout(locationLoadingShowTimer);
            locationLoadingShowTimer = null;
        }
        toggleLocationLoadingModal(false);
    };

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = Number(position?.coords?.latitude);
        const lng = Number(position?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            finalizeFetch();
            showAppNoticeModal("读取定位失败，请重试");
            return;
        }

        tempCoords = { lat, lng };
        finalizeFetch();

        toggleLocationConfirmModal(true);
        renderMiniConfirmMap(tempCoords);
    }, (error) => {
        finalizeFetch();
        const code = Number(error?.code);
        if (code === 1) {
            showAppNoticeModal("你拒绝了定位权限，请在浏览器设置里允许定位");
            return;
        }
        if (code === 2) {
            showAppNoticeModal("暂时无法获取当前位置，请检查定位服务");
            return;
        }
        if (code === 3) {
            showAppNoticeModal("定位超时，请重试");
            return;
        }
        showAppNoticeModal("读取定位失败，请重试");
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
};

/**
 * 确认使用GPS位置
 */
window.confirmGPSLocation = () => {
    const newLoc = "当前位置";
    document.getElementById('current-location-text').innerText = newLoc;
    if (tempCoords && Number.isFinite(tempCoords.lat) && Number.isFinite(tempCoords.lng)) {
        window.mapOrigin = { lat: Number(tempCoords.lat), lng: Number(tempCoords.lng) };
    }
    window.mapOriginType = 'gps';
    syncLocationTriggerIcon();
    if (window.refreshCurrentOriginMarker) window.refreshCurrentOriginMarker();
    refreshDistanceDependentViews();
    closeLocModals();
};

/**
 * 关闭位置弹窗
 */
window.closeLocModals = () => {
    if (locationLoadingShowTimer) {
        clearTimeout(locationLoadingShowTimer);
        locationLoadingShowTimer = null;
    }
    toggleLocationLoadingModal(false);
    toggleLocationConfirmModal(false);
    const list = document.getElementById('loc-search-results');
    if (list) {
        list.classList.remove('active');
        list.innerHTML = "";
    }
};

// 点击页面其他地方时关闭位置菜单
document.addEventListener('click', (e) => {
    if (!document.getElementById('location-trigger').contains(e.target)) {
        document.getElementById('location-menu').classList.remove('active');
    }
});

initAutoSuggestInputs();
initHomeSearchInput();
initScrollbarAutoFade();
renderBuildVersionTag();
resetAddComposerFlow();

function resetFriendProfileOverlayState() {
    const profileView = document.getElementById('view-profile');
    if (friendProfileOverlayHideTimer) {
        clearTimeout(friendProfileOverlayHideTimer);
        friendProfileOverlayHideTimer = null;
    }
    friendProfileOverlayActive = false;
    if (profileView) {
        profileView.classList.remove('friend-profile-overlay', 'is-open');
    }
}

function closeFriendProfileOverlay() {
    const profileView = document.getElementById('view-profile');
    if (!profileView) return;
    profileView.classList.remove('is-open');
    friendProfileOverlayActive = false;
    if (friendProfileOverlayHideTimer) clearTimeout(friendProfileOverlayHideTimer);
    friendProfileOverlayHideTimer = setTimeout(() => {
        profileView.classList.add('hidden');
        profileView.classList.remove('friend-profile-overlay');
        friendProfileOverlayHideTimer = null;
        viewingFriendUid = "";
        viewingFriendData = null;
        friendProfileFavTab = 'want';
    }, 280);
}

function resetFriendsPageState() {
    const friendsPage = document.getElementById('friends-page');
    const profileView = document.getElementById('view-profile');
    if (friendsPageHideTimer) {
        clearTimeout(friendsPageHideTimer);
        friendsPageHideTimer = null;
    }
    if (friendsPage) {
        friendsPage.classList.add('hidden');
        friendsPage.classList.remove('is-open');
    }
    if (profileView) profileView.classList.remove('friends-page-active');
    friendsFilterKeyword = "";
    const filterInput = document.getElementById('friends-filter-input');
    if (filterInput) filterInput.value = "";
}

function resetRecordDayViewState() {
    const view = document.getElementById('record-day-view');
    const favView = document.getElementById('view-fav');
    if (recordDayViewHideTimer) {
        clearTimeout(recordDayViewHideTimer);
        recordDayViewHideTimer = null;
    }
    if (view) {
        view.classList.add('hidden');
        view.classList.remove('is-open');
    }
    if (favView) favView.classList.remove('record-day-active');
    currentRecordDayKey = "";
}

function isVisibleElement(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function isScrollableElement(el) {
    if (!isVisibleElement(el)) return false;
    const { overflowY } = window.getComputedStyle(el);
    const allowsScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    return allowsScroll && el.scrollHeight > el.clientHeight + 2;
}

function getActiveViewScrollTarget() {
    const activeView = Array.from(document.querySelectorAll('#app > section'))
        .find(section => !section.classList.contains('hidden'));
    if (!activeView) return null;

    const directSelectorsByView = {
        'view-home': ['.store-list'],
        'view-add': ['#view-add'],
        'view-fav': ['#record-day-view.is-open', '#record-day-view:not(.hidden)', '#view-fav'],
        'view-profile': [
            '#friends-list',
            '#friends-page',
            '#profile-fav-list',
            '#profile-content-activity',
            '#profile-content-favorites',
            '#guest-info',
            '#view-profile'
        ]
    };

    const directSelectors = directSelectorsByView[activeView.id] || [];
    for (const selector of directSelectors) {
        const target = document.querySelector(selector);
        if (isScrollableElement(target)) return target;
    }

    if (isScrollableElement(activeView)) return activeView;

    const descendants = Array.from(activeView.querySelectorAll('*'))
        .filter(isScrollableElement)
        .sort((a, b) => b.scrollHeight - a.scrollHeight);
    return descendants[0] || null;
}

function scrollActiveViewToTop() {
    const scrollTarget = getActiveViewScrollTarget();
    if (!scrollTarget) return;
    scrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
}

function shouldIgnoreTopTap(target) {
    return !!target.closest(
        'button, a, input, textarea, select, label, summary, [role="button"], [contenteditable="true"], .user-circle, .location-capsule, .profile-menu-popover'
    );
}

document.addEventListener('click', (e) => {
    const trigger = e.target.closest('header, .record-day-header, .profile-header, .friends-header, .login-header');
    if (!trigger || shouldIgnoreTopTap(e.target)) return;
    scrollActiveViewToTop();
});

/* =========================================
   13. 页面切换逻辑
   在首页、地图、添加、收藏、个人页面之间切换
   ========================================= */

/**
 * 切换页面视图
 * @param {string} v - 视图名称：home/map/add/fav/profile
 */
window.switchView = (v) => {
    const profileMenu = document.getElementById('profile-menu');
    if (profileMenu) profileMenu.classList.remove('open');
    closeRandomPanel();
    resetFriendProfileOverlayState();
    if (v !== 'profile') resetFriendsPageState();
    if (v !== 'fav') resetRecordDayViewState();
    if (typeof window.closeActivityImageModal === 'function') {
        window.closeActivityImageModal();
    }

    // 隐藏所有页面
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    // 显示目标页面
    document.getElementById('view-' + v).classList.remove('hidden');

    // 更新导航栏选中状态
    document.querySelectorAll('.nav-icon').forEach(n => {
        n.classList.remove('active');
        // 重置为灰色图标 (-g.svg)
        const img = n.querySelector('img');
        if (img) {
            const currentSrc = img.getAttribute('src');
            if (currentSrc.includes('-b.svg')) {
                img.setAttribute('src', currentSrc.replace('-b.svg', '-g.svg'));
            }
        }
    });

    const activeNav = document.getElementById('nav-' + v);
    if (activeNav) {
        activeNav.classList.add('active');
        // 设置为黑色图标 (-b.svg)
        const img = activeNav.querySelector('img');
        if (img) {
            const currentSrc = img.getAttribute('src');
            if (currentSrc.includes('-g.svg')) {
                img.setAttribute('src', currentSrc.replace('-g.svg', '-b.svg'));
            }
        }
    }

    // 页面切换后的特殊处理
    if (v === 'map') {
        window.initMap();        // 切换到地图时初始化地图
        if (typeof window.centerMapOnCurrentOrigin === 'function') {
            requestAnimationFrame(() => window.centerMapOnCurrentOrigin());
        }
    }
    if (v === 'add') {
        resetAddComposerReturnContext();
        resetAddComposerFlow();
        const addView = document.getElementById('view-add');
        if (addView) addView.classList.toggle('add-guest-centered', !currentUser);
    }
    if (v === 'fav') {
        recordAutoFocusPending = true;
        renderRecordCalendar();
    }
    if (v === 'home') applyFilters();                            // 切换到首页时刷新列表
    if (v === 'profile') {
        // 确保回到自己的个人主页，而不是好友页
        const friendsPage = document.getElementById('friends-page');
        const userInfo = document.getElementById('user-info');
        const guestInfo = document.getElementById('guest-info');
        const profileView = document.getElementById('view-profile');
        if (friendsPage) resetFriendsPageState();
        viewingFriendUid = "";
        viewingFriendData = null;
        if (currentUser) {
            if (profileView) profileView.classList.remove('profile-guest-mode');
            if (userInfo) userInfo.classList.remove('hidden');
            if (guestInfo) guestInfo.classList.add('hidden');
            if (userInfo) userInfo.style.display = '';
            if (guestInfo) guestInfo.style.display = 'none';
            setProfileIdentity(
                currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '用户'),
                currentUser.photoURL || ''
            );
            loadUserAvatar(currentUser.uid);
        } else {
            if (profileView) profileView.classList.add('profile-guest-mode');
            if (userInfo) userInfo.classList.add('hidden');
            if (guestInfo) guestInfo.classList.remove('hidden');
            if (userInfo) userInfo.style.display = 'none';
            if (guestInfo) guestInfo.style.display = '';
        }
        updateProfileHeaderMode();
        if (currentUser) {
            window.switchProfileTab('activity'); // 已登录进入个人页时固定展示动态并触发渲染
        }
    }

    lucide.createIcons();
};

/* =========================================
   14. 收藏页面标签切换
   想吃 / 好吃 / 难吃 三个标签
   ========================================= */

/**
 * 切换收藏页面的标签
 * @param {string} tab - 标签名：want/like/dislike
 */
window.switchFavTab = (tab) => {
    currentFavTab = tab;
    const validStoreIds = getExistingStoreIdSet();
    const validFavIds = sanitizePreferenceIds(myFavIds, validStoreIds);
    const validLikeIds = sanitizePreferenceIds(Array.from(localLikes), validStoreIds);
    const validDislikeIds = sanitizePreferenceIds(Array.from(localDislikes), validStoreIds);

    // 更新标签按钮样式
    document.querySelectorAll('.fav-tab-btn').forEach(b => {
        b.className = 'fav-tab-btn';
    });
    if (tab === 'want') document.getElementById('tab-want').classList.add('active-want');
    if (tab === 'like') document.getElementById('tab-like').classList.add('active-like');
    if (tab === 'dislike') document.getElementById('tab-dislike').classList.add('active-dislike');

    // 切换收藏 Tab 的图标（普通 ⇄ 带填充颜色）
    const wantBtn = document.getElementById('tab-want');
    const likeBtn = document.getElementById('tab-like');
    const dislikeBtn = document.getElementById('tab-dislike');
    setFavTabIconFilled(wantBtn, tab === 'want');
    setFavTabIconFilled(likeBtn, tab === 'like');
    setFavTabIconFilled(dislikeBtn, tab === 'dislike');

    // 更新标签上的数字
    document.getElementById('txt-want').innerText = `想吃(${validFavIds.length})`;
    document.getElementById('txt-like').innerText = `好吃(${validLikeIds.length})`;
    document.getElementById('txt-dislike').innerText = `难吃(${validDislikeIds.length})`;

    // 根据标签筛选店铺
    let targetIds = [];
    if (tab === 'want') targetIds = validFavIds;
    else if (tab === 'like') targetIds = validLikeIds;
    else if (tab === 'dislike') targetIds = validDislikeIds;

    const filteredStores = localStores.filter(s => targetIds.includes(s.id) && !isStorePermanentlyClosed(s));
    const container = document.getElementById('fav-list-container');

    // 渲染筛选后的店铺列表
    if (filteredStores.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding:40px; color:#ccc;'>空空如也</div>";
    } else {
        // 使用与首页相同的卡片结构
        container.innerHTML = filteredStores.map((s, idx) => {
            const isFav = myFavIds.includes(s.id);
            const isLiked = localLikes.has(s.id);
            const isDisliked = localDislikes.has(s.id);

            let statusClass = "";
            if (isDisliked) statusClass = "status-disliked";
            else if (isLiked) statusClass = "status-liked";
            else if (isFav) statusClass = "status-fav";

            const avgRating = getStoreAverageRating(s);
            const reviewCount = getStoreReviewCount(s);
            const rawImgs = getStorePreviewImageEntries(s);
            const displayImgs = rawImgs.length ? rawImgs : ["https://placehold.co/200?text=No+Image"];
            const imagesHtml = displayImgs.map(src =>
                `<img src="${getImageAssetThumbUrl(src)}" class="store-img-item" loading="lazy" decoding="async">`
            ).join('');

            return `
        <div class="store-card ${statusClass}" data-store-id="${s.id}" onclick="openDetail('${s.id}')">
            <div class="card-header-row">
                <div class="info-col">
                    <div class="store-name-row">
                        <h3 class="store-name">${renderStoreNameWithStatus(s)}</h3>
                        <div onclick="toggleFav('${s.id}'); event.stopPropagation();">
                            <img src="${isFav ? 'images/bookmark-f.svg' : 'images/bookmark.svg'}"
                                 class="bookmark-icon-btn"
                                 alt="want">
                        </div>
                    </div>
                    <div class="store-meta">
                         ${avgRating.toFixed(1)} <span class="rating-star" style="display:inline-flex;align-items:center;"><img src="images/pingfen.svg" style="width:12px;"></span>
                         <span style="color:#b2bec3">(${reviewCount})</span>
                         <span style="margin:0 4px">•</span> 
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-person-walking" viewBox="0 0 16 16"><path d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M6.44 3.752A.75.75 0 0 1 7 3.5h1.445c.742 0 1.32.643 1.243 1.38l-.43 4.083a1.8 1.8 0 0 1-.088.395l-.318.906.213.242a.8.8 0 0 1 .114.175l2 4.25a.75.75 0 1 1-1.357.638l-1.956-4.154-1.68-1.921A.75.75 0 0 1 6 8.96l.138-2.613-.435.489-.464 2.786a.75.75 0 1 1-1.48-.246l.5-3a.75.75 0 0 1 .18-.375l2-2.25Z"/><path d="M6.25 11.745v-1.418l1.204 1.375.261.524a.8.8 0 0 1-.12.231l-2.5 3.25a.75.75 0 1 1-1.19-.914zm4.22-4.215-.494-.494.205-1.843.006-.067 1.124 1.124h1.44a.75.75 0 0 1 0 1.5H11a.75.75 0 0 1-.531-.22Z"/></svg>
                         ${formatStoreDistanceText(s)}
                    </div>
                </div>
                
                ${renderStoreActionGroup(s.id, isLiked, isDisliked, idx)}
            </div>
            <div class="store-img-scroll">${imagesHtml}</div>
        </div>`;
        }).join('');
    }
    lucide.createIcons();
};

/**
 * 收藏页 / 个人页收藏 Tab 共用：根据是否激活，切换按钮里的图标
 * 普通：xxx.svg ；激活：xxx-f.svg
 */
function setFavTabIconFilled(btnEl, active) {
    if (!btnEl) return;
    const img = btnEl.querySelector('img');
    if (!img) return;
    let src = img.getAttribute('src');
    if (!src) return;

    if (active) {
        if (!src.endsWith('-f.svg')) {
            src = src.replace('.svg', '-f.svg');
            img.setAttribute('src', src);
        }
    } else {
        if (src.endsWith('-f.svg')) {
            src = src.replace('-f.svg', '.svg');
            img.setAttribute('src', src);
        }
    }
}

/**
 * 从列表中移除
 * @param {string} id - 店铺ID
 * @param {string} tab - 标签名
 */
window.removeFromList = (id, tab) => {
    if (tab === 'want') toggleFav(id);
    else toggleLocalAction(id, tab);
};

/**
 * 提交评论
 */
window.submitReview = async () => {
    const t = document.getElementById('new-review-input').value;
    if (t && currentUser) {
        await updateDoc(doc(db, "stores", currentStoreId), {
            revs: arrayUnion({
                text: t,
                user: currentUser.displayName || currentUser.email.split('@')[0],
                uid: currentUser.uid,
                createdAt: Date.now(),
                rating: Number((localStores.find(x => x.id === currentStoreId)?.rating) || 0),
                images: []
            })
        });
        document.getElementById('new-review-input').value = "";
        openDetail(currentStoreId);  // 刷新详情页
    }
};

/* =========================================
   15. 随机抽选功能
   "今天吃什么"随机选择器
   ========================================= */

// 随机抽选的筛选条件
let randomFilter = {
    types: new Set(['want', 'like']),  // 默认从: 想吃、好吃 中抽选
    distance: null,                     // 距离限制 (米)
    includeFriends: true,               // 是否包含朋友收藏
    priceMin: '',
    priceMax: '',
    distCustom: ''
};

/**
 * 打开随机抽选弹窗
 */
window.openRandomModal = () => {
    document.getElementById('layer-random').classList.add('open');
    document.getElementById('random-state-empty').style.display = 'flex';
    document.getElementById('random-result-wrap').style.display = 'none';
    document.getElementById('btn-random-text').innerText = "随机抽选";
    document.getElementById('random-title').innerText = "今天吃什么？";
    const panel = document.getElementById('random-filter-panel');
    if (panel) panel.style.display = 'none';
    syncRandomFilterUI();
    updateRandomSummary();
};

/**
 * 关闭随机抽选弹窗
 */
window.closeRandomPanel = () => {
    const layer = document.getElementById('layer-random');
    const panel = document.getElementById('random-filter-panel');
    if (layer) layer.classList.remove('open');
    if (panel) panel.style.display = 'none';
};

/**
 * 切换随机抽选筛选面板
 */
window.toggleRandomFilterPanel = () => {
    const panel = document.getElementById('random-filter-panel');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
    }
};

function syncRandomFilterUI() {
    const typeMap = {
        none: 'rf-opt-none',
        want: 'rf-opt-want',
        like: 'rf-opt-like',
        dislike: 'rf-opt-dislike'
    };
    Object.entries(typeMap).forEach(([type, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('selected', randomFilter.types.has(type));
    });
    syncRandomTypeIcons();
    document.querySelectorAll('.rf-pill.rf-dist-opt').forEach(p => p.classList.remove('selected'));
    if (randomFilter.distance) {
        const distEl = document.getElementById(`rf-dist-${randomFilter.distance}`);
        if (distEl) distEl.classList.add('selected');
    } else {
        const anyEl = document.getElementById('rf-dist-any');
        if (anyEl) anyEl.classList.add('selected');
    }
    const friendsEl = document.getElementById('rf-include-friends');
    if (friendsEl) friendsEl.checked = !!randomFilter.includeFriends;
    const pMin = document.getElementById('rf-price-min');
    const pMax = document.getElementById('rf-price-max');
    const dCustom = document.getElementById('rf-dist-custom');
    if (pMin) pMin.value = randomFilter.priceMin || '';
    if (pMax) pMax.value = randomFilter.priceMax || '';
    if (dCustom) dCustom.value = randomFilter.distCustom || '';
}

function syncRandomTypeIcons() {
    const iconMap = {
        want: { id: 'rf-opt-want', base: 'bookmark' },
        like: { id: 'rf-opt-like', base: 'like' },
        dislike: { id: 'rf-opt-dislike', base: 'dislike' }
    };
    Object.entries(iconMap).forEach(([type, conf]) => {
        const el = document.getElementById(conf.id);
        const img = el ? el.querySelector('img') : null;
        if (!img) return;
        const active = randomFilter.types.has(type);
        img.src = `images/${conf.base}-${active ? 'f' : 'g'}.svg`;
    });
}

/**
 * 切换随机抽选筛选选项
 * @param {Element} el - 被点击的选项元素  
 * @param {string} type - 选项类型
 */
window.toggleRfOption = (el, type) => {
    if (randomFilter.types.has(type)) {
        randomFilter.types.delete(type);
        el.classList.remove('selected');
    } else {
        randomFilter.types.add(type);
        el.classList.add('selected');
    }
    syncRandomTypeIcons();
};

/**
 * 切换距离选项（单选）
 */
window.toggleRfDistance = (el, dist) => {
    // 清除其他距离选中状态
    document.querySelectorAll('.rf-pill.rf-dist-opt').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    randomFilter.distCustom = '';
    const customInput = document.getElementById('rf-dist-custom');
    if (customInput) customInput.value = '';
    randomFilter.distance = dist;
};

/**
 * 保存筛选并更新摘要
 */
window.saveRandomFilter = () => {
    randomFilter.includeFriends = document.getElementById('rf-include-friends').checked;
    randomFilter.priceMin = (document.getElementById('rf-price-min')?.value || '').trim();
    randomFilter.priceMax = (document.getElementById('rf-price-max')?.value || '').trim();
    randomFilter.distCustom = (document.getElementById('rf-dist-custom')?.value || '').trim();
    if (randomFilter.distCustom) {
        const customNum = Number(randomFilter.distCustom);
        if (Number.isFinite(customNum) && customNum > 0) {
            randomFilter.distance = customNum;
            document.querySelectorAll('.rf-pill.rf-dist-opt').forEach(p => p.classList.remove('selected'));
        }
    } else {
        const hasPresetSelected = !!document.querySelector('.rf-pill.rf-dist-opt.selected');
        if (!hasPresetSelected) randomFilter.distance = null;
    }
    updateRandomSummary();
    toggleRandomFilterPanel();
};

/**
 * 更新随机抽选筛选摘要
 */
function updateRandomSummary() {
    const typeNames = {
        'none': '未收藏',
        'want': '想吃',
        'like': '好吃',
        'dislike': '难吃'
    };
    const selectedTypes = Array.from(randomFilter.types).map(t => typeNames[t] || t);
    let summary = '筛选：' + (selectedTypes.length > 0 ? selectedTypes.join('·') : '无');
    if (randomFilter.includeFriends) {
        summary += '(包含朋友收藏)';
    }
    document.getElementById('rf-summary-text').innerText = summary;
}

/**
 * 执行随机抽选
 */
window.doRandomPick = async () => {
    if (randomFilter.includeFriends && myFriends.length > 0 && !allUsersCache.length) {
        await ensureAllUsersLoaded();
    }
    const btn = document.getElementById('btn-do-random');
    const myAndFriendsFav = new Set(myFavIds);
    const myAndFriendsLike = new Set(Array.from(localLikes));
    const myAndFriendsDislike = new Set(Array.from(localDislikes));
    if (randomFilter.includeFriends && myFriends.length > 0) {
        allUsersCache
            .filter(u => myFriends.includes(u.id))
            .forEach(u => {
                (u.favorites || []).forEach(id => myAndFriendsFav.add(id));
                (u.likes || []).forEach(id => myAndFriendsLike.add(id));
                (u.dislikes || []).forEach(id => myAndFriendsDislike.add(id));
            });
    }

    const minPrice = Number(randomFilter.priceMin);
    const maxPrice = Number(randomFilter.priceMax);
    const hasMinPrice = Number.isFinite(minPrice) && minPrice >= 0 && String(randomFilter.priceMin).trim() !== '';
    const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice >= 0 && String(randomFilter.priceMax).trim() !== '';
    const maxDistance = Number(randomFilter.distance);
    const hasDistance = Number.isFinite(maxDistance) && maxDistance > 0;

    // 根据筛选条件过滤店铺
    const pool = localStores.filter(s => {
        if (isStorePermanentlyClosed(s)) return false;
        const isFav = myAndFriendsFav.has(s.id);
        const isLike = myAndFriendsLike.has(s.id);
        const isDislike = myAndFriendsDislike.has(s.id);
        const isNone = !isFav && !isLike && !isDislike;  // 未收藏

        let typeMatch = false;
        if (randomFilter.types.has('want') && isFav) typeMatch = true;
        if (randomFilter.types.has('like') && isLike) typeMatch = true;
        if (randomFilter.types.has('dislike') && isDislike) typeMatch = true;
        if (randomFilter.types.has('none') && isNone) typeMatch = true;
        if (!typeMatch) return false;

        const budgetRaw = Number(String(s.budget ?? '').replace(/[^\d.]/g, ''));
        const hasBudget = Number.isFinite(budgetRaw) && budgetRaw > 0;
        if (hasMinPrice && (!hasBudget || budgetRaw < minPrice)) return false;
        if (hasMaxPrice && (!hasBudget || budgetRaw > maxPrice)) return false;

        const distRaw = Number(getStoreLinearDistanceMeters(s));
        const hasStoreDist = Number.isFinite(distRaw) && distRaw > 0;
        if (hasDistance && (!hasStoreDist || distRaw > maxDistance)) return false;

        return true;
    });

    if (pool.length === 0) return alert("没有符合条件的店铺，请调整筛选！");

    btn.innerHTML = `<div class="spinner"></div> 抽选中...`;

    // 动画效果：快速切换显示问号变化
    let step = 0;
    const maxSteps = 12;
    const emptyBox = document.getElementById('random-state-empty');
    emptyBox.style.display = 'flex';
    document.getElementById('random-result-wrap').style.display = 'none';

    const interval = setInterval(() => {
        step++;
        // 动画期间保持显示问号，添加摇动效果
        emptyBox.innerHTML = `<span class="big-question-mark" style="animation: shake 0.1s ease;">?</span>`;

        if (step > maxSteps) {
            clearInterval(interval);
            // 最终选中
            const winner = pool[Math.floor(Math.random() * pool.length)];
            renderRandomResult(winner);

            document.getElementById('random-state-empty').style.display = 'none';
            document.getElementById('random-result-wrap').style.display = 'block';
            document.getElementById('random-title').innerText = "今天吃这个";
            btn.innerHTML = `🎲<span>再次随机</span>`;
        }
    }, 80);
};

/**
 * 渲染随机抽选结果
 * @param {Object} s - 被选中的店铺
 */
function renderRandomResult(s) {
    const container = document.getElementById('random-result-wrap');

    const isFav = myFavIds.includes(s.id);
    const isLiked = localLikes.has(s.id);
    const isDisliked = localDislikes.has(s.id);

    let statusClass = "";
    if (isDisliked) statusClass = "status-disliked";
    else if (isLiked) statusClass = "status-liked";
    else if (isFav) statusClass = "status-fav";

    const cardIndex = Math.max(0, localStores.findIndex(x => x.id === s.id));
    const avgRating = getStoreAverageRating(s);
    const reviewCount = getStoreReviewCount(s);
    const rawImgs = getStorePreviewImageEntries(s);
    const displayImgs = rawImgs.length ? rawImgs : ["https://placehold.co/200?text=No+Image"];
    const imagesHtml = displayImgs.map(src =>
        `<img src="${getImageAssetThumbUrl(src)}" class="store-img-item" loading="lazy" decoding="async">`
    ).join('');

    container.innerHTML = `
    <div class="store-card ${statusClass}" data-store-id="${s.id}" onclick="openDetail('${s.id}')" style="margin:0;">
        <div class="card-header-row">
            <div class="info-col">
                <div class="store-name-row">
                    <h3 class="store-name">${renderStoreNameWithStatus(s)}</h3>
                    <div onclick="toggleFav('${s.id}'); event.stopPropagation();">
                        <img src="${isFav ? 'images/bookmark-f.svg' : 'images/bookmark.svg'}"
                             class="bookmark-icon-btn"
                             alt="want">
                    </div>
                </div>
                <div class="store-meta">
                     ${avgRating.toFixed(1)} <span class="rating-star" style="display:inline-flex;align-items:center;"><img src="images/pingfen.svg" style="width:12px;"></span>
                     <span>(${reviewCount})</span>
                     <span style="margin:0 4px">•</span> 
                    <img src="images/walk.svg" style="width:10px; margin-right:3px;">
                     ${formatStoreDistanceText(s)}
                </div>
            </div>
            ${renderStoreActionGroup(s.id, isLiked, isDisliked, cardIndex)}
        </div>
        <div class="store-img-scroll">${imagesHtml}</div>
    </div>`;
    lucide.createIcons();
}

/**
 * 更新详情页收藏按钮状态
 */
function updateDetailFavBtn(id) {
    const btn = document.getElementById('fd-btn-fav');
    const isFav = myFavIds.includes(id);
    if (isFav) {
        btn.style.background = "#ffce00";
        btn.style.color = "#2d3436";
        btn.innerHTML = `<i data-lucide="bookmark" width="18" fill="currentColor"></i> 已想吃`;
    } else {
        btn.style.background = "#f0f0f0";
        btn.style.color = "#2d3436";
        btn.innerHTML = `<i data-lucide="bookmark" width="18"></i> 收藏(想吃)`;
    }
    lucide.createIcons();
}

/**
 * 从详情页切换收藏状态
 */
window.toggleFavFromDetail = async () => {
    if (!currentDetailId) return;
    await toggleFav(currentDetailId);
    updateDetailFavBtn(currentDetailId);
};

// ==========================================
// 初始化 Lucide 图标
// ==========================================
lucide.createIcons();

/* =========================================
   16. 个人页面逻辑
   动态 / 收藏 标签切换
   ========================================= */

let currentProfileFavTab = 'want';

function isViewingFriendProfile() {
    return !!(viewingFriendUid && viewingFriendUid !== (currentUser && currentUser.uid));
}

function updateProfileHeaderMode() {
    const isFriendMode = isViewingFriendProfile();
    const menuBtn = document.querySelector('.profile-menu-btn');
    const menu = document.getElementById('profile-menu');
    const backBtn = document.getElementById('profile-back-btn');
    const rightBox = document.querySelector('.profile-header-right');
    const avatarWrap = document.querySelector('.profile-avatar-wrap');
    const avatarCamera = document.querySelector('.profile-avatar-camera');
    const avatarInput = document.getElementById('avatar-file-input');
    const friendBtn = document.getElementById('profile-friend-action-btn');
    const editNameBtn = document.getElementById('profile-edit-name-btn');

    if (menuBtn) menuBtn.classList.toggle('hidden', isFriendMode);
    if (menu && isFriendMode) menu.classList.remove('open');
    if (backBtn) backBtn.classList.toggle('hidden', !isFriendMode);
    if (rightBox) rightBox.classList.toggle('hidden', isFriendMode);
    if (avatarWrap) {
        avatarWrap.style.cursor = isFriendMode ? 'default' : 'pointer';
        avatarWrap.onclick = isFriendMode ? null : () => avatarInput?.click();
    }
    if (avatarCamera) avatarCamera.classList.toggle('hidden', isFriendMode);
    if (friendBtn) friendBtn.classList.toggle('hidden', !isFriendMode);
    if (editNameBtn) editNameBtn.classList.toggle('hidden', isFriendMode);
}

function updateFriendActionButton() {
    const btn = document.getElementById('profile-friend-action-btn');
    if (!btn || !isViewingFriendProfile()) return;
    const targetUid = viewingFriendUid;
    const pendingReq = incomingFriendRequests.find(r => r.fromUid === targetUid && r.status === 'pending');
    const isFriend = myFriends.includes(targetUid);
    const isPending = mySentFriendRequests.includes(targetUid);

    btn.onclick = null;
    btn.classList.remove('disabled');

    if (isFriend) {
        btn.innerText = '已添加好友';
        btn.classList.add('disabled');
    } else if (pendingReq) {
        btn.innerText = '通过好友申请';
        btn.onclick = () => acceptFriendRequest(pendingReq.id, targetUid);
    } else if (isPending) {
        btn.innerText = '已发送好友申请';
        btn.classList.add('disabled');
    } else {
        btn.innerText = '发送好友申请';
        btn.onclick = () => addFriend(targetUid);
    }
}

function setProfileIdentity(name, avatarUrl) {
    const nameEl = document.getElementById('profile-username');
    const avatarImg = document.getElementById('profile-avatar-display');
    if (nameEl) nameEl.innerText = name || '用户';
    if (avatarImg) avatarImg.src = avatarUrl || 'images/Group 48.png';
}

window.editUsername = () => {
    if (!currentUser || isViewingFriendProfile()) return;
    const modal = document.getElementById('modal-edit-username');
    const input = document.getElementById('edit-username-input');
    if (!modal || !input) return;
    const currentName = (currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '')).trim();
    input.value = currentName;
    modal.classList.add('open');
    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmEditUsername();
        }
    };
};

window.closeEditUsernameModal = () => {
    const modal = document.getElementById('modal-edit-username');
    if (modal) modal.classList.remove('open');
};

window.confirmEditUsername = async () => {
    if (!currentUser || isViewingFriendProfile()) return;
    const input = document.getElementById('edit-username-input');
    if (!input) return;
    const currentName = (currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '')).trim();
    const nextName = String(input.value || '').trim();
    if (!nextName || nextName === currentName) {
        closeEditUsernameModal();
        return;
    }
    if (nextName.length > 28) {
        alert("用户名最多 28 个字符");
        return;
    }
    try {
        await updateProfile(currentUser, { displayName: nextName });
        await setDoc(doc(db, "users", currentUser.uid), {
            email: currentUser.email || "",
            displayName: nextName
        }, { merge: true });
        await setDoc(doc(db, "publicUsers", currentUser.uid), {
            email: currentUser.email || "",
            displayName: nextName
        }, { merge: true });
        setProfileIdentity(nextName, currentUser.photoURL || '');
        closeEditUsernameModal();
    } catch (err) {
        console.error("修改用户名失败:", err);
        alert("修改用户名失败: " + err.message);
    }
};

/**
 * 切换个人页标签（动态 / 收藏）
 * @param {string} tab - 'activity' 或 'favorites'
 */
window.switchProfileTab = (tab) => {
    updateProfileHeaderMode();
    if (isViewingFriendProfile()) updateFriendActionButton();

    // 更新标签样式
    document.getElementById('profile-tab-activity').classList.toggle('active', tab === 'activity');
    document.getElementById('profile-tab-favorites').classList.toggle('active', tab === 'favorites');

    // 移动指示器
    const indicator = document.getElementById('profile-tab-indicator');
    if (tab === 'favorites') {
        indicator.style.transform = 'translateX(100%)';
    } else {
        indicator.style.transform = 'translateX(0)';
    }

    // 切换内容
    document.getElementById('profile-content-activity').style.display = tab === 'activity' ? 'block' : 'none';
    document.getElementById('profile-content-favorites').style.display = tab === 'favorites' ? 'flex' : 'none';

    // 渲染对应内容
    if (tab === 'activity') {
        renderProfileActivity();
    } else {
        renderProfileFavorites();
    }
};

/**
 * 渲染个人页动态列表
 */
function renderProfileActivity() {
    const container = document.getElementById('profile-activity-list');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#ccc;">请先登录</div>`;
        return;
    }
    const activities = isViewingFriendProfile()
        ? buildActivitiesForUser(viewingFriendUid, viewingFriendData || {})
        : buildMyActivities();

    if (!activities.length) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#ccc;">暂无动态</div>`;
        return;
    }
    renderActivityCards(container, activities);
}

function getCurrentUserAliases() {
    const aliases = new Set();
    if (!currentUser) return aliases;
    if (currentUser.uid) aliases.add(String(currentUser.uid).toLowerCase());
    if (currentUser.email) aliases.add(String(currentUser.email).toLowerCase());
    if (currentUser.email && currentUser.email.includes('@')) {
        aliases.add(currentUser.email.split('@')[0].toLowerCase());
    }
    if (currentUser.displayName) aliases.add(String(currentUser.displayName).toLowerCase());
    return aliases;
}

function isReviewMine(rev, aliases) {
    if (!rev || typeof rev !== 'object') return false;
    const uid = rev.uid ? String(rev.uid).toLowerCase() : '';
    const user = rev.user ? String(rev.user).toLowerCase() : '';
    return (uid && aliases.has(uid)) || (user && aliases.has(user));
}

function getDayKeyFromTs(ts) {
    const d = new Date(Number(ts) || Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function buildMyActivities() {
    if (!currentUser) return [];
    return buildActivitiesForUser(currentUser.uid, {
        email: currentUser.email || '',
        displayName: currentUser.displayName || ''
    });
}

function buildActivitiesForUser(uid, userData = null) {
    if (!uid) return [];
    const aliases = uid === (currentUser && currentUser.uid)
        ? getCurrentUserAliases()
        : getAliasesForUid(uid, userData);
    const storeVisitCounts = new Map();

    localStores.forEach(store => {
        const revs = Array.isArray(store.revs) ? store.revs : [];
        const mineCount = revs.filter(rev => isReviewMine(rev, aliases)).length;
        if (mineCount > 0) storeVisitCounts.set(store.id, mineCount);
    });

    const activities = [];
    localStores.forEach(store => {
        const revs = Array.isArray(store.revs) ? store.revs : [];
        revs.forEach((rev) => {
            if (!isReviewMine(rev, aliases)) return;
            const createdAt = Number(rev.createdAt) || Number(store.createdAt) || Date.now();
            const reviewText = typeof rev.text === 'string' ? rev.text.trim() : '';
            const reviewImages = Array.isArray(rev.images) ? rev.images.filter(Boolean) : [];
            const ratingNum = Number(rev.rating || store.rating || 0);
            const budgetNum = Number(rev.budget || store.budget || 0);
            const dayKey = getDayKeyFromTs(createdAt);
            activities.push({
                store,
                storeId: store.id,
                createdAt,
                dayKey,
                dateMeta: formatActivityDate(createdAt),
                visits: storeVisitCounts.get(store.id) || 1,
                reviewIndex: revs.indexOf(rev),
                rating: Number.isFinite(ratingNum) ? ratingNum.toFixed(1) : '0.0',
                review: reviewText,
                images: reviewImages,
                budget: Number.isFinite(budgetNum) ? budgetNum : 0
            });
        });
    });
    activities.sort((a, b) => b.createdAt - a.createdAt);
    return activities;
}

/**
 * 渲染动态卡片列表
 */
function renderActivityCards(container, activities) {
    container.innerHTML = activities.map(a => {
        if (!a.store) return '';
        const s = a.store;
        const canDelete = !!currentUser && !isViewingFriendProfile() && Number.isInteger(a.reviewIndex) && a.reviewIndex >= 0;
        const deleteBtn = canDelete
            ? `<button class="review-delete-btn activity-delete-btn" onclick="deleteMyStoreReview('${s.id}', ${a.reviewIndex}); event.stopPropagation();">删除</button>`
            : '';

        // 生成星星评分 (使用emoji)
        const rating = parseFloat(a.rating) || 0;
        const fullStars = Math.floor(rating);
        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                starsHtml += `<img src="images/pingfen.svg" style="width:14px;">`;
            } else {
                starsHtml += `<img src="images/pingfen.svg" style="width:14px; opacity:0.3;">`;
            }
        }

        // 图片缩略图
        let photosHtml = '';
        if (a.images && a.images.length) {
            const galleryEntries = a.images.slice(0, 5);
            const galleryImages = galleryEntries.map(getImageAssetFullUrl).filter(Boolean);
            const galleryKey = window.registerActivityImageGallery(galleryImages);
            photosHtml = `<div class="activity-photos">${galleryEntries.map((entry, index) => {
                const fullSrc = getImageAssetFullUrl(entry);
                const thumbSrc = getImageAssetThumbUrl(entry);
                if (!fullSrc || !thumbSrc) return '';
                return `<img src="${thumbSrc.replace(/"/g, '&quot;')}" class="activity-photo-thumb" loading="lazy" decoding="async" onclick="openActivityImageModal('${fullSrc.replace(/'/g, "\\'")}', '${a.dayKey || ''}', '${galleryKey}', ${index}); event.stopPropagation();">`;
            }).join('')}</div>`;
        }

        // 评论文字
        const reviewHtml = a.review
            ? renderExpandableReviewText(a.review, {
                textClassName: 'activity-review-text',
                wrapperClassName: 'activity-review-block'
            })
            : '';

        return `
        <div class="activity-card ${a.dateMeta.isToday ? 'today' : ''}">
            <div class="activity-card-top">
                <div class="activity-date">${a.dateMeta.label}</div>
                ${deleteBtn}
            </div>
            <div class="activity-store-row">
                <div class="activity-store-name" onclick="openDetail('${s.id}', { mode: 'full', fromMap: false }); event.stopPropagation();">
                    <span class="activity-store-title">${s.name}</span>
                    <span class="activity-visit-count">（吃过${a.visits}次）</span>
                </div>
            </div>
            <div class="activity-rating-row">
                <span class="activity-score">${a.rating}</span>
                <div class="activity-stars">${starsHtml}</div>
            </div>
            ${reviewHtml}
            ${photosHtml}
        </div>`;
    }).join('');
}

function formatActivityDate(ts) {
    const d = new Date(Number(ts) || Date.now());
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');

    if (startOfTarget === startOfToday) {
        return { label: `今天 ${hh}:${mm}`, isToday: true };
    }
    if (startOfTarget === startOfToday - oneDay) {
        return { label: `昨天 ${hh}:${mm}`, isToday: false };
    }
    return {
        label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
        isToday: false
    };
}

function formatRecordDateTitle(dayKey) {
    const [y, m, d] = String(dayKey || '').split('-');
    if (!y || !m || !d) return dayKey || '';
    return `${y}年${Number(m)}月${Number(d)}日`;
}

function getMainImageForDay(dayKey) {
    return recordMainImageByDay?.[dayKey] || "";
}

function setMainImageForDay(dayKey, src) {
    if (!dayKey || !src) return;
    recordMainImageByDay[dayKey] = src;
    saveRecordMainImageMap();
}

function getPrimaryImageForDay(dayActs) {
    if (!Array.isArray(dayActs) || !dayActs.length) return '';
    const main = getMainImageForDay(dayActs[0].dayKey);
    if (main && dayActs.some(a => Array.isArray(a.images) && a.images.some((entry) => getImageAssetFullUrl(entry) === main))) {
        return main;
    }
    for (const a of dayActs) {
        const src = Array.isArray(a.images) ? getImageAssetThumbUrl(a.images[0]) : '';
        if (src) return src;
    }
    return '';
}

function getRecordActivitiesByDay(activities) {
    const dayMap = new Map();
    activities.forEach(a => {
        if (!dayMap.has(a.dayKey)) dayMap.set(a.dayKey, []);
        dayMap.get(a.dayKey).push(a);
    });
    dayMap.forEach(list => list.sort((x, y) => x.createdAt - y.createdAt));
    return dayMap;
}

function normalizeActivityImageGallery(images) {
    return Array.from(new Set((Array.isArray(images) ? images : []).filter(Boolean).map(src => String(src))));
}

window.registerActivityImageGallery = (images) => {
    const normalized = normalizeActivityImageGallery(images);
    if (!normalized.length) return "";
    if (activityImageGalleryRegistry.size > 800) activityImageGalleryRegistry.clear();
    activityImageGallerySeed += 1;
    const key = `gallery-${activityImageGallerySeed}`;
    activityImageGalleryRegistry.set(key, normalized);
    return key;
};

function resolveActivityImageGallery(galleryKey, fallbackSrc = "") {
    const images = normalizeActivityImageGallery(activityImageGalleryRegistry.get(String(galleryKey || "")));
    if (images.length) return images;
    return fallbackSrc ? [String(fallbackSrc)] : [];
}

function getActivityImageModalElements() {
    return {
        modal: document.getElementById('activity-image-modal'),
        stage: document.getElementById('activity-image-stage'),
        track: document.getElementById('activity-image-track'),
        img: document.getElementById('activity-image-modal-img'),
        prevImg: document.getElementById('activity-image-modal-img-prev'),
        nextImg: document.getElementById('activity-image-modal-img-next'),
        pinIcon: document.getElementById('activity-main-pin-icon'),
        pinLabel: document.getElementById('activity-main-pin-label'),
        setMainBtn: document.getElementById('activity-set-main-btn'),
        state: document.getElementById('activity-main-state'),
        tools: document.getElementById('activity-image-tools'),
        counter: document.getElementById('activity-image-counter')
    };
}

function setActivityImagePanelSource(img, src) {
    if (!img) return;
    if (src) {
        img.src = src;
        img.style.visibility = 'visible';
    } else {
        img.src = '';
        img.style.visibility = 'hidden';
    }
}

function getActivityImageSlideWidth() {
    const stage = document.getElementById('activity-image-stage');
    return Math.round(stage?.clientWidth || 0);
}

function setActivityImageTrackOffset(offsetX) {
    const track = document.getElementById('activity-image-track');
    if (!track) return;
    activityImageTrackOffsetX = Number(offsetX) || 0;
    track.style.transform = `translateX(${activityImageTrackOffsetX}px)`;
}

function resetActivityImageTrackPosition() {
    const track = document.getElementById('activity-image-track');
    if (!track) return;
    track.style.transition = 'none';
    setActivityImageTrackOffset(0);
}

function animateActivityImageTrackTo(targetOffset, transition, onComplete = null) {
    const track = document.getElementById('activity-image-track');
    if (!track) {
        if (typeof onComplete === 'function') onComplete();
        return;
    }
    let finished = false;
    let timeoutId = null;
    const cleanup = () => {
        track.removeEventListener('transitionend', handleTransitionEnd);
        if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    const finish = () => {
        if (finished) return;
        finished = true;
        cleanup();
        if (typeof onComplete === 'function') onComplete();
    };
    const handleTransitionEnd = (event) => {
        if (event.target !== track || event.propertyName !== 'transform') return;
        finish();
    };
    track.addEventListener('transitionend', handleTransitionEnd);
    timeoutId = window.setTimeout(finish, 420);
    track.style.transition = transition;
    requestAnimationFrame(() => setActivityImageTrackOffset(targetOffset));
}

function syncActivityImageModalImage() {
    const {
        img,
        prevImg,
        nextImg,
        modal,
        pinIcon,
        pinLabel,
        setMainBtn,
        state,
        tools,
        counter
    } = getActivityImageModalElements();
    if (!img || !modal) return;

    const src = currentImageModalGallery[currentImageModalIndex] || "";
    const prevSrc = currentImageModalIndex > 0 ? currentImageModalGallery[currentImageModalIndex - 1] : "";
    const nextSrc = currentImageModalIndex < currentImageModalGallery.length - 1 ? currentImageModalGallery[currentImageModalIndex + 1] : "";
    currentImageModalSrc = src;
    setActivityImagePanelSource(prevImg, prevSrc);
    setActivityImagePanelSource(img, src);
    setActivityImagePanelSource(nextImg, nextSrc);
    resetActivityImageTrackPosition();

    const canSetMain = !!(currentImageModalDateKey && currentUser && !isViewingFriendProfile());
    if (tools) tools.classList.toggle('hidden', !canSetMain);
    if (pinIcon && pinLabel && state && canSetMain) {
        const isMain = getMainImageForDay(currentImageModalDateKey) === src;
        pinIcon.src = isMain ? 'images/main-f.svg' : 'images/main.svg';
        pinLabel.innerText = '设为今日主图';
        if (setMainBtn) setMainBtn.classList.toggle('hidden', isMain);
        state.classList.toggle('hidden', !isMain);
    } else if (setMainBtn && state) {
        setMainBtn.classList.remove('hidden');
        state.classList.add('hidden');
    }

    if (counter) {
        const total = currentImageModalGallery.length;
        counter.classList.toggle('hidden', total <= 1);
        counter.innerText = total > 1 ? `${currentImageModalIndex + 1} / ${total}` : '';
    }

    const alignOverlay = () => positionActivityImageOverlay();
    img.onload = alignOverlay;
    if (modal.classList.contains('open')) requestAnimationFrame(alignOverlay);
}

function commitActivityImageModalStep(step) {
    const total = currentImageModalGallery.length;
    if (total <= 1) return false;
    const nextIndex = currentImageModalIndex + Number(step || 0);
    if (nextIndex < 0 || nextIndex >= total) return false;
    currentImageModalIndex = nextIndex;
    resetActivityImageZoom();
    syncActivityImageModalImage();
    return true;
}

function finishActivityImageSwipe(deltaX) {
    const slideWidth = getActivityImageSlideWidth();
    if (!slideWidth) {
        if (Math.abs(deltaX) >= 48) return commitActivityImageModalStep(deltaX < 0 ? 1 : -1);
        resetActivityImageTrackPosition();
        return false;
    }

    const threshold = slideWidth * 0.18;
    let step = 0;
    if (deltaX <= -threshold && currentImageModalIndex < currentImageModalGallery.length - 1) step = 1;
    else if (deltaX >= threshold && currentImageModalIndex > 0) step = -1;

    if (!step) {
        activityImageTrackAnimating = true;
        animateActivityImageTrackTo(0, 'transform 0.22s ease', () => {
            resetActivityImageTrackPosition();
            activityImageTrackAnimating = false;
        });
        return false;
    }

    activityImageTrackAnimating = true;
    animateActivityImageTrackTo(step > 0 ? -slideWidth : slideWidth, 'transform 0.28s ease', () => {
        commitActivityImageModalStep(step);
        activityImageTrackAnimating = false;
    });
    return true;
}

function animateActivityImageModalStep(step) {
    if (!step || activityImageTrackAnimating) return false;
    if (activityImageZoomed) {
        resetActivityImageZoom();
    }
    const slideWidth = getActivityImageSlideWidth();
    if (!slideWidth) return commitActivityImageModalStep(step);
    const nextIndex = currentImageModalIndex + step;
    if (nextIndex < 0 || nextIndex >= currentImageModalGallery.length) return false;
    activityImageTrackAnimating = true;
    animateActivityImageTrackTo(step > 0 ? -slideWidth : slideWidth, 'transform 0.28s ease', () => {
        commitActivityImageModalStep(step);
        activityImageTrackAnimating = false;
    });
    return true;
}

window.navigateActivityImageModal = (direction) => {
    if (direction === 'prev') return animateActivityImageModalStep(-1);
    if (direction === 'next') return animateActivityImageModalStep(1);
    return false;
};

window.renderRecordCalendar = () => {
    const wrap = document.getElementById('record-calendar-wrap');
    const yearSelect = document.getElementById('record-year-select');
    const dayView = document.getElementById('record-day-view');
    const yearRow = yearSelect ? yearSelect.closest('.record-year-row') : null;
    const recordPage = document.querySelector('#view-fav .record-page');
    if (!wrap || !yearSelect) return;
    if (dayView) dayView.classList.add('hidden');

    if (!currentUser) {
        if (yearRow) yearRow.classList.add('hidden');
        if (recordPage) recordPage.classList.add('record-page-guest');
        wrap.classList.add('record-auth-wrap');
        wrap.innerHTML = `
            <div class="record-auth-mask auth-mask-card">
                <i data-lucide="lock" style="color:#b2bec3; width:40px; height:40px; margin-bottom:16px;"></i>
                <p>请先登录后查看记录</p>
                <button onclick="switchView('profile')" class="btn-submit"
                    style="width:auto; margin:0 auto; padding:10px 30px;">去登录</button>
            </div>
        `;
        yearSelect.innerHTML = "";
        lucide.createIcons();
        return;
    }
    if (yearRow) yearRow.classList.remove('hidden');
    if (recordPage) recordPage.classList.remove('record-page-guest');
    wrap.classList.remove('record-auth-wrap');

    const activities = buildMyActivities();
    const dayMap = getRecordActivitiesByDay(activities);
    const currentYear = new Date().getFullYear();
    const activityYears = Array.from(new Set(activities.map(a => new Date(a.createdAt).getFullYear())));
    const minYear = Math.min(currentYear - 1, ...(activityYears.length ? activityYears : [currentYear]));
    const maxYear = Math.max(currentYear + 1, ...(activityYears.length ? activityYears : [currentYear]));
    const years = [];
    for (let y = maxYear; y >= minYear; y--) years.push(y);
    const prevYear = Number(yearSelect.value || currentYear);
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    const selectedYear = recordAutoFocusPending
        ? currentYear
        : (years.includes(prevYear) ? prevYear : years[0]);
    yearSelect.value = String(selectedYear);

    const uniqueMonths = Array.from({ length: 12 }, (_, i) => i + 1);

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDate = now.getDate();
    wrap.innerHTML = uniqueMonths.map(month => {
        const first = new Date(selectedYear, month - 1, 1);
        const daysInMonth = new Date(selectedYear, month, 0).getDate();
        const startWeekDay = first.getDay();
        const cells = [];
        for (let i = 0; i < startWeekDay; i++) cells.push(`<div class="record-day-cell empty"></div>`);

        for (let day = 1; day <= daysInMonth; day++) {
            const dayKey = `${selectedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayActs = dayMap.get(dayKey) || [];
            const primaryImg = getPrimaryImageForDay(dayActs);
            const daySpend = dayActs.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
            const dayRecordCount = dayActs.length;
            const isToday = selectedYear === todayYear && month === todayMonth && day === todayDate;
            cells.push(`
                <button class="record-day-cell ${dayActs.length ? 'has-data' : ''} ${isToday ? 'is-today' : ''}" ${dayActs.length ? `onclick="openRecordDayView('${dayKey}')"` : 'disabled'}>
                    <div class="record-day-thumb">
                        ${primaryImg ? `<img src="${primaryImg}" alt="day-thumb">` : ''}
                        ${dayRecordCount > 0 ? `<span class="record-day-count-badge">${dayRecordCount}</span>` : ''}
                    </div>
                    <div class="record-day-meta">
                        <span>${day}</span>
                        ${daySpend > 0 ? `<span class="record-day-cost">-${daySpend}</span>` : ''}
                    </div>
                </button>
            `);
        }

        const monthTotal = Array.from(dayMap.entries())
            .filter(([k]) => Number(k.slice(0, 4)) === selectedYear && Number(k.slice(5, 7)) === month)
            .reduce((sum, [, list]) => sum + list.reduce((s, a) => s + (Number(a.budget) || 0), 0), 0);

        return `
            <div class="record-month-block" data-record-month="${month}">
                <div class="record-month-head">
                    <h3>${month}月</h3>
                    <div>总花费: <b>${monthTotal || 0}</b></div>
                </div>
                <div class="record-week-head">
                    <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
                </div>
                <div class="record-grid">${cells.join('')}</div>
            </div>
        `;
    }).join('');

    if (recordAutoFocusPending && selectedYear === todayYear) {
        const target = wrap.querySelector(`[data-record-month="${todayMonth}"]`);
        if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    recordAutoFocusPending = false;
};

window.openRecordDayView = (dayKey) => {
    const activities = buildMyActivities();
    const dayActs = activities.filter(a => a.dayKey === dayKey).sort((a, b) => a.createdAt - b.createdAt);
    const view = document.getElementById('record-day-view');
    const favView = document.getElementById('view-fav');
    const list = document.getElementById('record-day-list');
    const title = document.getElementById('record-day-title');
    if (!view || !list || !title) return;

    currentRecordDayKey = dayKey;
    title.innerText = formatRecordDateTitle(dayKey);
    list.innerHTML = dayActs.length ? dayActs.map(a => {
        const d = new Date(a.createdAt);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const galleryEntries = (a.images || []).slice(0, 5);
        const galleryImages = galleryEntries.map(getImageAssetFullUrl).filter(Boolean);
        const galleryKey = window.registerActivityImageGallery(galleryImages);
        const photos = galleryEntries.map((entry, index) => {
            const fullSrc = getImageAssetFullUrl(entry);
            const thumbSrc = getImageAssetThumbUrl(entry);
            if (!fullSrc || !thumbSrc) return '';
            return `
            <div class="record-photo-item" onclick="openActivityImageModal('${fullSrc.replace(/'/g, "\\'")}', '${dayKey}', '${galleryKey}', ${index}); event.stopPropagation();">
                <img src="${thumbSrc.replace(/"/g, '&quot;')}" loading="lazy" decoding="async" alt="photo">
            </div>
        `;
        }).join('');
        const deleteBtn = Number.isInteger(a.reviewIndex) && a.reviewIndex >= 0
            ? `<button class="review-delete-btn activity-delete-btn" onclick="deleteMyStoreReview('${a.storeId}', ${a.reviewIndex}); event.stopPropagation();">删除</button>`
            : '';
        return `
            <div class="record-day-card">
                <div class="record-day-head">
                    <div class="record-day-time">${formatRecordDateTitle(dayKey)} ${hh}:${mm}</div>
                    ${deleteBtn}
                </div>
                <div class="record-day-store" onclick="openDetail('${a.storeId}', { mode: 'full', fromMap: false }); event.stopPropagation();">${a.store?.name || '店铺'} <span>（吃过${a.visits}次）</span></div>
                <div class="record-day-rating">
                    <span>${a.rating}</span>
                    <div class="record-day-mogu">${renderSimpleRatingIcons(Number(a.rating || 0))}</div>
                    ${(a.budget && Number(a.budget) > 0) ? `<em>花费: ${a.budget}</em>` : ''}
                </div>
                ${a.review ? renderExpandableReviewText(a.review, {
            textClassName: 'record-day-review',
            wrapperClassName: 'record-day-review-block'
        }) : ''}
                ${photos ? `<div class="record-day-photos">${photos}</div>` : ''}
            </div>
        `;
    }).join('') : `<div class="record-empty">当天暂无记录</div>`;
    if (recordDayViewHideTimer) {
        clearTimeout(recordDayViewHideTimer);
        recordDayViewHideTimer = null;
    }
    view.classList.remove('hidden');
    view.classList.remove('is-open');
    if (favView) favView.classList.remove('record-day-active');
    requestAnimationFrame(() => {
        if (favView) favView.classList.add('record-day-active');
        view.classList.add('is-open');
    });
};

window.closeRecordDayView = () => {
    const view = document.getElementById('record-day-view');
    const favView = document.getElementById('view-fav');
    if (!view) return;
    view.classList.remove('is-open');
    if (favView) favView.classList.remove('record-day-active');
    if (recordDayViewHideTimer) clearTimeout(recordDayViewHideTimer);
    recordDayViewHideTimer = setTimeout(() => {
        view.classList.add('hidden');
        recordDayViewHideTimer = null;
    }, 260);
    currentRecordDayKey = "";
};

function renderSimpleRatingIcons(score) {
    const n = getFilledRatingIconCount(score);
    return Array.from({ length: 5 }).map((_, i) =>
        `<img src="images/mogu.svg" style="width:13px; opacity:${i < n ? 1 : 0.26};">`
    ).join('');
}

window.openActivityImageModal = (src, dayKey = "", galleryKey = "", startIndex = -1) => {
    if (!src) return;
    const modal = document.getElementById('activity-image-modal');
    const img = document.getElementById('activity-image-modal-img');
    if (!modal || !img) return;
    currentImageModalDateKey = dayKey || currentRecordDayKey || "";
    currentImageModalGallery = resolveActivityImageGallery(galleryKey, src);
    const srcIndex = currentImageModalGallery.indexOf(String(src));
    currentImageModalIndex = Number.isInteger(startIndex) && startIndex >= 0
        ? Math.min(currentImageModalGallery.length - 1, startIndex)
        : (srcIndex >= 0 ? srcIndex : 0);
    resetActivityImageZoom();
    modal.classList.add('open');
    syncActivityImageModalImage();
};

window.closeActivityImageModal = () => {
    const modal = document.getElementById('activity-image-modal');
    const img = document.getElementById('activity-image-modal-img');
    const prevImg = document.getElementById('activity-image-modal-img-prev');
    const nextImg = document.getElementById('activity-image-modal-img-next');
    const counter = document.getElementById('activity-image-counter');
    if (!modal || !img) return;
    clearPendingActivityImageModalClose();
    resetActivityImageZoom();
    modal.classList.remove('open');
    img.src = '';
    if (prevImg) prevImg.src = '';
    if (nextImg) nextImg.src = '';
    img.onload = null;
    if (counter) {
        counter.innerText = '';
        counter.classList.add('hidden');
    }
    currentImageModalDateKey = "";
    currentImageModalSrc = "";
    currentImageModalGallery = [];
    currentImageModalIndex = 0;
};

let activityImageModalCloseTimer = null;
let activityImageZoomed = false;
let activityImageTrackOffsetX = 0;
let activityImageTrackAnimating = false;
let activityImageTouchGesture = {
    startDistance: 0,
    startScale: 1,
    active: false,
    skipTapClose: false,
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
    swipeActive: false,
    mouseActive: false
};

function clearActivityImageMouseDragListeners() {
    window.removeEventListener('mousemove', window.handleActivityImageMouseMove);
    window.removeEventListener('mouseup', window.handleActivityImageMouseUp);
}

function clearPendingActivityImageModalClose() {
    if (!activityImageModalCloseTimer) return;
    clearTimeout(activityImageModalCloseTimer);
    activityImageModalCloseTimer = null;
}

function scheduleActivityImageModalClose() {
    clearPendingActivityImageModalClose();
    activityImageModalCloseTimer = setTimeout(() => {
        activityImageModalCloseTimer = null;
        closeActivityImageModal();
    }, 220);
}

function resetActivityImageZoom() {
    const img = document.getElementById('activity-image-modal-img');
    activityImageZoomed = false;
    activityImageTrackAnimating = false;
    activityImageTouchGesture.startDistance = 0;
    activityImageTouchGesture.startScale = 1;
    activityImageTouchGesture.active = false;
    activityImageTouchGesture.skipTapClose = false;
    activityImageTouchGesture.startX = 0;
    activityImageTouchGesture.startY = 0;
    activityImageTouchGesture.deltaX = 0;
    activityImageTouchGesture.deltaY = 0;
    activityImageTouchGesture.swipeActive = false;
    activityImageTouchGesture.mouseActive = false;
    clearActivityImageMouseDragListeners();
    document.body.style.cursor = '';
    resetActivityImageTrackPosition();
    if (!img) return;
    img.classList.remove('is-zoomed');
    img.classList.remove('is-dragging');
    img.style.transition = '';
    img.style.transform = 'translateX(0px) scale(1)';
    img.style.transformOrigin = 'center center';
}

function getActivityImageCurrentScale(img) {
    if (!img) return 1;
    const match = (img.style.transform || '').match(/scale\(([\d.]+)\)/);
    const scale = match ? Number(match[1]) : 1;
    return Number.isFinite(scale) ? scale : 1;
}

function setActivityImageScale(img, scale, originX = 50, originY = 50) {
    if (!img) return;
    const nextScale = Math.min(4, Math.max(1, scale));
    activityImageZoomed = nextScale > 1.01;
    img.classList.toggle('is-zoomed', activityImageZoomed);
    img.style.transformOrigin = `${originX}% ${originY}%`;
    img.style.transform = `translateX(0px) scale(${nextScale})`;
}

function getTouchDistance(touchA, touchB) {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.hypot(dx, dy);
}

function getTouchMidpointPercent(img, touchA, touchB) {
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 50, y: 50 };
    const clientX = (touchA.clientX + touchB.clientX) / 2;
    const clientY = (touchA.clientY + touchB.clientY) / 2;
    return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100
    };
}

window.handleActivityImageModalClick = (event) => {
    if (event.target !== event.currentTarget) return;
    scheduleActivityImageModalClose();
};

window.handleActivityImageCardClick = (event) => {
    if (event.target.closest('.activity-image-tools, .activity-image-close')) return;
    scheduleActivityImageModalClose();
};

window.handleActivityImageClick = (event) => {
    event.stopPropagation();
    if (activityImageTouchGesture.skipTapClose) {
        activityImageTouchGesture.skipTapClose = false;
        clearPendingActivityImageModalClose();
        return;
    }
    scheduleActivityImageModalClose();
};

window.toggleActivityImageZoom = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearPendingActivityImageModalClose();

    const img = event.currentTarget;
    if (!img) return;

    if (activityImageZoomed) {
        resetActivityImageZoom();
        return;
    }

    const rect = img.getBoundingClientRect();
    const originX = rect.width ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
    const originY = rect.height ? ((event.clientY - rect.top) / rect.height) * 100 : 50;

    activityImageZoomed = true;
    img.classList.add('is-zoomed');
    img.style.transformOrigin = `${originX}% ${originY}%`;
    img.style.transform = 'translateX(0px) scale(2)';
};

window.handleActivityImageTouchStart = (event) => {
    const img = document.getElementById('activity-image-modal-img');
    if (!img || activityImageTrackAnimating) return;
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        const track = document.getElementById('activity-image-track');
        if (track) track.style.transition = 'none';
        activityImageTouchGesture.startX = touch.clientX;
        activityImageTouchGesture.startY = touch.clientY;
        activityImageTouchGesture.deltaX = 0;
        activityImageTouchGesture.deltaY = 0;
        activityImageTouchGesture.swipeActive = false;
        return;
    }
    if (event.touches.length !== 2) return;
    const [touchA, touchB] = event.touches;
    clearPendingActivityImageModalClose();
    activityImageTouchGesture.startDistance = getTouchDistance(touchA, touchB);
    activityImageTouchGesture.startScale = getActivityImageCurrentScale(img);
    activityImageTouchGesture.active = activityImageTouchGesture.startDistance > 0;
    activityImageTouchGesture.skipTapClose = activityImageTouchGesture.active;
};

window.handleActivityImageTouchMove = (event) => {
    const img = document.getElementById('activity-image-modal-img');
    if (!img) return;
    if (event.touches.length === 1 && !activityImageZoomed && currentImageModalGallery.length > 1) {
        const touch = event.touches[0];
        activityImageTouchGesture.deltaX = touch.clientX - activityImageTouchGesture.startX;
        activityImageTouchGesture.deltaY = touch.clientY - activityImageTouchGesture.startY;
        const absX = Math.abs(activityImageTouchGesture.deltaX);
        const absY = Math.abs(activityImageTouchGesture.deltaY);
        if (absX > 14 && absX > absY * 1.2) {
            activityImageTouchGesture.swipeActive = true;
            activityImageTouchGesture.skipTapClose = true;
            event.preventDefault();
        }
        if (activityImageTouchGesture.swipeActive) {
            let effectiveDelta = activityImageTouchGesture.deltaX;
            if ((currentImageModalIndex === 0 && effectiveDelta > 0) ||
                (currentImageModalIndex === currentImageModalGallery.length - 1 && effectiveDelta < 0)) {
                effectiveDelta *= 0.3;
            }
            setActivityImageTrackOffset(effectiveDelta);
        }
        return;
    }
    if (event.touches.length !== 2 || !activityImageTouchGesture.active) return;
    const [touchA, touchB] = event.touches;
    const distance = getTouchDistance(touchA, touchB);
    if (!distance || !activityImageTouchGesture.startDistance) return;
    const scale = activityImageTouchGesture.startScale * (distance / activityImageTouchGesture.startDistance);
    const midpoint = getTouchMidpointPercent(img, touchA, touchB);
    event.preventDefault();
    setActivityImageScale(img, scale, midpoint.x, midpoint.y);
    activityImageTouchGesture.skipTapClose = true;
};

window.handleActivityImageTouchEnd = (event) => {
    if (event.touches.length >= 2) return;
    activityImageTouchGesture.active = false;
    activityImageTouchGesture.startDistance = 0;
    activityImageTouchGesture.startScale = 1;
    const hadSwipe = activityImageTouchGesture.swipeActive;
    const img = document.getElementById('activity-image-modal-img');

    if (hadSwipe && !activityImageZoomed) {
        const dx = activityImageTouchGesture.deltaX;
        finishActivityImageSwipe(dx);
        activityImageTouchGesture.skipTapClose = true;
    } else {
        resetActivityImageTrackPosition();
    }
    activityImageTouchGesture.swipeActive = false;
    activityImageTouchGesture.deltaX = 0;
    activityImageTouchGesture.deltaY = 0;

    if (img && getActivityImageCurrentScale(img) <= 1.01) {
        setActivityImageScale(img, 1);
        if (!hadSwipe) activityImageTouchGesture.skipTapClose = false;
    }
};

window.handleActivityImageMouseDown = (event) => {
    if (event.button !== 0 || activityImageZoomed || currentImageModalGallery.length <= 1 || activityImageTrackAnimating) return;
    const img = document.getElementById('activity-image-modal-img');
    if (!img) return;
    event.preventDefault();
    clearPendingActivityImageModalClose();
    const track = document.getElementById('activity-image-track');
    if (track) track.style.transition = 'none';
    activityImageTouchGesture.startX = event.clientX;
    activityImageTouchGesture.startY = event.clientY;
    activityImageTouchGesture.deltaX = 0;
    activityImageTouchGesture.deltaY = 0;
    activityImageTouchGesture.swipeActive = false;
    activityImageTouchGesture.mouseActive = true;
    img.classList.add('is-dragging');
    document.body.style.cursor = 'grabbing';
    clearActivityImageMouseDragListeners();
    window.addEventListener('mousemove', window.handleActivityImageMouseMove);
    window.addEventListener('mouseup', window.handleActivityImageMouseUp);
};

window.handleActivityImageMouseMove = (event) => {
    if (!activityImageTouchGesture.mouseActive || activityImageZoomed) return;
    activityImageTouchGesture.deltaX = event.clientX - activityImageTouchGesture.startX;
    activityImageTouchGesture.deltaY = event.clientY - activityImageTouchGesture.startY;
    const absX = Math.abs(activityImageTouchGesture.deltaX);
    const absY = Math.abs(activityImageTouchGesture.deltaY);
    if (absX > 14 && absX > absY * 1.2) {
        activityImageTouchGesture.swipeActive = true;
        activityImageTouchGesture.skipTapClose = true;
        event.preventDefault();
    }
    if (activityImageTouchGesture.swipeActive) {
        let effectiveDelta = activityImageTouchGesture.deltaX;
        if ((currentImageModalIndex === 0 && effectiveDelta > 0) ||
            (currentImageModalIndex === currentImageModalGallery.length - 1 && effectiveDelta < 0)) {
            effectiveDelta *= 0.3;
        }
        setActivityImageTrackOffset(effectiveDelta);
    }
};

window.handleActivityImageMouseUp = (event) => {
    if (!activityImageTouchGesture.mouseActive) return;
    const img = document.getElementById('activity-image-modal-img');
    const hadSwipe = activityImageTouchGesture.swipeActive;
    const dx = activityImageTouchGesture.deltaX;
    const dy = activityImageTouchGesture.deltaY;
    activityImageTouchGesture.mouseActive = false;
    activityImageTouchGesture.swipeActive = false;
    activityImageTouchGesture.deltaX = 0;
    activityImageTouchGesture.deltaY = 0;
    clearActivityImageMouseDragListeners();
    if (img) {
        img.classList.remove('is-dragging');
    }
    document.body.style.cursor = '';
    if (hadSwipe) {
        finishActivityImageSwipe(dx);
        activityImageTouchGesture.skipTapClose = true;
    } else {
        resetActivityImageTrackPosition();
    }
    if (event) event.preventDefault();
};

function positionActivityImageOverlay() {
    const modal = document.getElementById('activity-image-modal');
    const card = modal ? modal.querySelector('.activity-image-modal-card') : null;
    const img = document.getElementById('activity-image-modal-img');
    const tools = document.getElementById('activity-image-tools');
    const closeBtn = card ? card.querySelector('.activity-image-close') : null;
    if (!modal || !card || !img || !tools || !closeBtn) return;
    if (!modal.classList.contains('open')) return;

    const cardRect = card.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    if (!imgRect.width || !imgRect.height) return;

    const top = Math.max(8, Math.round(imgRect.top - cardRect.top + 10));
    const left = Math.max(8, Math.round(imgRect.left - cardRect.left + 10));
    const rightInset = Math.max(8, Math.round(cardRect.right - imgRect.right + 10));

    tools.style.top = `${top}px`;
    tools.style.left = `${left}px`;
    closeBtn.style.top = `${top}px`;
    closeBtn.style.right = `${rightInset}px`;
}

window.addEventListener('resize', () => {
    positionActivityImageOverlay();
});

window.toggleCurrentImageAsMain = () => {
    if (!currentImageModalDateKey || !currentImageModalSrc) return;
    setMainImageForDay(currentImageModalDateKey, currentImageModalSrc);
    syncActivityImageModalImage();
    renderRecordCalendar();
    if (currentRecordDayKey === currentImageModalDateKey) openRecordDayView(currentRecordDayKey);
};

/**
 * 渲染个人页收藏列表
 */
function renderProfileFavorites() {
    switchProfileFavTab(isViewingFriendProfile() ? friendProfileFavTab : currentProfileFavTab);
}

/**
 * 切换个人页收藏标签
 * @param {string} tab - 'want', 'like', 'dislike'
 */
window.switchProfileFavTab = (tab) => {
    if (isViewingFriendProfile()) friendProfileFavTab = tab;
    else currentProfileFavTab = tab;

    const validStoreIds = getExistingStoreIdSet();
    const favIds = isViewingFriendProfile()
        ? sanitizePreferenceIds(viewingFriendData?.favorites, validStoreIds)
        : sanitizePreferenceIds(myFavIds, validStoreIds);
    const likeSet = isViewingFriendProfile()
        ? new Set(sanitizePreferenceIds(viewingFriendData?.likes, validStoreIds))
        : new Set(sanitizePreferenceIds(Array.from(localLikes), validStoreIds));
    const dislikeSet = isViewingFriendProfile()
        ? new Set(sanitizePreferenceIds(viewingFriendData?.dislikes, validStoreIds))
        : new Set(sanitizePreferenceIds(Array.from(localDislikes), validStoreIds));
    const readonly = isViewingFriendProfile();

    // 更新标签样式
    document.querySelectorAll('.profile-fav-tabs-row .fav-tab-btn').forEach(b => {
        b.className = 'fav-tab-btn';
    });
    if (tab === 'want') document.getElementById('profile-tab-want').classList.add('active-want');
    if (tab === 'like') document.getElementById('profile-tab-like').classList.add('active-like');
    if (tab === 'dislike') document.getElementById('profile-tab-dislike').classList.add('active-dislike');

    // 同步图标：使用和收藏页相同的填充规则
    const pWantBtn = document.getElementById('profile-tab-want');
    const pLikeBtn = document.getElementById('profile-tab-like');
    const pDislikeBtn = document.getElementById('profile-tab-dislike');
    setFavTabIconFilled(pWantBtn, tab === 'want');
    setFavTabIconFilled(pLikeBtn, tab === 'like');
    setFavTabIconFilled(pDislikeBtn, tab === 'dislike');

    // 更新标签数字
    document.getElementById('profile-txt-want').innerText = `想吃(${favIds.length})`;
    document.getElementById('profile-txt-like').innerText = `好吃(${likeSet.size})`;
    document.getElementById('profile-txt-dislike').innerText = `难吃(${dislikeSet.size})`;

    // 筛选店铺
    let targetIds = [];
    if (tab === 'want') targetIds = favIds;
    else if (tab === 'like') targetIds = Array.from(likeSet);
    else if (tab === 'dislike') targetIds = Array.from(dislikeSet);

    const filteredStores = localStores.filter(s => targetIds.includes(s.id) && !isStorePermanentlyClosed(s));
    const container = document.getElementById('profile-fav-list');

    if (filteredStores.length === 0) {
        container.innerHTML = `<div style='text-align:center; padding:40px; color:#ccc;'>空空如也</div>`;
    } else {
        container.innerHTML = filteredStores.map((s, idx) => {
            const isFav = favIds.includes(s.id);
            const isLiked = likeSet.has(s.id);
            const isDisliked = dislikeSet.has(s.id);

            let statusClass = '';
            if (isDisliked) statusClass = 'status-disliked';
            else if (isLiked) statusClass = 'status-liked';
            else if (isFav) statusClass = 'status-fav';

            const avgRating = getStoreAverageRating(s);
            const reviewCount = getStoreReviewCount(s);
            const rawImgs = getStorePreviewImageEntries(s);
            const displayImgs = rawImgs.length ? rawImgs : ['https://placehold.co/200?text=No+Image'];
            const imagesHtml = displayImgs.map(src =>
                `<img src="${getImageAssetThumbUrl(src)}" class="store-img-item" loading="lazy" decoding="async">`
            ).join('');

            if (readonly) {
                return `
            <div class="store-card ${statusClass}" data-store-id="${s.id}" onclick="openDetail('${s.id}')">
                <div class="card-header-row">
                    <div class="info-col">
                        <div class="store-name-row">
                            <h3 class="store-name">${renderStoreNameWithStatus(s)}</h3>
                        </div>
                        <div class="store-meta">${avgRating.toFixed(1)} · ${formatStoreDistanceText(s)}</div>
                    </div>
                </div>
                <div class="store-img-scroll">${imagesHtml}</div>
            </div>`;
            }

            return `
            <div class="store-card ${statusClass}" data-store-id="${s.id}" onclick="openDetail('${s.id}')">
            <div class="card-header-row">
                <div class="info-col">
                    <div class="store-name-row">
                        <h3 class="store-name">${renderStoreNameWithStatus(s)}</h3>
                        <div onclick="toggleFav('${s.id}'); event.stopPropagation();">
                            <img src="${isFav ? 'images/bookmark-f.svg' : 'images/bookmark.svg'}"
                                 class="bookmark-icon-btn"
                                 alt="want">
                        </div>
                    </div>
                    <div class="store-meta">
                         ${avgRating.toFixed(1)} <span class="rating-star" style="display:inline-flex;align-items:center;"><img src="images/pingfen.svg" style="width:12px;"></span>
                         <span style="color:#b2bec3">(${reviewCount})</span>
                         <span style="margin:0 4px">•</span> 
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
  <path d="M9.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M6.44 3.752A.75.75 0 0 1 7 3.5h1.445c.742 0 1.32.643 1.243 1.38l-.43 4.083a1.8 1.8 0 0 1-.088.395l-.318.906.213.242a.8.8 0 0 1 .114.175l2 4.25a.75.75 0 1 1-1.357.638l-1.956-4.154-1.68-1.921A.75.75 0 0 1 6 8.96l.138-2.613-.435.489-.464 2.786a.75.75 0 1 1-1.48-.246l.5-3a.75.75 0 0 1 .18-.375l2-2.25Z"/>
  <path d="M6.25 11.745v-1.418l1.204 1.375.261.524a.8.8 0 0 1-.12.231l-2.5 3.25a.75.75 0 1 1-1.19-.914zm4.22-4.215-.494-.494.205-1.843.006-.067 1.124 1.124h1.44a.75.75 0 0 1 0 1.5H11a.75.75 0 0 1-.531-.22Z"/>
</svg>
                         ${formatStoreDistanceText(s)}
                    </div>
                </div>
                
                ${renderStoreActionGroup(s.id, isLiked, isDisliked, idx)}
            </div>
            <div class="store-img-scroll">${imagesHtml}</div>
        </div>`;
        }).join('');
    }
    lucide.createIcons();
};

/* =========================================
   17. 好友列表 & 搜索
   ========================================= */

/**
 * 打开好友列表页面
 */
window.openFriendsPage = async () => {
    if (!currentUser) {
        alert("请先登录");
        return;
    }
    const friendsPage = document.getElementById('friends-page');
    const profileView = document.getElementById('view-profile');
    if (friendsPage) {
        friendsPage.classList.remove('hidden');
        friendsPage.classList.remove('is-open');
    }
    if (friendsPageHideTimer) {
        clearTimeout(friendsPageHideTimer);
        friendsPageHideTimer = null;
    }
    const filterInput = document.getElementById('friends-filter-input');
    friendsFilterKeyword = "";
    if (filterInput) filterInput.value = "";
    await ensureAllUsersLoaded();
    renderFriendsList();
    if (profileView) profileView.classList.remove('friends-page-active');
    requestAnimationFrame(() => {
        if (profileView) profileView.classList.add('friends-page-active');
        friendsPage?.classList.add('is-open');
    });
};

/**
 * 关闭好友列表页面，返回我的主页
 */
window.closeFriendsPage = () => {
    const friendsPage = document.getElementById('friends-page');
    const profileView = document.getElementById('view-profile');
    if (!friendsPage) return;
    friendsPage.classList.remove('is-open');
    if (profileView) profileView.classList.remove('friends-page-active');
    if (friendsPageHideTimer) clearTimeout(friendsPageHideTimer);
    friendsPageHideTimer = setTimeout(() => {
        friendsPage.classList.add('hidden');
        friendsPageHideTimer = null;
    }, 260);
    friendsFilterKeyword = "";
    const filterInput = document.getElementById('friends-filter-input');
    if (filterInput) filterInput.value = "";
};

async function ensureAllUsersLoaded(forceReload = false) {
    if (!currentUser) return;
    if (publicUsersUnsub && !forceReload) return;
    if (forceReload) {
        stopPublicUsersListener();
    }
    usersLoadErrorMsg = "";
    return new Promise((resolve) => {
        let resolved = false;
        const finish = () => {
            if (resolved) return;
            resolved = true;
            resolve();
        };

        publicUsersUnsub = onSnapshot(
            collection(db, "publicUsers"),
            (snap) => {
                const rawUsers = [];
                snap.forEach(d => {
                    if (d.id === currentUser?.uid) return;
                    rawUsers.push({ id: d.id, ...d.data() });
                });

                // 去重：优先按 email（忽略大小写）去重，没有 email 再按 uid
                const deduped = [];
                const seenKeys = new Set();
                rawUsers.forEach(u => {
                    const emailKey = (u.email || '').trim().toLowerCase();
                    const key = emailKey ? `email:${emailKey}` : `uid:${u.id}`;
                    if (seenKeys.has(key)) return;
                    seenKeys.add(key);
                    if (hasLoadedStoresSnapshot) {
                        const sanitized = getSanitizedPreferencePayload(u);
                        deduped.push({
                            ...u,
                            favorites: sanitized.favorites,
                            likes: sanitized.likes,
                            dislikes: sanitized.dislikes
                        });
                    } else {
                        deduped.push(u);
                    }
                });
                allUsersCache = deduped;
                window.allUsersCache = allUsersCache;
                usersLoadErrorMsg = "";

                // 好友点赞/差评变化后自动刷新，无需手动刷新页面
                if (isHomeViewActive()) refreshVisibleStoreCardPreferenceVisuals();
                else applyFilters();
                const favView = document.getElementById('view-fav');
                if (favView && !favView.classList.contains('hidden')) {
                    switchFavTab(currentFavTab);
                }
                const profileFavContent = document.getElementById('profile-content-favorites');
                if (profileFavContent && profileFavContent.style.display !== 'none') {
                    renderProfileFavorites();
                }
                const friendsPage = document.getElementById('friends-page');
                if (friendsPage && !friendsPage.classList.contains('hidden')) {
                    renderFriendsList();
                }

                finish();
            },
            (err) => {
                console.error("加载用户列表失败:", err);
                const code = err && err.code ? ` (${err.code})` : "";
                usersLoadErrorMsg = `用户列表读取失败${code}`;
                allUsersCache = [];
                window.allUsersCache = allUsersCache;
                finish();
            }
        );
    });
}
window.ensureAllUsersLoaded = ensureAllUsersLoaded;

/**
 * 渲染好友列表（只显示已添加好友）
 */
function renderFriendsList() {
    const listEl = document.getElementById('friends-list');
    const pendingEl = document.getElementById('friends-pending-list');
    if (!listEl) return;

    if (pendingEl) {
        if (!incomingFriendRequests.length) {
            pendingEl.innerHTML = '';
            pendingEl.classList.add('hidden');
        } else {
            pendingEl.classList.remove('hidden');
            pendingEl.innerHTML = incomingFriendRequests.map(req => {
                const from = allUsersCache.find(u => u.id === req.fromUid) || {};
                const name = from.displayName || (from.email ? from.email.split('@')[0] : (req.fromUid || '用户'));
                const avatar = from.avatarUrl || DEFAULT_AVATAR_URL;
                return `
                <div class="friend-request-row">
                    <img src="${avatar}" class="friend-avatar" alt="${name}">
                    <div class="friend-request-text">
                        <span class="friend-request-name">${name}</span>
                        <span class="friend-request-suffix">申请成为好友</span>
                    </div>
                    <button class="friend-btn primary" onclick="openFriendProfile('${req.fromUid}')">查看主页</button>
                    <button class="friend-btn secondary" onclick="ignoreFriendRequest('${req.id}')">忽略</button>
                    <button class="friend-btn primary approve" onclick="acceptFriendRequest('${req.id}', '${req.fromUid}')">通过</button>
                </div>`;
            }).join('');
        }
    }

    if (!myFriends || myFriends.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:40px; color:#b2bec3; font-size:13px;">
            还没有好友，点击右上角 <b>添加好友</b> 吧
        </div>`;
        return;
    }

    const keyword = normalizeFriendKeyword(friendsFilterKeyword);
    const friendUsers = allUsersCache
        .filter(u => myFriends.includes(u.id))
        .filter((u) => {
            if (!keyword) return true;
            const name = getFriendSearchName(u).toLowerCase();
            const emailLocal = getFriendSearchEmailLocal(u);
            const emailFull = String(u?.email || '').trim().toLowerCase();
            return name.includes(keyword) || emailLocal.includes(keyword) || emailFull.includes(keyword);
        });
    if (!friendUsers.length) {
        listEl.innerHTML = `<div style="text-align:center; padding:40px; color:#b2bec3; font-size:13px;">
            ${keyword ? '没有匹配的好友' : '好友数据加载中，请稍后再试'}
        </div>`;
        return;
    }

    listEl.innerHTML = friendUsers.map(u => {
        const name = u.displayName || (u.email ? u.email.split('@')[0] : '好友');
        const avatar = u.avatarUrl || DEFAULT_AVATAR_URL;
        return `
        <div class="friend-item">
            <div class="friend-main" onclick="openFriendProfile('${u.id}')">
                <img src="${avatar}" alt="${name}" class="friend-avatar">
                <div class="friend-info">
                    <div class="friend-name">${name}</div>
                </div>
            </div>
            <div class="friend-actions">
                <button class="friend-btn primary" onclick="openFriendProfile('${u.id}')">查看主页</button>
                <button class="friend-btn secondary" onclick="removeFriend('${u.id}')">删除</button>
            </div>
        </div>`;
    }).join('');
}

window.filterFriendsList = () => {
    const input = document.getElementById('friends-filter-input');
    friendsFilterKeyword = String(input?.value || '').trim();
    renderFriendsList();
};

window.acceptFriendRequest = async (rid, fromUid) => {
    if (!currentUser) return;
    try {
        await updateDoc(doc(db, "friendRequests", rid), { status: "accepted" });
        await updateDoc(doc(db, "users", currentUser.uid), { friends: arrayUnion(fromUid) });
        if (!myFriends.includes(fromUid)) myFriends.push(fromUid);
        window.myFriends = myFriends;
        updateFriendsCount();
        renderFriendsList();
        updateFriendActionButton();
        const modal = document.getElementById('friend-search-modal');
        if (modal && modal.classList.contains('open')) doFriendSearch();
    } catch (err) {
        console.error("通过好友申请失败:", err);
        alert("通过失败: " + err.message);
    }
};

window.ignoreFriendRequest = async (rid) => {
    if (!currentUser) return;
    try {
        await updateDoc(doc(db, "friendRequests", rid), { status: "rejected" });
        renderFriendsList();
        updateFriendActionButton();
        const modal = document.getElementById('friend-search-modal');
        if (modal && modal.classList.contains('open')) doFriendSearch();
    } catch (err) {
        console.error("忽略好友申请失败:", err);
        alert("忽略失败: " + err.message);
    }
};

/**
 * 打开添加好友搜索弹层
 */
window.openFriendSearch = async () => {
    if (!currentUser) {
        alert("请先登录");
        return;
    }
    await ensureAllUsersLoaded(true);
    const modal = document.getElementById('friend-search-modal');
    const input = document.getElementById('friend-search-input');
    const results = document.getElementById('friend-search-results');
    if (modal && input && results) {
        modal.classList.add('open');
        modal.style.display = 'flex';
        input.value = '';
        results.innerHTML = '';
        input.focus();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doFriendSearch({ searchAll: true });
            }
        };
        input.oninput = () => {
            if (input.value.trim()) doFriendSearch({ searchAll: false });
            else results.innerHTML = '';
        };
        if (usersLoadErrorMsg) {
            results.innerHTML = `<div style="padding:16px; text-align:center; color:#e17055; font-size:13px;">${usersLoadErrorMsg}，请检查 Firestore 读取权限</div>`;
        }
    }
};

function normalizeFriendKeyword(raw) {
    const q = String(raw || "").trim().toLowerCase();
    if (!q) return "";
    return q.split('@')[0].trim();
}

function getFriendSearchName(u) {
    return (u?.displayName || (u?.email ? String(u.email).split('@')[0] : '') || '').trim();
}

function getFriendSearchEmailLocal(u) {
    return u?.email ? String(u.email).toLowerCase().split('@')[0].trim() : '';
}

/**
 * 关闭添加好友搜索弹层
 */
window.closeFriendSearch = () => {
    const modal = document.getElementById('friend-search-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
};

/**
 * 执行好友搜索
 */
window.doFriendSearch = (opts = {}) => {
    const input = document.getElementById('friend-search-input');
    const results = document.getElementById('friend-search-results');
    if (!input || !results) return;
    const keywordRaw = input.value;
    const keyword = normalizeFriendKeyword(keywordRaw);
    if (!keyword) {
        results.innerHTML = '';
        return;
    }

    const currentUid = String(currentUser?.uid || '').toLowerCase();
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();

    const hits = allUsersCache.filter(u => {
        if (!u) return false;
        const uid = String(u.id || '').toLowerCase();
        const emailFull = String(u.email || '').trim().toLowerCase();
        if (uid && currentUid && uid === currentUid) return false;
        if (emailFull && currentEmail && emailFull === currentEmail) return false;
        const name = getFriendSearchName(u).toLowerCase();
        const emailLocal = getFriendSearchEmailLocal(u);
        return name.includes(keyword) || emailLocal.includes(keyword);
    }).sort((a, b) => {
        const aName = getFriendSearchName(a).toLowerCase();
        const bName = getFriendSearchName(b).toLowerCase();
        const aEmail = getFriendSearchEmailLocal(a);
        const bEmail = getFriendSearchEmailLocal(b);
        const aScore = (aName.startsWith(keyword) ? 3 : 0) + (aEmail.startsWith(keyword) ? 2 : 0) + (aName.includes(keyword) ? 1 : 0);
        const bScore = (bName.startsWith(keyword) ? 3 : 0) + (bEmail.startsWith(keyword) ? 2 : 0) + (bName.includes(keyword) ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return aName.localeCompare(bName);
    });

    if (!hits.length) {
        if (!allUsersCache.length && usersLoadErrorMsg) {
            results.innerHTML = `<div style="padding:16px; text-align:center; color:#e17055; font-size:13px;">${usersLoadErrorMsg}，请检查 Firestore 读取权限</div>`;
            return;
        }
        results.innerHTML = `<div style="padding:16px; text-align:center; color:#b2bec3; font-size:13px;">没有匹配的用户</div>`;
        return;
    }

    const searchAll = (typeof opts.searchAll === 'boolean') ? opts.searchAll : true;
    const limit = 10;
    const hasMore = !searchAll && hits.length > limit;
    const renderList = hasMore ? hits.slice(0, limit) : hits;

    results.innerHTML = renderList.map(u => {
        const name = getFriendSearchName(u) || '好友';
        const avatar = u.avatarUrl || DEFAULT_AVATAR_URL;
        const isFriend = Array.isArray(myFriends) && myFriends.includes(u.id);
        const isPending = Array.isArray(mySentFriendRequests) && mySentFriendRequests.includes(u.id);
        const friendTagHtml = isFriend ? `<span class="friend-tag friend-tag-friend">好友</span>` : ``;
        let actionHtml = '';
        if (isFriend) {
            actionHtml = `<button class="friend-btn primary" onclick="openFriendProfile('${u.id}')">查看主页</button>`;
        } else if (isPending) {
            actionHtml = `<button class="friend-btn secondary disabled" disabled>已发送好友申请</button>`;
        } else {
            actionHtml = `<button class="friend-btn primary approve" onclick="addFriend('${u.id}')">发送好友申请</button>`;
        }
        return `
        <div class="friend-search-item">
            <div class="friend-search-main">
                <img src="${avatar}" alt="${name}" class="friend-avatar">
                <div class="friend-info">
                    <div class="friend-name">${name}${friendTagHtml}</div>
                </div>
            </div>
            <div class="friend-actions">
                ${actionHtml}
            </div>
        </div>`;
    }).join('') + (hasMore ? `
        <div class="friend-search-more-wrap">
            <button class="friend-search-more" onclick="doFriendSearch({ searchAll: true })">搜索全部</button>
        </div>
    ` : '');
};

/**
 * 添加好友
 */
window.addFriend = async (uid) => {
    if (!currentUser) {
        alert("请先登录");
        return;
    }
    if (uid === currentUser.uid) return;

    if (myFriends.includes(uid)) return;

    const incoming = incomingFriendRequests.find(r => r.fromUid === uid && r.status === 'pending');
    if (incoming) {
        await acceptFriendRequest(incoming.id, uid);
        doFriendSearch();
        return;
    }
    if (mySentFriendRequests.includes(uid)) return;

    try {
        await addDoc(collection(db, "friendRequests"), {
            fromUid: currentUser.uid,
            toUid: uid,
            status: "pending",
            createdAt: Date.now()
        });
        if (!mySentFriendRequests.includes(uid)) mySentFriendRequests.push(uid);
        renderFriendsList();
        doFriendSearch();
        updateFriendActionButton();
    } catch (err) {
        console.error("添加好友失败:", err);
        alert("添加好友失败: " + err.message);
    }
};

/**
 * 删除好友
 */
window.removeFriend = async (uid) => {
    if (!currentUser) {
        alert("请先登录");
        return;
    }
    pendingDeleteFriendUid = uid || "";
    const modal = document.getElementById('modal-confirm-delete-friend');
    if (modal) modal.classList.add('open');
};

window.closeDeleteFriendModal = () => {
    const modal = document.getElementById('modal-confirm-delete-friend');
    if (modal) modal.classList.remove('open');
    pendingDeleteFriendUid = "";
};

window.confirmDeleteFriend = async () => {
    if (!currentUser || !pendingDeleteFriendUid) return;
    const uid = pendingDeleteFriendUid;
    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            friends: arrayRemove(uid)
        });
        myFriends = myFriends.filter(id => id !== uid);
        window.myFriends = myFriends;
        updateFriendsCount();
        renderFriendsList();
        closeDeleteFriendModal();
    } catch (err) {
        console.error("删除好友失败:", err);
        alert("删除好友失败: " + err.message);
    }
};

/**
 * 查看好友主页（简单版：展示头像 + 好友的收藏数量）
 */
window.openFriendProfile = async (uid, opts = {}) => {
    if (!currentUser || !uid || uid === currentUser.uid) return;
    const overlay = !!opts?.overlay;
    friendProfileReturnToFriends = !overlay && !!(document.getElementById('friends-page') && !document.getElementById('friends-page').classList.contains('hidden'));
    closeFriendSearch();
    try {
        if (!allUsersCache.length) await ensureAllUsersLoaded(true);
        let target = allUsersCache.find(u => u.id === uid) || null;
        if (!target) {
            const { getDoc: getDocSingle } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");
            const snap = await getDocSingle(doc(db, "publicUsers", uid));
            if (snap.exists()) target = { id: snap.id, ...snap.data() };
        }
        if (!target) {
            alert("该用户不存在");
            return;
        }
        if (hasLoadedStoresSnapshot) {
            const sanitized = getSanitizedPreferencePayload(target);
            target = {
                ...target,
                favorites: sanitized.favorites,
                likes: sanitized.likes,
                dislikes: sanitized.dislikes
            };
        }
        viewingFriendUid = uid;
        viewingFriendData = target;
        friendProfileFavTab = 'want';

        const profileView = document.getElementById('view-profile');
        const userInfo = document.getElementById('user-info');
        const guestInfo = document.getElementById('guest-info');
        if (profileView) {
            profileView.classList.remove('profile-guest-mode');
            if (overlay) {
                if (friendProfileOverlayHideTimer) {
                    clearTimeout(friendProfileOverlayHideTimer);
                    friendProfileOverlayHideTimer = null;
                }
                friendProfileOverlayActive = true;
                profileView.classList.remove('hidden');
                profileView.classList.add('friend-profile-overlay');
                requestAnimationFrame(() => profileView.classList.add('is-open'));
            } else {
                profileView.classList.remove('friend-profile-overlay', 'is-open');
            }
        }
        if (userInfo) userInfo.classList.remove('hidden');
        if (guestInfo) guestInfo.classList.add('hidden');

        setProfileIdentity(
            target.displayName || (target.email ? target.email.split('@')[0] : '用户'),
            target.avatarUrl || DEFAULT_AVATAR_URL
        );
        updateProfileHeaderMode();
        updateFriendActionButton();
        switchProfileTab('activity');
        if (!overlay) closeFriendsPage();
    } catch (err) {
        console.error("加载好友信息失败:", err);
        alert("加载好友信息失败: " + err.message);
    }
};

window.openFriendProfileFromReview = (uid) => {
    openFriendProfile(uid, { overlay: true });
};

window.backFromFriendProfile = () => {
    if (!currentUser) return;
    if (friendProfileOverlayActive) {
        closeFriendProfileOverlay();
        return;
    }
    viewingFriendUid = "";
    viewingFriendData = null;
    friendProfileFavTab = 'want';
    setProfileIdentity(
        currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : '用户'),
        currentUser.photoURL || ''
    );
    loadUserAvatar(currentUser.uid);
    updateProfileHeaderMode();
    switchProfileTab('activity');
    if (friendProfileReturnToFriends) {
        friendProfileReturnToFriends = false;
        openFriendsPage();
    }
};

// === 新增：处理详情页点击"查看路线" ===
window.doNavFromDetail = () => {
    if (!currentDetailId) return;
    if (typeof window.openStoreInGoogleMapsById === 'function') {
        window.openStoreInGoogleMapsById(currentDetailId);
    }
};
