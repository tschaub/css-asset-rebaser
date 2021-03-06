var Transform = require('stream').Transform;
var css = require('css');
var fse = require('fs-extra');
var gutil = require('gulp-util');
var path = require('path');
var util = require('util');

var PLUGIN_NAME = 'css-asset-rebaser';
var URL_MATCH = /(url\(\s*['"]?)([^?#"')]+)(\??#[^"')]+)?(["']?\s*\))/;
var URLS_MATCH = new RegExp(URL_MATCH.source, 'g');

function filterDeclarations(ast, filePath) {
  var declarations = [];

  var stylesheet = ast.stylesheet;
  if (!stylesheet) {
    gutil.log('Parsed CSS has no stylesheet:', filePath);
    return declarations;
  }

  var rules = stylesheet.rules;
  if (!rules || !rules.length) {
    gutil.log('Parsed CSS has no rules:', filePath);
    return declarations;
  }

  rules.forEach(function(rule) {
    if (!rule.declarations) {
      return;
    }
    rule.declarations.forEach(function(declaration) {
      var value = declaration.value;
      if (value && value.indexOf('node_modules') > -1) {
        declarations.push(declaration);
      }
    });
  });

  return declarations;
}

function error() {
  var message = util.format.apply(util, arguments);
  return new gutil.PluginError(PLUGIN_NAME, message);
}

function AssetRebaser(options) {
  Transform.call(this, {objectMode: true});

  if (!options) {
    throw error('Requires an options object');
  }

  if (!options.dest || typeof options.dest !== 'string') {
    throw error('Requires a dest string');
  }
  this._dest = path.resolve(options.dest);

  if (options.assets) {
    if (typeof options.assets !== 'string') {
      throw error('The assets option must be a string');
    }
    this._assets = path.resolve(this._dest, options.assets);
  } else {
    this._assets = this._dest;
  }

}
util.inherits(AssetRebaser, Transform);

AssetRebaser.prototype._transform = function(file, encoding, done) {
  if (!file) {
    done(error('Expected a source file'));
    return;
  }

  var ast;
  try {
    ast = css.parse(String(file.contents), {source: file.path});
  } catch (err) {
    done(error('Failed to parse file as CSS: %s', err.message));
  }

  var assetsDir = this._assets;
  var fileDir = path.dirname(file.path);
  var newFilePath = path.join(this._dest, file.relative);

  var modified = false;
  var replacementPaths = {};

  filterDeclarations(ast, file.path).forEach(function(declaration) {
    var value = declaration.value;
    var urls = value.match(URLS_MATCH);
    if (!urls) {
      return;
    }
    var replacementUrls = {};
    urls.forEach(function(str) {
      var originalUrl = str.match(URL_MATCH)[2];
      if (!originalUrl) {
        gutil.log('Expected url() in CSS value:', str);
        return;
      }

      var modulesIndex = originalUrl.indexOf('node_modules');
      if (modulesIndex > -1) {
        var originalAssetPath = path.join(fileDir, originalUrl);
        var modulesDir = path.join(fileDir, originalUrl.substring(0, modulesIndex + 13));
        var newAssetPath = path.join(assetsDir, path.relative(modulesDir, originalAssetPath));
        var newUrl = path.relative(path.dirname(newFilePath), newAssetPath).replace(/\\/g, '/');
        replacementPaths[originalAssetPath] = newAssetPath;
        replacementUrls[originalUrl] = newUrl;
      }
    });
    for (var key in replacementUrls) {
      value = value.replace(key, replacementUrls[key]);
      modified = true;
    }
    declaration.value = value;
  });

  if (modified) {
    for (var originalPath in replacementPaths) {
      try {
        fse.copySync(originalPath, replacementPaths[originalPath]);
      } catch (err) {
        done(error('Copying %s failed: %s', originalPath, err.message));
        return;
      }
    }
    var contents;
    try {
      contents = new Buffer(css.stringify(ast));
    } catch (err) {
      done(error('Unable to serialize CSS: %s', err.message));
      return;
    }
    file.contents = contents;
  }

  this.push(file);
  done();
};

module.exports = function(options) {
  return new AssetRebaser(options);
};
