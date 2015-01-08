'use strict';

/**
 * svg-sprite is a Node.js module for creating SVG sprites
 *
 * @see https://github.com/jkphl/svg-sprite
 *
 * @author Joschi Kuphal <joschi@kuphal.net> (https://github.com/jkphl)
 * @copyright © 2015 Joschi Kuphal
 * @license MIT https://raw.github.com/jkphl/svg-sprite/master/LICENSE
 */

var _							= require('lodash'),
	fs							= require('fs'),
	path						= require('path'),
	async						= require('async'),
	temp						= require('temp'),
	File						= require('vinyl'),
	execFile					= require('child_process').execFile,
	phantomjs					= require('phantomjs').path,
	execFile					= require('child_process').execFile,
	pngcrush					= require('pngcrush-bin').path,
	pngquant					= require('pngquant-bin').path,
	optipng						= require('optipng-bin').path,
	prettysize					= require('prettysize'),
	os							= require('os'),
	fallbackPhantomScript		= path.resolve(__dirname, 'fallback/png.phantom.js');

/**
 * Iconizr fallback file
 * 
 * @param {Object} file			File data
 */
function IconizrFallback(file) {	
	File.apply(this, arguments);
}

/**
 * Prototype
 * 
 * @type {Object} 
 */
IconizrFallback.prototype = _.create(File.prototype, {});

/**
 * Optimize the fallback file
 * 
 * @param {Logger} logger		Logger
 * @param {Object} config		Optimization configuration
 * @param {Function} callback	Callback
 */
IconizrFallback.prototype.optimize = function(logger, config, callback) {
	temp.track();
	
	var that					= this,
	tempFile					= temp.path({suffix: '.png', dir: os.tmpDir()}),
	getFileSize					= function(file) {
		var stats				= fs.statSync(file);
		return stats ? stats.size : null;
	},
	tasks						= [function(_callback) {
		logger.debug('Optimizing "%s" with pngcrush ...', path.basename(that.path));
		
		// Collect arguments
		var args				= ['-reduce', '-brute', '-ow'];
    	if (!config.debug) {
			args.push('-q');	
		}
		args.push(tempFile);
		args.push(tempFile + '-pc');
		
		// Run pngcrush
    	execFile(pngcrush, args, function(error, stdout, stderror) {
    		if (error) {
    			_callback(error);	
    		} else {
    			_callback(null, tempFile);
    		}
		});
	}];
	
	fs.writeFileSync(tempFile, this.contents);
	var origFileSize			= getFileSize(tempFile);
	
	// If the PNG should be quantized
	if (config.quantize) {
		tasks.push(function(file, _callback){
			logger.debug('Quantizing "%s" with pngquant ...', path.basename(that.path));
			
			// Collect arguments
			var args			= ['--speed', config.speed, '--force', '--transbug', '--ext', '-pq.png'];
	    	if (config.debug) {
				args.push('--verbose');	
			}
			args.push(tempFile);
			
			// Run pnquant
	    	execFile(pngquant, args, function(error, stdout, stderror) {
	    		if (error) {
	    			_callback(error);	
	    		} else {
	    			var quantFile		= temp.path({suffix: '.png', dir: os.tmpDir()});
	    			fs.renameSync(path.join(path.dirname(tempFile), path.basename(tempFile, '.png') + '-pq.png'), quantFile);
	    			_callback(null, (origFileSize < getFileSize(quantFile)) ? tempFile : quantFile);
	    		}			
			});
		});
	}
	
	// If the PNG should be further optimized 
	if (config.optimize) {
		tasks.push(function(file, _callback){
			logger.debug('Optimizing "%s" with optipng ...', path.basename(that.path));
			
			// Collect arguments
			var optFile			= temp.path({suffix: '.png', dir: os.tmpDir()}),
			args				= ['-o' + config.level, '-zm1-9', '-force', '-strip', 'all'];
	    	if (!config.debug) {
				args.push('-quiet');	
			}
			args.push(optFile);
			
			// Run optipng
			fs.writeFileSync(optFile, fs.readFileSync(file));
			execFile(optipng, args, function(error, stdout, stderr) {
				if (error) {
					callback(error, png);
				} else {
					_callback(null, (getFileSize(file) < getFileSize(optFile)) ? file : optFile);
				}
			});
		});
	}
	
	async.waterfall(tasks, function(error, file) {
		if (error) {
			return callback(error);
		}
		if (file != tempFile) {
			var fileSize		= getFileSize(file);
			logger.verbose('Shrinked "%s" to %s (%s%%)', path.basename(that.path), prettysize(fileSize), Math.round(1000 * fileSize / origFileSize) / 10);
			that.contents		= new Buffer(fs.readFileSync(file));
		}
		callback(null);
	});
}

/**
 * Iconizr fallback
 * 
 * @param {File} file			Original file (SVG)
 * @param {Number} width		File width
 * @param {Number} height		File height
 * @param {Number} scale		File scale
 * @param {Function} callback	Callback
 */
module.exports = function(file, width, height, scale, callback) {
	var fallback				= new IconizrFallback({cwd: file.cwd, base: file.base, path: path.join(path.dirname(file.path), path.basename(file.path, '.svg') + '.png')});

	execFile(phantomjs, [fallbackPhantomScript, file.contents.toString(), 'file://' + file.path, scale, width, height], function (error, stdout, stderror) {
        if (error) {
            callback(error);
        } else if (stdout.length > 0) {
        	fallback.contents	= new Buffer(stdout.toString(), 'base64');
        	callback(null, fallback);
        } else if (stderror.length > 0) {
            callback(new Error(stderror.toString().trim()));
        } else {
            callback(new Error('PhantomJS didn\'t return a PNG fallback for "' + file.relative + '"'));
        }
    });
}