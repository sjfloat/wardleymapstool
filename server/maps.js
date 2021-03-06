//#!/bin/env node
/* Copyright 2014 Krzysztof Daniel

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

var logger = require('./util/log.js').getLogger('maps');

var constructSharingURL = function(req, mapId) {
    var protocol;
    if(req.headers.referer){
        protocol = req.headers.referer.split(':')[0];
    } else {
        protocol = 'http';
    }
    var url_main = protocol + '://' + req.headers.host;
    return url_main + '/anonymous/' + mapId + '/map.svg';
};

var mapmodule = function(db) {
    return {
        createNewMap : function (req, res) {

            var userId = req.user.href;
            logger.debug("new map creation requested for user", userId);

            var name = "";
            if (typeof req.body.name !== 'undefined') {
                name = req.body.name;
            }
            var description = "";
            if (typeof req.body.description !== 'undefined') {
                description = req.body.description;
            }

            var date = null;
            if (typeof req.body.description !== 'undefined') {
                date = req.body.date;
            }

            var stub = {
                name : name,
                description : description,
                userDate : date,
                serverDate : new Date(),
                nodes : [],
                connections : []
            };

            var meta = {
                deleted : false,
                userIdGoogle : userId,
                history : [ stub ]
            };

            logger.debug("creating map", meta);

            db.maps.save(meta, function(err, saved) {
                if (err !== null) {
                    logger.error(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 500;
                    res.send(JSON.stringify(err));
                    res.end();
                }
                if (saved) {
                    logger.debug("new map", saved._id, "created for user", userId);
                    var mapid = '' + saved._id;
                    db.collection('progress').save({
                        mapid : mapid,
                        progress : 0
                    }, function(err, savedprogress) {
                        if (err !== null) {
                            logger.error(err);
                            res.setHeader('Content-Type', 'application/json');
                            res.statusCode = 500;
                            res.send(JSON.stringify(err));
                            res.end();
                        }
                        if (savedprogress) {
                            logger.debug("progress created for map", saved._id);
                            // tell the client where is the map
                            res.redirect('/map/' + saved._id);
                        }
                    });
                }
            });
        },

        deleteMap : function(req, res, mapId, redirect) {

            var userId = req.user.href;

            mapId = db.ObjectId(mapId);
            logger.debug("deleting map", mapId, "for user", userId);

            var userDate = null; // TODO: if I will ever care what time was
                                    // in
            // the client when a map was deleted.

            db.maps.findAndModify({
                query : {
                    userIdGoogle : userId,
                    _id : mapId,
                    deleted : false
                },
                update : {
                    $set : {
                        deleted : true
                    },
                    $push : {
                        // null object in the history
                        history : {
                            userDate : userDate,
                            serverDate : new Date()
                        }
                    }
                },
                upsert : true,
            }, function(err, object) {
                if (err !== null) {
                    logger.error(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 500;
                    res.send(JSON.stringify(err));
                } else {
                    if (!redirect) {
                        res.writeHead(200, {
                            'content-type' : 'text/html'
                        });
                        res.end();
                    } else {
                        res.redirect(redirect);
                    }
                }
            });

        },

        updateMap : function (req, res, mapId) {
            var userId = req.user.href;

            mapId = db.ObjectId(mapId);
            logger.debug("updating map", mapId, "for user", userId);
            var historyEntry = req.body;
            // objectID there, replace
            historyEntry._id = mapId;
            historyEntry.userId = userId;
            historyEntry.serverDate = new Date();

            logger.debug('map', historyEntry);

            db.maps.findAndModify({
                query : {
                    userIdGoogle : userId,
                    _id : mapId,
                    deleted : false
                /* don't modify deleted maps */
                },
                update : {
                    $push : {
                        history : historyEntry
                    }
                },
            }, function(err, object) {
                if (err !== null) {
                    logger.error(err);
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 500;
                    res.send(JSON.stringify(err));
                } else {
                    res.writeHead(200, {
                        'content-type' : 'text/html'
                    });
                    res.end();
                }
            });
        },

        partialMapUpdate : function (req, res, mapId) {
            var userId = req.user.href;

            mapId = db.ObjectId(mapId);
            var load = req.body;
            logger.debug("updating map partially", mapId, "for user", userId, " request" + JSON.stringify(load));

            db.maps.find({
                "userIdGoogle" : userId,
                "_id" : mapId,
                deleted : false
            /* don't return deleted maps */
            }, {
                history : {
                    $slice : -1
                }
            }).toArray(function(err, map) {
                res.setHeader('Content-Type', 'application/json');
                if (err !== null) {
                    logger.error(err);
                    res.statusCode = 500;
                    res.send(JSON.stringify(err));
                } else {
                    // clone last history entry
                    var historyEntry = (JSON.parse(JSON.stringify(map[0].history[0])));
                    historyEntry.serverDate = new Date();
                    historyEntry[load.pk] = load.value;

                    db.maps.findAndModify({
                        query : {
                            userIdGoogle : userId,
                            _id : mapId,
                            deleted : false
                        /* don't modify deleted maps */
                        },
                        update : {
                            $push : {
                                history : historyEntry
                            }
                        },
                    }, function(err, object) {
                        if (err !== null) {
                            logger.error(err);
                            res.setHeader('Content-Type', 'application/json');
                            res.statusCode = 500;
                            res.send(JSON.stringify(err));
                        } else {
                            res.writeHead(200, {
                                'content-type' : 'text/html'
                            });
                            res.end();
                        }
                    });
                }
            });
        },

        getMap : function (req, mapId, callback) {

            var userId = req.user.href;

            mapId = db.ObjectId(mapId);
            logger.debug("getting map", mapId, "for user", userId);

            db.maps.find({
                "userIdGoogle" : userId,
                "_id" : mapId,
                deleted : false
            /* don't return deleted maps */
            }, {
                history : {
                    $slice : -1
                }
            }).toArray(function(err, maps) {
                if (err) {
                    logger.error(err);
                } else if (maps.length === 0) {
                    logger.warn('no map ' + mapId + ' for user ' + userId + ' found!');
                } else {
                    if (!maps[0].history[0].nodes) {
                        maps[0].history[0].nodes = [];
                    }
                    if (!maps[0].history[0].connections) {
                        maps[0].history[0].connections = [];
                    }
                    if (!maps[0].anonymousShare) {
                        maps[0].anonymousShare = false;
                    } else {
                        maps[0].anonymousShareLink = constructSharingURL(req, mapId);
                    }
                    callback(maps[0]);
                }
            });

        },

        getMaps : function (req, next) {
            var userId = req.user.href;

            logger.debug("getting maps for user", userId);

            db.maps.find({
                "userIdGoogle" : userId,
                deleted : false
            /* don't return deleted maps */
            }, {
                history : {
                    $slice : -1
                }
            }).toArray(function(err, maps) {
                if (err !== null) {
                    logger.error(err);
                } else {
                    // limit what goes with generic maps
                    var response = [];
                    for (var i = 0; i < maps.length; i++) {
                        var singleMap = {};
                        singleMap._id = maps[i]._id;
                        singleMap.name = maps[i].history[0].name;
                        singleMap.description = maps[i].history[0].description;
                        singleMap.userDate = maps[i].history[0].userDate;
                        singleMap.serverDate = maps[i].history[0].serverDate;
                        response.push(singleMap);
                    }
                    next(response);
                }
            });
        },

        // TODO: check user access
        getProgressState : function (req, mapid, callback) {
            db.progress.findOne({
                mapid : mapid
            }, function(err, state) {
                if (err) {
                    logger.error(err);
                    return;
                }
                if (!state) {
                    callback({
                        progress : -1
                    });
                    return;
                }
                callback({
                    progress : state.progress
                });
            });
        },

        advanceProgressState : function (req, mapid, callback) {
            db.progress.findAndModify({
                query : {
                    mapid : mapid
                },
                update : {
                    $inc : {
                        progress : 1
                    }
                }
            }, function(err, object) {
                if (err) {
                    logger.error(err);
                }
                callback({
                    // this is updated in db
                    progress : object.progress + 1
                });
            });
        },

        share : function (req, mapId, mode, callback) {
            var userId = req.user.href;
            mapId = db.ObjectId(mapId);

            logger.debug("sharing ", mapId, " for user ", userId, " mode ", mode);

            var anonymousShare = mode === 'anonymous';

            db.maps.findAndModify({
                query : {
                    "_id" : mapId,
                    "userIdGoogle" : userId,
                    deleted : false
                },
                update : {
                    $set : {
                        anonymousShare : anonymousShare
                    }
                }
            }, function(err, object) {
                if (err) {
                    logger.error(err);
                }
                callback(anonymousShare ? {
                    url : constructSharingURL(req, mapId)
                } : {});
            });
        }
    };
};
module.exports = mapmodule;
