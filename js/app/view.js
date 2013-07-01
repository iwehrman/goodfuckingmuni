/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        command = require("app/command"),
        places = require("app/places"),
        geo = require("app/geolocation"),
        weather = require("app/weather");

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
        
    function showStops(routeTag, dirTag, scroll) {
        var deferred = $.Deferred();
        
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
                    deferred.resolve(stopTag);
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
            deferred.reject(err);
            console.error("[showStops] failed to get route: " + err);
        });
        
        return deferred.promise();
    }
    
    function showDirections(routeTag) {
        var deferred = $.Deferred();
        
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
                    deferred.resolve(dirTag);
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
            deferred.reject(err);
        });
        
        return deferred.promise();
    }

    function showRoutes() {
        var deferred = $.Deferred();
        
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
                    deferred.resolve(route.tag);
                });
            });
            
            $container.append($header).append($list);
            $routes.append($container);
            $routes.show();
        }).fail(function (err) {
            console.error("[showRoutes] failed to get routes: " + err);
            deferred.reject(err);
        });
        
        return deferred.promise();
    }
    
    function showPlace(placeId) {
        var place = places.getPlace(placeId),
            predictionsPromise = command.getPredictionsForMultiStops(place.stops),
            $container = $("<div class='topcoat-list__container'></div>"),
            $list = $("<ul class='topcoat-list'></ul>"),
            $title = $("<div class='header-places__title'>").append("Places &rangle; " + place.title),
            $buttons = $("<div class='header-places__buttons'>"),
            $header = $("<h1 class='topcoat-list__header header-places'>").append($title).append($buttons);
        
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
                    var predictions = predictionObjs[index].slice(0, 4),
                        route = routeObj.route,
                        routeTag = route.tag,
                        stopTag = routeObj.stopTag,
                        dirTag = routeObj.dirTag,
                        stop = route.stops[stopTag],
                        $item = $("<li class='topcoat-list__item entry-place-stop' data-stopTag='" +
                                 stopTag + "' data-routeTag='" + routeTag + "'>"),
                        $routeTitle = $("<div>").append(route.title).addClass("entry-place-stop__route"),
                        $stopTitle = $("<div>").append(stop.title).addClass("entry-place-stop__stop"),
                        $title = $("<div>").append($routeTitle).append($stopTitle).addClass("entry-place-stop__title"),
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
                        history.pushState(stateObj, null, "#p=" + placeId + "&r=" + routeTag + "&d=" + dirTag + "&s=" + stopTag);
                        
                        $places.hide();
                        $places.empty();
                        showPredictions(routeTag, dirTag, stopTag);
                    });
                });
                
                var $item = $("<li class='topcoat-list__item entry-place-stop'>"),
                    $text = $("<span>").append("Add new stop");
                
                $item.append($text);
                $list.append($item);
                
                $item.on("click", function () {
                    $places.hide();
                    $places.empty();
                    showRoutes().done(function (routeTag) {
                        showDirections(routeTag).done(function (dirTag) {
                            showStops(routeTag, dirTag, true).done(function (stopTag) {
                                place.addStop(routeTag, dirTag, stopTag);
                                showPlace(placeId);
                            });
                        });
                    });
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
            $list = $("<ul class='topcoat-list'></ul>"),
            $title = $("<div class='header-places__title'>").append("Places"),
            $buttons = $("<div class='header-places__buttons'>"),
            $header = $("<h1 class='topcoat-list__header header-places'>").append($title).append($buttons);
        
        function handlePlaceClick(placeId) {
            var stateObj = { placeId: placeId };
            history.pushState(stateObj, null, "#p=" + placeId);
            
            $places.hide();
            $places.empty();
            showPlace(placeId);
        }
        
        function getAddPlaceItem() {
            var $item = $("<li class='topcoat-list__item entry-place' data-op='add'>"),
                $text = $("<div class='entry-place__content'>").append($("<div class='entry-place__title'>").append("Add place..."));
            
            function handleAddClick() {
                var name = window.prompt("Place name: ", "");
                
                if (name) {
                    places.addPlace(name).done(function (place) {
                        var stateObj = { placeId: place.id };
                        history.pushState(stateObj, null, "#p=" + place.id);
                        
                        $places.hide();
                        $places.empty();
                        showPlace(place.id);
                    }).fail(function (err) {
                        console.error("[showPlaces] failed to add place: " + err);
                    });
                }
            }
            
            $item.append($text);
            $item.on("click", handleAddClick);
            $item.data("clickHandler", handleAddClick);
            
            return $item;
        }

        function getEditPlacesItem() {
            var $item = $("<span data-op='edit'>"),
                $editText = $("<a class='topcoat-button'>").append("Edit"),
                $doneText = $("<a class='topcoat-button'>").append("Done");
            
            function handleEditStart() {
                function handleEditStop() {
                    $places.find(".entry-place__remove").hide();
                    $places.find(".entry-place__distance").show();
                    $places.find(".entry-place").each(function (index, item) {
                        var $item = $(item),
                            handler = $item.data("clickHandler");
    
                        $item.on("click", handler);
                    });
                    
                    $item.children().remove();
                    $item.append($editText);
                    $item.on("click", handleEditStart);
                }
                
                $places.find(".entry-place__distance").hide();
                $places.find(".entry-place__remove").show();
                $places.find(".entry-place").each(function (index, item) {
                    $(item).off("click");
                });
                
                $item.children().remove();
                $item.append($doneText);
                $item.on("click", handleEditStop);
            }
            
            $item.append($editText);
            $item.on("click", handleEditStart);
            return $item;
        }

        geo.sortByCurrentLocation(placeList).done(function (position) {
            placeList.forEach(function (place) {
                var handler = handlePlaceClick.bind(null, place.id),
                    $item = $("<li class='topcoat-list__item entry-place' data-place='" +
                             place.id + "'>"),
                    distance = geo.formatDistance(geo.distance(position, place)),
                    $title = $("<div>").append(place.title).addClass("entry-place__title"),
                    $distance = $("<div>").append(distance).addClass("entry-place__distance"),
                    $remove = $("<div>").addClass("entry-place__remove").append($("<a>").addClass("topcoat-icon-button").append("&times;")),
                    $content = $("<div>").addClass("entry-place__content")
                        .append($title)
                        .append($distance)
                        .append($remove);

                $remove.on("click", function () {
                    if (window.confirm("Remove place '" + place.title + "'?")) {
                        places.removePlace(place);
                        $item.remove();
                    }
                });
                
                $item.append($content);
                $item.on("click", handler);
                $item.data("clickHandler", handler);

                $list.append($item);
            });

            $buttons.append(getEditPlacesItem());
            $list.append(getAddPlaceItem());
            
            $container.append($header).append($list);
            $places.append($container);
            $places.show();
        }).fail(function (err) {
            console.error("[showPlaces] failed to geolocate: " + err);
        });
    }
    
    return {
        showPlaces: showPlaces,
        showPlace: showPlace,
        showRoutes: showRoutes,
        showDirections: showDirections,
        showStops: showStops,
        showPredictions: showPredictions
    };
});
