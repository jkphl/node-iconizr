node-iconizr [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]  [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency Status][depstat-image]][depstat-url]
==========

This file is part of the documentation of *node-iconizr* — a free low-level Node.js module that **takes a bunch of SVG files**, optimizes them and creates a **CSS icon kit** including SVG and PNG sprites, stylesheet resources and a JavaScript loader. The package is [hosted on GitHub](https://github.com/jkphl/node-iconizr).


Configuration
-------------

*node-iconizr*'s **main configuration** is an `Object` with the following basic structure:

```javascript
{
	// Configuration properties common between svg-sprite and node-iconizr
	dest			: <String>,				// Main output directory
	log  			: <String|Logger>,		// Logging verbosity or custom logger
	shape			: <Object>,				// SVG shape configuration
	transform		: <Array>,				// SVG transformations
	svg				: <Object>,				// Common SVG properties
	variables		: <Object>,				// Custom templating variables
	
	// Icon specific configuration properties
	icons			: <Object>				// Icons & output related configuration
}
```

As *node-iconizr* has built-in defaults for all configuration properties, you may also pass an empty object `{}` to the [constructor](api.md#iconizr-config-) or even omit the configuration altogether.


Table of contents
-----------------

* [Basic properties](#basic-properties) (shared with [svg-sprite](https://github.com/jkphl/svg-sprite))
* [Icon properties](#icon-properties)
	* [Mode properties](#mode-properties)
	* [Fallback properties](#fallback-properties)
	* [Data URI thresholds](#data-uri-thresholds)
	* [JavaScript loader properties](#javascript-loader-properties)
	* [HTML preview](#html-preview)


### Basic properties

A lot of basic config properties are inherited from the underlying *svg-sprite* module. Please refer to the [svg-sprite configuration documentation](https://github.com/jkphl/svg-sprite/blob/master/docs/configuration.md) for details on these properties.

```javascript
// node-iconizr properties shared with svg-sprite

var config					= {
	
	// Properties inherited from svg-sprite
	dest					: '.',						// Main output directory
	log						: null,						// Logging verbosity (default: no logging)
	shape					: {							// SVG shape related properties
		id					: {							// SVG shape ID related properties
			separator		: '--',						// Separator for directory name traversal
			generator		: function() { /*...*/ },	// SVG shape ID generator callback
			pseudo			: '~'						// File name separator for shape states (e.g. ':hover')
		},
		dimension			: {							// Dimension related properties
			maxWidth		: 2000,						// Max. shape width
			maxHeight		: 2000,						// Max. shape height
			precision		: 2,						// Floating point precision
			attributes		: false,					// Width and height attributes on embedded shapes
		},
		spacing				: {							// Spacing related properties
			padding			: 0,						// Padding around all shapes
			box				: 'content'					// Padding strategy (similar to CSS `box-sizing`)
		},
		meta				: null,						// Path to YAML file with meta / accessibility data
		align				: null,						// Path to YAML file with extended alignment data
		dest				: null						// Output directory for optimized intermediate SVG shapes
	},
	transform				: ['svgo'],					// List of transformations / optimizations
	svg						: {							// General properties for created SVG files
		xmlDeclaration		: true,						// Add XML declaration to SVG sprite
		doctypeDeclaration	: true,						// Add DOCTYPE declaration to SVG sprite
		namespaceIDs		: true,						// Add namespace token to all IDs in SVG shapes
		dimensionAttributes	: true						// Width and height attributes on the sprite
	},
	variables				: {},						// Custom Mustache templating variables and functions
	
	// Icon related properties
	icons					: {
		/* ... */
	}
}
```

Although it's not really relevant for *node-iconizr*, you may also employ *svg-sprite*'s other [output modes](../README.md#leveraging-more-svg-sprite-features) to create further SVG sprites in addition to your CSS icon kit.

### Icon properties

```javascript
// node-iconizr icon properties and their default values

var config					= {
	// Common svg-sprite / node-iconizr properties
	/* ... */

	// Icon specific options
	icons					: {
		dest				: '.',						// Main icon output directory
        layout				: 'packed',					// Sprite layout
        common				: null,						// Common icon CSS class
        prefix				: '.icon-%s',				// CSS selector prefix
        dimensions			: '-dims',					// CSS dimension selector suffix
        sprite				: 'icons/icons.svg',		// SVG sprite path & name
        bust				: true,						// Whether to use cache busting
        render				: {},						// Format configurations for stylesheets
		fallback			: {							// Fallback related options
			scale			: 1,						// Zoom factor for PNG fallbacks
			optimize		: {							// PNG optimization related options
				level		: 3,						// Optimization level (0-11)
				quantize	: true,						// Whether to quantize fallback PNGs
				debug		: false						// Output opimization debug messages
			}
		},
		threshold			: {							// Data URI size limits
			svg				: 32768,					// SVG data URI size limits
			fallback		: 32768						// PNG data URI size limits
		},
		loader				: {							// JavaScript loader related options
			type			: 'html',					// Loader format (HTML fragment or JS only)
			dest			: 'icons-loader.html',		// Loader path and name
			minify			: true,						// Whether to minify the loader JS
			embed			: null,						// CSS embed path
			css				: ''						// CSS stylesheet file name pattern
		},
		preview				: false						// Directory for preview documents
	}
}
```

~~For getting off the ground quickly, you may also use the [online configurator & kickstarter](http://jkphl.github.io/node-iconizr), which lets you create a custom configuration in seconds~~ *[Not available yet]*.


#### Mode properties

Property         | Type            | Default       | Description                                |
---------------- | --------------- | ------------- | ------------------------------------------ |
`icons.dest`           | String          | `"."`       | Base directory for sprite and CSS file output. If not absolute, the path will be resolved using the main output directory (see global `dest` option). |
`icons.layout`         | String          | `"packed"`    | The arrangement of the shapes within the sprite. Might be `"vertical"`, `"horizontal"`, `"diagonal"` or `"packed"` (with the latter being the most compact type). It depends on your project which layout is best for you. |
`icons.common`         | String          |               | If given and not empty, this will be the selector name of a CSS rule commonly defining the `background-image` and `background-repeat` properties for all the shapes in the sprite (thus saving some bytes by not unnecessarily repeating them for each shape) |
`icons.prefix`         | String          | `".svg-%s"`    | Used for prefixing the [shape ID](#shape-ids) during CSS selector construction. If the value is empty, no prefix will be used. The prefix may contain the placeholder `"%s"` (e.g. `".svg %s-svg"`), which will then get replaced by the shape ID. Please be aware that `"%"` is a special character in this context and that you'll have to escape it by another percent sign (`"%%"`) in case you want to output it to your stylesheets (e.g. for a [Sass placeholder selector](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#placeholder_selectors_)). |
`icons.dimensions`     | String/Boolean  | `"-dims"`     | A non-empty string value will trigger the creation of additional CSS rules specifying the dimensions of each shape in the sprite. The string will be used as suffix to `icons.prefix` during CSS selector construction and may contain the placeholder `"%s"`, which will get replaced by the value of `icons.prefix`. A boolean `TRUE` will cause the dimensions to be included directly into each shape's CSS rule (only available for «css» and «view» sprites). |
`icons.sprite`         | String          | `"svg/sprite.<mode>.svg"` | SVG sprite path and file name, relative to the `icons.dest` directory (see above). The file extension is optional as it will always get replaced with `.svg` anyway. The basename part will always get used as name for the sprite file. |
`icons.bust`           | Boolean         | `true∣false`        | Add a content based hash to the name of the sprite file so that clients reliably reload the sprite when it's content changes («cache busting»). Defaults to `false` except for «css» and «view» sprites. |
`icons.render`         | Object of [Rendering configs](#rendering-configurations)          | `{}`     | Collection of [stylesheet rendering configurations](#rendering-configurations). The keys are used as file extensions as well as file return keys. At present, there are default templates for the file extensions `css` ([CSS](http://www.w3.org/Style/CSS/)), `scss` ([Sass](http://sass-lang.com/)), `less` ([Less](http://lesscss.org/)) and `styl` ([Stylus](http://learnboost.github.io/stylus/)), which all reside in the directory `tmpl/css`. Example: `{css: true, scss: {dest: '_sprite.scss'}}` |





#### Rendering configurations

*svg-sprite* uses [Mustache](http://mustache.github.io/) templates for creating certain output formats. Typically, the generation of these files is optional and you have to switch on the rendering process:

* For creating a **CSS resource** alongside your sprite, you will have to enable / configure at least one output format via the `icons.render` option.
* For creating an **example HTML document** demoing the use of your sprite, you will have to enable / configure it using `icons.example`.

In both cases you'll have to use a **rendering configuration** to tell *svg-sprite* which template it should use and where the result file should be targeted to. Let's take a look at the `icons.example` option. To enable the demo HTML document **with default template and destination**, simply set the value to `true`:

```javascript
{
	mode				: {
		css				: {
			example		: true
		}
	}
}
```

This is absolutely equivalent to:

```javascript
{
	mode				: {
		css				: {
			example		: {}
		}
	}
}
```

Use the subkey `template` for configuring the **rendering template** and `dest` for specifying the **output file destination**:

```javascript
{
	mode				: {
		css				: {
			template	: 'path/to/template.html',	// relative to current working directory
			dest		: 'path/to/demo.html'		// relative to current output directory
		}
	}
}
```

To **disable the rendering** without removing the whole structure, simply set the value to something falsy:

```javascript
{
	mode				: {
		css				: {
			example		: false
		}
	}
}
```


[npm-url]: https://npmjs.org/package/node-iconizr
[npm-image]: https://badge.fury.io/js/node-iconizr.png

[travis-url]: http://travis-ci.org/jkphl/node-iconizr
[travis-image]: https://secure.travis-ci.org/jkphl/node-iconizr.png

[coveralls-url]: https://coveralls.io/r/jkphl/node-iconizr
[coveralls-image]: https://img.shields.io/coveralls/jkphl/node-iconizr.svg

[depstat-url]: https://david-dm.org/jkphl/node-iconizr
[depstat-image]: https://david-dm.org/jkphl/node-iconizr.svg