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

    function makeListEntry(obj, index, opts) {
        var entrySettings = {
            href: opts.getEntryHref ? opts.getEntryHref(obj, index) : null,
            tags: opts.getTags ? opts.getTags(obj, index) : null,
            highlight: opts.getHighlight ? opts.getHighlight(obj, index) : null,
            left: opts.getLeft ? opts.getLeft(obj, index) : null,
            right: opts.getRight ? opts.getRight(obj, index) : null
        },  entryHTML = entryTemplate(entrySettings),
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
        
        list.forEach(function (obj, index) {
            var $entry = makeListEntry(obj, index, opts);
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
    
    function showPredictions(placeId, routeTag, stopTag) {
        routes.getRoute(routeTag).done(function (route) {
            preds.getPredictions(routeTag, stopTag).done(function (predictions) {
                var stop = route.stops[stopTag],
                    title = stop.title;
                
                var options = {
                    backHref: "#page=place&place=" + placeId,
                    getHighlight: function (prediction) { return false; },
                    getLeft: function (prediction) {
                        return predictionsTemplate({predictions: prediction});
                    }
                };
                
                showList(title, predictions, options);
                refreshTimer = window.setInterval(function () {
                    preds.getPredictions(routeTag, stopTag).done(function (newPredictions) {
                        $content.find(".entry").each(function (index, entry) {
                            var $entry = $(entry);
                            
                            $entry.find(".entry__minutes").each(function (_index, minutes) {
                                if (index < newPredictions.length) {
                                    $(minutes).text(newPredictions[index].minutes);
                                    return true;
                                } else {
                                    return false;
                                }
                            });
                        });
                    });
                }, REFRESH_INTERVAL);
            }).fail(function (err) {
                console.error("[showPredictions] failed to get predictions: " + err);
            });
        }).fail(function (err) {
            console.error("[showPredictions] failed to get route: " + err);
        });
    }
    
    function showStops(placeId, routeTag, dirTag, scroll) {
        var locationPromise = geo.getLocation();
        routes.getRoute(routeTag).done(function (route) {
            locationPromise.done(function (position) {
                var direction = route.directions[dirTag],
                    title = route.title + ": " + direction.name,
                    closestStop = direction.getClosestStop(position);
                
                var options = {
                    backHref: "#page=directions&place=" + placeId + "&route=" + routeTag,
                    getHighlight: function (stop, index) {
                        return stop === closestStop;
                    },
                    getEntryHref: function (stop) {
                        return "#page=place&op=add&place=" + placeId +
                            "&route=" + routeTag + "&direction=" + dirTag +
                            "&stop=" + stop.tag;
                    },
                    getLeft: function (stop) {
                        return stop.title;
                    },
                    getRight: function (stop) {
                        if (stop === closestStop) {
                            return "&rarr;&larr;";
                        } else {
                            return direction.isApproaching(stop, position) ? "&ensp;&larr;" : "&rarr;&ensp;";
                        }
                    }
                };
                
                showList(title, direction.stops, options);
                
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

            var options = {
                backHref: "#page=routes&place=" + placeId,
                getEntryHref: function (direction) {
                    var routeTag = route.tag;
                    return "#page=stops&place=" + placeId +
                        "&route=" + routeTag + "&direction=" + direction.tag;
                },
                getLeft: function (direction) {
                    return direction.title;
                }
            };
            
            showList(route.title, directions, options);
        }).fail(function (err) {
            console.error("[showDirections] failed to get route: " + err);
        });
    }
    
    function showRoutes(placeId) {
        routes.getRoutes().done(function (routes) {
            var options = {
                backHref: "#page=place&place=" + placeId,
                getEntryHref: function (route) {
                    var routeTag = route.tag;
                    return "#page=directions&place=" + placeId +
                        "&route=" + routeTag;
                },
                getLeft: function (route) {
                    return route.title;
                }
            };
        
            showList("Routes", routes, options);
        }).fail(function (err) {
            console.error("[showRoutes] failed to get routes: " + err);
        });
    }
    
    function showPlace(placeId) {
        var place = places.getPlace(placeId),
            predictionsPromise = preds.getPredictionsForMultiStops(place.stops),
            title = place.title,
            routeObjMap = {};

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
                
                var options = {
                    backHref: "#page=places",
                    addHref: "#page=routes&place=" + placeId,
                    getEntryHref: function (routeObj) {
                        var routeTag = routeObj.route.tag,
                            stopTag = routeObj.stopTag;
                        
                        return "#page=predictions&place=" + placeId +
                            "&route=" + routeTag + "&stop=" + stopTag;
                    },
                    getTags: function (routeObj) {
                        return [{tag: "route", value: routeObj.route.tag},
                                {tag: "dir", value: routeObj.dirTag},
                                {tag: "stop", value: routeObj.stopTag}];
                    },
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
                    function updateEntries(predictionObjects) {
                        $content.find(".entry").each(function (index, entry) {
                            var $entry = $(entry),
                                data = entry.dataset,
                                routeTag = data.route,
                                stopTag = data.stop,
                                predictionRoute = predictionObjects[routeTag],
                                predictions;
                            
                            if (predictionRoute && predictionRoute[stopTag]) {
                                predictions = predictionRoute[stopTag];
                                $entry.find(".entry__right").animate({opacity: 1.0});
                                $entry.find(".entry__minutes").each(function (index, minutes) {
                                    if (index < 3 && predictions.length > index) {
                                        $(minutes).text(predictions[index].minutes);
                                        return true;
                                    } else {
                                        return false;
                                    }
                                });
                            } else {
                                $entry.find(".entry__right").animate({opacity: 0.5});
                            }
                        });
                    }
                    
                    preds.getPredictionsForMultiStops(place.stops)
                        .progress(updateEntries)
                        .done(updateEntries)
                        .fail(updateEntries.bind(null, {}));
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
        
        geo.sortByCurrentLocation(placeList).done(function (position) {
            if (!showAll && placeList.length >= 1 &&
                    geo.distance(position, placeList[0]) < NEARBY_IN_KM &&
                    (placeList.length < 2 ||
                        geo.distance(position, placeList[1]) >= NEARBY_IN_KM)) {
                return showPlace(placeList[0].id);
            }

            var options = {
                addHref: "#page=places&op=add",
                getEntryHref: function (place) {
                    return "#page=place&place=" + place.id;
                },
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
