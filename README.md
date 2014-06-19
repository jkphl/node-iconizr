iconizr
=======
<img src="http://iconizr.com/iconizr.png" alt="iconizr" align="right"/>
> Node.js version

*iconizr* is a Node.js module that reads a folder of **SVG images** and creates a **CSS icon kit** out of them, including:

*	cleaned versions of the original **SVG icons** (optional),
*	a single compact **SVG icon sprite**,
*	optimized single **PNG icons** (optional),
*	an optimized combined **PNG icon sprite**,
*	corresponding **CSS stylesheets** in customizable formats (e.g. CSS, Sass, LESS, Stylus etc.),
*	an **HTML fragment** including some JavaScript for asynchronously loading the most appropriate stylesheet flavour (depending on the client)
*	and a couple of **HTML preview documents** (depending on the options you specified) for previewing and testing the different stylesheets (optional).

The stylesheets are rendered using [Mustache](http://mustache.github.io) templates, so you can control which output formats are generated (and how they are structured). For each of them, a set of several stylesheets are created, differing in the way the icons are served to clients:
*	SVG single image icons (optional),
*	SVG data URIs,
*	SVG sprite references,
*	PNG single image icons (optional),
*	PNG data URIs and
*	PNG sprite references.


Installation & usage
--------------------

To install *iconizr*, run

```bash
npm install iconizr -g
```

on the command line.

Usage
-----

The *iconizr* module exposes only one method, `createIconKit()`. Use it like this:

```javascript
var Iconizr			    = require('iconizr'),
var options				= {
	
	// svg-sprite inferred options
	render				: {
		css				: false,
		scss			: 'sass/output/directory/',
		less			: {
			template	: 'path/to/less/mustache/template.less',
			dest		: '/absolute/path/to/dest/file'
		}
	},
	// ...
	
	// iconizr specific options
	quantize			: true,
	level				: 5
	/* Further configuration options, see below ... */
},
callback				= function(err, results) { /*
	If no error occurs, `results` will be a JSON object like this one:
	
	{
	   success			: true,		// Overall success
	   length			: 3,		// Total number of files written
	   files			: {			// Files along with their file size in bytes
	      '/path/to/your/cwd/css/output/directory/svg/sprite.svg'	: 436823,
	      '/path/to/your/cwd/css/output/directory/sprite.css'		: 1821,
	      '/path/to/your/cwd/sass/output/directory/_sprite.scss'	: 2197
	   },
	   options          : {         // refined configuration options, see above 
           // ...
	   },
	   data             : {         // Mustache template variables, see below
	       // ...
	   }
	}
	
*/};
Iconizr.createIconKit('path/with/svg/images', 'css/output/directory', options, callback);
```

The `createIconKit()` method will refuse to run if you don't pass exactly four arguments:

1.	A path to be used as the **input directory** containing the SVG images for sprite creation. A relative path refers to the current working directory.
2.	A main / default **output directory**, used for creating the stylesheet resources (CSS / Sass / LESS / Stylus etc. if activated and not specified otherwise; see the [svg-sprite rendering options](https://github.com/jkphl/svg-sprite/blob/master/README.md#rendering-configuration)) and serving as a base for the sprite subdirectory given by `spritedir` see ([svg-sprite configuration options](https://github.com/jkphl/svg-sprite#available-options)). A relative path refers to the current working directory.
3.	An object with [configuration options](#available-options) (for both [svg-sprite](https://github.com/jkphl/svg-sprite#available-options) and [iconizr specific](#available-options)). None of these options is mandatory, so you may pass an empty object `{}` here.
4.	A callback to be run when the sprite creation has finished (with or without error).

Configuration
-------------

### Options inferred from svg-sprite

*iconizr* is built on top of [svg-sprite](https://github.com/jkphl/svg-sprite), which is a Node.js module for SVG sprite generation. All of [svg-sprite's configuration options](https://github.com/jkphl/svg-sprite#available-options) apply for *iconizr* as well. For a complete reference please see the [svg-sprite documentation](https://github.com/jkphl/svg-sprite).

|Option       |Description  |
|:------------|:------------|
|render       |Rendering configuration (output formats like CSS, Sass, LESS, Stylus, HTML with inline SVG, etc.)|
|variables    |Custom Mustache rendering variables [`{}`]|
|spritedir    |Sprite subdirectory name [`"svg"`]|
|sprite       |Sprite file name [`"sprite"`]|
|prefix       |CSS selector prefix [`"svg"`]|
|common       |Common CSS selector for all images [*empty*]|
|maxwidth     |Maximum single image width [`1000`]|
|maxheight    |Maximum single image height [`1000`]|
|padding      |Transparent padding around the single images (in pixel) [`0`]|
|layout       |Image arrangement within the sprite (`"vertical"`, `"horizontal"` or `"diagonal"`) [`"vertical"`]|
|pseudo       |Character sequence for denoting CSS pseudo classes [`"~"`]|
|dims         |Render image dimensions as separate CSS rules [`false`]|
|keep         |Keep intermediate SVG files (inside the sprite subdirectory) [`false`]|
|recursive    |Recursive scan of the input directory for SVG files [`false`]|
|verbose      | Output verbose progress information (0-3) [`0`]|
|cleanwith    |Module to be used for SVG cleaning. Currently "scour" or "svgo" [`"svgo"`]|
|cleanconfig  |Configuration options for the cleaning module [`{}`]|

In particular, *iconizr*'s [rendering configuration](https://github.com/jkphl/svg-sprite/blob/master/README.md#rendering-configuration) and [output format behaviour](https://github.com/jkphl/svg-sprite/blob/master/README.md#custom-output-formats) is identical to *svg-sprite*, so please have a look there for further reference.

### Options for iconizr

Property      | Type             | Description     
------------- | ---------------- | ----------------
`quantize`    | Boolean          | Whether to quantize PNG images (reduce to 8-bit depth) using `pngquant`. The quantized images are only used if they are smaller in file size than their the originals (and this is not necessarily the case for all PNG files). Quantization may also impact the visual image quality, so please make sure to compare the result to the original images. Defaults to `false`.
`level`       | Number (0-11)    | This is the optimization level for PNG files. It has to lie between 0 and 11 (inclusive) and defaults to 4, with 0 meaning "no optimization", 1 meaning "fast & rough" and 11 meaning "slow & high quality". Setting this to a high value may result in a very long processing time. Defaults to `3`.
`embed`       | String           | If given, *iconizr* will use this value as path prefix to embed the stylesheets into your HTML documents (used for the JavaScript loader fragment). By default, the path segment between the current working directory and the main output directory will be used as a root-relative embed path (i.e. giving `path/to/css` as output directory will result in the loader fragment expecting the CSS stylesheets to lie at `/path/to/css/<stylesheet-flavour>.css`). You may specify a period `.` here to make the embed path relative to your HTML document (i.e. `./<stylesheet-flavour>.css`), or use any other relative path (e.g. `../resources` for the embed path `../resources/<stylesheet-flavour>.css`).
`svg`         | Number           | This is the maximum length a SVG data URI may have. If only one icon exceeds this threshold, all data URIs of this icon set will be changed to external SVG sprite references. Defaults to `1048576` (1MB), minimum is `1024` (1kB).
`png`		  | Number           | This is the maximum length a PNG data URI may have. If only one icon exceeds this threshold, all data URIs of this icon set will be changed to external PNG sprite references. Defaults to `32768` (32KB = Internet Explorer 8 limit), minimum is `1024` (1kB).
`preview`     | String           | If given and not empty, a set of preview HTML documents will be rendered that can be used for previewing and testing the icon kit. The given value will be used as directory path relative to the main output directory, whereas the main preview document will be named after your CSS file name (`{render: {css: '...'}}`) or the `prefix` option (in case no CSS files are generated).

### Custom output formats & inline SVG embedding

The output rendering of *iconizr* is based on [Mustache](http://mustache.github.io) templates, which enables **full customization of the generated results**. You can even introduce completely new output formats. For details please see the [svg-sprite documentation](https://github.com/jkphl/svg-sprite#custom-output-formats).

Also, you may use *iconizr* to create an **inline SVG sprite** that can be embedded directly into your HTML documents. Please see the [svg-sprite documentation](https://github.com/jkphl/svg-sprite#inline-embedding) for details.


Other versions
--------------
Besides this Node.js module there are several different versions of *iconizr*:

*	A [Grunt plugin](https://github.com/jkphl/grunt-iconizr) wrapping around this module.
*	A [PHP command line](https://github.com/jkphl/iconizr) version (that in fact is the "original" one, but compared to the Node.js / Grunt branch it's a little outdated at the moment ...).
*	The **online service** at [iconizr.com](http://iconizr.com) that's based on the aforementioned PHP version (you can use it for creating CSS icon kits without the need of a local installation).
*	Finally, [Haithem Bel Haj](https://github.com/haithembelhaj) published a [Grunt plugin](https://github.com/haithembelhaj/grunt-iconizr-php) that's also based on the PHP version. I never tried this one myself, though.


Release History
---------------

#### v0.2.2
*	Added a Stylus output template ([#5](https://github.com/jkphl/node-iconizr/pull/5))
*	Added the `variables` config option ([*grunt-iconizr* #13](https://github.com/jkphl/grunt-iconizr/issues/13))

#### v0.2.1
*	Fixed invalid `background-position` style in Sass / LESS templates ([#4](https://github.com/jkphl/node-iconizr/issues/4)) 

#### v0.2.0
*	Switched to mustache.js for extended function support
*	Fixed full disabling of output rendering ([#2](https://github.com/jkphl/node-iconizr/issues/2))
*	Don't crash with empty input directory ([#3](https://github.com/jkphl/node-iconizr/issues/3))
*	Fixed bug with the SVG sprite not used by the Sass & LESS output types ([grunt-iconizr issue #6](https://github.com/jkphl/grunt-iconizr/issues/6))
*	Added new HTML output format for rendering an inline SVG HTML implementation ([#1](https://github.com/jkphl/node-iconizr/issues/1))
*	Added new SVG output format for rendering an inline SVG sprite ([#1](https://github.com/jkphl/node-iconizr/issues/1))
*	Documentation corrections

#### v0.1.0
*	Initial release


Contributors
------------
*	[Ralf Hortt](https://github.com/Horttcore)


Legal
-----
Copyright © 2014 Joschi Kuphal <joschi@kuphal.net> / [@jkphl](https://twitter.com/jkphl)

*iconizr* is licensed under the terms of the [MIT license](LICENSE.txt).

The contained example SVG icons are part of the [Tango Icon Library](http://tango.freedesktop.org/Tango_Icon_Library) and belong to the Public Domain.