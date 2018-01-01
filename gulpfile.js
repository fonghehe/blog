"use strict";

var gulp = require("gulp");
var htmlmin = require("gulp-htmlmin");
var htmlclean = require("gulp-htmlclean");
var cleanCSS = require("gulp-clean-css");
var uglify = require("gulp-uglify");
var imagemin = require("gulp-imagemin");
var autoprefixer = require("gulp-autoprefixer");
var runSequence = require("run-sequence");
var del = require("del");

// ── Paths ──────────────────────────────────────────────────────────────────
var paths = {
  html: "public/**/*.html",
  css: "public/**/*.css",
  js: "public/**/*.js",
  images: "public/**/*.{png,jpg,jpeg,gif,svg,ico}",
};

// ── HTML ───────────────────────────────────────────────────────────────────
gulp.task("minify-html", function () {
  return gulp
    .src(paths.html)
    .pipe(htmlclean())
    .pipe(
      htmlmin({
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeEmptyAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        minifyJS: true,
        minifyCSS: true,
      }),
    )
    .pipe(gulp.dest("public"));
});

// ── CSS ────────────────────────────────────────────────────────────────────
gulp.task("minify-css", function () {
  return gulp
    .src(paths.css)
    .pipe(
      autoprefixer({
        browsers: ["last 2 versions", "> 1%", "ie >= 9"],
        cascade: false,
      }),
    )
    .pipe(cleanCSS({ compatibility: "ie8" }))
    .pipe(gulp.dest("public"));
});

// ── JavaScript ─────────────────────────────────────────────────────────────
gulp.task("minify-js", function () {
  return gulp.src(paths.js).pipe(uglify()).pipe(gulp.dest("public"));
});

// ── Images ─────────────────────────────────────────────────────────────────
gulp.task("minify-images", function () {
  return gulp
    .src(paths.images)
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.jpegtran({ progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo(),
      ]),
    )
    .pipe(gulp.dest("public"));
});

// ── Clean ──────────────────────────────────────────────────────────────────
gulp.task("clean", function () {
  return del(["public"]);
});

// ── Default ────────────────────────────────────────────────────────────────
// Run after `hexo generate` has populated the public/ folder.
// Usage:  hexo generate && gulp
gulp.task("default", function (cb) {
  runSequence(["minify-html", "minify-css", "minify-js"], "minify-images", cb);
});
