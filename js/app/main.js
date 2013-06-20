/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "async", "app/command", "app/places"], function ($, async, command, places) {
    "use strict";
    
    var $body = $("body"),
        $placelist = $body.find(".content-places"),
        $stops = $body.find(".content-stops"),
        $directions = $body.find(".content-directions"),
        $routelist = $body.find(".content-routes"),
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
            });
        });
    }
        
    function showStops(routeTag, dirTag, scroll) {
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
                    
                    $stops.hide();
                    $stops.empty();
                    showPredictions(routeTag, dirTag, stopTag);
                });
                
                $item.append($text);
                $list.append($item);
            });
            
            $container.append($header).append($list);
            $stops.append($container);
            $stops.show();
            
            if (scroll) {
                $body.animate({
                    scrollTop: $list.find(".closest").parent().offset().top - $body.scrollTop()
                });
            }
        });
    }
    
    function showDirections(routeTag) {
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
                    showStops(routeTag, dirTag, true);
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
        });
    }

    function showRoutes() {
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
                    
                    $routelist.hide();
                    $routelist.empty();
                    showDirections(route.tag);
                });
            });
            
            $container.append($header).append($list);
            $routelist.append($container);
            $routelist.show();
        });
    }
    
    function showPlace(placeId) {
        var place = places.getPlaces(placeId),
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>" + place.title + "</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");

        function handleStopClick(place) {
            var stateObj = { place: place };
            history.pushState(stateObj, null, "#p=" + place.id);
            
            $placelist.hide();
            $placelist.empty();
            showPlace(place.id);
        }
        
        async.map(place.stops, function (stopObj, callback) {
            var stopTag = stopObj.stopTag,
                routeTat = stopObj.routeTag,
                $item = $("<li class='topcoat-list__item entry-place' data-tag='" +
                         place.id + "'>"),
                $text = $("<span>").append(place.title);
            
            $item.append($text);
            $item.on("click", handleStopClick);
            callback(null, $item);
        }, function (err, items) {
            items.forEach(function ($item) {
                $list.append($item);
            });
        });
        
        var $item = $("<li class='topcoat-list__item entry-place'>"),
            $text = $("<span>").append("Add new place");
        
        $item.append($text);
        $list.append($item);
        
        $item.on("click", function () {
            var name = window.prompt("Place name: ", "");
            places.addPlace(name).done(handleStopClick);
        });
        
        $container.append($header).append($list);
        $placelist.append($container);
        $placelist.show();
    }
    
    function showPlaces() {
        var placeList = places.getAllPlaces(),
            $container = $("<div class='topcoat-list__container'></div>"),
            $header = $("<h2 class='topcoat-list__header'>Places</h2>"),
            $list = $("<ul class='topcoat-list'></ul>");

        placeList.forEach(function (place) {
            var $item = $("<li class='topcoat-list__item entry-place' data-tag='" +
                         place.id + "'>"),
                $text = $("<span>").append(place.title);
            
            $item.append($text);
            $list.append($item);
            
            $item.on("click", function () {
                var stateObj = { place: place };
                history.pushState(stateObj, null, "#p=" + place.id);
                
                $placelist.hide();
                $placelist.empty();
                showPlace(place);
            });
        });
        
        var $item = $("<li class='topcoat-list__item entry-place'>"),
            $text = $("<span>").append("Add new place");
        
        $item.append($text);
        $list.append($item);
        
        $item.on("click", function () {
            var name = window.prompt("Place name: ", "");
            
            places.addPlace(name).done(function (place) {
                var stateObj = { place: place };
                history.pushState(stateObj, null, "#p=" + place.id);
                
                $placelist.hide();
                $placelist.empty();
                showPlace(place);
            });
            
        });
        
        $container.append($header).append($list);
        $placelist.append($container);
        $placelist.show();
    }
    
    window.onpopstate = function (event) {
        var state = event.state;

        if (state) {
            if (state.dirTag) {
                $predictions.hide();
                $predictions.empty();
                showStops(state.routeTag, state.dirTag);
            } else if (state.routeTag) {
                $stops.hide();
                $stops.empty();
                showDirections(state.routeTag);
            }
        } else {
            $directions.hide();
            $directions.empty();
            showRoutes();
        }
    };

    $(function () {
        var hash = window.location.hash;
        
        if (hash) {
            var params = hash.substring(1).split("&").reduce(function (obj, eq) {
                var terms = eq.split("=");
                obj[terms[0]] = terms[1];
                return obj;
            }, {});
            
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
                return;
            }
        }
        
        showPlaces();
    });
    
});
