/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        geo = require("app/geolocation"),
        command = require("app/command");

    var ROUTE_LIST_TIMEOUT = 1000 * 60 * 60 * 24 * 365, // 1 year
        ROUTE_TIMEOUT = 1000 * 60 * 60 * 24; // 1 day
    
    var ROUTE_LIST_KEY = "org.wehrman.muni.routelist",
        ROUTE_KEY = "org.wehrman.muni.routes";
    
    var cachedRouteList = null,
        cachedRoutes = {};
    
    var locationPromise = geo.getLocation();
    
    var cmdRouteList = command.defineCommand("routeList"),
        cmdRouteConfig = command.defineCommand("routeConfig", ["r", "terse"]);
    
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
            }
        }
    }

    function saveRoute(route) {
        var routeObj = { dateCreated: Date.now(), route: route},
            routeTag = route.tag,
            routeKey = ROUTE_KEY + "." + routeTag;
        localStorage.setItem(routeKey, JSON.stringify(routeObj));
        cachedRoutes[routeTag] = route;
        setTimeout(function () {
            cachedRoutes[routeTag] = null;
        }, ROUTE_TIMEOUT);
    }
    
    function loadSavedRoutes() {
        
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
                    allStops    = {};
                
                $route.children("stop").each(function (i, s) {
                    var $stop   = $(s),
                        id      = parseInt($stop.attr("stopId"), 10),
                        tag     = $stop.attr("tag"),
                        title   = $stop.attr("title"),
                        lat     = parseFloat($stop.attr("lat")),
                        lon     = parseFloat($stop.attr("lon"));
                    
                    allStops[tag] = {
                        title:  title,
                        lat:    lat,
                        lon:    lon
                    };
                });
                
                $route.children("direction").each(function (i, d) {
                    var $direction = $(d),
                        tag = $direction.attr("tag"),
                        title = $direction.attr("title"),
                        name = $direction.attr("name"),
                        stops = [];
                    
                    $direction.children("stop").each(function (i, s) {
                        var $stop = $(s),
                            stopTag = $stop.attr("tag");
                        
                        stops.push(stopTag);
                    });
                    
                    directions[tag] = {
                        tag: tag,
                        title:  title,
                        name:   name,
                        stops:  stops
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
