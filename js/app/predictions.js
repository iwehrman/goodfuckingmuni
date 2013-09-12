/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        Q = require("q"),
        command = require("app/command");

    var PREDICTION_TIMEOUT = 1000 * 30; // 30 seconds
    
    var cachedPredictions = {};
        
    var cmdPredictions = command.defineCommand("predictions", ["r", "s"]),
        cmdPredictionsForMultiStops = command.defineCommand("predictionsForMultiStops", ["stops"]);
    
    function Prediction(dirTag, epochTime, seconds, minutes, isDeparture, affectedByLayover, vehicle) {
        this.dirTag = dirTag;
        this.epochTime = epochTime;
        this.seconds = seconds;
        this.minutes = minutes;
        this.isDeparture = isDeparture;
        this.affectedByLayover = affectedByLayover;
        this.vehicle = vehicle;
    }
    
    Prediction.prototype.clone = function () {
        return new Prediction(this.dirTag, this.epochTime, this.seconds,
                              this.minutes, this.isDeparture,
                              this.affectedByLayover, this.vehicle);
    };
    
    function handlePredictionData(data) {
        var predictions = [];
                
        $(data).find("prediction").each(function (i, p) {
            var $prediction  = $(p),
                dirTag = $prediction.attr("dirTag"),
                epochTime = parseInt($prediction.attr("epochTime"), 10),
                seconds = parseInt($prediction.attr("seconds"), 10),
                minutes = parseInt($prediction.attr("minutes"), 10),
                isDeparture = $prediction.attr("isDeparture") === "true",
                affectedByLayover = $prediction.attr("affectedByLayover") === "true",
                vehicle = parseInt($prediction.attr("vehicle"), 10),
                prediction = new Prediction(dirTag, epochTime, seconds, minutes,
                                            isDeparture, affectedByLayover, vehicle);
            
            predictions.push(prediction);
        });
        
        return predictions.sort(function (a, b) {
            return a.minutes - b.minutes;
        });
    }
    
    function cachePredictions(routeTag, stopTag, predictions) {
        var timer = setTimeout(function () {
            delete cachedPredictions[routeTag][stopTag];
        }, PREDICTION_TIMEOUT);
        
        //TODO should enforce a minimum 10-second prediction lifetime
        function invalidate() {
            clearTimeout(timer);
            delete cachedPredictions[routeTag][stopTag];
        }
        
        cachedPredictions[routeTag][stopTag] = {
            predictions: predictions,
            invalidate: invalidate
        };
    }
    
    function getPredictions(routeTag, stopTag, force) {
        if (!cachedPredictions[routeTag]) {
            cachedPredictions[routeTag] = {};
        }

        if (force && cachedPredictions[routeTag][stopTag]) {
            cachedPredictions[routeTag][stopTag].invalidate();
        }
        
        if (cachedPredictions[routeTag][stopTag]) {
            var predictions = cachedPredictions[routeTag][stopTag].predictions.slice(0);
            return Q.when(predictions);
        } else {
            return cmdPredictions(routeTag, stopTag)
                .then(function (data) {
                    var predictions = handlePredictionData(data);
                    cachePredictions(routeTag, stopTag, predictions);
                    return predictions;
                });
        }
    }
    
    function getPredictionsForMultiStops(stopObjs, force) {
        var deferred = Q.defer(),
            predictionsForMultiStops = {},
            uncachedStopObjs = [];
        
        stopObjs.forEach(function (stopObj) {
            var routeTag = stopObj.routeTag,
                stopTag = stopObj.stopTag;
            
            if (!cachedPredictions[routeTag]) {
                cachedPredictions[routeTag] = {};
            }
            
            if (force && cachedPredictions[routeTag][stopTag]) {
                cachedPredictions[routeTag][stopTag].invalidate();
            }
            
            if (!cachedPredictions[routeTag][stopTag]) {
                uncachedStopObjs.push(stopObj);
            } else {
                if (!predictionsForMultiStops[routeTag]) {
                    predictionsForMultiStops[routeTag] = {};
                }
                predictionsForMultiStops[routeTag][stopTag] = cachedPredictions[routeTag][stopTag].predictions.slice(0);
            }
        });

        
        if (uncachedStopObjs.length > 0) {
            var stopParams = uncachedStopObjs.map(function (stopObj) {
                return stopObj.routeTag + "|" + stopObj.stopTag;
            });
            
            deferred.notify(predictionsForMultiStops);
            
            cmdPredictionsForMultiStops(stopParams).then(function (data) {
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
            }, function (err) {
                deferred.reject(err);
            });
        } else {
            deferred.resolve(predictionsForMultiStops);
        }

        return deferred.promise;
    }
    
    exports.getPredictions = getPredictions;
    exports.getPredictionsForMultiStops = getPredictionsForMultiStops;
});
