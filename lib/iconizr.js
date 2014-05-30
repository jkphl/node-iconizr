"use strict";

// Last resort for uncaught exceptions
process.on('uncaughtException', function (error) {
	console.log(error);
    console.error('An uncaughtException was found, iconizr will end.');
    process.exit(1);
});

var _			= require('underscore'),
path			= require('path'),
fs				= require('fs'),
SVGSprite		= require('svg-sprite'),
svg2png			= require('svg2png'),
async			= require('async'),
execFile		= require('child_process').execFile,
pngcrush		= require('pngcrush-bin').path,
pngquant		= require('pngquant-bin').path,
optipng			= require('optipng-bin').path,
mustache		= require('mustache'),
UglifyJS		= require('uglify-js'),
mkdirp			= require('mkdirp'),
chalk			= require('chalk'),
util			= require('util'),
defaultOptions	= {
	// svg-sprite options
	spritedir	: 'icons',
	sprite		: 'icons',
	verbose		: 0,
	keep		: false,
	render		: {},
	
	// iconizr options
	quantize	: false,
	level		: 3,
	embed		: '',
	svg			: 1048576,
	png			: 32768,
	preview		: null
};

/**
 * Restore the temporarily altered configuration options
 * 
 * @param {Object} options			Configuration options
 * @return {Object}					Restored options
 */
function restoreOptions(options) {
	options.keep				= options._keep;
	delete options._keep;
	options.render				= options._render;
	delete options._render;
	return options;
}
 
/**
 * Create a CSS icon kit from pre-processed SVG icons
 * 
 * @param {Object} result			Pre-processing results
 * @return {Object}
 */
function Iconizr(result) {
	this._options				= _.extend({}, defaultOptions, result.options);
	this._options.quantize		= !!this._options.quantize;
	this._options.level			= Math.max(0, Math.min(11, Math.abs(parseInt(this._options.level, 10)))) - 1;
	this._options.optimize		= this._options.level > 0;
	this._options.speed			= this._options.optimize ? Math.round(10 - (9 * this._options.level / 10)) : 0;
	this._options.optimization	= this._options.optimize ? Math.round(this._options.level * 7 / 10) : 0;
	this._options.svg			= Math.max(1024, parseInt(this._options.svg, 10));
	this._options.png			= Math.max(1024, parseInt(this._options.png, 10));
	this._options.preview		= this._options.preview || null;
	this._options.embed			= this._options.embed || ('/' + path.relative(process.cwd(), this._options.outputDir));
	
	this.result					= result;
	
	// If there's an SVG sprite available
	if ('data' in this.result) {
		this.result.data.exceed	= {svg: false, png: false};
		this._options.iconDir	= path.resolve(this._options.outputDir, this._options.spritedir);
		
		// Determine the sprite files
		this.sprite				= {
			svg					: path.resolve(this._options.outputDir, this.result.data.sprite),
			png					: path.join(this._options.iconDir, path.basename(this.result.data.sprite, '.svg') + '.png')
		};
		
		// Prepare the CSS file list & output type counter
		this.css				= this._options.prefix;
		this.output				= 0;
		
		// Collect all single files
		this.icons				= {svg: [], png: []};
		for (var s = 0, icon; s < this.result.data.svg.length; ++s) {
			icon				= path.join(this._options.iconDir, this.result.data.svg[s].name);
			try {
				if (fs.statSync(icon + '.svg').isFile()) {
					this.icons.svg.push(icon + '.svg');
					this.icons.png.push(icon + '.png');
				}
			} catch(e) {}
		}
	}
}

/**
 * Create an the icon kit
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype.createIconKit = function(callback) {

	// If an icon kit can be created
	if (this.result.data) {

		var that				= this;
		async.waterfall([
			
			// Convert all SVG files to PNG versions
		    function(_callback) {
		    	that._svg2png(_callback);
		    },
		    
		    // Optimize the PNG images
		    function(_callback) {
		    	if (that._options.optimize) {
		    		that._optimizePngs(_callback);
		    	} else {
		    		_callback(null);	
		    	}
		    },
		    
		    // Create data URIs for the SVG icons
		    function(_callback) {
		    	that._createSVGDataURIs(_callback);
		    },
		    
		    // Create data URIs for the PNG icons
		    function(_callback) {
		    	that._createPNGDataURIs(_callback);
		    },
		    
		    // Render the output stylesheets
		    function(_callback) {
		    	that._renderTemplates(_callback);
		    },
		    
		    // Render the loader fragment
		    function(_callback) {
		    	that._renderLoaderFragment(_callback);
		    },
		    
		    // Render the loader HTML preview
		    function(loader, _callback) {
		    	loader ? that._renderPreviewHTML(loader, _callback) : _callback(null);
		    }
		    
		], function(error) {
			
			// Remove intermediate files
			if (!that._options.keep) {
				that.icons.svg.concat(that.icons.png).forEach(function(icon) {
					if (icon in this.result.files) {
						try {
							fs.unlinkSync(icon);
							delete this.result.files[icon];
							--this.result.length;
						} catch(_error) {}
					}
				}, that);
			}
			
			callback(error, that.result);
		});
		
	// Else: Nothing to be done ...
	} else {
		callback(null, that.result);
	}
}

/**
 * Create PNG versions of all involved SVG files
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._svg2png = function(callback) {
	var that	= this,
	tasks		= [function(_callback) {
		if (that._options.verbose > 1) {
			console.log('·· Creating a PNG sprite from "%s" ...', path.basename(that.sprite.svg));
		}
		svg2png(that.sprite.svg, that.sprite.png, function(error) {
			if (!error) {
				try {
	    			that.result.files[that.sprite.png]	= fs.lstatSync(that.sprite.png).size;
	    			++that.result.length;
				} catch(_error) {
					error			= _error;
				}
			}
			_callback(error);
		});
	}];
	for (var s = 0; s < this.icons.svg.length; ++s) {
		tasks.push(function(svg, png) { return function(_callback) {
			if (that._options.verbose > 1) {
				console.log('·· Creating a PNG version of "%s" ...', path.basename(svg));
			}
			svg2png(svg, png, function(error) {
				if (!error) {
					try {
		    			that.result.files[png]			= fs.lstatSync(png).size;
		    			++that.result.length;
					} catch(_error) {
						error		= _error;
					}
				}
				_callback(error);
			});
		}}(this.icons.svg[s], this.icons.png[s]));
	}
	if (this._options.verbose) {
		console.log('Creating PNG versions of %s SVG images (including the sprite) ...', tasks.length);	
	}
	async.parallel(tasks, function(error) { callback(error); });
}

/**
 * Optimize all PNG icons
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._optimizePngs = function(callback) {
	if (this._options.verbose > 1) {
		console.log('Optimizing %s PNG images (including the sprite) ... ', this.icons.svg.length + 1);	
	}
	
	var that					= this,
	tasks						= [function(_callback) {
		that._optimizePng(that.sprite.png, _callback);
	}];
	for (var s = 0; s < this.icons.svg.length; ++s) {
		tasks.push(function(png) { return function(_callback) {
			that._optimizePng(png, _callback);
		}}(this.icons.png[s]));
	}
	async.parallel(tasks, function(error, result) {
		callback(error);
	});
}

/**
 * Optimize a single PNG icon
 * 
 * @param {String} png				PNG Icon
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._optimizePng = function(png, callback) {
	var that					= this,
	remove						= [];
	async.waterfall([

		// Optimize with pngcrush
	    function(_callback){
	    	var args			= ['-reduce', '-brute', '-e', '-pc.png'];
	    	if (that._options.verbose < 2) {
				args.push('-q');	
			}
			args.push(png);
	    	execFile(pngcrush, args, function(error) {
	    		if (error) {
	    			_callback(error);	
	    		} else {
	    			remove.push(png);
	    			_callback(null, path.join(that._options.iconDir, path.basename(png, '.png') + '-pc.png'));
	    		}
			});
	    },
	    
	    // Optimize with pngquant
	    function(png, _callback){
		    if (that._options.quantize) {
	    		var args			= ['--speed', that._options.speed, '--force', '--transbug', '--ext', '-pq.png'];
		    	if (that._options.verbose >= 2) {
					args.push('--verbose');	
				}
				args.push(png);
		    	execFile(pngquant, args, function(error) {
		    		if (error) {
		    			_callback(error);	
		    		} else {
		    			var opt		= path.join(that._options.iconDir, path.basename(png, '.png') + '-pq.png');
		    			if (that._isSmallerThan(opt, png)) {
		    				remove.push(png);
		    				_callback(null, opt);
		    			} else {
		    				remove.push(opt);
		    				_callback(null, png);
		    			}
		    		}			
				});
	    	} else {
	    		_callback(null, png);	
	    	}
	    },
	    
	    // Optimize with optipng
	    function(png, _callback) {
	    	var opt				= path.join(that._options.iconDir, path.basename(png, '.png') + '-op.png'),
	    	args				= ['-o' + that._options.optimization, '-zm1-9', '-force', '-strip', 'all'];
	    	if (that._options.verbose < 2) {
				args.push('-quiet');	
			}
			args.push(opt);
			fs.writeFileSync(opt, fs.readFileSync(png));
			execFile(optipng, args, function(error, stdout, stderr) {
				if (error) {
					callback(error, png);
				} else {
					if (that._isSmallerThan(opt, png)) {
	    				remove.push(png);
	    				_callback(null, opt);
	    			} else {
	    				remove.push(opt);
	    				_callback(null, png);
	    			}
				}
			});
	    }
	    
	], function(error, opt) {
		if (error) {
			if (that._options.verbose > 2) {
				console.log(' · Optimized PNG image "%s" ... ' + chalk.red('ERROR'), path.basename(png));
			}
			
			callback(error);
			return;
		}
		
		// Logging
		if (that._options.verbose > 2) {
			try {
				var prevSize			= fs.lstatSync(png).size,
				nowSize					= (png != opt) ? fs.lstatSync(opt).size : prevSize,
				saving					= prevSize - nowSize;
				console.log(' · Optimized PNG image "%s" ... ' + chalk.green('OK') + chalk.grey(' (saved %s / %s%%)'), path.basename(png), bytesToSize(saving, 1), Math.round(100 * saving / prevSize, 2));
			} catch (error) {
				console.log(' · Optimized PNG image "%s" ... ' + chalk.green('OK'), path.basename(png));
			}
		}
		
		// Remove all redundant files
		for (var r = 0; r < remove.length; ++r) {
			fs.unlinkSync(remove[r]);
		}
		
		// Rename the optimized PNG to the original filename
		if (png != opt) {
			fs.renameSync(opt, png);
		}

		callback(null, png);
	});
}

/**
 * Check if a file is smaller than another
 * 
 * @param {String} file1			File 1
 * @param {String} file2			File 2
 * @return {Boolean}
 */
Iconizr.prototype._isSmallerThan = function(file1, file2) {
	try {
		return fs.statSync(file1).size < fs.statSync(file2).size;
	} catch(e) {
		return false;	
	}
}

/**
 * Create data URIs for the SVG icons
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._createSVGDataURIs = function(callback) {
	var icons			= {};
	
	// Urlencode the SVG icons
	for (var s = 0; s < this.icons.svg.length; ++s) {
		var name		= path.basename(this.icons.svg[s], '.svg');
		icons[name]		= {
			path		: path.join(this._options.spritedir, path.basename(this.icons.svg[s])),
			encoded		: 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(this.icons.svg[s]))
		};
		if (icons[name].encoded.length > this._options.svg) {
			this.result.data.exceed.svg	= true;
		}
	}
	
	// Add the SVG icon properties to the template data
	for (var s = 0; s < this.result.data.svg.length; ++s) {
		if (this.result.data.svg[s].name in icons) {
			this.result.data.svg[s].svg	= icons[this.result.data.svg[s].name];
		}
	}

	callback(null);
}

/**
 * Create data URIs for the PNG icons
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._createPNGDataURIs = function(callback) {
	var icons			= {};
	
	// Urlencode the PNG icons
	for (var s = 0; s < this.icons.png.length; ++s) {
		var name		= path.basename(this.icons.png[s], '.png');
		icons[name]		= {
			path		: path.join(this._options.spritedir, path.basename(this.icons.png[s])),
			encoded		: 'data:image/png;base64,' + (new Buffer(fs.readFileSync(this.icons.png[s]))).toString('base64')
		};
		if (icons[name].encoded.length > this._options.png) {
			this.result.data.exceed.png	= true;
		}
	}
	
	// Add the SVG icon properties to the template data
	for (var s = 0; s < this.result.data.svg.length; ++s) {
		if (this.result.data.svg[s].name in icons) {
			this.result.data.svg[s].png	= icons[this.result.data.svg[s].name];
		}
	}

	callback(null);
}


/**
 * Write all files to the file system
 * 
 * @param {Function} callback		Callback
 */
Iconizr.prototype._renderTemplates = function(callback) {
	
	var tasks						= {},
	setDataAndSingle				= function(currentData, data, type) {
		currentData.svg				= [];
		for (var s = 0; s < data.svg.length; ++s) {
			currentData.svg[s]		= _.extend({}, data.svg[s], data.svg[s][type]);
			delete currentData.svg[s].svg;
			delete currentData.svg[s].png;
		}
		return currentData;
	}
	
	// If the sprite at least one SVG image
	if (this.result.data.svg.length) {
		
		// Run through all configured rendering types
		for (var type in this._options.render) {
			var render							= SVGSprite.renderConfig(this._options.outputDir, this._options.render[type], type, __dirname);

			// If both a template and a destination file are given: Create tasks for it
			if (render.dest !== null) {

				if (this._options.verbose > 0) {
					console.log('Creating the "%s" output type ...', type);
				}
				
				// Non-stylesheet output types: Simple rendering
				if (['html', 'inline.svg'].indexOf(type) >= 0) {
					tasks[type]						= SVGSprite.renderTask(render.template, dest + '.' + type, _.extend({}, data), this.result);
					
				// Stylesheet output type: Render variants
				} else {
					++this.output;
					var data						= setDataAndSingle(_.extend({}, this.result.data), this.result.data, 'svg'),
					dest							= path.join(path.dirname(render.dest), path.basename(render.dest, '.' + type));
					
					// Render the SVG sprite version
					tasks[type + '-svg-sprite']		= SVGSprite.renderTask(render.template, dest + '-svg-sprite.' + type, _.extend({}, data, {encode: !this.result.data.exceed.svg}), this.result);
					
					// Render the SVG data version
					tasks[type + '-svg-data']		= SVGSprite.renderTask(render.template, dest + '-svg-data.' + type, _.extend({}, data, {sprite: null, common: null, encode: !this.result.data.exceed.svg}), this.result);
					
					// Render the single SVG icon version (if applicable)
					if (this._options.keep) {
						tasks[type + '-svg-single']	= SVGSprite.renderTask(render.template, dest + '-svg-single.' + type, _.extend({}, data, {sprite: null, common: null, encode: false}), this.result);
					}
					
					// Render the PNG sprite version
					data							= setDataAndSingle(data, this.result.data, 'png');
					tasks[type + '-png-sprite']		= SVGSprite.renderTask(render.template, dest + '-png-sprite.' + type, _.extend({}, data, {sprite: path.join(this._options.spritedir, path.basename(this.sprite.png)), encode: !this.result.data.exceed.png}), this.result);
					
					// Render the PNG data version
					tasks[type + '-png-data']		= SVGSprite.renderTask(render.template, dest + '-png-data.' + type, _.extend({}, data, {sprite: null, common: null, encode: !this.result.data.exceed.png}), this.result);
					
					// Render the single PNG icon version (if applicable)
					if (this._options.keep) {
						tasks[type + '-png-single']	= SVGSprite.renderTask(render.template, dest + '-png-single.' + type, _.extend({}, data, {sprite: null, common: null, encode: false}), this.result);
					}
				}
				
				// Register the CSS file name registry
				if (type == 'css') {
					this.css					= path.basename(render.dest, '.' + type);
				}
			}
		}
	}
	
	async.parallel(tasks, function(error, result) {
		callback(error);
	});
}

/**
 * Render the loader HTML fragment
 * 
 * @param {Function} callback		Callback
 */
Iconizr.prototype._renderLoaderFragment = function(callback) {
	
	// If any output formats have been generated
	if (this.output) {
	
		if (this._options.verbose > 0) {
			console.log('Creating the stylesheet loader fragment ...');
		}
		
		try {
			var that								= this,
			dest									= path.join(this._options.outputDir, this.css + '-loader-fragment.html'),
			embed									= path.normalize(this._options.embed),
			data									= {
				'png-sprite'						: this.css + '-png-sprite.css',
				'png-data'							: this.css + '-png-data.css',
				'svg-sprite'						: this.css + '-svg-sprite.css',
				'svg-data'							: this.css + '-svg-data.css'
			},
			script									= mustache.render(fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', 'loader.js'), 'utf-8'), data);
			embed									= (!embed || (embed == '.')) ? '' : (embed + '/');
			data.script								= UglifyJS.minify(script, {fromString: true}).code;
			script									= mustache.render(fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', 'loader.html'), 'utf-8'), data).split('##embed##').join(embed);
			if (script.length) {
				fs.writeFileSync(dest, script);
				that.result.files[dest]				= script.length;
				++that.result.length;
			}
			callback(null, script);

		} catch(e) {
			callback(e, null);
		}
			
	// Else: Nothing to do
	} else {
		callback(null, null);
	}
}

/**
 * Render the preview HTML
 * 
 * @param {String} loader			Loader HTML fragment
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._renderPreviewHTML = function(loader, callback) {
	if (this._options.preview) {
		if (this._options.verbose > 0) {
			console.log('Creating the preview HTML documents ...');
		}
		
		// Create the preview directory
		var that				= this,
		preview					= path.resolve(this._options.outputDir, this._options.preview);
		mkdirp(preview, 511, function(error) {
    		if (error && (typeof(error) == 'object') && ('message' in error)) {
    			error			= new Error(error.message);
    			error.errno		= 1391854708;
    			callback(error);
    			return;
    		}
    		
    		var icons			= [],
			tasks				= {},
			css					= path.relative(preview, that._options.outputDir),
			embed				= css + '/' + that.css,
			stylesheets			= {
				'auto'			: ['Automatic detection', ''],
				'png-single'	: ['PNG single images', embed + '-png-single.css'],
				'png-sprite'	: ['PNG sprite', embed + '-png-sprite.css'],
				'png-data'		: ['PNG data URIs', embed + '-png-data.css'],
				'svg-single'	: ['SVG single images', embed + '-svg-single.css'],
				'svg-sprite'	: ['SVG sprite', embed + '-svg-sprite.css'],
				'svg-data'		: ['SVG data URIs', embed + '-svg-data.css']
			},
			task				= function(template, dest, data) {
				return function(_callback) {
					try {
						var out				= mustache.render(fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', template), 'utf-8'), data);
						if (out.length) {
							fs.writeFileSync(dest, out);
							that.result.files[dest]			= out.length;
							++that.result.length;
						}
						_callback(null);
					} catch(e) {
						_callback(e);
					}
				}
			},
			dims				= null;
			loader				= loader.split('##embed##').join((!css || (css == '.')) ? '' : (css + '/'));
			
			if (!that._options._keep) {
				delete stylesheets['png-single'];
				delete stylesheets['svg-single'];
			}
			
			// Create the icon names / CSS classes
			for (var s = 0, svg; s < that.result.data.svg.length; ++s) {
				svg				= that.result.data.svg[s].name;
				icons.push({name: that._options.pseudo ? svg.split(that._options.pseudo).join(':') : svg});
			}
			
			// Create a dimension task (if necessary)
			if (!that._options.dims) {
				dims			= that.css + '-dims.css';
				tasks.dims		= task('dimensions.css', path.normalize(path.join(preview, dims)), that.result.data);
			}
			
			// Run through all stylesheets
			for (var s1 in stylesheets) {
				var dest1		= path.normalize(path.join(preview, (stylesheets[s1][1] ? path.basename(stylesheets[s1][1], '.css') : that.css) + '-preview.html')),
				data			= {
					prefix		: that._options.prefix,
					css			: stylesheets[s1][1],
					numicons	: icons.length,
					icons		: icons,
					nav			: [],
					date		: (new Date()).toGMTString(),
					loader		: loader,
					dims		: dims
				};
				
				for (var s2 in stylesheets) {
					var dest2	= (stylesheets[s2][1] ? path.basename(stylesheets[s2][1], '.css') : that.css) + '-preview.html';
					data.nav.push({
						label	: stylesheets[s2][0],
						href	: dest2,
						current	: (s1 == s2)
					});
				}
				
				tasks[s1]		= task('preview.html', dest1, data);
			}
			
			async.parallel(tasks, function(error, result) {
				callback(error);
			});
    	});
		
	} else {
		callback(null);
	}
}

/**
 * Convert number of bytes into human readable format
 *
 * @param {Number} bytes     	Number of bytes to convert
 * @param {Number} precision 	Number of digits after the decimal separator
 * @return {String}
 */
function bytesToSize(bytes, precision) {  
    var kilobyte			= 1024,
    megabyte				= kilobyte * 1024,
    gigabyte				= megabyte * 1024,
    terabyte				= gigabyte * 1024;
   
    if ((bytes >= 0) && (bytes < kilobyte)) {
        return bytes + ' B';
 
    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed(precision) + ' KB';
 
    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed(precision) + ' MB';
 
    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed(precision) + ' GB';
 
    } else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed(precision) + ' TB';
 
    } else {
        return bytes + ' B';
    }
}

/**
 * Create a CSS icon kit from pre-processed SVG icons
 * 
 * @param {String} inputDir			Input directory
 * @param {String} outputDir		Output directory
 * @param {Object} options			Options
 * @param {Function} callback		Callback
 * @return {Object}
 */
function createIconKit(inputDir, outputDir, options, callback) {
	
	// Check arguments
	if (arguments.length != 4) {
		var error			= new Error('Please call svg-sprite.createSprite() with exactly 4 arguments');
		error.errno			= 1391852448;
		return error;
	}
	
	// Keep the intermediate files
	options				= _.extend({}, defaultOptions, options || {});
	options.verbose		= Math.max(0, Math.min(3, parseInt(options.verbose, 10) || 0));
	
	// Temporarily alter the configuration options to keep intermediate files and suppress all output rendering
	options._keep		= options.keep;
	options.keep		= 1;
	options._render		= _.extend({css: true}, options.render);
	options.render		= {css: false};
	
	// Create the SVG sprite
	var sprite			= SVGSprite.createSprite(inputDir, outputDir, options, function(error, results) {
		
		// Restore configuration options
		results.options	= restoreOptions(results.options);
		
		// If an error occured while creating the SVG sprite: Abort
		if (error) {
			callback(error, results);
			
		// Else: Create icon kit
		} else {
			new Iconizr(results).createIconKit(callback);
		}
	});
	
	// In case of an error: Return it
	if (util.isError(sprite)) {
		return sprite;
	}
}

module.exports.createIconKit = createIconKit;