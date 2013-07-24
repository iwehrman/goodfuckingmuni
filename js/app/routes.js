/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        geo = require("app/geolocation"),
        command = require("app/command"),
        util = require("app/util");

    var ROUTE_LIST_TIMEOUT = 1000 * 60 * 60 * 24 * 365, // 1 year
        ROUTE_TIMEOUT = 1000 * 60 * 60 * 24; // 1 day
    
    var ROUTE_LIST_KEY = "org.wehrman.muni.routelist",
        ROUTE_KEY = "org.wehrman.muni.routes";
    
    var cachedRouteList = null,
        cachedRoutes = {};
        
    var cmdRouteList = command.defineCommand("routeList"),
        cmdRouteConfig = command.defineCommand("routeConfig", ["r", "terse"]);
    
    function Stop(objOrTag, title, lat, lon) {
        if (typeof objOrTag === "string") {
            this.tag = objOrTag;
            this.title = title;
            this.lat = lat;
            this.lon = lon;
        } else {
            this.tag = objOrTag.tag;
            this.title = objOrTag.title;
            this.lat = objOrTag.lat;
            this.lon = objOrTag.lon;
        }
    }
    
    Stop.prototype.clone = function () {
        return new Stop(this.tag, this.title, this.lat, this.lon);
    };
    
    Stop.prototype.toJSONObject = function () {
        return this.clone();
    };
    
    Stop.prototype.distanceFrom = function (position) {
        return geo.distance(this, position);
    };
    
    function Direction(route, objOrTag, title, name, stops) {
        this._route = route;
        if (typeof objOrTag === "string") {
            this.tag = objOrTag;
            this.title = title;
            this.name = name;
            this.stops = stops;
        } else {
            this.tag = objOrTag.tag;
            this.title = objOrTag.title;
            this.name = objOrTag.name;
            this.stops = objOrTag.stops.map(function (stopTag) {
                return route.stops[stopTag];
            });
        }
    }
    
    Direction.prototype.clone = function (route) {
        var stops = this.stops.map(function (stop) {
            return stop.clone();
        });
        
        return new Direction(route, this.tag, this.title, this.name, stops);
    };
    
    Direction.prototype.toJSONObject = function () {
        var stopTags = this.stops.map(function (stop) {
            return stop.tag;
        }), direction = new Direction(null, this.tag, this.title, this.name, stopTags);
        
        delete direction._route;
        
        return direction;
    };
    
    function Route(objOrTag, title, stops, directions, color, oppositeColor) {
        var route = this,
            tag;
        
        if (typeof objOrTag === "string") {
            this.tag = objOrTag;
            this.title = title;
            this.stops = stops;
            this.directions = directions;
            this.color = color;
            this.oppositeColor = oppositeColor;
        } else {
            this.tag = objOrTag.tag;
            this.title = objOrTag.title;
            this.stops = {};
            for (tag in objOrTag.stops) {
                if (objOrTag.stops.hasOwnProperty(tag)) {
                    this.stops[tag] = new Stop(objOrTag.stops[tag]);
                }
            }
            this.directions = {};
            for (tag in objOrTag.directions) {
                if (objOrTag.directions.hasOwnProperty(tag)) {
                    this.directions[tag] = new Direction(route, objOrTag.directions[tag]);
                }
            }
            this.color = objOrTag.color;
            this.oppositeColor = objOrTag.oppositeColor;
        }
    }
    
    Route.prototype.clone = function () {
        var tag,
            stops = {},
            directions = {},
            route = new Route(this.tag, this.title, stops, directions,
                              this.color, this.oppositeColor);
        
        for (tag in this.stops) {
            if (this.stops.hasOwnProperty(tag)) {
                stops[tag] = this.stops[tag].clone();
            }
        }
        
        for (tag in this.directions) {
            if (this.directions.hasOwnProperty(tag)) {
                directions[tag] = this.directions[tag].clone(route);
            }
        }

        return route;
    };
    
    Route.prototype.toJSONObject = function () {
        var route = this.clone(),
            tag;
        
        for (tag in this.stops) {
            if (this.stops.hasOwnProperty(tag)) {
                route.stops[tag] = route.stops[tag].toJSONObject();
            }
        }
        
        for (tag in this.directions) {
            if (this.directions.hasOwnProperty(tag)) {
                route.directions[tag] = route.directions[tag].toJSONObject();
            }
        }
        
        return route;
    };
    
    Route.prototype.getTitleWithColor = function () {
        return "<span style='color: #" + this.color + ";'> • </span>" + this.title;
    };
    
    function saveRouteList(routes) {
        var routeObj = { dateCreated: Date.now(), routelist: routes};
        localStorage.setItem(ROUTE_LIST_KEY, JSON.stringify(routeObj));
        cachedRouteList = routes;
        setTimeout(function () {
            cachedRouteList = null;
        }, ROUTE_LIST_TIMEOUT);
    }
    
    function loadSavedRouteList() {
        var routesJSON = localStorage.getItem(ROUTE_LIST_KEY);
        if (routesJSON) {
            var routesObj = JSON.parse(routesJSON),
                dateCreated = parseInt(routesObj.dateCreated, 10),
                age = Date.now() - dateCreated;

            if (age < ROUTE_LIST_TIMEOUT) {
                cachedRouteList = routesObj.routelist;
                setTimeout(function () {
                    cachedRouteList = null;
                    localStorage.removeItem(ROUTE_LIST_KEY);
                }, ROUTE_LIST_TIMEOUT - age);
            } else {
                localStorage.removeItem(ROUTE_LIST_KEY);
            }
        }
    }
    
    function updateCachedRoutes() {
        var routeTagList = [],
            routeTag;
        
        for (routeTag in cachedRoutes) {
            if (cachedRoutes.hasOwnProperty(routeTag)) {
                routeTagList.push(routeTag);
            }
        }
        
        localStorage.setItem(ROUTE_KEY, JSON.stringify(routeTagList));
    }

    function saveRoute(route) {
        var routeJSONObj = route.toJSONObject(),
            routeObj = { dateCreated: Date.now(), route: routeJSONObj },
            routeTag = route.tag,
            routeKey = ROUTE_KEY + "." + routeTag;
        
        localStorage.setItem(routeKey, JSON.stringify(routeObj));
        cachedRoutes[routeTag] = route;
        updateCachedRoutes();
        
        setTimeout(function () {
            delete cachedRoutes[routeTag];
            localStorage.removeItem(routeKey);
            updateCachedRoutes();
        }, ROUTE_TIMEOUT);
    }
    
    function loadSavedRoutes() {
        var routeTagsJSON = localStorage.getItem(ROUTE_KEY);
        if (routeTagsJSON) {
            var routeTags = JSON.parse(routeTagsJSON);
            
            routeTags.forEach(function (routeTag) {
                var routeKey = ROUTE_KEY + "." + routeTag,
                    routeJSON = localStorage.getItem(routeKey),
                    routeObj = JSON.parse(routeJSON),
                    route = new Route(routeObj.route),
                    dateCreated = parseInt(routeObj.dateCreated, 10),
                    age = Date.now() - dateCreated;
                
                if (age < ROUTE_TIMEOUT) {
                    cachedRoutes[routeTag] = route;
                    setTimeout(function () {
                        delete cachedRoutes[routeTag];
                        localStorage.removeItem(routeKey);
                        updateCachedRoutes();
                    }, ROUTE_TIMEOUT - age);
                } else {
                    localStorage.removeItem(routeKey);
                }
                
            });
        }
        updateCachedRoutes();
    }
    
    function getRoutes() {
        var deferred = $.Deferred();
        
        if (cachedRouteList) {
            deferred.resolve(cachedRouteList);
        } else {
            cmdRouteList().done(function (data) {
                var routes  = [];
                
                $(data).find("route").each(function (i, r) {
                    var $route  = $(r),
                        tag     = $route.attr("tag"),
                        title   = $route.attr("title");
                        
                    routes.push({tag: tag, title: title});
                });
                
                saveRouteList(routes);
                deferred.resolve(routes);
            }).fail(deferred.reject.bind(deferred));
        }
        return deferred.promise();
    }
    
    function getRoute(tag) {
        var deferred = $.Deferred();
        
        if (cachedRoutes[tag]) {
            deferred.resolve(cachedRoutes[tag]);
        } else {
            cmdRouteConfig(tag, true).done(function (data) {
                var $data       = $(data),
                    $route      = $data.find("route"),
                    tag         = $route.attr("tag"),
                    title       = $route.attr("title"),
                    color       = $route.attr("color"),
                    opposite    = $route.attr("oppositeColor"),
                    directions  = {},
                    allStops    = {},
                    route;
                
                $route.children("stop").each(function (i, s) {
                    var $stop   = $(s),
                        id      = parseInt($stop.attr("stopId"), 10),
                        tag     = $stop.attr("tag"),
                        title   = $stop.attr("title"),
                        lat     = parseFloat($stop.attr("lat")),
                        lon     = parseFloat($stop.attr("lon"));
                    
                    allStops[tag] = new Stop(tag, title, lat, lon);
                });
                
                route = new Route(tag, title, allStops, directions, color, opposite);
                
                $route.children("direction").each(function (i, d) {
                    var $direction = $(d),
                        tag = $direction.attr("tag"),
                        title = $direction.attr("title"),
                        name = $direction.attr("name"),
                        stops = [];
                    
                    $direction.children("stop").each(function (i, s) {
                        var $stop = $(s),
                            stopTag = $stop.attr("tag");
                        
                        stops.push(allStops[stopTag]);
                    });
                    
                    directions[tag] = new Direction(route, tag, title, name, stops);
                });
                
                saveRoute(route);
                deferred.resolve(route);
            }).fail(deferred.reject.bind(deferred));
        }

        return deferred.promise();
    }
    
    loadSavedRouteList();
    loadSavedRoutes();
    
    exports.getRoutes = getRoutes;
    exports.getRoute = getRoute;
});