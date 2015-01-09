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
			dest							: '.',
			scale							: 1,
			optimize						: {
				level						: 3,
				quantize					: true,
				debug						: false
			}
		},
		limit								: {
			svg								: 1048576,
			fallback						: 32768
		}
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
	this.icons.limit.svg					= parseInt(this.icons.limit.svg || 0, 10);
	this.icons.limit.fallback				= parseInt(this.icons.limit.fallback || 0, 10);
	this.icons.mode							= 'view';
	
	// Ensure at least one render type is enabled
	if (!_.reduce(this.icons.render, function(result, render, type){
		return result || _.isPlainObject(render) || (render === true);
	}, false)) {
		this.icons.render.css				= true;
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