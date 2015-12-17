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
