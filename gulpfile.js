'use strict';

const gulp = require('gulp');
const sass = require('gulp-sass');
const concat = require('gulp-concat');
const jade = require('gulp-jade');


gulp.task('sass', function() {
    return gulp.src('res/sass/**/*.sass')
        .pipe(sass())
        .pipe(concat('custom.css'))
        .pipe(gulp.dest('./res/css'));
});


gulp.task('jade', function() {
    var p = 'res/jade/';
    return gulp.src([
            p+'meta.jade',
            p+'about.jade',
            p+'auth.jade',
            p+'grid.jade',
            p+'intro.jade',
            p+'leave_review.jade',
            p+'product.jade',
            p+'reviews.jade',
            p+'user_authed.jade',
            p+'user_not_authed.jade'
        ])
        .pipe(concat('index.html'))
        .pipe(jade({pretty: true}))
        .pipe(gulp.dest('./'));
});


gulp.task('default', function(){
    gulp.watch('res/**/*.*', ['sass', 'jade']);
});


