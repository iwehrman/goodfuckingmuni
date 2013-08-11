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
        var stop = new Stop(this.tag, this.title, this.lat, this.lon);
        stop._direction = this._direction;
        return stop;
    };
    
    Stop.prototype.toJSONObject = function () {
        var stop = this.clone();
        
        if (stop._direction) {
            delete stop._direction;
        }
        
        if (stop.next) {
            delete stop.next;
        }
        
        return stop;
    };
    
    Stop.prototype.distanceFrom = function (position) {
        return geo.distance(this, position);
    };
    
    Stop.prototype.nextLength = function () {
        if (this.next) {
            // TODO use more precise route information to calulate route edge length
            return this.distanceFrom(this.next);
        } else {
            throw new Error("There is no next stop");
        }
    };
    
    Stop.prototype.pathLength = function (targetStop) {
        var distance = 0;
        
        if (this === targetStop) {
            return distance;
        } else {
            var currentStop = this,
                nextStop = this.next;
            
            while (nextStop) {
                distance += currentStop.nextLength();
                if (nextStop === targetStop) {
                    return distance;
                } else {
                    currentStop = nextStop;
                    nextStop = nextStop.next;
                }
            }
            
            throw new Error("Target stop is not on path", targetStop);
        }
    };
    
    Stop.prototype.isApproaching = function (position) {
        var thisDist = this.distanceFrom(position),
            nextStop = this,
            nextDist;
        
        do {
            nextStop = nextStop.next;
        } while (nextStop && nextStop.distanceFrom(position) >= thisDist);
        
        return !!nextStop;
    };
    
    function Direction(route, objOrTag, title, name, stops) {
        var self = this;
        
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
                return route.stops[stopTag].clone();
            });
        }
        
        if (route) {
            this.stops.forEach(function (stop) {
                stop._direction = self;
            });
            
            var length = this.stops.length;
            this._route = route;
            this.stops.forEach(function (stop, index) {
                if (index + 1 < length) {
                    stop.next = self.stops[index + 1];
                }
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
    
    Direction.prototype.getClosestStop = function (position) {
        var minDist = Number.POSITIVE_INFINITY,
            closestStop = null;
        
        this.stops.forEach(function (stop) {
            var dist = stop.distanceFrom(position);
            
            if (dist < minDist) {
                minDist = dist;
                closestStop = stop;
            }
        });
        
        return closestStop;
    };
    
    Direction.prototype.getClosestApproachingStop = function (destPos, currPos) {
        var minDist = Number.POSITIVE_INFINITY,
            closestStop = null;
    
        this.stops.forEach(function (stop) {
            if (stop.isApproaching(destPos)) {
                var dist = stop.distanceFrom(currPos);
                
                if (dist < minDist) {
                    minDist = dist;
                    closestStop = stop;
                }
            }
        });
        
        return closestStop;
    };
    
    Direction.prototype.getJourney = function (destPos, currPos) {
        var arrivalStop = this.getClosestStop(destPos),
            departureStop = this.getClosestApproachingStop(destPos, currPos);
        
        try {
            var currentToDeparture = departureStop.distanceFrom(currPos),
                arrivalToDestination = arrivalStop.distanceFrom(destPos),
                pathLength = departureStop.pathLength(arrivalStop),
                walkingLength = currentToDeparture + arrivalToDestination;
            
            if (walkingLength > geo.distance(destPos, currPos)) {
                return null;
            }
            
            return {
                arrival: arrivalStop,
                departure: departureStop,
                currentToDeparture: currentToDeparture,
                arrivalToDestination: arrivalToDestination,
                pathLength: pathLength,
                walkingLength: walkingLength,
                totalLength: pathLength + walkingLength
            };
        } catch (err) {
            return null;
        }
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
            try {
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
            } catch (err) {
                console.warn("Unable to load saved route list: ", err);
                console.warn("Route list JSON: " + routesJSON);
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
                    routeJSON = localStorage.getItem(routeKey);
                try {
                    var routeObj = JSON.parse(routeJSON),
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
                } catch (err) {
                    console.warn("Unable to load saved route: ", err);
                    console.warn("Route JSON: ", routeJSON);
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
                        
                        stops.push(allStops[stopTag].clone());
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
