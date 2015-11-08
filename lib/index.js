var Transform = require('stream').Transform;
var path = require('path');
var util = require('util');

var css = require('css');
var fse = require('fs-extra');
var gutil = require('gulp-util');

var PluginError = gutil.PluginError;
var PLUGIN_NAME = 'css-asset-rebaser';

function AssetRebaser(options) {
  Transform.call(this, {objectMode: true});

  if (!options) {
    throw new PluginError(PLUGIN_NAME, 'Requires an options object');
  }
  this._assetsBase = options.assetsBase;
  this._dest = options.dest;

}
util.inherits(AssetRebaser, Transform);

var URL_MATCH = /(url\(\s*['"]?)([^"')]+)(["']?\s*\))/;
var URLS_MATCH = new RegExp(URL_MATCH.source, 'g');

AssetRebaser.prototype._transform = function(srcFile, encoding, done) {
  if (!srcFile) {
    done(new PluginError(PLUGIN_NAME, 'Expected a source file'));
    return;
  }

  var ast;
  try {
    ast = css.parse(String(srcFile.contents), {source: srcFile.path});
  } catch (err) {
    done(err);
  }

  var assetsBase = this._assetsBase;
  var destDir = this._dest;
  var copiedPaths = {};
  var modified = false;

  try {
    ast.stylesheet.rules.forEach(function(rule) {
      if (!rule.declarations) {
        return;
      }
      rule.declarations.forEach(function(declaration) {
        var value = declaration.value;
        if (value && value.indexOf('node_modules') > -1) {
          var replacementUrls = {};
          var urls = value.match(URLS_MATCH);
          urls.forEach(function(str) {
            var originalUrl = str.match(URL_MATCH)[2];
            var nodeModulesIndex = originalUrl.indexOf('node_modules');
            if (nodeModulesIndex > -1) {
              var srcBaseDir = path.dirname(srcFile.path);

              var originalAssetPath = path.join(srcBaseDir, originalUrl);

              var nodeModulesPath = path.join(srcBaseDir, originalUrl.substring(0, nodeModulesIndex + 13));

              var newAssetPath = path.join(assetsBase, path.relative(nodeModulesPath, originalAssetPath));

              var newSrcPath = path.join(destDir, srcFile.relative);

              // TODO: windows
              var newUrl = path.relative(path.dirname(newSrcPath), newAssetPath);

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
        }
      });
    });

    if (modified) {
      srcFile.contents = new Buffer(css.stringify(ast));
    }

  } catch (err) {
    done(err);
  }

  this.push(srcFile);
  done();
}

module.exports = function(options) {
  return new AssetRebaser(options);
}
