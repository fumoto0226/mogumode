/* =========================================
   MoguMode 地图模块 JavaScript
   Google Maps 集成
   从 02061500.html 整理
   
   这个文件包含：
   - Google Maps 初始化
   - 自定义店铺标记（图钉）
   - 地图搜索功能
   - 路线规划
   - 地图详情卡片
   ========================================= */

// ==========================================
// Google Maps API 配置
// ==========================================
const MAPS_API_KEY = "AIzaSyAvqupW6XZ7A61lutSD8_GlV31Xdc5ZTLw";  // Google Maps API密钥
const SHINJUKU_CENTER = { lat: 35.6905, lng: 139.7005 };          // 新宿中心点（地图默认中心）
const ORIGIN = { lat: 35.691638, lng: 139.697005 };                // 起点位置（Cocoon Tower）

// ==========================================
// 地图相关全局变量
// ==========================================
let map, marker, routePolyline;  // 地图实例、搜索标记、路线线条
let currentMapDest = null;        // 当前目的地坐标
let storeMarkers = [];            // 店铺标记数组
let currentOriginMarker = null;    // 当前起点标记（蓝/红定位图标）
const MAP_REVIEW_AVATAR_CACHE = new Map();
const DEFAULT_AVATAR_URL = "images/avatar-placeholder.svg";
let mapSearchDebounceTimer = null;
let lastMapQuery = "";
let activePinnedStoreId = "";
let mapFocusAnimationFrame = 0;
let mapFocusAnimationToken = 0;
const MAP_PIN_SIZE = 32;

function getMapCenterFromOrigin() {
    const origin = window.mapOrigin || ORIGIN;
    const lat = Number(origin?.lat);
    const lng = Number(origin?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ...SHINJUKU_CENTER };
    return { lat, lng };
}

function updateMapSearchClearButton() {
    const input = document.getElementById('q');
    const btn = document.getElementById('clearBtn');
    if (!input || !btn) return;
    btn.classList.toggle('hidden', !(String(input.value || '').trim()));
}

function clearMapSearchInput() {
    const input = document.getElementById('q');
    const results = document.getElementById('results');
    if (input) input.value = "";
    if (results) {
        results.classList.remove('active');
        results.innerHTML = "";
    }
    updateMapSearchClearButton();
    closeMapCard();
    if (map) {
        map.setCenter(getMapCenterFromOrigin());
        map.setZoom(15);
    }
}

function getActiveMapStoreId() {
    return activePinnedStoreId || document.getElementById('map-detail-card')?.dataset?.storeId || '';
}

function getSelectedStorePinUrl(store) {
    return 'images/dian01.svg';
}

function getMapPinMarkup(type = 'default') {
    const wrap = (inner) => `<svg class="map-pin-svg" width="121" height="121" viewBox="0 0 121 121" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
    switch (type) {
        case 'like':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FFC7F6"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF6ECB"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                <path d="M60.2446 87.021C59.274 87.021 58.3781 86.7224 57.5942 86.0878C56.9595 85.5651 41.4678 73.5823 35.271 63.8393C33.2179 60.629 30.3809 56.2614 30.3809 50.0647C30.3809 39.7244 38.1081 31.3252 47.5525 31.3252C52.368 31.3252 56.9595 33.5276 60.2446 37.3726C63.4922 33.4903 68.0464 31.3252 72.8993 31.3252C82.381 31.3252 90.0709 39.7244 90.0709 50.0647C90.0709 56.1494 87.4205 60.3303 85.2554 63.7273L85.1807 63.8393C78.984 73.5823 63.4922 85.6025 62.8576 86.0878C62.111 86.685 61.2151 87.021 60.2446 87.021Z" fill="#FF6ECB"/>
                <path d="M60.2446 87.021C59.274 87.021 58.3781 86.7224 57.5942 86.0878C56.9595 85.5651 41.4678 73.5823 35.271 63.8393C33.2179 60.629 30.3809 56.2614 30.3809 50.0647C30.3809 39.7244 38.1081 31.3252 47.5525 31.3252C52.368 31.3252 56.9595 33.5276 60.2446 37.3726C63.4922 33.4903 68.0464 31.3252 72.8993 31.3252C82.381 31.3252 90.0709 39.7244 90.0709 50.0647C90.0709 56.1494 87.4205 60.3303 85.2554 63.7273L85.1807 63.8393C78.984 73.5823 63.4922 85.6025 62.8576 86.0878C62.111 86.685 61.2151 87.021 60.2446 87.021Z" fill="#FFC7F6"/>
            `);
        case 'dislike':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#C4F7FF"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#4099FF"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                <path d="M51.9867 34.5737H76.6979C78.8979 34.5737 80.8163 35.949 81.6407 37.8694L89.8777 57.3662C90.1512 57.9132 90.4287 58.4623 90.4287 59.2847V64.5033V64.7787C90.4287 67.7973 87.9594 70.2688 84.9348 70.2688H67.6362L70.3831 82.8998V83.7242C70.3831 84.8203 69.8365 85.9203 69.2852 86.7426L66.2648 89.4895L48.1457 71.3687C47.0436 70.2687 46.497 68.8973 46.497 67.5217V40.0676C46.497 37.0451 48.9662 34.5737 51.9867 34.5737ZM41.0068 67.5217H30.0228V34.5737H41.0068V67.5217Z" fill="#4099FF"/>
                <path d="M51.9867 34.5737H76.6979C78.8979 34.5737 80.8163 35.949 81.6407 37.8694L89.8777 57.3662C90.1512 57.9132 90.4287 58.4623 90.4287 59.2847V64.5033V64.7787C90.4287 67.7973 87.9594 70.2688 84.9348 70.2688H67.6362L70.3831 82.8998V83.7242C70.3831 84.8203 69.8365 85.9203 69.2852 86.7426L66.2648 89.4895L48.1457 71.3687C47.0436 70.2687 46.497 68.8973 46.497 67.5217V40.0676C46.497 37.0451 48.9662 34.5737 51.9867 34.5737ZM41.0068 67.5217H30.0228V34.5737H41.0068V67.5217Z" fill="#C4F7FF"/>
            `);
        case 'fav':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#E5F795" stroke="white" stroke-width="9"/>
                <path d="M80.3457 27.8963L80.3457 90.3616L60.2256 71.1149L40.1055 90.3616L40.1055 27.8963L80.3457 27.8963Z" fill="#B9A930"/>
            `);
        case 'default':
        default:
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#9AF490"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF6666"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                <path d="M69.0062 59.4965L71.7098 75.1217C71.7098 79.4759 68.183 83.0065 63.825 83.0065H56.9486C52.5906 83.0065 49.0601 79.4759 49.0601 75.1217L51.7636 59.4965" fill="white"/>
                <path d="M60.6821 59.4965V83.0065H63.8245C68.1825 83.0065 71.7093 79.4759 71.7093 75.1217L69.0057 59.4965H60.6821Z" fill="white"/>
                <path d="M88.354 55.6841C88.354 71.2184 75.7573 63.5033 60.2277 63.5033C44.6949 63.5028 32.0977 71.2141 32.0977 55.6841C32.0977 40.1494 44.6949 29.4452 60.2277 29.4452C75.7573 29.4452 88.354 40.1494 88.354 55.6841Z" fill="white"/>
                <path d="M88.0509 51.8212C87.9698 51.2544 87.9032 50.6801 87.7869 50.1297C87.6946 49.6886 87.56 49.2676 87.4452 48.8373C87.3308 48.405 87.2365 47.9657 87.102 47.5462C86.9412 47.0497 86.7406 46.5767 86.5516 46.0966C86.4208 45.7661 86.3116 45.4225 86.1677 45.0995C85.9328 44.5679 85.6562 44.062 85.3848 43.5524C85.254 43.3049 85.1405 43.0447 85.0027 42.8023C84.6797 42.2449 84.3197 41.7128 83.9577 41.1826C83.8391 41.0111 83.7374 40.8301 83.6179 40.6623C83.202 40.088 82.7496 39.5414 82.2865 39.0041C82.1979 38.9005 82.12 38.788 82.0277 38.6844C81.514 38.1116 80.9743 37.5626 80.4103 37.0393C80.355 36.9878 80.3067 36.9306 80.2495 36.8786C79.6378 36.3171 79 35.7847 78.3382 35.2832C78.3237 35.2724 78.3087 35.2593 78.2941 35.2481C73.5133 31.6458 67.3813 29.5591 60.6821 29.4691V63.5145C65.5399 63.5591 70.0994 64.3307 74.0622 64.8806C74.4424 64.9322 74.817 64.9847 75.1883 65.0325L75.7218 65.0986C76.2094 65.1577 76.6857 65.213 77.1493 65.258C77.2712 65.2726 77.3893 65.2801 77.5079 65.2904C77.9027 65.3279 78.289 65.3537 78.6673 65.3757C78.7817 65.3837 78.8979 65.3907 79.0109 65.3944C79.4516 65.4165 79.8801 65.424 80.2959 65.4165C80.4061 65.4165 80.512 65.4127 80.6185 65.409C80.9935 65.3982 81.3592 65.3757 81.7098 65.3387C81.7689 65.3312 81.8317 65.3312 81.8894 65.3241C82.2633 65.2782 82.6343 65.2117 83.0009 65.1249C83.0909 65.1061 83.1837 65.0803 83.2719 65.0578C83.6197 64.9682 83.9611 64.8548 84.2934 64.7184C84.3178 64.7072 84.3398 64.6922 84.3633 64.6814C84.6601 64.5491 84.9454 64.3921 85.216 64.2121C85.2845 64.1681 85.3529 64.1235 85.4195 64.0757C85.6981 63.8758 85.9578 63.6507 86.1953 63.4034C86.2357 63.3589 86.2708 63.3111 86.3116 63.2628C86.5179 63.0303 86.712 62.7715 86.8887 62.4879C86.9318 62.425 86.9759 62.3618 87.0148 62.2919C87.2051 61.9666 87.3767 61.6046 87.5281 61.2132C87.5596 61.1283 87.5896 61.036 87.6186 60.9511C87.7499 60.578 87.8662 60.179 87.9623 59.7472C87.9768 59.6802 87.9951 59.6216 88.0082 59.5513C88.1099 59.0679 88.1835 58.5359 88.2388 57.9742C88.3142 57.2144 88.3525 56.4514 88.3537 55.6879C88.3537 54.7221 88.3045 53.7752 88.2098 52.8479C88.1732 52.4967 88.0991 52.1648 88.0509 51.8212Z" fill="white"/>
            `);
    }
}

function setSelectedStorePin(store) {
    if (!map || !store?.lat || !store?.lng) return;
    const dest = { lat: Number(store.lat), lng: Number(store.lng) };
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return;
    activePinnedStoreId = store.id || "";
    currentMapDest = dest;
    if (marker) marker.setMap(null);
    const iconUrl = getSelectedStorePinUrl(store);
    const finalW = 34;
    const finalH = 46;
    marker = new google.maps.Marker({
        map,
        position: dest,
        optimized: false,
        icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(finalW, finalH),
            anchor: new google.maps.Point(Math.round(finalW / 2), finalH)
        }
    });
    window.renderMarkers();
}

function refreshMapSearchListHighlight() {
    const results = document.getElementById('results');
    const input = document.getElementById('q');
    if (!results || !input) return;
    if (!results.classList.contains('active')) return;
    if (!String(input.value || '').trim()) return;
    performMapSearch();
}

function mountMapSheetToAppRoot() {
    const sheet = document.getElementById('map-detail-card');
    const backdrop = document.getElementById('map-sheet-backdrop');
    const appRoot = document.getElementById('app');
    if (!sheet || !appRoot) return;
    if (backdrop && backdrop.parentElement !== appRoot) {
        appRoot.appendChild(backdrop);
    }
    if (sheet.parentElement === appRoot) return;
    appRoot.appendChild(sheet);
}

function setMapSheetBackdrop(visible) {
    const backdrop = document.getElementById('map-sheet-backdrop');
    if (!backdrop) return;
    // 地图页不使用灰色遮罩，避免影响看路线和地图交互；
    // 其他页面展示遮罩以拦截页面其他区域的交互，点击遮罩等同关闭弹窗。
    const mapViewVisible = !document.getElementById('view-map')?.classList.contains('hidden');
    if (visible && !mapViewVisible) {
        backdrop.classList.add('active');
    } else {
        backdrop.classList.remove('active');
    }
}

function setMapSheetMode(mode) {
    const card = document.getElementById('map-detail-card');
    if (!card) return;
    card.classList.remove('peek', 'half', 'full');
    card.classList.add(mode === 'full' ? 'full' : mode === 'peek' ? 'peek' : 'half');
    if (card.dataset.dragging !== '1') {
        card.style.height = '';
    }
}

function getCurrentOriginState() {
    const origin = window.mapOrigin || ORIGIN;
    const type = window.mapOriginType || 'gps';
    return { origin, type };
}

function buildGoogleMapsWebPlaceUrl(placeLike = {}) {
    const placeId = String(placeLike?.googlePlaceId || placeLike?.placeId || '').trim();
    const name = String(placeLike?.name || '').trim();
    const address = String(placeLike?.address || placeLike?.formattedAddress || '').trim();
    const lat = Number(placeLike?.lat);
    const lng = Number(placeLike?.lng);

    const queryText = name || address || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : '');
    if (!queryText) return '';

    const params = new URLSearchParams({
        api: '1',
        query: queryText
    });
    if (placeId) params.set('query_place_id', placeId);
    return `https://www.google.com/maps/search/?${params.toString()}`;
}

function openGoogleMapsPlace(placeLike = {}) {
    const webUrl = buildGoogleMapsWebPlaceUrl(placeLike);
    if (!webUrl) {
        alert("未找到店铺位置信息");
        return;
    }

    const name = String(placeLike?.name || '').trim();
    const address = String(placeLike?.address || placeLike?.formattedAddress || '').trim();
    const lat = Number(placeLike?.lat);
    const lng = Number(placeLike?.lng);
    const queryText = name || address || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : '');
    if (!queryText) {
        window.open(webUrl, '_blank', 'noopener');
        return;
    }

    const ua = String(navigator.userAgent || '').toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);
    if (!isMobile) {
        window.open(webUrl, '_blank', 'noopener');
        return;
    }

    if (/iphone|ipad|ipod/.test(ua)) {
        const appUrl = `comgooglemaps://?q=${encodeURIComponent(queryText)}`;
        window.location.href = appUrl;
        setTimeout(() => {
            window.open(webUrl, '_blank', 'noopener');
        }, 650);
        return;
    }

    if (/android/.test(ua)) {
        const intentUrl = `intent://maps.google.com/maps?q=${encodeURIComponent(queryText)}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
        window.location.href = intentUrl;
        setTimeout(() => {
            window.open(webUrl, '_blank', 'noopener');
        }, 650);
        return;
    }

    window.open(webUrl, '_blank', 'noopener');
}

function formatMapDistanceText(storeLike) {
    if (typeof window.formatStoreDistanceText === 'function') {
        return window.formatStoreDistanceText(storeLike);
    }
    const fallback = Number(storeLike?.distance);
    if (!Number.isFinite(fallback) || fallback < 0) return '--分钟';
    const WALK_METERS_PER_MIN = 80;
    const mins = Math.max(1, Math.round(fallback / WALK_METERS_PER_MIN));
    return `${mins}分钟`;
}

function renderCurrentOriginMarker() {
    if (!map) return;
    if (currentOriginMarker) currentOriginMarker.setMap(null);

    const { origin, type } = getCurrentOriginState();
    const iconUrl = type === 'gps' ? 'images/weizhih.svg' : 'images/weizhilan.svg';
    const iconSize = new google.maps.Size(30, 30);

    currentOriginMarker = new google.maps.Marker({
        map,
        position: origin,
        optimized: false,
        zIndex: 1,
        clickable: false,
        draggable: false,
        icon: {
            url: iconUrl,
            scaledSize: iconSize
        }
    });
}

function stopMapFocusAnimation() {
    mapFocusAnimationToken += 1;
    if (mapFocusAnimationFrame) {
        cancelAnimationFrame(mapFocusAnimationFrame);
        mapFocusAnimationFrame = 0;
    }
}

function getMapSheetTargetHeight(mode = 'half') {
    const vh = window.innerHeight || 0;
    if (mode === 'full') return Math.max(0, vh - 60);
    if (mode === 'peek') return 102;
    return Math.round(vh * 0.5);
}

function getMapFocusOffsetY(mode = 'half') {
    const vh = window.innerHeight || 0;
    const sheetHeight = getMapSheetTargetHeight(mode);
    if (mode === 'full') return Math.round(Math.min(sheetHeight * 0.14, vh * 0.18));
    if (mode === 'peek') return Math.round(Math.min(sheetHeight * 0.28, 42));
    return Math.round(Math.min(sheetHeight * 0.34, vh * 0.24));
}

function offsetLatLngByPixels(latlngLike, offsetX, offsetY) {
    if (!map || !window.google?.maps) return null;
    const projection = map.getProjection?.();
    const zoom = Number(map.getZoom?.());
    if (!projection || !Number.isFinite(zoom)) return null;
    const latLng = latlngLike instanceof google.maps.LatLng
        ? latlngLike
        : new google.maps.LatLng(latlngLike);
    const worldPoint = projection.fromLatLngToPoint(latLng);
    const scale = Math.pow(2, zoom);
    return projection.fromPointToLatLng(new google.maps.Point(
        worldPoint.x + (offsetX / scale),
        worldPoint.y + (offsetY / scale)
    ));
}

function animateMapCenterTo(targetCenter, duration = 460) {
    if (!map || !targetCenter) return;
    const projection = map.getProjection?.();
    const zoom = Number(map.getZoom?.());
    const startCenter = map.getCenter?.();
    if (!projection || !Number.isFinite(zoom) || !startCenter) {
        map.panTo(targetCenter);
        return;
    }

    const startPoint = projection.fromLatLngToPoint(startCenter);
    const endPoint = projection.fromLatLngToPoint(targetCenter);
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) {
        map.setCenter(targetCenter);
        return;
    }

    stopMapFocusAnimation();
    const token = ++mapFocusAnimationToken;
    const startedAt = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);

    const tick = (now) => {
        if (!map || token !== mapFocusAnimationToken) return;
        const p = Math.min(1, (now - startedAt) / duration);
        const eased = ease(p);
        const nextPoint = new google.maps.Point(
            startPoint.x + (dx * eased),
            startPoint.y + (dy * eased)
        );
        map.setCenter(projection.fromPointToLatLng(nextPoint));
        if (p < 1) {
            mapFocusAnimationFrame = requestAnimationFrame(tick);
        } else {
            mapFocusAnimationFrame = 0;
        }
    };

    mapFocusAnimationFrame = requestAnimationFrame(tick);
}

function panToStoreKeepingVisible(pos, mode = 'half') {
    if (!map || !pos) return;
    const dest = pos instanceof google.maps.LatLng ? pos : new google.maps.LatLng(pos);
    const offsetY = getMapFocusOffsetY(mode);
    const targetCenter = offsetLatLngByPixels(dest, 0, offsetY);
    if (!targetCenter) {
        map.panTo(dest);
        return;
    }
    animateMapCenterTo(targetCenter);
}

// 地图卡片状态（用于记录交互数据）
let mapCardState = {
    checkInCount: 0,    // 打卡次数
    friendSocial: {
        fav: { count: 0, avatars: [] },
        like: { count: 0, avatars: [] },
        dislike: { count: 0, avatars: [] }
    }
};
let mapFriendPreviewTimer = null;

function stopMapFriendPreviewRotation() {
    if (mapFriendPreviewTimer) {
        clearInterval(mapFriendPreviewTimer);
        mapFriendPreviewTimer = null;
    }
}

function escapeMapHtml(raw) {
    return String(raw || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMapSocialAvatars(type, avatars = []) {
    const wrap = document.getElementById(`avatars-map-${type}`);
    if (!wrap) return;
    wrap.innerHTML = avatars.slice(0, 3).map(src => `<img src="${src}" alt="${type}-avatar">`).join('');
}

function getUserAvatarUrl(user) {
    return user?.avatarUrl || user?.photoURL || DEFAULT_AVATAR_URL;
}

function getMapFriendUsers() {
    const friendIds = new Set(Array.isArray(window.myFriends) ? window.myFriends : []);
    if (!friendIds.size) return [];
    return (Array.isArray(window.allUsersCache) ? window.allUsersCache : [])
        .filter(u => friendIds.has(u.id));
}

function buildFriendAliasMap() {
    const aliasMap = new Map();
    getMapFriendUsers().forEach(user => {
        const aliases = new Set();
        if (user?.id) aliases.add(String(user.id).toLowerCase());
        if (user?.email) {
            const email = String(user.email).toLowerCase();
            aliases.add(email);
            if (email.includes('@')) aliases.add(email.split('@')[0]);
        }
        if (user?.displayName) aliases.add(String(user.displayName).toLowerCase());
        aliases.forEach(a => aliasMap.set(a, user));
    });
    return aliasMap;
}

function resolveFriendFromReview(rev, aliasMap) {
    if (!rev || typeof rev !== 'object') return null;
    const uid = String(rev.uid || '').toLowerCase();
    if (uid && aliasMap.has(uid)) return aliasMap.get(uid);
    const user = String(rev.user || rev.displayName || '').toLowerCase();
    if (user && aliasMap.has(user)) return aliasMap.get(user);
    return null;
}

function computeMapFriendSocial(storeId) {
    const result = {
        fav: { count: 0, avatars: [] },
        like: { count: 0, avatars: [] },
        dislike: { count: 0, avatars: [] }
    };
    if (!storeId) return result;
    const friendUsers = getMapFriendUsers();
    friendUsers.forEach(u => {
        const avatar = getUserAvatarUrl(u);
        const favorites = Array.isArray(u.favorites) ? u.favorites : [];
        const likes = Array.isArray(u.likes) ? u.likes : [];
        const dislikes = Array.isArray(u.dislikes) ? u.dislikes : [];
        if (favorites.includes(storeId)) {
            result.fav.count += 1;
            result.fav.avatars.push(avatar);
        }
        if (likes.includes(storeId)) {
            result.like.count += 1;
            result.like.avatars.push(avatar);
        }
        if (dislikes.includes(storeId)) {
            result.dislike.count += 1;
            result.dislike.avatars.push(avatar);
        }
    });

    const myAvatar = typeof window.getCurrentUserAvatarUrl === 'function'
        ? window.getCurrentUserAvatarUrl()
        : DEFAULT_AVATAR_URL;
    const myFavs = window.myFavIds || [];
    const myLikes = window.localLikes || new Set();
    const myDislikes = window.localDislikes || new Set();
    if (myFavs.includes(storeId)) {
        result.fav.count += 1;
        result.fav.avatars.unshift(myAvatar);
    }
    if (myLikes.has(storeId)) {
        result.like.count += 1;
        result.like.avatars.unshift(myAvatar);
    }
    if (myDislikes.has(storeId)) {
        result.dislike.count += 1;
        result.dislike.avatars.unshift(myAvatar);
    }
    return result;
}

function refreshMapFriendSection(store) {
    stopMapFriendPreviewRotation();
    const aliasMap = buildFriendAliasMap();
    const revs = (Array.isArray(store?.revs) ? store.revs : [])
        .map(r => ({ rev: r, user: resolveFriendFromReview(r, aliasMap) }))
        .filter(item => !!item.user)
        .sort((a, b) => Number(b?.rev?.createdAt || 0) - Number(a?.rev?.createdAt || 0));

    const friendAvatarsWrap = document.querySelector('.sheet-friend-avatars');
    if (friendAvatarsWrap) {
        const unique = [];
        const seen = new Set();
        revs.forEach(item => {
            const uid = item.user?.id || '';
            if (!uid || seen.has(uid)) return;
            seen.add(uid);
            unique.push(getUserAvatarUrl(item.user));
        });
        friendAvatarsWrap.innerHTML = unique.slice(0, 3).map(src => `<img src="${src}" class="f-avatar">`).join('');
    }

    const ratingWrap = document.getElementById('sheet-friend-rating');
    if (ratingWrap) {
        if (!revs.length) {
            ratingWrap.innerHTML = `<div class="friend-score">--</div><div class="sheet-friend-empty">暂无好友评价</div>`;
            return;
        }

        const previewItems = revs.map((item, idx) => {
            const text = String(item.rev?.text || '').trim() || `评分 ${Number(item.rev?.rating || 0).toFixed(1)}`;
            const rating = Number(item.rev?.rating || 0);
            return `
                <div class="sheet-friend-rating-frame${idx === 0 ? ' is-active' : ''}">
                    <div class="friend-score">${Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : '--'}</div>
                    <div class="friend-comment-carousel">
                        <div class="friend-comment-item">${escapeMapHtml(text)}</div>
                    </div>
                </div>
            `;
        }).join('');

        ratingWrap.innerHTML = `<div class="friend-comment-carousel-track">${previewItems}</div>`;

        if (revs.length > 1) {
            const track = ratingWrap.querySelector('.friend-comment-carousel-track');
            let currentIndex = 0;
            mapFriendPreviewTimer = setInterval(() => {
                if (!track) return;
                currentIndex = (currentIndex + 1) % revs.length;
                track.style.transform = `translateY(-${currentIndex * 34}px)`;
            }, 2600);
        }
    }
}

function refreshMapSocialButtonsUI() {
    const card = document.getElementById('map-detail-card');
    if (!card) return;
    const storeId = card.dataset.storeId || "";
    if (!storeId) return;
    mapCardState.friendSocial = computeMapFriendSocial(storeId);

    const favIds = window.myFavIds || [];
    const likes = window.localLikes || new Set();
    const dislikes = window.localDislikes || new Set();
    const isFav = favIds.includes(storeId);
    const isLike = likes.has(storeId);
    const isDislike = dislikes.has(storeId);

    const favIcon = document.getElementById('icon-map-fav');
    const likeIcon = document.getElementById('icon-map-like');
    const dislikeIcon = document.getElementById('icon-map-dislike');
    if (favIcon) favIcon.src = isFav ? 'images/bookmark-f.svg' : 'images/bookmark.svg';
    if (likeIcon) likeIcon.src = isLike ? 'images/like-f.svg' : 'images/like.svg';
    if (dislikeIcon) dislikeIcon.src = isDislike ? 'images/dislike-f.svg' : 'images/dislike.svg';

    const friendSocial = mapCardState.friendSocial || {};
    const favStat = friendSocial.fav || { count: 0, avatars: [] };
    const likeStat = friendSocial.like || { count: 0, avatars: [] };
    const dislikeStat = friendSocial.dislike || { count: 0, avatars: [] };
    renderMapSocialAvatars('fav', favStat.avatars || []);
    renderMapSocialAvatars('like', likeStat.avatars || []);
    renderMapSocialAvatars('dislike', dislikeStat.avatars || []);

    const favCount = Number(favStat.count || 0);
    const likeCount = Number(likeStat.count || 0);
    const dislikeCount = Number(dislikeStat.count || 0);
    const favCountEl = document.getElementById('count-map-fav');
    const likeCountEl = document.getElementById('count-map-like');
    const dislikeCountEl = document.getElementById('count-map-dislike');
    if (favCountEl) favCountEl.innerText = String(favCount);
    if (likeCountEl) likeCountEl.innerText = String(likeCount);
    if (dislikeCountEl) dislikeCountEl.innerText = String(dislikeCount);
}

function formatMapReviewDate(ts) {
    const t = Number(ts);
    if (!Number.isFinite(t) || t <= 0) return '';
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${hh}:${mm}`;
}

function renderMapReviewRatingIcons(score) {
    const filled = typeof window.getFilledRatingIconCount === 'function'
        ? window.getFilledRatingIconCount(score)
        : Math.floor(Math.max(0, Math.min(5, Number(score) || 0)));
    return Array.from({ length: 5 }).map((_, i) =>
        `<img src="images/mogu.svg" style="width:13px; opacity:${i < filled ? 1 : 0.25};">`
    ).join('');
}

function getMapStoreAverageRating(store) {
    const revs = Array.isArray(store?.revs) ? store.revs : [];
    const ratings = revs
        .map(r => Number(r?.rating))
        .filter(v => Number.isFinite(v) && v > 0);
    if (ratings.length) {
        const sum = ratings.reduce((acc, n) => acc + n, 0);
        return sum / ratings.length;
    }
    const fallback = Number(store?.rating);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

function renderMapSummaryStars(score) {
    const filled = typeof window.getFilledRatingIconCount === 'function'
        ? window.getFilledRatingIconCount(score)
        : Math.floor(Math.max(0, Math.min(5, Number(score) || 0)));
    return Array.from({ length: 5 }).map((_, i) =>
        `<img src="images/pingfen.svg" width="14" style="opacity:${i < filled ? 1 : 0.3};">`
    ).join('');
}

function getMapHeaderMushroomCount(score) {
    if (typeof window.getFilledRatingIconCount === 'function') {
        return window.getFilledRatingIconCount(score);
    }
    return Math.floor(Math.max(0, Math.min(5, Number(score) || 0)));
}

function renderMapHeaderMushrooms(score) {
    const filled = getMapHeaderMushroomCount(score);
    return Array.from({ length: 5 }).map((_, i) =>
        `<img src="images/pingfen.svg" width="12" style="opacity:${i < filled ? 1 : 0.3};">`
    ).join('');
}

function resolveMapReviewAvatar(rev, idx) {
    const uid = String(rev?.uid || '');
    const me = window.currentUser || null;
    const profileImg = document.getElementById('profile-avatar-display');
    if (me && uid && me.uid === uid) {
        return me.photoURL || profileImg?.src || DEFAULT_AVATAR_URL;
    }
    if (uid && MAP_REVIEW_AVATAR_CACHE.has(uid)) {
        return MAP_REVIEW_AVATAR_CACHE.get(uid);
    }
    if (uid) {
        const friend = (window.allUsersCache || []).find(u => u.id === uid);
        if (friend?.avatarUrl) {
            MAP_REVIEW_AVATAR_CACHE.set(uid, friend.avatarUrl);
            return friend.avatarUrl;
        }
    }
    return DEFAULT_AVATAR_URL;
}

function isMyMapReview(rev) {
    if (!rev || typeof rev !== 'object') return false;
    const me = window.currentUser;
    if (!me) return false;
    const uid = String(rev.uid || '').toLowerCase();
    const meUid = String(me.uid || '').toLowerCase();
    if (uid && meUid && uid === meUid) return true;

    const aliases = new Set();
    if (me.email) {
        aliases.add(String(me.email).toLowerCase());
        if (String(me.email).includes('@')) aliases.add(String(me.email).split('@')[0].toLowerCase());
    }
    if (me.displayName) aliases.add(String(me.displayName).toLowerCase());
    const user = String(rev.user || '').toLowerCase();
    return !!(user && aliases.has(user));
}

function getSortedMapStoreReviews(store) {
    return (Array.isArray(store?.revs) ? [...store.revs] : [])
        .sort((a, b) => {
            const bTs = typeof window.getReviewEffectiveTimestamp === 'function'
                ? window.getReviewEffectiveTimestamp(b)
                : Number(b?.editedAt || b?.createdAt || 0);
            const aTs = typeof window.getReviewEffectiveTimestamp === 'function'
                ? window.getReviewEffectiveTimestamp(a)
                : Number(a?.editedAt || a?.createdAt || 0);
            return bTs - aTs;
        });
}

function buildMapReviewItems(store, scope = 'all') {
    const revs = getSortedMapStoreReviews(store);
    const aliasMap = buildFriendAliasMap();

    const allRevs = Array.isArray(store?.revs) ? store.revs : [];
    const reviewCountByUser = new Map();
    const reviewKeyFor = (r) => {
        if (!r || typeof r !== 'object') return '';
        const friend = resolveFriendFromReview(r, aliasMap);
        if (friend?.id) return `uid:${String(friend.id).toLowerCase()}`;
        if (r.uid) return `uid:${String(r.uid).toLowerCase()}`;
        const name = String(r.user || r.displayName || '').toLowerCase();
        return name ? `name:${name}` : '';
    };
    allRevs.forEach((r) => {
        const key = reviewKeyFor(r);
        if (!key) return;
        reviewCountByUser.set(key, (reviewCountByUser.get(key) || 0) + 1);
    });

    return revs.map((r, i) => {
        const userName = (typeof r === 'object' && (r.user || r.displayName)) ? (r.user || r.displayName) : 'User';
        const rating = Number((typeof r === 'object' && r.rating) || store?.rating || 0);
        const budgetNum = Number(r?.budget);
        const budget = Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : 0;
        const text = typeof r?.text === 'string' ? r.text.trim() : '';
        const imgs = Array.isArray(r?.images) ? r.images.filter(Boolean) : [];
        const avatar = resolveMapReviewAvatar(r, i);
        const dateStr = typeof window.formatReviewDisplayDateLabel === 'function'
            ? window.formatReviewDisplayDateLabel(r)
            : formatMapReviewDate(r?.createdAt);
        const isMine = isMyMapReview(r);
        const friendUser = resolveFriendFromReview(r, aliasMap);
        const isFriend = !!friendUser?.id;
        const originalIndex = allRevs.findIndex(item => item === r);
        const userKey = reviewKeyFor(r);
        const visitCount = userKey ? (reviewCountByUser.get(userKey) || 1) : 1;
        return {
            review: r,
            userName,
            rating,
            budget,
            text,
            imgs,
            avatar,
            dateStr,
            isMine,
            friendUser,
            isFriend,
            originalIndex,
            userKey,
            visitCount
        };
    }).filter((item) => {
        if (scope === 'mine') return item.isMine;
        if (scope === 'friends') return item.isFriend;
        return true;
    });
}

function renderMapReviewCardHtml(store, item, opts = {}) {
    const source = String(opts?.source || '').trim() || 'map';
    const reviewScope = String(opts?.reviewScope || '').trim();
    const reviewGalleryKey = typeof window.registerActivityImageGallery === 'function'
        ? window.registerActivityImageGallery(item.imgs.map(img => window.getImageAssetFullUrl ? window.getImageAssetFullUrl(img) : img).filter(Boolean))
        : '';
    const profileUid = item.isFriend
        ? item.friendUser.id
        : (item.review && item.review.uid ? item.review.uid : '');
    const canOpenProfile = !!profileUid && !item.isMine;
    const openProfileAttr = canOpenProfile
        ? `onclick="openFriendProfileFromReview('${profileUid}'); event.stopPropagation();"`
        : '';
    const friendBadge = item.isFriend ? `<span class="review-friend-badge">好友</span>` : '';
    const visitBadge = (item.visitCount && item.visitCount > 0)
        ? `<span class="review-visit-count">（吃过${item.visitCount}次）</span>`
        : '';
    const budgetBadge = item.budget > 0
        ? `<span class="review-budget">¥${item.budget}</span>`
        : '';
    const actionBtns = (item.isMine && item.originalIndex >= 0)
        ? `<div class="review-actions">
            <button class="review-edit-btn" onclick="openEditReviewComposer('${store.id}', ${item.originalIndex}, { source: '${source}', reviewScope: '${reviewScope}' }); event.stopPropagation();">编辑</button>
            <button class="review-delete-btn" onclick="deleteMyStoreReview('${store.id}', ${item.originalIndex}); event.stopPropagation();">删除</button>
        </div>`
        : '';

    return `
        <div class="review-card">
            <div class="review-header">
                <img src="${item.avatar}" class="review-avatar ${canOpenProfile ? 'is-clickable' : ''}" ${openProfileAttr}>
                <div class="review-user-info ${canOpenProfile ? 'is-clickable' : ''}" ${openProfileAttr}>
                    <div class="review-username">${item.userName}${friendBadge}${visitBadge}</div>
                    <div class="review-user-meta">${item.dateStr}</div>
                </div>
                ${actionBtns}
            </div>
            <div class="review-rating-row" style="margin-bottom:${item.text ? '8px' : '0'};">
                <b>${item.rating.toFixed(1)}</b>
                <span style="display:inline-flex; align-items:center; gap:2px; margin-left:6px;">${renderMapReviewRatingIcons(item.rating)}</span>
                ${budgetBadge}
            </div>
            ${item.text ? (typeof window.renderExpandableReviewText === 'function'
            ? window.renderExpandableReviewText(item.text, {
                textClassName: 'review-text',
                wrapperClassName: 'review-text-block'
            })
            : `<div class="review-text">${item.text}</div>`) : ''}
            ${item.imgs.length ? `<div class="review-images">${item.imgs.map((src, index) => {
            const fullSrc = window.getImageAssetFullUrl ? window.getImageAssetFullUrl(src) : String(src || '');
            const thumbSrc = window.getImageAssetThumbUrl ? window.getImageAssetThumbUrl(src) : fullSrc;
            if (!fullSrc || !thumbSrc) return '';
            return `<img src="${String(thumbSrc).replace(/"/g, '&quot;')}" loading="lazy" decoding="async" onclick="openActivityImageModal('${String(fullSrc).replace(/'/g, "\\'")}', '', '${reviewGalleryKey}', ${index}); event.stopPropagation();">`;
        }).join('')}</div>` : ''}
        </div>
    `;
}

function buildReviewGroups(items) {
    const groups = new Map();
    items.forEach((item, idx) => {
        const key = item.userKey || `anon:${idx}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });
    return Array.from(groups.entries()).map(([key, list]) => ({
        key,
        list
    }));
}

function renderReviewGroupHtml(store, group) {
    const [latest, ...rest] = group.list;
    const preview = rest.slice(0, 2);
    const total = group.list.length;
    const primaryHtml = renderMapReviewCardHtml(store, latest, { source: 'map' });
    if (total <= 1) {
        return `<div class="review-group" data-group-key="${encodeURIComponent(group.key)}">${primaryHtml}</div>`;
    }
    const moreHtml = preview.map(item => renderMapReviewCardHtml(store, item, { source: 'map' })).join('');
    const hasMoreThanShown = total > (1 + preview.length);
    const encKey = encodeURIComponent(group.key);
    const encName = encodeURIComponent(latest.userName || '');
    return `
        <div class="review-group" data-group-key="${encKey}">
            ${primaryHtml}
            <div class="review-group-expand-row">
                <button type="button" class="review-group-btn review-group-expand-btn" data-action="expand" data-group="${encKey}">展开更多 ▾</button>
            </div>
            <div class="review-group-more" data-group="${encKey}">
                <div class="review-group-more-inner">
                    ${moreHtml}
                    <div class="review-group-foot-row">
                        <button type="button" class="review-group-btn" data-action="collapse" data-group="${encKey}">收起 ▴</button>
                        ${hasMoreThanShown ? `<button type="button" class="review-group-btn review-group-view-all" data-action="view-all" data-group="${encKey}" data-user-name="${encName}">查看全部(${total}) ›</button>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function bindReviewGroupActions(container) {
    if (!container || container.dataset.groupBound === '1') return;
    container.dataset.groupBound = '1';
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || !container.contains(btn)) return;
        const action = btn.dataset.action;
        const groupEl = container.querySelector(`.review-group[data-group-key="${btn.dataset.group}"]`);
        if (!groupEl) return;
        e.stopPropagation();
        if (action === 'expand' || action === 'collapse') {
            const isOpen = groupEl.classList.toggle('is-expanded');
            const more = groupEl.querySelector('.review-group-more');
            if (more) {
                if (isOpen) {
                    const h = more.scrollHeight;
                    more.style.maxHeight = h + 'px';
                    more.addEventListener('transitionend', function onEnd() {
                        more.removeEventListener('transitionend', onEnd);
                        if (groupEl.classList.contains('is-expanded')) more.style.maxHeight = 'none';
                    });
                } else {
                    more.style.maxHeight = more.scrollHeight + 'px';
                    requestAnimationFrame(() => { more.style.maxHeight = '0px'; });
                }
            }
        } else if (action === 'view-all') {
            const userKey = decodeURIComponent(btn.dataset.group || '');
            const userName = decodeURIComponent(btn.dataset.userName || '');
            if (typeof window.openMapReviewSubpage === 'function') {
                window.openMapReviewSubpage('user', { userKey, userName });
            }
        }
    });
}

function appendNextReviewPage(reviewsList) {
    const state = reviewsList?._reviewPagination;
    if (!state) return;
    const { store, groups, rendered, pageSize } = state;
    if (rendered >= groups.length) return;
    const end = Math.min(groups.length, rendered + pageSize);
    const html = groups.slice(rendered, end).map(g => renderReviewGroupHtml(store, g)).join('');
    const placeholder = reviewsList.querySelector('.sheet-list-placeholder');
    if (placeholder) placeholder.insertAdjacentHTML('beforebegin', html);
    else reviewsList.insertAdjacentHTML('beforeend', html);
    state.rendered = end;
    if (end >= groups.length && placeholder) {
        placeholder.textContent = groups.length ? '没有更多评论了～' : '还没有评论';
    }
}

function bindReviewListInfiniteScroll(reviewsList) {
    const scroller = reviewsList.closest('.sheet-tab-content')
        || reviewsList.closest('.map-sheet.full')
        || reviewsList.closest('.map-sheet');
    if (!scroller || scroller.dataset.reviewInfiniteBound === '1') return;
    scroller.dataset.reviewInfiniteBound = '1';
    scroller.addEventListener('scroll', () => {
        const currentList = scroller.querySelector('#mp-reviews-list');
        if (!currentList || !currentList._reviewPagination) return;
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 120) {
            appendNextReviewPage(currentList);
        }
    });
}

function renderVisitRankingHtml(reviewItems) {
    if (!Array.isArray(reviewItems) || !reviewItems.length) return '';
    const byUser = new Map();
    reviewItems.forEach((item) => {
        const key = item.userKey || `name:${String(item.userName || '').toLowerCase()}`;
        if (!key) return;
        const rating = Number(item.rating);
        if (!byUser.has(key)) {
            byUser.set(key, {
                userName: item.userName || 'User',
                visitCount: item.visitCount || 1,
                ratingSum: 0,
                ratingCount: 0
            });
        }
        const u = byUser.get(key);
        if (Number.isFinite(rating) && rating > 0) {
            u.ratingSum += rating;
            u.ratingCount += 1;
        }
    });
    const list = Array.from(byUser.values())
        .filter(u => (u.visitCount || 0) >= 1)
        .sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0))
        .slice(0, 3);
    if (!list.length) return '';
    const medalClasses = ['gold', 'silver', 'bronze'];
    const rows = list.map((u, i) => {
        const avg = u.ratingCount > 0 ? (u.ratingSum / u.ratingCount) : 0;
        const avgHtml = avg > 0
            ? `<span class="visit-rank-avg">${avg.toFixed(1)}<img src="images/mogu.svg" class="visit-rank-avg-icon"></span>`
            : '';
        return `
        <div class="visit-rank-row">
            <span class="visit-rank-medal visit-rank-medal-${medalClasses[i]}">${i + 1}</span>
            <span class="visit-rank-name">${escapeHtml(u.userName)}</span>
            <span class="visit-rank-count">（吃过${u.visitCount}次）</span>
            ${avgHtml}
        </div>
        `;
    }).join('');
    return `<div class="visit-ranking-title">最爱吃这家店的人</div>${rows}`;
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMapReviewsAndAlbum(store) {
    const revs = getSortedMapStoreReviews(store);
    const reviewItems = buildMapReviewItems(store, 'all');

    const rankingEl = document.getElementById('mp-visit-ranking');
    if (rankingEl) {
        rankingEl.innerHTML = renderVisitRankingHtml(reviewItems);
    }

    const reviewsList = document.getElementById('mp-reviews-list');
    if (reviewsList) {
        const groups = buildReviewGroups(reviewItems);
        const pageSize = 20;
        const initial = Math.min(pageSize, groups.length);
        const reviewCards = groups.slice(0, initial).map(g => renderReviewGroupHtml(store, g)).join('');
        const capText = initial >= groups.length
            ? (revs.length ? '没有更多评论了～' : '还没有评论')
            : '下拉加载更多';
        reviewsList.innerHTML = `${reviewCards}<div class="sheet-list-placeholder">${capText}</div>`;
        reviewsList._reviewPagination = { store, groups, rendered: initial, pageSize };
        bindReviewWheelProxy(reviewsList);
        bindReviewGroupActions(reviewsList);
        bindReviewListInfiniteScroll(reviewsList);
    }

    const previewEntries = (typeof window.getStorePreviewImageEntries === 'function')
        ? window.getStorePreviewImageEntries(store, 300)
        : Array.from(new Set([
            ...(Array.isArray(store?.images) ? store.images : []),
            ...revs.flatMap(r => Array.isArray(r?.images) ? r.images : [])
        ].filter(Boolean)));
    const albumGrid = document.getElementById('mp-album-grid');
    if (albumGrid) {
        const albumGalleryKey = typeof window.registerActivityImageGallery === 'function'
            ? window.registerActivityImageGallery(previewEntries.map(entry => window.getImageAssetFullUrl ? window.getImageAssetFullUrl(entry) : entry).filter(Boolean))
            : '';
        const photoItems = previewEntries.length
            ? previewEntries.map((src, index) => {
                const fullSrc = window.getImageAssetFullUrl ? window.getImageAssetFullUrl(src) : String(src || '');
                const thumbSrc = window.getImageAssetThumbUrl ? window.getImageAssetThumbUrl(src) : fullSrc;
                if (!fullSrc || !thumbSrc) return '';
                return `<img src="${String(thumbSrc).replace(/"/g, '&quot;')}" loading="lazy" decoding="async" onclick="openActivityImageModal('${String(fullSrc).replace(/'/g, "\\'")}', '', '${albumGalleryKey}', ${index}); event.stopPropagation();">`;
            }).join('')
            : '';
        const photoPlaceholderText = previewEntries.length ? '没有更多图片了～' : '还没有图片';
        albumGrid.innerHTML = `
            ${photoItems}
            <div class="sheet-list-placeholder sheet-list-placeholder-photos">${photoPlaceholderText}</div>
        `;
    }

    const revCountEl = document.getElementById('mp-review-count');
    const albumCountEl = document.getElementById('mp-album-count');
    if (revCountEl) revCountEl.innerText = String(revs.length);
    if (albumCountEl) albumCountEl.innerText = String(previewEntries.length);

    const avgRating = (typeof window.getStoreAverageRating === 'function')
        ? window.getStoreAverageRating(store)
        : getMapStoreAverageRating(store);
    const avgEl = document.querySelector('#sheet-tab-reviews .review-avg');
    if (avgEl) avgEl.innerText = avgRating > 0 ? avgRating.toFixed(1) : '0.0';
    const avgStarsEl = document.querySelector('#sheet-tab-reviews .review-stars');
    if (avgStarsEl) avgStarsEl.innerHTML = renderMapSummaryStars(avgRating);
}

function renderMapReviewSubpage(store, scope = 'mine') {
    const titleEl = document.getElementById('map-review-subpage-title');
    const listEl = document.getElementById('map-review-subpage-list');
    if (!titleEl || !listEl) return;

    let items;
    let title;
    let emptyText;
    if (scope === 'user') {
        const card = document.getElementById('map-detail-card');
        const userKey = card?.dataset?.reviewUserKey || '';
        const userName = card?.dataset?.reviewUserName || '';
        items = buildMapReviewItems(store, 'all').filter(it => it.userKey === userKey);
        title = userName ? `${userName}的评价` : '用户评价';
        emptyText = '暂无评价';
    } else {
        items = buildMapReviewItems(store, scope);
        title = scope === 'friends' ? '朋友评价' : '我的评价';
        emptyText = scope === 'friends' ? '这家店还没有好友评价' : '你还没有评价过这家店';
    }
    titleEl.innerText = title;

    if (!items.length) {
        listEl.innerHTML = `<div class="sheet-subpage-empty">${emptyText}</div>`;
        return;
    }

    listEl.innerHTML = items.map(item => renderMapReviewCardHtml(store, item, {
        source: 'map-review',
        reviewScope: scope
    })).join('');
}

window.openMapReviewSubpage = (scope = 'mine', opts = {}) => {
    const card = document.getElementById('map-detail-card');
    const storeId = card?.dataset?.storeId || '';
    const store = (window.localStores || []).find(s => s.id === storeId);
    const overlay = document.getElementById('map-review-overlay');
    if (!card || !store || !overlay) return;
    card.dataset.reviewScope = scope;
    if (scope === 'user') {
        card.dataset.reviewUserKey = String(opts?.userKey || '');
        card.dataset.reviewUserName = String(opts?.userName || '');
    } else {
        delete card.dataset.reviewUserKey;
        delete card.dataset.reviewUserName;
    }
    renderMapReviewSubpage(store, scope);
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    bindMapReviewOverlaySwipe(overlay);
};

function bindMapReviewOverlaySwipe(overlay) {
    bindSwipeBackToClose(overlay, {
        isOpen: () => overlay.classList.contains('is-open'),
        onClose: () => { if (typeof window.closeMapReviewSubpage === 'function') window.closeMapReviewSubpage(); }
    });
}

window.bindSwipeBackToClose = function bindSwipeBackToClose(el, opts = {}) {
    if (!el || el.dataset.swipeBound === '1') return;
    el.dataset.swipeBound = '1';
    const isOpen = typeof opts.isOpen === 'function' ? opts.isOpen : () => true;
    const onClose = typeof opts.onClose === 'function' ? opts.onClose : () => {};
    const onDrag = typeof opts.onDrag === 'function' ? opts.onDrag : null;
    const onReset = typeof opts.onReset === 'function' ? opts.onReset : null;
    const onSettleClose = typeof opts.onSettleClose === 'function' ? opts.onSettleClose : null;
    let startX = 0, startY = 0, dx = 0, dragging = false, locked = false;
    const width = () => el.getBoundingClientRect().width || 400;
    const onDown = (e) => {
        if (!isOpen()) return;
        const t = e.touches ? e.touches[0] : e;
        startX = t.clientX; startY = t.clientY;
        dx = 0; dragging = true; locked = false;
    };
    const onMove = (e) => {
        if (!dragging) return;
        const t = e.touches ? e.touches[0] : e;
        const deltaX = t.clientX - startX;
        const deltaY = t.clientY - startY;
        if (!locked) {
            if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
            if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
                locked = true;
                el.style.transition = 'none';
            } else {
                dragging = false;
                return;
            }
        }
        dx = Math.max(0, deltaX);
        el.style.transform = `translateX(${dx}px)`;
        if (onDrag) onDrag(dx, width());
        if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
        if (!dragging) return;
        const wasLocked = locked;
        dragging = false; locked = false;
        el.style.transition = '';
        if (!wasLocked) { el.style.transform = ''; return; }
        const w = width();
        if (dx > w * 0.3) {
            el.style.transform = `translateX(${w}px)`;
            if (onSettleClose) onSettleClose();
            onClose();
            setTimeout(() => { el.style.transform = ''; if (onReset) onReset(); }, 300);
        } else {
            el.style.transform = '';
            if (onReset) onReset();
        }
        dx = 0;
    };
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onUp);
    el.addEventListener('touchcancel', onUp);
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') onDown(e); });
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && dragging) onMove(e); });
    el.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') onUp(e); });
    el.addEventListener('pointercancel', (e) => { if (e.pointerType === 'mouse') onUp(e); });
};

window.closeMapReviewSubpage = (opts = {}) => {
    const { keepScope = false } = opts || {};
    const overlay = document.getElementById('map-review-overlay');
    const card = document.getElementById('map-detail-card');
    if (!overlay) return;
    if (card && !keepScope) delete card.dataset.reviewScope;
    overlay.classList.remove('is-open');
    setTimeout(() => {
        if (!overlay.classList.contains('is-open')) overlay.classList.add('hidden');
    }, 280);
};

function bindReviewWheelProxy(reviewsList) {
    if (!reviewsList || reviewsList.dataset.wheelBound === '1') return;
    reviewsList.dataset.wheelBound = '1';
    reviewsList.addEventListener('wheel', (event) => {
        const isHorizontalGallery = !!event.target?.closest?.('.review-images');
        if (isHorizontalGallery && Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

        const scrollTarget = reviewsList.closest('.sheet-tab-content')
            || reviewsList.closest('.map-sheet.full')
            || reviewsList.closest('.map-sheet.half')
            || reviewsList.closest('.map-sheet');
        if (!scrollTarget) return;
        const canScroll = scrollTarget.scrollHeight > scrollTarget.clientHeight + 2;
        if (!canScroll) return;

        scrollTarget.scrollTop += event.deltaY;
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
        }
    }, { passive: false });
}

/* =========================================
   1. 初始化地图
   创建Google地图实例并添加基础标记
   ========================================= */
window.initMap = () => {
    // 检查地图容器是否存在
    if (!document.getElementById('google-map')) return;

    if (map && window.google?.maps) {
        const center = getMapCenterFromOrigin();
        const zoom = map.getZoom ? map.getZoom() : null;
        google.maps.event.trigger(map, 'resize');
        if (center) map.setCenter(center);
        if (Number.isFinite(zoom)) map.setZoom(zoom);
        renderCurrentOriginMarker();
        window.renderMarkers();
        return;
    }

    // ==========================================
    // 定义自定义标记类（SimpleMarker）
    // 继承自 Google Maps OverlayView
    // 用于在地图上显示自定义样式的图钉
    // ==========================================
    class SimpleMarker extends google.maps.OverlayView {
        /**
         * 创建自定义标记
         * @param {google.maps.LatLng} latlng - 标记位置
         * @param {string} htmlClass - CSS类名（用于设置样式）
         * @param {string} iconHtml - 图标HTML内容
         * @param {Function} onClick - 点击回调函数
         */
        constructor(latlng, htmlClass, iconHtml, onClick) {
            super();
            this.latlng = latlng;
            this.htmlClass = htmlClass;
            this.iconHtml = iconHtml;
            this.onClick = onClick;
            this.div = null;
            this.size = MAP_PIN_SIZE;
        }

        // 当标记被添加到地图时调用
        onAdd() {
            this.div = document.createElement('div');
            this.div.className = `map-pin ${this.htmlClass}`;
            this.div.innerHTML = this.iconHtml;
            // 绑定点击事件
            this.div.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onClick) this.onClick();
            });
            // 添加到地图覆盖层
            const panes = this.getPanes();
            panes.overlayMouseTarget.appendChild(this.div);
        }

        // 每次地图移动/缩放时重新计算标记位置
        draw() {
            if (!this.div) return;
            const projection = this.getProjection();
            const point = projection.fromLatLngToDivPixel(this.latlng);
            if (point) {
                const left = Math.round(point.x - (this.size / 2));
                const top = Math.round(point.y - (this.size / 2));
                this.div.style.left = left + 'px';
                this.div.style.top = top + 'px';
            }
        }

        // 当标记从地图移除时调用
        onRemove() {
            if (this.div) {
                this.div.parentNode.removeChild(this.div);
                this.div = null;
            }
        }
    }
    // 将类暴露到全局，供 renderMarkers 使用
    window.SimpleMarkerClass = SimpleMarker;

    // ==========================================
    // 创建地图实例
    // ==========================================
    map = new google.maps.Map(document.getElementById('google-map'), {
        center: getMapCenterFromOrigin(),
        zoom: 15,                       // 缩放级别
        disableDefaultUI: true,         // 禁用默认控件
        // 隐藏POI标签（商店、餐厅等默认标记）
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });

    // 显示当前起点标记（Cocoon=蓝，GPS=红）
    renderCurrentOriginMarker();

    // 渲染店铺标记（如果数据已加载）
    window.renderMarkers();

    // ==========================================
    // 绑定搜索框事件
    // ==========================================
    const qInput = document.getElementById('q');
    if (qInput) {
        if (qInput.dataset.bound !== '1') {
            qInput.dataset.bound = '1';
            qInput.addEventListener('focus', () => {
                if ((qInput.value || '').trim()) performMapSearch();
            });
            qInput.addEventListener('click', () => {
                if ((qInput.value || '').trim()) performMapSearch();
            });
            qInput.addEventListener("keypress", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    performMapSearch();
                }
            });
            qInput.addEventListener('input', () => {
                const q = (qInput.value || "").trim();
                updateMapSearchClearButton();
                clearTimeout(mapSearchDebounceTimer);
                if (q.length < 1) {
                    const l = document.getElementById('results');
                    if (l) {
                        l.classList.remove('active');
                        l.innerHTML = "";
                    }
                    lastMapQuery = "";
                    return;
                }
                mapSearchDebounceTimer = setTimeout(() => {
                    if (q === lastMapQuery) return;
                    lastMapQuery = q;
                    performMapSearch();
                }, 220);
            });
        }
    }

    if (document.getElementById('clearBtn')) {
        document.getElementById('clearBtn').onclick = clearMapSearchInput;
    }
    updateMapSearchClearButton();

    if (!document.body.dataset.mapSearchDismissBound) {
        document.body.dataset.mapSearchDismissBound = '1';
        document.addEventListener('click', (e) => {
            const target = e.target;
            const input = document.getElementById('q');
            const results = document.getElementById('results');
            const card = document.querySelector('.map-search-card');
            if (!input || !results || !card) return;
            if (card.contains(target) || results.contains(target)) return;
            results.classList.remove('active');
        });
    }
};

window.refreshCurrentOriginMarker = renderCurrentOriginMarker;

/* =========================================
   2. 渲染店铺标记
   在地图上显示所有店铺的图钉
   根据店铺状态（好吃/难吃/想吃）显示不同颜色
   ========================================= */
window.renderMarkers = () => {
    if (!map) return;

    // 清除旧的图钉
    storeMarkers.forEach(m => m.setMap(null));
    storeMarkers = [];

    // 获取数据（从 app.js 共享的全局变量）
    const stores = window.localStores || [];
    const myFavs = window.myFavIds || [];
    const likes = window.localLikes || new Set();
    const dislikes = window.localDislikes || new Set();

    // 遍历所有店铺，创建标记
    stores.forEach(store => {
        // 跳过没有坐标的店铺
        if (!store.lat || !store.lng) return;
        if (activePinnedStoreId && store.id === activePinnedStoreId) return;

        // 默认样式
        let pinClass = "pin-default";
        let iconHtml = getMapPinMarkup('default');

        // 根据状态设置不同颜色
        // 优先级：难吃(蓝) > 好吃(红) > 想吃(黄) > 默认
        if (dislikes.has(store.id)) {
            pinClass = "pin-dislike";
            iconHtml = getMapPinMarkup('dislike');
        } else if (likes.has(store.id)) {
            pinClass = "pin-like";
            iconHtml = getMapPinMarkup('like');
        } else if (myFavs.includes(store.id)) {
            pinClass = "pin-fav";
            iconHtml = getMapPinMarkup('fav');
        }

        // 创建标记
        const pos = new google.maps.LatLng(store.lat, store.lng);
        const marker = new window.SimpleMarkerClass(
            pos,
            pinClass,
            iconHtml,
            () => {
                // 点击标记时：移动地图并显示详情卡片
                window.renderMapCardFromDB(store, { mode: 'half', fromMap: true });
                requestAnimationFrame(() => {
                    panToStoreKeepingVisible(pos, 'half');
                });
                refreshMapSearchListHighlight();
            }
        );

        marker.setMap(map);
        storeMarkers.push(marker);
    });
};

/* =========================================
   3. 渲染地图详情卡片（从数据库数据）
   显示店铺的详细信息
   ========================================= */
window.renderMapCardFromDB = (store, opts = {}) => {
    const { mode = 'half', fromMap = false, sourceView = '', reviewScope = '', suppressAnimation = false } = opts || {};
    mountMapSheetToAppRoot();
    stopMapFriendPreviewRotation();

    if (!store) return;
    const card = document.getElementById('map-detail-card');
    const overlay = document.getElementById('map-review-overlay');
    if (!card) return;
    const sameStore = String(card.dataset.storeId || '') === String(store.id || '');
    const preservedReviewScope = String(reviewScope || (sameStore ? card.dataset.reviewScope || '' : '')).trim();
    if (!preservedReviewScope && typeof window.closeMapReviewSubpage === 'function') {
        window.closeMapReviewSubpage({ keepScope: !!preservedReviewScope });
    }
    card.dataset.storeId = store.id || "";
    card.dataset.sourceView = String(sourceView || document.querySelector('#app > section:not(.hidden)')?.id || '')
        .replace(/^view-/, '') || (fromMap ? 'map' : '');
    card.dataset.fromMap = fromMap ? '1' : '0';
    if (preservedReviewScope) {
        card.dataset.reviewScope = preservedReviewScope;
    } else {
        delete card.dataset.reviewScope;
    }
    setSelectedStorePin(store);

    // 1. 填充基本信息
    const nameEl = document.getElementById('mp-name');
    if (nameEl) {
        nameEl.innerHTML = (typeof window.renderStoreNameWithStatus === 'function')
            ? window.renderStoreNameWithStatus(store)
            : (store.name || '店铺');
    }

    const subNameEl = document.getElementById('mp-sub-name');
    if (subNameEl) subNameEl.innerText = store.name;

    const avgRating = (typeof window.getStoreAverageRating === 'function')
        ? window.getStoreAverageRating(store)
        : getMapStoreAverageRating(store);
    const ratingEl = document.getElementById('mp-rating-val');
    if (ratingEl) ratingEl.innerText = avgRating > 0 ? avgRating.toFixed(1) : "0.0";
    const ratingStarsEl = document.getElementById('mp-rating-stars');
    if (ratingStarsEl) ratingStarsEl.innerHTML = renderMapHeaderMushrooms(avgRating);
    const ratingCountEl = document.getElementById('mp-rating-count');
    const reviewCount = Array.isArray(store?.revs) ? store.revs.length : 0;
    if (ratingCountEl) ratingCountEl.innerText = `(${reviewCount})`;

    const timeEl = document.getElementById('mp-fake-time');
    if (timeEl) {
        timeEl.innerText = formatMapDistanceText(store);
    }

    const addressEl = document.getElementById('mp-address');
    if (addressEl) addressEl.innerText = store.address || store.formattedAddress || '地址未收录';

    const openTimeEl = document.getElementById('mp-open-time');
    if (openTimeEl) {
        const isClosed = typeof window.isStorePermanentlyClosed === 'function' && window.isStorePermanentlyClosed(store);
        const text = (typeof window.getStoreOpenTimeText === 'function')
            ? window.getStoreOpenTimeText(store)
            : (isClosed ? '永久歇业' : (store.openNow ? '营业中' : '未知'));
        openTimeEl.innerText = text;
        openTimeEl.classList.toggle('permanent-closed', !!isClosed);
    }

    // 我的评分：有评分显示分数；没有评分显示“暂无评分”
    const myScoreEl = document.getElementById('mp-my-score');
    const myScoreIcon = document.getElementById('mp-my-score-icon');
    const myRevs = (Array.isArray(store?.revs) ? store.revs : [])
        .filter(r => isMyMapReview(r))
        .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    const latestMyRating = myRevs.length ? Number(myRevs[0]?.rating) : NaN;
    const hasMyRating = Number.isFinite(latestMyRating) && latestMyRating > 0;
    if (myScoreEl) {
        myScoreEl.innerText = hasMyRating ? latestMyRating.toFixed(1) : '暂无评分';
        myScoreEl.classList.toggle('empty', !hasMyRating);
    }
    if (myScoreIcon) myScoreIcon.style.display = hasMyRating ? 'inline-block' : 'none';

    mapCardState.checkInCount = myRevs.length;
    updateCheckInBtnUI();

    // 2. 设置地图导航目标
    if (window.setMapTarget && store.lat && store.lng) {
        window.setMapTarget(store.lat, store.lng);
    } else if (store.lat && store.lng) {
        currentMapDest = { lat: parseFloat(store.lat), lng: parseFloat(store.lng) };
    }

    // 3. 图片
    const photoContainer = document.getElementById('mp-photos');
    if (photoContainer) {
        photoContainer.innerHTML = "";
        const previewImages = (typeof window.getStorePreviewImageEntries === 'function')
            ? window.getStorePreviewImageEntries(store, 80)
            : (Array.isArray(store?.images) ? store.images : []);
        if (previewImages.length) {
            const previewGalleryKey = typeof window.registerActivityImageGallery === 'function'
                ? window.registerActivityImageGallery(previewImages.map(entry => window.getImageAssetFullUrl ? window.getImageAssetFullUrl(entry) : entry).filter(Boolean))
                : '';
            previewImages.forEach((src, index) => {
                const fullSrc = window.getImageAssetFullUrl ? window.getImageAssetFullUrl(src) : String(src || '');
                const thumbSrc = window.getImageAssetThumbUrl ? window.getImageAssetThumbUrl(src) : fullSrc;
                if (!fullSrc || !thumbSrc) return;
                const img = document.createElement('img');
                img.src = thumbSrc;
                img.className = 'mp-photo-item';
                img.loading = 'lazy';
                img.decoding = 'async';
                img.onclick = (e) => {
                    e.stopPropagation();
                    if (window.openActivityImageModal) window.openActivityImageModal(fullSrc, '', previewGalleryKey, index);
                };
                photoContainer.appendChild(img);
            });
        } else {
            photoContainer.innerHTML = "<div style='padding:20px; color:#999; text-align:center; font-size:12px;'>暂无图片</div>";
        }
    }

    // 4. 信息卡
    const sheetFullContent = card.querySelector('.sheet-full-content');
    if (sheetFullContent) {
        let infoContainer = document.getElementById('sheet-info-container');
        if (!infoContainer) {
            infoContainer = document.createElement('div');
            infoContainer.id = 'sheet-info-container';
            sheetFullContent.prepend(infoContainer);
        }
        if (window.generateInfoCardHtml) {
            infoContainer.innerHTML = window.generateInfoCardHtml(store);
        }
    }

    mapCardState.friendSocial = computeMapFriendSocial(store.id || "");
    refreshMapSocialButtonsUI();
    refreshMapFriendSection(store);
    if (!Array.isArray(window.allUsersCache) || !window.allUsersCache.length) {
        if (typeof window.ensureAllUsersLoaded === 'function') {
            window.ensureAllUsersLoaded().then(() => {
                mapCardState.friendSocial = computeMapFriendSocial(store.id || "");
                refreshMapSocialButtonsUI();
                refreshMapFriendSection(store);
            }).catch(() => { });
        }
    }

    // 5. 评论 + 相册（真实数据）
    renderMapReviewsAndAlbum(store);
    refreshMapSearchListHighlight();

    // 6. 重置按钮状态
    const btnRoute = document.getElementById('btn-check-route');
    if (btnRoute) {
        btnRoute.innerHTML = "在谷歌地图查看";
        btnRoute.disabled = false;
    }

    // 7. 显示 sheet（统一样式）
    card.classList.remove('peek', 'full', 'half');
    card.classList.toggle('no-entry-animation', !!suppressAnimation);
    card.classList.add('active');
    card.dataset.openedAt = String(Date.now());
    setMapSheetMode(mode);
    setMapSheetBackdrop(true);
    if (window.switchSheetTab) window.switchSheetTab('reviews');
    // 每次打开都滚回顶部，避免显示上次滚动位置
    card.scrollTop = 0;
    card.querySelectorAll('.sheet-tab-content, .reviews-list, .sheet-full-content').forEach(el => {
        el.scrollTop = 0;
    });
    if (window.lucide) window.lucide.createIcons();
    if (suppressAnimation) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                card.classList.remove('no-entry-animation');
            });
        });
    }
    if (preservedReviewScope && overlay) {
        renderMapReviewSubpage(store, preservedReviewScope);
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => overlay.classList.add('is-open'));
    }
};
/* =========================================
   4. Google Places 搜索
   使用Google Places API搜索店铺
   ========================================= */

function normalizePlaceDisplayName(nameLike) {
    if (!nameLike) return '';
    if (typeof nameLike === 'string') return nameLike.trim();
    if (typeof nameLike?.text === 'string') return nameLike.text.trim();
    return '';
}

function withPreferredPlaceName(basePlace = {}, localName = '', englishName = '') {
    const next = { ...basePlace };
    const preferredName = String(localName || englishName || normalizePlaceDisplayName(basePlace?.displayName) || '').trim();
    next.preferredName = preferredName;
    next.localName = String(localName || '').trim();
    next.englishName = String(englishName || '').trim();
    next.displayName = {
        text: preferredName,
        languageCode: next.localName ? 'ja' : (next.englishName ? 'en' : (basePlace?.displayName?.languageCode || ''))
    };
    return next;
}

async function runPlacesSearchRequest(body, fieldMask, languageCode = 'ja') {
    const payload = {
        ...body,
        languageCode
    };
    const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': MAPS_API_KEY,
            'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(payload)
    });
    return (await response.json()).places || [];
}

async function runPlacesNearbyRequest(body, fieldMask, languageCode = 'ja') {
    const payload = {
        ...body,
        languageCode
    };
    const response = await fetch(`https://places.googleapis.com/v1/places:searchNearby`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': MAPS_API_KEY,
            'X-Goog-FieldMask': fieldMask
        },
        body: JSON.stringify(payload)
    });
    return (await response.json()).places || [];
}

function mergeLocalizedPlaceResults(localizedPlaces = [], englishPlaces = []) {
    const localMap = new Map(localizedPlaces.map((p) => [p.id || '', p]));
    const englishMap = new Map(englishPlaces.map((p) => [p.id || '', p]));
    const ids = new Set([...localMap.keys(), ...englishMap.keys()].filter(Boolean));

    return Array.from(ids).map((id) => {
        const localPlace = localMap.get(id);
        const englishPlace = englishMap.get(id);
        const base = localPlace || englishPlace || {};
        const localName = normalizePlaceDisplayName(localPlace?.displayName);
        const englishName = normalizePlaceDisplayName(englishPlace?.displayName);
        return withPreferredPlaceName(base, localName, englishName);
    });
}

window.fetchPreferredPlaceNameById = async (placeId) => {
    const safeId = String(placeId || '').trim();
    if (!safeId) throw new Error('缺少 placeId');
    const encodedId = encodeURIComponent(safeId);

    let localName = '';
    let englishName = '';
    try {
        const rJa = await fetch(`https://places.googleapis.com/v1/places/${encodedId}?languageCode=ja`, {
            headers: {
                'X-Goog-Api-Key': MAPS_API_KEY,
                'X-Goog-FieldMask': 'displayName',
                'Content-Type': 'application/json'
            }
        });
        if (rJa.ok) {
            const ja = await rJa.json();
            localName = normalizePlaceDisplayName(ja?.displayName);
        }
    } catch (err) {
        console.warn('获取日文店名失败:', err);
    }
    try {
        const rEn = await fetch(`https://places.googleapis.com/v1/places/${encodedId}?languageCode=en`, {
            headers: {
                'X-Goog-Api-Key': MAPS_API_KEY,
                'X-Goog-FieldMask': 'displayName',
                'Content-Type': 'application/json'
            }
        });
        if (rEn.ok) {
            const en = await rEn.json();
            englishName = normalizePlaceDisplayName(en?.displayName);
        }
    } catch (err) {
        console.warn('获取英文店名失败:', err);
    }
    return {
        preferredName: localName || englishName || '',
        localName,
        englishName
    };
};

/**
 * 搜索店铺
 * @param {string} q - 搜索关键词
 * @param {boolean} photo - 是否获取照片
 * @returns {Array} 搜索结果数组
 */
window.placesSearchText = async (q, photo = false) => {
    // 构建请求字段
    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types' + (photo ? ',places.photos' : '');
    try {
        const cuisineIntent = typeof window.resolveCuisineSearchIntent === 'function'
            ? window.resolveCuisineSearchIntent(q)
            : null;
        const body = {
            textQuery: cuisineIntent?.replaceQuery ? cuisineIntent.searchQuery : q
        };
        if (cuisineIntent?.type) {
            body.includedType = cuisineIntent.type;
            body.strictTypeFiltering = true;
        }
        const [localPlaces, englishPlaces] = await Promise.all([
            runPlacesSearchRequest(body, f, 'ja'),
            runPlacesSearchRequest(body, f, 'en')
        ]);
        return mergeLocalizedPlaceResults(localPlaces, englishPlaces);
    } catch (e) {
        console.error(e);
        return [];
    }
};

window.placesSearchTextByBounds = async (q, bounds, photo = false) => {
    if (!q || !bounds || !window.google?.maps) return [];
    const ne = bounds.getNorthEast?.();
    const sw = bounds.getSouthWest?.();
    if (!ne || !sw) return [];

    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types' + (photo ? ',places.photos' : '');
    try {
        const cuisineIntent = typeof window.resolveCuisineSearchIntent === 'function'
            ? window.resolveCuisineSearchIntent(q)
            : null;
        const body = {
            textQuery: cuisineIntent?.replaceQuery ? cuisineIntent.searchQuery : q,
            locationRestriction: {
                rectangle: {
                    low: { latitude: sw.lat(), longitude: sw.lng() },
                    high: { latitude: ne.lat(), longitude: ne.lng() }
                }
            }
        };
        if (cuisineIntent?.type) {
            body.includedType = cuisineIntent.type;
            body.strictTypeFiltering = true;
        }
        const [localPlaces, englishPlaces] = await Promise.all([
            runPlacesSearchRequest(body, f, 'ja'),
            runPlacesSearchRequest(body, f, 'en')
        ]);
        return mergeLocalizedPlaceResults(localPlaces, englishPlaces);
    } catch (e) {
        console.error(e);
        return [];
    }
};

window.placesSearchNearby = async (center, opts = {}) => {
    const lat = Number(center?.lat);
    const lng = Number(center?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    const radius = Math.max(1, Math.min(500, Number(opts.radius) || 100));
    const maxResultCount = Math.max(1, Math.min(20, Number(opts.maxResultCount) || 20));
    const includedTypes = Array.isArray(opts.includedTypes) && opts.includedTypes.length
        ? opts.includedTypes
        : ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'];
    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types,places.photos';

    try {
        const body = {
            includedTypes,
            maxResultCount,
            locationRestriction: {
                circle: {
                    center: { latitude: lat, longitude: lng },
                    radius
                }
            },
            rankPreference: 'DISTANCE'
        };
        const [localPlaces, englishPlaces] = await Promise.all([
            runPlacesNearbyRequest(body, f, 'ja'),
            runPlacesNearbyRequest(body, f, 'en')
        ]);
        return mergeLocalizedPlaceResults(localPlaces, englishPlaces);
    } catch (e) {
        console.error(e);
        return [];
    }
};

/**
 * 执行地图搜索
 * 在地图上搜索并显示结果
 */
window.performMapSearch = async () => {
    const q = (document.getElementById('q').value || "").trim();
    if (!q) return;

    const scoreFn = typeof window.scoreStoreSearch === 'function'
        ? window.scoreStoreSearch
        : ((query, store) => {
            const keyword = String(query || '').toLowerCase();
            const name = String(store?.name || "").toLowerCase();
            const address = String(store?.address || store?.formattedAddress || "").toLowerCase();
            return (name.includes(keyword) || address.includes(keyword)) ? 1 : 0;
        });
    const stores = (window.localStores || []).map(s => ({
        store: s,
        score: scoreFn(q, s)
    })).filter(({ store, score }) =>
        score > 0 && Number.isFinite(Number(store.lat)) && Number.isFinite(Number(store.lng))
    ).sort((a, b) => b.score - a.score).map(({ store }) => store);
    const l = document.getElementById('results');
    l.innerHTML = "";
    l.classList.add('active');

    const hintHtml = `<div class="map-results-hint">只包含mogumode已标记店铺</div>`;
    if (!stores.length) {
        l.innerHTML = `${hintHtml}<div style='padding:10px'>No results</div>`;
        return;
    }

    l.innerHTML = hintHtml;

    // 显示本地收录结果（最多8个）
    const activeStoreId = getActiveMapStoreId();
    stores.slice(0, 8).forEach(s => {
        const d = document.createElement('div');
        d.className = `result-item ${activeStoreId && s.id === activeStoreId ? 'active' : ''}`;
        const nameHtml = (typeof window.renderStoreNameWithStatus === 'function')
            ? window.renderStoreNameWithStatus(s)
            : (s.name || "未命名店铺");
        d.innerHTML = `
            <div class="result-item-name"><b>${nameHtml}</b></div>
            <small>${s.address || s.formattedAddress || "地址未收录"}</small>
        `;

        // 点击搜索结果
        d.onclick = () => {
            l.classList.remove('active');
            document.getElementById('q').value = s.name || "";
            updateMapSearchClearButton();

            const dest = { lat: Number(s.lat), lng: Number(s.lng) };
            currentMapDest = dest;
            map.setZoom(16);

            // 显示详情卡片
            window.renderMapCardFromDB(s, { mode: 'half', fromMap: true });
            requestAnimationFrame(() => {
                panToStoreKeepingVisible(dest, 'half');
            });
            refreshMapSearchListHighlight();
        };
        l.appendChild(d);
    });
};

/* =========================================
   5. 渲染地图详情卡片（从搜索数据）
   显示搜索结果的详细信息
   ========================================= */
function renderMapCardData(p) {
    // 先检查数据库中是否已有这个店铺
    const stores = window.localStores || [];
    const placeName = String(p?.preferredName || p?.displayName?.text || "").trim();
    const dbStore = stores.find(s => s.name === placeName);
    if (dbStore && dbStore.lat) {
        // 数据库中有，使用数据库数据渲染
        window.renderMapCardFromDB(dbStore, { mode: 'half', fromMap: true });
        return;
    }

    // 数据库中没有，显示Google搜索数据
    mountMapSheetToAppRoot();
    document.getElementById('mp-name').innerText = placeName;
    document.getElementById('mp-rating-val').innerText = "3.8";  // 假数据
    document.getElementById('mp-fake-time').innerText = formatMapDistanceText({
        lat: p?.location?.latitude,
        lng: p?.location?.longitude
    });
    document.getElementById('mp-photos').innerHTML = "<div style='padding:20px; color:#999; text-align:center;'>暂无收录图片</div>";

    const btnRoute = document.getElementById('btn-check-route');
    btnRoute.innerHTML = "<span>在谷歌地图查看</span>";
    btnRoute.disabled = false;

    // 标记为"未收录"
    const countSpan = document.querySelector('#map-detail-card .mp-sub-row span:nth-child(3)');
    if (countSpan) countSpan.innerText = "(未收录)";

    const card = document.getElementById('map-detail-card');
    if (card) {
        card.classList.remove('full');
        card.classList.add('active', 'half');
    }
    setMapSheetBackdrop(true);
    lucide.createIcons();
}

/* =========================================
   6. 路线规划
   使用Google Routes API计算并显示步行路线
   ========================================= */
// map.js

window.showRouteOnMap = async () => {
    const card = document.getElementById('map-detail-card');
    const storeId = card?.dataset?.storeId || '';
    const store = (window.localStores || []).find(s => s.id === storeId);
    if (store) {
        openGoogleMapsPlace(store);
        return;
    }

    if (!currentMapDest) {
        alert("请先选择一个店铺");
        return;
    }
    const name = String(document.getElementById('mp-name')?.innerText || '').trim();
    openGoogleMapsPlace({
        name,
        lat: Number(currentMapDest.lat),
        lng: Number(currentMapDest.lng)
    });
};

/* =========================================
   7. 地图卡片交互
   打卡、收藏、点赞等交互功能
   ========================================= */

/**
 * 切换打卡状态
 */
window.toggleMapCheckIn = () => {
    const storeId = document.getElementById('map-detail-card')?.dataset?.storeId || '';
    if (!storeId) return;
    if (typeof window.openAddComposerForStore === 'function') {
        window.openAddComposerForStore(storeId);
    }
};

/**
 * 更新打卡按钮UI
 */
function updateCheckInBtnUI() {
    const txt = document.getElementById('txt-checkin-count');
    const label = document.querySelector('.sheet-checkin-btn .checkin-label');
    if (txt && mapCardState.checkInCount > 0) {
        txt.innerText = `(吃过${mapCardState.checkInCount}次)`;
        if (label) label.innerText = "再吃";
    }
}

/**
 * 切换社交状态（收藏/好吃/难吃）
 * @param {string} type - 类型：fav/like/dislike
 */
window.toggleMapSocial = async (type) => {
    const card = document.getElementById('map-detail-card');
    const storeId = card?.dataset?.storeId;
    if (!storeId) return;

    try {
        if (type === 'fav' && window.toggleFav) {
            await window.toggleFav(storeId);
        } else if ((type === 'like' || type === 'dislike') && window.toggleLocalAction) {
            await window.toggleLocalAction(storeId, type);
        }
        if (window.renderMarkers) window.renderMarkers();
        refreshMapSocialButtonsUI();
    } catch (err) {
        console.error("切换社交状态失败:", err);
        alert("操作失败，请稍后重试");
    }
};

/**
 * 重置社交图标UI
 */
function resetSocialIconsUI() {
    refreshMapSocialButtonsUI();
}

/**
 * 复制店名到剪贴板
 */
window.copyMapStoreName = () => {
    const name =
        (document.getElementById('fd-name') && document.getElementById('fd-name').innerText) ||
        (document.getElementById('mp-name') && document.getElementById('mp-name').innerText) ||
        "";
    if (!name) return;
    navigator.clipboard.writeText(name).then(() => alert("店名已复制: " + name));
};

/**
 * 关闭地图详情卡片
 */
window.closeMapCard = (opts = {}) => {
    const { immediate = false } = opts || {};
    stopMapFocusAnimation();
    stopMapFriendPreviewRotation();
    if (typeof window.closeMapReviewSubpage === 'function') window.closeMapReviewSubpage();
    const card = document.getElementById('map-detail-card');

    const finalize = () => {
        if (card) {
            card.classList.remove('active', 'peek', 'half', 'full', 'closing');
            delete card.dataset.storeId;
            delete card.dataset.reviewScope;
            delete card.dataset.sourceView;
            delete card.dataset.fromMap;
            delete card.dataset.closing;
        }
        setMapSheetBackdrop(false);
        const fullDetail = document.getElementById('full-detail-page');
        if (fullDetail) fullDetail.classList.remove('open', 'half', 'from-map');
        if (routePolyline) routePolyline.setMap(null);
        if (marker) marker.setMap(null);
        marker = null;
        activePinnedStoreId = "";
        window.renderMarkers();
    };

    if (!card || !card.classList.contains('active') || immediate) {
        finalize();
        return;
    }

    if (card.dataset.closing === '1') return;
    card.dataset.closing = '1';
    card.classList.add('closing');
    const backdrop = document.getElementById('map-sheet-backdrop');
    if (backdrop && backdrop.classList.contains('active')) {
        backdrop.classList.add('closing');
    }

    let settled = false;
    const done = () => {
        if (settled) return;
        settled = true;
        card.removeEventListener('animationend', onAnimEnd);
        if (backdrop) backdrop.classList.remove('closing');
        finalize();
    };
    const onAnimEnd = (ev) => {
        if (ev.target !== card) return;
        done();
    };
    card.addEventListener('animationend', onAnimEnd);
    setTimeout(done, 260);
};

window.restoreMapSelectionContext = ({ storeId, mode = 'half', reviewScope = '', suppressAnimation = false } = {}) => {
    if (!storeId) return;
    const store = (window.localStores || []).find(s => s.id === storeId);
    if (!store) return;
    window.initMap();
    requestAnimationFrame(() => {
        window.renderMapCardFromDB(store, {
            mode,
            fromMap: true,
            sourceView: 'map',
            reviewScope,
            suppressAnimation
        });
        refreshMapSearchListHighlight();
    });
};

/* =========================================
   8. Sheet 拖拽和标签切换功能
   ========================================= */

/**
 * 切换sheet标签（评论/相册）
 */
window.switchSheetTab = (tabName) => {
    const tabs = document.querySelectorAll('.sheet-tab');
    const contents = document.querySelectorAll('.sheet-tab-content');

    tabs.forEach(tab => {
        if (tab.innerText.includes(tabName === 'reviews' ? '评论' : '相册')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    contents.forEach(content => {
        content.classList.add('hidden');
    });

    const activeContent = document.getElementById(`sheet-tab-${tabName}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
};

/**
 * 初始化Sheet拖拽功能
 */
function initSheetDrag() {
    const handle = document.getElementById('sheet-handle');
    const sheet = document.getElementById('map-detail-card');
    const sheetHeader = sheet?.querySelector('.sheet-header');
    if (!handle || !sheet) return;
    if (sheet.dataset.dragBound === '1') return;
    sheet.dataset.dragBound = '1';

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;
    let moved = false;
    let lastClientY = 0;

    const getClientY = (e) => {
        if (e.touches && e.touches.length) return e.touches[0].clientY;
        if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientY;
        return e.clientY;
    };

    const isInteractiveTarget = (target) => {
        if (!target || typeof target.closest !== 'function') return false;
        return !!target.closest([
            'button',
            'a',
            'input',
            'select',
            'textarea',
            '[role="button"]',
            '[onclick]',
            '.sheet-copy-btn',
            '.sheet-close-btn',
            '.mp-route-btn',
            '.sheet-checkin-btn',
            '.social-btn',
            '.sheet-tab'
        ].join(','));
    };

    const getSnapHeights = () => {
        const vh = window.innerHeight;
        return {
            peek: 170,
            half: Math.round(vh * 0.55),
            full: Math.round(vh - 60)
        };
    };

    const clampHeight = (h) => {
        const snaps = getSnapHeights();
        return Math.max(snaps.peek, Math.min(snaps.full, h));
    };

    const closestMode = (height) => {
        const snaps = getSnapHeights();
        const entries = Object.entries(snaps);
        let best = entries[0][0];
        let minDiff = Math.abs(height - entries[0][1]);
        for (let i = 1; i < entries.length; i++) {
            const [mode, val] = entries[i];
            const diff = Math.abs(height - val);
            if (diff < minDiff) {
                minDiff = diff;
                best = mode;
            }
        }
        return best;
    };

    const onStart = (e) => {
        if (!sheet.classList.contains('active')) return;
        if (isInteractiveTarget(e.target)) return;
        isDragging = true;
        moved = false;
        sheet.dataset.dragging = '1';
        startY = getClientY(e);
        lastClientY = startY;
        startHeight = sheet.getBoundingClientRect().height;
        sheet.style.transition = 'none';
        sheet.style.height = `${Math.round(startHeight)}px`;
        document.body.style.userSelect = 'none';
        if (e.cancelable) e.preventDefault();
    };

    const onMove = (e) => {
        if (!isDragging) return;
        const currentY = getClientY(e);
        lastClientY = currentY;
        const delta = startY - currentY;
        if (Math.abs(delta) > 2) moved = true;
        const nextHeight = clampHeight(startHeight + delta);
        sheet.style.height = `${Math.round(nextHeight)}px`;
        if (e.cancelable) e.preventDefault();
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        sheet.dataset.dragging = '0';
        document.body.style.userSelect = '';

        const endY = (typeof e?.clientY === 'number' || (e?.changedTouches && e.changedTouches.length))
            ? getClientY(e)
            : lastClientY;
        const currentHeight = clampHeight(startHeight + (startY - endY));
        const mode = closestMode(currentHeight);

        sheet.style.transition = 'height 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
        setMapSheetMode(mode);
        requestAnimationFrame(() => {
            sheet.style.height = '';
        });
        setTimeout(() => {
            sheet.style.transition = '';
        }, 380);
    };

    // 为handle添加事件
    handle.addEventListener('touchstart', onStart, { passive: false });
    handle.addEventListener('touchmove', onMove, { passive: false });
    handle.addEventListener('touchend', onEnd, { passive: false });
    handle.addEventListener('touchcancel', onEnd, { passive: false });
    handle.addEventListener('mousedown', onStart);

    // 为sheetHeader也添加拖拽功能
    if (sheetHeader) {
        sheetHeader.addEventListener('touchstart', onStart, { passive: false });
        sheetHeader.addEventListener('touchmove', onMove, { passive: false });
        sheetHeader.addEventListener('touchend', onEnd, { passive: false });
        sheetHeader.addEventListener('touchcancel', onEnd, { passive: false });
        sheetHeader.addEventListener('mousedown', onStart);
    }

    // 鼠标移动和释放需要在document级别监听
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // 点击手柄切换状态（仅在没有发生拖动时触发）
    handle.addEventListener('click', () => {
        if (moved) return;
        const modes = ['peek', 'half', 'full'];
        let idx = sheet.classList.contains('full') ? 2 : (sheet.classList.contains('half') ? 1 : 0);
        idx = (idx + 1) % modes.length;
        setMapSheetMode(modes[idx]);
    });
}

// 页面加载完成后初始化拖拽
document.addEventListener('DOMContentLoaded', () => {
    mountMapSheetToAppRoot();
    initSheetDrag();
    bindMapSheetOutsideClick();
    bindHomePullToRefresh();
});

function bindHomePullToRefresh() {
    const list = document.getElementById('store-list');
    const indicator = document.getElementById('home-pull-indicator');
    const textEl = indicator?.querySelector('.home-pull-text');
    if (!list || !indicator || !textEl) return;
    const THRESHOLD = 60;
    const MAX = 100;
    let startY = 0, dy = 0, dragging = false, locked = false, refreshing = false;
    let swallowUntil = 0;
    list.addEventListener('click', (e) => {
        if (Date.now() < swallowUntil) {
            e.stopPropagation();
            e.preventDefault();
        }
    }, true);
    const setHeight = (h) => { indicator.style.height = h + 'px'; };
    const onDown = (e) => {
        if (refreshing) return;
        if (list.scrollTop > 0) return;
        const t = e.touches ? e.touches[0] : e;
        startY = t.clientY; dy = 0;
        dragging = true; locked = false;
    };
    const onMove = (e) => {
        if (!dragging) return;
        const t = e.touches ? e.touches[0] : e;
        const deltaY = t.clientY - startY;
        if (!locked) {
            if (deltaY < 8) { if (deltaY < -8) dragging = false; return; }
            if (list.scrollTop > 0) { dragging = false; return; }
            locked = true;
            indicator.classList.add('is-pulling');
        }
        dy = Math.min(MAX, deltaY * 0.5);
        setHeight(dy);
        textEl.innerText = dy >= THRESHOLD ? '松开刷新位置' : '下拉刷新位置';
        if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
        if (!dragging) return;
        const wasLocked = locked;
        dragging = false; locked = false;
        if (!wasLocked) return;
        swallowUntil = Date.now() + 500;
        indicator.classList.remove('is-pulling');
        if (dy >= THRESHOLD) {
            refreshing = true;
            indicator.classList.add('is-refreshing');
            indicator.style.height = '';
            textEl.innerText = '正在刷新...';
            const startedAt = Date.now();
            const done = () => {
                const elapsed = Date.now() - startedAt;
                const holdMs = Math.max(0, 700 - elapsed);
                setTimeout(() => {
                    refreshing = false;
                    indicator.classList.remove('is-refreshing');
                    indicator.style.height = '';
                    textEl.innerText = '下拉刷新位置';
                }, holdMs);
            };
            const tasks = [];
            try {
                if (typeof window.startFetchLocation === 'function') {
                    window.startFetchLocation({ showConfirm: false, silentError: true, showLoading: false, force: true });
                }
                if (typeof window.refreshStoresFromFirestore === 'function') {
                    const r2 = window.refreshStoresFromFirestore();
                    if (r2 && typeof r2.then === 'function') tasks.push(r2.catch(() => {}));
                }
                const timeout = new Promise((resolve) => setTimeout(resolve, 5000));
                if (tasks.length) Promise.race([Promise.all(tasks), timeout]).finally(done);
                else done();
            } catch (_) { done(); }
        } else {
            indicator.style.height = '';
        }
        dy = 0;
    };
    list.addEventListener('dragstart', (e) => e.preventDefault());
    list.addEventListener('touchstart', onDown, { passive: true });
    list.addEventListener('touchmove', onMove, { passive: false });
    list.addEventListener('touchend', onUp);
    list.addEventListener('touchcancel', onUp);
    list.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') onDown(e); });
    list.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && dragging) onMove(e); });
    list.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') onUp(e); });
    list.addEventListener('pointercancel', (e) => { if (e.pointerType === 'mouse') onUp(e); });
}

function bindMapSheetOutsideClick() {
    if (document.body.dataset.mapSheetOutsideBound === '1') return;
    document.body.dataset.mapSheetOutsideBound = '1';
    document.addEventListener('click', (e) => {
        const card = document.getElementById('map-detail-card');
        if (!card || !card.classList.contains('active')) return;
        if (card.dataset.closing === '1') return;
        // 避免打开弹窗的那次 click 事件冒泡到 document 立即触发关闭
        const openedAt = Number(card.dataset.openedAt || 0);
        if (openedAt && Date.now() - openedAt < 300) return;
        if (e.target.closest('#map-detail-card')) return;
        if (e.target.closest('#map-sheet-backdrop')) return;
        if (e.target.closest('.map-pin')) return;
        if (e.target.closest('#map-review-overlay')) return;
        if (e.target.closest('#view-profile.friend-profile-overlay')) return;
        if (document.getElementById('view-profile')?.classList.contains('friend-profile-overlay')) return;
        const mapViewVisible = !document.getElementById('view-map')?.classList.contains('hidden');
        if (mapViewVisible) {
            // 地图页：只有 full 占比缩回 half，half/peek 不变
            if (card.classList.contains('full')) {
                setMapSheetMode('half');
            }
        } else {
            // 其他页面：点击外部区域直接关闭（带动画）
            window.closeMapCard();
        }
    });
}

// ==========================================
// Google Maps 加载回调
// 当Google Maps API加载完成后调用此函数
// ==========================================
window.initGoogleMap = () => {
    initMap();
    if (window.refreshAddMapPreview) window.refreshAddMapPreview();
    // 确保拖拽功能初始化
    setTimeout(initSheetDrag, 100);
};

window.refreshOpenMapCardDistance = () => {
    const card = document.getElementById('map-detail-card');
    if (!card || !card.classList.contains('active')) return;
    const storeId = card.dataset?.storeId || '';
    const store = (window.localStores || []).find(s => s.id === storeId);
    if (!store) return;
    const timeEl = document.getElementById('mp-fake-time');
    if (timeEl) timeEl.innerText = formatMapDistanceText(store);
};

window.centerMapOnCurrentOrigin = () => {
    if (!map) return;
    map.setCenter(getMapCenterFromOrigin());
    map.setZoom(15);
    renderCurrentOriginMarker();
    window.renderMarkers();
};

window.openStoreInGoogleMapsById = (storeId) => {
    const sid = String(storeId || '').trim();
    if (!sid) return;
    const store = (window.localStores || []).find(s => s.id === sid);
    if (!store) {
        alert("未找到店铺位置信息");
        return;
    }
    const dest = { lat: Number(store.lat), lng: Number(store.lng) };
    if (Number.isFinite(dest.lat) && Number.isFinite(dest.lng)) {
        currentMapDest = dest;
    }
    openGoogleMapsPlace(store);
};

// 允许外部设置当前地图的目标点
window.setMapDestination = (lat, lng) => {
    // currentMapDest 是 map.js 里的全局变量
    // 如果 store 数据里没有坐标，就设为 null
    if (lat && lng) {
        currentMapDest = { lat: parseFloat(lat), lng: parseFloat(lng) };
    } else {
        currentMapDest = null;
    }
};
// === 新增：允许外部修改地图导航的目标点 ===
window.setMapTarget = (lat, lng) => {
    if (lat && lng) {
        // 更新 map.js 内部的 currentMapDest 变量
        currentMapDest = { lat: parseFloat(lat), lng: parseFloat(lng) };
        console.log("导航目标已更新:", currentMapDest);
    }
};
