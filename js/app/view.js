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
        _buttonHtml = require("text!html/button.html"),
        _predictionsHtml = require("text!html/predictions.html"),
        _titleHtml = require("text!html/title.html");

    var containerTemplate = mustache.compile(_containerHtml),
        distanceTemplate = mustache.compile(_distanceHtml),
        buttonTemplate = mustache.compile(_buttonHtml),
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
            entries.forEach(function (entry) {
                entry.right += buttonTemplate({"class": "entry__remove", title: "&times;"});
            });
        }
        
        var addButton = options.addClickHandler ? buttonTemplate({"class": "entry__add", title: "+"}) : "",
            $container = $(containerTemplate({
                left: title,
                right: addButton,
                entries: entries
            }));
        
        if (options.addClickHandler) {
            var $addButton = $container.find(".entry__add");
            $addButton.on("click", options.addClickHandler);
        }
        
        var $entries = $container.find(".entry");
        
        if (options.entryClickHandler) {
            $entries.each(function (index, entry) {
                var data = entry.dataset,
                    $entry = $(entry);
                
                $entry.on("click", options.entryClickHandler.bind(null, data));
            });
        }
        
        if (options.removeClickHandler) {
            $entries.each(function (index, entry) {
                var data = entry.dataset,
                    $entry = $(entry),
                    $remove = $entry.find(".entry__remove"),
                    removeButton = $remove.children()[0];
                
                $entry.on("swipeleft", function (event) {
                    var $title = $entry.find(".entry__right .entry__title"),
                        $subtitle = $entry.find(".entry__right .entry__subtitle");
                    
                    $title.hide();
                    $subtitle.hide();
                    $remove.show();
                    event.stopPropagation();

                    // capture-phase event listener to cancel entry clicks during removal                    
                    document.addEventListener("click", function listener(event) {
                        if (event.target === removeButton && options.removeClickHandler(data)) {
                            $entry.remove();
                        } else {
                            $remove.hide();
                            $title.show();
                            $subtitle.show();
                        }
                        document.removeEventListener("click", listener, true);
                        event.stopPropagation();
                    }, true);
                });
            });
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
    
    function showStops(placeId, routeTag, dirTag, scroll) {
        function entryClickHandler(data) {
            $(exports).triggerHandler("navigate", ["addStop", placeId, routeTag, dirTag, data.stop]);
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
            console.error("[showStops] failed to get route: " + err);
        });
    }
    
    function showDirections(placeId, routeTag) {
        function entryClickHandler(data) {
            $(exports).triggerHandler("navigate", ["stops", placeId, routeTag, data.dir]);
        }
        
        command.getRoute(routeTag).done(function (route) {
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
        });
    }
    
    function showRoutes(placeId) {
        function entryClickHandler(data) {
            $(exports).triggerHandler("navigate", ["directions", placeId, data.route]);
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
        });
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
                
                $(exports).triggerHandler("navigate", ["predictions", routeTag, dirTag, stopTag]);
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
                    $(exports).triggerHandler("navigate", ["removeStop", placeId, stopTag]);
                    return true;
                }
            }
            return false;
        }
        
        function addClickHandler() {
            $(exports).triggerHandler("navigate", ["routes", placeId]);
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
            $(exports).triggerHandler("navigate", ["place", data.place]);
        }
        
        function removeClickHandler(data) {
            var place = places.getPlace(parseInt(data.place, 10));
        
            if (window.confirm("Remove place '" + place.title + "'?")) {
                $(exports).triggerHandler("navigate", ["removePlace", data.place]);
                return true;
            }
    
            return false;
        }
        
        function addClickHandler() {
            $(exports).triggerHandler("navigate", ["addPlace"]);
        }
        
        var placeList = places.getAllPlaces();
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
    
    exports.showPlaces = showPlaces;
    exports.showPlace = showPlace;
    exports.showRoutes = showRoutes;
    exports.showDirections = showDirections;
    exports.showStops = showStops;
    exports.showPredictions = showPredictions;
});
