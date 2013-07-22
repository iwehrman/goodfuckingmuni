/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        command = require("app/command");

    var PREDICTION_TIMEOUT = 1000 * 60; // 1 minute
    
    var cachedPredictions = {};
        
    var cmdPredictions = command.defineCommand("predictions", ["r", "s"]),
        cmdPredictionsForMultiStops = command.defineCommand("predictionsForMultiStops", ["stops"]);
    
    function handlePredictionData(data) {
        var predictions = [];
                
        $(data).find("prediction").each(function (i, p) {
            var $prediction  = $(p),
                dirTag = $prediction.attr("dirTag"),
                epochTime = parseInt($prediction.attr("epochTime"), 10),
                seconds = parseInt($prediction.attr("seconds"), 10),
                minutes = parseInt($prediction.attr("minutes"), 10),
                isDeparture = $prediction.attr("isDeparture") === "true",
                affectedByLayover = $prediction.attr("affectedByLayover") === "true";
                
            predictions.push({
                dirTag: dirTag,
                epochTime: epochTime,
                seconds: seconds,
                minutes: minutes,
                isDeparture: isDeparture,
                affectedByLayover: affectedByLayover
            });
        });
        
        return predictions.sort(function (a, b) {
            return a.minutes - b.minutes;
        });
    }
    
    function cachePredictions(routeTag, stopTag, predictions) {
        cachedPredictions[routeTag][stopTag] = predictions;
        setTimeout(function () {
            delete cachedPredictions[routeTag][stopTag];
        }, PREDICTION_TIMEOUT);
    }
    
    function getPredictions(routeTag, stopTag) {
        var deferred = $.Deferred();
        
        if (!cachedPredictions[routeTag]) {
            cachedPredictions[routeTag] = {};
        }

        if (cachedPredictions[routeTag][stopTag]) {
            deferred.resolve(cachedPredictions[routeTag][stopTag]);
        } else {
            cmdPredictions(routeTag, stopTag).done(function (data) {
                var predictions = handlePredictionData(data);
                cachePredictions(routeTag, stopTag, predictions);
                deferred.resolve(predictions);
            }).fail(deferred.reject.bind(deferred));
        }
        
        return deferred.promise();
    }
    
    function getPredictionsForMultiStops(stopObjs) {
        var deferred = $.Deferred(),
            predictionsForMultiStops = {},
            uncachedStopObjs = [];
        
        stopObjs.forEach(function (stopObj) {
            var routeTag = stopObj.routeTag,
                stopTag = stopObj.stopTag;
            
            if (!cachedPredictions[routeTag]) {
                cachedPredictions[routeTag] = {};
            }
            
            if (!cachedPredictions[routeTag][stopTag]) {
                uncachedStopObjs.push(stopObj);
            } else {
                if (!predictionsForMultiStops[routeTag]) {
                    predictionsForMultiStops[routeTag] = {};
                }
                predictionsForMultiStops[routeTag][stopTag] = cachedPredictions[routeTag][stopTag];
            }
        });
        
        if (uncachedStopObjs.length > 0) {
            var stopParams = uncachedStopObjs.map(function (stopObj) {
                return stopObj.routeTag + "|" + stopObj.stopTag;
            });
            
            cmdPredictionsForMultiStops(stopParams).done(function (data) {
                $(data).find("predictions").each(function (i, d) {
                    var $data = $(d),
                        predictions = handlePredictionData(d),
                        routeTag = $data.attr("routeTag"),
                        stopTag = $data.attr("stopTag");
                    
                    cachePredictions(routeTag, stopTag, predictions);
                    if (!predictionsForMultiStops[routeTag]) {
                        predictionsForMultiStops[routeTag] = {};
                    }
                    predictionsForMultiStops[routeTag][stopTag] = predictions;
                });
                
                deferred.resolve(predictionsForMultiStops);
            });
        } else {
            deferred.resolve(predictionsForMultiStops);
        }

        return deferred.promise();
    }
    
    exports.getPredictions = getPredictions;
    exports.getPredictionsForMultiStops = getPredictionsForMultiStops;
});
