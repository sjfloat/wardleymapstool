/* Copyright 2014, 2015 by Krzysztof Daniel

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

var should = require('should');
var sinon = require('sinon');

describe('Maps', function() {
    var self = this;

    before(function() {
        self.db = new require('../server/db')("127.0.0.1:27017/tests");
        self.maps = new require('../server/maps')(self.db);
        self.exp = new require('../server/export')(self.db);
    });
    
    it('request without any parameters', function(done){
        var req = {
                user : {
                    href : 'wardleymapper'
                },
                body : {}
        };
        var res = {
                mapid : "",
                redirect : function(arg) {
                    if(arg.substr(0,5) !== '/map/'){
                        done('wrong redirect ' + arg);
                    }
                    res.mapid = arg.substr(5);
                    if(res.mapid.length != 24) {
                        done('weird mapi length ' + res.mapid);
                    }
                    if(res.mapid.indexOf('/') !== -1) {
                        done('mapid contains // ' + res.mapid);
                    }
                    done();
                }
        }
        self.maps.createNewMap(req, res);
    });
    
    it('get a map', function(done){
        var req = {
                user : {
                    href : 'wardleymapper'
                },
                body : {}
        };
        self.maps.getMaps(req, function(response){
            try{
                should(response.length).be.equal(1);
                should(response[0]).have.property('_id');
                
                var mapid = response[0]._id;
                self.maps.getMap(req, mapid, function(map){
                    try{
                        should(map).have.property('history');
                        should(map.history[0]).have.property('nodes');
                        should(map.history[0]).have.property('connections');
                        map.should.have.property('anonymousShare').which.is.equal(false);
                    }catch(e) {
                        done(e);
                    }
                });
            } catch (e) {
                done(e);
                return;
            }
            done();
        });
    });
    
    it('get a map without privileges', function(done){
        var req = {
                user : {
                    href : 'notawardleymapper'
                },
                body : {}
        };
        self.maps.getMaps(req, function(response){
            try{
                should(response.length).be.equal(0);
            } catch (e) {
                done(e);
                return;
            }
            done();
        });
    });
    

    it('share a map', function(done) {
        var req = {
            user : {
                href : 'wardleymapper'
            },
            body : {},
            headers : {
                referer : 'http://127.0.0.1:8080',
                host : '127.0.0.1:8080'
            }
        };
        self.maps.getMaps(req, function(response) {
            try {
                should(response.length).be.equal(1);
                should(response[0]).have.property('_id');

                var mapid = response[0]._id;
                self.maps.share(req, mapid, 'anonymous', function(result) {
                    try {
                        var req2 = {};
                        var res2 = {
                            setHeader : function() {
                            },
                            send : function() {
                                done()
                            }
                        };
                        should(result).have.property('url').which.is.equal('http://127.0.0.1:8080/anonymous/' + mapid + '/map.svg');
                        self.exp.createAnonymousSVG(req2, res2, mapid, 'map.svg');
                    } catch (e) {
                        done(e);
                    }
                });
            } catch (e) {
                done(e);
                return;
            }
        });
    });
    
    
    it('unshare a map', function(done) {
        var req = {
            user : {
                href : 'wardleymapper'
            },
            body : {}
        };
        self.maps.getMaps(req, function(response) {
            try {
                should(response.length).be.equal(1);
                should(response[0]).have.property('_id');

                var mapid = response[0]._id;
                self.maps.share(req, mapid, 'none', function(result) {
                    try {
                        var req2 = {};
                        var res2 = {
                            setHeader : function() {
                            },
                            send : function() {
                                done('map should not be rendered');
                            },
                            redirect : function() {
                                done();
                            }
                        };
                        should(result).not.have.property('url');
                        self.exp.createAnonymousSVG(req2, res2, mapid, 'map.svg');
                    } catch (e) {
                        done(e);
                    }
                });
            } catch (e) {
                done(e);
                return;
            }
        });
    });

    after(function() {
        self.db.collection('maps').drop();
    });

});
