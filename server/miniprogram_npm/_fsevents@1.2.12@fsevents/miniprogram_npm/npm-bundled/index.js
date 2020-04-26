module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1587225872310, function(require, module, exports) {


// walk the tree of deps starting from the top level list of bundled deps
// Any deps at the top level that are depended on by a bundled dep that
// does not have that dep in its own node_modules folder are considered
// bundled deps as well.  This list of names can be passed to npm-packlist
// as the "bundled" argument.  Additionally, packageJsonCache is shared so
// packlist doesn't have to re-read files already consumed in this pass

const fs = require('fs')
const path = require('path')
const EE = require('events').EventEmitter
// we don't care about the package bins, but we share a pj cache
// with other modules that DO care about it, so keep it nice.
const normalizePackageBin = require('npm-normalize-package-bin')

class BundleWalker extends EE {
  constructor (opt) {
    opt = opt || {}
    super(opt)
    this.path = path.resolve(opt.path || process.cwd())

    this.parent = opt.parent || null
    if (this.parent) {
      this.result = this.parent.result
      // only collect results in node_modules folders at the top level
      // since the node_modules in a bundled dep is included always
      if (!this.parent.parent) {
        const base = path.basename(this.path)
        const scope = path.basename(path.dirname(this.path))
        this.result.add(/^@/.test(scope) ? scope + '/' + base : base)
      }
      this.root = this.parent.root
      this.packageJsonCache = this.parent.packageJsonCache
    } else {
      this.result = new Set()
      this.root = this.path
      this.packageJsonCache = opt.packageJsonCache || new Map()
    }

    this.seen = new Set()
    this.didDone = false
    this.children = 0
    this.node_modules = []
    this.package = null
    this.bundle = null
  }

  addListener (ev, fn) {
    return this.on(ev, fn)
  }

  on (ev, fn) {
    const ret = super.on(ev, fn)
    if (ev === 'done' && this.didDone) {
      this.emit('done', this.result)
    }
    return ret
  }

  done () {
    if (!this.didDone) {
      this.didDone = true
      if (!this.parent) {
        const res = Array.from(this.result)
        this.result = res
        this.emit('done', res)
      } else {
        this.emit('done')
      }
    }
  }

  start () {
    const pj = path.resolve(this.path, 'package.json')
    if (this.packageJsonCache.has(pj))
      this.onPackage(this.packageJsonCache.get(pj))
    else
      this.readPackageJson(pj)
    return this
  }

  readPackageJson (pj) {
    fs.readFile(pj, (er, data) =>
      er ? this.done() : this.onPackageJson(pj, data))
  }

  onPackageJson (pj, data) {
    try {
      this.package = normalizePackageBin(JSON.parse(data + ''))
    } catch (er) {
      return this.done()
    }
    this.packageJsonCache.set(pj, this.package)
    this.onPackage(this.package)
  }

  allDepsBundled (pkg) {
    return Object.keys(pkg.dependencies || {}).concat(
      Object.keys(pkg.optionalDependencies || {}))
  }

  onPackage (pkg) {
    // all deps are bundled if we got here as a child.
    // otherwise, only bundle bundledDeps
    // Get a unique-ified array with a short-lived Set
    const bdRaw = this.parent ? this.allDepsBundled(pkg)
      : pkg.bundleDependencies || pkg.bundledDependencies || []

    const bd = Array.from(new Set(
      Array.isArray(bdRaw) ? bdRaw
      : bdRaw === true ? this.allDepsBundled(pkg)
      : Object.keys(bdRaw)))

    if (!bd.length)
      return this.done()

    this.bundle = bd
    const nm = this.path + '/node_modules'
    this.readModules()
  }

  readModules () {
    readdirNodeModules(this.path + '/node_modules', (er, nm) =>
      er ? this.onReaddir([]) : this.onReaddir(nm))
  }

  onReaddir (nm) {
    // keep track of what we have, in case children need it
    this.node_modules = nm

    this.bundle.forEach(dep => this.childDep(dep))
    if (this.children === 0)
      this.done()
  }

  childDep (dep) {
    if (this.node_modules.indexOf(dep) !== -1 && !this.seen.has(dep)) {
      this.seen.add(dep)
      this.child(dep)
    } else if (this.parent) {
      this.parent.childDep(dep)
    }
  }

  child (dep) {
    const p = this.path + '/node_modules/' + dep
    this.children += 1
    const child = new BundleWalker({
      path: p,
      parent: this
    })
    child.on('done', _ => {
      if (--this.children === 0)
        this.done()
    })
    child.start()
  }
}

class BundleWalkerSync extends BundleWalker {
  constructor (opt) {
    super(opt)
  }

  start () {
    super.start()
    this.done()
    return this
  }

  readPackageJson (pj) {
    try {
      this.onPackageJson(pj, fs.readFileSync(pj))
    } catch (er) {}
    return this
  }

  readModules () {
    try {
      this.onReaddir(readdirNodeModulesSync(this.path + '/node_modules'))
    } catch (er) {
      this.onReaddir([])
    }
  }

  child (dep) {
    new BundleWalkerSync({
      path: this.path + '/node_modules/' + dep,
      parent: this
    }).start()
  }
}

const readdirNodeModules = (nm, cb) => {
  fs.readdir(nm, (er, set) => {
    if (er)
      cb(er)
    else {
      const scopes = set.filter(f => /^@/.test(f))
      if (!scopes.length)
        cb(null, set)
      else {
        const unscoped = set.filter(f => !/^@/.test(f))
        let count = scopes.length
        scopes.forEach(scope => {
          fs.readdir(nm + '/' + scope, (er, pkgs) => {
            if (er || !pkgs.length)
              unscoped.push(scope)
            else
              unscoped.push.apply(unscoped, pkgs.map(p => scope + '/' + p))
            if (--count === 0)
              cb(null, unscoped)
          })
        })
      }
    }
  })
}

const readdirNodeModulesSync = nm => {
  const set = fs.readdirSync(nm)
  const unscoped = set.filter(f => !/^@/.test(f))
  const scopes = set.filter(f => /^@/.test(f)).map(scope => {
    try {
      const pkgs = fs.readdirSync(nm + '/' + scope)
      return pkgs.length ? pkgs.map(p => scope + '/' + p) : [scope]
    } catch (er) {
      return [scope]
    }
  }).reduce((a, b) => a.concat(b), [])
  return unscoped.concat(scopes)
}

const walk = (options, callback) => {
  const p = new Promise((resolve, reject) => {
    new BundleWalker(options).on('done', resolve).on('error', reject).start()
  })
  return callback ? p.then(res => callback(null, res), callback) : p
}

const walkSync = options => {
  return new BundleWalkerSync(options).start().result
}

module.exports = walk
walk.sync = walkSync
walk.BundleWalker = BundleWalker
walk.BundleWalkerSync = BundleWalkerSync

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1587225872310);
})()
//# sourceMappingURL=index.js.map