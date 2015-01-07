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

var _									= require('lodash'),
	path								= require('path'),
	winston								= require('winston'),
	defaultIconsConfig					= {
		fallback						: {
			dest						: '.',
			scale						: 1
		}
	};

/**
 * Iconizr configuration
 * 
 * @param {Object} config				Configuration
 */
function IconizrConfig(config) {	
	
	// Logging
	this.log							= '';
	if ('log' in config) {
		if (config.log instanceof winston.Logger) {
			this.log					= config.log;
		} else {
			this.log					= (_.isString(config.log) && (['info', 'verbose', 'debug'].indexOf(config.log) >= 0)) ? config.log : 'info';
		}
	}
	if (_.isString(this.log)) {
		var twoDigits					= function(i) {
			return ('0' + i).slice(-2);
		};
		this.log						= new winston.Logger({
			transports					: [new (winston.transports.Console)({
				level					: this.log || 'info',
				silent					: !this.log.length,
				colorize				: true,
				prettyPrint				: true,
				timestamp				: function() {
					var now				= new Date();
					return now.getFullYear() + '-' + twoDigits(now.getMonth()) + '-' + twoDigits(now.getDate()) + ' ' + twoDigits(now.getHours()) + ':' + twoDigits(now.getMinutes()) + ':' + twoDigits(now.getSeconds());
				}
			})]
		});
	}
	
	this.log.debug('Started logging');

	this.dest							= path.resolve(config.dest || '.');
	
	this.log.debug('Prepared general options');
	
	this.variables						= _.extend({}, config.variables);
	
	this.log.debug('Prepared `variables` options');	
	
	this.icons							= _.clone(defaultIconsConfig);
	this.icons							= ('icons' in config) ? _.assign(this.icons, config.icons || {}) : this.icons;
	this.icons.fallback.scale			= Math.max(1.0, parseFloat(this.icons.fallback.scale || 1, 10));
	
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