/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/camelcase */
import gulp from "gulp";
import clean from "gulp-clean";
import tsc from "gulp-typescript";
import path from "path";
import swc from "gulp-swc";
import esbuild from "gulp-esbuild";
import watch from "gulp-watch";

import config from "./config";

const {
  srcPath,
  esbuildOptions,
  swcOptions,
  bundleInDemoPath,
  bundlePath,
  typesPath,
  tsConfigPath,
  swcBuildPath,
  entry,
} = config;

const gen_tsc = () => {
  return tsc.createProject(tsConfigPath);
};

// clean-dev-bundle:清空编译后的产物
// bundleInDemoPath路径为/demo/computed
// src创建一个流 allowEmpty:路径为空时不报错
gulp.task("clean-dev-bundle", () => {
  return gulp.src(bundleInDemoPath, { allowEmpty: true }).pipe(clean());
});

gulp.task("clean-demo-dev-bundle", () => {
  return gulp.src(bundleInDemoPath, { allowEmpty: true }).pipe(clean());
});

gulp.task("clean-bundle", () => {
  return gulp.src(bundlePath, { allowEmpty: true }).pipe(clean());
});

gulp.task("clean-dts", () => {
  return gulp.src(typesPath, { allowEmpty: true }).pipe(clean());
});
// 将项目的ts文件剥离出来形成声明文件
gulp.task("gen-dts", () => {
  const tsc = gen_tsc();
  return tsc.src().pipe(tsc()).pipe(gulp.dest(typesPath));
});

// 将src中的ts文件使用swc编译成es5保存至swc_build路径中
gulp.task("swc-ts-2-js", () => {
  return gulp
    .src(path.resolve(srcPath, "*.ts")) // 拿到src文件夹下的ts文件创建一个流
    .pipe(swc(swcOptions)) // 使用 swc 编译 ts 到 es5
    .pipe(gulp.dest(swcBuildPath)); // dest目的地:讲编译后的代码保存到swc_build路径中
});

gulp.task("swc-ts-3-js", () => {
  return gulp
    .src(path.resolve(srcPath, "*.ts")) // 拿到src文件夹下的ts文件创建一个流
    .pipe(swc()) // 使用 swc 编译 ts 到 es5
    .pipe(gulp.dest(swcBuildPath)); // dest目的地:讲编译后的代码保存到swc_build路径中
});

// 把swc_build的index拿出来,通过esbuild插件进行打包，保存至dist路径中
gulp.task("esbuild-bundle", () => {
  return gulp
    .src(path.resolve(swcBuildPath, `${entry}.js`))
    .pipe(esbuild(esbuildOptions))
    .pipe(gulp.dest(bundlePath));
});

// 将swc_build路径中的js文件复制到/demo/computed路径中
gulp.task("copy-2-demo", () => {
  return gulp
    .src(path.resolve(swcBuildPath, "*.js")) //
    .pipe(gulp.dest(bundleInDemoPath));
});

gulp.task("watch", () => {
  const ts_file = path.resolve(srcPath, "*.ts");
  const watcher = watch(ts_file, gulp.series("dev"));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watcher.on("change", function (path, stats) {
    console.log(`File ${path} was changed`);
  });
});

gulp.task(
  "dev1",
  gulp.series("clean-dev-bundle", "swc-ts-3-js", "copy-2-demo")
);

// build for develop
gulp.task("dev", gulp.series("clean-dev-bundle", "swc-ts-2-js", "copy-2-demo"));

// build for develop & watch
gulp.task("dev-watch", gulp.series("dev", "watch"));
// generate .d.ts 生成 .d.ts文件
gulp.task("dts", gulp.series("clean-dts", "gen-dts"));
// build for publish
gulp.task(
  "default",
  gulp.series("clean-bundle", "swc-ts-2-js", "esbuild-bundle", "dts")
);
