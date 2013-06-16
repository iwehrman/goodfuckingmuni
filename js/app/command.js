/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "app/geolocation"], function ($, geolocation) {
    "use strict";
    
    var locationPromise = geolocation.getLocation();
       
    function defineCommand(commandName, args) {
        function commandURL(commandName) {
            var baseURL = "http://webservices.nextbus.com/service/publicXMLFeed?a=sf-muni",
                fullURL = baseURL + "&command=" + commandName;
            
            if (arguments.length > 1) {
                var params  = Array.prototype.slice.call(arguments, 1),
                    query   = params.map(function (param) {
                        var key = encodeURIComponent(param[0]),
                            val = encodeURIComponent(param[1]);
                        return key + "=" + val;
                    }).join("&");
                fullURL += "&" + query;
            }
            return fullURL;
        }
        
        function doCommand(commandName) {
            var routeUrl        = commandURL.apply(null, arguments),
                routeSettings   = {
                    datatype: "xml"
                };
            
            return $.ajax(routeUrl, routeSettings).fail(function (jqXHR, textStatus, errorThrown) {
                console.error("Command " + commandName + " failed: " + textStatus);
            });
        }
        
        return function () {
            var vals = Array.prototype.slice.apply(arguments),
                params = vals.map(function (val, index) {
                    return [args[index], val];
                });
            
            params.unshift(commandName);
            return doCommand.apply(null, params);
        };
    }
    
    var cmdRouteList = defineCommand("routeList"),
        cmdRouteConfig = defineCommand("routeConfig", ["r", "terse"]),
        cmdPredictions = defineCommand("predictions", ["r", "s"]);
    
    function getRoutes() {
        var deferred = $.Deferred();
        
        cmdRouteList().done(function (data) {
            var routes  = [];
            
            $(data).find("route").each(function (i, r) {
                var $route  = $(r),
                    tag     = $route.attr("tag"),
                    title   = $route.attr("title");
                    
                routes.push({tag: tag, title: title});
            });
            deferred.resolve(routes);
        }).fail(deferred.reject.bind(deferred));
        
        return deferred.promise();
    }
    
    function getRoute(tag) {
        var deferred = $.Deferred();
        
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
                        dist    = geolocation.distance(position, stopPos);
                    
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
                        title:  title,
                        name:   name,
                        stops:  stops,
                        maxDist: maxDist,
                        minDist: minDist
                    };
                });
                
                deferred.resolve({
                    tag:            tag,
                    title:          title,
                    color:          color,
                    oppositeColor:  opposite,
                    directions:     directions,
                    stops:          allStops
                });
                
            }).fail(deferred.reject.bind(deferred));
        }).fail(deferred.reject.bind(deferred));
            
        return deferred.promise();
    }
    
    function getPredictions(routeTag, stopTag) {
        var deferred = $.Deferred();
        
        cmdPredictions(routeTag, stopTag).done(function (data) {
            var predictions  = [];
            
            $(data).find("prediction").each(function (i, p) {
                var $prediction  = $(p),
                    epochTime = parseInt($prediction.attr("epochTime"), 10),
                    seconds = parseInt($prediction.attr("seconds"), 10),
                    minutes = parseInt($prediction.attr("minutes"), 10),
                    isDeparture = $prediction.attr("isDeparture") === "true",
                    affectedByLayover = $prediction.attr("affectedByLayover") === "true";
                    
                predictions.push({
                    epochTime: epochTime,
                    seconds: seconds,
                    minutes: minutes,
                    isDeparture: isDeparture,
                    affectedByLayover: affectedByLayover
                });
            });
            deferred.resolve(predictions);
        }).fail(deferred.reject.bind(deferred));
        
        return deferred.promise();
    }
    
    return {
        getRoutes: getRoutes,
        getRoute: getRoute,
        getPredictions: getPredictions
    };
});