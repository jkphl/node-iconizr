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

var _										= require('lodash'),
	path									= require('path'),
	winston									= require('winston'),
	defaultIconsConfig						= {
		dest								: '.',
        layout								: 'packed',
        common								: null,
        prefix								: 'icon-%s',
        dimensions							: '-dims',
        sprite								: 'icons/icons.svg',
        bust								: true,
        render								: {},
		fallback							: {
			scale							: 1,
			optimize						: {
				level						: 3,
				quantize					: true,
				debug						: false
			}
		},
		threshold							: {
			svg								: 1048576,
			fallback						: 32768
		},
		loader								: {
			type							: 'html',
			dest							: 'icons-loader.html',
			minify							: true,
			embed							: null,
			css								: ''
		},
		preview								: false
	};

/**
 * Iconizr configuration
 * 
 * @param {Object} config				Configuration
 */
function IconizrConfig(config) {	
	
	// Logging
	this.log								= '';
	if ('log' in config) {
		if (config.log instanceof winston.Logger) {
			this.log						= config.log;
		} else {
			this.log						= (_.isString(config.log) && (['info', 'verbose', 'debug'].indexOf(config.log) >= 0)) ? config.log : 'info';
		}
	}
	if (_.isString(this.log)) {
		var twoDigits						= function(i) {
			return ('0' + i).slice(-2);
		};
		this.log							= new winston.Logger({
			transports						: [new (winston.transports.Console)({
				level						: this.log || 'info',
				silent						: !this.log.length,
				colorize					: true,
				prettyPrint					: true,
				timestamp					: function() {
					var now					= new Date();
					return now.getFullYear() + '-' + twoDigits(now.getMonth()) + '-' + twoDigits(now.getDate()) + ' ' + twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()) + ':' + twoDigits(now.getSeconds());
				}
			})]
		});
	}
	
	this.log.debug('Started logging');

	this.dest								= path.resolve(config.dest || '.');
	
	this.log.debug('Prepared general options');
	
	this.variables							= _.extend({}, config.variables);
	
	this.log.debug('Prepared `variables` options');	
	
	this.icons								= _.clone(defaultIconsConfig);
	this.icons								= ('icons' in config) ? _.merge(this.icons, config.icons || {}) : this.icons;
	this.icons.fallback.scale				= Math.max(1.0, parseFloat(this.icons.fallback.scale || 1, 10));
	this.icons.fallback.optimize			= {
		level								: Math.max(0, Math.min(11, Math.abs(parseInt(this.icons.fallback.optimize.level, 10)))) - 1,
		quantize							: !!this.icons.fallback.optimize.quantize,
		debug								: !!this.icons.fallback.optimize.debug
	};
	this.icons.fallback.optimize.optimize	= this.icons.fallback.optimize.level > 0;
	this.icons.fallback.optimize.speed		= this.icons.fallback.optimize.optimize ? (Math.round(10 - (9 * this.icons.fallback.optimize.level / 10))) : 0;
	this.icons.fallback.optimize.level		= this.icons.fallback.optimize.optimize ? Math.round(this.icons.fallback.optimize.level * 7 / 10) : 0;
	this.icons.threshold.svg				= parseInt(this.icons.threshold.svg || 0, 10);
	this.icons.threshold.fallback			= parseInt(this.icons.threshold.fallback || 0, 10);
	this.icons.loader.type					= ('' + this.icons.loader.type).trim().toLowerCase();
	this.icons.loader.type					= (['html', 'js'].indexOf(this.icons.loader.type) >= 0) ? this.icons.loader.type : defaultIconsConfig.loader.type;
	this.icons.loader.dest					= path.resolve(this.dest, this.icons.loader.dest.trim() || defaultIconsConfig.loader.dest);
	this.icons.loader.dest					= path.join(path.dirname(this.icons.loader.dest), path.basename(this.icons.loader.dest, path.extname(this.icons.loader.dest)) + '.' + this.icons.loader.type);
	this.icons.loader.minify				= !!this.icons.loader.minify;
	this.icons.loader.embed					= _.isString(this.icons.loader.embed) ? (this.icons.loader.embed.trim() || '.') : this.icons.loader.embed;
	this.icons.loader.embed					= path.normalize((function(str){ while(str.slice(-1) == '/'){ str = str.slice(0, -1); }; return str; })(this.icons.loader.embed || ('/' + path.relative(process.cwd(), this.dest))) + '/');
	this.icons.loader.css					= _.isString(this.icons.loader.css) ? this.icons.loader.css.trim() : '';
	this.icons.preview						= _.isString(this.icons.preview) ? this.icons.preview.trim() : '';
	this.icons.preview						= this.icons.preview.length ? path.resolve(this.dest, this.icons.preview) : false;
	this.icons.mode							= 'view';
	
	// Ensure at least one render type is enabled
	if (!_.reduce(this.icons.render, function(result, render, type){
		return result || _.isPlainObject(render) || (render === true);
	}, false)) {
		this.icons.render.css				= true;
	}
	
	// If preview documents are to be rendered, but the CSS render type isn't active
	if (this.icons.preview && (!('css' in this.icons.render) || !this.icons.render.css)) {
		this.icons.render.css				= {
			dest							: path.join(this.icons.preview, 'icons.css')
		};
	}
	
	// Prepare the rendering configuration
	for (var extension in this.icons.render) {
		var renderConfig					= {
			template						: path.resolve(path.dirname(path.dirname(__dirname)), path.join('tmpl', 'icons.' + extension)),
			dest							: path.join(this.icons.dest, 'icons.' + extension)
		};
		if (_.isObject(this.icons.render[extension])) {
			if ('template' in this.icons.render[extension]) {
				renderConfig.template		= path.resolve(this.icons.render[extension].template);
			}
			if ('dest' in this.icons.render[extension]) {
				renderConfig.dest			= path.resolve(this.dest, this.icons.render[extension].dest);
			}
		} else if (this.icons.render[extension] !== true) {
			continue;
		}
		this.icons.render[extension]		= renderConfig;
	}
	
	// Extract the CSS destination file name template
	if (!this.icons.loader.css.length) {
		this.icons.loader.css				= ('css' in this.icons.render) ? (path.basename(this.icons.render.css.dest, path.extname(this.icons.render.css.dest)) + '.%s.css') : 'icon.%s.css';
	}
	
	// Sanitize the CSS destination file name template
	if (this.icons.loader.css.indexOf('%s') < 0) {
		var css								= this.icons.loader.css.split('.');
		this.icons.loader.css				= css.shift() + '.%s.' + (css.length ? css.join('.') : 'css');
	}
	
	this.log.debug('Prepared `icons` options');

	this.log.verbose('Initialized iconizr configuration');
}

/**
 * Module export (constructor wrapper)
 * 
 * @param {Object} config				Configuration
 * @return {IconizrConfig}				Iconizr configuration
 */
module.exports = function(config) {
	return new IconizrConfig(config || {});
}