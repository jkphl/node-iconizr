node-iconizr [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]  [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency Status][depstat-image]][depstat-url]
==========

<img src="http://iconizr.com/iconizr.png" alt="iconizr" align="right"/>
is a low-level [Node.js](http://nodejs.org/) module that **takes a bunch of [SVG](http://www.w3.org/TR/SVG/) files**, optimizes them and transforms them into a **CSS icon kit** consisting of

*	a high-resolution **SVG sprite**,
*	a fallback **PNG sprite** for ancient clients,
*	**stylesheet resources** making them CSS sprites,
*	an intelligent **JavaScript loader** and
*	an optional set of **HTML preview documents**.

As an extension to [svg-sprite](https://github.com/jkphl/svg-sprite), *node-iconizr* basically adds PNG creation and optimization features as well as the logic for picking the icon type that's most appropriate for a specific client. By means of [Mustache](http://mustache.github.io/) templates the stylesheet resources can be created as plain [CSS](http://www.w3.org/Style/CSS/) or one of the major **pre-processor formats** ([Sass](http://sass-lang.com/), [Less](http://lesscss.org/) and [Stylus](http://learnboost.github.io/stylus/)). 

Grunt, Gulp & Co.
-----------------

*node-iconizr* supports [Node.js streams](https://github.com/substack/stream-handbook) and thus doesn't take on the part of accessing the file system (i.e. reading the source SVGs from and writing the sprites and CSS files to disk). If you don't want to take care of this yourself, you might rather have a look at the available wrappers for **Grunt** ([grunt-iconizr](https://github.com/jkphl/grunt-iconizr)) and **Gulp** ([gulp-iconizr](https://github.com/jkphl/gulp-iconizr)).


Table of contents
-----------------
* [Installation](#installation)
* [Getting started](#getting-started)
	* [Usage pattern](#usage-pattern)
* [Configuration basics](#configuration-basics)
	* [Properties overview](#properties-overview)
* [Command line usage](docs/command-line.md)
* [Leveraging more svg-sprite features](#leveraging-more-svg-sprite-features)
* [Background](#background)
* [Known problems / To-do](#known-problems--to-do)
* [Changelog](CHANGELOG.md)
* [Legal](#legal)


Installation
------------

To install *node-iconizr* globally, run

```bash
npm install node-iconizr -g
```

on the command line.


Getting started
---------------

Building an icon kit typically follows these steps:

1. You [create an Iconizr instance](docs/api.md#iconizr-config-) and pass it a main configuration object.
2. You [register the SVG source files](docs/api.md#iconizraddfile--name-svg-) that shall be part of your icon kit.
3. You [trigger the compilation process](docs/api.md#svgspritercompile-config--callback-) and receive the generated files (sprites, CSS, preview documents etc.).


### Usage pattern

Using the [standard API](docs/api.md) the creation of an icon kit looks somewhat like this (the necessary `require()` calls have been omitted for clarity's sake):

```javascript
// Create an iconizr instance (see below for `config` examples)
var iconizr       = new Iconizr(config);

// Add SVG source files — the manual way ...
iconizr.add('assets/svg-1.svg', null, fs.readFileSync('assets/svg-1.svg', {encoding: 'utf-8'}));
iconizr.add('assets/svg-2.svg', null, fs.readFileSync('assets/svg-2.svg', {encoding: 'utf-8'}));
	/* ... */

// Compile the sprite
iconizr.compile(function(error, result) {
	/* ... Write `result` files to disk or do whatever with them ... */
});
```


Configuration basics
--------------------

You will surely have noticed the `config` variable passed to the `Iconizr()` constructor in the above example. This is *node-iconizr*'s **main configuration** — an `Object` with the following properties:

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


If you are familiar with the underlying [svg-sprite](https://github.com/jkphl/svg-sprite), you may notice that all properties but `icons` are inherited from there. In fact, there are even more *svg-sprite* properties that you [can leverage](#leveraging-more-svg-sprite-features), but let's stick to the icon related ones first. The **properties shared between svg-sprite and node-iconizr** are described in detail in the [svg-sprite configuration documentation](https://github.com/jkphl/svg-sprite/blob/master/docs/configuration.md) — basically all of them apply to *node-iconizr* as well.

In addition, there are some **icon specific properties**. Please refer to the [node-iconizr configuration documentation](docs/configuration.md) to learn more.


### Properties overview

*node-iconizr* uses default values for everthing, so even if you don't provide a configuration at all, you will still get some resonable results. 

```javascript
// node-iconizr config properties and their default values

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
		dest				: '.',						// Main icon output directory
        layout				: 'packed',					// Sprite layout
        common				: null,						// Common icon CSS class
        prefix				: '.icon-%s',				// CSS selector prefix
        dimensions			: '-dims',					// CSS dimension selector suffix
        sprite				: 'icons/icons.svg',		// SVG sprite path & name
        bust				: true,						// Whether to use cache busting
        render				: {},						// Format configurations for stylesheets
		fallback			: {							// Fallback related properties
			scale			: 1,						// Zoom factor for PNG fallbacks
			optimize		: {							// PNG optimization related properties
				level		: 3,						// Optimization level (0-11)
				quantize	: true,						// Whether to quantize fallback PNGs
				debug		: false						// Output opimization debug messages
			}
		},
		threshold			: {							// Data URI size limits
			svg				: 32768,					// SVG data URI size limits
			fallback		: 32768						// PNG data URI size limits
		},
		loader				: {							// JavaScript loader related properties
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

Detailed information about the `icons` property and its members can be found in the [configuration documentation](docs/configuration.md).


Command line usage
------------------

*node-iconizr* comes with a full featured command line version. A typical usage example would look like this:

```bash
$ node-iconizr --css --css-render-css --css-example --dest=out assets/*.svg
```

Please refer to the [CLI guide](docs/command-line.md) for further details.


Leveraging more svg-sprite features
------------------------------

As mentioned before, *node-iconizr* is an extension to [svg-sprite](https://github.com/jkphl/svg-sprite), which is a low-level Node.js module for creating SVG sprites, currently supporting five different sprite types (*node-iconizr* uses the «view» type). *svg-sprite* has the `mode` property for [enabling and configuring](https://github.com/jkphl/svg-sprite/blob/master/docs/configuration.md#output-modes) the creation of particular sprites. Also with *node-iconizr* you may specify this property in order to create **additional sprites** along with your icon kit.

```javascript
var config					= {
	
	
	/* Common svg-sprite & node-iconizr properties */

	dest					: '.',
	log						: null,
	/* ... */
	
	
	/* node-iconizr specific properties */
	
	icons					: {
		/* ... */
	},
	
	
	/* Properties for additional sprites created by svg-sprite */
	mode					: {
		/* ... */
	}
}
```

For those of you interested: *node-iconizr* transcribes the relevant parts of the `icons` property to a corresponding `mode` definition which is getting passed to *svg-sprite* internally:

```javascript
var iconizrConfig			= {
	icons					: {
		/* ... Icon properties ... */
	}
}

// internally becomes

var svgSpriteConfig			= {
	mode					: {
		<icons>				: {
			mode			: 'view',
			/* ... Icon properties ... */
		}
	}
}

```


Background
----------

Although [SVG](http://www.w3.org/TR/SVG/) has been around for quite some time, it just got a lot of traction since responsive websites, mobile data connections and high-resolution ("retina") displays became fairly standard. SVG drawings are losslessly scalable, highly compressible, can be scripted and animated and outperform [bitmap images](http://en.wikipedia.org/wiki/Bitmap) in almost any way you.

While [browser support](http://caniuse.com/#feat=svg) is pretty decent in the meantime, there are still some old clients around that lack support of SVG (e.g. Internet Explorer < 9, Android < 3 and older BlackBerry browsers). To not let these platforms down you may use SVG as your default icon format and additionally serve bitmap versions as **fallbacks**.

Another important thing — especially on cellular networks — is to avoid as many [HTTP requests](http://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol) as possible. Serving images as [data URIs](http://en.wikipedia.org/wiki/Data_URI_scheme) is a well-known strategy for doing so (although a [controversially discussed](http://www.mobify.com/blog/css-sprites-vs-data-uris-which-is-faster-on-mobile/) one as well). *node-iconizr* combines these two techniques — SVG with PNG fallbacks and data URIs — and serves clients in the following order of priorities:

1.	**SVG data URIs** (1 x CSS request, high-resolution SVG)
2.	**SVG sprite** (1 x CSS + 1 x SVG sprite request, high-resolution SVG)
3.	**PNG data URIs** (1 x CSS request)
3.	**PNG sprite** (1 x CSS + 1 x PNG sprite request)

The reason why *node-iconizr* **prefers CSS sprites over single images** (both SVG and PNG) is simple: As soon as only one extra HTTP request has to be made (e.g. because a data URI exceeds the client's limit or the client doesn't support data URIs at all), it is most effective to fetch **all** image data in that one go and skip the data URIs altogether. In this situation CSS sprites help keeping the additional requests down to a minimum, which is exactly one.


Known problems / To-do
----------------------

* SVGO does not minify element IDs when there are `<style>` or `<script>` elements contained in the file


Changelog
---------

Please refer to the [changelog](CHANGELOG.md) for a complete release history.


Legal
-----
Copyright © 2015 Joschi Kuphal <joschi@kuphal.net> / [@jkphl](https://twitter.com/jkphl). *node-iconizr* is licensed under the terms of the [MIT license](LICENSE.txt). The contained example SVG icons are part of the [Tango Icon Library](http://tango.freedesktop.org/Tango_Icon_Library) and belong to the Public Domain.


[npm-url]: https://npmjs.org/package/node-iconizr
[npm-image]: https://badge.fury.io/js/node-iconizr.png

[travis-url]: http://travis-ci.org/jkphl/node-iconizr
[travis-image]: https://secure.travis-ci.org/jkphl/node-iconizr.png

[coveralls-url]: https://coveralls.io/r/jkphl/node-iconizr
[coveralls-image]: https://img.shields.io/coveralls/jkphl/node-iconizr.svg

[depstat-url]: https://david-dm.org/jkphl/node-iconizr
[depstat-image]: https://david-dm.org/jkphl/node-iconizr.svg