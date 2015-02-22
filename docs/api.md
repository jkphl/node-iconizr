node-iconizr [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]  [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency Status][depstat-image]][depstat-url]
==========

This file is part of the documentation of *node-iconizr* — a free low-level Node.js module that **takes a bunch of SVG files**, optimizes them and creates a **CSS icon kit** including SVG and PNG sprites, stylesheet resources and a JavaScript loader. The package is [hosted on GitHub](https://github.com/jkphl/node-iconizr).


Standard API
------------

*node-iconizr* comes with the very same four public methods as does the underlying [svg-sprite](https://github.com/jkphl/svg-sprite/blob/master/docs/api.md#standard-api):

* [Iconizr([ config ])](#iconizr-config-) — Iconizr's constructor (always the entry point)
* [Iconizr.add(file [, name, svg ])](#iconizraddfile--name-svg-) — Registering source SVG files
* [Iconizr.compile([ config ,] callback )](#iconizrcompile-config--callback-) — Triggering the icon kit compilation
* [Iconizr.getShapes( dest , callback )](#iconizrgetshapes-dest--callback-) — Accessing the intermediate SVG resources

To understand these methods' roles and interaction, please have a look at the following basic example first.

### Usage example 

```javascript
'use strict';

var Iconizr					= require('iconizr'),
mkdirp						= require('mkdirp'),
path						= require('path'),
fs							= require('fs'),

// 1. Create and configure an iconizr instance
// ====================================================================
iconizr						= new Iconizr({
	dest					: 'out',		// Main output directory
	icons					:
		render				: {
			css				: true			// Render CSS stylesheets
		}
	}
});

// 2. Add some SVG files to process
// ====================================================================
iconizr.add(
	path.resolve('assets/example-1.svg'),
	'example-1.svg',
	fs.readFileSync('assets/example-1.svg', {encoding: 'utf-8'})
);

	/* ... */

iconizr.add(
	path.resolve('assets/example-x.svg'),
	'example-x.svg',
	fs.readFileSync('assets/example-x.svg', {encoding: 'utf-8'})
);

// 3. Trigger the (asynchronous) compilation process
// ====================================================================
iconizr.compile(function(error, result, data){

	// Run through all icon kit files that have been created
	for (var type in result.icons) {
	
		// Recursively create directories as needed
		mkdirp.sync(path.dirname(result.icons[type].path));
		
		// Write the generated resource to disk
		fs.writeFileSync(result.icons[type].path, result.icons[type].contents);
	}
});
```

#### Iconizr([ config ])

**Constructor** — This is the only method publicly exposed by *node-iconizr*, so it's always your entry point. Use it to create an iconizr instance and access the remaining three methods.

##### Arguments

1. **config** `{Object}` *(default: `{}`)* — [Main configuration](configuration.md) for the icon kit creation process. As all configuration properties are optional, you may provide an empty object here or omit the argument altogether (in this case the icon kit will be created with default settings as long as you [register some SVG files](#iconizraddfile--name-svg-) for processing). The `icons` configuration property may also be specified when calling the `.compile()` method ([see below](#iconizrcompile-config--callback-)). 

#### Iconizr.add(file [, name, svg ])

**Registration of an SVG file** — Prior to compiliation, you'll need to register one or more SVG files for processing, obviously. As *node-iconizr* doesn't read the files from disk itself, you'll have to pass both the path and the file contents explicitly. Alternatively, you may pass a [vinyl](https://github.com/wearefractal/vinyl) file object as the first argument to `.add()`, which comes in handy when piping resources from one process to another (as you would do with the [Gulp wrapper](https://github.com/jkphl/gulp-iconizr) anyway). Please [see below](#example-using-glob-and-vinyl) for an example.

It is important to know that iconizr **optimizes the SVG files as soon as you register them**, not just when you [compile the icon kit](#iconizrcompile-config--callback-). This way it is possibly to call the `.compile()` method several time, possibly passing in different render configurations without the need of repeating the optimization steps.

##### Arguments

1. **file** `{String|File}` — Absolute path to the SVG file or a [vinyl](https://github.com/wearefractal/vinyl) file object carrying all the necessary values (the following arguments are ignored then).
2. **name** `{String}` *(ignored with vinyl file)* — The "local" part of the file path, possibly including subdirectories which will get traversed to CSS selectors using the `shape.id.separator` [configuration option](configuration.md#shape-ids). You will want to pay attention to this when recursively adding whole directories of SVG files (e.g. via [glob](#example-using-glob-and-vinyl)). When `name` is empty, *svg-sprite* will use the basename of the `file` argument. As an example, setting `name` to `"deeply/nested/asset.svg"` while giving `"/path/to/my/deeply/nested/asset.svg"` for `file` will translate to the CSS selector `"deeply--nested--asset"`.
3. **svg** `{String}` *(ignored with vinyl file)*: SVG file content.

##### Example using [glob](https://github.com/isaacs/node-glob) and [vinyl](https://github.com/wearefractal/vinyl)

```javascript
'use strict';

var Iconizr					= require('iconizr'),
mkdirp						= require('mkdirp'),
path						= require('path'),
fs							= require('fs'),
File						= require('vinyl'),
glob						= require('glob'),
iconizr						= new Iconizr({
	dest					: 'out',
	icons					: {
		render				: {
			css				: true
		}
	}
}),
cwd							= path.resolve('assets');

// Find SVG files recursively via `glob`
glob.glob('**/*.svg', {cwd: cwd}, function(err, files) {
	files.forEach(function(file){
	
		// Create and add a vinyl file instance for each SVG
		iconizr.add(new File({
			path: path.join(cwd, file),							// Absolute path to the SVG file
			base: cwd,											// Base path (see `name` argument)
			contents: fs.readFileSync(path.join(cwd, file))		// SVG file contents
		}));
	})
	
	iconizr.compile(function(error, result, data){
		for (var type in result.icons) {
			mkdirp.sync(path.dirname(result.icons[type].path));
			fs.writeFileSync(result.icons[type].path, result.icons[type].contents);
		}
	});
});
```

#### Iconizr.compile([ config ,] callback )

**Icon kit compilation** — Triggers an asynchronous icon kit compilation process. You may pass in an optional [icon configuration](configuration.md#icon-options) object as the first argument in order to set the icon parameters for that very run. You may call `.compile()` multiple times, allowing for several different icon kits being generated by the same iconizr instance. For each run, the callback will be triggered independently, giving you access to the resources that were generated.

##### Arguments

1. **config** `{Object}` *(optional)* — Configuration object setting the [icon parameters](configuration.md#icon-options) for a single compilation run. If omitted, the `icons` property of the [main configuration](configuration.md) used for the [constructor](#iconizr-config-) will be used.
2. **callback** `{Function}` — Callback triggered when the compilation has finished, getting three arguments:
	* **error** `{Error}` — Error message in case the compilation has failed
	* **result** `{Object}` — Directory of generated resources ([see below](#compilation-example))
	* **data** `{Object}` — Templating variables passed to Mustache for rendering the resources (see *svg-sprite*'s [sprite & shape variables](https://github.com/jkphl/svg-sprite/blob/master/docs/templating.md#sprite--shape-variables) for details)

##### Compilation example

Depending on the particular icon and render configuration, quite a lot of resources might be generated during a single compilation run. To understand the way *node-iconizr* returns these resources, please have a look at the following example: 

```javascript
spriter.compile({
	icons				: {
		render			: {
			scss		: true
		},
		preview			: 'preview'
	}
},
function(error, result, data){
    console.log(result);
});
```

Iconizr is instructed to create an icon kit with stylesheets in Sass format and a set of HTML preview documents demonstrating the icon kit. The output will look something like this (grouped, sorted and shortened for brevity):

```javascript
{
	icons						: {
		sprite					: <File "icons/icons-c26e2429.svg" <Buffer 3c 3f 78 ...>>,
     	fallbackSprite			: <File "icons/icons-c26e2429.png" <Buffer 89 50 4e ...>>,
     	
		svgDataUriScss			: <File "icons.svg-data-uri.scss" <Buffer 2e 69 63 ...>>,
		svgSpriteScss			: <File "icons.svg-sprite.scss" <Buffer 25 73 76 ...>>,
		fallbackDataUriScss		: <File "icons.fallback-data-uri.scss" <Buffer 2e 69 63 ...>>,
		fallbackSpriteScss		: <File "icons.fallback-sprite.scss" <Buffer 25 73 76 ...>>,

		svgDataUriPreview		: <File "preview/icons.svg-data-uri-preview.html" <Buffer 3c 21 44 ...>>,
		svgSpritePreview		: <File "preview/icons.svg-sprite-preview.html" <Buffer 3c 21 44 ...>>,
		fallbackDataUriPreview	: <File "preview/icons.fallback-data-uri-preview.html" <Buffer 3c 21 44 ...>>,
		fallbackSpritePreview	: <File "preview/icons.fallback-sprite-preview.html" <Buffer 3c 21 44 ...>>,
		autoPreview				: <File "preview/icons.auto-preview.html" <Buffer 3c 21 44 ...>>
		dimensionsPreview		: <File "preview/icons.dimensions.css" <Buffer 2e 69 63 ...>>,
		
		loader					: <File "icons-loader.html" <Buffer 3c 73 63 ...>>,
	}
}
```

`result.icons` contains all the resources of the icon kit (given as [vinyl](https://github.com/wearefractal/vinyl) files):

*	`sprite` holds a [«view» sprite](https://github.com/jkphl/svg-sprite/blob/master/docs/configuration.md#css--view-mode) of the registered SVG source files, while `fallbackSprite` is a **PNG version** of the sprite.
*	Next there are **four stylesheet resources**, representing the four different provisioning strategies. Their property names are constructed from
	1.	the icon type (`"svg"` or `"fallback"`),
	2.	the data type (`"DataUri"` or `"Sprite"`) and
	3.	the stylesheet format (`"Css"`, `"Scss"`, `"Less"`, `"Styl"`, etc.)	  


For each configured output mode (`css` in the example), the `result` object holds an item containing the resources generated for this particular mode. There is always a `sprite` resource (obviously) and possibly an `example` resource for the demo HTML document (if configured). For the [css and view](configuration.md#css--view-mode) output modes, there are additional items named after the configured [rendering configurations](configuration.md#rendering-configurations) (`scss` in the example).

Please note that the resources are always returned as [vinyl](https://github.com/wearefractal/vinyl) files. Have a look above for an [example of how to write these files to disk](#example-using-glob-and-vinyl).  

#### Iconizr.getShapes( dest , callback )

**Accessing the intermediate SVG resources** — Sometimes you may want to access the single transformed / optimized SVG files that *svg-sprite* produces in an intermediate step. Depending on the [configured transformations](configuration.md#svg-transformations) (e.g. SVG optimization with [SVGO](https://github.com/svg/svgo)), *svg-sprite* will need some time for transforming the files, which is why accessing them must be an assynchronous task.

##### Arguments

1. **dest** `{String}` — Base directory for the SVG files in case the will be written to disk.
2. **callback** `{Function}`: Callback triggered when the shapes are available, getting called with two arguments:
	* **error** `{Error}` — Error message in case the shape access has failed.
	* **result** `{Array}` — Array of [vinyl](https://github.com/wearefractal/vinyl) carrying the intermediate SVGs.  

##### Shape access example

```javascript
var mkdirp					= require('mkdirp'),
path						= require('path'),
fs							= require('fs');

spriter.getShapes(path.resolve('tmp/svg'), function(error, result) {
	result.forEach(function(file){
		mkdirp.sync(path.dirname(file.path));
		fs.writeFileSync(file.path, file.contents);
	});
});
```


[npm-url]: https://npmjs.org/package/node-iconizr
[npm-image]: https://badge.fury.io/js/node-iconizr.png

[travis-url]: http://travis-ci.org/jkphl/node-iconizr
[travis-image]: https://secure.travis-ci.org/jkphl/node-iconizr.png

[coveralls-url]: https://coveralls.io/r/jkphl/node-iconizr
[coveralls-image]: https://img.shields.io/coveralls/jkphl/node-iconizr.svg

[depstat-url]: https://david-dm.org/jkphl/node-iconizr
[depstat-image]: https://david-dm.org/jkphl/node-iconizr.svg