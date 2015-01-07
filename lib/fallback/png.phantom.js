/*global phantom: false*/

'use strict';

if (phantom.args.length !== 5) {
    console.error('Usage: png.phantom.js svg path scale width height');
    phantom.exit();
    
} else {
	var page			= require('webpage').create(),
	scale				= Math.max(1, parseFloat(phantom.args[2] || 1, 10));
	page.viewportSize	= {
        width			: Math.round(Math.max(1, parseInt(phantom.args[3] || 1, 10)) * scale),
        height			: Math.round(Math.max(1, parseInt(phantom.args[4] || 1, 10)) * scale)
    };
    page.setContent(phantom.args[0], phantom.args[1]);
    page.zoomFactor		= scale;
    setTimeout(function () {
        console.log(page.renderBase64('PNG'));
        phantom.exit();
    }, 0);
}