# `css-asset-rebaser`

A gulp plugin for copying assets from `node_modules` and rewriting URLs in CSS.

## Example use

```js
var gulp = require('gulp');
var less = require('gulp-less');
var rebaser = require('css-asset-rebaser');

gulp.task('style', function() {
  gulp.src('src/**/main.less')
      .pipe(less({
        relativeUrls: true
      }))
      .pipe(rebaser({
        dest: 'build', // relative to process.cwd()
        assets: 'assets' // relative to "dest" above
      }))
      .pipe(gulp.dest('build'));
});
```

## Options

 * `dest` - `string` Required path to destination directory for build artifacts.  This should be the same path that you provide to `gulp.dest()`.  If a relative path is provided, the absolute path will be resolved from `process.cwd()`.

 * `assets` - `string` Optional path for assets within the `dest` directory.  If not provided, `dest` is used as the assets directory.  Any assets (images, fonts, etc.) found in the input CSS that are in `node_modules`, will be copied to this directory, preserving the relative path from `node_modules` (e.g. if `dest` is `build` and `assets` is `assets` then `node_modules/foo/img/bar.png` will be copied to `build/assets/foo/img/bar.png`).

[![Build Status](https://travis-ci.org/tschaub/css-asset-rebaser.svg)](https://travis-ci.org/tschaub/css-asset-rebaser)
