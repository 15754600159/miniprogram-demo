module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = { exports: {} }; __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); if(typeof m.exports === "object") { __MODS__[modId].m.exports.__proto__ = m.exports.__proto__; Object.keys(m.exports).forEach(function(k) { __MODS__[modId].m.exports[k] = m.exports[k]; var desp = Object.getOwnPropertyDescriptor(m.exports, k); if(desp && desp.configurable) Object.defineProperty(m.exports, k, { set: function(val) { __MODS__[modId].m.exports[k] = val; }, get: function() { return __MODS__[modId].m.exports[k]; } }); }); if(m.exports.__esModule) Object.defineProperty(__MODS__[modId].m.exports, "__esModule", { value: true }); } else { __MODS__[modId].m.exports = m.exports; } } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1587225872406, function(require, module, exports) {
var debug = require('debug')('nodemon');
var path = require('path');
var monitor = require('./monitor');
var cli = require('./cli');
var version = require('./version');
var util = require('util');
var utils = require('./utils');
var bus = utils.bus;
var help = require('./help');
var config = require('./config');
var spawn = require('./spawn');
const defaults = require('./config/defaults')
var eventHandlers = {};

// this is fairly dirty, but theoretically sound since it's part of the
// stable module API
config.required = utils.isRequired;

function nodemon(settings) {
  bus.emit('boot');
  nodemon.reset();

  // allow the cli string as the argument to nodemon, and allow for
  // `node nodemon -V app.js` or just `-V app.js`
  if (typeof settings === 'string') {
    settings = settings.trim();
    if (settings.indexOf('node') !== 0) {
      if (settings.indexOf('nodemon') !== 0) {
        settings = 'nodemon ' + settings;
      }
      settings = 'node ' + settings;
    }
    settings = cli.parse(settings);
  }

  // set the debug flag as early as possible to get all the detailed logging
  if (settings.verbose) {
    utils.debug = true;
  }

  if (settings.help) {
    process.stdout._handle.setBlocking(true); // nodejs/node#6456
    console.log(help(settings.help));
    if (!config.required) {
      process.exit(0);
    }
  }

  if (settings.version) {
    version().then(function (v) {
      console.log(v);
      if (!config.required) {
        process.exit(0);
      }
    });
    return;
  }

  // nodemon tools like grunt-nodemon. This affects where
  // the script is being run from, and will affect where
  // nodemon looks for the nodemon.json files
  if (settings.cwd) {
    // this is protection to make sure we haven't dont the chdir already...
    // say like in cli/parse.js (which is where we do this once already!)
    if (process.cwd() !== path.resolve(config.system.cwd, settings.cwd)) {
      process.chdir(settings.cwd);
    }
  }

  const cwd = process.cwd();

  config.load(settings, function (config) {
    if (!config.options.dump && !config.options.execOptions.script &&
      config.options.execOptions.exec === 'node') {
      if (!config.required) {
        console.log(help('usage'));
        process.exit();
      }
      return;
    }

    // before we print anything, update the colour setting on logging
    utils.colours = config.options.colours;

    // always echo out the current version
    utils.log.info(version.pinned);

    const cwd = process.cwd();

    if (config.options.cwd) {
      utils.log.detail('process root: ' + cwd);
    }

    config.loaded.map(file => file.replace(cwd, '.')).forEach(file => {
      utils.log.detail('reading config ' + file);
    });

    if (config.options.stdin && config.options.restartable) {
      // allow nodemon to restart when the use types 'rs\n'
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', data => {
        const str = data.toString().trim().toLowerCase();

        // if the keys entered match the restartable value, then restart!
        if (str === config.options.restartable) {
          bus.emit('restart');
        } else if (data.charCodeAt(0) === 12) { // ctrl+l
          console.clear();
        }
      });
    } else if (config.options.stdin) {
      // so let's make sure we don't eat the key presses
      // but also, since we're wrapping, watch out for
      // special keys, like ctrl+c x 2 or '.exit' or ctrl+d or ctrl+l
      var ctrlC = false;
      var buffer = '';

      process.stdin.on('data', function (data) {
        data = data.toString();
        buffer += data;
        const chr = data.charCodeAt(0);

        // if restartable, echo back
        if (chr === 3) {
          if (ctrlC) {
            process.exit(0);
          }

          ctrlC = true;
          return;
        } else if (buffer === '.exit' || chr === 4) { // ctrl+d
          process.exit();
        } else if (chr === 13 || chr === 10) { // enter / carriage return
          buffer = '';
        } else if (chr === 12) { // ctrl+l
          console.clear();
          buffer = '';
        }
        ctrlC = false;
      });
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
    }

    if (config.options.restartable) {
      utils.log.info('to restart at any time, enter `' +
        config.options.restartable + '`');
    }

    if (!config.required) {
      const restartSignal = config.options.signal === 'SIGUSR2' ? 'SIGHUP' : 'SIGUSR2';
      process.on(restartSignal, nodemon.restart);
      utils.bus.on('error', () => {
        utils.log.fail((new Error().stack));
      });
      utils.log.detail((config.options.restartable ? 'or ' : '') + 'send ' +
        restartSignal + ' to ' + process.pid + ' to restart');
    }

    const ignoring = config.options.monitor.map(function (rule) {
      if (rule.slice(0, 1) !== '!') {
        return false;
      }

      rule = rule.slice(1);

      // don't notify of default ignores
      if (defaults.ignoreRoot.indexOf(rule) !== -1) {
        return false;
        return rule.slice(3).slice(0, -3);
      }

      if (rule.startsWith(cwd)) {
        return rule.replace(cwd, '.');
      }

      return rule;
    }).filter(Boolean).join(' ');
    if (ignoring) utils.log.detail('ignoring: ' + ignoring);

    utils.log.info('watching dir(s): ' + config.options.monitor.map(function (rule) {
      if (rule.slice(0, 1) !== '!') {
        try {
          rule = path.relative(process.cwd(), rule);
        } catch (e) {}

        return rule;
      }

      return false;
    }).filter(Boolean).join(' '));

    utils.log.info('watching extensions: ' + (config.options.execOptions.ext || '(all)'));

    if (config.options.dump) {
      utils.log._log('log', '--------------');
      utils.log._log('log', 'node: ' + process.version);
      utils.log._log('log', 'nodemon: ' + version.pinned);
      utils.log._log('log', 'command: ' + process.argv.join(' '));
      utils.log._log('log', 'cwd: ' + cwd);
      utils.log._log('log', ['OS:', process.platform, process.arch].join(' '));
      utils.log._log('log', '--------------');
      utils.log._log('log', util.inspect(config, { depth: null }));
      utils.log._log('log', '--------------');
      if (!config.required) {
        process.exit();
      }

      return;
    }

    config.run = true;

    if (config.options.stdout === false) {
      nodemon.on('start', function () {
        nodemon.stdout = bus.stdout;
        nodemon.stderr = bus.stderr;

        bus.emit('readable');
      });
    }

    if (config.options.events && Object.keys(config.options.events).length) {
      Object.keys(config.options.events).forEach(function (key) {
        utils.log.detail('bind ' + key + ' -> `' +
          config.options.events[key] + '`');
        nodemon.on(key, function () {
          if (config.options && config.options.events) {
            spawn(config.options.events[key], config,
              [].slice.apply(arguments));
          }
        });
      });
    }

    monitor.run(config.options);

  });

  return nodemon;
}

nodemon.restart = function () {
  utils.log.status('restarting child process');
  bus.emit('restart');
  return nodemon;
};

nodemon.addListener = nodemon.on = function (event, handler) {
  if (!eventHandlers[event]) { eventHandlers[event] = []; }
  eventHandlers[event].push(handler);
  bus.on(event, handler);
  return nodemon;
};

nodemon.once = function (event, handler) {
  if (!eventHandlers[event]) { eventHandlers[event] = []; }
  eventHandlers[event].push(handler);
  bus.once(event, function () {
    debug('bus.once(%s)', event);
    eventHandlers[event].splice(eventHandlers[event].indexOf(handler), 1);
    handler.apply(this, arguments);
  });
  return nodemon;
};

nodemon.emit = function () {
  bus.emit.apply(bus, [].slice.call(arguments));
  return nodemon;
};

nodemon.removeAllListeners = function (event) {
  // unbind only the `nodemon.on` event handlers
  Object.keys(eventHandlers).filter(function (e) {
    return event ? e === event : true;
  }).forEach(function (event) {
    eventHandlers[event].forEach(function (handler) {
      bus.removeListener(event, handler);
      eventHandlers[event].splice(eventHandlers[event].indexOf(handler), 1);
    });
  });

  return nodemon;
};

nodemon.reset = function (done) {
  bus.emit('reset', done);
};

bus.on('reset', function (done) {
  debug('reset');
  nodemon.removeAllListeners();
  monitor.run.kill(true, function () {
    utils.reset();
    config.reset();
    config.run = false;
    if (done) {
      done();
    }
  });
});

// expose the full config
nodemon.config = config;

module.exports = nodemon;


}, function(modId) {var map = {"./monitor":1587225872407,"./cli":1587225872427,"./version":1587225872423,"./utils":1587225872409,"./help":1587225872429,"./config":1587225872416,"./spawn":1587225872430,"./config/defaults":1587225872422}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872407, function(require, module, exports) {
module.exports = {
  run: require('./run'),
  watch: require('./watch').watch,
};

}, function(modId) { var map = {"./run":1587225872408,"./watch":1587225872415}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872408, function(require, module, exports) {
var debug = require('debug')('nodemon');
const statSync = require('fs').statSync;
var utils = require('../utils');
var bus = utils.bus;
var childProcess = require('child_process');
var spawn = childProcess.spawn;
var exec = childProcess.exec;
var fork = childProcess.fork;
var watch = require('./watch').watch;
var config = require('../config');
var child = null; // the actual child process we spawn
var killedAfterChange = false;
var noop = function () { };
var restart = null;
var psTree = require('pstree.remy');
var path = require('path');
var signals = require('./signals');

function run(options) {
  var cmd = config.command.raw;

  var runCmd = !options.runOnChangeOnly || config.lastStarted !== 0;
  if (runCmd) {
    utils.log.status('starting `' + config.command.string + '`');
  }

  /*jshint validthis:true*/
  restart = run.bind(this, options);
  run.restart = restart;

  config.lastStarted = Date.now();

  var stdio = ['pipe', 'pipe', 'pipe'];

  if (config.options.stdout) {
    stdio = ['pipe', process.stdout, process.stderr];
  }

  if (config.options.stdin === false) {
    stdio = [process.stdin, process.stdout, process.stderr];
  }

  var sh = 'sh';
  var shFlag = '-c';

  const binPath = process.cwd() + '/node_modules/.bin';

  const spawnOptions = {
    env: Object.assign({}, process.env, options.execOptions.env, {
      PATH: binPath + ':' + process.env.PATH,
    }),
    stdio: stdio,
  }

  var executable = cmd.executable;

  if (utils.isWindows) {
    // if the exec includes a forward slash, reverse it for windows compat
    // but *only* apply to the first command, and none of the arguments.
    // ref #1251 and #1236
    if (executable.indexOf('/') !== -1) {
      executable = executable.split(' ').map((e, i) => {
        if (i === 0) {
          return path.normalize(e);
        }
        return e;
      }).join(' ');
    }
    // taken from npm's cli: https://git.io/vNFD4
    sh = process.env.comspec || 'cmd';
    shFlag = '/d /s /c';
    spawnOptions.windowsVerbatimArguments = true;
  }

  var args = runCmd ? utils.stringify(executable, cmd.args) : ':';
  var spawnArgs = [sh, [shFlag, args], spawnOptions];

  const firstArg = cmd.args[0] || '';

  var inBinPath = false;
  try {
    inBinPath = statSync(`${binPath}/${executable}`).isFile();
  } catch (e) {}

  // hasStdio allows us to correctly handle stdin piping
  // see: https://git.io/vNtX3
  const hasStdio = utils.satisfies('>= 6.4.0 || < 5');

  // forking helps with sub-process handling and tends to clean up better
  // than spawning, but it should only be used under specific conditions
  const shouldFork =
    !config.options.spawn &&
    !inBinPath &&
    !(firstArg.indexOf('-') === 0) && // don't fork if there's a node exec arg
    firstArg !== 'inspect' && // don't fork it's `inspect` debugger
    executable === 'node' && // only fork if node
    utils.version.major > 4 // only fork if node version > 4

  if (shouldFork) {
    var forkArgs = cmd.args.slice(1);
    var env = utils.merge(options.execOptions.env, process.env);
    stdio.push('ipc');
    child = fork(options.execOptions.script, forkArgs, {
      env: env,
      stdio: stdio,
      silent: !hasStdio,
    });
    utils.log.detail('forking');
    debug('fork', sh, shFlag, args)
  } else {
    utils.log.detail('spawning');
    child = spawn.apply(null, spawnArgs);
    debug('spawn', sh, shFlag, args)
  }

  if (config.required) {
    var emit = {
      stdout: function (data) {
        bus.emit('stdout', data);
      },
      stderr: function (data) {
        bus.emit('stderr', data);
      },
    };

    // now work out what to bind to...
    if (config.options.stdout) {
      child.on('stdout', emit.stdout).on('stderr', emit.stderr);
    } else {
      child.stdout.on('data', emit.stdout);
      child.stderr.on('data', emit.stderr);

      bus.stdout = child.stdout;
      bus.stderr = child.stderr;
    }

    if (shouldFork) {
      child.on('message', function (message, sendHandle) {
        bus.emit('message', message, sendHandle);
      });
    }
  }

  bus.emit('start');

  utils.log.detail('child pid: ' + child.pid);

  child.on('error', function (error) {
    bus.emit('error', error);
    if (error.code === 'ENOENT') {
      utils.log.error('unable to run executable: "' + cmd.executable + '"');
      process.exit(1);
    } else {
      utils.log.error('failed to start child process: ' + error.code);
      throw error;
    }
  });

  child.on('exit', function (code, signal) {
    if (child && child.stdin) {
      process.stdin.unpipe(child.stdin);
    }

    if (code === 127) {
      utils.log.error('failed to start process, "' + cmd.executable +
        '" exec not found');
      bus.emit('error', code);
      process.exit();
    }

    // If the command failed with code 2, it may or may not be a syntax error
    // See: http://git.io/fNOAR
    // We will only assume a parse error, if the child failed quickly
    if (code === 2 && Date.now() < config.lastStarted + 500) {
      utils.log.error('process failed, unhandled exit code (2)');
      utils.log.error('');
      utils.log.error('Either the command has a syntax error,');
      utils.log.error('or it is exiting with reserved code 2.');
      utils.log.error('');
      utils.log.error('To keep nodemon running even after a code 2,');
      utils.log.error('add this to the end of your command: || exit 1');
      utils.log.error('');
      utils.log.error('Read more here: https://git.io/fNOAG');
      utils.log.error('');
      utils.log.error('nodemon will stop now so that you can fix the command.');
      utils.log.error('');
      bus.emit('error', code);
      process.exit();
    }

    // In case we killed the app ourselves, set the signal thusly
    if (killedAfterChange) {
      killedAfterChange = false;
      signal = config.signal;
    }
    // this is nasty, but it gives it windows support
    if (utils.isWindows && signal === 'SIGTERM') {
      signal = config.signal;
    }

    if (signal === config.signal || code === 0) {
      // this was a clean exit, so emit exit, rather than crash
      debug('bus.emit(exit) via ' + config.signal);
      bus.emit('exit', signal);

      // exit the monitor, but do it gracefully
      if (signal === config.signal) {
        return restart();
      }

      if (code === 0) { // clean exit - wait until file change to restart
        if (runCmd) {
          utils.log.status('clean exit - waiting for changes before restart');
        }
        child = null;
      }
    } else {
      bus.emit('crash');
      if (options.exitcrash) {
        utils.log.fail('app crashed');
        if (!config.required) {
          process.exit(1);
        }
      } else {
        utils.log.fail('app crashed - waiting for file changes before' +
          ' starting...');
        child = null;
      }
    }

    if (config.options.restartable) {
      // stdin needs to kick in again to be able to listen to the
      // restart command
      process.stdin.resume();
    }
  });

  run.kill = function (noRestart, callback) {
    // I hate code like this :(  - Remy (author of said code)
    if (typeof noRestart === 'function') {
      callback = noRestart;
      noRestart = false;
    }

    if (!callback) {
      callback = noop;
    }

    if (child !== null) {
      // if the stdin piping is on, we need to unpipe, but also close stdin on
      // the child, otherwise linux can throw EPIPE or ECONNRESET errors.
      if (options.stdin) {
        process.stdin.unpipe(child.stdin);
      }

      // For the on('exit', ...) handler above the following looks like a
      // crash, so we set the killedAfterChange flag if a restart is planned
      if (!noRestart) {
        killedAfterChange = true;
      }

      /* Now kill the entire subtree of processes belonging to nodemon */
      var oldPid = child.pid;
      if (child) {
        kill(child, config.signal, function () {
          // this seems to fix the 0.11.x issue with the "rs" restart command,
          // though I'm unsure why. it seems like more data is streamed in to
          // stdin after we close.
          if (child && options.stdin && child.stdin && oldPid === child.pid) {
            child.stdin.end();
          }
          callback();
        });
      }
    } else if (!noRestart) {
      // if there's no child, then we need to manually start the process
      // this is because as there was no child, the child.on('exit') event
      // handler doesn't exist which would normally trigger the restart.
      bus.once('start', callback);
      restart();
    } else {
      callback();
    }
  };

  // connect stdin to the child process (options.stdin is on by default)
  if (options.stdin) {
    process.stdin.resume();
    // FIXME decide whether or not we need to decide the encoding
    // process.stdin.setEncoding('utf8');

    // swallow the stdin error if it happens
    // ref: https://github.com/remy/nodemon/issues/1195
    if (hasStdio) {
      child.stdin.on('error', () => { });
      process.stdin.pipe(child.stdin);
    } else {
      if (child.stdout) {
        child.stdout.pipe(process.stdout);
      } else {
        utils.log.error('running an unsupported version of node ' +
          process.version);
        utils.log.error('nodemon may not work as expected - ' +
          'please consider upgrading to LTS');
      }
    }

    bus.once('exit', function () {
      if (child && process.stdin.unpipe) { // node > 0.8
        process.stdin.unpipe(child.stdin);
      }
    });
  }

  debug('start watch on: %s', config.options.watch);
  if (config.options.watch !== false) {
    watch();
  }
}

function kill(child, signal, callback) {
  if (!callback) {
    callback = function () { };
  }

  if (utils.isWindows) {
    // When using CoffeeScript under Windows, child's process is not node.exe
    // Instead coffee.cmd is launched, which launches cmd.exe, which starts
    // node.exe as a child process child.kill() would only kill cmd.exe, not
    // node.exe
    // Therefore we use the Windows taskkill utility to kill the process and all
    // its children (/T for tree).
    // Force kill (/F) the whole child tree (/T) by PID (/PID 123)
    exec('taskkill /pid ' + child.pid + ' /T /F');
    callback();
  } else {
    // we use psTree to kill the full subtree of nodemon, because when
    // spawning processes like `coffee` under the `--debug` flag, it'll spawn
    // it's own child, and that can't be killed by nodemon, so psTree gives us
    // an array of PIDs that have spawned under nodemon, and we send each the
    // configured signal (default: SIGUSR2) signal, which fixes #335
    // note that psTree also works if `ps` is missing by looking in /proc
    const sig = signal.replace('SIG', '');
    psTree(child.pid, function (err, kids) {
      if (psTree.hasPS) {
        spawn('kill', ['-s', sig, child.pid].concat(kids))
          .on('close', callback);
      } else {
        // make sure we kill from smallest to largest
        const pids = kids.concat(child.pid).sort();
        pids.forEach(pid => {
          exec('kill -' + signals[signal] + ' ' + pid, () => { });
        });
        callback();
      }
    });

  }
}

// stubbed out for now, filled in during run
run.kill = function (flag, callback) {
  if (callback) {
    callback();
  }
};
run.restart = noop;

bus.on('quit', function onQuit(code) {
  if (code === undefined) {
    code = 0;
  }

  // remove event listener
  var exitTimer = null;
  var exit = function () {
    clearTimeout(exitTimer);
    exit = noop; // null out in case of race condition
    child = null;
    if (!config.required) {
      // Execute all other quit listeners.
      bus.listeners('quit').forEach(function (listener) {
        if (listener !== onQuit) {
          listener();
        }
      });
      process.exit(code);
    } else {
      bus.emit('exit');
    }
  };

  // if we're not running already, don't bother with trying to kill
  if (config.run === false) {
    return exit();
  }

  // immediately try to stop any polling
  config.run = false;

  if (child) {
    // give up waiting for the kids after 10 seconds
    exitTimer = setTimeout(exit, 10 * 1000);
    child.removeAllListeners('exit');
    child.once('exit', exit);

    kill(child, 'SIGINT');
  } else {
    exit();
  }
});

bus.on('restart', function () {
  // run.kill will send a SIGINT to the child process, which will cause it
  // to terminate, which in turn uses the 'exit' event handler to restart
  run.kill();
});

// remove the child file on exit
process.on('exit', function () {
  utils.log.detail('exiting');
  if (child) { child.kill(); }
});

// because windows borks when listening for the SIG* events
if (!utils.isWindows) {
  bus.once('boot', () => {
    // usual suspect: ctrl+c exit
    process.once('SIGINT', () => bus.emit('quit', 130));
    process.once('SIGTERM', () => {
      bus.emit('quit', 143);
      if (child) { child.kill('SIGTERM'); }
    });
  })
}


module.exports = run;

}, function(modId) { var map = {"../utils":1587225872409,"./watch":1587225872415,"../config":1587225872416,"./signals":1587225872426}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872409, function(require, module, exports) {
var noop = function () { };
var path = require('path');
const semver = require('semver');
var version = process.versions.node.split('.') || [null, null, null];

var utils = (module.exports = {
  semver: semver,
  satisfies: test => semver.satisfies(process.versions.node, test),
  version: {
    major: parseInt(version[0] || 0, 10),
    minor: parseInt(version[1] || 0, 10),
    patch: parseInt(version[2] || 0, 10),
  },
  clone: require('./clone'),
  merge: require('./merge'),
  bus: require('./bus'),
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  isRequired: (function () {
    var p = module.parent;
    while (p) {
      // in electron.js engine it happens
      if (!p.filename) {
        return true;
      }
      if (p.filename.indexOf('bin' + path.sep + 'nodemon.js') !== -1) {
        return false;
      }
      p = p.parent;
    }

    return true;
  })(),
  home: process.env.HOME || process.env.HOMEPATH,
  quiet: function () {
    // nukes the logging
    if (!this.debug) {
      for (var method in utils.log) {
        if (typeof utils.log[method] === 'function') {
          utils.log[method] = noop;
        }
      }
    }
  },
  reset: function () {
    if (!this.debug) {
      for (var method in utils.log) {
        if (typeof utils.log[method] === 'function') {
          delete utils.log[method];
        }
      }
    }
    this.debug = false;
  },
  regexpToText: function (t) {
    return t
      .replace(/\.\*\\./g, '*.')
      .replace(/\\{2}/g, '^^')
      .replace(/\\/g, '')
      .replace(/\^\^/g, '\\');
  },
  stringify: function (exec, args) {
    // serializes an executable string and array of arguments into a string
    args = args || [];

    return [exec]
      .concat(
      args.map(function (arg) {
        // if an argument contains a space, we want to show it with quotes
        // around it to indicate that it is a single argument
        if (arg.length > 0 && arg.indexOf(' ') === -1) {
          return arg;
        }
        // this should correctly escape nested quotes
        return JSON.stringify(arg);
      })
      )
      .join(' ')
      .trim();
  },
});

utils.log = require('./log')(utils.isRequired);

Object.defineProperty(utils, 'debug', {
  set: function (value) {
    this.log.debug = value;
  },
  get: function () {
    return this.log.debug;
  },
});

Object.defineProperty(utils, 'colours', {
  set: function (value) {
    this.log.useColours = value;
  },
  get: function () {
    return this.log.useColours;
  },
});

}, function(modId) { var map = {"./clone":1587225872410,"./merge":1587225872411,"./bus":1587225872412,"./log":1587225872413}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872410, function(require, module, exports) {
module.exports = clone;

// via http://stackoverflow.com/a/728694/22617
function clone(obj) {
  // Handle the 3 simple types, and null or undefined
  if (null === obj || 'object' !== typeof obj) {
    return obj;
  }

  var copy;

  // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = clone(obj[i]);
    }
    return copy;
  }

  // Handle Object
  if (obj instanceof Object) {
    copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty && obj.hasOwnProperty(attr)) {
        copy[attr] = clone(obj[attr]);
      }
    }
    return copy;
  }

  throw new Error('Unable to copy obj! Its type isn\'t supported.');
}
}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872411, function(require, module, exports) {
var clone = require('./clone');

module.exports = merge;

function typesMatch(a, b) {
  return (typeof a === typeof b) && (Array.isArray(a) === Array.isArray(b));
}

/**
 * A deep merge of the source based on the target.
 * @param  {Object} source   [description]
 * @param  {Object} target   [description]
 * @return {Object}          [description]
 */
function merge(source, target, result) {
  if (result === undefined) {
    result = clone(source);
  }

  // merge missing values from the target to the source
  Object.getOwnPropertyNames(target).forEach(function (key) {
    if (source[key] === undefined) {
      result[key] = target[key];
    }
  });

  Object.getOwnPropertyNames(source).forEach(function (key) {
    var value = source[key];

    if (target[key] && typesMatch(value, target[key])) {
      // merge empty values
      if (value === '') {
        result[key] = target[key];
      }

      if (Array.isArray(value)) {
        if (value.length === 0 && target[key].length) {
          result[key] = target[key].slice(0);
        }
      } else if (typeof value === 'object') {
        result[key] = merge(value, target[key]);
      }
    }
  });

  return result;
}
}, function(modId) { var map = {"./clone":1587225872410}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872412, function(require, module, exports) {
var events = require('events');
var debug = require('debug')('nodemon');
var util = require('util');

var Bus = function () {
  events.EventEmitter.call(this);
};

util.inherits(Bus, events.EventEmitter);

var bus = new Bus();

// /*
var collected = {};
bus.on('newListener', function (event) {
  debug('bus new listener: %s (%s)', event, bus.listeners(event).length);
  if (!collected[event]) {
    collected[event] = true;
    bus.on(event, function () {
      debug('bus emit: %s', event);
    });
  }
});

// */

// proxy process messages (if forked) to the bus
process.on('message', function (event) {
  debug('process.message(%s)', event);
  bus.emit(event);
});

var emit = bus.emit;

// if nodemon was spawned via a fork, allow upstream communication
// via process.send
if (process.send) {
  bus.emit = function (event, data) {
    process.send({ type: event, data: data });
    emit.apply(bus, arguments);
  };
}

module.exports = bus;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872413, function(require, module, exports) {
var colour = require('./colour');
var bus = require('./bus');
var required = false;
var useColours = true;

var coding = {
  log: 'black',
  info: 'yellow',
  status: 'green',
  detail: 'yellow',
  fail: 'red',
  error: 'red',
};

function log(type, text) {
  var msg = '[nodemon] ' + (text || '');

  if (useColours) {
    msg = colour(coding[type], msg);
  }

  // always push the message through our bus, using nextTick
  // to help testing and get _out of_ promises.
  process.nextTick(() => {
    bus.emit('log', { type: type, message: text, colour: msg });
  });

  // but if we're running on the command line, also echo out
  // question: should we actually just consume our own events?
  if (!required) {
    if (type === 'error') {
      console.error(msg);
    } else {
      console.log(msg || '');
    }
  }
}

var Logger = function (r) {
  if (!(this instanceof Logger)) {
    return new Logger(r);
  }
  this.required(r);
  return this;
};

Object.keys(coding).forEach(function (type) {
  Logger.prototype[type] = log.bind(null, type);
});

// detail is for messages that are turned on during debug
Logger.prototype.detail = function (msg) {
  if (this.debug) {
    log('detail', msg);
  }
};

Logger.prototype.required = function (val) {
  required = val;
};

Logger.prototype.debug = false;
Logger.prototype._log = function (type, msg) {
  if (required) {
    bus.emit('log', { type: type, message: msg || '', colour: msg || '' });
  } else if (type === 'error') {
    console.error(msg);
  } else {
    console.log(msg || '');
  }
};

Object.defineProperty(Logger.prototype, 'useColours', {
  set: function (val) {
    useColours = val;
  },
  get: function () {
    return useColours;
  },
});

module.exports = Logger;

}, function(modId) { var map = {"./colour":1587225872414,"./bus":1587225872412}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872414, function(require, module, exports) {
/**
 * Encodes a string in a colour: red, yellow or green
 * @param  {String} c   colour to highlight in
 * @param  {String} str the string to encode
 * @return {String}     coloured string for terminal printing
 */
function colour(c, str) {
  return (colour[c] || colour.black) + str + colour.black;
}

function strip(str) {
  re.lastIndex = 0; // reset position
  return str.replace(re, '');
}

colour.red = '\x1B[31m';
colour.yellow = '\x1B[33m';
colour.green = '\x1B[32m';
colour.black = '\x1B[39m';

var reStr = Object.keys(colour).map(key => colour[key]).join('|');
var re = new RegExp(('(' + reStr + ')').replace(/\[/g, '\\['), 'g');

colour.strip = strip;

module.exports = colour;

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872415, function(require, module, exports) {
module.exports.watch = watch;
module.exports.resetWatchers = resetWatchers;

var debug = require('debug')('nodemon:watch');
var debugRoot = require('debug')('nodemon');
var chokidar = require('chokidar');
var undefsafe = require('undefsafe');
var config = require('../config');
var path = require('path');
var utils = require('../utils');
var bus = utils.bus;
var match = require('./match');
var watchers = [];
var debouncedBus;

bus.on('reset', resetWatchers);

function resetWatchers() {
  debugRoot('resetting watchers');
  watchers.forEach(function (watcher) {
    watcher.close();
  });
  watchers = [];
}

function watch() {
  if (watchers.length) {
    debug('early exit on watch, still watching (%s)', watchers.length);
    return;
  }

  var dirs = [].slice.call(config.dirs);

  debugRoot('start watch on: %s', dirs.join(', '));
  const rootIgnored = config.options.ignore;
  debugRoot('ignored', rootIgnored);

  var watchedFiles = [];

  const promise = new Promise(function (resolve) {
    const dotFilePattern = /[/\\]\./;
    var ignored = match.rulesToMonitor(
      [], // not needed
      Array.from(rootIgnored),
      config
    ).map(pattern => pattern.slice(1));

    const addDotFile = dirs.filter(dir => dir.match(dotFilePattern));

    // don't ignore dotfiles if explicitly watched.
    if (addDotFile.length === 0) {
      ignored.push(dotFilePattern);
    }

    var watchOptions = {
      ignorePermissionErrors: true,
      ignored: ignored,
      persistent: true,
      usePolling: config.options.legacyWatch || false,
      interval: config.options.pollingInterval,
      // note to future developer: I've gone back and forth on adding `cwd`
      // to the props and in some cases it fixes bugs but typically it causes
      // bugs elsewhere (since nodemon is used is so many ways). the final
      // decision is to *not* use it at all and work around it
      // cwd: ...
    };

    if (utils.isWindows) {
      watchOptions.disableGlobbing = true;
    }

    if (process.env.TEST) {
      watchOptions.useFsEvents = false;
    }

    var watcher = chokidar.watch(
      dirs,
      Object.assign({}, watchOptions, config.options.watchOptions || {})
    );

    watcher.ready = false;

    var total = 0;

    watcher.on('change', filterAndRestart);
    watcher.on('add', function (file) {
      if (watcher.ready) {
        return filterAndRestart(file);
      }

      watchedFiles.push(file);
      bus.emit('watching', file);
      debug('chokidar watching: %s', file);
    });
    watcher.on('ready', function () {
      watchedFiles = Array.from(new Set(watchedFiles)); // ensure no dupes
      total = watchedFiles.length;
      watcher.ready = true;
      resolve(total);
      debugRoot('watch is complete');
    });

    watcher.on('error', function (error) {
      if (error.code === 'EINVAL') {
        utils.log.error(
          'Internal watch failed. Likely cause: too many ' +
          'files being watched (perhaps from the root of a drive?\n' +
          'See https://github.com/paulmillr/chokidar/issues/229 for details'
        );
      } else {
        utils.log.error('Internal watch failed: ' + error.message);
        process.exit(1);
      }
    });

    watchers.push(watcher);
  });

  return promise.catch(e => {
    // this is a core error and it should break nodemon - so I have to break
    // out of a promise using the setTimeout
    setTimeout(() => {
      throw e;
    });
  }).then(function () {
    utils.log.detail(`watching ${watchedFiles.length} file${
      watchedFiles.length === 1 ? '' : 's'}`);
    return watchedFiles;
  });
}

function filterAndRestart(files) {
  if (!Array.isArray(files)) {
    files = [files];
  }

  if (files.length) {
    var cwd = process.cwd();
    if (this.options && this.options.cwd) {
      cwd = this.options.cwd;
    }

    utils.log.detail(
      'files triggering change check: ' +
      files
        .map(file => {
          const res = path.relative(cwd, file);
          return res;
        })
        .join(', ')
    );

    // make sure the path is right and drop an empty
    // filenames (sometimes on windows)
    files = files.filter(Boolean).map(file => {
      return path.relative(process.cwd(), path.relative(cwd, file));
    });

    if (utils.isWindows) {
      // ensure the drive letter is in uppercase (c:\foo -> C:\foo)
      files = files.map(f => {
        if (f.indexOf(':') === -1) { return f; }
        return f[0].toUpperCase() + f.slice(1);
      });
    }


    debug('filterAndRestart on', files);

    var matched = match(
      files,
      config.options.monitor,
      undefsafe(config, 'options.execOptions.ext')
    );

    debug('matched?', JSON.stringify(matched));

    // if there's no matches, then test to see if the changed file is the
    // running script, if so, let's allow a restart
    if (config.options.execOptions.script) {
      const script = path.resolve(config.options.execOptions.script);
      if (matched.result.length === 0 && script) {
        const length = script.length;
        files.find(file => {
          if (file.substr(-length, length) === script) {
            matched = {
              result: [file],
              total: 1,
            };
            return true;
          }
        });
      }
    }

    utils.log.detail(
      'changes after filters (before/after): ' +
      [files.length, matched.result.length].join('/')
    );

    // reset the last check so we're only looking at recently modified files
    config.lastStarted = Date.now();

    if (matched.result.length) {
      if (config.options.delay > 0) {
        utils.log.detail('delaying restart for ' + config.options.delay + 'ms');
        if (debouncedBus === undefined) {
          debouncedBus = debounce(restartBus, config.options.delay);
        }
        debouncedBus(matched);
      } else {
        return restartBus(matched);
      }
    }
  }
}

function restartBus(matched) {
  utils.log.status('restarting due to changes...');
  matched.result.map(file => {
    utils.log.detail(path.relative(process.cwd(), file));
  });

  if (config.options.verbose) {
    utils.log._log('');
  }

  bus.emit('restart', matched.result);
}

function debounce(fn, delay) {
  var timer = null;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timer);
    timer = setTimeout(() =>fn.apply(context, args), delay);
  };
}

}, function(modId) { var map = {"../config":1587225872416,"../utils":1587225872409,"./match":1587225872425}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872416, function(require, module, exports) {
/**
 * Manages the internal config of nodemon, checking for the state of support
 * with fs.watch, how nodemon can watch files (using find or fs methods).
 *
 * This is *not* the user's config.
 */
var debug = require('debug')('nodemon');
var load = require('./load');
var rules = require('../rules');
var utils = require('../utils');
var pinVersion = require('../version').pin;
var command = require('./command');
var rulesToMonitor = require('../monitor/match').rulesToMonitor;
var bus = utils.bus;

function reset() {
  rules.reset();

  config.dirs = [];
  config.options = { ignore: [], watch: [] };
  config.lastStarted = 0;
  config.loaded = [];
}

var config = {
  run: false,
  system: {
    cwd: process.cwd(),
  },
  required: false,
  dirs: [],
  timeout: 1000,
  options: {},
};

/**
 * Take user defined settings, then detect the local machine capability, then
 * look for local and global nodemon.json files and merge together the final
 * settings with the config for nodemon.
 *
 * @param  {Object} settings user defined settings for nodemon (typically on
 *  the cli)
 * @param  {Function} ready callback fired once the config is loaded
 */
config.load = function (settings, ready) {
  reset();
  var config = this;
  load(settings, config.options, config, function (options) {
    config.options = options;

    if (options.watch.length === 0) {
      // this is to catch when the watch is left blank
      options.watch.push('*.*');
    }

    if (options['watch_interval']) { // jshint ignore:line
      options.watchInterval = options['watch_interval']; // jshint ignore:line
    }

    config.watchInterval = options.watchInterval || null;
    if (options.signal) {
      config.signal = options.signal;
    }

    var cmd = command(config.options);
    config.command = {
      raw: cmd,
      string: utils.stringify(cmd.executable, cmd.args),
    };

    // now run automatic checks on system adding to the config object
    options.monitor = rulesToMonitor(options.watch, options.ignore, config);

    var cwd = process.cwd();
    debug('config: dirs', config.dirs);
    if (config.dirs.length === 0) {
      config.dirs.unshift(cwd);
    }

    bus.emit('config:update', config);
    pinVersion().then(function () {
      ready(config);
    }).catch(e => {
      // this doesn't help testing, but does give exposure on syntax errors
      console.error(e.stack);
      setTimeout(() => { throw e; }, 0);
    });
  });
};

config.reset = reset;

module.exports = config;

}, function(modId) { var map = {"./load":1587225872417,"../rules":1587225872418,"../utils":1587225872409,"../version":1587225872423,"./command":1587225872424,"../monitor/match":1587225872425}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872417, function(require, module, exports) {
var debug = require('debug')('nodemon');
var fs = require('fs');
var path = require('path');
var exists = fs.exists || path.exists;
var utils = require('../utils');
var rules = require('../rules');
var parse = require('../rules/parse');
var exec = require('./exec');
var defaults = require('./defaults');

module.exports = load;
module.exports.mutateExecOptions = mutateExecOptions;

var existsSync = fs.existsSync || path.existsSync;

function findAppScript() {
  // nodemon has been run alone, so try to read the package file
  // or try to read the index.js file
  if (existsSync('./index.js')) {
    return 'index.js';
  }
}

/**
 * Load the nodemon config, first reading the global root/nodemon.json, then
 * the local nodemon.json to the exec and then overwriting using any user
 * specified settings (i.e. from the cli)
 *
 * @param  {Object} settings user defined settings
 * @param  {Function} ready    callback that receives complete config
 */
function load(settings, options, config, callback) {
  config.loaded = [];
  // first load the root nodemon.json
  loadFile(options, config, utils.home, function (options) {
    // then load the user's local configuration file
    if (settings.configFile) {
      options.configFile = path.resolve(settings.configFile);
    }
    loadFile(options, config, process.cwd(), function (options) {
      // Then merge over with the user settings (parsed from the cli).
      // Note that merge protects and favours existing values over new values,
      // and thus command line arguments get priority
      options = utils.merge(settings, options);

      // legacy support
      if (!Array.isArray(options.ignore)) {
        options.ignore = [options.ignore];
      }

      if (!options.ignoreRoot) {
        options.ignoreRoot = defaults.ignoreRoot;
      }

      // blend the user ignore and the default ignore together
      if (options.ignoreRoot && options.ignore) {
        if (!Array.isArray(options.ignoreRoot)) {
          options.ignoreRoot = [options.ignoreRoot];
        }
        options.ignore = options.ignoreRoot.concat(options.ignore);
      } else {
        options.ignore = defaults.ignore.concat(options.ignore);
      }


      // add in any missing defaults
      options = utils.merge(options, defaults);

      if (!options.script && !options.exec) {
        var found = findAppScript();
        if (found) {
          if (!options.args) {
            options.args = [];
          }
          // if the script is found as a result of not being on the command
          // line, then we move any of the pre double-dash args in execArgs
          const n = options.scriptPosition || options.args.length;
          options.execArgs = (options.execArgs || [])
            .concat(options.args.splice(0, n));
          options.scriptPosition = null;

          options.script = found;
        }
      }

      mutateExecOptions(options);

      if (options.quiet) {
        utils.quiet();
      }

      if (options.verbose) {
        utils.debug = true;
      }

      // simplify the ready callback to be called after the rules are normalised
      // from strings to regexp through the rules lib. Note that this gets
      // created *after* options is overwritten twice in the lines above.
      var ready = function (options) {
        normaliseRules(options, callback);
      };

      // if we didn't pick up a nodemon.json file & there's no cli ignores
      // then try loading an old style .nodemonignore file
      if (config.loaded.length === 0) {
        var legacy = loadLegacyIgnore.bind(null, options, config, ready);

        // first try .nodemonignore, if that doesn't exist, try nodemon-ignore
        return legacy('.nodemonignore', function () {
          legacy('nodemon-ignore', function (options) {
            ready(options);
          });
        });
      }

      ready(options);
    });
  });
}

/**
 * Loads the old style nodemonignore files which is a list of patterns
 * in a file to ignore
 *
 * @param  {Object} options    nodemon user options
 * @param  {Function} success
 * @param  {String} filename   ignore file (.nodemonignore or nodemon-ignore)
 * @param  {Function} fail     (optional) failure callback
 */
function loadLegacyIgnore(options, config, success, filename, fail) {
  var ignoreFile = path.join(process.cwd(), filename);

  exists(ignoreFile, function (exists) {
    if (exists) {
      config.loaded.push(ignoreFile);
      return parse(ignoreFile, function (error, rules) {
        options.ignore = rules.raw;
        success(options);
      });
    }

    if (fail) {
      fail(options);
    } else {
      success(options);
    }
  });
}

function normaliseRules(options, ready) {
  // convert ignore and watch options to rules/regexp
  rules.watch.add(options.watch);
  rules.ignore.add(options.ignore);

  // normalise the watch and ignore arrays
  options.watch = options.watch === false ? false : rules.rules.watch;
  options.ignore = rules.rules.ignore;

  ready(options);
}

/**
 * Looks for a config in the current working directory, and a config in the
 * user's home directory, merging the two together, giving priority to local
 * config. This can then be overwritten later by command line arguments
 *
 * @param  {Function} ready callback to pass loaded settings to
 */
function loadFile(options, config, dir, ready) {
  if (!ready) {
    ready = function () { };
  }

  var callback = function (settings) {
    // prefer the local nodemon.json and fill in missing items using
    // the global options
    ready(utils.merge(settings, options));
  };

  if (!dir) {
    return callback({});
  }

  var filename = options.configFile || path.join(dir, 'nodemon.json');

  if (config.loaded.indexOf(filename) !== -1) {
    // don't bother re-parsing the same config file
    return callback({});
  }

  fs.readFile(filename, 'utf8', function (err, data) {
    if (err) {
      if (err.code === 'ENOENT') {
        if (!options.configFile && dir !== utils.home) {
          // if no specified local config file and local nodemon.json
          // doesn't exist, try the package.json
          return loadPackageJSON(config, callback);
        }
      }
      return callback({});
    }

    var settings = {};

    try {
      settings = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''));
      if (!filename.endsWith('package.json') || settings.nodemonConfig) {
        config.loaded.push(filename);
      }
    } catch (e) {
      utils.log.fail('Failed to parse config ' + filename);
      console.error(e);
      process.exit(1);
    }

    // options values will overwrite settings
    callback(settings);
  });
}

function loadPackageJSON(config, ready) {
  if (!ready) {
    ready = () => { };
  }

  const dir = process.cwd();
  const filename = path.join(dir, 'package.json');
  const packageLoadOptions = { configFile: filename };
  return loadFile(packageLoadOptions, config, dir, settings => {
    ready(settings.nodemonConfig || {});
  });
}

function mutateExecOptions(options) {
  // work out the execOptions based on the final config we have
  options.execOptions = exec({
    script: options.script,
    exec: options.exec,
    args: options.args,
    scriptPosition: options.scriptPosition,
    nodeArgs: options.nodeArgs,
    execArgs: options.execArgs,
    ext: options.ext,
    env: options.env,
  }, options.execMap);

  // clean up values that we don't need at the top level
  delete options.scriptPosition;
  delete options.script;
  delete options.args;
  delete options.ext;

  return options;
}

}, function(modId) { var map = {"../utils":1587225872409,"../rules":1587225872418,"../rules/parse":1587225872420,"./exec":1587225872421,"./defaults":1587225872422}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872418, function(require, module, exports) {

var utils = require('../utils');
var add = require('./add');
var parse = require('./parse');

// exported
var rules = { ignore: [], watch: [] };

/**
 * Loads a nodemon config file and populates the ignore
 * and watch rules with it's contents, and calls callback
 * with the new rules
 *
 * @param  {String} filename
 * @param  {Function} callback
 */
function load(filename, callback) {
  parse(filename, function (err, result) {
    if (err) {
      // we should have bombed already, but
      utils.log.error(err);
      callback(err);
    }

    if (result.raw) {
      result.raw.forEach(add.bind(null, rules, 'ignore'));
    } else {
      result.ignore.forEach(add.bind(null, rules, 'ignore'));
      result.watch.forEach(add.bind(null, rules, 'watch'));
    }

    callback(null, rules);
  });
}

module.exports = {
  reset: function () { // just used for testing
    rules.ignore.length = rules.watch.length = 0;
    delete rules.ignore.re;
    delete rules.watch.re;
  },
  load: load,
  ignore: {
    test: add.bind(null, rules, 'ignore'),
    add: add.bind(null, rules, 'ignore'),
  },
  watch: {
    test: add.bind(null, rules, 'watch'),
    add: add.bind(null, rules, 'watch'),
  },
  add: add.bind(null, rules),
  rules: rules,
};
}, function(modId) { var map = {"../utils":1587225872409,"./add":1587225872419,"./parse":1587225872420}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872419, function(require, module, exports) {


var utils = require('../utils');

// internal
var reEscComments = /\\#/g;
// note that '^^' is used in place of escaped comments
var reUnescapeComments = /\^\^/g;
var reComments = /#.*$/;
var reEscapeChars = /[.|\-[\]()\\]/g;
var reAsterisk = /\*/g;

module.exports = add;

/**
 * Converts file patterns or regular expressions to nodemon
 * compatible RegExp matching rules. Note: the `rules` argument
 * object is modified to include the new rule and new RegExp
 *
 * ### Example:
 *
 *     var rules = { watch: [], ignore: [] };
 *     add(rules, 'watch', '*.js');
 *     add(rules, 'ignore', '/public/');
 *     add(rules, 'watch', ':(\d)*\.js'); // note: string based regexp
 *     add(rules, 'watch', /\d*\.js/);
 *
 * @param {Object} rules containing `watch` and `ignore`. Also updated during
 *                       execution
 * @param {String} which must be either "watch" or "ignore"
 * @param {String|RegExp} the actual rule.
 */
function add(rules, which, rule) {
  if (!{ ignore: 1, watch: 1}[which]) {
    throw new Error('rules/index.js#add requires "ignore" or "watch" as the ' +
      'first argument');
  }

  if (Array.isArray(rule)) {
    rule.forEach(function (rule) {
      add(rules, which, rule);
    });
    return;
  }

  // support the rule being a RegExp, but reformat it to
  // the custom :<regexp> format that we're working with.
  if (rule instanceof RegExp) {
    // rule = ':' + rule.toString().replace(/^\/(.*?)\/$/g, '$1');
    utils.log.error('RegExp format no longer supported, but globs are.');
    return;
  }

  // remove comments and trim lines
  // this mess of replace methods is escaping "\#" to allow for emacs temp files

  // first up strip comments and remove blank head or tails
  rule = (rule || '').replace(reEscComments, '^^')
             .replace(reComments, '')
             .replace(reUnescapeComments, '#').trim();

  var regexp = false;

  if (typeof rule === 'string' && rule.substring(0, 1) === ':') {
    rule = rule.substring(1);
    utils.log.error('RegExp no longer supported: ' + rule);
    regexp = true;
  } else if (rule.length === 0) {
    // blank line (or it was a comment)
    return;
  }

  if (regexp) {
    // rules[which].push(rule);
  } else {
    // rule = rule.replace(reEscapeChars, '\\$&')
    // .replace(reAsterisk, '.*');

    rules[which].push(rule);
    // compile a regexp of all the rules for this ignore or watch
    var re = rules[which].map(function (rule) {
      return rule.replace(reEscapeChars, '\\$&')
                 .replace(reAsterisk, '.*');
    }).join('|');

    // used for the directory matching
    rules[which].re = new RegExp(re);
  }
}

}, function(modId) { var map = {"../utils":1587225872409}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872420, function(require, module, exports) {

var fs = require('fs');

/**
 * Parse the nodemon config file, supporting both old style
 * plain text config file, and JSON version of the config
 *
 * @param  {String}   filename
 * @param  {Function} callback
 */
function parse(filename, callback) {
  var rules = {
    ignore: [],
    watch: [],
  };

  fs.readFile(filename, 'utf8', function (err, content) {

    if (err) {
      return callback(err);
    }

    var json = null;
    try {
      json = JSON.parse(content);
    } catch (e) {}

    if (json !== null) {
      rules = {
        ignore: json.ignore || [],
        watch: json.watch || [],
      };

      return callback(null, rules);
    }

    // otherwise return the raw file
    return callback(null, { raw: content.split(/\n/) });
  });
}

module.exports = parse;


}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872421, function(require, module, exports) {
const path = require('path');
const fs = require('fs');
const existsSync = fs.existsSync;
const utils = require('../utils');

module.exports = exec;
module.exports.expandScript = expandScript;

/**
 * Reads the cwd/package.json file and looks to see if it can load a script
 * and possibly an exec first from package.main, then package.start.
 *
 * @return {Object} exec & script if found
 */
function execFromPackage() {
  // doing a try/catch because we can't use the path.exist callback pattern
  // or we could, but the code would get messy, so this will do exactly
  // what we're after - if the file doesn't exist, it'll throw.
  try {
    // note: this isn't nodemon's package, it's the user's cwd package
    var pkg = require(path.join(process.cwd(), 'package.json'));
    if (pkg.main !== undefined) {
      // no app found to run - so give them a tip and get the feck out
      return { exec: null, script: pkg.main };
    }

    if (pkg.scripts && pkg.scripts.start) {
      return { exec: pkg.scripts.start };
    }
  } catch (e) { }

  return null;
}

function replace(map, str) {
  var re = new RegExp('{{(' + Object.keys(map).join('|') + ')}}', 'g');
  return str.replace(re, function (all, m) {
    return map[m] || all || '';
  });
}

function expandScript(script, ext) {
  if (!ext) {
    ext = '.js';
  }
  if (script.indexOf(ext) !== -1) {
    return script;
  }

  if (existsSync(path.resolve(script))) {
    return script;
  }

  if (existsSync(path.resolve(script + ext))) {
    return script + ext;
  }

  return script;
}

/**
 * Discovers all the options required to run the script
 * and if a custom exec has been passed in, then it will
 * also try to work out what extensions to monitor and
 * whether there's a special way of running that script.
 *
 * @param  {Object} nodemonOptions
 * @param  {Object} execMap
 * @return {Object} new and updated version of nodemonOptions
 */
function exec(nodemonOptions, execMap) {
  if (!execMap) {
    execMap = {};
  }

  var options = utils.clone(nodemonOptions || {});
  var script;

  // if there's no script passed, try to get it from the first argument
  if (!options.script && (options.args || []).length) {
    script = expandScript(options.args[0],
      options.ext && ('.' + (options.ext || 'js').split(',')[0]));

    // if the script was found, shift it off our args
    if (script !== options.args[0]) {
      options.script = script;
      options.args.shift();
    }
  }

  // if there's no exec found yet, then try to read it from the local
  // package.json this logic used to sit in the cli/parse, but actually the cli
  // should be parsed first, then the user options (via nodemon.json) then
  // finally default down to pot shots at the directory via package.json
  if (!options.exec && !options.script) {
    var found = execFromPackage();
    if (found !== null) {
      if (found.exec) {
        options.exec = found.exec;
      }
      if (!options.script) {
        options.script = found.script;
      }
      if (Array.isArray(options.args) &&
        options.scriptPosition === null) {
        options.scriptPosition = options.args.length;
      }
    }
  }

  // var options = utils.clone(nodemonOptions || {});
  script = path.basename(options.script || '');

  var scriptExt = path.extname(script).slice(1);

  var extension = options.ext;
  if (extension === undefined) {
    var isJS = scriptExt === 'js' || scriptExt === 'mjs';
    extension = (isJS || !scriptExt) ? 'js,mjs' : scriptExt;
    extension += ',json'; // Always watch JSON files
  }

  var execDefined = !!options.exec;

  // allows the user to simplify cli usage:
  // https://github.com/remy/nodemon/issues/195
  // but always give preference to the user defined argument
  if (!options.exec && execMap[scriptExt] !== undefined) {
    options.exec = execMap[scriptExt];
    execDefined = true;
  }

  options.execArgs = nodemonOptions.execArgs || [];

  if (Array.isArray(options.exec)) {
    options.execArgs = options.exec;
    options.exec = options.execArgs.shift();
  }

  if (options.exec === undefined) {
    options.exec = 'node';
  } else {
    // allow variable substitution for {{filename}} and {{pwd}}
    var substitution = replace.bind(null, {
      filename: options.script,
      pwd: process.cwd(),
    });

    var newExec = substitution(options.exec);
    if (newExec !== options.exec &&
      options.exec.indexOf('{{filename}}') !== -1) {
      options.script = null;
    }
    options.exec = newExec;

    var newExecArgs = options.execArgs.map(substitution);
    if (newExecArgs.join('') !== options.execArgs.join('')) {
      options.execArgs = newExecArgs;
      delete options.script;
    }
  }


  if (options.exec === 'node' && options.nodeArgs && options.nodeArgs.length) {
    options.execArgs = options.execArgs.concat(options.nodeArgs);
  }

  // note: indexOf('coffee') handles both .coffee and .litcoffee
  if (!execDefined && options.exec === 'node' &&
    scriptExt.indexOf('coffee') !== -1) {
    options.exec = 'coffee';

    // we need to get execArgs set before the script
    // for example, in `nodemon --debug my-script.coffee --my-flag`, debug is an
    // execArg, while my-flag is a script arg
    var leadingArgs = (options.args || []).splice(0, options.scriptPosition);
    options.execArgs = options.execArgs.concat(leadingArgs);
    options.scriptPosition = 0;

    if (options.execArgs.length > 0) {
      // because this is the coffee executable, we need to combine the exec args
      // into a single argument after the nodejs flag
      options.execArgs = ['--nodejs', options.execArgs.join(' ')];
    }
  }

  if (options.exec === 'coffee') {
    // don't override user specified extension tracking
    if (options.ext === undefined) {
      if (extension) { extension += ','; }
      extension += 'coffee,litcoffee';
    }

    // because windows can't find 'coffee', it needs the real file 'coffee.cmd'
    if (utils.isWindows) {
      options.exec += '.cmd';
    }
  }

  // allow users to make a mistake on the extension to monitor
  // converts .js, pug => js,pug
  // BIG NOTE: user can't do this: nodemon -e *.js
  // because the terminal will automatically expand the glob against
  // the file system :(
  extension = (extension.match(/[^,*\s]+/g) || [])
    .map(ext => ext.replace(/^\./, ''))
    .join(',');

  options.ext = extension;

  if (options.script) {
    options.script = expandScript(options.script,
      extension && ('.' + extension.split(',')[0]));
  }

  options.env = {};
  // make sure it's an object (and since we don't have )
  if (({}).toString.apply(nodemonOptions.env) === '[object Object]') {
    options.env = utils.clone(nodemonOptions.env);
  } else if (nodemonOptions.env !== undefined) {
    throw new Error('nodemon env values must be an object: { PORT: 8000 }');
  }

  return options;
}

}, function(modId) { var map = {"../utils":1587225872409}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872422, function(require, module, exports) {
var ignoreRoot = require('ignore-by-default').directories();

// default options for config.options
module.exports = {
  restartable: 'rs',
  colours: true,
  execMap: {
    py: 'python',
    rb: 'ruby',
    ts: 'ts-node',
    // more can be added here such as ls: lsc - but please ensure it's cross
    // compatible with linux, mac and windows, or make the default.js
    // dynamically append the `.cmd` for node based utilities
  },
  ignoreRoot: ignoreRoot.map(_ => `**/${_}/**`),
  watch: ['*.*'],
  stdin: true,
  runOnChangeOnly: false,
  verbose: false,
  signal: 'SIGUSR2',
  // 'stdout' refers to the default behaviour of a required nodemon's child,
  // but also includes stderr. If this is false, data is still dispatched via
  // nodemon.on('stdout/stderr')
  stdout: true,
  watchOptions: {

  },
};

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872423, function(require, module, exports) {
module.exports = version;
module.exports.pin = pin;

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var root = null;

function pin() {
  return version().then(function (v) {
    version.pinned = v;
  });
}

function version(callback) {
  // first find the package.json as this will be our root
  var promise = findPackage(path.dirname(module.parent.filename))
    .then(function (dir) {
      // now try to load the package
      var v = require(path.resolve(dir, 'package.json')).version;

      if (v && v !== '0.0.0-development') {
        return v;
      }

      root = dir;

      // else we're in development, give the commit out
      // get the last commit and whether the working dir is dirty
      var promises = [
        branch().catch(function () { return 'master'; }),
        commit().catch(function () { return '<none>'; }),
        dirty().catch(function () { return 0; }),
      ];

      // use the cached result as the export
      return Promise.all(promises).then(function (res) {
        var branch = res[0];
        var commit = res[1];
        var dirtyCount = parseInt(res[2], 10);
        var curr = branch + ': ' + commit;
        if (dirtyCount !== 0) {
          curr += ' (' + dirtyCount + ' dirty files)';
        }

        return curr;
      });
    }).catch(function (error) {
      console.log(error.stack);
      throw error;
    });

  if (callback) {
    promise.then(function (res) {
      callback(null, res);
    }, callback);
  }

  return promise;
}

function findPackage(dir) {
  if (dir === '/') {
    return Promise.reject(new Error('package not found'));
  }
  return new Promise(function (resolve) {
    fs.stat(path.resolve(dir, 'package.json'), function (error, exists) {
      if (error || !exists) {
        return resolve(findPackage(path.resolve(dir, '..')));
      }

      resolve(dir);
    });
  });
}

function command(cmd) {
  return new Promise(function (resolve, reject) {
    exec(cmd, { cwd: root }, function (err, stdout, stderr) {
      var error = stderr.trim();
      if (error) {
        return reject(new Error(error));
      }
      resolve(stdout.split('\n').join(''));
    });
  });
}

function commit() {
  return command('git rev-parse HEAD');
}

function branch() {
  return command('git rev-parse --abbrev-ref HEAD');
}

function dirty() {
  return command('expr $(git status --porcelain 2>/dev/null| ' +
    'egrep "^(M| M)" | wc -l)');
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872424, function(require, module, exports) {
module.exports = command;

/**
 * command constructs the executable command to run in a shell including the
 * user script, the command arguments.
 *
 * @param  {Object} settings Object as:
 *                           { execOptions: {
 *                               exec: String,
 *                               [script: String],
 *                               [scriptPosition: Number],
 *                               [execArgs: Array<string>]
 *                             }
 *                           }
 * @return {Object}          an object with the node executable and the
 *                           arguments to the command
 */
function command(settings) {
  var options = settings.execOptions;
  var executable = options.exec;
  var args = [];

  // after "executable" go the exec args (like --debug, etc)
  if (options.execArgs) {
    [].push.apply(args, options.execArgs);
  }

  // then goes the user's script arguments
  if (options.args) {
    [].push.apply(args, options.args);
  }

  // after the "executable" goes the user's script
  if (options.script) {
    args.splice((options.scriptPosition || 0) +
      options.execArgs.length, 0, options.script);
  }

  return {
    executable: executable,
    args: args,
  };
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872425, function(require, module, exports) {
const minimatch = require('minimatch');
const path = require('path');
const fs = require('fs');
const debug = require('debug')('nodemon:match');
const utils = require('../utils');

module.exports = match;
module.exports.rulesToMonitor = rulesToMonitor;

function rulesToMonitor(watch, ignore, config) {
  var monitor = [];

  if (!Array.isArray(ignore)) {
    if (ignore) {
      ignore = [ignore];
    } else {
      ignore = [];
    }
  }

  if (!Array.isArray(watch)) {
    if (watch) {
      watch = [watch];
    } else {
      watch = [];
    }
  }

  if (watch && watch.length) {
    monitor = utils.clone(watch);
  }

  if (ignore) {
    [].push.apply(monitor, (ignore || []).map(function (rule) {
      return '!' + rule;
    }));
  }

  var cwd = process.cwd();

  // next check if the monitored paths are actual directories
  // or just patterns - and expand the rule to include *.*
  monitor = monitor.map(function (rule) {
    var not = rule.slice(0, 1) === '!';

    if (not) {
      rule = rule.slice(1);
    }

    if (rule === '.' || rule === '.*') {
      rule = '*.*';
    }

    var dir = path.resolve(cwd, rule);

    try {
      var stat = fs.statSync(dir);
      if (stat.isDirectory()) {
        rule = dir;
        if (rule.slice(-1) !== '/') {
          rule += '/';
        }
        rule += '**/*';

        // `!not` ... sorry.
        if (!not) {
          config.dirs.push(dir);
        }
      } else {
        // ensures we end up in the check that tries to get a base directory
        // and then adds it to the watch list
        throw new Error();
      }
    } catch (e) {
      var base = tryBaseDir(dir);
      if (!not && base) {
        if (config.dirs.indexOf(base) === -1) {
          config.dirs.push(base);
        }
      }
    }

    if (rule.slice(-1) === '/') {
      // just slap on a * anyway
      rule += '*';
    }

    // if the url ends with * but not **/* and not *.*
    // then convert to **/* - somehow it was missed :-\
    if (rule.slice(-4) !== '**/*' &&
      rule.slice(-1) === '*' &&
      rule.indexOf('*.') === -1) {

      if (rule.slice(-2) !== '**') {
        rule += '*/*';
      }
    }


    return (not ? '!' : '') + rule;
  });

  return monitor;
}

function tryBaseDir(dir) {
  var stat;
  if (/[?*\{\[]+/.test(dir)) { // if this is pattern, then try to find the base
    try {
      var base = path.dirname(dir.replace(/([?*\{\[]+.*$)/, 'foo'));
      stat = fs.statSync(base);
      if (stat.isDirectory()) {
        return base;
      }
    } catch (error) {
      // console.log(error);
    }
  } else {
    try {
      stat = fs.statSync(dir);
      // if this path is actually a single file that exists, then just monitor
      // that, *specifically*.
      if (stat.isFile() || stat.isDirectory()) {
        return dir;
      }
    } catch (e) { }
  }

  return false;
}

function match(files, monitor, ext) {
  // sort the rules by highest specificity (based on number of slashes)
  // ignore rules (!) get sorted highest as they take precedent
  const cwd = process.cwd();
  var rules = monitor.sort(function (a, b) {
    var r = b.split(path.sep).length - a.split(path.sep).length;
    var aIsIgnore = a.slice(0, 1) === '!';
    var bIsIgnore = b.slice(0, 1) === '!';

    if (aIsIgnore || bIsIgnore) {
      if (aIsIgnore) {
        return -1;
      }

      return 1;
    }

    if (r === 0) {
      return b.length - a.length;
    }
    return r;
  }).map(function (s) {
    var prefix = s.slice(0, 1);

    if (prefix === '!') {
      if (s.indexOf('!' + cwd) === 0) {
        return s;
      }
      return '!**' + (prefix !== path.sep ? path.sep : '') + s.slice(1);
    }

    // if it starts with a period, then let's get the relative path
    if (s.indexOf('.') === 0) {
      return path.resolve(cwd, s);
    }

    if (s.indexOf(cwd) === 0) {
      return s;
    }

    return '**' + (prefix !== path.sep ? path.sep : '') + s;
  });

  debug('rules', rules);

  var good = [];
  var whitelist = []; // files that we won't check against the extension
  var ignored = 0;
  var watched = 0;
  var usedRules = [];
  var minimatchOpts = {
    dot: true,
  };

  // enable case-insensitivity on Windows
  if (utils.isWindows) {
    minimatchOpts.nocase = true;
  }

  files.forEach(function (file) {
    file = path.resolve(cwd, file);

    var matched = false;
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].slice(0, 1) === '!') {
        if (!minimatch(file, rules[i], minimatchOpts)) {
          ignored++;
          matched = true;
          break;
        }
      } else {
        debug('match', file, minimatch(file, rules[i], minimatchOpts));
        if (minimatch(file, rules[i], minimatchOpts)) {
          watched++;

          // don't repeat the output if a rule is matched
          if (usedRules.indexOf(rules[i]) === -1) {
            usedRules.push(rules[i]);
            utils.log.detail('matched rule: ' + rules[i]);
          }

          // if the rule doesn't match the WATCH EVERYTHING
          // but *does* match a rule that ends with *.*, then
          // white list it - in that we don't run it through
          // the extension check too.
          if (rules[i] !== '**' + path.sep + '*.*' &&
            rules[i].slice(-3) === '*.*') {
            whitelist.push(file);
          } else if (path.basename(file) === path.basename(rules[i])) {
            // if the file matches the actual rule, then it's put on whitelist
            whitelist.push(file);
          } else {
            good.push(file);
          }
          matched = true;
          break;
        } else {
          // utils.log.detail('no match: ' + rules[i], file);
        }
      }
    }
    if (!matched) {
      ignored++;
    }
  });

  debug('good', good)

  // finally check the good files against the extensions that we're monitoring
  if (ext) {
    if (ext.indexOf(',') === -1) {
      ext = '**/*.' + ext;
    } else {
      ext = '**/*.{' + ext + '}';
    }

    good = good.filter(function (file) {
      // only compare the filename to the extension test
      return minimatch(path.basename(file), ext, minimatchOpts);
    });
  } // else assume *.*

  var result = good.concat(whitelist);

  if (utils.isWindows) {
    // fix for windows testing - I *think* this is okay to do
    result = result.map(function (file) {
      return file.slice(0, 1).toLowerCase() + file.slice(1);
    });
  }

  return {
    result: result,
    ignored: ignored,
    watched: watched,
    total: files.length,
  };
}

}, function(modId) { var map = {"../utils":1587225872409}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872426, function(require, module, exports) {
module.exports = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGTRAP: 5,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
  SIGSTKFLT: 16,
  SIGCHLD: 17,
  SIGCONT: 18,
  SIGSTOP: 19,
  SIGTSTP: 20,
  SIGTTIN: 21,
  SIGTTOU: 22,
  SIGURG: 23,
  SIGXCPU: 24,
  SIGXFSZ: 25,
  SIGVTALRM: 26,
  SIGPROF: 27,
  SIGWINCH: 28,
  SIGIO: 29,
  SIGPWR: 30,
  SIGSYS: 31,
  SIGRTMIN: 35,
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872427, function(require, module, exports) {
var parse = require('./parse');

/**
 * Converts a string to command line args, in particular
 * groups together quoted values.
 * This is a utility function to allow calling nodemon as a required
 * library, but with the CLI args passed in (instead of an object).
 *
 * @param  {String} string
 * @return {Array}
 */
function stringToArgs(string) {
  var args = [];

  var parts = string.split(' ');
  var length = parts.length;
  var i = 0;
  var open = false;
  var grouped = '';
  var lead = '';

  for (; i < length; i++) {
    lead = parts[i].substring(0, 1);
    if (lead === '"' || lead === '\'') {
      open = lead;
      grouped = parts[i].substring(1);
    } else if (open && parts[i].slice(-1) === open) {
      open = false;
      grouped += ' ' + parts[i].slice(0, -1);
      args.push(grouped);
    } else if (open) {
      grouped += ' ' + parts[i];
    } else {
      args.push(parts[i]);
    }
  }

  return args;
}

module.exports = {
  parse: function (argv) {
    if (typeof argv === 'string') {
      argv = stringToArgs(argv);
    }

    return parse(argv);
  },
};
}, function(modId) { var map = {"./parse":1587225872428}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872428, function(require, module, exports) {
/*

nodemon is a utility for node, and replaces the use of the executable
node. So the user calls `nodemon foo.js` instead.

nodemon can be run in a number of ways:

`nodemon` - tries to use package.json#main property to run
`nodemon` - if no package, looks for index.js
`nodemon app.js` - runs app.js
`nodemon --arg app.js --apparg` - eats arg1, and runs app.js with apparg
`nodemon --apparg` - as above, but passes apparg to package.json#main (or
  index.js)
`nodemon --debug app.js

*/

var fs = require('fs');
var path = require('path');
var existsSync = fs.existsSync || path.existsSync;

module.exports = parse;

/**
 * Parses the command line arguments `process.argv` and returns the
 * nodemon options, the user script and the executable script.
 *
 * @param  {Array} full process arguments, including `node` leading arg
 * @return {Object} { options, script, args }
 */
function parse(argv) {
  if (typeof argv === 'string') {
    argv = argv.split(' ');
  }

  var eat = function (i, args) {
    if (i <= args.length) {
      return args.splice(i + 1, 1).pop();
    }
  };

  var args = argv.slice(2);
  var script = null;
  var nodemonOptions = { scriptPosition: null };

  var nodemonOpt = nodemonOption.bind(null, nodemonOptions);
  var lookForArgs = true;

  // move forward through the arguments
  for (var i = 0; i < args.length; i++) {
    // if the argument looks like a file, then stop eating
    if (!script) {
      if (args[i] === '.' || existsSync(args[i])) {
        script = args.splice(i, 1).pop();

        // we capture the position of the script because we'll reinsert it in
        // the right place in run.js:command (though I'm not sure we should even
        // take it out of the array in the first place, but this solves passing
        // arguments to the exec process for now).
        nodemonOptions.scriptPosition = i;
        i--;
        continue;
      }
    }

    if (lookForArgs) {
      // respect the standard way of saying: hereafter belongs to my script
      if (args[i] === '--') {
        args.splice(i, 1);
        nodemonOptions.scriptPosition = i;
        // cycle back one argument, as we just ate this one up
        i--;

        // ignore all further nodemon arguments
        lookForArgs = false;

        // move to the next iteration
        continue;
      }

      if (nodemonOpt(args[i], eat.bind(null, i, args)) !== false) {
        args.splice(i, 1);
        // cycle back one argument, as we just ate this one up
        i--;
      }
    }
  }

  nodemonOptions.script = script;
  nodemonOptions.args = args;

  return nodemonOptions;
}


/**
 * Given an argument (ie. from process.argv), sets nodemon
 * options and can eat up the argument value
 *
 * @param {Object} options object that will be updated
 * @param {Sting} current argument from argv
 * @param {Function} the callback to eat up the next argument in argv
 * @return {Boolean} false if argument was not a nodemon arg
 */
function nodemonOption(options, arg, eatNext) {
  // line separation on purpose to help legibility
  if (arg === '--help' || arg === '-h' || arg === '-?') {
    var help = eatNext();
    options.help = help ? help : true;
  } else

  if (arg === '--version' || arg === '-v') {
    options.version = true;
  } else

  if (arg === '--no-update-notifier') {
    options.noUpdateNotifier = true;
  } else

  if (arg === '--spawn') {
    options.spawn = true;
  } else

  if (arg === '--dump') {
    options.dump = true;
  } else

  if (arg === '--verbose' || arg === '-V') {
    options.verbose = true;
  } else

  if (arg === '--legacy-watch' || arg === '-L') {
    options.legacyWatch = true;
  } else

  if (arg === '--polling-interval' || arg === '-P') {
    options.pollingInterval = parseInt(eatNext(), 10);
  } else

  // Depricated as this is "on" by default
  if (arg === '--js') {
    options.js = true;
  } else

  if (arg === '--quiet' || arg === '-q') {
    options.quiet = true;
  } else

  if (arg === '--config') {
    options.configFile = eatNext();
  } else

  if (arg === '--watch' || arg === '-w') {
    if (!options.watch) { options.watch = []; }
    options.watch.push(eatNext());
  } else

  if (arg === '--ignore' || arg === '-i') {
    if (!options.ignore) { options.ignore = []; }
    options.ignore.push(eatNext());
  } else

  if (arg === '--exitcrash') {
    options.exitcrash = true;
  } else

  if (arg === '--delay' || arg === '-d') {
    options.delay = parseDelay(eatNext());
  } else

  if (arg === '--exec' || arg === '-x') {
    options.exec = eatNext();
  } else

  if (arg === '--no-stdin' || arg === '-I') {
    options.stdin = false;
  } else

  if (arg === '--on-change-only' || arg === '-C') {
    options.runOnChangeOnly = true;
  } else

  if (arg === '--ext' || arg === '-e') {
    options.ext = eatNext();
  } else

  if (arg === '--no-colours' || arg === '--no-colors') {
    options.colours = false;
  } else

  if (arg === '--signal' || arg === '-s') {
    options.signal = eatNext();
  } else

  if (arg === '--cwd') {
    options.cwd = eatNext();

    // go ahead and change directory. This is primarily for nodemon tools like
    // grunt-nodemon - we're doing this early because it will affect where the
    // user script is searched for.
    process.chdir(path.resolve(options.cwd));
  } else {

    // this means we didn't match
    return false;
  }
}

/**
 * Given an argument (ie. from nodemonOption()), will parse and return the
 * equivalent millisecond value or 0 if the argument cannot be parsed
 *
 * @param {String} argument value given to the --delay option
 * @return {Number} millisecond equivalent of the argument
 */
function parseDelay(value) {
  var millisPerSecond = 1000;
  var millis = 0;

  if (value.match(/^\d*ms$/)) {
    // Explicitly parse for milliseconds when using ms time specifier
    millis = parseInt(value, 10);
  } else {
    // Otherwise, parse for seconds, with or without time specifier then convert
    millis = parseFloat(value) * millisPerSecond;
  }

  return isNaN(millis) ? 0 : millis;
}


}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872429, function(require, module, exports) {
var fs = require('fs');
var path = require('path');
const supportsColor = require('supports-color');

module.exports = help;

const highlight = supportsColor.stdout ? '\x1B\[$1m' : '';

function help(item) {
  if (!item) {
    item = 'help';
  } else if (item === true) { // if used with -h or --help and no args
    item = 'help';
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was eaiser to read
  item = item.replace(/[^a-z]/gi, '');

  try {
    var dir = path.join(__dirname, '..', '..', 'doc', 'cli', item + '.txt');
    var body = fs.readFileSync(dir, 'utf8');
    return body.replace(/\\x1B\[(.)m/g, highlight);
  } catch (e) {
    return '"' + item + '" help can\'t be found';
  }
}

}, function(modId) { var map = {}; return __REQUIRE__(map[modId], modId); })
__DEFINE__(1587225872430, function(require, module, exports) {
const utils = require('./utils');
const merge = utils.merge;
const bus = utils.bus;
const spawn = require('child_process').spawn;

module.exports = function spawnCommand(command, config, eventArgs) {
  var stdio = ['pipe', 'pipe', 'pipe'];

  if (config.options.stdout) {
    stdio = ['pipe', process.stdout, process.stderr];
  }

  var sh = 'sh';
  var shFlag = '-c';

  if (utils.isWindows) {
    sh = 'cmd';
    shFlag = '/c';
  }


  if (!Array.isArray(command)) {
    command = [command];
  }

  const args = command.join(' ');

  const env = merge(process.env, { FILENAME: eventArgs[0] });
  const child = spawn(sh, [shFlag, args], {
    env: merge(config.options.execOptions.env, env),
    stdio: stdio,
  });

  if (config.required) {
    var emit = {
      stdout: function (data) {
        bus.emit('stdout', data);
      },
      stderr: function (data) {
        bus.emit('stderr', data);
      },
    };

    // now work out what to bind to...
    if (config.options.stdout) {
      child.on('stdout', emit.stdout).on('stderr', emit.stderr);
    } else {
      child.stdout.on('data', emit.stdout);
      child.stderr.on('data', emit.stderr);

      bus.stdout = child.stdout;
      bus.stderr = child.stderr;
    }
  }
};

}, function(modId) { var map = {"./utils":1587225872409}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1587225872406);
})()
//# sourceMappingURL=index.js.map