/*global phantom: false*/

'use strict';

if (phantom.args.length !== 4) {
    console.error('Usage: png.phantom.js svg scale width height');
    phantom.exit();
    
} else {
	var page			= require('webpage').create(),
	scale				= Math.max(1, parseFloat(phantom.args[1] || 1, 10)),
	width				= Math.round(Math.max(1, parseInt(phantom.args[2] || 1, 10)) * scale),
	height				= Math.round(Math.max(1, parseInt(phantom.args[3] || 1, 10)) * scale);
	page.viewportSize	= { width: width, height: height };
	page.clipRect		= { top: 0, left: 0, width: width, height: height };
    page.zoomFactor		= scale;
    page.open(phantom.args[0], function(status){
    	if (status !== 'success') {
            phantom.exit(1);
        } else {
            window.setTimeout(function () {
                console.log(page.renderBase64('PNG'));
       			phantom.exit();
            }, 0);
        }
    })
}