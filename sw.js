const VERSION = '0.0.6';

class CacheManager {
    #staticFiles = [
        '/',
        '/index.html',
        '/contact',
        '/contact/index.html',
        '/about',
        '/about/index.html',
        '/js/index.js',
        '/css/styles.css',
        '/offline.html',
    ];

    #assets = [
        '/assets/offline.gif',
        '/assets/home.png',
        '/assets/about.png',
        '/assets/contact.png',
    ];
    #fileCacheName;
    #assetsCacheName;
    #dynamicCacheName;

    constructor(version) {
        this.#fileCacheName = `rufi/static/${version}`;
        this.#assetsCacheName = `rufi/assets/${version}`;
        this.#dynamicCacheName = `rufi/dynamic/${version}`;
    }

    async fetchAndCache() {
        try {
            const fileCache = await caches.open(this.#fileCacheName);
            await fileCache.addAll(this.#staticFiles);

            const assetsCache = await caches.open(this.#assetsCacheName);
            await assetsCache.addAll(this.#assets);
        } catch (error) {
            console.error('Failed to add cache: ' + error);
        }
    }

    async clearOldCache() {
        try {
            const cachesList = await caches.keys();
            const oldCaches = cachesList.filter((cacheKey) =>
                cacheKey !== this.#fileCacheName
                && cacheKey !== this.#assetsCacheName
                && cacheKey !== this.#dynamicCacheName
            );

            const results = await Promise.all(oldCaches.map((oldKey) => caches.delete(oldKey)));
            
            const haveNotDeletedEntries = results.some((isDeleted) => !isDeleted);
            if(haveNotDeletedEntries) {
                const failedEntries = results.reduce((entries, isDeleted, index) => {
                    if(!isDeleted) {
                        entries.push(oldCaches[index]);
                    }

                    return entries;
                }, []);

                throw new Error('Error while procesing delete operation on ' + failedEntries.toString());
            }
        } catch (error) {
            console.error('Failed to clear cache: ' + error);
        }
    }

    #isStaticFileResponse(response) {
        const supportedFilesRegexList = [
            /^text\/css/i,
            /^text\/html/i,
            /text\/javascript/i,
        ];

        const contentType = response.headers.get('content-type');
        return supportedFilesRegexList.some(regex => contentType.match(regex));
    }

    #isAssetResponse(response) {
        const supportedMediaMIMERegexList = [
            /^image\/png/i,
            /^image\/gif/i,
        ];

        const contentType = response.headers.get('content-type');
        return supportedMediaMIMERegexList.some(regex => contentType.match(regex));
    }

    async cacheResponse(request, response) {
        if(this.#isAssetResponse(response.clone())) {
            const cache = await caches.open(this.#assetsCacheName);
            await cache.put(request, response.clone());
            return;
        }

        if(this.#isStaticFileResponse(response.clone())) {
            const cache = await caches.open(this.#fileCacheName);
            await cache.put(request, response.clone());
            return;
        }

        const cache = await caches.open(this.#dynamicCacheName);
        await cache.put(request, response.clone());
        return;
    }

    async getOfflineResponse() {
        return caches.match('/offline.html');
    }
}

const cacheManager = new CacheManager(VERSION);

self.addEventListener('install', (ev) => {
    ev.waitUntil(
        Promise.resolve()
        .then(() => cacheManager.fetchAndCache())
        .catch((error) => {
            throw new Error('Failed to cache resources on service worker install: ' + error);
        })
    );
});

self.addEventListener('activate', (ev) => {
    ev.waitUntil(
        Promise.resolve()
        .then(() => cacheManager.clearOldCache())
        .catch((error) => {
            throw new Error('Failed to clear cache from previous iterations: ' + error);
        })
    )
});

self.addEventListener('fetch', (ev) => {
    ev.respondWith(
    caches.match(ev.request.url)
        .then((cacheResponse) => {
            if(cacheResponse) {
                return Promise.resolve(cacheResponse);
            }

            return fetch(ev.request)
                .then((fetchResponse) => {
                    cacheManager.cacheResponse(ev.request, fetchResponse.clone());

                    return fetchResponse;
                },
                (err) => {
                    if(ev.request.url.match(/\.html$/i)) {
                        return cacheManager.getOfflineResponse();
                    }
                },
            );
        })
        .catch((error) => {
            console.error('Failed to fetch: ', error);
        })
);
});