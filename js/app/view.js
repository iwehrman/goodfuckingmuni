/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        mustache = require("mustache"),
        command = require("app/command"),
        places = require("app/places"),
        geo = require("app/geolocation"),
        weather = require("app/weather");

    var containerHtml = require("text!html/view.html"),
        distanceHtml = require("text!html/distance.html"),
        editHtml = require("text!html/edit.html"),
        titleHtml = require("text!html/title.html"),
        removeHtml = require("text!html/remove.html");
    
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
        
        function handleStopClick(routeTag, dirTag, stopTag) {
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
        }
        
        function getAddStopItem() {
            var $item = $("<li class='topcoat-list__item entry-place-stop'>"),
                $text = $("<span>").append("Add new stop");
            
            function handleAddClick() {
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
            }
            
            $item.append($text);
            $item.on("click", handleAddClick);
            $item.data("clickHandler", handleAddClick);
            
            return $item;
        }
        
        function getEditStopsItem() {
            var $item = $("<span data-op='edit'>"),
                $editText = $("<a class='topcoat-button'>").append("Edit"),
                $doneText = $("<a class='topcoat-button'>").append("Done");
            
            function handleEditStart() {
                function handleEditStop() {
                    $places.find(".entry__remove").hide();
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
                $places.find(".entry__remove").show();
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
                        handler = handleStopClick.bind(null, routeTag, dirTag, stopTag),
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
                        $remove = $("<div>").addClass("entry__remove").append($("<a>").addClass("topcoat-icon-button").append("&times;")),
                        $text = $("<div>")
                            .addClass("entry-place-stop__content")
                            .append($title)
                            .append($predictions)
                            .append($remove);

                    $item.append($text);
                    $list.append($item);
                    
                    $item.on("click", handler);
                    $item.data("clickHandler", handler);
                });
                
                $list.append(getAddStopItem());
                $buttons.append(getEditStopsItem());
                
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
            title = "Places";
        
        function handlePlaceClick(place) {
            var stateObj = { placeId: place.id };
            history.pushState(stateObj, null, "#p=" + place.id);
            
            $places.hide();
            $places.empty();
            showPlace(place.id);
        }
        
        function handleRemoveClick(place, $item) {
            if (window.confirm("Remove place '" + place.title + "'?")) {
                places.removePlace(place);
                $item.remove();
            }
        }
        
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

        var handleEditStart,
            handleEditStop;
        
        handleEditStop = function ($places, $item) {
            var $editText = $(mustache.render(editHtml, {title: "Edit"}));

            $places.find(".entry__remove").hide();
            $places.find(".entry__distance").show();
            $places.find(".entry").each(function (index, item) {
                var $item = $(item),
                    handler = $item.data("clickHandler");

                $item.on("click", handler);
            });
            
            $item.children().remove();
            $item.append($editText);
            $item.on("click", handleEditStart.bind(null, $places, $item));
        };
        
        handleEditStart = function ($places, $item) {
            var $doneText = $(mustache.render(editHtml, {title: "Done"}));
            
            $places.find(".entry__distance").hide();
            $places.find(".entry__remove").show();
            $places.find(".entry").each(function (index, item) {
                $(item).off("click");
            });
            
            $item.children().remove();
            $item.append($doneText);
            $item.on("click", handleEditStop.bind(null, $places, $item));
        };

        geo.sortByCurrentLocation(placeList).done(function (position) {
            var entries = placeList.map(function (place) {
                var tags = [{tag: "place", value: place.id}],
                    distance = geo.formatDistance(geo.distance(position, place));

                return {
                    left: mustache.render(titleHtml, place),
                    right: mustache.render(distanceHtml, {distance: distance}) + removeHtml,
                    tags: tags
                };
            });
            
            entries.push({
                left: mustache.render(titleHtml, {title: "Add place..."}),
                right: "",
                tags: [{tag: "op", value: "add"}]
            });

            var strings = {
                left: title,
                entries: entries
            },
                $container = $(mustache.render(containerHtml, strings));
            
            $container.find(".entry").each(function (index, entry) {
                var $entry = $(entry),
                    placeId = $entry.data("place"),
                    op = $entry.data("op");
                
                if (placeId !== undefined) {
                    var place = places.getPlace(parseInt(placeId, 10)),
                        $remove = $entry.find(".entry__remove"),
                        placeClickHandler = handlePlaceClick.bind(null, place),
                        removeClickHandler = handleRemoveClick.bind(null, place, $entry);
                    
                    $entry.data("clickHandler", placeClickHandler);
                    $remove.on("click", removeClickHandler);
                } else if (op === "add") {
                    $entry.on("click", handleAddClick);
                }
            });
            
            var $editButton = $($container.find(".header__right")[0]);
            handleEditStop($container, $editButton);
            
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
