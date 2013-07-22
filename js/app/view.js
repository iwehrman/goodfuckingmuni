/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        mustache = require("mustache"),
        routes = require("app/routes"),
        preds = require("app/predictions"),
        places = require("app/places"),
        geo = require("app/geolocation");

    var REFRESH_INTERVAL = 5000,
        NEARBY_IN_KM = 0.5;
    
    var _backHtml = require("text!html/back.html"),
        _containerHtml = require("text!html/container.html"),
        _entryHtml = require("text!html/entry.html"),
        _distanceHtml = require("text!html/distance.html"),
        _buttonHtml = require("text!html/button.html"),
        _predictionsHtml = require("text!html/predictions.html"),
        _titleHtml = require("text!html/title.html");

    var backTemplate = mustache.compile(_backHtml),
        containerTemplate = mustache.compile(_containerHtml),
        entryTemplate = mustache.compile(_entryHtml),
        distanceTemplate = mustache.compile(_distanceHtml),
        buttonTemplate = mustache.compile(_buttonHtml),
        predictionsTemplate = mustache.compile(_predictionsHtml),
        titleTemplate = mustache.compile(_titleHtml);

    var $body = $("body"),
        $content = $body.find(".content");
    
    var refreshTimer = null;

    function makeListEntry(obj, opts) {
        var entrySettings = {
            href: opts.getEntryHref(obj),
            highlight: opts.getHighlight(obj),
            left: opts.getLeft(obj),
            right: opts.getRight(obj)
        };
        
        var entryHTML = entryTemplate(entrySettings),
            $entry = $(entryHTML);

        if (opts.getRemoveHref) {
            var removeHref = opts.getRemoveHref(obj),
                removeSettings = {
                    "class": "entry__remove",
                    href: removeHref,
                    title: "&times;"
                },
                removeHtml = buttonTemplate(removeSettings),
                $remove = $(removeHtml),
                removeButton = $remove.children()[0];
            
            $entry.find(".entry__right").append($remove);
            $entry.on("swipeleft", function (event) {
                var $title = $entry.find(".entry__right .entry__title"),
                    $subtitle = $entry.find(".entry__right .entry__subtitle");
                
                $title.hide();
                $subtitle.hide();
                $remove.show();
                event.stopPropagation();
                event.preventDefault();
    
                // capture-phase event listener to cancel entry clicks during removal
                document.addEventListener("click", function listener(event) {
                    if (event.target === removeButton && opts.confirmRemove(obj)) {
                        $entry.remove();
                    } else {
                        $remove.hide();
                        $title.show();
                        $subtitle.show();
                        event.preventDefault();
                    }
                    document.removeEventListener("click", listener, true);
                    event.stopPropagation();
                }, true);
            });
        }
        
        return $entry;
    }

    function makeList(title, list, opts) {
        var left;
        if (opts.backHref) {
            var backSettings = {
                title: "&lsaquo;",
                href: opts.backHref
            };
            left = backTemplate(backSettings);
        } else {
            left = null;
        }
        
        var right;
        if (opts.addHref) {
            var addSettings = {
                title: "+",
                href: opts.addHref
            };
            right = buttonTemplate(addSettings);
        } else {
            right = null;
        }
        
        var containerSettings = {
            left: left,
            center: title,
            right: right
        },  containerHTML = containerTemplate(containerSettings),
            $container = $(containerHTML),
            $entries = $container.find(".entries");
        
        list.forEach(function (obj) {
            var $entry = makeListEntry(obj, opts);
            $entries.append($entry);
        });
        
        return $container;
    }

    function showList(title, list, options) {
        options = options || {};
        
        if (refreshTimer) {
            window.clearInterval(refreshTimer);
            refreshTimer = null;
        }
        
        var $container = makeList(title, list, options);
        
        $content.empty();
        $content.append($container);
    }
    
    function _showList(title, entries, options) {
        options = options || {};
        
        if (refreshTimer) {
            window.clearInterval(refreshTimer);
            refreshTimer = null;
        }
 
//        if (options.removeClickHandler) {
//            entries.forEach(function (entry) {
//                entry.right += buttonTemplate({"class": "entry__remove", title: "&times;"});
//            });
//        }
        
        if (options.removeHref) {
            entries.forEach(function (entry) {
                entry.right += buttonTemplate({"class": "entry__remove",
                                               href: options.removeHref,
                                               title: "&times;"});
            });
        }
        
        var addButton = options.addHref ?
                buttonTemplate({"class": "entry__add",
                                href: options.addHref,
                                title: "+"}) : "",
            containerHtml = containerTemplate({
                left: options.backHref ? "&lsaquo;" : null,
                leftHref: options.backHref,
                center: title,
                right: addButton,
                entries: entries
            }),
            $container = $(containerHtml);
        
//        if (options.addClickHandler) {
//            var $addButton = $container.find(".entry__add");
//            $addButton.on("click", options.addClickHandler);
//        }
        
        var $entries = $container.find(".entry");
        
//        if (options.entryClickHandler) {
//            $entries.each(function (index, entry) {
//                var data = entry.dataset,
//                    $entry = $(entry);
//                
//                $entry.on("click", options.entryClickHandler.bind(null, data));
//            });
//        }
        
        if (options.removeHref) {
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
                    event.preventDefault();

                    // capture-phase event listener to cancel entry clicks during removal
                    document.addEventListener("click", function listener(event) {
                        if (event.target === removeButton && options.removeClickHandler(data)) {
                            $entry.remove();
                        } else {
                            $remove.hide();
                            $title.show();
                            $subtitle.show();
                            event.preventDefault();
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
    
    function showPredictions(routeTag, stopTag, placeId) {
        routes.getRoute(routeTag).done(function (route) {
            preds.getPredictions(routeTag, stopTag).done(function (predictions) {
                var stop = route.stops[stopTag],
                    title = stop.title,
                    backHref = "#page=place&place=" + placeId;
                
                var entries = predictions.map(function (prediction, index) {
                    return {
                        left: predictionsTemplate({predictions: prediction}),
                        right: ""
                    };
                });
                
                showList(title, entries, { backHref: backHref });
                
                function refreshPredictions() {
                    preds.getPredictions(routeTag, stopTag).done(function (predictions) {
                        $content.find(".entry").each(function (index, entry) {
                            var $entry = $(entry);
                            
                            $entry.find(".entry__minutes").each(function (_index, minutes) {
                                if (index < entries.length) {
                                    $(minutes).text(predictions[index].minutes);
                                    return true;
                                } else {
                                    return false;
                                }
                            });
                        });
                    });
                }
                
                refreshTimer = window.setInterval(refreshPredictions, REFRESH_INTERVAL);

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

        var locationPromise = geo.getLocation();
        routes.getRoute(routeTag).done(function (route) {
            locationPromise.done(function (position) {
                var direction = route.directions[dirTag],
                    title = route.title + ": " + direction.title,
                    minDist = Number.POSITIVE_INFINITY,
                    maxDist = Number.NEGATIVE_INFINITY,
                    distances = direction.stops.map(function (stopTag) {
                        var stop = route.stops[stopTag],
                            dist = geo.distance(position, stop);
                            
                        if (dist > maxDist) {
                            maxDist = dist;
                        }
                        
                        if (dist < minDist) {
                            minDist = dist;
                        }
                        return dist;
                    });
                
                var entries = direction.stops.map(function (stopTag, index) {
                    var stop = route.stops[stopTag],
                        range = maxDist - minDist,
                        fromMin = distances[index] - minDist,
                        norm = 1 - (fromMin / range);

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
                    var $entry = $content.find(".highlight").parents(".entry");
                    $body.animate({
                        scrollTop: $entry.offset().top - $content.scrollTop()
                    });
                }
            });
        }).fail(function (err) {
            console.error("[showStops] failed to get route: " + err);
        });
    }
    
    function showDirections(placeId, routeTag) {
        function entryClickHandler(data) {
            $(exports).triggerHandler("navigate", ["stops", placeId, routeTag, data.dir]);
        }
        
        routes.getRoute(routeTag).done(function (route) {
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
        
        routes.getRoutes().done(function (routes) {
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
            predictionsPromise = preds.getPredictionsForMultiStops(place.stops),
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
            routes.getRoute(stopObj.routeTag).done(function (route) {
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
                        stopTitle = "@ " + stop.title,
                        routeTitle = route.getTitleWithColor(),
                        subtitles = [route.directions[dirTag].title, stopTitle],
                        title = titleTemplate({title: routeTitle, subtitles: subtitles}),
                        predictions = routeObj.predictions,
                        firstPrediction = predictions.length ? predictions[0] : [],
                        firstPredictionString = predictionsTemplate({ predictions: firstPrediction }),
                        lastPredictionIndex = Math.min(3, predictions.length),
                        laterPredictions = predictions.slice(1, lastPredictionIndex),
                        laterPredictionsString = predictionsTemplate({ predictions: laterPredictions }),
                        predictionsString = titleTemplate({ title: firstPredictionString, subtitles: [laterPredictionsString] }),
                        tags = [{tag: "route", value: routeTag},
                                {tag: "dir", value: dirTag},
                                {tag: "stop", value: stopTag}];
                    
                    return {
                        href: "#page=predictions&place=" + placeId +
                            "&route=" + routeTag + "&stop=" + stopTag,
                        left: title,
                        right: predictionsString,
                        tags: tags
                    };
                });
                
//                var options = {
//                    backHref: "#page=places",
//                    entryClickHandler: entryClickHandler,
//                    removeClickHandler: removeClickHandler,
//                    addClickHandler: addClickHandler
//                };
                
                var options = {
                    backHref: "#page=places",
                    addHref: "#page=place&op=add",
                    getEntryHref: function (routeObj) {
                        var routeTag = routeObj.route.tag,
                            stopTag = routeObj.stopTag;
                        
                        return "#page=predictions&place=" + placeId +
                            "&route=" + routeTag + "&stop=" + stopTag;
                    },
                    getHighlight: function (routeObj) { return false; },
                    getLeft: function (routeObj) {
                        var route = routeObj.route,
                            routeTag = route.tag,
                            dirTag = routeObj.dirTag,
                            stopTag = routeObj.stopTag,
                            stop = route.stops[stopTag],
                            stopTitle = "@ " + stop.title,
                            routeTitle = route.getTitleWithColor(),
                            subtitles = [route.directions[dirTag].title, stopTitle];
                        
                        return titleTemplate({title: routeTitle, subtitles: subtitles});
                    },
                    getRight: function (routeObj) {
                        var predictions = routeObj.predictions,
                            firstPrediction = predictions.length ? predictions[0] : [],
                            firstPredictionString = predictionsTemplate({
                                predictions: firstPrediction
                            }),
                            lastPredictionIndex = Math.min(3, predictions.length),
                            laterPredictions = predictions.slice(1, lastPredictionIndex),
                            laterPredictionsString = predictionsTemplate({
                                predictions: laterPredictions
                            });
                        
                        return titleTemplate({
                            title: firstPredictionString,
                            subtitles: [laterPredictionsString]
                        });
                    },
                    getRemoveHref: function (routeObj) {
                        var route = routeObj.route,
                            routeTag = route.tag,
                            stopTag = routeObj.stopTag;

                        return "#page=place&op=remove&place=" + placeId +
                            "&route=" + routeTag + "&stop=" + stopTag;
                    },
                    confirmRemove: function (routeObj) {
                        var route = routeObj.route,
                            dirTag = routeObj.dirTag,
                            stopTag = routeObj.stopTag,
                            stop = route.stops[stopTag];

                        return window.confirm("Remove stop " + stop.title + "?");
                    }
                };
                
                showList(title, routeObjs, options);
                
                function refreshPredictions() {
                    return preds.getPredictionsForMultiStops(place.stops)
                        .progress(function () {
                            $content.find(".entry__right").addClass("stale");
                        }).done(function (predictionObjs) {
                            $content.find(".entry").each(function (index, entry) {
                                var $entry = $(entry),
                                    data = entry.dataset,
                                    routeTag = data.route,
                                    stopTag = data.stop,
                                    predictions = predictionObjs[routeTag][stopTag];
                                
                                $entry.find(".entry__right").removeClass("stale");
                                $entry.find(".entry__minutes").each(function (index, minutes) {
                                    if (index < 3) {
                                        $(minutes).text(predictions[index].minutes);
                                        return true;
                                    } else {
                                        return false;
                                    }
                                });
                            });
                        });
                }
                
                refreshTimer = window.setInterval(refreshPredictions, REFRESH_INTERVAL);
                
            }).fail(function (err) {
                console.error("[showPlace] failed to get predictions: " + err);
            });
        });
    }
    
    function showPlaces(showAll) {
        var placeList = places.getAllPlaces();
        
        function preloadPredictions() {
            placeList.forEach(function (place) {
                // FIXME: Could reduce this to one predictions request
                preds.getPredictionsForMultiStops(place.stops);
                place.stops.forEach(function (stopObj) {
                    routes.getRoute(stopObj.routeTag);
                });
            });
        }
        
        if (!showAll && placeList.length === 1) {
            return showPlace(placeList[0].id);
        }
        
        geo.sortByCurrentLocation(placeList).done(function (position) {
            if (!showAll && placeList.length > 1) {
                if (geo.distance(position, placeList[0]) < NEARBY_IN_KM &&
                        geo.distance(position, placeList[1]) >= NEARBY_IN_KM) {
                    location.hash = "#page=place&place=" + placeList[0].id;
                    return;
                }
            }

            var options = {
                addHref: "#page=places&op=add",
                getEntryHref: function (place) {
                    return "#page=place&place=" + place.id;
                },
                getHighlight: function (place) { return false; },
                getLeft: function (place) {
                    return titleTemplate(place);
                },
                getRight: function (place) {
                    var meters = geo.distance(position, place),
                        miles = geo.kilometersToMiles(meters),
                        distance = distanceTemplate({miles: miles});
                    return titleTemplate({title: distance});
                },
                getRemoveHref: function (place) {
                    return "#page=places&op=remove&place=" + place.id;
                },
                confirmRemove: function (place) {
                    return window.confirm("Remove place " + place.title + "?");
                }
            };
            
            showList("Places", placeList, options);
            
            // warm up cache
            preloadPredictions();
            refreshTimer = window.setInterval(preloadPredictions, REFRESH_INTERVAL);
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
