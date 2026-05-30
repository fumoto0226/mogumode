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
const MAP_PIN_SIZE = 26;

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
    // 餐具图标（吃 - default / default-low 共用前景）
    const FORK_KNIFE_PATH = `<path d="M34.9041 28.4245C36.0485 28.4245 37.1929 29.5689 37.1929 30.7133V51.313C34.5226 51.313 32.6152 49.4056 32.6152 46.7353V30.7133C32.6152 29.5689 33.7597 28.4245 34.9041 28.4245Z" fill="white"/><path d="M57.0296 28.4245C55.8852 28.4245 54.7408 29.5689 54.7408 30.7133V44.8279C54.7408 46.7353 53.2149 48.2612 51.689 48.2612C49.7816 48.2612 48.2557 46.7353 48.2557 44.8279V30.7133C48.2557 29.5689 47.1113 28.4245 45.9668 28.4245C44.8224 28.4245 43.678 29.5689 43.678 30.7133V44.8279C43.678 46.7353 42.1521 48.2612 40.2447 48.2612C38.3374 48.2612 37.1929 46.7353 37.1929 44.8279V41.3946H32.6152V49.4056C32.6152 55.8907 37.1929 61.2313 43.2965 62.3757L41.0077 79.9236V80.6865C41.0077 83.3568 43.2965 85.6457 45.9668 85.6457H46.7298C49.4001 85.2642 51.689 82.5939 51.3075 79.9236L49.0186 62.3757C54.7408 61.2313 59.3185 55.8907 59.3185 49.4056V30.7133C59.3185 29.5689 58.174 28.4245 57.0296 28.4245ZM89.8364 45.5909C89.8364 36.054 83.7328 28.4245 76.4848 28.4245C69.2368 28.4245 63.1332 36.054 63.1332 45.5909C63.1332 53.9833 67.7109 60.8498 73.8145 62.3757L71.5256 80.305V81.068C71.5256 83.7383 73.8145 86.0272 76.4848 86.0272H77.2478C79.9181 85.6457 81.8255 83.3568 81.444 80.6865L79.1551 62.7572C85.2587 60.8498 89.8364 53.9833 89.8364 45.5909Z" fill="white"/>`;
    // 饮品（杯子）图标 - drink / drink-low 共用
    const DRINK_PATH = `<path d="M45.3101 36.1941C44.55 36.6746 43.9035 37.3147 43.4155 38.0701C42.9275 38.8254 42.6097 39.6779 42.4841 40.5684C42.3827 41.0409 42.1251 41.4656 41.7528 41.7738C41.3805 42.082 40.9153 42.2557 40.4321 42.2671C40.2513 42.2658 40.0715 42.24 39.8976 42.1903C38.7518 41.8524 38.076 40.6206 38.3801 39.4195C38.9023 36.5382 40.5458 34.0131 42.9203 32.4465C44.2504 31.6939 45.0859 30.2471 45.1013 28.662C45.1694 28.0804 45.4613 27.5483 45.9153 27.1784C46.1353 27.0004 46.3895 26.8696 46.6622 26.794C46.9348 26.7185 47.2201 26.6998 47.5003 26.7391C48.6707 26.9357 49.4724 28.0815 49.2943 29.3071C49.2236 30.6891 48.8254 32.0345 48.1327 33.2324C47.4401 34.4303 46.4726 35.4465 45.3101 36.1972V36.1941ZM60.1163 36.1941C59.3564 36.6749 58.7101 37.3151 58.2221 38.0704C57.7342 38.8257 57.4162 39.678 57.2902 40.5684C57.189 41.0404 56.9318 41.4647 56.5602 41.7728C56.1885 42.081 55.7239 42.2551 55.2413 42.2671C55.0595 42.2655 54.8787 42.2397 54.7037 42.1903C53.558 41.8524 52.8852 40.6206 53.1863 39.4195C53.7085 36.5382 55.355 34.0131 57.7264 32.4465C59.0596 31.697 59.8951 30.2471 59.9074 28.662C59.9763 28.08 60.2694 27.5477 60.7245 27.1784C60.9445 27.0004 61.1987 26.8696 61.4714 26.794C61.744 26.7185 62.0293 26.6998 62.3095 26.7391C63.4768 26.9357 64.2755 28.0815 64.1035 29.3071C64.0322 30.6893 63.6335 32.0348 62.9403 33.2327C62.247 34.4306 61.2791 35.4467 60.1163 36.1972V36.1941ZM74.9562 36.1941C74.1956 36.6741 73.5488 37.3141 73.0607 38.0696C72.5727 38.825 72.2551 39.6777 72.1301 40.5684C72.0681 40.8509 71.951 41.1184 71.7855 41.3556C71.62 41.5928 71.4093 41.795 71.1656 41.9507C70.9268 42.1014 70.6592 42.2005 70.3799 42.2418C70.1006 42.283 69.8158 42.2655 69.5437 42.1903C68.3979 41.8524 67.7251 40.6206 68.0293 39.4195C68.5515 36.5382 70.1949 34.0131 72.5663 32.4465C73.8995 31.697 74.735 30.2471 74.7473 28.662C74.8148 28.0787 75.1081 27.545 75.5644 27.1753C75.7845 26.9977 76.0389 26.8674 76.3116 26.7923C76.5842 26.7173 76.8695 26.6992 77.1495 26.7391C78.3167 26.9388 79.1154 28.0815 78.9434 29.3071C78.8731 30.6895 78.4748 32.0354 77.7815 33.2335C77.0882 34.4315 76.1197 35.4474 74.9562 36.1972V36.1941ZM88.721 57.1101H85.2007V59.3218C85.2007 62.025 84.8105 64.7128 84.0457 67.2962C85.5386 67.0044 86.8779 66.1566 87.8148 64.9094C89.0527 62.5257 89.3814 59.7365 88.724 57.1101H88.721ZM91.2613 67.5542C89.0681 70.5462 85.6492 72.2756 82.0398 72.2172C77.7884 80.4896 69.5498 85.6718 60.5678 85.7332H56.4424C42.6745 85.5305 31.6559 73.7194 31.8157 59.3279V49.9712C31.8061 49.3805 32.0238 48.8086 32.4239 48.3739C32.6171 48.165 32.8507 47.9975 33.1104 47.8813C33.3702 47.7652 33.6507 47.7028 33.9352 47.6981H83.078C84.2638 47.7134 85.213 48.7302 85.1976 49.9712V52.5669H91.8972L92.3826 54.112C92.487 54.4376 94.8646 62.1816 91.2644 67.5512L91.2613 67.5542Z" fill="white"/>`;
    // 其他（房子）图标 - other / other-low 共用
    const OTHER_PATH = `<path d="M80.9995 86.1746H39.4551C38.6681 86.1746 37.9133 85.862 37.3568 85.3055C36.8003 84.749 36.4877 83.9942 36.4877 83.2072V68.3699C36.4877 67.5828 36.8003 66.8281 37.3568 66.2716C37.9133 65.715 38.6681 65.4024 39.4551 65.4024C40.2421 65.4024 40.9969 65.715 41.5534 66.2716C42.1099 66.8281 42.4226 67.5828 42.4226 68.3699V80.2397H78.0321V68.3699C78.0321 67.5828 78.3447 66.8281 78.9012 66.2716C79.4577 65.715 80.2125 65.4024 80.9995 65.4024C81.7866 65.4024 82.5413 65.715 83.0979 66.2716C83.6544 66.8281 83.967 67.5828 83.967 68.3699V83.2072C83.967 83.9942 83.6544 84.749 83.0979 85.3055C82.5413 85.862 81.7866 86.1746 80.9995 86.1746ZM89.9019 47.5977C89.9018 47.012 89.7283 46.4395 89.4034 45.9522L77.5335 28.1474C77.2626 27.7409 76.8955 27.4075 76.4649 27.1769C76.0342 26.9462 75.5532 26.8255 75.0646 26.8254H45.39C44.9015 26.8255 44.4205 26.9462 43.9898 27.1769C43.5591 27.4075 43.192 27.7409 42.9211 28.1474L31.0513 45.9522C30.7264 46.4395 30.5529 47.012 30.5527 47.5977V52.0488C30.5551 54.0157 31.3375 55.9013 32.7282 57.292C34.119 58.6828 36.0046 59.4651 37.9714 59.4675C43.6748 59.4675 45.39 53.5326 45.39 53.5326C45.7678 55.2178 46.7085 56.724 48.0571 57.8028C49.4057 58.8817 51.0816 59.4688 52.8087 59.4675C58.5121 59.4675 60.2273 53.5326 60.2273 53.5326C60.6051 55.2178 61.5458 56.724 62.8944 57.8028C64.243 58.8817 65.9189 59.4688 67.646 59.4675C73.3494 59.4675 75.0646 53.5326 75.0646 53.5326C75.4424 55.2178 76.3831 56.724 77.7317 57.8028C79.0803 58.8817 80.7562 59.4688 82.4833 59.4675C84.4501 59.4651 86.3357 58.6828 87.7264 57.292C89.1172 55.9013 89.8996 54.0157 89.9019 52.0488V47.5977Z" fill="white"/>`;

    switch (type) {
        case 'like':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF34B5" stroke="white" stroke-width="9"/>
                <path d="M60.2446 87.021C59.274 87.021 58.3781 86.7224 57.5942 86.0878C56.9595 85.5651 41.4678 73.5823 35.271 63.8393C33.2179 60.629 30.3809 56.2614 30.3809 50.0647C30.3809 39.7244 38.1081 31.3252 47.5525 31.3252C52.368 31.3252 56.9595 33.5276 60.2446 37.3726C63.4922 33.4903 68.0464 31.3252 72.8993 31.3252C82.381 31.3252 90.0709 39.7244 90.0709 50.0647C90.0709 56.1494 87.4205 60.3303 85.2554 63.7273L85.1807 63.8393C78.984 73.5823 63.4922 85.6025 62.8576 86.0878C62.111 86.685 61.2151 87.021 60.2446 87.021Z" fill="#FFDCF2"/>
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
        case 'drink':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF8BD5"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF5E2A"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                ${DRINK_PATH}
            `);
        case 'drink-low':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#9AF490"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF8BD5"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FFB641"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                ${DRINK_PATH}
            `);
        case 'other':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF8BD5"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF5E2A"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                ${OTHER_PATH}
            `);
        case 'other-low':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#9AF490"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF8BD5"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FFB641"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                ${OTHER_PATH}
            `);
        case 'default-low':
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#9AF490"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF8BD5"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FFB641"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                ${FORK_KNIFE_PATH}
            `);
        case 'default':
        default:
            return wrap(`
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#9AF490"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF6066"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" fill="#FF5E2A"/>
                <circle cx="60.2258" cy="56.2258" r="51.7258" stroke="white" stroke-width="9"/>
                ${FORK_KNIFE_PATH}
            `);
    }
}

function createSelectedPinOverlayClass() {
    return class SelectedPinOverlay extends google.maps.OverlayView {
        constructor(latlng) {
            super();
            this.latlng = latlng;
            this.div = null;
        }
        onAdd() {
            this.div = document.createElement('div');
            this.div.className = 'map-pin-selected-overlay';
            // 使用 Google Maps 经典红色水滴图标（位于 floatPane 顶层）
            this.div.innerHTML = `<img src="images/current-location-google-pin.svg" width="29" height="38" alt="" draggable="false">`;
            const panes = this.getPanes();
            panes.floatPane.appendChild(this.div);
        }
        draw() {
            if (!this.div) return;
            const projection = this.getProjection();
            const point = projection.fromLatLngToDivPixel(this.latlng);
            if (!point) return;
            const w = 29, h = 38;
            this.div.style.left = Math.round(point.x - w / 2) + 'px';
            this.div.style.top = Math.round(point.y - h) + 'px';
        }
        onRemove() {
            if (this.div && this.div.parentNode) {
                this.div.parentNode.removeChild(this.div);
            }
            this.div = null;
        }
    };
}

// 把店铺按主属性分成 吃 (default) / 喝 (drink) / 其他 (other)
// 参考 Google Places 的 primaryType / types 字段
window.classifyStorePinKind = classifyStorePinKind;
function classifyStorePinKind(store) {
    const primary = String(store?.primaryType || '').toLowerCase();
    const types = (Array.isArray(store?.types) ? store.types : []).map(t => String(t).toLowerCase());
    const isDrink = (t) => /(^|_)(bar|pub|night_club|wine_bar|beer_garden|cafe|coffee_shop|tea_house|juice_shop)$/.test(t)
        || /^(cafe|coffee_shop|tea_house|juice_shop|bar|pub|night_club|wine_bar|beer_garden)$/.test(t);
    const isEat = (t) => /(restaurant|food|bakery|meal_takeaway|meal_delivery|cake_shop|sandwich_shop|pizza|burger|sushi|ramen|donut|ice_cream|confectionery|deli|barbecue|seafood|steakhouse|noodle|dessert|chocolate|patisserie)/.test(t);
    const classify = (t) => {
        if (!t) return null;
        if (isDrink(t)) return 'drink';
        if (isEat(t)) return 'default';
        return null;
    };
    // 优先看 primaryType
    const fromPrimary = classify(primary);
    if (fromPrimary) return fromPrimary;
    // primary 没匹配上 → 看 types 列表
    for (const t of types) {
        const k = classify(t);
        if (k) return k;
    }
    // 都没匹配 → 其他
    return 'other';
}

function setSelectedStorePin(store) {
    if (!map || !store?.lat || !store?.lng) return;
    const dest = { lat: Number(store.lat), lng: Number(store.lng) };
    if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) return;
    activePinnedStoreId = store.id || "";
    currentMapDest = dest;
    if (marker) marker.setMap(null);
    if (!window.SelectedPinOverlayClass) {
        window.SelectedPinOverlayClass = createSelectedPinOverlayClass();
    }
    marker = new window.SelectedPinOverlayClass(new google.maps.LatLng(dest.lat, dest.lng));
    marker.setMap(map);
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

function createOriginPinOverlayClass() {
    return class OriginPinOverlay extends google.maps.OverlayView {
        constructor(latlng, iconUrl, anchorBottom) {
            super();
            this.latlng = latlng;
            this.iconUrl = iconUrl;
            this.anchorBottom = !!anchorBottom; // true: anchor 底部中心；false: 中心
            this.div = null;
        }
        onAdd() {
            this.div = document.createElement('div');
            this.div.className = 'map-origin-overlay';
            this.div.innerHTML = `<img src="${this.iconUrl}" width="30" height="30" alt="" draggable="false">`;
            const panes = this.getPanes();
            // floatPane 是最高层，保证不会被任何店铺图钉遮挡
            panes.floatPane.appendChild(this.div);
        }
        draw() {
            if (!this.div) return;
            const projection = this.getProjection();
            const point = projection?.fromLatLngToDivPixel?.(this.latlng);
            if (!point) return;
            const w = 30, h = 30;
            const left = Math.round(point.x - w / 2);
            const top = this.anchorBottom ? Math.round(point.y - h) : Math.round(point.y - h / 2);
            this.div.style.left = `${left}px`;
            this.div.style.top = `${top}px`;
        }
        onRemove() {
            if (this.div && this.div.parentNode) this.div.parentNode.removeChild(this.div);
            this.div = null;
        }
    };
}

function renderCurrentOriginMarker() {
    if (!map) return;
    if (currentOriginMarker) currentOriginMarker.setMap(null);

    const { origin, type } = getCurrentOriginState();
    const isGpsOrigin = type === 'gps';
    const iconUrl = 'images/weizhilan.svg';

    if (!window.OriginPinOverlayClass) {
        window.OriginPinOverlayClass = createOriginPinOverlayClass();
    }
    const lat = Number(origin?.lat ?? origin?.lat?.());
    const lng = Number(origin?.lng ?? origin?.lng?.());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const latlng = new google.maps.LatLng(lat, lng);
    currentOriginMarker = new window.OriginPinOverlayClass(latlng, iconUrl, isGpsOrigin);
    currentOriginMarker.setMap(map);
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
            ratingWrap.innerHTML = `<div class="friend-score">--</div><div class="sheet-friend-empty">暂无好友评论</div>`;
            return;
        }

        const previewItems = revs.map((item, idx) => {
            const text = String(item.rev?.text || '').trim();
            const rating = Number(item.rev?.rating || 0);
            return `
                <div class="sheet-friend-rating-frame${idx === 0 ? ' is-active' : ''}">
                    <div class="friend-score">${Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : '--'}<img src="images/mogu.svg" class="friend-score-mogu" alt=""></div>
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

function refreshMapReviewSectionCounts(store) {
    const myReviewCountEl = document.getElementById('mp-my-review-count');
    const friendReviewCountEl = document.getElementById('mp-friend-review-count');
    const myCount = buildMapReviewItems(store, 'mine').length;
    const friendCount = buildMapReviewItems(store, 'friends').length;

    if (myReviewCountEl) {
        myReviewCountEl.innerText = myCount > 0 ? `(${myCount})` : '';
    }
    if (friendReviewCountEl) {
        friendReviewCountEl.innerText = friendCount > 0 ? `(${friendCount})` : '';
    }
    // 同步更新"再吃"按钮上的次数，与"我的评价(N)"保持一致
    mapCardState.checkInCount = myCount;
    updateCheckInBtnUI();
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
        title = userName ? `${userName}的评论` : '用户评论';
        emptyText = '暂无评论';
    } else {
        items = buildMapReviewItems(store, scope);
        title = scope === 'friends' ? '朋友评论' : '我的评论';
        emptyText = scope === 'friends' ? '这家店还没有好友评论' : '你还没有评论过这家店';
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
            this.compact = false; // 紧凑模式标记，onAdd 时根据该状态决定是否加 is-dot 类
        }

        // 当标记被添加到地图时调用
        onAdd() {
            this.div = document.createElement('div');
            this.div.className = `map-pin ${this.htmlClass}` + (this.compact ? ' is-dot' : '');
            this.div.innerHTML = this.iconHtml;
            // 根据纬度设置 z-index：纬度越低（越靠南/靠下）越在上层
            const lat = (typeof this.latlng?.lat === 'function') ? this.latlng.lat() : 0;
            this.div.style.zIndex = String(Math.round((90 - lat) * 1000000));
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

        setCompact(flag) {
            this.compact = !!flag;
            if (!this.div) return;
            this.div.classList.toggle('is-dot', !!flag);
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
    // 简约浅灰风格地图样式：白底、淡灰路网、隐藏 POI / 交通图标，
    // 让我们的店铺图钉成为视觉焦点
    const MINIMAL_MAP_STYLES = [
        { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#7d7d7d' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
        { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#eaeaea' }] },
        { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
        { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'transit.station', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9eef2' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#a7b3bd' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] }
    ];

    map = new google.maps.Map(document.getElementById('google-map'), {
        center: getMapCenterFromOrigin(),
        zoom: 15,                       // 缩放级别
        disableDefaultUI: true,         // 禁用默认控件
        styles: MINIMAL_MAP_STYLES
    });

    // 显示当前起点标记（Cocoon=蓝，GPS=红）
    renderCurrentOriginMarker();

    // 渲染店铺标记（如果数据已加载）
    window.renderMarkers();

    // 缩放变化时切换图标紧凑模式（小白边圆点）
    map.addListener('zoom_changed', () => {
        applyMarkerCompactness();
    });

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
                    // 回车 = 点击放大镜，提交搜索（限制地图只显示匹配的店铺）
                    if (typeof window.onMapSearchActionClick === 'function') {
                        window.onMapSearchActionClick();
                    } else {
                        performMapSearch();
                    }
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

/* ===========================
   地图筛选状态：按搜索词、分类、评分、可见区域过滤显示的店铺图钉
   =========================== */
const mapVisibleFilter = {
    searchActive: false,        // 用户点了放大镜后才生效；只显示 searchMatchedIds 集合中的
    searchMatchedIds: null,     // Set<string> 或 null
    categories: new Set(),      // 已选的分类 chip：'eat' | 'drink' | 'other' | 'fav' | 'like' | 'dislike'
    minRating: 0                // 0=不限；3.5=只显示 ≥3.5
};

function storePassesMapFilter(store) {
    // 1) 搜索激活时只显示匹配的
    if (mapVisibleFilter.searchActive) {
        if (!mapVisibleFilter.searchMatchedIds || !mapVisibleFilter.searchMatchedIds.has(String(store.id))) return false;
    }
    // 2) 分类多选（多个分类是"或"关系；选中任一即通过）
    if (mapVisibleFilter.categories.size > 0) {
        const cats = mapVisibleFilter.categories;
        const myFavs = window.myFavIds || [];
        const likes = window.localLikes || new Set();
        const dislikes = window.localDislikes || new Set();
        let pass = false;
        if (cats.has('fav') && myFavs.includes(store.id)) pass = true;
        if (!pass && cats.has('like') && likes.has(store.id)) pass = true;
        if (!pass && cats.has('dislike') && dislikes.has(store.id)) pass = true;
        if (!pass && (cats.has('eat') || cats.has('drink') || cats.has('other'))) {
            const kind = classifyStorePinKind(store); // 'default' | 'drink' | 'other'
            const kindKey = kind === 'default' ? 'eat' : kind;
            if (cats.has(kindKey)) pass = true;
        }
        if (!pass) return false;
    }
    // 3) 评分阈值
    if (mapVisibleFilter.minRating > 0) {
        const rating = (typeof window.getStoreAverageRating === 'function')
            ? Number(window.getStoreAverageRating(store)) || 0
            : 0;
        if (rating < mapVisibleFilter.minRating) return false;
    }
    return true;
}

window.toggleMapCategoryChip = (cat) => {
    const set = mapVisibleFilter.categories;
    if (set.has(cat)) set.delete(cat); else set.add(cat);
    refreshMapChipUI();
    if (typeof window.renderMarkers === 'function') window.renderMarkers();
};

window.toggleMapRatingChip = () => {
    mapVisibleFilter.minRating = mapVisibleFilter.minRating > 0 ? 0 : 3.5;
    refreshMapChipUI();
    if (typeof window.renderMarkers === 'function') window.renderMarkers();
};

function refreshMapChipUI() {
    document.querySelectorAll('.map-chip').forEach((btn) => {
        const cat = btn.dataset.cat;
        const rating = btn.dataset.rating;
        if (cat) btn.classList.toggle('is-selected', mapVisibleFilter.categories.has(cat));
        if (rating) btn.classList.toggle('is-selected', mapVisibleFilter.minRating > 0);
    });
}

function refreshMapSearchActionButton() {
    const btn = document.getElementById('map-search-action-btn');
    const areaRow = document.getElementById('map-search-area-row');
    if (!btn) return;
    btn.innerHTML = mapVisibleFilter.searchActive
        ? '<i data-lucide="x" width="20"></i>'
        : '<i data-lucide="search" width="20"></i>';
    btn.classList.toggle('is-active', mapVisibleFilter.searchActive);
    if (window.lucide?.createIcons) lucide.createIcons();
    if (areaRow) areaRow.classList.toggle('hidden', !mapVisibleFilter.searchActive);
}

// 地图搜索时默认限定一个城市级别的最大半径（米）
const MAP_SEARCH_MAX_RADIUS_METERS = 50000;

function getStoresMatchingQuery(query, opts = {}) {
    const q = String(query || '').trim();
    if (!q) return [];
    const { bounds = null, center = null, maxMeters = 0 } = opts;
    const scoreFn = typeof window.scoreStoreSearch === 'function'
        ? window.scoreStoreSearch
        : ((qq, store) => {
            const k = String(qq || '').toLowerCase();
            const name = String(store?.name || '').toLowerCase();
            const addr = String(store?.address || store?.formattedAddress || '').toLowerCase();
            return (name.includes(k) || addr.includes(k)) ? 1 : 0;
        });
    const haversine = (a, b) => {
        if (!a || !b) return Infinity;
        const R = 6371000;
        const toRad = (x) => x * Math.PI / 180;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    };
    return (window.localStores || []).filter((s) => {
        const lat = Number(s.lat);
        const lng = Number(s.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (scoreFn(q, s) <= 0) return false;
        if (bounds && map) {
            try {
                const ll = new google.maps.LatLng(lat, lng);
                if (!bounds.contains(ll)) return false;
            } catch (e) { /* ignore */ }
        }
        if (center && maxMeters > 0) {
            const d = haversine(center, { lat, lng });
            if (d > maxMeters) return false;
        }
        return true;
    });
}

function getMapCurrentSearchScope() {
    if (!map?.getBounds) return { bounds: null, center: null };
    const bounds = map.getBounds();
    const c = map.getCenter?.();
    const center = c ? { lat: c.lat(), lng: c.lng() } : null;
    return { bounds, center };
}

function commitMapSearch() {
    const input = document.getElementById('q');
    const q = (input?.value || '').trim();
    if (!q) {
        clearMapSearchFilter();
        return;
    }
    const { bounds, center } = getMapCurrentSearchScope();
    // Pass 1：当前可见区域 + 最大 50km 半径（站在用户视角的附近搜索）
    let matched = getStoresMatchingQuery(q, {
        bounds,
        center,
        maxMeters: MAP_SEARCH_MAX_RADIUS_METERS
    });
    let expandedToFit = false;
    // Pass 2：视区里没有 → 在中心点 50km 内（不限制 bounds）找
    if (matched.length === 0 && center) {
        matched = getStoresMatchingQuery(q, { center, maxMeters: 50000 });
        if (matched.length > 0) expandedToFit = true;
    }
    // Pass 3：附近 50km 仍没有 → 扩大到周边 150km（覆盖大都会区周边城市）
    if (matched.length === 0 && center) {
        matched = getStoresMatchingQuery(q, { center, maxMeters: 150000 });
        if (matched.length > 0) expandedToFit = true;
    }
    if (matched.length === 0) {
        // 真的没有：轻提示，不激活筛选
        if (typeof window.showAppFeedbackToast === 'function') {
            window.showAppFeedbackToast('没有符合条件的店铺');
        }
        return;
    }
    // 进入搜索结果时自动清掉之前选中的 chip 筛选，避免命中店铺被分类/评分过滤掉
    mapVisibleFilter.categories.clear();
    mapVisibleFilter.minRating = 0;
    refreshMapChipUI();
    mapVisibleFilter.searchActive = true;
    mapVisibleFilter.searchMatchedIds = new Set(matched.map(s => String(s.id)));
    refreshMapSearchActionButton();
    const results = document.getElementById('results');
    if (results) results.classList.remove('active');
    if (typeof window.renderMarkers === 'function') window.renderMarkers();
    // 如果命中的店铺不在当前视窗里（被扩大半径找到的），平滑过渡到这些店铺
    if (expandedToFit && map?.fitBounds && window.google?.maps?.LatLngBounds) {
        try {
            const lb = new google.maps.LatLngBounds();
            matched.forEach(s => {
                const lat = Number(s.lat), lng = Number(s.lng);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    lb.extend(new google.maps.LatLng(lat, lng));
                }
            });
            smoothFlyToBounds(lb, 80);
        } catch (e) { /* ignore */ }
    }
}

// 计算让 bounds 完整显示在指定像素尺寸下所需的最小 zoom（参考 Google Maps Mercator 投影）
function computeBoundsZoom(bounds, mapDim) {
    if (!bounds) return 0;
    const WORLD_DIM = 256;
    const ZOOM_MAX = 21;
    const latRad = (lat) => {
        const sin = Math.sin(lat * Math.PI / 180);
        const r = Math.log((1 + sin) / (1 - sin)) / 2;
        return Math.max(Math.min(r, Math.PI), -Math.PI) / 2;
    };
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;
    const lngDiff = ne.lng() - sw.lng();
    const lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;
    if (latFraction <= 0 || lngFraction <= 0) return ZOOM_MAX;
    const latZoom = Math.floor(Math.log(mapDim.height / WORLD_DIM / latFraction) / Math.LN2);
    const lngZoom = Math.floor(Math.log(mapDim.width / WORLD_DIM / lngFraction) / Math.LN2);
    return Math.min(latZoom, lngZoom, ZOOM_MAX);
}

// 平滑过渡到目标 bounds：
// - 当前 zoom 已经能装下目标 → 仅平移 (panTo)，不缩放
// - 装不下 → 先缩到刚好装下的 zoom，再平滑 pan 过去
function smoothFlyToBounds(targetBounds, padding = 60) {
    if (!map || !targetBounds) return;
    try {
        const currentZoom = Number(map.getZoom?.() || 15);
        const div = map.getDiv?.();
        const mapDim = div
            ? { width: div.offsetWidth || 360, height: div.offsetHeight || 640 }
            : { width: 360, height: 640 };
        const reqZoom = computeBoundsZoom(targetBounds, mapDim);
        const center = targetBounds.getCenter();
        if (reqZoom >= currentZoom) {
            // 当前缩放已经够装下，纯平移
            animateMapCenterTo(center, 600);
        } else {
            // 需要缩小才能容下：先 setZoom 再平滑平移
            map.setZoom(Math.max(8, reqZoom));
            requestAnimationFrame(() => animateMapCenterTo(center, 600));
        }
    } catch (e) {
        try { map.fitBounds(targetBounds, padding); } catch (_) { /* ignore */ }
    }
}
window.smoothFlyToBounds = smoothFlyToBounds;

function clearMapSearchFilter() {
    mapVisibleFilter.searchActive = false;
    mapVisibleFilter.searchMatchedIds = null;
    const input = document.getElementById('q');
    if (input) input.value = '';
    const results = document.getElementById('results');
    if (results) {
        results.classList.remove('active');
        results.innerHTML = '';
    }
    refreshMapSearchActionButton();
    if (typeof window.renderMarkers === 'function') window.renderMarkers();
}

window.onMapSearchActionClick = () => {
    if (mapVisibleFilter.searchActive) {
        clearMapSearchFilter();
    } else {
        commitMapSearch();
    }
};

window.searchInVisibleArea = () => {
    // 移动地图后再次按当前视区重新搜索
    commitMapSearch();
};

window.clearMapSearchFilter = clearMapSearchFilter;

// 给 chip 行加上手动拖拽滚动逻辑（防止被 Google Map 的手势拦截）
function bindMapChipsDragScroll() {
    const el = document.getElementById('map-filter-chips');
    if (!el || el.dataset.dragBound === '1') return;
    el.dataset.dragBound = '1';
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let dragged = false;
    const SLOP = 5;

    el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        isDown = true;
        dragged = false;
        startX = e.clientX;
        scrollStart = el.scrollLeft;
    });
    el.addEventListener('pointermove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        if (!dragged && Math.abs(dx) > SLOP) {
            dragged = true;
            try { el.setPointerCapture(e.pointerId); } catch (_) { }
        }
        if (dragged) {
            el.scrollLeft = scrollStart - dx;
            e.preventDefault();
        }
    }, { passive: false });
    const finish = (e) => {
        if (!isDown) return;
        isDown = false;
        try { el.releasePointerCapture(e.pointerId); } catch (_) { }
        if (dragged) {
            // 阻止本次拖动后的 click 触发，避免误触发 chip 选择
            const blockClick = (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                el.removeEventListener('click', blockClick, true);
            };
            el.addEventListener('click', blockClick, true);
            setTimeout(() => el.removeEventListener('click', blockClick, true), 350);
        }
    };
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
    el.addEventListener('pointerleave', finish);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMapChipsDragScroll);
} else {
    bindMapChipsDragScroll();
}

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
        // 应用搜索 / 分类 / 评分筛选
        if (!storePassesMapFilter(store)) return;

        // 默认样式：先根据店铺主属性分类（吃 default / 喝 drink / 其他 other），再根据评分加 -low 后缀
        const avgRatingForPin = (typeof window.getStoreAverageRating === 'function')
            ? Number(window.getStoreAverageRating(store)) || 0
            : 0;
        const isLowRated = avgRatingForPin > 0 && avgRatingForPin < 3.5;
        const kind = classifyStorePinKind(store); // 'default' | 'drink' | 'other'
        const baseType = isLowRated ? `${kind}-low` : kind;
        let pinClass = `pin-${baseType}`;
        let iconHtml = getMapPinMarkup(baseType);

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

    // 渲染完成后立即应用一次紧凑模式
    applyMarkerCompactness();
};

// 根据当前缩放级别决定是否使用紧凑（小圆点）模式
function applyMarkerCompactness() {
    if (!map) return;
    const zoom = Number(map.getZoom() || 15);
    const compact = zoom <= 13;
    storeMarkers.forEach(m => {
        if (m && typeof m.setCompact === 'function') m.setCompact(compact);
    });
}

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
    refreshMapReviewSectionCounts(store);
    refreshMapFriendSection(store);
    if (!Array.isArray(window.allUsersCache) || !window.allUsersCache.length) {
        if (typeof window.ensureAllUsersLoaded === 'function') {
            window.ensureAllUsersLoaded().then(() => {
                mapCardState.friendSocial = computeMapFriendSocial(store.id || "");
                refreshMapSocialButtonsUI();
                refreshMapReviewSectionCounts(store);
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

// 国家/地区 → 优先语言代码
const COUNTRY_TO_LANG = {
    JP: 'ja',
    KR: 'ko',
    TW: 'zh-TW',
    HK: 'zh-HK',
    MO: 'zh-HK',
    CN: 'zh-CN',
    US: 'en', GB: 'en', AU: 'en', NZ: 'en', SG: 'en', CA: 'en', IE: 'en', PH: 'en',
    FR: 'fr', DE: 'de', IT: 'it', ES: 'es', PT: 'pt', NL: 'nl', BE: 'nl', CH: 'de', AT: 'de',
    TH: 'th', VN: 'vi', ID: 'id', MY: 'ms',
    RU: 'ru', UA: 'uk', PL: 'pl', CZ: 'cs', SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', GR: 'el',
    TR: 'tr', SA: 'ar', AE: 'ar',
    BR: 'pt-BR', MX: 'es', AR: 'es', CL: 'es', CO: 'es',
    IN: 'en'
};

function getCountryCodeFromPlace(place) {
    const comps = place?.addressComponents || place?.address_components || [];
    if (!Array.isArray(comps)) return '';
    const c = comps.find((x) => Array.isArray(x?.types) && x.types.includes('country'));
    const code = c?.shortText || c?.short_name || c?.shortName || '';
    return String(code || '').toUpperCase();
}

function getPreferredLanguageForPlace(place) {
    const code = getCountryCodeFromPlace(place);
    if (!code) return '';
    return COUNTRY_TO_LANG[code] || 'en';
}

const placeRegionalNameCache = new Map();
async function fetchPlaceNameByLanguage(placeId, languageCode) {
    if (!placeId || !languageCode) return '';
    const cacheKey = `${placeId}::${languageCode}`;
    if (placeRegionalNameCache.has(cacheKey)) return placeRegionalNameCache.get(cacheKey);
    try {
        const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(languageCode)}`, {
            headers: {
                'X-Goog-Api-Key': MAPS_API_KEY,
                'X-Goog-FieldMask': 'displayName',
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            placeRegionalNameCache.set(cacheKey, '');
            return '';
        }
        const data = await res.json();
        const name = normalizePlaceDisplayName(data?.displayName);
        placeRegionalNameCache.set(cacheKey, name);
        return name;
    } catch (err) {
        console.warn('fetchPlaceNameByLanguage failed:', err);
        placeRegionalNameCache.set(cacheKey, '');
        return '';
    }
}

function withPreferredPlaceName(basePlace = {}, localName = '', englishName = '', regionalName = '', regionalLang = '') {
    const next = { ...basePlace };
    const localTrim = String(localName || '').trim();
    const englishTrim = String(englishName || '').trim();
    const regionalTrim = String(regionalName || '').trim();
    // 优先级：店铺所在地区语言 > 当地（日文）> 英文
    const preferredName = String(regionalTrim || localTrim || englishTrim || normalizePlaceDisplayName(basePlace?.displayName) || '').trim();
    next.preferredName = preferredName;
    next.localName = localTrim;
    next.englishName = englishTrim;
    next.regionalName = regionalTrim;
    next.regionalLang = String(regionalLang || '').trim();
    let langCode = next.regionalLang;
    if (!langCode) langCode = localTrim ? 'ja' : (englishTrim ? 'en' : (basePlace?.displayName?.languageCode || ''));
    next.displayName = {
        text: preferredName,
        languageCode: langCode
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

async function mergeLocalizedPlaceResults(localizedPlaces = [], englishPlaces = []) {
    const localMap = new Map(localizedPlaces.map((p) => [p.id || '', p]));
    const englishMap = new Map(englishPlaces.map((p) => [p.id || '', p]));
    const ids = new Set([...localMap.keys(), ...englishMap.keys()].filter(Boolean));

    const items = Array.from(ids).map((id) => {
        const localPlace = localMap.get(id);
        const englishPlace = englishMap.get(id);
        const base = localPlace || englishPlace || {};
        const localName = normalizePlaceDisplayName(localPlace?.displayName);
        const englishName = normalizePlaceDisplayName(englishPlace?.displayName);
        return { id, base, localName, englishName };
    });

    // 根据每个店铺所在国家/地区，获取该地区语言的店名
    const enhanced = await Promise.all(items.map(async ({ id, base, localName, englishName }) => {
        const regionalLang = getPreferredLanguageForPlace(base);
        let regionalName = '';
        if (regionalLang === 'ja') {
            regionalName = localName;
        } else if (regionalLang === 'en') {
            regionalName = englishName;
        } else if (regionalLang) {
            regionalName = await fetchPlaceNameByLanguage(id, regionalLang);
        }
        return withPreferredPlaceName(base, localName, englishName, regionalName, regionalName ? regionalLang : '');
    }));
    return enhanced;
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
    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types,places.addressComponents' + (photo ? ',places.photos' : '');
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

// 文本搜索附近（locationBias = 以 origin 为圆心的圆）：用户输入文字时优先返回附近相关店铺
window.placesSearchTextNearOrigin = async (q, origin, radiusMeters = 30000, photo = false) => {
    if (!q || !origin) return [];
    const lat = Number(origin.lat);
    const lng = Number(origin.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types,places.addressComponents' + (photo ? ',places.photos' : '');
    try {
        const cuisineIntent = typeof window.resolveCuisineSearchIntent === 'function'
            ? window.resolveCuisineSearchIntent(q)
            : null;
        const body = {
            textQuery: cuisineIntent?.replaceQuery ? cuisineIntent.searchQuery : q,
            locationBias: {
                circle: {
                    center: { latitude: lat, longitude: lng },
                    radius: Math.max(100, Math.min(50000, Number(radiusMeters) || 30000))
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

window.placesSearchTextByBounds = async (q, bounds, photo = false) => {
    if (!q || !bounds || !window.google?.maps) return [];
    const ne = bounds.getNorthEast?.();
    const sw = bounds.getSouthWest?.();
    if (!ne || !sw) return [];

    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types,places.addressComponents' + (photo ? ',places.photos' : '');
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
    const f = 'places.displayName,places.formattedAddress,places.location,places.id,places.regularOpeningHours,places.currentOpeningHours,places.primaryType,places.primaryTypeDisplayName,places.types,places.photos,places.addressComponents';

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
    // 始终以"我的评价"实际条数为准，避免缓存的 mapCardState.checkInCount 过期
    const card = document.getElementById('map-detail-card');
    const storeId = card?.dataset?.storeId || '';
    let count = Number(mapCardState.checkInCount) || 0;
    if (storeId && Array.isArray(window.localStores)) {
        const store = window.localStores.find(s => s.id === storeId);
        if (store) {
            const revs = Array.isArray(store.revs) ? store.revs : [];
            count = revs.filter(r => isMyMapReview(r)).length;
            mapCardState.checkInCount = count;
        }
    }
    const txt = document.getElementById('txt-checkin-count');
    const label = document.querySelector('.sheet-checkin-btn .checkin-label');
    if (txt) {
        txt.innerText = formatCheckInCountLabel(count);
    }
    if (label) label.innerText = count > 0 ? '再吃' : '记录';
}

function formatCheckInCountLabel(count) {
    const normalizedCount = Number.isFinite(Number(count)) ? Number(count) : 0;
    if (normalizedCount <= 0) return '(还没吃过)';
    const displayCount = normalizedCount > 99 ? '99+' : String(normalizedCount);
    return `(吃过${displayCount}次)`;
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
        // 图片放大弹窗打开期间的所有点击都不应关闭店铺弹窗
        const imgModal = document.getElementById('activity-image-modal');
        if (imgModal && imgModal.classList.contains('open')) return;
        if (e.target.closest('#activity-image-modal')) return;
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

// 地图右下角按钮：平滑回到当前定位（保持当前 zoom，仅平移）
window.recenterMapToOrigin = () => {
    if (!map) return;
    const origin = getMapCenterFromOrigin();
    if (!origin) return;
    try {
        const lat = Number(origin.lat ?? origin.lat?.());
        const lng = Number(origin.lng ?? origin.lng?.());
        if (Number.isFinite(lat) && Number.isFinite(lng) && window.google?.maps?.LatLng) {
            animateMapCenterTo(new google.maps.LatLng(lat, lng), 600);
            renderCurrentOriginMarker();
            return;
        }
    } catch (e) { /* fallthrough */ }
    map.setCenter(origin);
    renderCurrentOriginMarker();
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
