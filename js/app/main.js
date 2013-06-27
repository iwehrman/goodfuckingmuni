/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "async", "app/command", "app/places", "app/geolocation", "app/weather"], function ($, async, command, places, geo, weather) {
    "use strict";
    
    var $body = $("body"),
        $places = $body.find(".content-places"),
        $placeStops = $body.find(".content-places"),
        $routeStops = $body.find(".content-route-stops"),
        $directions = $body.find(".content-directions"),
        $routes = $body.find(".content-routes"),
        $predictions = $body.find(".content-predictions");
    
    function showPredictions(routeTag, dirTag, stopTag) {
        command.getRoute(routeTag).done(function (route) {
            command.getPredictions(routeTag, stopTag).done(function (predictions) {
                var stop = route.stops[stopTag],
                    direction = route.directions[dirTag],
                    $container = $("<div class='topcoat-list__container'></div>"),
                    $header = $("<h2 class='topcoat-list__header'>" + route.title +
                                " &gt; " + direction.title + " &gt; " + stop.title + "</h2>"),
                    $list = $("<ul class='topcoat-list'></ul>");
                
                predictions.forEach(function (prediction, index) {
                    var $item = $("<li class='topcoat-list__item entry-prediction'>"),
                        $text = $("<span>").append(prediction.minutes + " minutes");
                    
                    if (index === 0) {
                        $text.addClass("closest");
                    }
                    
                    $item.append($text);
                    $list.append($item);
                });
                
                $container.append($header).append($list);
                $predictions.append($container);
                $predictions.show();
            }).fail(function (err) {
                console.error("[showPredictions] failed to get predictions: " + err);
            });
        }).fail(function (err) {
            console.error("[showPredictions] failed to get route: " + err);
        });
    }
        
    function showStops(routeTag, dirTag, scroll, callback) {
        if (!callback) {
            callback = showPredictions;
        }
        
        command.getRoute(routeTag).done(function (route) {
            var direction = route.directions[dirTag],
                $container = $("<div class='topcoat-list__container'></div>"),
                $header = $("<h2 class='topcoat-list__header'>" + route.title +
                            " &gt; " + direction.title + "</h2>"),
                $list = $("<ul class='topcoat-list'></ul>");
            
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
                
                $item.on("click", function () {
                    var stateObj = { routeTag: routeTag, dirTag: dirTag, stopTag: stopTag };
                    history.pushState(stateObj, null, "#r=" + routeTag + "&d=" + dirTag + "&s=" + stopTag);
                    
                    $routeStops.hide();
                    $routeStops.empty();
                    callback(routeTag, dirTag, stopTag);
                });
                
                $item.append($text);
                $list.append($item);
            });
            
            $container.append($header).append($list);
            $routeStops.append($container);
            $routeStops.show();
            
            if (scroll) {
                $body.animate({
                    scrollTop: $list.find(".closest").parent().offset().top - $body.scrollTop()
                });
            }
        }).fail(function (err) {
            console.error("[showStops] failed to get route: " + err);
        });
    }
    
    function showDirections(routeTag, callback) {
        if (!callback) {
            callback = showStops;
        }
        
        command.getRoute(routeTag).done(function (route) {
            var $container = $("<div class='topcoat-list__container'></div>"),
                $header = $("<h2 class='topcoat-list__header'>" + route.title + "</h2>"),
                $list = $("<ul class='topcoat-list route-directions'></ul>"),
                direction,
                dirTag,
                $item,
                $text;
            
            function clickHandler(dirTag) {
                return function () {
                    var stateObj = { routeTag: routeTag, dirTag: dirTag };
                    history.pushState(stateObj, null, "#r=" + routeTag + "&d=" + dirTag);
                    
                    $directions.hide();
                    $directions.empty();
                    callback(routeTag, dirTag, true);
                };
            }
            
            for (dirTag in route.directions) {
                if (route.directions.hasOwnProperty(dirTag)) {
                    direction = route.directions[dirTag];
                    $item = $("<li class='topcoat-list__item entry-direction' data-tag='" +
                             dirTag + "'>");
                    $text = $("<span>").append(direction.title);
                
                    $item.append($text);
                    $list.append($item);
                    
                    $item.on("click", clickHandler(dirTag));
                }
            }
            
            $container.append($header).append($list);
            $directions.append($container);
            $directions.show();
        }).fail(function (err) {
            console.error("[showDirections] failed to get route: " + err);
        });
    }

    function showRoutes(callback) {
        if (!callback) {
            callback = showDirections;
        }
        
        command.getRoutes().done(function (routes) {
            var $container = $("<div class='topcoat-list__container'></div>"),
                $header = $("<h2 class='topcoat-list__header'>Routes</h2>"),
                $list = $("<ul class='topcoat-list'></ul>");
    
            routes.forEach(function (route) {
                var $item = $("<li class='topcoat-list__item entry-route' data-tag='" +
                             route.tag + "'>"),
                    $text = $("<span>").append(route.title);
                
                $item.append($text);
                $list.append($item);
                
                $item.on("click", function () {
                    var stateObj = { routeTag: route.tag };
                    history.pushState(stateObj, null, "#r=" + route.tag);
                    
                    $routes.hide();
                    $routes.empty();
                    callback(route.tag);
                });
            });
            
            $container.append($header).append($list);
            $routes.append($container);
            $routes.show();
        }).fail(function (err) {
            console.error("[showRoutes] failed to get routes: " + err);
        });
    }
    
    function showPlace(placeId) {
        var place = places.getPlace(placeId),
            predictionsPromise = command.getPredictionsForMultiStops(place.stops),
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + place.title + "</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");
        
        async.map(place.stops, function (stopObj, callback) {
            command.getRoute(stopObj.routeTag).done(function (route) {
                callback(null, {
                    route: route,
                    dirTag: stopObj.dirTag,
                    stopTag: stopObj.stopTag
                });
            }).fail(function (err) {
                callback(err);
            });
            
        }, function (err, routeObjs) {
            if (err) {
                console.error("[showPlace] failed to get routes: " + err);
                return;
            }
            
            predictionsPromise.done(function (predictionObjs) {
                routeObjs.forEach(function (routeObj, index) {
                    var predictions = predictionObjs[index],
                        route = routeObj.route,
                        routeTag = route.tag,
                        stopTag = routeObj.stopTag,
                        dirTag = routeObj.dirTag,
                        stop = route.stops[stopTag],
                        $item = $("<li class='topcoat-list__item entry-place-stop' data-stopTag='" +
                                 stopTag + "' data-routeTag='" + routeTag + "'>"),
                        $routeTitle = $("<div>").append(route.title).addClass("entry-place-stop__route"),
                        $stopTitle = $("<div>").append(stop.title).addClass("entry-place-stop__stop"),
                        $title = $("<div>").append($stopTitle).append($routeTitle).addClass("entry-place-stop__title"),
                        $times = predictions.map(function (prediction) {
                            return $("<span>").append(prediction.minutes).addClass("entry-place-stop__minutes");
                        }),
                        $predictions = $("<div>").append($times).addClass("entry-place-stop__predictions"),
                        $text = $("<div>")
                            .addClass("entry-place-stop__content")
                            .append($title)
                            .append($predictions);

                    $item.append($text);
                    $list.append($item);
                    
                    $item.on("click", function () {
                        var stateObj = {
                            placeId: placeId,
                            routeTag: routeTag,
                            dirTag: dirTag,
                            stopTag: stopTag
                        };
                        history.pushState(stateObj, null, "#p=" + placeId + "&#r=" + routeTag + "&d=" + dirTag + "&s=" + stopTag);
                        
                        $places.hide();
                        $places.empty();
                        showPredictions(routeTag, dirTag, stopTag);
                    });
                });
                
                var $item = $("<li class='topcoat-list__item'>"),
                    $text = $("<span>").append("Add new stop");
                
                $item.append($text);
                $list.append($item);
                
                $item.on("click", function () {
                    function routeHandler(routeTag) {
                        function directionHandler(routeTag, dirTag) {
                            function stopHandler(routeTag, dirTag, stopTag) {
                                place.addStop(routeTag, dirTag, stopTag);
                                showPlace(placeId);
                            }
                            showStops(routeTag, dirTag, true, stopHandler);
                        }
                        showDirections(routeTag, directionHandler);
                    }
                    
                    $places.hide();
                    $places.empty();
                    showRoutes(routeHandler);
                });
                
                $container.append($header).append($list);
                $places.append($container);
                $places.show();
            }).fail(function (err) {
                console.error("[showPlace] failed to get predictions: " + err);
            });
        });
    }
    
    function showPlaces() {
        var placeList = places.getAllPlaces(),
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>Places</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");

        geo.sortByCurrentLocation(placeList).done(function (position) {
            placeList.forEach(function (place) {
                var $item = $("<li class='topcoat-list__item entry-place' data-tag='" +
                             place.id + "'>"),
                    distance = geo.formatDistance(geo.distance(position, place)),
                    $text = $("<span>").append(place.title + " (" + distance + ")");
                
                $item.append($text);
                $list.append($item);
                
                $item.on("click", function () {
                    var stateObj = { placeId: place.id };
                    history.pushState(stateObj, null, "#p=" + place.id);
                    
                    $places.hide();
                    $places.empty();
                    showPlace(place.id);
                });
            });
            
            var $item = $("<li class='topcoat-list__item'>"),
                $text = $("<span>").append("Add new place");
            
            $item.append($text);
            $list.append($item);
            
            $item.on("click", function () {
                var name = window.prompt("Place name: ", "");
                
                places.addPlace(name).done(function (place) {
                    var stateObj = { placeId: place.id };
                    history.pushState(stateObj, null, "#p=" + place.id);
                    
                    $places.hide();
                    $places.empty();
                    showPlace(place.id);
                }).fail(function (err) {
                    console.error("[showPlaces] failed to add place: " + err);
                });
                
            });
            
            $container.append($header).append($list);
            $places.append($container);
            $places.show();
        }).fail(function (err) {
            console.error("[showPlaces] failed to geolocate: " + err);
        });
    }
    
    window.onpopstate = function (event) {
        var state = event.state;

        if (state) {
            if (state.placeId) {
                $predictions.hide();
                $predictions.empty();
                showPlace(state.placeId);
            } else if (state.dirTag) {
                $predictions.hide();
                $predictions.empty();
                showStops(state.routeTag, state.dirTag);
            } else if (state.routeTag) {
                $routeStops.hide();
                $routeStops.empty();
                showDirections(state.routeTag);
            }
        } else {
            $placeStops.hide();
            $placeStops.empty();
            showPlaces();
        }
    };
    
    function loadDarkStylesheet() {
        weather.isDaytime().done(function (daytime) {
            if (!daytime) {
                var $link = $("<link rel='stylesheet' type='text/css' href='css/topcoat-mobile-dark.min.css'>");
                $body.append($link);
            }
        });
    }
    
    function getHashParams() {
        var hash = window.location.hash,
            params;
        
        if (hash) {
            params = hash.substring(1).split("&").reduce(function (obj, eq) {
                var terms = eq.split("=");
                obj[terms[0]] = terms[1];
                return obj;
            }, {});
        } else {
            params = {};
        }
        
        return params;
    }
    
    function loadFromHashParams() {
        var params = getHashParams();
        if (params.p) {
            showPlace(parseInt(params.p, 10));
        } else {
            if (params.r) {
                if (params.d) {
                    if (params.s) {
                        showPredictions(params.r, params.d, params.s);
                    } else {
                        showStops(params.r, params.d, true);
                    }
                } else {
                    showDirections(params.r);
                }
            } else {
                showPlaces();
            }
        }
    }

    $(function () {
        loadDarkStylesheet();
        loadFromHashParams();
    });
});
