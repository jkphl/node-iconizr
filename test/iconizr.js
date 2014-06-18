var should			= require('should'),
path				= require('path'),
rimraf				= require('rimraf'),
Iconizr				= require('../lib/iconizr');

describe('iconizr', function() {
	
    describe('with no arguments', function() {
        it('returns an error', function() {
            var result = Iconizr.createIconKit();
            result.should.be.an.Error;
			result.should.have.property('errno', 1391852448);
        });
    });
    
    describe('with an empty input directory', function() {
        it('returns an error', function() {
            var result = Iconizr.createIconKit('', '', null, function(){});
            result.should.be.an.Error;
			result.should.have.property('errno', 1391852763);
        });
    });
    
    describe('with an invalid input directory', function() {
        it('returns an error', function() {
            var result = Iconizr.createIconKit('/abcde/fghij/klmno', '', null, function(){});
            result.should.be.an.Error;
			result.should.have.property('errno', 1391853079);
        });
    });
    
    describe('with an invalid main / default output directory', function() {
        it('returns an error', function(done) {
        	Iconizr.createIconKit(path.join(__dirname, 'files'), path.normalize(path.join(__dirname, '..', 'tmp\0null')), null, function(err, result){
            	err.should.be.an.Error;
				err.should.have.property('errno', 1391854708);
				done();
            });
        });
    });
    
    describe('with an invalid Sass output directory', function() {
        it('returns an error', function(done) {
        	this.timeout(10000);
        	Iconizr.createIconKit(path.join(__dirname, 'files'), path.normalize(path.join(__dirname, '..', 'tmp', 'css')), {render: {scss: path.normalize(path.join(__dirname, '..', 'tmp', 'sass\0null/'))}, level: 0}, function(err, result){
            	err.should.be.an.Error;
				err.should.have.property('errno', 1391854708);
				done();
            });
        });
    });
    
    describe('with valid, default arguments', function() {
        it('generates 7 files', function(done) {
        	this.timeout(10000);
        	Iconizr.createIconKit(path.join(__dirname, 'files'), path.normalize(path.join(__dirname, '..', 'tmp', 'css')), {level: 0}, function(err, result){
            	should(err).not.ok;
            	should(result).be.an.Object;
				should(result).property('success', true);
				should(result).property('length', 7);
				done();
            });
        });
    });
    
    describe('with valid, extended arguments', function() {
        it('generates 57 files', function(done) {
        	this.timeout(10000);
        	Iconizr.createIconKit(path.join(__dirname, 'files'), path.normalize(path.join(__dirname, '..', 'tmp', 'css')), {preview: 'preview', keep: true, render: {scss: '../sass/_icons', less: '../less/_icons', styl: '../styl/_icons'}, level: 0}, function(err, result){
            	should(err).not.ok;
            	should(result).be.an.Object;
				should(result).property('success', true);
				should(result).property('length', 57);
				done();
            });
        });
    });
 });

after(function(done) {
	rimraf(path.normalize(path.join(__dirname, '..', 'tmp')), function(error){
		done();
	});
});