// Generated by CoffeeScript 1.6.3
(function() {
  var Dependency, Package, Stitch, file, fs, mime, path, stitchFile, toArray, uglify,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  fs = require('fs');

  file = require('file');

  path = require('path');

  uglify = require('uglify-js');

  stitchFile = require('../assets/stitch');

  Dependency = require('./dependency');

  Stitch = require('./stitch');

  toArray = require('./utils').toArray;

  mime = require('connect')["static"].mime;

  Package = (function() {
    function Package(name, config, argv) {
      if (config == null) {
        config = {};
      }
      if (argv == null) {
        argv = {};
      }
      this.middleware = __bind(this.middleware, this);
      this.name = name;
      this.argv = argv;
      this.identifier = config.identifier;
      this.target = config.target;
      this.libs = toArray(config.libs || []);
      this.paths = toArray(config.paths || []);
      this.modules = toArray(config.modules || []);
      this.jsAfter = config.jsAfter || "";
      this.url = config.url || "";
      this.contentType = mime.lookup(this.target);
      if (this.isJavascript()) {
        this.compile = this.compileJavascript;
      } else if (this.isCss()) {
        this.compile = this.compileCss;
      } else if (this.isCacheManifest()) {
        this.compile = this.compileCache;
      } else {
        throw new Error("Package '" + this.name + "' does not have any compiler");
      }
    }

    Package.prototype.compileModules = function() {
      var _modules, _stitch;
      this.depend || (this.depend = new Dependency(this.modules));
      _stitch = new Stitch(this.paths);
      _modules = this.depend.resolve().concat(_stitch.resolve());
      return stitchFile({
        identifier: this.identifier,
        modules: _modules
      });
    };

    Package.prototype.compileLibs = function() {
      var lib;
      return ((function() {
        var _i, _len, _ref, _results;
        _ref = this.libs;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          lib = _ref[_i];
          _results.push(fs.readFileSync(lib, 'utf8'));
        }
        return _results;
      }).call(this)).join("\n");
    };

    Package.prototype.compileJavascript = function(minify) {
      var ex, result;
      if (minify == null) {
        minify = false;
      }
      try {
        result = [this.compileLibs(), this.compileModules(), this.jsAfter].join("\n");
        if (minify) {
          result = uglify.minify(result, {
            fromString: true
          }).code;
        }
        return result;
      } catch (_error) {
        ex = _error;
        return this.handleCompileError(ex);
      }
    };

    Package.prototype.compileCss = function(minify) {
      var ex, result, _i, _len, _path, _ref;
      if (minify == null) {
        minify = false;
      }
      try {
        result = [];
        _ref = this.paths;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          _path = _ref[_i];
          _path = require.resolve(path.resolve(_path));
          delete require.cache[_path];
          result.push(require(_path));
        }
        return result.join("\n");
      } catch (_error) {
        ex = _error;
        return this.handleCompileError(ex);
      }
    };

    Package.prototype.compileCache = function() {
      var allowed_file, content, root_path;
      content = ['CACHE MANIFEST', '# ' + new Date(), 'CACHE:'];
      root_path = this.paths[0];
      allowed_file = function(filename) {
        var cache_file, hidden_file;
        hidden_file = filename[0] === '.';
        cache_file = mime.lookup(filename) === 'text/cache-manifest';
        return !hidden_file && !cache_file;
      };
      file.walkSync(root_path, function(current, subdirs, filenames) {
        var filename, full_path, result, _i, _len, _results;
        if (filenames == null) {
          return;
        }
        _results = [];
        for (_i = 0, _len = filenames.length; _i < _len; _i++) {
          filename = filenames[_i];
          if (!(allowed_file(filename))) {
            continue;
          }
          full_path = current + '/' + filename;
          result = full_path.replace(root_path + '/', '').replace(root_path.replace('./', '') + '/', '');
          _results.push(content.push(result));
        }
        return _results;
      });
      content.push('NETWORK:', '*');
      return content.join("\n");
    };

    Package.prototype.handleCompileError = function(ex) {
      console.error(ex.message);
      if (ex.path) {
        console.error(ex.path);
      }
      if (ex.location) {
        console.error(ex.location);
      }
      switch (this.argv.command) {
        case "server":
          return "console.log(\"" + ex + "\");";
        case "watch":
          return "";
        default:
          return process.exit(1);
      }
    };

    Package.prototype.isJavascript = function() {
      return this.contentType === "application/javascript";
    };

    Package.prototype.isCss = function() {
      return this.contentType === "text/css";
    };

    Package.prototype.isCacheManifest = function() {
      return this.contentType === "text/cache-manifest";
    };

    Package.prototype.unlink = function() {
      if (fs.existsSync(this.target)) {
        return fs.unlinkSync(this.target);
      }
    };

    Package.prototype.build = function(minify, versionAddOn) {
      var source;
      if (minify == null) {
        minify = false;
      }
      console.log("Building '" + this.name + "' target: " + this.target);
      source = this.compile(minify);
      if (source) {
        return fs.writeFileSync(this.target, source);
      }
    };

    Package.prototype.watch = function() {
      var dir, lib, watchOptions, _i, _len, _ref, _results,
        _this = this;
      console.log("Watching '" + this.name + "'");
      watchOptions = {
        persistent: true,
        interval: 1000,
        ignoreDotFiles: true
      };
      _ref = ((function() {
        var _j, _len, _ref, _results1;
        _ref = this.libs;
        _results1 = [];
        for (_j = 0, _len = _ref.length; _j < _len; _j++) {
          lib = _ref[_j];
          _results1.push(path.dirname(lib));
        }
        return _results1;
      }).call(this)).concat(this.paths);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        dir = _ref[_i];
        if (!fs.existsSync(dir)) {
          continue;
        }
        _results.push(require('watch').watchTree(dir, watchOptions, function(file, curr, prev) {
          if (curr && (curr.nlink === 0 || +curr.mtime !== +(prev != null ? prev.mtime : void 0))) {
            return _this.build();
          }
        }));
      }
      return _results;
    };

    Package.prototype.middleware = function(debug) {
      var _this = this;
      return function(req, res, next) {
        var str;
        str = _this.compile(!debug);
        res.charset = 'utf-8';
        res.setHeader('Content-Type', _this.contentType);
        res.setHeader('Content-Length', Buffer.byteLength(str));
        return res.end((req.method === 'HEAD' && null) || str);
      };
    };

    return Package;

  })();

  module.exports = Package;

}).call(this);
