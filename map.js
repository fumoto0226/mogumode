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
    switch (type) {
        case 'like':
            return '<img src="images/pin-like.svg" alt="">';
        case 'dislike':
            return '<img src="images/pin-dislike.svg" alt="">';
        case 'fav':
            return '<img src="images/pin-fav.svg" alt="">';
        case 'default':
        default:
            return '<img src="images/pin-default.svg" alt="">';
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
    // 地图页不使用灰色遮罩，避免影响看路线和地图交互
    backdrop.classList.remove('active');
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
    const type = window.mapOriginType || 'cocoon';
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
    const myLikes = window.localLikes || new Set();
    const myDislikes = window.localDislikes || new Set();
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
        .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
}

function buildMapReviewItems(store, scope = 'all') {
    const revs = getSortedMapStoreReviews(store);
    const aliasMap = buildFriendAliasMap();

    return revs.map((r, i) => {
        const userName = (typeof r === 'object' && (r.user || r.displayName)) ? (r.user || r.displayName) : 'User';
        const rating = Number((typeof r === 'object' && r.rating) || store?.rating || 0);
        const text = typeof r?.text === 'string' ? r.text.trim() : '';
        const imgs = Array.isArray(r?.images) ? r.images.filter(Boolean) : [];
        const avatar = resolveMapReviewAvatar(r, i);
        const dateStr = formatMapReviewDate(r?.createdAt);
        const isMine = isMyMapReview(r);
        const friendUser = resolveFriendFromReview(r, aliasMap);
        const isFriend = !!friendUser?.id;
        const originalIndex = (Array.isArray(store?.revs) ? store.revs : []).findIndex(item => item === r);
        return {
            review: r,
            userName,
            rating,
            text,
            imgs,
            avatar,
            dateStr,
            isMine,
            friendUser,
            isFriend,
            originalIndex
        };
    }).filter((item) => {
        if (scope === 'mine') return item.isMine;
        if (scope === 'friends') return item.isFriend;
        return true;
    });
}

function renderMapReviewCardHtml(store, item) {
    const openProfileAttr = item.isFriend
        ? `onclick="openFriendProfileFromReview('${item.friendUser.id}'); event.stopPropagation();"`
        : '';
    const friendBadge = item.isFriend ? `<span class="review-friend-badge">好友</span>` : '';
    const deleteBtn = (item.isMine && item.originalIndex >= 0)
        ? `<button class="review-delete-btn" onclick="deleteMyStoreReview('${store.id}', ${item.originalIndex}); event.stopPropagation();">删除</button>`
        : '';

    return `
        <div class="review-card">
            <div class="review-header">
                <img src="${item.avatar}" class="review-avatar ${item.isFriend ? 'is-clickable' : ''}" ${openProfileAttr}>
                <div class="review-user-info ${item.isFriend ? 'is-clickable' : ''}" ${openProfileAttr}>
                    <div class="review-username">${item.userName}${friendBadge}</div>
                    <div class="review-user-meta">${item.dateStr}</div>
                </div>
                ${deleteBtn}
            </div>
            <div class="review-rating-row" style="margin-bottom:${item.text ? '8px' : '0'};">
                <b>${item.rating.toFixed(1)}</b>
                <span style="display:inline-flex; align-items:center; gap:2px; margin-left:6px;">${renderMapReviewRatingIcons(item.rating)}</span>
            </div>
            ${item.text ? (typeof window.renderExpandableReviewText === 'function'
            ? window.renderExpandableReviewText(item.text, {
                textClassName: 'review-text',
                wrapperClassName: 'review-text-block'
            })
            : `<div class="review-text">${item.text}</div>`) : ''}
            ${item.imgs.length ? `<div class="review-images">${item.imgs.map(src =>
            `<img src="${src}" onclick="openActivityImageModal('${String(src).replace(/'/g, "\\'")}'); event.stopPropagation();">`
        ).join('')}</div>` : ''}
        </div>
    `;
}

function renderMapReviewsAndAlbum(store) {
    const revs = getSortedMapStoreReviews(store);
    const reviewItems = buildMapReviewItems(store, 'all');

    const reviewsList = document.getElementById('mp-reviews-list');
    if (reviewsList) {
        const reviewCards = reviewItems.length
            ? reviewItems.map(item => renderMapReviewCardHtml(store, item)).join('')
            : '';
        const reviewPlaceholderText = revs.length ? '没有更多评论了～' : '还没有评论';
        reviewsList.innerHTML = `
            ${reviewCards}
            <div class="sheet-list-placeholder">${reviewPlaceholderText}</div>
        `;
        bindReviewWheelProxy(reviewsList);
    }

    const uniqPhotos = (typeof window.getStorePreviewImages === 'function')
        ? window.getStorePreviewImages(store, 300)
        : Array.from(new Set([
            ...(Array.isArray(store?.images) ? store.images : []),
            ...revs.flatMap(r => Array.isArray(r?.images) ? r.images : [])
        ].filter(Boolean)));
    const albumGrid = document.getElementById('mp-album-grid');
    if (albumGrid) {
        const photoItems = uniqPhotos.length
            ? uniqPhotos.map(src =>
                `<img src="${src}" onclick="openActivityImageModal('${String(src).replace(/'/g, "\\'")}'); event.stopPropagation();">`
            ).join('')
            : '';
        const photoPlaceholderText = uniqPhotos.length ? '没有更多图片了～' : '还没有图片';
        albumGrid.innerHTML = `
            ${photoItems}
            <div class="sheet-list-placeholder sheet-list-placeholder-photos">${photoPlaceholderText}</div>
        `;
    }

    const revCountEl = document.getElementById('mp-review-count');
    const albumCountEl = document.getElementById('mp-album-count');
    if (revCountEl) revCountEl.innerText = String(revs.length);
    if (albumCountEl) albumCountEl.innerText = String(uniqPhotos.length);

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

    const items = buildMapReviewItems(store, scope);
    titleEl.innerText = scope === 'friends' ? '朋友评价' : '我的评价';

    if (!items.length) {
        listEl.innerHTML = `<div class="sheet-subpage-empty">${scope === 'friends' ? '这家店还没有好友评价' : '你还没有评价过这家店'}</div>`;
        return;
    }

    listEl.innerHTML = items.map(item => renderMapReviewCardHtml(store, item)).join('');
}

window.openMapReviewSubpage = (scope = 'mine') => {
    const card = document.getElementById('map-detail-card');
    const storeId = card?.dataset?.storeId || '';
    const store = (window.localStores || []).find(s => s.id === storeId);
    const overlay = document.getElementById('map-review-overlay');
    if (!card || !store || !overlay) return;
    renderMapReviewSubpage(store, scope);
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('is-open'));
};

window.closeMapReviewSubpage = () => {
    const overlay = document.getElementById('map-review-overlay');
    if (!overlay) return;
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
                this.div.style.left = Math.round(point.x) + 'px';
                this.div.style.top = Math.round(point.y) + 'px';
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
    const { mode = 'half' } = opts || {};
    mountMapSheetToAppRoot();
    stopMapFriendPreviewRotation();
    if (typeof window.closeMapReviewSubpage === 'function') window.closeMapReviewSubpage();

    if (!store) return;
    const card = document.getElementById('map-detail-card');
    if (!card) return;
    card.dataset.storeId = store.id || "";
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
        const previewImages = (typeof window.getStorePreviewImages === 'function')
            ? window.getStorePreviewImages(store, 80)
            : (Array.isArray(store?.images) ? store.images : []);
        if (previewImages.length) {
            previewImages.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'mp-photo-item';
                img.onclick = (e) => {
                    e.stopPropagation();
                    if (window.openActivityImageModal) window.openActivityImageModal(src);
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
    card.classList.add('active');
    setMapSheetMode(mode);
    setMapSheetBackdrop(true);
    if (window.switchSheetTab) window.switchSheetTab('reviews');
    if (window.lucide) window.lucide.createIcons();
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
    const preserveMapView = !!opts.preserveMapView;
    stopMapFocusAnimation();
    stopMapFriendPreviewRotation();
    if (typeof window.closeMapReviewSubpage === 'function') window.closeMapReviewSubpage();
    const card = document.getElementById('map-detail-card');
    if (card) card.classList.remove('active', 'peek', 'half', 'full');
    setMapSheetBackdrop(false);
    const fullDetail = document.getElementById('full-detail-page');
    if (fullDetail) fullDetail.classList.remove('open', 'half', 'from-map');
    // 清除路线
    if (routePolyline) routePolyline.setMap(null);
    // 清除搜索标记
    if (marker) marker.setMap(null);
    marker = null;
    activePinnedStoreId = "";
    // 重置地图缩放
    if (map && !preserveMapView) map.setZoom(15);
    window.renderMarkers();
};

window.restoreMapSelectionContext = ({ storeId, mode = 'half' } = {}) => {
    if (!storeId) return;
    const store = (window.localStores || []).find(s => s.id === storeId);
    if (!store) return;
    window.initMap();
    requestAnimationFrame(() => {
        window.renderMapCardFromDB(store, { mode, fromMap: true });
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
});

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
