const fs = require('fs')
const path = require('path')

function findCustomItems(options = {}) {
  const { components, apis } = options
  /** @type {Record<string,string>|undefined} */
  let component = undefined
  /** @type {Record<string,string>|undefined} */
  let api = undefined
  if (fs.existsSync(components) && fs.statSync(components).isDirectory()) {
    component = fs.readdirSync(components).reduce((prev, current) => {
      const name = current.replace(/\.(t|j)sx?$/, '')
      prev[name] = path.resolve(components, current)
      return prev
    }, {})
  }
  if (fs.existsSync(apis) && fs.statSync(apis).isDirectory()) {
    api = fs.readdirSync(apis).reduce((prev, current) => {
      const name = current.replace(/\.(t|j)sx?$/, '')
      prev[name] = path.resolve(apis, current)
      return prev
    }, {})
  }
  // console.info({ api, component })
  return { api, component }
}
module.exports = (_, options = {}) => {
  const taroOrigin = require('babel-preset-taro')
  if (process.env.TARO_ENV != 'rn') {
    return taroOrigin(_, options)
  }
  const { presets, plugins } = taroOrigin(_, options)
  // taro-rn api/lib 支持按需引入
  const nativeApis = require('@tarojs/taro-rn/apiList.js')
  const nativeLibs = require('@tarojs/taro-rn/libList.js')
  const nativeInterfaces = nativeApis.concat(nativeLibs)

  const transformPlugin = require('babel-plugin-transform-imports-api').default
  const transformIndex = plugins.findIndex(plugin => plugin?.[0] === transformPlugin)

  const { component = {}, api = {} } = findCustomItems(options)
  const plugin = [transformPlugin, {
    packagesApis: new Map([
      ['@tarojs/taro', new Set(nativeInterfaces)],
      ['@tarojs/taro-rn', new Set(nativeInterfaces)]
    ]),
    usePackgesImport: true, // Whether to use packagesImport
    packagesImport: {
      '^@tarojs/components(-rn)?$': {
        transform: (importName) => {
          const local = component[importName]
          if (local) {
            return local
          }
          return `@tarojs/components-rn/dist/components/${importName}`
        }
      },
      // '^@tarojs/components-rn$': {
      //   transform: (importName) => `@tarojs/components-rn/dist/components/${importName}`,
      // },
      '^@tarojs/taro(-rn)?$': {
        transform: (importName) => {
          const local = api[importName]
          // console.info(`import {${importName}} from '@tarojs/taro'`)
          if (local) {
            return local
          }
          if (nativeLibs.includes(importName)) {
            return `@tarojs/taro-rn/dist/lib/${importName}`
          } else {
            return '@tarojs/taro-rn/dist/api'
          }
        },
        skipDefaultConversion: true
      },
      // '^@tarojs/taro-rn$': {
      //   transform: (importName) => {
      //     console.info(`import {${importName}} from '@tarojs/taro-rn'`)
      //     const local = api[importName]
      //     if (local) {
      //       return local
      //     }
      //     if (nativeLibs.includes(importName)) {
      //       return `@tarojs/taro-rn/dist/lib/${importName}`
      //     } else {
      //       return '@tarojs/taro-rn/dist/api'
      //     }
      //   },
      //   skipDefaultConversion: true
      // },
      // '^@tarojs/components(-rn)?$': {
      //   transform: '@tarojs/components-rn/dist/components/${member}'
      // },
      // '^@tarojs/taro(-rn)?$': {
      //   transform: (importName) => {
      //     if (nativeLibs.includes(importName)) {
      //       return `@tarojs/taro-rn/dist/lib/${importName}`
      //     } else {
      //       return '@tarojs/taro-rn/dist/api'
      //     }
      //   },
      //   skipDefaultConversion: true
      // }
    }
  }]
  plugins[transformIndex] = plugin
  // plugins.splice(transformIndex, 1, plugin)

  return {
    presets,
    plugins
  }
}
