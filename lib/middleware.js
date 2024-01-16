const { gzipSync } = require('zlib')

const generateETag = require('etag')
const fresh = require('fresh')

const { createSitemap, createSitemapIndex } = require('./builder')
const { createRoutesCache, createSitemapIndexCache } = require('./cache')
const logger = require('./logger')
const { setDefaultSitemapOptions, setDefaultSitemapIndexOptions } = require('./options')
const { excludeRoutes } = require('./routes')

/**
 * Register a middleware for each sitemap or sitemapindex
 *
 * @param {Object} options
 * @param {Object} globalCache
 * @param {Nuxt}   nuxtInstance
 * @param {number} depth
 */
async function registerSitemaps(options, globalCache, nuxtInstance, depth = 0) {
  /* istanbul ignore if */
  if (depth > 1) {
    // see https://webmasters.stackexchange.com/questions/18243/can-a-sitemap-index-contain-other-sitemap-indexes
    logger.warn("A sitemap index file can't list other sitemap index files, but only sitemap files")
  }

  const isSitemapIndex = options && options.sitemaps

  if (isSitemapIndex) {
    await registerSitemapIndex(options, globalCache, nuxtInstance, depth)
  } else {
    await registerSitemap(options, globalCache, nuxtInstance, depth)
  }
}

let cacheRoutes = {}

/**
 * Register a middleware to serve a sitemap
 *
 * @param {Object} options
 * @param {Object} globalCache
 * @param {Nuxt}   nuxtInstance
 * @param {number} depth
 */
async function registerSitemap(options, globalCache, nuxtInstance, depth = 0) {
  const base = nuxtInstance.options.router.base
  // Init options
  options = setDefaultSitemapOptions(options, nuxtInstance, depth > 0)
  if ( ! options.path in cacheRoutes )
  {
    cacheRoutes[options.path] = createRoutesCache(options)
  }

  const cacheLinkedSitemaps = async (sitemaps) => {
    cacheRoutes = { index: cacheRoutes['index'], indexLazy: cacheRoutes['indexLazy'] }
    await Promise.all(sitemaps.map(async (sitemapOptions) =>{
      options = setDefaultSitemapOptions(sitemapOptions, nuxtInstance, true)
      cacheRoutes[options.path] = createRoutesCache(sitemapOptions)
    }))
  }

  // Add server middleware for anything starting with /sitemap and ends with .xml.gz
  if (options.gzip) {
    nuxtInstance.addServerMiddleware({
      path:'/sitemap',
      async handler(req, res, next) {
        try {
          if(!req.url.endsWith('.xml.gz')){
            next()
            return
          }
          const key = `sitemap${req.url}`.replace('.gz','')
          const cache = await cacheRoutes[key]?.get(key)
          if(!cache){
            res.writeHead(404)
            res.end()
            return
          }

          const gzip = await createSitemap(cache.options, cache.routes, base, req).toGzip()
          // Check cache headers
          if (validHttpCache(gzip, options.etag, req, res)) {
            return
          }
          // Send http response
          res.setHeader('Content-Type', 'application/gzip')
          res.end(gzip)

          // Refresh cache after serving the page.
          const sitemaps = await cacheRoutes['index'].get('sitemaps')
          await cacheLinkedSitemaps( sitemaps )

        } catch (err) {
          /* istanbul ignore next */
          next(err)
        }
      },
    })
  }

  // Add server middleware for routes starting with /sitemap
  nuxtInstance.addServerMiddleware({
    path:'/sitemap',
    /**
     * @param {Request} req
     * @param {Response} res
     * @param {*} next
     */
    async handler(req, res, next) {
      try {
        if(!req.url.endsWith('.xml')){
          res.writeHead(404)
          res.end()
          return
        }
      
        const key = `sitemap${req.url}`
        const cache = await cacheRoutes[key]?.get(key)
        if(!cache?.routes?.length){
          cacheRoutes[key]?.del(key)
          res.writeHead(404)
          res.end()
          return
        }

        const xml = await createSitemap(cache.options, cache.routes, base, req).toXML()
        
        // Check cache headers
        if (validHttpCache(xml, cache.options.etag, req, res)) {
          return
        }
        // Send http response
        res.setHeader('Content-Type', 'application/xml')
        res.end(xml)

        // Refresh cache after serving the page.
        const sitemaps = await cacheRoutes['index'].get('sitemaps')
        await cacheLinkedSitemaps( sitemaps )

      } catch (err) {
        /* istanbul ignore next */
        next(err)
      }
    },
  })

  Promise.resolve()
}

/**
 * Register a middleware to serve a sitemapindex
 *
 * @param {Object} options
 * @param {Object} globalCache
 * @param {Nuxt}   nuxtInstance
 * @param {number} depth
 */
async function registerSitemapIndex(options, globalCache, nuxtInstance, depth = 0) {
  const base = nuxtInstance.options.router.base

  // Init options
  options = setDefaultSitemapIndexOptions(options, nuxtInstance)

  cacheRoutes['index'] = createSitemapIndexCache(options)

  const cacheLinkedSitemaps = async (sitemaps) => {
    cacheRoutes = { index: cacheRoutes['index'], indexLazy: cacheRoutes['indexLazy'] }
    await Promise.all(sitemaps.map(async (sitemapOptions) =>{
      options = setDefaultSitemapOptions(sitemapOptions, nuxtInstance, true)
      cacheRoutes[options.path] = createRoutesCache(sitemapOptions)
    }))
  }

  if (options.gzip) {
    // Add server middleware for sitemapindex.xml.gz
    nuxtInstance.addServerMiddleware({
      path: options.pathGzip,
      async handler(req, res, next) {
        // Init sitemap index
        const sitemaps = cacheRoutes['indexLazy']
        const sitemapIndex = await createSitemapIndex( { ...options, sitemaps }, base, req )
        const gzip = gzipSync(sitemapIndex)
        // Check cache headers
        if (validHttpCache(gzip, options.etag, req, res)) {
          return
        }
        // Send http response
        res.setHeader('Content-Type', 'application/gzip')
        res.end(gzip)

        // Refresh sitemaps cache after serving the page.
        const updatedSitemaps = await cacheRoutes['index'].get('sitemaps')
        cacheRoutes['indexLazy'] = updatedSitemaps
        await cacheLinkedSitemaps( updateSitemaps )
      },
    })
  }

  // Add server middleware for sitemapindex.xml
  nuxtInstance.addServerMiddleware({
    path: options.path,
    async handler(req, res, next) {
      // Init sitemap index
      const sitemaps = cacheRoutes['indexLazy']
      const xml = await createSitemapIndex( { ...options, sitemaps }, base, req )
      // Check cache headers
      if (validHttpCache(xml, options.etag, req, res)) {
        return
      }
      // Send http response
      res.setHeader('Content-Type', 'application/xml')
      res.end(xml)

      // Refresh sitemaps cache after serving the page.
      const updatedSitemaps = await cacheRoutes['index'].get('sitemaps')
      cacheRoutes['indexLazy'] = updatedSitemaps
      await cacheLinkedSitemaps( updateSitemaps )
    },
  })

  // Register linked sitemaps
  const sitemaps = await cacheRoutes['index'].get('sitemaps')
  cacheRoutes['indexLazy'] = sitemaps
  await cacheLinkedSitemaps( sitemaps )
  await Promise.all(sitemaps.map(async (sitemapOptions) =>{
    await registerSitemaps(sitemapOptions, globalCache, nuxtInstance, depth + 1)
  }))
}

/**
 * Validate the freshness of HTTP cache using headers
 *
 * @param {Object} entity
 * @param {Object} options
 * @param {Request} req
 * @param {Response} res
 * @returns {boolean}
 */
function validHttpCache(entity, options, req, res) {
  if (!options) {
    return false
  }
  const { hash } = options
  const etag = hash ? hash(entity, options) : generateETag(entity, options)
  if (fresh(req.headers, { etag })) {
    // Resource not modified
    res.statusCode = 304
    res.end()
    return true
  }
  // Add ETag header
  res.setHeader('ETag', etag)
  return false
}

module.exports = { registerSitemaps }
