const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = readFileSync(join(__dirname, '..', 'app.js'), 'utf8');
const publishCode = source.slice(
    source.indexOf('async function getNewStoreDocumentId('),
    source.indexOf('\n/**\n * 图片预览', source.indexOf('window.submitNew = async'))
);
const normalizeCode = source.match(/function normalizeStoreName\(name\) \{[\s\S]*?\n\}/)[0];
const clone = value => JSON.parse(JSON.stringify(value));

// Model optimistic Firestore commits: two readers can see an absent document,
// but the loser must rerun its callback after the winner commits.
function createDatabase() {
    const documents = new Map();
    const versions = new Map();
    let retries = 0;
    return {
        documents,
        get retries() { return retries; },
        async runTransaction(_db, callback) {
            for (let attempt = 0; attempt < 20; attempt++) {
                const reads = new Map();
                const writes = [];
                const result = await callback({
                    async get(path) {
                        reads.set(path, versions.get(path) || 0);
                        const data = documents.get(path);
                        // Yield with this snapshot captured to force overlapping reads.
                        await Promise.resolve();
                        return { exists: () => data !== undefined, data: () => clone(data) };
                    },
                    set: (path, data) => writes.push({ path, data, create: true }),
                    update: (path, data) => writes.push({ path, data, create: false })
                });
                if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) {
                    retries++;
                    continue;
                }
                for (const { path, data, create } of writes) {
                    const next = create ? clone(data) : clone(documents.get(path));
                    if (!create) for (const [field, value] of Object.entries(data)) {
                        if (value && value.arrayUnionValues) {
                            const entries = Array.isArray(next[field]) ? next[field] : [];
                            for (const item of value.arrayUnionValues) {
                                if (!entries.some(entry => JSON.stringify(entry) === JSON.stringify(item))) entries.push(clone(item));
                            }
                            next[field] = entries;
                        } else next[field] = clone(value);
                    }
                    documents.set(path, next);
                    versions.set(path, (versions.get(path) || 0) + 1);
                }
                return result;
            }
            throw new Error('Transaction retry limit');
        }
    };
}

function createClient(database, uid, options = {}) {
    const nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { value: '', files: [], innerHTML: '', style: {}, classList: { add() {}, remove() {} } });
        return nodes.get(id);
    };
    Object.assign(node('newName'), { value: options.name || 'Shared restaurant' });
    node('newBudget').value = '1000';
    node('newReview').value = `Review by ${uid}`;
    node('newMealDate').value = '2026-10-07';
    node('add-rating-slider').value = '4';
    node('fileInput').files = [{ name: `${uid}.jpg`, size: 100, type: 'image/jpeg' }];
    const successes = [], errors = [], deletedImages = [];
    const context = vm.createContext({
        console: { warn() {}, error() {} }, crypto: webcrypto, TextEncoder,
        document: { getElementById: node }, window: { t: key => key },
        db: {}, currentUser: { uid, displayName: uid, email: `${uid}@example.com` },
        isSubmittingReview: false, lastSubmitAt: 0, SUBMIT_COOLDOWN_MS: 3000,
        MAX_REVIEW_IMAGES: 5, MAX_IMAGE_BYTES: 8 * 1024 * 1024, MAX_REVIEW_TEXT_LEN: 2000,
        localStores: options.localStores || [], selectedExistingStoreId: options.existingId || null,
        selectedStorePlaceId: options.placeId === undefined ? 'ChIJ-shared-place' : options.placeId,
        selectedStoreLocation: options.location || { lat: 35.69, lng: 139.69 },
        selectedStoreOpeningHours: null, selectedStoreDistance: 100,
        selectedStoreAddress: 'Tokyo', selectedStoreCuisineLabel: 'Japanese',
        selectedStorePrimaryType: 'restaurant', selectedStoreTypes: ['restaurant'],
        fetchedPhotoRef: 'places/example/photos/cover', MAPS_API_KEY: 'test-only',
        isImageFile: () => true, uploadImageAssetPair: async () => `${uid}-review.jpg`,
        copyGooglePlacePhotoToStorage: async () => `${uid}-cover.jpg`,
        getImageAssetFullUrl: entry => entry, getImageAssetThumbUrl: entry => entry,
        collectImageAssetUrls: entries => entries,
        collectStoreAllImageUrls: store => [store.googleCoverImage, ...(store.images || []), ...(store.revs || []).flatMap(review => review.images || [])],
        deleteStorageFilesByUrls: async urls => deletedImages.push(...urls),
        getStoreLinearDistanceMeters: () => 100,
        collection: (_db, name) => name, where: (field, _op, value) => ({ field, value }),
        query: (collection, constraint) => ({ collection, ...constraint }),
        getDocs: options.getDocs || (async () => ({ empty: true, docs: [] })),
        doc: (_db, collection, id) => `${collection}/${id}`,
        arrayUnion: (...values) => ({ arrayUnionValues: values }),
        runTransaction: database.runTransaction,
        normalizeDayKeyInput: value => value, getTodayDayKey: () => '2026-10-07',
        isAddComposerEditMode: () => false, getCurrentUserAliases: () => [uid],
        isReviewMine: (review, aliases) => aliases.includes(review.uid),
        switchView() {}, resetSelectedStoreState() {}, resetAddComposerFlow() {},
        openPostSuccessModal: payload => successes.push(payload),
        showAppNoticeModal: message => errors.push(message)
    });
    vm.runInContext(normalizeCode + '\n' + publishCode, context);
    return { context, publish: () => context.window.submitNew(), successes, errors, deletedImages };
}

// Exercise the actual submitNew path in separate client contexts, with both
// legacy lookups returning empty, rather than testing only the ID helper.
test('simultaneous first publications produce one store and retain both reviews/photos', async () => {
    const db = createDatabase();
    const alice = createClient(db, 'alice');
    const bob = createClient(db, 'bob', { name: 'Localized restaurant name' });
    await Promise.all([alice.publish(), bob.publish()]);
    assert.deepEqual(alice.errors, []);
    assert.deepEqual(bob.errors, []);
    assert.equal(db.documents.size, 1);
    const store = [...db.documents.values()][0];
    assert.deepEqual(store.revs.map(review => review.uid).sort(), ['alice', 'bob']);
    assert.ok(store.images.includes('alice-review.jpg'));
    assert.ok(store.images.includes('bob-review.jpg'));
    assert.equal(store.images.filter(image => image.endsWith('-cover.jpg')).length, 1);
    assert.ok(db.retries > 0, 'must exercise a conflicting read and transaction retry');
    const deleted = [...alice.deletedImages, ...bob.deletedImages];
    assert.equal(deleted.length, 1, 'clean up only the losing publication’s cover');
    assert.ok(!store.images.includes(deleted[0]));
    assert.equal([...alice.successes, ...bob.successes].filter(result => result.isNewStore).length, 1);
});

test('legacy random document IDs are reused without losing existing data', async () => {
    const db = createDatabase();
    const original = { name: 'Legacy name', googlePlaceId: 'ChIJ-shared-place', address: 'Original address', googleCoverImage: 'original.jpg', images: ['original.jpg'], revs: [{ uid: 'old-user', rating: 3 }] };
    db.documents.set('stores/old-random-id', clone(original));
    const localStores = [{ id: 'old-random-id', ...original }];
    const alice = createClient(db, 'alice', { localStores, existingId: 'old-random-id' });
    const bob = createClient(db, 'bob', { localStores, existingId: 'old-random-id' });
    await Promise.all([alice.publish(), bob.publish()]);
    assert.deepEqual([...alice.errors, ...bob.errors], []);
    assert.equal(db.documents.size, 1);
    const store = db.documents.get('stores/old-random-id');
    assert.equal(store.revs.length, 3);
    assert.equal(store.address, original.address);
    assert.equal(store.googleCoverImage, original.googleCoverImage);
    assert.equal(store.images.length, 3);
});

test('a remotely discovered legacy store is reused when local caches are empty', async () => {
    const db = createDatabase();
    const original = { name: 'Legacy', googlePlaceId: 'ChIJ-shared-place', images: [], revs: [] };
    db.documents.set('stores/remote-old-id', clone(original));
    const client = createClient(db, 'alice', { getDocs: async () => ({ empty: false, docs: [{ id: 'remote-old-id', data: () => clone(original) }] }) });
    await client.publish();
    assert.deepEqual(client.errors, []);
    assert.equal(db.documents.size, 1);
    assert.equal(db.documents.get('stores/remote-old-id').revs.length, 1);
});

test('same-name branches with different Place IDs remain separate', async () => {
    const db = createDatabase();
    const alice = createClient(db, 'alice', { placeId: 'branch-a' });
    const bob = createClient(db, 'bob', { placeId: 'branch-b' });
    await Promise.all([alice.publish(), bob.publish()]);
    assert.deepEqual([...alice.errors, ...bob.errors], []);
    assert.equal(db.documents.size, 2);
});

test('missing Place IDs use stable name/location identity', async () => {
    const db = createDatabase();
    const alice = createClient(db, 'alice', { placeId: null });
    const bob = createClient(db, 'bob', { placeId: null });
    await Promise.all([alice.publish(), bob.publish()]);
    assert.deepEqual([...alice.errors, ...bob.errors], []);
    assert.equal(db.documents.size, 1);
    assert.equal([...db.documents.values()][0].revs.length, 2);
    const other = createClient(db, 'other', { placeId: null, location: { lat: 35.8, lng: 139.8 } });
    await other.publish();
    assert.equal(db.documents.size, 2);
});

test('lookup failures stop publication rather than creating a duplicate', async () => {
    const db = createDatabase();
    const client = createClient(db, 'alice', { getDocs: async () => { throw new Error('permission-denied'); } });
    await client.publish();
    assert.deepEqual(client.errors, ['permission-denied']);
    assert.equal(client.successes.length, 0);
    assert.equal(db.documents.size, 0);
});

test('a store deleted before the transaction is not recreated from stale cache', async () => {
    const db = createDatabase();
    const client = createClient(db, 'alice', { localStores: [{ id: 'deleted', name: 'Shared restaurant' }], existingId: 'deleted' });
    await client.publish();
    assert.deepEqual(client.errors, ['notice.storeNotFound']);
    assert.equal(db.documents.size, 0);
});

test('same-name local and remote matches with a different Place ID are not reused', async () => {
    const db = createDatabase();
    const original = { name: 'Shared restaurant', googlePlaceId: 'other-branch', images: [], revs: [] };
    db.documents.set('stores/other-branch-id', clone(original));
    const client = createClient(db, 'alice', {
        localStores: [{ id: 'other-branch-id', ...original }],
        getDocs: async request => request.field === 'googlePlaceId'
            ? { empty: true, docs: [] }
            : { empty: false, docs: [{ id: 'other-branch-id', data: () => clone(original) }] }
    });
    await client.publish();
    assert.deepEqual(client.errors, []);
    assert.equal(db.documents.size, 2);
    assert.equal(db.documents.get('stores/other-branch-id').revs.length, 0);
});
