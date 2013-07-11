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

    var _containerHtml = require("text!html/container.html"),
        _distanceHtml = require("text!html/distance.html"),
        _editHtml = require("text!html/edit.html"),
        _predictionsHtml = require("text!html/predictions.html"),
        _titleHtml = require("text!html/title.html"),
        removeHtml = require("text!html/remove.html");

    var containerTemplate = mustache.compile(_containerHtml),
        distanceTemplate = mustache.compile(_distanceHtml),
        editTemplate = mustache.compile(_editHtml),
        predictionsTemplate = mustache.compile(_predictionsHtml),
        titleTemplate = mustache.compile(_titleHtml);

    var $body = $("body"),
        $content = $body.find(".content");
    
    var refreshTimer = null;

    function showList(title, entries, options) {
        options = options || {};
        
        if (refreshTimer) {
            window.clearTimeout(refreshTimer);
            refreshTimer = null;
        }
 
        if (options.removeClickHandler) {
            entries = entries.map(function (entry) {
                entry.right += removeHtml;
                return entry;
            });
        }
        
        if (options.addClickHandler) {
            var addTitle = options.addTitle || "Add...";
            entries.push({
                left: titleTemplate({title: addTitle}),
                right: "",
                tags: [{tag: "op", value: "add"}]
            });
        }
        
        var $container = $(containerTemplate({
            left: title,
            entries: entries
        }));
        
        var handleEditStop,
            handleEditStart;
        
        handleEditStop = function ($editContainer) {
            var $editButton = $(editTemplate({title: "Edit"}));

            $container.find(".entry__remove").hide();
            $container.find(".entry__right .entry__title").show();
            $container.find(".entry__right .entry__subtitle").show();
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
            var $doneButton = $(editTemplate({title: "Done"}));
            
            $container.find(".entry__right .entry__title").hide();
            $container.find(".entry__right .entry__subtitle").hide();
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
                    title = "Predictions: " + stop.title;
                
                var entries = predictions.map(function (prediction, index) {
                    return {
                        left: prediction.minutes + " minutes",
                        right: ""
                    };
                });
                
                showList(title, entries);
                
                refreshTimer = window.setTimeout(function () {
                    showPredictions(routeTag, dirTag, stopTag);
                }, 60000);

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
            deferred.resolve(data.stop);
        }
        
        command.getRoute(routeTag).done(function (route) {
            function normalizeDist(direction, stop) {
                var range = direction.maxDist - direction.minDist,
                    fromMin = stop.dist - direction.minDist;
                
                return 1 - (fromMin / range);
            }

            var direction = route.directions[dirTag],
                title = route.title + ": " + direction.title;
            
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

            var directions = [],
                dirTag;

            for (dirTag in route.directions) {
                if (route.directions.hasOwnProperty(dirTag)) {
                    directions.push(route.directions[dirTag]);
                }
            }
            
            directions.sort(function (a, b) {
                return a.title > b.title;
            });
            
            var entries = directions.map(function (direction) {
                return {
                    tags: [{tag: "dir", value: direction.tag}],
                    left: direction.title,
                    right: ""
                };
            });
            
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
            title = place.title,
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
                    place.removeStop(stopTag);
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
                
                function predictionComparator(a, b) {
                    if (a.predictions.length === 0) {
                        if (b.predictions.length === 0) {
                            return 0;
                        } else {
                            return 1;
                        }
                    } else {
                        if (b.predictions.length === 0) {
                            return -1;
                        } else {
                            return a.predictions[0].seconds - b.predictions[0].seconds;
                        }
                    }
                }
                
                routeObjs.forEach(function (routeObj, index) {
                    var routeTag = routeObj.route.tag,
                        stopTag = routeObj.stopTag;
                    
                    routeObj.predictions = predictionObjs[routeTag][stopTag];
                });
                
                routeObjs.sort(predictionComparator);
                
                var entries = routeObjs.map(function (routeObj) {
                    var route = routeObj.route,
                        routeTag = route.tag,
                        dirTag = routeObj.dirTag,
                        stopTag = routeObj.stopTag,
                        stop = route.stops[stopTag],
                        title = titleTemplate({title: route.title, subtitle: stop.title}),
                        predictions = routeObj.predictions,
                        firstPrediction = predictions.length ? predictions[0] : [],
                        firstPredictionString = predictionsTemplate({ predictions: firstPrediction }),
                        lastPredictionIndex = Math.min(3, predictions.length),
                        laterPredictions = predictions.slice(1, lastPredictionIndex),
                        laterPredictionsString = predictionsTemplate({ predictions: laterPredictions }),
                        predictionsString = titleTemplate({ title: firstPredictionString, subtitle: laterPredictionsString }),
                        tags = [{tag: "route", value: routeTag},
                                {tag: "dir", value: dirTag},
                                {tag: "stop", value: stopTag}];
                    
                    return {
                        left: title,
                        right: predictionsString,
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
                
                refreshTimer = window.setTimeout(function () {
                    showPlace(placeId);
                }, 60000);
                
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
        
//        if (placeList.length === 1) {
//            entryClickHandler({place: placeList[0].id});
//            return;
//        }
        
        geo.sortByCurrentLocation(placeList).done(function (position) {
            var entries = placeList.map(function (place) {
                var tags = [{tag: "place", value: place.id}],
                    miles = geo.kilometersToMiles(geo.distance(position, place)),
                    distance = distanceTemplate({miles: miles});

                // warm up cache
                command.getPredictionsForMultiStops(place.stops);
                place.stops.forEach(function (stopObj) {
                    command.getRoute(stopObj.routeTag);
                });
                
                return {
                    left: titleTemplate(place),
                    right: titleTemplate({title: distance}),
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
