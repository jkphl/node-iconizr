'use strict';

/**
 * iconizr is a Node.js module for creating SVG icon systems with PNG fallbacks
 *
 * @see https://github.com/jkphl/iconizr
 *
 * @author Joschi Kuphal <joschi@kuphal.net> (https://github.com/jkphl)
 * @copyright © 2015 Joschi Kuphal
 * @license MIT https://raw.github.com/jkphl/iconizr/master/LICENSE.txt
 */

var CONFIG					= require('./iconizr/config'),
	FALLBACK				= require('./iconizr/fallback'),
	_						= require('lodash'),
	path					= require('path'),
	fs						= require('fs'),
	File					= require('vinyl'),
	events					= require('events'),
	async					= require('async'),
	os 						= require('os'),
	util					= require('util'),
	mustache				= require('mustache'),
	uglify					= require('uglify-js'),
	prettysize				= require('prettysize'),
	SVGSpriter				= require('svg-sprite'),
	crypto					= require('crypto');

/**
 * Convert a string into a proper object key
 * 
 * @param {String} str					String
 * @return {String}						object key
 */
function objectKey(str) {
	return str.replace(/[\.\-]+[a-z\d]/gi, function(s){ return s.substr(1).toUpperCase(); });
}

/**
 * Iconizr class
 * 
 * @param {Object} config				Configuration
 */
function Iconizr(config) {
	this.config				= new CONFIG(config);
	this.config.log.extend(this);
	this.tempShapes			= !('shape' in config) || !config.shape.dest;
	this.key				= 'icons';
	
	config.log				= this.config.log;
	
	if (this.tempShapes) {
		config.shape		= _.merge({dest: '.'}, config.shape || {}); 
	}
	config.mode				= (!('mode' in config) || !_.isPlainObject(config.mode)) ? {} : config.mode;
	while(this.key in config.mode) {
		this.key			+= '_';
	}
	config.mode[this.key]	= _.merge({}, this.config.icons);
	delete config.mode[this.key].render;
	delete config.mode[this.key].example;
	delete config.icons;
	
	this._spriter			= new SVGSpriter(config);
	this.add				= this._spriter.add.bind(this._spriter);
	this.getShapes			= this._spriter.getShapes.bind(this._spriter);
	
	this.info('Created iconizr instance');
}

/**
 * Compile the sprite & additional resources
 * 
 * @param {Object} config				Configuration
 * @param {Function} cb					Callback
 */
Iconizr.prototype.compile = function() {
	var args				= _.toArray(arguments),
	config					= _.isPlainObject(args[0]) ? args.shift() : null,
	cb						= _.isFunction(args[0]) ? args.shift() : function(error){ throw error; },
	spriterArguments		= [],
	that					= this;
	
	// Pass-through the configuration
	if (config !== null) {
		spriterArguments.push(config);
	}
	
	// Wrap the callback
	spriterArguments.push(function(error, result, data) {
		if (error) {
			return cb(error, null, null);
		}

		// Process the created files
		that._process(result, data, cb);
	});
	
	this._spriter.compile.apply(this._spriter, spriterArguments);
}

/**
 * Process the optimized SVG files and sprite
 * 
 * @param {Object} files				Result files
 * @param {Object} data					Templating data
 * @param {Function} callback			Callback
 */
Iconizr.prototype._process = function(files, data, callback) {
	var that				= this;
	
	async.waterfall([
		
		// Create PNG fallback images
		that._createPngFallbacks.bind(that, files, data),
		
		// Optimize the PNG fallback images
		that._optimizePngFallbacks.bind(that),
		
		// Create dataURIs of all single images (SVG and PNG)
		that._buildDataUrisAndPaths.bind(that),
		
		// Create the different stylesheet resources
		that._buildStylesheetResources.bind(that),
		
		// Create loader script / fragment
		that._buildLoaderResource.bind(that),
		
		// Create loader script / fragment
		that._buildHTMLPreview.bind(that)
		
	], function(error, files, data){
	
		// Remove temporary results
		if (that.tempShapes) {
			delete files.shapes;
			delete files.fallbackShapes;
		}
		
		callback(null, files, data);
	});
}

/**
 * Create PNG fallback images of all SVG files including the view sprite
 * 
 * @param {Object} files		Files
 * @param {Object} data			Templating data
 * @param {Function} callback	Callback
 */
Iconizr.prototype._createPngFallbacks = function(files, data, callback) {
	this.info('Creating PNG fallbacks');
	
	// Create tasks for all SVG files including the sprite
	var that					= this,
	tasks						= [this._createPngFallback.bind(this, files[that.key].sprite, data[that.key].spriteWidth, data[that.key].spriteHeight)].concat(files.shapes.map(function(svg, index){
		return this._createPngFallback.bind(this, svg, data[that.key].shapes[index].width.outer, data[that.key].shapes[index].height.outer);
	}, this));
	
	// Create PNG fallback images
	async.parallelLimit(tasks, os.cpus().length * 2, function(error, fallbacks) {
		if (error) {
			that.error(error);
			return callback(error, files, data);
		}
		files.fallbackShapes	= fallbacks;
		callback(error, files, data);		
	});
}

/**
 * Create a PNG fallback of an SVG file
 * 
 * @param {File} file			SVG file vinyl object
 * @param {Number} width		File width
 * @param {Number} height		File height
 * @param {Function} callback	Callback
 */
Iconizr.prototype._createPngFallback = function(file, width, height, callback) {
	FALLBACK(file, width, height, this.config.icons.fallback.scale, callback);
}

/**
 * Optimize PNG fallback images
 * 
 * @param {Object} files		Files
 * @param {Object} data			Templating data
 * @param {Function} callback	Callback
 */
Iconizr.prototype._optimizePngFallbacks = function(files, data, callback) {
	this.info('Optimizing PNG fallbacks');
	
	var that					= this;
	
	// Optimize PNG fallback images
	async.parallelLimit(files.fallbackShapes.map(function(fallback) {
		return fallback.optimize.bind(fallback, that, that.config.icons.fallback.optimize);
	}), os.cpus().length * 2, function(error) {
		files[that.key].fallbackSprite = files.fallbackShapes.shift();
		callback(error, files, data);
	});
}

/**
 * Build dataURIs and single file paths for all shapes (SVG and PNG)
 * 
 * @param {Object} files		Files
 * @param {Object} data			Templating data
 * @param {Function} callback	Callback
 */
Iconizr.prototype._buildDataUrisAndPaths = function(files, data, callback) {
	this.info('Building dataURIs');
	
	var that					= this;
	
	// Run through all templating shapes
	data[this.key].shapes.map(function(shape, index){
		var fallbackShape		= this[index];
		
		// Add SVG sprite path getter
		shape.__defineGetter__('svgSprite', function() {
			return data[that.key].sprite;
		});
		
		// Add SVG dataURI getter
		shape.__defineGetter__('svgDataUri', function() {
			var svg				= files.shapes[index].contents.toString(),
			root				= svg.match(/\<svg /i);
			svg					= _.isArray(root) ? svg.substr(root.index) : svg;
			return 'data:image/svg+xml,' + encodeURIComponent(svg);
		});
		
		// Add SVG file path getter
		shape.__defineGetter__('svgImage', function() {
			return path.relative(that.config.dest, files.shapes[index].path);
		});
		
		// Add PNG sprite path getter
		shape.__defineGetter__('fallbackSprite', function() {
			return path.relative(that.config.dest, files[that.key].fallbackSprite.path);
		});
		
		// Add PNG dataUri getter
		shape.__defineGetter__('fallbackDataUri', function() {
			return 'data:image/png;base64,' + fallbackShape.contents.toString('base64');
		});
		
		// Add PNG file path getter
		shape.__defineGetter__('fallbackImage', function() {
			return path.relative(that.config.dest, fallbackShape.path);
		});
		
	}, files.fallbackShapes);
	
	data.strategy				= 'invalid-strategy';
	data.exceed					= {
		svg						: _.reduce(_.pluck(data[this.key].shapes, 'svgDataUri'), function(max, dataUri){
									return Math.max(max, dataUri.length);
								}, 0) > this.config.icons.threshold.svg, 
		fallback				: _.reduce(_.pluck(data[this.key].shapes, 'fallbackDataUri'), function(max, dataUri){
									return Math.max(max, dataUri.length);
								}, 0) > this.config.icons.threshold.fallback
	}
	
	if (data.exceed.svg) {
		this.debug('At least one SVG file exceeds the file size limit of %s, enforcing sprite mode', prettysize(this.config.icons.threshold.svg));
	}
	if (data.exceed.png) {
		this.debug('At least one PNG file exceeds the file size limit of %s, enforcing sprite mode', prettysize(this.config.icons.threshold.png));
	}
	callback(null, files, data);
}

/**
 * Build the CSS stylesheet resources in the configured format(s)
 * 
 * @param {Object} files		Files
 * @param {Object} data			Templating data
 * @param {Function} callback	Callback
 */
Iconizr.prototype._buildStylesheetResources = function(files, data, callback) {
	this.info('Building stylesheet resources');
	
	var that							= this;
	this._buildStylesheetResourcePayloads(this.config.icons.render, data, files[this.key].fallbackSprite.path, function(error, resources) {
		if (!error) {
			resources.forEach(function(resource) {
				files[that.key][objectKey(resource[1] + '-' + resource[2])] = resource[0];
				that._spriter.verbose("Created a «%s» strategy «%s» stylesheet resource", resource[1], resource[2]);
			});
		}
		callback(error, files, data);
	});
}

/**
 * Building the CSS stylesheet resource payloads
 * 
 * @param {Object} config		Rendering configuration
 * @param {Object} data			Templating data
 * @param {String} fallback		Fallback sprite path
 * @param {Function} callback	Callback
 */
Iconizr.prototype._buildStylesheetResourcePayloads = function(config, data, fallback, callback) {
	var that							= this,
	tasks								= [],
	cssDest								= (config.css ? config.css.dest : '') || path.resolve(this.config.dest, this.config.icons.dest),
	strategyList						= {
		'svg-data-uri'					: 'svgDataUri',
		'svg-sprite'					: 'svgSprite',
		'svg-image'						: 'svgImage',
		'fallback-data-uri'				: 'fallbackDataUri',
		'fallback-sprite'				: 'fallbackSprite',
		'fallback-image'				: 'fallbackImage'
	},
	sprites								= {
		'fallback-sprite'				: fallback,
		'svg-sprite'					: path.resolve(this.config.dest, this.config[this.key].dest, data[that.key].sprite)
	};
	
	if (this.tempShapes) {
		delete strategyList['svg-image'];
		delete strategyList['fallback-image'];
	}
	
	// Run through all render configurations
	for (var extension in config) {
		var template					= fs.readFileSync(config[extension].template, 'utf-8'),
		prefix							= path.basename(config[extension].dest, path.extname(config[extension].dest)),
		dest							= path.resolve(this.config.dest, path.join(path.dirname(config[extension].dest), prefix)),
		bust							= (extension == 'css') && that.config.icons.bust;

		// Run through all render strageties
		for (var strategy in strategyList) {
			
			// Register a rendering task
			tasks.push(function(extension, template, prefix, dest, strategy, bust){
				var localDest			= dest + '.' + strategy + (bust ? '%s' : '') + '.' + extension,
				isDataUri				= strategy.indexOf('-data-uri') > 0,
				localData				= _.clone(data[that.key]);
				localData.strategy		= strategy;
				localData.sprite		= (strategy == 'fallback-sprite') ? path.relative(that.config.dest, fallback) : ((strategy == 'svg-sprite') ? data[that.key].sprite : null)
				localData.common		= localData.sprite ? localData.common : null;
				localData.icon			= function(content, context) {
					var icon			= this[strategyList[strategy]];
					return isDataUri ? ('"' + icon + '"') : icon;
			    }

			    return function(_cb) {
					var out				= mustache.render(template, localData),
					file				= out.length ? new File({
						base			: that._spriter.config.dest,
						path			: bust ? that._addCacheBustingHash(localDest, out) : localDest,
						contents		: new Buffer(out)
					}) : null;
					_cb(null, file, strategy, extension);
				}
			}(extension, template, prefix, dest, strategy, bust));
		}
	}
	
	// Render the stylesheet resources
	async.parallelLimit(tasks, os.cpus().length * 2, function(error, resources) {
		callback(error, resources);
	});
}

/**
 * Build the JavaScript loader resource / HTML loader fragment
 * 
 * @param {Object} files		Files
 * @param {Object} data			Templating data
 * @param {Function} callback	Callback
 */
Iconizr.prototype._buildLoaderResource = function(files, data, callback) {
	
	// If at least one output format has been rendered
	if (_.size(this.config.icons.render)) {
		this.info('Building loader resource');
		
		var loader						= this._buildLoaderResourcePayload(this._spriter.config.dest, files, this.config.icons.loader, data.exceed);
		if (loader) {
			files[this.key].loader		= loader;
			this._spriter.verbose((this.config.icons.loader.type == 'js') ? "Created loader JavaScript «%s»" : "Created HTML loader fragment «%s»", path.basename(this.config.icons.loader.dest));
		}
	}
	
	callback(null, files, data);
}

/**
 * Create the loader resource payload
 * 
 * @param {String} dest			Main destination directory
 * @param {Object} files		Files
 * @param {Object} config		Loader resource configuration
 * @param {Object} exceed		DataURI limit excessions 
 * @return {String}				Loader resource payload (JavaScript or HTML)
 */
Iconizr.prototype._buildLoaderResourcePayload = function(dest, files, config, exceed) {
	var data						= {
		'fallback-sprite'			: files[this.key].fallbackSpriteCss ? path.basename(files[this.key].fallbackSpriteCss.path) : util.format(config.css, 'fallback-sprite'),
		'fallback-data-uri'			: files[this.key][exceed.fallback ? 'fallbackSpriteCss' : 'fallbackDataUriCss'] ? path.basename(files[this.key][exceed.fallback ? 'fallbackSpriteCss' : 'fallbackDataUriCss'].path) : util.format(config.css, exceed.fallback ? 'fallback-sprite' : 'fallback-data-uri'),
		'svg-sprite'				: files[this.key].svgSpriteCss ? path.basename(files[this.key].svgSpriteCss.path) : util.format(config.css, 'svg-sprite'),
		'svg-data-uri'				: files[this.key][exceed.svg ? 'svgSpriteCss' : 'svgDataUriCss'] ? path.basename(files[this.key][exceed.svg ? 'svgSpriteCss' : 'svgDataUriCss'].path) : util.format(config.css, exceed.svg ? 'svg-sprite' : 'svg-data-uri'),
		'embed'						: config.embed
	},
	payload							= mustache.render(fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', 'loader.js'), 'utf-8'), data);
	
	// Optionally minify script payload
	if (config.minify) {
		payload						= uglify.minify(payload, {fromString: true}).code;
	}
	
	// If a HTML loader fragment is to be created
	if (config.type === 'html') {
		data.script					= payload;
		payload						= mustache.render(fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', 'loader.html'), 'utf-8'), data);
	}
	
	return payload.length ? new File({
		base						: dest,
		path						: config.dest,
		contents					: new Buffer(payload)
	}) : null;
}

/**
 * Build the HTML example document (if configured)
 * 
 * @param {Object} files		Files
 * @param {Object} data			Templating data
 * @param {Function} callback	Callback
 */
Iconizr.prototype._buildHTMLPreview = function(files, data, callback) {
	
	// If preview documents should be rendered
	if (this.config.icons.preview) {
		this.info('Building HTML preview');
		
		var that					= this,
		tasks						= {},
		embed						= path.relative(this.config.icons.preview, path.dirname(path.resolve(this.config.dest, this.config.icons.render.css.dest))),
		css							= this.config.icons.render.css.dest.replace(/\./, '.%s.'),
		stylesheets					= {
			'auto'					: ['Automatic detection'	, ''],
			'fallback-image'		: ['Fallback images'		, path.join(embed, files[this.key].fallbackImageCss ? path.basename(files[this.key].fallbackImageCss.path) : util.format(css, 'fallback-image'))],
			'fallback-sprite'		: ['Fallback sprite'		, path.join(embed, files[this.key].fallbackSpriteCss ? path.basename(files[this.key].fallbackSpriteCss.path) : util.format(css, 'fallback-sprite'))],
			'fallback-data-uri'		: ['Fallback data URIs'		, path.join(embed, files[this.key][data.exceed.fallback ? 'fallbackSpriteCss' : 'fallbackDataUriCss'] ? path.basename(files[this.key][data.exceed.fallback ? 'fallbackSpriteCss' : 'fallbackDataUriCss'].path) : util.format(css, 'fallback-data-uri'))],
			'svg-image'				: ['SVG images'				, path.join(embed, files[this.key].svgImageCss ? path.basename(files[this.key].svgImageCss.path) : util.format(css, 'svg-image'))],
			'svg-sprite'			: ['SVG sprite'				, path.join(embed, files[this.key].svgSpriteCss ? path.basename(files[this.key].svgSpriteCss.path) : util.format(css, 'svg-sprite'))],
			'svg-data-uri'			: ['SVG data URIs'			, path.join(embed, files[this.key][data.exceed.svg ? 'svgSpriteCss' : 'svgDataUriCss'] ? path.basename(files[this.key][data.exceed.svg ? 'svgSpriteCss' : 'svgDataUriCss'].path) : util.format(css, 'svg-data-uri'))]
		},
		previewTemplate				= fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', 'preview.html'), 'utf-8'),
		loader						= this._buildLoaderResourcePayload(this._spriter.config.dest, files, {
			type					: 'html',
			dest					: path.join(this.config.icons.preview, 'icons-loader.html'),
			minify					: true,
			embed					: embed + '/',
			css						: css
		}, {svg: false, png: false}),
		task						= function(template, dest, data) {
			return function(_callback) {
				var out				= mustache.render(template, data),
				file				= out.length ? new File({
					base			: that._spriter.config.dest,
					path			: dest,
					contents		: new Buffer(out)
				}) : null;
				_callback(null, file);
			}
		},
		stylesheet					= function(s) {
			return path.basename(util.format(css, s + '-preview.html'), '.css');
		};

		if (this.tempShapes) {
			delete stylesheets['fallback-image'];
			delete stylesheets['svg-image'];
		}

		// Render the dimension stylesheet
		var dims					= util.format(css, 'dimensions');
		tasks['dimensions']			= task(fs.readFileSync(path.join(path.dirname(__dirname), 'tmpl', 'dimensions.css'), 'utf-8'), path.join(this.config.icons.preview, dims), data.icons);
		
		// Run through all stylesheets
		for (var s1 in stylesheets) {
			var dest1				= path.normalize(path.join(this.config.icons.preview, stylesheet(s1))),
			localData					= {
				css					: stylesheets[s1][1],
				numicons			: data.icons.shapes.length,
				icons				: data.icons.shapes,
				nav					: [],
				date				: (new Date()).toGMTString(),
				loader				: loader ? loader.contents.toString() : '',
				dims				: dims,
				classname           : function() {
			        return function(str, render) {
			        	var classname			= render(str).replace(/\s+/g, ' ').split(' ').pop();
			        	return (classname.indexOf('.') === 0) ? classname.substr(1) : '';
			        }
			    }
			};
			
			for (var s2 in stylesheets) {
				localData.nav.push({
					label			: stylesheets[s2][0],
					href			: stylesheet(s2),
					current			: (s1 == s2)
				});
			}
			
			tasks[s1]				= task(previewTemplate, dest1, localData);
		}
		
		// Render the stylesheet resources
		async.parallelLimit(tasks, os.cpus().length * 2, function(error, resources) {
			for (var resource in resources) {
				files[that.key][objectKey(resource + '-preview')] = resources[resource];
			}
			callback(null, files, data);
		});
	} else {
		callback(null, files, data);
	}
}

/**
 * Add a cache busting hash to a file name
 * 
 * @param {String} filename			File name
 * @param {String} contents			File contents
 * @return {String}					File name with cache busting hash
 */
Iconizr.prototype._addCacheBustingHash = function(filename, contents) {
	var hash						= '-' + crypto.createHash('md5')
									.update(contents, 'utf8')
									.digest('hex')
									.substr(0, 8);
	return util.format(filename, hash);
}

/**
 * Module export (constructor wrapper)
 * 
 * @param {Object} config		Configuration
 * @return {Iconizr}			Iconizr instance
 */
module.exports = function(config) {
	return new Iconizr(config || {});
}