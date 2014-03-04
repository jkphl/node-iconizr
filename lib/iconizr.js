"use strict";

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
mu				= require('mu2'),
UglifyJS		= require('uglify-js'),
mkdirp			= require('mkdirp'),
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
	embed		: '.',
	svg			: 1048576,
	png			: 32768,
	preview		: null
};
 
/**
 * Create a CSS icon kit from pre-processed SVG icons
 * 
 * @param {Object} result			Pre-processing results
 * @return {Object}
 */
function Iconizr(result) {
	this._options				= _.extend(defaultOptions, result.options);
	this._options.quantize		= !!this._options.quantize;
	this._options.level			= Math.max(0, Math.min(11, Math.abs(parseInt(this._options.level, 10)))) - 1;
	this._options.optimize		= this._options.level > 0;
	this._options.speed			= this._options.optimize ? Math.round(10 - (9 * this._options.level / 10)) : 0;
	this._options.optimization	= this._options.optimize ? Math.round(this._options.level * 7 / 10) : 0;
	this._options.svg			= Math.max(1024, parseInt(this._options.svg, 10));
	this._options.png			= Math.max(1024, parseInt(this._options.png, 10));
	this._options.preview		= this._options.preview || null;
	this._options.embed			= this._options.embed || '.';
	
	this.result					= result;
	this.result.data.exceed		= {svg: false, png: false};
	this._options.iconDir		= path.resolve(this._options.outputDir, this._options.spritedir);
	
	// Determine the sprite files
	this.sprite					= {
		svg						: path.resolve(this._options.outputDir, this.result.data.sprite),
		png						: path.join(this._options.iconDir, path.basename(this.result.data.sprite, '.svg') + '.png')
	};
	
	// Prepare the CSS file list
	this.css					= this._options.prefix;
	
	// Collect all single files
	this.icons					= {svg: [], png: []};
	for (var s = 0, icon; s < this.result.data.svg.length; ++s) {
		icon					= path.join(this._options.iconDir, this.result.data.svg[s].name);
		try {
			if (fs.statSync(icon + '.svg').isFile()) {
				this.icons.svg.push(icon + '.svg');
				this.icons.png.push(icon + '.png');
			}
		} catch(e) {}
	}
}

/**
 * Create an the icon kit
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype.createIconKit = function(callback) {
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
	    	that._renderPreviewHTML(loader, _callback);
	    }
	    
	], callback);
}

/**
 * Create PNG versions of all involved SVG files
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._svg2png = function(callback) {
	var that					= this,
	tasks						= [function(_callback) {
		if (that._options.verbose > 1) {
			console.log('Building PNG sprite from "%s" ...', that.sprite.svg);
		}
		svg2png(that.sprite.svg, that.sprite.png, function(err) {
			_callback(err);
		});
	}];
	for (var s = 0; s < this.icons.svg.length; ++s) {
		tasks.push(function(svg, png) { return function(_callback) {
			if (that._options.verbose > 1) {
				console.log('Building PNG icon from "%s" ...', svg);
			}
			svg2png(svg, png, function(err) {
    			_callback(err);
			});
		}}(this.icons.svg[s], this.icons.png[s]));
	}
	if (this._options.verbose == 1) {
		console.log('Building PNG versions %s SVG icon(s) ...', tasks.length);	
	}
	async.parallel(tasks, function(err) { callback(err); });
}

/**
 * Optimize all PNG icons
 * 
 * @param {Function} callback		Callback
 * @return {void}
 */
Iconizr.prototype._optimizePngs = function(callback) {
	var that					= this,
	tasks						= [function(_callback) {
		if (that._options.verbose > 1) {
			console.log('Optimizing PNG sprite "%s" ...', that.sprite.png);
		}
		that._optimizePng(that.sprite.png, _callback);
	}];
	for (var s = 0; s < this.icons.svg.length; ++s) {
		tasks.push(function(png) { return function(_callback) {
			if (that._options.verbose > 1) {
				console.log('Optimizing PNG icon "%s" ...', png);
			}
			that._optimizePng(png, _callback);
		}}(this.icons.png[s]));
	}
	if (this._options.verbose == 1) {
		console.log('Optimizing %s PNG icon(s) ...', tasks.length);	
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
			callback(error);
			return;
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
	this._options.render			= this._options._render;
	delete this._options._render;
	
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
	if (this._options.verbose > 0) {
		console.log('Creating the stylesheet loader fragment ...');
	}
	
	var that			= this,
	dest				= path.join(this._options.outputDir, this.css + '-loader-fragment.html'),
	embed				= path.normalize(this._options.embed),
	data				= {
		'png-sprite'	: this.css + '-png-sprite.css',
		'png-data'		: this.css + '-png-data.css',
		'svg-sprite'	: this.css + '-svg-sprite.css',
		'svg-data'		: this.css + '-svg-data.css'
	},
	script				= '';
	embed				= (!embed || (embed == '.')) ? '' : (embed + '/');
	
	mu.root				= path.join(path.dirname(__dirname), 'tmpl');
	mu.compileAndRender('loader.js', data)
		.on('data', function (d) {
			script		+= d.toString();
		})
		.on('error', function(error) {
			callback(error, '');
		})
		.on('end', function(error) {
			if (error) {
				callback(error, '');
			} else {
				data.script								= UglifyJS.minify(script, {fromString: true}).code;
				script									= '';
				that.result.files[dest]					= 0;
				try {
					fs.truncateSync(dest);
				} catch(e) {}
				
				mu.compileAndRender('loader.html', data)
					.on('data', function (d) {
						try {
							var out						= d.toString();
							script						+= out;
							out							= out.split('##embed##').join(embed);
							fs.appendFileSync(dest, out);
							that.result.files[dest]		+= out.length;
						} catch(e) {}
					})
					.on('error', function(error) {
						callback(error, '');
					})
					.on('end', function(error) {
						if (that.result.files[dest]) {
							++that.result.length;
						}
						callback(error, script);
					});
			}
		});
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
			};
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
					loader		: loader
				};
				
				for (var s2 in stylesheets) {
					var dest2	= (stylesheets[s2][1] ? path.basename(stylesheets[s2][1], '.css') : that.css) + '-preview.html';
					data.nav.push({
						label	: stylesheets[s2][0],
						href	: dest2,
						current	: (s1 == s2)
					});
				}
				
				tasks[s1]		= (function(dest, data) {
					return function(_callback) {
						that.result.files[dest]					= 0;
						try {
							fs.truncateSync(dest);
						} catch(e) {}
						mu.compileAndRender('preview.html', data)
							.on('data', function (d) {
								try {
									var out						= d.toString();
									fs.appendFileSync(dest, out);
									that.result.files[dest]	+= out.length;
								} catch(e) {}
							})
							.on('error', _callback)
							.on('end', function(error) {
								if (that.result.files[dest]) {
									++that.result.length;
								}
								_callback(error);
							});
					}
				})(dest1, data);
			}
			
			mu.root				= path.join(path.dirname(__dirname), 'tmpl');
			async.parallel(tasks, function(error, result) {
				callback(error);
			});
    	});
		
	} else {
		callback(null);
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
	
	// Keep the intermediate files
	options				= _.extend(defaultOptions, options);
	options.verbose		= Math.max(0, Math.min(2, parseInt(options.verbose, 10) || 0));
	options._keep		= options.keep;
	options.keep		= 1;
	options._render		= _.extend({css: true}, options.render);
	options.render		= {css: false};
	
	// TODO
	options.dims		= 1;
	
	// Create the SVG sprite
	SVGSprite.createSprite(inputDir, outputDir, options, function(error, results) {
		if (error) {
			callback(error);
		} else {
//			callback(error);
			new Iconizr(results).createIconKit(callback);
		}
	});
}

module.exports.createIconKit = createIconKit;