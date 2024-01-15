


[![@nuxtjs/sitemap](docs/static/preview.png)](https://sitemap.nuxtjs.org)

# Sitemap Module

[![npm (scoped with tag)](https://img.shields.io/npm/v/@nuxtjs/sitemap/latest?style=flat-square)](https://npmjs.com/package/@nuxtjs/sitemap)
[![Downloads](https://img.shields.io/npm/dw/@nuxtjs/sitemap?style=flat-square)](https://npmjs.com/package/@nuxtjs/sitemap)
[![Build Status](https://img.shields.io/circleci/project/github/nuxt-community/sitemap-module?style=flat-square)](https://app.circleci.com/pipelines/github/nuxt-community/sitemap-module)
[![Coverage Status](https://img.shields.io/codecov/c/github/nuxt-community/sitemap-module?style=flat-square)](https://codecov.io/gh/nuxt-community/sitemap-module)
[![License](https://img.shields.io/npm/l/@nuxtjs/sitemap?style=flat-square)](http://standardjs.com)

> Automatically generate or serve dynamic [sitemap.xml](https://www.sitemaps.org/protocol.html) for Nuxt projects!

## Whats overwritten

1. Sitemaps property can be an async function.
2. Can add a cache time for sitemap index.
3. All sitemaps must be in a folder named 'sitemap', e.g.:

    ```js
    {
        sitemaps : async () => {
	        return [
		        {
			        path:'sitemap/your-site-map.xml'
		        }
	        ]
        },
        cacheTime: 1000
    }
    ```
4. Cache refreshes after serving the file, so there's no waiting when the requests are being made. One problem is: lastmod for sitemaps in sitemap index however updates prematurely.
5. `globalCache` internal variable is no longer used, so some functionality tied to it may be broken, e.g. `staticRoutes`.

## Warning!
Did not test it fully, only tested sitemap index configuration, no gzip or other options were tested either.


<p align="center">
  <a href="https://sitemap.nuxtjs.org">Read Documentation</a>
</p>

[📖 **Release Notes**](./CHANGELOG.md)

## License

[MIT License](./LICENSE)

## Contributors

- [Nicolas Pennec](https://github.com/NicoPennec)
- [Pooya Parsa](https://github.com/pi0)

## Fork

- [mluria21](https://github.com/mluria21)
- [dta90d](https://github.com/dta90d)
