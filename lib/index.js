var Transform = require('stream').Transform;
var path = require('path');
var util = require('util');

var PluginError = require('gulp-util').PluginError;
var css = require('css');
var fse = require('fs-extra');

var PLUGIN_NAME = 'css-asset-rebaser';

function filterDeclarations(ast) {
  var declarations = [];

  var stylesheet = ast.stylesheet;
  if (!stylesheet) {
    // log
    return declarations;
  }

  var rules = stylesheet.rules;
  if (!rules || !rules.length) {
    // log
    return declarations;
  }

  for (var i = 0, ii = rules.length; i < ii; ++i) {
    var rule = rules[i];
    if (!rule.declarations) {
      continue;
    }
    for (var j = 0, jj = rule.declarations.length; j < jj; ++j) {
      var declaration = rule.declarations[j];
      var value = declaration.value;
      if (value && value.indexOf('node_modules') > -1) {
        declarations.push(declaration);
      }
    }
  }
  return declarations;
}

function AssetRebaser(options) {
  Transform.call(this, {objectMode: true});

  if (!options) {
    throw new PluginError(PLUGIN_NAME, 'Requires an options object');
  }

  if (!options.dest || typeof options.dest !== 'string') {
    throw new PluginError(PLUGIN_NAME, 'Requires a dest string');
  }
  this._dest = path.resolve(options.dest);

  if (options.assets) {
    if (typeof options.assets !== 'string') {
      throw new PluginError(PLUGIN_NAME, 'The assets option must be a string');
    }
    this._assets = path.resolve(this._dest, options.assets);
  } else {
    this._assets = this._dest;
  }

}
util.inherits(AssetRebaser, Transform);

var URL_MATCH = /(url\(\s*['"]?)([^"')]+)(["']?\s*\))/;
var URLS_MATCH = new RegExp(URL_MATCH.source, 'g');

AssetRebaser.prototype._transform = function(file, encoding, done) {
  if (!file) {
    done(new PluginError(PLUGIN_NAME, 'Expected a source file'));
    return;
  }

  var ast;
  try {
    ast = css.parse(String(file.contents), {source: file.path});
  } catch (err) {
    done(new PluginError(PLUGIN_NAME, 'Failed to parse file as CSS: ' + err.message));
  }

  var assetsDir = this._assets;
  var destDir = this._dest;

  var fileDir = path.dirname(file.path);
  var newFilePath = path.join(destDir, file.relative);

  var copiedPaths = {};
  var modified = false;

  var replacementUrls = {};

  filterDeclarations(ast).forEach(function(declaration) {
    var value = declaration.value;
    var urls = value.match(URLS_MATCH);
    if (!urls) {
      return;
    }
    urls.forEach(function(str) {
      var originalUrl = str.match(URL_MATCH)[2];
      if (!originalUrl) {
        // unexpected
        return;
      }

      var modulesIndex = originalUrl.indexOf('node_modules');

      if (modulesIndex > -1) {
        var originalAssetPath = path.join(fileDir, originalUrl);
        var modulesDir = path.join(fileDir, originalUrl.substring(0, modulesIndex + 13));
        var newAssetPath = path.join(assetsDir, path.relative(modulesDir, originalAssetPath));

        // TODO: windows
        var newUrl = path.relative(path.dirname(newFilePath), newAssetPath);

        // copy to asset directory
        if (!copiedPaths[originalAssetPath]) {
          try {
            fse.copySync(originalAssetPath, newAssetPath);
          } catch (err) {
            done(new Error('Copying ' + originalAssetPath + ' failed: ' +
                err.message));
            return;
          }
          copiedPaths[originalAssetPath] = true;
        }

        replacementUrls[originalUrl] = newUrl;
        modified = true;
      }
    });
    for (var key in replacementUrls) {
      value = value.replace(key, replacementUrls[key]);
    }
    declaration.value = value;
  });

  if (modified) {
    file.contents = new Buffer(css.stringify(ast));
  }

  this.push(file);
  done();
}

module.exports = function(options) {
  return new AssetRebaser(options);
}
