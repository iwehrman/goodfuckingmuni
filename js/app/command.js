/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        geo = require("app/geolocation");

    var ROUTE_LIST_TIMEOUT = 1000 * 60 * 60 * 24 * 7, // 1 week
        ROUTE_TIMEOUT = 1000 * 60 * 60 * 24, // 1 day
        PREDICTION_TIMEOUT = 1000 * 60; // 1 minute
    
    var cachedRouteList = null,
        cachedRoutes = {},
        cachedPredictions = {},
        cachedPromises = {};
    
    var locationPromise = geo.getLocation();
       
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
                promise         = cachedPromises[routeUrl];
            
            if (!promise) {
                var settings = { datatype: "xml" };
                promise = $.ajax(routeUrl, settings)
                    .always(function () {
                        delete cachedPromises[routeUrl];
                    })
                    .fail(function (jqXHR, textStatus, errorThrown) {
                        console.error("Command " + commandName + " failed: " + textStatus);
                    });
            }
            
            return promise;
        }
        
        return function () {
            var vals = Array.prototype.slice.apply(arguments),
                params = vals.map(function (val, index) {
                    // zip params and arguments
                    return [args[index], val];
                }).reduce(function (prev, next) {
                    // expand array arguments
                    var arg = next[0],
                        valArray = [].concat(next[1]);
                    
                    valArray.forEach(function (val) {
                        prev.push([arg, val]);
                    });
                    return prev;
                }, []);
            
            params.unshift(commandName);
            return doCommand.apply(null, params);
        };
    }
    
    var cmdRouteList = defineCommand("routeList"),
        cmdRouteConfig = defineCommand("routeConfig", ["r", "terse"]),
        cmdPredictions = defineCommand("predictions", ["r", "s"]),
        cmdPredictionsForMultiStops = defineCommand("predictionsForMultiStops", ["stops"]);
    
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
    
    function handlePredictionData(data) {
        var predictions = [];
                
        $(data).find("prediction").each(function (i, p) {
            var $prediction  = $(p),
                dirTag = $prediction.attr("dirTag"),
                epochTime = parseInt($prediction.attr("epochTime"), 10),
                seconds = parseInt($prediction.attr("seconds"), 10),
                minutes = parseInt($prediction.attr("minutes"), 10),
                isDeparture = $prediction.attr("isDeparture") === "true",
                affectedByLayover = $prediction.attr("affectedByLayover") === "true";
                
            predictions.push({
                dirTag: dirTag,
                epochTime: epochTime,
                seconds: seconds,
                minutes: minutes,
                isDeparture: isDeparture,
                affectedByLayover: affectedByLayover
            });
        });
        
        return predictions.sort(function (a, b) {
            return a.minutes - b.minutes;
        });
    }
    
    function cachePredictions(routeTag, stopTag, predictions) {
        cachedPredictions[routeTag][stopTag] = predictions;
        setTimeout(function () {
            delete cachedPredictions[routeTag][stopTag];
        }, PREDICTION_TIMEOUT);
    }
    
    function getPredictions(routeTag, stopTag) {
        var deferred = $.Deferred();
        
        if (!cachedPredictions[routeTag]) {
            cachedPredictions[routeTag] = {};
        }

        if (cachedPredictions[routeTag][stopTag]) {
            deferred.resolve(cachedPredictions[routeTag][stopTag]);
        } else {
            cmdPredictions(routeTag, stopTag).done(function (data) {
                var predictions = handlePredictionData(data);
                cachePredictions(routeTag, stopTag, predictions);
                deferred.resolve(predictions);
            }).fail(deferred.reject.bind(deferred));
        }
        
        return deferred.promise();
    }
    
    function getPredictionsForMultiStops(stopObjs) {
        var deferred = $.Deferred(),
            predictionsForMultiStops = {},
            uncachedStopObjs = [];
        
        stopObjs.forEach(function (stopObj) {
            var routeTag = stopObj.routeTag,
                stopTag = stopObj.stopTag;
            
            if (!cachedPredictions[routeTag]) {
                cachedPredictions[routeTag] = {};
            }
            
            if (!cachedPredictions[routeTag][stopTag]) {
                uncachedStopObjs.push(stopObj);
            } else {
                if (!predictionsForMultiStops[routeTag]) {
                    predictionsForMultiStops[routeTag] = {};
                }
                predictionsForMultiStops[routeTag][stopTag] = cachedPredictions[routeTag][stopTag];
            }
        });
        
        if (uncachedStopObjs.length > 0) {
            var stopParams = uncachedStopObjs.map(function (stopObj) {
                return stopObj.routeTag + "|" + stopObj.stopTag;
            });
            
            cmdPredictionsForMultiStops(stopParams).done(function (data) {
                $(data).find("predictions").each(function (i, d) {
                    var $data = $(d),
                        predictions = handlePredictionData(d),
                        routeTag = $data.attr("routeTag"),
                        stopTag = $data.attr("stopTag");
                    
                    cachePredictions(routeTag, stopTag, predictions);
                    if (!predictionsForMultiStops[routeTag]) {
                        predictionsForMultiStops[routeTag] = {};
                    }
                    predictionsForMultiStops[routeTag][stopTag] = predictions;
                });
                
                deferred.resolve(predictionsForMultiStops);
            });
        } else {
            deferred.resolve(predictionsForMultiStops);
        }

        return deferred.promise();
    }
    
    return {
        getRoutes: getRoutes,
        getRoute: getRoute,
        getPredictions: getPredictions,
        getPredictionsForMultiStops: getPredictionsForMultiStops
    };
});
