/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        geo = require("app/geolocation"),
        command = require("app/command");

    var ROUTE_LIST_TIMEOUT = 1000 * 60 * 60 * 24 * 7, // 1 week
        ROUTE_TIMEOUT = 1000 * 60 * 60 * 24; // 1 day
    
    var cachedRouteList = null,
        cachedRoutes = {};
    
    var locationPromise = geo.getLocation();
    
    var cmdRouteList = command.defineCommand("routeList"),
        cmdRouteConfig = command.defineCommand("routeConfig", ["r", "terse"]);
    
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
                
                cachedRouteList = routes;
                setTimeout(function () {
                    cachedRouteList = null;
                }, ROUTE_LIST_TIMEOUT);
                
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
                    allStops    = {};
                
                locationPromise.done(function (position, timestamp) {
                    $route.children("stop").each(function (i, s) {
                        var $stop   = $(s),
                            id      = parseInt($stop.attr("stopId"), 10),
                            tag     = $stop.attr("tag"),
                            title   = $stop.attr("title"),
                            lat     = parseFloat($stop.attr("lat")),
                            lon     = parseFloat($stop.attr("lon")),
                            stopPos = {lat: lat, lon: lon},
                            dist    = geo.distance(position, stopPos);
                        
                        allStops[tag] = {
                            title:  title,
                            lat:    lat,
                            lon:    lon,
                            dist:   dist
                        };
                    });
                    
                    $route.children("direction").each(function (i, d) {
                        var $direction = $(d),
                            tag = $direction.attr("tag"),
                            title = $direction.attr("title"),
                            name = $direction.attr("name"),
                            stops = [];
                        
                        var minDist = Number.POSITIVE_INFINITY,
                            maxDist = Number.NEGATIVE_INFINITY;
                        
                        $direction.children("stop").each(function (i, s) {
                            var $stop = $(s),
                                stopTag = $stop.attr("tag"),
                                stop = allStops[stopTag];
                            
                            stops.push(stopTag);
                            
                            if (stop.dist > maxDist) {
                                maxDist = stop.dist;
                            }
                            
                            if (stop.dist < minDist) {
                                minDist = stop.dist;
                            }
                        });
                        
                        directions[tag] = {
                            tag: tag,
                            title:  title,
                            name:   name,
                            stops:  stops,
                            maxDist: maxDist,
                            minDist: minDist
                        };
                    });
                                        
                    var route = {
                        tag:            tag,
                        title:          title,
                        color:          color,
                        oppositeColor:  opposite,
                        directions:     directions,
                        stops:          allStops
                    };
                    
                    cachedRoutes[tag] = route;
                    setTimeout(function () {
                        cachedRoutes[tag] = null;
                    }, ROUTE_TIMEOUT);
                    
                    deferred.resolve(route);
                    
                }).fail(deferred.reject.bind(deferred));
            }).fail(deferred.reject.bind(deferred));
        }

        return deferred.promise();
    }
    
    exports.getRoutes = getRoutes;
    exports.getRoute = getRoute;
});
