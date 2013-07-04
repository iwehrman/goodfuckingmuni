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

    var containerHtml = require("text!html/container.html"),
        editHtml = require("text!html/edit.html"),
        numbersHtml = require("text!html/numbers.html"),
        titleHtml = require("text!html/title.html"),
        removeHtml = require("text!html/remove.html");
    
    var $content = $("body").find(".content");
    
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
                $content.append($container);
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
                    
                    $content.empty();
                    deferred.resolve(stopTag);
                });
                
                $item.append($text);
                $list.append($item);
            });
            
            $container.append($header).append($list);
            $content.append($container);
            
            if (scroll) {
                $content.animate({
                    scrollTop: $list.find(".closest").parent().offset().top - $content.scrollTop()
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
                    
                    $content.empty();
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
            $content.append($container);
        }).fail(function (err) {
            console.error("[showDirections] failed to get route: " + err);
            deferred.reject(err);
        });
        
        return deferred.promise();
    }
    
    function showList(title, entries, entryClickHandler, removeClickHandler, addClickHandler) {
        if (addClickHandler) {
            entries = entries.map(function (entry) {
                entry.right += removeHtml;
                return entry;
            });
            
            entries.push({
                left: mustache.render(titleHtml, {title: "Add..."}),
                right: "",
                tags: [{tag: "op", value: "add"}]
            });
        }
        
        var strings = {
            left: title,
            entries: entries
        },
            $container = $(mustache.render(containerHtml, strings));
        
        var handleEditStop,
            handleEditStart;
        
        handleEditStop = function ($editContainer) {
            var $editButton = $(mustache.render(editHtml, {title: "Edit"}));

            $container.find(".entry__remove").hide();
            $container.find(".entry__numbers").show();
            $container.find(".entry").each(function (index, item) {
                var $item = $(item),
                    handler = $item.data("clickHandler");

                $item.on("click", handler);
            });
            
            $editContainer.children().remove();
            $editContainer.append($editButton);
            $editContainer.off("click");
            $editContainer.on("click", handleEditStart.bind(null, $editContainer));
        };
        
        handleEditStart = function ($editContainer) {
            var $doneButton = $(mustache.render(editHtml, {title: "Done"}));
            
            $container.find(".entry__numbers").hide();
            $container.find(".entry__remove").show();
            $container.find(".entry").each(function (index, item) {
                $(item).off("click");
            });
            
            $editContainer.children().remove();
            $editContainer.append($doneButton);
            $editContainer.off("click");
            $editContainer.on("click", handleEditStop.bind(null, $editContainer));
        };
        
        $container.find(".entry").each(function (index, entry) {
            var data = entry.dataset,
                $entry = $(entry),
                op = $entry.data("op");
            
            if (op === "add") {
                $entry.data("clickHandler", addClickHandler);
            } else {
                if (entryClickHandler) {
                    $entry.data("clickHandler", entryClickHandler.bind(null, data));
                    if (removeClickHandler) {
                        var remove = $($entry.find(".entry__remove").children()[0]);
                        
                        $(remove).on("click", function () {
                            if (removeClickHandler(data)) {
                                $entry.remove();
                            }
                        });
                    } else {
                        $entry.on("click", entryClickHandler.bind(null, data));
                    }
                }
            }
        });
        
        if (removeClickHandler) {
            var $editContainer = $($container.find(".header__right")[0]);
            handleEditStop($editContainer);
        }
        
        $content.append($container);
    }
    
    function showRoutes() {
        var deferred = $.Deferred();

        function entryClickHandler(data) {
            var routeTag = data.route,
                stateObj = { routeTag: routeTag };
            history.pushState(stateObj, null, "#r=" + routeTag);
            
            $content.empty();
            deferred.resolve(routeTag);
        }
        
        command.getRoutes().done(function (routes) {
            var entries = routes.map(function (route) {
                return {
                    left: route.title,
                    right: "",
                    tags: [{tag: "route", value: route.tag}]
                };
            });
        
            showList("Routes", entries, entryClickHandler);
        }).fail(function (err) {
            console.error("[showRoutes] failed to get routes: " + err);
            deferred.reject(err);
        });
        
        return deferred.promise();
    }
    
    function showPlace(placeId) {
        var place = places.getPlace(placeId),
            predictionsPromise = command.getPredictionsForMultiStops(place.stops),
            title = "Places &rangle; " + place.title,
            routeObjMap = {};
        
        function entryClickHandler(data) {
            var routeTag = data.route,
                dirTag = data.dir,
                stopTag = data.stop;
            
            if (routeTag !== undefined) {
                var stateObj = {
                    placeId: placeId,
                    routeTag: routeTag,
                    dirTag: dirTag,
                    stopTag: stopTag
                };
                history.pushState(stateObj, null, "#p=" + placeId + "&r=" + routeTag + "&d=" + dirTag + "&s=" + stopTag);
                
                $content.empty();
                showPredictions(routeTag, dirTag, stopTag);
            }
            return null;
        }
        
        function removeClickHandler(data) {
            var routeTag = data.route,
                stopTag = data.stop;
            
            if (routeTag !== undefined) {
                var route = routeObjMap[routeTag],
                    stop = route.stops[stopTag];
                
                if (window.confirm("Remove stop '" + stop.title + "'?")) {
                    place.removeStop(stop);
                    return true;
                }
            }
            return false;
        }
        
        function handleAddClick() {
            $content.empty();
            showRoutes().done(function (routeTag) {
                showDirections(routeTag).done(function (dirTag) {
                    showStops(routeTag, dirTag, true).done(function (stopTag) {
                        place.addStop(routeTag, dirTag, stopTag);
                        showPlace(placeId);
                    });
                });
            });
        }
        
        async.map(place.stops, function (stopObj, callback) {
            command.getRoute(stopObj.routeTag).done(function (route) {
                routeObjMap[route.tag] = route;
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
                var entries = routeObjs.map(function (routeObj, index) {
                    var route = routeObj.route,
                        routeTag = route.tag,
                        dirTag = routeObj.dirTag,
                        stopTag = routeObj.stopTag,
                        stop = route.stops[stopTag],
                        title = mustache.render(titleHtml, {title: route.title, subtitle: stop.title}),
                        predictionList = predictionObjs[index].slice(0, 4),
                        predictions = mustache.render(numbersHtml, { predictions: predictionList }),
                        tags = [{tag: "route", value: routeTag},
                                {tag: "dir", value: dirTag},
                                {tag: "stop", value: stopTag}];
                    
                    return {
                        left: title,
                        right: predictions,
                        tags: tags
                    };
                });
                
                showList(title, entries, entryClickHandler, removeClickHandler, handleAddClick);
            }).fail(function (err) {
                console.error("[showPlace] failed to get predictions: " + err);
            });
        });
    }
    
    function showPlaces() {
        function entryClickHandler(data) {
            var placeId = data.place;
            
            if (placeId !== undefined) {
                var place = places.getPlace(parseInt(placeId, 10));
                
                var stateObj = { placeId: place.id };
                history.pushState(stateObj, null, "#p=" + place.id);
                
                $content.empty();
                showPlace(place.id);
            }
        }
        
        function removeClickHandler(data) {
            var placeId = data.place;
            
            if (placeId !== undefined) {
                var place = places.getPlace(parseInt(placeId, 10));
                
                if (window.confirm("Remove place '" + place.title + "'?")) {
                    places.removePlace(place);
                    return true;
                }
            }
            return false;
        }
        
        function handleAddClick() {
            var name = window.prompt("Place name: ", "");
            
            if (name) {
                places.addPlace(name).done(function (place) {
                    var stateObj = { placeId: place.id };
                    history.pushState(stateObj, null, "#p=" + place.id);
                    
                    $content.empty();
                    showPlace(place.id);
                }).fail(function (err) {
                    console.error("[showPlaces] failed to add place: " + err);
                });
            }
        }
        
        var placeList = places.getAllPlaces();
        geo.sortByCurrentLocation(placeList).done(function (position) {
            var entries = placeList.map(function (place) {
                var tags = [{tag: "place", value: place.id}],
                    distance = geo.formatDistance(geo.distance(position, place));

                return {
                    left: mustache.render(titleHtml, place),
                    right: mustache.render(numbersHtml, {distance: distance}),
                    tags: tags
                };
            });
            
            showList("Places", entries, entryClickHandler, removeClickHandler, handleAddClick);
            
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
