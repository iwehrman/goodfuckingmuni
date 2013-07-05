/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        mustache = require("mustache"),
        command = require("app/command"),
        places = require("app/places"),
        geo = require("app/geolocation");

    var containerHtml = require("text!html/container.html"),
        editHtml = require("text!html/edit.html"),
        numbersHtml = require("text!html/numbers.html"),
        titleHtml = require("text!html/title.html"),
        removeHtml = require("text!html/remove.html");
    
    var $body = $("body"),
        $content = $body.find(".content");

    function showList(title, entries, options) {
        options = options || {};
 
        if (options.removeClickHandler) {
            entries = entries.map(function (entry) {
                entry.right += removeHtml;
                return entry;
            });
        }
        
        if (options.addClickHandler) {
            var addTitle = options.addTitle || "Add...";
            entries.push({
                left: mustache.render(titleHtml, {title: addTitle}),
                right: "",
                tags: [{tag: "op", value: "add"}]
            });
        }
        
        var $container = $(mustache.render(containerHtml, {
            left: title,
            entries: entries
        }));
        
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
                $entry.data("clickHandler", options.addClickHandler);
            } else {
                if (options.entryClickHandler) {
                    $entry.data("clickHandler", options.entryClickHandler.bind(null, data));
                    if (options.removeClickHandler) {
                        var remove = $($entry.find(".entry__remove").children()[0]);
                        
                        $(remove).on("click", function () {
                            if (options.removeClickHandler(data)) {
                                $entry.remove();
                            }
                        });
                    } else {
                        $entry.on("click", options.entryClickHandler.bind(null, data));
                    }
                }
            }
        });
        
        if (options.removeClickHandler) {
            var $editContainer = $($container.find(".header__right")[0]);
            handleEditStop($editContainer);
        }
        
        $content.empty();
        $content.append($container);
    }
    
    function showPredictions(routeTag, dirTag, stopTag) {
        command.getRoute(routeTag).done(function (route) {
            command.getPredictions(routeTag, stopTag).done(function (predictions) {
                var stop = route.stops[stopTag],
                    title = "Predictions &rangle; " + stop.title;
                
                var entries = predictions.map(function (prediction, index) {
                    return {
                        left: prediction.minutes + " minutes",
                        right: ""
                    };
                });
                
                showList(title, entries);
            }).fail(function (err) {
                console.error("[showPredictions] failed to get predictions: " + err);
            });
        }).fail(function (err) {
            console.error("[showPredictions] failed to get route: " + err);
        });
    }
    
    function showStops(routeTag, dirTag, scroll) {
        var deferred = $.Deferred();
        
        function entryClickHandler(data) {
            var routeTag = data.route,
                dirTag = data.dir,
                stopTag = data.stop,
                stateObj = { routeTag: routeTag, dirTag: dirTag, stopTag: stopTag };
            
            history.pushState(stateObj, null, "#r=" + routeTag + "&d=" + dirTag + "&s=" + stopTag);
            
            deferred.resolve(stopTag);
        }
        
        command.getRoute(routeTag).done(function (route) {
            function normalizeDist(direction, stop) {
                var range = direction.maxDist - direction.minDist,
                    fromMin = stop.dist - direction.minDist;
                
                return 1 - (fromMin / range);
            }

            var direction = route.directions[dirTag],
                title = route.title + " &rangle; " + direction.title;
            
            var entries = direction.stops.map(function (stopTag) {
                var stop = route.stops[stopTag],
                    norm = normalizeDist(direction, stop);

                return {
                    left: stop.title,
                    right: "",
                    highlight: (norm === 1),
                    tags: [{tag: "route", value: routeTag},
                           {tag: "dir", value: dirTag},
                           {tag: "stop", value: stopTag}]
                };
            });
            
            showList(title, entries, { entryClickHandler: entryClickHandler });
            
            if (scroll) {
                $body.animate({
                    scrollTop: $content.find(".highlight").parents(".entry").offset().top - $content.scrollTop()
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
            function entryClickHandler(data) {
                deferred.resolve(data.dir);
            }

            var entries = [],
                dirTag,
                direction;
            for (dirTag in route.directions) {
                if (route.directions.hasOwnProperty(dirTag)) {
                    direction = route.directions[dirTag];
                    entries.push({
                        tags: [{tag: "dir", value: dirTag}],
                        left: direction.title,
                        right: ""
                    });
                }
            }

            showList(route.title, entries, { entryClickHandler: entryClickHandler });
        }).fail(function (err) {
            console.error("[showDirections] failed to get route: " + err);
            deferred.reject(err);
        });
        
        return deferred.promise();
    }
    
    function showRoutes() {
        var deferred = $.Deferred();

        function entryClickHandler(data) {
            deferred.resolve(data.route);
        }
        
        command.getRoutes().done(function (routes) {
            var entries = routes.map(function (route) {
                return {
                    left: route.title,
                    right: "",
                    tags: [{tag: "route", value: route.tag}]
                };
            });
        
            showList("Routes", entries, { entryClickHandler: entryClickHandler });
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
                history.pushState(stateObj, null, "#r=" + routeTag + "&d=" + dirTag + "&s=" + stopTag);
                
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
        
        function addClickHandler() {
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
                
                var options = {
                    entryClickHandler: entryClickHandler,
                    removeClickHandler: removeClickHandler,
                    addClickHandler: addClickHandler,
                    addTitle: "Add stop..."
                };
                showList(title, entries, options);
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
        
        function addClickHandler() {
            var name = window.prompt("Place name: ", "");
            
            if (name) {
                places.addPlace(name).done(function (place) {
                    var stateObj = { placeId: place.id };
                    history.pushState(stateObj, null, "#p=" + place.id);
                    
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
            
            var options = {
                entryClickHandler: entryClickHandler,
                removeClickHandler: removeClickHandler,
                addClickHandler: addClickHandler,
                addTitle: "Add place..."
            };
            showList("Places", entries, options);
            
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
