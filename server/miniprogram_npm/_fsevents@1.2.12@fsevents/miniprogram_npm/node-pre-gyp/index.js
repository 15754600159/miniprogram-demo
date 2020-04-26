module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1587225872303, function(require, module, exports) {


/**
 * Module exports.
 */

module.exports = exports;

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var nopt = require('nopt');
var log = require('npmlog');
log.disableProgress();
var napi = require('./util/napi.js');

var EE = require('events').EventEmitter;
var inherits = require('util').inherits;
var commands = [
      'clean',
      'install',
      'reinstall',
      'build',
      'rebuild',
      'package',
      'testpackage',
      'publish',
      'unpublish',
      'info',
      'testbinary',
      'reveal',
      'configure'
    ];
var aliases = {};

// differentiate node-pre-gyp's logs from npm's
log.heading = 'node-pre-gyp';

exports.find = require('./pre-binding').find;

function Run() {
  var self = this;

  this.commands = {};

  commands.forEach(function (command) {
    self.commands[command] = function (argv, callback) {
      log.verbose('command', command, argv);
      return require('./' + command)(self, argv, callback);
    };
  });
}
inherits(Run, EE);
exports.Run = Run;
var proto = Run.prototype;

/**
 * Export the contents of the package.json.
 */

proto.package = require('../package.json');

/**
 * nopt configuration definitions
 */

proto.configDefs = {
    help: Boolean,     // everywhere
    arch: String,      // 'configure'
    debug: Boolean,    // 'build'
    directory: String, // bin
    proxy: String,     // 'install'
    loglevel: String,  // everywhere
};

/**
 * nopt shorthands
 */

proto.shorthands = {
    release: '--no-debug',
    C: '--directory',
    debug: '--debug',
    j: '--jobs',
    silent: '--loglevel=silent',
    silly: '--loglevel=silly',
    verbose: '--loglevel=verbose',
};

/**
 * expose the command aliases for the bin file to use.
 */

proto.aliases = aliases;

/**
 * Parses the given argv array and sets the 'opts',
 * 'argv' and 'command' properties.
 */

proto.parseArgv = function parseOpts (argv) {
  this.opts = nopt(this.configDefs, this.shorthands, argv);
  this.argv = this.opts.argv.remain.slice();
  var commands = this.todo = [];

  // create a copy of the argv array with aliases mapped
  argv = this.argv.map(function (arg) {
    // is this an alias?
    if (arg in this.aliases) {
      arg = this.aliases[arg];
    }
    return arg;
  }, this);

  // process the mapped args into "command" objects ("name" and "args" props)
  argv.slice().forEach(function (arg) {
    if (arg in this.commands) {
      var args = argv.splice(0, argv.indexOf(arg));
      argv.shift();
      if (commands.length > 0) {
        commands[commands.length - 1].args = args;
      }
      commands.push({ name: arg, args: [] });
    }
  }, this);
  if (commands.length > 0) {
    commands[commands.length - 1].args = argv.splice(0);
  }

  // expand commands entries for multiple napi builds
  var dir = this.opts.directory;
  if (dir == null) dir = process.cwd();
  var package_json = JSON.parse(fs.readFileSync(path.join(dir,'package.json')));

  this.todo = napi.expand_commands (package_json, this.opts, commands);

  // support for inheriting config env variables from npm
  var npm_config_prefix = 'npm_config_';
  Object.keys(process.env).forEach(function (name) {
    if (name.indexOf(npm_config_prefix) !== 0) return;
    var val = process.env[name];
    if (name === npm_config_prefix + 'loglevel') {
      log.level = val;
    } else {
      // add the user-defined options to the config
      name = name.substring(npm_config_prefix.length);
      // avoid npm argv clobber already present args
      // which avoids problem of 'npm test' calling
      // script that runs unique npm install commands
      if (name === 'argv') {
         if (this.opts.argv &&
             this.opts.argv.remain &&
             this.opts.argv.remain.length) {
            // do nothing
         } else {
            this.opts[name] = val;
         }
      } else {
        this.opts[name] = val;
      }
    }
  }, this);

  if (this.opts.loglevel) {
    log.level = this.opts.loglevel;
  }
  log.resume();
};

/**
 * Returns the usage instructions for node-pre-gyp.
 */

proto.usage = function usage () {
  var str = [
      '',
      '  Usage: node-pre-gyp <command> [options]',
      '',
      '  where <command> is one of:',
      commands.map(function (c) {
        return '    - ' + c + ' - ' + require('./' + c).usage;
      }).join('\n'),
      '',
      'node-pre-gyp@' + this.version + '  ' + path.resolve(__dirname, '..'),
      'node@' + process.versions.node
  ].join('\n');
  return str;
};

/**
 * Version number getter.
 */

Object.defineProperty(proto, 'version', {
    get: function () {
      return this.package.version;
    },
    enumerable: true
});


}, function(modId) {var map = {"./util/napi.js":1587225872304,"./pre-binding":1587225872305,"../package.json":1587225872308}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872304, function(require, module, exports) {


var fs = require('fs');

module.exports = exports;

var versionArray = process.version
	.substr(1)
	.replace(/-.*$/, '')
	.split('.')
	.map(function(item) {
		return +item;
	});

var napi_multiple_commands = [
	'build',
	'clean',
	'configure',
	'package',
	'publish',
	'reveal',
	'testbinary',
	'testpackage',
	'unpublish'
];

var napi_build_version_tag = 'napi_build_version=';

module.exports.get_napi_version = function(target) { // target may be undefined
	// returns the non-zero numeric napi version or undefined if napi is not supported.
	// correctly supporting target requires an updated cross-walk
	var version = process.versions.napi; // can be undefined
	if (!version) { // this code should never need to be updated
		if (versionArray[0] === 9 && versionArray[1] >= 3) version = 2; // 9.3.0+
		else if (versionArray[0] === 8) version = 1; // 8.0.0+
	}
	return version;
};

module.exports.get_napi_version_as_string = function(target) {
	// returns the napi version as a string or an empty string if napi is not supported.
	var version = module.exports.get_napi_version(target);
	return version ? ''+version : '';
};

module.exports.validate_package_json = function(package_json, opts) { // throws Error

	var binary = package_json.binary;
	var module_path_ok = pathOK(binary.module_path);
	var remote_path_ok = pathOK(binary.remote_path);
	var package_name_ok = pathOK(binary.package_name);
	var napi_build_versions = module.exports.get_napi_build_versions(package_json,opts,true);
	var napi_build_versions_raw = module.exports.get_napi_build_versions_raw(package_json);

	if (napi_build_versions) {
		napi_build_versions.forEach(function(napi_build_version){
			if (!(parseInt(napi_build_version,10) === napi_build_version && napi_build_version > 0)) {
				throw new Error("All values specified in napi_versions must be positive integers.");
			}
		});
	}

	if (napi_build_versions && (!module_path_ok || (!remote_path_ok && !package_name_ok))) {
		throw new Error("When napi_versions is specified; module_path and either remote_path or " +
			"package_name must contain the substitution string '{napi_build_version}`.");
	}

	if ((module_path_ok || remote_path_ok || package_name_ok) && !napi_build_versions_raw) {
		throw new Error("When the substitution string '{napi_build_version}` is specified in " +
			"module_path, remote_path, or package_name; napi_versions must also be specified.");
	}

	if (napi_build_versions && !module.exports.get_best_napi_build_version(package_json, opts) && 
	module.exports.build_napi_only(package_json)) {
		throw new Error(
			'The N-API version of this Node instance is ' + module.exports.get_napi_version(opts ? opts.target : undefined) + '. ' +
			'This module supports N-API version(s) ' + module.exports.get_napi_build_versions_raw(package_json) + '. ' +
			'This Node instance cannot run this module.');
	}

	if (napi_build_versions_raw && !napi_build_versions && module.exports.build_napi_only(package_json)) {
		throw new Error(
			'The N-API version of this Node instance is ' + module.exports.get_napi_version(opts ? opts.target : undefined) + '. ' +
			'This module supports N-API version(s) ' + module.exports.get_napi_build_versions_raw(package_json) + '. ' +
			'This Node instance cannot run this module.');
	}

};

function pathOK (path) {
	return path && (path.indexOf('{napi_build_version}') !== -1 || path.indexOf('{node_napi_label}') !== -1);
}

module.exports.expand_commands = function(package_json, opts, commands) {
	var expanded_commands = [];
	var napi_build_versions = module.exports.get_napi_build_versions(package_json, opts);
	commands.forEach(function(command){
		if (napi_build_versions && command.name === 'install') {
			var napi_build_version = module.exports.get_best_napi_build_version(package_json, opts);
			var args = napi_build_version ? [ napi_build_version_tag+napi_build_version ] : [ ];
			expanded_commands.push ({ name: command.name, args: args });
		} else if (napi_build_versions && napi_multiple_commands.indexOf(command.name) !== -1) {
			napi_build_versions.forEach(function(napi_build_version){
				var args = command.args.slice();
				args.push (napi_build_version_tag+napi_build_version);
				expanded_commands.push ({ name: command.name, args: args });
			});
		} else {
			expanded_commands.push (command);
		}
	});
	return expanded_commands;
};

module.exports.get_napi_build_versions = function(package_json, opts, warnings) { // opts may be undefined
	var log = require('npmlog');
	var napi_build_versions = [];
	var supported_napi_version = module.exports.get_napi_version(opts ? opts.target : undefined);
	// remove duplicates, verify each napi version can actaully be built
	if (package_json.binary && package_json.binary.napi_versions) {
		package_json.binary.napi_versions.forEach(function(napi_version) {
			var duplicated = napi_build_versions.indexOf(napi_version) !== -1;
			if (!duplicated && supported_napi_version && napi_version <= supported_napi_version) {
				napi_build_versions.push(napi_version);
			} else if (warnings && !duplicated && supported_napi_version) {
				log.info('This Node instance does not support builds for N-API version', napi_version);
			}
		});
	}
	if (opts && opts["build-latest-napi-version-only"]) {
		var latest_version = 0;
		napi_build_versions.forEach(function(napi_version) {
			if (napi_version > latest_version) latest_version = napi_version;
		});
		napi_build_versions = latest_version ? [ latest_version ] : [];
	}
	return napi_build_versions.length ? napi_build_versions : undefined;
};

module.exports.get_napi_build_versions_raw = function(package_json) {
	var napi_build_versions = [];
	// remove duplicates
	if (package_json.binary && package_json.binary.napi_versions) {
		package_json.binary.napi_versions.forEach(function(napi_version) {
			if (napi_build_versions.indexOf(napi_version) === -1) {
				napi_build_versions.push(napi_version);
			}
		});
	}
	return napi_build_versions.length ? napi_build_versions : undefined;
};

module.exports.get_command_arg = function(napi_build_version) {
	return napi_build_version_tag + napi_build_version;
};

module.exports.get_napi_build_version_from_command_args = function(command_args) {
	for (var i = 0; i < command_args.length; i++) {
		var arg = command_args[i];
		if (arg.indexOf(napi_build_version_tag) === 0) {
			return parseInt(arg.substr(napi_build_version_tag.length),10);
		}
	}
	return undefined;
};

module.exports.swap_build_dir_out = function(napi_build_version) {
	if (napi_build_version) {
		var rm = require('rimraf');
		rm.sync(module.exports.get_build_dir(napi_build_version));
		fs.renameSync('build', module.exports.get_build_dir(napi_build_version));
	}
};

module.exports.swap_build_dir_in = function(napi_build_version) {
	if (napi_build_version) {
		var rm = require('rimraf');
		rm.sync('build');
		fs.renameSync(module.exports.get_build_dir(napi_build_version), 'build');
	}
};

module.exports.get_build_dir = function(napi_build_version) {
	return 'build-tmp-napi-v'+napi_build_version;
};

module.exports.get_best_napi_build_version = function(package_json, opts) {
	var best_napi_build_version = 0;
	var napi_build_versions = module.exports.get_napi_build_versions (package_json, opts);
	if (napi_build_versions) {
		var our_napi_version = module.exports.get_napi_version(opts ? opts.target : undefined);
		napi_build_versions.forEach(function(napi_build_version){
			if (napi_build_version > best_napi_build_version &&
				napi_build_version <= our_napi_version) {
				best_napi_build_version = napi_build_version;
			}
		});
	}
	return best_napi_build_version === 0 ? undefined : best_napi_build_version;
};

module.exports.build_napi_only = function(package_json) {
	return package_json.binary && package_json.binary.package_name && 
	package_json.binary.package_name.indexOf('{node_napi_label}') === -1;
};
}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872305, function(require, module, exports) {


var versioning = require('../lib/util/versioning.js');
var napi = require('../lib/util/napi.js');
var existsSync = require('fs').existsSync || require('path').existsSync;
var path = require('path');

module.exports = exports;

exports.usage = 'Finds the require path for the node-pre-gyp installed module';

exports.validate = function(package_json,opts) {
    versioning.validate_config(package_json,opts);
};

exports.find = function(package_json_path,opts) {
   if (!existsSync(package_json_path)) {
        throw new Error("package.json does not exist at " + package_json_path);
   }
   var package_json = require(package_json_path);
   versioning.validate_config(package_json,opts);
   var napi_build_version;
   if (napi.get_napi_build_versions (package_json, opts)) {
       napi_build_version = napi.get_best_napi_build_version(package_json, opts);
   }
   opts = opts || {};
   if (!opts.module_root) opts.module_root = path.dirname(package_json_path);
   var meta = versioning.evaluate(package_json,opts,napi_build_version);
   return meta.module;
};

}, function(modId) { var map = {"../lib/util/versioning.js":1587225872306,"../lib/util/napi.js":1587225872304}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872306, function(require, module, exports) {


module.exports = exports;

var path = require('path');
var semver = require('semver');
var url = require('url');
var detect_libc = require('detect-libc');
var napi = require('./napi.js');

var abi_crosswalk;

// This is used for unit testing to provide a fake
// ABI crosswalk that emulates one that is not updated
// for the current version
if (process.env.NODE_PRE_GYP_ABI_CROSSWALK) {
    abi_crosswalk = require(process.env.NODE_PRE_GYP_ABI_CROSSWALK);
} else {
    abi_crosswalk = require('./abi_crosswalk.json');
}

var major_versions = {};
Object.keys(abi_crosswalk).forEach(function(v) {
    var major = v.split('.')[0];
    if (!major_versions[major]) {
        major_versions[major] = v;
    }
});

function get_electron_abi(runtime, target_version) {
    if (!runtime) {
        throw new Error("get_electron_abi requires valid runtime arg");
    }
    if (typeof target_version === 'undefined') {
        // erroneous CLI call
        throw new Error("Empty target version is not supported if electron is the target.");
    }
    // Electron guarantees that patch version update won't break native modules.
    var sem_ver = semver.parse(target_version);
    return runtime + '-v' + sem_ver.major + '.' + sem_ver.minor;
}
module.exports.get_electron_abi = get_electron_abi;

function get_node_webkit_abi(runtime, target_version) {
    if (!runtime) {
        throw new Error("get_node_webkit_abi requires valid runtime arg");
    }
    if (typeof target_version === 'undefined') {
        // erroneous CLI call
        throw new Error("Empty target version is not supported if node-webkit is the target.");
    }
    return runtime + '-v' + target_version;
}
module.exports.get_node_webkit_abi = get_node_webkit_abi;

function get_node_abi(runtime, versions) {
    if (!runtime) {
        throw new Error("get_node_abi requires valid runtime arg");
    }
    if (!versions) {
        throw new Error("get_node_abi requires valid process.versions object");
    }
    var sem_ver = semver.parse(versions.node);
    if (sem_ver.major === 0 && sem_ver.minor % 2) { // odd series
        // https://github.com/mapbox/node-pre-gyp/issues/124
        return runtime+'-v'+versions.node;
    } else {
        // process.versions.modules added in >= v0.10.4 and v0.11.7
        // https://github.com/joyent/node/commit/ccabd4a6fa8a6eb79d29bc3bbe9fe2b6531c2d8e
        return versions.modules ? runtime+'-v' + (+versions.modules) :
            'v8-' + versions.v8.split('.').slice(0,2).join('.');
    }
}
module.exports.get_node_abi = get_node_abi;

function get_runtime_abi(runtime, target_version) {
    if (!runtime) {
        throw new Error("get_runtime_abi requires valid runtime arg");
    }
    if (runtime === 'node-webkit') {
        return get_node_webkit_abi(runtime, target_version || process.versions['node-webkit']);
    } else if (runtime === 'electron') {
        return get_electron_abi(runtime, target_version || process.versions.electron);
    } else {
        if (runtime != 'node') {
            throw new Error("Unknown Runtime: '" + runtime + "'");
        }
        if (!target_version) {
            return get_node_abi(runtime,process.versions);
        } else {
            var cross_obj;
            // abi_crosswalk generated with ./scripts/abi_crosswalk.js
            if (abi_crosswalk[target_version]) {
                cross_obj = abi_crosswalk[target_version];
            } else {
                var target_parts = target_version.split('.').map(function(i) { return +i; });
                if (target_parts.length != 3) { // parse failed
                    throw new Error("Unknown target version: " + target_version);
                }
                /*
                    The below code tries to infer the last known ABI compatible version
                    that we have recorded in the abi_crosswalk.json when an exact match
                    is not possible. The reasons for this to exist are complicated:

                       - We support passing --target to be able to allow developers to package binaries for versions of node
                         that are not the same one as they are running. This might also be used in combination with the
                         --target_arch or --target_platform flags to also package binaries for alternative platforms
                       - When --target is passed we can't therefore determine the ABI (process.versions.modules) from the node
                         version that is running in memory
                       - So, therefore node-pre-gyp keeps an "ABI crosswalk" (lib/util/abi_crosswalk.json) to be able to look
                         this info up for all versions
                       - But we cannot easily predict what the future ABI will be for released versions
                       - And node-pre-gyp needs to be a `bundledDependency` in apps that depend on it in order to work correctly
                         by being fully available at install time.
                       - So, the speed of node releases and the bundled nature of node-pre-gyp mean that a new node-pre-gyp release
                         need to happen for every node.js/io.js/node-webkit/nw.js/atom-shell/etc release that might come online if
                         you want the `--target` flag to keep working for the latest version
                       - Which is impractical ^^
                       - Hence the below code guesses about future ABI to make the need to update node-pre-gyp less demanding.

                    In practice then you can have a dependency of your app like `node-sqlite3` that bundles a `node-pre-gyp` that
                    only knows about node v0.10.33 in the `abi_crosswalk.json` but target node v0.10.34 (which is assumed to be
                    ABI compatible with v0.10.33).

                    TODO: use semver module instead of custom version parsing
                */
                var major = target_parts[0];
                var minor = target_parts[1];
                var patch = target_parts[2];
                // io.js: yeah if node.js ever releases 1.x this will break
                // but that is unlikely to happen: https://github.com/iojs/io.js/pull/253#issuecomment-69432616
                if (major === 1) {
                    // look for last release that is the same major version
                    // e.g. we assume io.js 1.x is ABI compatible with >= 1.0.0
                    while (true) {
                        if (minor > 0) --minor;
                        if (patch > 0) --patch;
                        var new_iojs_target = '' + major + '.' + minor + '.' + patch;
                        if (abi_crosswalk[new_iojs_target]) {
                            cross_obj = abi_crosswalk[new_iojs_target];
                            console.log('Warning: node-pre-gyp could not find exact match for ' + target_version);
                            console.log('Warning: but node-pre-gyp successfully choose ' + new_iojs_target + ' as ABI compatible target');
                            break;
                        }
                        if (minor === 0 && patch === 0) {
                            break;
                        }
                    }
                } else if (major >= 2) {
                    // look for last release that is the same major version
                    if (major_versions[major]) {
                        cross_obj = abi_crosswalk[major_versions[major]];
                        console.log('Warning: node-pre-gyp could not find exact match for ' + target_version);
                        console.log('Warning: but node-pre-gyp successfully choose ' + major_versions[major] + ' as ABI compatible target');
                    }
                } else if (major === 0) { // node.js
                    if (target_parts[1] % 2 === 0) { // for stable/even node.js series
                        // look for the last release that is the same minor release
                        // e.g. we assume node 0.10.x is ABI compatible with >= 0.10.0
                        while (--patch > 0) {
                            var new_node_target = '' + major + '.' + minor + '.' + patch;
                            if (abi_crosswalk[new_node_target]) {
                                cross_obj = abi_crosswalk[new_node_target];
                                console.log('Warning: node-pre-gyp could not find exact match for ' + target_version);
                                console.log('Warning: but node-pre-gyp successfully choose ' + new_node_target + ' as ABI compatible target');
                                break;
                            }
                        }
                    }
                }
            }
            if (!cross_obj) {
                throw new Error("Unsupported target version: " + target_version);
            }
            // emulate process.versions
            var versions_obj = {
                node: target_version,
                v8: cross_obj.v8+'.0',
                // abi_crosswalk uses 1 for node versions lacking process.versions.modules
                // process.versions.modules added in >= v0.10.4 and v0.11.7
                modules: cross_obj.node_abi > 1 ? cross_obj.node_abi : undefined
            };
            return get_node_abi(runtime, versions_obj);
        }
    }
}
module.exports.get_runtime_abi = get_runtime_abi;

var required_parameters = [
    'module_name',
    'module_path',
    'host'
];

function validate_config(package_json,opts) {
    var msg = package_json.name + ' package.json is not node-pre-gyp ready:\n';
    var missing = [];
    if (!package_json.main) {
        missing.push('main');
    }
    if (!package_json.version) {
        missing.push('version');
    }
    if (!package_json.name) {
        missing.push('name');
    }
    if (!package_json.binary) {
        missing.push('binary');
    }
    var o = package_json.binary;
    required_parameters.forEach(function(p) {
        if (missing.indexOf('binary') > -1) {
            missing.pop('binary');
        }
        if (!o || o[p] === undefined || o[p] === "") {
            missing.push('binary.' + p);
        }
    });
    if (missing.length >= 1) {
        throw new Error(msg+"package.json must declare these properties: \n" + missing.join('\n'));
    }
    if (o) {
        // enforce https over http
        var protocol = url.parse(o.host).protocol;
        if (protocol === 'http:') {
            throw new Error("'host' protocol ("+protocol+") is invalid - only 'https:' is accepted");
        }
    }
    napi.validate_package_json(package_json,opts);
}

module.exports.validate_config = validate_config;

function eval_template(template,opts) {
    Object.keys(opts).forEach(function(key) {
        var pattern = '{'+key+'}';
        while (template.indexOf(pattern) > -1) {
            template = template.replace(pattern,opts[key]);
        }
    });
    return template;
}

// url.resolve needs single trailing slash
// to behave correctly, otherwise a double slash
// may end up in the url which breaks requests
// and a lacking slash may not lead to proper joining
function fix_slashes(pathname) {
    if (pathname.slice(-1) != '/') {
        return pathname + '/';
    }
    return pathname;
}

// remove double slashes
// note: path.normalize will not work because
// it will convert forward to back slashes
function drop_double_slashes(pathname) {
    return pathname.replace(/\/\//g,'/');
}

function get_process_runtime(versions) {
    var runtime = 'node';
    if (versions['node-webkit']) {
        runtime = 'node-webkit';
    } else if (versions.electron) {
        runtime = 'electron';
    }
    return runtime;
}

module.exports.get_process_runtime = get_process_runtime;

var default_package_name = '{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz';
var default_remote_path = '';

module.exports.evaluate = function(package_json,options,napi_build_version) {
    options = options || {};
    validate_config(package_json,options); // options is a suitable substitute for opts in this case
    var v = package_json.version;
    var module_version = semver.parse(v);
    var runtime = options.runtime || get_process_runtime(process.versions);
    var opts = {
        name: package_json.name,
        configuration: Boolean(options.debug) ? 'Debug' : 'Release',
        debug: options.debug,
        module_name: package_json.binary.module_name,
        version: module_version.version,
        prerelease: module_version.prerelease.length ? module_version.prerelease.join('.') : '',
        build: module_version.build.length ? module_version.build.join('.') : '',
        major: module_version.major,
        minor: module_version.minor,
        patch: module_version.patch,
        runtime: runtime,
        node_abi: get_runtime_abi(runtime,options.target),
        node_abi_napi: napi.get_napi_version(options.target) ? 'napi' : get_runtime_abi(runtime,options.target),
        napi_version: napi.get_napi_version(options.target), // non-zero numeric, undefined if unsupported
        napi_build_version: napi_build_version || '',
        node_napi_label: napi_build_version ? 'napi-v' + napi_build_version : get_runtime_abi(runtime,options.target),
        target: options.target || '',
        platform: options.target_platform || process.platform,
        target_platform: options.target_platform || process.platform,
        arch: options.target_arch || process.arch,
        target_arch: options.target_arch || process.arch,
        libc: options.target_libc || detect_libc.family || 'unknown',
        module_main: package_json.main,
        toolset : options.toolset || '' // address https://github.com/mapbox/node-pre-gyp/issues/119
    };
    // support host mirror with npm config `--{module_name}_binary_host_mirror`
    // e.g.: https://github.com/node-inspector/v8-profiler/blob/master/package.json#L25
    // > npm install v8-profiler --profiler_binary_host_mirror=https://npm.taobao.org/mirrors/node-inspector/
    var host = process.env['npm_config_' + opts.module_name + '_binary_host_mirror'] || package_json.binary.host;
    opts.host = fix_slashes(eval_template(host,opts));
    opts.module_path = eval_template(package_json.binary.module_path,opts);
    // now we resolve the module_path to ensure it is absolute so that binding.gyp variables work predictably
    if (options.module_root) {
        // resolve relative to known module root: works for pre-binding require
        opts.module_path = path.join(options.module_root,opts.module_path);
    } else {
        // resolve relative to current working directory: works for node-pre-gyp commands
        opts.module_path = path.resolve(opts.module_path);
    }
    opts.module = path.join(opts.module_path,opts.module_name + '.node');
    opts.remote_path = package_json.binary.remote_path ? drop_double_slashes(fix_slashes(eval_template(package_json.binary.remote_path,opts))) : default_remote_path;
    var package_name = package_json.binary.package_name ? package_json.binary.package_name : default_package_name;
    opts.package_name = eval_template(package_name,opts);
    opts.staged_tarball = path.join('build/stage',opts.remote_path,opts.package_name);
    opts.hosted_path = url.resolve(opts.host,opts.remote_path);
    opts.hosted_tarball = url.resolve(opts.hosted_path,opts.package_name);
    return opts;
};

}, function(modId) { var map = {"./napi.js":1587225872304,"./abi_crosswalk.json":1587225872307}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872307, function(require, module, exports) {
module.exports = {
  "0.1.14": {
    "node_abi": null,
    "v8": "1.3"
  },
  "0.1.15": {
    "node_abi": null,
    "v8": "1.3"
  },
  "0.1.16": {
    "node_abi": null,
    "v8": "1.3"
  },
  "0.1.17": {
    "node_abi": null,
    "v8": "1.3"
  },
  "0.1.18": {
    "node_abi": null,
    "v8": "1.3"
  },
  "0.1.19": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.20": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.21": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.22": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.23": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.24": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.25": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.26": {
    "node_abi": null,
    "v8": "2.0"
  },
  "0.1.27": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.28": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.29": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.30": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.31": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.32": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.33": {
    "node_abi": null,
    "v8": "2.1"
  },
  "0.1.90": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.91": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.92": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.93": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.94": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.95": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.96": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.97": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.98": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.99": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.100": {
    "node_abi": null,
    "v8": "2.2"
  },
  "0.1.101": {
    "node_abi": null,
    "v8": "2.3"
  },
  "0.1.102": {
    "node_abi": null,
    "v8": "2.3"
  },
  "0.1.103": {
    "node_abi": null,
    "v8": "2.3"
  },
  "0.1.104": {
    "node_abi": null,
    "v8": "2.3"
  },
  "0.2.0": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.2.1": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.2.2": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.2.3": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.2.4": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.2.5": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.2.6": {
    "node_abi": 1,
    "v8": "2.3"
  },
  "0.3.0": {
    "node_abi": 1,
    "v8": "2.5"
  },
  "0.3.1": {
    "node_abi": 1,
    "v8": "2.5"
  },
  "0.3.2": {
    "node_abi": 1,
    "v8": "3.0"
  },
  "0.3.3": {
    "node_abi": 1,
    "v8": "3.0"
  },
  "0.3.4": {
    "node_abi": 1,
    "v8": "3.0"
  },
  "0.3.5": {
    "node_abi": 1,
    "v8": "3.0"
  },
  "0.3.6": {
    "node_abi": 1,
    "v8": "3.0"
  },
  "0.3.7": {
    "node_abi": 1,
    "v8": "3.0"
  },
  "0.3.8": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.0": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.1": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.2": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.3": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.4": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.5": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.6": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.7": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.8": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.9": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.10": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.11": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.4.12": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.5.0": {
    "node_abi": 1,
    "v8": "3.1"
  },
  "0.5.1": {
    "node_abi": 1,
    "v8": "3.4"
  },
  "0.5.2": {
    "node_abi": 1,
    "v8": "3.4"
  },
  "0.5.3": {
    "node_abi": 1,
    "v8": "3.4"
  },
  "0.5.4": {
    "node_abi": 1,
    "v8": "3.5"
  },
  "0.5.5": {
    "node_abi": 1,
    "v8": "3.5"
  },
  "0.5.6": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.5.7": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.5.8": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.5.9": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.5.10": {
    "node_abi": 1,
    "v8": "3.7"
  },
  "0.6.0": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.1": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.2": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.3": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.4": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.5": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.6": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.7": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.8": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.9": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.10": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.11": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.12": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.13": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.14": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.15": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.16": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.17": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.18": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.19": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.20": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.6.21": {
    "node_abi": 1,
    "v8": "3.6"
  },
  "0.7.0": {
    "node_abi": 1,
    "v8": "3.8"
  },
  "0.7.1": {
    "node_abi": 1,
    "v8": "3.8"
  },
  "0.7.2": {
    "node_abi": 1,
    "v8": "3.8"
  },
  "0.7.3": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.4": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.5": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.6": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.7": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.8": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.9": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.7.10": {
    "node_abi": 1,
    "v8": "3.9"
  },
  "0.7.11": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.7.12": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.0": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.1": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.2": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.3": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.4": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.5": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.6": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.7": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.8": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.9": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.10": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.11": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.12": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.13": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.14": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.15": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.16": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.17": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.18": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.19": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.20": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.21": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.22": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.23": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.24": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.25": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.26": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.27": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.8.28": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.9.0": {
    "node_abi": 1,
    "v8": "3.11"
  },
  "0.9.1": {
    "node_abi": 10,
    "v8": "3.11"
  },
  "0.9.2": {
    "node_abi": 10,
    "v8": "3.11"
  },
  "0.9.3": {
    "node_abi": 10,
    "v8": "3.13"
  },
  "0.9.4": {
    "node_abi": 10,
    "v8": "3.13"
  },
  "0.9.5": {
    "node_abi": 10,
    "v8": "3.13"
  },
  "0.9.6": {
    "node_abi": 10,
    "v8": "3.15"
  },
  "0.9.7": {
    "node_abi": 10,
    "v8": "3.15"
  },
  "0.9.8": {
    "node_abi": 10,
    "v8": "3.15"
  },
  "0.9.9": {
    "node_abi": 11,
    "v8": "3.15"
  },
  "0.9.10": {
    "node_abi": 11,
    "v8": "3.15"
  },
  "0.9.11": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.9.12": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.0": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.1": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.2": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.3": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.4": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.5": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.6": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.7": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.8": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.9": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.10": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.11": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.12": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.13": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.14": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.15": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.16": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.17": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.18": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.19": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.20": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.21": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.22": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.23": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.24": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.25": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.26": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.27": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.28": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.29": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.30": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.31": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.32": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.33": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.34": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.35": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.36": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.37": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.38": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.39": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.40": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.41": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.42": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.43": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.44": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.45": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.46": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.47": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.10.48": {
    "node_abi": 11,
    "v8": "3.14"
  },
  "0.11.0": {
    "node_abi": 12,
    "v8": "3.17"
  },
  "0.11.1": {
    "node_abi": 12,
    "v8": "3.18"
  },
  "0.11.2": {
    "node_abi": 12,
    "v8": "3.19"
  },
  "0.11.3": {
    "node_abi": 12,
    "v8": "3.19"
  },
  "0.11.4": {
    "node_abi": 12,
    "v8": "3.20"
  },
  "0.11.5": {
    "node_abi": 12,
    "v8": "3.20"
  },
  "0.11.6": {
    "node_abi": 12,
    "v8": "3.20"
  },
  "0.11.7": {
    "node_abi": 12,
    "v8": "3.20"
  },
  "0.11.8": {
    "node_abi": 13,
    "v8": "3.21"
  },
  "0.11.9": {
    "node_abi": 13,
    "v8": "3.22"
  },
  "0.11.10": {
    "node_abi": 13,
    "v8": "3.22"
  },
  "0.11.11": {
    "node_abi": 14,
    "v8": "3.22"
  },
  "0.11.12": {
    "node_abi": 14,
    "v8": "3.22"
  },
  "0.11.13": {
    "node_abi": 14,
    "v8": "3.25"
  },
  "0.11.14": {
    "node_abi": 14,
    "v8": "3.26"
  },
  "0.11.15": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.11.16": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.0": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.1": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.2": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.3": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.4": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.5": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.6": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.7": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.8": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.9": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.10": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.11": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.12": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.13": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.14": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.15": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.16": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.17": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "0.12.18": {
    "node_abi": 14,
    "v8": "3.28"
  },
  "1.0.0": {
    "node_abi": 42,
    "v8": "3.31"
  },
  "1.0.1": {
    "node_abi": 42,
    "v8": "3.31"
  },
  "1.0.2": {
    "node_abi": 42,
    "v8": "3.31"
  },
  "1.0.3": {
    "node_abi": 42,
    "v8": "4.1"
  },
  "1.0.4": {
    "node_abi": 42,
    "v8": "4.1"
  },
  "1.1.0": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.2.0": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.3.0": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.4.1": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.4.2": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.4.3": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.5.0": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.5.1": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.6.0": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.6.1": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.6.2": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.6.3": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.6.4": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.7.1": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.8.1": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.8.2": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.8.3": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "1.8.4": {
    "node_abi": 43,
    "v8": "4.1"
  },
  "2.0.0": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.0.1": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.0.2": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.1.0": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.2.0": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.2.1": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.3.0": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.3.1": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.3.2": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.3.3": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.3.4": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.4.0": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "2.5.0": {
    "node_abi": 44,
    "v8": "4.2"
  },
  "3.0.0": {
    "node_abi": 45,
    "v8": "4.4"
  },
  "3.1.0": {
    "node_abi": 45,
    "v8": "4.4"
  },
  "3.2.0": {
    "node_abi": 45,
    "v8": "4.4"
  },
  "3.3.0": {
    "node_abi": 45,
    "v8": "4.4"
  },
  "3.3.1": {
    "node_abi": 45,
    "v8": "4.4"
  },
  "4.0.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.1.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.1.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.1.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.3": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.4": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.5": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.2.6": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.3.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.3.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.3.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.3": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.4": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.5": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.6": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.4.7": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.5.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.6.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.6.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.6.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.7.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.7.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.7.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.7.3": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.2": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.3": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.4": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.5": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.6": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.8.7": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.9.0": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "4.9.1": {
    "node_abi": 46,
    "v8": "4.5"
  },
  "5.0.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.1.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.1.1": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.2.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.3.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.4.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.4.1": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.5.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.6.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.7.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.7.1": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.8.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.9.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.9.1": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.10.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.10.1": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.11.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.11.1": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "5.12.0": {
    "node_abi": 47,
    "v8": "4.6"
  },
  "6.0.0": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.1.0": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.2.0": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.2.1": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.2.2": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.3.0": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.3.1": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.4.0": {
    "node_abi": 48,
    "v8": "5.0"
  },
  "6.5.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.6.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.7.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.8.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.8.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.9.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.9.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.9.2": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.9.3": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.9.4": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.9.5": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.10.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.10.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.10.2": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.10.3": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.11.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.11.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.11.2": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.11.3": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.11.4": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.11.5": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.12.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.12.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.12.2": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.12.3": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.13.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.13.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.14.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.14.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.14.2": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.14.3": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.14.4": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.15.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.15.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.16.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.17.0": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "6.17.1": {
    "node_abi": 48,
    "v8": "5.1"
  },
  "7.0.0": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.1.0": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.2.0": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.2.1": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.3.0": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.4.0": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.5.0": {
    "node_abi": 51,
    "v8": "5.4"
  },
  "7.6.0": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.7.0": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.7.1": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.7.2": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.7.3": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.7.4": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.8.0": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.9.0": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.10.0": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "7.10.1": {
    "node_abi": 51,
    "v8": "5.5"
  },
  "8.0.0": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.1.0": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.1.1": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.1.2": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.1.3": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.1.4": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.2.0": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.2.1": {
    "node_abi": 57,
    "v8": "5.8"
  },
  "8.3.0": {
    "node_abi": 57,
    "v8": "6.0"
  },
  "8.4.0": {
    "node_abi": 57,
    "v8": "6.0"
  },
  "8.5.0": {
    "node_abi": 57,
    "v8": "6.0"
  },
  "8.6.0": {
    "node_abi": 57,
    "v8": "6.0"
  },
  "8.7.0": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.8.0": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.8.1": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.9.0": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.9.1": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.9.2": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.9.3": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.9.4": {
    "node_abi": 57,
    "v8": "6.1"
  },
  "8.10.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.11.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.11.1": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.11.2": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.11.3": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.11.4": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.12.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.13.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.14.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.14.1": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.15.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.15.1": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.16.0": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.16.1": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "8.16.2": {
    "node_abi": 57,
    "v8": "6.2"
  },
  "9.0.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.1.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.2.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.2.1": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.3.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.4.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.5.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.6.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.6.1": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.7.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.7.1": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.8.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.9.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.10.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.10.1": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.11.0": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.11.1": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "9.11.2": {
    "node_abi": 59,
    "v8": "6.2"
  },
  "10.0.0": {
    "node_abi": 64,
    "v8": "6.6"
  },
  "10.1.0": {
    "node_abi": 64,
    "v8": "6.6"
  },
  "10.2.0": {
    "node_abi": 64,
    "v8": "6.6"
  },
  "10.2.1": {
    "node_abi": 64,
    "v8": "6.6"
  },
  "10.3.0": {
    "node_abi": 64,
    "v8": "6.6"
  },
  "10.4.0": {
    "node_abi": 64,
    "v8": "6.7"
  },
  "10.4.1": {
    "node_abi": 64,
    "v8": "6.7"
  },
  "10.5.0": {
    "node_abi": 64,
    "v8": "6.7"
  },
  "10.6.0": {
    "node_abi": 64,
    "v8": "6.7"
  },
  "10.7.0": {
    "node_abi": 64,
    "v8": "6.7"
  },
  "10.8.0": {
    "node_abi": 64,
    "v8": "6.7"
  },
  "10.9.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.10.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.11.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.12.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.13.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.14.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.14.1": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.14.2": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.15.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.15.1": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.15.2": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.15.3": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.16.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.16.1": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.16.2": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.16.3": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "10.17.0": {
    "node_abi": 64,
    "v8": "6.8"
  },
  "11.0.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.1.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.2.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.3.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.4.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.5.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.6.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.7.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.8.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.9.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.10.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.10.1": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.11.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.12.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.13.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.14.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "11.15.0": {
    "node_abi": 67,
    "v8": "7.0"
  },
  "12.0.0": {
    "node_abi": 72,
    "v8": "7.4"
  },
  "12.1.0": {
    "node_abi": 72,
    "v8": "7.4"
  },
  "12.2.0": {
    "node_abi": 72,
    "v8": "7.4"
  },
  "12.3.0": {
    "node_abi": 72,
    "v8": "7.4"
  },
  "12.3.1": {
    "node_abi": 72,
    "v8": "7.4"
  },
  "12.4.0": {
    "node_abi": 72,
    "v8": "7.4"
  },
  "12.5.0": {
    "node_abi": 72,
    "v8": "7.5"
  },
  "12.6.0": {
    "node_abi": 72,
    "v8": "7.5"
  },
  "12.7.0": {
    "node_abi": 72,
    "v8": "7.5"
  },
  "12.8.0": {
    "node_abi": 72,
    "v8": "7.5"
  },
  "12.8.1": {
    "node_abi": 72,
    "v8": "7.5"
  },
  "12.9.0": {
    "node_abi": 72,
    "v8": "7.6"
  },
  "12.9.1": {
    "node_abi": 72,
    "v8": "7.6"
  },
  "12.10.0": {
    "node_abi": 72,
    "v8": "7.6"
  },
  "12.11.0": {
    "node_abi": 72,
    "v8": "7.7"
  },
  "12.11.1": {
    "node_abi": 72,
    "v8": "7.7"
  },
  "12.12.0": {
    "node_abi": 72,
    "v8": "7.7"
  },
  "12.13.0": {
    "node_abi": 72,
    "v8": "7.7"
  },
  "13.0.0": {
    "node_abi": 79,
    "v8": "7.8"
  },
  "13.0.1": {
    "node_abi": 79,
    "v8": "7.8"
  }
}
}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872308, function(require, module, exports) {
module.exports = {
  "_from": "node-pre-gyp@0.14.0",
  "_id": "node-pre-gyp@0.14.0",
  "_inBundle": false,
  "_integrity": "sha512-+CvDC7ZttU/sSt9rFjix/P05iS43qHCOOGzcr3Ry99bXG7VX953+vFyEuph/tfqoYu8dttBkE86JSKBO2OzcxA==",
  "_location": "/node-pre-gyp",
  "_phantomChildren": {},
  "_requested": {
    "type": "version",
    "registry": true,
    "raw": "node-pre-gyp@0.14.0",
    "name": "node-pre-gyp",
    "escapedName": "node-pre-gyp",
    "rawSpec": "0.14.0",
    "saveSpec": null,
    "fetchSpec": "0.14.0"
  },
  "_requiredBy": [
    "#USER",
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/node-pre-gyp/-/node-pre-gyp-0.14.0.tgz",
  "_shasum": "9a0596533b877289bcad4e143982ca3d904ddc83",
  "_spec": "node-pre-gyp@0.14.0",
  "_where": "/Users/user/Developer/personal/fsevents",
  "author": {
    "name": "Dane Springmeyer",
    "email": "dane@mapbox.com"
  },
  "bin": {
    "node-pre-gyp": "bin/node-pre-gyp"
  },
  "bugs": {
    "url": "https://github.com/mapbox/node-pre-gyp/issues"
  },
  "bundleDependencies": false,
  "dependencies": {
    "detect-libc": "^1.0.2",
    "mkdirp": "^0.5.1",
    "needle": "^2.2.1",
    "nopt": "^4.0.1",
    "npm-packlist": "^1.1.6",
    "npmlog": "^4.0.2",
    "rc": "^1.2.7",
    "rimraf": "^2.6.1",
    "semver": "^5.3.0",
    "tar": "^4.4.2"
  },
  "deprecated": false,
  "description": "Node.js native addon binary install tool",
  "devDependencies": {
    "aws-sdk": "^2.28.0",
    "jshint": "^2.9.5",
    "nock": "^9.2.3",
    "tape": "^4.6.3"
  },
  "homepage": "https://github.com/mapbox/node-pre-gyp#readme",
  "jshintConfig": {
    "node": true,
    "globalstrict": true,
    "undef": true,
    "unused": false,
    "noarg": true
  },
  "keywords": [
    "native",
    "addon",
    "module",
    "c",
    "c++",
    "bindings",
    "binary"
  ],
  "license": "BSD-3-Clause",
  "main": "./lib/node-pre-gyp.js",
  "name": "node-pre-gyp",
  "repository": {
    "type": "git",
    "url": "git://github.com/mapbox/node-pre-gyp.git"
  },
  "scripts": {
    "pretest": "jshint test/build.test.js test/s3_setup.test.js test/versioning.test.js test/fetch.test.js lib lib/util scripts bin/node-pre-gyp",
    "test": "jshint lib lib/util scripts bin/node-pre-gyp && tape test/*test.js",
    "update-crosswalk": "node scripts/abi_crosswalk.js"
  },
  "version": "0.14.0"
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1587225872303);
})()
//# sourceMappingURL=index.js.map