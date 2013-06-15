/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "jquery.alpha", "jquery.beta"], function ($) {
    "use strict";
    
    var STOPS_KEY = "org.wehrman.goodfuckingmuni.stops";
    
    var $body = $("body"),
        $stops = $body.find(".content-stops"),
        $directions = $body.find(".content-directions"),
        $routelist = $body.find(".content-routes"),
        routesPromise,
        locationPromise;
    
    function getAllStoredStops(routeTag, directionTag) {
        var storeJSON = localStorage.getItem(STOPS_KEY),
            store = storeJSON ? JSON.parse(storeJSON) : {};
        
        if (!store[routeTag]) {
            store[routeTag] = {};
        }
        
        if (!store[routeTag][directionTag]) {
            store[routeTag][directionTag] = {};
        }
        
        return store;
    }
    
    function getStoredStops(routeTag, directionTag) {
        var store = getAllStoredStops(routeTag, directionTag);
        
        return store[routeTag][directionTag];
    }
    
    function updateStoredStop(routeTag, directionTag, callback) {
        var store = getAllStoredStops(routeTag, directionTag);
        
        callback(store[routeTag][directionTag]);
        
        localStorage.setItem(STOPS_KEY, JSON.stringify(store));
    }
    
    function rememberStop(routeTag, directionTag, stopTag) {
        var _store;
        updateStoredStop(routeTag, directionTag, function (store) {
            store[stopTag] = true;
            _store = store;
        });
        return _store;
    }
    
    function forgetStop(routeTag, directionTag, stopTag) {
        var _store;
        updateStoredStop(routeTag, directionTag, function (store) {
            if (store[stopTag]) {
                delete store[stopTag];
            }
            _store = store;
        });
        return _store;
    }
        
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
    
    function distance(pos1, pos2) {
        function toRad(x) {
            return x * Math.PI / 180;
        }
        
        var lat1 = pos1.lat,
            lat2 = pos2.lat,
            lon1 = pos1.lon,
            lon2 = pos2.lon;
        
        var R = 6371; // Radius of the earth in km
        var dLat = toRad(lat2 - lat1);  // Javascript functions in radians
        var dLon = toRad(lon2 - lon1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in km
        
        return d;
    }
    
    function positionComparator(main) {
        return function (pos1, pos2) {
            var dist1 = distance(main, pos1),
                dist2 = distance(main, pos2);
            
            return dist2 - dist1;
        };
    }
    
    function getRoutes() {
        var deferred = $.Deferred();
        
        doCommand("routeList").done(function (data) {
            var routes  = [];
            
            $(data).find("route").each(function (i, r) {
                var $route  = $(r),
                    tag     = $route.attr("tag"),
                    title   = $route.attr("title");
                    
                routes.push({tag: tag, title: title});
            });
            deferred.resolve(routes);
        }).fail(deferred.reject);
        
        return deferred.promise();
    }
    
    function getRoute(tag) {
        var deferred = $.Deferred();
        
        doCommand("routeConfig",  ["r", tag]).done(function (data) {
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
                        tag     = $stop.attr("tag"),
                        title   = $stop.attr("title"),
                        lat     = parseFloat($stop.attr("lat")),
                        lon     = parseFloat($stop.attr("lon")),
                        stopPos = {lat: lat, lon: lon},
                        dist    = distance(position, stopPos);
                    
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
    
    function showStopsForDirection(route, dirTag) {
        var direction = route.directions[dirTag],
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + direction.title + "</h2>"),
            $list = $("<ul class='topcoat-list'></ul>"),
            storedStops = getStoredStops(route.tag, dirTag);
        
        function normalizeDist(direction, stop) {
            var range = direction.maxDist - direction.minDist,
                fromMin = stop.dist - direction.minDist;
            
            return 1 - (fromMin / range);
        }
        
        direction.stops.forEach(function (stopTag) {
            var stop = route.stops[stopTag],
                norm = normalizeDist(direction, stop),
                $item = $("<li class='topcoat-list__item entry-stop' data-tag='" +
                          stopTag + "'>"),
                $text = $("<span>").append(stop.title);
            
            if (norm === 1) {
                $text.addClass("closest");
            }
            
            if (storedStops[stopTag]) {
                $text.addClass("stored");
            }
            
            $item.on("click", function () {
                if (storedStops[stopTag]) {
                    $text.removeClass("stored");
                    storedStops = forgetStop(route.tag, dirTag, stopTag);
                } else {
                    $text.addClass("stored");
                    storedStops = rememberStop(route.tag, dirTag, stopTag);
                }
            });
            
            $item.append($text);
            $list.append($item);
        });
        
        $container.append($header).append($list);
        $stops.append($container);
        $stops.show();
        
        var stateObj = { route: route, direction: dirTag };
        history.pushState(stateObj, undefined, "#route=" + route.tag + "&direction=" + dirTag);
    }
    
    function showDirections(routes, route) {
        var $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + route.title + "</h2>"),
            $list = $("<ul class='topcoat-list route-directions'></ul>"),
            direction,
            tag;
        
        for (tag in route.directions) {
            if (route.directions.hasOwnProperty(tag)) {
                direction = route.directions[tag];
                
                $list.append("<li class='topcoat-list__item entry-direction' data-tag='" +
                         tag + "'>" + direction.title + "</li>");
            }
        }
        
        $container.append($header).append($list);
        $directions.append($container);
        $directions.show();
        
        var stateObj = { routes: routes, route: route };
        history.pushState(stateObj, "Route: " + route.title, "#route=" + route.tag);
        
        $directions.find(".entry-direction").each(function (i, d) {
            var $direction = $(d),
                tag = $direction.data("tag");
            
            $direction.on("click", function () {
                $directions.hide();
                $directions.empty();
                showStopsForDirection(route, tag);
            });
        });
    }

    function showRoutes(routes) {
        var $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>Routes</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");

        routes.forEach(function (route) {
            $list.append("<li class='topcoat-list__item entry-route' data-tag='" +
                         route.tag + "'>" + route.title + "</li>");
        });
        
        $container.append($header).append($list);
        $routelist.append($container);
        $routelist.show();
        history.pushState({ routes: routes }, "Routes", "/");
        
        $routelist.find(".entry-route").each(function (i, r) {
            var $route = $(r),
                tag = $route.data("tag");
            
            $route.on("click", function () {
                getRoute(tag).done(function (route) {
                    $routelist.hide();
                    $routelist.empty();
                    showDirections(routes, route);
                });
            });
        });
    }
    
    window.onpopstate = function (event) {
        var state = event.state;
        
        if (state.route) {
            $stops.hide();
            $stops.empty();
            history.pushState({ routes: state.routes }, "Routes", "/");
            showDirections(state.routes, state.route);
        } else if (state.routes) {
            $directions.hide();
            $directions.empty();
            showRoutes(state.routes);
        }
    };
    
    routesPromise = getRoutes();
    locationPromise = (function () {
        var deferred = $.Deferred();
        
        navigator.geolocation.getCurrentPosition(function (position) {
            position.coords.lat = position.coords.latitude;
            position.coords.lon = position.coords.longitude;
            deferred.resolve(position.coords, position.timestamp);
        }, function (error) {
            console.error("Unable to geolocate: " + error);
            deferred.reject(error);
        }, {
            enableHighAccuracy: true,
            timeout: undefined,
            maximumAge: 1000 * 60 * 5
        });
        
        return deferred.promise();
    }());

        
    $(function () {
        //$('body').alpha().beta();
        routesPromise.done(showRoutes);
    });
    
});